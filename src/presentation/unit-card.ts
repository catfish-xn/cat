/**
 * Unit description card (G2 prerequisite): cost, traits, ability text for the star level and base stats, all read from the
 * content's public definitions (`UNIT_DEFINITIONS`, `getUnitStats`, `TRAIT_DEFINITIONS`) and the rules' ability display
 * functions (`abilityDisplayName` / `abilityDisplayValues`). Nothing is computed beyond formatting.
 */
import { getUnitStats } from '../simulation/unit-stats';
import { anvilIconUrl, anvilInfo, type AnvilInfo } from './anvil-display';
import { fourStarBaseStats } from './d14-display';
import { UNIT_DEFINITIONS, type StarLevel } from '../simulation/units';
import { abilityText } from './ability-text';
import type { RankTotals, UnitBattleStats } from './battle-ranking';
import { getHeroIdentity, heroEmblemSvg, heroTraitTags } from './hero-identity';
import { attachHoverCards, unitHoverCard } from './hover-card';
import { heroPortraitHtml } from './s13-assets';
import { ITEM_DEFINITIONS } from '../simulation/content/g2-3-item-registry';
import { itemDisplayName } from './g23-display';
import { itemMarkHtml } from './item-codex';
import { CHAMPION_ROLES, ROLE_DISPLAY } from './unit-roles';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
/** COMBAT tick is 50 ms: attacks per second from the attack interval when the content has no original speed. */
const TICKS_PER_SECOND = 20;

/** Trait labels: the S13 client list, open where the unit's content traits include it (see `heroTraitTags`). */
export function unitTraitLabels(definitionId: string): { name: string; open: boolean }[] {
  return heroTraitTags(definitionId);
}

const ITEM_ID_BY_API = new Map(Object.values(ITEM_DEFINITIONS).flatMap(item => 'apiName' in item && item.apiName ? [[item.apiName, item.id] as const] : []));

/**
 * The hero's 14.24 client role (角色定位) and that role card's recommended items, limited to items this content has; null
 * for units without a client role (summons, neutrals). Display only (client data via `unit-roles.ts`).
 */
export function unitRole(definitionId: string): { name: string; itemIds: string[] } | null {
  const hero = definitionId.replace(/-ranged$/, ''), role = Object.hasOwn(CHAMPION_ROLES, hero) ? ROLE_DISPLAY[CHAMPION_ROLES[hero]] : undefined;
  return role ? { name: role.name, itemIds: role.items.flatMap(api => ITEM_ID_BY_API.get(api) ?? []) } : null;
}
function roleSection(definitionId: string): HTMLElement | null {
  const role = unitRole(definitionId);
  if (!role) return null;
  const section = el('div', '', 'unit-card-role'); section.dataset.debug = 'unit-card:role';
  section.append(el('div', `定位 · ${role.name}`, 'unit-card-label'));
  if (role.itemIds.length) {
    const items = el('div', '', 'unit-card-items'); items.title = '推荐装备';
    items.append(el('span', '推荐装备', 'unit-card-items-label'));
    for (const id of role.itemIds) {
      const cell = el('span', '', 'unit-card-item'); cell.dataset.itemDef = id; cell.title = itemDisplayName(id);
      cell.innerHTML = itemMarkHtml(id, 20); items.append(cell);
    }
    section.append(items);
  }
  return section;
}

/** Cache key part of a battle stats line: equal stats draw the same card. */
export function unitBattleStatsKey(stats: UnitBattleStats | null | undefined): string {
  const part = (row: RankTotals | null) => row ? `${row.damageDealt}/${row.damageTaken}/${row.healingDone}/${row.healingReceived}` : '-';
  return stats && (stats.battle || stats.match) ? `${part(stats.battle)}|${part(stats.match)}` : '';
}
/**
 * G5: one line of the unit's damage / damage taken / healing done in my last battle (本场) and its kind's match total
 * (累计), the ranking panel's own numbers (battle-ranking `unitBattleStats`); healing received is in the line's title.
 */
function battleLine(stats: UnitBattleStats): HTMLElement {
  const line = el('p', '', 'unit-card-battle'); line.dataset.debug = 'unit-card:battle';
  const part = (label: string, row: RankTotals | null) => row ? `${label} ${row.damageDealt}/${row.damageTaken}/${row.healingDone}` : `${label} —`;
  line.append(el('span', '伤害/承伤/治疗', 'unit-card-label'), el('span', ` ${part('本场', stats.battle)} · ${part('累计', stats.match)}`));
  line.title = [stats.battle && `本场受治疗 ${stats.battle.healingReceived} · 击杀 ${stats.battle.kills}`,
    stats.match && `累计 ${stats.match.battles} 场 · 受治疗 ${stats.match.healingReceived} · 击杀 ${stats.match.kills}`].filter(Boolean).join('\n');
  for (const [key, row] of [['battle', stats.battle], ['match', stats.match]] as const) {
    if (row) Object.assign(line.dataset, { [`${key}Dealt`]: String(row.damageDealt), [`${key}Taken`]: String(row.damageTaken), [`${key}Healed`]: String(row.healingDone), [`${key}Received`]: String(row.healingReceived) });
  }
  return line;
}

/**
 * Card body for a unit definition at a star level; `null` when the definition is unknown to the content. `battle` (online)
 * adds the G5 battle stats line when the unit or its kind has fought this match; `gear` (board pieces) lists what it carries.
 * Star 4 is a promoted Ultimate Hero (v16): the rules' 4★ base health/attack and 4★ ability values; `notes` are extra
 * lines (d14-display) under the title.
 */
