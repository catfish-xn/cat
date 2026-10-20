import {expect,it} from 'vitest';
import {createMatch,deployMatchUnit,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem,grantMechanicUnit} from '../src/simulation/seat-mechanics';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

it.each([4,6])('public Match Mirror Jayce row %s restores its independent forge at opening, midcombat and terminal',row=>{
 let state=createMatch(42);
 const starter=state.preparation.units.find(u=>u.team==='player')!;
 const bench=deployMatchUnit(state,starter.id,{kind:'bench',slot:0});if(!bench.ok)throw Error(bench.reason);state=bench.state;
 const jayce=grantMechanicUnit(state,{receiptId:'restore-jayce',source:'test',definitionId:'jayce'});if(!jayce.ok)throw Error(jayce.reason);state=jayce.state;
 const holder=state.preparation.units.find(u=>u.definitionId==='jayce')!;
 const deploy=deployMatchUnit(state,holder.id,{kind:'board',cell:{col:3,row}});if(!deploy.ok)throw Error(deploy.reason);state=deploy.state;
 const mirror=grantMechanicItem(state,{receiptId:'restore-mirror',source:'test',definitionId:'TFT9_Item_OrnnTrickstersGlass'});if(!mirror.ok)throw Error(mirror.reason);state=mirror.state;
 const equip=equipItem(state,state.items.at(-1)!.id,holder.id,0);if(!equip.ok)throw Error(equip.reason);state=equip.state;
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const start=startMatchCombat(state);if(!start.ok)throw Error(start.reason);state=start.state;
 const copy=state.combat!.units.find(u=>u.itemSummon?.kind==='mirror')!;
 expect(copy).toBeDefined();expect(copy.form).toBe(row===4?'melee':'ranged');
 const forgeId=`${copy.id}:g23-forge`;
 expect(state.combat!.units.find(u=>u.id===forgeId)).toMatchObject({definitionId:'g23-forge',maxHp:1000});
 expect(restoreMatch(state)).toEqual(state);expect(restoreMatch(serializeMatch(state))).toEqual(state);
 for(let n=0;n<5&&state.phase==='combat';n++)state=stepMatch(state).state;
 expect(state.combat!.tick).toBeGreaterThan(0);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const forged=structuredClone(state);Object.assign(forged.combat!.units.find(u=>u.id===forgeId)!,{maxHp:99999});
 expect(()=>restoreMatch(forged)).toThrow('Mirror forge');
 while(state.phase==='combat')state=stepMatch(state).state;
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 expect(state.items.filter(i=>start.state.items.some(old=>old.id===i.id))).toEqual(start.state.items);
 expect(state.items.filter(i=>!start.state.items.some(old=>old.id===i.id)).map(i=>i.definitionId)).toEqual(['belt']);
});
