import { onTooltipTextChanged } from '../../presentation/tooltip-text-loader';
import { onAugmentTextChanged } from '../../presentation/augment-text-loader';
/**
 * Read-only "对方阵容" panel (work order C5): opened by clicking a seat in the right column, it floats over
 * the top of my board without replacing it. It shows what the server published as that seat's public
 * build (board and bench units, stars, items, anomalies, unequipped items, augments) and the traits the board units
 * activate. Streak, gold and shop are not published. It sends no command and reads no private state:
 * everything comes from `SeatPublic.publicBoard`.
 */
import type { Board } from '../../simulation/board';
import type { GameState } from '../../simulation/game';
import type { ItemInstance } from '../../simulation/strategy-types';
import { deriveTraits } from '../../simulation/trait-snapshot';
import { UNIT_DEFINITIONS, type Unit } from '../../simulation/units';
import { getHeroIdentity, heroEmblemSvg, traitDisplayName } from '../../presentation/hero-identity';
import { itemMarkHtml } from '../../presentation/item-codex';
import { heroPortraitHtml } from '../../presentation/s13-assets';
import { attachItemPopover } from '../../presentation/item-codex';
import { traitHoverCard } from '../../presentation/hover-card';
import { attachUnitCards } from '../../presentation/unit-card';
import { attachTraitCards, renderTraitRows, traitRows, type TraitRow } from '../trait-column';
import type { PublicBenchUnit, PublicBoard, PublicBoardUnit, SeatPublic } from './protocol';
import { anomalyIconHtml, itemDisplayName } from '../../presentation/g23-display';
import { augmentDisplayName, augmentIconOrBadgeHtml, augmentPlayerDescription } from '../../presentation/augment-display';
import { publicOrbsElement, readPublicOrbs } from './orb-dock';
import { anomalyNotes, unitAnomalies } from '../../presentation/anomaly-display';

/** Bench slots drawn when the seat's bench is shorter (TFT bench width); a longer bench draws every slot. */
const BENCH_SLOTS = 9;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}

