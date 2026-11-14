import { createCombatWithEvents, stepCombat, type CombatState, type CombatUnit } from './combat';
import type { CombatInputBasis } from './combat-input';
import type { StrategySnapshot } from './strategy-types';
import { canonicalContent, digestContent, equalValidatedContent } from './content';
import { shareValidatedCombatDeclarations } from './combat-static';
import { M8_VERSION } from './m8/version';

export interface CombatReplayFacts {
  readonly openingDeaths:CombatState['openingDeaths'];
  readonly openingState: CombatState['openingState'];
  readonly tick: number;
  readonly rngState: CombatState['rngState'];
  readonly rngDraws: CombatState['rngDraws'];
  readonly nextActionSeq: CombatState['nextActionSeq'];
  readonly nextEventSeq: CombatState['nextEventSeq'];
  readonly damageContributors: CombatState['damageContributors'];
  readonly nextTriggerEventSeq: CombatState['nextTriggerEventSeq'];
  readonly units: readonly (Pick<CombatUnit, 'targetId' | 'targetEngaged' | 'meleeApproach' | 'mana' | 'manaLockedUntilTick' | 'damageManaRemainderCenti' | 'runtime' | 'shieldLayers' | 'shield' | 'shieldExpiresAtTick' | 'g23' | 'g23Sion' | 'maxHp' | 'maxHpBasis'> & {
    readonly periodicTasks: NonNullable<CombatUnit['mechanismState']>['periodicTasks'];
    readonly abilityContributions: readonly import('./m8/contracts').StatusContribution[];
    readonly abilityStatuses: CombatUnit['statuses'];
    readonly stunStatuses: NonNullable<CombatUnit['mechanismState']>['statuses'];
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
  stateAtSaveTick(): CombatState;
  /** Internal restore comparison: candidate must be admitted finite plain JSON.
   * Does not expose the private replay cursor or retain candidate admission. */
  matchesValidatedAtSaveTick(candidate: CombatState, shareDeclarations?: boolean): boolean;
  /** Internal: all ordinary candidate checks must have completed first. */
  shareValidatedDeclarations(candidate: CombatState): void;
  p2Opening(): readonly Pick<CombatUnit, 'id' | 's13P2Opening'>[];
  atSaveTick(): CombatReplayFacts;
}
function facts(state: CombatState): CombatReplayFacts {
  return structuredClone({ openingDeaths:state.openingDeaths, openingState: state.openingState, tick: state.tick, rngState: state.rngState, rngDraws: state.rngDraws,
    nextActionSeq: state.nextActionSeq, nextEventSeq: state.nextEventSeq,
    damageContributors: state.damageContributors, nextTriggerEventSeq: state.nextTriggerEventSeq, units: state.units.map(unit => ({
    id: unit.id, definitionId: unit.definitionId, mana: unit.mana, targetId: unit.targetId, targetEngaged: unit.targetEngaged, meleeApproach: unit.meleeApproach,
    manaLockedUntilTick: unit.manaLockedUntilTick, damageManaRemainderCenti: unit.damageManaRemainderCenti,
    curseCaster: unit.ability.kind === 's13' && unit.ability.championId === 'morgana',
    buddyTriggered: unit.runtime?.buddyTriggered, castCount: unit.runtime?.castCount,
    reaveBps: unit.g22?.reaveBps ?? 0, reaveUntilTick: unit.g22?.reaveUntilTick ?? 0,
    tasks: unit.tasks ?? [], triggerLedger: unit.triggerLedger,
    runtime: unit.runtime, shieldLayers: unit.shieldLayers, shield: unit.shield, shieldExpiresAtTick: unit.shieldExpiresAtTick,
    g23: unit.g23, g23Sion: unit.g23Sion, maxHp: unit.maxHp, maxHpBasis: unit.maxHpBasis,
    periodicTasks: unit.mechanismState?.periodicTasks ?? [],
    abilityContributions: unit.mechanismState?.statuses.flatMap(g => g.contributions).filter(c => c.source.sourceKind === 'ability') ?? [],
    abilityStatuses: unit.statuses?.filter(s => s.source.sourceKind === 'ability' && !s.activity) ?? [],
    stunStatuses: unit.mechanismState?.statuses.filter(s => s.kind === 'stun') ?? [],
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
// Pure encodings of already authenticated JSON inputs, never candidate runtime
// or admission results. Exact bytes bind every basis/strategy/version field.
const identities = new Map<string, { identity: string; key: string }>();

/** Restore-only: normal combat stepping and save capture never populate this cache.
 * The full authenticated basis, resolved strategy and every format/rules version
 * identify a trajectory. Returned states are detached, including on exact hits.
 * Validators must still compare the current candidate on every invocation. */
export function createRestoreCombatReplay(basis: CombatInputBasis, strategy: StrategySnapshot, tick: number, parsedJsonInput = false): RestoreCombatReplay {
  let initial: CombatState | undefined, openingCopy: CombatState | undefined, result: CombatReplayFacts | undefined;
  let p2Copy: readonly Pick<CombatUnit, 'id' | 's13P2Opening'>[] | undefined;
  let cached: Evidence | undefined, key: string | undefined, identity: string | undefined;
  const lookup = () => {
    if (identity !== undefined) return;
    const inputs = { version: M8_VERSION, basis, strategy };
    // Only the restore boundary's own parsed graph can take the native JSON
    // encoding path. Object inputs retain their original getter/read behavior.
    const encoded = parsedJsonInput ? JSON.stringify({ version: canonicalContent(M8_VERSION), basis, strategy }) : undefined;
    const known = encoded === undefined ? undefined : identities.get(encoded);
    // Inputs are already admitted finite JSON. Canonical keys make a live state
    // and its serialized text share evidence; frozen inputs reuse cached text.
    identity = known?.identity ?? canonicalContent(inputs);
    if (identity.length > MAX_IDENTITY_LENGTH) return;
    key = known?.key ?? digestContent(identity);
    if (encoded !== undefined && encoded.length <= MAX_IDENTITY_LENGTH) {
      if (known) identities.delete(encoded);
      else if (identities.size >= MAX_BATTLES) identities.delete(identities.keys().next().value!);
      identities.set(encoded, { identity, key });
    }
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
  let latest: CombatState | undefined;
  const privateCursor = () => {
    if (latest) return latest;
    lookup();
    let cursor = cached && cached.latest.tick <= tick ? cached.latest : privateOpening();
    while (cursor.tick < tick && cursor.status === 'running') cursor = stepCombat(cursor).state;
    if (key && cursor.tick === tick) {
      if (cached) cached.latest = cursor;
      else {
        if (evidence.size >= MAX_BATTLES) evidence.delete(evidence.keys().next().value!);
        evidence.set(key, { identity: identity!, opening: privateOpening(), latest: cursor });
      }
    }
    return latest = cursor;
  };
  return {
    opening: () => openingCopy ??= structuredClone(privateOpening()),
    stateAtSaveTick: () => structuredClone(privateCursor()),
    matchesValidatedAtSaveTick(candidate, shareDeclarations = false) {
      const expected = privateCursor();
      // Preserve the legacy canonical validation of independently generated
      // evidence, including its errors. The caller has already validated the
      // complete parsed candidate, so equality needs no second text encoding.
      // Comparing here keeps the cursor private and avoids thawing/copying its
      // immutable declarations just to discard the copy after comparison.
      canonicalContent(expected);
      const matches = equalValidatedContent(expected, candidate);
      if (matches && shareDeclarations) shareValidatedCombatDeclarations(candidate, expected);
      return matches;
    },
    shareValidatedDeclarations(candidate) { shareValidatedCombatDeclarations(candidate, privateCursor()); },
    // P2 reads only these facts. Copying the complete opening also copied all
    // declarations, histories and runtime containers on every restored tick.
    p2Opening: () => p2Copy ??= structuredClone(privateOpening().units.map(({ id, s13P2Opening }) => ({ id, s13P2Opening }))),
    atSaveTick() {
      if (result) return result;
      // stepCombat is pure: it detaches dynamic fields and shares only immutable
      // declarations. The private cursor never escapes. Cloning it before each
      // step would thaw and re-intern every declaration on every restored tick.
      // All outward paths deep-copy, including cold computations. Mutating a
      // returned opening/facts can never alter a later invocation's evidence.
      // Copy the compared facts, avoiding an unused clone of all declarations.
      return result = facts(privateCursor());
    },
  };
}
