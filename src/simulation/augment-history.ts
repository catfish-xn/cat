import { recordR2PortableBattle } from './augment-pool-batch5-r2-history';
import { settleNoScoutGrowth } from './augment-pool-batch5-h3';
import { drainSurvivorGold } from './augment-pool-batch5-h4-survivor';
import { grantScoreboardEntry } from './augment-pool-batch5-h6-scoreboard';
import { drainBatch5H7Gold } from './augment-pool-batch5-h7';
import { drainBatch5H8Deaths } from './augment-pool-batch5-h8-deaths';
import { drainBatch5H8Gold } from './augment-pool-batch5-h8';
import { completeTraitTrackerCommand } from './augment-pool-batch5-h10-tracker';
import { maxCapOfferNeedsHistory } from './augment-pool-batch5-h12-progression';
import { settleBatch5H9History } from './augment-pool-batch5-h9';
import type { MatchState, MatchEvent } from './match-types';
import type { AugmentFactData, AugmentHistoryFact, AugmentGrowth, HistoryCommand, HistoryRoster, HistorySeat, PreviousAugmentBattle } from './augment-history-types';
import { AUGMENT_HISTORY_VERSION, AUGMENT_HISTORY_LIMITS as LIMIT } from './augment-history-types';
import { augmentNeedsHistory, AUGMENT_HISTORY_OWNERS } from './augment-history-owners';
import { freezeContent } from './content/freeze';
import { canonicalContent } from './content';
import { UNIT_DEFINITIONS } from './units';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { augmentDeathsFromEvents, readAugmentCombatDeaths } from './augment-death-samples';
import { shopGlitchRefreshes } from './augment-pool-batch5-h1';
import { drawSoloAugmentShop, recordShopReroll } from './shop-augments';
import { sixCostShopContext } from './six-cost-shop';

export function historyCheck(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new RangeError(`Invalid augment history: ${reason}`);
}
const same = (a: unknown, b: unknown) => canonicalContent(a) === canonicalContent(b);
export const historySeatId = (s: MatchState): string => s.multiplayer?.seatId ?? 'solo';
export const needsAugmentHistory = (s: MatchState): boolean => s.augments.some(a => augmentNeedsHistory(a.definitionId)) || maxCapOfferNeedsHistory(s);
export const needsAugmentPreparationClock = (s: MatchState): boolean => s.augments.some(a => AUGMENT_HISTORY_OWNERS[a.definitionId]?.includes('preparation-time'));
export function historyRoster(s: Pick<MatchState, 'preparation' | 'items'>): HistoryRoster {
  return structuredClone({ units: s.preparation.units.filter(u => u.team === 'player'), items: s.items });
}
export function appendAugmentFact(s: MatchState, fact: AugmentFactData): MatchState {
  if (!s.augmentHistory) { historyCheck(!needsAugmentHistory(s), 'missing augment-history-v1; history-dependent augment saves cannot be authenticated'); return s; }
  historyCheck(s.augmentHistory.facts.length < LIMIT.facts && s.round <= LIMIT.rounds, 'recording bounds');
  const row: AugmentHistoryFact = { ...structuredClone(fact), sequence: s.augmentHistory.facts.length,
    seatId: historySeatId(s), round: s.round, roundId: getMultiplayerRoundByOrdinal(s.round).roundId,
    resourcePrefix: s.resourceProvenance.entries.length };
  return { ...s, augmentHistory: { ...s.augmentHistory, facts: [...s.augmentHistory.facts, row] } };
}
export function recordAugmentRoundEntry(s: MatchState): MatchState {
  return appendAugmentFact(s, { kind: 'round-entry', roster: historyRoster(s) });
}

