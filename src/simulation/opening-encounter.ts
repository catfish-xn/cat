import { grantAnvilUnit } from './anvils';
import { batchEncounter, subscriptionFact, subscriptionReceipts, grantOpeningRewards, validateOpeningRewards, melBranch } from './opening-batch-rewards';
import { getMultiplayerRoundById } from './multiplayer-round';
import { validateBatchBRewards } from './opening-batch-b-rewards';
import { enterTrainerGolems, validateTrainerGolems } from './trainer-golems';
import { enterOpeningCrabs } from './opening-crabs';
import { MONKEY_NODE, MONKEY_ROUND, monkeyOutcome, applyMonkey, validateMonkeyGrants, type MonkeyOutcome } from './opening-monkey';
import { canonicalContent } from './content';
import { freezeContent } from './content/freeze';
import { OPENING_ENCOUNTERS, OPENING_ENCOUNTER_CONFIG, type OpeningEncounterId } from './content/opening-encounters';
import { G24_FORGE_POLICY, resolveG24ForgePool } from './content/g2-4-forges';
import type { MatchState, MatchCommandResult, RoundResult } from './match-types';
import { nextRandom, validateSeed } from './rng';

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
  readonly outcome?: MonkeyOutcome;
  readonly factId: string; readonly effectKey: string; readonly nodeId: string;
}
export interface OpeningEffectReceipt {
  readonly hpBefore?: number;
  readonly receiptId: string; readonly factId: string; readonly seatId: string; readonly nodeId: string;
}
/** Authenticated first crossing and exactly-once reward entitlement. */
export interface OpeningMelThresholdReceipt extends OpeningEffectReceipt {
  readonly kind: 'mel-threshold';
  readonly round: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
  readonly rewardStatus: 'granted';
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

/** Read-only inputs also include the public whitelist carried by client display states.
 * A projection has no context, seat binding or receipts and must never become an authority.
 */
export interface OpeningEncounterProjection {
  readonly configVersion: string;
  readonly encounterId: OpeningEncounterId;
  readonly revealedFacts?: readonly {readonly nodeId: string; readonly outcome: MonkeyOutcome}[];
}
export interface OpeningEncounterReadState {
  readonly openingEncounter?: OpeningEncounterState | OpeningEncounterProjection | null;
}
/** Missing authority fields are unavailable, never re-derived from a display state's placeholder seed. */
export function readOpeningSelection(state: OpeningEncounterReadState): OpeningEncounterSelection | null {
  const opening = state.openingEncounter;
  if (!opening || !('mode' in opening)) return null;
  switch (opening.mode) {
    case 'solo': return opening.context?.selection ?? null;
    case 'shared': return opening.selection ?? null;
    case 'shared-deferred': return null;
    default: return null;
  }
}

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
  const initial = createOpeningEncounter(seed);
  if (same(input, initial)) return;
  if (initial.selection.encounterId === 'wind-up-monkey' && same(input, {...initial, facts: openingFacts(initial)})) return;
  fail('opening-context-mismatch');
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
  if (entry.id === 'wind-up-monkey') {
    const outcome = monkeyOutcome(context.seed), effectKey = `monkey/${outcome}`;
    return [{factId: JSON.stringify(['opening-effect', context.selection.configVersion, openingInstanceId(context.seed),
      entry.id, effectKey, MONKEY_NODE]), effectKey, nodeId: MONKEY_NODE, outcome}];
  }
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
    || !same(opening, {mode:'solo', context:opening.context, receipts:opening.receipts})) fail('opening-context-mismatch');
  validateOpeningEncounterContext(opening.context, state.seed);
  return opening.context;
}
function effectReceipts(context: OpeningEncounterContext, seatId: string): OpeningEffectReceipt[] {
  return openingFacts(context).map(f => ({receiptId: JSON.stringify(['opening-receipt', f.factId, seatId]),
    factId: f.factId, seatId, nodeId: f.nodeId}));
}
export function validateOpeningEncounterState(state: MatchState, shared?: OpeningEncounterContext): void {
  const context = boundContext(state, shared), opening = state.openingEncounter;
  if (opening.mode === 'shared-deferred') fail('opening-context-mismatch');
  const monkey = context.selection.encounterId === 'wind-up-monkey';
  const due = !monkey || state.round >= MONKEY_ROUND;
  // Seats eliminated earlier retain their empty personal receipt even after the global fact is revealed.
  const earlierDeath = monkey && state.round < MONKEY_ROUND && state.multiplayer?.status === 'eliminated';
  if (monkey && !earlierDeath && Boolean(context.facts.length) !== due) fail('opening-context-mismatch');
  const expected = batchEncounter(context.selection.encounterId) ? subscriptionReceipts(state) : due ? effectReceipts(context, state.sharedPool?.seatId ?? 'solo') : [];
  if (monkey && expected.length && opening.receipts[0]?.hpBefore !== undefined && monkeyOutcome(context.seed) === 'damage')
    expected[0] = {...expected[0], hpBefore: opening.receipts[0].hpBefore};
  // Authenticate the complete ledger, including observations; never filter away foreign receipts.
  if (!same(opening.receipts, [...expected, ...expectedMelThresholdReceipts(state)])) fail('opening-context-mismatch');
  validateOpeningRewards(state);
  validateTrainerGolems(state);
  validateBatchBRewards(state);
  validateOpeningForges(state);
  validateMonkeyGrants(state, monkey ? context.facts[0] : undefined);
}
/** Reveal the one global monkey fact only at 3-5; retries reuse the frozen fact. */
export function planOpeningRound(shared: OpeningEncounterContext, roundId: string): {
  readonly context: OpeningEncounterContext; readonly facts: readonly OpeningEffectFact[];
} {
  validateOpeningEncounterContext(shared, shared.seed);
  try { getMultiplayerRoundById(roundId); } catch { fail('invalid-opening-effect'); }
  const subscription=subscriptionFact(shared.seed,shared.selection.encounterId,getMultiplayerRoundById(roundId).ordinal);
  if(subscription)return {context:shared,facts:[subscription]};
  const facts = openingFacts(shared).filter(f => f.nodeId === roundId);
  const context = roundId === MONKEY_NODE && facts.length && !shared.facts.length ? freezeContent({...shared, facts}) : shared;
  return {context, facts};
}
/** Admission/round-entry hook. Failure returns the original state; a receipted retry is inert. */
export function applyOpeningEffects(state: MatchState, facts: readonly OpeningEffectFact[], shared?: OpeningEncounterContext): MatchCommandResult {
  const originalState=state;
  try {
    const context = boundContext(state, shared), opening = state.openingEncounter;
    if (opening.mode === 'shared-deferred') fail('opening-context-mismatch');
    if (batchEncounter(context.selection.encounterId)) {
      const expected=subscriptionReceipts(state), due=subscriptionFact(context.seed,context.selection.encounterId,state.round);
      if(!same(facts,due?[due]:[]))fail('invalid-opening-effect');
      if(same(opening.receipts,[...expected,...expectedMelThresholdReceipts(state)])){
        validateOpeningEncounterState(state,shared);return {ok:true,state,events:[]};
      }
      if(!due||!same(opening.receipts,expected.slice(0,-1))||state.phase!=='preparation'||state.pendingChoice
        ||state.playerHp<=0||state.multiplayer?.status==='eliminated')fail('invalid-opening-effect');
      validateOpeningRewards(state);
      const receipt=expected.at(-1)!;
      const applied=grantOpeningRewards({...state,openingEncounter:{...opening,receipts:expected}});
      validateOpeningEncounterState(applied.state,shared);
      const raw:import('./match-types').MatchEvent[]=[{type:'openingEffectApplied',receipt},
        {type:'openingRewardResolved',receiptId:receipt.receiptId,encounterId:context.selection.encounterId,
          outcome:due.effectKey,nodeId:due.nodeId},...applied.events];
      let seq=state.nextMatchEventSeq;
      const events=raw.map(e=>'tick' in e?e:{...e,domain:'match' as const,eventSeq:seq++});
      return {ok:true,state:{...applied.state,nextMatchEventSeq:seq},events};
    }
    const allFacts = openingFacts(context), monkey = context.selection.encounterId === 'wind-up-monkey';
    if (!same(facts, []) && !same(facts, allFacts)) fail('invalid-opening-effect');
    const batch=enterTrainerGolems(enterOpeningCrabs(state));
    if(batch.state!==state){const original=state;state=batch.state;validateOpeningEncounterState(state,shared);let seq=original.nextMatchEventSeq;const events=batch.events.map(e=>'tick' in e?e:{...e,domain:'match' as const,eventSeq:seq++});return {ok:true,state:{...state,nextMatchEventSeq:seq},events};}
    const expected = effectReceipts(context, state.sharedPool?.seatId ?? 'solo');
    if (opening.receipts.length || !expected.length) {
      validateOpeningEncounterState(state, shared);
      return {ok: true, state, events: []};
    }
    if (!facts.length) {
      if (monkey && state.round < MONKEY_ROUND) {
        validateOpeningEncounterState(state, shared);
        return {ok: true, state, events: []};
      }
      fail('invalid-opening-effect');
    }
    const node = monkey ? MONKEY_NODE : '1-2', ordinal = monkey ? MONKEY_ROUND : 1;
    if (!same(facts, allFacts) || state.roundDefinitionId !== node || state.round !== ordinal
      || state.phase !== 'preparation' || state.pendingChoice || state.playerHp <= 0
      || state.multiplayer?.status === 'eliminated' || state.roundResults.length !== ordinal - 1) fail('invalid-opening-effect');
    if (state.seatMechanics?.receipts.some(r => r.source === 'opening-encounter-monkey' || r.receiptId.includes('wind-up-monkey')))
      fail('opening-context-mismatch');
    if (monkey && state.sharedPool && !same(context.facts, facts)) fail('opening-context-mismatch');
    if (monkey && facts[0].outcome === 'damage') expected[0] = {...expected[0], hpBefore: state.playerHp};
    const nextOpening = opening.mode === 'solo' && monkey
      ? {...opening, context: {...context, facts}, receipts: expected} : {...opening, receipts: expected};
    const staged = {...state, openingEncounter: nextOpening};
    const applied = monkey ? applyMonkey(staged, facts[0], expected[0]) : openOpeningForge(staged);
    validateOpeningEncounterState(applied.state, shared);
    let eventSeq = state.nextMatchEventSeq;
    const raw: import('./match-types').MatchEvent[] = [...expected.map(receipt => ({type: 'openingEffectApplied' as const, receipt})), ...applied.events];
    const events = raw.map(event => 'tick' in event ? event : ({...event, domain: 'match' as const, eventSeq: eventSeq++}));
    if (!Number.isSafeInteger(eventSeq)) fail('invalid-opening-effect');
    return {ok: true, state: {...applied.state, nextMatchEventSeq: eventSeq}, events};
  } catch (error) {
    return {ok: false, state:originalState, reason: error instanceof OpeningEncounterError ? error.reason : 'opening-context-mismatch'};
  }
}
/** Also used by the temporary unbound shared-seat advance, before scheduled choices. */
export function applyOpeningRoundEntry(state:MatchState):MatchCommandResult {
  const o=state.openingEncounter;
  if(o.mode==='shared-deferred'||o.mode==='shared'&&!['gold-subscription','loot-subscription'].includes(o.selection.encounterId))return {ok:true,state,events:[]};
  const context=o.mode==='solo'?o.context:createOpeningEncounter(state.augmentTierSeed);
  const binding=o.mode==='shared'?state.sharedPool??{poolId:o.poolId,seatId:o.seatId,revision:0}:undefined;
  const result=applyOpeningEffects(binding?{...state,sharedPool:binding}:state,planOpeningRound(context,state.roundDefinitionId).facts,binding?context:undefined);
  if(!result.ok)return {...result,state};
  if(binding&&!state.sharedPool){const {sharedPool:_binding,...unbound}=result.state;return {...result,state:unbound};}
  return result;
}
export function openingEncounterId(state: OpeningEncounterReadState): OpeningEncounterId | null {
  const opening = state.openingEncounter;
  return opening && !('mode' in opening) ? opening.encounterId ?? null : readOpeningSelection(state)?.encounterId ?? null;
}
function forgeReceipts(state: MatchState): readonly OpeningEffectReceipt[] {
  const id = openingEncounterId(state), opening = state.openingEncounter;
  return (id === 'component-anvils' || id === 'artifact-anvil') && opening && 'mode' in opening && opening.mode !== 'shared-deferred' ? opening.receipts ?? [] : [];
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
export function openOpeningForge(state:MatchState):{state:MatchState;events:readonly import('./match-types').MatchEvent[]} {
  if(state.multiplayer?.status==='eliminated')return {state,events:[]};
  const events:import('./match-types').MatchEvent[]=[];
  for(const r of pendingOpeningForges(state)){
    const grant=grantAnvilUnit(state,{receiptId:r.receiptId,source:'opening-encounter',definitionId:openingEncounterId(state)==='component-anvils'?'TFT_ArmoryKeyComponent':'TFT_ArmoryKeyOrnn'});
    if(!grant.ok){if(grant.reason==='bench-full')break;fail('invalid-opening-effect');}
    else {state=grant.state;events.push(...grant.events);}
  }
  return {state,events};
}
export function validateOpeningForges(state:MatchState):void {
  const receipts=forgeReceipts(state);
  for(const r of state.seatMechanics?.receipts??[])if(r.source==='opening-encounter'){
    if(!receipts.some(e=>e.receiptId===r.receiptId)||r.kind!=='unit'||r.resolution!=='held'||r.gold!==0||r.round<1||r.round>state.round
      ||r.definitionId!==(openingEncounterId(state)==='component-anvils'?'TFT_ArmoryKeyComponent':'TFT_ArmoryKeyOrnn'))fail('opening-context-mismatch');
  }
}
/** Public whitelist. Never spread a context: seed, RNG and unrevealed facts stay private. */
export function readOpeningEncounterView(state: OpeningEncounterReadState, shared?: OpeningEncounterContext) {
  const opening = state.openingEncounter;
  const projected = opening && !('mode' in opening) ? opening : null;
  const selection = projected ? {configVersion: projected.configVersion, encounterId: projected.encounterId} : readOpeningSelection(state);
  if (!selection) return null;
  const entry = OPENING_ENCOUNTERS.find(entry => entry.id === selection.encounterId);
  if (!entry || selection.configVersion !== OPENING_ENCOUNTER_CONFIG.version) fail('opening-context-mismatch');
  if (shared) {
    validateOpeningEncounterContext(shared, shared.seed);
    if (!same(selection, shared.selection)) fail('opening-context-mismatch');
  }
  const revealed = opening && 'mode' in opening && opening.mode === 'solo' ? opening.context?.facts : shared?.facts;
  const receipts = opening && 'mode' in opening && opening.mode !== 'shared-deferred' ? opening.receipts ?? [] : [];
  return freezeContent({ configVersion: selection.configVersion, encounterId: entry.id,
    sourceEncounterId: entry.encounterId, portalId: entry.portalId, champion: entry.champion,
    nameZh: entry.nameZh, nameEn: entry.nameEn, enabled: entry.enabled, effectStatus: entry.effectStatus,
    readiness: entry.readiness, descriptionZh: entry.descriptionZh,
    statusTextZh: entry.id === 'none' ? '本局不附加奇遇规则' : entry.enabled ? '本局奇遇效果已启用' : '本局抽中此奇遇，效果尚未启用',
    revealedFacts: projected?.revealedFacts ? projected.revealedFacts.map(f => ({nodeId: f.nodeId, outcome: f.outcome})) : revealed?.length ? revealed.map(f => ({nodeId:f.nodeId,outcome:f.outcome!}))
      : (entry.id === 'wind-up-monkey' && receipts.length
        ? [{nodeId: MONKEY_NODE, outcome: JSON.parse(receipts[0].factId)[4].slice(7) as MonkeyOutcome}] : []) });
}
export type OpeningEncounterView = ReturnType<typeof readOpeningEncounterView>;

/** Approved project convention, applied to HP AFTER the six-cost Mel save. */
export function isMelBlessingCrossing(oldHp: number, newHp: number): boolean {
  if (![oldHp, newHp].every(hp => Number.isSafeInteger(hp) && hp >= 0 && hp <= 100))
    throw new RangeError('Invalid opening encounter HP');
  const threshold = OPENING_ENCOUNTER_CONFIG.melThreshold.hp;
  return oldHp > threshold && newHp > 0 && newHp <= threshold;
}
function expectedMelThresholdReceipts(state: MatchState): readonly OpeningMelThresholdReceipt[] {
  const opening = state.openingEncounter;
  if (opening.mode === 'shared-deferred') return [];
  const selection = opening.mode === 'solo' ? opening.context.selection : opening.selection;
  if (selection.encounterId !== 'mels-blessing') return [];
  const first = state.roundResults.find(record => isMelBlessingCrossing(record.hpBefore, record.hpAfter));
  if (!first) return [];
  const instanceId = opening.mode === 'solo' ? JSON.stringify(['solo', state.seed]) : JSON.stringify(['shared', opening.poolId]);
  const seatId = opening.mode === 'solo' ? 'solo' : opening.seatId;
  const nodeId = first.settlementId;
  const factId = JSON.stringify([instanceId, 'mel-threshold', seatId, nodeId]);
  return [{kind: 'mel-threshold', receiptId: factId, factId, seatId, nodeId,
    round: first.round, hpBefore: first.hpBefore, hpAfter: first.hpAfter, rewardStatus: 'granted'}];
}
/** Settlement hook after commitMelSave; authenticate history before granting once. */
export function commitOpeningEncounterHealth(state: MatchState, events: import('./match-types').MatchEvent[] = []): MatchState {
  const opening = state.openingEncounter;
  if (openingEncounterId(state) !== 'mels-blessing' || opening.mode === 'shared-deferred') return state;
  const expected = expectedMelThresholdReceipts(state);
  if (same(opening.receipts, expected)) return state;
  const latest: RoundResult | undefined = state.roundResults.at(-1);
  if (!same(opening.receipts, []) || expected.length !== 1 || !latest
    || expected[0].nodeId !== latest.settlementId || expected[0].round !== state.round
    || latest.hpAfter !== state.playerHp || state.multiplayer?.status === 'eliminated') fail('opening-context-mismatch');
  const next: MatchState = {...state, openingEncounter: {...opening, receipts: freezeContent(expected)}};
  const applied=grantOpeningRewards(next);
  events.push({type:'openingEffectApplied',receipt:expected[0]},
    {type:'openingRewardResolved',receiptId:expected[0].receiptId,encounterId:'mels-blessing',outcome:`Blessing_High_${melBranch(state.augmentTierSeed)}`,nodeId:expected[0].nodeId});
  validateOpeningEncounterState(applied.state, state.sharedPool ? createOpeningEncounter(state.augmentTierSeed) : undefined);
  return applied.state;
}
/** Owner-only progress whitelist. Do not put this into public PlayerView. */
export function readOpeningMelProgress(state: OpeningEncounterReadState) {
  const opening = state.openingEncounter;
  if (!opening || !('mode' in opening) || opening.mode === 'shared-deferred') return null;
  if (readOpeningSelection(state)?.encounterId !== 'mels-blessing' || !opening.receipts) return null;
  const receipt = opening.receipts[0] as OpeningMelThresholdReceipt | undefined;
  return freezeContent({encounterId: 'mels-blessing' as const, thresholdHp: OPENING_ENCOUNTER_CONFIG.melThreshold.hp,
    thresholdReached: receipt !== undefined, rewardStatus: receipt ? 'granted' as const : 'waiting-threshold' as const,
    triggeredRound: receipt?.round ?? null, hpBefore: receipt?.hpBefore ?? null, hpAfter: receipt?.hpAfter ?? null});
}
export type OpeningMelProgress = ReturnType<typeof readOpeningMelProgress>;
/** Compatibility input for authentic settled-kill retries; never a client reward command. */
export interface OpeningWarwickKillFact {
  readonly battleId: string;
  readonly eventSeq: number;
  readonly victimId: string;
  readonly victimKind: 'champion' | 'summon' | 'monster';
  readonly settlementEligible: boolean;
}
/** External kill claims are never trusted. Settlement owns rewards; retries must match its facts. */
export function applyWarwickHunger(state:MatchState,facts:readonly OpeningWarwickKillFact[],shared?:OpeningEncounterContext):MatchCommandResult {
 try{validateOpeningEncounterState(state,shared);
  if(openingEncounterId(state)!=='warwicks-hunger')fail('invalid-opening-effect');
  const history=(state.seatMechanics?.hidden.progress as {economyReceipts?:readonly {kind:string;facts?:{battleId:string;roundKind:string;openingDeaths?:readonly {victimId:string;eventSeq:number}[]}}[]}|undefined)?.economyReceipts??[];
  if(facts.some(f=>!f.settlementEligible||f.victimKind!=='champion'||!history.some(r=>r.kind==='battle'&&r.facts?.roundKind==='pvp'&&r.facts.battleId===f.battleId&&r.facts.openingDeaths?.some(d=>d.victimId===f.victimId&&d.eventSeq===f.eventSeq))))fail('invalid-opening-effect');
  return {ok:true,state,events:[]};
 }catch(e){return {ok:false,state,reason:e instanceof OpeningEncounterError?e.reason:'opening-context-mismatch'};}
}
/** Owner-only progress, never future offers or RNG. Current offers remain in pendingChoice. */
export function readOpeningForgeProgress(state: MatchState) {
  const opening = state.openingEncounter;
  if (!opening || !('mode' in opening) || opening.mode === 'shared-deferred' || !forgeReceipts(state).length) return null;
  const total=forgeReceipts(state).length;
  const granted=(state.seatMechanics?.receipts??[]).filter(r=>r.source==='opening-encounter'&&r.kind==='unit');
  const resolved=granted.filter(r=>r.kind==='unit'&&state.seatMechanics?.receipts.some(c=>c.receiptId===JSON.stringify(['anvil',r.unitId]))).length;
  const pending=total-resolved;
  return {source: 'opening-encounter' as const, effectsApplied: opening.receipts.length,
    forgesGranted: total, forgesResolved: total - pending, forgesPending: pending};
}

export type OpeningForgeProgress = ReturnType<typeof readOpeningForgeProgress>;
