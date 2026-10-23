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
export interface OpeningMelProgressDisplay { readonly thresholdHp: number; readonly thresholdReached: boolean }
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
 * Mel's personal threshold. Before it: when it triggers; after it: reached. The reward is closed either way and the line
 * says so; it is never shown as claimable or claimed.
 */
export function melProgressText(progress: OpeningMelProgressDisplay | null | undefined): string | null {
  if (!progress || !Number.isFinite(progress.thresholdHp)) return null;
  return progress.thresholdReached ? '梅尔的祝福 · 已达门槛（奖励尚未启用）'
    : `梅尔的祝福 · 生命值降到 ${progress.thresholdHp} 及以下时触发（奖励尚未启用）`;
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
