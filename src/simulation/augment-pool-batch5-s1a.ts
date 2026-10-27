import { AUGMENT_BATCH5_S1A } from './content/augment-pool-batch5-s1a';
import type { OwnedAugment } from './strategy-types';

/** Base slot uses are consumed before the three shared uses. History is the existing ordered index ledger. */
export function augmentExtraRerolls(owned: readonly OwnedAugment[], choiceId: string): number {
  return owned.some(a => a.definitionId === 'beggars-can-be-choosers' && a.choiceId !== choiceId)
    ? AUGMENT_BATCH5_S1A['beggars-can-be-choosers'].source.values.ExtraRolls : 0;
}
export function canRerollAugmentSlot(owned: readonly OwnedAugment[], choiceId: string, indices: readonly number[], slot: number): boolean {
  const extraUsed = indices.length - new Set(indices).size;
  return !indices.includes(slot) || extraUsed < augmentExtraRerolls(owned, choiceId);
}

/** The immediately following actual choice uses the promotion; later choices never do. */
export function promoteNextAugmentTier<T extends 'silver' | 'gold' | 'prismatic'>(tier: T, owned: readonly OwnedAugment[], choiceId: string): 'silver' | 'gold' | 'prismatic' {
  const nodes = ['round:2-1:augment', 'round:3-2:augment', 'round:4-2:augment'];
  const current = nodes.indexOf(choiceId);
  const power = owned.find(a => a.definitionId === 'power-up');
  if (!power) return tier;
  const acquired = nodes.indexOf(power.choiceId);
  if (acquired < 0 || current <= acquired || owned.some(a => {
    const n = nodes.indexOf(a.choiceId);
    return n > acquired && n < current;
  })) return tier;
  return tier === 'silver' ? 'gold' : 'prismatic';
}
