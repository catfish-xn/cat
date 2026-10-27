import { readAugmentFacts, recordAugmentTable } from './augment-history';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import type { MatchState, MatchEvent, MatchStep } from './match-types';
import type { HistorySeat } from './augment-history-types';
import { UNIT_DEFINITIONS } from './units';
import { isAnvil } from './content/anvils';
import { canonicalContent } from './content';
import { openMechanicChoice } from './seat-mechanics/choices';
import type { MechanicChoiceSpec } from './seat-mechanics/types';
import { g23RadiantDefinitionId } from './g2-3-rewards';
import { readG23Progress, validateG23RewardSources } from './g2-3-state';
import { replayG23Economy } from './g2-3-match-progress';
import { g23RadiantRound } from './g2-3-settlement';
import { getCatalogRoundById } from './round-selectors';

export const TOMB_RAIDER_SOURCE = 'augment-pool-batch5-r1';
const isOwner = (id: string) => id === 'tomb-raider-1' || id === 'tomb-raider-2';
export const hasTombRaider = (state: MatchState): boolean => state.augments.some(a => isOwner(a.definitionId));

export interface TombRaiderOpportunity {
  readonly seatId: string;
  readonly rank: number;
  readonly round: number;
  /** One row per equipped item, including identical copies. */
  readonly candidates: readonly { readonly itemId: string; readonly definitionId: string; readonly unitId: string }[];
}

/** Pure interpretation of authenticated history. The settlement table must retain each
 * eliminated player's pre-release roster. An empty candidate list consumes an opportunity. */
export function tombRaiderOpportunities(state: MatchState, choiceId: string): readonly TombRaiderOpportunity[] {
  const owner = state.augments.find(a => a.choiceId === choiceId && (a.definitionId === 'tomb-raider-1' || a.definitionId === 'tomb-raider-2'));
  if (!owner) throw new RangeError('Invalid tomb raider owner');
  const acquire = readAugmentFacts(state, 'acquire').find(f => f.choiceId === choiceId);
  if (!acquire) throw new RangeError('Invalid tomb raider acquisition');
  const tables = readAugmentFacts(state, 'table').filter(f => f.sequence > acquire.sequence);
  const initial = tables.find(f => f.stage === 'acquire');
  if (!initial && !state.multiplayer) return [];
  if (!initial) throw new RangeError('Invalid tomb raider acquisition table');
  const alive = new Set(initial.seats.filter(s => s.alive && s.seatId !== initial.seatId).map(s => s.seatId));
  const result: TombRaiderOpportunity[] = [];
  for (const table of tables) {
    if (table.sequence <= initial.sequence || table.stage === 'acquire') continue;
    const self = table.seats.find(s => s.seatId === table.seatId);
    if (!self) throw new RangeError('Invalid tomb raider table seat');
    const eliminated = table.seats.filter(s => alive.has(s.seatId) && !s.alive).sort((a, b) => b.rank - a.rank);
    for (const seat of eliminated) {
      alive.delete(seat.seatId);
      if (self.alive && (owner.definitionId !== 'tomb-raider-1' || result.length < 3))
        result.push({ seatId: seat.seatId, rank: seat.rank, round: table.round, candidates: tombRaiderCandidates(seat) });
    }
  }
  return result;
}

export function tombRaiderCandidates(seat: HistorySeat): TombRaiderOpportunity['candidates'] {
  const ordinary = new Set<string>(G24_FORGE_POOLS.TFT_ArmoryKeyCompleted);
  const heroes = new Set(seat.units.filter(unit => {
    const def = UNIT_DEFINITIONS[unit.definitionId];
    return unit.team === 'player' && (unit.location.kind === 'board' || unit.location.kind === 'bench')
      && !isAnvil(unit.definitionId) && def && !def.summon && def.unitKind !== 'neutral';
  }).map(unit => unit.id));
  return seat.items.flatMap(item => item.location.kind === 'unit' && heroes.has(item.location.unitId) && ordinary.has(item.definitionId)
    ? [{ itemId: item.id, definitionId: item.definitionId, unitId: item.location.unitId }] : []);
}

