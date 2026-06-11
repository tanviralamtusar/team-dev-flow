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
  CREATE TABLE IF NOT EXISTS projects (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    ownerId   TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (ownerId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS project_members (
    projectId TEXT NOT NULL,
    userId    TEXT NOT NULL,
    role      TEXT NOT NULL DEFAULT 'member',
    createdAt TEXT NOT NULL,
    PRIMARY KEY (projectId, userId),
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invitations (
    id        TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    inviterId TEXT NOT NULL,
    email     TEXT NOT NULL,
    status    TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, declined
    createdAt TEXT NOT NULL,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (inviterId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS items (
    id        TEXT PRIMARY KEY,
    projectId TEXT,
    data      TEXT NOT NULL,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS columns (
    id        TEXT PRIMARY KEY,
    projectId TEXT,
    data      TEXT NOT NULL,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tags (
    id        TEXT PRIMARY KEY,
    projectId TEXT,
    data      TEXT NOT NULL,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assignees (
    id        TEXT PRIMARY KEY,
    projectId TEXT,
    data      TEXT NOT NULL,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
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

  CREATE TABLE IF NOT EXISTS users (
    id        TEXT PRIMARY KEY,
    username  TEXT UNIQUE NOT NULL,
    password  TEXT NOT NULL,
    email     TEXT UNIQUE NOT NULL,
    createdAt TEXT NOT NULL
  );
`);

export default db;
