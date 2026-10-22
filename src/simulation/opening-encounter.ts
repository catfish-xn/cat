import { canonicalContent } from './content';
import { freezeContent } from './content/freeze';
import { OPENING_ENCOUNTERS, OPENING_ENCOUNTER_CONFIG, type OpeningEncounterId } from './content/opening-encounters';
import { openMechanicChoice } from './seat-mechanics/choices';
import { G24_FORGE_POLICY, resolveG24ForgePool } from './content/g2-4-forges';
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
/** Deterministic effect descriptors; PR2 activation and anvil grants have independent receipts. */
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
export function createSoloOpeningEncounter(seed: number): Extract<OpeningEncounterState, {mode: 'solo'}> {
  return freezeContent({mode: 'solo', context: createOpeningEncounter(seed), receipts: []});
}
/** Called by initializeSharedSeat only after untouched-opening admission succeeds. */
export function bindSharedOpeningEncounter(context: OpeningEncounterContext, poolId: string, seatId: string): OpeningEncounterState {
  validateOpeningEncounterContext(context, context.seed);
  if (!poolId || !seatId) fail('opening-context-mismatch');
  return freezeContent({mode: 'shared', poolId, seatId, selection: {...context.selection}, receipts: []});
}
function openingInstanceId(seed: number): string {
  const name = `opening-instance/${seed}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
/** The PR2 facts are deterministic grants/policy activation, not random global outcomes. */
function openingFacts(context: OpeningEncounterContext): OpeningEffectFact[] {
  const entry = OPENING_ENCOUNTERS.find(e => e.id === context.selection.encounterId)!;
  if (!entry.enabled || entry.followupPr !== 2) return [];
  const keys = entry.id === 'component-anvils' ? ['anvil/0', 'anvil/1']
    : entry.id === 'artifact-anvil' ? ['anvil/0'] : ['augment-policy'];
  return keys.map(effectKey => ({factId: JSON.stringify(['opening-effect', context.selection.configVersion,
    openingInstanceId(context.seed), entry.id, effectKey, '1-2']), effectKey, nodeId: '1-2'}));
}
function boundContext(state: MatchState, shared?: OpeningEncounterContext): OpeningEncounterContext {
  const opening = state.openingEncounter;
  if (state.sharedPool) {
    if (!shared) fail('opening-context-mismatch');
    validateOpeningEncounterContext(shared, state.augmentTierSeed);
    if (!opening || opening.mode !== 'shared' || !same({...opening, receipts: []},
      bindSharedOpeningEncounter(shared, state.sharedPool.poolId, state.sharedPool.seatId))) fail('opening-context-mismatch');
    return shared;
  }
  if (!opening || opening.mode !== 'solo' || state.augmentTierSeed !== state.seed
    || !same({...opening, receipts: []}, createSoloOpeningEncounter(state.seed))) fail('opening-context-mismatch');
  return opening.context;
}
function effectReceipts(context: OpeningEncounterContext, seatId: string): OpeningEffectReceipt[] {
  return openingFacts(context).map(f => ({receiptId: JSON.stringify(['opening-receipt', f.factId, seatId]),
    factId: f.factId, seatId, nodeId: f.nodeId}));
}
export function validateOpeningEncounterState(state: MatchState, shared?: OpeningEncounterContext): void {
  const context = boundContext(state, shared);
  if (state.openingEncounter.mode === 'shared-deferred' || !same(state.openingEncounter.receipts,
    effectReceipts(context, state.sharedPool?.seatId ?? 'solo'))) fail('opening-context-mismatch');
  validateOpeningForges(state);
}
/** PR2 needs no mutable shared facts or shared RNG. Each 1-2 plan returns the same facts. */
export function planOpeningRound(shared: OpeningEncounterContext, roundId: string): {
  readonly context: OpeningEncounterContext; readonly facts: readonly OpeningEffectFact[];
} {
  validateOpeningEncounterContext(shared, shared.seed);
  try { getCatalogRoundById(roundId); } catch { fail('invalid-opening-effect'); }
  return {context: shared, facts: roundId === '1-2' ? openingFacts(shared) : []};
}
/** Called once after admission/binding, before the first preparation is exposed. */
export function applyOpeningEffects(state: MatchState, facts: readonly OpeningEffectFact[], shared?: OpeningEncounterContext): MatchCommandResult {
  try {
    const context = boundContext(state, shared), opening = state.openingEncounter;
    if (opening.mode === 'shared-deferred') fail('opening-context-mismatch');
    const expected = effectReceipts(context, state.sharedPool?.seatId ?? 'solo');
    if (!same(facts, []) && !same(facts, openingFacts(context))) fail('invalid-opening-effect');
    if (same(opening.receipts, expected)) {
      validateOpeningForges(state);
      return {ok: true, state, events: []};
    }
    if (!same(opening.receipts, []) || state.seatMechanics?.receipts.some(r => r.source === 'opening-encounter'
      || r.receiptId.startsWith('["opening-receipt",'))) fail('opening-context-mismatch');
    if (!same(facts, openingFacts(context)) || state.roundDefinitionId !== '1-2' || state.round !== 1
      || state.phase !== 'preparation' || state.pendingChoice || state.roundResults.length) fail('invalid-opening-effect');
    const applied = openOpeningForge({...state, openingEncounter: {...opening, receipts: expected}});
    let eventSeq = state.nextMatchEventSeq;
    const raw: import('./match-types').MatchEvent[] = [...expected.map(receipt => ({type: 'openingEffectApplied' as const, receipt})), ...applied.events];
    const events = raw.map(event => 'tick' in event ? event : ({...event, domain: 'match' as const, eventSeq: eventSeq++}));
    return {ok: true, state: {...applied.state, nextMatchEventSeq: eventSeq}, events};
  } catch (error) {
    return {ok: false, state, reason: error instanceof OpeningEncounterError ? error.reason : 'opening-context-mismatch'};
  }
}
export function openingEncounterId(state: Pick<MatchState, 'openingEncounter'>): OpeningEncounterId | null {
  const opening = state.openingEncounter;
  return opening.mode === 'shared-deferred' ? null : opening.mode === 'solo'
    ? opening.context.selection.encounterId : opening.selection.encounterId;
}
function forgeReceipts(state: MatchState): readonly OpeningEffectReceipt[] {
  const id = openingEncounterId(state), opening = state.openingEncounter;
  return (id === 'component-anvils' || id === 'artifact-anvil') && opening.mode !== 'shared-deferred' ? opening.receipts : [];
}
export function pendingOpeningForges(state: MatchState): readonly OpeningEffectReceipt[] {
  return forgeReceipts(state).filter(r => !state.seatMechanics?.receipts.some(m => m.receiptId === r.receiptId));
}
/** Stateless independent substream; recomputed only to authenticate offers, never advances legacy streams. */
export function openingForgeOffers(state: MatchState, receiptId: string): readonly string[] {
  const receipts = forgeReceipts(state), index = receipts.findIndex(r => r.receiptId === receiptId);
  if (index < 0) fail('invalid-opening-effect');
  const pool = [...resolveG24ForgePool(openingEncounterId(state) === 'component-anvils'
    ? 'TFT_ArmoryKeyComponent' : 'TFT_ArmoryKeyOrnn')].sort();
  const name = `opening-encounter-v1/seat/${state.sharedPool?.seatId ?? 'solo'}/anvil/${index}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 0x01000193) >>> 0;
  let rng = (state.augmentTierSeed ^ hash) >>> 0;
  if (pool.length < G24_FORGE_POLICY.choices) fail('opening-config-incomplete');
  for (let i = 0; i < G24_FORGE_POLICY.choices; i++) {
    const draw = nextRandom(rng); rng = draw.state;
    const j = i + draw.word % (pool.length - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, G24_FORGE_POLICY.choices);
}
export function openOpeningForge(state: MatchState): {state: MatchState; events: readonly import('./match-types').MatchEvent[]} {
  if (state.pendingChoice || state.phase !== 'preparation' || state.multiplayer?.status === 'eliminated') return {state, events: []};
  const receipt = pendingOpeningForges(state)[0];
  if (!receipt) return {state, events: []};
  const offers = openingForgeOffers(state, receipt.receiptId);
  const opened = openMechanicChoice(state, {choiceId: receipt.receiptId, offers, returnPhase: 'preparation',
    payload: {kind: 'forge', source: 'opening-encounter', timeoutOption: offers[0]}});
  if (!opened.ok) fail('invalid-opening-effect');
  return opened;
}
/** Bind every choice/grant to its independent effect receipt; forbid reordering and tampered timeout outcomes. */
export function validateOpeningForges(state: MatchState): void {
  const check = (ok: unknown) => {if (!ok) fail('opening-context-mismatch');};
  const receipts = forgeReceipts(state);
  const resolved = (state.seatMechanics?.receipts ?? []).filter(r => r.source === 'opening-encounter'
    || r.receiptId.startsWith('["opening-receipt",'));
  check(resolved.length <= receipts.length);
  resolved.forEach((r, index) => {
    check(r.receiptId === receipts[index]?.receiptId);
    const offers = openingForgeOffers(state, r.receiptId);
    check(r.source === 'opening-encounter' && r.round === 1 && r.roundId === '1-2'
      && r.kind === 'choice' && r.choiceKind === 'forge' && r.skipped === false && r.price === 0
      && typeof r.itemId === 'string' && typeof r.timedOut === 'boolean'
      && offers.includes(r.optionId) && (!r.timedOut || r.optionId === offers[0]));
    if (r.kind === 'choice') check(state.resourceProvenance.entries.some(e => e.kind === 'item-acquired'
      && e.itemId === r.itemId && e.source.kind === 'mechanic' && e.source.receiptId === r.receiptId));
  });
  const choice = state.pendingChoice;
  const remaining = receipts.slice(resolved.length);
  if (choice?.payload?.source === 'opening-encounter' || choice?.choiceId.startsWith('["opening-receipt",')) {
    check(remaining.length > 0);
    const expected = openOpeningForge({...state, phase: 'preparation', combat: null, pendingChoice: null}).state.pendingChoice;
    check(expected && same(choice, expected));
  }
  if (remaining.length && state.multiplayer?.status !== 'eliminated') {
    check(state.round === 1 && state.phase === 'choice' && choice?.choiceId === remaining[0].receiptId);
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
    statusTextZh: entry.id === 'none' ? '本局不附加奇遇规则' : entry.enabled ? '本局奇遇效果已启用' : '本局抽中此奇遇，效果尚未启用',
    revealedFacts: [] as readonly OpeningEffectFact[] });
}
export type OpeningEncounterView = ReturnType<typeof readOpeningEncounterView>;

/** Owner-only progress, never future offers or RNG. Current offers remain in pendingChoice. */
export function readOpeningEncounterProgress(state: MatchState) {
  const opening = state.openingEncounter;
  if (opening.mode === 'shared-deferred' || !opening.receipts.length) return null;
  const total = forgeReceipts(state).length, pending = pendingOpeningForges(state).length;
  return {source: 'opening-encounter' as const, effectsApplied: opening.receipts.length,
    forgesGranted: total, forgesResolved: total - pending, forgesPending: pending};
}
