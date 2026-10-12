/**
 * 占位实现：PvP 仍是各席位独立的单人战斗；真实双方战斗见 two-sided-resolver.ts（B3），
 * 等 T3 的结算提交入口交付后，房间默认切到 two-sided。PvE 与补给回合继续走这里。
 *
 * The room hands every battle to a resolver and only orchestrates. This placeholder runs
 * each seat's OWN single-player combat through the shared-pool wrapper of the public rules
 * API (`runSharedMatchCommand` startCombat + step, contract §12.4: a PvE win may award a unit,
 * so the pool must see it) and reports what the rules settled. It never looks at the opponent:
 * a "pvp" pairing is two independent single-player battles.
 */
import type { LedgerCombatEvent } from '../../simulation/combat-types';
import type { MatchEvent, MatchState } from '../../simulation/match-types';
import { runSharedMatchCommand, type SharedPoolState } from '../../server-entry';
import type { BattleFrame, BattleInput, BattleResult, BattleSeatOutcome } from './types';

/**
 * `pool` is the room's unpublished shared pool as left by the battles resolved before this one in the
 * same round (§12.4: one seat's reward reservation is the next seat's input). A resolver that awards
 * nothing may ignore it; one that runs rules combat returns the pool it ended with in `result.pool`.
 */
export interface BattleResolver { resolveBattle(input: BattleInput, pool: SharedPoolState): BattleResult }

/** A rules refusal is an orchestration fault for the room (half a round never commits). */
export class BattleResolveError extends Error {
  constructor(readonly seatId: string, readonly reason: string) { super(`seat ${seatId}: ${reason}`); this.name = 'BattleResolveError'; }
}

function runOwnCombat(seatId: string, state: MatchState, pool: SharedPoolState): { readonly outcome: BattleSeatOutcome; readonly pool: SharedPoolState } {
  // A supply round (or any state the rules already settled) has no combat to run.
  if (state.phase !== 'preparation') {
    if (state.phase === 'settlement' || state.phase === 'gameOver') return { outcome: { seatId, state, result: lastResult(state), damage: lastDamage(state), frames: [] }, pool };
    throw new BattleResolveError(seatId, `wrong-phase:${state.phase}`);
  }
  const started = runSharedMatchCommand(pool, state, { type: 'startCombat' });
  if (!started.ok) throw new BattleResolveError(seatId, started.reason);
  const frames: BattleFrame[] = [toFrame(started.state, started.events)];
  let current = started.state, latest = started.pool;
  while (current.phase === 'combat') {
    const step = runSharedMatchCommand(latest, current, { type: 'step' });
    if (!step.ok) throw new BattleResolveError(seatId, step.reason);
    current = step.state; latest = step.pool;
    frames.push(toFrame(current, step.events));
  }
  return { outcome: { seatId, state: current, result: lastResult(current), damage: lastDamage(current), frames }, pool: latest };
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
  resolveBattle(input: BattleInput, pool: SharedPoolState): BattleResult {
    const outcomes: BattleSeatOutcome[] = [];
    let latest = pool;
    for (const seat of input.seats) { const ran = runOwnCombat(seat.seatId, seat.state, latest); outcomes.push(ran.outcome); latest = ran.pool; }
    return { kind: 'placeholder', battleId: input.battleId, round: input.round, roomRevision: input.roomRevision, outcomes, pool: latest };
  }
}
