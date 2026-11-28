/**
 * Ability description text for hover cards. The name and every value come from the rules' display functions
 * (`abilityDisplayName` / `abilityDisplayValues`, MATCH_CONTRACT SR-G2-01): `@Key@` and expression tokens such as
 * `@PercentShieldDamage*100@` are looked up as given, never multiplied or recomputed here. Riot markup is reduced to plain
 * text; the Experiment branch (trait not enabled in this release) is replaced by a "not enabled" note on its own line. The player sees the
 * 14.24 zh_cn client name and tooltip (`ABILITY_ZH`, same tokens as the English content text) where the client has one.
 */
import { abilityDisplayName, abilityDisplayValues, glovesOffDisplayValues, ultimateHeroAbilityDisplayValues, type AbilityDisplayStats } from '../simulation/ability-display';
import { S13_ABILITY_DATA } from '../simulation/content/abilities';
import { G23_UNITS } from '../simulation/content/g2-3-units';
import type { UnitForm } from '../simulation/seat-mechanics/types';
import { UNIT_DEFINITIONS, type StarLevel } from '../simulation/units';
import type { UnitDefinition } from '../simulation/unit-types';
import { readTooltipText, tooltipTextPlaceholder } from './tooltip-text-loader';

export interface AbilityText {
  /** zh_cn client ability name; the locked CDragon name when the client table has none. */
  readonly name: string;
  readonly text: string;
  /** Tokens left as written because the display values have no such key (in order of first appearance). */
  readonly unknown: readonly string[];
}

const SCALE_ICONS: Readonly<Record<string, string>> = {
  scaleAP: '法强', scaleAD: '攻击力', scaleHealth: '生命', scaleArmor: '护甲', scaleMR: '魔抗', scaleAS: '攻速', scaleMana: '法力', scaleDA: '伤害增幅', scaleDR: '减伤',
};
const ENTITIES: Readonly<Record<string, string>> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
/** Experiment is not an enabled trait: its whole tooltip branch is shown as a note instead of numbers (SR-G2-01). */
const EXPERIMENT_BRANCH = /<spellActive enabled=TFT13_ExperimentActive[^>]*>[\s\S]*?<\/spellActive>/g;
export const EXPERIMENT_NOTE = '试验品加成：本版本未启用';
/** Private marker in front of the note until the line breaks are settled (never in client text). */
const NOTE_LINE = '\u0001';
/** Non-numeric placeholders of traits that are not enabled (Rumble's Junker King upgrade name); hidden. */
const HIDDEN_TOKENS: ReadonlySet<string> = new Set(['TFTUnitProperty.:TFT13_JunkerKing_UpgradeTRAKeyWrapper']);

/** Up to two decimals, no trailing zeros (30.000000000000004 → 30, 1.25 → 1.25). Formatting only. */
function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Pure: `description` with every `@token@` replaced by `values[token]`, markup reduced to plain text. */
export function fillAbilityTemplate(description: string, values: Readonly<Record<string, number>>): Omit<AbilityText, 'name'> {
  const unknown: string[] = [];
  const filled = description.replace(EXPERIMENT_BRANCH, `${NOTE_LINE}${EXPERIMENT_NOTE}`).replace(/@([^@<>\s]+)@/g, (token, key: string) => {
    if (Object.hasOwn(values, key)) return formatNumber(values[key]);
    if (HIDDEN_TOKENS.has(key)) return '';
    if (!unknown.includes(token)) unknown.push(token);
    return token;
  });
  const text = filled
    .replace(/(?:%i:[A-Za-z]+%)+/g, run => [...run.matchAll(/%i:([A-Za-z]+)%/g)].map(([, icon]) => SCALE_ICONS[icon] ?? '').filter(Boolean).join('+'))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z#0-9]+;/gi, entity => ENTITIES[entity] ?? entity)
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // The note starts a line of its own; a line break the client text already has before it is kept as written.
    .replace(new RegExp(` *\n? *${NOTE_LINE}`), '\n')
    .trim();
  return { text, unknown };
}

