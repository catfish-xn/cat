/**
 * Measurement only (no thresholds, not a test): how much server CPU the battle replay re-execution and its comparison
 * against the rules' result ("战斗重演对照") cost per round of a typical 8-seat match.
 *
 * One Room with 8 bot seats on a ManualClock, the production resolver (TwoSidedBattleResolver), the carousel, the
 * default slice size (DEFAULT_SLICE_TICKS) and the same replay warm-up the network server runs (`startReplayWarmup`
 * for the seats that hold a connection). Every room-clock callback is timed; the resolver is wrapped so battle ticks
 * and replay ticks are timed apart. "Attended" seats get the push work the server does per connection
 * (`toCombatReplayFor` + JSON.stringify of the replay message). Results do not depend on the attended set (replays
 * never feed back into the room), so every mode plays the very same match.
 *
 * Run: npx esbuild tests/server/bench/replay-cpu.ts --bundle --platform=node --format=esm --packages=external \
 *        --outfile=dist-server/bench/replay-cpu.mjs && node dist-server/bench/replay-cpu.mjs --seeds 1,2,3 > report.json
 */
import { performance } from 'node:perf_hooks';
import { ManualClock, type Clock } from '../../../src/server/room/clock';
import { startBattleJob, type BattleJob, type BattleResolver } from '../../../src/server/room/battle-resolver';
import { TwoSidedBattleResolver } from '../../../src/server/room/two-sided-resolver';
import { Room, ROOM_TIMING_DEFAULTS } from '../../../src/server/room/room';
import { BotDriver } from '../../../src/server/room/bot-driver';
import { CAROUSEL_RULES_BINDING } from '../../../src/server/room/carousel';
import { startReplayWarmup, toCombatReplayFor } from '../../../src/server/room/projection';
import { DEFAULT_SLICE_TICKS } from '../../../src/server/net/server';
import type { BattleResult, RoomState, SeatSpec } from '../../../src/server/room/types';
import { stepCombat } from '../../../src/simulation/combat';
import { toCombatViewEvents, toCombatViewState } from '../../../src/simulation/combat-replay-view';
import { canonicalContent } from '../../../src/simulation/content';
import type { CombatState, LedgerCombatEvent } from '../../../src/simulation/combat-types';

interface RoundSample {
  round: number; roundId: string; kind: string; battles: number; combatTicks: number;
  totalMs: number; battleMs: number; replayMs: number; commitMs: number; pushMs: number;
  /** Measured outside the room, on the same battles: a bare stepCombat loop, and the comparison work alone. */
  resimMs: number; compareMs: number;
}
type Mode = { readonly name: string; readonly attended: (seats: readonly string[]) => readonly string[] };
const MODES: readonly Mode[] = [
  { name: 'none', attended: () => [] },
  { name: 'one', attended: seats => seats.slice(0, 1) },
  { name: 'all', attended: seats => seats },
];

function args(): { seeds: number[]; modes: string[]; warmup: number } {
  const argv = process.argv.slice(2);
  const get = (flag: string) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  return {
    seeds: (get('--seeds') ?? '1,2,3').split(',').map(Number),
    modes: (get('--modes') ?? MODES.map(mode => mode.name).join(',')).split(','),
    warmup: Number(get('--warmup') ?? '1'),
  };
}

