import { freezeContent } from './freeze';
import type { ChoiceDefinition } from '../strategy-types';
import type { AugmentGiftSpec } from '../augment-gift-plan';

/** 14.24 fields; the complete dice table is P-B5-82 (2026-10-27), not a claim of a recovered S13 script. */
export const AUGMENT_BATCH5_G5 = freezeContent({
  'expected-unexpectedness': {
    apiName: 'TFT_Augment_ExpectedUnexpectedness', name: '意料之中的意外', tier: 'prismatic' as const,
    description: '现在及3-1、4-1各投掷3个六面骰。三骰相同获得头奖，其余按总点数获得该阶段奖励。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json',
      values: { NumStages: 2, '{03e061af}': 7, '{dae07608}': 20, '{fcb8577b}': 15 } },
  },
  'prismatic-pipeline': {
    apiName: 'TFT_Augment_PrismaticPipeline', name: '棱彩管道', tier: 'prismatic' as const,
    description: '下个非玩家对战回合额外掉落一个标准棱彩法球。取得后自己开启的所有棱彩球加奖：2-1取得加8金币，3-2取得随机加16金币、2个散件或2个5费英雄和6金币。',
    source: { patch: '14.24', archive: 'augments-research-2026-10-23/data/augments-14.24.json', values: { NumRounds: 1 } },
  },
});

export type ExpectedDiceBand = 'economy' | 'units' | 'forge' | 'equipment' | 'jackpot';
export interface ExpectedDiceReward { readonly gold?: number; readonly rerolls?: number; readonly gifts: readonly AugmentGiftSpec[] }
const unit = (cost: 4 | 5, count: number): AugmentGiftSpec => ({ kind: 'random-unit', cost, count });
const tool = (definitionId: string, count = 1): AugmentGiftSpec => ({ kind: 'consumable', definitionId, count });
const anvil = (definitionId: string): AugmentGiftSpec => ({ kind: 'unit', definitionId });
const components = (count: number): AugmentGiftSpec => ({ kind: 'random-item', pool: 'component', count });
/** Gemini's primary S13-labelled alternatives, selected by the user on 2026-10-27; no S14 gold substitutions. */
export const EXPECTED_UNEXPECTEDNESS_REWARDS: Readonly<Record<2 | 3 | 4, Readonly<Record<ExpectedDiceBand, ExpectedDiceReward>>>> = freezeContent({
  2: {
    economy: { rerolls: 7, gifts: [] }, units: { gifts: [unit(4, 2)] },
    forge: { gold: 2, gifts: [anvil('TFT_ArmoryKeyCompleted'), tool('reforger', 3)] },
    equipment: { gold: 2, gifts: [tool('masterwork-upgrade')] },
    jackpot: { gold: 5, gifts: [{ kind: 'item', definitionId: 'TFT_Item_ForceOfNature' }] },
  },
  3: {
    economy: { gold: 15, gifts: [] }, units: { gold: 10, gifts: [tool('TFT_Consumable_ChampionDuplicator_III', 4)] },
    forge: { gold: 2, gifts: [anvil('TFT_ArmoryKeyOrnn')] }, equipment: { gold: 2, gifts: [components(3)] },
    jackpot: { gold: 5, gifts: [{ kind: 'random-item', pool: 'emblem', count: 2 }] },
  },
  4: {
    economy: { gold: 20, gifts: [] }, units: { gifts: [unit(5, 3)] },
    forge: { gold: 2, gifts: [anvil('TFT_ArmoryKeySupport')] },
    equipment: { gold: 2, gifts: [{ kind: 'random-item', pool: 'completed', count: 1 }, components(2)] },
    jackpot: { gold: 5, gifts: [unit(5, 2), tool('TFT_Consumable_NeekosHelp')] },
  },
});

/** P-B5-85: the selection node fixes the bonus table for every subsequent opening.
 * The base table already exists: ORB_BOXES.ultraPlus. Do not replace that shared table. */
export const PRISMATIC_PIPELINE_REWARDS = freezeContent({
  baseTable: 'ultraPlus', early: { gold: 8, gifts: [] as readonly AugmentGiftSpec[] },
  late: [
    { weight: 34, gold: 16, gifts: [] as readonly AugmentGiftSpec[] },
    { weight: 33, gold: 0, gifts: [components(2)] },
    { weight: 33, gold: 6, gifts: [unit(5, 2)] },
  ],
  timing: 'first-subsequent-pve/source-death;bonus-after-complete-opening',
  carrier: 'first-neutral-slot-codepoint/after-its-natural-orb-slots', convention: 'P-B5-85-2026-10-27',
});

export const AUGMENT_BATCH5_G5_DEFINITIONS: Readonly<Record<string, ChoiceDefinition>> = freezeContent(Object.fromEntries(
  Object.entries(AUGMENT_BATCH5_G5).map(([id, row]) => [id, { id, name: row.name, description: row.description,
    effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } }] }]),
));
export const AUGMENT_BATCH5_G5_TIERS = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G5).map(([id, row]) => [id, row.tier])));
export const AUGMENT_BATCH5_G5_API_NAMES = freezeContent(Object.fromEntries(Object.entries(AUGMENT_BATCH5_G5).map(([id, row]) => [id, row.apiName])));
