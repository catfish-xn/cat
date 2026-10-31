import {describe,it,expect} from 'vitest';
import {useConsumable,equipItem,nextRound,startMatchCombat,stepMatch} from '../src/simulation/match';
import {previewUseConsumable} from '../src/simulation/consumables';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {ITEM_DEFINITIONS} from '../src/simulation/content/items';
import type {MatchState} from '../src/simulation/match-types';
import type {ConsumableDefinitionId,ConsumableTarget} from '../src/simulation/consumable-types';
import {publicConsumables,accepted,finish} from './fixtures/r3r4-public';
// v26 D5 (7953c99a): the default route's first 2-1 card is now Spoils of War III, whose saves need replayed battle history;
// take the route's first quiet card instead (r3r4-public quietAugment) so every save below stays a plain B8 restore.
const tools:{id:ConsumableDefinitionId;kind:'component'|'completed'}[]=[{id:'magnetic-remover',kind:'component'},{id:'reforger',kind:'component'},{id:'reforger',kind:'completed'}];
function prepared(phase:MatchState['phase']){
 let state=publicConsumables(27566,true);
 if(phase!=='settlement')state=accepted(nextRound(state,state.round));
 if(phase==='choice')state=accepted(nextRound(finish(state),state.round));
 if(phase==='combat')state=accepted(startMatchCombat(state));
 expect(state.phase).toBe(phase);return state;
}
function target(state:MatchState,_tool:ConsumableDefinitionId,kind:'component'|'completed'):{state:MatchState;target:ConsumableTarget;itemId:string}{
 const item=state.items.find(i=>ITEM_DEFINITIONS[i.definitionId].kind===kind)!;
 const holder=state.preparation.units.find(u=>u.team==='player')!;
 state=accepted(equipItem(state,item.id,holder.id,2));
 return {state,target:{kind:'unit',unitId:holder.id},itemId:item.id};
}
describe('R4 public tools, four phases and restored source history',()=>{
 for(const phase of ['preparation','combat','choice','settlement'] as const)for(const {id:definitionId,kind} of tools){
  it(`${definitionId}/${kind} in ${phase}: real loot, once-only use, frozen battle and B8 restore`,()=>{
   const input=target(prepared(phase),definitionId,kind),state=input.state;
   expect(restoreMatch(serializeMatch(state))).toEqual(state);
   const tool=state.consumables.find(c=>c.definitionId===definitionId)!;
   const bytes=JSON.stringify(state),preview=previewUseConsumable(state,tool.consumableId,input.target);
   expect(preview.ok).toBe(true);expect(JSON.stringify(state)).toBe(bytes);
   const result=useConsumable(state,tool.consumableId,input.target),next=accepted(result);
   expect(next.consumables).toHaveLength(state.consumables.length-1);
   expect(next.combat).toBe(state.combat);expect(next.combatInputBasis).toBe(state.combatInputBasis);
   expect(next.pendingChoice).toBe(state.pendingChoice);expect(next.gold).toBe(state.gold);
   expect(next.rngState).toBe(state.rngState);expect(next.m8.loot).toBe(state.m8.loot);
   expect(next.battleSeedRngState).toBe(state.battleSeedRngState);
   if(definitionId==='magnetic-remover'){
    expect(next.items.find(i=>i.id===input.itemId)?.location).toEqual({kind:'inventory'});
    expect(next.nextItemSerial).toBe(state.nextItemSerial);expect(next.reforgeState).toBe(state.reforgeState);
   }else{
    const original=state.items.find(i=>i.id===input.itemId)!,output=next.items.find(i=>i.id===`item-${state.nextItemSerial}`)!;
    expect(next.items.some(i=>i.id===input.itemId)).toBe(false);expect(output.definitionId).not.toBe(original.definitionId);
    expect(ITEM_DEFINITIONS[output.definitionId].kind).toBe(ITEM_DEFINITIONS[original.definitionId].kind);
    expect(output.location).toEqual({kind:'inventory'});expect(next.nextItemSerial).toBe(state.nextItemSerial+1);
    expect(next.reforgeState.draws).toBeGreaterThan(state.reforgeState.draws);
   }
   expect(useConsumable(next,tool.consumableId,input.target)).toEqual({ok:false,state:next,reason:'unknown-consumable'});
   let copy=restoreMatch(serializeMatch(next));expect(copy).toEqual(next);
   if(phase==='combat'){
    let before=state,after=next;
    while(after.phase==='combat'){
     const a=stepMatch(before),b=stepMatch(after),c=stepMatch(copy);
     expect(c).toEqual(b);expect(b.state.combat).toEqual(a.state.combat);
     expect(b.events.filter(e=>e.domain==='combat')).toEqual(a.events.filter(e=>e.domain==='combat'));
     before=a.state;after=b.state;copy=c.state;
    }
    expect(restoreMatch(serializeMatch(after))).toEqual(after);
   }
  },30000);
 }
 it('rejects all tool target/phase failures without IDs, RNG, receipts, resources or events',()=>{
  const state=publicConsumables(27566,true),remover=state.consumables.find(c=>c.definitionId==='magnetic-remover')!,component=state.consumables.find(c=>c.definitionId==='reforger')!;
  const empty=state.preparation.units.find(u=>u.team==='player')!;
  const cases:[MatchState,string,ConsumableTarget,string][]=[
   [state,'missing',{kind:'unit',unitId:empty.id},'unknown-consumable'],
   [state,remover.consumableId,{kind:'item',itemId:state.items[0].id},'invalid-consumable-target'],
   [state,remover.consumableId,{kind:'unit',unitId:'missing'},'unknown-unit'],
   [state,remover.consumableId,{kind:'unit',unitId:empty.id},'no-removable-items'],
   [state,component.consumableId,{kind:'item',itemId:'missing'},'invalid-consumable-target'],
   [state,component.consumableId,{kind:'item',itemId:state.items.find(i=>ITEM_DEFINITIONS[i.definitionId].kind==='completed')!.id},'invalid-consumable-target'],
   [{...state,phase:'gameOver',combat:null},remover.consumableId,{kind:'unit',unitId:empty.id},'wrong-phase'],
  ];
  for(const [s,id,t,reason] of cases){const bytes=JSON.stringify(s),r=useConsumable(s,id,t);expect(r).toEqual({ok:false,state:s,reason});expect(r.state).toBe(s);expect(JSON.stringify(s)).toBe(bytes);}
 });
 it('rejects altered consumption RNG, output, double consumption and consumption before grant',()=>{
  let state=publicConsumables(27566,true);const tool=state.consumables.find(c=>c.definitionId==='reforger')!;
  const item=state.items.find(i=>ITEM_DEFINITIONS[i.definitionId].kind==='component')!;
  state=accepted(equipItem(state,item.id,state.preparation.units.find(u=>u.team==='player')!.id,0));
  const used=accepted(useConsumable(state,tool.consumableId,{kind:'unit',unitId:state.preparation.units.find(u=>u.team==='player')!.id}));
  for(const change of [
   (s:MatchState)=>Object.assign(s.reforgeState,{draws:s.reforgeState.draws+1}),
   (s:MatchState)=>{const f=s.resourceProvenance.entries.at(-1)!;if(f.kind==='consumable-used')Object.assign(f.record.output!,{definitionId:item.definitionId});},
   (s:MatchState)=>{const f=s.resourceProvenance.entries.at(-1)!;Object.assign(f,{roundId:'1-2'});},
  ]){const raw=structuredClone(used);change(raw);expect(()=>restoreMatch(raw)).toThrow();}
 });
});


