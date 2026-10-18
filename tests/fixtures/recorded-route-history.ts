import type { MatchState, MatchEvent } from '../../src/simulation/match';
import { startMatchCombat } from '../../src/simulation/match';
import { BattleHistory, recordVersion } from '../../src/replay/history';
import { digestContent } from '../../src/simulation/content';
import type { BattleRecord } from '../../src/m6/contracts';
import { registerHistory } from './history-evidence';
/** Import an existing command driver's full emitted ledger, never settlement-only data.
 * Admission still replays each record and compares its complete contexts and terminal. */
export function registerRecordedRoute(route: { rounds: readonly { before: MatchState; after: MatchState; events: readonly MatchEvent[] }[] }, runId = 'recorded-route'): readonly BattleRecord[] {
  let battles: readonly BattleRecord[] = [];
  for (const round of route.rounds) {
    registerHistory(round.before, battles);
    const start = startMatchCombat(round.before);
    if (!start.ok || !start.state.combat || !round.after.combat) throw new Error('Incomplete recorded route');
    const events = round.events.filter(event => event.domain === 'combat');
    const terminal = round.after.combat;
    const record: BattleRecord = {version:recordVersion(round.before),runId,combatId:terminal.combatId!,roundId:round.before.roundDefinitionId,
      context:round.before,initial:start.state.combat,events,endTick:terminal.tick,nextEventSeq:terminal.nextEventSeq!,result:terminal.result,
      stateHash:digestContent(terminal),eventHash:digestContent(events)};
    battles = new BattleHistory(runId, [...battles, record]).completedRecords;
    registerHistory(round.after,battles);
  }
  return battles;
}
