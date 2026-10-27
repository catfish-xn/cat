import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5_H11 as ROWS } from '../src/simulation/content/augment-pool-batch5-h11';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { firstNodeSeed } from './augment-stage-helpers';
import { accepted, reachRound, fieldBench, resolveM5Choices, finish } from './match-helpers';
import { buyUnit, createMatch, selectChoice, startMatchCombat, stepMatch, nextRound, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents } from '../src/simulation/combat';
import { settleH11Deaths } from '../src/simulation/augment-pool-batch5-h11';
import { sampleAugmentDeath } from '../src/simulation/augment-death-samples';
import type { S13Unit } from '../src/simulation/combat-s13-state';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import { G24_CHEST_POOL } from '../src/simulation/content/g2-4-chest-pool';
import { validateCombatItemGrants } from '../src/simulation/m8/combat-item-grants';
import { readAugmentFirstHeroDeaths } from '../src/simulation/augment-death-samples';

export const grantRows = (s: MatchState) => s.combat!.units.flatMap(u => (u.combatItemGrants ?? []).map(g => ({ unitId: u.id, ...g })));
const entries = ['object', 'JSON', 'serialized'] as const;
function entry(s: MatchState, name: typeof entries[number]): unknown {
  return name === 'object' ? s : name === 'JSON' ? JSON.stringify(s) : serializeMatch(s);
}
function reject(s: MatchState, mutate: (bad: any) => void): void {
  for (const name of entries) { const bad = structuredClone(s); mutate(bad); expect(() => restoreMatch(entry(bad, name)), name).toThrow(); }
}
let acquired: MatchState, granted: MatchState;
beforeAll(() => {
  const seed = firstNodeSeed('scavenger', 101);
  let s = reachRound('2-1', false, seed), c = s.pendingChoice!;
  acquired = accepted(selectChoice(s, c.choiceId, c.generation, 'scavenger'));
  s = resolveM5Choices(acquired);
  for (let slot = 0; slot < s.shop.slots.length; slot++) {
    const r = buyUnit(s, slot, s.shop.generation); if (r.ok) s = r.state;
  }
  s = accepted(startMatchCombat(fieldBench(s)));
  while (s.phase === 'combat' && !grantRows(s).length) s = stepMatch(s).state;
  expect(grantRows(s).length, `public seed ${seed}`).toBeGreaterThan(0);
  granted = s;
});
it.skipIf(!existsSync(RESEARCH_FILE))('B5-76 uses the archived numbers', () => {
  const row = JSON.parse(readFileSync(RESEARCH_FILE, 'utf8')).find((r: any) => r.apiName === 'TFT_Augment_Scavenger');
  expect(ROWS.scavenger.source.values).toEqual(row.effects); expect(row.tier).toBe(2);
  expect(row.item_tags_raw.filter((tag: string) => ['{d02ae323}','{d12ae4b6}','{d22ae649}'].includes(tag))).toEqual([]);
});
it('B5-76 is offered at all three nodes, with mutual exclusion and no effect on failed selection', () => {
  for (const node of ['2-1', '3-2', '4-2']) {
    const context = { node, fieldedTraits: [], blocked: [] };
    expect(augmentOfferAllowed('scavenger', [], context)).toBe(true);
    expect(augmentCandidates('gold', [], [], null, context)).toContain('scavenger');
  }
  expect(augmentOfferAllowed('scavenger', [{ definitionId: 'TFT_Augment_QualityOverQuantity', choiceId: 'old', acquiredRound: 1 }], { node: '3-2', fieldedTraits: [], blocked: [] })).toBe(false);
  const result = selectChoice(acquired, 'stale', 0, 'scavenger');
  expect(result.ok).toBe(false); expect(result.state).toBe(acquired); expect('events' in result).toBe(false);
});
it.each(entries)('B5-76 public death grants work immediately, survive %s restore and resume deterministically', name => {
  for (const s of [acquired, granted]) expect(restoreMatch(entry(s, name))).toEqual(s);
  expect(stepMatch(restoreMatch(entry(granted, name)))).toEqual(stepMatch(granted));
  const deaths = requireAugmentFacts(granted, 'deaths', granted.round).flatMap(f => f.deaths);
  expect(deaths.some(d => d.ordinaryHero && d.team === 'enemy')).toBe(true);
  for (const g of grantRows(granted)) {
    expect(g.chest.definitionId).toBe('scavenger'); expect(g.grantedAtTick).toBe(granted.combat!.tick);
    expect(granted.items.some(i => i.id.includes(g.chest.instanceId))).toBe(false);
    const receiver = granted.combat!.units.find(u => u.id === g.unitId)!;
    expect(receiver.mechanismDefinitions).toBeDefined();
  }
});
const scavengerEdits: ((s: any) => void)[] = [
    s => { delete s.augmentHistory; }, s => { s.augmentHistory.version = 'augment-history-v2'; },
    s => { s.augmentHistory.facts.find((f: any) => f.kind === 'combat-roster').roster.units[0].definitionId = 'mel'; },
    s => { s.augmentHistory.facts.find((f: any) => f.kind === 'deaths' && f.deaths.length).deaths[0].ordinaryHero = false; },
    s => { s.combat.openingDeaths = []; }, s => { s.combat.rngState ^= 1; },
    ...['definitionId', 'ordinal', 'grantedAtTick', 'chest'].map(key => (s: any) => {
      const g = s.combat.units.find((u: any) => u.combatItemGrants?.length).combatItemGrants[0];
      if (key === 'chest') g.chest.definitionId = 'not-scavenger';
      else if (key === 'definitionId') g.definitionId = g.definitionId === 'rageblade' ? 'blue-buff' : 'rageblade';
      else g[key]++;
    }),
    s => { s.combat.units.find((u: any) => u.combatItemGrants?.length).combatItemGrants = []; },
  ];
