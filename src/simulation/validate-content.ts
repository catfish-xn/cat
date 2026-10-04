import { ABILITY_DEFINITIONS, validateAbilityDefinitions } from './combat-abilities';
import { UNIT_DEFINITIONS, validateUnitDefinitions } from './units';
import { SHOP_CATALOG_BY_COST, SHOP_ODDS, XP_TO_NEXT_LEVEL } from './match-rules';
import { TRAIT_DEFINITIONS } from './content/traits';
import { ITEM_DEFINITIONS } from './content/items';
import { AUGMENT_DEFINITIONS } from './content/augments';
import { ANOMALY_DEFINITIONS } from './content/anomalies';
import { ROUND_SCHEDULE } from './round-schedule';
import type { AbilityDefinition } from './ability-types';
import type { CostTier, UnitDefinition } from './unit-types';
import type { ChoiceDefinition, Effect, ItemDefinition, ScheduleEvent, Stat, TraitDefinition } from './strategy-types';

export interface ContentCatalogs {
  readonly units: Readonly<Record<string, UnitDefinition>>;
  readonly abilities: Readonly<Record<string, AbilityDefinition>>;
  readonly traits: Readonly<Record<string, TraitDefinition>>;
  readonly items: Readonly<Record<string, ItemDefinition>>;
  readonly augments: Readonly<Record<string, ChoiceDefinition>>;
  readonly anomalies: Readonly<Record<string, ChoiceDefinition>>;
  readonly shopCatalog: Readonly<Record<CostTier, readonly string[]>>;
  readonly schedule: {
    readonly fixed: readonly { readonly round: number; readonly event: ScheduleEvent }[];
    readonly recurring: { readonly fromRound: number; readonly everyRounds: number; readonly randomComponents: number };
    readonly fallbackDefinitionId: string;
  };
}
const STATS: readonly Stat[] = ['maxHp', 'attackDamage', 'armor', 'magicResist', 'initialMana', 'abilityAmount'];
const HOOKS = ['combatStart', 'onAttack', 'onCast', 'onHpLoss'];
const integer = (value: unknown, minimum = 0): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
const fail = (message: string): never => { throw new RangeError(message); };
const keysAre = (value: object, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));
function finiteJson(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return;
  if (typeof value !== 'object' || value === null || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) || ancestors.has(value)) fail('Content must be finite plain integer JSON');
  if (Object.getOwnPropertySymbols(value as object).length) fail('Content cannot contain symbol keys');
  if (Array.isArray(value)) for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) fail('Content cannot contain sparse arrays');
  ancestors.add(value as object);
  for (const child of Object.values(value as object)) finiteJson(child, ancestors);
  ancestors.delete(value as object);
}
function ids<T extends { readonly id: string }>(catalog: Readonly<Record<string, T>>, kind: string): void {
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) fail(`Invalid ${kind} catalog`);
  for (const [id, entry] of Object.entries(catalog)) {
    if (!entry || entry.id !== id || !/^[a-z][a-z0-9-]*$/.test(id)) fail(`Invalid ${kind} ID: ${id}`);
  }
}
export function validateEffect(effect: Effect): void {
  if (!effect || typeof effect !== 'object') fail('Invalid effect');
  switch (effect.kind) {
    case 'statFlat':
      if (!keysAre(effect, ['kind', 'stat', 'amount']) || !STATS.includes(effect.stat) || !integer(effect.amount)) fail('Invalid flat stat');
      return;
    case 'statPercentBps':
      if (!keysAre(effect, ['kind', 'stat', 'bps']) || !STATS.includes(effect.stat) || (effect.stat as string) === 'initialMana' || !integer(effect.bps) || effect.bps > 40000) fail('Invalid percent stat');
      return;
    case 'attackSpeedBps':
      if (!keysAre(effect, ['kind', 'bps']) || !integer(effect.bps) || effect.bps > 20000) fail('Invalid attack speed');
      return;
    case 'trigger': {
      if (!keysAre(effect, ['kind', 'hook', 'everyN', 'action']) || !HOOKS.includes(effect.hook) || !integer(effect.everyN, 1)
        || (effect.hook === 'combatStart' && effect.everyN !== 1) || !effect.action || !integer(effect.action.amount)) fail('Invalid trigger');
      const action = effect.action;
      if (action.kind === 'gainMana') {
        if (!keysAre(action, ['kind', 'amount'])) fail('Invalid mana action');
      } else if (action.kind === 'grantShield') {
        if (!keysAre(action, ['kind', 'amount', 'durationTicks']) || effect.hook === 'onHpLoss' || !integer(action.durationTicks, 1)
          || !integer(action.durationTicks + 1200)) fail('Invalid shield action');
      } else if (action.kind === 'dealDamage') {
        if (!keysAre(action, ['kind', 'amount', 'damageType']) || !['onAttack', 'onCast'].includes(effect.hook)
          || !['physical', 'magic'].includes(action.damageType)) fail('Invalid damage action');
      } else fail('Unknown effect action');
      return;
    }
    default: fail('Unknown effect primitive');
  }
}
function effects(effects: readonly Effect[]): void {
  if (!Array.isArray(effects) || effects.length === 0) fail('Empty or invalid effects');
  for (const effect of effects) validateEffect(effect);
}