function playMatch(seed: number, mode: Mode): RoundSample[] {
  const seats: SeatSpec[] = Array.from({ length: 8 }, (_, i) => ({ seatId: `bot-${i + 1}`, name: `机器人 ${i + 1}`, kind: 'bot' }));
  const attended = mode.attended(seats.map(seat => seat.seatId));
  const manual = new ManualClock();
  const samples = new Map<number, RoundSample>();
  let room: Room | null = null;
  const sample = (): RoundSample => {
    const state = room!.state;
    let entry: RoundSample | undefined = samples.get(state.round);
    if (!entry) samples.set(state.round, entry = { round: state.round, roundId: state.roundId ?? '', kind: state.roundKind ?? '', battles: 0, combatTicks: 0,
      totalMs: 0, battleMs: 0, replayMs: 0, commitMs: 0, pushMs: 0, resimMs: 0, compareMs: 0 });
    return entry!;
  };
  let pushPending: RoomState | null = null;
  const pushed = new Set<number>();
  const clock: Clock = {
    now: () => manual.now(),
    cancel: handle => manual.cancel(handle),
    schedule: (at, fn) => manual.schedule(at, () => {
      const target = sample(), started = performance.now();
      fn();
      target.totalMs += performance.now() - started;
      if (pushPending) {
        // The server's per-connection push of the battle: the cached replay (side B mirrored once) and its JSON frame.
        const state = pushPending; pushPending = null;
        const pushStart = performance.now();
        for (const seatId of attended) {
          const replay = toCombatReplayFor(state, seatId);
          if (replay) JSON.stringify({ type: 'replay', roomId: state.roomId, round: state.round, battleId: replay.battleId, replay: replay.replay, unitIds: replay.unitIds });
        }
        const spent = performance.now() - pushStart;
        target.pushMs += spent; target.totalMs += spent;
      }
    }),
  };
  // The network server's withReplayWarmup, with each part of a job timed.
  const inner = new TwoSidedBattleResolver();
  const resolver: BattleResolver = {
    resolveBattle: (input, pool) => inner.resolveBattle(input, pool),
    startBattle(input, pool): BattleJob {
      const job = startBattleJob(inner, input, pool);
      let finished: BattleResult | null = null, warmup: ReturnType<typeof startReplayWarmup> | null = null;
      return {
        advance(maxTicks) {
          const started = performance.now();
          try {
            if (finished) {
              warmup ??= startReplayWarmup(finished, attended);
              return warmup.advance(maxTicks) ? finished : null;
            }
            finished = job.advance(maxTicks);
            return null;
          } finally {
            const spent = performance.now() - started;
            if (finished && warmup) sample().replayMs += spent; else sample().battleMs += spent;
          }
        },
      };
    },
  };
  room = new Room(seats, { ...ROOM_TIMING_DEFAULTS, roomId: 'bench', seed, clock, resolver, sliceTicks: DEFAULT_SLICE_TICKS, carousel: CAROUSEL_RULES_BINDING, assertPoolConservation: false });
  const commit = room.commitSettlement.bind(room);
  room.commitSettlement = settlement => {
    const started = performance.now();
    try { return commit(settlement); } finally { sample().commitMs += performance.now() - started; }
  };
  const driver = new BotDriver(room, seed, {});
  room.subscribe(state => {
    if (state.phase === 'battle' && !pushed.has(state.round)) { pushed.add(state.round); if (attended.length) pushPending = state; }
  });
  let lastFrozenRound = -1;
  room.subscribe(state => {
    // Off-clock reference measurements, once per round, on the battles just resolved.
    if (state.phase !== 'battle' || lastFrozenRound === state.round) return;
    lastFrozenRound = state.round;
    const entry = sample();
    for (const battle of state.battles) {
      const combats = battle.kind === 'two-sided' ? [battle.battle] : battle.outcomes.flatMap(outcome => outcome.combat ? [outcome.combat] : []);
      for (const combat of combats) { entry.battles++; entry.combatTicks += combat.terminal.tick; }
    }
    if (attended.length === 0) return;
    for (const battle of state.battles) {
      if (!(battle.kind === 'two-sided' ? battle.participants : battle.outcomes.map(o => o.seatId)).some(id => attended.includes(id))) continue;
      const combats = battle.kind === 'two-sided' ? [battle.battle] : battle.outcomes.filter(o => attended.includes(o.seatId) && o.combat).map(o => o.combat!);
      for (const combat of combats) {
        // Not counted in totalMs: these run outside the clock callbacks.
        let t = performance.now();
        let current: CombatState = structuredClone(combat.initial) as CombatState;
        while (current.status === 'running' && current.tick < combat.terminal.tick) current = stepCombat(current).state;
        entry.resimMs += performance.now() - t;
        t = performance.now();
        const events = toCombatViewEvents(combat.events as readonly LedgerCombatEvent[]);
        // startCombatReplay compares each produced event with the expected one (both canonicalized) and the last view with the terminal.
        for (const event of events) { canonicalContent(event); canonicalContent(event); }
        canonicalContent(toCombatViewState(combat.terminal as CombatState)); canonicalContent(toCombatViewState(combat.terminal as CombatState));
        entry.compareMs += performance.now() - t;
      }
    }
  });
  room.start();
  for (let fired = 0; room.state.phase !== 'ended' && fired < 200_000; fired++) if (!manual.runNext()) break;
  if (room.state.phase !== 'ended' || room.state.fault) throw new Error(`match did not end cleanly: ${room.state.phase} ${JSON.stringify(room.state.fault)}`);
  driver.dispose(); room.dispose();
  return [...samples.values()].sort((a, b) => a.round - b.round);
}