it.each(scavengerEdits.map((edit, index) => [index, edit] as const))('B5-76 rejects tamper %i at all three entries', (_index, edit) => { reject(granted, edit); });
it('B5-76 removes temporary grants next round and round-trips the settled and next-round history', () => {
  const terminal = resolveM5Choices(finish(granted));
  expect(restoreMatch(JSON.stringify(terminal))).toEqual(terminal);
  const next = accepted(nextRound(terminal, terminal.round));
  expect(next.combat).toBeNull(); expect(next.items).toEqual(terminal.items);
  expect(restoreMatch(serializeMatch(next))).toEqual(next);
});

function fixture(items: MatchState['items'] = []) {
  const base = createMatch(42), unit = base.preparation.units[0];
  const units = [...Array.from({ length: 3 }, (_, i) => ({ ...unit, id: `p${i}`, definitionId: 'maddie', team: 'player' as const, location: { kind: 'board' as const, cell: { col: i * 2, row: 7 } } })),
    ...Array.from({ length: 6 }, (_, i) => ({ ...unit, id: `e${i}`, definitionId: 'irelia', team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: i, row: 0 } } }))];
  const preparation = { ...base.preparation, units };
  return createCombatWithEvents(preparation, buildStrategySnapshot({ ...base, preparation, items, augments: [{ definitionId: 'scavenger', choiceId: 'fixture', acquiredRound: 1 }] }), 'h11-fixture', 42).state;
}
it('B5-76 processes five distinct real hero deaths in event order, caps slots, excludes summons and does not repay resurrection', () => {
  const before = fixture(), units = structuredClone(before.units) as S13Unit[], words: number[] = [];
  const ctx: AbilityContext = { tick: 1, combatId: 'h11-fixture', board: before.board, units, events: [], packets: [], heals: [], draw: () => { words.push(0); return 0; } };
  for (const id of ['e4', 'e1', 'e3', 'e0', 'e5', 'e2']) {
    const u = units.find(u => u.id === id)!; u.hp = 0; u.alive = false;
    ctx.events.push(sampleAugmentDeath({ type: 'death', tick: 1, unitId: id }, u));
  }
  settleH11Deaths(ctx, before);
  expect(units.flatMap(u => u.combatItemGrants ?? [])).toHaveLength(5); expect(words).toHaveLength(10);
  expect(units.find(u => u.id === 'p0')!.combatItemGrants).toHaveLength(3);
  expect(units.find(u => u.id === 'p1')!.combatItemGrants).toHaveLength(2);
  expect(units.flatMap(u => u.combatItemGrants ?? []).every(g => g.definitionId === G24_CHEST_POOL[0].definitionId)).toBe(true);
  const prefix = { ...before, openingDeaths: ['e4', 'e1', 'e3', 'e0', 'e5', 'e2'].map((unitId, eventSeq) => ({ unitId, eventSeq })) };
  settleH11Deaths(ctx, prefix); expect(words).toHaveLength(10);
});
it('B5-76 excludes neutral/summon deaths and dead/full receivers without drawing RNG', () => {
  const before = fixture(), units = structuredClone(before.units) as S13Unit[];
  const ctx: AbilityContext = { tick: 1, board: before.board, units, events: [], packets: [], heals: [], draw: () => { throw new Error('unexpected RNG'); } };
  const enemy = units.find(u => u.team === 'enemy')!;
  for (const definitionId of ['training-dummy', 'g23-sion']) ctx.events.push(sampleAugmentDeath({ type: 'death', tick: 1, unitId: definitionId }, { ...enemy, id: definitionId, definitionId }));
  settleH11Deaths(ctx, before);
  for (const u of units.filter(u => u.team === 'player')) { u.alive = false; u.hp = 0; }
  ctx.events.push(sampleAugmentDeath({ type: 'death', tick: 1, unitId: enemy.id }, enemy)); settleH11Deaths(ctx, before);
  expect(units.flatMap(u => u.combatItemGrants ?? [])).toEqual([]);
});

