import db from "../db.js";

const args = process.argv.slice(2);
const demote = args.includes("--demote");
const identifier = args.find((a) => !a.startsWith("--"));

if (!identifier) {
  console.error("Usage: npm run set-admin -- <email-or-username> [--demote]");
  process.exit(1);
}

const isEmail = identifier.includes("@");
const user = (
  isEmail
    ? db.prepare("SELECT id, username, email, isAdmin FROM users WHERE email = ?").get(identifier.trim().toLowerCase())
    : db.prepare("SELECT id, username, email, isAdmin FROM users WHERE LOWER(username) = LOWER(?)").get(identifier.trim())
) as { id: string; username: string; email: string; isAdmin: number } | undefined;

if (!user) {
  console.error(`No user found matching "${identifier}"`);
  process.exit(1);
}

const newValue = demote ? 0 : 1;
db.prepare("UPDATE users SET isAdmin = ? WHERE id = ?").run(newValue, user.id);

console.log(`✓ ${user.username} (${user.email}) is now ${demote ? "a regular user" : "an admin"}.`);
process.exit(0);
