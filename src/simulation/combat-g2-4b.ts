import type { AbilityContext } from './combat-s13-abilities';
import { mirroredItemCell, nearestItemCell, manaReavedMaximum, validateDeferredItemDamage } from './g2-4b-item-kernel';
import { sameCell } from './board';
import { MOVE_INTERVAL_TICKS } from './combat-types';
import type {CombatUnit} from './combat-types';

/** Dynamic debt is schema/timing/provenance checked, like the existing combat
 * task ledger. This does not claim to reconstruct historical damage from HP. */
export function validateDefianceDebts(unit:CombatUnit, units:readonly CombatUnit[], tick:number, combatId:string, nextActionSeq:number):void {
  const item=unit.mechanics?.find(m=>m.mechanic==='g24DeathsDefiance');
  if (!item) {
    if(unit.deferredItemDamage!==undefined)throw new RangeError('Unexpected Defiance debt');
    return;
  }
  const debts=unit.deferredItemDamage;
  if(!Array.isArray(debts)||!unit.alive&&debts.length)throw new RangeError('Invalid Defiance debts');
  const ids=new Set<string>();
  for(const debt of debts){
    validateDeferredItemDamage(debt,tick,item.values.durationTicks);
    if(!debt.amount||debt.elapsedTicks!==tick-debt.startedAtTick||debt.elapsedTicks>=item.values.durationTicks||ids.has(debt.packetId))throw new RangeError('Invalid Defiance debt timing');
    ids.add(debt.packetId);
    let packet:unknown;
    try{packet=JSON.parse(debt.packetId);}catch{throw new RangeError('Invalid Defiance packet');}
    if(Array.isArray(packet)&&packet.length===3){
      if(packet[1]!=='redirect'||packet[2]!==unit.id||typeof packet[0]!=='string')throw new RangeError('Invalid Defiance redirect');
      try{packet=JSON.parse(packet[0]);}catch{throw new RangeError('Invalid Defiance parent');}
    }else if(!Array.isArray(packet)||packet[4]!==unit.id)throw new RangeError('Invalid Defiance target');
    if(!Array.isArray(packet)||packet.length!==6||packet[0]!==combatId||packet[1]!==debt.startedAtTick||packet[1]<1
      ||!units.some(u=>u.id===packet[2])||!units.some(u=>u.id===packet[4])
      ||!Number.isSafeInteger(packet[3])||packet[3]<0||packet[3]>=nextActionSeq
      ||!Number.isSafeInteger(packet[5])||packet[5]<0)throw new RangeError('Invalid Defiance packet provenance');
  }
}

type ShroudUnit=Pick<CombatUnit,'team'|'cell'|'mechanics'>;
/** Evaluate only on original combat cells, after both seats have been combined. */
export function shroudBpsAtCell(target:ShroudUnit,initial:readonly ShroudUnit[]):number {
  return Math.max(0,...initial.filter(u=>u.team!==target.team&&Math.abs(u.cell.col-target.cell.col)<=1)
    .flatMap(u=>u.mechanics?.filter(m=>m.mechanic==='g24Shroud').map(m=>m.values.costIncreaseBps)??[]));
}
export function initializeShroud(units:readonly CombatUnit[]):CombatUnit[] {
  return units.map(unit=>{
    const bps=shroudBpsAtCell(unit,units);
    return bps&&unit.maxMana>0?{...unit,unreavedMaxMana:unit.maxMana,maxMana:manaReavedMaximum(unit.maxMana,bps)}:unit;
  });
}

/** Spectral Cutlass records its home in the existing frozen startingCell.
 * Occupied destinations select the nearest free cell (documented convention).
 * Actor-ID order reserves each destination before processing the next holder.
 */
export function advanceSpectralCutlass(ctx: AbilityContext): void {
  // Most ticks have no teleport. Avoid allocating/sorting the entire army on
  // those ticks, including battles without this item.
  if (!ctx.units.some(unit=>unit.alive&&unit.hp>0&&unit.mechanics?.some(m=>
    m.mechanic==='g24SpectralCutlass'&&(ctx.tick===0||ctx.tick===m.values.durationTicks)))) return;
  for (const unit of [...ctx.units].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)) {
    const item = unit.mechanics?.find(m=>m.mechanic==='g24SpectralCutlass');
    if (!item || !unit.alive || unit.hp <= 0 || ctx.tick !== 0 && ctx.tick !== item.values.durationTicks) continue;
    if (!unit.startingCell) throw new RangeError('Missing cutlass starting cell');
    const desired = ctx.tick === 0 ? mirroredItemCell(ctx.board, unit.startingCell) : unit.startingCell;
    const cells = Array.from({length:ctx.board.rows},(_,row)=>Array.from({length:ctx.board.columns},(_,col)=>({col,row}))).flat();
    const available = cells.filter(cell=>!ctx.units.some(other=>other.id!==unit.id&&other.alive&&sameCell(other.cell,cell)));
    const to = nearestItemCell(desired,available);
    if (!to || sameCell(to,unit.cell)) continue;
    ctx.events.push({type:'movement',tick:ctx.tick,unitId:unit.id,from:{...unit.cell},to});
    unit.cell=to;unit.moveCooldownTicks=MOVE_INTERVAL_TICKS;
  }
}
