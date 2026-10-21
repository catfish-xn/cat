import { describe, expect, it } from 'vitest';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toCombatReplayFor } from '../../src/server/room/projection';
import type { BattleInput, BattleResult } from '../../src/server/room/types';
import { runUntil, SEATS, TIMINGS } from './helpers';
import { openMatchCombatStream, stepMatchCombatStream, startMatchCombat, stepMatch, createMatch, deployMatchUnit } from '../../src/simulation/match';
import { serializeMatch, restoreMatch } from '../../src/simulation/serialization';

const json = (value: unknown) => JSON.stringify(value);
function fixture(seed: number, sliceTicks = 8) {
  const clock = new ManualClock();
  const resolver = new TwoSidedBattleResolver();
  const room = new Room(SEATS.map(s => ({ ...s, kind: 'human' })), { ...ROOM_TIMING_DEFAULTS, ...TIMINGS,
    roomId: 'stream-test', seed, clock, resolver, combatStreaming: true, sliceTicks, sliceMs: 20 });
  room.start(); return { clock, room, resolver };
}

describe('B phase 1 first-pass stream', () => {
  for (const seed of [7, 42, 991]) it(`8 seats seed ${seed}: old full battles, ledgers, damage and replay bytes equal`, () => {
    const { room, clock, resolver } = fixture(seed, 2);
    for (let round = 1; round <= 5; round++) {
      runUntil(room, clock, s => s.round === round && s.phase === 'battle', 20_000);
      const inputs = (room as unknown as { frozenInputs: readonly BattleInput[] }).frozenInputs;
      const expected: BattleResult[] = [];
      let pool = room.state.pool;
      for (const input of inputs) {
        const result = resolver.resolveBattle(input, pool); expected.push(result);
        if (result.kind === 'placeholder' && result.pool) pool = result.pool;
      }
      // Opening exists before any tick, no pre-simulated results or settlement barrier.
      expect(room.combatStreamFor('s0')!.ticks).toHaveLength(1);
      expect(room.state.battles).toHaveLength(0);
      expect(room.retained.pendingSettlement).toBe(false);
      runUntil(room, clock, s => s.round === round && s.battles.length > 0, 20_000);
      expect(room.state.fault).toBeNull();
      for (const result of room.state.battles) {
        const old = expected.find(r => r.battleId === result.battleId)!;
        expect(result.kind).toBe(old.kind);
        if (result.kind === 'two-sided' && old.kind === 'two-sided') {
          expect(json(result.battle)).toBe(json(old.battle)); expect(json(result.proposals)).toBe(json(old.proposals));
        } else if (result.kind === 'placeholder' && old.kind === 'placeholder') {
          for (const outcome of result.outcomes) {
            const previous = old.outcomes.find(o => o.seatId === outcome.seatId)!;
            expect(json(outcome.combat)).toBe(json(previous.combat));
            expect(outcome.damage).toBe(previous.damage); expect(outcome.result).toBe(previous.result);
            expect(json(outcome.state.roundResults)).toBe(json(previous.state.roundResults));
          }
        }
      }
      for (const seat of room.state.seats) {
        const stream = room.combatStreamFor(seat.seatId)!;
        const replay = toCombatReplayFor(room.state, seat.seatId)!;
        expect(json({ initial: stream.initial, ticks: stream.ticks, terminal: stream.terminal })).toBe(json(replay.replay));
        expect(stream.ticks.map(t => t.tick)).toEqual(Array.from({ length: stream.ticks.length }, (_, i) => i));
      }
      const count = room.state.settlements.length;
      runUntil(room, clock, s => s.settlements.length > count, 20_000);
      expect(room.state.settlements).toHaveLength(count + 1);
    }
    room.dispose(); expect(room.retained.timers).toBe(0);
  }, 120_000);

  it('an unfinished PvE prefix restores and resumes without duplicating a tick or a settlement', () => {
    const initial = createMatch(42);
    const source = deployMatchUnit(initial, initial.preparation.units[0]!.id, { kind: 'board', cell: { col: 3, row: 6 } }); if (!source.ok) throw Error(source.reason);
    const open = openMatchCombatStream(source.state); if (!open.ok) throw Error(open.reason);
    let state = open.state;
    for (let i = 0; i < 4; i++) state = stepMatchCombatStream(state).state;
    const restored = restoreMatch(serializeMatch(state));
    const run = (start: typeof state) => {
      let current = start; const events = [];
      for (;;) { const next = stepMatchCombatStream(current); events.push(...next.events); if (next.terminal) return { terminal: next.terminal, events }; current = next.state; }
    };
    expect(run(restored)).toEqual(run(state));
    let full = startMatchCombat(source.state); if (!full.ok) throw Error(full.reason);
    while (full.state.phase === 'combat') full = { ok: true, ...stepMatch(full.state) };
    expect(run(restored).terminal).toEqual(full.state.combat);
  });

  it('no battle crosses the next boundary until all battles complete the current tick', () => {
    const { room, clock } = fixture(42, 1);
    runUntil(room, clock, s => s.phase === 'battle');
    const first = room.combatStreamFor('s0')!;
    clock.advance(49); expect(room.combatStreamFor('s0')!.ticks.length).toBe(first.ticks.length);
    clock.advance(1);
    const ticks = room.state.seats.map(s => room.combatStreamFor(s.seatId)!.ticks.at(-1)!.tick);
    expect(new Set(ticks)).toEqual(new Set([1]));
    const operation = room.handle('s0', { type: 'reroll' });
    if (!operation.ok) expect(operation.reason).not.toBe('wrong-phase');
    room.dispose();
  });
});

