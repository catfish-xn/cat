/**
 * G5 post-battle ranking in the right column (TFT's damage chart): damage dealt, damage taken and healing of every
 * unit of both sides, either in my last battle (本场) or added up over the match by unit kind and star level
 * (本局累计), from the replays' own events (presentation/battle-ranking.ts). It appears when my battle ends and
 * stays through the next preparation. Read-only: no command, no rule.
 */
import { accumulateRankings, rankBattle, sortRanking, type BattleRankMetric, type BattleRanking, type RankTotals } from '../../presentation/battle-ranking';
import { heroEmblemSvg } from '../../presentation/hero-identity';
import { heroPortraitHtml } from '../../presentation/s13-assets';
import { displayUnitName } from '../display-names';
import type { FinishedBattle } from './remote-session';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
type Scope = 'battle' | 'match';
const SCOPES: readonly { readonly scope: Scope; readonly label: string }[] = [{ scope: 'battle', label: '本场' }, { scope: 'match', label: '本局累计' }];
const METRICS: readonly { readonly metric: BattleRankMetric; readonly label: string }[] = [
  { metric: 'damageDealt', label: '伤害' }, { metric: 'damageTaken', label: '承伤' }, { metric: 'healingReceived', label: '治疗' },
];
const RESULT_TEXT: Record<string, string> = { playerWin: '胜利', enemyWin: '失败', draw: '平局' };
/** What one row shows, for either scope. */
interface ShownRow extends RankTotals { readonly id: string; readonly team: string; readonly definitionId: string; readonly starLevel: number; readonly alive: boolean; readonly battles: number | null }

