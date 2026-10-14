/**
 * C18-B: R3/R4 loot presentation, pre-wired before T13-B lands. Pure renderers over the DRAFT projection of
 * MULTIPLAYER_CONTRACT §18.4 (orbs with a quality tier, their revealed entries incl. forfeited ones, and the seat's
 * consumable tools). They only format what the server sends: no drop rate, tier, grant, reforge result or target
 * legality is decided here.
 *
 * TODO(T13-B, contract §18.4): the Draft* shapes below mirror the unsigned draft; once §18 is signed, import the
 * exported types (OrbTier, OrbDropView, RevealedOrbView, ConsumableDefinitionId) instead and delete the copies.
 */
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { displayUnitName } from '../rendering/display-names';
import { heroEmblemSvg } from './hero-identity';
import { itemMarkHtml } from './item-codex';
import type { LootLabels } from './loot-view';

export type OrbTier = 'gray' | 'blue' | 'gold' | 'prismatic';
export type ConsumableDefinitionId = 'magnetic-remover' | 'component-reforger' | 'completed-reforger';
export type DraftPayload =
  | { readonly kind: 'gold'; readonly quantity: number }
  | { readonly kind: 'unit' | 'item'; readonly definitionId: string; readonly quantity: number }
  | { readonly kind: 'consumable'; readonly definitionId: ConsumableDefinitionId; readonly quantity: number };
export type DraftDropStatus = 'revealed' | 'pending-capacity' | 'retained-terminal' | 'granted' | 'forfeited';
export type DraftDropReason = 'auto-grant-in-domain' | 'bench-full' | 'terminal-bench-full' | 'timeout-forfeited' | 'eliminated-forfeited';
export interface DraftOrbDrop {
  readonly orbId: string; readonly entryOrdinal: number; readonly dropId: string; readonly encounterId: string;
  readonly sourceUnitId: string; readonly roundId: string; readonly payload: DraftPayload; readonly status: DraftDropStatus;
  readonly receiptId: string | null; readonly allowedActions: readonly []; readonly reason?: DraftDropReason;
}
export type DraftOrbStatus = 'revealed' | 'partially-claimed' | 'claimed' | 'forfeited';
export interface DraftRevealedOrb { readonly orbId: string; readonly tier: OrbTier; readonly status: DraftOrbStatus; readonly entryDropIds: readonly string[] }
export interface DraftOrbLoot { readonly roundId: string; readonly revealedDrops: readonly DraftOrbDrop[]; readonly revealedOrbs: readonly DraftRevealedOrb[] }
export interface DraftConsumable { readonly consumableId: string; readonly definitionId: ConsumableDefinitionId }
export type DraftConsumableTarget = { readonly kind: 'item'; readonly itemId: string } | { readonly kind: 'unit'; readonly unitId: string };
/** §18.5 failure codes (draft). */
export type DraftConsumableFailure = 'wrong-phase' | 'unknown-consumable' | 'temporary-item' | 'unknown-item' | 'unknown-unit'
  | 'invalid-consumable-target' | 'no-removable-items';
/**
 * §18.1 ConsumablePreview (draft) plus the placeholder answer used until a client-usable preview exists (SR-C18-01):
 * `pending` means nobody has judged this target yet, never "allowed".
 */
export type DraftConsumablePreview =
  | { readonly ok: true; readonly effect: 'remove-all' | 'reforge-component' | 'reforge-completed'; readonly affectedItemIds: readonly string[]; readonly destination: 'inventory'; readonly affectsCurrentBattle: false }
  | { readonly ok: false; readonly reason: DraftConsumableFailure }
  | { readonly ok: 'pending'; readonly contract: '§18.1' };

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
};

