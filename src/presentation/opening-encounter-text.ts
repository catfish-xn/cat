/**
 * Opening encounters PR8: the texts the opening-encounter HUD shows (banner, intro card, the reviewable "本局奇遇" entry,
 * the 3-5 wind-up monkey result, Mel's personal threshold and the opening forges' remaining count). Display only: every
 * value is read from the rules' public view (`readOpeningEncounterView`) or my own private progress as the server sent
 * them; nothing here decides a reward, a threshold or an outcome. Pure functions, no DOM, safe for the 3D chunk too.
 */
import { itemDisplayName } from './g23-display';
import { itemDescriptions } from './item-codex';

export type MonkeyOutcome = 'damage' | 'gold' | 'masterwork' | 'components';
/** The public whitelist fields the HUD reads (same shape as the rules' OpeningEncounterView). */
export interface OpeningEncounterDisplay {
  readonly encounterId: string;
  readonly nameZh: string;
  readonly champion: { readonly name_zh: string; readonly name_en?: string } | null;
  readonly descriptionZh: string;
  readonly enabled: boolean;
  readonly statusTextZh: string;
  readonly revealedFacts: readonly { readonly nodeId: string; readonly outcome?: string }[];
}
/** My own Mel threshold progress (`openingMelProgress`), as the private seat view carries it. */
export interface OpeningMelProgressDisplay { readonly thresholdHp: number; readonly thresholdReached: boolean; readonly rewardStatus?: 'waiting-threshold' | 'granted' }
/** My own opening forge count (`openingForgeProgress`). */
export interface OpeningForgeProgressDisplay { readonly forgesGranted: number; readonly forgesPending: number }
/** One `masterworkOptions` row: the offered item instance, its definition and its radiant version. */
export interface MasterworkOptionDisplay { readonly itemId: string; readonly definitionId: string; readonly radiantDefinitionId: string }

export const NOT_ENABLED_TEXT = '效果尚未启用';
export const NO_ENCOUNTER_TITLE = '本局没有奇遇';

/** Reads the public whitelist defensively (an older server sends none; a malformed one is ignored, never thrown). */
export function readOpeningDisplay(value: unknown): OpeningEncounterDisplay | null {
  if (!value || typeof value !== 'object') return null;
  const view = value as Record<string, unknown>;
  if (typeof view.encounterId !== 'string' || typeof view.nameZh !== 'string' || typeof view.statusTextZh !== 'string'
    || typeof view.enabled !== 'boolean' || typeof view.descriptionZh !== 'string' || !Array.isArray(view.revealedFacts)) return null;
  const champion = view.champion && typeof view.champion === 'object' && typeof (view.champion as { name_zh?: unknown }).name_zh === 'string'
    ? view.champion as OpeningEncounterDisplay['champion'] : null;
  return { ...(view as unknown as OpeningEncounterDisplay), champion };
}

export const isNoEncounter = (view: OpeningEncounterDisplay): boolean => view.encounterId === 'none';

/**
 * The status line. Always the rules' `statusTextZh`; a closed encounter (`enabled=false`) must say "效果尚未启用" plainly,
 * so the words are added when the status text does not already carry them.
 */
export function openingStatusText(view: OpeningEncounterDisplay): string {
  if (view.enabled || view.statusTextZh.includes(NOT_ENABLED_TEXT)) return view.statusTextZh;
  return `${view.statusTextZh} · ${NOT_ENABLED_TEXT}`;
}

export interface OpeningBannerText {
  /** Encounter name; "no encounter" has its own title. */
  readonly title: string;
  /** Champion zh name; null for "no encounter" (never invented). */
  readonly champion: string | null;
  readonly description: string;
  readonly status: string;
  /** Closed encounters are styled as such (the status says so too). */
  readonly closed: boolean;
}
export function openingBannerText(view: OpeningEncounterDisplay): OpeningBannerText {
  const none = isNoEncounter(view);
  return { title: none ? NO_ENCOUNTER_TITLE : view.nameZh, champion: none ? null : view.champion?.name_zh ?? null,
    description: view.descriptionZh, status: openingStatusText(view), closed: !view.enabled };
}
/** One line for the compact top banner: 「奇遇名 · 角色」. */
export function openingBannerLine(view: OpeningEncounterDisplay): string {
  const text = openingBannerText(view);
  return text.champion ? `${text.title} · ${text.champion}` : text.title;
}

const MONKEY_TEXT: Readonly<Record<MonkeyOutcome, string>> = {
  damage: '所有存活玩家受到 10 点伤害',
  gold: '所有存活玩家获得 25 金币',
  masterwork: '所有存活玩家获得 1 个杰作升级（拖到单位上，把它的一件装备升级为光明版）',
  components: '所有存活玩家获得 4 件基础装备',
};
/** The 3-5 wind-up monkey result toast; null for anything that is not a revealed monkey outcome. */
export function monkeyToastText(fact: { readonly nodeId: string; readonly outcome?: string } | undefined): string | null {
  if (!fact || fact.nodeId !== '3-5' || !fact.outcome || !Object.hasOwn(MONKEY_TEXT, fact.outcome)) return null;
  return `发条猴子 · ${MONKEY_TEXT[fact.outcome as MonkeyOutcome]}`;
}
/** The revealed 3-5 fact of the view, if any. */
export function monkeyFact(view: OpeningEncounterDisplay | null): { readonly nodeId: string; readonly outcome?: string } | undefined {
  return view?.revealedFacts.find(fact => fact.nodeId === '3-5');
}

