import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { UnitDefinition } from '../unit-types';

export const CARRY_GOLEM_ID = 'carry-golem';
/** 14.24 TFT_BlueGolem prototype. Fourth rank uses the existing 1.8 HP / 1.5 AD star progression;
 * growth and the fixed loadout are P-B5-83 (2026-10-27), not verified live-server formulas. */
export const CARRY_GOLEM = freezeContent({
  health: [600, 1080, 1944, 3499],
  attackCenti: [5500, 8250, 12375, 18562],
  damage: [300, 480, 750, 1125],
  items: ['crownguard', 'bloodthirster', 'titans-resolve'],
  healthPerStage: 475,
  attackDamageBpsPerStage: 2000,
  maximumStar: 4,
} as const);
export const CARRY_GOLEM_UNIT: UnitDefinition = freezeContent({
  id: CARRY_GOLEM_ID, name: '魔像', symbol: '像', color: 9993582, cost: 1, traits: [],
  summon: { sellable: false, countsTowardPopulation: false, fixedStarStats: true },
  baseStats: { health: 600, attack: 55, armor: 40, magicResist: 40 },
  attackRange: 1, attackIntervalTicks: 37, baseAttackSpeedBps: 5500,
  initialMana: 30, maxMana: 100, abilityId: 'carry-golem-ability',
});
export const AUGMENT_BATCH5_G6 = freezeContent({
  'im-the-carry-now': {
    apiName: 'TFT_Augment_ImTheCarryNow', name: '我成C位了', tier: 'prismatic',
    description: '获得一个【魔像】且它携带着多件量身定做的进攻型装备。它会在每个阶段开始时变得更强。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { '{2d6883d7}': 0.20000000298023224, '{8715634f}': 475, '{92c6e7f9}': null } },
    convention: 'P-B5-83-2026-10-27',
  },
} as const);
export const AUGMENT_BATCH5_G6_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(
  Object.entries(AUGMENT_BATCH5_G6).map(([id, row]) => [id, { id, name: row.name, description: row.description,
    effects: [{ kind: 'mechanic', mechanic: 'carryGolem', values: { enabled: 1 } }] }]),
));
export const AUGMENT_BATCH5_G6_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G6).map(([id, row]) => [id, row.tier])));
export const AUGMENT_BATCH5_G6_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G6).map(([id, row]) => [id, row.apiName])));
