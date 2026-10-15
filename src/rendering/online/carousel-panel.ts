/**
 * G1-P7 shared carousel (选秀) panel. A ring of the units standing on the carousel, each with the item it carries,
 * floating over the enemy half of my board so the bench below stays visible (a picked unit lands there at once).
 * Release order, the countdown to my batch and to the carousel's end are shown beside it. Like TFT: the units I may take
 * light up when my batch is released, units already taken are greyed with the taker's name, and a seat the server picked
 * for (bot, disconnected, or no click before the deadline) is marked "自动".
 *
 * Read-only apart from the click: a slot is clickable only while the server says `eligible` and the slot still stands.
 * The panel never decides who is released or what is left; everything comes from `PlayerView.carousel` (MULTIPLAYER_CONTRACT
 * §21.1). The release groups shown are the rules' `releaseOrder` cut where `releaseAtMs` changes, for display only.
 */
import { ITEM_DEFINITIONS } from '../../simulation/content/items';
import { UNIT_DEFINITIONS } from '../../simulation/units';
import { getHeroIdentity, heroEmblemSvg } from '../../presentation/hero-identity';
import { itemMarkHtml } from '../../presentation/item-codex';
import { heroPortraitHtml } from '../../presentation/s13-assets';
import type { CarouselSlotView, CarouselView, SeatPublic } from './protocol';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
const unitName = (definitionId: string) => getHeroIdentity(definitionId).name;
const itemName = (definitionId: string) => ITEM_DEFINITIONS[definitionId]?.name ?? definitionId;

/** One release group as shown: consecutive seats of the release order that share a release time. */
export interface CarouselGroup { readonly seatIds: readonly string[]; readonly releaseAtMs: number }
export function carouselGroups(view: CarouselView): CarouselGroup[] {
  const groups: { seatIds: string[]; releaseAtMs: number }[] = [];
  for (const seatId of view.releaseOrder) {
    const at = view.releaseAtMs[seatId] ?? view.deadlineMs, last = groups.at(-1);
    if (last && last.releaseAtMs === at) last.seatIds.push(seatId); else groups.push({ seatIds: [seatId], releaseAtMs: at });
  }
  return groups;
}
/** My line under the title; pure so tests and the status line read the same words. `serverNow` is the server clock. */
export function carouselStatusText(view: CarouselView, mySeatId: string, serverNow: number): string {
  if (view.pickedSlot !== null) {
    const slot = view.slots.find(candidate => candidate.slot === view.pickedSlot);
    const what = slot ? `${unitName(slot.definitionId)}` : '单位';
    return view.autoPicked.includes(mySeatId) ? `未在截止前选择 · 已自动选取 ${what}` : `已选取 ${what} · 已进入备战席`;
  }
  if (view.eligible) return '已放行 · 点击一个单位选取';
  const at = view.releaseAtMs[mySeatId];
  if (at === undefined) return '观看选秀';
  if (view.status === 'closed' || view.elapsedMs >= view.deadlineMs) return '选秀结束 · 服务器代选中';
  const mine = carouselGroups(view).findIndex(group => group.seatIds.includes(mySeatId));
  const wait = Math.max(0, Math.ceil((view.startedAt + at - serverNow) / 1000));
  return `你在第 ${mine + 1} 批 · ${wait} 秒后放行 · 生命越低越先选`;
}

export class CarouselPanel {
  readonly root: HTMLElement;
  private title: HTMLElement;
  private status: HTMLElement;
  private timer: HTMLElement;
  private ring: HTMLElement;
  private order: HTMLElement;
  private view: CarouselView | null = null;
  private seats: readonly SeatPublic[] = [];
  private mySeatId = '';
  /** performance.now() minus the server clock of the last view. */
  private clockOffset = 0;
  /** Slot I clicked and whose answer is still out; cleared by the next view. */
  private pending: number | null = null;

  constructor(host: HTMLElement, private readonly onPick: (slot: number, view: CarouselView) => void) {
    this.root = element('section', '', 'carousel-panel'); this.root.id = 'carousel-panel'; this.root.hidden = true;
    this.root.dataset.debug = 'online:carousel'; this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-label', '选秀');
    const head = element('header', '', 'carousel-head');
    this.title = element('strong', '选秀', 'carousel-title');
    this.status = element('span', '', 'carousel-status'); this.status.dataset.debug = 'online:carousel-status'; this.status.setAttribute('role', 'status');
    head.append(this.title, this.status);
    const body = element('div', '', 'carousel-body');
    this.ring = element('div', '', 'carousel-ring'); this.ring.dataset.debug = 'online:carousel-ring';
    this.timer = element('span', '', 'carousel-timer'); this.timer.dataset.debug = 'online:carousel-timer'; this.timer.setAttribute('role', 'timer');
    this.timer.setAttribute('aria-label', '选秀剩余时间');
    this.order = element('ol', '', 'carousel-order'); this.order.dataset.debug = 'online:carousel-order'; this.order.setAttribute('aria-label', '放行顺序');
    body.append(this.ring, this.order);
    this.root.append(head, body);
    host.append(this.root);
  }
  get open(): boolean { return this.view !== null; }

