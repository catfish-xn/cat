import { recordCommand, recordedEmptyRoute } from './fixtures/recorded-empty-route';
import { beforeAll, describe, expect, it } from 'vitest';
import { deepStrictEqual } from 'node:assert/strict';
import { readLootView, buyXp, deployMatchUnit, equipItem, nextRound, rerollAugment, selectChoice, sellUnit,
  startMatchCombat, stepMatch, useConsumable, type MatchState } from '../src/simulation/match';
import { grantMechanicGold, grantMechanicItem, grantMechanicUnit, grantMechanicConsumable } from '../src/simulation/seat-mechanics/grants';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { g23Laboratories } from '../src/simulation/g2-3-experiment';
import { readRoundEnemyProjection } from '../src/simulation/round-enemies';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { openingEncounterId } from '../src/simulation/opening-encounter';
import { createMatch } from '../src/simulation/match';
import { BattleHistory } from '../src/replay/history';
import type { BattleRecord } from '../src/m6/contracts';
import { reachRound, resolveM5Choices } from './match-helpers';

function accepted<T extends { ok: boolean; state: MatchState; reason?: string }>(r: T): MatchState {
  expect(r.ok, r.reason).toBe(true); return r.state;
}
// P 2026-10-25: fixtures use real, receipted mechanic grant commands, ordinary
// deployment/equipment/choices/combat. Only detached, already serialized saves are edited.
// Deliberately loose at the untrusted JSON boundary: missing/extra keys are attacks.
type Json = any;
const entries = ['JSON', 'object', 'serialized'] as const;
const restore = (s: MatchState, entry: typeof entries[number], battles?: readonly BattleRecord[]) => entry === 'JSON'
  ? restoreMatch(JSON.stringify(s), battles) : entry === 'object' ? restoreMatch(s, battles) : restoreMatch(serializeMatch(s, battles), battles);
