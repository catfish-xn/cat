import {expect,it} from 'vitest';
import {createMatch,startMatchCombat,stepMatch,type MatchState} from '../src/simulation/match';
import {restoreMatch} from '../src/simulation/serialization';
import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import {validateG23Progress,createG23Progress} from '../src/simulation/g2-3-match-progress';
import {advanceG23Economy} from '../src/simulation/g2-3-economy';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {g23FormDefinitionId} from '../src/simulation/g2-3-forms';
import {resolveUnitForm} from '../src/simulation/seat-mechanics/forms';
import {G23_UNITS} from '../src/simulation/content/g2-3-units';
import {validateResourceReceipts,foldResourceProvenance,RESOURCE_PROVENANCE_VERSION} from '../src/simulation/resource-provenance';
import {g23JunkerMenu} from '../src/simulation/g2-3-junker';
import {openG23Choice} from '../src/simulation/g2-3-runtime';
import {choiceTimeoutOption} from '../src/simulation/seat-mechanics';
import {freezeContent} from '../src/simulation/content/freeze';

const battle=()=>{let state=startMatchCombat(createMatch(42)).state;while(state.phase==='combat')state=stepMatch(state).state;return state;};
it.each([null,{},'bad',[null],{length:0}])('corrupt mechanic receipts %j reject uniformly before resource validation',receipts=>{
 const state=structuredClone(createMatch(42));Object.assign(state.seatMechanics!,{receipts});
 for(const input of [state,JSON.stringify(state)])expect(()=>restoreMatch(input)).toThrow(/Invalid Match save/);
});
it('removed combat ids are strings, unique and disjoint from the active roster',()=>{
 const state=battle();
 for(const ids of [null,'x',[1],['gone','gone'],[state.combat!.units[0].id]]){
  const bad=structuredClone(state);Object.assign(bad.combat!,{removedUnitIds:ids});
  for(const input of [bad,JSON.stringify(bad)])expect(()=>restoreMatch(input)).toThrow(/Invalid Match save/);
 }
 const good={...state,combat:{...state.combat!,removedUnitIds:['old-summon']}} as MatchState;
 expect(restoreMatch(JSON.stringify(good))).toEqual(good);
});
it('restores the missing carousel unit/item birth authority and rejects duplicate or forged bindings',()=>{
 const receipt={id:'pool:carousel:1-1:A',carouselId:'pool:carousel:1-1',seatId:'A',slot:0,definitionId:'maddie',itemId:'sword',holdingSource:'pool:carousel:1-1:A',unitId:'unit-1',itemInstanceId:'item-1',status:'granted' as const};
 const context={scheduleReceipts:[],lootReceipts:[],carouselReceipts:[receipt],throughRoundOrdinal:1,carouselOpening:true,combatSettlements:[]};
 const births=validateResourceReceipts(context);
 expect(births.get(`carousel-unit:${receipt.id}`)).toEqual({kind:'unit',id:'unit-1',definitionId:'maddie',roundId:'1-2'});
 expect(births.get(`carousel-item:${receipt.id}`)).toEqual({kind:'item',id:'item-1',definitionId:'sword',roundId:'1-2'});
 const entries=[{kind:'unit-acquired',unitId:'unit-1',source:{kind:'carousel',receiptId:receipt.id}},{kind:'item-acquired',itemId:'item-1',source:{kind:'carousel',receiptId:receipt.id}}].map((e,sequence)=>({...e,sequence,roundId:'1-2'}));
 expect(foldResourceProvenance({version:RESOURCE_PROVENANCE_VERSION,entries},context)).toMatchObject({units:[{id:'unit-1',definitionId:'maddie',starLevel:1}],items:[{id:'item-1',definitionId:'sword'}]});
 expect(()=>validateResourceReceipts({...context,carouselReceipts:[receipt,receipt]})).toThrow();
 expect(()=>validateResourceReceipts({...context,carouselReceipts:[{...receipt,holdingSource:'forged'}]})).toThrow();
});
it('Titan removes all paid upgrades from later armories and leaves a free timeout',()=>{
 const base=createMatch(42),p=readG23Progress(base)!;
 const state=writeG23Progress({...base,preparation:{...base.preparation,units:[{id:'rumble',definitionId:'rumble',starLevel:3 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:0,row:4}}}]}},
 {...p,junkerRounds:6,junkerPurchases:[{id:'g23:junker:1',round:1,unitId:'rumble',upgrade:'junkyard-titan',cost:0}]});
 expect(g23JunkerMenu(state)?.choices).toEqual(['finishing-touch']);
 const choice=openG23Choice(state).state.pendingChoice!;
 expect(choiceTimeoutOption(choice)).toBe('finishing-touch');
 expect(choice.payload?.kind==='armory'&&choice.payload.prices['finishing-touch']).toBe(0);
});
it('all four combat forms use the shared row resolver, including out-of-zone rows',()=>{
 for(const id of ['elise','swain','jayce','gangplank'])for(const team of ['player','enemy'] as const)for(let row=-1;row<=8;row++){
  expect(g23FormDefinitionId(id,team,row)).toBe(resolveUnitForm(G23_UNITS[id],team,{kind:'board',cell:{col:0,row}})==='ranged'?id+'-ranged':id);
 }
 expect(g23FormDefinitionId('lux','player',7)).toBe('lux');
});
it('exact-content economy reuse still validates every aggregate, round bound and mutable receipt on every call',()=>{
 const facts={battleId:'one',round:1,roundKind:'pve' as const,result:'win' as const,conquerorTier:2,conquestTakedowns:['enemy'],chemBaronTier:0,alliedDeaths:0,rumbleStar:0 as const,highRollerGold:0};
 const p=advanceG23Economy(createG23Progress(42),facts).progress;
 validateG23Progress(p,42,1);validateG23Progress(structuredClone(p),42,1);
 expect(()=>validateG23Progress(p,42,0)).toThrow();
 const mutable=structuredClone(p);validateG23Progress(mutable,42,1);
 Object.assign(mutable,{rngDraws:99});expect(()=>validateG23Progress(mutable,42,1)).toThrow();
 Object.assign(mutable,{rngDraws:p.rngDraws});Object.assign(mutable.economyReceipts[0],{gold:100});
 expect(()=>validateG23Progress(mutable,42,1)).toThrow();
 const next=advanceG23Economy(p,{...facts,battleId:'two',round:2}).progress;
 expect(()=>validateG23Progress(freezeContent(next),42,2)).not.toThrow();
});
it('reward atom reuse is immutable and keys the whole descriptor plus seed',()=>{
 const bundle={id:'reward',round:1,source:'conqueror' as const,tier:1,reward:{Gold:3}};
 const atoms=g23RewardAtoms(bundle,42);
 expect(g23RewardAtoms(structuredClone(bundle),42)).toBe(atoms);
 expect(g23RewardAtoms(bundle,43)).not.toBe(atoms);
 expect(Object.isFrozen(atoms[0])).toBe(true);
 bundle.reward.Gold=9;expect(g23RewardAtoms(bundle,42)[0].gold).toBe(9);
 expect(atoms[0].gold).toBe(3);
});
