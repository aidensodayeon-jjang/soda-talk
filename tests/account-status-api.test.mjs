import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { scryptSync } from 'node:crypto';
import { createStudioFixture, readTalkFixture } from './studio-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const temp = await mkdtemp(path.join(tmpdir(), 'soda-account-status-'));
const port = 17995;
let child;
const request = (url, token, method = 'GET', body) => fetch(`http://127.0.0.1:${port}${url}`, {
  method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});
const login = () => request('/api/auth/login', null, 'POST', { username: 'student', password: 'fixture-password' });
const status = (id, suspended, token = 'key-admin') => request(`/api/admin/users/${id}/status`, token, 'PUT', { suspended });
async function stop() {
  if (child?.exitCode === null) { const done = once(child, 'exit'); child.kill('SIGTERM'); await done; }
}
async function start(studioPath) {
  child = spawn(process.execPath, ['--import', path.join(root, 'node_modules/tsx/dist/loader.mjs'), path.join(root, 'server.ts')], {
    cwd: temp, env: { ...process.env, NODE_ENV: 'production', SODA_STUDIO_DB_PATH: studioPath, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  for (let i = 0; i < 100 && child.exitCode === null; i++) {
    try { if ((await request('/api/server-info')).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`fixture server did not start: ${output}`);
}
try {
  const expiry = Date.now() + 86400000;
  const users = ['admin', 'tutor', 'student', 'other'].map(role => ({
    id: role, username: role, displayName: role, role: role === 'other' ? 'student' : role,
    personalApiKey: `key-${role}`, campus: role === 'other' ? '송도' : '목동', canAccessChat: true,
    accessUntil: new Date(expiry).toISOString(),
    keyRegistrations: [{ registeredAt: Date.now(), expiresAt: expiry, validityDays: 60 }]
  }));
  await mkdir(path.join(temp, 'data'));
  await writeFile(path.join(temp, 'data/db.json'), JSON.stringify({ users, chats: [], settings: {}, curriculumWeekShiftVersion: 1 }));
  const studioPath = createStudioFixture(temp);
  const db = new DatabaseSync(studioPath);
  db.exec('ALTER TABLE users ADD COLUMN campus TEXT');
  for (const user of users) db.prepare('UPDATE users SET campus = ?, salt = ?, hash = ? WHERE username = ?').run(
    user.campus, 'fixture-salt', scryptSync('fixture-password', 'fixture-salt', 64).toString('hex'), user.username
  );
  db.close();
  await start(studioPath);
  assert.equal((await request('/api/auth/me', 'key-admin')).status, 200);
  assert.equal((await request('/api/auth/me', 'key-tutor')).status, 200);
  const loggedIn = await login();
  assert.equal(loggedIn.status, 200);
  const token = (await loggedIn.json()).sessionId;
  assert.equal((await request('/api/auth/me', 'key-student')).status, 200);
  assert.equal((await status('student', true, 'key-student')).status, 403);
  assert.equal((await status('student', true, null)).status, 401);
  assert.equal((await status('admin', true)).status, 400);
  assert.equal((await status('student', 'true')).status, 400);
  assert.equal((await status('other', true, 'key-tutor')).status, 404);
  assert.equal((await status('student', true, 'key-tutor')).status, 200);
  assert.equal((await login()).status, 403);
  assert.equal((await request('/api/chats', token)).status, 401);
  assert.equal((await request('/api/auth/me', 'key-student')).status, 403);
  assert.equal((await request('/v1/chat/completions', 'key-student', 'POST', {})).status, 403);
  assert.equal((await request('/api/hw/tts', 'key-student', 'POST', {})).status, 403);
  const listed = (await (await request('/api/admin/users', 'key-admin')).json()).users.find(user => user.id === 'student');
  assert.equal(listed.suspended, true);
  assert.equal(listed.canAccessChat, false);
  const saved = readTalkFixture(studioPath).talkProfiles.find(user => user.id === 'student');
  assert.equal(saved.suspended, true);
  assert.equal(saved.canAccessChat, true);
  assert.equal(saved.keyRegistrations[0].expiresAt, expiry);
  await stop();
  await start(studioPath);
  assert.equal((await login()).status, 403, 'suspension survives restart');
  assert.equal((await request('/api/auth/me', 'key-admin')).status, 200);
  assert.equal((await status('student', false)).status, 200);
  assert.equal((await login()).status, 200);
  assert.equal((await request('/api/auth/me', 'key-student')).status, 200);
  assert.equal(readTalkFixture(studioPath).talkProfiles.find(user => user.id === 'student').canAccessChat, true);
  console.log('PASS: account suspension enforces staff scope, blocks login/sessions/hardware, persists, and restores access without changing entitlements');
} finally {
  await stop();
  await rm(temp, { recursive: true, force: true });
}
