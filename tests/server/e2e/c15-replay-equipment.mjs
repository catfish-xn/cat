/**
 * Work order C15: in a PvP replay my units are named by battle ids (contract §10.2); the server sends my own
 * battle id → original id pairs with the replay (`unitIds`) and the board shows each of my battle units with the
 * equipment of the unit it stands for. Two humans + six bots against the real game server (`?server=ws`).
 *
 *   npm run build:game && node tests/server/e2e/c15-replay-equipment.mjs
 *
 * Each page, independently:
 *   1. In a preparation phase with an item in its inventory, equips it on one of its units through the strategy
 *      item bench (drag onto an empty unit, slot 0) and waits for the state push that shows it equipped.
 *   2. Waits for its first PvP replay after that (a `replay` frame with a non-empty `unitIds`; PvE frames carry none)
 *      in which the equipped unit fights, and while it plays checks: every own battle token (each `combatId` of the frame)
 *      draws exactly the item pips my state holds for its `originalId`, the equipped unit's token among them; every
 *      enemy token draws none; the frame names only units on my side of the replay.
 * Fails on any page or console error. Screenshots go to artifacts/c15/ (not committed). CHROMIUM overrides the browser
 * path; C15_VITE_PORT (default 5204) and C15_WS_PORT (default 8796) override the ports.
 */
import { writeFileSync } from 'node:fs';
import { click, dragEquipment, collectErrors, createChecks, joinOnline, launchBrowser, onlineUrl, onWire, outDir, read, startGameServer, startVite, stopAll } from './harness.mjs';

const OUT = outDir('c15');
const VITE_PORT = Number(process.env.C15_VITE_PORT ?? 5204);
const WS_PORT = Number(process.env.C15_WS_PORT ?? 8796);

const { check, failures } = createChecks();
async function waitRead(page, predicate, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const snapshot = await read(page).catch(() => null);
    if (snapshot && predicate(snapshot)) return snapshot;
    if (Date.now() > deadline) return null;
    await page.waitForTimeout(50);
  }
}
const inPreparation = s => s?.m6?.phase?.kind === 'preparation' && s.state.phase === 'preparation';
/** Item definition ids my state holds on a unit, in slot order: what its token must draw. */
const itemsOn = (state, unitId) => state.items.filter(item => item.location.kind === 'unit' && item.location.unitId === unitId)
  .sort((a, b) => a.location.slot - b.location.slot).map(item => item.definitionId);

async function openPage(browser, url, name, errors) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const replays = [];
  collectErrors(page, errors, name);
  onWire(page, { received: m => { if (m.type === 'replay') replays.push({ round: m.round, battleId: m.battleId, unitIds: m.unitIds, at: Date.now() }); } });
  await joinOnline(page, url, name, { startMatch: false });
  return { name, page, context, replays };
}