/** Stage of a round: the x of "x-y"; the overtime rounds (ordinal 39+) as stage 7. */
const stageOf = (sample: RoundSample) => sample.round >= 39 ? '7（加时）' : sample.roundId.split('-')[0]!;
interface Totals { rounds: number; battles: number; ticks: number; total: number; settle: number; replay: number; push: number; resim: number; compare: number }
function totals(rounds: readonly RoundSample[]): Totals {
  const t: Totals = { rounds: 0, battles: 0, ticks: 0, total: 0, settle: 0, replay: 0, push: 0, resim: 0, compare: 0 };
  for (const r of rounds) {
    t.rounds++; t.battles += r.battles; t.ticks += r.combatTicks; t.total += r.totalMs; t.replay += r.replayMs; t.push += r.pushMs;
    // Settlement = resolving the frozen round (battle ticks), the replay warm-up, the per-connection replay push and the commit.
    t.settle += r.battleMs + r.replayMs + r.pushMs + r.commitMs; t.resim += r.resimMs; t.compare += r.compareMs;
  }
  return t;
}
const pct = (part: number, whole: number) => whole > 0 ? `${(100 * part / whole).toFixed(1)}%` : '—';
function markdown(runs: readonly { mode: string; rounds: RoundSample[] }[]): string {
  const stages = [...new Set(runs.flatMap(run => run.rounds.map(stageOf)))].sort();
  const by = (mode: string, stage: string | null) => totals(runs.filter(run => run.mode === mode).flatMap(run => run.rounds.filter(r => stage === null || stageOf(r) === stage)));
  const lines = ['| 阶段 | 轮数 | 场数 | 无观战 结算/整轮 ms | 1 人观战 重演占结算 | 占整轮 | 8 人观战 重演占结算 | 占整轮 | 8 人: 重跑/比对/其余 占重演 |', '|---|---|---|---|---|---|---|---|---|'];
  for (const stage of [...stages, null]) {
    const none = by('none', stage), one = by('one', stage), all = by('all', stage);
    const replayAll = all.replay + all.push;
    lines.push(`| ${stage ?? '全局'} | ${none.rounds} | ${none.battles} | ${none.settle.toFixed(0)} / ${none.total.toFixed(0)} | ${pct(one.replay + one.push, one.settle)} | ${pct(one.replay + one.push, one.total)} | ${pct(replayAll, all.settle)} | ${pct(replayAll, all.total)} | ${pct(all.resim, all.replay)} / ${pct(all.compare, all.replay)} / ${pct(Math.max(0, all.replay - all.resim - all.compare), all.replay)} |`);
  }
  return lines.join('\n');
}

const { seeds, modes, warmup } = args();
for (let i = 0; i < warmup; i++) playMatch(seeds[0]!, MODES[2]!);
const runs: { seed: number; mode: string; rounds: RoundSample[] }[] = [];
for (const seed of seeds) for (const mode of MODES.filter(m => modes.includes(m.name))) {
  process.stderr.write(`seed ${seed} mode ${mode.name}\n`);
  runs.push({ seed, mode: mode.name, rounds: playMatch(seed, mode) });
}
process.stderr.write(markdown(runs) + '\n');
process.stdout.write(JSON.stringify({ node: process.version, sliceTicks: DEFAULT_SLICE_TICKS, seeds, runs }, null, 1) + '\n');
