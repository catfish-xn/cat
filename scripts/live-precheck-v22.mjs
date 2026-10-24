#!/usr/bin/env node
/**
 * v22 live pre-check (docs/V22_RELEASE.md §4.7): six things the test-server check list asks for, played in real online
 * matches on the production bundles (dist-server/game/main.mjs + `vite preview` of dist/, like §4.6), with the server's
 * default timings. Two rooms run side by side, each with four browser players and four server bots:
 *
 *   room A  seed whose opening encounter is 基础装备锻造器 (component-anvils: two anvils on every bench at 1-2)
 *   room B  seed with no anvil encounter (clean 1-2 / 1-3 timings)
 *
 * Every browser player plays through the page's own controls (shop cards, D/F, the 部署 tab, drags on the canvas, choice
 * cards); what to do is the bots' own policy (`decideBotAction`, as in tests/server/e2e/c19-full-match.mjs) unless a role
 * below says otherwise. Nothing here computes a rule: the checks compare what the server pushed with what the page shows.
 *
 *   1 anvil     (room A, 甲) 1-4: the anvil on the bench is dragged onto the shop dock; the armory opens (4 offers), the
 *               countdown shows the anvil deadline (the server's choiceDeadline.endsAt), nobody picks, and at the deadline
 *               the first offer lands in the inventory.
 *   2 augment   (甲 and 戊) 2-1: the augment choice is open at the start of the preparation, the preparation is 50 s,
 *               a shop purchase works while it is open, and at the deadline the first offer is owned.
 *   3 timing    (甲 and 戊) the published length and the wall-clock length of the 1-2 (6 s) and 1-3 (15 s) preparations.
 *   4 forge     (whoever gets 杰斯 first) the 海克斯科技锻炉 is dragged to another cell of my rows in a preparation;
 *               the next preparation it is still there. Every player hunts Jayce: buys him whenever he is in the shop,
 *               takes him at a carousel, and from 4-1 levels to 8 and rolls with spare gold.
 *   5 overtime  (every player, own battles) a battle that reaches tick 600 (30 s): screenshot past 30 s, movement step
 *               intervals from the streamed movement events before and after tick 600, and the end (45 s = draw).
 *   6 market    (乙 and 己, chem-baron role) only 炼金男爵 on the board until the black market opens; its bundle shows
 *               concrete items, 全部拿走 grants exactly those.
 *
 * A point that the matches did not reach before the time cap is reported as not reached (rerun, or pick other seeds).
 *
 *   node scripts/live-precheck-v22.mjs [--no-build] [--minutes=70] [--seed-a=N] [--seed-b=N]
 *
 * Needs playwright and Chrome (CHROMIUM, default /usr/bin/google-chrome). Ports are picked free at start. Screenshots
 * and report.json go to artifacts/live-precheck/ (not committed). Exit code 1 when a point failed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { ROOT, click, onWire, read, start, startGameServer, stopAll, trackCommands } from '../tests/server/e2e/harness.mjs';

const argv = process.argv.slice(2);
const option = (name, fallback) => { const hit = argv.find(arg => arg.startsWith(`--${name}=`)); return hit ? hit.slice(name.length + 3) : fallback; };
const OUT = `${ROOT}artifacts/live-precheck`;
const MINUTES = Number(option('minutes', '70'));
const CHROME = process.env.CHROMIUM ?? '/usr/bin/google-chrome';
mkdirSync(OUT, { recursive: true });

const T0 = Date.now();
const stamp = () => `${String(Math.round((Date.now() - T0) / 1000)).padStart(4)}s`;
const log = (...parts) => console.log(stamp(), ...parts);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const mine = state => state.preparation.units.filter(unit => unit.team === 'player');
const inPreparation = s => s?.m6?.phase?.kind === 'preparation' && ['preparation', 'choice'].includes(s.state?.phase);
const inBattle = s => s?.m6?.phase?.kind === 'combat' && s.state?.phase === 'combat';
const cellKey = cell => `${cell.col},${cell.row}`;

/* ---------------- report ---------------- */

const POINTS = {
  anvil: '1 锻造器：备战席 → 拖到商店开武器库，倒计时，超时拿第一个',
  augment: '2 强化并入准备阶段：2-1 准备开始就弹出，50 秒，超时拿第一个',
  timing: '3 准备时间：1-2 为 6 秒，1-3 为 15 秒',
  forge: '4 杰斯锻炉：准备阶段可拖动，下回合保留位置',
  overtime: '5 加时：30 秒起移动加快，45 秒平局',
  market: '6 黑市：显示具体装备，买到的就是显示的',
};
const report = { startedAt: new Date().toISOString(), points: Object.fromEntries(Object.keys(POINTS).map(key => [key, { title: POINTS[key], status: 'not-reached', checks: [], shots: [], notes: [] }])),
  rooms: {}, battles: [], errors: [] };
/** One check of a point: kept with its evidence, printed, and turns the point to fail when it fails. */
function check(point, ok, message, evidence) {
  const entry = report.points[point];
  entry.checks.push({ ok: Boolean(ok), message, ...(evidence === undefined ? {} : { evidence }) });
  if (!ok) entry.status = 'fail';
  else if (entry.status === 'not-reached') entry.status = 'pass';
  log(`${ok ? 'ok  ' : 'FAIL'} [${point}] ${message}`);
}
const note = (point, text) => { report.points[point].notes.push(text); log(`note [${point}] ${text}`); };
async function shot(page, point, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path }).catch(error => log(`screenshot ${name} failed: ${error.message}`));
  report.points[point].shots.push(path.slice(ROOT.length));
  return path;
}
const done = point => report.points[point].status !== 'not-reached';
/** Points that only one player in all rooms needs to run. */
const claimed = new Set();
const claim = task => { if (claimed.has(task)) return false; claimed.add(task); return true; };

/* ---------------- setup ---------------- */

const freePort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); });
});

