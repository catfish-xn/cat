import type { TraitDefinition } from '../strategy-types';
import { freezeContent } from './freeze';
/** Values transcribed from normalized/g2-1-traits.json. High tiers requiring emblems remain unreachable in this slice. */
export const G2_TRAIT_DEFINITIONS: Readonly<Record<string, TraitDefinition>> = freezeContent({
  automata: { id: 'automata', name: '自动机', target: 'members', tiers: [
    [2, 150, 25], [4, 400, 60],
  ].map(([threshold, damage, resistance]) => ({ threshold, effects: [
    { kind: 'statFlat' as const, stat: 'armor' as const, amount: resistance },
    { kind: 'statFlat' as const, stat: 'magicResist' as const, amount: resistance },
    { kind: 'mechanic' as const, mechanic: 'automata', values: { crystals: 20, damage, conversionBps: 2500 } },
  ] })) },
  firelight: { id: 'firelight', name: '野火帮', target: 'members', tiers: [
    [2, 2000, 0], [3, 3300, 0],
  ].map(([threshold, healBps, attackSpeedBps]) => ({ threshold, effects: [
    { kind: 'mechanic' as const, mechanic: 'firelight', values: { periodTicks: 120, healBps, attackSpeedBps, dashTicks: 20 } },
  ] })) },
  family: { id: 'family', name: '家人', target: 'members', tiers: [
    [3, 2500],
  ].map(([threshold, manaReductionBps]) => ({ threshold, effects: [
    { kind: 'mechanic' as const, mechanic: 'family', values: { manaReductionBps, damageReductionBps: 2000, heist: threshold === 5 ? 1 : 0 } },
    ...(threshold >= 4 ? [{ kind: 'attackSpeedBps' as const, bps: 2000 }] : []),
  ] })) },
});
