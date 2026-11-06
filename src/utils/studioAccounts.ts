import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

let database: DatabaseSync | undefined;

export function studioAccounts() {
  if (database) return database;
  const filename = process.env.SODA_STUDIO_DB_PATH || path.resolve("../soda-studio/data/soda.db");
  if (!existsSync(filename)) throw new Error("Soda Studio database is missing");
  const db = new DatabaseSync(filename);
  try {
    db.exec(`
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS talk_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS talk_signup_requests (
        username TEXT PRIMARY KEY, name TEXT NOT NULL, salt TEXT NOT NULL,
        hash TEXT NOT NULL, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS talk_kit_keys (
        code TEXT PRIMARY KEY,
        created_at INTEGER NOT NULL,
        starts_on TEXT,
        ends_on TEXT,
        issued_at INTEGER,
        used_at INTEGER,
        used_by TEXT
      );
      CREATE INDEX IF NOT EXISTS talk_kit_keys_used_by ON talk_kit_keys (used_by);
    `);
    db.exec("BEGIN IMMEDIATE");
    for (const table of ["talk_signup_requests", "users"]) {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all();
      if (!columns.some(column => column.name === "campus")) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN campus TEXT CHECK (campus IN ('목동', '송도', '기타'))`);
      }
    }
    db.exec("COMMIT");
    database = db;
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

const derive = promisify(scrypt);
export async function studioPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: (await derive(password, salt, 64) as Buffer).toString("hex") };
}

export function equalSecret(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
