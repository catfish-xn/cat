/**
 * G5: the post-battle ranking reads a real room battle's compact replay (contract §14.2) and adds the events' own
 * numbers up: damage = HP damage + shield absorbed (TFT's damage chart), healing = healing received. The match
 * totals add every battle's rows up by team, definition and star level. Display only.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { toCombatReplayFor } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoomState, TwoSidedBattleResult } from '../../src/server/room/types';
import { accumulateRankings, matchRankKey, rankBattle, replayEvents, sortRanking, type BattleRanking, type RankTotals } from '../../src/presentation/battle-ranking';
import { RemoteSession } from '../../src/rendering/online/remote-session';
import type { GameClient } from '../../src/rendering/online/protocol';
import type { CombatReplay } from '../../src/server-entry';
import { makeRoom, runUntil } from './helpers';

let cache: { state: RoomState; pvp: TwoSidedBattleResult; pve: CombatReplay[] } | null = null;
/** One room up to its first real PvP battle, with my seat's PvE replays of the rounds before it. */
function battles() {
  if (cache) return cache;
  const { room, clock } = makeRoom(new TwoSidedBattleResolver());
  room.start();
  const pve: CombatReplay[] = [];
  let seen = -1;
  const state = runUntil(room, clock, current => {
    if (current.phase === 'battle' && current.roundKind === 'pve' && current.round !== seen) {
      const replay = toCombatReplayFor(current, 's0')?.replay; if (replay) { pve.push(replay); seen = current.round; }
    }
    return current.phase === 'battle' && current.battles.some(entry => entry.kind === 'two-sided' && entry.participants.length === 2);
  }, 600);
  const pvp = state.battles.find((entry): entry is TwoSidedBattleResult => entry.kind === 'two-sided' && entry.participants.length === 2)!;
  cache = { state, pvp, pve };
  return cache;
}
// Shared room/replay setup is independent of the ranking assertions.
beforeAll(() => { battles(); });
const sum = (rows: readonly RankTotals[], key: keyof RankTotals) => rows.reduce((total, row) => total + row[key], 0);