let bloodHistory: BattleHistory;
function recorded<T extends { state: MatchState; events?: readonly import('../src/simulation/match').MatchEvent[]; ok?: boolean }>(before: MatchState, result: T): T {
  return recordCommand(bloodHistory, before, result);
}
function reachBloodRound(seed: number): MatchState {
  bloodHistory = new BattleHistory('v23-blood-history');
  return recordedEmptyRoute(seed, '2-1', bloodHistory);
}
const emblem = (trait: string) => Object.values(EMBLEM_ITEMS).find(e => e.emblemTrait === trait)!.id;
const unit = (s: Json, id: string): Json => s.combat.units.find((u: Json) => u.definitionId === id && u.team === 'player');
const mech = (s: Json, id: string, name: string): Json => unit(s, id).mechanics.find((m: Json) => m.mechanic === name);
let receipt = 0;
const request = () => ({ receiptId: `v23-tamper-${++receipt}`, source: 'test' });
function clear(s: MatchState): MatchState {
  for (let i = 0; s.preparation.units.some(u => u.team === 'player') && i < 50; i++) {
    const u = s.preparation.units.find(u => u.team === 'player')!;
    s = resolveM5Choices(accepted(sellUnit(s, u.id)));
  }
  return s;
}
function add(s: MatchState, id: string, col: number, row = 7, starLevel: 1|2|3 = 1): MatchState {
  s = accepted(grantMechanicUnit(s, { ...request(), definitionId: id, starLevel }));
  const u = s.preparation.units.find(u => u.team === 'player' && u.definitionId === id && u.location.kind === 'bench')!;
  return accepted(deployMatchUnit(s, u.id, { kind: 'board', cell: { col, row } }));
}
function item(s: MatchState, definitionId: string, holder: string, slot = 0): MatchState {
  const id = s.nextItemSerial;
  s = accepted(grantMechanicItem(s, { ...request(), definitionId }));
  return accepted(equipItem(s, `item-${id}`, s.preparation.units.find(u => u.team === 'player' && u.definitionId === holder)!.id, slot));
}
function level(s: MatchState, n: number): MatchState {
  s = accepted(grantMechanicGold(s, { ...request(), amount: 1500 }));
  while (s.level < n) s = accepted(buyXp(s));
  return s;
}
function until(s: MatchState, predicate: (s: MatchState) => boolean): MatchState {
  for (let tick = 0; tick < 1201; tick++) {
    if (predicate(s)) return s;
    if (s.phase !== 'combat') break;
    s = stepMatch(s).state;
  }
  throw Error('Real combat did not reach required checkpoint');
}
function matrix(name: string, build: () => MatchState | Generator<void, MatchState>, edits: readonly [string, (s: Json) => void][]) {
  describe(name, () => {
    let saved: string, legitimate: MatchState, battles: readonly BattleRecord[] | undefined, work: Generator<void, MatchState> | undefined;
    beforeAll(() => {
      const result = build();
      if ('next' in result) work = result; else legitimate = result;
    });
    // Advance long, real-command fixture routes in bounded chunks. Each hook
    // retains Vitest's default timeout; no fabricated shortcut state is used.
    for (let chunk = 0; chunk < 512; chunk++) beforeAll(() => {
      if (work && !legitimate) { const next = work.next(); if (next.done) legitimate = next.value; }
    });
    beforeAll(() => { expect(legitimate).toBeDefined(); battles = name.startsWith('blood-brothers') ? bloodHistory.completedRecords : undefined; saved = serializeMatch(legitimate, battles); });
    for (const entry of entries) describe(`legitimate ${entry} continuation`, () => {
      let a: MatchState, b: MatchState;
      it('round-trips and starts the next battle when between rounds', () => {
        a = JSON.parse(saved); b = restore(a, entry, battles); deepStrictEqual(b, a);
        if (a.phase === 'settlement') { a = accepted(nextRound(a, a.round)); b = accepted(nextRound(b, b.round)); }
        a = resolveM5Choices(a); b = resolveM5Choices(b);
        if (a.phase === 'preparation') {
          const next = startMatchCombat(a); deepStrictEqual(startMatchCombat(b), next);
          a = accepted(next); b = accepted(startMatchCombat(b));
        }
      });
      // Bounded consecutive segments keep full tick/state/event/RNG assertions
      // within Vitest defaults without changing the battle or adding timeouts.
      it.each(Array.from({ length: 13 }, (_, i) => i))('identical continuation segment %i', () => {
        for (let i = 0; a.phase === 'combat' && i < 100; i++) {
          const next = stepMatch(a), restored = stepMatch(b);
          deepStrictEqual(restored, next); a = next.state; b = restored.state;
        }
        deepStrictEqual(b, a);
      });
      it('reaches identical settlement', () => { expect(a.phase).not.toBe('combat'); deepStrictEqual(b, a); });
    });
    if (name === 'blood-brothers between-round persisted facts') {
      it.each(entries)('requires complete independent history (%s)', entry => {
        const state = JSON.parse(saved);
        expect(() => restore(state, entry)).toThrow('missing historical evidence');
        expect(() => restore(state, entry, battles!.slice(0, -1))).toThrow('历史缺战或重战');
        // JSON archives must authenticate in a fresh object graph too.
        deepStrictEqual(restore(state, entry, JSON.parse(JSON.stringify(battles))), state);
      });
      it('cannot bypass history admission by deleting both historical counters', () => {
        const state = JSON.parse(saved);
        for (const receipt of state.seatMechanics.hidden.progress.economyReceipts) {
          if (receipt.kind === 'battle' && receipt.facts.batch2) {
            receipt.facts.batch2 = receipt.facts.batch2.filter((fact: Json) => !fact.definitionId.startsWith('blood-brothers'));
            if (!receipt.facts.batch2.length) delete receipt.facts.batch2;
          }
        }
        for (const entry of entries) expect(() => restore(state, entry)).toThrow('missing historical evidence');
        for (const entry of entries) expect(() => restore(state, entry, battles)).toThrow();
      });
    }
    for (const [label, edit] of edits) {
      it.each(entries)(`rejects ${label} (%s)`, entry => {
        const forged = JSON.parse(saved), before = JSON.stringify(forged);
        edit(forged);
        expect(JSON.stringify(forged)).not.toBe(before);
        expect(() => restore(forged, entry, battles)).toThrow();
      });
    }
  });
}
const fields = (label: string, get: (s: Json) => Json, keys: readonly string[]): [string, (s: Json) => void][] => keys.flatMap(key => [
  [`${label}.${key} changed`, (s: Json) => { const x = get(s); expect(x).toBeDefined(); const v = x[key]; x[key] = typeof v === 'number' ? v + 1 : typeof v === 'boolean' ? !v : v === null ? 'forged' : `${v}-forged`; }],
  [`${label}.${key} deleted`, (s: Json) => { const x = get(s); expect(Object.hasOwn(x, key)).toBe(true); delete x[key]; }],
] as [string, (s: Json) => void][]);