export const ORB_TIER_TEXT: Readonly<Record<OrbTier, string>> = { gray: '灰色宝珠', blue: '蓝色宝珠', gold: '金色宝珠', prismatic: '棱彩宝珠' };
/** Aggregate wording; the status itself is the server's (§18.4 aggregation), never recomputed from the entries here. */
const ORB_STATUS_TEXT: Readonly<Record<DraftOrbStatus, string>> = { revealed: '已打开', 'partially-claimed': '部分入库', claimed: '全部入库', forfeited: '已放弃' };
const DROP_STATUS: Readonly<Record<DraftDropStatus, { label: string; note: string }>> = {
  granted: { label: '已入库', note: '奖励已实际发放' },
  revealed: { label: '已揭示', note: '战斗结束后自动入库，无需操作' },
  'pending-capacity': { label: '等待空位', note: '英雄备战席已满：出售或合成升星释放空位后会自动入库' },
  'retained-terminal': { label: '终局保留', note: '对局已结束，此奖励只作记录保留：未入库、不可领取' },
  forfeited: { label: '已放弃', note: '奖励未入库' },
};
/** Why a revealed entry was forfeited (§18.4, design D7); a code this table does not name falls back to the plain note. */
const FORFEIT_TEXT: Readonly<Partial<Record<DraftDropReason, string>>> = {
  'timeout-forfeited': '等待空位超时，奖励已放弃（英雄已退回卡池）',
  'eliminated-forfeited': '本席已淘汰，未入库的奖励已放弃',
};

/**
 * Consumable names and what the tool is for, as written in the draft (design D4/D5, contract §18.5 target kinds).
 * TODO(T13-B, contract §18.1/§18.5): read names and descriptions from the exported consumable content table once it
 * exists (SR-C18-02); this copy is wording only, never a legality check.
 */
export const CONSUMABLE_TEXT: Readonly<Record<ConsumableDefinitionId, { readonly name: string; readonly short: string; readonly target: 'unit' | 'item'; readonly note: string }>> = {
  'magnetic-remover': { name: '磁力拆卸器', short: '拆', target: 'unit', note: '拖到我方单位：卸下其全部永久装备，回到物品备战席' },
  'component-reforger': { name: '组件重铸器', short: '铸', target: 'item', note: '拖到一件普通组件：重铸为另一件组件，产物进入物品备战席' },
  'completed-reforger': { name: '成装重铸器', short: '铸', target: 'item', note: '拖到一件成装：重铸为另一件成装，产物进入物品备战席' },
};
const consumableName = (id: string) => CONSUMABLE_TEXT[id as ConsumableDefinitionId]?.name ?? id;
/** Suggested wording for the §18.5 codes (SR-C18-03); Codex may revise it with the signed contract. */
export const CONSUMABLE_FAILURE_TEXT: Readonly<Record<DraftConsumableFailure, string>> = {
  'wrong-phase': '当前阶段不能使用消耗品',
  'unknown-consumable': '该消耗品已不存在，请重新选择',
  'temporary-item': '临时装备由本轮自动生成，不能拆卸或重铸',
  'unknown-item': '该物品已不存在，请重新选择',
  'unknown-unit': '未找到该单位，只能对我方单位使用',
  'invalid-consumable-target': '这件消耗品不能用在该目标上',
  'no-removable-items': '该单位身上没有可拆下的装备',
};
const EFFECT_TEXT = { 'remove-all': '将拆下', 'reforge-component': '将重铸', 'reforge-completed': '将重铸' } as const;

function payloadLabel(payload: DraftPayload): { icon: string; text: string } {
  const count = payload.quantity > 1 ? ` ×${payload.quantity}` : '';
  if (payload.kind === 'gold') return { icon: '<span class="loot-gold" aria-hidden="true">G</span>', text: `${payload.quantity} 金币` };
  if (payload.kind === 'consumable') return { icon: `<span class="consumable-mark" aria-hidden="true">${CONSUMABLE_TEXT[payload.definitionId]?.short ?? '?'}</span>`, text: `${consumableName(payload.definitionId)}${count}` };
  if (payload.kind === 'item') return { icon: itemMarkHtml(payload.definitionId, 22), text: `${ITEM_DEFINITIONS[payload.definitionId]?.name ?? payload.definitionId}${count}` };
  return { icon: heroEmblemSvg(payload.definitionId, 22), text: `${displayUnitName(payload.definitionId)}${count}` };
}

