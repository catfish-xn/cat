/**
 * Work order C4 acceptance in a real browser: two browser contexts play one match against one
 * real game server (`dist-server/game/main.mjs`, CAT_PREP_SEC=3) through the vite dev proxy (/ws).
 *
 *   npm run build:game && node tests/server/e2e/ws-two-contexts.mjs [--rounds=N] [--ranking-minutes=M]
 *
 * Checks: pending purchase leaves gold untouched until the receipt; the other seat's sidebar shows
 * my level change while its own state never holds my shop; reloading one page returns it to its
 * seat without disturbing the other; both pages end with the same ranking. Screenshots go to
 * artifacts/c4/ (not committed). CHROMIUM overrides the browser path.
 *
 * A whole match with real two-sided PvP takes about 25 minutes at these phase lengths, so the final
 * ranking wait defaults to 40 minutes (`--ranking-minutes=M` changes it). `--rounds=N` stops earlier:
 * once both pages have reached round N together the run passes without waiting for the ranking.
 */
import { spawn } from 'node:child_process';
import { watchServerReplayErrors } from '../../../scripts/replay-error-guard.cjs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const OUT = `${ROOT}artifacts/c4`;
const VITE_PORT = 5199;
const PAGE_URL = `http://127.0.0.1:${VITE_PORT}/?mode=online&server=ws`;
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const argument = name => process.argv.slice(2).find(arg => arg.startsWith(`--${name}=`))?.split('=')[1];
const positive = (name, fallback) => {
  const raw = argument(name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer, got ${raw}`);
  return value;
};
const STOP_AT_ROUND = positive('rounds', null);
const RANKING_TIMEOUT_MS = positive('ranking-minutes', 40) * 60_000;
mkdirSync(OUT, { recursive: true });

const children = [];
function start(command, args, env, ready) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    children.push(child);
    watchServerReplayErrors(child, stopAll);
    const timer = setTimeout(() => reject(new Error(`${command} did not become ready`)), 30_000);
    const onData = data => { const text = String(data); if (process.env.VERBOSE) process.stdout.write(text); if (ready.test(text)) { clearTimeout(timer); resolve(child); } };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`${command} exited with ${code}`)); });
  });
}
const stopAll = () => { for (const child of children) child.kill('SIGTERM'); };
const check = (condition, message) => { if (!condition) throw new Error(`check failed: ${message}`); console.log(`ok  ${message}`); };
const read = page => page.evaluate(() => window.__CAT_DEBUG__?.read() ?? null);
async function waitRead(page, predicate, what, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const snapshot = await read(page).catch(() => null);
    if (snapshot && predicate(snapshot)) return snapshot;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}: ${JSON.stringify(snapshot?.m6 ?? null)}`);
    await page.waitForTimeout(100);
  }
}