let roseSave: MatchState | undefined;
function* rose(): Generator<void, MatchState> {
  if (roseSave) return roseSave;
  let s = level(clear(reachRound('3-1')), 7);
  for (const [i, id] of ['morgana', 'vladimir', 'cassiopeia', 'amumu', 'steb', 'trundle', 'powder'].entries()) {
    s = add(s, id, i, 4);
    if (i >= 3) s = item(s, emblem('black-rose'), id);
  }
  s = accepted(startMatchCombat(s));
  expect(mech(s, 'g23-sion', 'g23Sion').values.tier).toBe(7);
  for (let round = 0; round < 15; round++) {
    let ticks = 0;
    while (s.phase === 'combat') {
      if (++ticks % 50 === 0) yield;
      if (unit(s, 'g23-sion').g23Sion) { roseSave = s; return s; }
      s = stepMatch(s).state;
    }
    s = resolveM5Choices(s);
    s = resolveM5Choices(accepted(nextRound(s, s.round)));
    if (s.phase === 'preparation') s = accepted(startMatchCombat(s));
  }
  throw Error('No real Sion death');
}
matrix('Black Rose 7 genuine revive countdown', rose, [
  ...fields('g23Sion', s => unit(s, 'g23-sion').g23Sion, ['reviveAtTick', 'revived']),
  ['g23Sion deleted', s => { delete unit(s, 'g23-sion').g23Sion; }],
  ['g23Sion wrong holder', s => { unit(s, 'morgana').g23Sion = unit(s, 'g23-sion').g23Sion; }],
  ['g23Sion extra field', s => { unit(s, 'g23-sion').g23Sion.extra = 1; }],
  ['tier lowered', s => { mech(s, 'g23-sion', 'g23Sion').values.tier = 4; }],
]);
matrix('Black Rose 7 completed revive', function* () { return until(yield* rose(), s => unit(s, 'g23-sion').g23Sion?.revived === true); }, [
  ...fields('g23Sion', s => unit(s, 'g23-sion').g23Sion, ['reviveAtTick', 'revived']),
]);

