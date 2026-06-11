import { Router, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import db from "../db.js";
import { AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/invitations - List pending invitations for current user
router.get("/", (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string };
    
    const invitations = db.prepare(`
      SELECT i.*, p.name as projectName, u.username as inviterName
      FROM invitations i
      JOIN projects p ON i.projectId = p.id
      JOIN users u ON i.inviterId = u.id
      WHERE i.email = ? AND i.status = 'pending'
    `).all(user.email);
    
    res.json(invitations);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

// POST /api/invitations/invite - Invite a user to a project
router.post("/invite", (req: AuthRequest, res: Response) => {
  try {
    const { projectId, email } = req.body;
    const inviterId = req.user?.userId;

    if (!projectId || !email || !inviterId) {
      return res.status(400).json({ error: "Project ID and email are required" });
    }

    // Check if inviter is member of project
    const member = db.prepare("SELECT * FROM project_members WHERE projectId = ? AND userId = ?").get(projectId, inviterId);
    if (!member) {
      return res.status(403).json({ error: "You are not a member of this project" });
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO invitations (id, projectId, inviterId, email, status, createdAt)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(id, projectId, inviterId, email.toLowerCase(), createdAt);

    res.status(201).json({ id, projectId, email, status: 'pending' });
  } catch (error) {
    res.status(500).json({ error: "Failed to send invitation" });
  }
});

// POST /api/invitations/:id/accept - Accept an invitation
router.post("/:id/accept", (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string };

    const invitation = db.prepare("SELECT * FROM invitations WHERE id = ?").get(id) as any;
    if (!invitation || invitation.email !== user.email) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: "Invitation already processed" });
    }

    const acceptTransaction = db.transaction(() => {
      db.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(id);
      
      db.prepare(`
        INSERT OR IGNORE INTO project_members (projectId, userId, role, createdAt)
        VALUES (?, ?, 'member', ?)
      `).run(invitation.projectId, userId, new Date().toISOString());
    });

    acceptTransaction();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to accept invitation" });
  }
});

// POST /api/invitations/:id/decline - Decline an invitation
router.post("/:id/decline", (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as { email: string };

    const invitation = db.prepare("SELECT * FROM invitations WHERE id = ?").get(id) as any;
    if (!invitation || invitation.email !== user.email) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    db.prepare("UPDATE invitations SET status = 'declined' WHERE id = ?").run(id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to decline invitation" });
  }
});

export default router;
