/**
 * C18-B: R3/R4 loot presentation over the signed contract (MULTIPLAYER_CONTRACT §18.4/§18.8). Pure renderers: the orb
 * cards of the round's revealed loot (tier, the server's aggregate status, entries incl. forfeited ones) and the
 * consumable shelf. They only format what the rules sent: no drop rate, tier, grant, reforge result or target legality
 * is decided here; names and descriptions come from CONSUMABLE_DEFINITIONS.
 */
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { CONSUMABLE_DEFINITIONS } from '../simulation/content/consumables';
import type { ConsumableDefinitionId, ConsumableFailure, ConsumableInstance, ConsumablePreview } from '../simulation/consumable-types';
import type { LootView, RevealedDropView, RevealedOrbView } from '../simulation/m8/ui-contracts';
import type { OrbTier } from '../simulation/orb-layout';
import type { MatchEvent } from '../simulation/match-types';
import { displayUnitName } from '../rendering/display-names';
import { heroEmblemSvg } from './hero-identity';
import { itemMarkHtml } from './item-codex';
import type { LootLabels } from './loot-view';
import { NEXT_BATTLE_TEXT, takesEffectNextBattle } from './equipment-feedback';

/** The orb part of a LootView, or of the private view's revealedLoot (§18.4): the same three fields. */
export type OrbLoot = Pick<LootView, 'roundId' | 'revealedDrops' | 'revealedOrbs'>;

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
};

export const ORB_TIER_TEXT: Readonly<Record<OrbTier, string>> = { gray: '灰色宝珠', blue: '蓝色宝珠', gold: '金色宝珠', prismatic: '棱彩宝珠' };
/** Aggregate wording; the status itself is the server's (§18.4 aggregation), never recomputed from the entries here. */
const ORB_STATUS_TEXT: Readonly<Record<RevealedOrbView['status'], string>> = { revealed: '已打开', 'partially-claimed': '部分入库', claimed: '全部入库', forfeited: '已放弃' };
const DROP_STATUS: Readonly<Record<RevealedDropView['status'], { label: string; note: string }>> = {
  granted: { label: '已入库', note: '' },
  revealed: { label: '已揭示', note: '战斗结束后自动入库，无需操作' },
  'pending-capacity': { label: '等待空位', note: '英雄备战席已满：出售或合成升星释放空位后会自动入库' },
  'retained-terminal': { label: '终局保留', note: '对局已结束，此奖励只作记录保留：未入库、不可领取' },
  forfeited: { label: '已放弃', note: '奖励未入库' },
};
/** §18.8 04: why a revealed entry was forfeited. */
const FORFEIT_TEXT: Readonly<Record<'timeout-forfeited' | 'eliminated-forfeited', string>> = {
  'timeout-forfeited': '操作窗口超时，奖励已放弃',
  'eliminated-forfeited': '本席已淘汰，未入库的奖励已放弃',
};

/** A one-glyph mark per tool kind (presentation only; the name and description are the content table's). */
const TOOL_MARK: Readonly<Record<ConsumableDefinitionId, string>> = { 'magnetic-remover': '拆', 'component-reforger': '铸', 'completed-reforger': '铸' };
export const consumableName = (id: string): string => CONSUMABLE_DEFINITIONS[id as ConsumableDefinitionId]?.name ?? id;
const toolMark = (id: string) => `<span class="consumable-mark" aria-hidden="true">${TOOL_MARK[id as ConsumableDefinitionId] ?? '?'}</span>`;

/** §18.8 03 wording for the seven ConsumableFailure codes. */
export const CONSUMABLE_FAILURE_TEXT: Readonly<Record<ConsumableFailure, string>> = {
  'unknown-consumable': '该消耗品已不存在，请重新选择',
  'invalid-consumable-target': '这件消耗品不能用在该目标上',
  'no-removable-items': '该单位身上没有可拆下的装备',
  'temporary-item': '临时装备由本轮自动生成，不能拆卸或重铸',
  'wrong-phase': '当前阶段不能使用消耗品',
  'unknown-unit': '该单位已不存在，请重新选择',
  'unknown-item': '该装备已不存在，请重新选择',
};

function payloadLabel(payload: RevealedDropView['payload']): { icon: string; text: string } {
  const count = payload.quantity > 1 ? ` ×${payload.quantity}` : '';
  if (payload.kind === 'gold') return { icon: '<span class="loot-gold" aria-hidden="true">G</span>', text: `${payload.quantity} 金币` };
  if (payload.kind === 'consumable') return { icon: toolMark(payload.definitionId), text: `${consumableName(payload.definitionId)}${count}` };
  if (payload.kind === 'item') return { icon: itemMarkHtml(payload.definitionId, 22), text: `${ITEM_DEFINITIONS[payload.definitionId]?.name ?? payload.definitionId}${count}` };
  return { icon: heroEmblemSvg(payload.definitionId, 22), text: `${displayUnitName(payload.definitionId)}${count}` };
}