  /** Shows the carousel of this view, or hides the panel when the view has none. */
  render(view: CarouselView | null, seats: readonly SeatPublic[], mySeatId: string, serverNow: number): void {
    if (!view) { this.hide(); return; }
    const fresh = this.view?.id !== view.id;
    this.view = view; this.seats = seats; this.mySeatId = mySeatId; this.clockOffset = performance.now() - serverNow;
    this.pending = null;
    this.root.hidden = false; this.root.dataset.carousel = view.id;
    this.root.toggleAttribute('data-can-pick', view.eligible);
    this.title.textContent = `选秀 · ${view.roundName}`;
    this.renderRing(view, fresh);
    this.renderOrder(view);
    this.tick();
  }
  /** A refused or blocked pick: the slots are clickable again. */
  clearPending(): void {
    if (this.pending === null) return;
    this.pending = null;
    for (const chip of Array.from(this.ring.querySelectorAll('.carousel-slot.pending'))) chip.classList.remove('pending');
    this.tick();
  }
  hide(): void {
    if (this.view === null) return;
    this.view = null; this.pending = null; this.root.hidden = true;
    this.ring.replaceChildren(); this.order.replaceChildren();
  }

  /** Every frame: countdown texts only. */
  tick(): void {
    const view = this.view; if (!view) return;
    const now = performance.now() - this.clockOffset;
    const seconds = `${Math.max(0, Math.ceil((view.startedAt + view.deadlineMs - now) / 1000))}`;
    if (this.timer.textContent !== seconds) this.timer.textContent = seconds;
    const status = this.pending !== null && view.eligible ? '选取中…' : carouselStatusText(view, this.mySeatId, now);
    if (this.status.textContent !== status) this.status.textContent = status;
    for (const row of Array.from(this.order.children) as HTMLElement[]) {
      const at = Number(row.dataset.releaseAt);
      const wait = row.querySelector<HTMLElement>('.carousel-wait');
      if (!Number.isFinite(at) || !wait) continue;
      const left = Math.ceil((view.startedAt + at - now) / 1000);
      const text = at <= view.elapsedMs || left <= 0 ? '' : `${left}s`;
      if (wait.textContent !== text) wait.textContent = text;
    }
  }

