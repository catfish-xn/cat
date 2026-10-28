/** Shared display selectors, usable without projecting the entire private seat. */
import { anvilDisplay } from './content/anvils';
import { getUnitSellPrice } from './unit-stats';
import { D14_POLICY } from './content/d14-anomalies';
import type { MatchState } from './match-types';
import { cellView, pick } from './view-fields';
import { getUnitForm } from './seat-mechanics/forms';

export function preparationUnitView(unit: MatchState['preparation']['units'][number]) {
  // G2-3 form swappers only: the form the unit would take if combat started now (seat-mechanics/forms.ts).
  const form = getUnitForm(unit);
  return { ...pick(unit, ['id', 'definitionId', 'team', 'starLevel']), ...(anvilDisplay(unit.definitionId)?{anvil:anvilDisplay(unit.definitionId)}:{}),
    location: unit.location.kind === 'bench' ? pick(unit.location, ['kind', 'slot'])
      : { kind: 'board' as const, cell: cellView(unit.location.cell) }, ...(form ? { form } : {}) };
}

export function itemView(item: MatchState['items'][number]) {
  return { ...pick(item, ['id', 'definitionId']), location: item.location.kind === 'inventory'
    ? { kind: 'inventory' as const } : pick(item.location, ['kind', 'unitId', 'slot']) };
}

function heldUnitView(unit: MatchState['preparation']['units'][number]) {
  // Held units keep the original Unit field set; form is a live preparation hint.
  const {form:_form,...view}=preparationUnitView(unit);
  return view;
}

export function d14PrivateDisplay(state:MatchState){
  const d=state.d14;if(!d)return undefined;
  return {anomalyId:d.anomalyId,choiceId:d.choiceId,unitId:d.unitId,phase:d.phase,dueOrdinal:d.atOrdinal+D14_POLICY.numRounds,
    remainingSettlements:Math.max(0,d.atOrdinal+D14_POLICY.numRounds-state.roundResults.length),effectiveStarLevel:d.phase==='promoted'?4:(state.preparation.units.find(u=>u.id===d.unitId)?.starLevel??d.originalUnit.starLevel),
    physicalStarLevel:state.preparation.units.find(u=>u.id===d.unitId)?.starLevel??d.originalUnit.starLevel,...(d.anomalyId==='ultimate-hero'?{sellGold:getUnitSellPrice({definitionId:d.originalUnit.definitionId,starLevel:3}),poolCopies:D14_POLICY.ultimateShares}:{}),
    ...(d.held?{heldUnit:heldUnitView(d.held.unit),heldItems:d.held.items.map(itemView)}:{})};
}