/**
 * Mel's personal threshold. Before it: when it triggers; after it: the blessing was granted (its rewards wait as orbs).
 * A server without the reward (no `rewardStatus`) still says the reward is not enabled.
 */
export function melProgressText(progress: OpeningMelProgressDisplay | null | undefined): string | null {
  if (!progress || !Number.isFinite(progress.thresholdHp)) return null;
  if (progress.rewardStatus === undefined) return progress.thresholdReached ? '梅尔的祝福 · 已达门槛（奖励尚未启用）'
    : `梅尔的祝福 · 生命值降到 ${progress.thresholdHp} 及以下时触发（奖励尚未启用）`;
  return progress.thresholdReached ? '梅尔的赐福 · 已获得（奖励在法球里领取）'
    : `梅尔的赐福 · 生命值首次降到 ${progress.thresholdHp} 及以下（仍存活）时获得一次`;
}

/** Mel's 13 blessing branches (Blessing_High_<n>), as the batch A reward pool grants them. */
const MEL_BLESSINGS: Readonly<Record<number, string>> = {
  1: '30 金币', 2: '1 个英雄复制器、2 件基础装备、1 把金铲铲', 4: '4 件基础装备、1 个装备重铸器', 5: '1 个金铲铲冠冕',
  6: '2 件基础装备、1 把金铲铲、1 个装备重铸器、10 金币', 7: '2 副窃贼手套', 8: '2 件基础装备、1 个五费弈子',
  9: '2 个基础装备锻造器、1 把金铲铲、1 口金锅锅', 10: '2 件基础装备、1 口金锅锅、1 个装备重铸器、10 金币',
  11: '50 金币', 12: '2 个金铲铲冠冕', 13: '20 金币、2 个英雄复制器', 14: '8 件基础装备',
};
/** Gold subscription buckets XS/S/M/L/XL/Giga (index = rules bucket). */
const GOLD_BUCKETS = ['极小', '小', '中', '大', '特大', '巨额'] as const;
/** Loot subscription categories in the rules' weight order; 0 is the boot (a visual only, no reward). */
const LOOT_CATEGORIES = ['靴子（空奖励）', '金铲铲', '阶段金币', '辅助装备锻造器', '神器锻造器', '二星弈子', '基础装备', '装备重铸器', '金铲铲冠冕'] as const;

/** One `openingRewardResolved` event as a toast line; null for an outcome this build does not know. */
export function openingRewardText(event: { readonly encounterId: string; readonly outcome: string }, goldOf?: (stage: number, bucket: number) => number): string | null {
  if (event.encounterId === 'mels-blessing') {
    const branch = Number(/^Blessing_High_(\d+)$/.exec(event.outcome)?.[1]);
    return Object.hasOwn(MEL_BLESSINGS, branch) ? `梅尔的赐福 · 获得 ${MEL_BLESSINGS[branch]}（在法球里领取）` : null;
  }
  const match = /^(gold-subscription|loot-subscription)\/stage\/(\d+)\/(\d+)$/.exec(event.outcome);
  if (!match || match[1] !== event.encounterId) return null;
  const stage = Number(match[2]), bucket = Number(match[3]);
  if (match[1] === 'gold-subscription') {
    const name = GOLD_BUCKETS[bucket]; if (!name) return null;
    const gold = goldOf?.(stage, bucket);
    return `金币订阅 · 第 ${stage} 阶段 · ${name}档${gold === undefined ? '' : ` · 所有玩家 +${gold} 金币`}`;
  }
  const category = LOOT_CATEGORIES[bucket]; if (!category) return null;
  return bucket === 0 ? `战利品订阅 · 第 ${stage} 阶段 · 一只靴子砸了下来，什么也没有`
    : `战利品订阅 · 第 ${stage} 阶段 · 所有玩家获得${category}（在法球里领取）`;
}

/** Remaining opening forges (the pending count includes the one open now); null when there is nothing to forge. */
export function forgeProgressText(progress: OpeningForgeProgressDisplay | null | undefined): string | null {
  if (!progress || !Number.isInteger(progress.forgesPending) || progress.forgesPending <= 0) return null;
  return `锻造器 剩余 ${progress.forgesPending}`;
}

/** A masterwork offer as the popup shows it: current item → its radiant version; the id stays the item instance id. */
export function masterworkOffer(option: MasterworkOptionDisplay): { readonly id: string; readonly name: string; readonly description: string } {
  return { id: option.itemId, name: `${itemDisplayName(option.definitionId)} → ${itemDisplayName(option.radiantDefinitionId)}`,
    description: itemDescriptions(option.radiantDefinitionId).join('；') };
}