function orbEntryRow(drop: RevealedDropView): HTMLElement {
  const status = DROP_STATUS[drop.status] ?? DROP_STATUS.revealed, payload = payloadLabel(drop.payload);
  const row = node('li', '', `orb-entry loot-${drop.status}`);
  row.dataset.debug = `orb-entry:${drop.dropId}`; row.dataset.status = drop.status;
  if ('reason' in drop && drop.reason) row.dataset.reason = drop.reason;
  if (drop.receiptId) row.dataset.receipt = drop.receiptId;
  row.insertAdjacentHTML('afterbegin', payload.icon);
  row.append(node('span', payload.text, 'orb-entry-name'), node('span', status.label, 'loot-badge'));
  const note = drop.status === 'forfeited' ? FORFEIT_TEXT[drop.reason] ?? status.note : status.note;
  if (note) row.title = note;
  return row;
}

/**
 * The round's opened orbs (§18.8 04), one card per orb in the server's order: quality tier, the server's aggregate
 * status and the revealed entries it lists (entryDropIds) with their own status; forfeited entries carry their reason.
 * Unrevealed orbs are never sent and never shown. A visible drop no orb references is listed under 其他.
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
    const sources = new Set<string>();
    for (const id of orb.entryDropIds) {
      const drop = drops.get(id); if (!drop) continue;
      listed.add(id); if (drop.sourceUnitId) sources.add(drop.sourceUnitId); entries.append(orbEntryRow(drop));
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

/** What a picked tool is for (the content table's description) and where it is dropped. */
export function consumableTargetHint(tool: ConsumableInstance): string {
  const definition = CONSUMABLE_DEFINITIONS[tool.definitionId];
  return `${definition.name}：${definition.description} · 拖到${definition.targetKind === 'unit' ? '我方单位' : '一件装备'}上使用`;
}

/**
 * Consumables on the item bench (§18.4 `consumables`), one card per tool instance in the server's order. `selected`
 * marks the tool picked for targeting; `bind` attaches the panel's pointer and key handlers.
 */
export function consumableShelf(consumables: readonly ConsumableInstance[], selected: string | null, bind: (card: HTMLButtonElement, tool: ConsumableInstance) => void): HTMLElement {
  const section = node('div', '', 'consumable-shelf'); section.dataset.debug = 'consumables';
  section.append(node('h4', '消耗品'));
  const row = node('div', '', 'consumable-row');
  for (const tool of consumables) {
    const button = node('button', '', 'consumable-card'); button.type = 'button';
    button.dataset.debug = `consumable:${tool.consumableId}`; button.dataset.consumableDef = tool.definitionId;
    button.setAttribute('aria-pressed', String(selected === tool.consumableId));
    button.insertAdjacentHTML('afterbegin', toolMark(tool.definitionId));
    button.append(node('span', consumableName(tool.definitionId)));
    button.title = CONSUMABLE_DEFINITIONS[tool.definitionId]?.description ?? tool.definitionId;
    bind(button, tool);
    row.append(button);
  }
  if (!consumables.length) row.append(node('span', '暂无消耗品', 'loot-empty'));
  section.append(row);
  const tool = consumables.find(entry => entry.consumableId === selected);
  if (tool) { const hint = node('p', consumableTargetHint(tool), 'equip-hint consumable-hint'); hint.dataset.debug = 'consumable-hint'; section.append(hint); }
  return section;
}

/**
 * P1: an item tool (a reforger) dropped on a whole unit (a board or bench token, an equipment row) uses one of the items
 * that unit wears, given in slot order: the first whose target answer is ok, else the first worn item so that its own
 * refusal is shown; null when the unit wears nothing. Picks among the answers only (same idea as pickUnitDropSlot).
 */
export function routeToolUnitDrop(wornItemIds: readonly string[], allowed: (itemId: string) => boolean): string | null {
  return wornItemIds.find(allowed) ?? wornItemIds[0] ?? null;
}

/**
 * What dropping `tool` on a target would do, in the preview's words (§18.8 01: `affectedItemIds` names what is removed
 * or reforged; the reforge result is random and never guessed). `phase` is the shown state's: outside preparation the
 * change enters the next battle.
 */
export function consumableDropText(tool: ConsumableInstance, targetLabel: string, preview: ConsumablePreview, itemName: (id: string) => string, phase: string): string {
  const name = consumableName(tool.definitionId);
  if (!preview.ok) return `${name} → ${targetLabel}：${CONSUMABLE_FAILURE_TEXT[preview.reason] ?? '当前无法使用该消耗品'}`;
  const items = preview.affectedItemIds.map(itemName).join('、') || '—';
  const what = preview.effect === 'remove-all' ? `将拆下 ${items}，放回物品备战席` : `将重铸 ${items}（结果随机），产物进入物品备战席`;
  return `${name} → ${targetLabel}：${what}${takesEffectNextBattle(phase) ? ` · ${NEXT_BATTLE_TEXT}` : ''}`;
}

/**
 * Record-page line for a seat operation event of a tool use (§18.8 03): "重铸：A → B", "拆卸：X 卸下 A、B". The
 * consumableUsed event that follows them says nothing more and gets no line. Names only; nothing is applied from events.
 */
export function consumableEventText(event: MatchEvent, name: { readonly item: (itemId: string) => string; readonly unit: (unitId: string) => string }): string | null {
  const definitionName = (id: string) => ITEM_DEFINITIONS[id]?.name ?? id;
  if (event.type === 'itemReforged') return `重铸：${definitionName(event.definitionId)} → ${definitionName(event.outputDefinitionId)}`;
  if (event.type === 'itemsRemoved') return `拆卸：${name.unit(event.unitId)} 卸下 ${event.itemIds.map(name.item).join('、') || '—'}`;
  return null;
}
