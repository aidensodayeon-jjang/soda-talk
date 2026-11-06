import { randomBytes } from "node:crypto";
import type { Express, RequestHandler } from "express";
import { studioAccounts } from "./studioAccounts";

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const codePattern = /^SODA(?:-[0-9A-HJKMNP-TV-Z]{4}){3}$/;

export function normalizeKitKey(input: string) {
  const compact = input.toUpperCase().replace(/[\s-]/g, "");
  return /^SODA[A-Z0-9]{12}$/.test(compact)
    ? `SODA-${compact.slice(4, 8)}-${compact.slice(8, 12)}-${compact.slice(12)}`
    : "";
}

function generateCode() {
  const chars = Array.from(randomBytes(12), byte => alphabet[byte & 31]).join("");
  return normalizeKitKey(`SODA${chars}`);
}

export function kitKeyError(studio: ReturnType<typeof studioAccounts>, code: string, now: number) {
  const key = studio.prepare(
    "SELECT issued_at, used_at, starts_on, ends_on FROM talk_kit_keys WHERE code = ?"
  ).get(code);
  if (!key || key.issued_at === null) return "발행된 키트 인증 키를 확인해 주세요.";
  if (key.used_at !== null) return "이미 사용된 키트 인증 키입니다.";
  const today = new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
  if ((key.starts_on && today < String(key.starts_on)) || (key.ends_on && today > String(key.ends_on))) {
    return "키트 인증 키의 등록 가능 기간을 확인해 주세요.";
  }
  return null;
}

function parseDate(input: unknown) {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return undefined;
  const date = new Date(`${input}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input) return undefined;
  return input;
}

function parseSchedule(body: { startsOn?: unknown; endsOn?: unknown }) {
  const startsOn = parseDate(body.startsOn);
  const endsOn = parseDate(body.endsOn);
  if (startsOn === undefined || endsOn === undefined || (startsOn && endsOn && startsOn > endsOn)) return null;
  return { startsOn, endsOn };
}

function selection(input: unknown): string[] | null {
  if (!Array.isArray(input) || !input.length || input.length > 500 ||
      input.some(code => typeof code !== "string" || !codePattern.test(code))) return null;
  return [...new Set(input)];
}

export function registerKitKeyRoutes(app: Express, requireAdmin: RequestHandler) {
  app.get("/api/admin/kit-keys", requireAdmin, (_req, res) => {
    const keys = studioAccounts().prepare(`
      SELECT code, created_at AS createdAt, starts_on AS startsOn, ends_on AS endsOn,
             issued_at AS issuedAt, used_at AS usedAt, used_by AS usedBy
      FROM talk_kit_keys ORDER BY created_at DESC, rowid DESC
    `).all();
    res.set("Cache-Control", "no-store").json({ keys });
  });

  app.post("/api/admin/kit-keys", requireAdmin, (req, res) => {
    const body = req.body ?? {};
    const schedule = parseSchedule(body);
    const { count } = body;
    if (!Number.isInteger(count) || count < 1 || count > 100 || !schedule) {
      return res.status(400).json({ error: "발급 수량(1~100개)과 등록 가능 기간을 확인해 주세요." });
    }
    const studio = studioAccounts();
    const insert = studio.prepare(`
      INSERT INTO talk_kit_keys (code, created_at, starts_on, ends_on) VALUES (?, ?, ?, ?)
      ON CONFLICT(code) DO NOTHING
    `);
    const now = Date.now();
    const codes: string[] = [];
    studio.exec("BEGIN IMMEDIATE");
    try {
      while (codes.length < count) {
        const code = generateCode();
        if (insert.run(code, now, schedule.startsOn, schedule.endsOn).changes) codes.push(code);
      }
      studio.exec("COMMIT");
    } catch (error) {
      studio.exec("ROLLBACK");
      throw error;
    }
    return res.status(201).json({ codes });
  });

  const updateSelectedKeys = (operation: "schedule" | "issue"): RequestHandler => (req, res) => {
    const body = req.body ?? {};
    const codes = selection(body.codes);
    const schedule = operation === "schedule" ? parseSchedule(body) : null;
    if (!codes || (operation === "schedule" && !schedule)) {
      return res.status(400).json({ error: "선택한 키와 등록 가능 기간을 확인해 주세요." });
    }
    const studio = studioAccounts();
    const fields = schedule ? "starts_on = ?, ends_on = ?" : "issued_at = COALESCE(issued_at, ?)";
    const values = schedule ? [schedule.startsOn, schedule.endsOn] : [Date.now()];
    studio.exec("BEGIN IMMEDIATE");
    try {
      const result = studio.prepare(`
        UPDATE talk_kit_keys SET ${fields}
        WHERE used_at IS NULL AND code IN (${codes.map(() => "?").join(", ")})
      `).run(...values, ...codes);
      if (Number(result.changes) !== codes.length) {
        studio.exec("ROLLBACK");
        return res.status(409).json({ error: "이미 사용되었거나 존재하지 않는 키가 포함되어 있습니다." });
      }
      studio.exec("COMMIT");
    } catch (error) {
      studio.exec("ROLLBACK");
      throw error;
    }
    return res.json({ success: true });
  };

  app.put("/api/admin/kit-keys/schedule", requireAdmin, updateSelectedKeys("schedule"));
  app.post("/api/admin/kit-keys/issue", requireAdmin, updateSelectedKeys("issue"));
}
