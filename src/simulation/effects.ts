import { S13_COMBAT_RULES } from './s13-rules';
import { resolveStat, attackInterval } from './m8/stats';
import type { Stat as M8Stat, StatModifier } from './m8/contracts';
import type { ResolvedAbility } from './ability-types';
import type { ResolvedUnitStats } from './unit-types';
import type { CombatMechanics } from './combat-types';
import type {
  Effect, EffectAction, EffectInvocation, EffectRuntime, EffectSource, Hook,
  ResolvedTrigger, SourceKind, SourcedEffect, Stat,
} from './strategy-types';

const SOURCE_ORDER: Readonly<Record<SourceKind, number>> = {
  attack: -2, ability: -1, trait: 0, item: 1, augment: 2, anomaly: 3, enemyGrowth: 4,
};
const STAT_NAMES: readonly Stat[] = ['maxHp', 'attackDamage', 'armor', 'magicResist', 'initialMana', 'abilityAmount', 'abilityPower'];
const MECHANICS = new Set(['artillery', 'sniper', 'watcher', 'rageblade', 'archangel', 'dragonClaw', 'gargoyle', 'gunblade',
  'extraAttackMana', 'titanic', 'killStreak', 'bulkyBuddies', 'mageArmor', 'glassCannon', 'pumpingUp', 'investment', 'damageAmp', 'acquisitionGold', 'lowCostAllies']);
const MECHANIC_FIELDS: Readonly<Record<string, readonly string[]>> = {
  artillery: ['everyN', 'adBps', 'radius'], sniper: ['damageBpsPerHex'], watcher: ['reductionBps', 'healthyReductionBps', 'thresholdBps'],
  rageblade: ['attackSpeedBps'], archangel: ['periodTicks', 'abilityPower'], dragonClaw: ['periodTicks', 'healMaxHpBps'],
  gargoyle: ['resistPerEnemy'], gunblade: ['selfHealBps', 'allyHealBps'], extraAttackMana: ['amount'], titanic: ['adBps', 'radius'],
  killStreak: ['mana'], bulkyBuddies: ['health', 'shieldMaxHpBps', 'durationTicks'], mageArmor: ['apBps'],
  glassCannon: ['startingHealthBps', 'damageAmpBps'], pumpingUp: ['attackSpeedBpsPerRound'], investment: ['healthPerInterest'],
  damageAmp: ['bps'], acquisitionGold: ['amount'], lowCostAllies: ['count'],
};
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
    case 'mechanic': {
      if (!MECHANICS.has(effect.mechanic)) throw new RangeError('Unknown finite mechanic');
      const fields = MECHANIC_FIELDS[effect.mechanic];
      if (fields.some(key => !Object.hasOwn(effect.values, key))) throw new RangeError('Missing mechanic parameter');
      if (Object.keys(effect.values).some(key => !fields.includes(key) && !['backRowOnly', 'buddyIndex'].includes(key))) throw new RangeError('Unknown mechanic parameter');
      for (const value of Object.values(effect.values)) integer(value);
      for (const key of ['everyN', 'periodTicks', 'durationTicks']) if (Object.hasOwn(effect.values, key)) integer(effect.values[key], 1);
      for (const key of ['reductionBps', 'healthyReductionBps', 'thresholdBps', 'startingHealthBps'])
        if ((effect.values[key] ?? 0) > 10000) throw new RangeError('Invalid bounded percentage');
      if (Object.hasOwn(effect.values, 'radius') && effect.values.radius !== 1) throw new RangeError('Unsupported mechanic radius');
      return { kind: 'mechanic', mechanic: effect.mechanic, values: { ...effect.values } };
    }
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
  sourceInstanceId: string, effects: readonly Effect[], parentItemInstanceId?: string): SourcedEffect[] {
  return effects.map((effect, effectIndex) => {
    const source: EffectSource = { ownerId, sourceKind, sourceDefinitionId, sourceInstanceId, effectIndex, ...(parentItemInstanceId ? { parentItemInstanceId } : {}) };
    return { key: effectKey(source), source, effect: cloneEffect(effect) };
  });
}

