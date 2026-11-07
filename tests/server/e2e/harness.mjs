/**
 * Shared harness of the online e2e scripts (work order C19 item 2). Every c7–c18b script used to copy the same process
 * start, port, browser and page-reading boilerplate; it lives here once. Assertions stay in the scripts.
 *
 * Ports: a script asks for its default port (still overridable through its own env variable); when that port is taken
 * (another e2e left running, a parallel run), the server or Vite exits with EADDRINUSE / "already in use" and the next
 * port is tried, up to PORT_ATTEMPTS times. Scripts use the port the start helpers return, never the requested one.
 *
 * Env: CHROMIUM overrides the browser path; VERBOSE=1 echoes the child processes' output.
 */
import { spawn } from 'node:child_process';
import { watchServerReplayErrors } from '../../../scripts/replay-error-guard.cjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// A native path with its trailing separator (URL.pathname gives /C:/... on Windows, which spawn cannot use as cwd).
export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT_ATTEMPTS = 5;
const PORT_IN_USE = /EADDRINUSE|already in use/;

/** artifacts/<name>/ (not committed), created on first use. */
export function outDir(name) {
  const dir = `${ROOT}artifacts/${name}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

/* ---------------- child processes ---------------- */

const children = [];
/** Spawns `command` in the repository root and resolves once a chunk of its output matches `ready`. */
export function start(command, args, env, ready, timeout = 30_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    watchServerReplayErrors(child, stopAll);
    let output = '';
    const timer = setTimeout(() => reject(new Error(`${command} did not become ready`)), timeout);
    const onData = data => {
      const text = String(data); output += text;
      if (process.env.VERBOSE) process.stdout.write(text);
      if (ready.test(text)) { clearTimeout(timer); resolve(child); }
    };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    // A child that cannot start (bad cwd or command) emits 'error' and never 'exit'.
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      reject(Object.assign(new Error(`${command} exited with ${code}`), { portInUse: PORT_IN_USE.test(output) }));
    });
  });
}
export const stopAll = () => { for (const child of children) child.kill('SIGTERM'); };

/** Runs `launch(port)` on `port`, then on the next ports while the previous one was taken. */
async function onFreePort(port, what, launch) {
  for (let attempt = 0; ; attempt++) {
    const candidate = port + attempt;
    try { await launch(candidate); return candidate; }
    catch (error) {
      if (!error.portInUse || attempt + 1 >= PORT_ATTEMPTS) throw error;
      console.log(`${what}: port ${candidate} in use, retrying on ${candidate + 1}`);
    }
  }
}

/** The bundled game server (`npm run build:game`) with the given CAT_* env; resolves to the port it listens on. */
export function startGameServer(port, env = {}) {
  return onFreePort(port, 'game server', candidate => start('node', ['dist-server/game/main.mjs'], { ...env, PORT: String(candidate) }, /listening on/));
}
/** The Vite dev server of the page; resolves to its base URL. */
export async function startVite(port) {
  const actual = await onFreePort(port, 'vite', candidate => start('node', ['node_modules/vite/bin/vite.js', '--port', String(candidate), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/));
  return `http://127.0.0.1:${actual}/`;
}
/** The online page of `base` against the game server on `wsPort`. */
export const onlineUrl = (base, wsPort) => `${base}?mode=online&server=ws&ws=ws://127.0.0.1:${wsPort}`;
export const launchBrowser = () => chromium.launch({ executablePath });

/* ---------------- page helpers ---------------- */

