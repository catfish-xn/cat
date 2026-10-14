import { canonicalContent } from './content';
import { freezeContent } from './content/freeze';
import { ROUND_CATALOG } from './content/round-catalog';
import { ORB_SLOTS, ORB_RULES } from './content/orbs';
import { nextRandom, validateSeed } from './rng';
import type { RngStream } from './m8/contracts';

export type OrbTier = 'gray' | 'blue' | 'gold' | 'prismatic';
export interface OrbRoundLayout {
  readonly roundId: string;
  readonly encounterId: string;
  readonly orbs: readonly { readonly sourceUnitId: string; readonly slotOrdinal: number;
    readonly tier: OrbTier; readonly templateId: string }[];
}
export interface OrbLayoutLedger {
  readonly version: 's13-orb-layout-v1'; readonly seed: number; readonly throughRoundOrdinal: number;
  readonly rng: RngStream; readonly rounds: readonly OrbRoundLayout[];
}
export type OrbLayoutFailure = 'invalid-orb-layout' | 'stale-orb-layout' | 'invalid-orb-round';
export type OrbLayoutResult = { readonly ok: true; readonly layout: OrbLayoutLedger }
  | { readonly ok: false; readonly layout: OrbLayoutLedger; readonly reason: OrbLayoutFailure };
export type LootInitialization = { readonly mode: 'solo' } | { readonly mode: 'shared-deferred' };
export type LootLayoutBinding = { readonly mode: 'solo'; readonly layout: OrbLayoutLedger }
  | { readonly mode: 'shared-deferred' }
  | { readonly mode: 'shared'; readonly poolId: string; readonly version: 's13-orb-layout-v1'; readonly throughRoundOrdinal: number };

/** Rejection words count as draws; all callers keep an explicit independent cursor. */
export function drawIndex(rng: RngStream, size: number): { readonly index: number; readonly rng: RngStream } {
  validateSeed(rng.state);
  if (!Number.isSafeInteger(rng.draws) || rng.draws < 0 || !Number.isSafeInteger(size) || size < 1 || size > 0x100000000)
    throw new RangeError('Invalid independent draw');
  const limit = Math.floor(0x100000000 / size) * size;
  let { state, draws } = rng;
  for (;;) {
    if (!Number.isSafeInteger(draws + 1)) throw new RangeError('Draw overflow');
    const next = nextRandom(state); state = next.state; draws++;
    if (next.word < limit) return { index: next.word % size, rng: { state, draws } };
  }
}
export function createOrbLayout(seed: number): OrbLayoutLedger {
  validateSeed(seed);
  return freezeContent({version: 's13-orb-layout-v1', seed, throughRoundOrdinal: 0,
    rng: { state: (seed ^ ORB_RULES.layoutSeedXor) >>> 0, draws: 0 }, rounds: []});
}
function replay(seed: number, ordinal: number): OrbLayoutLedger {
  let layout = createOrbLayout(seed), rng = layout.rng;
  const rounds: OrbRoundLayout[] = [];
  for (const round of ROUND_CATALOG) {
    if (round.ordinal > ordinal) break;
    if (round.kind !== 'pve') continue;
    const orbs = ORB_SLOTS[round.roundId].map(slot => {
      let templateId = slot.templateId, tier: OrbTier = slot.tier;
      if (templateId === 'opening-bonus' || templateId === 'equipment') {
        const draw = drawIndex(rng, 100); rng = draw.rng;
        if (templateId === 'opening-bonus') {
          templateId = draw.index < 50 ? 'component' : 'opening-gold'; tier = draw.index < 50 ? 'blue' : 'gray';
        } else {
          templateId = draw.index < 90 ? 'blue-pair' : draw.index < 99 ? 'gold-pair' : 'prismatic-standard';
          tier = draw.index < 90 ? 'blue' : draw.index < 99 ? 'gold' : 'prismatic';
        }
      }
      return {sourceUnitId: JSON.stringify(['pve', round.roundId, round.encounterId, slot.sourceSlotId]),
        slotOrdinal: slot.slotOrdinal, tier, templateId};
    }).sort((a,b) => a.sourceUnitId < b.sourceUnitId ? -1 : a.sourceUnitId > b.sourceUnitId ? 1 : a.slotOrdinal-b.slotOrdinal);
    rounds.push({roundId:round.roundId, encounterId:round.encounterId!, orbs});
  }
  return freezeContent({...layout, throughRoundOrdinal:ordinal, rng, rounds});
}
export function restoreOrbLayout(value: unknown): OrbLayoutLedger {
  if (!value || typeof value !== 'object') throw new RangeError('Invalid orb layout');
  const input = value as OrbLayoutLedger;
  if (!Number.isSafeInteger(input.throughRoundOrdinal) || input.throughRoundOrdinal < 0 || input.throughRoundOrdinal > ROUND_CATALOG.length)
    throw new RangeError('Invalid orb layout');
  const expected = replay(input.seed, input.throughRoundOrdinal);
  if (canonicalContent(value) !== canonicalContent(expected)) throw new RangeError('Invalid orb layout');
  return expected;
}
export function freezeOrbLayoutThroughRound(layout: OrbLayoutLedger, ordinal: number): OrbLayoutResult {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal > ROUND_CATALOG.length)
    return {ok:false, layout, reason:'invalid-orb-round'};
  try { restoreOrbLayout(layout); } catch { return {ok:false, layout, reason:'invalid-orb-layout'}; }
  if (ordinal < layout.throughRoundOrdinal) return {ok:false, layout, reason:'stale-orb-layout'};
  return {ok:true, layout:ordinal === layout.throughRoundOrdinal ? layout : replay(layout.seed,ordinal)};
}
