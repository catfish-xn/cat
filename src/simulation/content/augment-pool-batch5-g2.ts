import { freezeContent } from './freeze';
import { CHAMPION_ROLES } from './scrap-lucky-roles';
import type { ChoiceDefinition, Effect } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

/** 14.24 numbers; P-B5-63/70-G2 (2026-10-27) owns the unresolved execution semantics. */
export const AUGMENT_BATCH5_G2 = freezeContent({
  'ghost-of-friends-past': {
    apiName: 'TFT_Augment_GhostOfUnitsPast', name: '老友幽魂', tier: 'prismatic' as const,
    description: '每当己方英雄阵亡，当前和未来队友永久获得5生命值、0.8%攻击力或1法术强度，取决于阵亡英雄的角色。坦克及其他角色给生命，AD类给攻击力，AP类给法强。英雄复制体和复活后的再次阵亡计入，非英雄召唤物不计。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { HealthPerStack: 5, ADPerStack: 0.00800000037997961, APPerStack: 1 } },
    gifts: [] as readonly AugmentGiftSpec[],
    effects: [{ kind: 'mechanic' as const, mechanic: 'ghostFriends', values: { healthFlat: 5, attackDamageBps: 80, abilityPower: 1 } }] as readonly Extract<Effect,{kind:'mechanic'}>[],
  },
  'rebel-resurgence': {
    apiName: 'TFT13_Augment_Rebel', name: '爆蓝之城', tier: 'gold' as const,
    description: '每场对战前5次己方蓝发小队英雄阵亡时，原格召唤低一星的复制体（1星仍按1星），再减400生命，最低100。复制体保留羁绊，不带装备和异常，不占名额也不再召唤。获得1个阿卡丽和1个艾瑞莉娅。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { NumOfUnits: 5, ReducedHealth: 400 } },
    gifts: [{ kind: 'unit', definitionId: 'akali' }, { kind: 'unit', definitionId: 'irelia' }] as readonly AugmentGiftSpec[],
    effects: [{ kind: 'mechanic' as const, mechanic: 'rebelResurgence', values: { count: 5, reducedHealth: 400 } }, { kind: 'mechanic' as const, mechanic: 'acquisitionBundle', values: { enabled: 1 } }] as readonly Extract<Effect,{kind:'mechanic'}>[],
  },
});

export const REBEL_COPY_RULES = freezeContent({ minimumHealth: 100, minimumStar: 1, spawn: 'original-cell-else-nearest-empty-distance-row-column',
  saveAuthority: 'augment-history-v1-independent-server-authority', equipment: false, anomaly: false, traitPulse: 'inherit-current-without-team-retrigger', recursive: false, countsTowardQuota: false, noFreeCell: 'consume-trigger-without-copy' });

/** Native role names come from the archived client; the reward mapping is the approved convention. */
export const GHOST_FRIENDS_ROLES = freezeContent({
  // The older shared role table predates the six-costs. 14.24 en_us TFTSet13_Evolved:
  // TFT13_MissMage / TFT13_Viktor / TFT13_Warwick.
  champions: {...CHAMPION_ROLES, mel: 'APReaper', viktor: 'APCasterViktorS13', warwick: 'ADFighter'} as Readonly<Record<string, string>>,
  ranged: { elise: 'APCaster', swain: 'APCaster', gangplank: 'ADCaster', jayce: 'ADCaster' },
  priority: ['tank', 'AD', 'AP', 'other-health'],
  nonHeroSummons: false, championCopies: true, repeatedDeaths: true, revivalDeaths: 'lethal-before-revival-and-each-later-death',
  futureAllies: 'inherit-team-counters-at-birth-without-readding-captured-copy-health',
});

export const AUGMENT_BATCH5_G2_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(
  Object.entries(AUGMENT_BATCH5_G2).map(([id, row]) => [id, { id, name: row.name, description: row.description, effects: row.effects }]),
));
export const AUGMENT_BATCH5_G2_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G2).map(([id, row]) => [id, row.tier])));
export const AUGMENT_BATCH5_G2_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G2).map(([id, row]) => [id, row.apiName])));
