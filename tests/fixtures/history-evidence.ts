import type { BattleRecord } from '../../src/m6/contracts';
import type { MatchState } from '../../src/simulation/match-types';
import { canonicalContent, digestContent } from '../../src/simulation/content';
import { restoreMatch as productionRestore, serializeMatch as productionSerialize } from '../../src/simulation/serialization';
import type { BattleHistory } from '../../src/replay/history';
import type { MatchCommandResult, MatchStep } from '../../src/simulation/match';

// Only public fixture recorders publish evidence. Resource/loot mutations never
// generate a proof: negative copies are tested against the original battles.
interface RecordedHistory {
  readonly seed: number;
  readonly battles: readonly BattleRecord[];
  readonly resourcePrefix: readonly string[];
}
const direct = new WeakMap<MatchState, readonly BattleRecord[]>();
// setupFiles may retain an import from before vi.resetModules(). Keep cleanup
// and the current module graph on the same per-file registry in this worker.
const registrySymbol = Symbol.for('cat.fixture.history.registries');
const historyScopes: Map<string, Map<string, RecordedHistory[]>> = Reflect.get(globalThis,registrySymbol)
  ?? new Map<string, Map<string, RecordedHistory[]>>();
Reflect.set(globalThis,registrySymbol,historyScopes);
function scopedHistories(): Map<string, RecordedHistory[]> {
  const readScope=Reflect.get(globalThis,Symbol.for('cat.fixture.history.scope')) as (()=>string)|undefined;
  const scope=readScope?.()??'script';
  let histories=historyScopes.get(scope);
  if(!histories){histories=new Map();historyScopes.set(scope,histories);}
  return histories;
}
export function clearHistoryScope(scope:string): void { historyScopes.delete(scope); }
/** Release one route's file-local indexes after its final assertion. Direct
 * evidence remains weakly bound to any state a caller still owns. */
export function releaseHistorySeed(seed:number):void {
  const histories=scopedHistories();
  for(const [id,entries] of histories)if(entries[0]?.seed===seed)histories.delete(id);
}
function battleEconomy(state:MatchState): unknown {
  const receipts=(state.seatMechanics?.hidden.progress as {economyReceipts?: readonly {kind?:unknown}[]} | undefined)?.economyReceipts;
  return receipts?.filter(receipt=>receipt?.kind==='battle');
}
const key = (state: MatchState) => canonicalContent([state.seed,
  state.roundResults.filter(result => result.roundKind !== 'supply'), state.persistentGrowth, state.augmentProgress, battleEconomy(state)]);
export function copyWithHistory(state: MatchState): MatchState {
  const copy=structuredClone(state);
  registerHistory(copy,historyFor(state));
  return copy;
}
export function bindHistory(state: MatchState, battles: readonly BattleRecord[]): void { direct.set(state, battles); }
export function registerHistory(state: MatchState, battles: readonly BattleRecord[], serialized?: string): void {
  // A tick-zero concession already has a settlement in its returned state.
  // Never publish its pre-observation prefix under the completed state's key.
  if (battles.length !== state.roundResults.filter(result=>result.roundKind!=='supply').length) return;
  direct.set(state, battles);
  const histories=scopedHistories(),id=key(state), entries=histories.get(id)??[];
  // Acquisition facts name receipt IDs; the full state also binds their actual
  // definitions. Different recipes may otherwise share the same generic prefix.
  if (serialized!==undefined || state.phase!=='combat' || state.combat?.tick===0)
    histories.set('snapshot:'+(serialized??canonicalContent(state)),[{seed:state.seed,battles,resourcePrefix:[]}]);
  // Keep separate genuine branches with identical round summaries (e.g. an
  // extra bench equip). Selection is only a fixture lookup; production replay
  // still verifies the chosen complete proof against every candidate.
  if(entries.some(entry=>entry.battles.at(-1)===battles.at(-1)))return;
  entries.push({seed:state.seed,battles,resourcePrefix:state.resourceProvenance.entries.map(canonicalContent)});
  histories.set(id,entries);
}
export function historyFor(state: MatchState): readonly BattleRecord[] {
  if (!state || !Array.isArray(state.roundResults) || !state.resourceProvenance || !Array.isArray(state.resourceProvenance.entries)) return [];
  const count=state.roundResults.filter(result=>result.roundKind!=='supply').length;
  const known = direct.get(state);
  if (known && known.length===count) return known;
  const histories=scopedHistories();
  // Accessor inputs retain production's evaluation path; ordinary JSON clones
  // can use the complete content address of their genuine fixture snapshot.
  if (Object.values(Object.getOwnPropertyDescriptors(state)).every(descriptor=>'value' in descriptor)) {
    const exact=histories.get('snapshot:'+canonicalContent(state))?.[0];
    if(exact && exact.battles.length===count)return exact.battles;
  }
  const entries=(histories.get(key(state))??[]).filter(entry=>entry.battles.length===count),resources=state.resourceProvenance.entries.map(canonicalContent);
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
export function carryHistory(before: MatchState, after: MatchState): void {
  const battles = historyFor(before);
  direct.set(after, battles);
  if (before.augmentProgress !== after.augmentProgress || before.persistentGrowth !== after.persistentGrowth)
    registerHistory(after, battles);
}
export function observeHistory(history: BattleHistory, before: MatchState, result: MatchCommandResult | MatchStep): void {
  registerHistory(before,history.completedRecords);
  history.observe({before,after:result.state,
    events:('events' in result?result.events:[]).filter(e=>e.domain==='combat'),reason:before.combat?'tick':'command'});
  registerHistory(result.state,history.completedRecords);
}
function candidateHistory(state: MatchState): readonly BattleRecord[] {
  // Malformed candidates must reach production's original structural boundary;
  // fixture lookup cannot expand grants or replace its rejection diagnostics.
  try { return historyFor(state); } catch { return []; }
}
export function restoreWithEvidence(input: unknown, battles?: readonly BattleRecord[]): MatchState {
  const state = (typeof input === 'string' ? JSON.parse(input) : input) as MatchState;
  const exact=typeof input==='string'?scopedHistories().get('snapshot:'+input)?.[0]?.battles:undefined;
  const proof=battles ?? exact ?? candidateHistory(state), restored=productionRestore(input,proof);
  bindHistory(restored,proof);
  return restored;
}
export function serializeWithEvidence(state: MatchState, battles?: readonly BattleRecord[]): string {
  const proof=battles ?? candidateHistory(state), text=productionSerialize(state,proof);
  // Publish only AFTER full production validation. Text/object restores of the
  // same genuine preparation then use its own branch, including later choices.
  registerHistory(state,proof,text);
  return text;
}

export { restoreWithEvidence as restoreMatch, serializeWithEvidence as serializeMatch };
export { validateM5Runtime } from '../../src/simulation/serialization';
