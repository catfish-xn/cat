import { readAugmentFacts } from './augment-history';
import type { MatchState } from './match-types';
import type { CombatUnit } from './combat-types';
import type { AugmentDeath } from './augment-history-types';
import { GHOST_FRIENDS_ROLES, AUGMENT_BATCH5_G2 } from './content/augment-pool-batch5-g2';
import { UNIT_DEFINITIONS } from './units';

export interface GhostFriendsGrowth { readonly healthFlat: number; readonly attackDamageBps: number; readonly abilityPower: number }
export const EMPTY_GHOST_GROWTH: GhostFriendsGrowth = Object.freeze({ healthFlat: 0, attackDamageBps: 0, abilityPower: 0 });

export function ghostFriendsRole(definitionId: string, form?: CombatUnit['form']): string {
  const ranged: Readonly<Record<string, string>> = GHOST_FRIENDS_ROLES.ranged;
  return (form === 'ranged' ? ranged[definitionId] : undefined) ?? GHOST_FRIENDS_ROLES.champions[definitionId] ?? 'other';
}

export function ghostFriendsReward(role: string): GhostFriendsGrowth {
  const values = AUGMENT_BATCH5_G2['ghost-of-friends-past'].effects[0].values;
  if (role.includes('Tank')) return { ...EMPTY_GHOST_GROWTH, healthFlat: values.healthFlat };
  if (role.startsWith('AD')) return { ...EMPTY_GHOST_GROWTH, attackDamageBps: values.attackDamageBps };
  if (role.startsWith('AP')) return { ...EMPTY_GHOST_GROWTH, abilityPower: values.abilityPower };
  return { ...EMPTY_GHOST_GROWTH, healthFlat: values.healthFlat };
}

export function addGhostFriends(a: GhostFriendsGrowth, b: GhostFriendsGrowth): GhostFriendsGrowth {
  return { healthFlat: a.healthFlat + b.healthFlat, attackDamageBps: a.attackDamageBps + b.attackDamageBps, abilityPower: a.abilityPower + b.abilityPower };
}

/** History is the sole permanent authority. A combat uses only completed earlier rounds. */
export function ghostFriendsGrowth(state: MatchState): GhostFriendsGrowth | undefined {
  const owner = state.augments.find(a => a.definitionId === 'ghost-of-friends-past');
  if (!owner) return undefined;
  const seen = new Set<string>(), seatId = state.multiplayer?.seatId ?? 'solo';
  let growth = EMPTY_GHOST_GROWTH;
  for (const fact of readAugmentFacts(state, 'deaths')) {
    if (fact.round < owner.acquiredRound || fact.round >= state.round) continue;
    for (const death of fact.deaths) {
      const key = JSON.stringify([death.combatId, death.eventSeq]);
      if (seen.has(key)) continue;
      seen.add(key);
      if (death.ownerSeatId === seatId && (death.ordinaryHero || death.championCopy))
        growth = addGhostFriends(growth, ghostFriendsReward(ghostFriendsRole(death.definitionId, death.form)));
    }
  }
  return growth;
}

export function ghostFriendsChampion(unit: Pick<CombatUnit, 'definitionId' | 'unitKind' | 'itemSummon' | 'anomalySummon'>): boolean {
  const definition = UNIT_DEFINITIONS[unit.definitionId];
  return !!definition && !definition.summon && definition.unitKind !== 'neutral' && unit.unitKind !== 'neutral' && !unit.anomalySummon;
}

/** Exposed for independent history consumers without reading a mutable combat body. */
export function ghostFriendsDeathReward(death: Pick<AugmentDeath, 'definitionId' | 'ordinaryHero' | 'championCopy' | 'form'>): GhostFriendsGrowth {
  return death.ordinaryHero || death.championCopy ? ghostFriendsReward(ghostFriendsRole(death.definitionId, death.form)) : EMPTY_GHOST_GROWTH;
}
