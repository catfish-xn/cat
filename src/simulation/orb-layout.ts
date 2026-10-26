import { canonicalContent, equalValidatedContent } from './content';
import { shareGeneratedJson } from './immutable-json';
import { ROUND_CATALOG } from './content/round-catalog';
import { ORB_RULES, EPIC_SOURCES, orbBoxId } from './content/orbs';
import { NEUTRAL_ENCOUNTERS } from './content/neutral-encounters';
import { sampleOrbStagePlan } from './orb-stage-plan';
export { sampleOrbStagePlan } from './orb-stage-plan';
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
  readonly version: 's13-orb-layout-v2'; readonly seed: number; readonly throughRoundOrdinal: number;
  readonly rng: RngStream; readonly rounds: readonly OrbRoundLayout[];
}
export type OrbLayoutFailure = 'invalid-orb-layout' | 'stale-orb-layout' | 'invalid-orb-round';
export type OrbLayoutResult = { readonly ok: true; readonly layout: OrbLayoutLedger }
  | { readonly ok: false; readonly layout: OrbLayoutLedger; readonly reason: OrbLayoutFailure };
export type LootInitialization = { readonly mode: 'solo' } | { readonly mode: 'shared-deferred' };
export type LootLayoutBinding = { readonly mode: 'solo'; readonly layout: OrbLayoutLedger }
  | { readonly mode: 'shared-deferred' }
  | { readonly mode: 'shared'; readonly poolId: string; readonly version: 's13-orb-layout-v2'; readonly throughRoundOrdinal: number };

// Membership is granted only by the deterministic constructors below, never by
// deserialization or by observing a frozen wrapper supplied by a caller.
// Canonical text is memoized only for private, generated frozen references.
const referenceText = new WeakMap<object, string>();
function canonicalReference(value: object): string {
  let text = referenceText.get(value);
  if (text === undefined) { text = canonicalContent(value); referenceText.set(value, text); }
  return text;
}
const generatedLayouts = new WeakSet<OrbLayoutLedger>();
function generated(layout: OrbLayoutLedger): OrbLayoutLedger {
  layout = shareGeneratedJson(layout); generatedLayouts.add(layout); return layout;
}

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
  return generated({version: 's13-orb-layout-v2', seed, throughRoundOrdinal: 0,
    rng: { state: (seed ^ ORB_RULES.layoutSeedXor) >>> 0, draws: 0 }, rounds: []});
}
const replayedLayouts = new Map<string, OrbLayoutLedger>();
function replay(seed: number, ordinal: number): OrbLayoutLedger {
  validateSeed(seed);
  const key = `${Object.is(seed, -0) ? '-0' : seed}:${Object.is(ordinal, -0) ? '-0' : ordinal}`, cached = replayedLayouts.get(key);
  if (cached) return cached;
  const layout = replayUncached(seed, ordinal);
  if (replayedLayouts.size >= 128) replayedLayouts.delete(replayedLayouts.keys().next().value!);
  replayedLayouts.set(key, layout);
  return layout;
}
function replayUncached(seed: number, ordinal: number): OrbLayoutLedger {
  const layout = createOrbLayout(seed);
  // Compute once for all entered rounds; only the entered prefix is serialized.
  const plan = ordinal > 0 ? sampleOrbStagePlan(seed) : null;
  const rounds: OrbRoundLayout[] = [];
  for (const round of ROUND_CATALOG) {
    if (round.ordinal > ordinal) break;
    if (round.kind !== 'pve') continue;
    const encounter = NEUTRAL_ENCOUNTERS.find(e=>e.roundId===round.roundId)!;
    const carriers = encounter.slots.map(s=>s.slotId).sort();
    const slots:{sourceSlotId:string;slotOrdinal:number;tier:OrbTier;templateId:string}[]=[];
    if(round.stage<=4) {
      const row=plan!.stages[round.stage-1];
      const sequence:{tier:OrbTier;templateId:string}[]=[];
      for(const kind of ['components','gray','blue','gold','prismatic'] as const)
        for(let i=0;i<row[kind];i++)sequence.push(kind==='components'?{tier:'blue',templateId:'component'}:{tier:kind,templateId:orbBoxId(kind,round.stage)});
      const selected=round.stage===1?sequence.filter((_,i)=>i%3===round.ordinal-1):sequence;
      selected.forEach((s,i)=>slots.push({...s,sourceSlotId:carriers[i%carriers.length],slotOrdinal:Math.floor(i/carriers.length)}));
    } else slots.push({sourceSlotId:EPIC_SOURCES[round.roundId as keyof typeof EPIC_SOURCES],slotOrdinal:0,tier:'gold',templateId:'epic-reward'});
    const orbs = slots.map(slot => {
      const {templateId,tier}=slot;
      return {sourceUnitId: JSON.stringify(['pve', round.roundId, round.encounterId, slot.sourceSlotId]),
        slotOrdinal: slot.slotOrdinal, tier, templateId};
    }).sort((a,b) => a.sourceUnitId < b.sourceUnitId ? -1 : a.sourceUnitId > b.sourceUnitId ? 1 : a.slotOrdinal-b.slotOrdinal);
    rounds.push({roundId:round.roundId, encounterId:round.encounterId!, orbs});
  }
  return generated({...layout, throughRoundOrdinal:ordinal, rounds});
}
export function restoreOrbLayout(value: unknown, parsedJsonInput = false): OrbLayoutLedger {
  if (!value || typeof value !== 'object') throw new RangeError('Invalid orb layout');
  const input = value as OrbLayoutLedger;
  // Parsed admission always checks the complete layout, even when decoding
  // reused an immutable constructor representation. Internal generated callers
  // can still reuse their own constructor proof within the current operation.
  if (generatedLayouts.has(input) && !parsedJsonInput) return input;
  if (!Number.isSafeInteger(input.throughRoundOrdinal) || input.throughRoundOrdinal < 0 || input.throughRoundOrdinal > ROUND_CATALOG.length)
    throw new RangeError('Invalid orb layout');
  const expected = replay(input.seed, input.throughRoundOrdinal);
  if (parsedJsonInput ? !equalValidatedContent(value, expected) : canonicalContent(value) !== canonicalReference(expected)) throw new RangeError('Invalid orb layout');
  return expected;
}
export function freezeOrbLayoutThroughRound(layout: OrbLayoutLedger, ordinal: number): OrbLayoutResult {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal > ROUND_CATALOG.length)
    return {ok:false, layout, reason:'invalid-orb-round'};
  try { restoreOrbLayout(layout); } catch { return {ok:false, layout, reason:'invalid-orb-layout'}; }
  if (ordinal < layout.throughRoundOrdinal) return {ok:false, layout, reason:'stale-orb-layout'};
  return {ok:true, layout:ordinal === layout.throughRoundOrdinal ? layout : replay(layout.seed,ordinal)};
}
