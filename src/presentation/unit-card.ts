/**
 * Unit description card (G2 prerequisite): cost, traits, ability text for the star level and base stats, all read from the
 * content's public definitions (`UNIT_DEFINITIONS`, `getUnitStats`, `S13_ABILITY_DATA`, `TRAIT_DEFINITIONS`). Nothing is
 * computed beyond formatting: stats are the rules' resolved star stats, the ability text fills only listed variables.
 */
import { TRAIT_DEFINITIONS } from '../simulation/content/traits';
import { getUnitStats } from '../simulation/unit-stats';
import { UNIT_DEFINITIONS, type StarLevel } from '../simulation/units';
import { abilityText } from './ability-text';
import { getHeroIdentity, heroEmblemSvg, heroTraitLabels } from './hero-identity';
import { attachHoverCards, unitHoverCard } from './hover-card';
import { heroPortraitHtml } from './s13-assets';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}
/** COMBAT tick is 50 ms: attacks per second from the attack interval when the content has no original speed. */
const TICKS_PER_SECOND = 20;

/** Trait labels: the S13 client list when the presentation knows the hero, else the content's own trait ids (new heroes). */
export function unitTraitLabels(definitionId: string): { name: string; open: boolean }[] {
  const labels = heroTraitLabels(definitionId);
  if (labels.length) return labels;
  return (UNIT_DEFINITIONS[definitionId]?.traits ?? []).map(id => ({ name: TRAIT_DEFINITIONS[id]?.name ?? id, open: Object.hasOwn(TRAIT_DEFINITIONS, id) }));
}

/** Card body for a unit definition at a star level; `null` when the definition is unknown to the content. */
export function unitCardBody(definitionId: string, starLevel: number): HTMLElement | null {
  const definition = Object.hasOwn(UNIT_DEFINITIONS, definitionId) ? UNIT_DEFINITIONS[definitionId] : undefined;
  if (!definition) return null;
  const star = Math.min(3, Math.max(1, Math.trunc(starLevel))) as StarLevel;
  const identity = getHeroIdentity(definitionId);
  const neutral = definition.unitKind === 'neutral';
  const body = el('div', '', 'unit-card'); body.dataset.unitDef = definitionId; body.dataset.star = String(star);
  const head = el('div', '', 'unit-card-head');
  const portrait = el('span', '', `unit-card-portrait cost-${definition.cost}`);
  portrait.innerHTML = heroPortraitHtml(definitionId, 40, heroEmblemSvg(definitionId, 40));
  const title = el('div', '', 'unit-card-title');
  title.append(el('strong', identity.name, 'unit-card-name'), el('span', '★'.repeat(star), `unit-card-stars star-${star}`),
    el('span', neutral ? '野怪' : `${definition.cost} 费`, 'unit-card-cost'));
  head.append(portrait, title); body.append(head);
  if (!neutral) {
    const traits = el('div', '', 'unit-card-traits'); traits.dataset.debug = 'unit-card:traits';
    for (const label of unitTraitLabels(definitionId)) { const tag = el('span', label.name, label.open ? 'trait-open' : 'trait-closed'); if (!label.open) tag.title = '本版本未开放'; traits.append(tag); }
    body.append(traits);
  }
  const stats = getUnitStats(definitionId, neutral ? 1 : star);
  const ability = abilityText(definition.abilityId, star);
  const section = el('div', '', 'unit-card-ability'); section.dataset.debug = 'unit-card:ability';
  section.append(el('div', `技能 · 法力 ${stats.initialMana}/${stats.maxMana}`, 'unit-card-label'));
  section.append(el('p', ability?.text || '无主动技能说明', 'unit-card-text'));
  body.append(section);
  const speed = stats.baseAttackSpeedBps !== undefined ? stats.baseAttackSpeedBps / 10_000 : TICKS_PER_SECOND / stats.attackIntervalTicks;
  const grid = el('dl', '', 'unit-card-stats'); grid.dataset.debug = 'unit-card:stats';
  for (const [label, value] of [['生命', stats.health], ['攻击力', stats.attack], ['护甲', stats.armor], ['魔抗', stats.magicResist], ['攻速', speed.toFixed(2)], ['射程', stats.attackRange]] as const) {
    grid.append(el('dt', label), el('dd', String(value)));
  }
  body.append(grid);
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