/** Content tables and the bots' policy, from the same sources the bundles were built from. */
async function loadTables() {
  const outfile = `${OUT}/tables.mjs`;
  await build({
    stdin: { contents: [
      "export { ITEM_DEFINITIONS } from './src/simulation/content/items.ts';",
      "export { G23_MEMBERSHIP } from './src/simulation/content/g2-3-units.ts';",
      "export { UNIT_DEFINITIONS } from './src/simulation/units.ts';",
      "export { itemDisplayName } from './src/presentation/g23-display.ts';",
      "export { selectOpeningUnit } from './src/simulation/opening-unit.ts';",
      "export { decideBotAction, BOT_MAX_STEPS, createOpeningEncounter } from './src/server-entry/index.ts';",
    ].join('\n'), resolveDir: ROOT, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'warning',
  });
  return import(`${outfile}?${Date.now()}`);
}
/** Room A: the first seed whose opening encounter is component-anvils; room B: the first seed with no anvil encounter. */
function pickSeeds(tables) {
  const encounter = seed => tables.createOpeningEncounter(seed).selection.encounterId;
  let a = option('seed-a'), b = option('seed-b');
  for (let seed = 1; !a; seed++) if (encounter(seed) === 'component-anvils') a = String(seed);
  for (let seed = 1; !b; seed++) if (['none', 'golden-gala', 'prismatic-prelude'].includes(encounter(seed))) b = String(seed);
  return [{ id: 'A', seed: a, encounter: encounter(Number(a)) }, { id: 'B', seed: b, encounter: encounter(Number(b)) }];
}

/* ---------------- one browser player ---------------- */

/**
 * Wire bookkeeping of one page: the first view of each phase (published length), my anvil deadlines, and my own battles
 * as streamed (movement events and the terminal view).
 */
function watchWire(page, human) {
  onWire(page, { received: m => {
    if (m.type === 'view') {
      const phase = m.view.phase, key = `${phase.roundName}:${phase.kind}`;
      human.viewRound = phase.roundName;
      if (!human.phases.has(key)) { human.phases.set(key, { key, at: Date.now(), publishedMs: phase.endsAt === null ? null : Math.round(phase.endsAt - phase.serverNow), endsAt: phase.endsAt, extended: [] }); human.phaseOrder.push(key); }
      // Each push restates the same deadline (to within clock jitter); a later deadline is an extension.
      else { const entry = human.phases.get(key); if (phase.endsAt !== null && entry.endsAt !== null && phase.endsAt > entry.endsAt + 1_000) { entry.extended.push(Math.round(phase.endsAt - phase.serverNow)); entry.endsAt = phase.endsAt; } }
      human.serverOffset = phase.serverNow - Date.now();
    }
    if (m.type === 'state') {
      human.choiceDeadline = m.state.choiceDeadline ?? null;
      const open = m.state.pendingChoice?.choiceId ?? null;
      if (open !== human.choiceLog.at(-1)?.choiceId) human.choiceLog.push({ at: Date.now(), choiceId: open });
    }
    const battle = id => human.battles.get(id) ?? (human.battles.set(id, { battleId: id, round: human.viewRound ?? null, moves: [], terminal: null }), human.battles.get(id));
    // Steps only: a movement with a reason (dash, knock-back, relocation) is not a walk step.
    const moves = (entry, ticks) => { for (const record of ticks) for (const event of record.events ?? []) if (event.type === 'movement' && !event.reason) entry.moves.push([event.unitId, event.tick ?? record.tick]); };
    if (m.type === 'combat-open' && !m.watch) { const entry = battle(m.battleId); entry.seatId = m.seatId; moves(entry, [m.frame]); }
    if (m.type === 'combat-chunk') for (const chunk of m.chunks) if (!chunk.watch) moves(battle(chunk.battleId), chunk.ticks);
    if (m.type === 'combat-end' && !m.watch) battle(m.battleId).terminal = { tick: m.terminal.tick, result: m.terminal.result, status: m.terminal.status, maxTicks: m.terminal.maxTicks };
    if (m.type === 'replay') { const entry = battle(m.battleId); if (!entry.moves.length) moves(entry, m.replay.ticks); entry.terminal = { tick: m.replay.terminal.tick, result: m.replay.terminal.result, status: m.replay.terminal.status, maxTicks: m.replay.terminal.maxTicks }; }
  } });
}

async function openHuman(browser, room, spec, tables) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1500 } });
  const page = await context.newPage();
  const human = { ...spec, room, page, tables, wire: null, rng: 0x7ec0 + room.humans.length, phases: new Map(), phaseOrder: [], choiceLog: [], viewRound: null, battles: new Map(), choiceDeadline: null, serverOffset: 0,
    answered: new Set(), carousels: new Set(), prepDone: new Set(), shotBattles: new Set(), forge: null, chemDone: false, out: false };
  page.on('pageerror', error => report.errors.push(`${spec.name}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(`${spec.name} console: ${message.text()}`); });
  human.wire = trackCommands(page);
  watchWire(page, human);
  await page.goto(`${room.base}?mode=online&server=ws&ws=ws://127.0.0.1:${room.wsPort}`);
  await page.waitForSelector('[data-debug="online:join"]');
  await page.fill('[data-debug="online:name"]', spec.name);
  await page.click('[data-debug="online:join"]');
  return human;
}

/** A control's receipt (or 'disabled' when it cannot be clicked). */
async function act(human, control, type) {
  const before = human.wire.mark();
  if (!(await click(human.page, control))) return 'disabled';
  return human.wire.receiptSince(before, type);
}
const fingerprint = state => JSON.stringify([state.gold, state.level, state.xp, state.shop, state.preparation.units.map(unit => [unit.id, unit.location, unit.starLevel]),
  state.items.map(item => [item.id, item.location]), state.pendingChoice?.choiceId ?? null, state.itemSummons]);
/** The next read whose state satisfies `predicate` (null after `timeout`). */
async function pushed(human, predicate, timeout = 5_000) {
  const until = Date.now() + timeout;
  for (;;) {
    const s = await read(human.page).catch(() => null);
    if (s?.state && predicate(s)) return s;
    if (Date.now() > until) return null;
    await human.page.waitForTimeout(50);
  }
}
/** Carries out one intention through the page (as c19-full-match.mjs): the receipt kind, `refused:<reason>`, 'disabled'. */
async function perform(human, action) {
  const { page } = human;
  const units = async () => { await click(page, 'panel:units'); await page.waitForTimeout(80); };
  const items = async () => { await click(page, 'panel:items'); await page.waitForTimeout(80); };
  const press = async key => { const box = (await read(page)).strategy.bounds[key]; if (!box) return false; await page.mouse.click(box.centerX, box.centerY); await page.waitForTimeout(80); return true; };
  switch (action.type) {
    case 'buy': return act(human, `mobile:buy-${action.slot}`, 'buy');
    case 'reroll': return act(human, 'mobile:reroll', 'reroll');
    case 'buyXp': return act(human, 'mobile:buy-xp', 'buyXp');
    case 'shopLock': return act(human, 'shop-lock', 'shopLock');
    case 'sell': await units(); if (!(await click(page, `mobile:unit:${action.unitId}`))) return 'disabled'; return act(human, 'mobile:sell', 'sell');
    case 'deploy': {
      await units();
      if (!(await click(page, `mobile:unit:${action.unitId}`))) return 'disabled';
      return act(human, action.target.kind === 'board' ? `deploy:${cellKey(action.target.cell)}` : `mobile:bench:${action.target.slot}`, 'deploy');
    }
    case 'combine': { await items(); for (const id of [action.a, action.b]) if (!(await press(`item:${id}`))) return 'disabled'; return act(human, 'combine-items', 'combine'); }
    case 'equip': {
      await items();
      const before = human.wire.mark();
      if (!(await press(`item:${action.itemId}`)) || !(await press(`equipment:${action.unitId}:${action.slot}`))) return 'disabled';
      return human.wire.receiptSince(before, 'equip');
    }
    default: return 'unmapped';
  }
}
async function doAction(human, action) {
  const s = await read(human.page);
  const before = fingerprint(s.state), outcome = await perform(human, action);
  if (outcome === 'applied') await pushed(human, x => fingerprint(x.state) !== before, 3_000);
  return outcome;
}

/** The bots' own policy, one intention at a time, carried out through the page; never sells or benches Jayce. */
async function policyTurn(human, { keepUnit = () => false } = {}) {
  const { page, tables } = human;
  let stepsTaken = 0, lastFailure;
  for (let guard = 0; guard < 60; guard++) {
    const s = await read(page);
    if (!inPreparation(s) || s.state.phase !== 'preparation') return;
    const self = s.m6.seats.find(seat => seat.name === human.name);
    const after = (ids, prefix) => Math.max(0, ...ids.filter(id => id.startsWith(prefix)).map(id => Number(id.slice(prefix.length)) || 0)) + 1;
    const input = { ...s.state, nextUnitSerial: Math.max(s.state.nextUnitSerial, after(s.state.preparation.units.map(unit => unit.id), 'unit-')),
      nextItemSerial: Math.max(s.state.nextItemSerial, after(s.state.items.map(item => item.id), 'item-')) };
    let decision;
    try { decision = tables.decideBotAction(input, { difficulty: 'basic', stepsTaken, maxSteps: tables.BOT_MAX_STEPS, self: { seatId: self.seatId, hp: s.state.playerHp, round: s.state.round }, ...(lastFailure ? { lastFailure } : {}) }, human.rng); }
    catch (error) {
      // The policy reads a full rule state; the page's copy of some seats (opening anvils, for one) lacks what it needs.
      if (!human.policyFallback) log(`${human.name}: the bots' policy cannot read the page state (${error.message}); a simple policy plays this seat`);
      human.policyFallback = true;
      return simpleTurn(human, keepUnit);
    }
    human.rng = decision.rng;
    const action = decision.action;
    if (action === 'done') return;
    stepsTaken++;
    const unit = action.unitId && s.state.preparation.units.find(entry => entry.id === action.unitId);
    if (unit && keepUnit(unit) && (action.type === 'sell' || (action.type === 'deploy' && action.target.kind === 'bench'))) return;
    const outcome = await doAction(human, action);
    if (outcome !== 'applied') lastFailure = { action, reason: outcome ?? 'no-receipt' };
  }
}

/** Fallback when the bots' policy cannot read the page state: fill the board, buy pairs and strong cards, level up. */
async function simpleTurn(human, keepUnit) {
  const { page, tables } = human;
  const cost = id => tables.UNIT_DEFINITIONS[id]?.cost ?? 99;
  for (let guard = 0; guard < 20; guard++) {
    const s = await read(page);
    if (!inPreparation(s) || s.state.phase !== 'preparation') return;
    const state = s.state, units = mine(state).filter(unit => !unit.anvil);
    const bench = units.filter(unit => unit.location.kind === 'bench'), board = units.filter(unit => unit.location.kind === 'board');
    const benchFree = state.preparation.benchSize - mine(state).filter(unit => unit.location.kind === 'bench').length;
    const cell = emptyCells(state)[0];
    const best = [...bench].sort((a, b) => b.starLevel - a.starLevel || cost(b.definitionId) - cost(a.definitionId))[0];
    if (best && board.length < deploymentCap(s) && cell) { if (await doAction(human, { type: 'deploy', unitId: best.id, target: { kind: 'board', cell } }) === 'applied') continue; }
    const owned = new Set(units.map(unit => unit.definitionId));
    const offers = state.shop.slots.map((offer, slot) => ({ ...offer, slot })).filter(offer => offer.status === 'available' && cost(offer.definitionId) <= state.gold);
    const pick = offers.find(offer => owned.has(offer.definitionId)) ?? offers.filter(offer => state.gold - cost(offer.definitionId) >= 10).sort((a, b) => cost(b.definitionId) - cost(a.definitionId))[0];
    if (pick && benchFree > 0) { if (await doAction(human, { type: 'buy', slot: pick.slot }) === 'applied') continue; }
    if (pick && benchFree === 0) { const spare = [...bench].filter(unit => !keepUnit(unit)).sort((a, b) => a.starLevel - b.starLevel || cost(a.definitionId) - cost(b.definitionId))[0]; if (spare) { await doAction(human, { type: 'sell', unitId: spare.id }); continue; } }
    if (state.level < 8 && state.gold >= 14) { if (await doAction(human, { type: 'buyXp' }) === 'applied') continue; }
    return;
  }
}

/* ---------------- shared helpers ---------------- */

const isJayce = unit => unit.definitionId === 'jayce';
const playerZone = state => state.preparation.board.deploymentZones.player;
function emptyCells(state) {
  const zone = playerZone(state), taken = new Set([...mine(state).filter(unit => unit.location.kind === 'board').map(unit => cellKey(unit.location.cell)),
    ...(state.itemSummons ?? []).map(summon => summon.unit.location?.kind === 'board' ? cellKey(summon.unit.location.cell) : null).filter(Boolean)]);
  const cells = [];
  for (let row = zone.firstRow; row <= zone.lastRow; row++) for (let col = 0; col < state.preparation.board.columns; col++) if (!taken.has(`${col},${row}`)) cells.push({ col, row });
  return cells;
}
const deploymentCap = s => Number(String(s.hud?.population ?? '').split('/')[1]) || s.state.level;
async function claimOrbs(human) {
  const s = await read(human.page);
  for (const orb of s.state.unclaimedOrbs ?? []) {
    await human.page.evaluate(id => { const node = [...document.querySelectorAll('[data-debug^="orb-claim:"]')].find(button => button.dataset.debug === `orb-claim:${id}`); if (node && !node.disabled) node.click(); }, orb.orbId);
    await human.page.waitForTimeout(150);
  }
}
/** Drags from one client point to another with the real mouse. */
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 14 }); await page.waitForTimeout(120); await page.mouse.up();
}
const dockCenter = page => page.evaluate(() => { const rect = document.querySelector('.shop-dock')?.getBoundingClientRect(); return rect && { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; });
const timerText = page => page.evaluate(() => document.querySelector('[data-debug="online:timer"]')?.textContent ?? null);
const dialog = page => page.evaluate(() => {
  const node = document.querySelector('.choice-dialog');
  if (!node || node.closest('[hidden]')) return null;
  return { source: node.dataset.choiceSource ?? null, title: node.querySelector('h2')?.textContent ?? '', text: node.innerText.slice(0, 400),
    offers: [...node.querySelectorAll('[data-debug^="choice:"]')].map(button => button.dataset.debug.slice('choice:'.length)) };
});

/* ---------------- point 3: preparation lengths ---------------- */

function timingChecks(human) {
  for (const [roundName, expected] of [['1-2', 6_000], ['1-3', 15_000]]) {
    const prep = human.phases.get(`${roundName}:preparation`), index = human.phaseOrder.indexOf(`${roundName}:preparation`);
    const next = index >= 0 ? human.phases.get(human.phaseOrder.slice(index + 1).find(key => key.endsWith(':combat'))) : undefined;
    if (!prep || !next) { note('timing', `${human.name} ${roundName}: preparation not seen from its start`); continue; }
    const wall = next.at - prep.at;
    const extended = prep.extended.length ? `；后来被延长到 ${prep.extended.at(-1)} ms（有座位开了锻造器）` : '';
    check('timing', Math.abs(prep.publishedMs - expected) <= 500, `${human.name} 房间${human.room.id} ${roundName}: 服务器公布的准备时间 ${prep.publishedMs} ms（应为 ${expected}）${extended}`, { publishedMs: prep.publishedMs, extended: prep.extended });
    if (!prep.extended.length) check('timing', Math.abs(wall - expected) <= 1_500, `${human.name} 房间${human.room.id} ${roundName}: 页面实际经历的准备 ${wall} ms（应约 ${expected}）`, { wallMs: wall });
    else note('timing', `${human.name} 房间${human.room.id} ${roundName}: 准备被锻造器延长，实际 ${wall} ms`);
  }
}

/* ---------------- point 1: anvil ---------------- */

async function anvilFlow(human) {
  const { page } = human;
  const s = await read(page);
  const anvil = mine(s.state).find(unit => unit.location.kind === 'bench' && unit.anvil);
  const token = anvil && s.tokens.find(entry => entry.id === anvil.id);
  if (!anvil || !token) { note('anvil', `${human.name} ${s.m6.phase.roundName}: no anvil on the bench (${mine(s.state).map(unit => unit.definitionId).join(', ')})`); return; }
  check('anvil', anvil.location.kind === 'bench', `${human.name} ${s.m6.phase.roundName}: 锻造器 ${anvil.definitionId}（${anvil.anvil.name}）在备战席 ${anvil.location.slot} 号位`, anvil);
  await shot(page, 'anvil', `1-anvil-bench-${human.name}`);
  const phaseBefore = s.m6.phase, itemsBefore = s.state.items.filter(item => item.location.kind === 'inventory').map(item => item.definitionId);
  const dock = await dockCenter(page);
  const before = human.wire.mark(), openedAt = Date.now();
  await drag(page, { x: token.screenX, y: token.screenY }, dock);
  const receipt = await human.wire.receiptSince(before, 'sell', 3_000);
  const open = await pushed(human, x => x.state.pendingChoice?.payload?.source === 'anvil-unit', 3_000);
  check('anvil', receipt === 'applied' && open !== null, `drag to the shop sent sell(${anvil.id}) → ${receipt}; armory open: ${open ? 'yes' : 'no'}`, { commands: human.wire.commandsSince(before, 'sell') });
  if (!open) return;
  await page.waitForTimeout(400);
  const choice = open.state.pendingChoice, shown = await dialog(page), timer = await timerText(page), deadline = human.choiceDeadline;
  const left = deadline ? Math.round(deadline.endsAt - (Date.now() + human.serverOffset)) : null;
  check('anvil', shown?.source === 'forge' && same(shown.offers, choice.offers) && choice.offers.length === 4, `武器库弹窗：「${shown?.title}」，${shown?.offers.length} 个选项 ${shown?.offers.join('/')}，与服务器给的一致`, { choice, shown });
  check('anvil', deadline !== null && left > 27_000 && left <= 30_000, `服务器给我的锻造器倒计时 choiceDeadline 剩 ${left} ms（timeoutMs ${choice.payload.timeoutMs}，超时项 ${choice.payload.timeoutOption}）`, { deadline });
  check('anvil', Number(timer) >= 27 && Number(timer) <= 30, `页面倒计时显示 ${timer} 秒（准备阶段原本剩 ${Math.round((phaseBefore.endsAt - phaseBefore.serverNow) / 1000)} 秒，开启后阶段截止延长到锻造器截止）`, { timer });
  await shot(page, 'anvil', `1-anvil-armory-open-${human.name}`);
  // Nobody picks: wait for the server's deadline.
  await page.waitForTimeout(Math.max(0, (left ?? 30_000) - 4_000));
  await shot(page, 'anvil', `1-anvil-armory-4s-left-${human.name}`);
  const closed = await pushed(human, x => x.state.pendingChoice?.choiceId !== choice.choiceId, 10_000);
  // When the server's push closed the armory (wire time), measured from the push that opened it.
  const openPush = human.choiceLog.find(entry => entry.choiceId === choice.choiceId), closePush = openPush && human.choiceLog.find(entry => entry.at > openPush.at && entry.choiceId !== choice.choiceId);
  const elapsed = openPush && closePush ? closePush.at - openPush.at : Date.now() - openedAt;
  const itemsAfter = closed?.state.items.filter(item => item.location.kind === 'inventory').map(item => item.definitionId) ?? [];
  const gained = itemsAfter.filter(id => { const index = itemsBefore.indexOf(id); if (index >= 0) { itemsBefore.splice(index, 1); return false; } return true; });
  check('anvil', closed !== null && gained.includes(choice.offers[0]) && !mine(closed.state).some(unit => unit.id === anvil.id),
    `不选，打开后 ${(elapsed / 1000).toFixed(1)} 秒服务器关闭武器库，库存多了 ${gained.join(', ') || '（无）'}（第一个选项 ${choice.offers[0]}），锻造器已消耗`, { gained, elapsed });
  await click(page, 'panel:items'); await page.waitForTimeout(300);
  await shot(page, 'anvil', `1-anvil-timeout-first-offer-${human.name}`);
}

/* ---------------- point 2: augment ---------------- */

async function augmentFlow(human) {
  const { page } = human;
  const s = await pushed(human, x => x.state.pendingChoice?.kind === 'augment', 5_000);
  const prep = human.phases.get('2-1:preparation');
  if (!s) { check('augment', false, `${human.name} 2-1: no augment choice open at the start of the preparation`); return; }
  const choice = s.state.pendingChoice, sinceStart = prep ? Date.now() - prep.at : null;
  await page.waitForTimeout(500);
  const shown = await dialog(page), timer = await timerText(page);
  check('augment', s.m6.phase.kind === 'preparation' && choice.choiceId === 'round:2-1:augment', `${human.name} 房间${human.room.id} 2-1: 准备阶段（view ${s.m6.phase.kind}）一开始就有强化三选一（开始后 ${sinceStart} ms 已在）`, { choice: { choiceId: choice.choiceId, offers: choice.offers, augmentTier: choice.augmentTier } });
  check('augment', prep && Math.abs(prep.publishedMs - 50_000) <= 500, `2-1 准备时间公布为 ${prep?.publishedMs} ms（应为 50000），页面倒计时 ${timer}`, { publishedMs: prep?.publishedMs, timer });
  check('augment', shown?.source === 'augment' && same(shown.offers, choice.offers) && choice.offers.length === 3, `强化弹窗「${shown?.title}」显示 ${shown?.offers.join(' / ')}`, shown);
  await shot(page, 'augment', `2-augment-open-${human.name}`);
  // The shop stays open: fold the popup and buy the cheapest affordable card.
  await click(page, 'choice-collapse'); await page.waitForTimeout(200);
  const now = (await read(page)).state;
  const slot = now.shop.slots.findIndex(offer => offer.status === 'available' && human.tables.UNIT_DEFINITIONS[offer.definitionId]?.cost <= now.gold);
  if (slot >= 0) {
    const receipt = await act(human, `mobile:buy-${slot}`, 'buy');
    check('augment', receipt === 'applied', `强化没选时照常买棋子：买 ${now.shop.slots[slot].definitionId} → ${receipt}`);
  } else note('augment', `${human.name}: no affordable shop card to test buying during the augment choice (${now.gold} gold)`);
  await shot(page, 'augment', `2-augment-folded-shop-${human.name}`);
  const ended = await pushed(human, x => x.state.pendingChoice?.choiceId !== choice.choiceId, 60_000);
  const owned = ended?.state.augments.map(entry => entry.definitionId) ?? [];
  const wall = prep && ended ? Date.now() - prep.at : null;
  check('augment', ended !== null && owned.includes(choice.offers[0]), `不选：约 ${wall} ms 后自动拿到第一个 ${choice.offers[0]}（现有强化 ${owned.join(', ')}）`, { owned, wallMs: wall });
  await page.waitForTimeout(400);
  await shot(page, 'augment', `2-augment-timeout-first-offer-${human.name}`);
}

/* ---------------- point 6: chem-baron black market ---------------- */

function chemPolicy(human) {
  const chem = new Set(Object.entries(human.tables.G23_MEMBERSHIP).filter(([, traits]) => traits.includes('chem-baron')).map(([id]) => id));
  return async () => {
    const { page, tables } = human;
    for (let guard = 0; guard < 20; guard++) {
      const s = await read(page);
      if (!inPreparation(s) || s.state.phase !== 'preparation') return;
      const state = s.state, units = mine(state).filter(unit => !unit.anvil), owned = new Set(units.map(unit => unit.definitionId));
      const bench = units.filter(unit => unit.location.kind === 'bench'), board = units.filter(unit => unit.location.kind === 'board');
      const benchFree = state.preparation.benchSize - mine(state).filter(unit => unit.location.kind === 'bench').length;
      const cost = id => tables.UNIT_DEFINITIONS[id]?.cost ?? 99;
      // 1. A Chem-Baron I do not own yet.
      const slot = state.shop.slots.findIndex(offer => offer.status === 'available' && chem.has(offer.definitionId) && !owned.has(offer.definitionId) && cost(offer.definitionId) <= state.gold);
      if (slot >= 0 && benchFree > 0) { await doAction(human, { type: 'buy', slot }); continue; }
      // 2. Non-Chem-Barons leave the board; with a full bench they are sold.
      const outsider = board.find(unit => !chem.has(unit.definitionId));
      if (outsider) {
        const free = [...Array(state.preparation.benchSize).keys()].find(index => !mine(state).some(unit => unit.location.kind === 'bench' && unit.location.slot === index));
        await doAction(human, free === undefined ? { type: 'sell', unitId: outsider.id } : { type: 'deploy', unitId: outsider.id, target: { kind: 'bench', slot: free } }); continue;
      }
      // 3. Distinct Chem-Barons onto the board, up to the cap.
      const onBoard = new Set(board.map(unit => unit.definitionId)), cap = deploymentCap(s);
      const candidate = bench.find(unit => chem.has(unit.definitionId) && !onBoard.has(unit.definitionId));
      const cell = emptyCells(state)[0];
      if (candidate && board.length < cap && cell) { await doAction(human, { type: 'deploy', unitId: candidate.id, target: { kind: 'board', cell } }); continue; }
      // 4. A full bench: sell a non-Chem-Baron reserve.
      if (benchFree === 0) { const spare = bench.find(unit => !chem.has(unit.definitionId)); if (spare) { await doAction(human, { type: 'sell', unitId: spare.id }); continue; } }
      // 5. XP for the 3-cost Chem-Barons and the cap, keeping a little for the next one.
      if (state.level < 6 && state.gold >= (state.level < 4 ? 4 : 8)) { if (await doAction(human, { type: 'buyXp' }) === 'applied') continue; }
      return;
    }
  };
}
async function marketFlow(human, s) {
  const { page, tables } = human;
  const choice = s.state.pendingChoice;
  await page.waitForTimeout(600);
  const view = await page.evaluate(() => {
    const bundle = document.querySelector('[data-debug="market:bundle"]');
    if (!bundle || bundle.closest('[hidden]')) return null;
    return { meta: document.querySelector('.market-meta')?.textContent ?? null, title: bundle.title,
      slots: [...bundle.querySelectorAll('.market-slot')].map(slot => ({ name: slot.querySelector('.market-slot-name')?.textContent ?? '', pool: Boolean(slot.querySelector('.market-pool')), art: Boolean(slot.querySelector('.market-slot-art')?.innerHTML) })),
      take: Boolean(document.querySelector('[data-debug="market:take"]')), keep: Boolean(document.querySelector('[data-debug="market:keep"]')) };
  });
  report.points.market.evidence = { round: s.m6.phase.roundName, choice: { choiceId: choice.choiceId, offers: choice.offers, payload: choice.payload }, view };
  await shot(page, 'market', `6-market-open-${human.name}`);
  check('market', view !== null && view.slots.length > 0, `${human.name} ${s.m6.phase.roundName}: 黑市打开（${view?.meta}），包里 ${view?.slots.map(slot => slot.name).join(' / ')}`, view);
  if (!view) return;
  check('market', view.slots.every(slot => !slot.pool && slot.art && slot.name && !/随机|\?/.test(slot.name)), `每个格子都是具体的东西，有图有名字（${view.slots.map(slot => slot.name).join('、')}；没有“随机/?”格子）`);
  const before = s.state.items.map(item => item.id), toolsBefore = (s.state.consumables ?? []).map(tool => tool.consumableId);
  const receipt = await act(human, 'market:take', 'choose');
  const after = await pushed(human, x => x.state.pendingChoice?.choiceId !== choice.choiceId, 5_000);
  await page.waitForTimeout(500);
  // Rewards that come as orbs (the market's consumables) are claimed like any orb before counting.
  const orbs = (await read(page)).state.unclaimedOrbs ?? [];
  report.points.market.evidence.orbsAfterTake = orbs;
  if (orbs.length) { await claimOrbs(human); await page.waitForTimeout(1_000); }
  const latest = (await read(page)).state;
  // Items go to the inventory, consumables (the shimmer duplicator, say) to the tool shelf: both are what the bundle showed.
  const gained = [...latest.items.filter(item => !before.includes(item.id)).map(item => tables.itemDisplayName(item.definitionId)),
    ...(latest.consumables ?? []).filter(tool => !toolsBefore.includes(tool.consumableId)).map(tool => tables.itemDisplayName(tool.definitionId))].sort();
  // A shimmer duplicator is granted as what it does (G2-3 policy): an orb with a 1★ copy of one of my Chem-Barons.
  const shown = view.slots.filter(slot => !/金币$|星【/.test(slot.name)).map(slot => slot.name);
  const expected = shown.filter(name => !/复制器$/.test(name)).sort(), duplicators = shown.filter(name => /复制器$/.test(name));
  const copies = orbs.flatMap(orb => orb.entries.filter(entry => entry.kind === 'unit').map(entry => `${entry.starLevel ?? 1}★ ${entry.definitionId}`));
  report.points.market.evidence.gained = gained;
  check('market', receipt === 'applied' && after !== null && same(gained, expected), `点「全部拿走」→ ${receipt}；拿到的装备 ${gained.join('、') || '无'}，显示的装备 ${expected.join('、') || '无'}`, { gained, expected });
  if (duplicators.length) check('market', copies.length === duplicators.length, `显示的 ${duplicators.join('、')} 以法球给出炼金男爵复制品 ${copies.join('、') || '（没有）'}`, { orbs });
  await click(page, 'panel:items'); await page.waitForTimeout(300);
  await shot(page, 'market', `6-market-taken-items-${human.name}`);
}

/* ---------------- point 4: Jayce and his forge ---------------- */

async function jayceHunt(human) {
  const { page, tables } = human;
  for (let guard = 0; guard < 30; guard++) {
    const s = await read(page);
    if (!inPreparation(s) || s.state.phase !== 'preparation') return;
    const state = s.state, jayce = mine(state).find(isJayce);
    const benchFree = state.preparation.benchSize - mine(state).filter(unit => unit.location.kind === 'bench').length;
    if (!jayce) {
      const slot = state.shop.slots.findIndex(offer => offer.status === 'available' && offer.definitionId === 'jayce');
      if (slot >= 0 && state.gold >= 5) {
        if (benchFree === 0) { const spare = mine(state).find(unit => unit.location.kind === 'bench' && !unit.anvil); if (spare) await doAction(human, { type: 'sell', unitId: spare.id }); }
        const receipt = await doAction(human, { type: 'buy', slot });
        log(`${human.name} ${s.m6.phase.roundName}: Jayce in the shop, bought → ${receipt}`); continue;
      }
      const lateGame = Number(s.m6.phase.roundName.split('-')[0]) >= 4; // 4-1 and later (overtime rounds count too)
      if (lateGame && state.level < 8 && state.gold >= 24) { if (await doAction(human, { type: 'buyXp' }) === 'applied') continue; }
      if (lateGame && state.level >= 8 && state.gold >= 22) { if (await doAction(human, { type: 'reroll' }) === 'applied') continue; }
      return;
    }
    if (jayce.location.kind === 'bench') {
      const board = mine(state).filter(unit => unit.location.kind === 'board' && !isJayce(unit));
      const cell = emptyCells(state)[0];
      const target = board.length < deploymentCap(s) && cell ? cell : board.sort((a, b) => (tables.UNIT_DEFINITIONS[a.definitionId]?.cost ?? 0) - (tables.UNIT_DEFINITIONS[b.definitionId]?.cost ?? 0))[0]?.location.cell;
      if (!target) return;
      const receipt = await doAction(human, { type: 'deploy', unitId: jayce.id, target: { kind: 'board', cell: target } });
      log(`${human.name} ${s.m6.phase.roundName}: Jayce onto the board at ${cellKey(target)} → ${receipt}`);
      if (receipt !== 'applied') return;
      continue;
    }
    return;
  }
}
/** In a preparation with Jayce on my board: move the forge once, then check it kept its cell the next preparation. */
async function forgeFlow(human) {
  const { page } = human;
  const s = await read(page);
  const jayce = mine(s.state).find(unit => isJayce(unit) && unit.location.kind === 'board');
  const forge = (s.state.itemSummons ?? []).find(summon => summon.kind === 'forge');
  if (human.forge?.moved && s.m6.phase.round > human.forge.round) {
    if (!jayce) { note('forge', `${human.name} ${s.m6.phase.roundName}: Jayce is not on the board any more; the forge check waits for him`); return; }
    const where = forge?.unit.location;
    check('forge', where?.kind === 'board' && cellKey(where.cell) === human.forge.to, `${human.name} ${s.m6.phase.roundName}（下一个准备阶段）: 锻炉还在 ${where?.kind === 'board' ? cellKey(where.cell) : where?.kind}（上回合拖到 ${human.forge.to}）`, { forge });
    await shot(page, 'forge', `4-forge-next-round-${human.name}`);
    human.forge.checked = true;
    return;
  }
  if (human.forge || !jayce) return;
  check('forge', forge !== undefined, `${human.name} ${s.m6.phase.roundName}: 杰斯在 ${cellKey(jayce.location.cell)}，准备阶段有锻炉 ${forge ? `在 ${cellKey(forge.unit.location.cell)}` : '（没有）'}`, { jayce, forge, summons: s.state.itemSummons });
  if (!forge) { human.forge = { failed: true }; return; }
  if (claimed.has('forge-move')) { human.forge = { skipped: true }; return; }
  // The drag needs the preparation to last through it; too late in this one, the next preparation does it.
  if ((Number(await timerText(page)) || 0) < 6) { log(`${human.name} ${s.m6.phase.roundName}: too little preparation left to move the forge, next round`); return; }
  claim('forge-move');
  await shot(page, 'forge', `4-forge-before-drag-${human.name}`);
  const token = s.tokens.find(entry => entry.id === forge.unit.id);
  const cells = emptyCells(s.state).filter(cell => cellKey(cell) !== cellKey(forge.unit.location.cell));
  const target = cells.sort((a, b) => (Math.abs(b.col - forge.unit.location.cell.col) + Math.abs(b.row - forge.unit.location.cell.row)) - (Math.abs(a.col - forge.unit.location.cell.col) + Math.abs(a.row - forge.unit.location.cell.row)))[0];
  if (!token || !target) { check('forge', false, `forge token ${token ? 'found' : 'missing'}, empty cell ${target ? cellKey(target) : 'none'}`); human.forge = { failed: true }; return; }
  const before = human.wire.mark(), to = s.layout.hexes[cellKey(target)];
  await drag(page, { x: token.screenX, y: token.screenY }, to);
  const receipt = await human.wire.receiptSince(before, 'moveItemSummon', 3_000);
  const moved = await pushed(human, x => (x.state.itemSummons ?? []).some(summon => summon.kind === 'forge' && summon.unit.location?.kind === 'board' && cellKey(summon.unit.location.cell) === cellKey(target)), 3_000);
  check('forge', receipt === 'applied' && moved !== null, `拖动锻炉 ${cellKey(forge.unit.location.cell)} → ${cellKey(target)}：moveItemSummon ${receipt}，服务器推送的位置${moved ? '已更新' : '没有变'}`, { commands: human.wire.commandsSince(before, 'moveItemSummon') });
  await page.waitForTimeout(300);
  await shot(page, 'forge', `4-forge-after-drag-${human.name}`);
  human.forge = { round: s.m6.phase.round, from: cellKey(forge.unit.location.cell), to: cellKey(target), moved: receipt === 'applied' };
}

/* ---------------- point 5: overtime ---------------- */

async function overtimeWatch(human, s) {
  const tick = s.replay?.tick ?? 0, round = s.m6.phase.roundName;
  for (const [mark, label] of [[610, '31s'], [895, '45s']]) {
    const key = `${round}:${mark}`;
    if (tick >= mark && !human.shotBattles.has(key)) {
      human.shotBattles.add(key);
      if (report.points.overtime.shots.length < 8) await shot(human.page, 'overtime', `5-overtime-${human.name}-${round}-${label}`);
      log(`${human.name} ${round}: my battle is at tick ${tick} (${label})`);
    }
  }
}
/** Movement step gaps of each unit, before tick 600 and from tick 600 on (consecutive steps only, gap <= 8). */
function stepGaps(moves) {
  const last = new Map(), before = [], after = [];
  for (const [unitId, tick] of [...moves].sort((a, b) => a[1] - b[1])) {
    const previous = last.get(unitId);
    if (previous !== undefined && tick - previous <= 8) (previous >= 600 ? after : tick < 600 ? before : []).push(tick - previous);
    last.set(unitId, tick);
  }
  return { before, after };
}
const histogram = list => Object.fromEntries([...new Set(list)].sort((a, b) => a - b).map(gap => [gap, list.filter(entry => entry === gap).length]));
const mode = list => { const counts = histogram(list); return Number(Object.keys(counts).sort((x, y) => counts[y] - counts[x] || x - y)[0] ?? NaN); };
const mean = list => list.length ? Math.round(list.reduce((sum, gap) => sum + gap, 0) / list.length * 100) / 100 : null;
function overtimeChecks(humans) {
  const seen = new Map();
  for (const human of humans) for (const battle of human.battles.values()) {
    if (!battle.terminal) continue;
    const row = { human: human.name, room: human.room.id, round: battle.round, battleId: battle.battleId, ticks: battle.terminal.tick, result: battle.terminal.result, maxTicks: battle.terminal.maxTicks };
    report.battles.push(row);
    const key = `${human.room.id}:${battle.battleId}`, gaps = stepGaps(battle.moves);
    if (battle.terminal.tick >= 600 && (!seen.has(key) || seen.get(key).gaps.before.length + seen.get(key).gaps.after.length < gaps.before.length + gaps.after.length)) seen.set(key, { row, gaps });
  }
  // Reaching 30 s alone is only part of the point: without a measured speed-up or a 45 s draw it stays PARTIAL.
  const measured = [...seen.values()].some(({ gaps }) => gaps.before.length && gaps.after.length), drawn = [...seen.values()].some(({ row }) => row.ticks >= (row.maxTicks ?? 900));
  if (seen.size && !measured) note('overtime', '移动加快没有在实战里量到（过 30 秒的战斗里单位都站着打），只有截图和时长');
  if (seen.size && (!measured || !drawn)) report.points.overtime.partial = true;
  if (!seen.size) { note('overtime', `no own battle of a browser player reached tick 600 (${report.battles.length} battles, longest ${Math.max(0, ...report.battles.map(row => row.ticks))} ticks)`); return; }
  for (const { row, gaps } of seen.values()) {
    if (!gaps.after.length || !gaps.before.length) {
      check('overtime', true, `${row.human} 房间${row.room} ${row.round}：战斗打到 tick ${row.ticks}（${(row.ticks / 20).toFixed(1)} 秒，结果 ${row.result}），过了 30 秒对局照常进行`, row);
      note('overtime', `${row.human} ${row.round}: 30 秒前后没有足够的连续走格（前 ${gaps.before.length} 个、后 ${gaps.after.length} 个间隔），这场量不出移动速度`);
      continue;
    }
    const ok = gaps.before.length > 0 && gaps.after.length > 0 && mode(gaps.before) === 5 && [3, 4].includes(mode(gaps.after)) && mean(gaps.after) < mean(gaps.before);
    check('overtime', ok, `${row.human} 房间${row.room} ${row.round}：战斗打到 tick ${row.ticks}（${(row.ticks / 20).toFixed(1)} 秒，结果 ${row.result}）；移动间隔 30 秒前 ${JSON.stringify(histogram(gaps.before))} 平均 ${mean(gaps.before)}，30 秒后 ${JSON.stringify(histogram(gaps.after))} 平均 ${mean(gaps.after)}`, { ...row, before: histogram(gaps.before), after: histogram(gaps.after) });
    if (row.ticks >= (row.maxTicks ?? 900)) check('overtime', row.result === 'draw', `打满 ${row.ticks} tick（45 秒）：结果 ${row.result}（应为平局）`, row);
  }
  if (![...seen.values()].some(({ row }) => row.ticks >= (row.maxTicks ?? 900))) note('overtime', 'no battle went the full 45 s, so the draw at 45 s was not observed live');
}

/* ---------------- one player's loop ---------------- */

async function play(human, deadline) {
  const { page, name } = human;
  const chem = human.roles.includes('chem') ? chemPolicy(human) : null;
  let lastRound = null;
  for (;;) {
    if (Date.now() > deadline || human.room.stop) return;
    let s;
    try { s = await read(page); } catch { await sleep(200); continue; }
    if (!s?.state || !s.m6 || s.m6.mode !== 'active') { await sleep(150); continue; }
    const phase = s.m6.phase;
    if (phase.roundName !== lastRound) { lastRound = phase.roundName; if (human.roles.includes('timing')) log(`${name} room ${human.room.id}: ${phase.roundName} hp ${s.state.playerHp} lv ${s.state.level} gold ${s.state.gold}`); }
    if (phase.kind === 'ended') { human.out = true; return; }
    const me = s.m6.seats.find(seat => seat.name === name);
    if (me && !me.alive) { if (!human.out) log(`${name} room ${human.room.id}: eliminated in ${phase.roundName}`); human.out = true; return; }
    try { await step(human, s, chem); }
    catch (error) {
      if (/Execution context was destroyed|Target closed|reading '(state|strategy|tokens)'/.test(String(error?.message))) { await sleep(200); continue; }
      throw error;
    }
  }
}

async function step(human, s, chem) {
  const { page, name } = human;
  const phase = s.m6.phase, state = s.state;
  if (inBattle(s)) { await overtimeWatch(human, s); await page.waitForTimeout(120); return; }

  /* x-4 carousel: the Jayce unit when standing, else the first one */
  const carousel = s.m6.carousel ?? null;
  if (phase.kind === 'carousel' && carousel?.status === 'open' && carousel.eligible && carousel.pickedSlot === null && !human.carousels.has(carousel.id)) {
    const free = await page.evaluate(() => [...document.querySelectorAll('#carousel-panel .carousel-slot')].filter(node => node.classList.contains('takable') && !node.disabled).map(node => Number(node.dataset.slot)));
    if (!free.length) {
      if (s.m6.carouselSide !== 'carousel') { await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur()); await page.keyboard.press('Space'); }
      await page.waitForTimeout(150); return;
    }
    human.carousels.add(carousel.id);
    const jayce = free.find(slot => carousel.slots.find(entry => entry.slot === slot)?.definitionId === 'jayce');
    const slot = jayce ?? free[0];
    const box = await page.locator(`[data-debug="online:carousel-slot:${slot}"]`).boundingBox({ timeout: 1_000 }).catch(() => null);
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    if (jayce !== undefined) log(`${name} ${carousel.roundId}: Jayce on the carousel, picked slot ${slot}`);
    return;
  }

  /* choices */
  const choice = state.pendingChoice;
  if (choice) {
    const key = `${choice.choiceId}:${choice.step}:${choice.generation}`;
    if (choice.kind === 'augment' && phase.roundName === '2-1' && human.roles.includes('augment') && claim(`augment:${human.room.id}`)) { await augmentFlow(human); return; }
    if (choice.kind === 'blackMarket' && !human.answered.has(key)) {
      human.answered.add(key);
      if (human.roles.includes('chem') && claim('market')) { await marketFlow(human, s); human.chemDone = true; return; }
      await click(page, 'market:take'); return;
    }
    if (!human.answered.has(key)) {
      const ok = choice.step === 'target' ? await click(page, `anomaly-target:${mine(state)[0]?.id}`) : await click(page, `choice:${choice.offers[0]}`);
      if (ok) human.answered.add(key);
      await page.waitForTimeout(150);
      return;
    }
  }

  /* preparation: once per round, a short moment after it opened */
  if (inPreparation(s) && state.phase === 'preparation' && !human.prepDone.has(phase.round)) {
    human.prepDone.add(phase.round);
    await claimOrbs(human);
    if (human.roles.includes('anvil') && phase.roundName === '1-4' && claim('anvil')) await anvilFlow(human);
    await forgeFlow(human);
    if (chem && !human.chemDone) await chem();
    // The anvil player keeps its anvils for the 1-4 check.
    else await policyTurn(human, { keepUnit: unit => isJayce(unit) || (human.roles.includes('anvil') && Boolean(unit.anvil) && !claimed.has('anvil')) });
    await jayceHunt(human);
    await forgeFlow(human);
    return;
  }
  await page.waitForTimeout(120);
}

