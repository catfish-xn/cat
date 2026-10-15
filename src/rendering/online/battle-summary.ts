/**
 * G5 post-battle ranking in the right column (TFT's damage chart): damage dealt, damage taken and healing of every
 * unit of both sides in my last battle, from the replay's own events (presentation/battle-ranking.ts). It appears
 * when my battle ends and stays through the next preparation; "回看" opens the replay review over the board.
 * Read-only: no command, no rule.
 */
import { rankBattle, sortRanking, type BattleRankMetric, type BattleRanking } from '../../presentation/battle-ranking';
import { heroEmblemSvg } from '../../presentation/hero-identity';
import { heroPortraitHtml } from '../../presentation/s13-assets';
import { displayUnitName } from '../display-names';
import type { FinishedBattle } from './remote-session';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
const METRICS: readonly { readonly metric: BattleRankMetric; readonly label: string }[] = [
  { metric: 'damageDealt', label: '伤害' }, { metric: 'damageTaken', label: '承伤' }, { metric: 'healingReceived', label: '治疗' },
];
const RESULT_TEXT: Record<string, string> = { playerWin: '胜利', enemyWin: '失败', draw: '平局' };

export class BattleSummaryPanel {
  readonly root: HTMLElement;
  private title = element('strong', '', 'summary-title');
  private result = element('span', '', 'summary-result');
  private review = element('button', '回看', 'summary-review');
  private tabs = element('div', '', 'summary-tabs');
  private list = element('ol', '', 'summary-rows');
  private metric: BattleRankMetric = 'damageDealt';
  private battle: FinishedBattle | null = null;
  private ranking: BattleRanking | null = null;
  constructor(host: HTMLElement, private readonly onReview: (battle: FinishedBattle) => void, private readonly onSelect: (unitId: string) => void) {
    this.root = element('section', '', 'battle-summary'); this.root.id = 'battle-summary'; this.root.hidden = true;
    this.root.dataset.debug = 'online:battle-summary'; this.root.setAttribute('aria-label', '本场战斗统计');
    this.review.type = 'button'; this.review.dataset.debug = 'online:review-open'; this.review.title = '在棋盘上方重放刚才的战斗（倒计时照常进行，可继续操作）';
    this.review.addEventListener('click', () => { if (this.battle) this.onReview(this.battle); });
    const head = element('header', '', 'summary-head'); head.append(this.title, this.result, this.review);
    this.tabs.setAttribute('role', 'tablist');
    for (const { metric, label } of METRICS) {
      const tab = element('button', label, 'summary-tab'); tab.type = 'button'; tab.dataset.metric = metric; tab.dataset.debug = `online:summary-tab:${metric}`;
      tab.setAttribute('role', 'tab'); tab.addEventListener('click', () => { this.metric = metric; this.renderRows(); });
      this.tabs.append(tab);
    }
    this.list.dataset.debug = 'online:summary-rows';
    this.list.addEventListener('click', event => { const row = (event.target as HTMLElement).closest<HTMLElement>('[data-unit]'); if (row?.dataset.unit) this.onSelect(row.dataset.unit); });
    this.root.title = '伤害与承伤为实际生命损失（护盾吸收另计）；治疗为单位受到的治疗量。';
    this.root.append(head, this.tabs, this.list);
    host.append(this.root);
  }
  /** Shows `battle` (null hides the panel); the ranking is tallied once per battle. */
  show(battle: FinishedBattle | null): void {
    if (!battle) { this.root.hidden = true; return; }
    if (battle !== this.battle) {
      this.battle = battle; this.ranking = rankBattle(battle.replay);
      this.root.dataset.round = String(battle.round); this.root.dataset.combat = this.ranking.combatId ?? '';
      this.title.textContent = `${battle.roundId} 战斗`;
      const result = this.ranking.result ?? '';
      this.result.textContent = RESULT_TEXT[result] ?? ''; this.result.dataset.result = result;
      this.renderRows();
    }
    this.root.hidden = false;
  }
  get visible(): boolean { return !this.root.hidden; }
  private renderRows(): void {
    const ranking = this.ranking; if (!ranking) return;
    for (const tab of Array.from(this.tabs.children) as HTMLElement[]) { const on = tab.dataset.metric === this.metric; tab.classList.toggle('active', on); tab.setAttribute('aria-selected', String(on)); }
    this.root.dataset.metric = this.metric;
    const rows = sortRanking(ranking.rows, this.metric), top = Math.max(1, ...rows.map(row => row[this.metric]));
    this.list.replaceChildren(...rows.map(row => {
      const value = row[this.metric];
      const item = element('li', '', `summary-row team-${row.team}${row.alive ? '' : ' dead'}`);
      Object.assign(item.dataset, { unit: row.unitId, team: row.team, value: String(value), definition: row.definitionId,
        dealt: String(row.damageDealt), taken: String(row.damageTaken), healed: String(row.healingReceived), absorbed: String(row.shieldAbsorbed) });
      item.title = `${displayUnitName(row.definitionId)} ${row.starLevel}星 · ${row.team === 'player' ? '我方' : '敌方'}${row.alive ? '' : ' · 阵亡'}\n伤害 ${row.damageDealt} · 承伤 ${row.damageTaken}（护盾吸收 ${row.shieldAbsorbed}）· 受治疗 ${row.healingReceived}`;
      const portrait = element('span', '', 'summary-portrait'); portrait.innerHTML = heroPortraitHtml(row.definitionId, 22, heroEmblemSvg(row.definitionId, 22));
      const name = element('span', `${displayUnitName(row.definitionId)}${'★'.repeat(row.starLevel)}`, 'summary-name');
      const bar = element('span', '', 'summary-bar'); const fill = element('span', '', 'summary-fill'); fill.style.width = `${Math.round(value / top * 100)}%`; bar.append(fill);
      item.append(portrait, name, element('span', String(value), 'summary-value'), bar);
      return item;
    }));
  }
  /** Acceptance read: what the panel shows now. */
  debug() {
    if (this.root.hidden || !this.ranking || !this.battle) return null;
    return { round: this.battle.round, combatId: this.ranking.combatId, metric: this.metric, rows: this.ranking.rows.length };
  }
  dispose(): void { this.root.remove(); this.battle = null; this.ranking = null; }
}