export function tombRaiderChoiceId(choiceId: string, seatId: string): string {
  return JSON.stringify([TOMB_RAIDER_SOURCE, choiceId, seatId]);
}

function pendingOpportunity(state: MatchState) {
  for (const owner of state.augments.filter(a => isOwner(a.definitionId))) {
    for (const opportunity of tombRaiderOpportunities(state, owner.choiceId)) {
      const choiceId = tombRaiderChoiceId(owner.choiceId, opportunity.seatId);
      if (opportunity.candidates.length && !state.seatMechanics?.receipts.some(r => r.receiptId === choiceId))
        return { choiceId, opportunity };
    }
  }
  return undefined;
}

function specification(state: MatchState): MechanicChoiceSpec | undefined {
  if (!state.multiplayer || !hasTombRaider(state)) return undefined;
  const pending = pendingOpportunity(state);
  if (!pending) return undefined;
  // Identical equipped copies are separate displayed candidates. Selecting either grants the same definition once.
  const offers = pending.opportunity.candidates.map(item => item.definitionId);
  return { choiceId: pending.choiceId, offers, returnPhase: state.phase === 'settlement' ? 'settlement' : 'preparation',
    payload: { kind: 'forge', source: TOMB_RAIDER_SOURCE, timeoutOption: offers[0] } };
}

/** Reuses the existing blocking forge and choose/timeout commands. No private reward queue or RNG. */
export function openTombRaiderChoice(state: MatchState): MatchStep {
  if (!state.multiplayer || state.multiplayer.status !== 'active' || state.pendingChoice
    || state.m8.round.kind === 'supply' || !['preparation', 'settlement'].includes(state.phase)) return { state, events: [] };
  const spec = specification(state);
  if (!spec) return { state, events: [] };
  const result = openMechanicChoice(state, spec);
  if (!result.ok) throw new RangeError(`Invalid tomb raider choice: ${result.reason}`);
  return result;
}

/** Server-only observation hook: the ranked table is frozen before any eliminated seat releases its resources.
 * Events are stamped here because this transaction is published atomically with the room settlement. */
export function recordTombRaiderEliminations(state: MatchState, table: readonly HistorySeat[]): MatchStep {
  if (!state.multiplayer || !hasTombRaider(state)) return { state, events: [] };
  const existing = readAugmentFacts(state, 'table').find(f => f.round === state.round && f.stage === 'settlement');
  if (existing && canonicalContent(existing.seats) !== canonicalContent(table)) throw new RangeError('Invalid tomb raider settlement conflict');
  const recorded = existing ? state : recordAugmentTable(state, 'settlement', table);
  const opened = openTombRaiderChoice(recorded);
  return stampTombRaiderOpening(opened);
}

/** Entry eliminations use the table already recorded by the room's round-entry publication. */
export function publishTombRaiderChoice(state: MatchState): MatchStep {
  return stampTombRaiderOpening(openTombRaiderChoice(state));
}
function stampTombRaiderOpening(opened: MatchStep): MatchStep {
  let seq = opened.state.nextMatchEventSeq;
  const events: MatchEvent[] = opened.events.map(event => 'tick' in event ? event : { ...event, domain: 'match' as const, eventSeq: seq++ });
  return events.length ? { state: { ...opened.state, nextMatchEventSeq: seq }, events } : opened;
}

