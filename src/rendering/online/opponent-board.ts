/**
 * Read-only "对方阵容" panel (work order C5): opened by clicking a seat in the right column, it floats over
 * the top of my board without replacing it. It shows what the server published as that seat's public
 * board (deployed units, stars, items) and the traits those units activate. It sends no command and
 * reads no private state: everything comes from `SeatPublic.publicBoard`.
 */
import type { Board } from '../../simulation/board';
import type { GameState } from '../../simulation/game';
import { ITEM_DEFINITIONS } from '../../simulation/content/items';
import { deriveTraits } from '../../simulation/trait-snapshot';
import { UNIT_DEFINITIONS, type Unit } from '../../simulation/units';
import { getHeroIdentity, heroEmblemSvg, traitDisplayName } from '../../presentation/hero-identity';
import { itemMarkHtml } from '../../presentation/item-codex';
import { heroPortraitHtml } from '../../presentation/s13-assets';
import { attachItemPopover } from '../../presentation/item-codex';
import { traitHoverCard } from '../../presentation/hover-card';
import { attachUnitCards } from '../../presentation/unit-card';
import { attachTraitCards, renderTraitRows, traitRows, type TraitRow } from '../trait-column';
import type { PublicBoard, PublicBoardUnit, SeatPublic } from './protocol';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}

/** The public board as a preparation state for the rules' trait selector (definition ids and board cells only). */
function publicPreparation(board: PublicBoard, layout: Board): GameState {
  return { board: layout, benchSize: 0, units: board.units.map((unit, index) => ({
    id: `public-${index}`, definitionId: unit.definitionId, team: 'player', starLevel: unit.starLevel as Unit['starLevel'], location: { kind: 'board', cell: unit.cell },
  })) };
}
/** G2: the trait column rows of a public board (same rows and order as my own column). */
export function publicTraitRows(board: PublicBoard, layout: Board): TraitRow[] {
  try { return traitRows(deriveTraits(publicPreparation(board, layout), 'player')); } catch { return []; }
}
/** Traits a public board activates; deriveTraits only reads definition ids and board locations. */
export function publicTraits(board: PublicBoard, layout: Board): { traitId: string; name: string; count: number; tier: number }[] {
  return deriveTraits(publicPreparation(board, layout), 'player').filter(trait => trait.count > 0)
    .map(trait => ({ traitId: trait.traitId, name: traitDisplayName(trait.traitId), count: trait.count, tier: trait.tier }))
    .sort((a, b) => b.tier - a.tier || b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

/** Seat avatar (TFT player icon): the most expensive deployed unit, higher star first; null for an empty board. */
export function avatarUnit(board: PublicBoard | undefined): PublicBoardUnit | null {
  let best: PublicBoardUnit | null = null;
  for (const unit of board?.units ?? []) {
    const cost = UNIT_DEFINITIONS[unit.definitionId]?.cost ?? 0, bestCost = best ? UNIT_DEFINITIONS[best.definitionId]?.cost ?? 0 : -1;
    if (cost > bestCost || (cost === bestCost && unit.starLevel > best!.starLevel)) best = unit;
  }
  return best;
}

export class OpponentBoardPanel {
  readonly root: HTMLElement;
  private seatId: string | null = null;
  private rows: readonly TraitRow[] = [];
  private readonly detach: (() => void)[] = [];
  constructor(host: HTMLElement, private readonly layout: () => Board, private readonly onClose: () => void) {
    this.root = element('section', '', 'opponent-board'); this.root.id = 'opponent-board'; this.root.hidden = true;
    this.root.dataset.debug = 'online:opponent-board'; this.root.setAttribute('role', 'dialog'); this.root.setAttribute('aria-label', '对方阵容');
    host.append(this.root);
    document.addEventListener('keydown', this.onKey);
    // G2: the same trait, unit and item descriptions as on my own side; read-only.
    this.detach.push(attachTraitCards(this.root, traitHoverCard(), traitId => this.rows.find(row => row.traitId === traitId)?.members ?? []),
      attachUnitCards(this.root), attachItemPopover(this.root, 'item-popover-scout'));
  }
  get openSeatId(): string | null { return this.seatId; }
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
  private onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && this.seatId !== null) { event.stopPropagation(); this.close(); } };

  private render(seat: SeatPublic, mine: boolean): void {
    const board = seat.publicBoard ?? { units: [] }, layout = this.layout();
    this.root.dataset.seat = seat.seatId;
    const head = element('header', '', 'opponent-head');
    head.append(element('strong', `${seat.name}${mine ? '（我）' : ''} 的阵容`, 'opponent-name'),
      element('span', seat.alive ? `生命 ${seat.hp} · Lv ${seat.level}` : `已淘汰 · 第 ${seat.rank ?? '?'} 名`, 'opponent-meta'));
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
        if (unit) cell.append(this.unitChip(unit));
        line.append(cell);
      }
      grid.append(line);
    }
    // G2: the opponent's trait column, same rows, breakpoints and hover as mine.
    this.rows = publicTraitRows(board, layout);
    const traits = renderTraitRows(this.rows, 'online:opponent-traits', board.units.length ? '无羁绊' : '场上暂无单位');
    traits.classList.add('opponent-traits');
    for (const row of Array.from(traits.children)) row.classList.add('opponent-trait');
    traits.title = '只读 · 仅显示场上单位与装备（不含备战席、商店、金币）';
    this.root.replaceChildren(head, grid, traits);
  }
  private unitChip(unit: PublicBoardUnit): HTMLElement {
    const identity = getHeroIdentity(unit.definitionId);
    const chip = element('div', '', `opponent-unit cost-${UNIT_DEFINITIONS[unit.definitionId]?.cost ?? 0}`);
    chip.dataset.debug = `online:opponent-unit:${unit.cell.col},${unit.cell.row}`;
    chip.dataset.definition = unit.definitionId; chip.dataset.star = String(unit.starLevel);
    chip.dataset.unitDef = unit.definitionId; chip.dataset.unitStar = String(unit.starLevel);
    chip.title = `${identity.name} ${'★'.repeat(unit.starLevel)}${unit.items.length ? ` · ${unit.items.map(id => ITEM_DEFINITIONS[id]?.name ?? id).join('、')}` : ''}`;
    const portrait = element('span', '', 'opponent-portrait'); portrait.innerHTML = heroPortraitHtml(unit.definitionId, 36, heroEmblemSvg(unit.definitionId, 36));
    chip.append(element('span', '★'.repeat(unit.starLevel), `opponent-stars star-${unit.starLevel}`), portrait);
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
