import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deepStrictEqual } from 'node:assert/strict';
import { createMatch, deployMatchUnit, buyXp, buyUnit, sellUnit, rerollShop, rerollAugment, selectChoice, equipItem, startMatchCombat, stepMatch, nextRound, type MatchState } from '../src/simulation/match';
import { grantMechanicGold, grantMechanicUnit } from '../src/simulation/seat-mechanics/grants';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { needsCrownHistory } from '../src/simulation/crown-history';
import { BattleHistory } from '../src/replay/history';
import { recordCommand } from './fixtures/recorded-empty-route';
import { accepted, emptyBoard, fieldBench, resolveM5Choices } from './match-helpers';
import { firstNodeSeed, fieldedRoute, FIELDED_LEGS } from './augment-stage-helpers';
import { installB1Offers } from './fixtures/b1-scripted-offers';
import { AUGMENT_ACQUISITION_LEVEL_KEY } from '../src/simulation/augment-xp';
import { FREE_REROLL_KEY, freeRerollsAvailable } from '../src/simulation/free-rerolls';

// P-B4-TAMPER 2026-10-25: command-only witnesses; receipted test grants are
// public domain commands. Only detached saves are forged. No epoch fixture edits.
type Json = any;
type Path = (string | number)[];
const levels = ['caretakers-ally', 'lategame-specialist', 'caretakers-favor', 'birthday-presents', 'caretakers-chosen'];
const xp = ['clear-mind', 'cluttered-mind', 'slammin', 'slammin-plus'];
const rerolls = ['patience-is-a-virtue', 'invested-plus', 'invested-plus-plus'];
const combat = ['category-five', 'long-distance-pals', 'sated-spellweaver', 'overheal'];
// v26 D5 pool (7953c99a): first seeds (0..100; lategame-specialist 0..400, none below 107) whose route
// below offers the card with no history-proof pick before it: lategame-specialist 107 (was 24),
// slammin-plus 43 (was 36), invested-plus 29 (was 16), invested-plus-plus 12 (was 29; its 4-1 checkpoint
// needs no augment/crown history), long-distance-pals 14 (was 49), sated-spellweaver 37 (was 42).
const late: Record<string, [number, string]> = {
 'lategame-specialist': [107, '3-2'], 'slammin-plus': [43, '3-2'],
 'invested-plus': [29, '3-2'], 'invested-plus-plus': [12, '4-2'],
 'long-distance-pals': [14, '3-2'], 'sated-spellweaver': [37, '3-2'], 'overheal': [11, '3-2'],
};
const entries = ['JSON', 'object', 'serialized'] as const;
const read = (s: Json, path: Path): Json => path.reduce((v, k) => v[k], s);
function leaves(value: Json, path: Path): Path[] {
 if (value !== null && typeof value === 'object' && Object.keys(value).length) return Object.entries(value).flatMap(([k, v]) => leaves(v, [...path, Array.isArray(value) ? Number(k) : k]));
 return [path];
}

