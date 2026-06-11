import { Router, Response } from "express";
import db from "../db.js";
import { AuthRequest } from "../middleware/auth.js";
import { verifyProjectMember } from "../middleware/project.js";

const router = Router();

// GET /api/tags
router.get("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const rows = db.prepare("SELECT data FROM tags WHERE projectId = ?").all(projectId) as { data: string }[];
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch {
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

// POST /api/tags
router.post("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId, ...tag } = req.body;
    if (!tag?.id) return res.status(400).json({ error: "Missing tag.id" });
    if (!projectId) return res.status(400).json({ error: "Missing projectId" });

    db.prepare("INSERT OR REPLACE INTO tags (id, projectId, data) VALUES (?, ?, ?)").run(
      tag.id, projectId, JSON.stringify(tag)
    );
    res.status(201).json(tag);
  } catch {
    res.status(500).json({ error: "Failed to save tag" });
  }
});

// PUT /api/tags/:id
router.put("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId, ...rest } = req.body;
    const tag = { ...rest, id };
    const result = db
      .prepare("UPDATE tags SET data = ? WHERE id = ? AND projectId = ?")
      .run(JSON.stringify(tag), id, projectId);
    if (result.changes === 0) return res.status(404).json({ error: "Tag not found" });
    res.json(tag);
  } catch {
    res.status(500).json({ error: "Failed to update tag" });
  }
});

// DELETE /api/tags/:id
router.delete("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;
    const result = db.prepare("DELETE FROM tags WHERE id = ? AND projectId = ?").run(id, projectId);
    if (result.changes === 0) return res.status(404).json({ error: "Tag not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

export default router;