it('a stream exhausting its tick limit faults instead of fabricating a terminal or rewarding a seat', async () => {
  const { CombatStream } = await import('../../src/server/room/combat-stream');
  const { room, clock } = fixture(42);
  runUntil(room, clock, s => s.round === 5 && s.phase === 'battle', 20_000);
  const input = (room as unknown as { frozenInputs: readonly BattleInput[] }).frozenInputs[0]!;
  const stream = new CombatStream({ ...input, maxSteps: 1 });
  expect(() => stream.advancePvp()).toThrow('step-limit-exceeded');
  expect(stream.result).toBeNull(); expect(stream.done).toBe(false);
  expect(room.state.settlements).toHaveLength(4); room.dispose();
}, 60_000);

it('the 20ms budget yields inside a boundary and seals later input for the following tick', async () => {
  const { vi } = await import('vitest');
  const { CombatStream } = await import('../../src/server/room/combat-stream');
  const clock = new ManualClock(); let workMs = 0;
  const wallClock = { now: () => clock.now() + workMs, schedule: (at: number, fn: () => void) => clock.schedule(at - workMs, fn), cancel: (id: number) => clock.cancel(id) };
  const room = new Room(SEATS.map(s => ({ ...s, kind: 'human' })), { ...ROOM_TIMING_DEFAULTS, ...TIMINGS,
    roomId: 'budget', seed: 42, clock: wallClock, resolver: new TwoSidedBattleResolver(), combatStreaming: true, sliceTicks: 100, sliceMs: 20 });
  room.start(); clock.fireNext();
  expect(room.state.phase).toBe('battle');
  const original = CombatStream.prototype.advancePve;
  const spy = vi.spyOn(CombatStream.prototype, 'advancePve').mockImplementation(function (this: InstanceType<typeof CombatStream>, state) {
    const result = original.call(this, state); workMs += 11; return result;
  });
  try {
    clock.fireNext();
    const ticks = room.state.seats.map(s => room.combatStreamFor(s.seatId)!.ticks.at(-1)!.tick);
    expect(ticks).toEqual([1, 1, 0, 0, 0, 0, 0, 0]);
    expect(room.committedBattleTick).toBe(0); expect(room.nextBattleInputTick).toBe(2);
    for (let i = 0; i < 3; i++) clock.fireNext();
    expect(room.state.seats.map(s => room.combatStreamFor(s.seatId)!.ticks.at(-1)!.tick)).toEqual(Array(8).fill(1));
    expect(room.committedBattleTick).toBe(1);
  } finally { spy.mockRestore(); room.dispose(); }
});
it('D11 gold samples feed the same first-pass task and remain replayable', async () => {
  const { startCombatReplay } = await import('../../src/server-entry');
  const { room, clock } = fixture(42);
  runUntil(room, clock, s => s.round === 5 && s.phase === 'preparation', 20_000);
  const seam = room as unknown as { current: typeof room.state };
  seam.current = { ...seam.current, seats: seam.current.seats.map(s => s.seatId !== 's0' ? s : { ...s,
    match: { ...s.match, anomalyBinding: { definitionId: 'avarice-incarnate', unitId: s.match.preparation.units.find(u => u.location.kind === 'board')!.id,
      choiceId: 'live-test', boundRound: s.match.round } } }) };
  runUntil(room, clock, s => s.round === 5 && s.phase === 'battle', 20_000);
  clock.advance(100);
  const tick = room.combatStreamFor('s0')!.ticks.at(-1)!.tick;
  expect(room.handle('s0', { type: 'buyXp' })).toMatchObject({ ok: true });
  const gold = room.state.seats[0]!.match.gold;
  runUntil(room, clock, s => s.battles.length > 0, 20_000);
  const battle = room.state.battles.find(b => b.kind === 'two-sided' && b.participants.includes('s0'))!;
  if (battle.kind !== 'two-sided') throw Error('battle');
  expect(battle.battle.bankSamples).toContainEqual({ tick, team: battle.battle.a.seatId === 's0' ? 'player' : 'enemy', liveGold: gold });
  const replay = startCombatReplay(battle.battle).advance(1201)!;
  const stream = room.combatStreamFor(battle.battle.a.seatId)!;
  expect(json({ initial: stream.initial, ticks: stream.ticks, terminal: stream.terminal })).toBe(json(replay));
  room.dispose();
}, 60_000);

