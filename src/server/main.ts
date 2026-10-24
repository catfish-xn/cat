/**
 * Node entry of the game server: `npm run serve:game` (esbuild bundle → dist-server/game/main.mjs).
 * Configuration comes from the environment; everything else is injected into createGameServer.
 *
 *   PORT / CAT_PORT          listen port (default 8787)
 *   CAT_HOST                 bind address (default 127.0.0.1; set 0.0.0.0 behind a reverse proxy)
 *   CAT_SEED                 seed of the first room, lcg32-v1; later rooms derive theirs from it (lobbyRoomSeed). Unset: a
 *                            random uint32 per process start, logged as config.seed (set it to replay a session)
 *   CAT_PREP_SEC / CAT_CHOICE_SEC / CAT_SETTLE_SEC   phase lengths in seconds
 *   CAT_QUEUE_TIMEOUT_SEC    auto-start this long after the first join (unset: wait for "start")
 *   CAT_BOT_STEP_MS          delay between two bot steps of one seat (default 300)
 *   CAT_TAKEOVER             1/true/on: a bot plays a disconnected player's seat (B6). Default off (P2, like TFT:
 *                            a disconnected seat does nothing, its board still fights)
 *   CAT_TAKEOVER_SEC         with CAT_TAKEOVER on, the bot takes over after this long disconnected (default 60)
 *   CAT_CAROUSEL             1/true/on (default): G1-P7 shared carousel (P7-1: the usual opening with the free unit,
 *                            carousels at the five x-4 rounds). 0/false/off: the pre-P7 x-4 component supply, for old
 *                            e2e scripts only
 *   CAT_STALL_SEC            G3 watchdog: end a match that publishes nothing this long past its phase deadline (default 120, 0 = off)
 *   CAT_ABANDON_SEC          G3 watchdog: end a match whose human seats are all disconnected this long (default 90, 0 = off)
" *   CAT_HEARTBEAT_SEC        ping + heartbeat message every this many seconds (default 10, 0 = off); a connection silent for
 *                            2.5 intervals is dropped (its seat is kept and resumes as after any disconnect)
 *   CAT_LOOP_LAG_SEC         event-loop delay report (`loop.lag`, max and p99) every this many seconds (default 10, 0 = off);
 *                            a warning when the loop was held 100 ms or more, debug otherwise
 *   CAT_LOG_LEVEL            debug / info (default) / warn / error; one JSON object per line on stdout
 *   CAT_GIT_SHA              commit the bundle was built from, reported by GET /healthz (deploy/deploy.sh sets it)
 *   CAT_FAULT_INJECT_ROUND   TEST ONLY (G3 e2e): the first battle of this round number throws once, so the room ends
 *                            with a resolver-error fault; later matches are unaffected. Never set it in production.
 *
 * TLS termination is the reverse proxy's job (T9); this process speaks plain ws://.
 */
import { CONTENT_DIGEST } from '../simulation/content';
import { LOOT_REPLAY_DIGEST } from '../simulation/loot-freeze';
import { createJsonLogger, parseLogLevel } from './log';
import { HEARTBEAT_DEFAULTS, createGameServer } from './net/server';
import { randomSeed } from './net/session';
import type { BattleResolver } from './room/battle-resolver';
import { BOT_DRIVER_DEFAULTS } from './room/bot-driver';
import { CAROUSEL_RULES_BINDING } from './room/carousel';
import { RealClock } from './room/real-clock';
import { PER_ROUND_PREPARATION, ROOM_TIMING_DEFAULTS } from './room/room';
import { TwoSidedBattleResolver } from './room/two-sided-resolver';

