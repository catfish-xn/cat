/**
 * U6 reward presentation (static phase). Pure renderers over the frozen LootView
 * (M8_UI_CONTRACT §5) and the PendingChoice that M8B_CONTRACT_ADDENDUM §3.3 uses for the
 * component pick. They only format what the domain already decided: no grants, no
 * settlement, no fallback, no capacity or continue logic of their own. Commands are passed
 * in by the caller; the formal Match wiring waits for B8③ readLootView.
 */
import type { LootView, RevealedDropView } from '../simulation/m8/ui-contracts';
import type { PendingChoice } from '../simulation/strategy-types';
import { ITEM_DEFINITIONS } from '../simulation/content/items';
import { displayUnitName } from '../rendering/display-names';
import { heroEmblemSvg } from './hero-identity';
import { itemDescriptions, itemMarkHtml } from './item-codex';

export interface LootLabels {
  /** Monster name for a drop source; the formal wiring reads it from readEncounterPreview of the same round. */
  readonly sourceName: (sourceUnitId: string | null) => string;
}
type Payload = RevealedDropView['payload'];

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
};
const itemName = (id: string) => ITEM_DEFINITIONS[id]?.name ?? id;

/** Status wording mirrors the frozen semantics table; UI never infers a receipt from animation or gold. */
const STATUS: Readonly<Record<RevealedDropView['status'], { label: string; note: string }>> = {
  granted: { label: '已入库', note: '奖励已实际发放' },
  // 'revealed' only exists between the source's death and the end-of-combat grant.
  revealed: { label: '已揭示', note: '战斗结束后自动入库，无需操作' },
  'pending-capacity': { label: '等待空位', note: '英雄备战席已满：出售或合成升星释放空位后会自动入库' },
  'retained-terminal': { label: '终局保留', note: '对局已结束，此奖励只作记录保留：未入库、不折算金币、不可领取' },
};
const CONTINUE_BLOCK: Readonly<Record<NonNullable<LootView['reason']>, string>> = {
  'pending-capacity': '有奖励英雄等待备战席空位，释放空位前不能继续',
  'unsettled-round': '本回合尚未结算完成，暂不能继续',
  'game-over': '对局已结束，不能继续',
};

function payloadLabel(payload: Payload): { icon: string; text: string } {
  if (payload.kind === 'gold') return { icon: '<span class="loot-gold" aria-hidden="true">G</span>', text: `${payload.quantity} 金币` };
  const count = payload.quantity > 1 ? ` ×${payload.quantity}` : '';
  return payload.kind === 'item'
    ? { icon: itemMarkHtml(payload.definitionId, 26), text: `${itemName(payload.definitionId)}${count}` }
    : { icon: heroEmblemSvg(payload.definitionId, 26), text: `${displayUnitName(payload.definitionId)}${count}` };
}

/** One row per revealed drop, in the order the domain returned them. */
export function lootDropRow(drop: RevealedDropView, labels: LootLabels): HTMLElement {
  const status = STATUS[drop.status], payload = payloadLabel(drop.payload);
  const row = node('li', '', `loot-drop loot-${drop.status}`);
  row.dataset.debug = `loot-drop:${drop.dropId}`; row.dataset.status = drop.status;
  if (drop.receiptId) row.dataset.receipt = drop.receiptId;
  const head = node('div', '', 'loot-drop-head');
  head.insertAdjacentHTML('afterbegin', payload.icon);
  head.append(node('strong', payload.text), node('span', status.label, 'loot-badge'));
  row.append(head, node('p', `来源：${labels.sourceName(drop.sourceUnitId)} · ${status.note}`, 'loot-note'));
  return row;
}

/** Settlement block: revealed rewards plus the domain's own Continue verdict. */
export function lootPanelSection(view: LootView, labels: LootLabels, pendingChoice: PendingChoice | null = null): HTMLElement {
  const section = node('section', '', 'loot-panel'); section.dataset.debug = 'loot-panel';
  section.dataset.canContinue = String(view.canContinue);
  section.append(node('h3', `${view.roundId} 奖励`));
  const list = node('ul', '', 'loot-list');
  for (const drop of view.revealedDrops) list.append(lootDropRow(drop, labels));
  if (!view.revealedDrops.length) list.append(node('li', '本回合没有已揭示的奖励', 'loot-empty'));
  section.append(list);
  // The open component pick is shown from PendingChoice (ADDENDUM §5.1); it is never displayed as an owned item.
  // Shown separately only when the domain also reports another blocker; otherwise the verdict below says it.
  if (pendingChoice?.kind === 'component' && view.reason) section.append(node('p', '有组件奖励等待选择', 'loot-choice-pending'));
  const verdict = view.canContinue ? null : view.reason ? CONTINUE_BLOCK[view.reason] : pendingChoice ? '请先完成组件选择' : '暂不能继续';
  if (verdict) {
    const block = node('p', verdict, 'loot-blocked'); block.dataset.debug = 'loot-continue-block';
    if (view.reason) block.dataset.reason = view.reason;
    block.setAttribute('role', 'status'); section.append(block);
  }
  if (view.pendingClaims.length) section.append(node('p', `等待入库：${view.pendingClaims.length} 项`, 'loot-note'));
  return section;
}

/** The 8-component pick (ADDENDUM §3.3): fixed candidates, no reroll, one command per click. */
export function lootChoiceDialog(choice: PendingChoice, sourceLabel: string, onSelect: (choiceId: string, generation: number, definitionId: string) => void): HTMLElement {
  const card = node('div', '', 'choice-dialog loot-choice'); card.dataset.debug = 'loot-choice';
  card.append(node('h2', '野怪奖励 · 选择一件组件'));
  card.append(node('p', `${sourceLabel} · 固定 ${choice.offers.length} 选 1，不可刷新；确认后立即入库。完成选择前不能继续。`));
  const grid = node('div', '', 'loot-choice-grid');
  for (const id of choice.offers) {
    const button = node('button', '', 'loot-choice-card'); button.type = 'button';
    button.dataset.debug = `loot-offer:${id}`; button.dataset.itemDef = id;
    button.insertAdjacentHTML('afterbegin', itemMarkHtml(id, 36));
    button.append(node('strong', itemName(id)), node('span', itemDescriptions(id).join('；'), 'loot-choice-effect'));
    button.addEventListener('click', () => onSelect(choice.choiceId, choice.generation, id));
    grid.append(button);
  }
  card.append(grid);
  return card;
}

/** Terminal record: retained rewards are read-only and carry no action at all. */
export function lootTerminalSummary(view: LootView, labels: LootLabels): HTMLElement {
  const section = node('section', '', 'loot-panel loot-terminal'); section.dataset.debug = 'loot-terminal';
  section.append(node('h3', '终局奖励记录'));
  const retained = view.revealedDrops.filter(drop => drop.status === 'retained-terminal');
  const granted = view.revealedDrops.filter(drop => drop.status === 'granted');
  const list = node('ul', '', 'loot-list');
  for (const drop of [...granted, ...retained]) list.append(lootDropRow(drop, labels));
  section.append(list);
  if (retained.length) section.append(node('p', `${retained.length} 项奖励因备战席已满未能入库，按规则作为终局记录保留，不可操作。`, 'loot-note'));
  const block = node('p', CONTINUE_BLOCK['game-over'], 'loot-blocked'); block.dataset.reason = 'game-over'; section.append(block);
  return section;
}
