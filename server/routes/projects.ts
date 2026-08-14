import { Router, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { AuthRequest, isUserAdmin } from "../middleware/auth.js";

const router = Router();

const activeUsers: Record<string, Record<string, number>> = {};

// GET /api/projects - List projects user is member of (or ALL projects if admin)
router.get("/", (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const projects = isUserAdmin(userId)
      ? db.prepare(`SELECT * FROM projects`).all()
      : db.prepare(`
          SELECT p.* FROM projects p
          JOIN project_members pm ON p.id = pm.projectId
          WHERE pm.userId = ?
        `).all(userId);
    
    const now = Date.now();
    const enrichedProjects = projects.map((p: any) => {
      let activeCount = 0;
      if (activeUsers[p.id]) {
        for (const uid in activeUsers[p.id]) {
          if (now - activeUsers[p.id][uid] < 30000) {
            activeCount++;
          }
        }
      }
      return { ...p, activeCount };
    });
    
    res.json(enrichedProjects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// POST /api/projects - Create a new project (admin only)
router.post("/", (req: AuthRequest, res: Response) => {
  try {
    if (!isUserAdmin(req.user?.userId)) {
      return res.status(403).json({ error: "Only admins can create projects" });
    }

    const { name } = req.body;
    const userId = req.user?.userId;

    if (!name || !userId) {
      return res.status(400).json({ error: "Project name is required" });
    }

    const projectId = uuidv4();
    const createdAt = new Date().toISOString();

    const insertProject = db.transaction(() => {
      db.prepare(`
        INSERT INTO projects (id, name, ownerId, createdAt)
        VALUES (?, ?, ?, ?)
      `).run(projectId, name, userId, createdAt);

      db.prepare(`
        INSERT INTO project_members (projectId, userId, role, createdAt)
        VALUES (?, ?, ?, ?)
      `).run(projectId, userId, "owner", createdAt);
    });

    insertProject();

    res.status(201).json({ id: projectId, name, ownerId: userId, createdAt });
  } catch (error) {
    console.error("Project creation error:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// POST /api/projects/:id/heartbeat
router.post("/:id/heartbeat", (req: AuthRequest, res: Response) => {
  const projectId = req.params.id;
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  if (!activeUsers[projectId]) {
    activeUsers[projectId] = {};
  }

  const now = Date.now();
  activeUsers[projectId][userId] = now;

  // Persist a durable "check-in" so we can show when a user last visited,
  // even after they've gone offline.
  db.prepare(`
    INSERT INTO check_ins (projectId, userId, lastSeen)
    VALUES (?, ?, ?)
    ON CONFLICT(projectId, userId) DO UPDATE SET lastSeen = excluded.lastSeen
  `).run(projectId, userId, new Date(now).toISOString());

  // Cleanup old users and count active (e.g. seen in last 30 seconds)
  let activeCount = 0;
  for (const uid in activeUsers[projectId]) {
    if (now - activeUsers[projectId][uid] < 30000) {
      activeCount++;
    } else {
      delete activeUsers[projectId][uid];
    }
  }

  res.json({ activeCount });
});

// GET /api/projects/:id/checkins — when each member last visited the project
router.get("/:id/checkins", (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const rows = db.prepare(`
      SELECT c.userId, c.lastSeen, p.displayName, p.email, p.avatarUrl
      FROM check_ins c
      LEFT JOIN profiles p ON p.id = c.userId
      WHERE c.projectId = ?
      ORDER BY c.lastSeen DESC
    `).all(projectId);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch check-ins" });
  }
});

export default router;
