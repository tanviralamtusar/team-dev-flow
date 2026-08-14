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

// Flush any uncommitted WAL data into the main DB file on startup
db.pragma("wal_checkpoint(TRUNCATE)");

// Flush WAL to main DB file on clean shutdown so data survives restarts
process.on("exit", () => db.pragma("wal_checkpoint(TRUNCATE)"));
process.on("SIGINT", () => { db.pragma("wal_checkpoint(TRUNCATE)"); process.exit(0); });
process.on("SIGTERM", () => { db.pragma("wal_checkpoint(TRUNCATE)"); process.exit(0); });

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

  -- Project-scoped tables are keyed by (projectId, id), never by id alone:
  -- the same logical id (a teammate's profile id, a seeded column like
  -- "backlog") must be able to live in several projects at once.
  CREATE TABLE IF NOT EXISTS items (
    id        TEXT NOT NULL,
    projectId TEXT NOT NULL,
    data      TEXT NOT NULL,
    PRIMARY KEY (projectId, id),
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS columns (
    id        TEXT NOT NULL,
    projectId TEXT NOT NULL,
    data      TEXT NOT NULL,
    PRIMARY KEY (projectId, id),
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tags (
    id        TEXT NOT NULL,
    projectId TEXT NOT NULL,
    data      TEXT NOT NULL,
    PRIMARY KEY (projectId, id),
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS assignees (
    id        TEXT NOT NULL,
    projectId TEXT NOT NULL,
    data      TEXT NOT NULL,
    PRIMARY KEY (projectId, id),
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

  -- Excalidraw whiteboards — one row per canvas, scoped to a project
  CREATE TABLE IF NOT EXISTS canvases (
    id        TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    name      TEXT NOT NULL,
    data      TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    updatedBy TEXT,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_canvases_project ON canvases(projectId);

  -- Rich-text documents — one row per note, scoped to a project
  CREATE TABLE IF NOT EXISTS notes (
    id        TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    title     TEXT NOT NULL,
    content   TEXT NOT NULL,               -- sanitized HTML
    excerpt   TEXT NOT NULL DEFAULT '',    -- plain-text preview for the list rail
    pinned    INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    updatedBy TEXT,
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_notes_project ON notes(projectId);

  -- Persistent "check-in" / last-seen tracking per user per project
  CREATE TABLE IF NOT EXISTS check_ins (
    projectId TEXT NOT NULL,
    userId    TEXT NOT NULL,
    lastSeen  TEXT NOT NULL,
    PRIMARY KEY (projectId, userId),
    FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ── Migrations ─────────────────────────────────────────────────────────────────

// Older databases keyed the project-scoped tables on `id` alone. Because ids are
// stable across projects (a teammate's profile id, seeded ids like "backlog" or
// "front"), a row could only exist in ONE project at a time: adding the same
// person to a second project either blew up the bulk-sync transaction or, via
// INSERT OR REPLACE, silently moved them out of the first project. Rebuild those
// tables with a (projectId, id) primary key.
const PROJECT_SCOPED_TABLES = ["items", "columns", "tags", "assignees"];

type ColumnInfo = { name: string; pk: number };

const needsCompositeKey = (table: string): boolean => {
  const cols = db.pragma(`table_info(${table})`) as ColumnInfo[];
  const projectId = cols.find((c) => c.name === "projectId");
  // Already migrated when projectId is part of the primary key.
  return !!projectId && projectId.pk === 0;
};

const rebuildWithCompositeKey = (table: string) => {
  const orphans = (
    db.prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE projectId IS NULL`).get() as { c: number }
  ).c;

  db.exec(`
    CREATE TABLE ${table}__migrated (
      id        TEXT NOT NULL,
      projectId TEXT NOT NULL,
      data      TEXT NOT NULL,
      PRIMARY KEY (projectId, id),
      FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
    );
    INSERT INTO ${table}__migrated (id, projectId, data)
      SELECT id, projectId, data FROM ${table} WHERE projectId IS NOT NULL;
    DROP TABLE ${table};
    ALTER TABLE ${table}__migrated RENAME TO ${table};
  `);

  // Rows with a NULL projectId are pre-multi-project leftovers; every read path
  // filters on `projectId = ?`, so they were already unreachable.
  const dropped = orphans ? `, dropped ${orphans} unscoped row(s)` : "";
  console.log(`  ✓ ${table}: re-keyed on (projectId, id)${dropped}`);
};

const pending = PROJECT_SCOPED_TABLES.filter(needsCompositeKey);

if (pending.length > 0) {
  console.log("🔧 Migrating project-scoped tables to composite (projectId, id) keys...");

  const backupPath = `${DB_PATH}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  console.log(`  ✓ backup written to ${backupPath}`);

  // PRAGMA foreign_keys is a no-op inside a transaction, so toggle it outside.
  db.pragma("foreign_keys = OFF");
  db.transaction(() => pending.forEach(rebuildWithCompositeKey))();
  db.pragma("foreign_keys = ON");

  const violations = db.pragma("foreign_key_check") as unknown[];
  if (violations.length > 0) {
    console.warn(`  ⚠ ${violations.length} foreign key violation(s) after migration`);
  }
  console.log("✅ Migration complete\n");
}

// ── Admin role ────────────────────────────────────────────────────────────────
// SQLite's ALTER TABLE ADD COLUMN is a lightweight, non-rebuilding operation —
// unlike the composite-key migration above, no backup/VACUUM/rebuild is needed.
// Still guard it via table_info so it's safe/idempotent to run on every boot.
const userColumns = db.pragma("table_info(users)") as ColumnInfo[];
if (!userColumns.some((c) => c.name === "isAdmin")) {
  console.log("🔧 Adding isAdmin column to users...");
  db.exec(`ALTER TABLE users ADD COLUMN isAdmin INTEGER NOT NULL DEFAULT 0`);
  console.log("  ✓ users.isAdmin added (default 0)\n");
}

export default db;