function scrap(tier: number): MatchState {
  let s = level(clear(reachRound('2-1')), tier);
  const ids = ['corki', 'ekko', 'powder', 'rumble', 'trundle', 'ziggs', 'gangplank', 'maddie', 'loris'].slice(0, tier);
  for (const [i, id] of ids.entries()) {
    s = add(s, id, i % 7, 6 + Math.floor(i / 7));
    if (i >= 7) s = item(s, emblem('scrap'), id);
  }
  s = item(s, 'belt', 'corki');
  s = accepted(startMatchCombat(s)); s = stepMatch(s).state;
  expect(s.combat!.strategy!.traits.find(t => t.traitId === 'scrap' && t.team === 'player')!.tier).toBe(tier);
  const sources = unit(s, 'corki').sources.filter((x: Json) => x.source.sourceKind === 'item');
  expect([...new Set(sources.map((x: Json) => x.source.sourceDefinitionId))].sort()).toEqual((tier === 6
    ? ['guardbreaker'] : ['TFT5_Item_TrapClawRadiant']).sort());
  return s;
}
for (const tier of [6, 9]) matrix(`Scrap ${tier} lucky/radiant conversion`, () => scrap(tier), [
  ...fields('scrap values', s => mech(s, 'corki', 'scrap').values, ['componentCount', 'shieldPerComponent']),
  ...fields('converted source', s => unit(s, 'corki').sources.find((x: Json) => x.source.sourceKind === 'item').source, ['ownerId', 'effectIndex', 'sourceKind']),
  ...fields('converted declaration', s => unit(s, 'corki').sources.find((x: Json) => x.source.sourceKind === 'item'), ['key']),
  ['converted source definition', s => { unit(s, 'corki').sources.find((x: Json) => x.source.sourceKind === 'item').source.sourceDefinitionId = 'bloodthirster'; }],
  ['converted source instance', s => { unit(s, 'corki').sources.find((x: Json) => x.source.sourceKind === 'item').source.sourceInstanceId = 'item-999'; }],
  ['converted effects', s => { unit(s, 'corki').sources.find((x: Json) => x.source.sourceKind === 'item').effect = { kind: 'statFlat', stat: 'attackDamage', amount: 999 };  }],
  ['converted sources deleted', s => { unit(s, 'corki').sources = unit(s, 'corki').sources.filter((x: Json) => x.source.sourceKind !== 'item'); }],
  ['strategy conversion', s => { s.combat.strategy.units.find((u: Json) => u.unitId === unit(s, 'corki').id).sources.find((x: Json) => x.source.sourceKind === 'item').source.sourceDefinitionId = 'bloodthirster'; }],
  ['original component', s => { s.items.find((i: Json) => i.definitionId === 'belt').definitionId = 'cloak'; }],
]);

function experiment(): MatchState {
  let s = clear(reachRound('2-1'));
  const ids = ['amumu', ...Object.values(UNIT_DEFINITIONS).filter(d => d.traits.includes('experiment') && !d.summon).map(d => d.id).sort().slice(0, 2)];
  for (const [i, id] of ids.entries()) s = add(s, id, i);
  s = item(s, emblem('experiment'), ids[0]);
  const labs = g23Laboratories(readG23Progress(s)!.seed, 'player', 3);
  // Move to spare cells first so neither Laboratory is occupied during deployment.
  for (const [i, id] of ids.entries()) s = accepted(deployMatchUnit(s, s.preparation.units.find(u => u.definitionId === id)!.id, { kind: 'board', cell: { col: i, row: 6 } }));
  for (const [i, id] of ids.slice(0, 2).entries()) s = accepted(deployMatchUnit(s, s.preparation.units.find(u => u.definitionId === id)!.id, { kind: 'board', cell: labs[i] }));
  s = accepted(startMatchCombat(s));
  expect(unit(s, 'amumu').experimentClone).toBeDefined();
  return until(s, s => unit(s, 'amumu').experimentClone?.triggeredAtTick !== null);
}
const copy = (s: Json): Json => s.combat.units.find((u: Json) => u.id === unit(s, 'amumu').experimentClone.cloneId);
matrix('Experiment genuine split', experiment, [
  ...fields('clone declaration', s => mech(s, 'amumu', 'g23ExperimentClone').values, ['healthBps', 'splitTick']),
  ...fields('clone origin location', s => copy(s).itemSummon.unit.location, ['kind']),
  ...fields('experimentClone', s => unit(s, 'amumu').experimentClone, ['openingMaxHp', 'triggeredAtTick', 'cloneId']),
  ['experimentClone deleted', s => { delete unit(s, 'amumu').experimentClone; }],
  ['trigger reset', s => { unit(s, 'amumu').experimentClone.triggeredAtTick = null; }],
  ...fields('clone summon', s => copy(s).itemSummon, ['kind', 'ownerId', 'healthBps', 'spawnedAtTick', 'copyOrdinal', 'itemInstanceId']),
  ...fields('clone origin unit', s => copy(s).itemSummon.unit, ['id', 'definitionId', 'team', 'starLevel']),
  ...fields('clone form cell', s => copy(s).itemSummon.formCell, ['col', 'row']),
  ...fields('clone origin cell', s => copy(s).itemSummon.unit.location.cell, ['col', 'row']),
  ...fields('clone HP basis', s => copy(s).maxHpBasis, ['base', 'flat', 'bps', 'bonusBps']),
  ['clone opening HP', s => { copy(s).itemSummonOpeningMaxHp++; }],
  ['clone deleted', s => { s.combat.units = s.combat.units.filter((u: Json) => u.id !== copy(s).id); }],
  ['clone duplicated', s => { s.combat.units.push(structuredClone(copy(s))); }],
  ['clone maxHp', s => { copy(s).maxHp++; }],
  ['clone HP', s => { copy(s).hp++; }],
]);

