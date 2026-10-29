import type { MatchState, MatchEvent } from './match-types';
import type { ChoiceDefinition } from './strategy-types';
import type { UnitLocation } from './unit-types';
import { getMultiplayerRoundByOrdinal } from './multiplayer-round';
import { usableBenchSlots } from './bench-capacity';
import { canonicalContent } from './content';
import { grantMechanicItem } from './seat-mechanics/grants';
import { AUGMENT_GIFT_SOURCE } from './augment-gift-plan';
import { planAugmentGifts } from './augment-gift-plan';

/** D3 is deliberately dormant: D5 alone registers the definition/tier/offer rules.
 * Source: local 14.24 research, TFT11_Augment_OverEncumbered; timing/overflow P-D3 (2026-10-28). */
export const OVER_ENCUMBERED_DEFINITION: ChoiceDefinition = {
  id: 'over-encumbered', name: '运力不足',
  description: '下一整个阶段仅有1个可用备战席栏位，期间不能购买弈子。多余弈子暂留场上不参战，只能出售；阶段结束获得3件随机基础装备。',
  effects: [{kind:'mechanic',mechanic:'acquisitionBundle',values:{enabled:1}}],
};
export function overEncumberedActive(state: Pick<MatchState, 'round' | 'roundResults' | 'augments'>): boolean {
  const stage = getMultiplayerRoundByOrdinal(state.round).stage;
  return state.augments.some(a => a.definitionId === 'over-encumbered'
    && stage === getMultiplayerRoundByOrdinal(a.acquiredRound).stage + 1
    && !state.roundResults.some(r => {
      const settled = getMultiplayerRoundByOrdinal(r.round);
      return settled.stage === stage && settled.subround === 7;
    }));
}

/** Stable bench-slot order on activation; only a bench sale releases parked pieces.
 * No removals, grants, merges, serials or random draws. */
type CapacityState = Pick<MatchState, 'round' | 'roundResults' | 'augments' | 'preparation'>;
export function reconcileOverEncumbered(state: MatchState, returnOverflow = false): { state: MatchState; events: MatchEvent[] } {
  return reconcileCapacity(state, returnOverflow);
}
function reconcileCapacity<T extends CapacityState>(state: T, returnOverflow = false): { state: T; events: MatchEvent[] } {
  const active = overEncumberedActive(state), p = state.preparation;
  if (!active && p.usableBenchSlots === undefined && p.overflowUnitIds === undefined) return { state, events: [] };
  const limit = active ? 1 : p.benchSize;
  let units = [...p.units];
  let parked = (p.overflowUnitIds ?? []).filter(id => units.some(u => u.id === id));
  const events: MatchEvent[] = [];
  const move = (id: string, to: UnitLocation) => {
    const unit = units.find(u => u.id === id)!;
    events.push({ type: 'unitDeployed', unitId: id, from: structuredClone(unit.location), to: structuredClone(to) });
    units = units.map(u => u.id === id ? { ...u, location: to } : u);
  };
  const freeBench = () => Array.from({ length: limit }, (_, slot) => slot)
    .find(slot => !units.some(u => u.location.kind === 'bench' && u.location.slot === slot));
  // Compact any old bench before parking the rest; slot zero is retained when occupied.
  for (const u of units.filter(u => u.team === 'player' && u.location.kind === 'bench' && u.location.slot >= limit)
    .sort((a,b) => (a.location as {slot:number}).slot - (b.location as {slot:number}).slot)) {
    const slot = freeBench();
    if (slot !== undefined) { move(u.id, { kind: 'bench', slot }); continue; }
    const zone = p.board.deploymentZones.player;
    const cells = Array.from({length:zone.lastRow-zone.firstRow+1},(_,r)=>zone.lastRow-r)
      .flatMap(row=>Array.from({length:p.board.columns},(_,col)=>({row,col})));
    const cell = cells.find(cell => !units.some(u => u.location.kind === 'board' && u.location.cell.col === cell.col && u.location.cell.row === cell.row));
    if (!cell) throw new RangeError('Invalid over-encumbered parking capacity');
    move(u.id, { kind: 'board', cell }); parked.push(u.id);
  }
  for (const id of !active || returnOverflow ? parked : []) {
    const slot = freeBench(); if (slot === undefined) break;
    move(id, { kind: 'bench', slot });
  }
  parked = parked.filter(id => units.some(u => u.id === id && u.location.kind === 'board'));
  const { usableBenchSlots: _usable, overflowUnitIds: _overflow, ...base } = p;
  const preparation = { ...base, units, ...(active ? { usableBenchSlots: 1, overflowUnitIds: parked } : {}) };
  if (canonicalContent(preparation) === canonicalContent(p)) return { state, events: [] };
  return { state: { ...state, preparation }, events };
}