/** Bind receipts, pending candidates and item births to authenticated elimination history. */
export function validateTombRaider(state: MatchState): void {
  const fail = (): never => { throw new RangeError('Invalid tomb raider authority'); };
  let radiantRound: number | undefined;
  let radiantValidated = false;
  const expected = new Map(state.multiplayer && hasTombRaider(state) ? state.augments.filter(a => isOwner(a.definitionId))
    .flatMap(a => tombRaiderOpportunities(state, a.choiceId).filter(o => o.candidates.length)
      .map(o => [tombRaiderChoiceId(a.choiceId, o.seatId), o] as const)) : []);
  const receipts = state.seatMechanics?.receipts ?? [];
  let unresolved = false;
  for (const [choiceId, opportunity] of expected) {
    const receipt = receipts.find(r => r.receiptId === choiceId);
    if (!receipt) { unresolved = true; continue; }
    if (receipt.kind !== 'choice') return fail();
    if (unresolved || receipt.source !== TOMB_RAIDER_SOURCE || receipt.choiceKind !== 'forge'
      || receipt.price !== 0 || receipt.skipped || !receipt.itemId || receipt.round < opportunity.round || receipt.round > state.round
      || !opportunity.candidates.some(c => c.definitionId === receipt.optionId)
      || receipt.timedOut && receipt.optionId !== opportunity.candidates[0].definitionId) fail();
    const itemId = receipt.itemId!; // The receipt guard above rejects missing item identities.
    const birth = state.resourceProvenance.entries.filter(f => f.kind === 'item-acquired' && f.itemId === itemId);
    if (birth.length !== 1 || birth[0].kind !== 'item-acquired' || birth[0].source.kind !== 'mechanic'
      || birth[0].source.receiptId !== choiceId || birth[0].roundId !== receipt.roundId) fail();
    const entries = state.resourceProvenance.entries;
    const birthIndex = entries.indexOf(birth[0]);
    if (birth[0].sequence !== birthIndex) fail();
    let definitionId = receipt.optionId;
    let retained = true;
    for (const [index, fact] of entries.entries()) {
      if (index > birthIndex && fact.kind === 'item-combined' && fact.event.consumedIds.includes(itemId)) retained = false;
      if (index > birthIndex && fact.kind === 'consumable-used') {
        const affected = fact.record.affectedItems.findIndex(item => item.id === itemId);
        if (affected >= 0 && fact.record.outputs[affected]?.id !== itemId) retained = false;
      }
      if (fact.kind !== 'g23-item-converted' || fact.itemId !== itemId) continue;
      if (!radiantValidated) {
        try {
          validateG23RewardSources(state);
          const progress = readG23Progress(state);
          if (!progress) return fail();
          const replayed = replayG23Economy(state.seed, progress.economyReceipts);
          if (canonicalContent(progress.conquest) !== canonicalContent(replayed.conquest)) return fail();
          radiantRound = g23RadiantRound(state);
        } catch { return fail(); }
        radiantValidated = true;
      }
      try {
        const round = getCatalogRoundById(fact.roundId).ordinal;
        const target = g23RadiantDefinitionId(fact.from);
        if (!retained || index <= birthIndex || fact.sequence !== index || getCatalogRoundById(birth[0].roundId).ordinal !== receipt.round
          || round < receipt.round || round > state.round
          || radiantRound === undefined || round < radiantRound || fact.receiptId !== 'g23:conqueror:15'
          || fact.from !== definitionId || !target || target !== fact.to) fail();
      } catch { return fail(); }
      definitionId = fact.to;
    }
    const items = state.items.filter(i => i.id === itemId);
    if (items.length > 1 || items.some(item => !retained || item.definitionId !== definitionId)) fail();
  }
  for (const receipt of receipts) if ((receipt.source === TOMB_RAIDER_SOURCE || receipt.receiptId.startsWith(`["${TOMB_RAIDER_SOURCE}",`))
    && !expected.has(receipt.receiptId)) fail();
  if (state.pendingChoice?.payload?.source === TOMB_RAIDER_SOURCE) {
    const waiting = { ...state, phase: state.pendingChoice.returnPhase, pendingChoice: null } as MatchState;
    const expectedChoice = openTombRaiderChoice(waiting).state.pendingChoice;
    if (canonicalContent(state.pendingChoice) !== canonicalContent(expectedChoice)) fail();
  } else if (unresolved && state.multiplayer?.status === 'active' && !state.pendingChoice
    && ['preparation', 'settlement'].includes(state.phase) && state.m8.round.kind !== 'supply') fail();
}