/** Portable Anomaly owns its own kill journal. Original Headhunter history is never inherited. */
export function recordAugmentCopyKills(s:MatchState,fact:Extract<AugmentFactData,{kind:'anomaly-copy-kills'}>):MatchState {
  historyCheck(s.augments.some(a=>a.definitionId==='another-anomaly')&&s.augmentHistory,'anomaly copy owner');
  const old=readAugmentFacts(s,'anomaly-copy-kills').find(f=>f.battleId===fact.battleId&&f.itemId===fact.itemId);
  if(old){historyCheck(same({battleId:fact.battleId,itemId:fact.itemId,unitId:fact.unitId,kills:fact.kills},{battleId:old.battleId,itemId:old.itemId,unitId:old.unitId,kills:old.kills}),'anomaly copy conflict');return s;}
  historyCheck(fact.kills.length<=LIMIT.deaths&&new Set(fact.kills.map(k=>k.eventSeq)).size===fact.kills.length
    &&fact.kills.every(k=>Number.isSafeInteger(k.eventSeq)&&k.eventSeq>=0&&typeof k.victimId==='string'),'anomaly copy kills');
  return appendAugmentFact(s,fact);
}
export function readAugmentCopyKills(s:MatchState,itemId:string,beforeRound=s.round):number {
  return readAugmentFacts(s,'anomaly-copy-kills').filter(f=>f.itemId===itemId&&f.round<beforeRound).reduce((n,f)=>n+f.kills.length,0);
}
export function recordAugmentTable(s: MatchState, stage: 'acquire' | 'entry' | 'settlement', seats: readonly HistorySeat[]): MatchState {
  let recorded = appendAugmentFact(s, { kind: 'table', stage, seats });
  if (recorded.augments.some(a=>a.definitionId==='survivor')) recorded = drainSurvivorGold(recorded);
  return stage==='entry'?grantScoreboardEntry(recorded):recorded;
}
export function recordAugmentPvpRoster(s: MatchState, battleId: string, seats: readonly HistorySeat[], mirrorOfSeatId: string | null): MatchState {
  if (s.augmentHistory?.facts.some(f => f.kind === 'pvp-roster' && f.battleId === battleId)) return s;
  const recorded = appendAugmentFact(s, { kind: 'pvp-roster', battleId, seats, mirrorOfSeatId });
  return s.augments.some(a => a.definitionId === 'a-golden-find') && !recorded.augmentHistory?.facts.some(f => f.kind === 'combat-binding' && f.battleId === battleId)
    ? appendAugmentFact(recorded, { kind: 'combat-binding', battleId, binding: s.anomalyBinding }) : recorded;
}
/** Internal domain hook, called in the same successful transaction as the future augment's effect.
 * It records integer amounts; it does not select recipients or invent a growth formula. */
