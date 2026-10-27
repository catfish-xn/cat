/** Server orchestration only: freeze authoritative table/roster/settlement observations.
 * No rewards, growth amounts, player damage formula or random draws live here. */
import { appendAugmentFact, recordAugmentTable, recordAugmentPvpRoster, recordAugmentTransition, historyRoster, augmentDeathsFromEvents,
  type HistorySeat } from '../../server-entry';
import type { MatchState, MatchEvent } from '../../simulation/match-types';
import type { RoomState, SeatState, SettledSeat, BattleResult, BattleInput } from './types';

function executedDeaths(battle: Extract<BattleResult,{kind:'two-sided'}>['battle']) {
  const deaths=augmentDeathsFromEvents(battle.events).map(d=>{
    const mapped=battle.mapping.find(m=>m.kind==='unit'&&m.combatId===d.unitId);
    const killer=d.lootExplosion;
    const killerMapped=killer?battle.mapping.find(m=>m.kind==='unit'&&m.combatId===killer.killerUnitId):undefined;
    return {...d,ownerSeatId:d.team==='player'?battle.a.seatId:battle.b.seatId,originalUnitId:mapped?.originalId??d.unitId,
      ...(killer?{lootExplosion:{...killer,killerSeatId:d.team==='enemy'?battle.a.seatId:battle.b.seatId,originalKillerUnitId:killerMapped?.originalId??killer.killerUnitId}}:{})};
  });
  if(deaths.length!==battle.events.filter(e=>e.type==='death').length)throw new RangeError('Invalid augment history: missing executed death samples');
  return deaths;
}
/** B5-69 needs executed deaths inside the shared settlement transaction, before rewards. */
export function recordRoomBattleDeaths(match:MatchState,results:readonly BattleResult[]):MatchState {
  if(!match.augments.some(a=>a.definitionId==='loot-explosion'))return match;
  const result=results.find((r):r is Extract<BattleResult,{kind:'two-sided'}>=>r.kind==='two-sided'&&r.participants.includes(match.multiplayer!.seatId));
  if(!result)return match;
  return appendAugmentFact(match,{kind:'deaths',battleId:result.battleId,completeThroughTick:result.battle.terminal.tick,deaths:executedDeaths(result.battle)});
}

export function tableFacts(seats: readonly SeatState[], matches?: ReadonlyMap<string, {readonly match: MatchState}>): readonly HistorySeat[] {
  const order = [...seats].filter(s => s.alive).sort((a,b) => b.hp-a.hp ||
    (b.match.roundResults.at(-1)?.hpBefore ?? b.hp) - (a.match.roundResults.at(-1)?.hpBefore ?? a.hp) || a.index-b.index);
  return [...seats].sort((a,b) => a.index-b.index).map(s => ({ ...historyRoster(matches?.get(s.seatId)?.match ?? s.match),
    seatId: s.seatId, index: s.index, hp: s.hp, alive: s.alive, rank: s.rank ?? order.indexOf(s)+1, eliminatedRound: s.eliminatedRound }));
}
export function recordRoomPublication(before: RoomState, next: RoomState): RoomState {
  if (before.seats === next.seats) return next;
  let changed = false; const table = next.seats.some(s => s.match.augmentHistory) ? tableFacts(next.seats) : [];
  const seats = next.seats.map(seat => {
    const previous = before.seats.find(s => s.seatId === seat.seatId); if (!previous || previous.match === seat.match) return seat;
    let match = recordAugmentTransition(previous.match, seat.match);
    // Acquisition facts already belong to the choice transaction, before its effects execute.
    if (match.augmentHistory && previous.match.round !== match.round) match = recordAugmentTable(match, 'entry', table);
    if (match === seat.match) return seat; changed = true; return { ...seat, match };
  });
  return changed ? { ...next, seats } : next;
}
export function recordRoomPvpRosters(room: RoomState, deployed: ReadonlyMap<string, {readonly match: MatchState; readonly events: readonly MatchEvent[]}>, inputs: readonly BattleInput[]) {
  if (room.roundKind !== 'pvp' || !room.seats.some(s => s.match.augmentHistory)) return deployed;
  const seats = tableFacts(room.seats, deployed), result = new Map(deployed);
  for (const input of inputs) for (const seat of input.seats) {
    const value = result.get(seat.seatId) ?? { match: seat.state, events: [] };
    result.set(seat.seatId, { ...value, match: recordAugmentPvpRoster(value.match, input.battleId, seats, input.mirrorOf?.seatId ?? null) });
  }
  return result;
}
export function recordRoomBattleFacts(seats: readonly SettledSeat[], results: readonly BattleResult[]): readonly SettledSeat[] {
  return seats.map(seat => {
    let match = seat.match; if (!match.augmentHistory) return seat;
    const result = results.find(r => r.kind === 'two-sided' ? r.participants.includes(seat.seatId) : r.outcomes.some(s => s.seatId === seat.seatId));
    if (!result || result.kind !== 'two-sided') return seat; // PvE samples are recorded by the Match commands.
    const battle = result.battle;
    if(!match.augmentHistory!.facts.some(f=>f.kind==='deaths'&&f.battleId===result.battleId))
      match = appendAugmentFact(match, { kind: 'deaths', battleId: result.battleId, completeThroughTick: battle.terminal.tick, deaths:executedDeaths(battle) });
    const opponentId = battle.a.seatId === seat.seatId ? battle.b.seatId : battle.a.seatId;
    const opponent = seats.find(s => s.seatId === opponentId);
    const record = opponent?.match.roundResults.find(r => r.round === match.round);
    const mirror = battle.mirrorOfSeatId !== null;
    if (!mirror && !record) throw new RangeError('Invalid augment history: missing opponent damage settlement');
    match = appendAugmentFact(match, { kind: 'player-damage', battleId: result.battleId, opponentSeatId: opponentId,
      mirror, hpBefore: mirror ? null : record!.hpBefore, hpAfterDamage: mirror ? null : record!.hpAfter, actualDamage: mirror ? 0 : record!.hpLost });
    return { ...seat, match };
  });
}
export function recordRoomSettlementTable(seats: readonly SeatState[]): readonly SeatState[] {
  if (!seats.some(s => s.match.augmentHistory)) return seats;
  const table = tableFacts(seats);
  return seats.map(s => s.match.augmentHistory && s.match.roundResults.at(-1)?.round === s.match.round
    && !s.match.augmentHistory.facts.some(f => f.kind === 'table' && f.stage === 'settlement' && f.round === s.match.round)
    ? { ...s, match: recordAugmentTable(s.match, 'settlement', table) } : s);
}
