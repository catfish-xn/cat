/**
 * G5 economy hint in the countdown strip above the board (TFT shows interest and streak next to the board):
 * interest estimate, win/loss streak and the streak gold of the last settlement. Shown in preparation only.
 *
 * Every number is read, none is worked out here:
 * - gold and streak come from my private seat view (contract §14.1);
 * - the interest estimate is the rules' own read-only preparation selector `getInterestGold(gold)`, the same one
 *   the HUD's "预计利息" uses; it is the interest of the current gold and leaves out what the settlement may add to
 *   its basis (victory gold) or the opening rounds' rules (SR-G5-02 asks the server for the exact preview);
 * - "上轮连胜败金币" is `incomeBreakdown.streak` of my last settled round, as the server committed it.
 */
import { getInterestGold } from '../../simulation/economy';
import type { MatchState } from '../../simulation/match-types';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
export interface EconomyHintRead { readonly gold: number; readonly interest: number; readonly streakKind: 'win' | 'loss' | null; readonly streakCount: number; readonly lastStreakGold: number | null; readonly lastRound: number | null }

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
  /** Redraws from my latest state; hidden outside preparation (and while spectating). */
  render(state: MatchState, visible: boolean): void {
    if (!visible || state.phase !== 'preparation') { this.root.hidden = true; this.shown = null; return; }
    const last = state.roundResults.at(-1) ?? null;
    const read: EconomyHintRead = { gold: state.gold, interest: getInterestGold(state.gold), streakKind: state.streak.kind, streakCount: state.streak.count,
      lastStreakGold: last?.incomeBreakdown?.streak ?? null, lastRound: last?.round ?? null };
    this.shown = read;
    this.interest.textContent = `利息 +${read.interest}`;
    this.interest.title = `按当前 ${read.gold} 金币估算（每 10 金币 +1）；胜利金币计入结算基数时可能多 1`;
    const kind = read.streakKind === 'win' ? '连胜' : read.streakKind === 'loss' ? '连败' : null;
    this.streak.textContent = kind ? `${kind} ${read.streakCount}` : '无连胜/连败';
    this.streak.dataset.kind = read.streakKind ?? 'none';
    this.bonus.textContent = read.lastStreakGold === null ? '' : `上轮连胜败 +${read.lastStreakGold}`;
    this.bonus.title = '上一回合结算实际发放的连胜/连败额外金币';
    this.bonus.hidden = read.lastStreakGold === null;
    for (const [node, value] of [[this.root, read.gold], [this.interest, read.interest], [this.streak, read.streakCount], [this.bonus, read.lastStreakGold ?? '']] as const) node.dataset.value = String(value);
    this.root.hidden = false;
  }
  debug(): EconomyHintRead | null { return this.shown; }
  dispose(): void { this.root.remove(); }
}
