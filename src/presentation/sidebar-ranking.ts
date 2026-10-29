import { reducedMotion } from './preferences';

interface RankedSeat { readonly seatId: string; readonly alive: boolean; readonly hp: number; readonly rank: number | null }

/** Display order only. No verified 14.24 live-HP tie rule: retain the last displayed order;
 * the first projection's array is the server's seat order. Never use name or viewer identity. */
export function rankSidebarSeats<T extends RankedSeat>(seats: readonly T[], previous: readonly string[]): T[] {
  const last = new Map(previous.map((id, index) => [id, index]));
  const fallback = new Map(seats.map((seat, index) => [seat.seatId, previous.length + index]));
  return [...seats].sort((a, b) => Number(b.alive) - Number(a.alive)
    || (a.alive ? b.hp - a.hp : (a.rank ?? 99) - (b.rank ?? 99))
    || (last.get(a.seatId) ?? fallback.get(a.seatId)!) - (last.get(b.seatId) ?? fallback.get(b.seatId)!));
}

/** FLIP, with retained row nodes: unchanged pushes leave a running move alone. On another
 * rank change, start from the current visual position, including the unfinished move. */
export class SidebarRanking {
  private previous: string[] = [];
  private moves = new Map<HTMLElement, Animation>();
  render<T extends RankedSeat>(list: HTMLElement, seats: readonly T[], row: (seat: T) => HTMLElement): void {
    const ordered = rankSidebarSeats(seats, this.previous);
    const changed = ordered.length !== this.previous.length || ordered.some((seat, index) => seat.seatId !== this.previous[index]);
    const before = new Map<HTMLElement, { left: number; top: number }>();
    if (changed && !reducedMotion()) for (const node of Array.from(list.children) as HTMLElement[]) {
      if (node.getBoundingClientRect) before.set(node, node.getBoundingClientRect());
    }
    const rows = ordered.map(row);
    if (changed) {
      this.dispose();
      list.replaceChildren(...rows);
      for (const node of rows) {
        const from = before.get(node);
        if (!from || !node.animate) continue;
        const to = node.getBoundingClientRect(), x = from.left - to.left, y = from.top - to.top;
        if (!x && !y) continue;
        const animation = node.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
        this.moves.set(node, animation);
        animation.onfinish = () => { if (this.moves.get(node) === animation) this.moves.delete(node); };
      }
    }
    this.previous = ordered.map(seat => seat.seatId);
  }
  dispose(): void { for (const move of this.moves.values()) move.cancel(); this.moves.clear(); }
}
