import { readAugmentFacts, recordAugmentTable } from './augment-history';
import { G24_FORGE_POOLS } from './content/g2-4-forges';
import type { MatchState, MatchEvent, MatchStep } from './match-types';
import type { HistorySeat } from './augment-history-types';
import { UNIT_DEFINITIONS } from './units';
import { isAnvil } from './content/anvils';
import { canonicalContent } from './content';
import { openMechanicChoice } from './seat-mechanics/choices';
import type { MechanicChoiceSpec } from './seat-mechanics/types';

export const TOMB_RAIDER_SOURCE = 'augment-pool-batch5-r1';
export const isOwner = (id: string) => id === 'tomb-raider-1' || id === 'tomb-raider-2';
export const hasTombRaider = (state: MatchState): boolean => state.augments.some(a => isOwner(a.definitionId));

export interface TombRaiderOpportunity {
  readonly seatId: string;
  readonly rank: number;
  readonly round: number;
  /** One row per equipped item, including identical copies. */
  readonly candidates: readonly { readonly itemId: string; readonly definitionId: string; readonly unitId: string }[];
}

/** Pure interpretation of authenticated history. The settlement table must retain each
 * eliminated player's pre-release roster. An empty candidate list consumes an opportunity.
 * `missingTable` is not yet an authenticated baseline: a public selectChoice dry-run records
 * the acquire fact before the server attaches the table, and must not abort that command. */
function listedOpportunities(state: MatchState, choiceId: string):
  { readonly opportunities: readonly TombRaiderOpportunity[] } | { readonly missingTable: true } {
  const owner = state.augments.find(a => a.choiceId === choiceId && (a.definitionId === 'tomb-raider-1' || a.definitionId === 'tomb-raider-2'));
  if (!owner) throw new RangeError('Invalid tomb raider owner');
  const acquire = readAugmentFacts(state, 'acquire').find(f => f.choiceId === choiceId);
  if (!acquire) throw new RangeError('Invalid tomb raider acquisition');
  const tables = readAugmentFacts(state, 'table').filter(f => f.sequence > acquire.sequence);
  const initial = tables.find(f => f.stage === 'acquire');
  if (!initial) return { missingTable: true };
  const alive = new Set(initial.seats.filter(s => s.alive && s.seatId !== initial.seatId).map(s => s.seatId));
  const opportunities: TombRaiderOpportunity[] = [];
  for (const table of tables) {
    if (table.sequence <= initial.sequence || table.stage === 'acquire') continue;
    const self = table.seats.find(s => s.seatId === table.seatId);
    if (!self) throw new RangeError('Invalid tomb raider table seat');
    const eliminated = table.seats.filter(s => alive.has(s.seatId) && !s.alive).sort((a, b) => b.rank - a.rank);
    for (const seat of eliminated) {
      alive.delete(seat.seatId);
      if (self.alive && (owner.definitionId !== 'tomb-raider-1' || opportunities.length < 3))
        opportunities.push({ seatId: seat.seatId, rank: seat.rank, round: table.round, candidates: tombRaiderCandidates(seat) });
    }
  }
  return { opportunities };
}

export function tombRaiderOpportunities(state: MatchState, choiceId: string): readonly TombRaiderOpportunity[] {
  const listed = listedOpportunities(state, choiceId);
  if ('missingTable' in listed) {
    if (!state.multiplayer) return [];
    throw new RangeError('Invalid tomb raider acquisition table');
  }
  return listed.opportunities;
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
    const listed = listedOpportunities(state, owner.choiceId);
    // No acquisition table yet: nothing authenticated to open. Validation still rejects a saved seat.
    if ('missingTable' in listed) continue;
    for (const opportunity of listed.opportunities) {
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


