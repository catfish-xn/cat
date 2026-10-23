import {expect,it} from 'vitest';
import {allocateDamage,permissionsFor,validateDamageContext} from '../src/simulation/m8/damage';
import type {DamageContext} from '../src/simulation/m8/contracts';
import {deployMatchUnit,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {reachRound,accepted} from './match-helpers';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {advanceDeferredItemDamage} from '../src/simulation/g2-4b-item-kernel';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const context:DamageContext={source:{ownerId:'a',sourceKind:'attack',definitionId:'attack',instanceId:'a',effectIndex:0,parentItemInstanceId:null},
  targetId:'b',damageType:'physical',delivery:'basic-attack',actionSeq:0,rootActionSeq:0,parentPacketId:null,
  triggeringCastActionSeq:null,packetId:'p',packetOrdinal:0,equipmentDepth:0,redirected:false,area:false,critEligibility:'never',permissions:[]};

it('defers exactly half after shields, balances the packet and can prevent immediate lethal damage',()=>{
  const r=allocateDamage(context,{raw:400,prevented:0,mitigated:200,critical:false},90,[{key:'s',remaining:40}],5000);
  expect(r.shields).toEqual([{key:'s',remaining:0}]);
  expect(r.outcome).toMatchObject({mitigated:200,absorbed:40,deferred:80,hpDamage:80,overkill:0,killingPacket:false});
  expect(r.hpAfter).toBe(10);
  expect(allocateDamage(context,{raw:400,prevented:0,mitigated:200,critical:false},90,[],5000).outcome)
    .toMatchObject({deferred:100,hpDamage:90,overkill:10,killingPacket:true});
});

it('fully shielded and prevented packets do not create debt; debt cannot revive or recurse',()=>{
  for(const mitigated of [0,40])expect(allocateDamage(context,{raw:40,prevented:40-mitigated,mitigated,critical:false},10,[{key:'s',remaining:40}],5000).outcome.deferred).toBeUndefined();
  const deferred:DamageContext={...context,damageType:'true',delivery:'equipment-proc',deferredPayment:true,equipmentDepth:1};
  expect(permissionsFor(deferred)).toEqual([]);
  expect(()=>validateDamageContext(deferred)).not.toThrow();
  expect(()=>validateDamageContext({...deferred,permissions:['omnivamp']})).toThrow();
  const debt={packetId:'p',startedAtTick:10,amount:160,elapsedTicks:0,paid:0};
  const first=advanceDeferredItemDamage(debt,11,2,80);
  expect(first.hpAfter).toBe(1);expect(first.debt.paid).toBe(2);
  const healed=advanceDeferredItemDamage(first.debt,12,100,80);
  expect(healed.hpAfter).toBe(98); // clipped point is consumed, not carried to a later heal
  expect(advanceDeferredItemDamage(debt,90,0,80).hpAfter).toBe(0);
});

it('public Match persists real debts, reproduces continuation and rejects forged debt timing/identity',()=>{
  // v22: every stage-1 PvE fight is now opening crabs, which never damage the holder,
  // so take the first real fight (2-1) where the holder actually receives packets.
  const granted=grantMechanicItem(reachRound('2-1',true,42),{receiptId:'defiance',source:'test',definitionId:'TFT4_Item_OrnnDeathsDefiance'});
  if(!granted.ok)throw Error(granted.reason);
  const owner=granted.state.preparation.units.find(u=>u.team==='player')!;
  const fielded=accepted(deployMatchUnit(granted.state,owner.id,{kind:'board',cell:{col:3,row:4}}));
  const equipped=equipItem(fielded,fielded.items.at(-1)!.id,owner.id,0);
  if(!equipped.ok)throw Error(equipped.reason);
  const start=startMatchCombat(equipped.state);if(!start.ok)throw Error(start.reason);
  let state=start.state,found=false;
  expect(restoreMatch(serializeMatch(state))).toEqual(state);
  for(let n=0;n<400&&state.phase==='combat';n++){
    state=stepMatch(state).state;
    const holder=state.combat!.units.find(u=>u.id===owner.id)!;
    if(!holder.deferredItemDamage?.length)continue;
    found=true;
    const restored=restoreMatch(serializeMatch(state));
    expect(restored).toEqual(state);expect(stepMatch(restored)).toEqual(stepMatch(state));
    for(const patch of [{paid:9999},{elapsedTicks:80},{packetId:'["forged"]'}]){
      const forged=structuredClone(state),unit=forged.combat!.units.find(u=>u.id===owner.id)!;
      Object.assign(unit.deferredItemDamage![0],patch);
      expect(()=>restoreMatch(forged)).toThrow();
    }
    break;
  }
  expect(found).toBe(true);
});