/* ---------------- main ---------------- */

async function main() {
  if (!argv.includes('--no-build')) {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
    log('building dist-server/ and dist/ (npm run build:game, npm run build) …');
    execFileSync('npm', ['run', 'build:game'], { cwd: ROOT, stdio: 'inherit' });
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, VITE_CAT_SHA: sha } });
  }
  if (!existsSync(`${ROOT}dist/index.html`) || !existsSync(`${ROOT}dist-server/game/main.mjs`)) throw new Error('dist/ or dist-server/ missing: run without --no-build');
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
  report.sha = sha;
  const tables = await loadTables();
  const rooms = pickSeeds(tables);
  const webPort = await freePort();
  await start('node', ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], {}, /Local:/);
  const base = `http://127.0.0.1:${webPort}/`;
  const ROLES = { A: [['甲', ['timing', 'anvil', 'augment']], ['乙', ['chem']], ['丙', []], ['丁', []]], B: [['戊', ['timing', 'augment']], ['己', ['chem']], ['庚', []], ['辛', []]] };
  for (const room of rooms) {
    room.wsPort = await startGameServer(await freePort(), { CAT_SEED: room.seed, CAT_GIT_SHA: sha });
    room.base = base; room.humans = [];
    room.health = await fetch(`http://127.0.0.1:${room.wsPort}/healthz`).then(response => response.json());
    report.rooms[room.id] = { seed: room.seed, encounter: room.encounter, wsPort: room.wsPort, webPort, health: room.health };
    log(`room ${room.id}: seed ${room.seed} (${room.encounter}), ws ${room.wsPort}, web ${webPort}, healthz ${JSON.stringify(room.health)}`);
  }
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    const deadline = Date.now() + MINUTES * 60_000, loops = [];
    for (const room of rooms) {
      for (const [name, roles] of ROLES[room.id]) room.humans.push(await openHuman(browser, room, { name, roles }, tables));
      await sleep(1_000);
      await room.humans[0].page.click('[data-debug="online:start"]');
      for (const human of room.humans) loops.push(play(human, deadline).catch(error => { report.errors.push(`${human.name}: ${error.stack ?? error.message}`); log(`${human.name} stopped: ${error.message}`); human.out = true; }));
    }
    const all = rooms.flatMap(room => room.humans);
    // Stop early once every point has a verdict and the overtime and forge checks have their evidence.
    const watcher = (async () => {
      while (Date.now() < deadline && !all.every(human => human.out)) {
        const overtimeSeen = all.some(human => [...human.battles.values()].some(battle => battle.terminal?.tick >= 600));
        const forgeDone = all.some(human => human.forge?.checked);
        if (overtimeSeen && forgeDone && ['anvil', 'augment', 'market'].every(done) && all.filter(human => human.roles.includes('timing')).every(human => human.phases.has('2-1:preparation'))) break;
        await sleep(2_000);
      }
      for (const room of rooms) room.stop = true;
    })();
    await Promise.all([watcher, ...loops]);
    for (const human of all.filter(entry => entry.roles.includes('timing'))) { timingChecks(human); report.rooms[human.room.id].phases = human.phaseOrder.map(key => human.phases.get(key)); }
    overtimeChecks(all);
    if (report.points.overtime.partial && report.points.overtime.status === 'pass') report.points.overtime.status = 'partial';
    if (!done('forge')) note('forge', `nobody had Jayce on the board within the run (${all.map(human => `${human.name}:${human.forge ? JSON.stringify(human.forge) : '-'}`).join(' ')})`);
    if (report.points.forge.status === 'pass' && !all.some(human => human.forge?.checked)) { report.points.forge.status = 'fail'; note('forge', 'the forge moved but the next preparation never came with Jayce on the board'); }
  } finally {
    report.finishedAt = new Date().toISOString();
    writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
    await browser.close().catch(() => {});
    stopAll();
  }
  console.log('\n==== v22 live pre-check ====');
  for (const point of Object.values(report.points)) console.log(`${point.status.toUpperCase().padEnd(11)} ${point.title}${point.shots.length ? `\n            ${point.shots.join('\n            ')}` : ''}`);
  console.log(`page errors: ${report.errors.length}; report: artifacts/live-precheck/report.json`);
  if (Object.values(report.points).some(point => point.status === 'fail')) process.exitCode = 1;
}

main().catch(error => { console.error(error); stopAll(); process.exit(1); });