export function recordAugmentGrowth(s: MatchState, choiceId: string, receiptId: string, deltas: readonly AugmentGrowth[]): MatchState {
  historyCheck(s.augmentHistory && s.augments.some(a => a.choiceId === choiceId && augmentNeedsHistory(a.definitionId)), 'growth owner');
  historyCheck(typeof receiptId === 'string' && receiptId.length > 0 && receiptId.length <= 256, 'growth receipt');
  const old = s.augmentHistory.facts.find(f => f.kind === 'growth' && f.receiptId === receiptId);
  if (old) { historyCheck(old.kind === 'growth' && same(old.deltas, deltas) && old.choiceId === choiceId, 'growth receipt conflict'); return s; }
  historyCheck(deltas.length <= LIMIT.units && new Set(deltas.map(d => d.unitId)).size === deltas.length, 'growth recipients');
  for (const d of deltas) {
    const owner = s.augments.find(a=>a.choiceId===choiceId);
    const entry = owner?.definitionId==='scoreboard-scrapper' ? s.augmentHistory!.facts.find(f=>f.kind==='round-entry' && f.round===s.round) : undefined;
    const unit = s.preparation.units.find(u => u.id === d.unitId && u.team === 'player') ?? (entry?.kind==='round-entry'?entry.roster.units.find(u=>u.id===d.unitId&&u.team==='player'):undefined);
    historyCheck(unit && UNIT_DEFINITIONS[unit.definitionId] && !UNIT_DEFINITIONS[unit.definitionId].summon && UNIT_DEFINITIONS[unit.definitionId].unitKind !== 'neutral', 'growth ordinary hero');
    historyCheck(same(Object.keys(d).sort(), ['abilityPowerCenti','attackDamageBps','healthBps','healthFlat','unitId']) &&
      Object.entries(d).every(([k,v]) => k === 'unitId' || Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 1000000), 'growth amount');
  }
  return appendAugmentFact(s, { kind: 'growth', choiceId, receiptId, deltas });
}
/** No implicit zero for an absent history or absent round boundary. */
export function readAugmentFacts<K extends AugmentFactData['kind']>(s: MatchState, kind: K): readonly Extract<AugmentHistoryFact, {kind: K}>[] {
  historyCheck(s.augmentHistory, 'missing augment-history-v1; history-dependent augment saves cannot be authenticated');
  return structuredClone(s.augmentHistory.facts.filter(f => f.kind === kind)) as Extract<AugmentHistoryFact, {kind: K}>[];
}
/** Detached lookup for optional receipts or in-progress boundaries. An empty lookup never proves a completed battle. */
export function findAugmentFacts<K extends AugmentFactData['kind']>(s: MatchState, kind: K, round: number): readonly Extract<AugmentHistoryFact, {kind: K}>[] {
  historyCheck(s.augmentHistory, 'missing augment-history-v1; history-dependent augment saves cannot be authenticated');
  const rows = s.augmentHistory.facts.filter(f => f.kind === kind && f.round === round) as Extract<AugmentHistoryFact, {kind: K}>[];
  return structuredClone(rows);
}
/** No implicit zero for an absent history or absent round boundary. */
export function requireAugmentFacts<K extends AugmentFactData['kind']>(s: MatchState, kind: K, round: number): readonly Extract<AugmentHistoryFact, {kind: K}>[] {
  const rows = findAugmentFacts(s, kind, round);
  historyCheck(rows.length > 0, `missing ${kind} for round ${round}`); return rows;
}
/** Health receipts are sparse: no row means no health change, not missing combat evidence.
 * The enclosing section is still mandatory and authenticated by the normal restore boundary. */
export function readAugmentPlayerHealth(s: MatchState): readonly Extract<AugmentHistoryFact, {kind: 'player-health'}>[] {
  historyCheck(s.augmentHistory, 'missing player health history');
  return structuredClone(s.augmentHistory.facts.filter(f => f.kind === 'player-health'));
}
export function readAugmentGrowth(s: MatchState, unitId: string, provenancePrefixLength = s.resourceProvenance.entries.length): AugmentGrowth {
  historyCheck(Number.isSafeInteger(provenancePrefixLength)&&provenancePrefixLength>=0&&provenancePrefixLength<=s.resourceProvenance.entries.length, 'growth provenance prefix');
  historyCheck(s.augmentHistory, 'missing growth history');
  // Follow the existing acquisition/merge lineage; never transfer a sold unit to an unrelated instance.
  const ids = new Set([unitId]);
  for (const e of s.resourceProvenance.entries.slice(0,provenancePrefixLength).reverse()) {
    const upgrades = e.kind === 'unit-upgraded' || e.kind === 'unit-upgraded-after-combat' ? [e.event]
      : e.kind === 'carousel-preparation-settled' || e.kind === 'carousel-unit-claimed' ? e.upgrades : [];
    // One carousel transaction can merge 1 -> 2 -> 3 stars. Discover the consumed
    // intermediate survivor before following its own earlier merge.
    for (let i = upgrades.length - 1; i >= 0; i--) if (ids.has(upgrades[i].survivorId))
      for (const id of upgrades[i].consumedIds) ids.add(id);
  }
  const result: { -readonly [K in keyof AugmentGrowth]: AugmentGrowth[K] } = { unitId, healthFlat: 0, healthBps: 0, attackDamageBps: 0, abilityPowerCenti: 0 };
  for (const f of s.augmentHistory.facts) if (f.kind === 'growth') for (const d of f.deltas) if (ids.has(d.unitId))
    for (const k of ['healthFlat','healthBps','attackDamageBps','abilityPowerCenti'] as const) { result[k] += d[k]; historyCheck(Number.isSafeInteger(result[k]), 'growth overflow'); }
  return result;
}

