import { canonicalContent } from './content';
import { freezeContent } from './content/freeze';
import { OPENING_ENCOUNTERS, OPENING_ENCOUNTER_CONFIG, type OpeningEncounterId } from './content/opening-encounters';
import type { MatchState, MatchCommandResult } from './match-types';
import { nextRandom, validateSeed } from './rng';
import { getCatalogRoundById } from './round-selectors';

export { OPENING_ENCOUNTERS, OPENING_ENCOUNTER_CONFIG } from './content/opening-encounters';
export type { OpeningEncounterId } from './content/opening-encounters';
export type OpeningEncounterFailure = 'opening-config-incomplete' | 'opening-context-mismatch' | 'invalid-opening-effect';
export class OpeningEncounterError extends Error {
  constructor(readonly reason: OpeningEncounterFailure) { super(reason); }
}
export interface OpeningEncounterSelection {
  readonly configVersion: typeof OPENING_ENCOUNTER_CONFIG.version;
  readonly encounterId: OpeningEncounterId;
}
/** Reserved effect records cannot be populated until their producing/validating PR lands. */
export interface OpeningEffectFact {
  readonly factId: string; readonly effectKey: string; readonly nodeId: string;
}
export interface OpeningEffectReceipt {
  readonly receiptId: string; readonly factId: string; readonly seatId: string; readonly nodeId: string;
}
export interface OpeningEncounterContext {
  readonly selection: OpeningEncounterSelection;
  readonly seed: number;
  readonly selectionRng: { readonly state: number; readonly draws: 1 };
  readonly facts: readonly OpeningEffectFact[];
}
export type OpeningEncounterState =
  | { readonly mode: 'shared-deferred' }
  | { readonly mode: 'solo'; readonly context: OpeningEncounterContext; readonly receipts: readonly OpeningEffectReceipt[] }
  | { readonly mode: 'shared'; readonly poolId: string; readonly seatId: string;
      readonly selection: OpeningEncounterSelection; readonly receipts: readonly OpeningEffectReceipt[] };

function fail(reason: OpeningEncounterFailure): never { throw new OpeningEncounterError(reason); }
function same(a: unknown, b: unknown): boolean {
  try { return canonicalContent(a) === canonicalContent(b); } catch { return false; }
}
/** A config parameter is an identity assertion, not a backdoor to enable unfinished rules. */
export function validateOpeningEncounterConfig(config: unknown): void {
  if (config !== OPENING_ENCOUNTER_CONFIG && !same(config, OPENING_ENCOUNTER_CONFIG)) fail('opening-config-incomplete');
}
function selectionWord(seed: number): number {
  validateSeed(seed);
  let hash = 0x811c9dc5;
  const name = OPENING_ENCOUNTER_CONFIG.selectionStream;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 0x01000193) >>> 0;
  return nextRandom((seed ^ hash) >>> 0).word;
}
/** No enabled filtering: all intervals, including disabled effects, retain their weight. */
export function selectOpeningEncounterFromWord(word: number): OpeningEncounterId {
  validateSeed(word);
  const ticket = Math.floor(word * 10000 / 4294967296);
  let end = 0;
  for (const entry of OPENING_ENCOUNTERS) {
    end += entry.weightBps;
    if (ticket < end) return entry.id;
  }
  return fail('opening-config-incomplete');
}
export function createOpeningEncounter(seed: number, config: unknown = OPENING_ENCOUNTER_CONFIG): OpeningEncounterContext {
  validateOpeningEncounterConfig(config);
  const word = selectionWord(seed);
  return freezeContent({ selection: {configVersion: OPENING_ENCOUNTER_CONFIG.version, encounterId: selectOpeningEncounterFromWord(word)},
    seed, selectionRng: {state: word, draws: 1}, facts: [] });
}
/** Re-derive to authenticate, never replace an input or repair missing fields. */
export function validateOpeningEncounterContext(input: unknown, seed: number): void {
  if (!same(input, createOpeningEncounter(seed))) fail('opening-context-mismatch');
}
export function createSoloOpeningEncounter(seed: number): OpeningEncounterState {
  return freezeContent({mode: 'solo', context: createOpeningEncounter(seed), receipts: []});
}
/** Called by initializeSharedSeat only after untouched-opening admission succeeds. */
export function bindSharedOpeningEncounter(context: OpeningEncounterContext, poolId: string, seatId: string): OpeningEncounterState {
  validateOpeningEncounterContext(context, context.seed);
  if (!poolId || !seatId) fail('opening-context-mismatch');
  return freezeContent({mode: 'shared', poolId, seatId, selection: {...context.selection}, receipts: []});
}
export function validateOpeningEncounterState(state: MatchState, shared?: OpeningEncounterContext): void {
  const opening = state.openingEncounter;
  if (state.sharedPool) {
    if (!shared) fail('opening-context-mismatch');
    validateOpeningEncounterContext(shared, state.augmentTierSeed);
    if (!same(opening, bindSharedOpeningEncounter(shared, state.sharedPool.poolId, state.sharedPool.seatId))) fail('opening-context-mismatch');
  } else if (!same(opening, createSoloOpeningEncounter(state.seed))) fail('opening-context-mismatch');
}
/** PR1: validate a real catalog round; every selected result is a rule no-op. */
export function planOpeningRound(shared: OpeningEncounterContext, roundId: string): {
  readonly context: OpeningEncounterContext; readonly facts: readonly OpeningEffectFact[];
} {
  validateOpeningEncounterContext(shared, shared.seed);
  try { getCatalogRoundById(roundId); } catch { fail('invalid-opening-effect'); }
  return {context: shared, facts: []};
}
/** No forged progress/receipts accepted while all effect executors are disabled. */
export function applyOpeningEffects(state: MatchState, facts: readonly OpeningEffectFact[], shared?: OpeningEncounterContext): MatchCommandResult {
  try {
    validateOpeningEncounterState(state, shared);
    if (!same(facts, [])) fail('invalid-opening-effect');
    return {ok: true, state, events: []};
  } catch (error) {
    return {ok: false, state, reason: error instanceof OpeningEncounterError ? error.reason : 'opening-context-mismatch'};
  }
}
/** Public whitelist. Never spread a context: seed, RNG and unrevealed facts stay private. */
export function readOpeningEncounterView(state: Pick<MatchState, 'openingEncounter'>) {
  const opening = state.openingEncounter;
  if (opening.mode === 'shared-deferred') return null;
  const selection = opening.mode === 'solo' ? opening.context.selection : opening.selection;
  const entry = OPENING_ENCOUNTERS.find(entry => entry.id === selection.encounterId);
  if (!entry || selection.configVersion !== OPENING_ENCOUNTER_CONFIG.version) fail('opening-context-mismatch');
  return freezeContent({ configVersion: selection.configVersion, encounterId: entry.id,
    sourceEncounterId: entry.encounterId, portalId: entry.portalId, champion: entry.champion,
    nameZh: entry.nameZh, nameEn: entry.nameEn, enabled: entry.enabled, effectStatus: entry.effectStatus,
    readiness: entry.readiness, descriptionZh: entry.descriptionZh,
    statusTextZh: entry.enabled ? '本局不附加奇遇规则' : '本局抽中此奇遇，效果尚未启用',
    revealedFacts: [] as readonly OpeningEffectFact[] });
}
export type OpeningEncounterView = ReturnType<typeof readOpeningEncounterView>;
