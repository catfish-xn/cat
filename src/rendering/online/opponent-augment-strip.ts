import './opponent-augment-strip.css';
import { augmentDisplayName, augmentIconOrBadgeHtml, augmentIconUrl, augmentPlayerDescription } from '../../presentation/augment-display';
import { onAugmentTextChanged } from '../../presentation/augment-text-loader';
import { attachTextCards, textCard } from '../../presentation/text-card';
import type { PlayerView } from './protocol';

/**
 * TFT: while my PvP battle plays, the opponent's chosen augments hang on their side of the board (the far side, upper
 * right), the mirror of my own row. Read-only: the opponent's `publicBoard.augments` (already public, C5 scouting), in
 * the order acquired. No dynamic values: those belong to the owner's private state, so the hover card shows the
 * static description, as the scouting panel does.
 */
export interface OpponentAugmentInput {
  readonly view: PlayerView | null;
  /** I am playing (not in the lobby, not eliminated, not after the end). */
  readonly playing: boolean;
  /** My own battle is playing back (it can outlast the room's combat phase). */
  readonly battlePlaying: boolean;
  /** The scouting panel is open: it already lists that seat's augments, and the board shows someone else. */
  readonly scouting: boolean;
}

/** The opponent's augment ids to show, or an empty list when the row stays hidden. */
export function opponentAugmentIds(input: OpponentAugmentInput): readonly string[] {
  const { view } = input;
  if (!view || !input.playing || input.scouting || !view.opponentSeatId) return [];
  if (view.phase.kind !== 'combat' && !input.battlePlaying) return [];
  const seat = view.seats.find(candidate => candidate.seatId === view.opponentSeatId);
  return seat?.publicBoard?.augments ?? [];
}

export class OpponentAugmentStrip {
  readonly root: HTMLElement;
  private key = '';
  private ids: readonly string[] = [];
  private name = '';
  private readonly disposers: (() => void)[] = [];
  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'opponent-augment-strip'; this.root.dataset.debug = 'online:opponent-augment-strip';
    this.root.setAttribute('role', 'group'); this.root.hidden = true;
    // Clicks and drags on the row never reach the board under it.
    for (const type of ['pointerdown', 'mousedown', 'touchstart', 'click', 'contextmenu'] as const) this.root.addEventListener(type, event => event.stopPropagation());
    parent.append(this.root);
    this.disposers.push(attachTextCards(this.root), onAugmentTextChanged(() => { this.key = ''; this.paint(); }), () => this.root.remove());
  }
  /** Cheap when nothing changed: the key covers the ids, the opponent's name and each icon URL (late asset root). */
  update(input: OpponentAugmentInput): void {
    const ids = opponentAugmentIds(input), view = input.view;
    this.ids = ids;
    this.name = ids.length ? view?.seats.find(seat => seat.seatId === view.opponentSeatId)?.name ?? '' : '';
    this.paint();
  }
  private paint(): void {
    const key = JSON.stringify([this.name, this.ids.map(id => [id, augmentIconUrl(id)])]);
    if (key === this.key) return;
    this.key = key;
    this.root.hidden = this.ids.length === 0;
    this.root.setAttribute('aria-label', this.name ? `${this.name} 的强化` : '对手的强化');
    this.root.replaceChildren(...this.ids.map(id => this.chip(id)));
  }
  private chip(id: string): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'augment-chip opponent-augment-chip'; chip.dataset.augment = id;
    const owner = this.name ? `（${this.name}）` : '';
    textCard(chip, [`${augmentDisplayName(id)}${owner}`, augmentPlayerDescription(id)].filter(Boolean).join('\n'));
    chip.insertAdjacentHTML('afterbegin', augmentIconOrBadgeHtml(id, 32));
    return chip;
  }
  dispose(): void { this.disposers.forEach(dispose => dispose()); }
}
