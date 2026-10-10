import { describe, expect, it } from 'vitest';
import { buyXp, equipItem, sellUnit, startMatchCombat, stepMatch, nextRound, createMatch, combineItems, deployMatchUnit } from '../src/simulation/match';
import { previewCombine, previewEquip, readUnitEquipment } from '../src/simulation/item-selectors';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import type { MatchState } from '../src/simulation/match-types';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { planTemporaryEquipment, validateMatchEquipment, TEMPORARY_EQUIPMENT_POOL } from '../src/simulation/temporary-equipment';
import { generateRoundRolls, initializeStreams } from '../src/simulation/m8/equipment';
import { accepted, emptyBoard, freeze } from './match-helpers';
import { publicEquipmentPreparation, finishPublicEquipmentBattle, resolvePublicEquipmentChoices } from './fixtures/b8-public-equipment';

const levelRounds: Readonly<Record<number, string>> = { 3: '2-1', 6: '2-5', 7: '2-7', 9: '4-2' };
function inventoryAtRound(roundId = '2-1', seed = 42): MatchState {
  let state = publicEquipmentPreparation(['gloves', 'gloves'], { seed });
  state = accepted(combineItems(state, 'item-1', 'item-2'));
  while (state.roundDefinitionId !== roundId) {
    state = resolvePublicEquipmentChoices(state);
    if (state.phase === 'preparation') state = finishPublicEquipmentBattle(state);
    state = resolvePublicEquipmentChoices(state);
    state = accepted(nextRound(state, state.round));
  }
  return resolvePublicEquipmentChoices(state);
}
function inventory(level = 3, seed = 42): MatchState {
  let state = inventoryAtRound(levelRounds[level], seed);
  while (state.level < level) state = accepted(buyXp(state));
  expect(state.level).toBe(level);
  return accepted(deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 1, row: 4 } }));
}
function equipped(level = 3, seed = 42): MatchState { return accepted(equipItem(inventory(level, seed), 'item-3', 'unit-1', 0)); }
/** Deliberately synthetic 2-1 levels exercise the pool/LCG mechanism only.
 * Their same-test full Match controls below use actual paid XP at levelRounds.
 */
function mechanismInventory(level: number): MatchState {
  const state = inventory();
  return { ...state, level, xp: 0 };
}
const pair = (state: MatchState) => state.temporaryEquipment.map(i => i.definitionId);
const otherRng = (state: MatchState) => [state.rngState, state.choiceRngState, state.rewardRngState, state.battleSeedRngState];

