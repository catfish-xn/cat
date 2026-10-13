/**
 * C13 real-machine bug: in online battles, dead pieces stayed on the board until the settlement.
 *
 *   npm run build:game && node tests/server/e2e/c13-dead-tokens.mjs
 *
 * One human + seven bots against the real game server (`?server=ws`). The human buys and deploys every round;
 * every battle from 1-2 on is sampled every 300 ms while it plays back, then once more on its terminal view:
 *   1. a combatView unit with alive:false has an invisible token;
 *   2. after a unit's `death` event tick has played, its token is no longer visible;
 *   3. no stray piece: every visible token is an alive combat unit or one of my bench units (a PvP battle
 *      renames units, so my preparation pieces must not stay on the board next to the battle's own);
 *   4. a second PvP battle is cut short like a tab that comes back (visibilitychange → skipPlayback):
 *      the terminal view shows the same checks;
 *   5. after a PvP battle, the settlement (no battle view any more) shows my board pieces again.
 * Passes once one PvP battle with a death was watched to its end and one was skipped. Screenshots go to
 * artifacts/c13/ (not committed). CHROMIUM overrides the browser path.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = `${ROOT}artifacts/c13`;
const VITE_PORT = 5196;
const WS_PORT = 8790;
const BASE = `http://127.0.0.1:${VITE_PORT}/`;
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LAST_ROUND = '3-2';
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
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}: ${JSON.stringify(snapshot?.m6?.phase ?? null)} ${snapshot?.state?.phase}`);
    await page.waitForTimeout(100);
  }
}
const click = (page, name) => page.evaluate(debug => { const node = document.querySelector(`[data-debug="${debug}"]`); if (node && !node.disabled) { node.click(); return true; } return false; }, name);

/** Buy what gold allows, then deploy bench units up to the level through the 部署 tab (as c7-playtest). */
async function prepare(page) {
  let state = (await read(page)).state;
  for (let slot = 0; slot < 5; slot++) if (state.shop.slots[slot]?.status === 'available' && state.gold >= 1) { await click(page, `mobile:buy-${slot}`); await page.waitForTimeout(200); state = (await read(page)).state; }
  await click(page, 'panel:units');
  for (let i = 0; i < 6; i++) {
    state = (await read(page)).state;
    if (state.phase !== 'preparation') return;
    const mine = state.preparation.units.filter(u => u.team === 'player');
    const onBoard = mine.filter(u => u.location.kind === 'board').length;
    const bench = mine.filter(u => u.location.kind === 'bench');
    if (!bench.length || onBoard >= state.level) return;
    const occupied = new Set(state.preparation.units.filter(u => u.location.kind === 'board').map(u => `${u.location.cell.col},${u.location.cell.row}`));
    const zone = state.preparation.board.deploymentZones.player;
    let cell = null;
    for (let row = zone.firstRow; row <= zone.lastRow && !cell; row++) for (let col = 1; col < state.preparation.board.columns && !cell; col++) if (!occupied.has(`${col},${row}`)) cell = `${col},${row}`;
    if (!cell) return;
    await click(page, `mobile:unit:${bench[0].id}`); await click(page, `deploy:${cell}`); await page.waitForTimeout(300);
  }
}

/** Violations of checks 1–3 in one snapshot; `deaths` maps unit id → tick of its death event. */
function violations(s, deaths) {
  const view = s.combatView;
  if (!view) return [];
  const out = [];
  const tokens = new Map(s.tokens.map(token => [token.id, token]));
  const units = new Map(view.units.map(unit => [unit.id, unit]));
  const bench = new Set(s.state.preparation.units.filter(u => u.location.kind === 'bench').map(u => u.id));
  for (const unit of view.units) {
    const token = tokens.get(unit.id);
    if (!token) out.push(`tick ${view.tick}: no token for combat unit ${unit.id}`);
    else if (!unit.alive && token.visible) out.push(`tick ${view.tick}: dead ${unit.definitionId} ${unit.id} still visible`);
  }
  for (const [id, tick] of deaths) {
    if (view.tick <= tick) continue;
    if (units.get(id)?.alive) out.push(`tick ${view.tick}: ${id} died at tick ${tick} but the view has it alive`);
    if (tokens.get(id)?.visible) out.push(`tick ${view.tick}: ${id} died at tick ${tick} but its token is visible`);
  }
  for (const token of s.tokens) {
    if (!token.visible || bench.has(token.id) || units.get(token.id)?.alive) continue;
    out.push(`tick ${view.tick}: stray piece ${token.definitionId} ${token.id} at (${Math.round(token.x)},${Math.round(token.y)}) is not an alive combat unit`);
  }
  return out;
}
function collectDeaths(s, deaths) {
  for (const event of s.recentCombatEvents ?? []) if (event.type === 'death' && !deaths.has(event.unitId)) deaths.set(event.unitId, event.tick);
}