/** Three independent uniform draws from the existing eight-component pool, with replacement.
 * A choice-bound substream and the ordinary gift receipts make retry/restore idempotent. */
export function overEncumberedRewardPlan(state: MatchState) {
  return state.augments.filter(a => a.definitionId === 'over-encumbered').flatMap(a => {
    const stage = getMultiplayerRoundByOrdinal(a.acquiredRound).stage + 1;
    const due = state.roundResults.find(r => {
      const round = getMultiplayerRoundByOrdinal(r.round); return round.stage === stage && round.subround === 7;
    });
    return due && due.hpAfter > 0 ? planAugmentGifts(state,
      { ...a, acquiredRound: due.round, choiceId: JSON.stringify([a.choiceId, 'over-encumbered-stage', stage]) },
      [{kind:'random-item',pool:'component',count:3}]) : [];
  });
}

/** Both solo replay and independent shared authority authenticate the overlay as well as positions. */
export function validateOverEncumbered(state: CapacityState): void {
  const p = state.preparation;
  if (!state.augments.some(a => a.definitionId === 'over-encumbered') && p.usableBenchSlots === undefined && p.overflowUnitIds === undefined) return;
  const check = (ok: unknown) => { if (!ok) throw new RangeError('Invalid over-encumbered overlay'); };
  if (!overEncumberedActive(state)) { check(p.usableBenchSlots === undefined && p.overflowUnitIds === undefined); return; }
  check(p.usableBenchSlots === 1 && Array.isArray(p.overflowUnitIds) && p.overflowUnitIds!.length <= p.benchSize - 1);
  const ids = p.overflowUnitIds!; check(new Set(ids).size === ids.length);
  check(ids.every(id => p.units.some(u => u.id === id && u.team === 'player' && u.location.kind === 'board')));
  check(p.units.every(u => u.location.kind !== 'bench' || u.location.slot < usableBenchSlots(p)));
  // Deployment may leave slot zero empty without releasing any parked piece.
  check(ids.length + p.units.filter(u => u.team === 'player' && u.location.kind === 'bench').length <= p.benchSize);
  // Reconciliation already compares the complete canonical preparations and
  // returns this exact state iff they match. Reuse that result instead of
  // encoding both preparations a second time at every restore boundary.
  check(reconcileCapacity(state).state === state);
}

export function completeOverEncumbered(state: MatchState): { state: MatchState; events: MatchEvent[] } {
  const reconciled = reconcileOverEncumbered(state);
  let next = reconciled.state;
  const events = [...reconciled.events];
  for (const gift of overEncumberedRewardPlan(next)) {
    if (next.seatMechanics?.receipts.some(r => r.receiptId === gift.receiptId)) continue;
    const granted = grantMechanicItem(next, { ...gift, source: AUGMENT_GIFT_SOURCE });
    if (!granted.ok) throw new RangeError('Invalid over-encumbered reward');
    next = granted.state; events.push(...granted.events);
  }
  return { state: next, events };
}