export const read = page => page.evaluate(() => window.__CAT_DEBUG__?.read() ?? null);
/** Clicks the enabled `[data-debug=name]` node; false when it is missing or disabled. */
export const click = (page, name) => page.evaluate(debug => { const node = document.querySelector(`[data-debug="${debug}"]`); if (node && !node.disabled) { node.click(); return true; } return false; }, name);
export const text = (page, selector) => page.evaluate(sel => document.querySelector(sel)?.textContent ?? null, selector);
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Polls the debug snapshot every 100 ms until `predicate` holds; throws after `timeout`. */
export async function waitRead(page, predicate, what, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const snapshot = await read(page).catch(() => null);
    if (snapshot && predicate(snapshot)) return snapshot;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}: ${JSON.stringify(snapshot?.m6?.phase ?? null)} ${snapshot?.state?.phase}`);
    await page.waitForTimeout(100);
  }
}
/** Polls the debug snapshot every `interval` ms until `predicate` holds; null after `timeout` (the caller decides). */
export async function pollRead(page, predicate, timeout = 10_000, interval = 50) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const snapshot = await read(page).catch(() => null);
    if (snapshot && predicate(snapshot)) return snapshot;
    if (Date.now() > deadline) return null;
    await page.waitForTimeout(interval);
  }
}

/** Page errors and console errors go to `errors`, prefixed with `label` when given. */
export function collectErrors(page, errors, label = '') {
  const prefix = label ? `${label}: ` : '', consolePrefix = label ? `${label} console: ` : 'console: ';
  page.on('pageerror', error => errors.push(`${prefix}${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${consolePrefix}${message.text()}`); });
}
/** Calls `sent(message)` / `received(message)` with every JSON frame of the page's sockets (binary frames are skipped). */
export function onWire(page, { sent, received } = {}) {
  const parse = frame => { try { return JSON.parse(String(frame.payload)); } catch { return null; } };
  page.on('websocket', socket => {
    if (sent) socket.on('framesent', frame => { const m = parse(frame); if (m) sent(m); });
    if (received) socket.on('framereceived', frame => { const m = parse(frame); if (m) received(m); });
  });
}
/**
 * The usual command bookkeeping: `sent` maps commandId → command, `receipts` maps commandId → result kind or
 * `refused:<reason>` for the receipts of commands this page sent.
 */
export function trackCommands(page) {
  const sent = new Map(), receipts = new Map();
  onWire(page, {
    sent: m => { if (m.type === 'command') sent.set(m.commandId, m.command); else if (m.type === 'walk') sent.set(m.commandId, m); },
    received: m => { if (m.type === 'receipt' && sent.has(m.commandId)) receipts.set(m.commandId, m.ok ? m.result.kind : `refused:${m.reason}`); },
  });
  /** The first receipt of a command of `type` sent after the ids in `before`; null after `timeout`. */
  const receiptSince = async (before, type, timeout = 5_000) => {
    const deadline = Date.now() + timeout;
    for (;;) {
      const receipt = [...sent].filter(([id, command]) => !before.has(id) && command.type === type).map(([id]) => receipts.get(id)).find(Boolean);
      if (receipt) return receipt;
      if (Date.now() > deadline) return null;
      await sleep(40);
    }
  };
  const commandsSince = (before, type) => [...sent].filter(([id, command]) => !before.has(id) && command.type === type).map(([, command]) => command);
  return { sent, receipts, receiptSince, commandsSince, mark: () => new Set(sent.keys()) };
}
/** Opens the lobby at `url`, joins as `name` and (unless `startMatch` is false) presses start. */
export async function joinOnline(page, url, name, { startMatch = true } = {}) {
  await page.goto(url);
  await page.waitForSelector('[data-debug="online:join"]');
  await page.fill('[data-debug="online:name"]', name); await page.click('[data-debug="online:join"]');
  if (startMatch) await page.click('[data-debug="online:start"]');
}

/* ---------------- checks ---------------- */

/** Fail-fast check: throws on the first failed condition. */
export const strictCheck = (condition, message) => { if (!condition) throw new Error(`check failed: ${message}`); console.log(`ok  ${message}`); };
/** Collecting checks: every failure is logged and kept; `finish(label)` sets the exit code and prints the summary. */
export function createChecks() {
  const failures = [];
  const check = (condition, message) => { if (condition) console.log(`ok  ${message}`); else { console.log(`FAIL ${message}`); failures.push(message); } };
  const finish = label => {
    if (failures.length) { console.log(`\n${failures.length} check(s) failed`); process.exitCode = 1; }
    else console.log(`\nall ${label} checks passed`);
  };
  return { check, failures, finish };
}