/** Upper bounds honor three repeatable slots, two distinct augments, one anomaly and applicable tiers. */
export function validateStatBounds(content: ContentCatalogs): void {
  const items = Object.values(content.items).map(item => item.effects);
  const augments = Object.values(content.augments).map(augment => augment.effects);
  const anomalies = Object.values(content.anomalies).map(anomaly => anomaly.effects);
  const sum = (effects: readonly Effect[], measure: (effect: Effect) => number) => {
    const value = effects.reduce((total, effect) => total + measure(effect), 0);
    if (!integer(value)) fail('Effect sum overflow');
    return value;
  };
  const largest = (groups: readonly (readonly Effect[])[], measure: (effect: Effect) => number, count: number) =>
    groups.map(effects => sum(effects, measure)).sort((a, b) => b - a).slice(0, count).reduce((a, b) => a + b, 0);
  for (const unit of Object.values(content.units)) {
    const traits = Object.values(content.traits).filter(trait => trait.target === 'team' || unit.traits.includes(trait.id));
    const upper = (measure: (effect: Effect) => number) => {
      const traitAmount = traits.reduce((total, trait) => total + Math.max(...trait.tiers.map(tier => sum(tier.effects, measure))), 0);
      const value = traitAmount + 3 * largest(items, measure, 1) + largest(augments, measure, 2) + largest(anomalies, measure, 1);
      if (!integer(value)) fail(`Stacked effect overflow: ${unit.id}`);
      return value;
    };
    const speed = upper(effect => effect.kind === 'attackSpeedBps' ? effect.bps : 0);
    if (speed > 20000 || !integer(unit.attackIntervalTicks * 10000)) fail(`Attack speed bound exceeded: ${unit.id}`);
    const ability = content.abilities[unit.abilityId];
    const base: Record<Stat, number> = {
      maxHp: Math.floor(unit.baseStats.health * 324 / 100), attackDamage: Math.floor(unit.baseStats.attack * 324 / 100),
      armor: unit.baseStats.armor, magicResist: unit.baseStats.magicResist, initialMana: unit.initialMana,
      abilityAmount: Math.max(...ability.amountByStar),
    };
    if (![unit.baseStats.health * 324, unit.baseStats.attack * 324].every(Number.isSafeInteger)) fail(`Star scaling overflow: ${unit.id}`);
    const resolved: Partial<Record<Stat, number>> = {};
    for (const stat of STATS) {
      const flat = upper(effect => effect.kind === 'statFlat' && effect.stat === stat ? effect.amount : 0);
      const percent = upper(effect => effect.kind === 'statPercentBps' && effect.stat === stat ? effect.bps : 0);
      if (percent > 40000 || !integer(base[stat] + flat) || !integer((base[stat] + flat) * (10000 + percent))) fail(`Stat bound exceeded: ${unit.id}/${stat}`);
      resolved[stat] = Math.floor((base[stat] + flat) * (10000 + percent) / 10000);
    }
    // At most 56 board cells can contribute packets in one tick. Armor uses raw * 100.
    const hookDamage = upper(effect => effect.kind === 'trigger' && effect.action.kind === 'dealDamage' ? effect.action.amount : 0);
    const hookMana = upper(effect => effect.kind === 'trigger' && effect.action.kind === 'gainMana' ? effect.action.amount : 0);
    const shield = upper(effect => effect.kind === 'trigger' && effect.action.kind === 'grantShield' ? effect.action.amount : 0);
    if (!integer(((resolved.attackDamage ?? 0) + (resolved.abilityAmount ?? 0) + hookDamage) * 100 * 56)
      || !integer(hookMana + unit.maxMana + 30) || !integer(shield)) fail(`Combat arithmetic bound exceeded: ${unit.id}`);
  }
}

