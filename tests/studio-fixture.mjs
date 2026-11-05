import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import path from "node:path";

export function createStudioFixture(directory) {
  const filename = path.join(directory, "soda.db");
  const db = new DatabaseSync(filename);
  db.exec(`
    CREATE TABLE users (
      username TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
      salt TEXT NOT NULL, hash TEXT NOT NULL, created_at TEXT NOT NULL
    )
  `);
  const legacy = JSON.parse(readFileSync(path.join(directory, "data", "db.json"), "utf8"));
  const insert = db.prepare("INSERT INTO users VALUES (?, ?, ?, '', '', ?)");
  for (const user of legacy.users) {
    insert.run(user.username, user.displayName, user.role, new Date().toISOString());
  }
  db.close();
  return filename;
}

export function readTalkFixture(filename) {
  const db = new DatabaseSync(filename, { readOnly: true });
  try {
    return JSON.parse(db.prepare("SELECT payload FROM talk_state WHERE id = 1").get().payload);
  } finally {
    db.close();
  }
}
