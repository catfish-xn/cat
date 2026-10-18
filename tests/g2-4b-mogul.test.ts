import {expect,it} from 'vitest';
import {createMatch,equipItem,startMatchCombat,stepMatch} from '../src/simulation/match';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {restoreMatch,serializeMatch} from '../src/simulation/serialization';
import {readCombatStats} from '../src/simulation/combat-s13';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import {snapshotForBattle} from '../src/simulation/two-sided-snapshot';
import {compileBattle,startTwoSidedCombat} from '../src/simulation/two-sided-battle';
import {stepCombat,type CombatEvent} from '../src/simulation/combat';
import type {MatchState} from '../src/simulation/match-types';

function equip(state:MatchState){
 const g=grantMechanicItem(state,{receiptId:'mogul',source:'test',definitionId:'TFT7_Item_ShimmerscaleMogulsMail'});if(!g.ok)throw Error(g.reason);
 const owner=g.state.preparation.units.find(u=>u.team==='player')!;
 const e=equipItem(g.state,g.state.items.at(-1)!.id,owner.id,0);if(!e.ok)throw Error(e.reason);
 return {state:e.state,ownerId:owner.id};
}
it('tracks real positive damage packets and restores exact HP/resist stacks without allowing forged hits',()=>{
 const equipped=equip(createMatch(42)),start=startMatchCombat(equipped.state);if(!start.ok)throw Error(start.reason);
 let state=start.state;const initial=state.combat!.units.find(u=>u.id===equipped.ownerId)!;
 while(state.phase==='combat')state=stepMatch(state).state;
 const holder=state.combat!.units.find(u=>u.id===equipped.ownerId)!;
 expect(holder.itemMogulHits!.length).toBeGreaterThan(0);
 expect(holder.maxHp).toBe(initial.maxHp+7*holder.itemMogulHits!.length);
 expect(readCombatStats(holder,state.combat!).armor).toBe(initial.armor+holder.itemMogulHits!.length);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const bad=structuredClone(state),unit=bad.combat!.units.find(u=>u.id===equipped.ownerId)!;
 Object.assign(unit,{itemMogulHits:[...unit.itemMogulHits!,unit.itemMogulHits![0]]});
 expect(()=>restoreMatch(bad)).toThrow();
});

it('caps at35, grants the normal1gold immediately and then each160ticks with no RNG draw',()=>{
 const base=createMatch(42),round=getCatalogRoundById('2-1');
 const army:MatchState={...base,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...base.m8,round},
  preparation:{...base.preparation,units:[{id:'unit-1',definitionId:'steb',starLevel:3,team:'player',location:{kind:'board',cell:{col:3,row:4}}}]}};
 const equipped=equip(army);
 const input=compileBattle(snapshotForBattle(equipped.state,'A'),snapshotForBattle(army,'B'),42);
 // Isolate the stack clock with harmless one-point attacks and no spells.
 // Public-save authority is tested above with unmodified production inputs.
 const initial=startTwoSidedCombat(input);
 let combat={...initial,units:initial.units.map(u=>({...u,hp:100000,maxHp:100000,
   maxHpBasis:{base:100000,flat:0,bps:0,bonusBps:0},attackDamageBase:1,attackDamagePercentBps:0,attackSpeedBonusBps:10000,
   manaLockedUntilTick:1201}))};
 const events:CombatEvent[]=[];
 for(let tick=0;tick<1200&&combat.status==='running';tick++){
   const next=stepCombat(combat);combat=next.state as typeof combat;events.push(...next.events);
 }
 const result={initial,terminal:combat,events};
 const holder=result.terminal.units.find(u=>u.team==='player')!;
 expect(holder.itemMogulHits).toHaveLength(35);
 const full=holder.itemMogulHits!.at(-1)!.tick;
 const receipts=result.terminal.itemGoldReceipts!;
 expect(receipts[0]).toMatchObject({kind:'moguls-full',tick:full,gold:1,word:null});
 const death=result.events.find(e=>e.type==='death'&&e.unitId===holder.id);
 const through=death?.tick??result.terminal.tick;
 expect(receipts).toHaveLength(1+Math.floor((through-full)/160));
 expect(receipts.every(r=>r.gold===1&&r.word===null)).toBe(true);
 expect(result.terminal.itemRandomStreams).toEqual(result.initial.itemRandomStreams);
});
