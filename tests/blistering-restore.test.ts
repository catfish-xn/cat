import { expect, it } from 'vitest';
import { buyUnit, deployMatchUnit, selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { validateStatusGroups } from '../src/simulation/m8/status';
import { accepted, reachRound } from './match-helpers';

function start(seed: number, requireBlistering = false): MatchState {
  let s = reachRound('2-1', false, seed);
  const choice = s.pendingChoice!;
  if (requireBlistering) expect(choice.offers).toContain('blistering-strikes');
  // The current and XP pools no longer offer Blistering at 16/648. Keep their
  // real shops/armies and select an actual offer: Powder's ignite is the cause,
  // independently of which augment coexists with it. Never replace either seed.
  const id = choice.offers.includes('blistering-strikes') ? 'blistering-strikes' : choice.offers[0];
  s = accepted(selectChoice(s, choice.choiceId, choice.generation, id));
  const first = s.preparation.units.find(u => u.team === 'player')!;
  const slot = s.shop.slots.findIndex(v => v.status === 'available' && v.definitionId === 'powder');
  expect(slot).toBeGreaterThanOrEqual(0);
  s = accepted(deployMatchUnit(s, first.id, { kind: 'board', cell: { col: seed === 648 ? 0 : 3, row: seed === 648 ? 7 : 4 } }));
  s = accepted(buyUnit(s, slot, s.shop.generation));
  if (seed === 648) {
    // Three paid Powder offers merge into a sturdier caster on this seed.
    for (const [index, offer] of s.shop.slots.entries()) if (offer.status === 'available' && offer.definitionId === 'powder') s = accepted(buyUnit(s, index, s.shop.generation));
  }
  const powder = s.preparation.units.find(u => u.team === 'player' && u.definitionId === 'powder')!;
  s = accepted(deployMatchUnit(s, powder.id, { kind: 'board', cell: { col: seed === 648 ? 3 : 0, row: seed === 648 ? 4 : 7 } }));
  return accepted(startMatchCombat(s));
}
function igniteGroups(s: MatchState) {
  return s.combat!.units.flatMap(u => u.mechanismState!.statuses)
    .filter(g => g.contributions.some(c => c.source.definitionId === 'powder-ability'));
}
function checkpoint(seed: number, requireBlistering = false): MatchState {
  let s = start(seed, requireBlistering);
  while (s.phase === 'combat') {
    s = stepMatch(s).state;
    const groups = igniteGroups(s);
    if (groups.some(g => g.kind === 'burn') && groups.some(g => g.kind === 'wound')) return s;
  }
  throw new Error(`Seed ${seed} did not reach Powder ignite`);
}

// The v24 pool offers Blistering with a real Powder shop at seed 273.
it.each([16, 648, 273])('real-command ignite restores exactly and continues with identical events/RNG/receipts (seed %i)', seed => {
  const s = checkpoint(seed, seed === 273);
  const groups = igniteGroups(s);
  const keys = groups.flatMap(g => g.contributions.filter(c => c.source.definitionId === 'powder-ability').map(c => c.key));
  expect(new Set(keys).size).toBeLessThan(keys.length);
  // The generic validator remains fail-closed: only trusted full replay can
  // authenticate this historical cross-category alias and its shared display.
  expect(() => validateStatusGroups(groups, s.combat!.tick, s.combat!.combatId)).toThrow('Invalid status contribution');
  if (seed === 273) expect(s.augments.some(a => a.definitionId === 'blistering-strikes')).toBe(true);
  let original = s, restored = restoreMatch(serializeMatch(s));
  expect(restored).toEqual(original);
  while (original.phase === 'combat') {
    const next = stepMatch(original), resumed = stepMatch(restored);
    expect(resumed).toEqual(next);
    original = next.state; restored = resumed.state;
  }
  expect(restoreMatch(serializeMatch(original))).toEqual(original);
});

it('rejects every changed ignite contribution, projection and attached burn clock on both restore entry paths', () => {
  const s = checkpoint(273, true);
  const saved = serializeMatch(s);
  const mutations: ((raw: any, unit: any, burn: any, wound: any) => void)[] = [
    (_r, _u, b) => { b.application.magnitudeBps++; },
    (_r, _u, _b, w) => { w.application.magnitudeBps++; },
    (_r, _u, b) => { b.key += ' '; },
    (_r, _u, b) => { b.source.effectIndex++; },
    (_r, _u, b) => { b.source.ownerId = 'forged'; },
    (_r, _u, b) => { b.targetId = 'forged'; },
    (_r, _u, b) => { b.application.kind = 'wound'; },
    (_r, _u, b) => { b.application.duration.ticks++; },
    (_r, _u, b) => { b.application.activation = 'next-tick'; },
    (_r, _u, b) => { b.application.stackPolicy.category = 'wound'; },
    (_r, _u, b) => { b.appliedAtTick--; },
    (_r, _u, b) => { b.expiresAtTick++; },
    (_r, _u, b) => { b.endRewardConsumed = true; },
    (_r, _u, b) => { b.endRewardConsumed = 0; },
    (_r, u) => { u.mechanismState.statuses.find((g: any) => g.kind === 'burn').nextPulseAtTick++; },
    (_r, u) => { u.mechanismState.statuses.find((g: any) => g.kind === 'wound').effectiveMagnitudeBps++; },
    (_r, u, b) => { u.mechanismState.statuses.find((g: any) => g.kind === 'burn').contributions.push(structuredClone(b)); },
    (_r, u, b) => { u.mechanismState.statuses = u.mechanismState.statuses.map((g: any) => ({ ...g, contributions: g.contributions.filter((c: any) => c !== b) })); },
    (_r, u, b) => { u.statuses.find((l: any) => l.key === b.key).amount++; },
    (_r, u, b) => { u.mechanismState.periodicTasks.find((t: any) => t.key === b.key).nextPulseAtTick++; },
    (_r, u, b) => { u.mechanismState.periodicTasks.find((t: any) => t.key === b.key).source.effectIndex++; },
    (r) => { r.combat.units.find((u: any) => u.definitionId === 'powder').ability.championId = 'lux'; },
  ];
  for (const mutate of mutations) {
    const raw = JSON.parse(saved);
    const unit = raw.combat.units.find((u: any) => u.mechanismState.statuses.some((g: any) => g.contributions.some((c: any) => c.source.definitionId === 'powder-ability')));
    const contributions = unit.mechanismState.statuses.flatMap((g: any) => g.contributions).filter((c: any) => c.source.definitionId === 'powder-ability');
    const burn = contributions.find((c: any) => c.application.kind === 'burn');
    const wound = contributions.find((c: any) => c.application.kind === 'wound');
    mutate(raw, unit, burn, wound);
    expect(() => restoreMatch(raw)).toThrow();
    expect(() => restoreMatch(JSON.stringify(raw))).toThrow();
  }
  // Rejections must not poison independently reconstructed evidence.
  expect(restoreMatch(saved)).toEqual(s);
});

import { createMatch } from '../src/simulation/match';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { validateDynamicCombat } from '../src/simulation/g2-4b-gold-restore';

it('Rumble uses the same ignite path; only the trusted strategy enables exact replay authentication', () => {
  const base = createMatch(42);
  const input = { ...base, preparation: { ...base.preparation, units: [
    { id: 'p', definitionId: 'rumble', starLevel: 1 as const, team: 'player' as const, location: { kind: 'board' as const, cell: { col: 3, row: 4 } } },
    { id: 'e', definitionId: 'leona', starLevel: 3 as const, team: 'enemy' as const, location: { kind: 'board' as const, cell: { col: 3, row: 3 } } },
  ] } };
  // Direct validator vector, like s13-anomalies-restore: production authenticates
  // this frozen input first. No runtime or expected contribution is injected.
  const basis = freezeCombatInput(input, 42, 0), strategy = buildStrategySnapshot(input);
  let state = createCombatWithEvents(input.preparation, strategy, basis.combatId, basis.battleSeed).state;
  while (state.status === 'running' && !state.units.some(u => u.mechanismState!.statuses.some(g => g.kind === 'burn'))) state = stepCombat(state).state;
  const groups = state.units.flatMap(u => u.mechanismState!.statuses);
  expect(groups.some(g => g.kind === 'burn')).toBe(true);
  expect(groups.some(g => g.kind === 'wound')).toBe(true);
  expect(() => validateStatusGroups(groups, state.tick, state.combatId)).toThrow('Invalid status contribution');
  expect(validateDynamicCombat(state, basis, strategy)).toBe(true);
  const forged = structuredClone(state);
  Object.assign(forged.units.flatMap(u => u.mechanismState!.statuses).find(g => g.kind === 'wound')!.contributions[0].application, { magnitudeBps: 3301 });
  expect(() => validateDynamicCombat(forged, basis, strategy)).toThrow('authoritative ignite replay');
  const ordinary = { ...input, preparation: { ...input.preparation, units: input.preparation.units.map(u => u.id === 'p' ? { ...u, definitionId: 'lux' } : u) } };
  expect(validateDynamicCombat(state, freezeCombatInput(ordinary, 42, 0), buildStrategySnapshot(ordinary))).toBe(false);
});
