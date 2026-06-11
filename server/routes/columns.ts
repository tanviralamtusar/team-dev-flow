import { Router, Response } from "express";
import db from "../db.js";
import { AuthRequest } from "../middleware/auth.js";
import { verifyProjectMember } from "../middleware/project.js";

const router = Router();

// GET /api/columns
router.get("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const rows = db.prepare("SELECT data FROM columns WHERE projectId = ?").all(projectId) as { data: string }[];
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch {
    res.status(500).json({ error: "Failed to fetch columns" });
  }
});

// POST /api/columns
router.post("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId, ...col } = req.body;
    if (!col?.id) return res.status(400).json({ error: "Missing column.id" });
    if (!projectId) return res.status(400).json({ error: "Missing projectId" });

    db.prepare("INSERT OR REPLACE INTO columns (id, projectId, data) VALUES (?, ?, ?)").run(
      col.id, projectId, JSON.stringify(col)
    );
    res.status(201).json(col);
  } catch {
    res.status(500).json({ error: "Failed to save column" });
  }
});

// PUT /api/columns/:id
router.put("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId, ...rest } = req.body;
    const col = { ...rest, id };
    const result = db
      .prepare("UPDATE columns SET data = ? WHERE id = ? AND projectId = ?")
      .run(JSON.stringify(col), id, projectId);
    if (result.changes === 0) return res.status(404).json({ error: "Column not found" });
    res.json(col);
  } catch {
    res.status(500).json({ error: "Failed to update column" });
  }
});

// DELETE /api/columns/:id
router.delete("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;
    const result = db.prepare("DELETE FROM columns WHERE id = ? AND projectId = ?").run(id, projectId);
    if (result.changes === 0) return res.status(404).json({ error: "Column not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete column" });
  }
});

export default router;
