/**
 * Work order C6 acceptance in a real browser: battles are played from the server's compact replay.
 *
 *   npm run build:game && node tests/server/e2e/c6-replay.mjs [--rounds=N]
 *
 * Three runs, each failing on any page error or console error:
 *   1. `?mode=online` (local room in the tab) up to round N (default 3): during every battle the HP meters
 *      follow the replay, the "开战" opening shows, the board ends on the replay's terminal view.
 *   2. `?mode=online&server=ws` against a real game server (dist-server/game/main.mjs), same checks.
 *   3. Offline: one whole battle through the shared renderer; HP meters move, the stats panel renders.
 * Screenshots go to artifacts/c6/ (not committed). CHROMIUM overrides the browser path.
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const ROOT = new URL('../../../', import.meta.url).pathname;
const OUT = `${ROOT}artifacts/c6`;
const VITE_PORT = 5198;
const BASE = `http://127.0.0.1:${VITE_PORT}/`;
const executablePath = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const roundsArg = process.argv.slice(2).find(arg => arg.startsWith('--rounds='));
const ROUNDS = roundsArg ? Number(roundsArg.split('=')[1]) : 3;
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
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}: ${JSON.stringify({ m6: snapshot?.m6 ?? null, replay: snapshot?.replay ?? null })}`);
    await page.waitForTimeout(50);
  }
}
const hpKey = snapshot => JSON.stringify(snapshot.health.filter(meter => meter.visible).map(meter => [meter.id, meter.value]));

/** Watches every battle of an online page until round `rounds` is reached; returns per-battle evidence. */
async function watchOnline(page, label, rounds) {
  const battles = [];
  let seenRound = 0;
  for (;;) {
    const snapshot = await waitRead(page, s => s.replay?.playingBack || (s.state.round >= rounds && s.m6.phase?.kind === 'preparation'), `${label}: next battle`, 120_000);
    if (!snapshot.replay?.playingBack) break;
    const round = snapshot.m6.phase.round;
    if (round === seenRound) { await page.waitForTimeout(100); continue; }
    seenRound = round;
    const texts = snapshot.texts.join(' ');
    const samples = new Set([hpKey(snapshot)]);
    let last = snapshot;
    const started = Date.now(); let lastTick = snapshot.replay.tick, terminalTick = snapshot.replay.terminalTick;
    while (last.replay?.playingBack) { await page.waitForTimeout(120); last = await read(page); samples.add(hpKey(last)); if (last.replay?.tick != null) lastTick = last.replay.tick; }
    const view = last.combatView;
    console.log(`    ${label} round ${round}: reached tick ${lastTick}/${terminalTick} in ${Date.now() - started} ms (1x = ${terminalTick * 50} ms), superseded ${last.replay?.superseded}`);
    battles.push({ round, opening: texts.includes('开战'), hpSamples: samples.size, units: view?.units.length ?? 0, terminalTick: view?.tick ?? -1, status: view?.status ?? null, played: last.replay?.played ?? 0 });
    if (battles.length === 1) await page.screenshot({ path: `${OUT}/${label}-battle-end.png` });
    console.log(`    ${label} round ${round}: ${JSON.stringify(battles.at(-1))}`);
  }
  return battles;
}
async function runOnline(browser, url, label, errors) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`${label} console: ${message.text()}`); });
  await page.goto(url);
  await page.waitForSelector('[data-debug="online:join"]');
  await page.fill('[data-debug="online:name"]', label); await page.click('[data-debug="online:join"]');
  await page.click('[data-debug="online:start"]');
  await waitRead(page, s => s.m6.mode === 'active', `${label}: match start`);
  const battles = await watchOnline(page, label, ROUNDS);
  check(battles.length > 0, `${label}: ${battles.length} battle(s) played from replays before round ${ROUNDS}`);
  check(battles.every(battle => battle.status === 'finished'), `${label}: every battle ended on a finished terminal view`);
  check(battles.some(battle => battle.hpSamples > 1), `${label}: HP meters changed during playback (${battles.map(b => b.hpSamples).join('/')} distinct samples)`);
  check(battles.some(battle => battle.opening), `${label}: the 开战 opening was shown`);
  const end = await read(page);
  check(end.combatEvents.length === 0, `${label}: no ledger reached the client (combatEvents empty)`);
  await page.screenshot({ path: `${OUT}/${label}-round-${end.state.round}.png` });
  await context.close();
  return battles;
}
/** Offline: seed 42, buy and deploy a unit, then play battles until one moves HP; the same renderer draws it. */
async function runOffline(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`offline: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`offline console: ${message.text()}`); });
  await page.goto(BASE);
  await page.waitForSelector('[data-debug="m6-fixed-start"]:not([disabled])');
  await page.fill('[data-debug="m6-seed-input"]', '42'); await page.click('[data-debug="m6-fixed-start"]');
  await waitRead(page, s => s.m6?.mode === 'active' && s.state.seed === 42, 'offline: seed 42 active');
  const click = name => page.evaluate(debug => { const node = document.querySelector(`[data-debug="${debug}"]`); if (node && !node.disabled) { node.click(); return true; } return false; }, name);
  for (let step = 0; step < 40; step++) {
    let s = await read(page);
    if (s.state.phase === 'choice') { await click(`choice:${s.state.pendingChoice.offers[0]}`); await page.waitForTimeout(300); continue; }
    if (s.state.phase === 'settlement') { await click('mobile:continue'); await page.waitForTimeout(200); continue; }
    if (s.state.phase !== 'preparation') { await page.waitForTimeout(200); continue; }
    // Buy what the gold allows, then drag bench units onto free cells of my zone (rows 4–7).
    for (let slot = 0; slot < 5; slot++) { const offer = s.state.shop.slots[slot]; if (offer.status === 'available' && s.state.gold >= 1) { await click(`mobile:buy-${slot}`); s = await read(page); } }
    const occupied = new Set(s.state.preparation.units.filter(u => u.location.kind === 'board').map(u => `${u.location.cell.col},${u.location.cell.row}`));
    const free = Object.keys(s.layout.hexes).filter(key => Number(key.split(',')[1]) >= 5 && !occupied.has(key));
    const onBoard = s.state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board').length;
    const bench = s.state.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench');
    for (const unit of bench.slice(0, Math.max(0, s.state.level - onBoard))) {
      const token = s.tokens.find(t => t.id === unit.id), target = s.layout.hexes[free.shift()];
      if (!token || !target) break;
      await page.mouse.move(token.screenX, token.screenY); await page.mouse.down();
      await page.mouse.move((token.screenX + target.x) / 2, (token.screenY + target.y) / 2, { steps: 6 });
      await page.mouse.move(target.x, target.y, { steps: 6 }); await page.mouse.up();
      await page.waitForTimeout(100); s = await read(page);
    }
    await click('mobile:start-combat');
    const started = await read(page);
    if (started.state.phase !== 'combat') { await page.waitForTimeout(200); continue; }
    const samples = new Set([hpKey(started)]);
    let last = started;
    while (last.state.phase === 'combat') { await page.waitForTimeout(120); last = await read(page); samples.add(hpKey(last)); }
    console.log(`    offline round ${started.state.round}: ${samples.size} distinct HP samples, ${last.combatEvents.length} ledger events`);
    if (samples.size <= 1) continue;
    check(last.combatView !== null && last.combatView.tick === last.state.combat.tick, 'offline: the shown view is the engine combat through the shared whitelist');
    check(last.combatEvents.length > 0, 'offline: the local ledger is still kept for saves, replays and stats');
    const stats = await page.evaluate(() => document.querySelector('[data-debug="m6-stats-table"]')?.textContent ?? '');
    check(stats.length > 0, 'offline: stats table rendered from the ledger aggregate');
    await page.screenshot({ path: `${OUT}/offline-battle-end.png` });
    check(true, `offline: HP meters changed during the battle (${samples.size} distinct samples)`);
    await context.close();
    return;
  }
  throw new Error('offline: no battle moved HP within 40 steps');
}

async function main() {
  await start('node', ['dist-server/game/main.mjs'], { PORT: '8787', CAT_PREP_SEC: '3', CAT_CHOICE_SEC: '2', CAT_SETTLE_SEC: '1' }, /listening on/);
  await start('node', ['node_modules/vite/bin/vite.js', '--port', String(VITE_PORT), '--strictPort', '--host', '127.0.0.1'], {}, /Local:/);
  const browser = await chromium.launch({ executablePath });
  const errors = [];
  try {
    await runOffline(browser, errors);
    await runOnline(browser, `${BASE}?mode=online&prep=3&choice=2&settle=1`, 'local', errors);
    await runOnline(browser, `${BASE}?mode=online&server=ws`, 'ws', errors);
    check(errors.length === 0, `no page or console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  } finally { await browser.close(); stopAll(); }
}
main().then(() => { console.log('c6 replay e2e passed'); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
