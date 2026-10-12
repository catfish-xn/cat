/**
 * 占位实现：PvP 仍是各席位独立的单人战斗；真实双方战斗见 two-sided-resolver.ts（B3），
 * 等 T3 的结算提交入口交付后，房间默认切到 two-sided。PvE 与补给回合继续走这里。
 *
 * The room hands every battle to a resolver and only orchestrates. This placeholder runs
 * each seat's OWN single-player combat through the public rules API (startMatchCombat +
 * stepMatch, exactly like the fake server) and reports what the rules settled. It never
 * looks at the opponent: a "pvp" pairing is two independent single-player battles.
 */
import type { LedgerCombatEvent } from '../../simulation/combat-types';
import { startMatchCombat, stepMatch } from '../../simulation/match';
import type { MatchEvent, MatchState } from '../../simulation/match-types';
import type { BattleFrame, BattleInput, BattleResult, BattleSeatOutcome } from './types';

export interface BattleResolver { resolveBattle(input: BattleInput): BattleResult }

/** A rules refusal is an orchestration fault for the room (half a round never commits). */
export class BattleResolveError extends Error {
  constructor(readonly seatId: string, readonly reason: string) { super(`seat ${seatId}: ${reason}`); this.name = 'BattleResolveError'; }
}

function runOwnCombat(seatId: string, state: MatchState): BattleSeatOutcome {
  // A supply round (or any state the rules already settled) has no combat to run.
  if (state.phase !== 'preparation') {
    if (state.phase === 'settlement' || state.phase === 'gameOver') return { seatId, state, result: lastResult(state), damage: lastDamage(state), frames: [] };
    throw new BattleResolveError(seatId, `wrong-phase:${state.phase}`);
  }
  const started = startMatchCombat(state);
  if (!started.ok) throw new BattleResolveError(seatId, started.reason);
  const frames: BattleFrame[] = [toFrame(started.state, started.events)];
  let current = started.state;
  while (current.phase === 'combat') {
    const step = stepMatch(current);
    current = step.state;
    frames.push(toFrame(current, step.events));
  }
  return { seatId, state: current, result: lastResult(current), damage: lastDamage(current), frames };
}
/** Battle view data only: the combat the rules ran plus that tick's ledger events; the MatchState itself stays in the outcome. */
function toFrame(state: MatchState, events: readonly MatchEvent[]): BattleFrame {
  if (!state.combat) throw new BattleResolveError('frame', 'no-combat');
  return { state: state.combat, events: events.filter((event): event is LedgerCombatEvent => 'tick' in event) };
}
function lastResult(state: MatchState): BattleSeatOutcome['result'] {
  const record = state.roundResults.at(-1);
  return record && record.round === state.round ? record.result : null;
}
/** Untruncated damage the rules decided for this round; the room subtracts it from the authoritative HP. */
function lastDamage(state: MatchState): number {
  const record = state.roundResults.at(-1);
  return record && record.round === state.round ? record.playerDamage : 0;
}

export class PlaceholderBattleResolver implements BattleResolver {
  resolveBattle(input: BattleInput): BattleResult {
    const outcomes = input.seats.map(seat => runOwnCombat(seat.seatId, seat.state));
    return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes };
  }
}