describe('G5 battle ranking', () => {
  it('has one row per unit of both sides; damage dealt and taken are HP damage plus shield absorbed', () => {
    const { state, pvp } = battles();
    const { replay } = toCombatReplayFor(state, pvp.battle.a.seatId)!;
    const ranking = rankBattle(replay);
    expect(ranking.rows.map(row => row.unitId)).toEqual(replay.initial.units.map(unit => unit.id));
    expect(new Set(ranking.rows.map(row => row.team))).toEqual(new Set(['player', 'enemy']));
    const events = replayEvents(replay), damage = events.filter(event => event.type === 'packetDamage');
    const total = damage.reduce((value, event) => value + event.hpDamage + event.absorbed, 0);
    expect(total).toBeGreaterThan(0);
    expect(sum(ranking.rows, 'damageDealt')).toBe(total);
    expect(sum(ranking.rows, 'damageTaken')).toBe(total);
    expect(sum(ranking.rows, 'shieldAbsorbed')).toBe(damage.reduce((value, event) => value + event.absorbed, 0));
    expect(sum(ranking.rows, 'healingReceived')).toBe(events.reduce((value, event) => value + (event.type === 'heal' ? event.actual : 0), 0));
    for (const row of ranking.rows) {
      const own = damage.filter(event => event.sourceId === row.unitId), hits = damage.filter(event => event.targetId === row.unitId);
      expect(row.damageDealt).toBe(own.reduce((value, event) => value + event.hpDamage + event.absorbed, 0));
      expect(row.damageTaken).toBe(hits.reduce((value, event) => value + event.hpDamage + event.absorbed, 0));
      expect(row.shieldAbsorbed).toBe(hits.reduce((value, event) => value + event.absorbed, 0));
      expect(row.alive).toBe(replay.terminal.units.find(unit => unit.id === row.unitId)!.alive);
    }
    expect(ranking.result).toBe(replay.terminal.result);
  });
  it('mirrors for the other seat: the same totals with the sides swapped', () => {
    const { state, pvp } = battles();
    const a = rankBattle(toCombatReplayFor(state, pvp.battle.a.seatId)!.replay), b = rankBattle(toCombatReplayFor(state, pvp.battle.b.seatId)!.replay);
    const side = (rows: typeof a.rows, team: 'player' | 'enemy') => sum(rows.filter(row => row.team === team), 'damageDealt');
    expect(side(a.rows, 'player')).toBe(side(b.rows, 'enemy'));
    expect(side(a.rows, 'enemy')).toBe(side(b.rows, 'player'));
  });
  it('sorts by a metric, highest first, ties in the given order', () => {
    const { state, pvp } = battles();
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

describe('G5 match totals', () => {
  it('add up every battle by team + definition + star; the N-battle totals are the sum of the first N battles', () => {
    const { state, pvp, pve } = battles();
    const rankings: BattleRanking[] = [...pve.map(rankBattle), rankBattle(toCombatReplayFor(state, pvp.battle.a.seatId)!.replay)];
    expect(rankings.length).toBeGreaterThanOrEqual(2);
    for (let n = 1; n <= rankings.length; n++) {
      const totals = accumulateRankings(rankings.slice(0, n));
      const expected = new Map<string, { dealt: number; taken: number; shield: number; healed: number; battles: Set<number> }>();
      rankings.slice(0, n).forEach((ranking, index) => {
        for (const row of ranking.rows) {
          const key = matchRankKey(row), entry = expected.get(key) ?? { dealt: 0, taken: 0, shield: 0, healed: 0, battles: new Set<number>() };
          entry.dealt += row.damageDealt; entry.taken += row.damageTaken; entry.shield += row.shieldAbsorbed; entry.healed += row.healingReceived; entry.battles.add(index);
          expected.set(key, entry);
        }
      });
      expect(totals.map(row => row.key).sort()).toEqual([...expected.keys()].sort());
      for (const row of totals) {
        const want = expected.get(row.key)!;
        expect([row.damageDealt, row.damageTaken, row.shieldAbsorbed, row.healingReceived, row.battles]).toEqual([want.dealt, want.taken, want.shield, want.healed, want.battles.size]);
      }
    }
    // Units of earlier battles keep their rows once they no longer fight.
    const early = accumulateRankings(rankings.slice(0, 1)), all = accumulateRankings(rankings);
    for (const row of early) expect(all.some(entry => entry.key === row.key)).toBe(true);
  });
});

describe('G5 RemoteSession keeps the match battles', () => {
  const client: GameClient = { transport: 'local-room', listen: () => () => {}, joinQueue: () => {}, leaveQueue: () => {}, startMatch: () => {},
    send: () => ({ ok: 'pending', commandId: 0 }), reset: () => {}, dispose: () => {} };
  it('outlive the settlement push, one per round, until forgotten', () => {
    const { state, pvp, pve } = battles();
    const { replay, unitIds } = toCombatReplayFor(state, pvp.battle.a.seatId)!;
    const session = new RemoteSession(client, undefined, () => 0);
    const round = session.state.round;
    session.receiveReplay(pve[0]!);
    session.receiveReplay(replay, unitIds); // the same round again: replaces the first
    expect(session.battleHistory).toHaveLength(1);
    expect(session.lastBattle).toMatchObject({ round, replay });
    session.receiveState({ ...session.state, phase: 'settlement', round } as typeof session.state);
    expect(session.inBattle).toBe(false);
    expect(session.lastBattle?.replay).toBe(replay);
    session.receiveState({ ...session.state, phase: 'preparation', round: round + 1 } as typeof session.state);
    session.receiveReplay(pve[0]!);
    expect(session.battleHistory.map(battle => battle.round)).toEqual([round, round + 1]);
    session.forgetBattles();
    expect(session.battleHistory).toEqual([]);
    expect(session.lastBattle).toBeNull();
  });
});