// Preparation clocks are not combat ticks or wall time. The caller supplies a monotone, integer logical elapsed time.
export function advanceAugmentPreparationTime(s: MatchState, elapsedMs: number, sharedRefresh?: (state: MatchState) => MatchState): MatchState {
  return traceHistoryCommand('advanceAugmentPreparationTime', [s, elapsedMs], () => {
    historyCheck(s.phase === 'preparation' || s.phase === 'choice' && s.pendingChoice?.returnPhase === 'preparation', 'preparation clock phase');
    historyCheck(Number.isSafeInteger(elapsedMs) && elapsedMs >= 0 && elapsedMs <= LIMIT.preparationMs, 'preparation clock bounds');
    const last = s.augmentHistory?.facts.filter(f => f.kind === 'preparation-time' && f.round === s.round).at(-1);
    const previous = last?.kind === 'preparation-time' ? last.elapsedMs : preparationElapsed(s);
    historyCheck(elapsedMs >= previous, 'preparation clock regression');
    if(elapsedMs===previous)return s;
    const refreshes = shopGlitchRefreshes(s, previous, elapsedMs);
    historyCheck(!s.sharedPool || !refreshes || sharedRefresh, 'shared shop refresh requires pool transaction');
    let next: MatchState = s;
    for (let i = 0; i < refreshes; i++) {
      const before: MatchState = next;
      const rolled = recordShopReroll(before);
      next = sharedRefresh ? sharedRefresh(rolled)
        : drawSoloAugmentShop(rolled, sixCostShopContext(rolled), false, 'shop-glitch', before);
    }
    next = next.augmentHistory ? appendAugmentFact(next,{kind:'preparation-time',elapsedMs}) : {...next};
    preparationTimes.set(next,{round:s.round,elapsedMs}); return next;
  });
}

