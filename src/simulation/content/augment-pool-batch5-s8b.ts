import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

/** 14.24 archive; P-B5-64 (2026-10-27). */
export const AUGMENT_BATCH5_S8B = freezeContent({
  'glorious-evolution': {
    apiName: 'TFT13_Augment_Grant6Cost_Viktor', tier: 'prismatic',
    name: '光荣进化', description: '获得一个适应性头盔。升级9个弈子后，获得维克托和珠光护手。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { NumUpgrades: 9 } },
    gifts: [{ kind: 'item', definitionId: 'adaptive-helm' }] as readonly AugmentGiftSpec[],
  },
} as const);
export const AUGMENT_BATCH5_S8B_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent({
  'glorious-evolution': { id: 'glorious-evolution', name: AUGMENT_BATCH5_S8B['glorious-evolution'].name,
    description: AUGMENT_BATCH5_S8B['glorious-evolution'].description,
    effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } }] },
});
export const AUGMENT_BATCH5_S8B_TIERS = freezeContent({ 'glorious-evolution': 'prismatic' as const });
export const AUGMENT_BATCH5_S8B_API_NAMES = freezeContent({ 'glorious-evolution': 'TFT13_Augment_Grant6Cost_Viktor' });
