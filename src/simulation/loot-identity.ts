import { encodePrimitiveTuple } from './primitive-tuple';
import { compareCodePoints } from './m8/identity';
import type { DropIdentity } from './m8/contracts';

export function lootDropId(roundId:string, encounterId:string, sourceUnitId:string, slotOrdinal:number): string {
  if (![roundId,encounterId,sourceUnitId].every(v=>typeof v==='string' && v.length>0)
    || !Number.isSafeInteger(slotOrdinal) || slotOrdinal<0) throw new RangeError('Invalid loot identity');
  return JSON.stringify([roundId,encounterId,sourceUnitId,slotOrdinal]);
}
export function lootOrbId(roundId:string,encounterId:string,sourceUnitId:string,slotOrdinal:number):string {
  lootDropId(roundId,encounterId,sourceUnitId,slotOrdinal);
  return JSON.stringify(['orb',roundId,encounterId,sourceUnitId,slotOrdinal]);
}
export function lootEntryId(orbId:string,entryOrdinal:number):string {
  if (!Number.isSafeInteger(entryOrdinal)||entryOrdinal<0) throw new RangeError('Invalid orb entry');
  return JSON.stringify([orbId,entryOrdinal]);
}
export const lootReceiptId = (dropId:string):string => encodePrimitiveTuple([dropId,'grant']);
export const lootChoiceId = (dropId:string):string => JSON.stringify(['m8b-loot-choice',dropId]);
/** Freeze and direct award order. Numeric slot order is NOT canonical tuple text order. */
export function compareLootFreezeSlots(a:{readonly sourceUnitId:string;readonly slotOrdinal:number;readonly entryOrdinal?:number},b:{readonly sourceUnitId:string;readonly slotOrdinal:number;readonly entryOrdinal?:number}):number {
  return compareCodePoints(a.sourceUnitId,b.sourceUnitId) || a.slotOrdinal-b.slotOrdinal || (a.entryOrdinal??0)-(b.entryOrdinal??0);
}
/** Domain choice order, also used after restore; independent of UI and death-event order. */
export function compareLootChoices(a:Pick<DropIdentity,'dropId'>,b:Pick<DropIdentity,'dropId'>):number {
  return compareCodePoints(a.dropId,b.dropId);
}
