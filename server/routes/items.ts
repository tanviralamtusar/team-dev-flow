import { Router, Request, Response } from "express";
import db from "../db.js";

const router = Router();

// GET /api/items
router.get("/", (_req: Request, res: Response) => {
  try {
    const rows = db.prepare("SELECT data FROM items").all() as { data: string }[];
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
router.post("/", (req: Request, res: Response) => {
  try {
    const item = req.body;
    if (!item?.id) return res.status(400).json({ error: "Missing item.id" });
    db.prepare("INSERT OR REPLACE INTO items (id, data) VALUES (?, ?)").run(
      item.id,
      JSON.stringify(item)
    );
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to save item" });
  }
});

// PUT /api/items/:id — update existing
router.put("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = req.body;
    const result = db
      .prepare("UPDATE items SET data = ? WHERE id = ?")
      .run(JSON.stringify({ ...item, id }), id);
    if (result.changes === 0) return res.status(404).json({ error: "Item not found" });
    res.json({ ...item, id });
  } catch (err) {
    res.status(500).json({ error: "Failed to update item" });
  }
});

// DELETE /api/items/:id
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = db.prepare("DELETE FROM items WHERE id = ?").run(id);
    if (result.changes === 0) return res.status(404).json({ error: "Item not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete item" });
  }
});

export default router;
