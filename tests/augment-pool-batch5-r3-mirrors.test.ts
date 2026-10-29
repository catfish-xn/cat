import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { type MatchState, createMatch, deployMatchUnit, startMatchCombat, stepMatch } from '../src/simulation/match';
import { readCombatStrategyInputs, type CombatStrategyInputs } from '../src/simulation/combat-input';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { validateDynamicCombat } from '../src/simulation/g2-4b-gold-restore';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { AUGMENT_BATCH5_R3 } from '../src/simulation/content/augment-pool-batch5-r3';
import { AUGMENT_STAGE_BANS } from '../src/simulation/content/augment-stage-bans';
import { hallOfMirrorsTargets, hallOfMirrorsDamage, hallOfMirrorsExecution } from '../src/simulation/augment-pool-batch5-r3-mirrors';
import { snapshotForBattle } from '../src/simulation/two-sided-snapshot';
import { compileBattle, restoreBattleInput, startTwoSidedCombat, resolveTwoSidedBattle, proposeSettlement } from '../src/simulation/two-sided-battle';
import type { Unit } from '../src/simulation/unit-types';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { hallOpening, hallDamage, rewardPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
import { accepted, reachRound, resolveM5Choices } from './match-helpers';

const archive = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
it.skipIf(!existsSync(archive))('B5-78 transcribes the independent 14.24 numbers and tier', () => {
  const row = JSON.parse(readFileSync(archive, 'utf8')).find((x: any) => x.apiName === 'TFT_Augment_HallOfMirrors');
  expect(row.effects).toEqual(AUGMENT_BATCH5_R3['hall-of-mirrors'].source.values); expect(row.tier).toBe(3);
});

it('B5-78 is banned at all three nodes by the archived tags, including reroll candidates', () => {
  expect(AUGMENT_STAGE_BANS.TFT_Augment_HallOfMirrors).toEqual(['2-1', '3-2', '4-2']);
  for (const node of ['2-1', '3-2', '4-2']) {
    const filter = { node, fieldedTraits: [], blocked: [] };
    expect(augmentOfferAllowed('hall-of-mirrors', [], filter)).toBe(false);
    expect(augmentCandidates('prismatic', [], [], null, filter)).not.toContain('hall-of-mirrors');
    expect(augmentPool('prismatic', [], [], `round:${node}:augment`)).not.toContain('hall-of-mirrors');
    expect(augmentCandidates('gold', [], [], null, filter)).not.toContain('hall-of-mirrors');
  }
});

// Controlled holder: the card is unavailable at every natural augment node.
function acquireHall(): MatchState {
  const s = resolveM5Choices(reachRound('2-1', false, 38));
  return { ...s, augments: [...s.augments, { definitionId: 'hall-of-mirrors', choiceId: 'fixture-hall', acquiredRound: s.round }] };
}
const hero = (id: string, definitionId: string, col: number, row = 4, starLevel: 1 | 2 | 3 = 1): Unit =>
  ({ id, definitionId, starLevel, team: 'player', location: { kind: 'board', cell: { col, row } } });
function fixture(): CombatStrategyInputs {
  const base = readCombatStrategyInputs(createMatch(42));
  return { ...base, round: 4, augments: [{ definitionId: 'hall-of-mirrors', choiceId: 'round:2-1:augment', acquiredRound: 4 }],
    preparation: { ...base.preparation, units: [hero('unit-1', 'lux', 1), hero('unit-2', 'tristana', 3, 4, 2), hero('unit-3', 'darius', 5),
      { ...hero('unit-4', 'darius', 3, 1), team: 'enemy' }] },
    items: [{ id: 'item-1', definitionId: 'warmog', location: { kind: 'unit', unitId: 'unit-1', slot: 0 } }],
    persistentGrowth: [{ unitId: 'unit-2', attackDamageBps: 1250 }],
    anomalyBinding: { unitId: 'unit-2', definitionId: 'giant-sized', choiceId: 'anomaly', boundRound: 4 } };
}
function start(input: CombatStrategyInputs) { return createCombatWithEvents(input.preparation, buildStrategySnapshot(input), 'hall-numeric', 42).state; }

it('selects fourth column or nearest occupied column with a left tie, independent of roster order; empty front row does nothing', () => {
  const input = fixture(), units = [hero('unit-1', 'lux', 2), hero('unit-2', 'darius', 4), hero('unit-3', 'tristana', 3, 5)];
  const preparation = { ...input.preparation, units };
  expect(hallOfMirrorsTargets(preparation).map(u => u.id)).toEqual(['unit-1', 'unit-2']);
  expect(hallOfMirrorsTargets({ ...preparation, units: [...units].reverse() }).map(u => u.id)).toEqual(['unit-1', 'unit-2']);
  const combat = start({ ...input, items: [], anomalyBinding: null, persistentGrowth: [], preparation });
  expect(combat.units.filter(u => u.r3Mirror).map(u => u.definitionId)).toEqual(['lux', 'lux']);
  expect(combat.units.find(u => u.id === 'unit-3')!.r3Mirror).toBeUndefined();
  const empty = { ...input, preparation: { ...input.preparation, units: input.preparation.units.map(u => u.team === 'player' ? { ...u, location: { kind: 'board' as const, cell: { col: u.location.kind === 'board' ? u.location.cell.col : 0, row: 5 } } } : u) } };
  const unaugmented = { ...empty, augments: [] };
  expect(start(empty)).toEqual(start(unaugmented));
});

it('simultaneously keeps each original opening HP, copies center star, removes equipment/anomaly/growth, and counts all copies', () => {
  const input = fixture(), original = start({ ...input, augments: [] }), combat = start(input);
  expect(original.units.filter(u => u.team === 'player').map(u => u.maxHp)).toEqual([1232, 1990, 600]);
  expect(combat.units.filter(u => u.r3Mirror)).toHaveLength(3);
  for (const expected of hallOpening(input, original.units)) expect(combat.units.find(u => u.id === expected.id)).toMatchObject(expected);
  for (const copy of combat.units.filter(u => u.r3Mirror)) {
    expect(copy.definitionId).toBe('tristana'); expect(copy.starLevel).toBe(2); expect(copy.attackDamage).toBe(69);
    expect(copy.sources?.some(s => ['item', 'anomaly'].includes(s.source.sourceKind) || s.source.sourceDefinitionId === 'tristana-ability')).toBe(false);
    expect(copy.itemPrograms?.some(p => ['item', 'anomaly'].includes(p.source.sourceKind))).toBeFalsy();
  }
  expect(combat.strategy!.traits.find(t => t.team === 'player' && t.traitId === 'artillerist')).toMatchObject({ count: 3, tier: 2 });
  let later = combat; for (let n = 0; n < 20 && later.status === 'running'; n++) later = stepCombat(later).state;
  expect(later.units.filter(u => u.r3Mirror).map(u => u.maxHp)).toEqual([1232, 1990, 600]);
});

it('retains original positions full opening HP even when Garen and his equipment are removed by transformation', () => {
  const input = fixture(), units = input.preparation.units.map(u => u.id === 'unit-1' ? hero('unit-1','garen',2) : u.id === 'unit-2' ? hero('unit-2','lux',3,4,2) : u);
  const combat = start({ ...input, persistentGrowth: [], preparation: { ...input.preparation, units } });
  // Sole Emissary Garen: 1792 from Warmog, then self/adjacent +215; Lux2: 900+1000+215.
  expect(combat.units.filter(u => u.r3Mirror).map(u => u.maxHp)).toEqual([2007,2115,600]);
  expect(combat.units.every(u => u.definitionId !== 'garen')).toBe(true);
  expect(combat.units.filter(u => u.r3Mirror).every(u => u.v19 === undefined)).toBe(true);
});

it('applies one 40% multiplier to attacks, spells, equipment and burn including true damage; inherited damage is not penalized twice', () => {
  const combat = start(fixture()), owner = combat.units.find(u => u.r3Mirror)!;
  for (const delivery of ['basic-attack', 'ability-direct', 'ability-periodic', 'attack-extra', 'equipment-proc', 'item-burn']) for (const damageType of ['physical', 'magic', 'true']) {
    const packet = { delivery, damageType, inherited: undefined };
    const prepared = { raw: 111, mitigated: 101, beforeMitigation: 111, prevented: 0, blockedByMitigation: 10 };
    const result = hallOfMirrorsDamage(owner, packet, prepared);
    expect(result.mitigated).toBe(hallDamage(101)); expect(result.beforeMitigation).toBe(hallDamage(111));
    expect(result.raw).toBe(111);
  }
  const prepared = { mitigated: 101, beforeMitigation: 111, prevented: 0, blockedByMitigation: 10 };
  expect(hallOfMirrorsDamage(owner, { inherited: { parentPacketId: 'prior', resolvedAtTick: 1, critical: false, portion: 'redirect-share' } }, prepared)).toBe(prepared);
  expect(hallOfMirrorsDamage(undefined, {}, prepared)).toBe(prepared);
  expect(hallOfMirrorsExecution(owner,101).mitigated).toBe(hallDamage(101));
  expect(hallOfMirrorsExecution(undefined,101).mitigated).toBe(101);
  let penalized = combat;
  let control: CombatState = { ...combat, units: combat.units.map(u => { const { r3Mirror: _mirror, ...rest } = u; return rest; }) };
  let observed = false;
  for (let n = 0; n < 30 && penalized.status === 'running' && control.status === 'running'; n++) {
    const a = stepCombat(penalized), b = stepCombat(control); penalized = a.state; control = b.state;
    const expected = b.events.find(e => e.type === 'packetDamage' && e.outcome.context.source.ownerId === owner.id);
    if (expected?.type !== 'packetDamage') continue;
    const actual = a.events.find(e => e.type === 'packetDamage' && e.outcome.context.packetId === expected.outcome.context.packetId);
    expect(actual?.type).toBe('packetDamage');
    if (actual?.type === 'packetDamage') expect(actual.outcome.mitigated).toBe(hallDamage(expected.outcome.mitigated));
    observed = true; break;
  }
  expect(observed).toBe(true);
});

it('controlled holder exercises combat and tamper rejection; authentic baseline survives all round trips', () => {
  let s = acquireHall(); const owner = s.preparation.units.find(u => u.team === 'player')!;
  s = accepted(deployMatchUnit(s, owner.id, { kind: 'board', cell: { col: 3, row: 4 } }));
  const before = s; s = accepted(startMatchCombat(s));
  expect(s.combat!.units.filter(u => u.r3Mirror)).toHaveLength(1);
  expect(s.preparation).toEqual(before.preparation); expect(s.items).toEqual(before.items);
  expect(rewardPlan({ ...s, augments: s.augments.filter(a => a.definitionId === 'hall-of-mirrors') }, {})).toEqual({ gifts: [], gold: [] });
  for (let i = 0; i < 3 && s.phase === 'combat'; i++) s = stepMatch(s).state;
  // A fabricated owner cannot pass acquisition/offer authentication. Verify the same
  // round trips on the authentic baseline, and reject the controlled holder.
  let baseline = accepted(startMatchCombat({ ...before, augments: before.augments.filter(a => a.definitionId !== 'hall-of-mirrors') }));
  for (let i = 0; i < 3 && baseline.phase === 'combat'; i++) baseline = stepMatch(baseline).state;
  for (const input of [baseline, JSON.stringify(baseline), serializeMatch(baseline)]) {
    const restored = restoreMatch(input); expect(restored).toEqual(baseline); expect(stepMatch(restored)).toEqual(stepMatch(baseline));
  }
  for (const input of [s, JSON.stringify(s)]) expect(() => restoreMatch(input)).toThrow();
  expect(() => serializeMatch(s)).toThrow();
  // Cold replay checks the controlled combat independently of acquisition authentication.
  expect(validateDynamicCombat(s.combat!, s.combatInputBasis!, s.combat!.strategy!)).toBe(true);
  for (const mutate of [
    (x: any) => { x.combat.units.find((u: any) => u.r3Mirror).maxHp++; },
    (x: any) => { x.combat.units.find((u: any) => u.r3Mirror).r3Mirror.sourceUnitId = 'forged'; },
    (x: any) => { delete x.combat.units.find((u: any) => u.r3Mirror).r3Mirror; },
    (x: any) => { x.combat.strategy.r3Original[0].strategy.units[0].stats.health++; },
    (x: any) => { x.combat.units.find((u: any) => u.r3Mirror).itemSummonOpeningMaxHp++; },
  ]) { const bad = structuredClone(s); mutate(bad);
    expect(() => validateDynamicCombat(bad.combat!, s.combatInputBasis!, s.combat!.strategy!)).toThrow();
    expect(() => restoreMatch(bad)).toThrow(); expect(() => restoreMatch(JSON.stringify(bad))).toThrow(); }
});

it('both online sides transform in local front rows, restore compiled inputs, settle without copy growth, and reject derived-field tampering', () => {
  let s = acquireHall(); const owner = s.preparation.units.find(u => u.team === 'player')!;
  s = accepted(deployMatchUnit(s, owner.id, { kind: 'board', cell: { col: 3, row: 4 } }));
  const input = compileBattle(snapshotForBattle(s, 'A'), snapshotForBattle(s, 'B'), 42);
  expect(restoreBattleInput(JSON.stringify(input))).toEqual(input);
  const initial = startTwoSidedCombat(input);
  expect(initial.units.filter(u => u.r3Mirror).map(u => [u.team, u.cell.row])).toEqual([['player', 4], ['enemy', 3]]);
  const battle = resolveTwoSidedBattle(input, 1201), proposed = proposeSettlement(battle);
  expect(proposed.a.growth).toEqual([]); expect(proposed.b.growth).toEqual([]);
  for (const mutate of [
    (x: any) => { x.strategy.units.find((u: any) => u.r3Mirror).stats.health++; },
    (x: any) => { delete x.strategy.r3Original; },
    (x: any) => { x.strategy.r3Original[0].preparation.units[0].starLevel = 3; },
  ]) { const bad = structuredClone(input); mutate(bad); expect(() => restoreBattleInput(bad)).toThrow(); }
});