const preparationTimes = new WeakMap<MatchState,{round:number;elapsedMs:number}>();
const acquisitionContexts = new WeakMap<MatchState,{previousBattle:PreviousAugmentBattle;seats:readonly HistorySeat[]}>();
/** Server-owned observations made available before selectChoice executes acquisition effects. No save fields. */
export function prepareAugmentAcquisition(s: MatchState, previousBattle: PreviousAugmentBattle, elapsedMs: number, seats: readonly HistorySeat[]): void {
  historyCheck(s.multiplayer && Number.isSafeInteger(elapsedMs) && elapsedMs >= 0 && elapsedMs <= LIMIT.preparationMs, 'server acquisition context');
  historyCheck(seats.length > 0 && seats.length <= LIMIT.seats && new Set(seats.map(seat=>seat.seatId)).size === seats.length && seats.some(seat=>seat.seatId === s.multiplayer!.seatId), 'server acquisition table');
  acquisitionContexts.set(s, structuredClone({previousBattle,seats}));
  preparationTimes.set(s,{round:s.round,elapsedMs});
}
function preparationElapsed(s:MatchState):number {
  const clock=preparationTimes.get(s);if(clock?.round===s.round)return clock.elapsedMs;
  const fact=s.augmentHistory?.facts.filter(f=>f.round===s.round&&(f.kind==='preparation-time'||f.kind==='acquire')).at(-1);
  return fact?.kind==='preparation-time'?fact.elapsedMs:fact?.kind==='acquire'?fact.preparationElapsedMs:0;
}
interface Trace { readonly origin: MatchState; readonly commands: readonly HistoryCommand[]; readonly previousBattle: PreviousAugmentBattle }
const traces = new WeakMap<MatchState, Trace>();
let depth = 0;
export function initializeAugmentTrace(s: MatchState): MatchState {
  if (!s.multiplayer && s.openingEncounter.mode !== 'shared-deferred' && !needsAugmentHistory(s)) {
    const basis=s.combatInputBasis;
    const previousBattle:PreviousAugmentBattle=s.combat&&basis ? {status:'recorded',round:s.round,roundId:s.roundDefinitionId,battleId:s.combat.combatId!,roster:historyRoster({...s,preparation:basis.inputs.preparation,items:basis.inputs.items})} : {status:s.round===1?'none':'unavailable'};
    traces.set(s, { origin: s, commands: [], previousBattle });
  }
  return s;
}
export function recordAugmentAcquisition(before: MatchState, after: MatchState): MatchState {
  if (after === before) return after;
  if (!after.augmentHistory && !needsAugmentHistory(after)) return after;
  let next = after;
  if (!next.augmentHistory) {
    historyCheck(!needsAugmentHistory(before), 'missing augment-history-v1; history-dependent augment saves cannot be authenticated');
    next = { ...next, augmentHistory: { version: AUGMENT_HISTORY_VERSION, seatId: historySeatId(next), facts: [], proof: { kind: 'server' } } };
  }
  const context = acquisitionContexts.get(before);
  const acquired = after.augments.filter(a => augmentNeedsHistory(a.definitionId) && !before.augments.some(b => b.choiceId === a.choiceId) && !next.augmentHistory!.facts.some(f => f.kind === 'acquire' && f.choiceId === a.choiceId));
  for (const a of acquired)
    next = appendAugmentFact(next, { kind: 'acquire', choiceId: a.choiceId, definitionId: a.definitionId, goldBefore: before.gold, hpBefore: before.playerHp, roster: historyRoster(before), preparationElapsedMs: preparationElapsed(before), previousBattle: context?.previousBattle ?? traces.get(before)?.previousBattle ?? {status:'unavailable'} });
  // The effect may need prior eliminations immediately, before the room publishes this choice.
  if (acquired.length && context) next = recordAugmentTable(next, 'acquire', context.seats);
  return next;
}
/** Offer eligibility is a history consumer before an owner exists. Only the 4-2 prismatic node activates it.
 * Same v1 proof, origin, replay and independent server authority; no self-authenticating level field in offer records. */
