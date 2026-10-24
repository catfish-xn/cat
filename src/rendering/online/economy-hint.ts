/**
 * G5 economy hint in the countdown strip above the board (TFT shows interest and streak next to the board):
 * "利息 +N（胜 +M）· 连胜/连败 X · 再胜/再败 +Y". Shown in preparation and through my battle.
 *
 * Every number is read, none is worked out here:
 * - interest, victory gold and streak gold are the server's `economyPreview` (SR-G5-02, contract §14.4), the rules'
 *   `previewRoundEconomy` of my seat: N is the interest if this round is lost (or drawn), M the interest if it is won
 *   (victory gold counts in its basis), Y the streak gold the settlement credits if the current streak goes on;
 * - the current streak X is `streak` of my private seat view (§14.1).
 * Without a preview (choice, settlement, supply rounds, offline) the hint is hidden.
 */
import type { MatchState } from '../../simulation/match-types';
import type { RoundEconomyPreview } from './protocol';
import { readEconomyPreview } from './seat-view-adapter';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
export interface EconomyHintRead {
  readonly roundId: string;
  readonly gold: number;
  /** Interest if lost / drawn (N) and if won (M). */
  readonly interest: number;
  readonly winInterest: number;
  readonly streakKind: 'win' | 'loss' | null;
  readonly streakCount: number;
  /** The streak gold of carrying the current streak on (Y); null without a streak. */
  readonly nextStreakGold: number | null;
  /** The preview as the server sent it. */
  readonly ifWin: RoundEconomyPreview['ifWin'];
  readonly ifLoss: RoundEconomyPreview['ifLoss'];
}

/** One outcome of the preview as an income line: base, interest, victory and streak gold, then their sum. */
export const economyIncomeText = (label: string, outcome: RoundEconomyPreview['ifWin']) =>
  `${label}：基础 +${outcome.base} · 利息 +${outcome.interest}${outcome.win ? ` · 胜利 +${outcome.win}` : ''} · 连胜败 +${outcome.streakGold} = +${outcome.base + outcome.interest + outcome.win + outcome.streakGold}`;

export class EconomyHint {
  readonly root: HTMLElement;
  private interest = element('span', '', 'economy-chip economy-interest');
  private streak = element('span', '', 'economy-chip economy-streak');
  private bonus = element('span', '', 'economy-chip economy-bonus');
  private shown: EconomyHintRead | null = null;
  constructor(host: HTMLElement) {
    this.root = element('div', '', 'economy-hint'); this.root.dataset.debug = 'online:economy'; this.root.hidden = true;
    this.root.setAttribute('aria-label', '经济提示');
    this.interest.dataset.debug = 'online:economy-interest'; this.streak.dataset.debug = 'online:economy-streak'; this.bonus.dataset.debug = 'online:economy-bonus';
    this.root.append(this.interest, this.streak, this.bonus);
    host.append(this.root);
  }
  /** Redraws from my latest state; hidden while not `visible` (spectating, lobby) or when the server sent no preview. */
  render(state: MatchState, visible: boolean): void {
    const preview = visible ? readEconomyPreview(state) : null;
    if (!preview) { this.root.hidden = true; this.shown = null; return; }
    const kind = state.streak.kind;
    const read: EconomyHintRead = { roundId: preview.roundId, gold: preview.gold, interest: preview.ifLoss.interest, winInterest: preview.ifWin.interest,
      streakKind: kind, streakCount: state.streak.count,
      nextStreakGold: kind === 'win' ? preview.ifWin.streakGold : kind === 'loss' ? preview.ifLoss.streakGold : null,
      ifWin: preview.ifWin, ifLoss: preview.ifLoss };
    this.shown = read;
    this.interest.textContent = `利息 +${read.interest}（胜 +${read.winInterest}）`;
    this.interest.title = `可能的总收入：按当前 ${read.gold} 金币计算（胜利金币当场到账，其余在下个准备阶段开始时到账）\n${economyIncomeText('胜', read.ifWin)}\n${economyIncomeText('败/平', read.ifLoss)}`;
    // 3D shows only the streak beside the gold (TFT); hovering it gives the same income lines.
    this.root.title = this.interest.title;
    const label = kind === 'win' ? '连胜' : kind === 'loss' ? '连败' : null;
    this.streak.textContent = label ? `${label} ${read.streakCount}` : '无连胜/连败';
    this.streak.dataset.kind = kind ?? 'none';
    this.bonus.textContent = read.nextStreakGold === null ? '' : `${kind === 'win' ? '再胜' : '再败'} +${read.nextStreakGold}`;
    this.bonus.title = '本回合若延续当前连胜/连败，结算发放的连胜/连败金币';
    this.bonus.hidden = read.nextStreakGold === null;
    for (const [node, value] of [[this.root, read.gold], [this.interest, read.interest], [this.streak, read.streakCount], [this.bonus, read.nextStreakGold ?? '']] as const) node.dataset.value = String(value);
    this.interest.dataset.win = String(read.winInterest);
    this.root.dataset.round = read.roundId;
    this.root.hidden = false;
  }
  debug(): EconomyHintRead | null { return this.shown; }
  dispose(): void { this.root.remove(); }
}
