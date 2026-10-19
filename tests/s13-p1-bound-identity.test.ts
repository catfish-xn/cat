import {expect,it} from 'vitest';
import {traceBoundUnitIdentity} from '../src/simulation/bound-unit-identity';
import type {ResourceProvenanceEntry} from '../src/simulation/resource-provenance';
const upgrade={type:'unitUpgraded' as const,definitionId:'lux',survivorId:'unit-1',consumedIds:['unit-2','unit-3'],fromStar:1 as const,toStar:2 as const,location:{kind:'bench' as const,slot:0}};
const facts:ResourceProvenanceEntry[]=[{sequence:0,roundId:'4-6',kind:'unit-upgraded',acquisitionSequence:1,event:upgrade}];
it('follows consumed bound unit to actual survivor and then sale to null',()=>{
 expect(traceBoundUnitIdentity('unit-3',facts)).toBe('unit-1');
 expect(traceBoundUnitIdentity('unit-1',facts)).toBe('unit-1');
 expect(traceBoundUnitIdentity('unit-9',facts)).toBe('unit-9');
 const sale={sequence:1,roundId:'4-6',kind:'unit-sold' as const,unitId:'unit-1',context:'preparation' as const,goldGranted:3};
 expect(traceBoundUnitIdentity('unit-3',[...facts,sale])).toBe(null);
});
it('accepts verified postcombat and carousel upgrade fact shapes without changing originals',()=>{
 const later:ResourceProvenanceEntry[]=[{sequence:0,roundId:'4-6',kind:'unit-upgraded-after-combat',event:upgrade},{sequence:1,roundId:'4-6',kind:'carousel-unit-claimed',unitId:'unit-5',receiptId:'r',upgrades:[{...upgrade,fromStar:2,toStar:3,consumedIds:['unit-1','unit-4'],survivorId:'unit-5'}]}];
 const before=structuredClone(later);expect(traceBoundUnitIdentity('unit-3',later)).toBe('unit-5');expect(later).toEqual(before);
});