async function main() {
  await start('node', ['dist-server/game/main.mjs'], { PORT: '8787', CAT_PREP_SEC: '3', CAT_CHOICE_SEC: '2', CAT_SETTLE_SEC: '1' }, /listening on/);
  await start('node', ['node_modules/vite/bin/vite.js', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/);
  const browser = await chromium.launch({ executablePath });
  const errors = [];
  const open = async label => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`); });
    await page.goto(PAGE_URL);
    await page.waitForSelector('[data-debug="online:join"]');
    return page;
  };
  try {
    const a = await open('A'), b = await open('B');
    check((await read(a)).m6.transport === 'websocket', 'A uses the websocket transport');
    await a.fill('[data-debug="online:name"]', '甲'); await a.click('[data-debug="online:join"]');
    await b.fill('[data-debug="online:name"]', '乙'); await b.click('[data-debug="online:join"]');
    await a.waitForFunction(() => document.querySelectorAll('[data-debug="online:queue-entry"]').length === 2);
    await a.screenshot({ path: `${OUT}/1-lobby.png` });
    await a.click('[data-debug="online:start"]');
    const [startA, startB] = await Promise.all([a, b].map(page => waitRead(page, s => s.m6.mode === 'active' && s.m6.phase?.kind === 'preparation' && s.state.phase === 'preparation', 'match start')));
    const seatA = (await a.evaluate(() => document.querySelector('.online-seat.me')?.dataset.debug))?.replace('online:seat:', '');
    check(Boolean(seatA), `A sits at ${seatA}`);
    check(JSON.stringify(startA.state.shop) !== JSON.stringify(startB.state.shop), 'each page holds only its own private state (different shops)');

    // Pending purchase: the click returns before any receipt; gold is not spent ahead of the server.
    const clickBuy = page => page.evaluate(() => {
      const button = [...document.querySelectorAll('[data-debug^="mobile:buy-"]')].find(node => /^mobile:buy-\d+$/.test(node.dataset.debug) && !node.disabled);
      if (!button) return null;
      const before = window.__CAT_DEBUG__.read().state;
      button.click();
      const after = window.__CAT_DEBUG__.read().state;
      return { slot: button.dataset.debug, before: before.gold, after: after.gold, units: before.preparation.units.length, status: document.querySelector('.panel-status')?.textContent ?? '' };
    });
    // Round 1 starts with no gold: the server refuses, and nothing local changed in between.
    const poor = await clickBuy(a);
    check(poor !== null && poor.after === poor.before && !poor.status.includes('待确认'), `pending buy (${poor?.slot}) keeps gold ${poor?.before} with no pending notice ("${poor?.status}")`);
    if (poor.before === 0) {
      await a.waitForFunction(() => document.querySelector('.panel-status')?.textContent?.includes('金币不足'), null, { timeout: 5_000 });
      const refused = await read(a);
      check(refused.state.gold === poor.before && refused.state.preparation.units.length === poor.units, 'refused receipt leaves gold and bench unchanged ("金币不足")');
    }
    // A later preparation phase with gold: the purchase is confirmed by the receipt and the state push.
    const rich = await waitRead(a, s => s.state.phase === 'preparation' && s.m6.phase?.kind === 'preparation' && !s.m6.playingBack && s.state.gold >= 5, 'a preparation phase with gold', 120_000);
    const pending = await clickBuy(a);
    check(pending !== null && pending.after === pending.before, `round ${rich.state.round}: pending buy keeps gold ${pending?.before} until the receipt`);
    const bought = await waitRead(a, s => s.state.gold < pending.before, 'gold after receipt', 5_000);
    check(bought.state.preparation.units.length === pending.units + 1, `receipt + state push spent ${pending.before - bought.state.gold} gold and added the unit`);
    await a.screenshot({ path: `${OUT}/2-bought.png` });

    // A buys XP until its level changes; B's sidebar shows the new level, B's own state never holds A's shop.
    const levelBefore = bought.state.level;
    for (let tries = 0; tries < 4; tries++) {
      const now = await read(a);
      if (now.state.level > levelBefore || now.state.gold < 4 || now.state.phase !== 'preparation') break;
      await a.click('[data-debug="mobile:buy-xp"]');
      await waitRead(a, s => s.state.gold < now.state.gold || s.state.phase !== 'preparation', 'buy-xp receipt', 5_000);
    }
    const leveled = await read(a);
    await b.waitForFunction(([seat, level]) => document.querySelector(`[data-debug="online:seat:${seat}"] .seat-level`)?.textContent === `Lv ${level}`, [seatA, leveled.state.level], { timeout: 10_000 });
    check(true, `B's sidebar shows A at Lv ${leveled.state.level} (was Lv ${startA.state.level} at the start)`);
    const viewB = await read(b);
    // B7: states arrive as private seat views, so seed/RNG are display placeholders on both pages; compare the shops.
    check(JSON.stringify(viewB.state.shop) !== JSON.stringify(leveled.state.shop), "B's __CAT_DEBUG__ state.shop is B's own");
    await b.screenshot({ path: `${OUT}/3-b-sidebar.png` });

    // Reload A: it resumes its seat from sessionStorage; B keeps playing undisturbed.
    const bModeBefore = (await read(b)).m6.mode;
    const ownUnits = snapshot => JSON.stringify(snapshot.state.preparation.units.filter(unit => unit.team === 'player').map(unit => unit.id).sort());
    const unitsBeforeReload = ownUnits(await read(a));
    await a.reload();
    const resumed = await waitRead(a, s => s.m6.mode === 'active' && s.m6.phase !== null, 'A back in the match after reload');
    const seatAfter = await a.evaluate(() => document.querySelector('.online-seat.me')?.dataset.debug?.replace('online:seat:', ''));
    check(seatAfter === seatA, `reloaded A is back at ${seatAfter}`);
    check(ownUnits(resumed) === unitsBeforeReload, 'reloaded A shows its own private state again (same own units)');
    const afterB = await read(b);
    check(afterB.m6.mode === bModeBefore && afterB.m6.connection === null, 'B unaffected by the reload');
    await b.waitForFunction(seat => !document.querySelector(`[data-debug="online:seat:${seat}"] .seat-offline`), seatA, { timeout: 10_000 });
    check(true, "B's sidebar shows A connected again");
    await a.screenshot({ path: `${OUT}/4-a-reloaded.png` });

    // HP: once A has taken damage, B's sidebar shows the same HP as A's own top bar.
    const hurt = await waitRead(a, s => s.m6.phase?.kind !== 'combat' && s.state.playerHp < 100, 'A takes damage', 600_000);
    await b.waitForFunction(([seat, hp]) => document.querySelector(`[data-debug="online:seat:${seat}"] .seat-hp`)?.textContent === `${hp}`, [seatA, hurt.state.playerHp], { timeout: 15_000 }).catch(() => null);
    const hpOnB = await b.evaluate(seat => document.querySelector(`[data-debug="online:seat:${seat}"] .seat-hp`)?.textContent, seatA);
    const hpOnA = (await read(a)).state.playerHp;
    check(Number(hpOnB) === hpOnA && hpOnA < 100, `B's sidebar shows A's HP ${hpOnB} (A's own state: ${hpOnA})`);

    if (STOP_AT_ROUND !== null) {
      // Shortened run: both pages reach round N of the same match, then the run passes without the ranking.
      const reached = await Promise.all([a, b].map(page => waitRead(page, s => (s.m6.phase?.round ?? 0) >= STOP_AT_ROUND || s.m6.phase?.kind === 'ended', `round ${STOP_AT_ROUND}`, RANKING_TIMEOUT_MS)));
      check(reached.every(snapshot => snapshot.m6.phase.kind === 'ended' || snapshot.m6.phase.round >= STOP_AT_ROUND), `both pages reached round ${STOP_AT_ROUND} (A at ${reached[0].m6.phase.round}, B at ${reached[1].m6.phase.round})`);
      await a.screenshot({ path: `${OUT}/5-a-round-${STOP_AT_ROUND}.png` });
      check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
      return;
    }
    // Play to the end: choices are answered by the server on timeout; both pages must agree on the ranking.
    const ended = await Promise.all([a, b].map(page => waitRead(page, s => s.m6.phase?.kind === 'ended' && s.m6.ranking !== null, 'ranking', RANKING_TIMEOUT_MS)));
    const ranking = snapshot => snapshot.m6.ranking.map(seat => `${seat.rank}:${seat.seatId}`).join(',');
    check(ranking(ended[0]) === ranking(ended[1]), `both pages show the same ranking ${ranking(ended[0])}`);
    await a.screenshot({ path: `${OUT}/5-a-ranking.png` }); await b.screenshot({ path: `${OUT}/5-b-ranking.png` });
    check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  } finally {
    await browser.close();
    stopAll();
  }
}
main().then(() => { console.log('C4 two-context run passed'); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
