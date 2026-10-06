// M4 legacy fixture content only. Never used by M5 acquisition pools.
import type { Effect, TraitDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
const tiers = (amounts: readonly number[], effects: (amount: number) => readonly Effect[]) =>
  amounts.map((amount, i) => ({ threshold: (i + 1) * 2, effects: effects(amount) }));
export const TRAIT_DEFINITIONS: Readonly<Record<string, TraitDefinition>> = freezeContent({
  bulwark: { id: 'bulwark', name: '壁阵', target: 'members', tiers: tiers([15, 30, 50], amount => [
    { kind: 'statFlat', stat: 'armor', amount }, { kind: 'statFlat', stat: 'magicResist', amount }]) },
  marksman: { id: 'marksman', name: '远射', target: 'members', tiers: tiers([1500, 3000, 5000], bps => [{ kind: 'attackSpeedBps', bps }]) },
  scholar: { id: 'scholar', name: '研习', target: 'members', tiers: tiers([1500, 3000, 5000], bps => [{ kind: 'statPercentBps', stat: 'abilityAmount', bps }]) },
  forge: { id: 'forge', name: '锻盟', target: 'team', tiers: tiers([8, 16, 28], amount => [{ kind: 'statFlat', stat: 'attackDamage', amount }]) },
  conduit: { id: 'conduit', name: '导流', target: 'members', tiers: tiers([10, 20, 30], amount => [{ kind: 'statFlat', stat: 'initialMana', amount }]) },
  duelist: { id: 'duelist', name: '锋舞', target: 'members', tiers: tiers([25, 55], amount => [
    { kind: 'trigger', hook: 'onAttack', everyN: 3, action: { kind: 'dealDamage', damageType: 'physical', amount } }]) },
});
