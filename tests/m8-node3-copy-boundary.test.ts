import { expect, it } from 'vitest';
import * as api from '../src/simulation/match';

it('copy enumerates keys once and observes getter deletion of a later key', () => {
  const start = api.startMatchCombat(api.createMatch(42));
  if (!start.ok) throw Error(start.reason);
  const unit = { ...start.state.combat!.units[0] } as unknown as Record<string, unknown>;
  const reads: string[] = [];
  Object.defineProperty(unit, 'probe', { enumerable: true, get: () => {
    reads.push('probe'); delete unit.later; unit.added = 2; return 1;
  } });
  unit.later = 3;
  const state = { ...start.state, combat: { ...start.state.combat!, units: [unit, ...start.state.combat!.units.slice(1)] } } as unknown as api.MatchState;
  const copied = api.stepMatch(state).state.combat!.units.find(u=>u.id===unit.id)!;
  expect(reads).toEqual(['probe']);
  expect(Object.hasOwn(copied,'probe')).toBe(true);
  expect(Object.hasOwn(copied,'later')).toBe(false);
  expect(Object.hasOwn(copied,'added')).toBe(false);
});

it('native tick copy keeps own __proto__, nested aliases/cycles and built-in values', () => {
  const start = api.startMatchCombat(api.createMatch(42));
  if (!start.ok) throw Error(start.reason);
  const shared = { value: 7 }, probe: Record<string, unknown> = { left: shared, right: shared,
    date: new Date(1234), map: new Map([[shared, new Set([shared])]]) };
  probe.self = probe;
  const unit = { ...start.state.combat!.units[0], probe };
  Object.defineProperty(unit, '__proto__', { value: { ordinary: true }, enumerable: true });
  const state = { ...start.state, combat: { ...start.state.combat!, units: [unit, ...start.state.combat!.units.slice(1)] } } as api.MatchState;
  const copied = api.stepMatch(state).state.combat!.units.find(u => u.id === unit.id)! as unknown as Record<string, unknown>;
  expect(Object.hasOwn(copied, '__proto__')).toBe(true);
  expect(copied.__proto__).toEqual({ ordinary: true });
  expect(Object.getPrototypeOf(copied)).toBe(Object.prototype);
  const next = copied.probe as typeof probe;
  expect(next).toEqual(structuredClone(probe));
  expect(next).not.toBe(probe); expect(next.self).toBe(next);
  expect(next.left).toBe(next.right); expect(next.left).not.toBe(shared);
  expect([...(next.map as Map<unknown, unknown>).keys()][0]).toBe(next.left);
  expect(probe.self).toBe(probe); expect(shared.value).toBe(7);
});

it('unit getters are read before the three excluded fields are read again', () => {
  const start = api.startMatchCombat(api.createMatch(42));
  if (!start.ok) throw Error(start.reason);
  const unit = { ...start.state.combat!.units[0] };
  const reads: string[] = [];
  for (const key of ['mechanismDefinitions', 'mechanismState', 'triggerLedger'] as const) {
    const value = unit[key];
    Object.defineProperty(unit, key, { enumerable: true, get: () => { reads.push(key); return value; } });
  }
  Object.defineProperty(unit, 'probe', { enumerable: true, get: () => { reads.push('probe'); return 1; } });
  const expected = Object.keys(unit).filter(key => ['mechanismDefinitions', 'mechanismState', 'triggerLedger', 'probe'].includes(key));
  const state = { ...start.state, combat: { ...start.state.combat!, units: [unit, ...start.state.combat!.units.slice(1)] } } as api.MatchState;
  api.stepMatch(state);
  expect(reads.slice(0,expected.length)).toEqual(expected);
  expect(reads.slice(expected.length,expected.length+3)).toEqual(['mechanismDefinitions','mechanismState','triggerLedger']);
  expect(reads.filter(x=>x==='probe')).toHaveLength(1);
});
