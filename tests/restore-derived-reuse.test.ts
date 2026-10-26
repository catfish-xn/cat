import { afterEach, expect, it, vi } from 'vitest';
import { createMatch, startMatchCombat, stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import * as definitions from '../src/simulation/m8/s13-definitions';
import { accepted } from './match-helpers';

afterEach(() => vi.restoreAllMocks());

it('compiles each private candidate unit once per restore while comparing complete declarations each time', () => {
  const state = accepted(startMatchCombat(createMatch(42))), text = JSON.stringify(state);
  const compile = vi.spyOn(definitions, 'compileMechanismDefinitions');
  const first = restoreMatch(text);
  expect(first.combat!.units.some(u => u.ability.kind === 's13')).toBe(true);
  for (const unit of first.combat!.units.filter(u => u.ability.kind === 's13')) {
    expect(compile.mock.calls.filter(([input]) => input === unit)).toHaveLength(1);
  }
  expect(first).toEqual(state);
  expect(JSON.stringify(first)).toBe(text);
  expect(stepMatch(first)).toEqual(stepMatch(state));
  compile.mockClear();
  const second = restoreMatch(text);
  for (const unit of second.combat!.units.filter(u => u.ability.kind === 's13')) {
    expect(compile.mock.calls.filter(([input]) => input === unit)).toHaveLength(1);
  }
  expect(second).toEqual(first);
  expect(second.combat!.units[0]).not.toBe(first.combat!.units[0]);
  const bad = JSON.parse(text);
  bad.combat.units.find((u: any) => u.ability.kind === 's13').mechanismDefinitions.extra = 1;
  expect(() => restoreMatch(JSON.stringify(bad))).toThrow('uncompiled mechanism definitions');
  expect(() => restoreMatch(bad)).toThrow('uncompiled mechanism definitions');
  expect(() => serializeMatch(bad)).toThrow('uncompiled mechanism definitions');
  expect(restoreMatch(text)).toEqual(state);
});
