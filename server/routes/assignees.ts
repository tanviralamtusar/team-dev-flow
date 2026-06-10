import { Router, Request, Response } from "express";
import db from "../db.js";

const router = Router();

// GET /api/assignees
router.get("/", (_req: Request, res: Response) => {
  try {
    const rows = db.prepare("SELECT data FROM assignees").all() as { data: string }[];
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch {
    res.status(500).json({ error: "Failed to fetch assignees" });
  }
});

// POST /api/assignees
router.post("/", (req: Request, res: Response) => {
  try {
    const assignee = req.body;
    if (!assignee?.id) return res.status(400).json({ error: "Missing assignee.id" });
    db.prepare("INSERT OR REPLACE INTO assignees (id, data) VALUES (?, ?)").run(
      assignee.id, JSON.stringify(assignee)
    );
    res.status(201).json(assignee);
  } catch {
    res.status(500).json({ error: "Failed to save assignee" });
  }
});

// PUT /api/assignees/:id
router.put("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assignee = { ...req.body, id };
    const result = db
      .prepare("UPDATE assignees SET data = ? WHERE id = ?")
      .run(JSON.stringify(assignee), id);
    if (result.changes === 0) return res.status(404).json({ error: "Assignee not found" });
    res.json(assignee);
  } catch {
    res.status(500).json({ error: "Failed to update assignee" });
  }
});

// DELETE /api/assignees/:id
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = db.prepare("DELETE FROM assignees WHERE id = ?").run(id);
    if (result.changes === 0) return res.status(404).json({ error: "Assignee not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete assignee" });
  }
});

export default router;
