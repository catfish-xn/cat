/**
 * Ability description text for hover cards (G2 prerequisite). Reads the archived description template and the per-star
 * variables of `S13_ABILITY_DATA` as given: `@Var@` (and `@Var*N@`) becomes that variable's value for the star level,
 * Riot markup is reduced to plain text. Variables the content does not list (the AP/AD-modified totals such as
 * `@ModifiedShield@`, unit properties) stay exactly as written: they are computed by the rules and not exported for display.
 */
import { S13_ABILITY_DATA } from '../simulation/content/abilities';

export interface AbilityText {
  readonly text: string;
  /** Tokens left as written because the content has no such variable (in order of first appearance). */
  readonly unknown: readonly string[];
}

const SCALE_ICONS: Readonly<Record<string, string>> = { scaleAP: '法强', scaleAD: '攻击力', scaleHealth: '生命', scaleArmor: '护甲', scaleMR: '魔抗', scaleAS: '攻速', scaleMana: '法力' };
const ENTITIES: Readonly<Record<string, string>> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/** Up to two decimals, no trailing zeros (0.3 * 100 → 30, 1.25 → 1.25). */
function formatNumber(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** Pure: the template of `description` filled for `starLevel` (1–3) from `variables`. */
export function fillAbilityTemplate(description: string, variables: Readonly<Record<string, readonly number[]>>, starLevel: number): AbilityText {
  const unknown: string[] = [];
  const index = Math.min(3, Math.max(1, Math.trunc(starLevel))) - 1;
  const filled = description.replace(/@([A-Za-z0-9_.:]+)(?:\*(-?\d+(?:\.\d+)?))?@/g, (token, name: string, multiplier: string | undefined) => {
    const values = Object.hasOwn(variables, name) ? variables[name] : undefined;
    const value = values?.[index];
    if (value === undefined) { if (!unknown.includes(token)) unknown.push(token); return token; }
    return formatNumber(value * (multiplier === undefined ? 1 : Number(multiplier)));
  });
  const text = filled
    .replace(/%i:([A-Za-z]+)%/g, (_, icon: string) => SCALE_ICONS[icon] ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z#0-9]+;/gi, entity => ENTITIES[entity] ?? entity)
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text, unknown };
}

/** The ability of `abilityId` at `starLevel`, or null when the content has no description for it (neutrals, legacy units). */
export function abilityText(abilityId: string, starLevel: number): AbilityText | null {
  const data = Object.hasOwn(S13_ABILITY_DATA, abilityId) ? S13_ABILITY_DATA[abilityId] : undefined;
  return data ? fillAbilityTemplate(data.description, data.variables, starLevel) : null;
}
