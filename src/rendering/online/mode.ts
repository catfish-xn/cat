/** Online mode is opt-in via `?mode=online`; the single-player path stays the default. */
import { FAKE_DEFAULTS, type FakeServerOptions } from './fake-server';
const currentSearch = () => (typeof window === 'undefined' ? '' : window.location.search);
export function isOnlineMode(search = currentSearch()): boolean { return new URLSearchParams(search).get('mode') === 'online'; }
export function readFakeOptions(search = currentSearch()): FakeServerOptions {
  const params = new URLSearchParams(search);
  const num = (key: string, fallback: number) => { const value = Number(params.get(key)); return Number.isFinite(value) && params.has(key) ? value : fallback; };
  return { seed: num('seed', FAKE_DEFAULTS.seed), preparationMs: num('prep', FAKE_DEFAULTS.preparationMs / 1000) * 1000,
    choiceMs: num('choice', FAKE_DEFAULTS.choiceMs / 1000) * 1000, settlementMs: num('settle', FAKE_DEFAULTS.settlementMs / 1000) * 1000, myName: params.get('name') ?? FAKE_DEFAULTS.myName, botHp: num('bots', FAKE_DEFAULTS.botHp) };
}