/**
 * Display id of hero `definitionId` in `form`: a form swapper's back-row form is the content's `<id>-ranged` definition
 * (rules: g2-3-forms.ts); every other hero, and an unknown form, keeps its own id.
 */
export function formDefinitionId(definitionId: string, form: UnitForm | null | undefined): string {
  return form === 'ranged' && Object.hasOwn(G23_UNITS, `${definitionId}-ranged`) ? `${definitionId}-ranged` : definitionId;
}
/** Display ids of every form of `definitionId`: front row first, then the back-row form of a form swapper. */
export function abilityFormIds(definitionId: string): readonly string[] {
  return Object.hasOwn(G23_UNITS, `${definitionId}-ranged`) ? [definitionId, `${definitionId}-ranged`] : [definitionId];
}
/** Content definition of a hero or of a form swapper's back-row form (left out of UNIT_DEFINITIONS). */
export function abilityUnitDefinition(definitionId: string): UnitDefinition | undefined {
  if (Object.hasOwn(UNIT_DEFINITIONS, definitionId)) return UNIT_DEFINITIONS[definitionId];
  return definitionId.endsWith('-ranged') && Object.hasOwn(G23_UNITS, definitionId) ? G23_UNITS[definitionId] : undefined;
}

/**
 * The ability of hero `definitionId` (or a back-row form id from `formDefinitionId`) at `starLevel` (default base AD and 100 AP unless `stats` is given), or null when the
 * rules have no display source for it (neutrals, legacy units).
 */
export function abilityText(definitionId: string, starLevel: number, stats?: AbilityDisplayStats, heroAbility = false): AbilityText | null {
  const definition = abilityUnitDefinition(definitionId);
  const data = definition && Object.hasOwn(S13_ABILITY_DATA, definition.abilityId) ? S13_ABILITY_DATA[definition.abilityId] : undefined;
  if (!data) return null;
  const star = Math.min(3, Math.max(1, Math.trunc(starLevel))) as StarLevel;
  const texts = readTooltipText();
  if (!texts) return { name: abilityDisplayName(definitionId), text: tooltipTextPlaceholder().replace('强化', '技能'), unknown: [] };
  const zh = Object.hasOwn(texts.ABILITY_ZH, data.id) ? texts.ABILITY_ZH[data.id] : undefined;
  // 卯足全力: the strongest Vander shows the hero spell that replaces his ability (rules: content/gloves-off.ts).
  const hero = heroAbility && starLevel !== 4 && definitionId === 'vander' && Object.hasOwn(texts.HERO_ABILITY_ZH, data.id) ? texts.HERO_ABILITY_ZH[data.id] : undefined;
  if (hero) return { name: hero.name, ...fillAbilityTemplate(hero.text, glovesOffDisplayValues(star, stats)) };
  try {
    const values = starLevel === 4 ? ultimateHeroAbilityDisplayValues(definitionId, stats)
      : abilityDisplayValues(definitionId, star, stats);
    // The client's own name strings may carry trailing tabs (Nunu); only the surrounding whitespace is dropped.
    return { name: (zh?.name ?? abilityDisplayName(definitionId)).trim(), ...fillAbilityTemplate(zh?.text ?? data.description, values) };
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

/** Ability name of a hero (zh_cn client name when known), or null when the rules have no display source for it. */
export function abilityNameOf(definitionId: string): string | null {
  const abilityId = abilityUnitDefinition(definitionId)?.abilityId ?? `${definitionId}-ability`;
  try { const name = abilityDisplayName(definitionId); return ((Object.hasOwn(readTooltipText()?.ABILITY_ZH ?? {}, abilityId) ? readTooltipText()!.ABILITY_ZH[abilityId].name : undefined) ?? name).trim(); } catch (error) { if (error instanceof RangeError) return null; throw error; }
}