// Search only authentic initial public augment offers; final selection is a command.
function acquire(id: string): MatchState {
  for (let seed = 0; seed < 10000; seed++) {
    const root = createMatch(seed);
    if (openingEncounterId(root) === 'trainer-golems') continue;
    if (!generateChoices(augmentCandidates(resolveAugmentTier(root, 'round:2-1:augment'), [], [], null,
      { node: '2-1', fieldedTraits: [], blocked: [] }), root.choiceRngState).offers.includes(id)) continue;
    const s = id === 'blood-brothers' ? reachBloodRound(seed) : reachRound('2-1', false, seed);
    const c = s.pendingChoice!;
    if (c.offers.includes(id)) return resolveM5Choices(accepted(selectChoice(s, c.choiceId, c.generation, id)));
  }
  throw Error(`No public ${id} offer`);
}
function* acquireBetrayal(): Generator<void, MatchState> {
  // Seed 12, discovered through real commands. Betrayal is 3-2-only and
  // trait-tailored; field both partners BEFORE opening that node's offer.
  let s = clear(reachRound('2-1', true, 12));
  s = add(s, 'maddie', 0, 4); s = add(s, 'ambessa', 3, 7);
  while (s.roundDefinitionId !== '3-2') {
    s = resolveM5Choices(s);
    if (s.phase === 'preparation') s = accepted(startMatchCombat(s));
    for (let tick = 0; s.phase === 'combat' && tick < 1201; tick++) {
      s = stepMatch(s).state; if (tick % 50 === 0) yield;
    }
    s = resolveM5Choices(s); s = accepted(nextRound(s, s.round));
  }
  for (let slot = 0; slot < 3 && !s.pendingChoice!.offers.includes('betrayal'); slot++) {
    const c = s.pendingChoice!, r = rerollAugment(s, c.choiceId, c.generation, slot);
    if (r.ok) s = r.state;
  }
  const c = s.pendingChoice!;
  expect(c.kind).toBe('augment'); expect(c.offers).toContain('betrayal');
  return resolveM5Choices(accepted(selectChoice(s, c.choiceId, c.generation, 'betrayal')));
}
const partnerSaves = new Map<string, MatchState>();
function* partners(id: string): Generator<void, MatchState> {
  const cached = partnerSaves.get(id); if (cached) return cached;
  let s = clear(id === 'betrayal' ? yield* acquireBetrayal() : acquire(id));
  for (const [i, hero] of (id === 'blood-brothers' ? ['vander', 'silco'] : ['maddie', 'ambessa']).entries())
    s = add(s, hero, i * 3, i ? 7 : 4, id === 'betrayal' ? 3 : 1);
  s = accepted(id === 'blood-brothers' ? recorded(s, startMatchCombat(s)) : startMatchCombat(s));
  for (let tick = 0; tick < 1201; tick++) {
    if (s.combat!.units.some(u => id === 'blood-brothers' ? (u.batch2?.casts ?? 0) > 0 : (u.batch2?.kills ?? 0) > 0)) {
      partnerSaves.set(id, s); return s;
    }
    expect(s.phase).toBe('combat'); s = (id === 'blood-brothers' ? recorded(s, stepMatch(s)) : stepMatch(s)).state; if (tick % 50 === 0) yield;
  }
  throw Error('No genuine partner runtime');
}
for (const [id, hero, keys] of [['blood-brothers', 'silco', ['casts', 'vanderDeaths']], ['blood-brothers', 'vander', ['deaths']], ['betrayal', 'ambessa', ['kills']]] as const) {
  matrix(`${id} ${hero} runtime`, () => partners(id), [
    ...keys.map(key => [`${key} incremented`, (s: Json) => { const u = unit(s, hero); u.batch2 = { ...u.batch2, [key]: (u.batch2?.[key] ?? 0) + 1 }; }] as [string, (s: Json) => void]),
    ['augment binding removed', s => { unit(s, hero).mechanics = unit(s, hero).mechanics.filter((m: Json) => !(m.mechanic === 'traitAugmentB2' && m.source.definitionId === id)); }],
    ['augment binding source', s => { unit(s, hero).mechanics.find((m: Json) => m.mechanic === 'traitAugmentB2' && m.source.definitionId === id).source.ownerId = 'unit-999'; }],
    ...(id === 'blood-brothers' && hero === 'vander' ? [
      ['Vander grown maxHp', (s: Json) => { unit(s, hero).maxHp++; }],
      ['Vander grown current hp', (s: Json) => { unit(s, hero).hp++; }],
      ['Vander flat health basis', (s: Json) => { unit(s, hero).maxHpBasis.flat++; }],
    ] as [string, (s: Json) => void][] : []),
    ...(id === 'betrayal' ? [['Maddie kills incremented', (s: Json) => { const u = unit(s, 'maddie'); u.batch2 = { ...u.batch2, kills: (u.batch2?.kills ?? 0) + 1 }; }]] as [string, (s: Json) => void][] : []),
  ]);
}

