import {expect,it} from 'vitest';
import {createMatch,selectChoice,forfeitPendingChoice,claimG23Reward,nextRound,useConsumable,equipItem,type MatchState} from '../src/simulation/match';
import {applyRoundSettlement} from '../src/simulation/round-settlement';
import {grantMechanicItem,openMechanicChoice} from '../src/simulation/seat-mechanics';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {G24_FORGE_POOLS,G24_FORGE_POLICY,resolveG24ForgePool} from '../src/simulation/content/g2-4-forges';
import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import { readG23Progress } from '../src/simulation/g2-3-state';
import { validateG23MechanicLinks } from '../src/simulation/restore-checks/g23-state-check';
import {openG23Choice,claimG23Atom} from '../src/simulation/g2-3-runtime';
import { previewUseConsumable } from '../src/simulation/consumables';
import { validateConsumableState } from '../src/simulation/restore-checks/consumable-state-check';
import {REFORGE_POOLS} from '../src/simulation/content/consumables';
import {finish} from './fixtures/r3r4-public';
import {buyUnit,combineItems,deployMatchUnit,rerollShop,type MatchCommandResult} from '../src/simulation/match';
import {isAnvil} from '../src/simulation/content/anvils';
import {isSellableUnit} from '../src/simulation/seat-mechanics/forms';
import {augmentNeedsHistory} from '../src/simulation/augment-history-owners';
import {needsCrownHistory} from '../src/simulation/crown-history';
import {digestContent} from '../src/simulation/content';
import {RULES_GAP_MANIFEST} from '../src/simulation/content/rules-manifest';

import {accepted,forgeStates,forgeAnvils,restoreDomain,FORGE_ATOM_IDS} from './helpers/g24-forge-states';
import {sellUnit} from '../src/simulation/match';
import {anvilChoiceId} from '../src/simulation/anvils';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });
const bundle=(tier:number)=>{const {Gold:_gold,...reward}=g23ConquerorReward(G23_CONQUEROR_CHESTS[tier-1]);return {id:`g23:conqueror:${tier}`,round:8,source:'conqueror' as const,tier,reward};};
const artifactIds=[
 'TFT4_Item_OrnnAnimaVisage','TFT4_Item_OrnnInfinityForce','TFT4_Item_OrnnMuramana','TFT4_Item_OrnnZhonyasParadox',
 'TFT9_Item_OrnnHullbreaker','TFT9_Item_OrnnDeathfireGrasp','TFT9_Item_OrnnHorizonFocus',
 'TFT_Item_Artifact_TalismanOfAscension','TFT_Item_Artifact_HorizonFocus','TFT_Item_Artifact_Mittens',
 'TFT_Item_Artifact_UnendingDespair','TFT_Item_Artifact_RapidFirecannon','TFT_Item_Artifact_InnervatingLocket',
 'TFT_Item_Artifact_LudensTempest','TFT_Item_Artifact_SilvermereDawn','TFT_Item_Artifact_ProwlersClaw',
 'TFT_Item_Artifact_BlightingJewel','TFT_Item_Artifact_WitsEnd','TFT_Item_Artifact_LichBane',
 'TFT_Item_Artifact_LightshieldCrest','TFT_Item_Artifact_SeekersArmguard',
 // G2-4b mechanism artifacts (#150) complete the 29-identity source pool.
 'TFT4_Item_OrnnDeathsDefiance','TFT4_Item_OrnnTheCollector','TFT9_Item_OrnnTrickstersGlass','TFT7_Item_ShimmerscaleGamblersBlade',
 'TFT7_Item_ShimmerscaleMogulsMail','TFT_Item_Artifact_Fishbones','TFT_Item_Artifact_SuspiciousTrenchCoat','TFT_Item_Artifact_SpectralCutlass',
].sort();

