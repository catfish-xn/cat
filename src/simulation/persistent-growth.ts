import { S13_ABILITY_DATA } from './content/abilities';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { HERO_UNITS } from './content/augment-pool-batch3';
import { resolveFourthStarAbility } from './fourth-star-ability';
import { S13_COMBAT_RULES } from './s13-rules';

/**
 * The one table of everything that writes the persistent attack-damage growth ledger (`MatchState.persistentGrowth`,
 * fed by a combat unit's `runtime.permanentAdBps`). Every validator of that ledger (battle snapshot, PvP receipt, PvE
 * combat input, save structure, combat runtime, resource provenance) asks this module; none keeps its own owner list.
 * Steps are derived from the same content rows the combat writers read, never typed in here.
 *
 * Writers (combat):
 *  - `tristana-ricochet`: her cannonball's ricochet (combat-s13.ts, `ASKillGain`); any Tristana, every star.
 *  - `hero:<augment>`: a hero augment whose `heroCarry` row carries `permanentAdBps` (today Shocking Troll's Trundle,
 *    combat-g2-2.ts), only while the seat owns that augment.
 * Carriers (move growth, add none): star merges (sum), Trench copies (back to their owner), and the unit transforms
 * of {@link GROWTH_TRANSFER_AUGMENTS}, after which a growth entry may sit on any champion.
 */
export interface PersistentGrowthSource {
  readonly id: string;
  readonly definitionId: string;
  /** null: the champion's own ability; otherwise the augment the seat must own. */
  readonly augmentId: string | null;
  readonly stepsBps: readonly number[];
}

/** Same arithmetic as the writer: ability variables are stored ×10000, the gain is applied in bps (×100). */
const abilityStep = (stored: number) => Math.round(stored / 10000 * 100);
const tristanaSteps = (): number[] => {
  const raw = S13_ABILITY_DATA['tristana-ability']!.variables.ASKillGain!;
  const stars = raw.map(value => abilityStep(Math.round(value * 10000)));
  const fourth = abilityStep(resolveFourthStarAbility('tristana', 'tristana-ability').variables.ASKillGain!);
  return [...new Set([...stars, fourth])].filter(step => step > 0).sort((a, b) => a - b);
};
const heroSources = (): PersistentGrowthSource[] => Object.values(AUGMENT_DEFINITIONS).flatMap(definition =>
  definition.effects.flatMap(effect => effect.kind === 'mechanic' && effect.mechanic === 'heroCarry' && (effect.values.permanentAdBps ?? 0) > 0
    ? [{ id: `hero:${definition.id}`, definitionId: HERO_UNITS[effect.values.hero!]!, augmentId: definition.id, stepsBps: [effect.values.permanentAdBps!] }]
    : []));

export const PERSISTENT_GROWTH_SOURCES: readonly PersistentGrowthSource[] = Object.freeze([
  { id: 'tristana-ricochet', definitionId: 'tristana', augmentId: null, stepsBps: tristanaSteps() },
  ...heroSources(),
].map(source => Object.freeze({ ...source, stepsBps: Object.freeze([...source.stepsBps]) })));

/** Augments that transform units in place, so a growth entry can outlive the champion that earned it. */
export const GROWTH_TRANSFER_AUGMENTS: readonly string[] = Object.freeze(['pandoras-bench', 'recombobulator']);

/** Copies merged into one unit at most (a 3-star is nine 1-stars); each copy may have fought every combat. */
const MAX_MERGED_COPIES = 9;

const owned = (augmentIds: Iterable<string>) => new Set(augmentIds);
const applicable = (source: PersistentGrowthSource, augments: ReadonlySet<string>) => source.augmentId === null || augments.has(source.augmentId);

/** Steps a ledger entry on `definitionId` can be made of, for a seat owning `augmentIds`. Empty: no growth allowed. */
export function persistentGrowthSteps(definitionId: string, augmentIds: Iterable<string>): readonly number[] {
  const augments = owned(augmentIds);
  const transferred = GROWTH_TRANSFER_AUGMENTS.some(id => augments.has(id));
  return [...new Set(PERSISTENT_GROWTH_SOURCES.filter(source => applicable(source, augments) && (transferred || source.definitionId === definitionId))
    .flatMap(source => source.stepsBps))].sort((a, b) => a - b);
}

/** Steps one live combat unit can earn this combat: its champion's own source, or its live hero augment. */
export function combatGrowthSteps(championId: string, liveHero: Readonly<Record<string, number>> | undefined): readonly number[] {
  return [...new Set(PERSISTENT_GROWTH_SOURCES.filter(source => source.definitionId === championId
    && (source.augmentId === null || liveHero !== undefined && HERO_UNITS[liveHero.hero!] === championId && liveHero.permanentAdBps === source.stepsBps[0]))
    .flatMap(source => source.stepsBps))].sort((a, b) => a - b);
}

/**
 * Self-chosen safety ceiling (not a game value): one growth event needs one cast and a cast needs at least one tick, so
 * a unit can gain at most `maxTicks × largest step` per combat; a merged unit carries at most nine copies' growth.
 */
export function persistentGrowthCeiling(steps: readonly number[], combats: number, copies = MAX_MERGED_COPIES): number {
  return steps.length === 0 ? 0 : Math.max(1, combats) * S13_COMBAT_RULES.maxTicks * Math.max(...steps) * copies;
}

/** True when `amount` is a sum of the given steps (each used any number of times, at least one in total). */
export function growthRepresentable(amount: number, steps: readonly number[]): boolean {
  if (!Number.isSafeInteger(amount) || amount < 1 || steps.length === 0) return false;
  const smallest = steps[0]!;
  // Shortest-path over residues mod the smallest step: least[r] is the least sum ≡ r; every larger sum ≡ r follows.
  const least = new Array<number>(smallest).fill(Infinity); least[0] = 0;
  const done = new Array<boolean>(smallest).fill(false);
  for (;;) {
    let r = -1;
    for (let i = 0; i < smallest; i++) if (!done[i] && least[i]! < Infinity && (r < 0 || least[i]! < least[r]!)) r = i;
    if (r < 0) break;
    done[r] = true;
    for (const step of steps) { const next = (r + step) % smallest; if (least[r]! + step < least[next]!) least[next] = least[r]! + step; }
  }
  return amount >= least[amount % smallest]!;
}

/** A whole ledger entry: representable, and under the ceiling for the combats fought before `roundOrdinal`. */
export function validLedgerGrowth(amount: number, definitionId: string, augmentIds: Iterable<string>, roundOrdinal: number): boolean {
  const steps = persistentGrowthSteps(definitionId, augmentIds);
  return growthRepresentable(amount, steps) && amount <= persistentGrowthCeiling(steps, roundOrdinal);
}

/** One combat's gain on one unit (a settlement receipt or provenance delta): no merges inside a combat. */
export function validCombatGrowthDelta(amount: number, definitionId: string, augmentIds: Iterable<string>): boolean {
  const steps = persistentGrowthSteps(definitionId, augmentIds);
  return growthRepresentable(amount, steps) && amount <= persistentGrowthCeiling(steps, 1, 1);
}