describe('B5 Match TG-01 lifecycle and save validation', () => {
  it.each([3, 6, 7, 9])('level %s preserves the 2-1 pool mechanism and its legal paid-XP restore control', level => {
    const state = mechanismInventory(level), result = equipItem(freeze(state), 'item-3', 'unit-1', 2);
    const next = accepted(result);
    // Independent LCG words for seed42 XOR 0x243f6a88: 3254118809,3773810212.
    // API-sorted 35-pool index4=Bramble; low second 8-pool index4=Cloak;
    // high second 34-pool (Bramble removed) index0=AdaptiveHelm.
    expect(pair(next)).toEqual(level <= 6 ? ['bramble-vest', 'cloak'] : ['bramble-vest', 'adaptive-helm']);
    expect(next.equipmentState.equipment).toEqual({ state: 3773810212, draws: 2 });
    expect(next.equipmentState.rolls).toEqual([{ parentItemInstanceId: 'item-3', roundId: '2-1', playerLevelSnapshot: level,
      poolVersion: 'tg-01-v1', children: pair(next), rngDrawStart: 0, rngDrawEnd: 2 }]);
    expect(next.temporaryEquipment.map(i => [i.temporaryId, i.parentItemInstanceId, i.slot, i.expiresAfterRoundId]))
      .toEqual([[JSON.stringify(['item-3', '2-1', 1]), 'item-3', 1, '2-1'], [JSON.stringify(['item-3', '2-1', 2]), 'item-3', 2, '2-1']]);
    expect(otherRng(next)).toEqual(otherRng(state));
    expect(next.nextItemSerial).toBe(state.nextItemSerial);
    expect(next.items).toHaveLength(state.items.length);
    expect(next.resourceProvenance).toEqual(state.resourceProvenance);
    expect(next.scheduleReceipts).toEqual(state.scheduleReceipts);
    expect(next.m8.loot).toEqual(state.m8.loot);
    if (!result.ok) throw new Error(result.reason);
    expect(result.events.map(e => e.type)).toEqual(['itemEquipped', 'equipmentRolled', 'temporaryEquipmentChanged']);
    validateMatchEquipment(next);
    // Keep the original round/level mechanism vector, but never claim the
    // synthetic 2-1 economy is a public Match route. The real control buys XP
    // at the earliest solvent preparation while TG is still in inventory.
    const legal = inventory(level), legalResult = equipItem(freeze(legal), 'item-3', 'unit-1', 2);
    const restoredControl = accepted(legalResult);
    expect(restoredControl.roundDefinitionId).toBe(levelRounds[level]);
    expect(pair(restoredControl)).toEqual(pair(next));
    expect(restoredControl.equipmentState.equipment).toEqual(next.equipmentState.equipment);
    expect(restoredControl.equipmentState.rolls).toEqual([{ ...next.equipmentState.rolls[0], roundId: levelRounds[level] }]);
    expect(otherRng(restoredControl)).toEqual(otherRng(legal));
    expect(restoredControl.nextItemSerial).toBe(legal.nextItemSerial);
    expect(restoredControl.items).toHaveLength(legal.items.length);
    expect(restoredControl.resourceProvenance).toEqual(legal.resourceProvenance);
    expect(restoredControl.scheduleReceipts).toEqual(legal.scheduleReceipts);
    expect(restoredControl.m8.loot).toEqual(legal.m8.loot);
    expect(restoredControl.temporaryEquipment.map(child => [child.temporaryId, child.parentItemInstanceId, child.slot, child.expiresAfterRoundId]))
      .toEqual([1, 2].map(slot => [JSON.stringify(['item-3', levelRounds[level], slot]), 'item-3', slot, levelRounds[level]]));
    if (!legalResult.ok) throw new Error(legalResult.reason);
    expect(legalResult.events.map(event => event.type)).toEqual(['itemEquipped', 'equipmentRolled', 'temporaryEquipmentChanged']);
    expect(restoreMatch(serializeMatch(restoredControl))).toEqual(restoredControl);
    const forged = structuredClone(restoredControl);
    Object.assign(forged.equipmentState.rolls[0], { playerLevelSnapshot: level <= 6 ? 7 : 6 });
    expect(() => restoreMatch(forged)).toThrow('Invalid equipment roll ledger');
  });
  it('F, sale, same-round re-equip and restore preserve the original level6 roll across level7', () => {
    let state = inventoryAtRound('2-7');
    while (state.level < 6 || state.xp < 32) state = accepted(buyXp(state));
    expect([state.level, state.xp, state.gold]).toEqual([6, 32, 4]);
    state = accepted(equipItem(state, 'item-3', 'unit-1', 0));
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const roll = structuredClone(state.equipmentState);
    state = accepted(buyXp(freeze(state)));
    expect(state.level).toBe(7);
    expect(pair(state)).toEqual(['bramble-vest', 'cloak']);
    state = accepted(sellUnit(freeze(state), 'unit-1'));
    expect(state.temporaryEquipment).toEqual([]);
    expect(state.items.find(i => i.id === 'item-3')?.location.kind).toBe('inventory');
    state = restoreMatch(serializeMatch(state));
    const result = equipItem(freeze(state), 'item-3', 'unit-2', 1);
    state = accepted(result);
    expect(state.equipmentState).toEqual(roll);
    expect(pair(state)).toEqual(['bramble-vest', 'cloak']);
    expect(state.temporaryEquipment.every(i => i.holderId === 'unit-2')).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.events.map(e => e.type)).toEqual(['itemEquipped', 'temporaryEquipmentChanged']);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
  it('next round revokes old children and rolls once; failed/duplicate Continue and step do not draw', () => {
    const before = emptyBoard(equipped());
    const settled = accepted(startMatchCombat(before)); // real tick0 concession; parent stays on bench
    expect(settled.phase).toBe('settlement');
    expect(stepMatch(settled)).toEqual({ state: settled, events: [] });
    const result = nextRound(freeze(settled), settled.round), next = accepted(result);
    expect(next.equipmentState.equipment).toEqual({ state: 2226054902, draws: 4 });
    expect(pair(next)).toEqual(['gargoyle', 'gloves']);
    expect(next.equipmentState.rolls).toHaveLength(2);
    expect(next.temporaryEquipment.every(i => i.roundId === '2-2')).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    const change = result.events.find(e => e.type === 'temporaryEquipmentChanged');
    expect(change?.type === 'temporaryEquipmentChanged' && change.removed.map(i => i.roundId)).toEqual(['2-1', '2-1']);
    const repeated = nextRound(freeze(next), settled.round);
    expect(repeated.ok).toBe(false); expect(repeated.state).toBe(next);
    expect(restoreMatch(serializeMatch(next))).toEqual(next);
    expect(createMatch(42).equipmentState).toEqual({ equipment: { state: (42 ^ 0x243f6a88) >>> 0, draws: 0 }, rolls: [] });
  });
  it('inventory parents do not refresh until first equip in a new round', () => {
    let state = accepted(sellUnit(equipped(), 'unit-1'));
    const old = structuredClone(state.equipmentState);
    state = accepted(startMatchCombat(emptyBoard(state)));
    state = accepted(nextRound(state, state.round));
    expect(state.equipmentState).toEqual(old);
    expect(state.temporaryEquipment).toEqual([]);
    state = accepted(equipItem(state, 'item-3', 'unit-2', 0));
    expect(state.equipmentState.equipment.draws).toBe(4);
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
  });
  it('queries and temporary-ID commands cannot redraw, consume children or issue permanent IDs', () => {
    const state = freeze(equipped()), before = JSON.stringify(state), id = state.temporaryEquipment[0].temporaryId;
    for (let i = 0; i < 4; i++) {
      expect(previewEquip(state, id, 'unit-2', 0).reason).toBe('temporary-item');
      expect(previewCombine(state, id, 'item-3').reason).toBe('temporary-item');
      for (const r of [equipItem(state, id, 'unit-2', 0), combineItems(state, id, 'item-3')]) {
        expect(r).toEqual({ ok: false, state, reason: 'temporary-item' }); expect(r.state).toBe(state);
      }
      const view = readUnitEquipment(state, 'unit-1')!;
      Object.assign(view.temporaryItems[0], { definitionId: 'tampered' });
      expect(readUnitEquipment(state, 'unit-1')!.temporaryItems).toEqual(state.temporaryEquipment);
    }
    const sold = accepted(sellUnit(state, 'unit-1'));
    expect(previewEquip(sold, id, 'unit-2', 0).reason).toBe('temporary-item');
    expect(JSON.stringify(state)).toBe(before);
  });
  it('pure batch generation orders permanent IDs and is independent of input array order', () => {
    const base = mechanismInventory(6), state: MatchState = { ...base, items: [...base.items.filter(i => i.id !== 'item-3'),
      { id: 'item-20', definitionId: 'thiefs-gloves', location: { kind: 'unit', unitId: 'unit-1', slot: 0 } },
      { id: 'item-10', definitionId: 'thiefs-gloves', location: { kind: 'unit', unitId: 'unit-2', slot: 0 } }] };
    const a = planTemporaryEquipment(state), b = planTemporaryEquipment({ ...state, items: [...state.items].reverse() });
    expect(a.state.equipmentState).toEqual(b.state.equipmentState);
    expect(a.state.temporaryEquipment).toEqual(b.state.temporaryEquipment);
    expect(a.events).toEqual(b.events);
    expect(a.state.equipmentState.rolls.map(r => r.parentItemInstanceId)).toEqual(['item-10', 'item-20']);
    expect(planTemporaryEquipment(freeze(a.state))).toEqual({ state: a.state, events: [] });
    validateMatchEquipment(a.state);
  });
  it('children contribute real stats/programs and parent provenance through combat and restore', () => {
    let state = equipped();
    const snapshot = buildStrategySnapshot(state), unit = snapshot.units.find(u => u.unitId === 'unit-1')!;
    // Irelia base700HP + parent150, Bramble7% =>floor(909.5)=909; base40armor +65 =>105 (no active Sentinel tier).
    expect(unit.stats.health).toBe(909);
    expect(unit.stats.armor).toBe(105);
    const childId = state.temporaryEquipment[0].temporaryId;
    expect(unit.itemPrograms!.find(p => p.source.instanceId === childId)!.source.parentItemInstanceId).toBe('item-3');
    expect(unit.sources.filter(s => s.source.sourceInstanceId === childId).every(s => s.source.parentItemInstanceId === 'item-3')).toBe(true);
    state = accepted(startMatchCombat(state));
    const allEvents = [];
    for (let tick = 0; tick < 101 && state.phase === 'combat'; tick++) {
      if ([0, 1, 40, 80, 100].includes(tick)) {
        const restored = restoreMatch(serializeMatch(state));
        expect(restored).toEqual(state); expect(stepMatch(restored)).toEqual(stepMatch(state));
      }
      const next = stepMatch(state); allEvents.push(...next.events); state = next.state;
    }
    expect(allEvents.some(e => e.type === 'packetDamage' && e.source.instanceId === childId && e.source.parentItemInstanceId === 'item-3')).toBe(true);
  });
  /* User-approved test structure (2026-10-10, TG P2-1 plan A): the original single
   * 43-definition test could not finish its 35 required public routes inside one
   * 5-second budget. The same 35 routes, in the same greedy order, now run as fixed
   * groups that each keep the default 5-second timeout; the overall time budget is
   * therefore 5 x 5 s, not 5 s. Every group prepares its own routes from createMatch,
   * shares no state with other tests, and asserts the definitions it ACTUALLY bound. */
  const TG_ROUND_GROUPS = 5;
  /** Pure planning only: the original greedy choice over 512 candidates (two unseen
   * children first, ties by ascending seed), computed afresh by each caller. */
  function plannedTemporaryRoutes() {
    const candidates = Array.from({ length: 512 }, (_, seed) => {
      const matchSeed = Math.imul(seed, 2654435761) >>> 0;
      const planned = generateRoundRolls({ equipment: initializeStreams(matchSeed).equipment, rolls: [] },
        [{ parentItemInstanceId: 'item-3', roundId: '2-5', playerLevel: 6 }], TEMPORARY_EQUIPMENT_POOL);
      return { matchSeed, children: planned.rolls[0].children };
    });
    const seen = new Set<string>(), routes: { matchSeed: number; children: readonly string[] }[] = [];
    while (seen.size < 43) {
      const additions = (candidate: typeof candidates[number]) => candidate.children.filter(child => !seen.has(child)).length;
      const selected = candidates.reduce((best, candidate) => additions(candidate) > additions(best) ? candidate : best);
      if (!additions(selected)) throw new Error('TG plan cannot reach 43 definitions');
      routes.push(selected); for (const child of selected.children) seen.add(child);
    }
    const size = Math.ceil(routes.length / TG_ROUND_GROUPS);
    return Array.from({ length: TG_ROUND_GROUPS }, (_, group) => routes.slice(group * size, (group + 1) * size));
  }
  /** One actual public route: bind, restore at combat start, corrupt any temporary shield, step and resume. */
  function bindRealRoute(matchSeed: number, children: readonly string[]) {
    let state = equipped(6, matchSeed);
    expect(pair(state)).toEqual(children);
    const bound = state.temporaryEquipment.map(child => child.definitionId);
    state = accepted(startMatchCombat(state));
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const shield = state.combat?.units.flatMap(unit => unit.shieldLayers ?? []).find(layer => layer.source.parentItemInstanceId);
    if (shield) {
      const corrupt = JSON.parse(serializeMatch(state));
      const layer = corrupt.combat.units.flatMap((unit: any) => unit.shieldLayers).find((layer: any) => layer.source.parentItemInstanceId);
      // A legacy source-only key is not a valid temporary shield identity.
      layer.key = JSON.stringify([layer.source.ownerId, layer.source.sourceKind, layer.source.definitionId, layer.source.instanceId, layer.source.effectIndex]);
      expect(() => restoreMatch(corrupt)).toThrow('Invalid Match save: shield projection');
    }
    for (let i = 0; i < 3 && state.phase === 'combat'; i++) state = stepMatch(state).state;
    const restored = restoreMatch(serializeMatch(state));
    expect(stepMatch(restored)).toEqual(stepMatch(state));
    return { bound, shieldChild: shield?.source.definitionId ?? null };
  }
  it('the fixed TG route plan covers all 43 eligible children in 35 routes, with exactly one shield child', () => {
    const groups = plannedTemporaryRoutes(), routes = groups.flat();
    expect(groups.map(group => group.length)).toEqual([7, 7, 7, 7, 7]);
    expect(routes).toHaveLength(35); // One completed child per level-six roll is the lower bound.
    expect(new Set(routes.map(route => route.matchSeed)).size).toBe(35);
    // The public preparation cache is keyed by seed; no other test in this file uses these seeds.
    expect(routes.some(route => route.matchSeed === 42)).toBe(false);
    expect([...new Set(routes.flatMap(route => route.children))].sort()).toEqual(
      [...TEMPORARY_EQUIPMENT_POOL.completed, ...TEMPORARY_EQUIPMENT_POOL.components].map(item => item.definitionId).sort());
    expect(routes.filter(route => route.children.includes('crownguard'))).toHaveLength(1);
  });
  it.each(Array.from({ length: TG_ROUND_GROUPS }, (_, group) => group))(
    'TG route group %i binds its eligible children through real Match snapshots and restore', group => {
      const routes = plannedTemporaryRoutes()[group];
      const actual = routes.map(route => bindRealRoute(route.matchSeed, route.children));
      // Coverage is what the public routes actually bound, not the plan.
      expect(actual.map(result => result.bound)).toEqual(routes.map(route => route.children));
      // Keep the corruption branch non-vacuous: the one crownguard route really grants a temporary shield.
      expect(actual.flatMap(result => result.shieldChild ? [result.shieldChild] : []))
        .toEqual(routes.some(route => route.children.includes('crownguard')) ? ['crownguard'] : []);
    });
  it('combat restore rejects a forged temporary program parent chain', () => {
    const state = accepted(startMatchCombat(equipped()));
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const raw = JSON.parse(serializeMatch(state));
    const program = raw.combat.units.find((u: any) => u.id === 'unit-1').itemPrograms.find((p: any) => p.source.parentItemInstanceId);
    program.source.parentItemInstanceId = 'item-29';
    expect(() => restoreMatch(raw)).toThrow('Invalid Match save: resolved item programs');
  });
  it.each([
    ['stream', 'Equipment stream mismatch', (s: any) => s.equipmentState.equipment.state++],
    ['draw count', 'Unreceipted equipment draws', (s: any) => s.equipmentState.equipment.draws++],
    ['forged pair', 'Equipment roll does not match trusted initial stream', (s: any) => s.equipmentState.rolls[0].children[0] = 'deathblade'],
    ['missing ledger', 'Equipment stream mismatch', (s: any) => { s.equipmentState.rolls = []; s.equipmentState.equipment.draws = 0; }],
    ['unknown parent', 'Invalid equipment parent/round/level', (s: any) => s.equipmentState.rolls[0].parentItemInstanceId = 'item-29'],
    ['future round', 'Invalid equipment parent/round/level', (s: any) => s.equipmentState.rolls[0].roundId = '2-2'],
    ['future level', 'Invalid equipment roll ledger', (s: any) => s.equipmentState.rolls[0].playerLevelSnapshot = 10],
    ['wrong holder', 'Invalid current temporary equipment projection', (s: any) => s.temporaryEquipment.forEach((c: any) => c.holderId = 'unit-2')],
    ['missing sibling', 'Missing temporary sibling', (s: any) => s.temporaryEquipment.pop()],
    ['missing projection', 'Invalid current temporary equipment projection', (s: any) => s.temporaryEquipment = []],
    ['wrong expiry', 'Invalid temporary equipment binding/slots', (s: any) => s.temporaryEquipment[0].expiresAfterRoundId = '2-2'],
    ['inventory parent with children', 'Invalid current temporary equipment projection', (s: any) => s.items.find((i: any) => i.id === 'item-3').location = { kind: 'inventory' }],
    ['permanent child', 'Invalid Match save: item ID', (s: any) => s.items.push({ id: s.temporaryEquipment[0].temporaryId, definitionId: 'bramble-vest', location: { kind: 'inventory' } })],
  ])('restore rejects %s instead of rerolling or repairing', (_label, error, mutate) => {
    const state = equipped();
    expect(restoreMatch(serializeMatch(state))).toEqual(state);
    const raw = JSON.parse(serializeMatch(state)); mutate(raw); const before = JSON.stringify(raw);
    expect(() => restoreMatch(raw)).toThrow(error);
    expect(() => restoreMatch(before)).toThrow(error);
    expect(() => serializeMatch(raw)).toThrow(error);
    expect(JSON.stringify(raw)).toBe(before);
  });
});
