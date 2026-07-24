import { Router, Response } from "express";
import { randomUUID } from "crypto";
import db from "../db.js";
import { AuthRequest } from "../middleware/auth.js";
import { verifyProjectMember } from "../middleware/project.js";

const router = Router();

// An empty Excalidraw scene — kept server-side so a brand new canvas is
// immediately loadable without the client having to special-case null data.
const EMPTY_SCENE = JSON.stringify({ elements: [], appState: {}, files: {} });

interface CanvasRow {
  id: string;
  projectId: string;
  name: string;
  data: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

// Canvas scenes are large; the list endpoint returns metadata only.
const toMeta = (r: Omit<CanvasRow, "data">) => ({
  id: r.id,
  name: r.name,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  updatedBy: r.updatedBy,
});

// GET /api/canvases — metadata for every canvas in the project
router.get("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const rows = db
      .prepare(
        "SELECT id, projectId, name, createdAt, updatedAt, updatedBy FROM canvases WHERE projectId = ? ORDER BY createdAt ASC"
      )
      .all(projectId) as Omit<CanvasRow, "data">[];
    res.json(rows.map(toMeta));
  } catch {
    res.status(500).json({ error: "Failed to fetch canvases" });
  }
});

// GET /api/canvases/:id — full scene payload
router.get("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;
    const row = db
      .prepare("SELECT * FROM canvases WHERE id = ? AND projectId = ?")
      .get(id, projectId) as CanvasRow | undefined;
    if (!row) return res.status(404).json({ error: "Canvas not found" });

    let scene;
    try {
      scene = JSON.parse(row.data);
    } catch {
      scene = JSON.parse(EMPTY_SCENE);
    }
    res.json({ ...toMeta(row), scene });
  } catch {
    res.status(500).json({ error: "Failed to fetch canvas" });
  }
});

// POST /api/canvases — create a new canvas
router.post("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId, name, scene } = req.body;
    const now = new Date().toISOString();
    const canvas = {
      id: randomUUID(),
      projectId,
      name: (name || "Untitled Canvas").toString().slice(0, 120),
      createdAt: now,
      updatedAt: now,
      updatedBy: req.user?.username ?? null,
    };

    db.prepare(
      "INSERT INTO canvases (id, projectId, name, data, createdAt, updatedAt, updatedBy) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      canvas.id,
      canvas.projectId,
      canvas.name,
      scene ? JSON.stringify(scene) : EMPTY_SCENE,
      canvas.createdAt,
      canvas.updatedAt,
      canvas.updatedBy
    );

    res.status(201).json(toMeta(canvas as CanvasRow));
  } catch {
    res.status(500).json({ error: "Failed to create canvas" });
  }
});

// PUT /api/canvases/:id — autosave the scene and/or rename
router.put("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId, name, scene } = req.body;
    const now = new Date().toISOString();

    const existing = db
      .prepare("SELECT id FROM canvases WHERE id = ? AND projectId = ?")
      .get(id, projectId);
    if (!existing) return res.status(404).json({ error: "Canvas not found" });

    // A rename and a scene autosave arrive as separate requests — only touch
    // the field that was actually sent so neither clobbers the other.
    if (scene !== undefined) {
      db.prepare(
        "UPDATE canvases SET data = ?, updatedAt = ?, updatedBy = ? WHERE id = ? AND projectId = ?"
      ).run(JSON.stringify(scene), now, req.user?.username ?? null, id, projectId);
    }
    if (name !== undefined) {
      db.prepare(
        "UPDATE canvases SET name = ?, updatedAt = ?, updatedBy = ? WHERE id = ? AND projectId = ?"
      ).run(name.toString().slice(0, 120), now, req.user?.username ?? null, id, projectId);
    }

    const row = db
      .prepare("SELECT id, projectId, name, createdAt, updatedAt, updatedBy FROM canvases WHERE id = ?")
      .get(id) as Omit<CanvasRow, "data">;
    res.json(toMeta(row));
  } catch {
    res.status(500).json({ error: "Failed to save canvas" });
  }
});

// DELETE /api/canvases/:id
router.delete("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;
    const result = db.prepare("DELETE FROM canvases WHERE id = ? AND projectId = ?").run(id, projectId);
    if (result.changes === 0) return res.status(404).json({ error: "Canvas not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete canvas" });
  }
});

export default router;
