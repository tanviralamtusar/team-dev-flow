import { Router, Response } from "express";
import db from "../db.js";
import { AuthRequest } from "../middleware/auth.js";
import { verifyProjectMember } from "../middleware/project.js";

const router = Router();

// GET /api/items
router.get("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const rows = db.prepare("SELECT data FROM items WHERE projectId = ?").all(projectId) as { data: string }[];
    const items = rows.map((r) => JSON.parse(r.data));
    // Sort newest first
    items.sort((a: { createdDate?: string }, b: { createdDate?: string }) =>
      new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime()
    );
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// POST /api/items  — create or upsert
router.post("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId, ...item } = req.body;
    if (!item?.id) return res.status(400).json({ error: "Missing item.id" });
    if (!projectId) return res.status(400).json({ error: "Missing projectId" });

    db.prepare("INSERT OR REPLACE INTO items (id, projectId, data) VALUES (?, ?, ?)").run(
      item.id,
      projectId,
      JSON.stringify(item)
    );
    res.status(201).json(item);
  } catch (err) {
    console.error("Save item error:", err);
    res.status(500).json({ error: "Failed to save item" });
  }
});

// PUT /api/items/:id — update existing
router.put("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId, ...item } = req.body;
    const result = db
      .prepare("UPDATE items SET data = ? WHERE id = ? AND projectId = ?")
      .run(JSON.stringify({ ...item, id }), id, projectId);
    if (result.changes === 0) return res.status(404).json({ error: "Item not found or not in project" });
    res.json({ ...item, id });
  } catch (err) {
    res.status(500).json({ error: "Failed to update item" });
  }
});

// DELETE /api/items/:id
router.delete("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;
    const result = db.prepare("DELETE FROM items WHERE id = ? AND projectId = ?").run(id, projectId);
    if (result.changes === 0) return res.status(404).json({ error: "Item not found or not in project" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;
