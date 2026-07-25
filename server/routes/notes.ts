import { Router, Response } from "express";
import { randomUUID } from "crypto";
import db from "../db.js";
import { AuthRequest } from "../middleware/auth.js";
import { verifyProjectMember } from "../middleware/project.js";

const router = Router();

const MAX_TITLE = 160;

interface NoteRow {
  id: string;
  projectId: string;
  title: string;
  content: string;
  excerpt: string;
  pinned: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

/**
 * Note bodies are HTML authored in a contentEditable surface. The client
 * sanitizes before rendering, but anything persisted is also served to every
 * other project member — so strip the executable surface here too rather than
 * trusting a single layer.
 */
const sanitize = (html: string) =>
  html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)\b[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]*)/gi, "");

/** Plain-text preview so the list rail never has to ship full documents. */
const toExcerpt = (html: string) =>
  html
    // Block boundaries become spaces so adjacent blocks do not run together;
    // inline tags vanish so words keep their own spacing.
    .replace(/<\/?(p|div|br|li|ul|ol|h[1-6]|blockquote|pre|hr|table|tr|td|th)\b[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);

// Note bodies can be long; the list endpoint returns metadata + excerpt only.
const toMeta = (r: Omit<NoteRow, "content">) => ({
  id: r.id,
  title: r.title,
  excerpt: r.excerpt,
  pinned: !!r.pinned,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  updatedBy: r.updatedBy,
});

const META_COLUMNS =
  "id, projectId, title, excerpt, pinned, createdAt, updatedAt, updatedBy";

// GET /api/notes — metadata for every note in the project, pinned first
router.get("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.query;
    const rows = db
      .prepare(
        `SELECT ${META_COLUMNS} FROM notes WHERE projectId = ? ORDER BY pinned DESC, updatedAt DESC`
      )
      .all(projectId) as Omit<NoteRow, "content">[];
    res.json(rows.map(toMeta));
  } catch {
    res.status(500).json({ error: "Failed to fetch notes" });
  }
});

// GET /api/notes/:id — full document
router.get("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;
    const row = db
      .prepare("SELECT * FROM notes WHERE id = ? AND projectId = ?")
      .get(id, projectId) as NoteRow | undefined;
    if (!row) return res.status(404).json({ error: "Note not found" });
    res.json({ ...toMeta(row), content: row.content });
  } catch {
    res.status(500).json({ error: "Failed to fetch note" });
  }
});

// POST /api/notes — create a new note
router.post("/", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { projectId, title, content } = req.body;
    const now = new Date().toISOString();
    const html = sanitize((content ?? "").toString());
    const note = {
      id: randomUUID(),
      projectId,
      title: (title || "Untitled document").toString().slice(0, MAX_TITLE),
      content: html,
      excerpt: toExcerpt(html),
      pinned: 0,
      createdAt: now,
      updatedAt: now,
      updatedBy: req.user?.username ?? null,
    };

    db.prepare(
      `INSERT INTO notes (id, projectId, title, content, excerpt, pinned, createdAt, updatedAt, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      note.id,
      note.projectId,
      note.title,
      note.content,
      note.excerpt,
      note.pinned,
      note.createdAt,
      note.updatedAt,
      note.updatedBy
    );

    res.status(201).json(toMeta(note as NoteRow));
  } catch {
    res.status(500).json({ error: "Failed to create note" });
  }
});

// PUT /api/notes/:id — autosave the body, rename, or toggle pin
router.put("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId, title, content, pinned } = req.body;
    const now = new Date().toISOString();

    const existing = db
      .prepare("SELECT id FROM notes WHERE id = ? AND projectId = ?")
      .get(id, projectId);
    if (!existing) return res.status(404).json({ error: "Note not found" });

    // Body autosaves, renames and pin toggles each arrive as their own request —
    // only touch the field that was actually sent so none clobbers the others.
    const editor = req.user?.username ?? null;

    if (content !== undefined) {
      const html = sanitize(content.toString());
      db.prepare(
        "UPDATE notes SET content = ?, excerpt = ?, updatedAt = ?, updatedBy = ? WHERE id = ? AND projectId = ?"
      ).run(html, toExcerpt(html), now, editor, id, projectId);
    }
    if (title !== undefined) {
      db.prepare(
        "UPDATE notes SET title = ?, updatedAt = ?, updatedBy = ? WHERE id = ? AND projectId = ?"
      ).run(title.toString().slice(0, MAX_TITLE) || "Untitled document", now, editor, id, projectId);
    }
    // Pinning is an organisational flag, not an edit — it leaves updatedAt alone
    // so shuffling the rail order does not rewrite everyone's "last edited".
    if (pinned !== undefined) {
      db.prepare("UPDATE notes SET pinned = ? WHERE id = ? AND projectId = ?").run(
        pinned ? 1 : 0,
        id,
        projectId
      );
    }

    const row = db
      .prepare(`SELECT ${META_COLUMNS} FROM notes WHERE id = ?`)
      .get(id) as Omit<NoteRow, "content">;
    res.json(toMeta(row));
  } catch {
    res.status(500).json({ error: "Failed to save note" });
  }
});

// DELETE /api/notes/:id
router.delete("/:id", verifyProjectMember, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.query;
    const result = db.prepare("DELETE FROM notes WHERE id = ? AND projectId = ?").run(id, projectId);
    if (result.changes === 0) return res.status(404).json({ error: "Note not found" });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete note" });
  }
});

export default router;
