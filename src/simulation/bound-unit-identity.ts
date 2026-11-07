import type {ResourceProvenanceEntry} from './resource-provenance';
/** Follow an already authenticated original unit through the verified resource facts.
 * This does not authenticate raw facts or record growth: callers must run the complete fold first. */
export function traceBoundUnitIdentity(originalId:string,facts:readonly ResourceProvenanceEntry[]):string|null{
 let unitId:string|null=originalId;
 for(const fact of facts){
  if(unitId===null)break;
  if((fact.kind==='unit-sold'||fact.kind==='unit-removed')&&fact.unitId===unitId){unitId=null;continue;}
  const upgrades=fact.kind==='unit-upgraded'||fact.kind==='unit-upgraded-after-combat'?[fact.event]
   :fact.kind==='carousel-preparation-settled'||fact.kind==='carousel-unit-claimed'?fact.upgrades:[];
  for(const event of upgrades)if(unitId!==null&&event.consumedIds.includes(unitId))unitId=event.survivorId;
 }
 return unitId;
}
