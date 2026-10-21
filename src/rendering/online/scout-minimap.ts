import { costColor } from '../../presentation/theme';
import { UNIT_DEFINITIONS } from '../../simulation/units';
import type { PlayerView, SeatPublic } from './protocol';

/** Deployment half of an owner's board as the public view gives it (rows 4-7 of 8, 7 columns). */
const FIRST_ROW = 4, ROWS = 4, COLUMNS = 7;

/**
 * 3D only (CSS shows it under a 3D layer): TFT's bottom-right minimap. One small board per seat with its units as
 * cost-coloured dots, from publicBoard alone; a click opens that seat (my own takes me back to my board).
 */
export class ScoutMinimap {
  readonly root = document.createElement('nav');
  constructor(host: HTMLElement, private readonly onSelect: (seatId: string) => void) {
    this.root.className = 'scout-minimap'; this.root.dataset.debug = 'online:minimap'; this.root.setAttribute('aria-label', '对手棋盘');
    host.append(this.root);
  }
  render(view: PlayerView | null, viewing: string | null): void {
    const shown = viewing ?? view?.mySeatId;
    this.root.replaceChildren(...(view?.seats ?? []).map(seat => this.tile(seat, seat.seatId === view!.mySeatId, seat.seatId === shown, seat.seatId === view!.opponentSeatId)));
  }
  dispose(): void { this.root.remove(); }
  private tile(seat: SeatPublic, me: boolean, shown: boolean, opponent: boolean): HTMLButtonElement {
    const tile = document.createElement('button');
    tile.type = 'button'; tile.dataset.seat = seat.seatId;
    tile.className = `minimap-seat${me ? ' me' : ''}${shown ? ' shown' : ''}${opponent ? ' opponent' : ''}${seat.alive ? '' : ' eliminated'}`;
    tile.title = `${seat.name}${me ? '（我）' : ''} · 生命 ${seat.hp}`;
    const board = document.createElement('span'); board.className = 'minimap-board';
    for (const unit of seat.publicBoard?.units ?? []) {
      const row = unit.cell.row - FIRST_ROW;
      if (row < 0 || row >= ROWS || unit.cell.col < 0 || unit.cell.col >= COLUMNS) continue;
      const dot = document.createElement('i');
      dot.style.left = `${((unit.cell.col + (row % 2 ? 0.75 : 0.25)) / (COLUMNS + 0.5)) * 100}%`;
      dot.style.top = `${((row + 0.5) / ROWS) * 100}%`;
      dot.style.background = unit.summon ? '#8a96a3' : costColor(UNIT_DEFINITIONS[unit.definitionId]?.cost ?? 1);
      board.append(dot);
    }
    const name = document.createElement('span'); name.className = 'minimap-name'; name.textContent = seat.name;
    const hp = document.createElement('b'); hp.className = 'minimap-hp'; hp.textContent = String(seat.hp);
    tile.append(board, name, hp);
    tile.addEventListener('click', () => this.onSelect(seat.seatId));
    return tile;
  }
}