let enforcerControl: MatchState;
function* enforcer(): Generator<void, MatchState> {
  let s = level(clear(reachRound('2-1')), 10);
  const ids = ['maddie', 'loris', 'caitlyn', 'camille', 'steb', 'twistedfate', 'vi', 'garen', 'lux', 'amumu'];
  for (const [i, id] of ids.entries()) {
    s = add(s, id, i % 7, 6 + Math.floor(i / 7), 3);
    if (i >= 7) s = item(s, emblem('enforcer'), id);
    yield;
  }
  // Fight to a real enemy with real equipment; do not fabricate the opponent.
  while (s.roundDefinitionId !== '5-1') {
    if (s.phase === 'preparation') {
      for (const u of s.preparation.units.filter(u => u.team === 'player' && u.location.kind === 'bench')) s = accepted(sellUnit(s, u.id));
      s = accepted(startMatchCombat(s));
    }
    for (let tick = 0; s.phase === 'combat' && tick < 1201; tick++) {
      s = stepMatch(s).state; if (tick % 50 === 0) yield;
    }
    s = resolveM5Choices(s);
    const advanced = nextRound(s, s.round);
    if (!advanced.ok) throw Error(`${s.roundDefinitionId}/${s.phase}/${advanced.reason}: ${JSON.stringify(readLootView(s))}`);
    s = resolveM5Choices(accepted(advanced));
  }
  s = accepted(grantMechanicConsumable(s, { ...request(), definitionId: 'magnetic-remover' }));
  const tool = s.consumables.find(c => c.definitionId === 'magnetic-remover')!;
  const control = accepted(useConsumable(s, tool.consumableId, { kind: 'unit', unitId: s.preparation.units.find(u => u.definitionId === 'garen' && u.team === 'player')!.id }));
  enforcerControl = stepMatch(accepted(startMatchCombat(control))).state;
  s = accepted(startMatchCombat(s)); s = stepMatch(s).state;
  expect(enforcerControl.combat!.strategy!.traits.find(t => t.team === 'player' && t.traitId === 'enforcer')!.tier).toBe(8);
  expect(readRoundEnemyProjection(s.round).items.length).toBeGreaterThan(0);
  expect(s.combat!.strategy!.traits.find(t => t.team === 'player' && t.traitId === 'enforcer')!.tier).toBe(10);
  expect(s.combat!.strategy!.units.filter(u => s.combat!.units.some(c => c.id === u.unitId && c.team === 'enemy')).some(u => u.sources.some(x => x.source.sourceKind === 'item'))).toBe(false);
  expect(s.preparation.units.some(u => u.team === 'enemy')).toBe(true);
  return s;
}
matrix('Enforcer 10 genuine confiscation', enforcer, [
  ['confiscation mechanic values', s => { mech(s, 'caitlyn', 'enforcer').values.extra = 1; }],
  ['confiscation mechanic removed', s => { unit(s, 'caitlyn').mechanics = unit(s, 'caitlyn').mechanics.filter((m: Json) => m.mechanic !== 'enforcer'); }],
  ['tier lowered', s => { s.combat.strategy.traits.find((t: Json) => t.team === 'player' && t.traitId === 'enforcer').tier = 8; }],
  ['confiscated item source reintroduced', s => {
    const control = enforcerControl.combat!.units.find(u => u.team === 'enemy' && u.sources?.some(x => x.source.sourceKind === 'item'))!;
    expect(control).toBeDefined();
    const enemy = s.combat.units.find((u: Json) => u.id === control.id);
    const source = control.sources!.find(x => x.source.sourceKind === 'item')!;
    expect(source).toBeDefined(); enemy.sources.push(structuredClone(source));
  }],
  ['confiscation attack damage', s => { unit(s, 'caitlyn').attackDamage++; }],
]);

