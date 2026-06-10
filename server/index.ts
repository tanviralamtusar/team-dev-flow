import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { seedDatabase } from "./seed.js";

// Route imports
import itemsRouter from "./routes/items.js";
import columnsRouter from "./routes/columns.js";
import tagsRouter from "./routes/tags.js";
import assigneesRouter from "./routes/assignees.js";
import profilesRouter from "./routes/profiles.js";

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
app.use("/api/items", itemsRouter);
app.use("/api/columns", columnsRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/assignees", assigneesRouter);
app.use("/api/profiles", profilesRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Seed + Start ───────────────────────────────────────────────────────────────
seedDatabase();

app.listen(PORT, () => {
  console.log(`🚀 Kanban API server running on http://localhost:${PORT}`);
  console.log(`   /api/items, /api/columns, /api/tags, /api/assignees, /api/profiles`);
  console.log(`   /uploads  (static avatar/image files)`);
});
