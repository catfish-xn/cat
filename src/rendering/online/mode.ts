/** Online mode is opt-in via `?mode=online`; the single-player path stays the default. */
import { FAKE_DEFAULTS, FakeServer, type FakeServerOptions } from './fake-server';
import { LOCAL_ROOM_DEFAULTS, LocalRoomClient, type LocalRoomOptions } from './local-room-client';
import type { GameClient } from './protocol';

const currentSearch = () => (typeof window === 'undefined' ? '' : window.location.search);
export function isOnlineMode(search = currentSearch()): boolean { return new URLSearchParams(search).get('mode') === 'online'; }

/** `?server=fake` keeps the legacy in-memory mock (kept until C4); everything else runs the real room in the tab. */
export type OnlineServerKind = 'local-room' | 'fake';
export function readServerKind(search = currentSearch()): OnlineServerKind { return new URLSearchParams(search).get('server') === 'fake' ? 'fake' : 'local-room'; }

function numberParam(params: URLSearchParams, key: string, fallback: number): number {
  const value = Number(params.get(key)); return Number.isFinite(value) && params.has(key) ? value : fallback;
}
export function readFakeOptions(search = currentSearch()): FakeServerOptions {
  const params = new URLSearchParams(search);
  const num = (key: string, fallback: number) => numberParam(params, key, fallback);
  return { seed: num('seed', FAKE_DEFAULTS.seed), preparationMs: num('prep', FAKE_DEFAULTS.preparationMs / 1000) * 1000,
    choiceMs: num('choice', FAKE_DEFAULTS.choiceMs / 1000) * 1000, settlementMs: num('settle', FAKE_DEFAULTS.settlementMs / 1000) * 1000, myName: params.get('name') ?? FAKE_DEFAULTS.myName, botHp: num('bots', FAKE_DEFAULTS.botHp) };
}
/** Same URL parameters as the fake (`prep/choice/settle/seed/name`, seconds) plus the debug-only `faultAt` round and `pvp=placeholder` (B1 test path; default is the real two-sided PvP). */
export function readLocalRoomOptions(search = currentSearch()): LocalRoomOptions {
  const params = new URLSearchParams(search);
  const num = (key: string, fallback: number) => numberParam(params, key, fallback);
  const faultAt = params.has('faultAt') ? num('faultAt', 0) : 0;
  return { seed: num('seed', LOCAL_ROOM_DEFAULTS.seed), preparationMs: num('prep', LOCAL_ROOM_DEFAULTS.preparationMs / 1000) * 1000,
    choiceMs: num('choice', LOCAL_ROOM_DEFAULTS.choiceMs / 1000) * 1000, settlementMs: num('settle', LOCAL_ROOM_DEFAULTS.settlementMs / 1000) * 1000,
    myName: params.get('name') ?? LOCAL_ROOM_DEFAULTS.myName, faultAtRound: Number.isInteger(faultAt) && faultAt > 0 ? faultAt : null,
    pvpMode: params.get('pvp') === 'placeholder' ? 'placeholder' : LOCAL_ROOM_DEFAULTS.pvpMode };
}
export function createGameClient(search = currentSearch()): GameClient {
  return readServerKind(search) === 'fake' ? new FakeServer(readFakeOptions(search)) : new LocalRoomClient(readLocalRoomOptions(search));
}
