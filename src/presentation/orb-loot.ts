/**
 * C18-B: R3/R4 loot presentation (contract §18.4/§18.8). Pure renderers over the server's private seat view: the round's
 * opened orbs (quality tier, server aggregate status, revealed entries incl. forfeited ones) and the seat's consumable
 * tools with the authoritative per-target answers (`consumableTargets`). They only format what the server sends: no
 * drop rate, tier, grant, reforge result or target legality is decided here.
 */
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { CONSUMABLE_DEFINITIONS } from '../simulation/content/consumables';
import type { OrbTier } from '../simulation/orb-layout';
import type { RevealedDropView, RevealedOrbView } from '../simulation/m8/ui-contracts';
import type { ConsumableDefinitionId, ConsumableEffect, ConsumableFailure, ConsumableInstance, ConsumableTarget } from '../simulation/consumable-types';
import { displayUnitName } from '../rendering/display-names';
import { heroEmblemSvg } from './hero-identity';
import { itemMarkHtml } from './item-codex';
import type { LootLabels } from './loot-view';

export type { ConsumableDefinitionId, ConsumableFailure, ConsumableInstance, ConsumableTarget, OrbTier };
type OrbDrop = RevealedDropView;
type DropStatus = OrbDrop['status'];
type DropReason = Extract<OrbDrop, { readonly reason: string }>['reason'];
type OrbStatus = RevealedOrbView['status'];
/** §18.4 `revealedLoot` v2 as the private view sends it. */
export interface OrbLoot { readonly roundId: string; readonly revealedDrops: readonly OrbDrop[]; readonly revealedOrbs: readonly RevealedOrbView[] }
/**
 * One row of the server's `consumableTargets` for a target (§18.8 SR-C18-01), with the tool's effect from the content
 * table. `not-listed`: the server sent no row or no entry for this target, which the client treats as unusable.
 */
export type ConsumableAnswer =
  | { readonly ok: true; readonly effect: ConsumableEffect; readonly affectedItemIds: readonly string[] }
  | { readonly ok: false; readonly reason: ConsumableFailure | 'not-listed' };

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
};

export const ORB_TIER_TEXT: Readonly<Record<OrbTier, string>> = { gray: '灰色宝珠', blue: '蓝色宝珠', gold: '金色宝珠', prismatic: '棱彩宝珠' };
/** Aggregate wording; the status itself is the server's (§18.4 aggregation), never recomputed from the entries here. */
const ORB_STATUS_TEXT: Readonly<Record<OrbStatus, string>> = { revealed: '已打开', 'partially-claimed': '部分入库', claimed: '全部入库', forfeited: '已放弃' };
const DROP_STATUS: Readonly<Record<DropStatus, { label: string; note: string }>> = {
  granted: { label: '已入库', note: '奖励已实际发放' },
  revealed: { label: '已揭示', note: '战斗结束后自动入库，无需操作' },
  'pending-capacity': { label: '等待空位', note: '英雄备战席已满：出售或合成升星释放空位后会自动入库' },
  'retained-terminal': { label: '终局保留', note: '对局已结束，此奖励只作记录保留：未入库、不可领取' },
  forfeited: { label: '已放弃', note: '奖励未入库' },
};
/** Why a revealed entry was forfeited (§18.4, design D7); a code this table does not name falls back to the plain note. */
const FORFEIT_TEXT: Readonly<Partial<Record<DropReason, string>>> = {
  'timeout-forfeited': '等待空位超时，奖励已放弃（英雄已退回卡池）',
  'eliminated-forfeited': '本席已淘汰，未入库的奖励已放弃',
};