it('pins all 29 executable IDs against the intact 29 source identities and hashes the acquisition policy',()=>{
 expect(G24_FORGE_POOLS.TFT_ArmoryKeyOrnn).toEqual(artifactIds);
 expect(G24_FORGE_POLICY.artifactSource).toHaveLength(29);
 expect(G24_FORGE_POLICY.artifactExclusions).toEqual([]);
 expect([...artifactIds,...G24_FORGE_POLICY.artifactExclusions].sort()).toEqual([...G24_FORGE_POLICY.artifactSource].sort());
 expect(G24_FORGE_POOLS.TFT_ArmoryKeyCompleted).toHaveLength(36);
 expect(Object.isFrozen(G24_FORGE_POOLS.TFT_ArmoryKeyOrnn)).toBe(true);
 const changed=structuredClone(RULES_GAP_MANIFEST);
 // The full admission boundary and algorithm choices are digest inputs, not an unhashed UI list.
 expect(JSON.stringify(changed)).toContain(JSON.stringify(G24_FORGE_POLICY));
 expect(digestContent(changed)).not.toBe(digestContent(JSON.parse(JSON.stringify(changed).replace('g24-forge-v2','g24-forge-v3'))));
 for(const api of ['unknown','toString']){
  expect(()=>resolveG24ForgePool(api)).toThrow('Unadmitted');
  expect(()=>g23RewardAtoms({...bundle(10),reward:{MeepTypeUnit:[api]}},42)).toThrow('frozen reward descriptor');
 }
});
it('preserves source tiers 10/14 alongside newly admitted support tiers 11/13',()=>{
 for(const tier of [10,11,13,14])expect(g23ConquerorReward(G23_CONQUEROR_CHESTS[tier-1])).toEqual(G23_CONQUEROR_CHESTS[tier-1].reward);
 const atoms=g23RewardAtoms(bundle(14),42);
 // v22 anvil units (docs/ANVIL_UNITS.md): the MeepTypeUnit artifact forge is an 'anvil' atom bound to its source definitionId.
 expect(atoms.map(a=>[a.kind,a.options.length])).toEqual([['item',1],['anvil',4],['tool',1]]);
 expect(atoms[1].forgeDefinitionId).toBe('TFT_ArmoryKeyOrnn');
 expect(atoms[0].options[0]).toMatch(/^TFT5_Item_/);
 expect(atoms[2].options).toEqual(['magnetic-remover']);
});
it('offers four distinct reproducible artifacts and permits overlap between independent windows',()=>{
 const first=g23RewardAtoms(bundle(10),42)[0],again=g23RewardAtoms(bundle(10),42)[0];
 expect(again).toEqual(first);
 // Independent uint32 integer oracle (Python), pinned to seed42 and tier10 atom0.
 expect(first.options).toEqual(['TFT_Item_Artifact_InnervatingLocket', 'TFT9_Item_OrnnHorizonFocus', 'TFT_Item_Artifact_SilvermereDawn', 'TFT_Item_Artifact_TalismanOfAscension']);
 for(let seed=0;seed<32;seed++){
  const options=g23RewardAtoms(bundle(10),seed)[0].options;
  expect(options).toHaveLength(4);expect(new Set(options).size).toBe(4);
  for(const id of options)expect(artifactIds).toContain(id);
 }
 const pairs=Array.from({length:32},(_,seed)=>[g23RewardAtoms(bundle(10),seed)[0].options,g23RewardAtoms(bundle(14),seed)[1].options]);
 expect(pairs.some(([a,b])=>a.some(id=>b.includes(id)))).toBe(true);
});

