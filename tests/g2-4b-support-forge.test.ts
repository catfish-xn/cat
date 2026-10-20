import {expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createMatch,selectChoice,forfeitPendingChoice,equipItem,startMatchCombat,stepMatch,nextRound,useConsumable,type MatchState} from '../src/simulation/match';
import {grantMechanicItem,openMechanicChoice} from '../src/simulation/seat-mechanics';
import {applyRoundSettlement} from '../src/simulation/round-settlement';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {G24_FORGE_POOLS,G24_FORGE_POLICY,resolveG24ForgePool} from '../src/simulation/content/g2-4-forges';
import {G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {readG23Progress} from '../src/simulation/g2-3-state';
import {drainG23Rewards,openG23Choice,claimG23Atom} from '../src/simulation/g2-3-runtime';
import {previewUseConsumable,validateConsumableState} from '../src/simulation/consumables';
import {REFORGE_POOLS} from '../src/simulation/content/consumables';
import {RULES_GAP_MANIFEST} from '../src/simulation/content/rules-manifest';
import {publicConsumables} from './fixtures/r3r4-public';
import {accepted,forgeStates,restoreDomain} from './helpers/g24-forge-states';

// Independent expected admission list, not derived from the runtime registry under test.
const supportIds=[
 'TFT_Item_ZekesHerald','TFT_Item_Chalice','TFT4_Item_OrnnRanduinsSanctum','TFT_Item_LocketOfTheIronSolari',
 'TFT4_Item_OrnnObsidianCleaver','TFT_Item_AegisOfTheLegion','TFT_Item_RadiantVirtue','TFT7_Item_ShimmerscaleHeartOfGold',
 'TFT_Item_BansheesVeil','TFT_Item_EternalFlame','TFT_Item_SupportKnightsVow','TFT_Item_Moonstone','TFT_Item_Spite',
 // Unstable chest (#153) and the G2-4b mechanism supports (#150) complete the 17-identity source pool.
 'TFT_Item_UnstableTreasureChest','TFT5_Item_ZzRotPortalRadiant','TFT_Item_Shroud','TFT_Item_Zephyr',
].sort();
const fixed13=['TFT_Item_ZekesHerald','TFT_Item_LocketOfTheIronSolari','TFT_Item_Chalice'];
const bundle=(tier:number,id=`g23:conqueror:${tier}`)=>{
 const {Gold:_gold,...reward}=g23ConquerorReward(G23_CONQUEROR_CHESTS[tier-1]);
 return {id,round:8,source:'conqueror' as const,tier,reward};
};

it('admits all 17 executable supports against the 17 source IDs and includes the support boundary in the digest input',()=>{
 expect(resolveG24ForgePool('TFT_ArmoryKeySupport')).toEqual(supportIds);
 expect(G24_FORGE_POLICY.supportSource).toHaveLength(17);
 expect(G24_FORGE_POLICY.supportExclusions).toEqual([]);
 expect([...supportIds,...G24_FORGE_POLICY.supportExclusions].sort()).toEqual([...G24_FORGE_POLICY.supportSource].sort());
 expect(Object.isFrozen(G24_FORGE_POOLS.TFT_ArmoryKeySupport)).toBe(true);
 expect(JSON.stringify(RULES_GAP_MANIFEST)).toContain(JSON.stringify(G24_FORGE_POLICY));
});

it('takes tier 11/13 rewards and thresholds directly from raw, with fixed supports rather than three extra rolls',()=>{
 const map=JSON.parse(gunzipSync(readFileSync(new URL('../src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz',import.meta.url))).toString());
 for(const [tier,pointer,reward] of [
  [11,'{687c9527}',{MeepTypeUnit:['TFT_ArmoryKeySupport']}],
  [13,'{b7b519b5}',{Item:[...fixed13,'TFT_Consumable_ItemRemover'],Gold:20}],
 ] as const){
  const raw=Object.fromEntries(Object.entries(map[pointer].mConstants).map(([key,v])=>[key,(v as {mValue:unknown}).mValue]));
  expect(raw).toEqual(reward);
  expect(g23ConquerorReward(G23_CONQUEROR_CHESTS[tier-1])).toEqual(raw);
 }
 expect([G23_CONQUEROR_CHESTS[10].threshold,G23_CONQUEROR_CHESTS[12].threshold]).toEqual([750,1000]);
 expect(g23RewardAtoms(bundle(13),42).map(a=>[a.kind,a.options,a.quantity])).toEqual([
  ...fixed13.map(id=>['item',[id],1]),['tool',['magnetic-remover'],1],
 ]);
});

it('offers four distinct uniformly sampled supports; previous offers and owned items are not exclusions',()=>{
 // Independent Python uint32 oracle for seed42, tier11 atom0, sorted list and shrinking-pool selection.
 expect(g23RewardAtoms(bundle(11),42)[0].options).toEqual(['TFT_Item_ZekesHerald','TFT_Item_RadiantVirtue','TFT_Item_AegisOfTheLegion','TFT_Item_Zephyr']);
 let overlap=false;
 for(let seed=0;seed<64;seed++){
  const first=g23RewardAtoms(bundle(11),seed)[0].options;
  const second=g23RewardAtoms(bundle(11,'support-next-window'),seed)[0].options;
  expect(first).toHaveLength(4);expect(new Set(first).size).toBe(4);
  expect(first.every(id=>supportIds.includes(id))).toBe(true);
  expect(g23RewardAtoms(bundle(11),seed)[0].options).toEqual(first);
  overlap ||= first.some(id=>second.includes(id));
 }
 expect(overlap).toBe(true);
 const state=forgeStates().get(11)!,c=state.pendingChoice!;
 let owned:MatchState={...state,phase:'preparation',combat:null,combatInputBasis:null,pendingChoice:null};
 for(const [i,definitionId] of c.offers.entries())owned=accepted(grantMechanicItem(owned,{receiptId:`fixture:support-owned:${i}`,source:'fixture',definitionId}));
 expect(openG23Choice(owned).state.pendingChoice!.offers).toEqual(c.offers);
});

it('tier 11 selection/timeout survives domain restore, issues one item and rejects replay or forged receipts',()=>{
 const state=forgeStates().get(11)!,c=state.pendingChoice!,before=JSON.stringify(state);
 expect(c).toMatchObject({kind:'forge',offers:expect.any(Array),payload:{kind:'forge',source:'conqueror',timeoutOption:c.offers[0]}});
 expect(c.offers).toHaveLength(4);expect(new Set(c.offers).size).toBe(4);
 expect(restoreDomain(state)).toEqual(state);
 const manual=accepted(selectChoice(state,c.choiceId,c.generation,c.offers[2]));
 const timeout=accepted(forfeitPendingChoice(state,state.round,c.choiceId,c.generation));
 for(const [selected,option,timedOut] of [[manual,c.offers[2],false],[timeout,c.offers[0],true]] as const){
  expect(selected.items).toHaveLength(state.items.length+1);
  expect(selected.items.at(-1)?.definitionId).toBe(option);
  expect(selected.seatMechanics!.receipts.find(r=>r.receiptId===c.choiceId)).toMatchObject({kind:'choice',choiceKind:'forge',optionId:option,itemId:expect.any(String),price:0,timedOut,skipped:false});
  expect(restoreDomain(selected)).toEqual(selected);
  expect(drainG23Rewards(restoreDomain(selected))).toEqual(selected);
  expect(selectChoice(selected,c.choiceId,c.generation,option)).toMatchObject({ok:false,state:selected});
  expect(forfeitPendingChoice(selected,state.round,c.choiceId,c.generation)).toMatchObject({ok:false,state:selected});
  expect(selected.reforgeState).toEqual(state.reforgeState);
  expect(readG23Progress(selected)!.rngDraws).toBe(readG23Progress(state)!.rngDraws);
 }
 expect(claimG23Atom(state,c.choiceId.replace(':copy:0',''),c.offers[0])).toEqual({ok:false,state,reason:'stale-choice'});
 expect(JSON.stringify(state)).toBe(before);
 for(const patch of [{offers:[...c.offers].reverse()},{offers:['warmog',...c.offers.slice(1)]},{payload:{...c.payload,timeoutOption:c.offers[1]}}])
  expect(()=>restoreDomain({...state,pendingChoice:{...c,...patch}})).toThrow();
 for(const patch of [{itemId:null},{source:'black-market'},{choiceKind:'blackMarket'},{price:1},{skipped:true},{timedOut:true},{optionId:'TFT4_Item_OrnnAnimaVisage'}])
  expect(()=>restoreDomain({...manual,seatMechanics:{...manual.seatMechanics!,receipts:manual.seatMechanics!.receipts.map(r=>r.receiptId===c.choiceId?{...r,...patch}:r)}})).toThrow();
 expect(state.seatMechanics!.receipts.some(r=>r.receiptId==='g23:conqueror:11:gold')).toBe(false);
 const oldGold={receiptId:'g23:conqueror:11:gold',source:'conqueror-chest',kind:'gold',amount:15,round:state.round,roundId:state.roundDefinitionId};
 expect(()=>restoreDomain({...manual,seatMechanics:{...manual.seatMechanics!,receipts:[...manual.seatMechanics!.receipts,oldGold]}})).toThrow();
});

it('tier 13 automatically grants the three fixed supports, remover and 20 gold exactly once across restore',()=>{
 // At the next forge all automatic tier13 grants have already drained from real settlement receipts.
 const state=forgeStates().get(14)!;
 const receipts=state.seatMechanics!.receipts.filter(r=>r.receiptId.startsWith('g23:conqueror:13:'));
 expect(receipts).toHaveLength(5);
 for(const [index,definitionId] of fixed13.entries()){
  expect(receipts.find(r=>r.receiptId===`g23:conqueror:13:atom:${index}:copy:0`)).toMatchObject({kind:'item',source:'conqueror',definitionId,itemId:expect.any(String)});
 }
 expect(receipts.find(r=>r.receiptId==='g23:conqueror:13:atom:3:copy:0')).toMatchObject({kind:'consumable',definitionId:'magnetic-remover'});
 expect(receipts.find(r=>r.receiptId==='g23:conqueror:13:gold')).toMatchObject({kind:'gold',amount:20});
 expect(restoreDomain(state)).toEqual(state);
 expect(drainG23Rewards(restoreDomain(state))).toEqual(state);
 expect(claimG23Atom(state,'g23:conqueror:13:atom:0',fixed13[0])).toEqual({ok:false,state,reason:'stale-choice'});
 expect(applyRoundSettlement(state,state.multiplayer!.receipts.at(-1)!)).toMatchObject({ok:false,reason:'duplicate-settlement',state});
 const stale={...state,seatMechanics:{...state.seatMechanics!,receipts:state.seatMechanics!.receipts.map(r=>r.receiptId==='g23:conqueror:13:gold'?{...r,amount:50}:r)}};
 expect(()=>restoreDomain(stale)).toThrow();
 const corrupt={...state,seatMechanics:{...state.seatMechanics!,receipts:state.seatMechanics!.receipts.map(r=>r.receiptId==='g23:conqueror:13:atom:0:copy:0'?{...r,definitionId:'warmog'}:r)}};
 expect(()=>restoreDomain(corrupt)).toThrow();
});

it('completed reforger rejects every support in inventory and on a holder without tool, receipt or RNG changes',()=>{
 const base=accepted(nextRound(publicConsumables(162),10)),tool=base.consumables.find(c=>c.definitionId==='reforger')!;
 for(const definitionId of supportIds){
  const state=accepted(grantMechanicItem(base,{receiptId:'fixture:support',source:'fixture',definitionId}));
  const item=state.items.at(-1)!,unit=state.preparation.units.find(u=>u.team==='player')!;
  for(const candidate of [state,accepted(equipItem(state,item.id,unit.id,0))]){
   const before=JSON.stringify(candidate),target={kind:'item' as const,itemId:item.id};
   expect(previewUseConsumable(candidate,tool.consumableId,target)).toEqual({ok:false,reason:'invalid-consumable-target'});
   expect(useConsumable(candidate,tool.consumableId,target)).toEqual({ok:false,state:candidate,reason:'invalid-consumable-target'});
   expect(JSON.stringify(candidate)).toBe(before);
  }
 }
 expect(REFORGE_POOLS.completed.some(i=>supportIds.includes(i.definitionId))).toBe(false);
 const ordinary=accepted(grantMechanicItem(base,{receiptId:'fixture:ordinary',source:'fixture',definitionId:'warmog'}));
 const holder=ordinary.preparation.units.find(u=>u.team==='player')!;
 const equipped=accepted(equipItem(ordinary,ordinary.items.at(-1)!.id,holder.id,0));
 const reforged=accepted(useConsumable(equipped,tool.consumableId,{kind:'unit',unitId:holder.id}));
 const forged={...reforged,resourceProvenance:{...reforged.resourceProvenance,entries:reforged.resourceProvenance.entries.map(f=>f.kind==='consumable-used'?{...f,record:{...f.record,affectedItems:f.record.affectedItems.map(i=>({...i,definitionId:supportIds[0]}))}}:f)}};
 expect(()=>validateConsumableState(forged)).toThrow('Invalid consumable ledger');
});

it('full single-player save restores pending/manual support choices and equipped ongoing combat exactly',()=>{
 const initial=createMatch(42),offers=g23RewardAtoms(bundle(11),42)[0].options;
 const state=accepted(openMechanicChoice(initial,{choiceId:'support-save',offers,returnPhase:'preparation',payload:{kind:'forge',source:'fixture',timeoutOption:offers[0]}}));
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
 const picked=accepted(selectChoice(state,'support-save',0,'TFT_Item_ZekesHerald'));
 expect(restoreMatch(serializeMatch(picked))).toEqual(picked);
 const holder=picked.preparation.units.find(u=>u.team==='player'&&u.location.kind==='board')!;
 const equipped=accepted(equipItem(picked,picked.items.at(-1)!.id,holder.id,0));
 let live=accepted(startMatchCombat(equipped));
 expect(live.combat!.strategy!.units.find(u=>u.unitId===holder.id)!.sources.some(s=>s.source.sourceDefinitionId==='TFT_Item_ZekesHerald')).toBe(true);
 live=stepMatch(live).state;
 expect(live.phase).toBe('combat');
 let restored=restoreMatch(serializeMatch(live));
 expect(restored).toEqual(live);
 for(let tick=0;tick<1200&&live.phase==='combat';tick++){
  const a=stepMatch(live),b=stepMatch(restored);expect(b).toEqual(a);live=a.state;restored=b.state;
 }
 expect(live.phase).not.toBe('combat');
 expect(restoreMatch(serializeMatch(restored))).toEqual(live);
});

it('rejects a configured support admission pool smaller than four instead of issuing a partial offer',async()=>{
 vi.resetModules();
 vi.doMock('../src/simulation/content/g2-4-support-items',()=>({G24_SUPPORT_ITEMS:Object.fromEntries(supportIds.slice(0,3).map(id=>[id,{}]))}));
 vi.doMock('../src/simulation/content/g2-4b-mechanism-items',()=>({G24_MECHANISM_ITEMS:{}}));
 try{await expect(import('../src/simulation/content/g2-4-forges')).rejects.toThrow('Invalid G24 forge pool');}
 finally{vi.doUnmock('../src/simulation/content/g2-4-support-items');vi.doUnmock('../src/simulation/content/g2-4b-mechanism-items');vi.resetModules();}
});
