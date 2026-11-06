import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { createStudioFixture, readTalkFixture } from "./studio-fixture.mjs";

const root = path.resolve(import.meta.dirname, "..");
const temp = await mkdtemp(path.join(tmpdir(), "soda-server-settings-"));
const legacyKey = "test-legacy-openai-value";
const serverKey = "test-runtime-openai-value";
const mock = createServer((_req, res) => res.end(JSON.stringify({ data: [{ id: "mock-model" }] })));
let child;
try {
  mock.listen(0, "127.0.0.1");
  await once(mock, "listening");
  const lmStudioUrl = `http://127.0.0.1:${mock.address().port}`;
  const expiresAt = Date.now() + 60 * 60 * 1000;
  const users = ["admin", "student"].map(role => ({
    id: role,
    username: role,
    displayName: role,
    personalApiKey: `settings-test-${role}`,
    role,
    keyRegistrations: [{ registeredAt: Date.now(), expiresAt, validityDays: 60 }]
  }));
  await mkdir(path.join(temp, "data"));
  await writeFile(path.join(temp, "data/db.json"), JSON.stringify({
    users, chats: [], settings: { lmStudioUrl, openaiApiKey: legacyKey }, curriculumWeekShiftVersion: 1
  }));
  const studioPath = createStudioFixture(temp);

  child = spawn(process.execPath, [
    "--import", path.join(root, "node_modules/tsx/dist/loader.mjs"), path.join(root, "server.ts")
  ], {
    cwd: temp,
    env: { ...process.env, NODE_ENV: "production", SODA_STUDIO_DB_PATH: studioPath, PORT: "17996", OPENAI_API_KEY: serverKey },
    stdio: "ignore"
  });
  const api = (url, role, body) => fetch(`http://127.0.0.1:17996${url}`, {
    method: body ? "POST" : "GET",
    headers: {
      ...(role ? { Authorization: `Bearer settings-test-${role}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let ready = false;
  for (let attempt = 0; attempt < 100 && child.exitCode === null; attempt++) {
    try {
      ready = (await api("/api/server-info")).ok;
      if (ready) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, "fixture server did not start");

  const config = "/api/lmstudio/config";
  const test = "/api/lmstudio/test";
  assert.equal((await api("/api/auth/me", "student")).status, 200);
  assert.equal((await api("/api/auth/me", "admin")).status, 200);
  for (const [role, status] of [[undefined, 401], ["student", 403]]) {
    assert.equal((await api(config, role)).status, status);
    assert.equal((await api(config, role, { modelName: "unauthorized" })).status, status);
    assert.equal((await api(test, role, { lmStudioUrl })).status, status);
  }
  const initial = await api(config, "admin");
  assert.equal(initial.status, 200);
  assert.equal(initial.headers.get("cache-control"), "no-store");
  const settings = await initial.json();
  assert.equal(settings.openaiConfigured, true);
  assert.notEqual(settings.modelName, "unauthorized");
  assert.equal((await api(config, "admin", { openaiApiKey: "rejected-browser-value" })).status, 400);

  const updated = await api(config, "admin", { modelName: "mock-model", dailyGptQuota: 12 });
  assert.equal(updated.status, 200);
  const saved = (await updated.json()).settings;
  assert.equal(saved.modelName, "mock-model");
  assert.equal(saved.dailyGptQuota, 12);
  for (const result of [settings, saved, readTalkFixture(studioPath).settings]) {
    assert.equal(Object.hasOwn(result, "openaiApiKey"), false);
    assert.equal(JSON.stringify(result).includes(legacyKey), false);
    assert.equal(JSON.stringify(result).includes(serverKey), false);
  }
  assert.equal((await (await api(test, "admin", { lmStudioUrl })).json()).connected, true);
  console.log("PASS: server settings require admin access, and OpenAI keys stay out of responses and active storage");
} finally {
  if (child?.exitCode === null) {
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    await exited;
  }
  mock.closeAllConnections();
  mock.close();
  await rm(temp, { recursive: true, force: true });
}