it.each([10,14])('tier %i survives pending/manual/timeout restore and rejects duplicate grants and edited authority',tier=>{
 // v22 anvil units (docs/ANVIL_UNITS.md): the tier's forge is an anvil unit; the fixture claimed it from its orb
 // and opened it by selling it, so the pending window is the anvil-unit forge (4 picks, 30 s, timeout = first).
 const state=forgeStates().get(tier)!,c=state.pendingChoice!,{before:anvilState,unitId}=forgeAnvils().get(tier)!,atomId=FORGE_ATOM_IDS[tier];
 expect(c).toMatchObject({kind:'forge',choiceId:anvilChoiceId(unitId),payload:{kind:'forge',source:'anvil-unit',timeoutMs:30000,timeoutOption:c.offers[0]}});
 expect(c.offers).toEqual(g23RewardAtoms(readG23Progress(state)!.rewards.find(b=>b.tier===tier)!,readG23Progress(state)!.seed,true).find(a=>a.id===atomId)!.options);
 expect(restoreDomain(state)).toEqual(state);
 const before=JSON.stringify(state),rng=state.reforgeState;
 const manual=accepted(selectChoice(state,c.choiceId,c.generation,c.offers[2]));
 expect(manual.items.filter(i=>i.definitionId===c.offers[2]).length).toBe(state.items.filter(i=>i.definitionId===c.offers[2]).length+1);
 expect(restoreDomain(manual)).toEqual(manual);
 expect(selectChoice(manual,c.choiceId,c.generation,c.offers[2])).toMatchObject({ok:false,state:manual});
 const timeout=accepted(forfeitPendingChoice(state,state.round,c.choiceId,c.generation));
 expect(timeout.seatMechanics!.receipts.find(r=>r.receiptId===c.choiceId)).toMatchObject({kind:'choice',choiceKind:'forge',optionId:c.offers[0],price:0,timedOut:true,skipped:false});
 expect(restoreDomain(timeout)).toEqual(timeout);
 expect(forfeitPendingChoice(timeout,state.round,c.choiceId,c.generation).ok).toBe(false);
 expect(timeout.reforgeState).toEqual(rng);
 expect(JSON.stringify(state)).toBe(before);
 const p=readG23Progress(state)!;
 expect(readG23Progress(manual)!.rngDraws).toBe(p.rngDraws);
 expect(claimG23Atom(state,atomId,c.offers[0])).toEqual({ok:false,state,reason:'stale-choice'});
 const preparation:MatchState={...state,phase:'preparation',combat:null,combatInputBasis:null,pendingChoice:null};
 expect(claimG23Reward(preparation,atomId,c.offers[0])).toEqual({ok:false,state:preparation,reason:'stale-choice'});
 // Owning all offered artifacts does not reroll or exclude them (the anvil is opened after they are owned).
 let owned:MatchState=anvilState;
 for(const [i,definitionId] of c.offers.entries())owned=accepted(grantMechanicItem(owned,{receiptId:`fixture:owned:${i}`,source:'fixture',definitionId})) as MatchState;
 expect(openG23Choice(owned).state.pendingChoice).toBeNull();
 expect(accepted(sellUnit(owned,unitId)).pendingChoice!.offers).toEqual(c.offers);
 const otherUnit=state.preparation.units.find(u=>u.team==='player')!.id;
 for(const patch of [{offers:[...c.offers].reverse()},{offers:['warmog',...c.offers.slice(1)]},{choiceId:anvilChoiceId(otherUnit)},{payload:{...c.payload,source:'black-market'}},{payload:{...c.payload,timeoutOption:c.offers[1]}}]){
  expect(()=>restoreDomain({...state,pendingChoice:{...c,...patch}})).toThrow();
 }
 for(const patch of [{itemId:null},{kind:'item',definitionId:c.offers[2]},{source:'black-market'},{choiceKind:'blackMarket'},{price:1},{skipped:true},{timedOut:true},{optionId:'warmog'},{receiptId:anvilChoiceId(otherUnit)}]){
  const bad={...manual,seatMechanics:{...manual.seatMechanics!,receipts:manual.seatMechanics!.receipts.map(r=>r.receiptId===c.choiceId?{...r,...patch}:r)}};
  expect(()=>restoreDomain(bad)).toThrow();
 }
 expect(()=>validateG23MechanicLinks(manual)).not.toThrow();
 const receipt=state.multiplayer!.receipts.at(-1)!;
 expect(applyRoundSettlement(manual,receipt)).toMatchObject({ok:false,reason:'duplicate-settlement',state:manual});
 expect(state.seatMechanics!.receipts.filter(r=>r.receiptId===`g23:conqueror:${tier}:gold`)).toEqual(tier===10?[]:[expect.objectContaining({kind:'gold',amount:50})]);
 const goldId=`g23:conqueror:${tier}:gold`;
 const forgedGold={receiptId:goldId,source:'conqueror-chest',kind:'gold' as const,amount:tier===10?14:60,round:state.round,roundId:state.roundDefinitionId};
 expect(()=>restoreDomain({...manual,seatMechanics:{...manual.seatMechanics!,receipts:[...manual.seatMechanics!.receipts.filter(r=>r.receiptId!==goldId),forgedGold]}})).toThrow();
},30000);

/** publicConsumables(162) (seed 27566, tests/fixtures/r3r4-public.ts), except that augment choices skip replay-history
 * cards. v26 D5 registration (7953c99a, merge 3ce71065) makes that shared route's offers[0] at 2-1 Spoils of War III
 * (the v25 route restored without battles), whose kill ordinal needs full battle replay once round 10 is settled, so the
 * ordinary-reforge save below could not be serialized without battles. Same commands otherwise. */
