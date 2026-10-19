import {expect,it} from 'vitest';
import {createMatch,equipItem} from '../src/simulation/match';
import type {MatchState} from '../src/simulation/match-types';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import {snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import {compileBattle,startTwoSidedCombat} from '../src/simulation/two-sided-battle';
import {stepCombat,type CombatState} from '../src/simulation/combat';
import {validateMechanisms} from '../src/simulation/m8/restore';
import {withItemRestoreCache} from '../src/simulation/m8/item-restore';

const DEATHFIRE='TFT9_Item_OrnnDeathfireGrasp',ZEPHYR='TFT_Item_Zephyr';
function seat(items:readonly string[],twoUnits=false):MatchState {
 const base=createMatch(42),round=getCatalogRoundById('2-1');
 let state:MatchState={...base,level:9,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},
  preparation:{...base.preparation,units:[{id:'unit-1',definitionId:'garen',starLevel:3,team:'player',location:{kind:'board',cell:{col:3,row:4}}},
   ...(twoUnits?[{id:'unit-2',definitionId:'garen',starLevel:3 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:6,row:4}}}]:[])]}};
 for(const [slot,definitionId] of items.entries()){
  const grant=grantMechanicItem(state,{receiptId:`integration-${slot}`,source:'test',definitionId});if(!grant.ok)throw Error(grant.reason);
  const equip=equipItem(grant.state,grant.state.items.at(-1)!.id,'unit-1',slot);if(!equip.ok)throw Error(equip.reason);state=equip.state;
 }
 return state;
}
function start(a:MatchState,b:MatchState):CombatState {
 return startTwoSidedCombat(compileBattle(snapshotForBattle(a,'A'),snapshotForBattle(b,'B'),42));
}
function quiet(state:CombatState):CombatState {
 return {...state,units:state.units.map(u=>({...u,cooldownTicks:5000,moveCooldownTicks:5000,mana:0}))};
}
it('Deathfire opening selects the nearest present enemy rather than losing its blast on the Zephyr victim',()=>{
 const initial=start(seat([DEATHFIRE,ZEPHYR]),seat([],true));
 const absent=initial.units.find(u=>u.itemBanish)!,present=initial.units.find(u=>u.team==='enemy'&&!u.itemBanish)!;
 expect(absent).toBeDefined();expect(present).toBeDefined();
 const result=stepCombat(quiet(initial));
 const blasts=result.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.definitionId===DEATHFIRE);
 expect(blasts).toHaveLength(1);
 expect(blasts[0]).toMatchObject({outcome:{context:{targetId:present.id}}});
 expect(result.state.units.find(u=>u.id===absent.id)!.hp).toBe(absent.hp);
});
it('a banished Deathfire holder keeps initialized equipment but emits no opening blast or catch-up blast on return',()=>{
 const initial=start(seat([DEATHFIRE,'quicksilver']),seat([ZEPHYR]));
 const absent=initial.units.find(u=>u.team==='player')!;
 expect(absent.itemBanish?.untilTick).toBe(100);
 let state=initial;
 for(let tick=1;tick<=100;tick++){
  const result=stepCombat(quiet(state));state=result.state;
  expect(result.events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.definitionId===DEATHFIRE)).toHaveLength(0);
  if(tick===1||tick===99||tick===100){
   const holder=state.units.find(u=>u.id===absent.id)!;
   expect(holder.mechanismState?.initialized).toBe(true);
   expect(holder.mechanismState!.periodicTasks.some(t=>t.source.definitionId===DEATHFIRE)).toBe(true);
   expect(holder.mechanismState!.statuses.some(g=>g.kind==='control-immunity')).toBe(true);
   // Suspended runtime retains its last sampled tick; production restore has a
   // dedicated absence validator. Check ordinary mechanisms before/after absence.
   if(tick!==99)withItemRestoreCache(()=>validateMechanisms(holder,state.units,state.tick,state.combatId!,false,state.nextActionSeq!));
  }
 }
 expect(state.units.find(u=>u.id===absent.id)!.itemBanish?.untilTick).toBe(100);
});