export class BattleSummaryPanel {
  readonly root: HTMLElement;
  private title = element('strong', '', 'summary-title');
  private result = element('span', '', 'summary-result');
  private scopes = element('div', '', 'summary-tabs summary-scopes');
  private tabs = element('div', '', 'summary-tabs');
  private list = element('ol', '', 'summary-rows');
  private scope: Scope = 'battle';
  private metric: BattleRankMetric = 'damageDealt';
  private battles: readonly FinishedBattle[] = [];
  /** Each battle is tallied once. */
  private rankings = new WeakMap<FinishedBattle, BattleRanking>();
  constructor(host: HTMLElement) {
    this.root = element('section', '', 'battle-summary'); this.root.id = 'battle-summary'; this.root.hidden = true;
    this.root.dataset.debug = 'online:battle-summary'; this.root.setAttribute('aria-label', '战斗统计');
    const head = element('header', '', 'summary-head'); head.append(this.title, this.result);
    const tabs = (host: HTMLElement, entries: readonly { readonly key: string; readonly label: string }[], kind: string, pick: (key: string) => void) => {
      host.setAttribute('role', 'tablist');
      for (const { key, label } of entries) {
        const tab = element('button', label, 'summary-tab'); tab.type = 'button'; tab.dataset.key = key; tab.dataset.debug = `online:summary-${kind}:${key}`;
        tab.setAttribute('role', 'tab'); tab.addEventListener('click', () => { pick(key); this.renderRows(); });
        host.append(tab);
      }
    };
    tabs(this.scopes, SCOPES.map(entry => ({ key: entry.scope, label: entry.label })), 'scope', key => { this.scope = key as Scope; });
    tabs(this.tabs, METRICS.map(entry => ({ key: entry.metric, label: entry.label })), 'tab', key => { this.metric = key as BattleRankMetric; });
    this.list.dataset.debug = 'online:summary-rows';
    this.root.title = '伤害与承伤含护盾吸收（承伤另列护盾部分）；治疗为单位受到的治疗量。本局累计按单位与星级合并本局每一场。';
    this.root.append(head, this.scopes, this.tabs, this.list);
    host.append(this.root);
  }
  private rankingOf(battle: FinishedBattle): BattleRanking {
    let ranking = this.rankings.get(battle);
    if (!ranking) { ranking = rankBattle(battle.replay); this.rankings.set(battle, ranking); }
    return ranking;
  }
  /** Shows the last of `battles` and the match totals over all of them; `visible` false hides the panel. */
  show(battles: readonly FinishedBattle[], visible: boolean): void {
    const last = battles.at(-1);
    if (!visible || !last) { this.root.hidden = true; return; }
    if (battles !== this.battles) {
      this.battles = battles;
      const ranking = this.rankingOf(last);
      this.root.dataset.round = String(last.round); this.root.dataset.combat = ranking.combatId ?? ''; this.root.dataset.battles = String(battles.length);
      this.title.textContent = `${last.roundId} 战斗`;
      const result = ranking.result ?? '';
      this.result.textContent = RESULT_TEXT[result] ?? ''; this.result.dataset.result = result;
      this.renderRows();
    }
    this.root.hidden = false;
  }
  private shownRows(): ShownRow[] {
    const last = this.battles.at(-1); if (!last) return [];
    if (this.scope === 'battle') return this.rankingOf(last).rows.map(row => ({ ...row, id: row.unitId, battles: null }));
    return accumulateRankings(this.battles.map(battle => this.rankingOf(battle))).map(row => ({ ...row, id: row.key, alive: true }));
  }
  private renderRows(): void {
    for (const [host, current] of [[this.scopes, this.scope], [this.tabs, this.metric]] as const) {
      for (const tab of Array.from(host.children) as HTMLElement[]) { const on = tab.dataset.key === current; tab.classList.toggle('active', on); tab.setAttribute('aria-selected', String(on)); }
    }
    this.root.dataset.scope = this.scope; this.root.dataset.metric = this.metric;
    const metric = this.metric, rows = sortRanking(this.shownRows(), metric), top = Math.max(1, ...rows.map(row => row[metric]));
    this.list.replaceChildren(...rows.map(row => {
      const value = row[metric];
      const item = element('li', '', `summary-row team-${row.team}${row.alive ? '' : ' dead'}`);
      Object.assign(item.dataset, { unit: row.id, team: row.team, value: String(value), definition: row.definitionId, star: String(row.starLevel),
        dealt: String(row.damageDealt), taken: String(row.damageTaken), healed: String(row.healingReceived), absorbed: String(row.shieldAbsorbed) });
      if (row.battles !== null) item.dataset.battles = String(row.battles);
      item.title = `${displayUnitName(row.definitionId)} ${row.starLevel}星 · ${row.team === 'player' ? '我方' : '敌方'}${row.alive ? '' : ' · 阵亡'}${row.battles === null ? '' : ` · ${row.battles} 场`}`
        + `\n伤害 ${row.damageDealt} · 承伤 ${row.damageTaken}（其中护盾 ${row.shieldAbsorbed}）· 受治疗 ${row.healingReceived}`;
      const portrait = element('span', '', 'summary-portrait'); portrait.innerHTML = heroPortraitHtml(row.definitionId, 22, heroEmblemSvg(row.definitionId, 22));
      const name = element('span', `${displayUnitName(row.definitionId)}${'★'.repeat(row.starLevel)}`, 'summary-name');
      const number = element('span', String(value), 'summary-value');
      // 承伤 shows its shield part next to the total.
      if (metric === 'damageTaken' && row.shieldAbsorbed > 0) number.append(element('small', ` 盾${row.shieldAbsorbed}`, 'summary-shield'));
      const bar = element('span', '', 'summary-bar'); const fill = element('span', '', 'summary-fill'); fill.style.width = `${Math.round(value / top * 100)}%`; bar.append(fill);
      if (metric === 'damageTaken' && row.shieldAbsorbed > 0) {
        const shield = element('span', '', 'summary-fill summary-fill-shield'); shield.style.width = `${Math.round(row.shieldAbsorbed / top * 100)}%`; bar.append(shield);
        fill.style.width = `${Math.round((value - row.shieldAbsorbed) / top * 100)}%`;
      }
      item.append(portrait, name, number, bar);
      return item;
    }));
  }
  /** Acceptance read: what the panel shows now. */
  debug() {
    const last = this.battles.at(-1);
    if (this.root.hidden || !last) return null;
    return { round: last.round, combatId: this.rankingOf(last).combatId, battles: this.battles.length, scope: this.scope, metric: this.metric, rows: this.list.childElementCount };
  }
  dispose(): void { this.root.remove(); this.battles = []; }
}