function historyFreeConsumables():MatchState {
  const free=(id:string)=>!augmentNeedsHistory(id)&&!id.startsWith('spoils-of-war-')&&!['blood-brothers','salvage-bin','a-change-of-fate','pilfer'].includes(id);
  let state=createMatch(27566);
  while(state.round<=10){
    while(state.phase==='choice'){
      const c=state.pendingChoice!;state=accepted(selectChoice(state,c.choiceId,c.generation,c.offers.find(id=>id==='bulky-buddies-i')??(c.kind==='augment'?c.offers.find(free)!:c.offers[0])));
    }
    if(state.phase==='preparation'){
      if(state.round===10)while(state.gold>=2){
        const slot:number=state.shop.slots.findIndex(o=>o.status==='available'&&['irelia','maddie','lux','darius','zyra'].includes(o.definitionId!));
        const result:MatchCommandResult=slot<0?rerollShop(state):buyUnit(state,slot,state.shop.generation);if(!result.ok)break;state=result.state;
      }
      for(const u of state.preparation.units.filter(u=>u.team==='player')){
        if(u.location.kind==='board'||isAnvil(u.definitionId))continue;
        const held=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');if(held.length>=state.level)break;
        const col=[3,2,4,1,5,0,6].find(col=>!held.some(u=>u.location.kind==='board'&&u.location.cell.col===col&&u.location.cell.row===7))!;
        state=accepted(deployMatchUnit(state,u.id,{kind:'board',cell:{col,row:7}}));
      }
      state=finish(state);
    }
    if(state.round===10)break;
    if(state.phase==='settlement')state=accepted(nextRound(state,state.round));
  }
  const gloves=state.items.filter(i=>i.definitionId==='gloves'&&i.location.kind==='inventory');
  if(gloves.length>=2)state=accepted(combineItems(state,gloves[0].id,gloves[1].id));
  while(state.m8.loot.direct.some(d=>d.status==='pending-capacity')){const reserve=state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench'&&isSellableUnit(u.definitionId)&&!isAnvil(u.definitionId))!;state=accepted(sellUnit(state,reserve.id));}
  return state;
}

it('completed reforger refuses artifacts in inventory or equipped without consuming tool/RNG; ordinary reforge still restores',()=>{
 let state=accepted(nextRound(historyFreeConsumables(),10));
 expect(needsCrownHistory(state)).toBe(false);
 const tool=state.consumables.find(c=>c.definitionId==='reforger')!;
 const definitionId=artifactIds[0];state=accepted(grantMechanicItem(state,{receiptId:'fixture:artifact',source:'fixture',definitionId}));
 const item=state.items.find(i=>i.definitionId===definitionId)!,unit=state.preparation.units.find(u=>u.team==='player')!;
 for(const candidate of [state,accepted(equipItem(state,item.id,unit.id,0))]){
  const before=JSON.stringify(candidate),target={kind:'item' as const,itemId:item.id};
  expect(previewUseConsumable(candidate,tool.consumableId,target)).toEqual({ok:false,reason:'invalid-consumable-target'});
  expect(useConsumable(candidate,tool.consumableId,target)).toEqual({ok:false,state:candidate,reason:'invalid-consumable-target'});
  expect(JSON.stringify(candidate)).toBe(before);
 }
 expect(REFORGE_POOLS.completed).toHaveLength(36);
 expect(REFORGE_POOLS.completed.some(i=>artifactIds.includes(i.definitionId))).toBe(false);
 state=accepted(grantMechanicItem(state,{receiptId:'fixture:ordinary',source:'fixture',definitionId:'warmog'}));
 const ordinary=state.items.find(i=>i.definitionId==='warmog')!;
 state=accepted(equipItem(state,ordinary.id,unit.id,0));
 const reforged=accepted(useConsumable(state,tool.consumableId,{kind:'unit',unitId:unit.id}));
 expect(restoreMatch(serializeMatch(reforged))).toEqual(reforged);
 const forged={...reforged,resourceProvenance:{...reforged.resourceProvenance,entries:reforged.resourceProvenance.entries.map(f=>f.kind==='consumable-used'?{...f,record:{...f.record,affectedItems:f.record.affectedItems.map(i=>({...i,definitionId}))}}:f)}};
 expect(()=>validateConsumableState(forged)).toThrow('Invalid consumable ledger');
});

it('single-player artifact windows and selected items round-trip through the full save API',()=>{
 const initial=createMatch(42),offers=g23RewardAtoms(bundle(10),42)[0].options;
 const state=accepted(openMechanicChoice(initial,{choiceId:'artifact-save',offers,returnPhase:'preparation',payload:{kind:'forge',source:'fixture',timeoutOption:offers[0]}}));
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const picked=accepted(selectChoice(state,'artifact-save',0,offers[3]));
 expect(restoreMatch(serializeMatch(picked))).toEqual(picked);
 expect(restoreMatch(serializeMatch(picked)).items.at(-1)?.definitionId).toBe(offers[3]);
});