const shimmer = 'TFT13_Crime_Consumable_LesserShimmerDuplicator';
function duplicator(used: boolean): MatchState {
  let s = clear(reachRound('2-1'));
  s = add(s, 'renata', 3);
  s = accepted(grantMechanicConsumable(s, { ...request(), definitionId: shimmer }));
  if (used) s = accepted(useConsumable(s, s.consumables.find(c => c.definitionId === shimmer)!.consumableId,
    { kind: 'unit', unitId: s.preparation.units.find(u => u.definitionId === 'renata')!.id }));
  return s;
}
const use = (s: Json): Json => s.resourceProvenance.entries.find((e: Json) => e.kind === 'consumable-used').record;
// Existing g2-3-lesser-shimmer-duplicator covers market package/claims, joint
// hero+receipt+record replacement and non-Chem-Baron retargeting. Only isolated
// tool/use identity, timing and copied-id edits are added here.
matrix('Lesser Shimmer unused tool identity', () => duplicator(false), [
  ...fields('tool', s => s.consumables.find((c: Json) => c.definitionId === shimmer), ['consumableId', 'definitionId']),
  ['tool duplicated', s => { s.consumables.push(structuredClone(s.consumables.find((c: Json) => c.definitionId === shimmer))); }],
  ['tool removed', s => { s.consumables = s.consumables.filter((c: Json) => c.definitionId !== shimmer); }],
]);
matrix('Lesser Shimmer isolated use record', () => duplicator(true), [
  ...fields('use record', use, ['consumableId', 'definitionId', 'effect']),
  ['affected items invented', s => { use(s).affectedItems = [{ id: 'item-999', definitionId: 'sword', location: { kind: 'inventory' } }]; }],
  ['output invented', s => { use(s).output = { id: 'item-999', definitionId: 'sword' }; }],
  ['outputs invented', s => { use(s).outputs = [{ id: 'item-999', definitionId: 'sword' }]; }],
  ...fields('rngBefore', s => use(s).rngBefore, ['state', 'draws']),
  ...fields('rngAfter', s => use(s).rngAfter, ['state', 'draws']),
  ...fields('copied unit', s => use(s).copiedUnit, ['id']),
  ...fields('target', s => use(s).target, ['unitId', 'kind']),
  ['use record removed', s => { s.resourceProvenance.entries = s.resourceProvenance.entries.filter((e: Json) => e.kind !== 'consumable-used'); }],
  ['use duplicated', s => { s.resourceProvenance.entries.push(structuredClone(s.resourceProvenance.entries.find((e: Json) => e.kind === 'consumable-used'))); }],
  ['spent tool reintroduced', s => { s.consumables.push({ consumableId: use(s).consumableId, definitionId: shimmer }); }],
]);


