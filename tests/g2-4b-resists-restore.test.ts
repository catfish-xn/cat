import { validateMechanisms } from '../src/simulation/m8/restore';
import { validateResistsShields } from '../src/simulation/m8/resists-shield-restore';
import { expect, it } from 'vitest';
import { startMatchCombat, nextRound, stepMatch, equipItem, deployMatchUnit, type MatchState } from '../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readCombatStats } from '../src/simulation/combat-s13';
import { accepted, reachRound, purchasedThreeHeroMatch, resolveM5Choices, battle } from './match-helpers';

const crest = 'TFT_Item_Artifact_LightshieldCrest';
function publicStart(dynamic = false, deathHolder = false, bracer = false): MatchState {
  let state = dynamic ? purchasedThreeHeroMatch() : reachRound('2-1', true, 5);
  if (!dynamic) for (const [i, unit] of state.preparation.units.filter(u => u.team === 'player').entries())
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: { col: i * 2 + 1, row: 4 } }));
  if (deathHolder) {
    state = accepted(deployMatchUnit(state, 'unit-1', {kind: 'board', cell: {col: 1, row: 7}}));
    state = accepted(deployMatchUnit(state, 'unit-2', {kind: 'board', cell: {col: 1, row: 4}}));
  }
  for (const [slot, definitionId] of (dynamic && !deathHolder ? [crest, 'gargoyle', ...(bracer ? ['TFT_Item_Artifact_SeekersArmguard'] : [])] : [crest]).entries()) {
    const granted = grantMechanicItem(state, { receiptId: `resists-${slot}`, source: 'resists-restore-test', definitionId });
    if (!granted.ok) throw Error(granted.reason);
    state = accepted(equipItem(granted.state, granted.state.items.at(-1)!.id, deathHolder ? 'unit-2' : 'unit-1', slot));
  }
  return accepted(startMatchCombat(state));
}
function atTick(tick: number, dynamic = false) {
  let state = publicStart(dynamic);
  while (state.phase === 'combat' && state.combat!.tick < tick) state = stepMatch(state).state;
  expect(state.combat!.tick).toBe(tick);
  return state;
}
// Deliberately mutable only for candidate corruption, never for legal positive controls.
function active(state: any) {
  const unit = state.combat.units.find((u: any) => u.shieldLayers?.some((l: any) => l.source.definitionId === crest));
  return { unit, layer: unit.shieldLayers.find((l: any) => l.source.definitionId === crest) };
}
function changeAmount(state: any, delta: number) {
  const { unit, layer } = active(state);
  layer.granted += delta; layer.remaining += delta;
  layer.m8State.granted += delta; layer.m8State.remaining += delta;
  unit.shield += delta;
}
function transfer(state: any) {
  const { unit, layer } = active(state), target = state.combat.units.find((u: any) => u.id !== unit.id);
  unit.shieldLayers = unit.shieldLayers.filter((l: any) => l !== layer);
  unit.shield -= layer.remaining;
  unit.shieldExpiresAtTick = unit.shield ? Math.max(...unit.shieldLayers.map((l: any) => l.expiresAtTick)) : null;
  target.shieldLayers.push(layer); target.shield += layer.remaining;
  target.shieldExpiresAtTick = Math.max(target.shieldExpiresAtTick ?? 0, layer.expiresAtTick);
  // Rebind the identity too: without this, the old projection check already rejects.
  const key = JSON.parse(layer.m8State.key); key[7] = target.id;
  layer.m8State.key = JSON.stringify(key); layer.m8State.targetId = target.id;
}
it('public equipped live shield restores unchanged and continues identically', () => {
  const state = atTick(60), text = JSON.stringify(state);
  expect(active(state).layer).toMatchObject({ granted: 133, remaining: 133 });
  for (const input of [state, text]) {
    const restored = restoreMatch(input);
    expect(restored).toEqual(state); expect(stepMatch(restored)).toEqual(stepMatch(state));
  }
  expect(JSON.parse(serializeMatch(state))).toEqual(state);
  expect(JSON.stringify(state)).toBe(text);
});
it.each([
  ['small increase', (s: any) => changeAmount(s, 1)],
  ['small decrease', (s: any) => changeAmount(s, -1)],
  ['negative', (s: any) => changeAmount(s, -active(s).layer.granted - 1)],
  ['fractional', (s: any) => changeAmount(s, 0.5)],
  ['coherently rebound target', transfer],
  ['missing shield', (s: any) => { const {unit, layer} = active(s); unit.shieldLayers = unit.shieldLayers.filter((l: any) => l !== layer); unit.shield -= layer.remaining; unit.shieldExpiresAtTick = null; }],
  ['forged historical tick', (s: any) => { active(s).layer.m8State.startsAtTick--; }],
  ['forged coefficient', (s: any) => { active(s).layer.m8Grant.amount.resistsBps++; }],
] as const)('rejects %s through real object and JSON restoration', (_name, corrupt) => {
  const state = atTick(60), candidate = structuredClone(state), before = JSON.stringify(state);
  corrupt(candidate);
  for (const input of [candidate, JSON.stringify(candidate)]) expect(() => restoreMatch(input)).toThrow(/^Invalid Match save:/);
  expect(JSON.stringify(state)).toBe(before);
});
it('restores live targeting-dependent resists, refreshes, absorption, expiry and combat end', () => {
  let state = publicStart(true);
  const opening = readCombatStats(state.combat!.units.find(u => u.id === 'unit-1')!, state.combat!);
  const openingAmount = Math.floor((opening.armor + opening.magicResist) * 7000 / 10000);
  const checkpoints = new Set([60, 120, 180, 240, 600]);
  let sawDynamic = false, sawAbsorption = false;
  while (state.phase === 'combat') {
    state = stepMatch(state).state;
    if (!checkpoints.has(state.combat!.tick)) continue;
    const layers = state.combat!.units.flatMap(u => u.shieldLayers ?? []).filter(l => l.source.definitionId === crest);
    sawDynamic ||= layers.some(l => l.granted !== openingAmount);
    sawAbsorption ||= layers.some(l => l.remaining < l.granted);
    const text = JSON.stringify(state), start = performance.now();
    expect(restoreMatch(text)).toEqual(state);
    console.log(`resists restore tick=${state.combat!.tick} ms=${(performance.now() - start).toFixed(2)}`);
    if (state.combat!.tick === 60) {
      expect(openingAmount).toBe(168); expect(layers[0].granted).toBe(196);
      expect(stepMatch(restoreMatch(state))).toEqual(stepMatch(state));
    }
  }
  expect(sawDynamic).toBe(true); expect(sawAbsorption).toBe(true);
  expect(state.combat!.units.flatMap(u => u.shieldLayers ?? [])).toEqual([]);
  expect(restoreMatch(JSON.stringify(state))).toEqual(state);
});