/** The public board as a preparation state for the rules' trait selector (definition ids and board cells only). */
function publicPreparation(board: PublicBoard, layout: Board): GameState {
  return { board: layout, benchSize: 0, units: board.units.filter(unit => !unit.summon).map((unit, index) => ({
    id: `public-${index}`, definitionId: unit.definitionId, team: 'player', starLevel: unit.starLevel as Unit['starLevel'], location: { kind: 'board', cell: unit.cell },
  })) };
}
/** The public board units' held items, so emblems count toward the scouted traits as they do on my own column. */
function publicItems(board: PublicBoard): ItemInstance[] {
  return board.units.filter(unit => !unit.summon).flatMap((unit, index) => (unit.items ?? []).map((definitionId, slot) => ({
    id: `public-${index}-${slot}`, definitionId, location: { kind: 'unit' as const, unitId: `public-${index}`, slot },
  })));
}
/** G2: the trait column rows of a public board (same rows and order as my own column). */
export function publicTraitRows(board: PublicBoard, layout: Board): TraitRow[] {
  try { return traitRows(deriveTraits(publicPreparation(board, layout), 'player', undefined, undefined, publicItems(board))); } catch { return []; }
}
/** Traits a public board activates; deriveTraits only reads definition ids and board locations. */
export function publicTraits(board: PublicBoard, layout: Board): { traitId: string; name: string; count: number; tier: number }[] {
  return deriveTraits(publicPreparation(board, layout), 'player', undefined, undefined, publicItems(board)).filter(trait => trait.count > 0)
    .map(trait => ({ traitId: trait.traitId, name: traitDisplayName(trait.traitId), count: trait.count, tier: trait.tier }))
    .sort((a, b) => b.tier - a.tier || b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

/** Seat avatar (TFT player icon): the most expensive deployed unit, higher star first; null for an empty board. */
export function avatarUnit(board: PublicBoard | undefined): PublicBoardUnit | null {
  let best: PublicBoardUnit | null = null;
  for (const unit of board?.units ?? []) {
    if (unit.summon) continue;
    const cost = UNIT_DEFINITIONS[unit.definitionId]?.cost ?? 0, bestCost = best ? UNIT_DEFINITIONS[best.definitionId]?.cost ?? 0 : -1;
    if (cost > bestCost || (cost === bestCost && (unit.effectiveStarLevel ?? unit.starLevel) > (best!.effectiveStarLevel ?? best!.starLevel))) best = unit;
  }
  return best;
}

export class OpponentBoardPanel {
  readonly root: HTMLElement;
  private seatId: string | null = null;
  private lastView: { seat: SeatPublic; mine: boolean } | undefined;
  private rows: readonly TraitRow[] = [];
  private readonly detach: (() => void)[] = [];
  constructor(host: HTMLElement, private readonly layout: () => Board, private readonly onClose: () => void) {
    this.root = element('section', '', 'opponent-board'); this.root.id = 'opponent-board'; this.root.hidden = true;
    this.root.dataset.debug = 'online:opponent-board'; this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-label', '对方阵容');
    host.append(this.root);
    const redraw = () => {
      if (this.seatId !== null && this.lastView) this.render(this.lastView.seat, this.lastView.mine);
    };
    this.detach.push(onAugmentTextChanged(redraw), onTooltipTextChanged(redraw));
    document.addEventListener('keydown', this.onKey);
    // G2: the same trait, unit and item descriptions as on my own side; read-only.
    this.detach.push(attachTraitCards(this.root, traitHoverCard(), traitId => this.rows.find(row => row.traitId === traitId)?.members ?? []),
      attachUnitCards(this.root), attachItemPopover(this.root, 'item-popover-scout'));
  }
  get openSeatId(): string | null { return this.seatId; }
  /** True while the 3D layer draws the open seat: the panel is a strip, and Space (like Esc) goes back to my board. */
  get drawnIn3d(): boolean { return this.root.hasAttribute('data-scout-3d'); }
  set drawnIn3d(on: boolean) { this.root.toggleAttribute('data-scout-3d', on); }
  /** Opens this seat, or closes the panel when it is already showing it. */
  toggle(seat: SeatPublic, mine: boolean): void {
    if (this.seatId === seat.seatId) { this.close(); return; }
    this.seatId = seat.seatId; this.render(seat, mine); this.root.hidden = false;
  }
  /** Keeps the open panel in step with the latest view; closes it if the seat disappeared. */
  update(seats: readonly SeatPublic[], mySeatId: string): void {
    if (this.seatId === null) return;
    const seat = seats.find(candidate => candidate.seatId === this.seatId);
    if (!seat) { this.close(); return; }
    this.render(seat, seat.seatId === mySeatId);
  }
  close(): void {
    if (this.seatId === null) return;
    this.seatId = null; this.root.hidden = true; this.root.replaceChildren(); this.onClose();
  }
  dispose(): void { document.removeEventListener('keydown', this.onKey); this.detach.forEach(dispose => dispose()); this.root.remove(); }
  private onKey = (event: KeyboardEvent) => {
    if (this.seatId === null) return;
    const target = event.target as HTMLElement | null;
    const space = event.code === 'Space' && this.drawnIn3d && !event.repeat && !target?.closest?.('input, textarea, select, button, [contenteditable]');
    // Other document listeners (the carousel's Space switch) must not see this key too.
    if (event.key === 'Escape' || space) { event.stopImmediatePropagation(); event.preventDefault(); this.close(); }
  };

  private render(seat: SeatPublic, mine: boolean): void {
    this.lastView = { seat, mine };
    const board = seat.publicBoard ?? { units: [] }, layout = this.layout();
    this.root.dataset.seat = seat.seatId;
    const head = element('header', '', 'opponent-head');
    head.append(element('strong', `${seat.name}${mine ? '（我）' : ''} 的阵容`, 'opponent-name'),
      element('span', seat.alive ? `生命 ${seat.hp} · Lv ${seat.level}` : `已淘汰 · 第 ${seat.rank ?? '?'} 名`, 'opponent-meta'));
    // v15: the seat's unclaimed orbs, count and tiers only (SeatPublic.orbs).
    const orbs = publicOrbsElement(readPublicOrbs(seat));
    if (orbs) head.append(orbs);
    // 3D strip only (CSS): the seat's anomalies in one chip, unit by unit on hover (the grid with their marks is hidden there).
    const marked = [...board.units, ...board.bench ?? []].filter(unit => unitAnomalies(unit.anomaly, unit.items).length);
    if (marked.length) {
      const chip = element('span', `异常 ${marked.length}`, 'opponent-anomalies');
      chip.title = marked.map(unit => `${getHeroIdentity(unit.definitionId).name}：${anomalyNotes(unitAnomalies(unit.anomaly, unit.items)).join('\n')}`).join('\n'); head.append(chip);
    }
    const close = element('button', '关闭', 'opponent-close'); close.type = 'button'; close.dataset.debug = 'online:opponent-close';
    close.setAttribute('aria-label', '关闭对方阵容（Esc）'); close.addEventListener('click', () => this.close()); head.append(close);

    const grid = element('div', '', 'opponent-grid'); grid.style.setProperty('--cols', String(layout.columns));
    const byCell = new Map(board.units.map(unit => [`${unit.cell.col},${unit.cell.row}`, unit]));
    // Only the owner's own half (its deployment rows, where every public unit stands), as TFT shows a scouted board: the
    // panel then stays over the enemy half of my board and never over my deployment rows (G1 scouting).
    const zone = layout.deploymentZones.player;
    const firstRow = Math.min(zone.firstRow, ...board.units.map(unit => unit.cell.row)), lastRow = Math.max(zone.lastRow, ...board.units.map(unit => unit.cell.row));
    for (let row = firstRow; row <= lastRow; row++) {
      const line = element('div', `` , `opponent-row${row % 2 ? ' odd' : ''}`);
      for (let col = 0; col < layout.columns; col++) {
        const unit = byCell.get(`${col},${row}`);
        const cell = element('div', '', `opponent-cell${unit ? ' filled' : ''}`);
        if (unit) cell.append(this.unitChip(unit, `${unit.cell.col},${unit.cell.row}`));
        line.append(cell);
      }
      grid.append(line);
    }
    // G2: the opponent's trait column, same rows, breakpoints and hover as mine.
    this.rows = publicTraitRows(board, layout);
    const traits = renderTraitRows(this.rows, 'online:opponent-traits', board.units.some(unit => !unit.summon) ? '无羁绊' : '场上暂无单位');
    traits.classList.add('opponent-traits');
    for (const row of Array.from(traits.children)) row.classList.add('opponent-trait');
    traits.title = '只读 · 羁绊按场上单位计算（不含商店、金币、连胜）';
    this.root.replaceChildren(head, this.augmentRow(board.augments ?? []), grid, this.benchRow(board.bench ?? []), this.looseItemRow(board.looseItems ?? []), traits);
  }
  /** 2026-10-20 scouting: the seat's owned augments, in the order acquired. */
  private augmentRow(augments: readonly string[]): HTMLElement {
    const row = element('div', '', 'opponent-augments'); row.dataset.debug = 'online:opponent-augments';
    if (!augments.length) { row.append(element('span', '暂无强化', 'opponent-empty')); return row; }
    for (const id of augments) {
      const chip = element('span', augmentDisplayName(id), 'opponent-augment'); chip.dataset.augment = id;
      chip.title = [augmentDisplayName(id), augmentPlayerDescription(id)].filter(Boolean).join('\n');
      chip.insertAdjacentHTML('afterbegin', augmentIconOrBadgeHtml(id, 18));
      row.append(chip);
    }
    return row;
  }
  /** 2026-10-20 scouting: the seat's bench, slot by slot, with the items its units hold. */
  private benchRow(bench: readonly PublicBenchUnit[]): HTMLElement {
    const row = element('div', '', 'opponent-bench'); row.dataset.debug = 'online:opponent-bench'; row.setAttribute('aria-label', '备战席');
    const bySlot = new Map(bench.map(unit => [unit.slot, unit]));
    const slots = Math.max(BENCH_SLOTS, ...bench.map(unit => unit.slot + 1));
    for (let slot = 0; slot < slots; slot++) {
      const unit = bySlot.get(slot), cell = element('div', '', `opponent-cell${unit ? ' filled' : ''}`);
      if (unit) cell.append(this.unitChip(unit, `bench-${slot}`));
      row.append(cell);
    }
    return row;
  }
  /** 2026-10-20 scouting: items no unit holds (the item bench). */
  private looseItemRow(items: readonly string[]): HTMLElement {
    const row = element('div', '', 'opponent-loose-items'); row.dataset.debug = 'online:opponent-loose-items';
    if (!items.length) { row.hidden = true; return row; }
    row.append(element('span', '装备', 'opponent-loose-label'));
    for (const id of items) {
      const mark = element('span', '', 'opponent-item'); mark.dataset.itemDef = id; mark.title = itemDisplayName(id);
      mark.insertAdjacentHTML('afterbegin', itemMarkHtml(id, 18)); row.append(mark);
    }
    return row;
  }
  private unitChip(unit: PublicBoardUnit | PublicBenchUnit, place: string): HTMLElement {
    const identity = getHeroIdentity(unit.definitionId);
    const chip = element('div', '', `opponent-unit cost-${UNIT_DEFINITIONS[unit.definitionId]?.cost ?? 0}`);
    chip.dataset.debug = `online:opponent-unit:${place}`;
    const star = unit.effectiveStarLevel ?? unit.starLevel;
    chip.dataset.inspectId = `scout:${this.openSeatId}:${place}:${unit.definitionId}:${star}`;
    chip.dataset.definition = unit.definitionId; chip.dataset.star = String(star);
    if (unit.anomaly) chip.dataset.unitAnomaly = unit.anomaly;
    // G2-4b: a summon's card would show champion base stats, not its stage values; its title names it instead.
    const summon = 'summon' in unit && unit.summon === true;
    if (summon) chip.dataset.summon = 'true';
    else { chip.dataset.unitDef = unit.definitionId; chip.dataset.unitStar = String(star); }
    chip.title = `${identity.name}${summon ? '（兹若特传送门召唤）' : ''} ${'★'.repeat(star)}${star === 4 ? '（终极英雄）' : ''}${unit.items.length ? ` · ${unit.items.map(id => itemDisplayName(id)).join('、')}` : ''}`;
    const portrait = element('span', '', 'opponent-portrait'); portrait.innerHTML = heroPortraitHtml(unit.definitionId, 36, heroEmblemSvg(unit.definitionId, 36));
    chip.append(element('span', '★'.repeat(star), `opponent-stars star-${star}`), portrait);
    const anomalies = unitAnomalies(unit.anomaly, unit.items);
    if (anomalies.length) {
      // 2026-10-20 scouting: the anomaly bound to this unit, marked on its portrait with the shared anomaly icon.
      const mark = element('span', '', 'opponent-anomaly');
      mark.dataset.anomaly = anomalies[0].id; mark.title = anomalyNotes(anomalies).join('\n');
      mark.insertAdjacentHTML('afterbegin', anomalyIconHtml(14) || '<b>异</b>');
      chip.title += ` · ${mark.title}`; chip.append(mark);
    }
    if (unit.items.length) {
      const items = element('span', '', 'opponent-items');
      for (const id of unit.items) {
        const mark = element('span', '', 'opponent-item'); mark.dataset.itemDef = id; mark.insertAdjacentHTML('afterbegin', itemMarkHtml(id, 13)); items.append(mark);
      }
      chip.append(items);
    }
    return chip;
  }
}
