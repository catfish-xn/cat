/**
 * U5 current-round enemy preview. Every value comes from readEncounterPreview() (UR-U5-01/02:
 * classification and start-of-combat stats share the real combat initialization); the UI only
 * formats units. Never predicts later rounds, drops or RNG. Names use the UI's own name table.
 */
import { readEncounterPreview } from '../simulation/match';
import type { MatchState } from '../simulation/match-types';
import { heroEmblemSvg } from './hero-identity';
import { displayUnitName } from '../rendering/display-names';

export interface EncounterPreviewOptions {
  /** null = default (open for monster rounds, closed for PvP). */
  readonly open: boolean | null;
  readonly onToggle: (open: boolean) => void;
  /** Highlights the matching board pieces; empty clears. Presentation only. */
  readonly onHover: (unitIds: readonly string[]) => void;
}

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
  const element = document.createElement(tag); element.textContent = text; element.className = className; return element;
};
const seconds = (ticks: number) => `${+(ticks * 0.05).toFixed(2)}s`;

export function encounterPreviewSection(state: MatchState, options: EncounterPreviewOptions): HTMLElement | null {
  const preview = readEncounterPreview(state);
  if (!preview) return null;
  const monsters = state.m8.round.kind === 'pve';
  // Identical units (same definition, star, stats and rule text) share one card.
  const groups = new Map<string, (typeof preview.units)[number][]>();
  for (const unit of preview.units) {
    const key = JSON.stringify([unit.definitionId, unit.starLevel, unit.stats, unit.abilityDescription]);
    groups.set(key, [...groups.get(key) ?? [], unit]);
  }
  const label = (unit: (typeof preview.units)[number], count: number) => `${displayUnitName(unit.definitionId)} ${'★'.repeat(unit.starLevel)}${count > 1 ? ` ×${count}` : ''}`;
  const section = node('details', '', 'encounter-preview');
  section.dataset.debug = 'encounter-preview'; section.dataset.encounter = preview.encounterId;
  section.open = options.open ?? monsters;
  section.addEventListener('toggle', () => options.onToggle(section.open));
  section.append(node('summary', `${monsters ? '本轮野怪' : '本轮对手'} · ${[...groups.values()].map(units => label(units[0], units.length)).join('、')}`));
  for (const units of groups.values()) {
    const unit = units[0], ids = units.map(entry => entry.unitId);
    const row = node('article', '', 'encounter-unit'); row.tabIndex = 0;
    row.dataset.debug = `encounter-unit:${unit.definitionId}`; row.dataset.unitIds = ids.join(' ');
    const title = node('h4', label(unit, units.length));
    title.insertAdjacentHTML('afterbegin', heroEmblemSvg(unit.definitionId, 22));
    title.append(node('span', `位置 ${units.map(entry => `${entry.cell.col},${entry.cell.row}`).join(' / ')}`, 'encounter-cell'));
    row.append(title, node('p', `生命 ${unit.stats.maxHp} · 攻击力 ${unit.stats.attackDamage} · 护甲 ${unit.stats.armor} · 魔抗 ${unit.stats.magicResist}`));
    const stats = unit.stats;
    row.append(node('p', `射程 ${stats.attackRange} 格 · 攻击间隔 ${seconds(stats.attackIntervalTicks)} · 暴击 ${stats.critChanceBps / 100}% ×${stats.critMultiplierBps / 10000}`
      + (unit.unitKind === 'neutral' ? ' · 无法力' : ` · 法强 ${stats.abilityPower} · 法力 ${stats.mana}/${stats.maxMana}`), 'encounter-extra'));
    row.append(node('p', unit.abilityDescription, 'encounter-ability'));
    for (const type of ['mouseenter', 'focus'] as const) row.addEventListener(type, () => options.onHover(ids));
    for (const type of ['mouseleave', 'blur'] as const) row.addEventListener(type, () => options.onHover([]));
    section.append(row);
  }
  section.append(node('p', preview.rulesNote, 'encounter-note'));
  return section;
}