it('restores the holder-death grant after live defenses and periodic history', () => {
  let state = publicStart(true, true), death: MatchState | undefined;
  while (state.phase === 'combat') {
    state = stepMatch(state).state;
    const holder = state.combat!.units.find(u => u.id === 'unit-2')!;
    if (!holder.alive && state.combat!.units.some(u => u.shieldLayers?.some(l => l.source.definitionId === crest && l.m8State!.startsAtTick === state.combat!.tick))) {
      death = state; break;
    }
  }
  expect(death).toBeDefined();
  const restored = restoreMatch(JSON.stringify(death));
  expect(restored).toEqual(death); expect(stepMatch(restored)).toEqual(stepMatch(death!));
});

it('rejects an invented resists declaration in a battle without a compiled resists source', () => {
  let state = battle();
  while (state.phase === 'combat' && !state.combat!.units.some(u => u.shieldLayers?.some(l => l.remaining > 0))) state = stepMatch(state).state;
  const candidate: any = structuredClone(state);
  const layer = candidate.combat.units.flatMap((u: any) => u.shieldLayers ?? []).find((l: any) => l.remaining > 0);
  expect(layer).toBeDefined();
  layer.m8Grant.amount.resistsBps = 7000;
  expect(() => restoreMatch(candidate)).toThrow(/^Invalid Match save:/);
});

it.each([-1, 0.5, 1201, Number.MAX_SAFE_INTEGER])('bounds independent resists replay tick %s', tick => {
  const state = atTick(60);
  expect(() => validateResistsShields({...state.combat!, tick}, state.combatInputBasis!, state.combat!.strategy!))
    .toThrow(/^Invalid Match save:/);
});
it('does not inspect replay inputs when the trusted strategy has no resists grant', () => {
  const state = battle();
  const basis = Object.defineProperty({}, 'inputs', {get() {throw Error('must not replay');}});
  expect(() => validateResistsShields(state.combat!, basis as any, state.combat!.strategy!)).not.toThrow();
});

it('rejects an extra zero-resists layer claiming a real source on another live target', () => {
  const state = atTick(60), candidate: any = structuredClone(state);
  const { unit, layer } = active(candidate);
  const target = candidate.combat.units.find((u: any) => u.alive && u.id !== unit.id);
  expect(target).toBeDefined();
  const extra = structuredClone(layer);
  extra.m8Grant.amount.resistsBps = 0;
  extra.m8Grant.amount.flat = 1;
  extra.granted = extra.remaining = extra.m8State.granted = extra.m8State.remaining = 1;
  extra.absorbed = extra.m8State.absorbed = 0;
  extra.expiresAtTick = extra.m8State.expiresAtTick = extra.m8State.startsAtTick + extra.m8Grant.durationTicks;
  const key = JSON.parse(extra.m8State.key); key[7] = target.id;
  extra.m8State.key = JSON.stringify(key); extra.m8State.targetId = target.id;
  extra.m8Grant.endTargeting = { kind: 'fixed', targetIds: [target.id], ifMissing: 'skip' };
  target.shieldLayers.push(extra); target.shield += extra.remaining;
  target.shieldExpiresAtTick = Math.max(target.shieldExpiresAtTick ?? 0, extra.expiresAtTick);
  expect(layer).toEqual(active(state).layer);
  // The local declaration guard must also reject, independently of replay.
  expect(() => validateMechanisms(target, candidate.combat.units, candidate.combat.tick,
    candidate.combat.combatId, false, candidate.combat.nextActionSeq))
    .toThrow('Invalid Match save: declared shield grant');
  for (const input of [candidate, JSON.stringify(candidate)])
    expect(() => restoreMatch(input)).toThrow('Invalid Match save: resists shield replay');
});