/** The rules' content table (§18.8 SR-C18-02): name, description and target kind; the mark letter is display only. */
const definition = (id: string) => CONSUMABLE_DEFINITIONS[id as ConsumableDefinitionId];
export const consumableName = (id: string): string => definition(id)?.name ?? id;
const consumableMark = (id: string) => definition(id)?.targetKind === 'unit' ? '拆' : definition(id) ? '铸' : '?';
/** The tool's target kind from the content table (`unit` or `item`), null for an unknown definition. */
export const consumableTargetKind = (id: string): 'unit' | 'item' | null => definition(id)?.targetKind ?? null;
/** The seven §18.5 codes in the contract's suggested wording (§18.8 SR-C18-03). */
export const CONSUMABLE_FAILURE_TEXT: Readonly<Record<ConsumableFailure, string>> = {
  'unknown-consumable': '该消耗品已不存在，请重新选择',
  'invalid-consumable-target': '这件消耗品不能用在该目标上',
  'no-removable-items': '该单位身上没有可拆下的装备',
  'temporary-item': '临时装备由本轮自动生成，不能拆卸或重铸',
  'wrong-phase': '当前阶段不能使用消耗品',
  'unknown-unit': '该单位已不存在，请重新选择',
  'unknown-item': '该装备已不存在，请重新选择',
};
/** A §18.5 code in its wording; anything else (a code this table does not name) falls back to the generic line. */
export const consumableFailureText = (reason: string): string => CONSUMABLE_FAILURE_TEXT[reason as ConsumableFailure] ?? '当前无法使用该消耗品';
const EFFECT_TEXT = { 'remove-all': '将拆下', 'reforge-component': '将重铸', 'reforge-completed': '将重铸' } as const;

function payloadLabel(payload: OrbDrop['payload']): { icon: string; text: string } {
  const count = payload.quantity > 1 ? ` ×${payload.quantity}` : '';
  if (payload.kind === 'gold') return { icon: '<span class="loot-gold" aria-hidden="true">G</span>', text: `${payload.quantity} 金币` };
  if (payload.kind === 'consumable') return { icon: `<span class="consumable-mark" aria-hidden="true">${consumableMark(payload.definitionId)}</span>`, text: `${consumableName(payload.definitionId)}${count}` };
  if (payload.kind === 'item') return { icon: itemMarkHtml(payload.definitionId, 22), text: `${ITEM_DEFINITIONS[payload.definitionId]?.name ?? payload.definitionId}${count}` };
  return { icon: heroEmblemSvg(payload.definitionId, 22), text: `${displayUnitName(payload.definitionId)}${count}` };
}

function orbEntryRow(drop: OrbDrop): HTMLElement {
  const status = DROP_STATUS[drop.status] ?? DROP_STATUS.revealed, payload = payloadLabel(drop.payload);
  const row = node('li', '', `orb-entry loot-${drop.status}`);
  row.dataset.debug = `orb-entry:${drop.dropId}`; row.dataset.status = drop.status;
  if ('reason' in drop) row.dataset.reason = drop.reason;
  if (drop.receiptId) row.dataset.receipt = drop.receiptId;
  row.insertAdjacentHTML('afterbegin', payload.icon);
  row.append(node('span', payload.text, 'orb-entry-name'), node('span', status.label, 'loot-badge'));
  const note = drop.status === 'forfeited' ? FORFEIT_TEXT[drop.reason] || status.note : drop.status === 'granted' ? '' : status.note;
  if (note) row.title = note;
  return row;
}

/**
 * The round's opened orbs, one card per orb in the server's order: quality tier, the server's aggregate status and the
 * revealed entries it lists (entryDropIds) with their own status; forfeited entries carry their reason. Unrevealed orbs
 * are never sent and never shown. A drop without an orb card (not referenced) is listed under 其他.
 */
