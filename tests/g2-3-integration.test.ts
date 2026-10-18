import {expect,it} from 'vitest';
import {createMatch,sellUnit,selectChoice,forfeitPendingChoice,type MatchState} from './fixtures/recorded-match';
import {serializeMatch,restoreMatch} from './fixtures/history-evidence';
import {ITEM_DEFINITIONS} from '../src/simulation/content/g2-3-item-registry';
import {G23_RADIANT_MAPPING} from '../src/simulation/content/g2-3-special-item-source';
import {validateContent} from '../src/simulation/validate-content';
import {grantMechanicItem,grantMechanicGold,grantMechanicUnit,radiantVersionOf,openMechanicChoice,choiceTimeoutOption} from '../src/simulation/seat-mechanics';
import {toPrivateSeatView} from '../src/simulation/private-seat-view';
import {readG23Progress,writeG23Progress} from '../src/simulation/g2-3-state';
import {openG23Choice} from '../src/simulation/g2-3-runtime';
import {G23_JUNKER_PAID,g23JunkerMenu} from '../src/simulation/g2-3-junker';
import {getPlayerDeploymentCount} from '../src/simulation/game';
import {eliminationResult,createCombatWithEvents,stepCombat} from '../src/simulation/combat';
import {buildStrategySnapshot} from '../src/simulation/strategy-snapshot';
import {unit} from './combat-helpers';
import {recordedCrownBattle} from './crown-history-helpers';
const ok=<T extends {ok:boolean}>(r:T):Extract<T,{ok:true}>=>{if(!r.ok)throw Error(JSON.stringify(r));return r as Extract<T,{ok:true}>;};
const archives = new Map<string, ReturnType<typeof recordedCrownBattle>['battles']>();
const evidence = (s:MatchState) => archives.get(JSON.stringify(s.roundResults)) ?? [];
const settled=(s:MatchState)=>{const live=recordedCrownBattle(s);archives.set(JSON.stringify(live.state.roundResults),live.battles);return live.state;};
it('the full registry admits source apiNames to grants, choices, validation and text/object restoration',()=>{
 expect(()=>validateContent()).not.toThrow();
 for(const id of ['TFT13_Crime_Bronze_ChemGrips','TFT5_Item_JeweledGauntletRadiant']){
  const granted=ok(grantMechanicItem(createMatch(42),{receiptId:'registry:'+id,source:'registry-test',definitionId:id}));
  expect(granted.events.at(-1)).toMatchObject({type:'mechanicGranted'});
  expect(restoreMatch(serializeMatch(granted.state))).toEqual(granted.state);
  expect(restoreMatch(structuredClone(granted.state))).toEqual(granted.state);
  const opened=ok(openMechanicChoice(createMatch(42),{choiceId:'forge:'+id,returnPhase:'preparation',offers:[id],payload:{kind:'forge',source:'registry-test',timeoutOption:id}}));
  expect(ok(selectChoice(opened.state,'forge:'+id,0,id)).state.items.at(-1)?.definitionId).toBe(id);
 }
});
it('every radiant points uniquely to a completed item, has no recipe, and is queryable by the generic interface',()=>{
 for(const [base,radiant] of Object.entries(G23_RADIANT_MAPPING)){
  expect(ITEM_DEFINITIONS[radiant]).toMatchObject({kind:'radiant',radiantOf:base});
  expect(ITEM_DEFINITIONS[radiant].recipe).toBeUndefined();
  expect(radiantVersionOf(base)).toBe(radiant);
 }
 const id=Object.values(G23_RADIANT_MAPPING)[0];
 expect(()=>validateContent({items:{...ITEM_DEFINITIONS,[id]:{...ITEM_DEFINITIONS[id],radiantOf:'sword'}}})).toThrow();
});
it('current content creates one owner-visible mechanism container and never projects RNG or hidden history',()=>{
 const state=createMatch(42),view=toPrivateSeatView(state);
 for(const key of ['conqueror','academy','alchemist','junkerKing','experimentCells','radiantConversion'])expect(view.seatMechanics?.seat).toHaveProperty(key);
 expect(state).not.toHaveProperty('g23');expect(state.seatMechanics?.hidden).toHaveProperty('progress');
 expect(view.seatMechanics?.hidden).toEqual({});expect(view).not.toHaveProperty('g23');
 const detached=structuredClone(view.seatMechanics!.seat) as Record<string,unknown>;detached.radiantConversion=true;
 expect(readG23Progress(state)!.conquest.radiantConversion).toBe(false);
});
it('settled restoration counts post-boundary mechanic gold and pool-empty unit gold but never counts preparation grants twice',()=>{
 const before=ok(grantMechanicGold(createMatch(42),{receiptId:'preparation',source:'test',amount:3})).state;
 const initial=settled(before);expect(restoreMatch(serializeMatch(initial,evidence(initial)),evidence(initial))).toEqual(initial);
 const gold=ok(grantMechanicGold(initial,{receiptId:'post-settlement',source:'test',amount:3}));
 const fallback=ok(grantMechanicUnit(gold.state,{receiptId:'empty-unit',source:'test',definitionId:'renata'},()=>({kind:'gold',quantity:2})));
 expect(fallback.receipt).toMatchObject({kind:'unit',resolution:'gold',gold:2});
 expect(fallback.state.gold).toBe(initial.gold+5);
 expect(restoreMatch(serializeMatch(fallback.state,evidence(fallback.state)),evidence(fallback.state))).toEqual(fallback.state);
 expect(restoreMatch(structuredClone(fallback.state),evidence(fallback.state))).toEqual(fallback.state);
 expect(()=>restoreMatch({...fallback.state,gold:fallback.state.gold-5})).toThrow();
 const bad=structuredClone(fallback.state);Object.assign(bad.roundResults.at(-1)!,{mechanicReceiptPrefixLength:0});
 expect(()=>restoreMatch(bad)).toThrow();
});
it.each(['g23-sion','g23-forge'])('%s cannot be sold, costs no population, and is excluded from player damage',definitionId=>{
 const base=createMatch(42),state={...base,preparation:{...base.preparation,units:[...base.preparation.units,{id:'body',definitionId,starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:1,row:4}}}]}};
 expect(getPlayerDeploymentCount(state.preparation)).toBe(1);
 expect(sellUnit(state,'body')).toEqual({ok:false,state,reason:'unit-not-sellable'});
 const fighter=unit('enemy','enemy',0,0),body=unit('body','player',1,4,{definitionId});
 expect(eliminationResult([body,fighter])).toBe(definitionId==='g23-forge'?'enemyWin':null);
});
it.each(['regular','exhausted','three-star'] as const)('%s armory opens a popup whose bot/timeout default is legal and free',mode=>{
 const initial=createMatch(42),p=readG23Progress(initial)!;
 const purchases=mode==='exhausted'?G23_JUNKER_PAID.map((upgrade,i)=>({id:`g23:junker:${i+1}`,round:1,unitId:'rumble',upgrade,cost:5})):[];
 const state=writeG23Progress({...initial,round:4,roundDefinitionId:'2-1',multiplayer:{version:'multiplayer-settlement-v1' as const,seatId:'A',status:'active' as const,receipts:[],forfeitedChoices:[]},m8:{...initial.m8,round:{...initial.m8.round,kind:'pvp' as const}},preparation:{...initial.preparation,units:[{id:'rumble',definitionId:'rumble',starLevel:mode==='three-star'?3 as const:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:0,row:4}}}]}},{...p,junkerRounds:3*(purchases.length+1),junkerPurchases:purchases});
 const menu=g23JunkerMenu(state)!;expect(menu).not.toBeNull();
 const opened=openG23Choice(state).state;expect(opened.pendingChoice?.kind).toBe('armory');
 const choice=opened.pendingChoice!,option=choiceTimeoutOption(choice)!;
 expect(choice.payload?.kind==='armory'&&choice.payload.prices[option]).toBe(0);
 const expired=ok(forfeitPendingChoice(opened,opened.round,choice.choiceId,0));
 expect(expired.state.gold).toBe(state.gold);
 expect(expired.state.seatMechanics?.receipts.at(-1)).toMatchObject({kind:'choice',choiceKind:'armory',price:0,timedOut:true});
});
it('starting summons use membership events; Sion emits its binding transition exactly once',()=>{
 const initial=createMatch(42),preparation={...initial.preparation,units:['morgana','vladimir','cassiopeia','jayce'].map((definitionId,i)=>({id:'p'+i,definitionId,starLevel:1 as const,team:'player' as const,location:{kind:'board' as const,cell:{col:i,row:4}}})).concat([])};
 const enemy={id:'enemy',definitionId:'garen',starLevel:1 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:0,row:0}}};
 const prep={...preparation,units:[...preparation.units,enemy]};
 const started=createCombatWithEvents(prep,buildStrategySnapshot({...initial,preparation:prep}),'spawn-test');
 expect(started.events.filter(e=>e.type==='unitSpawned')).toHaveLength(2);
 expect(started.events.filter(e=>e.type==='bindingChanged')).toMatchObject([{bound:true,reason:'combat-start'}]);
 const weakened={...started.state,units:started.state.units.map(u=>u.definitionId==='g23-sion'?{...u,hp:1}:u)};
 const next=stepCombat(weakened);expect(next.events.filter(e=>e.type==='bindingChanged')).toMatchObject([{bound:false,reason:'hp-threshold'}]);
 expect(stepCombat(next.state).events.filter(e=>e.type==='bindingChanged')).toHaveLength(0);
});
import {room,accept,batch,conserved} from './tp-helpers';
import {runSharedMatchCommand,nextSharedRound,refreshSharedShops} from '../src/simulation/shared-pool';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {deriveTraits} from '../src/simulation/trait-snapshot';
it.each([false,true])('shared settleRound uses its transaction policy for escrowed source chest heroes (empty=%s)',empty=>{
 const bundle={id:'g23:conqueror:3',round:1,source:'conqueror' as const,tier:3,reward:g23ConquerorReward(G23_CONQUEROR_CHESTS[2])};
 const definitionId=g23RewardAtoms(bundle,5)[0].options[0];
 let {pool,states}=room(empty?{irelia:3}:undefined,1),state=states[0];
 const first=batch(refreshSharedShops(pool,[state],1));pool=first.pool;state=first.states[0];
 // Public opening establishes the complete contiguous history and shared loot policy.
 for(let budget=0;state.roundDefinitionId!=='2-1'||state.pendingChoice;budget++){
  if(budget>8000)throw Error('opening budget');
  if(state.phase==='settlement'){
   const loot=accept(runSharedMatchCommand(pool,state,{type:'claimLoot',round:state.round}));pool=loot.pool;state=loot.state;
   if(state.phase==='choice')continue;
   const advanced=batch(nextSharedRound(pool,[state],state.round));pool=advanced.pool;state=advanced.states[0];
  }else{
   const command=state.phase==='choice'?{type:'timeoutChoice' as const,round:state.round,choiceId:state.pendingChoice!.choiceId,generation:state.pendingChoice!.generation}:state.phase==='combat'?{type:'step' as const}:{type:'startCombat' as const};
   const r=accept(runSharedMatchCommand(pool,state,command));pool=r.pool;state=r.state;
  }
 }
 // Deliberately queue an already earned tier-3 descriptor: tests settlement's grant boundary, not source eligibility.
 state=writeG23Progress(state,{...readG23Progress(state)!,rewards:[bundle]});
 const traits=deriveTraits(state.preparation,'player'),beforeGold=state.gold;
 const receipt={version:'multiplayer-settlement-v1' as const,settlementId:'g23-shared',battleId:'g23-battle',seatId:state.multiplayer!.seatId,round:state.round,roundId:state.roundDefinitionId,settlementEligible:true,result:'win' as const,damage:0,baseDamage:2,opposingSurvivors:0,growth:[],combatTicks:1,combatEventCount:1,
  g23Facts:{battleId:'g23-battle',round:state.round,roundKind:'pvp' as const,result:'win' as const,conquerorTier:traits.find(t=>t.traitId==='conqueror')?.tier??0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0 as const,highRollerGold:0}};
 const committed=accept(runSharedMatchCommand(pool,state,{type:'settleRound',receipt}));
 const grant=committed.state.seatMechanics!.receipts.find(r=>r.kind==='unit'&&r.definitionId===definitionId)!;
 expect(grant).toMatchObject({kind:'unit',resolution:empty?'gold':'held',gold:empty?4:0});
 expect(committed.state.gold).toBe(beforeGold+committed.state.roundResults.at(-1)!.income+(empty?4:0));
 expect(committed.events.some(e=>e.type==='mechanicGranted'&&e.receipt.receiptId===grant.receiptId)).toBe(true);
 conserved(committed.pool,[committed.state]);
 expect(runSharedMatchCommand(committed.pool,committed.state,{type:'settleRound',receipt})).toMatchObject({ok:false,reason:'duplicate-settlement'});
});
import {spawnCombatUnit,removeCombatUnit} from '../src/simulation/seat-mechanics/combat-events';
it('removed summon identities cannot be reused by a later spawn in the same battle',()=>{
 const base=settled(createMatch(42)).combat!;
 const body={...base.units[0],id:'new-summon',definitionId:'g23-forge',alive:true,cell:{col:6,row:7}};
 const source={ownerId:base.units[0].id,sourceKind:'ability' as const,definitionId:base.units[0].ability.id,instanceId:'cast-1',effectIndex:0};
 const spawned=spawnCombatUnit(base,body,source,base.tick),removed=removeCombatUnit(spawned.state,body.id,'expired',base.tick);
 expect(()=>spawnCombatUnit(removed.state,body,source,base.tick)).toThrow('Duplicate combat unit');
 expect(spawnCombatUnit(removed.state,{...body,id:'new-summon:2'},source,base.tick).events).toMatchObject([{type:'unitSpawned',unitId:'new-summon:2'}]);
});
it('the itemless source black-market bundle still opens a skippable popup and pays its units only once',()=>{
 const initial=createMatch(42),p=readG23Progress(initial)!,offer={id:'g23:market:itemless:1',tier:1,optionId:'TFT13_Crime_LootA4',round:1};
 const state=writeG23Progress(initial,{...p,chem:{...p.chem,shimmer:100,offeredThrough:1,offer}});
 const opened=openG23Choice(state).state;
 expect(opened.pendingChoice).toMatchObject({kind:'blackMarket',offers:['TFT13_Crime_LootA4'],payload:{grantItem:false,timeoutOption:'@skip'}});
 const accepted=ok(selectChoice(opened,offer.id,0,'TFT13_Crime_LootA4'));
 expect(accepted.state.items).toHaveLength(0);
 expect(accepted.state.preparation.units.filter(u=>u.team==='player').map(u=>u.definitionId)).toEqual(expect.arrayContaining(['renni','smeech']));
 expect(readG23Progress(accepted.state)!.chem.shimmer).toBe(0);
 expect(selectChoice(accepted.state,offer.id,0,'TFT13_Crime_LootA4').ok).toBe(false);
 const skipped=ok(selectChoice(opened,offer.id,0,'@skip'));
 expect(skipped.state.preparation.units).toEqual(state.preparation.units);expect(readG23Progress(skipped.state)!.chem.skips).toBe(1);
});
it('a paid settlement-return choice is included in post-economy net mechanic gold',()=>{
 const first=settled(createMatch(42)),funded=ok(grantMechanicGold(first,{receiptId:'armory-funding',source:'test',amount:8})).state;
 const opened=ok(openMechanicChoice(funded,{choiceId:'test-armory',returnPhase:'settlement',offers:['paid','free'],payload:{kind:'armory',source:'test',prices:{paid:5,free:0},timeoutOption:'free'}}));
 const paid=ok(selectChoice(opened.state,'test-armory',0,'paid')).state;
 expect(paid.gold).toBe(first.gold+3);expect(restoreMatch(serializeMatch(paid,evidence(paid)),evidence(paid))).toEqual(paid);
});
import {draftPool,rewardPolicy,reconcileHoldings} from '../src/simulation/shared-pool-ledger';
import type {SharedPoolEvent} from '../src/simulation/shared-pool-types';
it.each(['maddie','g23-forge'])('shared reconciliation derives %s birth definition from receipts even if the third candidate merged away',definitionId=>{
 const {pool,states}=room({irelia:3,maddie:3},1);let state=states[0];const draft=draftPool(pool),events:SharedPoolEvent[]=[];
 for(let i=0;i<3;i++){
  const granted=ok(grantMechanicUnit(state,{receiptId:'merge-'+i,source:'test',definitionId},rewardPolicy(draft,state,events)));
  if(i===2){expect(mechanicGrantEvents(state,granted.state).filter(e=>e.type==='unitUpgraded')).toHaveLength(1);}
  if(i===2&&granted.receipt.kind==='unit'){const unitId=granted.receipt.unitId;expect(granted.state.preparation.units.some(u=>u.id===unitId)).toBe(false);}
  reconcileHoldings(draft,state,granted.state,events);state=granted.state;
 }
 expect(state.preparation.units.find(u=>u.definitionId===definitionId)?.starLevel).toBe(2);
 conserved(draft,[state]);
});
import {buyUnit} from './fixtures/recorded-match';
it('buying Rumble to three stars refreshes a folded armory and invalidates its old generation',()=>{
 const initial=createMatch(42),p=readG23Progress(initial)!;
 const units=[2,2,1,1].map((starLevel,i)=>({id:'rumble-'+i,definitionId:'rumble',starLevel:starLevel as 1|2,team:'player' as const,location:{kind:'bench' as const,slot:i}}));
 const state=writeG23Progress({...initial,gold:20,round:4,roundDefinitionId:'2-1',multiplayer:{version:'multiplayer-settlement-v1' as const,seatId:'A',status:'active' as const,receipts:[],forfeitedChoices:[]},m8:{...initial.m8,round:{...initial.m8.round,kind:'pvp' as const}},preparation:{...initial.preparation,units},shop:{generation:1,locked:false,slots:[{status:'available' as const,definitionId:'rumble'}]}},{...p,junkerRounds:3});
 const opened=openG23Choice(state).state,choice=opened.pendingChoice!;
 const upgraded=ok(buyUnit(opened,0,1)).state;
 expect(upgraded.preparation.units.some(u=>u.starLevel===3)).toBe(true);
 expect(upgraded.pendingChoice?.offers).toEqual(['junkyard-titan']);
 expect(upgraded.pendingChoice?.generation).toBe(choice.generation+1);
 expect(selectChoice(upgraded,choice.choiceId,choice.generation,choice.offers[0])).toMatchObject({ok:false,reason:'stale-choice'});
 const timed=ok(forfeitPendingChoice(upgraded,4,choice.choiceId,choice.generation+1));
 expect(timed.state.gold).toBe(15);
});

import {mechanicGrantEvents} from '../src/simulation/g2-3-runtime';