it.each(['object', 'JSON'] as const)('restores stacked crest/gargoyle/bracer from %s and matches every tick through the next battle', format => {
  let state = publicStart(true, false, true);
  while (state.phase === 'combat' && state.combat!.tick < 600) state = stepMatch(state).state;
  expect(state.combat!.tick).toBe(600);
  const holder = state.combat!.units.find(u => u.id === 'unit-1')!;
  expect(holder.triggerLedger!.runtimes.some(r => r.source.definitionId === 'TFT_Item_Artifact_SeekersArmguard' && r.triggerCount > 0)).toBe(true);
  expect(holder.runtime!.abilityPowerFlat).toBe(15);
  expect(readCombatStats(holder, state.combat!).abilityPower).toBe(145);
  expect(active(state).layer.granted).toBe(217);
  const input = format === 'object' ? state : serializeMatch(state);
  let original = state, restored = restoreMatch(input);
  expect(restored).toEqual(original);
  const compareBattle = () => {
    while (original.phase === 'combat') {
      const a = stepMatch(original), b = stepMatch(restored);
      expect(b).toEqual(a); // Full state (including RNG) and events, at every tick.
      original = a.state; restored = b.state;
    }
  };
  compareBattle();
  original = resolveM5Choices(original); restored = resolveM5Choices(restored);
  const a = nextRound(original, original.round), b = nextRound(restored, restored.round);
  expect(b).toEqual(a);
  original = resolveM5Choices(accepted(a)); restored = resolveM5Choices(accepted(b));
  const startA = startMatchCombat(original), startB = startMatchCombat(restored);
  expect(startB).toEqual(startA);
  original = accepted(startA); restored = accepted(startB);
  expect(original.phase).toBe('combat');
  expect(original.round).toBe(state.round + 1);
  compareBattle();
}, 20000);

it('restores crest shields after a chest grants the holder dual resists, and rejects coherent amount edits', () => {
  // Public commands only: crest is equipped at combat start; v14 seed 26 naturally
  // grants Gargoyle at tick 172, before the next crest pulse at tick 180.
  let state = reachRound('2-1', true, 26);
  state = accepted(grantMechanicUnit(state, { receiptId: 'chest-crest-holder', source: 'test', definitionId: 'maddie' }));
  const players = state.preparation.units.filter(u => u.team === 'player');
  const receiver = players[0].id, chestHolder = players[1].id;
  for (const [id, col, row] of [[receiver, 1, 7], [chestHolder, 3, 4]] as const)
    state = accepted(deployMatchUnit(state, id, { kind: 'board', cell: { col, row } }));
  for (const [unitId, definitionId] of [[receiver, crest], [chestHolder, 'TFT_Item_UnstableTreasureChest']]) {
    state = accepted(grantMechanicItem(state, { receiptId: `chest-crest-${definitionId}`, source: 'test', definitionId }));
    state = accepted(equipItem(state, state.items.at(-1)!.id, unitId, 0));
  }
  state = accepted(startMatchCombat(state));
  const openingHolder = state.combat!.units.find(u => u.id === receiver)!;
  expect(openingHolder.itemPrograms!.some(p => p.source.definitionId === crest)).toBe(true);
  expect(openingHolder.combatItemGrants ?? []).toEqual([]);
  while (state.phase === 'combat' && state.combat!.tick < 180) state = stepMatch(state).state;
  expect(state.combat!.tick).toBe(180);
  const holder = state.combat!.units.find(u => u.id === receiver)!;
  expect(holder.combatItemGrants).toMatchObject([{ definitionId: 'gargoyle', grantedAtTick: 172 }]);
  expect(active(state).layer.source.ownerId).toBe(receiver);
  expect(active(state).layer.m8State.startsAtTick).toBe(180);
  for (const input of [structuredClone(state), serializeMatch(state)]) expect(restoreMatch(input)).toEqual(state);
  const candidate = structuredClone(state);
  changeAmount(candidate, 1);
  for (const input of [candidate, JSON.stringify(candidate)]) expect(() => restoreMatch(input)).toThrow('Invalid Match save: resists shield replay');
  expect(() => serializeMatch(candidate)).toThrow('Invalid Match save: resists shield replay');
});
