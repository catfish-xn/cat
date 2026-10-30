/** Server orchestration only: freeze authoritative table/roster/settlement observations.
 * No rewards, growth amounts, player damage formula or random draws live here. */
import { drainBatch5H7Gold, applyDhampyrSettlement, drainBatch5H8Deaths, appendAugmentFact, recordAugmentTable, recordAugmentSettlementTable, settleBatch5H9History, recordAugmentPvpRoster, recordAugmentTransition, historyRoster, augmentDeathsFromEvents,
  hasTombRaider, recordTombRaiderEliminations, publishTombRaiderChoice, tombRaiderOpportunities, recordR2PortableBattle, type HistorySeat } from '../../server-entry';
import type { MatchState, MatchEvent } from '../../simulation/match-types';
import type { RoomState, SeatState, SettledSeat, BattleResult, BattleInput, RankEntry } from './types';

function executedDeaths(battle: Pick<Extract<BattleResult,{kind:'two-sided'}>['battle'], 'events' | 'mapping' | 'a' | 'b'>, match: MatchState) {
  const deaths=augmentDeathsFromEvents(battle.events, match.augments.some(a => a.definitionId === 'a-golden-find'), match.augments.some(a => a.definitionId === 'forbidden-magic')).map(d=>{
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
  return appendAugmentFact(match,{kind:'deaths',battleId:result.battleId,completeThroughTick:result.battle.terminal.tick,deaths:executedDeaths(result.battle, match)});
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
    // Official publication must not skip rewards when the acquisition baseline is missing.
    // Bot dry-runs never reach here; they still skip a missing table inside pendingOpportunity.
    if (hasTombRaider(match)) for (const owner of match.augments)
      if (owner.definitionId === 'tomb-raider-1' || owner.definitionId === 'tomb-raider-2') tombRaiderOpportunities(match, owner.choiceId);
    const opened = publishTombRaiderChoice(match); match = opened.state;
    if (match === seat.match) return seat; changed = true;
    return { ...seat, match, ...(opened.events.length ? { serverEvents: { seatRevision: seat.seatRevision,
      events: [...(seat.serverEvents?.events ?? []), ...opened.events] } } : {}) };
  });
  return changed ? { ...next, seats } : next;
}

/** Capture the rules' settled, ranked rosters before shared-pool resource release. */
export function recordRoomEliminations(room: RoomState, settled: readonly SettledSeat[], eliminated: readonly RankEntry[]): readonly SettledSeat[] {
  if (!settled.some(s => hasTombRaider(s.match))) return settled;
  const outcomes = new Map(settled.map(s => [s.seatId, s]));
  const ranks = new Map(eliminated.map(s => [s.seatId, s.rank]));
  const table = tableFacts(room.seats.map(seat => {
    const outcome = outcomes.get(seat.seatId);
    return outcome ? { ...seat, match: outcome.match, hp: outcome.hpAfter, alive: outcome.hpAfter > 0,
      rank: ranks.get(seat.seatId) ?? seat.rank, eliminatedRound: outcome.hpAfter > 0 ? null : room.round } : seat;
  }));
  return settled.map(seat => {
    const result = recordTombRaiderEliminations(seat.match, table);
    return result.state === seat.match ? seat : { ...seat, match: result.state, events: [...seat.events, ...result.events] };
  });
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
    if (!result || match.m8.round.kind !== 'pvp') return seat; // PvE samples are recorded by the Match commands.
    const combat = result.kind === 'two-sided' ? result.battle : result.outcomes.find(s => s.seatId === seat.seatId)?.combat;
    if (!combat) return seat;
    // A placeholder may carry either a real two-sided battle or the Match's own generated opponent.
    const battle = combat.mapping && combat.a && combat.b ? { ...combat, mapping: combat.mapping, a: combat.a, b: combat.b } : null;
    if (battle) {
      match = recordR2PortableBattle(match,battle.terminal,battle.a.seatId===seat.seatId?'player':'enemy',battle.mapping);
      if(!match.augmentHistory!.facts.some(f=>f.kind==='deaths'&&f.battleId===result.battleId))
        match = appendAugmentFact(match, { kind: 'deaths', battleId: result.battleId, completeThroughTick: battle.terminal.tick, deaths:executedDeaths(battle, match) });
      const opponentId = battle.a.seatId === seat.seatId ? battle.b.seatId : battle.a.seatId;
      const opponent = seats.find(s => s.seatId === opponentId);
      const record = opponent?.match.roundResults.find(r => r.round === match.round);
      const mirror = battle.mirrorOfSeatId != null;
      if (!mirror && !record) throw new RangeError('Invalid augment history: missing opponent damage settlement');
      match = appendAugmentFact(match, { kind: 'player-damage', battleId: result.battleId, opponentSeatId: opponentId,
        mirror, hpBefore: mirror ? null : record!.hpBefore, hpAfterDamage: mirror ? null : record!.hpAfter, actualDamage: mirror ? 0 : record!.hpLost });
    } else {
      // Own-combat death samples and portable effects already came from Match commands.
      // Its generated opponent has no player HP account, as in solo combat.
      if (!match.roundResults.some(r => r.round === match.round)) return seat;
      match = appendAugmentFact(match, { kind: 'player-damage', battleId: result.battleId, opponentSeatId: null,
        mirror: false, hpBefore: null, hpAfterDamage: null, actualDamage: null });
    }
    const rewarded = drainBatch5H7Gold(match);
    match = rewarded.state;
    const beforePayout=match;
    match=drainBatch5H8Deaths(match);
    const prior=new Set((beforePayout.seatMechanics?.receipts??[]).map(r=>r.receiptId));
    const receipts=(match.seatMechanics?.receipts??[]).filter(r=>!prior.has(r.receiptId));
    const payoutEvents:MatchEvent[]=receipts.map((receipt,index)=>({type:'mechanicGranted',receipt,domain:'match',eventSeq:match.nextMatchEventSeq+index}));
    if(payoutEvents.length)match={...match,nextMatchEventSeq:match.nextMatchEventSeq+payoutEvents.length};
    match = applyDhampyrSettlement(match);
    const effect = settleBatch5H9History(match);
    return { ...seat, match: effect.state, hpAfter: effect.state.playerHp, events:[...seat.events,...rewarded.events,...payoutEvents,...effect.events] };
  });
}
export function recordRoomSettlementTable(seats: readonly SeatState[]): readonly SeatState[] {
  if (!seats.some(s => s.match.augmentHistory)) return seats;
  const table = tableFacts(seats);
  return seats.map(seat => {
    const recorded = recordAugmentSettlementTable(seat.match, table);
    if (recorded.state === seat.match) return seat;
    const events = seat.serverEvents?.seatRevision === seat.seatRevision ? seat.serverEvents.events : [];
    return { ...seat, match: recorded.state,
      serverEvents: { seatRevision: seat.seatRevision, events: [...events, ...recorded.events] } };
  });
}