export function orbLootSection(loot: OrbLoot, labels: LootLabels): HTMLElement {
  const section = node('section', '', 'loot-panel orb-loot'); section.dataset.debug = 'orb-loot';
  section.append(node('h3', `${loot.roundId} 宝珠`));
  const drops = new Map(loot.revealedDrops.map(drop => [drop.dropId, drop]));
  const listed = new Set<string>();
  const grid = node('ul', '', 'orb-list');
  for (const orb of loot.revealedOrbs) {
    const card = node('li', '', `orb-card orb-${orb.tier} orb-status-${orb.status}`);
    card.dataset.debug = `orb:${orb.orbId}`; card.dataset.tier = orb.tier; card.dataset.status = orb.status;
    const head = node('div', '', 'orb-head');
    head.append(node('span', '', 'orb-gem'), node('strong', ORB_TIER_TEXT[orb.tier] ?? orb.tier), node('span', ORB_STATUS_TEXT[orb.status] ?? orb.status, 'loot-badge'));
    card.append(head);
    const entries = node('ul', '', 'orb-entries');
    const sources = new Set<string | null>();
    for (const id of orb.entryDropIds) {
      const drop = drops.get(id); if (!drop) continue;
      listed.add(id); sources.add(drop.sourceUnitId); entries.append(orbEntryRow(drop));
    }
    card.append(entries);
    if (sources.size) card.append(node('p', `来源：${[...sources].map(labels.sourceName).join('、')}`, 'loot-note'));
    grid.append(card);
  }
  const loose = loot.revealedDrops.filter(drop => !listed.has(drop.dropId));
  if (loose.length) {
    const card = node('li', '', 'orb-card orb-other'); card.dataset.debug = 'orb:other';
    card.append(node('strong', '其他'));
    const entries = node('ul', '', 'orb-entries'); for (const drop of loose) entries.append(orbEntryRow(drop)); card.append(entries);
    grid.append(card);
  }
  if (!loot.revealedOrbs.length && !loose.length) grid.append(node('li', '本回合没有已打开的宝珠', 'loot-empty'));
  section.append(grid);
  return section;
}

/**
 * Consumables on the item bench: one card per tool instance in the server's order (§18.4 `consumables`). `selected`
 * marks the tool picked for targeting; the hint names its target kind and description from the content table.
 */
export function consumableShelf(consumables: readonly ConsumableInstance[], selected: string | null, bind: (card: HTMLButtonElement, tool: ConsumableInstance) => void): HTMLElement {
  const section = node('div', '', 'consumable-shelf'); section.dataset.debug = 'consumables';
  section.append(node('h4', '消耗品'));
  const row = node('div', '', 'consumable-row');
  for (const tool of consumables) {
    const button = node('button', '', 'consumable-card'); button.type = 'button';
    button.dataset.debug = `consumable:${tool.consumableId}`; button.dataset.consumableDef = tool.definitionId;
    button.setAttribute('aria-pressed', String(selected === tool.consumableId));
    button.insertAdjacentHTML('afterbegin', `<span class="consumable-mark" aria-hidden="true">${consumableMark(tool.definitionId)}</span>`);
    button.append(node('span', consumableName(tool.definitionId)));
    button.title = definition(tool.definitionId)?.description ?? tool.definitionId;
    bind(button, tool);
    row.append(button);
  }
  if (!consumables.length) row.append(node('span', '暂无消耗品', 'loot-empty'));
  section.append(row);
  const tool = consumables.find(entry => entry.consumableId === selected);
  if (tool) {
    const hint = node('p', consumableTargetHint(tool), 'equip-hint consumable-hint'); hint.dataset.debug = 'consumable-hint'; section.append(hint);
  }
  return section;
}
/** What a picked tool is dropped on: the target kind and the content table's description. */
export function consumableTargetHint(tool: ConsumableInstance): string {
  const kind = consumableTargetKind(tool.definitionId);
  return `${kind === 'unit' ? '拖到或点选我方单位' : kind === 'item' ? '拖到或点选一件装备' : '选择目标'}：${definition(tool.definitionId)?.description ?? tool.definitionId}`;
}
/**
 * What dropping `tool` on a target would do, in the server's words (§18.8 SR-C18-01): the items it removes or reforges
 * when allowed, the §18.5 refusal otherwise. Never names the reforge result (it is drawn only when the command runs).
 */
export function consumableDropText(tool: ConsumableInstance, targetLabel: string, answer: ConsumableAnswer, itemName: (id: string) => string): string {
  const name = consumableName(tool.definitionId);
  if (answer.ok) return `${name} → ${targetLabel}：${EFFECT_TEXT[answer.effect]} ${answer.affectedItemIds.map(itemName).join('、') || '—'} · 产物进入物品备战席 · 下场生效`;
  return `${name} → ${targetLabel}：${answer.reason === 'not-listed' ? CONSUMABLE_FAILURE_TEXT['invalid-consumable-target'] : consumableFailureText(answer.reason)}`;
}
