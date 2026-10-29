import { createHash } from 'node:crypto';
import { vi } from 'vitest';
import * as commands from '../../src/simulation/match';
import * as history from '../../src/simulation/augment-history-restore';
import { canonicalContent } from '../../src/simulation/content';
import type { AugmentHistoryFact } from '../../src/simulation/augment-history-types';
import type { MatchState } from '../../src/simulation/match-types';

type Result = { readonly ok?: boolean; readonly state: MatchState };
type Cached = { readonly result: Result; readonly releaseFacts: () => void };

/** One file's private, deterministic reconstruction work. Never cache candidate
 * admission: validateAugmentHistory still checks every proof, fact and final
 * state. Battle-record replay and live fixture commands always execute normally.
 */
export function installAugmentReplayCommandCache(
  additionalCommands: readonly ('rerollAugment' | 'selectAnomalyTarget' | 'rerollAnomaly' | 'setShopLock')[] = [],
) {
  let frame: { reuse: boolean } | undefined;
  const checkpoint = Symbol('authentic replay checkpoint');
  let warmBudget: number | undefined;
  let recording = true;
  const results = new Map<string, Cached>();
  let facts: readonly AugmentHistoryFact[] = [];
  const states = new WeakMap<MatchState, { key: string; cached?: Cached }>();
  const counts = { hits: 0, misses: 0, executions: 0, recorded: 0, battleStarts: 0, battleTicks: 0 };
  let lastReplayState: MatchState | undefined;
  const digest = (text: string) => createHash('sha256').update(text).digest('hex');
  function remember(result: Result): Cached {
    const h = result.state.augmentHistory;
    if (!h || facts.length > h.facts.length || !facts.every((fact, i) => fact === h.facts[i])) return { result, releaseFacts: () => {} };
    // Tick n has the complete n-row fact array. Retaining all 8,000 such
    // arrays is quadratic storage. Keep one exactly checked append-only prefix
    // and materialize the original dense array only when a result is reused.
    facts = h.facts;
    const length = facts.length;
    let materialized: readonly AugmentHistoryFact[] | undefined = facts;
    // Keep the actual replay state identity: traces AND preparationTimes remain
    // attached to it, as do any other WeakMap observations. Only its private
    // fact-array storage is compacted; no shallow state copies lose side data.
    Object.defineProperty(h, 'facts', { enumerable: true, configurable: true,
      get: () => materialized ??= facts.slice(0, length) });
    return { result, releaseFacts: () => {
      // Production may retain/freeze this exact prefix. Its getter must then
      // keep returning that same frozen array, never a later mutable copy.
      if (!Object.isFrozen(h)) materialized = undefined;
    } };
  }
  function negativeZero(values: readonly unknown[]): boolean {
    const pending = [...values];
    while (pending.length) {
      const value = pending.pop();
      if (Object.is(value, -0)) return true;
      if (value && typeof value === 'object') for (const child of Object.values(value)) pending.push(child);
    }
    return false;
  }
  // A proof containing an unwrapped command stays entirely on the cold path:
  // hashing its JSON result would omit that command's hidden side-table data.
  const names = ['startMatchCombat', 'stepMatch', 'deployMatchUnit', 'nextRound', 'selectChoice',
    'buyUnit', 'rerollShop', 'sellUnit', 'combineItems', 'equipItem', 'buyXp', ...additionalCommands] as const;
  const cacheableCommands = new Set<string>(names);
  const validate = history.validateAugmentHistory;
  const validationSpy = vi.spyOn(history, 'validateAugmentHistory').mockImplementation((...args) => {
    validationSpy.mockClear();
    const previous = frame, proof = args[0].augmentHistory?.proof;
    frame = { reuse: proof?.kind === 'solo' && proof.commands.every(command => cacheableCommands.has(command.name)) };
    try { return validate(...args); } finally { frame = previous; }
  });
  const commandSpies = names.map(name => {
    const run = commands[name] as (state: MatchState, ...args: unknown[]) => Result;
    const spy = vi.spyOn(commands, name).mockImplementation(((state: MatchState, ...args: unknown[]) => {
      // Vitest's call log would otherwise retain every *uncached* live/replay
      // tick too. Only the explicit authentic-prefix cache owns retained states.
      spy.mockClear();
      if (!frame) {
        if (name === 'startMatchCombat') counts.battleStarts++;
        if (name === 'stepMatch') counts.battleTicks++;
        // Live construction and battle archive validation never seed OR read
        // this cache. Equal JSON cannot substitute for live hidden side data.
        return run(state, ...args);
      }
      const execute = () => {
        // A setup hook may yield between real reconstruction commands. Only
        // completed command outputs enter the cache; admission still has to
        // finish the unmodified validator in a later slice.
        if (warmBudget !== undefined && warmBudget-- === 0) throw checkpoint;
        counts.executions++;
        const result = run(state, ...args);
        lastReplayState = result.state;
        return result;
      };
      if (!frame.reuse) return execute();
      // Canonical JSON erases -0; preserve the production proof replay's cold
      // path for that value rather than merging it with a zero-valued origin.
      if (negativeZero(args)) { frame.reuse = false; return execute(); }
      let prefix = states.get(state)?.key;
      if (prefix === undefined) {
        if (negativeZero([state])) { frame.reuse = false; return execute(); }
        prefix = digest(canonicalContent(state)); states.set(state, { key: prefix });
      }
      // Bind the complete origin and ordered command/argument prefix. Derived
      // keys are confined to private, independently reconstructed proof outputs.
      // The proof validator never exposes its intermediate states.
      // Like F5 route hashing, this relies on the public command immutability
      // contract without freezing live inputs or retaining full per-tick text.
      const key = digest(JSON.stringify([prefix, name, args.map(arg =>
        arg === undefined ? ['undefined'] : ['json', canonicalContent(arg)])]));
      const cached = results.get(key);
      if (cached) {
        counts.hits++;
        states.get(state)?.cached?.releaseFacts();
        lastReplayState = cached.result.state;
        return cached.result;
      }
      counts.misses++;
      // Seal after the authentic fixture is reconstructed. A different branch
      // runs normally from its first miss; never retain thousands of states or
      // hash every tick of a deliberately corrupted proof.
      if (!recording) { frame.reuse = false; return execute(); }
      const result = execute();
      if (result.ok !== false && result.state !== state) {
        const cached = remember(result);
        states.set(result.state, { key, cached }); results.set(key, cached); counts.recorded++;
      }
      states.get(state)?.cached?.releaseFacts();
      return result;
    }) as never);
    return spy;
  });
  return {
    counts,
    get lastReplayState() { return lastReplayState; },
    warm(state: MatchState, commandBudget: number): boolean {
      if (!recording || !Number.isSafeInteger(commandBudget) || commandBudget <= 0) throw Error('Invalid replay warm budget');
      warmBudget = commandBudget;
      try {
        // Candidate graphs never become cache entries. The normal validator
        // creates the origin, clones arguments and runs every uncached command.
        history.validateAugmentHistory(structuredClone(state));
        return true;
      } catch (error) {
        if (error !== checkpoint) throw error;
        return false;
      } finally { warmBudget = undefined; }
    },
    seal() { recording = false; },
    resetBattleCounts() { counts.battleStarts = 0; counts.battleTicks = 0; },
    restore() {
      commandSpies.forEach(spy => spy.mockRestore()); validationSpy.mockRestore(); results.clear(); facts = [];
      lastReplayState = undefined;
    },
  };
}
