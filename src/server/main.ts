/**
 * Node entry of the game server: `npm run serve:game` (esbuild bundle → dist-server/game/main.mjs).
 * Configuration comes from the environment; everything else is injected into createGameServer.
 *
 *   PORT / CAT_PORT          listen port (default 8787)
 *   CAT_HOST                 bind address (default 127.0.0.1; set 0.0.0.0 behind a reverse proxy)
 *   CAT_SEED                 room seed, lcg32-v1 (default 20261012)
 *   CAT_PREP_SEC / CAT_CHOICE_SEC / CAT_SETTLE_SEC   phase lengths in seconds
 *   CAT_QUEUE_TIMEOUT_SEC    auto-start this long after the first join (unset: wait for "start")
 *   CAT_COMBAT_TRANSPORT     frames | replay | both (default both until the client plays replays, C6)
 *   CAT_BOT_STEP_MS          delay between two bot steps of one seat (default 300)
 *   CAT_TAKEOVER_SEC         a disconnected player's seat is played by a bot after this long (default 60)
 *
 * TLS termination is the reverse proxy's job (T9); this process speaks plain ws://.
 */
import { DEFAULT_COMBAT_TRANSPORT, type CombatTransport } from './net/messages';
import { createGameServer } from './net/server';
import { BOT_DRIVER_DEFAULTS } from './room/bot-driver';
import { RealClock } from './room/real-clock';
import { ROOM_TIMING_DEFAULTS } from './room/room';

const env = process.env;
const integer = (name: string, fallback: number): number => {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer, got "${raw}"`);
  return value;
};
const seconds = (name: string, fallbackMs: number): number => integer(name, fallbackMs / 1000) * 1000;

const port = integer('PORT', integer('CAT_PORT', 8787));
const host = env.CAT_HOST || '127.0.0.1';
const queueTimeout = env.CAT_QUEUE_TIMEOUT_SEC ? seconds('CAT_QUEUE_TIMEOUT_SEC', 0) : null;
const transport = env.CAT_COMBAT_TRANSPORT || DEFAULT_COMBAT_TRANSPORT;
if (transport !== 'frames' && transport !== 'replay' && transport !== 'both') throw new RangeError(`CAT_COMBAT_TRANSPORT must be frames, replay or both, got "${transport}"`);
const combatTransport: CombatTransport = transport;
const clock = new RealClock();

createGameServer({
  port, host, clock, seed: integer('CAT_SEED', 20261012),
  timings: {
    preparationMs: seconds('CAT_PREP_SEC', ROOM_TIMING_DEFAULTS.preparationMs),
    choiceMs: seconds('CAT_CHOICE_SEC', ROOM_TIMING_DEFAULTS.choiceMs),
    settlementMs: seconds('CAT_SETTLE_SEC', ROOM_TIMING_DEFAULTS.settlementMs),
  },
  queueTimeoutMs: queueTimeout,
  combatTransport,
  bots: { stepMs: integer('CAT_BOT_STEP_MS', BOT_DRIVER_DEFAULTS.stepMs) || BOT_DRIVER_DEFAULTS.stepMs, takeoverMs: seconds('CAT_TAKEOVER_SEC', BOT_DRIVER_DEFAULTS.takeoverMs) },
  log: line => console.log(`[game] ${line}`),
}).then(server => {
  console.log(`[game] listening on ws://${host}:${server.port} (prep ${seconds('CAT_PREP_SEC', ROOM_TIMING_DEFAULTS.preparationMs) / 1000}s)`);
  const shutdown = () => { console.log('[game] shutting down'); server.close().then(() => { clock.dispose(); process.exit(0); }); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}).catch(error => { console.error('[game] failed to start', error); process.exit(1); });