function orbEntryRow(drop: DraftOrbDrop): HTMLElement {
  const status = DROP_STATUS[drop.status] ?? DROP_STATUS.revealed, payload = payloadLabel(drop.payload);
  const row = node('li', '', `orb-entry loot-${drop.status}`);
  row.dataset.debug = `orb-entry:${drop.dropId}`; row.dataset.status = drop.status;
  if (drop.reason) row.dataset.reason = drop.reason;
  if (drop.receiptId) row.dataset.receipt = drop.receiptId;
  row.insertAdjacentHTML('afterbegin', payload.icon);
  row.append(node('span', payload.text, 'orb-entry-name'), node('span', status.label, 'loot-badge'));
  const note = drop.status === 'forfeited' ? (drop.reason && FORFEIT_TEXT[drop.reason]) || status.note : drop.status === 'granted' ? '' : status.note;
  if (note) row.title = note;
  return row;
}

/**
 * The round's opened orbs, one card per orb in the server's order: quality tier, the server's aggregate status and the
 * revealed entries it lists (entryDropIds) with their own status; forfeited entries carry their reason. Unrevealed orbs
 * are never sent and never shown. A drop without an orb card (not referenced) is listed under 其他.
 */
export function orbLootSection(loot: DraftOrbLoot, labels: LootLabels, options: { readonly preview?: boolean } = {}): HTMLElement {
  const section = node('section', '', 'loot-panel orb-loot'); section.dataset.debug = 'orb-loot';
  const title = node('h3', `${loot.roundId} 宝珠`);
  if (options.preview) title.append(node('span', '假数据 · 仅布局预览', 'fake-tag'));
  section.append(title);
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
 * Consumables on the item bench: one card per tool instance in the server's order. `selected` marks the tool picked
 * for targeting. Using one is not wired yet: target legality and the command await §18.1 (previewUseConsumable /
 * useConsumable, see SR-C18-01), so the hint names the expected target kind and says it is not open yet.
 */
export function consumableShelf(consumables: readonly DraftConsumable[], selected: string | null, bind: (card: HTMLButtonElement, tool: DraftConsumable) => void, options: { readonly preview?: boolean } = {}): HTMLElement {
  const section = node('div', '', 'consumable-shelf'); section.dataset.debug = 'consumables';
  const title = node('h4', '消耗品');
  if (options.preview) title.append(node('span', '假数据 · 仅布局预览', 'fake-tag'));
  section.append(title);
  const row = node('div', '', 'consumable-row');
  for (const tool of consumables) {
    const text = CONSUMABLE_TEXT[tool.definitionId];
    const button = node('button', '', 'consumable-card'); button.type = 'button';
    button.dataset.debug = `consumable:${tool.consumableId}`; button.dataset.consumableDef = tool.definitionId;
    button.setAttribute('aria-pressed', String(selected === tool.consumableId));
    button.insertAdjacentHTML('afterbegin', `<span class="consumable-mark" aria-hidden="true">${text?.short ?? '?'}</span>`);
    button.append(node('span', text?.name ?? tool.definitionId));
    button.title = text?.note ?? tool.definitionId;
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
/**
 * What a picked tool is dropped on, and that its use is not open yet.
 * TODO(T13-B, contract §18.1): replace with the server's per-target preview answer (SR-C18-01) and send
 * `useConsumable`; until then no target is marked legal and no command is sent.
 */
export function consumableTargetHint(tool: DraftConsumable): string {
  const text = CONSUMABLE_TEXT[tool.definitionId];
  return `${text?.note ?? tool.definitionId} · 使用待接线（合同 §18.1 previewUseConsumable / useConsumable）`;
}
/**
 * What dropping `tool` on a target would do, in the preview's words: the domain's effect or failure once wired, and
 * until then the target's name plus "待接线". The tool's intended target kind (§18.5) is named as guidance only.
 */
export function consumableDropText(tool: DraftConsumable, targetLabel: string, preview: DraftConsumablePreview, itemName: (id: string) => string): string {
  const name = consumableName(tool.definitionId);
  if (preview.ok === true) return `${name} → ${targetLabel}：${EFFECT_TEXT[preview.effect]} ${preview.affectedItemIds.map(itemName).join('、') || '—'} · 产物进入物品备战席 · 下场生效`;
  if (preview.ok === false) return `${name} → ${targetLabel}：${CONSUMABLE_FAILURE_TEXT[preview.reason] ?? '当前无法使用该消耗品'}`;
  return `${name} → ${targetLabel} · 能否使用待接线（合同 ${preview.contract} previewUseConsumable）`;
}
