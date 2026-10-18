/**
 * G5 battle stats in the right column (TFT's damage chart): 输出, 治疗 and 防护 of my units in the battle on the board,
 * adding up live while it plays back, then held at its final totals until my next battle starts (then it starts from
 * zero). Numbers are the rules' `summarizeBattle` of the ticks shown so far (presentation/battle-ranking.ts); 防护 is the
 * shield each unit granted. Read-only: no command, no rule.
 */
import { rankBattle, rankLiveBattle, type BattleRanking, type BattleRankRow } from '../../presentation/battle-ranking';
import { heroEmblemSvg } from '../../presentation/hero-identity';
import { heroPortraitHtml } from '../../presentation/s13-assets';
import { displayUnitName } from '../display-names';
import type { CombatReplay, CombatViewState } from '../../simulation/combat-replay-view';
import type { FinishedBattle } from './remote-session';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
type Metric = 'damageDealt' | 'healingDone' | 'shieldGiven';
type ShownRow = BattleRankRow & { readonly shieldGiven: number };
const METRICS: readonly { readonly metric: Metric; readonly label: string }[] = [
  { metric: 'damageDealt', label: '输出' }, { metric: 'healingDone', label: '治疗' }, { metric: 'shieldGiven', label: '防护' },
];
const RESULT_TEXT: Record<string, string> = { playerWin: '胜利', enemyWin: '失败', draw: '平局' };
/** Live totals are recomputed at most this often while a battle plays. */
const LIVE_REFRESH_MS = 250;
export interface LiveBattle { readonly replay: CombatReplay; readonly played: number; readonly view: CombatViewState }

export class BattleSummaryPanel {
  readonly root: HTMLElement;
  private title = element('strong', '', 'summary-title');
  private result = element('span', '', 'summary-result');
  private tabs = element('div', '', 'summary-tabs');
  private list = element('ol', '', 'summary-rows');
  private metric: Metric = 'damageDealt';
  /** The battle shown: its replay, round name and the ranking last computed for it. */
  private shown: { replay: CombatReplay; roundId: string; ranking: BattleRanking; played: number; live: boolean } | null = null;
  private refreshedAt = -Infinity;
  constructor(host: HTMLElement) {
    this.root = element('section', '', 'battle-summary'); this.root.id = 'battle-summary'; this.root.hidden = true;
    this.root.dataset.debug = 'online:battle-summary'; this.root.setAttribute('aria-label', '战斗统计');
    const head = element('header', '', 'summary-head'); head.append(this.title, this.result);
    this.tabs.setAttribute('role', 'tablist');
    for (const { metric, label } of METRICS) {
      const tab = element('button', label, 'summary-tab'); tab.type = 'button'; tab.dataset.key = metric; tab.dataset.debug = `online:summary-tab:${metric}`;
      tab.setAttribute('role', 'tab'); tab.addEventListener('click', () => { this.metric = metric; this.renderRows(); });
      this.tabs.append(tab);
    }
    this.list.dataset.debug = 'online:summary-rows';
    this.root.title = '本场我方单位：输出含护盾吸收的伤害；治疗为单位施加的治疗量；防护为单位给出的护盾量。战斗中实时累加，下一场战斗开始时清零。';
    this.root.append(head, this.tabs, this.list);
    host.append(this.root);
  }
  /** My battle still playing back: totals of the ticks shown so far, refreshed a few times a second. */
  live(battle: LiveBattle, roundId: string): void {
    const now = performance.now(), same = this.shown?.replay === battle.replay && this.shown.live;
    if (same && (battle.played === this.shown!.played || now - this.refreshedAt < LIVE_REFRESH_MS)) { this.root.hidden = false; return; }
    this.refreshedAt = now;
    this.shown = { replay: battle.replay, roundId, ranking: rankLiveBattle(battle.replay, battle.played, battle.view), played: battle.played, live: true };
    this.renderHead(); this.renderRows(); this.root.hidden = false;
  }
  /** After the battle: its final totals, held until the next battle starts; `visible` false hides the panel. */
  show(last: FinishedBattle | null, visible: boolean): void {
    if (!visible || !last) { this.root.hidden = true; return; }
    if (this.shown?.replay !== last.replay || this.shown.live) {
      this.shown = { replay: last.replay, roundId: last.roundId, ranking: rankBattle(last.replay), played: last.replay.ticks.length, live: false };
      this.renderHead(); this.renderRows();
    }
    this.root.hidden = false;
  }
  private renderHead(): void {
    const shown = this.shown!, result = shown.live ? '' : shown.ranking.result ?? '';
    this.root.dataset.combat = shown.ranking.combatId ?? ''; this.root.dataset.live = String(shown.live);
    this.title.textContent = `${shown.roundId} 战斗`;
    this.result.textContent = shown.live ? '战斗中' : RESULT_TEXT[result] ?? ''; this.result.dataset.result = shown.live ? 'live' : result;
  }
  /** My side only, as in TFT's chart. */
  private shownRows(): ShownRow[] {
    const ranking = this.shown?.ranking;
    return ranking ? ranking.rows.filter(row => row.team === 'player').map(row => ({ ...row, shieldGiven: ranking.shieldGiven.get(row.unitId) ?? 0 })) : [];
  }
  private renderRows(): void {
    for (const tab of Array.from(this.tabs.children) as HTMLElement[]) { const on = tab.dataset.key === this.metric; tab.classList.toggle('active', on); tab.setAttribute('aria-selected', String(on)); }
    this.root.dataset.metric = this.metric;
    const metric = this.metric, rows = this.shownRows().map((row, index) => ({ row, index })).sort((a, b) => b.row[metric] - a.row[metric] || a.index - b.index).map(entry => entry.row), top = Math.max(1, ...rows.map(row => row[metric]));
    this.list.replaceChildren(...rows.map(row => {
      const value = row[metric];
      const item = element('li', '', `summary-row team-${row.team}${row.alive ? '' : ' dead'}`);
      Object.assign(item.dataset, { unit: row.unitId, team: row.team, value: String(value), definition: row.definitionId, star: String(row.starLevel),
        dealt: String(row.damageDealt), healed: String(row.healingDone), shielded: String(row.shieldGiven), kills: String(row.kills) });
      item.title = `${displayUnitName(row.definitionId)} ${row.starLevel}星${row.alive ? '' : ' · 阵亡'}`
        + `\n输出 ${row.damageDealt} · 治疗 ${row.healingDone} · 防护 ${row.shieldGiven} · 击杀 ${row.kills}`;
      const portrait = element('span', '', 'summary-portrait'); portrait.innerHTML = heroPortraitHtml(row.definitionId, 22, heroEmblemSvg(row.definitionId, 22));
      const name = element('span', `${displayUnitName(row.definitionId)}${'★'.repeat(row.starLevel)}`, 'summary-name');
      const number = element('span', String(value), 'summary-value');
      const bar = element('span', '', 'summary-bar'); const fill = element('span', '', `summary-fill${metric === 'shieldGiven' ? ' summary-fill-shield' : ''}`);
      fill.style.width = `${Math.round(value / top * 100)}%`; bar.append(fill);
      item.append(portrait, name, number, bar);
      return item;
    }));
  }
  /** Acceptance read: what the panel shows now. */
  debug() {
    if (this.root.hidden || !this.shown) return null;
    return { combatId: this.shown.ranking.combatId, live: this.shown.live, metric: this.metric, rows: this.list.childElementCount };
  }
  dispose(): void { this.root.remove(); this.shown = null; }
}
