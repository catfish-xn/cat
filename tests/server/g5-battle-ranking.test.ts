/**
 * G5: the post-battle ranking and the review cursor read a real room battle's compact replay (contract §14.2).
 * Display only: the ranking adds up the events' own numbers; the cursor ends exactly on the terminal view.
 */
import { describe, expect, it } from 'vitest';
import { toCombatReplayFor } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoomState, TwoSidedBattleResult } from '../../src/server/room/types';
import { rankBattle, replayEvents, sortRanking } from '../../src/presentation/battle-ranking';
import { ReplayCursor } from '../../src/presentation/replay-cursor';
import { RemoteSession } from '../../src/rendering/online/remote-session';
import type { GameClient } from '../../src/rendering/online/protocol';
import { COMBAT_TICK_MS } from '../../src/simulation/combat';
import { makeRoom, runUntil } from './helpers';

let cache: { state: RoomState; pvp: TwoSidedBattleResult } | null = null;
function battle() {
  if (cache) return cache;
  const { room, clock } = makeRoom(new TwoSidedBattleResolver());
  room.start();
  const state = runUntil(room, clock, current => current.phase === 'battle' && current.battles.some(entry => entry.kind === 'two-sided' && entry.participants.length === 2), 600);
  const pvp = state.battles.find((entry): entry is TwoSidedBattleResult => entry.kind === 'two-sided' && entry.participants.length === 2)!;
  cache = { state, pvp };
  return cache;
}

describe('G5 battle ranking', () => {
  it('has one row per unit of both sides and sums the events exactly once', () => {
    const { state, pvp } = battle();
    const { replay } = toCombatReplayFor(state, pvp.battle.a.seatId)!;
    const ranking = rankBattle(replay);
    expect(ranking.rows.map(row => row.unitId)).toEqual(replay.initial.units.map(unit => unit.id));
    expect(new Set(ranking.rows.map(row => row.team))).toEqual(new Set(['player', 'enemy']));
    const events = replayEvents(replay), damage = events.filter(event => event.type === 'packetDamage');
    const sum = (key: 'damageDealt' | 'damageTaken' | 'healingReceived' | 'shieldAbsorbed') => ranking.rows.reduce((total, row) => total + row[key], 0);
    const hp = damage.reduce((total, event) => total + event.hpDamage, 0);
    expect(hp).toBeGreaterThan(0);
    expect(sum('damageDealt')).toBe(hp);
    expect(sum('damageTaken')).toBe(hp);
    expect(sum('shieldAbsorbed')).toBe(damage.reduce((total, event) => total + event.absorbed, 0));
    expect(sum('healingReceived')).toBe(events.reduce((total, event) => total + (event.type === 'heal' ? event.actual : 0), 0));
    // Terminal liveness comes from the replay's terminal view.
    for (const row of ranking.rows) expect(row.alive).toBe(replay.terminal.units.find(unit => unit.id === row.unitId)!.alive);
    expect(ranking.result).toBe(replay.terminal.result);
  });
  it('mirrors for the other seat: the same totals with the sides swapped', () => {
    const { state, pvp } = battle();
    const a = rankBattle(toCombatReplayFor(state, pvp.battle.a.seatId)!.replay), b = rankBattle(toCombatReplayFor(state, pvp.battle.b.seatId)!.replay);
    const total = (rows: typeof a.rows, team: 'player' | 'enemy') => rows.filter(row => row.team === team).reduce((sum, row) => sum + row.damageDealt, 0);
    expect(total(a.rows, 'player')).toBe(total(b.rows, 'enemy'));
    expect(total(a.rows, 'enemy')).toBe(total(b.rows, 'player'));
  });
  it('sorts by a metric, highest first, ties in replay order', () => {
    const { state, pvp } = battle();
    const rows = rankBattle(toCombatReplayFor(state, pvp.battle.a.seatId)!.replay).rows;
    for (const metric of ['damageDealt', 'damageTaken', 'healingReceived'] as const) {
      const sorted = sortRanking(rows, metric);
      expect(sorted).toHaveLength(rows.length);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i - 1]![metric]).toBeGreaterThanOrEqual(sorted[i]![metric]);
        if (sorted[i - 1]![metric] === sorted[i]![metric]) expect(rows.indexOf(sorted[i - 1]!)).toBeLessThan(rows.indexOf(sorted[i]!));
      }
    }
  });
});

describe('G5 review cursor', () => {
  it('plays to the terminal view at tick pace and replays every event once', () => {
    const { state, pvp } = battle();
    const { replay } = toCombatReplayFor(state, pvp.battle.a.seatId)!;
    const cursor = new ReplayCursor(replay);
    expect(cursor.view).toBe(replay.initial);
    for (let guard = 0; !cursor.ended && guard < 2_000; guard++) cursor.advance(COMBAT_TICK_MS);
    expect(cursor.view).toEqual(replay.terminal);
    expect(cursor.events).toEqual(replayEvents(replay));
    expect(cursor.playing).toBe(false);
  });
  it('seeks to any tick with the same view as playing there, and speed multiplies pace', () => {
    const { state, pvp } = battle();
    const { replay } = toCombatReplayFor(state, pvp.battle.a.seatId)!;
    const played = new ReplayCursor(replay), views = new Map<number, unknown>();
    for (let guard = 0; !played.ended && guard < 2_000; guard++) { played.advance(COMBAT_TICK_MS); views.set(played.tick, played.view); }
    const end = replay.terminal.tick;
    for (const tick of [0, 1, 19, 20, 21, Math.floor(end / 2), end - 1, end]) {
      const cursor = new ReplayCursor(replay); cursor.seek(tick);
      expect(cursor.tick).toBe(tick);
      expect(cursor.view).toEqual(views.get(tick));
      expect(cursor.events).toEqual(replay.ticks.filter(frame => frame.tick <= tick).flatMap(frame => frame.events));
    }
    const fast = new ReplayCursor(replay); fast.speed = 4; fast.advance(COMBAT_TICK_MS);
    expect(fast.tick).toBe(replay.ticks[3]!.tick);
    // Pause holds; toggling at the end restarts from the initial view.
    fast.toggle(); expect(fast.advance(1_000)).toBe(false);
    fast.seek(end); fast.toggle(); expect(fast.view).toBe(replay.initial); expect(fast.playing).toBe(true);
  });
});

describe('G5 RemoteSession keeps the last battle', () => {
  const client: GameClient = { transport: 'local-room', listen: () => () => {}, joinQueue: () => {}, leaveQueue: () => {}, startMatch: () => {},
    send: () => ({ ok: 'pending', commandId: 0 }), reset: () => {}, dispose: () => {} };
  it('outlives the settlement push that takes the battle off the board, until forgotten', () => {
    const { state, pvp } = battle();
    const { replay, unitIds } = toCombatReplayFor(state, pvp.battle.a.seatId)!;
    const session = new RemoteSession(client, undefined, () => 0);
    const round = session.state.round;
    session.receiveReplay(replay, unitIds);
    expect(session.lastBattle).toMatchObject({ round, replay });
    session.receiveState({ ...session.state, phase: 'settlement', round } as typeof session.state);
    expect(session.inBattle).toBe(false);
    expect(session.lastBattle?.replay).toBe(replay);
    session.forgetBattle();
    expect(session.lastBattle).toBeNull();
  });
});