/** v22 anvil (锻造器): its icon, name, the client's hover text and what selling it does; no stars, cost or stats. */
function anvilCardBody(definitionId: string, anvil: AnvilInfo): HTMLElement {
  const body = el('div', '', 'unit-card unit-card-anvil'); body.dataset.unitDef = definitionId;
  const head = el('div', '', 'unit-card-head'), portrait = el('span', '', 'unit-card-portrait anvil'), url = anvilIconUrl(definitionId);
  if (url) portrait.innerHTML = `<img src="${url}" alt="" width="40" height="40">`;
  const title = el('div', '', 'unit-card-title');
  title.append(el('strong', anvil.name, 'unit-card-name'), el('span', '锻造器', 'unit-card-cost'));
  head.append(portrait, title); body.append(head);
  const section = el('div', '', 'unit-card-ability');
  section.append(el('p', anvil.description, 'unit-card-text'), el('p', `拖到商店或按 E：${anvil.sellText}`, 'unit-card-text'));
  body.append(section);
  return body;
}

export function unitCardBody(definitionId: string, starLevel: number, battle: UnitBattleStats | null = null, gear = '', notes: readonly string[] = []): HTMLElement | null {
  const anvil = anvilInfo(definitionId);
  if (anvil) return anvilCardBody(definitionId, anvil);
  const definition = Object.hasOwn(UNIT_DEFINITIONS, definitionId) ? UNIT_DEFINITIONS[definitionId] : undefined;
  if (!definition) return null;
  const fourStar = Math.trunc(starLevel) >= 4 ? fourStarBaseStats(definitionId) : null;
  const star = Math.min(3, Math.max(1, Math.trunc(starLevel))) as StarLevel;
  const identity = getHeroIdentity(definitionId);
  const neutral = definition.unitKind === 'neutral';
  const body = el('div', '', 'unit-card'); body.dataset.unitDef = definitionId; body.dataset.star = String(fourStar ? 4 : star);
  const head = el('div', '', 'unit-card-head');
  const portrait = el('span', '', `unit-card-portrait cost-${definition.cost}`);
  portrait.innerHTML = heroPortraitHtml(definitionId, 40, heroEmblemSvg(definitionId, 40));
  const title = el('div', '', 'unit-card-title');
  title.append(el('strong', identity.name, 'unit-card-name'), el('span', '★'.repeat(fourStar ? 4 : star), `unit-card-stars star-${fourStar ? 4 : star}`),
    el('span', neutral ? '野怪' : `${definition.cost} 费`, 'unit-card-cost'));
  head.append(portrait, title); body.append(head);
  for (const note of notes) { const line = el('p', note, 'unit-card-note'); line.dataset.debug = 'unit-card:note'; body.append(line); }
  if (!neutral) {
    const traits = el('div', '', 'unit-card-traits'); traits.dataset.debug = 'unit-card:traits';
    for (const label of unitTraitLabels(definitionId)) { const tag = el('span', label.name, label.open ? 'trait-open' : 'trait-closed'); if (!label.open) tag.title = '本版本未开放'; traits.append(tag); }
    body.append(traits);
    const role = roleSection(definitionId);
    if (role) body.append(role);
  }
  const stats = fourStar ?? getUnitStats(definitionId, neutral ? 1 : star);
  const ability = abilityText(definitionId, fourStar ? 4 : star);
  const section = el('div', '', 'unit-card-ability'); section.dataset.debug = 'unit-card:ability';
  section.append(el('div', `技能${ability ? ` · ${ability.name}` : ''} · 法力 ${stats.initialMana}/${stats.maxMana}${fourStar ? ' · 四星数值' : ''}`, 'unit-card-label'));
  section.append(el('p', ability?.text || '无主动技能说明', 'unit-card-text'));
  body.append(section);
  const speed = stats.baseAttackSpeedBps !== undefined ? stats.baseAttackSpeedBps / 10_000 : TICKS_PER_SECOND / stats.attackIntervalTicks;
  const grid = el('dl', '', 'unit-card-stats'); grid.dataset.debug = 'unit-card:stats';
  for (const [label, value] of [['生命', stats.health], ['攻击力', stats.attack], ['护甲', stats.armor], ['魔抗', stats.magicResist], ['攻速', speed.toFixed(2)], ['射程', stats.attackRange]] as const) {
    grid.append(el('dt', label), el('dd', String(value)));
  }
  body.append(grid);
  if (gear) { const line = el('p', `已装备：${gear}`, 'unit-card-text'); line.dataset.debug = 'unit-card:gear'; body.append(line); }
  if (battle && (battle.battle || battle.match)) body.append(battleLine(battle));
  return body;
}

/** Unit hover cards for every `[data-unit-def]` (optional `data-unit-star`) inside `scope`. */
export function attachUnitCards(scope: HTMLElement): () => void {
  return attachHoverCards(scope, unitHoverCard(), '[data-unit-def]', anchor => {
    const definitionId = anchor.dataset.unitDef ?? '', star = Number(anchor.dataset.unitStar ?? 1) || 1;
    if (!Object.hasOwn(UNIT_DEFINITIONS, definitionId)) return null;
    return { key: `unit:${definitionId}:${star}`, build: () => unitCardBody(definitionId, star)! };
  });
}