/** Startup/CI validation; injected catalogs allow negative and data-extension tests. */
export function validateContent(overrides: Partial<ContentCatalogs> = {}): void {
  const content: ContentCatalogs = { units: UNIT_DEFINITIONS, abilities: ABILITY_DEFINITIONS, traits: TRAIT_DEFINITIONS,
    items: ITEM_DEFINITIONS, augments: AUGMENT_DEFINITIONS, anomalies: ANOMALY_DEFINITIONS,
    shopCatalog: SHOP_CATALOG_BY_COST, schedule: ROUND_SCHEDULE, ...overrides };
  finiteJson(content);
  for (const kind of ['units', 'abilities', 'traits', 'items', 'augments', 'anomalies'] as const) ids<{ readonly id: string }>(content[kind], kind);
  if (Object.keys(overrides).length === 0) {
    for (const [kind, expected] of Object.entries({ units: 18, abilities: 11, traits: 6, items: 20, augments: 8, anomalies: 8 })) {
      if (Object.keys(content[kind as keyof Pick<ContentCatalogs, 'units' | 'abilities' | 'traits' | 'items' | 'augments' | 'anomalies'>]).length !== expected) fail(`Incorrect slice ${kind} count`);
    }
  }
  validateUnitDefinitions(content.units, content.shopCatalog);
  validateAbilityDefinitions(content.abilities);
  for (const cost of [1, 2, 3, 4, 5] as const) {
    const values = content.shopCatalog[cost];
    if (values.join('|') !== [...values].sort().join('|')) fail(`Unsorted shop tier: ${cost}`);
  }
  for (const unit of Object.values(content.units)) {
    if (!Object.hasOwn(content.abilities, unit.abilityId)) fail(`Missing ability: ${unit.abilityId}`);
    for (const trait of unit.traits) if (!Object.hasOwn(content.traits, trait)) fail(`Missing trait: ${trait}`);
  }
  for (const trait of Object.values(content.traits)) {
    if (!trait.name || !['members', 'team'].includes(trait.target) || !Array.isArray(trait.tiers) || trait.tiers.length === 0) fail(`Invalid trait: ${trait.id}`);
    const members = Object.values(content.units).filter(unit => unit.traits.includes(trait.id)).length;
    let previous = 0;
    for (const tier of trait.tiers) {
      if (!integer(tier.threshold, previous + 1) || tier.threshold > members || tier.threshold > 9) fail(`Unreachable or unordered trait tier: ${trait.id}`);
      previous = tier.threshold;
      effects(tier.effects);
    }
  }
  const components = Object.values(content.items).filter(item => item.kind === 'component').map(item => item.id).sort();
  if (components.length !== 5) fail('The slice requires five obtainable components');
  const recipes = new Set<string>();
  for (const item of Object.values(content.items)) {
    if (!item.name) fail(`Missing item name: ${item.id}`);
    effects(item.effects);
    if (item.kind === 'component') { if (item.recipe !== undefined) fail('Component cannot have recipe'); }
    else if (item.kind === 'completed') {
      if (!Array.isArray(item.recipe) || item.recipe.length !== 2 || item.recipe.some(id => !components.includes(id))) fail(`Invalid recipe: ${item.id}`);
      const pair = [...item.recipe!].sort().join('|');
      if (recipes.has(pair)) fail(`Duplicate recipe: ${pair}`);
      recipes.add(pair);
    } else fail(`Invalid item kind: ${item.id}`);
  }
  for (let a = 0; a < components.length; a++) for (let b = a; b < components.length; b++) {
    if (!recipes.has(`${components[a]}|${components[b]}`)) fail('Missing component pair recipe');
  }
  if (Object.keys(content.augments).length - 1 < 3 || Object.keys(content.anomalies).length - 3 < 3) fail('Choice pool can be exhausted');
  for (const choice of [...Object.values(content.augments), ...Object.values(content.anomalies)]) {
    if (!choice.name || !choice.description) fail(`Invalid choice description: ${choice.id}`);
    effects(choice.effects);
  }
  const seenEvents = new Set<string>();
  let lastRound = 0, lastPriority = -1, lastId = '';
  let randomRewardCount = 0;
  for (const { round, event } of content.schedule.fixed) {
    if (!integer(round, 1) || round < lastRound || !event.id || seenEvents.has(event.id) || !integer(event.priority)
      || (round === lastRound && (event.priority < lastPriority || (event.priority === lastPriority && event.id <= lastId)))) fail('Invalid schedule order or ID');
    seenEvents.add(event.id);
    lastRound = round; lastPriority = event.priority; lastId = event.id;
    if (event.kind === 'reward') {
      if (event.priority !== 10 || !Array.isArray(event.components) || event.components.some(id => !components.includes(id))
        || !integer(event.randomComponents) || !integer(event.gold) || typeof event.recruitIfEmpty !== 'boolean'
        || (event.recruitIfEmpty && round !== 7)) fail('Invalid scheduled reward');
      randomRewardCount += event.randomComponents;
    } else if (event.kind === 'augment') {
      if (event.priority !== 20 || ![2, 5].includes(round)) fail('Invalid augment schedule');
    } else if (event.kind === 'anomaly') {
      if (event.priority !== 30 || round !== 7) fail('Invalid anomaly schedule');
    } else fail('Unknown schedule event');
  }
  const recurring = content.schedule.recurring;
  if (!integer(recurring.fromRound, 1) || !integer(recurring.everyRounds, 1) || !integer(recurring.randomComponents, 1)
    || !Object.hasOwn(content.units, content.schedule.fallbackDefinitionId) || randomRewardCount === 0) fail('Unreachable reward schedule');
  for (const { event } of content.schedule.fixed) {
    const generatedId = /^r([1-9][0-9]*)-reward$/.exec(event.id);
    const generatedRound = generatedId ? Number(generatedId[1]) : 0;
    if (generatedRound >= recurring.fromRound && (generatedRound - recurring.fromRound) % recurring.everyRounds === 0) fail('Recurring schedule ID collision');
  }
  const augmentRounds = content.schedule.fixed.filter(({ event }) => event.kind === 'augment').map(entry => entry.round);
  const anomalyRounds = content.schedule.fixed.filter(({ event }) => event.kind === 'anomaly').map(entry => entry.round);
  if (augmentRounds.join(',') !== '2,5' || anomalyRounds.join(',') !== '7') fail('Incomplete choice schedule');
  if (!content.schedule.fixed.some(({ round, event }) => round === 7 && event.kind === 'reward' && event.recruitIfEmpty && event.gold >= 2)) fail('Anomaly schedule needs recruitment and reroll gold');
  for (let level = 1; level <= 9; level++) {
    const odds = SHOP_ODDS[level];
    if (!odds || odds.length !== 5 || odds.some(value => !integer(value)) || odds.reduce((sum, value) => sum + value, 0) !== 100) fail(`Invalid odds: ${level}`);
    if (level < 9 && !integer(XP_TO_NEXT_LEVEL[level], 1)) fail(`Invalid XP threshold: ${level}`);
  }
  validateStatBounds(content);
}
