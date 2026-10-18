/** Test-only public command adapter. Records emitted battles; never derives a
 * proof from saved settlement facts. Production serialization remains unchanged. */
import * as api from '../../src/simulation/match';
import type { MatchState, MatchCommandResult, MatchStep } from '../../src/simulation/match';
import type { SessionChange, BattleRecord } from '../../src/m6/contracts';
import { CompletedBattleHistory } from './completed-battle-history';
import { historyFor, registerHistory, carryHistory, bindHistory } from './history-evidence';
export * from '../../src/simulation/match';
interface Trace { readonly previous?: Trace; readonly events: SessionChange['events']; readonly command?: SessionChange; readonly battles: readonly BattleRecord[] }
const traces = new WeakMap<MatchState, Trace>();
/** Preserve the genuine in-progress command trace when an immutable fixture
 * cache returns an independent graph. No trace is inferred from save facts. */
export function copyRecordedMatch(state: MatchState): MatchState {
  const copy = structuredClone(state);
  registerHistory(copy,historyFor(state));
  const trace = traces.get(state);
  if (trace) {
    const entries: Trace[] = [];
    for (let cursor: Trace | undefined = trace; cursor; cursor = cursor.previous) entries.push(cursor);
    let detached: Trace | undefined;
    for (const entry of entries.reverse()) {
      // Observed command snapshots must not retain the mutable public graph
      // returned by the first cache caller. Keep only immutable battle prefixes
      // shared; copy the actual observations, including all emitted events.
      const observed = entry.command
        ? structuredClone({events:entry.events,command:entry.command})
        : {events:structuredClone(entry.events)};
      detached = {...observed,battles:entry.battles,...(detached?{previous:detached}:{})};
    }
    if (detached) traces.set(copy,detached);
  }
  return copy;
}
function recorded<T extends (state: MatchState, ...args: never[]) => unknown>(command: T): T {
  return ((before: MatchState, ...args: never[]) => {
    const result = command(before, ...args) as MatchCommandResult | MatchStep;
    if (!result || !('state' in result) || ('ok' in result && !result.ok) || result.state === before) return result;
    const after = result.state, previous = traces.get(before);
    if (!before.combat && after.combat || previous && before.phase === 'combat') {
      const events = ('events' in result ? result.events : []).filter(e => e.domain === 'combat');
      const change: SessionChange = { before, after, events, reason: (command as unknown) === api.stepMatch ? 'tick' : 'command' };
      // Ticks retain emitted events, not thousands of complete transient Match graphs.
      const trace: Trace = { previous: before.combat ? previous : undefined, events,
        ...((command as unknown) !== api.stepMatch ? {command: change} : {}), battles: previous?.battles ?? historyFor(before) };
      traces.set(after, trace);
      bindHistory(after, trace.battles);
      if (trace.command && after.combat?.status !== 'finished') registerHistory(after, trace.battles);
      if (after.combat?.status === 'finished') {
        const entries: Trace[] = [];
        for (let cursor: Trace | undefined = trace; cursor; cursor = cursor.previous) entries.push(cursor);
        const history = new CompletedBattleHistory('public-command-fixture', trace.battles);
        let pending: SessionChange['events'][number][] = [];
        for (const entry of entries.reverse()) {
          if (entry.command) {
            history.observe({...entry.command, events: [...pending, ...entry.events]}); pending = [];
          } else pending.push(...entry.events);
        }
        if (!trace.command) history.observe({...change, events: pending});
        registerHistory(after, history.completedRecords);
        traces.delete(after);
      }
    } else if (previous) traces.set(after, previous);
    if (!after.combat || before.combat?.status === 'finished' && after.combat.status === 'finished')
      carryHistory(before, after);
    return result;
  }) as T;
}
export const deployMatchUnit: typeof api.deployMatchUnit = recorded(api.deployMatchUnit);
export const lockMatchCombatRoster: typeof api.lockMatchCombatRoster = recorded(api.lockMatchCombatRoster);
export const autoDeployToCap: typeof api.autoDeployToCap = recorded(api.autoDeployToCap);
export const buyUnit: typeof api.buyUnit = recorded(api.buyUnit);
export const sellUnit: typeof api.sellUnit = recorded(api.sellUnit);
export const setShopLock: typeof api.setShopLock = recorded(api.setShopLock);
export const rerollShop: typeof api.rerollShop = recorded(api.rerollShop);
export const buyXp: typeof api.buyXp = recorded(api.buyXp);
export const startMatchCombat: typeof api.startMatchCombat = recorded(api.startMatchCombat);
export const stepMatch: typeof api.stepMatch = recorded(api.stepMatch);
export const finishCarouselSupply: typeof api.finishCarouselSupply = recorded(api.finishCarouselSupply);
export const nextRound: typeof api.nextRound = recorded(api.nextRound);
export const advanceMultiplayerRound: typeof api.advanceMultiplayerRound = recorded(api.advanceMultiplayerRound);
export const useConsumable: typeof api.useConsumable = recorded(api.useConsumable);
export const combineItems: typeof api.combineItems = recorded(api.combineItems);
export const equipItem: typeof api.equipItem = recorded(api.equipItem);
export const selectAnomalyTarget: typeof api.selectAnomalyTarget = recorded(api.selectAnomalyTarget);
export const rerollAnomaly: typeof api.rerollAnomaly = recorded(api.rerollAnomaly);
export const forfeitPendingChoice: typeof api.forfeitPendingChoice = recorded(api.forfeitPendingChoice);
export const claimOrDiscardLoot: typeof api.claimOrDiscardLoot = recorded(api.claimOrDiscardLoot);
export const selectChoice: typeof api.selectChoice = recorded(api.selectChoice);
export const chooseG23Junker: typeof api.chooseG23Junker = recorded(api.chooseG23Junker);
export const chooseG23BlackMarket: typeof api.chooseG23BlackMarket = recorded(api.chooseG23BlackMarket);
export const claimG23Reward: typeof api.claimG23Reward = recorded(api.claimG23Reward);
