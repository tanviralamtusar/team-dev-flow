/**
 * seed.ts
 * Seeds the SQLite database with initial data on first run.
 * Only inserts data if each table is empty.
 */
import db from "./db.js";
import { INITIAL_COLUMNS, INITIAL_TAGS, INITIAL_ASSIGNEES, INITIAL_ITEMS } from "../src/data.js";

function seedTable(table: string, items: Array<{ id: string; [key: string]: unknown }>) {
  const count = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number }).c;
  if (count > 0) {
    console.log(`  ✓ ${table}: already seeded (${count} rows), skipping`);
    return;
  }
  const insert = db.prepare(`INSERT OR IGNORE INTO ${table} (id, data) VALUES (?, ?)`);
  const insertMany = db.transaction((rows: typeof items) => {
    for (const row of rows) {
      insert.run(row.id, JSON.stringify(row));
    }
  });
  insertMany(items);
  console.log(`  ✓ ${table}: seeded ${items.length} rows`);
}

export function seedDatabase() {
  console.log("🌱 Seeding database...");
  seedTable("columns", INITIAL_COLUMNS);
  seedTable("tags", INITIAL_TAGS);
  seedTable("assignees", INITIAL_ASSIGNEES);
  seedTable("items", INITIAL_ITEMS);
  console.log("✅ Seeding complete\n");
}
