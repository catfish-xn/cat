import {expect,it} from 'vitest';
import {createMatch,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {createCombatWithEvents,stepCombat,type CombatState} from '../src/simulation/combat';
import {createTrenchCopy} from '../src/simulation/combat-g2-4b-trench';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {compileBattle,resolveTwoSidedBattle} from '../src/simulation/two-sided-battle';
import {snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import {toCombatReplay,applyCombatReplayTick,toCombatViewState} from '../src/simulation/combat-replay-view';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
const coat='TFT_Item_Artifact_SuspiciousTrenchCoat';
function equipped(champion?:string){
 let base=createMatch(42);
 if(champion)base={...base,preparation:{...base.preparation,units:base.preparation.units.map(u=>u.team==='player'?{...u,definitionId:champion,starLevel:2,location:{kind:'board',cell:{col:3,row:6}}}:u)}};
 const grant=grantMechanicItem(base,{receiptId:'trench-runtime',source:'test',definitionId:coat});if(!grant.ok)throw Error(grant.reason);
 const owner=grant.state.preparation.units.find(u=>u.team==='player')!;
 const equip=equipItem(grant.state,grant.state.items.at(-1)!.id,owner.id,0);if(!equip.ok)throw Error(equip.reason);
 return equip.state;
}
function combat(){const state=equipped();return createCombatWithEvents(state.preparation,buildStrategySnapshot(state),'trench-runtime').state;}
function quietAt(bps:number):CombatState {const s=combat();return {...s,units:s.units.map(u=>({...u,hp:u.team==='player'?Math.floor(u.maxHp*bps/10000):u.hp,cooldownTicks:100,mana:0,moveCooldownTicks:5}))};}
it.each([5000,4999])('splits at %i bps into three full-health fresh IDs without recursive coat',bps=>{
 const state=quietAt(bps),owner=state.units.find(u=>u.team==='player')!;
 const result=stepCombat(state),copies=result.state.units.filter(u=>u.itemSummon?.kind==='trench');
 expect(copies).toHaveLength(3);expect(result.state.units.some(u=>u.id===owner.id)).toBe(false);
 expect(result.state.removedUnitIds).toContain(owner.id);
 expect(new Set(copies.map(u=>u.id)).size).toBe(3);
 for(const u of copies){expect(u.hp).toBe(Math.floor(owner.maxHp*.3));expect(u.maxHp).toBe(u.hp);expect(u.mechanics?.some(m=>m.mechanic==='g24Trench')).toBe(false);expect(u.runtime).toMatchObject({attackCount:0,castCount:0,permanentAdBps:0});}
 expect(result.events.filter(e=>e.type==='unitRemoved')).toHaveLength(1);
 expect(result.events.filter(e=>e.type==='unitSpawned')).toHaveLength(3);
 let after=result.state;for(let i=0;i<5;i++)after=stepCombat(after).state;
 expect(after.trenchSplits).toHaveLength(1);
 expect(state.units).toContain(owner);
});
it('does not trigger above half health or on lethal damage',()=>{
 expect(stepCombat(quietAt(5100)).state.trenchSplits).toBeUndefined();
 const base=quietAt(10000),player=base.units.find(u=>u.team==='player')!;
 const state={...base,units:base.units.map(u=>u.team==='player'?{...u,hp:1,cell:{col:3,row:4}}:{...u,cell:{col:3,row:3},cooldownTicks:0,attackDamage:9999,attackDamageBase:9999})};
 const next=stepCombat(state);expect(next.state.trenchSplits).toBeUndefined();expect(next.state.units.find(u=>u.id===player.id)!.alive).toBe(false);
});
it('rebuilds static champion, form and item declarations without inheriting transient buffs or counters',()=>{
 const state=equipped('jayce'),start=createCombatWithEvents(state.preparation,buildStrategySnapshot(state),'trench-form').state;
 const owner=start.units.find(u=>u.definitionId==='jayce')!,item=owner.mechanics!.find(m=>m.mechanic==='g24Trench')!;
 const dirty={...owner,hp:100,mana:99,cooldownTicks:17,moveCooldownTicks:4,shield:500,shieldExpiresAtTick:30,runtime:{...owner.runtime!,attackCount:13,castCount:4,permanentAdBps:250,attackSpeedBps:9000},itemMogulHits:[{packetId:'old',tick:1}],deferredItemDamage:[{packetId:'old',startedAtTick:1,amount:90,paid:0,elapsedTicks:0}],g23:{ascension:null,conquestTakedowns:['x'],experimentTakedowns:['x'],cuts:{x:3},stationaryTicks:55,lastCell:owner.cell,absorbed:[],highRoller:[]}};
 const copy=createTrenchCopy(dirty,item,0,{col:2,row:4},10);
 expect(copy).toMatchObject({definitionId:'jayce',starLevel:2,form:owner.form,cooldownTicks:0,moveCooldownTicks:0,shield:0,targetId:null});
 expect(copy.ability).toEqual(owner.ability);expect(copy.itemSummon!.formCell).toEqual(owner.startingCell??owner.cell);
 expect(copy.runtime).toMatchObject({attackCount:0,castCount:0,permanentAdBps:0,attackSpeedBps:0});
 expect(copy.g23).toBeUndefined();expect(copy.deferredItemDamage).toBeUndefined();expect(copy.itemMogulHits).toBeUndefined();
 expect(copy.sources!.every(s=>s.source.ownerId===copy.id)).toBe(true);
 const split=stepCombat({...start,units:start.units.map(u=>u.id===owner.id?{...u,hp:Math.floor(u.maxHp/2),runtime:{...u.runtime!,permanentAdBps:250}}:{...u,cooldownTicks:100})}).state;
 expect(split.trenchSplits![0].permanentAdBps).toBe(250);
 for(const child of split.units.filter(u=>u.itemSummon?.kind==='trench'))expect(split.units.some(u=>u.id===child.id+':g23-forge')).toBe(true);
});
it('preserves preparation, items and deterministic compact replay across both seats',()=>{
 const round=getCatalogRoundById('2-1');
 const seat=()=>{const s=equipped();return {...s,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...s.m8,round},preparation:{...s.preparation,units:s.preparation.units.filter(u=>u.team==='player')}}};
 const state=equipped(),started=startMatchCombat(state);if(!started.ok)throw Error(started.reason);
 let current=started.state;while(current.phase==='combat')current=stepMatch(current).state;
 expect(current.items).toEqual(state.items);expect(current.preparation.units.some(u=>u.id.startsWith('["g24-summon"'))).toBe(false);expect(current.preparation.units.find(u=>u.id==='unit-1')).toEqual(state.preparation.units.find(u=>u.id==='unit-1'));
 const result=resolveTwoSidedBattle(compileBattle(snapshotForBattle(seat(),'A'),snapshotForBattle(seat(),'B'),42),1201),replay=toCombatReplay(result);
 expect(result.terminal.trenchSplits!.length).toBeGreaterThan(0);
 let actual=result.initial,view=replay.initial;
 for(const frame of replay.ticks){if(frame.tick>0)actual=stepCombat(actual).state;view=applyCombatReplayTick(view,frame);expect(view).toEqual(toCombatViewState(actual));}
 expect(view).toEqual(replay.terminal);
});
it('waits for the entire damage batch, with two incoming packets and a single replacement',()=>{
 const base=quietAt(5100),player=base.units.find(u=>u.team==='player')!;
 const state={...base,units:base.units.map((u,i)=>u.team==='player'?{...u,cell:{col:3,row:4}}:{...u,cell:{col:i===0?2:3,row:3},cooldownTicks:0,attackDamage:20,attackDamageBase:20})};
 const result=stepCombat(state);
 expect(result.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.targetId===player.id)).toHaveLength(2);
 expect(result.state.trenchSplits).toHaveLength(1);
 expect(result.events.filter(e=>e.type==='unitRemoved'&&e.unitId===player.id)).toHaveLength(1);
});
it('starts copied periodic item clocks at birth and removes the replaced Jayce forge',()=>{
 const state=equipped('jayce'),ownerId=state.preparation.units.find(u=>u.team==='player')!.id;
 const grant=grantMechanicItem(state,{receiptId:'trench-clock',source:'test',definitionId:'archangel'});if(!grant.ok)throw Error(grant.reason);
 const equip=equipItem(grant.state,grant.state.items.at(-1)!.id,ownerId,1);if(!equip.ok)throw Error(equip.reason);
 let start=createCombatWithEvents(equip.state.preparation,buildStrategySnapshot(equip.state),'trench-clock').state;
 for(let i=0;i<7;i++)start=stepCombat({...start,units:start.units.map(u=>({...u,cooldownTicks:100,mana:0}))}).state;
 const owner=start.units.find(u=>u.id===ownerId)!;
 const split=stepCombat({...start,units:start.units.map(u=>({...u,hp:u.id===ownerId?Math.floor(owner.maxHp/2):u.hp,cooldownTicks:100,mana:0}))});
 expect(split.state.units.some(u=>u.id===ownerId+':g23-forge')).toBe(false);
 expect(split.events.some(e=>e.type==='unitRemoved'&&e.unitId===ownerId+':g23-forge')).toBe(true);
 for(const clone of split.state.units.filter(u=>u.itemSummon?.kind==='trench')){
  const clock=clone.mechanismState!.periodicTasks.find(t=>t.source.definitionId==='archangel')!;
  expect(clock).toBeDefined();expect(clock.pulseOrdinal).toBe(0);expect(clock.nextPulseAtTick).toBe(split.state.tick+clock.periodTicks);
  expect(clone.mechanismState!.sampledAtTick).toBe(split.state.tick);
  expect(clone.mechanismState!.statuses).toHaveLength(0);
 }
 const tracked=split.state.units.find(u=>u.itemSummon?.kind==='trench')!;
 const pulse=tracked.mechanismState!.periodicTasks.find(t=>t.source.definitionId==='archangel')!.nextPulseAtTick;
 let current=split.state;
 while(current.tick<pulse){
  const advanced=stepCombat({...current,units:current.units.map(u=>({...u,cooldownTicks:100,mana:0}))});
  current=advanced.state;
  const copy=current.units.find(u=>u.id===tracked.id)!;
  expect(copy.runtime!.abilityPowerFlat).toBe(current.tick===pulse?30:0);
  const pulses=advanced.events.filter(e=>e.type==='statChanged'&&e.unitId===tracked.id&&e.source.definitionId==='archangel');
  expect(pulses).toHaveLength(current.tick===pulse?1:0);
 }
});
