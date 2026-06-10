import { Router, Request, Response } from "express";
import db from "../db.js";

const router = Router();

// GET /api/tags
router.get("/", (_req: Request, res: Response) => {
  try {
    const rows = db.prepare("SELECT data FROM tags").all() as { data: string }[];
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch {
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

// POST /api/tags
router.post("/", (req: Request, res: Response) => {
  try {
    const tag = req.body;
    if (!tag?.id) return res.status(400).json({ error: "Missing tag.id" });
    db.prepare("INSERT OR REPLACE INTO tags (id, data) VALUES (?, ?)").run(
      tag.id, JSON.stringify(tag)
    );
    res.status(201).json(tag);
  } catch {
    res.status(500).json({ error: "Failed to save tag" });
  }
});

// PUT /api/tags/:id
router.put("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tag = { ...req.body, id };
    const result = db.prepare("UPDATE tags SET data = ? WHERE id = ?").run(JSON.stringify(tag), id);
    if (result.changes === 0) return res.status(404).json({ error: "Tag not found" });
    res.json(tag);
  } catch {
    res.status(500).json({ error: "Failed to update tag" });
  }
});

// DELETE /api/tags/:id
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = db.prepare("DELETE FROM tags WHERE id = ?").run(id);
    if (result.changes === 0) return res.status(404).json({ error: "Tag not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete tag" });
  }
});

export default router;