export interface ResolvedEffects {
  readonly attackDamageBase?: number;
  readonly attackDamagePercentBps?: number;
  readonly abilityPower?: number;
  readonly mechanics?: CombatMechanics;
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
  const flat: Record<Stat, number> = { maxHp: 0, attackDamage: 0, armor: 0, magicResist: 0, initialMana: 0, abilityAmount: 0, abilityPower: 0 };
  const percent = { ...flat };
  let speed = 0;
  const triggers: ResolvedTrigger[] = [];
  for (const sourced of sources) {
    if (sourced.key !== effectKey(sourced.source) || seen.has(sourced.key)) throw new RangeError('Invalid or duplicate effect key');
    seen.add(sourced.key);
    const { effect } = sourced;
    switch (effect.kind) {
      case 'mechanic': break;
      case 'statFlat': flat[effect.stat] = add(flat[effect.stat], effect.amount); break;
      case 'statPercentBps': percent[effect.stat] = add(percent[effect.stat], effect.bps); break;
      case 'attackSpeedBps': speed = add(speed, effect.bps); break;
      case 'trigger': triggers.push({ key: sourced.key, source: { ...sourced.source }, hook: effect.hook,
        everyN: effect.everyN, action: cloneAction(effect.action) }); break;
    }
  }
  if (Object.values(percent).some(value => value > 40000) || speed > 20000) throw new RangeError('Effect stacking bound exceeded');
  const stat = (name: Exclude<Stat, 'initialMana'>, base: number, minimum = 0): number => {
    if (baseAbility.kind !== 's13' || name === 'abilityAmount')
      return Math.max(minimum, Math.floor(multiply(add(integer(base), flat[name]), add(10000, percent[name])) / 10000));
    const modifiers: StatModifier[] = sources.flatMap(({ effect }) => {
      if ((effect.kind !== 'statFlat' && effect.kind !== 'statPercentBps') || effect.stat !== name) return [];
      return [{ stat: name as M8Stat, unit: effect.kind === 'statFlat' ? 'flat' : 'bps',
        value: { kind: 'constant', amount: effect.kind === 'statFlat' ? effect.amount : effect.bps }, condition: { kind: 'always' }, damageFilter: null }];
    });
    return Math.max(minimum, resolveStat(name as M8Stat, base, modifiers, { holder: { id: 'static', hp: baseStats.health, maxHp: baseStats.health } }));
  };
  const stats: ResolvedUnitStats = {
    ...baseStats,
    health: stat('maxHp', baseStats.health, 1), attack: stat('attackDamage', baseStats.attack),
    armor: stat('armor', baseStats.armor), magicResist: stat('magicResist', baseStats.magicResist),
    initialMana: Math.min(integer(baseStats.maxMana), add(integer(baseStats.initialMana), flat.initialMana)),
    attackIntervalTicks: baseStats.baseAttackSpeedBps === undefined
      ? Math.max(1, Math.ceil(multiply(integer(baseStats.attackIntervalTicks, 1), 10000) / add(10000, speed)))
      : attackInterval(baseStats.baseAttackSpeedBps, speed),
    ...(baseStats.baseAttackSpeedBps === undefined ? {} : { baseAttackSpeedBps: baseStats.baseAttackSpeedBps, attackSpeedBonusBps: speed }),
  };
  const ability = { ...baseAbility, amount: stat('abilityAmount', baseAbility.amount) };
  const abilityPower = stat('abilityPower', S13_COMBAT_RULES.abilityPowerBase);
  const mechanics: CombatMechanics = sources.flatMap(entry => entry.effect.kind === 'mechanic' ? [{
    source: { ownerId: entry.source.ownerId, sourceKind: entry.source.sourceKind, definitionId: entry.source.sourceDefinitionId,
      instanceId: entry.source.sourceInstanceId, effectIndex: entry.source.effectIndex,
      ...(entry.source.parentItemInstanceId ? { parentItemInstanceId: entry.source.parentItemInstanceId } : {}) }, mechanic: entry.effect.mechanic, values: { ...entry.effect.values },
  }] : []);
  const mageArmor = mechanics.filter(m => m.mechanic === 'mageArmor').reduce((sum, m) => sum + Math.floor(abilityPower * (m.values.apBps ?? 0) / 10000), 0);
  const resolvedStats = mageArmor ? { ...stats, armor: stats.armor + mageArmor, magicResist: stats.magicResist + mageArmor } : stats;
  return { stats: resolvedStats, ability, sources, triggers, ...(baseAbility.kind === 's13' ? { abilityPower, mechanics,
    attackDamageBase: baseStats.attack + flat.attackDamage, attackDamagePercentBps: percent.attackDamage } : {}) };
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
