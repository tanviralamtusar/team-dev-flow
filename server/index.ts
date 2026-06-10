import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { seedDatabase } from "./seed.js";

// Route imports
import authRouter from "./routes/auth.js";
import itemsRouter from "./routes/items.js";
import columnsRouter from "./routes/columns.js";
import tagsRouter from "./routes/tags.js";
import assigneesRouter from "./routes/assignees.js";
import profilesRouter from "./routes/profiles.js";
import { authenticateToken } from "./middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (avatars / images) as static
app.use("/uploads", express.static(UPLOADS_DIR));

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/items", authenticateToken, itemsRouter);
app.use("/api/columns", authenticateToken, columnsRouter);
app.use("/api/tags", authenticateToken, tagsRouter);
app.use("/api/assignees", authenticateToken, assigneesRouter);
app.use("/api/profiles", authenticateToken, profilesRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Serve frontend assets from Vite build output
const CLIENT_DIR = path.join(__dirname, "..", "dist");
app.use(express.static(CLIENT_DIR));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(CLIENT_DIR, "index.html"));
});

// ── Seed + Start ───────────────────────────────────────────────────────────────
seedDatabase();

app.listen(PORT, () => {
  console.log(`🚀 Kanban API server running on http://localhost:${PORT}`);
  console.log(`   /api/items, /api/columns, /api/tags, /api/assignees, /api/profiles`);
  console.log(`   /uploads  (static avatar/image files)`);
});