export function recordAugmentOfferLevel(before:MatchState,after:MatchState):MatchState {
 const c=after.pendingChoice;
 if(c?.choiceId!=='round:4-2:augment'||c.augmentTier!=='prismatic')return after;
 const next=recordAugmentAcquisition(before,after);
 return appendAugmentFact(next,{kind:'offer-level',choiceId:c.choiceId,generation:c.generation,level:before.level,xp:before.xp});
}
export function recordAugmentTransition(before: MatchState, after: MatchState, events: readonly MatchEvent[] = []): MatchState {
  if (after === before) return after;
  let next = recordAugmentAcquisition(before, after);
  if (!next.augmentHistory) return next;
  // Identical preparation/item containers have the same roster. Combat ticks usually keep
  // both references, so avoid cloning/canonicalizing that unchanged roster on every tick.
  if ((before.preparation !== after.preparation || before.items !== after.items)
    && !same(historyRoster(before), historyRoster(after)) && !same(next.augmentHistory!.facts.filter(f => f.kind === 'positions').at(-1)?.roster ?? null, historyRoster(after))) next = appendAugmentFact(next, { kind: 'positions', roster: historyRoster(after) });
  // Streaming PvE can finish at tick zero without exposing a CombatState until settlement.
  // The frozen input basis, not a later editable board, is the authoritative opening roster.
  if (!before.combatInputBasis && after.combatInputBasis) {
    const basis = after.combatInputBasis.inputs;
    const battleId = after.combat?.combatId ?? after.pendingCombatTerminal?.combatId ?? `round-${after.round}`;
    if (!next.augmentHistory?.facts.some(f=>f.kind==='combat-roster'&&f.battleId===battleId))
      next = appendAugmentFact(next, {kind:'combat-roster',battleId,roster:historyRoster({...after,preparation:basis.preparation,items:basis.items})});
    if (next.augments.some(a => a.definitionId === 'a-golden-find') && (!after.multiplayer || after.m8.round.kind !== 'pvp') && !next.augmentHistory?.facts.some(f=>f.kind==='combat-binding'&&f.battleId===battleId))
      next = appendAugmentFact(next, {kind:'combat-binding',battleId,binding:basis.anomalyBinding});
  }
  if (!before.combat && after.combat && after.m8.round.kind === 'pvp' && !after.multiplayer)
    next = recordAugmentPvpRoster(next, after.combat.combatId!, [{ ...historyRoster(before), seatId: 'solo', index: 0, hp: before.playerHp, alive: true, rank: 1, eliminatedRound: null }], null);
  const captureKiller = next.augments.some(a => a.definitionId === 'a-golden-find');
  const captureTakedowns = next.augments.some(a => a.definitionId === 'forbidden-magic');
  const currentDeaths = augmentDeathsFromEvents(events, captureKiller, captureTakedowns);
  const recorded = new Set(after.combat?.status === 'finished' ? next.augmentHistory!.facts.flatMap(f => f.kind === 'deaths' && f.battleId === after.combat?.combatId ? f.deaths.map(d => d.eventSeq) : []) : []);
  const deaths = after.combat?.status === 'finished' ? [...readAugmentCombatDeaths(after.combat, captureKiller, captureTakedowns), ...currentDeaths].filter((d,i,rows) => !recorded.has(d.eventSeq) && rows.findIndex(x => x.eventSeq === d.eventSeq) === i) : currentDeaths;
  if (after.combat && (deaths.length || before.combat?.tick !== after.combat.tick || !before.combat))
    next = appendAugmentFact(next, { kind: 'deaths', battleId: after.combat.combatId!, completeThroughTick: after.combat.tick,
      deaths: deaths.map(d => ({ ...d, ownerSeatId: d.team === 'player' ? historySeatId(after) : null })) });
  if(after.roundResults.length>before.roundResults.length&&after.combat?.status==='finished')next=recordR2PortableBattle(next,after.combat,'player');
  // Solo PvP has no opposing player's HP account. Unknown is explicit, never fabricated as zero.
  if (!after.multiplayer && after.roundResults.length > before.roundResults.length && after.m8.round.kind === 'pvp')
    next = appendAugmentFact(next, { kind: 'player-damage', battleId: after.combat!.combatId!, opponentSeatId: null, mirror: false, hpBefore: null, hpAfterDamage: null, actualDamage: null });
  if (!after.multiplayer && after.roundResults.length > before.roundResults.length && after.m8.round.kind === 'pvp' && after.combat)
    next = settleNoScoutGrowth(next, after.combat.combatId!);
  return next;
}
/** Wrap only outer public commands. Failed/no-op commands keep their exact original identity and no evidence. */
export function traceHistoryCommand<T>(name: string, args: readonly unknown[], run: () => T): T {
  if (depth) return run();
  const before = args[0] as MatchState;
  depth++; let result: T; try { result = run(); } finally { depth--; }
  const envelope = result as unknown as { ok?: boolean; state?: MatchState; events?: readonly MatchEvent[] };
  if (envelope.ok === false) return result;
  const after = envelope.state ?? result as unknown as MatchState;
  if (!after || after === before || !('augments' in after)) return result;
  const tracker = completeTraitTrackerCommand(name, after);
  const rewarded = drainBatch5H7Gold(recordAugmentTransition(before, tracker.state, [...(envelope.events ?? []), ...tracker.events]));
  let next = rewarded.state;
  if (next.roundResults.length > before.roundResults.length) {
    if (!next.multiplayer) next = drainBatch5H8Gold(next);
    if (!next.multiplayer || next.m8.round.kind === 'pve') next = drainBatch5H8Deaths(next);
  }
  const priorReceipts=new Set((rewarded.state.seatMechanics?.receipts??[]).map(r=>r.receiptId));
  const newReceipts=(next.seatMechanics?.receipts??[]).filter(r=>!priorReceipts.has(r.receiptId));
  const payoutEvents:MatchEvent[]=newReceipts.map((receipt,index)=>({type:'mechanicGranted',receipt,domain:'match',eventSeq:next.nextMatchEventSeq+index}));
  if(payoutEvents.length)next={...next,nextMatchEventSeq:next.nextMatchEventSeq+payoutEvents.length};
  let effectEvents: readonly MatchEvent[] = [];
  if (next.roundResults.length > before.roundResults.length && (!next.multiplayer || next.m8.round.kind !== 'pvp')) {
    const settled = settleBatch5H9History(next); next = settled.state; effectEvents = settled.events;
  }
  if (!before.multiplayer && before.openingEncounter.mode !== 'shared-deferred') {
    const stored = before.augmentHistory?.proof;
    let trace: Trace = traces.get(before) ?? { ...(stored?.kind === 'solo' ? stored : {origin:before,commands:[]}), previousBattle:{status:'unavailable'} };
    if (!next.augmentHistory && trace.commands.length >= LIMIT.commands) trace = {origin:before,commands:[],previousBattle:{status:'unavailable'}};
    historyCheck(!needsAugmentHistory(trace.origin) && !trace.origin.augmentHistory, 'missing solo command origin');
    const tail = trace.commands.at(-1), repeated = name === 'stepMatch' && tail?.name === name;
    let savedArgs: readonly unknown[];
    try { savedArgs = structuredClone(args.slice(1).map(a => a === undefined ? null : a)); } catch (error) { if (next.augmentHistory) throw error; return result; }
    const commands = repeated ? [...trace.commands.slice(0, -1), { ...tail, count: tail.count + 1 }]
      : [...trace.commands, { name, args: savedArgs, count: 1 }];
    historyCheck(commands.length <= LIMIT.commands, 'command bounds');
    const origin = next.augmentHistory && !before.augmentHistory ? freezeContent(structuredClone(trace.origin)) : trace.origin;
    const proof = { kind: 'solo' as const, origin, commands };
    if (next.augmentHistory) next = { ...next, augmentHistory: { ...next.augmentHistory, proof } };
    traces.set(next, { ...proof, previousBattle: !before.combat && after.combat ? {status:'recorded',round:before.round,roundId:before.roundDefinitionId,battleId:after.combat.combatId!,roster:historyRoster(before)} : trace.previousBattle });
  }
  preparationTimes.set(next,{round:next.round,elapsedMs:next.round===before.round?Math.max(preparationElapsed(before),preparationElapsed(after)):0});
  const extraEvents = [...tracker.events, ...rewarded.events, ...payoutEvents, ...effectEvents];
  return (envelope.state ? { ...envelope, state: next, ...(extraEvents.length ? { events: [...(envelope.events ?? []), ...extraEvents] } : {}) } : next) as T;
}

