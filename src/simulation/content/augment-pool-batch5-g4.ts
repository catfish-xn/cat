import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';
import type { UnitDefinition } from '../unit-types';
import type { S13AbilityData } from './abilities';

/** 14.24 archive values; unverified runtime details are P-B5-72 (2026-10-27). */
export const AUGMENT_BATCH5_G4 = freezeContent({
  voidcaller: {
    apiName: 'TFT13_Augment_Visionary', name: '虚空召唤者', tier: 'gold' as const,
    description: '战斗期间，先知们每累计消耗275法力值，召唤一个虚灵，每场至多5个。获得芮尔和莫甘娜。虚灵拥有400–600生命值（基于阶段）。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { Mana: 275, MaxVoidlings: 5, Stage2Health: 400, Stage3Health: 450, Stage4Health: 500, Stage5Health: 550, Stage6Health: 600, '{3bc62dd2}': 60 } },
    gifts: [{ kind: 'unit', definitionId: 'rell' }, { kind: 'unit', definitionId: 'morgana' }] as readonly AugmentGiftSpec[],
  },
  'void-swarm': {
    apiName: 'TFT_Augment_Voidborne', name: '虚空虫群', tier: 'prismatic' as const,
    description: '获得1个兹若特传送门，并在此后每11场玩家对战后再获得1个。传送门和先知召唤的虚灵获得40%攻击速度和40%全能吸血。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { BonusAS: 0.4000000059604645, BonusOmnivamp: 0.4000000059604645, Numberofcombats: 11 } },
    gifts: [{ kind: 'item', definitionId: 'TFT5_Item_ZzRotPortalRadiant' }] as readonly AugmentGiftSpec[],
  },
});
export const B5_G4_VOID_POLICY = freezeContent({
  smallHealth: [400, 450, 500, 550, 600], smallAttack: 60,
  largeHealth: [1000, 1500, 2000, 2500, 3000], largeAttack: [80, 80, 115, 150, 180],
  attackSpeedBps: 8000, armor: 30, magicResist: 30, range: 1,
  swarmAttackSpeedBps: 4000, swarmOmnivampBps: 4000, portalEveryPvp: 11, tauntRadius: 2,
  placement: 'nearest-free-distance-row-column', noSpace: 'consume-threshold-without-summoning',
  portalPlacement: 'combat-start-nearest-free-in-front-of-holder', taunt: 'opening-target-lock-until-target-unavailable',
});
export const AUGMENT_BATCH5_G4_DEFINITIONS = freezeContent<Readonly<Record<string, ChoiceDefinition>>>({
  voidcaller: { id: 'voidcaller', name: AUGMENT_BATCH5_G4.voidcaller.name, description: AUGMENT_BATCH5_G4.voidcaller.description,
    effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } },
      { kind: 'mechanic', mechanic: 'voidcaller', values: { mana: 275, maxVoidlings: 5, health: 400 } }] },
  'void-swarm': { id: 'void-swarm', name: AUGMENT_BATCH5_G4['void-swarm'].name, description: AUGMENT_BATCH5_G4['void-swarm'].description,
    effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } },
      { kind: 'mechanic', mechanic: 'voidSwarm', values: { attackSpeedBps: 4000, omnivampBps: 4000 } }] },
});
export const AUGMENT_BATCH5_G4_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G4).map(([id, row]) => [id, row.tier])));
export const AUGMENT_BATCH5_G4_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G4).map(([id, row]) => [id, row.apiName])));
export const B5_G4_MECHANIC_FIELDS = freezeContent({ voidcaller: ['mana', 'maxVoidlings', 'health'],
  voidSwarm: ['attackSpeedBps', 'omnivampBps'], b5VoidPortal: ['health', 'attack'] });
/** Combat-only body; never a shop, reward, population or permanent unit. */
export const B5_G4_SUMMON_UNITS: Readonly<Record<string, UnitDefinition>> = freezeContent({
  'b5-voidling': { id: 'b5-voidling', name: '虚灵', symbol: '虚', color: 10466749, cost: 1, traits: [],
    summon: { sellable: false, countsTowardPopulation: false, fixedStarStats: true },
    baseStats: { health: 400, attack: 60, armor: 30, magicResist: 30 }, attackRange: 1,
    attackIntervalTicks: 25, baseAttackSpeedBps: 8000, initialMana: 0, maxMana: 0, abilityId: 'b5-voidling-ability' },
});
export const B5_G4_SUMMON_ABILITIES: Readonly<Record<string, S13AbilityData>> = freezeContent({
  'b5-voidling-ability': { id: 'b5-voidling-ability', championId: 'b5-voidling', name: '虚灵普攻', description: '近战普攻，无主动技能。', variables: {} },
});
