import { freezeContent } from './content/freeze';
/** Fixed champion composition approved 2026-10-29; equipment/timing remain P7 policy. */
export const CAROUSEL_RULES = freezeContent({ version: 'carousel-v1', revision:'v26-fixed-costs-1', rounds:['2-4','3-4','4-4','5-4','6-4'], sharedPoolVersion: 'shared-pool-v3', batchSize: 2, firstBatchMs: 6000, batchIntervalMs: 6000, tailMs: 6000, departureMs: 2000, seedXor: 0x4341524f, slots: 9, opening: { gold: 0, level: 1, xp: 0, hp: 100, units: 1, components: 0 }, openingMode: 'free-irelia-portal-select', placement:'bench-then-board-then-held-v1', upgrades:'next-preparation-unique-receipt-v1', itemPolicy: 'eight-components-through-4-4-then-36-completed-v1', autoPolicy: 'upgrade-then-cost-then-slot-v1' } as const);

/** Counts are indexed by cost 1..6, not independent per-slot probabilities. */
export const CAROUSEL_COST_POLICY = freezeContent({
    version: 'carousel-fixed-costs-v1',
    countsByStage: {
        2: [1, 4, 4, 0, 0, 0],
        3: [1, 3, 3, 2, 0, 0],
        4: [1, 2, 2, 2, 2, 0],
        5: [0, 0, 3, 3, 3, 0],
    },
    normalLateCounts: [1, 2, 2, 2, 2, 0],
    sixCostLateCounts: [1, 0, 2, 2, 2, 2],
    sixCostGroupBps: { 6: 2000, 7: 5000, 8: 10000 },
    // The last cost word cannot affect the one remaining cost. Reuse it for the
    // late-stage group, leaving all nine champion/item words in their old positions.
    rng: { words: 27, groupWordIndex: 24, costs: 'remaining-counts-without-replacement-v1' },
    fallback: 'nearest-stocked-cost-1-through-6-lower-first-v1',
} as const);

/** @deprecated Legacy server-entry export; now aliases the fixed composition policy. */
export const CAROUSEL_COST_ODDS = CAROUSEL_COST_POLICY;

/** Stage policy only: this does not add carousel rounds to the overtime schedule. */
export function carouselCostCounts(stage: number, groupWord: number): readonly number[] {
    if (!Number.isSafeInteger(stage) || stage < 2 || !Number.isSafeInteger(groupWord) || groupWord < 0 || groupWord >= 4294967296)
        throw new RangeError('invalid-carousel-composition');
    if (stage <= 5)
        return CAROUSEL_COST_POLICY.countsByStage[stage as 2 | 3 | 4 | 5];
    const bps = CAROUSEL_COST_POLICY.sixCostGroupBps[Math.min(stage, 8) as 6 | 7 | 8];
    return Math.floor(groupWord * 10000 / 4294967296) < bps
        ? CAROUSEL_COST_POLICY.sixCostLateCounts : CAROUSEL_COST_POLICY.normalLateCounts;
}
