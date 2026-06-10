import { Router, Request, Response } from "express";
import db from "../db.js";

const router = Router();

// GET /api/columns
router.get("/", (_req: Request, res: Response) => {
  try {
    const rows = db.prepare("SELECT data FROM columns").all() as { data: string }[];
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch {
    res.status(500).json({ error: "Failed to fetch columns" });
  }
});

// POST /api/columns
router.post("/", (req: Request, res: Response) => {
  try {
    const col = req.body;
    if (!col?.id) return res.status(400).json({ error: "Missing column.id" });
    db.prepare("INSERT OR REPLACE INTO columns (id, data) VALUES (?, ?)").run(
      col.id, JSON.stringify(col)
    );
    res.status(201).json(col);
  } catch {
    res.status(500).json({ error: "Failed to save column" });
  }
});

// PUT /api/columns/:id
router.put("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const col = { ...req.body, id };
    const result = db.prepare("UPDATE columns SET data = ? WHERE id = ?").run(JSON.stringify(col), id);
    if (result.changes === 0) return res.status(404).json({ error: "Column not found" });
    res.json(col);
  } catch {
    res.status(500).json({ error: "Failed to update column" });
  }
});

// DELETE /api/columns/:id
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = db.prepare("DELETE FROM columns WHERE id = ?").run(id);
    if (result.changes === 0) return res.status(404).json({ error: "Column not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete column" });
  }
});

export default router;
