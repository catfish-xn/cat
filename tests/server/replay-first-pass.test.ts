/**
 * First-pass replay capture (MULTIPLAYER_CONTRACT first-pass supplement) and the server's background spot check
 * (user decision 2026-10-19): pushed replays are the frames recorded on the battle's own run, byte-identical to the
 * re-executed replay; a round re-runs one captured battle, a mismatch is logged and the room's later rounds are
 * checked in full. Settlement never depends on either.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PlaceholderBattleResolver, startBattleJob, type BattleJob, type BattleResolver } from '../../src/server/room/battle-resolver';
import { mirrorCombatReplay, primeCombatReplay, startReplaySpotCheck, toCombatReplayFor } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toCombatReplay } from '../../src/server-entry';
import { DEFAULT_BATTLE_MAX_STEPS, type BattleInput, type BattleResult, type RoomState } from '../../src/server/room/types';
import { answerOpenChoices, makeRoom, runUntil } from './helpers';
import { SPOT_CHECK_EVERY_ROUNDS } from '../../src/server/net/server';
import { seatTwo, startServer, type NetHarness } from './net/helpers';

const capturing = (capture: (seatIds: readonly string[]) => boolean = () => true) =>
  new TwoSidedBattleResolver(new PlaceholderBattleResolver({ captureReplay: capture }), { captureReplay: capture });

/** Every pushable (battle, seat) of a published round with the replay a re-execution would build for it. */
function expectedReplays(state: RoomState) {
  return state.battles.flatMap(battle => {
    if (battle.kind === 'two-sided') {
      const rerun = toCombatReplay(battle.battle);
      return [{ seatId: battle.battle.a.seatId, replay: rerun }, ...(battle.battle.b.seatId ? [{ seatId: battle.battle.b.seatId, replay: mirrorCombatReplay(rerun) }] : [])]
        .filter(entry => battle.participants.includes(entry.seatId));
    }
    return battle.outcomes.flatMap(outcome => outcome.combat ? [{ seatId: outcome.seatId, replay: toCombatReplay(outcome.combat) }] : []);
  });
}
const battlePhaseOf = (round: number) => (state: RoomState) => state.round === round && state.phase === 'battle';

describe('first-pass replay capture', () => {
  // Real lineups frozen at the first PvP round (2-1) of an idle placeholder room, built once outside the case timeouts.
  const idle = makeRoom(new PlaceholderBattleResolver());
  idle.room.start();
  runUntil(idle.room, idle.clock, state => state.round === 4 && state.phase === 'preparation');
  answerOpenChoices(idle.room); // v22: the 2-1 augment choice opens inside the preparation
  const seats = idle.room.state.seats;
  const pool = idle.room.state.pool;

  it('pushes the recorded frames of a PvE round, byte-identical to the re-executed replay', () => {
    const { room, clock } = makeRoom(capturing());
    room.start();
    const state = runUntil(room, clock, battlePhaseOf(1));
    const expected = expectedReplays(state);
    expect(expected.length).toBeGreaterThan(0);
    for (const { seatId, replay } of expected) expect(JSON.stringify(toCombatReplayFor(state, seatId)!.replay)).toBe(JSON.stringify(replay));
    // Captured, so the spot check has something to re-run this round.
    expect(startReplaySpotCheck(state.battles, state.round, false)).not.toBeNull();
  });

  it('pushes both sides of a PvP battle from the recorded frames (side B mirrored), byte-identical to the re-run', () => {
    const seat = (index: number) => ({ seatId: seats[index]!.seatId, state: seats[index]!.match });
    const input: BattleInput = { battleId: 'test-room:r4:b01', roomId: 'test-room', round: 4, roundId: '2-1', roundKind: 'pvp', roomRevision: 10, battleSeed: 0x1234_5678,
      maxSteps: DEFAULT_BATTLE_MAX_STEPS, seats: [seat(0), seat(1)], mirrorOf: null };
    const job = capturing().startBattle(input, pool);
    let result: BattleResult | null = null;
    while (!result) result = job.advance(50);
    const state = { battles: [result] } as unknown as RoomState;
    for (const { seatId, replay } of expectedReplays(state)) expect(JSON.stringify(toCombatReplayFor(state, seatId)!.replay)).toBe(JSON.stringify(replay));
    expect(startReplaySpotCheck(state.battles, 4, false)).not.toBeNull();
  });

  it('records nothing for battles the capture rule rejects (they stay re-run on demand as before)', () => {
    const { room, clock } = makeRoom(capturing(() => false));
    room.start();
    const state = runUntil(room, clock, battlePhaseOf(1));
    expect(startReplaySpotCheck(state.battles, state.round, true)).toBeNull();
    for (const { seatId, replay } of expectedReplays(state)) expect(JSON.stringify(toCombatReplayFor(state, seatId)!.replay)).toBe(JSON.stringify(replay));
  });
});