it('a real dropped Thief parent retains its roll after removal/re-equip; reforging removes live children while frozen combat restores',()=>{
 // Restore the v15 public recipe seed; scheme A leaves its original drops unchanged.
 let state=publicConsumables(162,true);
 const parent=state.items.find(i=>i.definitionId==='thiefs-gloves')!,holder=state.preparation.units.find(u=>u.team==='player')!;
 expect(parent).toBeDefined();state=accepted(equipItem(state,parent.id,holder.id,2));
 const roll=state.equipmentState.rolls,draws=state.equipmentState.equipment;
 const remover=state.consumables.find(c=>c.definitionId==='magnetic-remover')!;
 state=accepted(useConsumable(state,remover.consumableId,{kind:'unit',unitId:holder.id}));
 expect(state.temporaryEquipment).toEqual([]);
 state=accepted(equipItem(state,parent.id,holder.id,0));
 expect(state.equipmentState.rolls).toEqual(roll);expect(state.equipmentState.equipment).toEqual(draws);
 state=accepted(nextRound(state,state.round));state=accepted(startMatchCombat(state));
 const frozen=state,tool=state.consumables.find(c=>c.definitionId==='reforger')!;
 state=accepted(useConsumable(state,tool.consumableId,{kind:'unit',unitId:holder.id}));
 expect(state.temporaryEquipment).toEqual([]);expect(state.combat).toBe(frozen.combat);
 expect(state.combatInputBasis).toBe(frozen.combatInputBasis);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 let original=frozen,copy=restoreMatch(serializeMatch(state));
 while(state.phase==='combat'){
  const a=stepMatch(original),b=stepMatch(state),c=stepMatch(copy);
  expect(b.state.combat).toEqual(a.state.combat);expect(c).toEqual(b);
  original=a.state;state=b.state;copy=c.state;
 }
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
},30000);
