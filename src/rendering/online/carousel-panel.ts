/**
 * G1-P7 shared carousel (选秀) panel. A ring of the units standing on the carousel, each with the item it carries,
 * floating over the enemy half of my board so the bench below stays visible (a picked unit lands there at once).
 * Release order, the countdown to my batch and to the carousel's end are shown beside it. Like TFT: the units I may take
 * light up when my batch is released, units already taken are greyed with the taker's name, and a seat the server picked
 * for (bot, disconnected, or no click before the deadline) is marked "自动".
 *
 * P7-1: while the carousel runs I can switch between the ring and my own board (the toggle in the head, or Space). On the
 * board side a compact bar keeps the countdown and the "轮到我" hint; switching back shows the same panel (nothing is
 * rebuilt or forgotten, a pick still out stays pending). A new carousel always opens on the ring. Viewing only: picks,
 * bots and the server's auto-pick do not depend on which side is shown.
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
    // Where the unit lands (bench, board or the holding slot) is the rules' call; the panel does not claim one.
    return view.autoPicked.includes(mySeatId) ? `未在截止前选择 · 已自动选取 ${what}` : `已选取 ${what}`;
  }
  if (view.eligible) return '已放行 · 点击一个单位选取';
  const at = view.releaseAtMs[mySeatId];
  if (at === undefined) return '观看选秀';
  if (view.status === 'closed' || view.elapsedMs >= view.deadlineMs) return '选秀结束 · 服务器代选中';
  const mine = carouselGroups(view).findIndex(group => group.seatIds.includes(mySeatId));
  const wait = Math.max(0, Math.ceil((view.startedAt + at - serverNow) / 1000));
  return `你在第 ${mine + 1} 批 · ${wait} 秒后放行 · 生命越低越先选`;
}
/** The compact bar's line while I look at my board: my turn is called out, everything else reads as on the ring. */
export function carouselBoardText(view: CarouselView, mySeatId: string, serverNow: number): string {
  return myTurn(view) ? '轮到我选秀 · 返回选秀盘选取' : carouselStatusText(view, mySeatId, serverNow);
}
const myTurn = (view: CarouselView) => view.eligible && view.pickedSlot === null && view.status !== 'closed';
export type CarouselSide = 'carousel' | 'board';
/** Space switches sides, unless the key goes to a control or a text field (a focused slot button takes Space as a click). */
const SWITCH_KEY = 'Space';

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
  /** Which side I look at while the carousel runs; a new carousel resets it to the ring. */
  private side: CarouselSide = 'carousel';
  /** Shown instead of the panel while I look at my board: countdown, my line, the way back. */
  private bar: HTMLElement;
  private barTimer: HTMLElement;
  private barStatus: HTMLElement;

  constructor(host: HTMLElement, private readonly onPick: (slot: number, view: CarouselView) => void, private readonly onSide: (side: CarouselSide) => void = () => {}) {
    this.root = element('section', '', 'carousel-panel'); this.root.id = 'carousel-panel'; this.root.hidden = true;
    this.root.dataset.debug = 'online:carousel'; this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-label', '选秀');
    const head = element('header', '', 'carousel-head');
    this.title = element('strong', '选秀', 'carousel-title');
    this.status = element('span', '', 'carousel-status'); this.status.dataset.debug = 'online:carousel-status'; this.status.setAttribute('role', 'status');
    const toBoard = element('button', '查看我的棋盘', 'carousel-switch'); toBoard.type = 'button'; toBoard.dataset.debug = 'online:carousel-to-board';
    toBoard.title = '切到自己的棋盘（空格）· 选秀继续进行'; toBoard.append(element('kbd', '空格'));
    toBoard.addEventListener('click', () => this.setSide('board'));
    head.append(this.title, this.status, toBoard);
    const body = element('div', '', 'carousel-body');
    this.ring = element('div', '', 'carousel-ring'); this.ring.dataset.debug = 'online:carousel-ring';
    this.timer = element('span', '', 'carousel-timer'); this.timer.dataset.debug = 'online:carousel-timer'; this.timer.setAttribute('role', 'timer');
    this.timer.setAttribute('aria-label', '选秀剩余时间');
    this.order = element('ol', '', 'carousel-order'); this.order.dataset.debug = 'online:carousel-order'; this.order.setAttribute('aria-label', '放行顺序');
    body.append(this.ring, this.order);
    this.root.append(head, body);
    this.bar = element('div', '', 'carousel-bar'); this.bar.hidden = true; this.bar.dataset.debug = 'online:carousel-bar';
    this.bar.setAttribute('role', 'status'); this.bar.setAttribute('aria-label', '选秀进行中');
    this.barTimer = element('span', '', 'carousel-bar-timer'); this.barTimer.dataset.debug = 'online:carousel-bar-timer'; this.barTimer.setAttribute('role', 'timer');
    this.barStatus = element('span', '', 'carousel-bar-status'); this.barStatus.dataset.debug = 'online:carousel-bar-status';
    const back = element('button', '返回选秀', 'carousel-switch'); back.type = 'button'; back.dataset.debug = 'online:carousel-to-ring';
    back.title = '回到选秀盘（空格）'; back.append(element('kbd', '空格'));
    back.addEventListener('click', () => this.setSide('carousel'));
    this.bar.append(element('strong', '选秀', 'carousel-bar-title'), this.barTimer, element('span', '秒', 'carousel-timer-unit'), this.barStatus, back);
    host.append(this.root, this.bar);
    document.addEventListener('keydown', this.onKey);
  }
  get open(): boolean { return this.view !== null; }
  /** The side shown while a carousel runs; null when there is none. */
  get showing(): CarouselSide | null { return this.view ? this.side : null; }
  /** Switches between the ring and my board. Only what is shown changes; the view, a pending pick and the clocks stay. */
  setSide(side: CarouselSide): void {
    if (!this.view || side === this.side) return;
    this.side = side; this.applySide(); this.tick(); this.onSide(side);
  }
  toggleSide(): void { this.setSide(this.side === 'carousel' ? 'board' : 'carousel'); }
  private applySide(): void {
    const open = this.view !== null;
    this.root.hidden = !open || this.side !== 'carousel';
    this.bar.hidden = !open || this.side !== 'board';
  }
  private onKey = (event: KeyboardEvent) => {
    if (event.code !== SWITCH_KEY || !this.view || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, button, [role="button"]'))) return;
    event.preventDefault(); this.toggleSide();
  };

  /** Shows the carousel of this view, or hides the panel when the view has none. */
  render(view: CarouselView | null, seats: readonly SeatPublic[], mySeatId: string, serverNow: number): void {
    if (!view) { this.hide(); return; }
    const fresh = this.view?.id !== view.id;
    if (fresh) this.side = 'carousel';
    this.view = view; this.seats = seats; this.mySeatId = mySeatId; this.clockOffset = performance.now() - serverNow;
    this.pending = null;
    this.applySide(); this.root.dataset.carousel = view.id;
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
    this.view = null; this.pending = null; this.side = 'carousel'; this.applySide();
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
    if (this.side === 'board') {
      if (this.barTimer.textContent !== seconds) this.barTimer.textContent = seconds;
      const line = this.pending !== null && view.eligible ? '选取中…' : carouselBoardText(view, this.mySeatId, now);
      if (this.barStatus.textContent !== line) this.barStatus.textContent = line;
      this.bar.classList.toggle('my-turn', myTurn(view) && this.pending === null);
    }
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
  dispose(): void { document.removeEventListener('keydown', this.onKey); this.root.remove(); this.bar.remove(); }
}

/**
 * One unit in the carousel holding slot (临时位): a pick the rules could not place because my bench and my board were both
 * full (MULTIPLAYER_CONTRACT §21.6). The server sends them as `PrivateSeatView.heldCarouselUnits`, copied from the rules'
 * `carousel.heldCarouselUnits`; only `readHeldCarouselUnits` reads the wire.
 */
export interface HeldCarouselUnitView { readonly receiptId: string; readonly unitId: string; readonly definitionId: string }
/** The held units of my seat view (or its display copy); empty when the server sent none. */
export function readHeldCarouselUnits(state: object): readonly HeldCarouselUnitView[] {
  const held = (state as { readonly heldCarouselUnits?: unknown }).heldCarouselUnits;
  return Array.isArray(held) ? held as HeldCarouselUnitView[] : [];
}

/**
 * The holding slot (临时位) beside the bench: a carousel unit kept there does not fight. The server moves it out by
 * itself once the bench or the board has room (the rules decide where); the only command here is the explicit sell, the
 * same `sell` as any unit.
 */
export class CarouselHoldingSlot {
  readonly root: HTMLElement;
  private key = '';
  constructor(host: HTMLElement, private readonly onSell: (unitId: string) => void) {
    this.root = element('aside', '', 'carousel-holding'); this.root.hidden = true; this.root.dataset.debug = 'online:carousel-holding';
    this.root.setAttribute('aria-label', '临时位 · 不参战');
    host.append(this.root);
  }
  render(units: readonly HeldCarouselUnitView[], operable: boolean): void {
    const key = `${operable}|${units.map(unit => unit.unitId).join(',')}`;
    if (key === this.key) return;
    this.key = key;
    this.root.hidden = units.length === 0;
    const cards = units.map(unit => {
      const cost = UNIT_DEFINITIONS[unit.definitionId]?.cost ?? 0;
      const card = element('div', '', `carousel-holding-unit cost-${cost}`); card.dataset.unit = unit.unitId; card.dataset.definition = unit.definitionId;
      card.dataset.debug = `online:carousel-holding-unit:${unit.unitId}`;
      card.title = `${unitName(unit.definitionId)} · 临时位：只保管，不参战 · 备战席或场上有空位时自动移入`;
      const portrait = element('span', '', 'carousel-holding-portrait');
      portrait.innerHTML = heroPortraitHtml(unit.definitionId, 40, heroEmblemSvg(unit.definitionId, 40));
      const sell = element('button', `出售 +${cost}`, 'carousel-holding-sell'); sell.type = 'button'; sell.disabled = !operable;
      sell.dataset.debug = `online:carousel-holding-sell:${unit.unitId}`;
      sell.title = operable ? `出售 ${unitName(unit.definitionId)}` : '准备阶段可出售';
      sell.addEventListener('click', () => { if (!sell.disabled) this.onSell(unit.unitId); });
      card.append(portrait, element('span', unitName(unit.definitionId), 'carousel-holding-name'), element('span', '不参战', 'carousel-holding-idle'), sell);
      return card;
    });
    const head = element('header', '', 'carousel-holding-head'); head.title = '临时位：只保管，不参战 · 备战席或场上有空位时自动移入';
    head.append(element('strong', '临时位', 'carousel-holding-title'), element('span', '只保管不参战 · 有空位自动移入', 'carousel-holding-note'));
    this.root.replaceChildren(head, ...cards);
  }
  dispose(): void { this.root.remove(); }
}