/** Samples one battle every 300 ms; with `skipAfter` the tab "comes back" after that many samples. */
async function watchBattle(page, label, skipAfter) {
  const deaths = new Map(), problems = [];
  let s = await read(page), samples = 0, skipped = false, maxTick = 0;
  while (s.replay?.playingBack) {
    collectDeaths(s, deaths); problems.push(...violations(s, deaths)); samples++; maxTick = Math.max(maxTick, s.combatView?.tick ?? 0);
    if (samples === 3) await page.screenshot({ path: `${OUT}/${label}-early.png` });
    if (skipAfter !== null && samples >= skipAfter && !skipped) {
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); skipped = true;
    } else await page.waitForTimeout(300);
    s = await read(page);
  }
  // Terminal view (after playback, before the next state push replaces it), when still shown.
  if (s.combatView) {
    collectDeaths(s, deaths);
    // skipPlayback pushes the remaining events into the log without playing them; take deaths from the view instead.
    for (const unit of s.combatView.units) if (!unit.alive && !deaths.has(unit.id)) deaths.set(unit.id, -1);
    problems.push(...violations(s, deaths).map(line => `terminal ${line}`));
    await page.screenshot({ path: `${OUT}/${label}-terminal.png` });
  }
  const terminal = s.combatView;
  return { deaths: deaths.size, samples, skipped, maxTick, terminalTick: terminal?.tick ?? null, terminalShown: terminal !== null,
    deadAtEnd: terminal?.units.filter(unit => !unit.alive).length ?? 0, problems };
}

async function main() {
  await start('node', ['dist-server/game/main.mjs'], { PORT: String(WS_PORT), CAT_PREP_SEC: '6', CAT_CHOICE_SEC: '3', CAT_SETTLE_SEC: '3', CAT_BOT_STEP_MS: '150' }, /listening on/);
  await start('node', ['node_modules/vite/bin/vite.js', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/);
  const browser = await chromium.launch({ executablePath });
  const errors = [], battles = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    await page.goto(`${BASE}?mode=online&server=ws&ws=ws://127.0.0.1:${WS_PORT}`);
    await page.waitForSelector('[data-debug="online:join"]');
    await page.fill('[data-debug="online:name"]', '测试'); await page.click('[data-debug="online:join"]');
    await page.click('[data-debug="online:start"]');
    await waitRead(page, s => s.m6.mode === 'active', 'match start');

    let lastRound = 0;
    for (;;) {
      const s = await waitRead(page, s => (s.m6.phase?.kind === 'preparation' && s.m6.phase.round > lastRound) || s.state.phase === 'gameOver', 'next preparation', 120_000);
      if (s.state.phase === 'gameOver') break;
      const round = s.m6.phase.round, roundId = s.state.roundDefinitionId, kind = s.state.m8.round.kind;
      lastRound = round;
      await prepare(page);
      const battle = await waitRead(page, s => s.replay?.playingBack || (s.m6.phase?.round ?? 0) > round, `${roundId} battle`, 90_000);
      if (!battle.replay?.playingBack) { console.log(`    ${roundId} (${kind}): no battle for my seat`); continue; }
      const watchedPvp = battles.some(b => b.kind === 'pvp' && !b.skipped && b.deaths > 0);
      const skip = kind === 'pvp' && watchedPvp && !battles.some(b => b.kind === 'pvp' && b.skipped && b.deadAtEnd > 0) ? 4 : null;
      const result = { roundId, kind, ...(await watchBattle(page, `${roundId}`, skip)) };
      if (kind === 'pvp') {
        // Check 5: once the settlement replaces the battle view, my own board pieces are back on the board.
        const settle = await waitRead(page, s => s.state.phase === 'settlement' && !s.combatView, `${roundId} settlement`, 30_000).catch(() => null);
        if (settle) {
          const mine = settle.state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board');
          result.settlementHidden = mine.filter(u => !settle.tokens.find(t => t.id === u.id)?.visible).map(u => u.id);
          result.settlementBoard = mine.length;
          await page.screenshot({ path: `${OUT}/${roundId}-settlement.png` });
        }
      }
      battles.push(result);
      console.log(`    ${roundId} (${kind}): ${JSON.stringify({ ...result, problems: result.problems.slice(0, 4), problemCount: result.problems.length })}`);
      const done = battles.some(b => b.kind === 'pvp' && !b.skipped && b.deaths > 0) && battles.some(b => b.kind === 'pvp' && b.skipped && b.deadAtEnd > 0);
      if (done || roundId === LAST_ROUND) break;
    }
    const pvpWatched = battles.find(b => b.kind === 'pvp' && !b.skipped && b.deaths > 0);
    const pvpSkipped = battles.find(b => b.kind === 'pvp' && b.skipped && b.deadAtEnd > 0);
    check(Boolean(pvpWatched), `a PvP battle with deaths was watched at 1x (${pvpWatched?.roundId}, ${pvpWatched?.deaths} deaths, ${pvpWatched?.samples} samples)`);
    check(Boolean(pvpSkipped), `a PvP battle with deaths was skipped to its end (${pvpSkipped?.roundId}, ${pvpSkipped?.deadAtEnd} dead at the end)`);
    const settled = battles.filter(b => b.settlementBoard !== undefined);
    check(settled.length > 0 && settled.every(b => b.settlementHidden.length === 0), `my board pieces are shown again in the settlement after PvP: ${settled.map(b => `${b.roundId} ${b.settlementBoard - b.settlementHidden.length}/${b.settlementBoard}`).join(' ')}`);
    for (const b of battles) check(b.problems.length === 0, `${b.roundId} (${b.kind}${b.skipped ? ', skipped' : ''}): dead and stray pieces hidden${b.problems.length ? `: ${b.problems.slice(0, 6).join(' | ')}` : ''}`);
    check(errors.length === 0, `no page or console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
    await context.close();
  } finally { await browser.close(); stopAll(); }
}
main().then(() => { console.log('c13 dead tokens e2e passed'); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
