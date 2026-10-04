import type { ResolvedAbility } from './ability-types';
import type { ResolvedUnitStats } from './unit-types';
import type {
  Effect, EffectAction, EffectInvocation, EffectRuntime, EffectSource, Hook,
  ResolvedTrigger, SourceKind, SourcedEffect, Stat,
} from './strategy-types';

const SOURCE_ORDER: Readonly<Record<SourceKind, number>> = {
  trait: 0, item: 1, augment: 2, anomaly: 3, enemyGrowth: 4,
};
const STAT_NAMES: readonly Stat[] = ['maxHp', 'attackDamage', 'armor', 'magicResist', 'initialMana', 'abilityAmount'];
const HOOKS: readonly Hook[] = ['combatStart', 'onAttack', 'onCast', 'onHpLoss'];
const compareAscii = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

export function sourceRank(kind: SourceKind): number { return SOURCE_ORDER[kind]; }

/** Owner order dominates kind order, including the tick-zero hook batch. */
export function compareEffectSources(a: EffectSource, b: EffectSource): number {
  return compareAscii(a.ownerId, b.ownerId) || sourceRank(a.sourceKind) - sourceRank(b.sourceKind)
    || compareAscii(a.sourceDefinitionId, b.sourceDefinitionId)
    || compareAscii(a.sourceInstanceId, b.sourceInstanceId) || a.effectIndex - b.effectIndex;
}

export function compareSourcedEffects(a: SourcedEffect, b: SourcedEffect): number {
  return compareEffectSources(a.source, b.source);
}

/** Tuple encoding keeps distinct namespaces/instances unambiguous even with punctuation in IDs. */
export function effectKey(source: EffectSource): string {
  return JSON.stringify([source.ownerId, source.sourceKind, source.sourceDefinitionId, source.sourceInstanceId, source.effectIndex]);
}

function integer(value: number, minimum = 0): number {
  if (!Number.isSafeInteger(value) || value < minimum) throw new RangeError('Effect values must be safe nonnegative integers');
  return value;
}
function add(a: number, b: number): number { return integer(a + b); }
function multiply(a: number, b: number): number { return integer(a * b); }

export function cloneAction(action: EffectAction): EffectAction {
  integer(action.amount);
  switch (action.kind) {
    case 'grantShield': return { kind: action.kind, amount: action.amount, durationTicks: integer(action.durationTicks, 1) };
    case 'gainMana': return { kind: action.kind, amount: action.amount };
    case 'dealDamage':
      if (action.damageType !== 'physical' && action.damageType !== 'magic') throw new RangeError('Unknown effect damage type');
      return { kind: action.kind, amount: action.amount, damageType: action.damageType };
    default: throw new RangeError('Unknown effect action');
  }
}

/** Finite primitive validation also protects callers compiling custom content. */
export function cloneEffect(effect: Effect): Effect {
  switch (effect.kind) {
    case 'statFlat':
      if (!STAT_NAMES.includes(effect.stat)) throw new RangeError('Unknown effect stat');
      return { kind: effect.kind, stat: effect.stat, amount: integer(effect.amount) };
    case 'statPercentBps':
      if (!STAT_NAMES.includes(effect.stat) || (effect.stat as Stat) === 'initialMana') throw new RangeError('Unsupported percent stat');
      return { kind: effect.kind, stat: effect.stat, bps: integer(effect.bps) };
    case 'attackSpeedBps': return { kind: effect.kind, bps: integer(effect.bps) };
    case 'trigger': {
      if (!HOOKS.includes(effect.hook)) throw new RangeError('Unknown effect hook');
      integer(effect.everyN, 1);
      const action = cloneAction(effect.action);
      if ((effect.hook === 'combatStart' && (effect.everyN !== 1 || action.kind === 'dealDamage'))
        || (effect.hook === 'onHpLoss' && action.kind !== 'gainMana')) throw new RangeError('Unsupported hook/action combination');
      return { kind: effect.kind, hook: effect.hook, everyN: effect.everyN, action };
    }
    default: throw new RangeError('Unknown effect primitive');
  }
}

export function makeSourcedEffects(ownerId: string, sourceKind: SourceKind, sourceDefinitionId: string,
  sourceInstanceId: string, effects: readonly Effect[]): SourcedEffect[] {
  return effects.map((effect, effectIndex) => {
    const source: EffectSource = { ownerId, sourceKind, sourceDefinitionId, sourceInstanceId, effectIndex };
    return { key: effectKey(source), source, effect: cloneEffect(effect) };
  });
}

export interface ResolvedEffects {
  readonly stats: ResolvedUnitStats;
  readonly ability: ResolvedAbility;
  readonly sources: readonly SourcedEffect[];
  readonly triggers: readonly ResolvedTrigger[];
}

