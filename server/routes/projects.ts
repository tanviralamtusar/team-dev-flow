import { Router, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/projects - List projects user is member of
router.get("/", (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const projects = db.prepare(`
      SELECT p.* FROM projects p
      JOIN project_members pm ON p.id = pm.projectId
      WHERE pm.userId = ?
    `).all(userId);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// POST /api/projects - Create a new project
router.post("/", (req: AuthRequest, res: Response) => {
  try {
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

export default router;
