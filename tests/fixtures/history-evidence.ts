import type { BattleRecord } from '../../src/m6/contracts';
import type { MatchState } from '../../src/simulation/match-types';
import { canonicalContent, digestContent } from '../../src/simulation/content';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import type { BattleHistory } from '../../src/replay/history';
import type { MatchCommandResult, MatchStep } from '../../src/simulation/match';

// Only public fixture recorders publish evidence. Resource/loot mutations never
// generate a proof: negative copies are tested against the original battles.
interface RecordedHistory {
  readonly battles: readonly BattleRecord[];
  readonly resourcePrefix: readonly string[];
}
const histories = new Map<string, RecordedHistory[]>();
const key = (state: MatchState) => canonicalContent([state.seed,
  state.roundResults.filter(result => result.roundKind !== 'supply')]);
export function registerHistory(state: MatchState, battles: readonly BattleRecord[]): void {
  const id=key(state), entries=histories.get(id)??[];
  // Keep separate genuine branches with identical round summaries (e.g. an
  // extra bench equip). Selection is only a fixture lookup; production replay
  // still verifies the chosen complete proof against every candidate.
  if(entries.some(entry=>entry.battles.at(-1)===battles.at(-1)))return;
  entries.push({battles,resourcePrefix:state.resourceProvenance.entries.map(canonicalContent)});
  histories.set(id,entries);
}
export function historyFor(state: MatchState): readonly BattleRecord[] {
  const entries=histories.get(key(state))??[],resources=state.resourceProvenance.entries.map(canonicalContent);
  // A preparation may extend an earlier prefix with equipment transactions.
  // Prefer the most specific genuine branch instead of its shorter ancestor.
  const compatible=entries.filter(entry=>entry.resourcePrefix.every((fact,i)=>i<resources.length&&fact===resources[i]))
    .sort((a,b)=>b.resourcePrefix.length-a.resourcePrefix.length);
  if(state.combat?.status==='finished'){
    const hash=digestContent(state.combat),exact=compatible.find(entry=>entry.battles.at(-1)?.stateHash===hash);
    if(exact)return exact.battles;
  }
  return (compatible[0]??entries[0])?.battles??[];
}
export function observeHistory(history: BattleHistory, before: MatchState, result: MatchCommandResult | MatchStep): void {
  registerHistory(before,history.completedRecords);
  history.observe({before,after:result.state,
    events:('events' in result?result.events:[]).filter(e=>e.domain==='combat'),reason:before.combat?'tick':'command'});
  registerHistory(result.state,history.completedRecords);
}
export function restoreWithEvidence(input: unknown): MatchState {
  const state = (typeof input === 'string' ? JSON.parse(input) : input) as MatchState;
  return restoreMatch(input, historyFor(state));
}
export function serializeWithEvidence(state: MatchState): string {
  return serializeMatch(state, historyFor(state));
}
