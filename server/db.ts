import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "kanban.db");

// Open (or create) the SQLite database
const db = new Database(DB_PATH);

// WAL mode = faster concurrent reads
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ── Table Definitions ──────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id    TEXT PRIMARY KEY,
    data  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS columns (
    id    TEXT PRIMARY KEY,
    data  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id    TEXT PRIMARY KEY,
    data  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS assignees (
    id    TEXT PRIMARY KEY,
    data  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id           TEXT PRIMARY KEY,
    displayName  TEXT NOT NULL DEFAULT '',
    email        TEXT NOT NULL DEFAULT '',
    avatarUrl    TEXT,
    githubId     TEXT,
    role         TEXT,
    createdAt    TEXT NOT NULL
  );
`);

export default db;
