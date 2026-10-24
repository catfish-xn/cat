import { freezeContent } from './freeze';

/** 2026-10-23 approved M1–M4, V1–V3, S1–S7; evidence and units in the batch report. */
export const OPENING_BATCH_A = freezeContent({
  version: 'opening-batch-a-2026-10-23',
  melWeights: [7,15,10,15,10,15,10,2,10,1,1,1,3],
  melBranches: [1,2,4,5,6,7,8,9,10,11,12,13,14],
  goldWeights: [15,35,25,23,0,2],
  lootWeights: [3,14,14,13,14,14,14,13,1],
  goldMultipliers: [0,1,2,5,0,8],
  // Columns: normal Lv1–9, normal Lv10, Viktor Lv1–9, Viktor Lv10. Integer q Bps.
  sixCostQ: [
    [0,0,10,340], [16,126,48,378], [19,129,57,387], [22,132,66,396],
    [25,135,75,405], [28,138,84,414], [31,141,93,423], [34,144,102,432],
    [38,148,114,444], [42,152,126,456], [46,156,138,468], [50,160,150,480],
    [54,164,162,492], [58,168,174,504], [78,188,234,564], [98,208,294,624],
    [118,228,354,684], [138,248,414,744], [158,268,474,804], [178,288,534,864],
    [400,510,1200,1530],
  ],
  sampler: 'one-per-shop/clamp(5q)/one-uniform-slot/seat-stream',
  itemDelivery: 'pending-orb/existing-inventory-on-claim',
  stage: '2-1-first/every-n-1/overtime-seven-round-stages',
} as const);