const env = process.env;
const integer = (name: string, fallback: number): number => {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer, got "${raw}"`);
  return value;
};
const seconds = (name: string, fallbackMs: number): number => integer(name, fallbackMs / 1000) * 1000;
/** `CAT_PREP_SEC` overrides every round's preparation; unset keeps the rules' per-round table. */
const preparationMs = env.CAT_PREP_SEC === undefined || env.CAT_PREP_SEC === '' ? PER_ROUND_PREPARATION : integer('CAT_PREP_SEC', 0) * 1000;
const flag = (name: string, fallback: boolean): boolean => {
  const raw = (env[name] ?? '').trim().toLowerCase();
  if (raw === '') return fallback;
  if (['1', 'true', 'on', 'yes'].includes(raw)) return true;
  if (['0', 'false', 'off', 'no'].includes(raw)) return false;
  throw new RangeError(`${name} must be 1/0, true/false, on/off or yes/no, got "${env[name]}"`);
};

const log = createJsonLogger({ level: parseLogLevel(env.CAT_LOG_LEVEL), write: line => process.stdout.write(`${line}\n`), now: () => new Date().toISOString() });
const port = integer('PORT', integer('CAT_PORT', 8787));
const host = env.CAT_HOST || '127.0.0.1';
const takeover = flag('CAT_TAKEOVER', BOT_DRIVER_DEFAULTS.takeover);
const queueTimeout = env.CAT_QUEUE_TIMEOUT_SEC ? seconds('CAT_QUEUE_TIMEOUT_SEC', 0) : null;
const sha = (env.CAT_GIT_SHA ?? '').trim() || 'unknown';
const heartbeatMs = seconds('CAT_HEARTBEAT_SEC', HEARTBEAT_DEFAULTS.intervalMs);
const heartbeat = heartbeatMs > 0 ? { intervalMs: heartbeatMs, timeoutMs: Math.round(heartbeatMs * 2.5) } : null;
const loopLagMs = seconds('CAT_LOOP_LAG_SEC', 10_000);
const watchdog = { stallMs: seconds('CAT_STALL_SEC', 120_000), abandonMs: seconds('CAT_ABANDON_SEC', 90_000) };
const faultRound = integer('CAT_FAULT_INJECT_ROUND', 0);
const carousel = flag('CAT_CAROUSEL', true);
// C6: battles leave only as compact replays; the per-tick frame transport and its switch are gone.
if (env.CAT_COMBAT_TRANSPORT && env.CAT_COMBAT_TRANSPORT !== 'replay') log('warn', 'config.ignored', { name: 'CAT_COMBAT_TRANSPORT', value: env.CAT_COMBAT_TRANSPORT, reason: 'battles are always sent as replay' });
const clock = new RealClock();

/** CAT_FAULT_INJECT_ROUND (test only): the first battle started in that round throws, once per process. */
function faultInjecting(inner: BattleResolver, round: number): BattleResolver {
  let armed = true;
  const trip = (battleRound: number, battleId: string) => {
    if (!armed || battleRound !== round) return;
    armed = false;
    log('warn', 'fault.injected', { round, battleId });
    throw new Error(`injected fault (CAT_FAULT_INJECT_ROUND=${round})`);
  };
  return {
    resolveBattle: (input, pool) => { trip(input.round, input.battleId); return inner.resolveBattle(input, pool); },
    ...(inner.startBattle ? { startBattle: (input, pool) => { trip(input.round, input.battleId); return inner.startBattle!(input, pool); } } satisfies Pick<BattleResolver, 'startBattle'> : {}),
  };
}
const seed = env.CAT_SEED === undefined || env.CAT_SEED === '' ? randomSeed() : Number(env.CAT_SEED);
if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
  throw new RangeError(`CAT_SEED must be a uint32 integer (0..4294967295), got "${env.CAT_SEED}"`);
}
log('info', 'config.seed', { seed, source: env.CAT_SEED ? 'CAT_SEED' : 'random' });
if (faultRound > 0) log('warn', 'config.fault-injection', { round: faultRound, msg: 'TEST ONLY: one battle of this round will throw' });

process.on('uncaughtException', error => { log('error', 'process.uncaught', { error: error.stack ?? error.message }); process.exit(1); });
process.on('unhandledRejection', reason => { log('error', 'process.unhandled-rejection', { error: reason instanceof Error ? reason.stack ?? reason.message : String(reason) }); process.exit(1); });

createGameServer({
  port, host, clock, seed,
  ...(faultRound > 0 ? { resolver: faultInjecting(new TwoSidedBattleResolver(), faultRound) } : {}),
  timings: {
    preparationMs,
    choiceMs: seconds('CAT_CHOICE_SEC', ROOM_TIMING_DEFAULTS.choiceMs),
    settlementMs: seconds('CAT_SETTLE_SEC', ROOM_TIMING_DEFAULTS.settlementMs),
  },
  queueTimeoutMs: queueTimeout,
  bots: { stepMs: integer('CAT_BOT_STEP_MS', BOT_DRIVER_DEFAULTS.stepMs) || BOT_DRIVER_DEFAULTS.stepMs, takeover, takeoverMs: seconds('CAT_TAKEOVER_SEC', BOT_DRIVER_DEFAULTS.takeoverMs) },
  logger: log, watchdog, heartbeat, loopLagReportMs: loopLagMs > 0 ? loopLagMs : null,
  ...(carousel ? { carousel: CAROUSEL_RULES_BINDING } : {}),
  build: { sha, contentDigest: CONTENT_DIGEST, lootReplayDigest: LOOT_REPLAY_DIGEST },
  processStats: () => ({ uptimeSec: Math.round(process.uptime()), rssBytes: process.memoryUsage.rss() }),
}).then(server => {
  // Install the signal handlers before announcing readiness: a supervisor may signal as soon as it reads the line.
  const shutdown = (signal: string) => { log('info', 'server.stopping', { signal }); server.close().then(() => { clock.dispose(); process.exit(0); }); };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  // `msg` keeps the "listening on" text the e2e harness and operators wait for.
  log('info', 'server.listening', { msg: `listening on ws://${host}:${server.port} (http://${host}:${server.port}/healthz)`, host, port: server.port, sha,
    contentDigest: CONTENT_DIGEST, lootReplayDigest: LOOT_REPLAY_DIGEST, prepSec: preparationMs === PER_ROUND_PREPARATION ? preparationMs : preparationMs / 1000,
    takeover, carousel, stallSec: watchdog.stallMs / 1000, heartbeatSec: heartbeatMs / 1000, abandonSec: watchdog.abandonMs / 1000 });
}).catch(error => { log('error', 'server.start-failed', { error: error instanceof Error ? error.stack ?? error.message : String(error) }); process.exit(1); });
