import type { UnitDefinition } from '../unit-types';
import type { S13AbilityData } from './abilities';
import { freezeContent } from './freeze';
/** Project bodies: crab is defense-only; wolves/minis are unselectable owner-bound attack agents. */
export const S13_ANOMALY_SUMMON_UNITS: Readonly<Record<string, UnitDefinition>> = freezeContent(Object.fromEntries(
  ['crab', 'wolf', 'mini'].map(kind => ['s13-' + kind, {
    id: 's13-' + kind, name: { crab: '异常螃蟹', wolf: '异常佣狼', mini: '迷你弈子' }[kind]!, symbol: '召', color: 10466749,
    cost: 1, traits: [], summon: { sellable: false, countsTowardPopulation: false },
    baseStats: { health: 1, attack: 0, armor: 0, magicResist: 0 }, attackRange: 1,
    baseAttackSpeedBps: 10000, attackIntervalTicks: 20, initialMana: 0, maxMana: 0, abilityId: 's13-' + kind + '-ability',
    baseCritChanceBps: 0, baseCritMultiplierBps: 14000,
  }])));
export const S13_ANOMALY_SUMMON_ABILITIES: Readonly<Record<string, S13AbilityData>> = freezeContent(Object.fromEntries(
  ['crab', 'wolf', 'mini'].map(kind => ['s13-' + kind + '-ability', { id: 's13-' + kind + '-ability', championId: 's13-' + kind,
    name: '异常召唤体', description: '项目约定：战斗专用身份，无技能或装备继承。', variables: {} }])));