for (const id of [...levels, ...xp, ...rerolls, ...combat]) describe(id, () => {
 const history = new BattleHistory(`batch4-tamper-${id}`);
 let legitimate: MatchState, saved: string, targets: Path[] = [], roots: Path[] = [], work: Generator<void, MatchState>;
 let serial = 0;
 let restoreOffers: (() => void) | undefined;
 if (id === 'overheal') {
  beforeAll(() => { restoreOffers = installB1Offers(['overheal']); });
  afterAll(() => { restoreOffers?.(); restoreOffers = undefined; });
 }
 const request = () => ({ receiptId: `b4-${id}-${++serial}`, source: 'test' });
 const observe = <T extends { state: MatchState }>(s: MatchState, r: T): T => recordCommand(history, s, r);
 function* fight(s: MatchState, fielded: boolean): Generator<void, MatchState> {
  s = resolveM5Choices(s);
  if (s.phase !== 'preparation') return s;
  s = fielded ? fieldBench(s) : emptyBoard(s);
  s = accepted(observe(s, startMatchCombat(s)));
  while (s.phase === 'combat') { for (let n = 0; n < 40 && s.phase === 'combat'; n++) s = observe(s, stepMatch(s)).state; yield; }
  return resolveM5Choices(s);
 }
 function* build(): Generator<void, MatchState> {
  const [seed, node] = late[id] ?? [firstNodeSeed(id), '2-1'];
  let s = createMatch(seed);
  if (id === 'invested-plus-plus') {
   // Offline search bounded to 0..100 (task constraint): seed 12 (v26 D5 pool 7953c99a; was 29), public slot
   // rerolls 0/1/2. Earlier picks are all-out/pyromaniac (no history at 4-1), so the
   // existing fieldedRoute 4-1 checkpoint starts a short history proof instead
   // of seed 20's no-scout-no-pivot replay from the opening. Keep each cached
   // leg in its own default-timeout hook; the offer assertion below is real RNG.
   for (const leg of FIELDED_LEGS) { s = fieldedRoute(seed, leg); yield; }
   for (const slot of [0, 1, 2]) {
    const c = s.pendingChoice!;
    s = accepted(rerollAugment(s, c.choiceId, c.generation, slot));
   }
  } else {
   while (s.roundDefinitionId !== node) {
    s = yield* fight(s, node === '4-2' || id === 'invested-plus');
    s = accepted(nextRound(s, s.round)); yield;
   }
  }
  const c = s.pendingChoice!; expect(c.offers).toContain(id); // fixture self-check under installB1Offers when scripted
  s = resolveM5Choices(accepted(selectChoice(s, c.choiceId, c.generation, id)));
  if (levels.includes(id)) {
   s = accepted(grantMechanicGold(s, { ...request(), amount: 2000 }));
   const target = id === 'lategame-specialist' ? 9 : id === 'caretakers-chosen' ? 7 : Math.max(6, s.level + 1);
   while (s.level < target) { s = accepted(buyXp(s)); yield; }
   expect(s.seatMechanics!.receipts.some(r => r.source === 'augment-pool-batch4' || r.receiptId.includes(c.choiceId))).toBe(true);
   return s;
  }
  if (rerolls.includes(id)) {
   s = yield* fight(s, id !== 'patience-is-a-virtue');
   s = resolveM5Choices(accepted(nextRound(s, s.round)));
   expect(freeRerollsAvailable(s)).toBeGreaterThan(0);
   s = accepted(rerollShop(s)); expect(s.seatMechanics!.seat[FREE_REROLL_KEY]).toEqual({ used: 1 });
   return s;
  }
  if (id === 'overheal' || id === 'sated-spellweaver') {
   // Keep a healthy ranged beneficiary behind a real frontline, so the witness
   // contains effective excess healing and a nonzero source-owned shield.
   for (const u of s.preparation.units.filter(u => u.team === 'player')) s = resolveM5Choices(accepted(sellUnit(s, u.id)));
   for (const [hero, starLevel, col, row] of [['amumu', 3, 3, 4], [id === 'overheal' ? 'maddie' : 'lux', 3, 3, 7]] as const) {
    s = accepted(grantMechanicUnit(s, { ...request(), definitionId: hero, starLevel }));
    const unit = s.preparation.units.find(u => u.team === 'player' && u.definitionId === hero)!;
    s = accepted(deployMatchUnit(s, unit.id, { kind: 'board', cell: { col, row } }));
   }
  }
  if (id === 'clear-mind') {
   for (const u of s.preparation.units.filter(u => u.team === 'player')) s = resolveM5Choices(accepted(sellUnit(s, u.id)));
  } else if (id === 'cluttered-mind') {
   for (const hero of ['amumu', 'darius', 'draven', 'irelia', 'lux', 'maddie', 'morgana', 'powder', 'steb', 'trundle', 'vex', 'zyra']) {
    if (s.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench').length === s.preparation.benchSize) break;
    s = accepted(grantMechanicUnit(s, { ...request(), definitionId: hero }));
   }
   expect(s.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench')).toHaveLength(s.preparation.benchSize);
  } else {
   if (s.preparation.units.filter(u => u.team === 'player').length < 2) s = accepted(buyUnit(s, s.shop.slots.findIndex(x => x.status === 'available'), s.shop.generation));
   if (id.startsWith('slammin') || id === 'category-five') {
    for (const item of s.items.filter(i => i.location.kind === 'inventory')) {
     let equipped = false;
     for (const u of s.preparation.units.filter(u => u.team === 'player')) {
      for (let slot = 0; slot < 3; slot++) { const r = equipItem(s, item.id, u.id, slot); if (r.ok) { s = r.state; equipped = true; break; } }
      if (equipped) break;
     }
     expect(equipped).toBe(true);
    }
   }
  }
  if (xp.includes(id)) {
   s = yield* fight(s, !['clear-mind', 'cluttered-mind'].includes(id));
   expect(s.roundResults.at(-1)!.xpRequested).toBe(id.startsWith('slammin') ? 4 : 5);
   return s;
  }
  s = fieldBench(s); s = accepted(observe(s, startMatchCombat(s)));
  let seen = false;
  for (let i = 0; i < 1200 && s.phase === 'combat'; i++) {
   const r = observe(s, stepMatch(s)); s = r.state;
   seen = id === 'category-five' ? r.events.some(e => e.type === 'packetDamage' && e.outcome.context.source.definitionId === 'runaans-hurricane')
    : id === 'overheal' ? r.events.some(e => e.type === 'packetDamage' && e.outcome.context.source.definitionId === id)
    : s.combat!.units.some(u => u.mechanismState?.statuses.some(g => g.contributions.some(c => c.source.definitionId === id)));
   if (id === 'overheal' || id === 'sated-spellweaver') seen &&= s.combat!.units.some(u => u.shieldLayers?.some(l => l.source.definitionId === id && l.remaining > 0));
   if (seen) break;
   if (i % 40 === 0) yield;
  }
  expect(seen).toBe(true); expect(s.phase).toBe('combat'); return s;
 }
 beforeAll(() => { work = build(); });
 // Split actual battle computation into bounded default-timeout hooks.
 for (let n = 0; n < 600; n++) beforeAll(() => { if (!legitimate) { const r = work.next(); if (r.done) legitimate = r.value; } });
 beforeAll(() => {
  expect(legitimate).toBeDefined(); saved = JSON.stringify(legitimate);
  const s: Json = legitimate;
  const add = (p: Path) => { const value = read(s, p); targets.push(...leaves(value, p)); if (value !== null && typeof value === 'object') roots.push(p); };
  add(['augments', s.augments.findIndex((a: Json) => a.definitionId === id)]);
  s.scheduleReceipts.forEach((r: Json, i: number) => { if (r.definitionId === id) add(['scheduleReceipts', i]); });
  const owner = s.augments.find((a: Json) => a.definitionId === id);
  s.seatMechanics.receipts.forEach((r: Json, i: number) => { if (r.receiptId.includes(owner.choiceId) || r.source === 'augment-pool-batch4') add(['seatMechanics', 'receipts', i]); });
  if (levels.includes(id)) {
   add(['seatMechanics', 'seat', AUGMENT_ACQUISITION_LEVEL_KEY, owner.choiceId]);
  }
  if (xp.includes(id)) {
   const i = s.roundResults.length - 1;
   for (const k of ['xpRequested', 'xpAwarded', 'levelBefore', 'xpBefore', 'levelAfter', 'xpAfter']) add(['roundResults', i, k]);
  }
  if (rerolls.includes(id)) {
   add(['seatMechanics', 'seat', FREE_REROLL_KEY]);
   s.resourceProvenance.entries.forEach((r: Json, i: number) => { if (r.kind === 'free-reroll') add(['resourceProvenance', 'entries', i]); });
  }
  if (combat.includes(id)) {
   s.combat.units.forEach((u: Json, i: number) => {
    u.sources.forEach((source: Json, j: number) => { if (source.source.sourceDefinitionId === id) add(['combat', 'units', i, 'sources', j]); });
    u.mechanics.forEach((m: Json, j: number) => { if (m.source.definitionId === id) add(['combat', 'units', i, 'mechanics', j]); });
    if (u.team === 'player' && u.mechanics.some((m: Json) => m.source.definitionId === id)) {
     if (id === 'overheal' || id === 'category-five') add(['combat', 'units', i, 'runtime', 'attackCount']);
     if (id === 'sated-spellweaver') add(['combat', 'units', i, 'runtime', 'castCount']);
    }
    u.mechanismState.statuses.forEach((g: Json, j: number) => g.contributions.forEach((c: Json, k: number) => {
     if (c.source.definitionId === id) add(['combat', 'units', i, 'mechanismState', 'statuses', j, 'contributions', k]);
    }));
    u.statuses.forEach((status: Json, j: number) => { if (status.source.definitionId === id) add(['combat', 'units', i, 'statuses', j]); });
    if (id === 'category-five') {
     u.mechanismDefinitions.eventTriggers?.forEach((trigger: Json, j: number) => { if (trigger.source.definitionId === 'runaans-hurricane') add(['combat', 'units', i, 'mechanismDefinitions', 'eventTriggers', j]); });
    }
    u.shieldLayers.forEach((l: Json, j: number) => { if (l.source.definitionId === id) add(['combat', 'units', i, 'shieldLayers', j]); });
   });
   s.combat.strategy.units.forEach((u: Json, i: number) => {
    u.mechanics?.forEach((m: Json, j: number) => { if (m.source.definitionId === id) add(['combat', 'strategy', 'units', i, 'mechanics', j]); });
    u.sources.forEach((source: Json, j: number) => { if (source.source.sourceDefinitionId === id) add(['combat', 'strategy', 'units', i, 'sources', j]); });
   });
   add(['combatInputBasis', 'inputs', 'augments', s.combatInputBasis.inputs.augments.findIndex((a: Json) => a.definitionId === id)]);
  }
  targets = [...new Map(targets.map(p => [JSON.stringify(p), p])).values()];
  expect(targets.length).toBeGreaterThan(3);
  expect(s.scheduleReceipts.find((r: Json) => r.definitionId === id).unitId).toBeNull();
 });
 const restore = (s: MatchState, entry: typeof entries[number]) => {
  const battles = needsCrownHistory(legitimate) ? history.completedRecords : undefined;
  return entry === 'JSON' ? restoreMatch(JSON.stringify(s), battles) : entry === 'object' ? restoreMatch(s, battles) : restoreMatch(serializeMatch(s, battles), battles);
 };
 for (const entry of entries) {
  let live: MatchState, lane: MatchState, done = false, fought = false;
  it(`legitimate ${entry} round-trip`, () => { live = legitimate; lane = restore(live, entry); deepStrictEqual(lane, live); });
  for (let chunk = 0; chunk < 13; chunk++) it(`${entry} identical continuation ${chunk}`, () => {
   for (let n = 0; n < 100 && !done && live.phase !== 'gameOver'; n++) {
    const op = live.phase === 'combat' ? stepMatch : live.phase === 'settlement' ? (s: MatchState) => nextRound(s, s.round)
     : live.phase === 'choice' ? (s: MatchState) => ({ state: resolveM5Choices(s) }) : startMatchCombat;
    fought ||= live.phase === 'combat' || live.phase === 'preparation';
    const a = op(live), b = op(lane); deepStrictEqual(b, a);
    if ('ok' in a) expect(a.ok).toBe(true);
    live = a.state; lane = b.state;
    done = fought && live.phase !== 'combat' && live.phase !== 'preparation';
   }
   deepStrictEqual(lane, live);
  });
  it(`${entry} completes a battle`, () => { expect(done || live.phase === 'gameOver').toBe(true); deepStrictEqual(lane, live); });
 }
 // Bounded path slices retain a separate assertion and diagnostic for every leaf;
 // no schema field is silently excluded because it is shared with another batch.
 for (let chunk = 0; chunk < 160; chunk++) it(`rejects persisted leaf slice ${chunk}`, () => {
  for (const path of targets.slice(chunk * 3, chunk * 3 + 3)) for (const action of ['change', 'delete']) {
   const forged = JSON.parse(saved), parent = read(forged, path.slice(0, -1)), key = path.at(-1)!;
   const v = parent[key];
   if (action === 'delete') delete parent[key];
   else parent[key] = typeof v === 'number' ? v + 1 : typeof v === 'boolean' ? !v : v === null ? 'forged' : `${v}-forged`;
   expect(JSON.stringify(forged), path.join('.')).not.toBe(saved);
   for (const entry of entries) expect(() => restore(forged, entry), `${id} ${path.join('.')} ${action} ${entry}`).toThrow();
  }
 });
 for (let chunk = 0; chunk < 80; chunk++) it(`rejects owned container removal ${chunk}`, () => {
  for (const path of roots.slice(chunk, chunk + 1)) {
   const forged = JSON.parse(saved), parent = read(forged, path.slice(0, -1)), key = path.at(-1)!;
   if (Array.isArray(parent)) parent.splice(Number(key), 1); else delete parent[key];
   for (const entry of entries) expect(() => restore(forged, entry), `${id} remove ${path.join('.')} ${entry}`).toThrow();
  }
 });
 for (const entry of entries) it(`${entry} rejects forged augment schedule unitId`, () => {
  const forged = JSON.parse(saved);
  const receipt = forged.scheduleReceipts.find((r: Json) => r.definitionId === id);
  receipt.unitId = 'forged';
  expect(() => restore(forged, entry)).toThrow();
 });
 it('all owned persisted leaves fit the attack matrix', () => { expect(targets.length).toBeLessThanOrEqual(480); expect(roots.length).toBeLessThanOrEqual(80);
  console.info(JSON.stringify({ augment: id, leaves: targets.length, containers: roots.length, rejectedLeafAttempts: targets.length * 6, dedicatedUnitIdAttempts: 3, containerAttempts: roots.length * 3 })); });
});
