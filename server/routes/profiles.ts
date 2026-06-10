import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage — saves avatar images to /uploads with a unique filename
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const profileId = req.params.id || "unknown";
    cb(null, `avatar-${profileId}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only image files are allowed (jpg, png, gif, webp)"));
  },
});

const router = Router();

// GET /api/profiles/:id
router.get("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
    if (!profile) return res.status(404).json({ error: "Profile not found" });
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// GET /api/profiles  — list all profiles
router.get("/", (_req: Request, res: Response) => {
  try {
    const profiles = db.prepare("SELECT * FROM profiles").all();
    res.json(profiles);
  } catch {
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

// POST /api/profiles — create a new profile
router.post("/", (req: Request, res: Response) => {
  try {
    const { id, displayName, email, avatarUrl, githubId, role } = req.body;
    if (!id || !email) return res.status(400).json({ error: "id and email are required" });
    const createdAt = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO profiles (id, displayName, email, avatarUrl, githubId, role, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, displayName || "", email, avatarUrl || null, githubId || null, role || null, createdAt);
    const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
    res.status(201).json(profile);
  } catch {
    res.status(500).json({ error: "Failed to create profile" });
  }
});

// PUT /api/profiles/:id — update profile fields
router.put("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { displayName, email, githubId, role } = req.body;
    const result = db.prepare(`
      UPDATE profiles
      SET displayName = COALESCE(?, displayName),
          email       = COALESCE(?, email),
          githubId    = COALESCE(?, githubId),
          role        = COALESCE(?, role)
      WHERE id = ?
    `).run(displayName ?? null, email ?? null, githubId ?? null, role ?? null, id);
    if (result.changes === 0) return res.status(404).json({ error: "Profile not found" });
    const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
    res.json(profile);
  } catch {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// POST /api/profiles/:id/avatar — upload avatar image
router.post("/:id/avatar", upload.single("avatar"), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Build public URL path for the stored file
    const avatarUrl = `/uploads/${req.file.filename}`;

    // Delete old avatar file if it exists
    const existing = db.prepare("SELECT avatarUrl FROM profiles WHERE id = ?").get(id) as
      | { avatarUrl?: string }
      | undefined;
    if (existing?.avatarUrl) {
      const oldFile = path.join(UPLOADS_DIR, path.basename(existing.avatarUrl));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    // Update profile record
    const result = db
      .prepare("UPDATE profiles SET avatarUrl = ? WHERE id = ?")
      .run(avatarUrl, id);
    if (result.changes === 0) {
      // Profile doesn't exist yet — create a minimal one
      const now = new Date().toISOString();
      db.prepare(
        `INSERT OR IGNORE INTO profiles (id, displayName, email, avatarUrl, githubId, role, createdAt)
         VALUES (?, '', '', ?, null, null, ?)`
      ).run(id, avatarUrl, now);
    }

    const profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(id);
    res.json({ avatarUrl, profile });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message || "Failed to upload avatar" });
  }
});

export default router;