// A server restore takes a separately held authority, never a field from the candidate save.
// This opaque handle is not JSON and cannot be manufactured by parsing/freezing a candidate.
export interface AugmentHistoryAuthority { readonly kind: 'server-augment-history-authority' }
const authorities = new WeakMap<AugmentHistoryAuthority, MatchState>();
export function captureAugmentHistoryAuthority(authoritative: MatchState): AugmentHistoryAuthority {
  const token = Object.freeze({ kind: 'server-augment-history-authority' as const });
  authorities.set(token, structuredClone(authoritative)); return token;
}
/** Room-only enrichment from its previous frozen battle, before publishing an acquisition. */
export function bindAugmentPreviousBattle(s: MatchState, previousBattle: PreviousAugmentBattle, preparationElapsedMs: number): MatchState {
  if (!s.augmentHistory) return s;
  return { ...s, augmentHistory: { ...s.augmentHistory, facts: s.augmentHistory.facts.map(f => f.kind === 'acquire' && f.round === s.round && f.previousBattle.status === 'unavailable'
    ? { ...f, previousBattle: structuredClone(previousBattle), preparationElapsedMs } : f) } };
}
export function readPreviousAugmentBattle(s: MatchState, choiceId: string): PreviousAugmentBattle {
  const fact = s.augmentHistory?.facts.find(f => f.kind === 'acquire' && f.choiceId === choiceId);
  historyCheck(fact?.kind === 'acquire' && fact.previousBattle.status !== 'unavailable', 'missing previous battle; supply verified battle history before selecting this augment');
  return structuredClone(fact.previousBattle);
}
/** A previously authenticated replay prefix may only grow, including a compressed step run. */
export function validateAugmentHistoryCarry(before: MatchState, after: MatchState): void {
  const a=before.augmentHistory,b=after.augmentHistory;if(!a)return;
  historyCheck(b && b.version===a.version && b.seatId===a.seatId && same(b.facts.slice(0,a.facts.length),a.facts),'history prefix');
  if(a.proof.kind==='solo'){
    historyCheck(b.proof.kind==='solo' && same(a.proof.origin,b.proof.origin),'origin carry');
    for(const [i,c] of a.proof.commands.entries()){
      const n=b.proof.commands[i];historyCheck(n && n.name===c.name && same(n.args,c.args) && (i===a.proof.commands.length-1&&c.name==='stepMatch'?n.count>=c.count:n.count===c.count),'command prefix');
    }
  }
}

