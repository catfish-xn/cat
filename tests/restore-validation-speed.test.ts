import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { validateDynamicCombat } from '../src/simulation/g2-4b-gold-restore';
import { canonicalContent } from '../src/simulation/content';

function fixture() {
  const base = createMatch(42);
  const inputs = { ...base, preparation: { ...base.preparation,
    units: base.preparation.units.map(u => u.team === 'player' ? { ...u, definitionId: 'warwick' } : u) } };
  const basis = freezeCombatInput(inputs, 42, 0), strategy = buildStrategySnapshot(inputs);
  let state = createCombatWithEvents(inputs.preparation, strategy, basis.combatId, basis.battleSeed).state;
  for (let n = 0; n < 3; n++) state = stepCombat(state).state;
  return { basis, strategy, state };
}
const parsed = (state: CombatState): CombatState => JSON.parse(JSON.stringify(state));
function rejection(run: () => unknown) {
  try { run(); } catch (error) {
    if (error instanceof Error) return { name: error.name, message: error.message };
    throw error;
  }
  throw new Error('Expected rejection');
}

it('compares every nested runtime field without retaining candidate admission between comparisons or replay calls', () => {
  const { basis, strategy, state } = fixture();
  const replay = createRestoreCombatReplay(basis, strategy, state.tick, true), candidate = parsed(state);
  expect(replay.matchesValidatedAtSaveTick(candidate)).toBe(true);
  const paths: (string | number)[][] = [];
  function leaves(value: unknown, path: (string | number)[] = []) {
    if (value === null || typeof value !== 'object') { paths.push(path); return; }
    for (const key of Object.keys(value)) leaves((value as Record<string, unknown>)[key], [...path, key]);
  }
  leaves(candidate);
  expect(paths.length).toBeGreaterThan(100);
  for (const path of paths) {
    let owner: any = candidate;
    for (const key of path.slice(0, -1)) owner = owner[key];
    const key = path.at(-1)!, original: unknown = owner[key];
    owner[key] = typeof original === 'number' ? original + 1 : typeof original === 'string' ? `${original}!` : original === null ? 0 : !original;
    expect(replay.matchesValidatedAtSaveTick(candidate), path.join('.')).toBe(false);
    owner[key] = original;
    expect(replay.matchesValidatedAtSaveTick(candidate)).toBe(true);
  }
  (candidate.units[0] as any).extra = 1;
  expect(replay.matchesValidatedAtSaveTick(candidate)).toBe(false);
  expect(createRestoreCombatReplay(basis, strategy, state.tick, true).matchesValidatedAtSaveTick(candidate)).toBe(false);
  delete (candidate.units[0] as any).extra;
  const copy = replay.stateAtSaveTick();
  (copy.units[0].ability as any).id = 'caller-mutation';
  expect(replay.matchesValidatedAtSaveTick(candidate)).toBe(true);
  expect(createRestoreCombatReplay(basis, strategy, state.tick, true).matchesValidatedAtSaveTick(candidate)).toBe(true);
});

it('retains canonical key ordering and negative-zero equality for admitted JSON', () => {
  const { basis, strategy, state } = fixture();
  const candidate = parsed(state);
  (candidate.units as any[]).reverse();
  const replay = createRestoreCombatReplay(basis, strategy, state.tick, true);
  expect(replay.matchesValidatedAtSaveTick(candidate)).toBe(canonicalContent(state) === canonicalContent(candidate));
  (candidate.units as any[]).reverse();
  const reordered = Object.fromEntries(Object.entries(candidate).reverse()) as unknown as CombatState;
  expect(replay.matchesValidatedAtSaveTick(reordered)).toBe(true);
  const zero = candidate.units.find(u => u.shield === 0)!;
  Object.assign(zero, { shield: -0 });
  expect(replay.matchesValidatedAtSaveTick(candidate)).toBe(true);
});

it('keeps dynamic replay rejection type/message identical to the original object path', () => {
  const { basis, strategy, state } = fixture();
  expect(validateDynamicCombat(parsed(state), basis, strategy)).toBe(true);
  expect(validateDynamicCombat(parsed(state), basis, strategy, true)).toBe(true);
  for (const mutate of [
    (c: CombatState) => { Object.assign(c.units[0], { hp: c.units[0].hp - 1 }); },
    (c: CombatState) => { (c as any).nextEventSeq++; },
    (c: CombatState) => { (c.units[0].ability as any).extra = 1; },
    (c: CombatState) => { (c.units as any[]).reverse(); },
  ]) {
    const candidate = parsed(state); mutate(candidate);
    expect(rejection(() => validateDynamicCombat(candidate, basis, strategy, true)))
      .toEqual(rejection(() => validateDynamicCombat(candidate, basis, strategy)));
    expect(validateDynamicCombat(parsed(state), basis, strategy, true)).toBe(true);
  }
});

it('shares only immutable equal declarations after validation, preserving native bytes and mutable runtimes', () => {
  const { basis, strategy, state } = fixture();
  const replay = createRestoreCombatReplay(basis, strategy, state.tick, true);
  const first = parsed(state), second = parsed(state), bytes = JSON.stringify(first);
  replay.shareValidatedDeclarations(first);
  replay.shareValidatedDeclarations(second);
  expect(JSON.stringify(first)).toBe(bytes);
  expect(first.units[0].ability).toBe(second.units[0].ability);
  expect(Object.isFrozen(first.units[0].ability)).toBe(true);
  expect(first.units[0]).not.toBe(second.units[0]);
  expect(first.units[0].runtime).not.toBe(second.units[0].runtime);
  const different = parsed(state);
  const reordered = Object.fromEntries(Object.entries(different.units[0].ability).reverse());
  Object.assign(different.units[0], { ability: reordered, attackCone: { extra: 1 } });
  const original = JSON.stringify(different);
  replay.shareValidatedDeclarations(different);
  expect(JSON.stringify(different)).toBe(original);
  expect(different.units[0].ability).toBe(reordered);
});
