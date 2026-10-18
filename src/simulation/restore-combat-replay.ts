import { createCombatWithEvents, stepCombat, type CombatState, type CombatUnit } from './combat';
import type { CombatInputBasis } from './combat-input';
import type { StrategySnapshot } from './strategy-types';
import { canonicalContent, digestContent } from './content';
import { M8_VERSION } from './m8/version';

export interface CombatReplayFacts {
  readonly tick: number;
  readonly rngState: CombatState['rngState'];
  readonly rngDraws: CombatState['rngDraws'];
  readonly nextActionSeq: CombatState['nextActionSeq'];
  readonly nextEventSeq: CombatState['nextEventSeq'];
  readonly damageContributors: CombatState['damageContributors'];
  readonly nextTriggerEventSeq: CombatState['nextTriggerEventSeq'];
  readonly units: readonly (Pick<CombatUnit, 'runtime' | 'shieldLayers' | 'shield' | 'shieldExpiresAtTick' | 'g23' | 'maxHp' | 'maxHpBasis' | 'currentAnomalyBankGold'> & {
    readonly periodicTasks: NonNullable<CombatUnit['mechanismState']>['periodicTasks'];
    readonly burnStatuses: NonNullable<CombatUnit['mechanismState']>['statuses'];
    readonly activities: NonNullable<CombatUnit['mechanismState']>['activities'];
    readonly exposureBps: number;
    readonly exposureFromTick: number;
    readonly exposureUntilTick: number;
    readonly expansionDamage: Pick<NonNullable<CombatUnit['expansion']>, 'damageDealt' | 'damageTaken' | 'crystalDamage'> | undefined;
    readonly id: string;
    readonly definitionId: string;
    readonly curseCaster: boolean;
    readonly buddyTriggered: boolean | undefined;
    readonly castCount: number | undefined;
    readonly reaveBps: number;
    readonly reaveUntilTick: number;
    readonly tasks: NonNullable<CombatUnit['tasks']>;
    readonly triggerLedger: CombatUnit['triggerLedger'];
  })[];
}
export interface RestoreCombatReplay {
  opening(): CombatState;
  atSaveTick(): CombatReplayFacts;
}
function facts(state: CombatState): CombatReplayFacts {
  return structuredClone({ tick: state.tick, rngState: state.rngState, rngDraws: state.rngDraws,
    nextActionSeq: state.nextActionSeq, nextEventSeq: state.nextEventSeq,
    damageContributors: state.damageContributors, nextTriggerEventSeq: state.nextTriggerEventSeq, units: state.units.map(unit => ({
    id: unit.id, definitionId: unit.definitionId,currentAnomalyBankGold:unit.currentAnomalyBankGold,
    curseCaster: unit.ability.kind === 's13' && unit.ability.championId === 'morgana',
    buddyTriggered: unit.runtime?.buddyTriggered, castCount: unit.runtime?.castCount,
    reaveBps: unit.g22?.reaveBps ?? 0, reaveUntilTick: unit.g22?.reaveUntilTick ?? 0,
    tasks: unit.tasks ?? [], triggerLedger: unit.triggerLedger,
    runtime: unit.runtime, shieldLayers: unit.shieldLayers, shield: unit.shield, shieldExpiresAtTick: unit.shieldExpiresAtTick,
    g23: unit.g23, maxHp: unit.maxHp, maxHpBasis: unit.maxHpBasis,
    periodicTasks: unit.mechanismState?.periodicTasks ?? [],
    burnStatuses: unit.mechanismState?.statuses.filter(s => s.kind === 'burn') ?? [],
    activities: unit.mechanismState?.activities ?? [],
    exposureBps: unit.g22?.exposureBps ?? 0, exposureFromTick: unit.g22?.exposureFromTick ?? 0,
    exposureUntilTick: unit.g22?.exposureUntilTick ?? 0,
    expansionDamage: unit.expansion && { damageDealt: unit.expansion.damageDealt,
      damageTaken: unit.expansion.damageTaken, crystalDamage: unit.expansion.crystalDamage },
  })) });
}
interface Evidence {
  readonly identity: string;
  readonly opening: CombatState;
  latest: CombatState;
}
// Only independently simulated evidence enters this bounded process-local LRU.
// A hash hit also requires the entire encoded input to match, so even a hash
// collision cannot authenticate another battle. No candidate runtime is cached.
const evidence = new Map<string, Evidence>();
const MAX_BATTLES = 8;
const MAX_IDENTITY_LENGTH = 1024 * 1024;

/** Restore-only: normal combat stepping and save capture never populate this cache.
 * The full authenticated basis, resolved strategy and every format/rules version
 * identify a trajectory. Returned states are detached, including on exact hits.
 * Validators must still compare the current candidate on every invocation. */
export function createRestoreCombatReplay(basis: CombatInputBasis, strategy: StrategySnapshot, tick: number): RestoreCombatReplay {
  let initial: CombatState | undefined, openingCopy: CombatState | undefined, result: CombatReplayFacts | undefined;
  let cached: Evidence | undefined, key: string | undefined, identity: string | undefined;
  const lookup = () => {
    if (identity !== undefined) return;
    const inputs = { version: M8_VERSION, basis, strategy };
    // Inputs are already admitted finite JSON. Canonical keys make a live state
    // and its serialized text share evidence; frozen inputs reuse cached text.
    identity = canonicalContent(inputs);
    if (identity.length > MAX_IDENTITY_LENGTH) return;
    key = digestContent(identity);
    const hit = evidence.get(key);
    if (hit?.identity === identity) {
      cached = hit;
      evidence.delete(key); evidence.set(key, hit);
    }
  };
  const privateOpening = () => {
    lookup();
    return initial ??= cached?.opening
      ?? createCombatWithEvents(basis.inputs.preparation, strategy, basis.combatId, basis.battleSeed).state;
  };
  return {
    opening: () => openingCopy ??= structuredClone(privateOpening()),
    atSaveTick() {
      if (result) return result;
      lookup();
      // stepCombat is pure: it detaches dynamic fields and shares only immutable
      // declarations. The private cursor never escapes. Cloning it before each
      // step would thaw and re-intern every declaration on every restored tick.
      let cursor = cached && cached.latest.tick <= tick ? cached.latest : privateOpening();
      while (cursor.tick < tick && cursor.status === 'running') cursor = stepCombat(cursor).state;
      if (key && cursor.tick === tick) {
        if (cached) cached.latest = cursor;
        else {
          if (evidence.size >= MAX_BATTLES) evidence.delete(evidence.keys().next().value!);
          evidence.set(key, { identity: identity!, opening: privateOpening(), latest: cursor });
        }
      }
      // All outward paths deep-copy, including cold computations. Mutating a
      // returned opening/facts can never alter a later invocation's evidence.
      // Copy the compared facts, avoiding an unused clone of all declarations.
      return result = facts(cursor);
    },
  };
}
