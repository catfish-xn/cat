/** Online mode is opt-in via `?mode=online`; the single-player path stays the default. */
import { SHOP_CATALOG } from '../../simulation/match-rules';
import { LOCAL_ROOM_DEFAULTS, LocalRoomClient, type LocalRoomOptions } from './local-room-client';
import type { GameClient } from './protocol';
import { defaultWsUrl, WsGameClient, type WsClientOptions } from './ws-client';

const currentSearch = () => (typeof window === 'undefined' ? '' : window.location.search);
export function isOnlineMode(search = currentSearch()): boolean { return new URLSearchParams(search).get('mode') === 'online'; }

/** `?server=ws` talks to the game server; everything else (`server=local`, the default) runs the real room in the tab. */
export type OnlineServerKind = 'local-room' | 'websocket';
export function readServerKind(search = currentSearch()): OnlineServerKind { return new URLSearchParams(search).get('server') === 'ws' ? 'websocket' : 'local-room'; }

function numberParam(params: URLSearchParams, key: string, fallback: number): number {
  const value = Number(params.get(key)); return Number.isFinite(value) && params.has(key) ? value : fallback;
}
/** Debug-only `poolCaps=irelia:8,darius:1`: catalog heroes with non-negative integer copies; anything malformed is ignored (official sizes). */
function poolCapsParam(raw: string | null): Readonly<Record<string, number>> | null {
  if (!raw) return null;
  const entries = raw.split(',').map(pair => pair.split(':'));
  const valid = entries.every(([id, count]) => id !== undefined && SHOP_CATALOG.includes(id) && /^\d+$/.test(count ?? ''));
  return valid ? Object.fromEntries(entries.map(([id, count]) => [id!, Number(count)])) : null;
}
/** URL parameters `prep/choice/settle/seed/name` (seconds) plus the debug-only `faultAt` round, `poolCaps` and `pvp=placeholder` (B1 test path; default is the real two-sided PvP). */
export function readLocalRoomOptions(search = currentSearch()): LocalRoomOptions {
  const params = new URLSearchParams(search);
  const num = (key: string, fallback: number) => numberParam(params, key, fallback);
  const faultAt = params.has('faultAt') ? num('faultAt', 0) : 0;
  return { seed: num('seed', LOCAL_ROOM_DEFAULTS.seed), preparationMs: num('prep', LOCAL_ROOM_DEFAULTS.preparationMs / 1000) * 1000,
    choiceMs: num('choice', LOCAL_ROOM_DEFAULTS.choiceMs / 1000) * 1000, settlementMs: num('settle', LOCAL_ROOM_DEFAULTS.settlementMs / 1000) * 1000,
    myName: params.get('name') ?? LOCAL_ROOM_DEFAULTS.myName, faultAtRound: Number.isInteger(faultAt) && faultAt > 0 ? faultAt : null,
    pvpMode: params.get('pvp') === 'placeholder' ? 'placeholder' : LOCAL_ROOM_DEFAULTS.pvpMode, poolCapacities: poolCapsParam(params.get('poolCaps')) };
}
/** Server address: `?ws=ws://127.0.0.1:8787` when given, else `ws(s)://<this host>/ws` (the dev server proxies it). */
export function readWsOptions(search = currentSearch()): WsClientOptions {
  const params = new URLSearchParams(search);
  const location = typeof window === 'undefined' ? { protocol: 'http:', host: '127.0.0.1:5173' } : window.location;
  let storage: Storage | null = null;
  try { storage = typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { /* storage blocked */ }
  return { url: defaultWsUrl(location, params.get('ws')), storage, log: line => console.info(`[online] ${line}`) };
}
export function createGameClient(search = currentSearch()): GameClient {
  return readServerKind(search) === 'websocket' ? new WsGameClient(readWsOptions(search)) : new LocalRoomClient(readLocalRoomOptions(search));
}
