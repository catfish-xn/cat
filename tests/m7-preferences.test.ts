import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reducedMotion, resetPreferenceCache, setReducedMotion } from '../src/presentation/preferences';

const g = globalThis as Record<string, unknown>;
// The fast project runs with isolate:false, so another file in this worker can call
// reducedMotion() or leave matchMedia/localStorage behind. Clear that before every
// case; the assertions below still require the system preference, a storage failure,
// and a real persisted value.
function isolatePreferences(): void {
  vi.unstubAllGlobals();
  delete g.localStorage;
  delete g.matchMedia;
  resetPreferenceCache();
}
beforeEach(isolatePreferences);
afterEach(isolatePreferences);

describe('M7 presentation preferences', () => {
  it('defaults to the system preference and survives missing storage', () => {
    g.matchMedia = () => ({ matches: true });
    expect(reducedMotion()).toBe(true);
    setReducedMotion(false);
    expect(reducedMotion()).toBe(false);
  });
  it('keeps working when storage throws on read and write', () => {
    g.localStorage = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(reducedMotion()).toBe(false);
    setReducedMotion(true);
    expect(reducedMotion()).toBe(true);
  });
  it('persists through storage when available', () => {
    const store = new Map<string, string>();
    g.localStorage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) };
    setReducedMotion(true);
    resetPreferenceCache();
    expect(reducedMotion()).toBe(true);
    expect(store.get('hex.m7.reducedMotion')).toBe('1');
  });
});