/** Star scaling has already happened. Flats precede one summed percentage and one final floor. */
export function resolveEffects(baseStats: ResolvedUnitStats, baseAbility: ResolvedAbility,
  input: readonly SourcedEffect[]): ResolvedEffects {
  const sources = input.map(({ key, source, effect }) => ({ key, source: { ...source }, effect: cloneEffect(effect) }))
    .sort(compareSourcedEffects);
  const seen = new Set<string>();
  const flat: Record<Stat, number> = { maxHp: 0, attackDamage: 0, armor: 0, magicResist: 0, initialMana: 0, abilityAmount: 0 };
  const percent = { ...flat };
  let speed = 0;
  const triggers: ResolvedTrigger[] = [];
  for (const sourced of sources) {
    if (sourced.key !== effectKey(sourced.source) || seen.has(sourced.key)) throw new RangeError('Invalid or duplicate effect key');
    seen.add(sourced.key);
    const { effect } = sourced;
    switch (effect.kind) {
      case 'statFlat': flat[effect.stat] = add(flat[effect.stat], effect.amount); break;
      case 'statPercentBps': percent[effect.stat] = add(percent[effect.stat], effect.bps); break;
      case 'attackSpeedBps': speed = add(speed, effect.bps); break;
      case 'trigger': triggers.push({ key: sourced.key, source: { ...sourced.source }, hook: effect.hook,
        everyN: effect.everyN, action: cloneAction(effect.action) }); break;
    }
  }
  if (Object.values(percent).some(value => value > 40000) || speed > 20000) throw new RangeError('Effect stacking bound exceeded');
  const stat = (name: Exclude<Stat, 'initialMana'>, base: number, minimum = 0): number =>
    Math.max(minimum, Math.floor(multiply(add(integer(base), flat[name]), add(10000, percent[name])) / 10000));
  const stats: ResolvedUnitStats = {
    ...baseStats,
    health: stat('maxHp', baseStats.health, 1), attack: stat('attackDamage', baseStats.attack),
    armor: stat('armor', baseStats.armor), magicResist: stat('magicResist', baseStats.magicResist),
    initialMana: Math.min(integer(baseStats.maxMana, 1), add(integer(baseStats.initialMana), flat.initialMana)),
    attackIntervalTicks: Math.max(1, Math.ceil(multiply(integer(baseStats.attackIntervalTicks, 1), 10000) / add(10000, speed))),
  };
  const ability = { ...baseAbility, amount: stat('abilityAmount', baseAbility.amount) };
  return { stats, ability, sources, triggers };
}

function copyTrigger(trigger: ResolvedTrigger): ResolvedTrigger {
  return { key: trigger.key, source: { ...trigger.source }, hook: trigger.hook,
    everyN: trigger.everyN, action: cloneAction(trigger.action) };
}

export function initializeEffectRuntime(triggers: readonly ResolvedTrigger[]): EffectRuntime[] {
  const keys = triggers.map(trigger => trigger.key).sort(compareAscii);
  if (new Set(keys).size !== keys.length) throw new RangeError('Duplicate trigger key');
  return keys.map(key => ({ key, count: 0 }));
}

/** One call represents one primary action (or one aggregate HP-loss tick), never a derived packet.
 * The caller enforces alive-snapshot and phase barriers. This function does not apply or recurse effects.
 */
export function collectTriggers(triggers: readonly ResolvedTrigger[], runtime: readonly EffectRuntime[],
  hook: Hook, ownerId: string, primaryEnemyId: string | null): {
    readonly runtime: readonly EffectRuntime[]; readonly invocations: readonly EffectInvocation[];
  } {
  const counts = new Map<string, number>();
  for (const counter of runtime) {
    if (counts.has(counter.key)) throw new RangeError('Duplicate effect runtime');
    counts.set(counter.key, integer(counter.count));
  }
  const invocations: EffectInvocation[] = [];
  const matching = triggers.filter(trigger => trigger.hook === hook && trigger.source.ownerId === ownerId)
    .sort((a, b) => compareEffectSources(a.source, b.source));
  const seen = new Set<string>();
  for (const trigger of matching) {
    if (seen.has(trigger.key)) throw new RangeError('Duplicate trigger key');
    seen.add(trigger.key);
    integer(trigger.everyN, 1);
    const count = add(counts.get(trigger.key) ?? 0, 1);
    counts.set(trigger.key, count);
    if (count % trigger.everyN !== 0) continue;
    const targetId = trigger.action.kind === 'dealDamage' ? primaryEnemyId : ownerId;
    if (targetId === null) continue;
    invocations.push({ trigger: copyTrigger(trigger), targetId, action: cloneAction(trigger.action) });
  }
  return {
    runtime: [...counts].sort(([a], [b]) => compareAscii(a, b)).map(([key, count]) => ({ key, count })),
    invocations,
  };
}
