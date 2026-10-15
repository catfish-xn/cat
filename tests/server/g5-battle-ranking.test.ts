/**
 * G5: the post-battle ranking of a real room battle is the rules' `summarizeBattle` of its compact replay (contract
 * §14.2), not a tally of its own: damage = HP damage + shield absorbed (TFT's damage chart), 治疗 = healing done by the
 * heal shares' sources, healing received kept for the hover. The match totals add every battle's rows up by team,
 * definition and star level; the unit hover card reads the same rows. Display only.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { toCombatReplayFor } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { RoomState, TwoSidedBattleResult } from '../../src/server/room/types';
import { accumulateRankings, matchRankKey, rankBattle, sortRanking, unitBattleStats, type BattleRanking, type RankTotals } from '../../src/presentation/battle-ranking';
import { RemoteSession } from '../../src/rendering/online/remote-session';
import type { GameClient } from '../../src/rendering/online/protocol';
import { summarizeBattle, type CombatReplay, type CombatViewEvent } from '../../src/server-entry';
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
const replayEvents = (replay: CombatReplay): CombatViewEvent[] => replay.ticks.flatMap(frame => frame.events);

describe('G5 battle ranking', () => {
  it('is the rules\' summarizeBattle of the replay: one row per unit of both sides, in replay order', () => {
    const { state, pvp, pve } = battles();
    for (const replay of [toCombatReplayFor(state, pvp.battle.a.seatId)!.replay, ...pve]) {
      const ranking = rankBattle(replay);
      expect(ranking.rows).toEqual(summarizeBattle(replay));
      expect(rankBattle(replay)).toBe(ranking); // computed once per replay
      expect(ranking.rows.map(row => row.unitId)).toEqual(replay.initial.units.map(unit => unit.id));
      expect(ranking.result).toBe(replay.terminal.result);
    }
    const ranking = rankBattle(toCombatReplayFor(state, pvp.battle.a.seatId)!.replay);
    expect(new Set(ranking.rows.map(row => row.team))).toEqual(new Set(['player', 'enemy']));
  });
  it('matches the replay events independently: damage HP + shield, 治疗 by the heal shares\' sources, received by target', () => {
    const { state, pvp, pve } = battles();
    for (const replay of [toCombatReplayFor(state, pvp.battle.a.seatId)!.replay, ...pve]) {
      const ranking = rankBattle(replay), events = replayEvents(replay);
      const damage = events.filter(event => event.type === 'packetDamage'), heals = events.filter(event => event.type === 'heal');
      for (const row of ranking.rows) {
        const own = damage.filter(event => event.sourceId === row.unitId), hits = damage.filter(event => event.targetId === row.unitId);
        expect(row.damageDealt).toBe(own.reduce((value, event) => value + event.hpDamage + event.absorbed, 0));
        expect(row.damageTaken).toBe(hits.reduce((value, event) => value + event.hpDamage + event.absorbed, 0));
        expect(row.shieldAbsorbed).toBe(hits.reduce((value, event) => value + event.absorbed, 0));
        expect(row.healingDone).toBe(heals.reduce((value, event) => value + event.shares.filter(share => share.sourceId === row.unitId).reduce((total, share) => total + share.actual, 0), 0));
        expect(row.healingReceived).toBe(heals.filter(event => event.targetId === row.unitId).reduce((value, event) => value + event.actual, 0));
        expect(row.alive).toBe(replay.terminal.units.find(unit => unit.id === row.unitId)!.alive);
      }
      for (const heal of heals) expect(heal.shares.reduce((total, share) => total + share.actual, 0)).toBe(heal.actual);
    }
    expect(sum(rankBattle(toCombatReplayFor(state, pvp.battle.a.seatId)!.replay).rows, 'damageDealt')).toBeGreaterThan(0);
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
    for (const metric of ['damageDealt', 'damageTaken', 'healingDone'] as const) {
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
      const expected = new Map<string, { dealt: number; taken: number; shield: number; healed: number; received: number; kills: number; battles: Set<number> }>();
      rankings.slice(0, n).forEach((ranking, index) => {
        for (const row of ranking.rows) {
          const key = matchRankKey(row), entry = expected.get(key) ?? { dealt: 0, taken: 0, shield: 0, healed: 0, received: 0, kills: 0, battles: new Set<number>() };
          entry.dealt += row.damageDealt; entry.taken += row.damageTaken; entry.shield += row.shieldAbsorbed; entry.healed += row.healingDone;
          entry.received += row.healingReceived; entry.kills += row.kills; entry.battles.add(index);
          expected.set(key, entry);
        }
      });
      expect(totals.map(row => row.key).sort()).toEqual([...expected.keys()].sort());
      for (const row of totals) {
        const want = expected.get(row.key)!;
        expect([row.damageDealt, row.damageTaken, row.shieldAbsorbed, row.healingDone, row.healingReceived, row.kills, row.battles])
          .toEqual([want.dealt, want.taken, want.shield, want.healed, want.received, want.kills, want.battles.size]);
      }
    }
    // Units of earlier battles keep their rows once they no longer fight.
    const early = accumulateRankings(rankings.slice(0, 1)), all = accumulateRankings(rankings);
    for (const row of early) expect(all.some(entry => entry.key === row.key)).toBe(true);
  });
});

describe('G5 unit hover stats', () => {
  it('show the unit\'s row of the last battle (by battle id or my original id) and its kind\'s match total', () => {
    const { state, pvp, pve } = battles();
    const own = toCombatReplayFor(state, pvp.battle.a.seatId)!;
    const history = [...pve.map(replay => ({ replay, unitIds: [] })), { replay: own.replay, unitIds: own.unitIds }];
    const rows = rankBattle(own.replay).rows, totals = accumulateRankings(history.map(entry => rankBattle(entry.replay)));
    for (const row of rows) {
      const unit = { id: row.unitId, definitionId: row.definitionId, starLevel: row.starLevel, team: row.team };
      const stats = unitBattleStats(history, unit);
      expect(stats.battle).toEqual(row);
      expect(stats.match).toEqual(totals.find(total => total.key === matchRankKey(row)));
    }
    // My original unit ids reach their battle rows through the replay's own id list (C15).
    expect(own.unitIds.length).toBeGreaterThan(0);
    for (const entry of own.unitIds) {
      const row = rows.find(candidate => candidate.unitId === entry.combatId)!;
      expect(unitBattleStats(history, { id: entry.originalId, definitionId: row.definitionId, starLevel: row.starLevel, team: 'player' }).battle).toEqual(row);
    }
    // A battle still being played back is left out: the earlier battles only.
    const first = rows[0]!, earlier = accumulateRankings(history.slice(0, -1).map(entry => rankBattle(entry.replay)));
    const partial = unitBattleStats(history, { id: first.unitId, definitionId: first.definitionId, starLevel: first.starLevel, team: first.team }, history.length - 1);
    expect(partial.match).toEqual(earlier.find(total => total.key === matchRankKey(first)) ?? null);
    expect(unitBattleStats([], { id: 'x', definitionId: first.definitionId, starLevel: 1, team: 'player' })).toEqual({ battle: null, match: null });
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