  private renderRing(view: CarouselView, fresh: boolean): void {
    const count = view.slots.length;
    const centre = element('div', '', 'carousel-centre');
    centre.append(this.timer, element('span', '秒', 'carousel-timer-unit'));
    const chips = view.slots.map((slot, index) => this.slotChip(view, slot, index, count));
    this.ring.replaceChildren(centre, ...chips);
    this.ring.style.setProperty('--count', String(count));
    if (fresh) this.ring.classList.add('carousel-enter'); else this.ring.classList.remove('carousel-enter');
  }
  private slotChip(view: CarouselView, slot: CarouselSlotView, index: number, count: number): HTMLElement {
    const cost = UNIT_DEFINITIONS[slot.definitionId]?.cost ?? 0;
    const mine = view.pickedSlot === slot.slot, taken = slot.pickedBy !== null;
    const takable = view.eligible && !taken;
    const chip = element('button', '', `carousel-slot cost-${cost}${taken ? ' taken' : ''}${mine ? ' mine' : ''}${takable ? ' takable' : ''}`);
    chip.type = 'button'; chip.disabled = !takable;
    chip.style.setProperty('--angle', `${(360 / Math.max(1, count)) * index - 90}deg`);
    chip.dataset.debug = `online:carousel-slot:${slot.slot}`; chip.dataset.slot = String(slot.slot); chip.dataset.definition = slot.definitionId;
    if (slot.pickedBy) chip.dataset.pickedBy = slot.pickedBy;
    const holder = slot.pickedBy ? this.seats.find(seat => seat.seatId === slot.pickedBy) : undefined;
    const auto = slot.pickedBy !== null && view.autoPicked.includes(slot.pickedBy);
    const label = `${unitName(slot.definitionId)} · 携带 ${slot.items.map(itemName).join('、')}`;
    chip.title = taken ? `${label} · 已被 ${holder?.name ?? slot.pickedBy}${auto ? '（自动）' : ''} 选走` : label;
    chip.setAttribute('aria-label', chip.title);
    const portrait = element('span', '', 'carousel-portrait');
    portrait.innerHTML = heroPortraitHtml(slot.definitionId, 44, heroEmblemSvg(slot.definitionId, 44));
    chip.append(portrait, element('span', unitName(slot.definitionId), 'carousel-name'));
    const held = element('span', '', 'carousel-items'); held.dataset.debug = `online:carousel-items:${slot.slot}`; held.dataset.item = slot.items.join(',');
    for (const itemId of slot.items) held.insertAdjacentHTML('beforeend', itemMarkHtml(itemId, 16));
    chip.append(held);
    if (taken) chip.append(element('span', `${mine ? '我' : holder?.name ?? '已选'}${auto ? ' · 自动' : ''}`, `carousel-taker${auto ? ' auto' : ''}`));
    chip.addEventListener('click', () => {
      const current = this.view;
      if (!current?.eligible || chip.disabled || this.pending !== null) return;
      this.pending = slot.slot; chip.classList.add('pending'); this.tick();
      this.onPick(slot.slot, current);
    });
    return chip;
  }
  private renderOrder(view: CarouselView): void {
    const picked = new Set(view.slots.flatMap(slot => slot.pickedBy ? [slot.pickedBy] : []));
    const rows = carouselGroups(view).map((batch, index) => {
      const state = batch.releaseAtMs <= view.elapsedMs ? 'open' : 'waiting';
      const row = element('li', '', `carousel-batch ${state}${batch.seatIds.includes(this.mySeatId) ? ' mine' : ''}`);
      row.dataset.batch = String(index); row.dataset.releaseAt = String(batch.releaseAtMs); row.dataset.debug = `online:carousel-batch:${index}`;
      row.append(element('span', `${index + 1}`, 'carousel-batch-no'));
      const names = element('span', '', 'carousel-batch-seats');
      for (const seatId of batch.seatIds) {
        const seat = this.seats.find(candidate => candidate.seatId === seatId);
        const tag = element('span', seat?.name ?? seatId, `carousel-seat${picked.has(seatId) ? ' picked' : ''}${seatId === this.mySeatId ? ' me' : ''}`);
        const auto = view.autoPicked.includes(seatId);
        if (auto) tag.classList.add('auto');
        tag.dataset.seat = seatId; tag.title = seat ? `${seat.name} · 生命 ${seat.hp}${picked.has(seatId) ? auto ? ' · 已自动选取' : ' · 已选' : ''}` : seatId;
        names.append(tag);
      }
      row.append(names, element('span', '', 'carousel-wait'));
      return row;
    });
    this.order.replaceChildren(...rows);
  }
  dispose(): void { this.root.remove(); }
}

/** One unit a carousel grant queued because my bench was full (`PrivateSeatView.pendingCarouselUnits`, MULTIPLAYER_CONTRACT §21.5). */
export interface PendingCarouselUnitView { readonly receiptId: string; readonly unitId: string; readonly definitionId: string }
/** The queued units of my seat view; empty when the server sent none. */
export function readPendingCarouselUnits(state: object): readonly PendingCarouselUnitView[] {
  const pending = (state as { readonly pendingCarouselUnits?: unknown }).pendingCarouselUnits;
  return Array.isArray(pending) ? pending as PendingCarouselUnitView[] : [];
}

/**
 * Units a carousel pick could not place because my bench was full. The server moves them in by itself once a bench slot is
 * free (the rules' `resolvePendingCarouselUnits`); the only command here is the explicit sell, the same `sell` as any unit.
 */
export class PendingCarouselQueue {
  readonly root: HTMLElement;
  private key = '';
  constructor(host: HTMLElement, private readonly onSell: (unitId: string) => void) {
    this.root = element('aside', '', 'carousel-queue'); this.root.hidden = true; this.root.dataset.debug = 'online:carousel-queue';
    this.root.setAttribute('aria-label', '选秀单位等待入席');
    host.append(this.root);
  }
  render(units: readonly PendingCarouselUnitView[], operable: boolean): void {
    const key = `${operable}|${units.map(unit => unit.unitId).join(',')}`;
    if (key === this.key) return;
    this.key = key;
    this.root.hidden = units.length === 0;
    const rows = units.map(unit => {
      const row = element('div', '', 'carousel-queue-row'); row.dataset.unit = unit.unitId;
      const cost = UNIT_DEFINITIONS[unit.definitionId]?.cost ?? 0;
      const sell = element('button', `出售 +${cost}`, 'carousel-queue-sell'); sell.type = 'button'; sell.disabled = !operable;
      sell.dataset.debug = `online:carousel-queue-sell:${unit.unitId}`;
      sell.addEventListener('click', () => { if (!sell.disabled) this.onSell(unit.unitId); });
      row.append(element('span', unitName(unit.definitionId), 'carousel-queue-name'), sell);
      return row;
    });
    this.root.replaceChildren(element('strong', '选秀单位等待入席 · 备战席有空位时自动放入', 'carousel-queue-title'), ...rows);
  }
  dispose(): void { this.root.remove(); }
}
