import type { S13ResolvedAbility } from './ability-types';
import { S13_ABILITY_DATA } from './content/abilities';
import { D14_FOURTH_ABILITY } from './d14-anomalies/fourth-ability';

/** The same fourth-rank skill for promotion, Family and combat-only copies. */
export function resolveFourthStarAbility(championId: string, abilityId: string): S13ResolvedAbility {
  const archived = D14_FOURTH_ABILITY[championId], raw = S13_ABILITY_DATA[abilityId];
  const variables = Object.fromEntries(Object.entries(raw.variables).map(([key, values]) =>
    [key, Math.round((archived?.[key] ?? (values[0] === values[2] ? values[2] : values[2] * 1.8)) * 10000)]));
  // 14.24b: 50/50/55/60%; the archived 14.24 fourth rank is still 70%.
  if (championId === 'singed') variables.DR = 6000;
  return { id: abilityId, amount: 0, kind: 's13', championId, variables };
}
