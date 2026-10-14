/**
 * Node entry of the game server: `npm run serve:game` (esbuild bundle → dist-server/game/main.mjs).
 * Configuration comes from the environment; everything else is injected into createGameServer.
 *
 *   PORT / CAT_PORT          listen port (default 8787)
 *   CAT_HOST                 bind address (default 127.0.0.1; set 0.0.0.0 behind a reverse proxy)
 *   CAT_SEED                 room seed, lcg32-v1 (default 20261012)
 *   CAT_PREP_SEC / CAT_CHOICE_SEC / CAT_SETTLE_SEC   phase lengths in seconds
 *   CAT_QUEUE_TIMEOUT_SEC    auto-start this long after the first join (unset: wait for "start")
 *   CAT_BOT_STEP_MS          delay between two bot steps of one seat (default 300)
 *   CAT_TAKEOVER             1/true/on: a bot plays a disconnected player's seat (B6). Default off (P2, like TFT:
 *                            a disconnected seat does nothing, its board still fights)
 *   CAT_TAKEOVER_SEC         with CAT_TAKEOVER on, the bot takes over after this long disconnected (default 60)
 *
 * TLS termination is the reverse proxy's job (T9); this process speaks plain ws://.
 */
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
const flag = (name: string, fallback: boolean): boolean => {
  const raw = (env[name] ?? '').trim().toLowerCase();
  if (raw === '') return fallback;
  if (['1', 'true', 'on', 'yes'].includes(raw)) return true;
  if (['0', 'false', 'off', 'no'].includes(raw)) return false;
  throw new RangeError(`${name} must be 1/0, true/false, on/off or yes/no, got "${env[name]}"`);
};

const port = integer('PORT', integer('CAT_PORT', 8787));
const host = env.CAT_HOST || '127.0.0.1';
const takeover = flag('CAT_TAKEOVER', BOT_DRIVER_DEFAULTS.takeover);
const queueTimeout = env.CAT_QUEUE_TIMEOUT_SEC ? seconds('CAT_QUEUE_TIMEOUT_SEC', 0) : null;
// C6: battles leave only as compact replays; the per-tick frame transport and its switch are gone.
if (env.CAT_COMBAT_TRANSPORT && env.CAT_COMBAT_TRANSPORT !== 'replay') console.warn(`[game] CAT_COMBAT_TRANSPORT=${env.CAT_COMBAT_TRANSPORT} ignored: battles are always sent as replay`);
const clock = new RealClock();

createGameServer({
  port, host, clock, seed: integer('CAT_SEED', 20261012),
  timings: {
    preparationMs: seconds('CAT_PREP_SEC', ROOM_TIMING_DEFAULTS.preparationMs),
    choiceMs: seconds('CAT_CHOICE_SEC', ROOM_TIMING_DEFAULTS.choiceMs),
    settlementMs: seconds('CAT_SETTLE_SEC', ROOM_TIMING_DEFAULTS.settlementMs),
  },
  queueTimeoutMs: queueTimeout,
  bots: { stepMs: integer('CAT_BOT_STEP_MS', BOT_DRIVER_DEFAULTS.stepMs) || BOT_DRIVER_DEFAULTS.stepMs, takeover, takeoverMs: seconds('CAT_TAKEOVER_SEC', BOT_DRIVER_DEFAULTS.takeoverMs) },
  log: line => console.log(`[game] ${line}`),
}).then(server => {
  console.log(`[game] listening on ws://${host}:${server.port} (prep ${seconds('CAT_PREP_SEC', ROOM_TIMING_DEFAULTS.preparationMs) / 1000}s, takeover ${takeover ? 'on' : 'off'})`);
  const shutdown = () => { console.log('[game] shutting down'); server.close().then(() => { clock.dispose(); process.exit(0); }); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}).catch(error => { console.error('[game] failed to start', error); process.exit(1); });
