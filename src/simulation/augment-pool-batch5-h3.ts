import { hexDistance } from './board';
import { readAugmentFacts, readAugmentGrowth, recordAugmentGrowth, requireAugmentFacts } from './augment-history';
import type { AugmentGrowth } from './augment-history-types';
import type { MatchState } from './match-types';
import { UNIT_DEFINITIONS } from './units';

/** Follow actual merge receipts forward. A consumed participant's lock and growth follow its survivor. */
function descendant(state: MatchState, id: string): string {
  for (const e of state.resourceProvenance.entries) {
    if ((e.kind === 'unit-upgraded' || e.kind === 'unit-upgraded-after-combat') && e.event.consumedIds.includes(id)) id = e.event.survivorId;
  }
  return id;
}

function ordinary(definitionId: string): boolean {
  const definition = UNIT_DEFINITIONS[definitionId];
  return !!definition && !definition.summon && definition.unitKind !== 'neutral';
}

/** All eligible frozen player-combat participants, including those merged into a current survivor. */
export function noScoutLockedUnits(state: MatchState): ReadonlySet<string> {
  const owner = state.augments.find(a => a.definitionId === 'no-scout-no-pivot');
  if (!owner || !state.augmentHistory) return new Set();
  const seatId = state.multiplayer?.seatId ?? 'solo';
  return new Set(readAugmentFacts(state,'pvp-roster').flatMap(f => f.round >= owner.acquiredRound
    ? (f.seats.find(s => s.seatId === seatId)?.units ?? []).filter(u => u.location.kind === 'board' && ordinary(u.definitionId)).map(u => descendant(state,u.id)) : []));
}

/** Called once as part of settlement. The roster is a server/solo history fact, never a client command. */
export function settleNoScoutGrowth(state: MatchState, battleId: string): MatchState {
  const owner = state.augments.find(a => a.definitionId === 'no-scout-no-pivot');
  if (!owner || !state.augmentHistory) return state;
  const roster = requireAugmentFacts(state,'pvp-roster',state.round).find(f => f.battleId === battleId);
  if (!roster || roster.kind !== 'pvp-roster') throw new RangeError('Invalid augment history: missing pvp roster');
  const seat = roster.seats.find(s => s.seatId === (state.multiplayer?.seatId ?? 'solo'));
  if (!seat) throw new RangeError('Invalid augment history: missing pvp seat');
  const counts = new Map<string,number>();
  for (const unit of seat.units) if (unit.location.kind === 'board' && ordinary(unit.definitionId)) {
    const id = descendant(state,unit.id);
    if (!state.preparation.units.some(u => u.id === id)) throw new RangeError('Invalid augment history: missing pvp participant');
    counts.set(id,(counts.get(id) ?? 0)+1);
  }
  const deltas: AugmentGrowth[] = [...counts].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([unitId,n]) => ({unitId,healthFlat:20*n,healthBps:0,attackDamageBps:150*n,abilityPowerCenti:150*n}));
  return recordAugmentGrowth(state,owner.choiceId,JSON.stringify(['no-scout-no-pivot',owner.choiceId,battleId]),deltas);
}

/** Freeze only growth already earned when the combat roster was captured. */
export function combatHistoryGrowth(state: MatchState, ids: readonly string[], atCombatStart = false): readonly AugmentGrowth[] {
  if (!state.augmentHistory || !state.augments.some(a=>a.definitionId==='no-scout-no-pivot'||a.definitionId==='cooking-pot')) return [];
  const boundary = atCombatStart ? readAugmentFacts(state,'combat-roster').find(f => f.round === state.round) : undefined;
  const history = boundary ? {...state.augmentHistory, facts:state.augmentHistory.facts.slice(0,boundary.sequence)} : state.augmentHistory;
  const provenance = atCombatStart && state.combatInputBasis ? {...state.resourceProvenance,entries:state.resourceProvenance.entries.slice(0,state.combatInputBasis.provenancePrefixLength)} : state.resourceProvenance;
  const snapshot = {...state,augmentHistory:history,resourceProvenance:provenance};
  return [...ids].sort().map(id=>readAugmentGrowth(snapshot,id)).filter(g=>g.healthFlat || g.healthBps || g.attackDamageBps || g.abilityPowerCenti);
}

/** Round-entry roster is recorded before any new-round rewards or placements. */
export function grantCookingPotGrowth(state: MatchState): MatchState {
  const owner = state.augments.find(a=>a.definitionId==='cooking-pot');
  if (!owner || owner.acquiredRound >= state.round) return state;
  const fact = requireAugmentFacts(state,'round-entry',state.round)[0];
  const deltas = planCookingPotGrowth(fact.roster);
  return recordAugmentGrowth(state,owner.choiceId,JSON.stringify(['cooking-pot',owner.choiceId,state.round]),deltas);
}

/** Deterministic recipient selection from the recorded board, with a single grant per holder. */
export function planCookingPotGrowth(roster: import('./augment-history-types').HistoryRoster): readonly AugmentGrowth[] {
  const units = roster.units.filter(u=>u.team==='player' && u.location.kind==='board' && ordinary(u.definitionId));
  const counts = new Map<string,number>();
  for (const holder of units) {
    if (!roster.items.some(i=>i.location.kind==='unit' && i.location.unitId===holder.id && (i.definitionId==='spatula'||i.definitionId==='frying-pan'))) continue;
    if(holder.location.kind!=='board') continue;
    const origin=holder.location.cell;
    const targets=units.filter(u=>u.id!==holder.id && u.location.kind==='board').sort((a,b)=>{
      if(a.location.kind!=='board'||b.location.kind!=='board')return 0;
      return hexDistance(origin,a.location.cell)-hexDistance(origin,b.location.cell)||(a.id<b.id?-1:a.id>b.id?1:0);
    });
    if(targets[0])counts.set(targets[0].id,(counts.get(targets[0].id)??0)+1);
  }
  return [...counts].sort(([a],[b])=>a<b?-1:a>b?1:0)
    .map(([unitId,n])=>({unitId,healthFlat:50*n,healthBps:0,attackDamageBps:0,abilityPowerCenti:0}));
}
