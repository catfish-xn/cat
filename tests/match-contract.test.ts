import { describe, expect, it } from 'vitest';
import { buyUnit, createMatch, startMatchCombat } from '../src/simulation/match';
describe('M2 public contract', () => {
  it('starts with a reproducible shop, economy and separate preparation', () => {
    const first = createMatch();
    expect(first).toEqual(createMatch(42));
    expect(first).toMatchObject({ phase: 'preparation', round: 1, gold: 10, rngState: 1613448261, nextUnitSerial: 6, combat: null, roundResults: [] });
    expect(first.shop.slots).toHaveLength(5);
    expect(first.preparation).not.toBe(createMatch().preparation);
  });
  it('rejects invalid start and stale shop without touching any state', () => {
    const state = createMatch();
    expect(startMatchCombat(state)).toEqual({ ok: false, state, reason: 'missing-player' });
    expect(buyUnit(state, 0, 0)).toEqual({ ok: false, state, reason: 'stale-shop' });
    expect(buyUnit(state, 0, 0).state).toBe(state);
  });
  it.each([-1, 0.5, 4294967296, NaN, Infinity])('rejects invalid initialization seed %s', seed => {
    expect(() => createMatch(seed)).toThrow(RangeError);
  });
  it.each([0, 4294967295])('accepts boundary seed %s without replacing it with the default', seed => {
    expect(createMatch(seed).seed).toBe(seed);
    expect(createMatch(seed)).toEqual(createMatch(seed));
    expect(createMatch(seed).shop).not.toEqual(createMatch(42).shop);
  });
});
