import { Router, Response } from "express";
import db from "../db.js";
import { AuthRequest } from "../middleware/auth.js";
import { verifyProjectMember } from "../middleware/project.js";

const router = Router();

// GET /api/assignees
router.get("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const rows = db.prepare("SELECT data FROM assignees WHERE projectId = ?").all(projectId) as { data: string }[];
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch {
    res.status(500).json({ error: "Failed to fetch assignees" });
  }
});

// POST /api/assignees
router.post("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId, ...assignee } = req.body;
    if (!assignee?.id) return res.status(400).json({ error: "Missing assignee.id" });
    if (!projectId) return res.status(400).json({ error: "Missing projectId" });

    db.prepare("INSERT OR REPLACE INTO assignees (id, projectId, data) VALUES (?, ?, ?)").run(
      assignee.id, projectId, JSON.stringify(assignee)
    );
    res.status(201).json(assignee);
  } catch {
    res.status(500).json({ error: "Failed to save assignee" });
  }
});

// PUT /api/assignees/:id
router.put("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId, ...rest } = req.body;
    const assignee = { ...rest, id };
    const result = db
      .prepare("UPDATE assignees SET data = ? WHERE id = ? AND projectId = ?")
      .run(JSON.stringify(assignee), id, projectId);
    if (result.changes === 0) return res.status(404).json({ error: "Assignee not found" });
    res.json(assignee);
  } catch {
    res.status(500).json({ error: "Failed to update assignee" });
  }
});

// DELETE /api/assignees/:id
router.delete("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;
    const result = db.prepare("DELETE FROM assignees WHERE id = ? AND projectId = ?").run(id, projectId);
    if (result.changes === 0) return res.status(404).json({ error: "Assignee not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete assignee" });
  }
});

export default router;