it('B5-76 counts permanent opening equipment, including all three glove slots, before considering recipients', () => {
  const items = [0,1,2].map(slot => ({ id: `full-${slot}`, definitionId: 'rageblade', location: { kind: 'unit' as const, unitId: 'p0', slot } }));
  const before = fixture(items), units = structuredClone(before.units) as S13Unit[];
  expect(units.find(u => u.id === 'p0')!.equipment).toHaveLength(3);
  for (const u of units.filter(u => u.team === 'player' && u.id !== 'p0')) { u.hp = 0; u.alive = false; }
  const enemy = units.find(u => u.id === 'e0')!;
  const ctx: AbilityContext = { tick: 1, board: before.board, units, events: [sampleAugmentDeath({type:'death',tick:1,unitId:enemy.id},enemy)], packets: [], heals: [], draw: () => { throw new Error('full team must not draw'); } };
  settleH11Deaths(ctx, before); expect(units.flatMap(u => u.combatItemGrants ?? [])).toEqual([]);
});

it('B5-76 consumes a death with no receiver, including after restore, and never pays the sixth death', () => {
  const before = fixture(), units = structuredClone(before.units) as S13Unit[];
  for (const u of units.filter(u => u.team === 'player')) u.equipment = [0,1,2].map(slot => ({ definitionId: 'rageblade', slot, temporary: false }));
  const ctx: AbilityContext = { tick: 1, board: before.board, units, events: [], packets: [], heals: [], draw: () => { throw new Error('no eligible grant'); } };
  for (const id of ['e0','e1','e2','e3','e4']) ctx.events.push(sampleAugmentDeath({ type:'death', tick:1, unitId:id }, units.find(u => u.id === id)!));
  settleH11Deaths(ctx,before);
  expect(units.flatMap(u => u.combatItemGrants ?? [])).toEqual([]);
  const prefix = JSON.parse(JSON.stringify({ ...before, openingDeaths: ['e0','e1','e2','e3','e4'].map((unitId,eventSeq) => ({unitId,eventSeq})) }));
  units.find(u => u.id === 'p0')!.equipment = [];
  ctx.events = [sampleAugmentDeath({type:'death',tick:2,unitId:'e5'},units.find(u => u.id === 'e5')!)];
  settleH11Deaths(ctx,prefix);
  expect(readAugmentFirstHeroDeaths(prefix,ctx.events).map(d => d.current)).toEqual([false,false,false,false,false,true]);
  expect(units.flatMap(u => u.combatItemGrants ?? [])).toEqual([]);
});

it('B5-76 interleaves both teams by death-event order and keeps the original source when it is absent', () => {
  const original = fixture(), before = structuredClone(original);
  const mechanic = before.units.find(u => u.id === 'p0')!.mechanics!.find(m => m.mechanic === 'scavenger')!;
  for (const u of before.units.filter(u => u.team === 'enemy')) (u as S13Unit).mechanics = [{...mechanic,source:{...mechanic.source,ownerId:u.id}}];
  const units = structuredClone(before.units).filter(u => u.id !== 'p0') as S13Unit[];
  for (const id of ['p2','e4']) { const u = units.find(u => u.id === id)!; u.hp = 0; u.alive = false; }
  const ctx: AbilityContext = { tick:1,board:before.board,units,events:['p2','e4'].map(id => sampleAugmentDeath({type:'death',tick:1,unitId:id},units.find(u => u.id === id)!)),packets:[],heals:[],draw:()=>0 };
  settleH11Deaths(ctx,before);
  expect(ctx.events.filter(e => e.type === 'combatItemGranted').map(e => e.source.ownerId)).toEqual(['e0','p0']);
  expect(units.find(u => u.id === 'p1')!.combatItemGrants).toHaveLength(1);
  const rows = readAugmentFirstHeroDeaths(before,ctx.events);
  expect(rows.map(d => [d.unitId,d.team])).toEqual([['p2','player'],['e4','enemy']]);
});

it('B5-76 authenticates grants at the grant boundary instead of rejecting later permanent equips', () => {
  const units = structuredClone(granted.combat!.units) as S13Unit[];
  const receiver = units.find(u => u.combatItemGrants?.length)!;
  receiver.equipment = [0,1,2].map(slot => ({definitionId:'rageblade',slot,temporary:false}));
  expect(() => validateCombatItemGrants(units,granted.combat!.tick,u => u.mechanismDefinitions?.eventTriggers ?? [])).not.toThrow();
});