/** Steps 1–2 above for one page; returns its report. */
async function play({ name, page, replays }) {
  const answered = new Set();
  let equipped = null;
  const deadline = Date.now() + 12 * 60_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error(`${name}: timed out (equipped ${JSON.stringify(equipped)}, replays ${replays.length})`);
    const s = await read(page).catch(() => null);
    if (!s?.state) { await page.waitForTimeout(100); continue; }
    if (s.m6?.phase?.kind === 'ended') throw new Error(`${name}: match ended before a PvP replay with the equipped unit`);
    const choice = s.state.phase === 'choice' ? s.state.pendingChoice : null;
    if (choice && !answered.has(`${choice.choiceId}:${choice.generation ?? 0}`)) {
      answered.add(`${choice.choiceId}:${choice.generation ?? 0}`);
      await click(page, `choice:${choice.offers[0]}`);
      continue;
    }
    // 1. Equip once: the first inventory item onto a board unit (a bench unit if none is on the board yet).
    if (!equipped && inPreparation(s)) {
      const item = s.state.items.find(candidate => candidate.location.kind === 'inventory');
      const units = s.state.preparation.units.filter(unit => unit.team === 'player' && itemsOn(s.state, unit.id).length === 0);
      const unit = units.find(candidate => candidate.location.kind === 'board') ?? units[0];
      if (item && unit) {
        await page.waitForTimeout(80);
        {
          await dragEquipment(page, item.id, unit.id);
          const shown = await waitRead(page, x => x.state.items.some(entry => entry.id === item.id && entry.location.kind === 'unit' && entry.location.unitId === unit.id && entry.location.slot === 0));
          if (shown) {
            equipped = { itemId: item.id, definitionId: item.definitionId, unitId: unit.id, round: s.state.round, at: Date.now() };
            console.log(`    ${name}: equipped ${item.definitionId} (${item.id}) on ${unit.definitionId} (${unit.id}) in round ${s.state.round}`);
            const token = shown.tokens.find(entry => entry.id === unit.id);
            check(token?.equipped.includes(item.definitionId), `${name}: preparation token of ${unit.id} draws the ${item.definitionId} pip`);
          }
        }
      }
      await page.waitForTimeout(100);
      continue;
    }
    // 2. A PvP replay (non-empty unitIds) received after equipping, in which the equipped unit fights, while it is on the board.
    const frame = equipped ? replays.findLast(entry => entry.at > equipped.at && Array.isArray(entry.unitIds) && entry.unitIds.length > 0) : undefined;
    const ids = new Set(s.combatView?.units.map(unit => unit.id) ?? []);
    if (!frame || !s.replay?.playingBack || !frame.unitIds.every(entry => ids.has(entry.combatId))) { await page.waitForTimeout(80); continue; }
    const fighting = frame.unitIds.find(entry => entry.originalId === equipped.unitId);
    if (!fighting) { console.log(`    ${name}: round ${frame.round} PvP replay without the equipped unit; waiting for the next one`); equipped = { ...equipped, at: Date.now() }; continue; }
    const tokens = new Map(s.tokens.map(token => [token.id, token]));
    const team = new Map(s.combatView.units.map(unit => [unit.id, unit.team]));
    check(frame.unitIds.every(entry => team.get(entry.combatId) === 'player'), `${name}: round ${frame.round} unitIds name only units on my side of the replay (${frame.unitIds.length})`);
    check(frame.unitIds.every(entry => Object.keys(entry).sort().join() === 'combatId,originalId'), `${name}: each unitIds entry is exactly {combatId, originalId}`);
    const own = frame.unitIds.map(entry => ({ ...entry, expected: itemsOn(s.state, entry.originalId), drawn: tokens.get(entry.combatId)?.equipped ?? null }));
    check(own.every(entry => JSON.stringify(entry.drawn) === JSON.stringify(entry.expected)),
      `${name}: every own battle token draws its unit's items ${JSON.stringify(own.map(({ originalId, drawn }) => [originalId, drawn]))}`);
    check(tokens.get(fighting.combatId)?.equipped.includes(equipped.definitionId), `${name}: the equipped ${equipped.unitId} fights as a battle token showing ${equipped.definitionId}`);
    const enemies = s.combatView.units.filter(unit => unit.team === 'enemy');
    check(enemies.length > 0 && enemies.every(unit => (tokens.get(unit.id)?.equipped ?? []).length === 0), `${name}: no enemy token draws equipment (${enemies.length} enemies)`);
    await page.screenshot({ path: `${OUT}/${name}-pvp-replay.png` });
    return { name, equipped, round: frame.round, battleId: frame.battleId, own: own.map(({ combatId, originalId, drawn }) => ({ combatId, originalId, drawn })) };
  }
}

async function main() {
  const wsPort = await startGameServer(WS_PORT, { CAT_PREP_SEC: '6', CAT_CHOICE_SEC: '6', CAT_SETTLE_SEC: '2', CAT_BOT_STEP_MS: '150' });
  const base = await startVite(VITE_PORT);
  const browser = await launchBrowser();
  const errors = [];
  try {
    const url = onlineUrl(base, wsPort);
    const a = await openPage(browser, url, 'jia', errors), b = await openPage(browser, url, 'yi', errors);
    await a.page.waitForSelector('[data-debug="online:start"]');
    await a.page.click('[data-debug="online:start"]');
    const reports = await Promise.all([play(a), play(b)]);
    writeFileSync(`${OUT}/report.json`, JSON.stringify(reports, null, 2));
    check(errors.length === 0, `no page or console errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  } finally { await browser.close(); stopAll(); }
  if (failures.length) throw new Error(`${failures.length} check(s) failed:\n${failures.join('\n')}`);
}
main().then(() => { console.log('c15 replay equipment e2e passed'); process.exit(0); }, error => { console.error(error); stopAll(); process.exit(1); });
