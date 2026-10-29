import { appendLog, createAppendLog, logValues, type AppendLog } from './append-only-log';
import type { AugmentHistory, AugmentHistoryFact, AugmentHistoryProof } from './augment-history-types';

interface Clock { readonly elapsedMs: number; readonly preparationMs?: number }
type Facts = AppendLog<AugmentHistoryFact> & { readonly clocks: ReadonlyMap<number, Clock> };
interface FactIndex {
  through: number;
  readonly deaths: Map<string, { readonly boundaries: Map<number, number>; readonly events: Map<number, number> }>;
}
const logs = new WeakMap<AugmentHistory, { readonly facts: readonly AugmentHistoryFact[]; readonly log: Facts }>();
const indexes = new WeakMap<readonly AugmentHistoryFact[], FactIndex>();

export function augmentFactLog(history: AugmentHistory): Facts {
  const cached = logs.get(history), descriptor = Object.getOwnPropertyDescriptor(history, 'facts');
  // An ordinary writable property can be replaced by a caller. Never retain an
  // index for the old array in that case. Match inputs otherwise remain immutable.
  let log = cached && (!descriptor || !('value' in descriptor) || descriptor.value === cached.facts && cached.facts.length === cached.log.length)
    ? cached.log : undefined;
  if (!log) {
    const facts = history.facts, seed = createAppendLog(facts);
    let clocks: ReadonlyMap<number, Clock> = new Map();
    for (const fact of seed.entries) clocks = clocksAfter(clocks, fact);
    log = { ...seed, clocks }; logs.set(history, { facts, log });
  }
  return log;
}
function clocksAfter(clocks: ReadonlyMap<number, Clock>, fact: AugmentHistoryFact): ReadonlyMap<number, Clock> {
  if (fact.kind !== 'preparation-time' && fact.kind !== 'acquire') return clocks;
  // At most LIMIT.rounds entries. Combat appends share this immutable map;
  // only sparse clock/acquisition facts copy it, never a tick's fact prefix.
  const next = new Map(clocks), previous = clocks.get(fact.round);
  next.set(fact.round, fact.kind === 'preparation-time' ? { elapsedMs: fact.elapsedMs, preparationMs: fact.elapsedMs }
    : { elapsedMs: fact.preparationElapsedMs, preparationMs: previous?.preparationMs });
  return next;
}
function indexFor(log: Facts): FactIndex {
  let index = indexes.get(log.entries);
  if (!index) {
    index = { through: 0, deaths: new Map() };
    indexes.set(log.entries, index);
  }
  // Index each arena row once, including rows with no deaths. Prefix checks
  // below exclude future rows when a caller revisits an older checkpoint.
  for (; index.through < log.length; index.through++) {
    const fact = log.entries[index.through];
    if (fact.kind === 'deaths') {
      let battle = index.deaths.get(fact.battleId);
      if (!battle) index.deaths.set(fact.battleId, battle = { boundaries: new Map(), events: new Map() });
      if (!battle.boundaries.has(fact.completeThroughTick)) battle.boundaries.set(fact.completeThroughTick, index.through);
      for (const death of fact.deaths) if (!battle.events.has(death.eventSeq)) battle.events.set(death.eventSeq, index.through);
    }
  }
  return index;
}
export function augmentPreparationElapsed(history: AugmentHistory, round: number, preparationOnly = false): number | undefined {
  const clock = augmentFactLog(history).clocks.get(round);
  return preparationOnly ? clock?.preparationMs : clock?.elapsedMs;
}
export function augmentDeathBoundary(history: AugmentHistory, battleId: string | undefined, tick: number | undefined): boolean {
  if (battleId === undefined || tick === undefined) return false;
  const log = augmentFactLog(history), sequence = indexFor(log).deaths.get(battleId)?.boundaries.get(tick);
  return sequence !== undefined && sequence < log.length;
}
export function augmentRecordedDeathEvents(history: AugmentHistory, battleId: string): ReadonlySet<number> {
  const log = augmentFactLog(history), events = indexFor(log).deaths.get(battleId)?.events;
  return new Set(events ? [...events].filter(([, sequence]) => sequence < log.length).map(([event]) => event) : []);
}
function withFacts(history: AugmentHistory, log: Facts, proof?: AugmentHistoryProof): AugmentHistory {
  // Match object-spread semantics even for frozen input: all enumerable own
  // fields become ordinary writable data properties, in the same key order.
  // Skip reading the old facts property; its replacement is already owned here.
  const facts = logValues(log), next = {} as AugmentHistory;
  for (const key of Reflect.ownKeys(history)) {
    if (!Object.getOwnPropertyDescriptor(history, key)!.enumerable) continue;
    const value = key === 'facts' ? facts : key === 'proof' && proof ? proof : Reflect.get(history, key);
    Object.defineProperty(next, key, { value, enumerable: true, configurable: true, writable: true });
  }
  if (proof && !Object.hasOwn(next, 'proof')) Object.defineProperty(next, 'proof', { value: proof, enumerable: true, configurable: true, writable: true });
  logs.set(next, { facts, log });
  return next;
}
export function appendHistoryFact(history: AugmentHistory, row: AugmentHistoryFact): AugmentHistory {
  const before = augmentFactLog(history);
  return withFacts(history, { ...appendLog(before, row), clocks: clocksAfter(before.clocks, row) });
}
export function withHistoryProof(history: AugmentHistory, proof: AugmentHistoryProof): AugmentHistory {
  return withFacts(history, augmentFactLog(history), proof);
}
