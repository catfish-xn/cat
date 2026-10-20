import { expect, it } from 'vitest';
import { createMatch, startMatchCombat, stepMatch } from '../src/simulation/match';
import { freezeCombatInput } from '../src/simulation/combat-input';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { createRestoreCombatReplay } from '../src/simulation/restore-combat-replay';
import { restoreMatch } from '../src/simulation/serialization';

it('copies only P2 opening facts without exposing the private opening or later callers', () => {
  const base = createMatch(42);
  const inputs = { ...base, preparation: { ...base.preparation,
    units: base.preparation.units.map(u => u.team === 'player' ? { ...u, definitionId: 'nami' } : u) },
    augments: [{ definitionId: 'trifecta-ii', choiceId: 'projection', acquiredRound: 1 }] };
  const basis = freezeCombatInput(inputs, 42, 0), strategy = buildStrategySnapshot(inputs);
  const replay = createRestoreCombatReplay(basis, strategy, 0);
  const expected = replay.opening().units.map(({ id, s13P2Opening }) => ({ id, s13P2Opening }));
  const projection = replay.p2Opening();
  expect(projection).toEqual(expected);
  const selected = projection.find(u => u.s13P2Opening?.selected.length)!.s13P2Opening!;
  (selected.selected as string[]).push('caller-mutation');
  expect(replay.opening().units.map(({ id, s13P2Opening }) => ({ id, s13P2Opening }))).toEqual(expected);
  expect(createRestoreCombatReplay(basis, strategy, 0).p2Opening()).toEqual(expected);
});

it('keys pure identity encodings by the complete basis and strategy, including after eviction', () => {
  const started = startMatchCombat(createMatch(42));
  if (!started.ok) throw Error(started.reason);
  const basis = started.state.combatInputBasis!, strategy = started.state.combat!.strategy!;
  for (const seed of [42, 43, 44, 45, 46, 47, 48, 49, 50, 42]) {
    const input = { ...basis, battleSeed: seed };
    const expected = createRestoreCombatReplay(input, strategy, 2).atSaveTick();
    expect(createRestoreCombatReplay(input, strategy, 2, true).atSaveTick()).toEqual(expected);
    const changed = { ...strategy, units: strategy.units.map((u, i) => i ? u : { ...u, stats: { ...u.stats, attack: u.stats.attack + 1 } }) };
    expect(createRestoreCombatReplay(input, changed, 2, true).atSaveTick())
      .toEqual(createRestoreCombatReplay(input, changed, 2).atSaveTick());
  }
});

it('keeps object getter evaluation on every replay identity lookup', () => {
  const started = startMatchCombat(createMatch(42));
  if (!started.ok) throw Error(started.reason);
  let seed = 42;
  const basis = Object.freeze({ ...started.state.combatInputBasis!, get battleSeed() { return seed; } });
  const strategy = started.state.combat!.strategy!;
  createRestoreCombatReplay(basis, strategy, 2).atSaveTick();
  seed = 43;
  expect(createRestoreCombatReplay(basis, strategy, 2).atSaveTick())
    .toEqual(createRestoreCombatReplay({ ...basis, battleSeed: 43 }, strategy, 2).atSaveTick());
});

it('revalidates candidate runtime and RNG after the identity encoding is warm', () => {
  const started = startMatchCombat(createMatch(42));
  if (!started.ok) throw Error(started.reason);
  const state = stepMatch(started.state).state;
  const text = JSON.stringify(state);
  expect(restoreMatch(text)).toEqual(state);
  for (const field of ['rngState', 'rngDraws', 'nextActionSeq', 'nextEventSeq'] as const) {
    const bad = JSON.parse(text);
    bad.combat[field]++;
    expect(() => restoreMatch(JSON.stringify(bad))).toThrow('combat cursor binding facts');
    expect(restoreMatch(text)).toEqual(state);
  }
});