/** Restore owns a detached value; carry only the trace regenerated by successful validation. */
export function carryRestoredAugmentTrace(validated: MatchState, restored: MatchState): MatchState {
  const trace=traces.get(validated);
  if(trace)traces.set(restored,trace);else initializeAugmentTrace(restored);
  return restored;
}

/** Restore-only trust check. The handle must come from an independently owned server checkpoint. */
export function validateAugmentAuthority(s: MatchState, authority: AugmentHistoryAuthority | undefined, required: boolean): void {
  const expected=authority && authorities.get(authority);
  if(required)historyCheck(expected,'missing independent server authority');
  if(expected && (required || expected.augmentHistory))historyCheck(same(s,expected),'server facts/state mismatch');
}

/** Evidence for a future maximum-HP effect, after its real domain transaction changed playerHp.
 * Does not heal or choose a cap; replay must reproduce the owning rule. */
export function recordAugmentPlayerHealth(s: MatchState, change: Extract<AugmentFactData,{kind:'player-health'}>): MatchState {
  historyCheck(s.augmentHistory && s.augments.some(a=>a.choiceId===change.choiceId && augmentNeedsHistory(a.definitionId)), 'player health owner');
  historyCheck(change.receiptId.length>0 && change.receiptId.length<=256 &&
    [change.hpBefore,change.hpAfter,change.maxHpBefore,change.maxHpAfter].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000) &&
    change.maxHpBefore>0 && change.maxHpAfter>0 && change.hpBefore<=change.maxHpBefore && change.hpAfter<=change.maxHpAfter && s.playerHp===change.hpAfter,'player health boundary');
  const old=s.augmentHistory.facts.find(f=>f.kind==='player-health'&&f.receiptId===change.receiptId);
  if(old){historyCheck(old.kind==='player-health'&&Object.entries(change).every(([k,v])=>old[k as keyof typeof old]===v),'player health receipt conflict');return s;}
  return appendAugmentFact(s,change);
}