function* betweenPartners(id: string): Generator<void, MatchState> {
  let s = yield* partners(id);
  for (let tick = 0; s.phase === 'combat' && tick < 1201; tick++) {
    s = (id === 'blood-brothers' ? recorded(s, stepMatch(s)) : stepMatch(s)).state; if (tick % 50 === 0) yield;
  }
  s = resolveM5Choices(s);
  return resolveM5Choices(accepted(nextRound(s, s.round)));
}
const battleFacts = (s: Json, id: string): Json => {
  const rows = s.seatMechanics.hidden.progress.economyReceipts;
  const receipt = [...rows].reverse().find((r: Json) => r.kind === 'battle' && r.facts.batch2?.some((f: Json) => f.definitionId === id));
  expect(receipt).toBeDefined(); return receipt.facts;
};
for (const id of ['blood-brothers', 'betrayal']) matrix(`${id} between-round persisted facts`, () => betweenPartners(id), [
  ...fields('battle fact', s => battleFacts(s, id).batch2.find((f: Json) => f.definitionId === id), ['count', 'definitionId']),
  ['battle fact deleted', s => { const f = battleFacts(s, id); f.batch2 = f.batch2.filter((f: Json) => f.definitionId !== id); }],
  ['battle fact duplicated', s => { const f = battleFacts(s, id); f.batch2.push(structuredClone(f.batch2.find((f: Json) => f.definitionId === id))); }],
  ...(id === 'blood-brothers' ? fields('death fact', s => battleFacts(s, id).batch2.find((f: Json) => f.definitionId === 'blood-brothers-deaths'), ['count', 'definitionId']) : []),
]);

const betrayalReward = (s: Json): Json => s.seatMechanics.receipts.find((r: Json) =>
  r.kind === 'unit' && r.definitionId === 'maddie' && r.receiptId.includes('batch2-reward'));
matrix('Betrayal earned Maddie receipt', function* () {
  const s = yield* betweenPartners('betrayal');
  expect(battleFacts(s, 'betrayal').batch2.find((f: Json) => f.definitionId === 'betrayal').count).toBe(1);
  expect(betrayalReward(s)).toBeDefined();
  return s;
}, [
  ...fields('reward receipt', betrayalReward, ['receiptId', 'round', 'roundId', 'source', 'kind', 'definitionId', 'resolution', 'unitId', 'gold']),
  ['reward star invented', s => { betrayalReward(s).starLevel = 3; }],
  ['reward duplicated', s => { s.seatMechanics.receipts.push(structuredClone(betrayalReward(s))); }],
  ['reward unit changed', s => { s.preparation.units.find((u: Json) => u.id === betrayalReward(s).unitId).definitionId = 'ambessa'; }],
]);