it('absolute boundaries include compute time and cap immediate catch-up at two ticks', async () => {
  const { vi } = await import('vitest');
  const { CombatStream } = await import('../../src/server/room/combat-stream');
  const clock = new ManualClock(); let workMs = 0;
  const scheduled: number[] = [], starts: number[] = [];
  const wallClock = { now: () => clock.now() + workMs,
    schedule: (at: number, fn: () => void) => { scheduled.push(at); return clock.schedule(at - workMs, fn); }, cancel: (id: number) => clock.cancel(id) };
  const room = new Room(SEATS.map(s => ({ ...s, kind: 'human' })), { ...ROOM_TIMING_DEFAULTS, ...TIMINGS,
    roomId: 'absolute', seed: 42, clock: wallClock, resolver: new TwoSidedBattleResolver(), combatStreaming: true, sliceTicks: 8, sliceMs: 20 });
  room.start(); clock.fireNext();
  const started = wallClock.now(), original = CombatStream.prototype.advancePve;
  const spy = vi.spyOn(CombatStream.prototype, 'advancePve').mockImplementation(function (this: InstanceType<typeof CombatStream>, state) {
    if (this.envelope.seats[0]!.seatId === 's0') starts.push(wallClock.now());
    const result = original.call(this, state); workMs++; return result;
  });
  try {
    for (let i = 0; i < 10; i++) clock.fireNext();
    expect(starts).toEqual(Array.from({ length: 10 }, (_, i) => started + (i + 1) * 50));
    // Event-loop stall: one overdue callback, two catch-up boundaries, then a timed yield.
    workMs += 1_000;
    for (let i = 0; i < 3; i++) clock.fireNext();
    expect(scheduled.at(-1)).toBe(wallClock.now() + 50);
    expect(room.committedBattleTick).toBe(13);
  } finally { spy.mockRestore(); room.dispose(); }
});

it('reuses a terminal settlement plan, and replans only when a tail operation changes its basis', async () => {
  const { vi } = await import('vitest');
  for (const change of [false, true]) {
    const { room, clock } = fixture(42);
    const seam = room as unknown as { planStreamSettlement: () => unknown };
    const spy = vi.spyOn(seam, 'planStreamSettlement');
    try {
      runUntil(room, clock, s => s.battles.length > 0, 20_000);
      expect(spy).toHaveBeenCalledTimes(1);
      if (change) expect(room.handle('s0', { type: 'shopLock', locked: true, generation: room.state.seats[0]!.match.shop!.generation })).toMatchObject({ ok: true });
      clock.advance(800);
      expect(room.state.fault).toBeNull(); expect(room.state.settlements).toHaveLength(1);
      expect(spy).toHaveBeenCalledTimes(change ? 2 : 1);
    } finally { spy.mockRestore(); room.dispose(); }
  }
}, 60_000);
