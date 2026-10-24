import { validateMechanisms } from '../src/simulation/m8/restore';
import { validateResistsShields } from '../src/simulation/m8/resists-shield-restore';
import { expect, it } from 'vitest';
import { selectChoice, buyUnit, startMatchCombat, nextRound, stepMatch, equipItem, deployMatchUnit, type MatchState } from '../src/simulation/match';
import { grantMechanicItem, grantMechanicUnit } from '../src/simulation/seat-mechanics';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readCombatStats } from '../src/simulation/combat-s13';
import { overtimeReceivedBps } from '../src/simulation/combat-overtime';
import { accepted, reachRound, resolveM5Choices, battle } from './match-helpers';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const crest = 'TFT_Item_Artifact_LightshieldCrest';
// v22: seed 5 now carries opening-reward Powder/Silco on the bench (unit-2/unit-3), so the shared
// purchasedThreeHeroMatch() numbers Maddie/Lux unit-4/unit-5 and deploys both onto (5,7), benching
// Maddie. Rebuild the intended Irelia + Maddie (3,7) + Lux (5,7) board here by definition, not serial.
let maddieId = 'unit-2', luxId = 'unit-3';
function threeHeroMatch(): MatchState {
  // v23 batch 3: seed 5's first offer became Built Different (changes the shield numbers); pin a public crest pick.
  const open = reachRound('2-1', false, 5), c = open.pendingChoice!;
  let state = resolveM5Choices(accepted(selectChoice(open, c.choiceId, c.generation, 'artillerist-crest')));
  state = accepted(deployMatchUnit(state, 'unit-1', { kind: 'board', cell: { col: 1, row: 4 } }));
  for (const [id, col] of [['maddie', 3], ['lux', 5]] as const) {
    const slot = state.shop.slots.findIndex(s => s.status === 'available' && s.definitionId === id);
    state = accepted(buyUnit(state, slot, state.shop.generation));
    const unitId = `unit-${state.nextUnitSerial - 1}`;
    if (id === 'maddie') maddieId = unitId; else luxId = unitId;
    state = accepted(deployMatchUnit(state, unitId, { kind: 'board', cell: { col, row: 7 } }));
  }
  return state;
}
// v23 batch 3: pool growth moved seed 42's first 2-1 offer to Sorcerer Explosion (a replay-validated batch-2
// mechanic), so the resists validator no longer decided. Pin a public pick that adds no combat mechanic.
function pick42(): MatchState {
  const open = reachRound('2-1', false, 42), c = open.pendingChoice!;
  return resolveM5Choices(accepted(selectChoice(open, c.choiceId, c.generation, 'ambusher-crest')));
}
function publicStart(dynamic = false, deathHolder = false, bracer = false): MatchState {
  // v22: seed 5 now fields opening-reward Powder+Silco (Dominator), which routes the save through the
  // earlier full V19 replay; seed 42 keeps a plain Irelia board so the resists validator decides.
  let state = dynamic ? threeHeroMatch() : pick42();
  if (!dynamic) for (const [i, unit] of state.preparation.units.filter(u => u.team === 'player').entries())
    state = accepted(deployMatchUnit(state, unit.id, { kind: 'board', cell: { col: i * 2 + 1, row: 4 } }));
  if (deathHolder) {
    // v22 combat (mana/overtime) keeps a front-line Maddie alive to the end, so the death holder is
    // now back-line Lux behind front-line Irelia (1,4) + Maddie (2,4): she dies at tick 489, pre-overtime.
    state = accepted(deployMatchUnit(state, maddieId, {kind: 'board', cell: {col: 2, row: 4}}));
  }
  for (const [slot, definitionId] of (dynamic && !deathHolder ? [crest, 'gargoyle', ...(bracer ? ['TFT_Item_Artifact_SeekersArmguard'] : [])] : [crest]).entries()) {
    const granted = grantMechanicItem(state, { receiptId: `resists-${slot}`, source: 'resists-restore-test', definitionId });
    if (!granted.ok) throw Error(granted.reason);
    state = accepted(equipItem(granted.state, granted.state.items.at(-1)!.id, deathHolder ? luxId : 'unit-1', slot));
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
    const holder = state.combat!.units.find(u => u.id === luxId)!;
    if (!holder.alive && state.combat!.units.some(u => u.shieldLayers?.some(l => l.source.definitionId === crest && l.m8State!.startsAtTick === state.combat!.tick))) {
      death = state; break;
    }
  }
  expect(death).toBeDefined();
  expect(death!.combat!.tick).toBe(489); // before overtime: the resists replay is the restore authority
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
  // 70% of the stacked 155 armor + 155 MR is 217; v22 tick 600 is the first overtime stack, which
  // scales new shields by 90% (so this checkpoint is authenticated by the overtime full replay).
  const stats = readCombatStats(holder, state.combat!);
  expect(stats.armor + stats.magicResist).toBe(310);
  expect(active(state).layer.granted).toBe(Math.floor(217 * overtimeReceivedBps(600) / 10000));
  expect(active(state).layer.granted).toBe(195);
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
  // Public commands only: crest is equipped at combat start; under v22 seed 78 (same Irelia +
  // Maddie board; v15 used seed 27, whose chest now rolls Bramble Vest) naturally grants
  // Gargoyle at tick 169, before the next crest pulse at tick 180.
  let state = reachRound('2-1', true, 78);
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
  expect(holder.combatItemGrants).toMatchObject([{ definitionId: 'gargoyle', grantedAtTick: 169 }]);
  expect(active(state).layer.source.ownerId).toBe(receiver);
  expect(active(state).layer.m8State.startsAtTick).toBe(180);
  for (const input of [structuredClone(state), serializeMatch(state)]) expect(restoreMatch(input)).toEqual(state);
  const candidate = structuredClone(state);
  changeAmount(candidate, 1);
  for (const input of [candidate, JSON.stringify(candidate)]) expect(() => restoreMatch(input)).toThrow('Invalid Match save: resists shield replay');
  expect(() => serializeMatch(candidate)).toThrow('Invalid Match save: resists shield replay');
});
