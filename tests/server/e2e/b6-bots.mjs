/**
 * Work order B6 acceptance in a real browser.
 *
 *   npm run build:game && node tests/server/e2e/b6-bots.mjs
 *
 * 1. Local room (`?mode=online`, default bots): within a few rounds the seven bots buy, deploy and level; the right
 *    column shows their deployed units as avatars and their levels; no bot is marked 接管中.
 * 2. Real server (`?server=ws`, CAT_TAKEOVER_SEC=5), two contexts: A leaves the page; after the takeover delay B's
 *    right column shows A as 机 + 接管中 and A's board changes under the bot; A comes back (same tab, token in
 *    sessionStorage), the status line says 已接回席位 and B sees A as a human again.
 * Screenshots go to artifacts/b6/ (not committed). CHROMIUM overrides the browser path.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = `${ROOT}artifacts/b6`;
const VITE_PORT = 5199;
const BASE = `http://127.0.0.1:${VITE_PORT}/`;
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(OUT, { recursive: true });

const children = [];
function start(command, args, env, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    const timer = setTimeout(() => reject(new Error(`${command} did not become ready`)), 30_000);
    const onData = data => { const text = String(data); if (process.env.VERBOSE) process.stdout.write(text); if (ready.test(text)) { clearTimeout(timer); resolve(child); } };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`${command} exited with ${code}`)); });
  });
}
const stopAll = () => { for (const child of children) child.kill('SIGTERM'); };
const check = (condition, message) => { if (!condition) throw new Error(`check failed: ${message}`); console.log(`ok  ${message}`); };
const read = page => page.evaluate(() => window.__CAT_DEBUG__?.read() ?? null);
async function waitRead(page, predicate, what, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const snapshot = await read(page).catch(() => null);
    if (snapshot && predicate(snapshot)) return snapshot;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}: ${JSON.stringify(snapshot?.m6 ?? null)}`);
    await page.waitForTimeout(200);
  }
}
const seatOf = page => page.evaluate(() => document.querySelector('.online-seat.me')?.dataset.debug?.replace('online:seat:', ''));
const seatRow = (page, seatId) => page.evaluate(seat => {
  const row = document.querySelector(`[data-debug="online:seat:${seat}"]`);
  return row ? { kind: row.querySelector('.seat-kind')?.textContent ?? '', takeover: row.querySelector('.seat-kind')?.classList.contains('seat-takeover') ?? false,
    tag: row.querySelector('.seat-offline')?.textContent ?? '', avatar: row.querySelector('.seat-avatar')?.dataset.definition ?? null } : null;
}, seatId);

async function main() {
  await start('node', ['dist-server/game/main.mjs'], { PORT: '8788', CAT_PREP_SEC: '20', CAT_CHOICE_SEC: '5', CAT_SETTLE_SEC: '2', CAT_TAKEOVER_SEC: '5', CAT_BOT_STEP_MS: '200' }, /listening on/);
  await start('node', ['node_modules/vite/bin/vite.js', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/);
  const browser = await chromium.launch({ executablePath });
  const errors = [];
  const open = async (label, query) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`); });
    await page.goto(`${BASE}?${query}`);
    await page.waitForSelector('[data-debug="online:join"]');
    return page;
  };
  try {
    /* ---------------- 1. local room: seven bots play ---------------- */
    const local = await open('local', 'mode=online&prep=6&choice=3&settle=1');
    await local.click('[data-debug="online:join"]');
    await local.click('[data-debug="online:start"]');
    await waitRead(local, s => s.m6.mode === 'active', 'local start');
    const me = await seatOf(local);
    const built = await waitRead(local, s => s.m6.phase?.round >= 4 && s.m6.seats.filter(seat => seat.kind === 'bot' && seat.publicBoard.units.length >= 2).length >= 5, 'bots with boards', 240_000);
    const bots = built.m6.seats.filter(seat => seat.kind === 'bot');
    check(bots.length === 7 && bots.every(seat => seat.controller === 'bot'), 'seven fill-in bots, all controller=bot');
    check(bots.filter(seat => seat.publicBoard.units.length >= 2).length >= 5, `bots deployed units by round ${built.m6.phase.round}: ${bots.map(seat => seat.publicBoard.units.length).join('/')}`);
    check(bots.some(seat => seat.level >= 3), `bots levelled: ${bots.map(seat => seat.level).join('/')}`);
    const avatars = await Promise.all(bots.map(seat => seatRow(local, seat.seatId)));
    check(avatars.filter(row => row?.avatar).length >= 5 && avatars.every(row => row?.kind === '机' && !row.takeover && row.tag === ''), 'right column: bot avatars are their units, marked 机, none 接管中');
    check((await seatRow(local, me))?.kind === '我', 'my own seat is marked 我');
    await local.screenshot({ path: `${OUT}/1-local-bots.png` });
    const starred = await waitRead(local, s => s.m6.seats.some(seat => seat.kind === 'bot' && seat.publicBoard.units.some(unit => unit.starLevel >= 2)), 'a two-star bot unit', 240_000);
    check(true, `a bot upgraded a hero to two stars by round ${starred.m6.phase.round}`);
    await local.screenshot({ path: `${OUT}/2-local-two-star.png` });
    await local.context().close();

    /* ---------------- 2. real server: takeover and reclaim ---------------- */
    const a = await open('A', 'mode=online&server=ws&ws=ws://127.0.0.1:8788');
    const b = await open('B', 'mode=online&server=ws&ws=ws://127.0.0.1:8788');
    await a.fill('[data-debug="online:name"]', '甲'); await a.click('[data-debug="online:join"]');
    await b.fill('[data-debug="online:name"]', '乙'); await b.click('[data-debug="online:join"]');
    await a.waitForFunction(() => document.querySelectorAll('[data-debug="online:queue-entry"]').length === 2);
    await a.click('[data-debug="online:start"]');
    await Promise.all([a, b].map(page => waitRead(page, s => s.m6.mode === 'active' && s.m6.phase?.kind === 'preparation', 'match start')));
    const seatA = await seatOf(a), seatB = await seatOf(b);
    check(seatA && seatB && seatA !== seatB, `A at ${seatA}, B at ${seatB}`);
    const url = a.url();
    await a.goto('about:blank');
    await waitRead(b, s => s.m6.seats.find(seat => seat.seatId === seatA)?.connected === false, 'A shown disconnected');
    const offline = await seatRow(b, seatA);
    check(offline.tag === '断线' && !offline.takeover, 'B sees A as 断线 before the takeover delay');
    await waitRead(b, s => s.m6.seats.find(seat => seat.seatId === seatA)?.controller === 'takeover', 'takeover of A', 20_000);
    const taken = await seatRow(b, seatA);
    check(taken.kind === '机' && taken.takeover && taken.tag === '接管中', 'B sees A as 机 (takeover style) + 接管中');
    await b.screenshot({ path: `${OUT}/3-b-sees-takeover.png` });
    // Back in the same tab: the token in sessionStorage resumes the seat.
    await a.goto(url);
    const statusSeen = await a.waitForFunction(() => {
      const badge = document.querySelector('[data-debug="online:connection"]');
      return badge && !badge.hidden && badge.textContent.includes('已接回席位') ? badge.textContent : null;
    }, null, { timeout: 30_000 }).then(handle => handle.jsonValue()).catch(() => null);
    check(statusSeen !== null, `A's status badge: ${statusSeen}`);
    await a.screenshot({ path: `${OUT}/4-a-reclaimed.png` });
    await waitRead(b, s => s.m6.seats.find(seat => seat.seatId === seatA)?.controller === 'human', 'A human again');
    const back = await seatRow(b, seatA);
    check(back.kind === '人' && !back.takeover && back.tag === '', 'B sees A as 人 again, no 接管中');
    check((await read(a)).m6.seats.find(seat => seat.seatId === seatA)?.controller === 'human', 'A controls its seat');
    check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
  } finally {
    await browser.close();
  }
}

main().then(() => { stopAll(); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