describe('replay spot check', () => {
  function roundOne() {
    const { room, clock } = makeRoom(capturing());
    room.start();
    return runUntil(room, clock, battlePhaseOf(1));
  }
  const run = (state: RoomState, all: boolean) => {
    const check = startReplaySpotCheck(state.battles, state.round, all, state.battleSeeds)!;
    for (let slices = 0; slices < 10_000; slices++) { const results = check.advance(7); if (results) return results; }
    throw new Error('spot check never finished');
  };

  it('re-runs one captured battle per round in rotation, or all of them, and finds them equal', () => {
    const state = roundOne();
    const outcomes = state.battles.flatMap(battle => battle.kind === 'placeholder' ? battle.outcomes.filter(o => o.combat) : []);
    const one = run(state, false);
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ seatIds: [outcomes[state.round % outcomes.length]!.seatId], firstDifference: null });
    const all = run(state, true);
    expect(all.map(result => result.seatIds[0])).toEqual(outcomes.map(outcome => outcome.seatId));
    expect(all.every(result => result.firstDifference === null)).toBe(true);
  });

  it('names the first differing frame when the pushed frames disagree with the re-run', () => {
    const state = roundOne();
    const battle = state.battles.find((candidate): candidate is Extract<BattleResult, { kind: 'placeholder' }> => candidate.kind === 'placeholder' && candidate.outcomes.some(o => o.combat))!;
    const outcome = battle.outcomes.find(o => o.combat)!;
    const replay = toCombatReplay(outcome.combat!);
    const tick = replay.ticks.length - 1;
    primeCombatReplay(outcome, { ...replay, ticks: replay.ticks.map((frame, index) => index === tick ? { ...frame, events: [] } : frame) });
    const results = run(state, true);
    const tampered = results.find(result => result.seatIds[0] === outcome.seatId)!;
    expect(tampered.firstDifference).toBe(`tick ${replay.ticks[tick]!.tick}`);
    expect(results.filter(result => result !== tampered).every(result => result.firstDifference === null)).toBe(true);
  });
});

describe('game server: spot check', () => {
  let harness: NetHarness | null = null;
  afterEach(async () => { await harness?.close(); harness = null; });

  /** Pushes a wrong replay for every round-1 battle: the check must log it, settle the round anyway and audit all of round 2. */
  class TamperRoundOne implements BattleResolver {
    private readonly inner = capturing();
    resolveBattle(): BattleResult { throw new Error('sliced only'); }
    startBattle(input: Parameters<BattleResolver['resolveBattle']>[0], pool: Parameters<BattleResolver['resolveBattle']>[1]): BattleJob {
      const job = startBattleJob(this.inner, input, pool);
      return { advance: ticks => {
        const result = job.advance(ticks);
        if (result?.kind === 'placeholder' && result.round === 1) for (const outcome of result.outcomes) {
          if (!outcome.combat) continue;
          const replay = toCombatReplay(outcome.combat);
          primeCombatReplay(outcome, { ...replay, terminal: { ...replay.terminal, tick: replay.terminal.tick + 1 } });
        }
        return result;
      } };
    }
  }

  it('logs a mismatch with its battle, seed and first difference, keeps settling, and checks every later battle', async () => {
    const records: { level: string; event: string; fields: Record<string, unknown> }[] = [];
    harness = await startServer({ logger: (level, event, fields = {}) => records.push({ level, event, fields }) }, new TamperRoundOne());
    await seatTwo(harness);
    const room = harness.server.room!;
    for (let guard = 0; guard < 5_000 && !(room.state.round >= 3 && room.state.phase === 'preparation'); guard++) harness.clock.runNext();
    expect(room.state.fault).toBeNull();
    expect(room.state.settlements).toEqual(expect.arrayContaining(['net-room:round-1', 'net-room:round-2']));
    const failed = records.filter(record => record.event === 'replay.spot-check-failed');
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ level: 'error', fields: { roomId: 'net-room', round: 1, firstDifference: 'terminal' } });
    expect(failed[0]!.fields).toHaveProperty('battleSeed');
    expect(failed[0]!.fields).toHaveProperty('seats');
    const roundTwo = records.filter(record => record.event === 'replay.spot-check' && record.fields.round === 2);
    expect(roundTwo.length).toBeGreaterThan(1);
    // 临时、用户 10-20 批准：只因 CI 机器计时超时（断言都过），按约 2 倍放宽；断言不变。5 秒 → 10 秒（CI 上超时 2 次）。
  }, 10_000);

  it('checks every Nth round that captured a battle (the 1st, N+1th …), one battle each, and nothing in between', async () => {
    // The production cadence is SPOT_CHECK_EVERY_ROUNDS; a cadence of 2 shows the same counting in fewer rounds.
    expect(SPOT_CHECK_EVERY_ROUNDS).toBe(4);
    const records: { event: string; fields: Record<string, unknown> }[] = [];
    harness = await startServer({ spotCheckEveryRounds: 2, logger: (_level, event, fields = {}) => records.push({ event, fields }) }, capturing());
    await seatTwo(harness);
    const room = harness.server.room!;
    const battleRounds: number[] = [];
    room.subscribe(state => { if (state.phase === 'battle' && state.battles.length && battleRounds.at(-1) !== state.round) battleRounds.push(state.round); });
    for (let guard = 0; guard < 5_000 && !(battleRounds.length >= 3 && room.state.phase === 'preparation'); guard++) harness.clock.runNext();
    expect(room.state.fault).toBeNull();
    const checked = records.filter(record => record.event === 'replay.spot-check').map(record => record.fields.round);
    expect(checked).toEqual([battleRounds[0], battleRounds[2]]);
    expect(records.some(record => record.event === 'replay.spot-check-failed')).toBe(false);
    // Temporary timing-only allowance (user-approved rule 2026-10-20: about 2x the measured time): ~3.5 s locally under
    // load, over the 5 s default twice on CI after the v17 orb combinations; no assertion is relaxed.
  }, 12_000);
});
