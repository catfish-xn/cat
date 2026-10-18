import {compileNeutralEncounter} from '../src/simulation/neutral-encounter-compiler';
import {createCombatWithEvents,stepCombat} from '../src/simulation/combat';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {expect,it} from 'vitest';
import {initializeZephyr} from '../src/simulation/combat-g2-4b';
import {DEFAULT_BOARD} from '../src/simulation/board';
import {unit} from './combat-helpers';
import {createMatch,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {toCombatViewState} from '../src/simulation/combat-replay-view';

it('selects the enemy nearest the mirrored whirlwind, deterministically reserving distinct victims',()=>{
 const holder=(id:string)=>({...unit(id,'player',1,6),mechanics:[{mechanic:'g24Zephyr',values:{durationTicks:100,allyAttackSpeedBps:200},
   source:{ownerId:id,sourceKind:'item' as const,definitionId:'TFT_Item_Zephyr',instanceId:id+':item',effectIndex:1}}]});
 const input=[holder('b'),unit('far','enemy',0,0),unit('near','enemy',5,1),holder('a')];
 const result=initializeZephyr(input,DEFAULT_BOARD);
 expect(result.find(u=>u.id==='near')!.itemBanish).toEqual({ownerId:'a',itemInstanceId:'a:item',untilTick:100});
 expect(result.find(u=>u.id==='far')!.itemBanish?.ownerId).toBe('b');
 expect(initializeZephyr([...input].reverse(),DEFAULT_BOARD).sort((a,b)=>a.id.localeCompare(b.id)))
  .toEqual([...result].sort((a,b)=>a.id.localeCompare(b.id)));
 expect(input.every(u=>!('itemBanish' in u))).toBe(true);
});

it('removes all action/target opportunities until tick100, keeps the battle alive, and strictly restores absence',()=>{
 const grant=grantMechanicItem(createMatch(42),{receiptId:'zephyr',source:'test',definitionId:'TFT_Item_Zephyr'});
 if(!grant.ok)throw Error(grant.reason);
 const owner=grant.state.preparation.units.find(u=>u.team==='player')!;
 const equip=equipItem(grant.state,grant.state.items.at(-1)!.id,owner.id,0);if(!equip.ok)throw Error(equip.reason);
 const start=startMatchCombat(equip.state);if(!start.ok)throw Error(start.reason);
 let current=start.state;const victim=current.combat!.units.find(u=>u.itemBanish)!;
 expect(victim).toBeDefined();
 expect(current.combat!.units.find(u=>u.id===owner.id)!.attackSpeedBonusBps).toBe(200);
 for(let n=0;n<100;n++){
   if([0,1,50,99].includes(n))expect(restoreMatch(serializeMatch(current))).toEqual(current);
   const next=stepMatch(current);current=next.state;
   if(current.combat!.tick<100){
     const absent=current.combat!.units.find(u=>u.id===victim.id)!;
     expect(absent.hp).toBe(victim.hp);expect(absent.runtime?.attackCount).toBe(0);expect(absent.runtime?.castCount).toBe(0);
     expect(next.events.filter(e=>e.type==='attack'&&(e.attackerId===victim.id||e.targetId===victim.id))).toHaveLength(0);
     expect(next.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.targetId===victim.id)).toHaveLength(0);
     expect(toCombatViewState(current.combat!).units.find(u=>u.id===victim.id)!.banished).toBe(true);
     expect(current.combat!.status).toBe('running');
   }
 }
 expect(current.combat!.tick).toBe(100);
 expect(toCombatViewState(current.combat!).units.find(u=>u.id===victim.id)!.banished).toBe(false);
 expect(restoreMatch(serializeMatch(current))).toEqual(current);
 const forged=structuredClone(current);Object.assign(forged.combat!.units.find(u=>u.id===victim.id)!.itemBanish!,{untilTick:101});
 expect(()=>restoreMatch(forged)).toThrow('Zephyr');
 const forgedHp=structuredClone(current);Object.assign(forgedHp.combat!.units.find(u=>u.id===victim.id)!,{hp:1});
 expect(()=>restoreMatch(forgedHp)).toThrow('Zephyr');
 while(current.phase==='combat')current=stepMatch(current).state;
 expect(restoreMatch(serializeMatch(current))).toEqual(current);
});

it.each(['2-7','3-7','4-7'])('%s neutral passives/openings never act through banishment',roundId=>{
 const encounter=compileNeutralEncounter(roundId),base=createMatch(42);
 const army={...base,preparation:{...base.preparation,units:[
  {id:'player-test',definitionId:'lux',starLevel:3 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:3,row:4}}},
  ...encounter.deployment]}};
 const grant=grantMechanicItem(army,{receiptId:'neutral-zephyr',source:'test',definitionId:'TFT_Item_Zephyr'});if(!grant.ok)throw Error(grant.reason);
 const equip=equipItem(grant.state,grant.state.items.at(-1)!.id,'player-test',0);if(!equip.ok)throw Error(equip.reason);
 let state=createCombatWithEvents(equip.state.preparation,buildStrategySnapshot(equip.state),'neutral-banish',42).state;
 const victim=state.units.find(u=>u.itemBanish)!;
 for(let n=0;n<100&&state.status==='running';n++){
  const next=stepCombat(state);state=next.state;
  if(state.tick<100){
   expect(state.units.find(u=>u.id===victim.id)!.hp).toBe(victim.hp);
   expect(next.events.filter(e=>e.type==='movement'&&e.unitId===victim.id)).toHaveLength(0);
   expect(next.events.filter(e=>e.type==='attack'&&(e.attackerId===victim.id||e.targetId===victim.id))).toHaveLength(0);
  }
 }
});
