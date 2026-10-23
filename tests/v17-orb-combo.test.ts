import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {ORB_STAGE_PLAN,orbBoxId} from '../src/simulation/content/orbs';
import {ORB_BOXES,EPIC_LOOT} from '../src/simulation/content/loot';
import {sampleOrbStagePlan,orbPlanTotals} from '../src/simulation/orb-stage-plan';
import {sampleOrbBox} from '../src/simulation/orb-box';
import {createOrbLayout,freezeOrbLayoutThroughRound,restoreOrbLayout} from '../src/simulation/orb-layout';
import {freezeLootThroughRound,restoreFrozenLootLedger} from '../src/simulation/loot-freeze';
import {createMatch,claimOrb,rerollShop,equipItem,useConsumable,selectChoice} from '../src/simulation/match';
import {prepareMatchLoot,revealMatchLoot,grantDirectLoot} from '../src/simulation/loot-runtime';
import {toPrivateSeatView} from '../src/simulation/private-seat-view';
import {readLootView,readPublicOrbSummary} from '../src/simulation/loot-view';
import {serializeMatch,restoreMatch} from '../src/simulation/serialization';
import {epicForgeOffers,openEpicForge,epicForgeId} from '../src/simulation/epic-forges';
import {G24_FORGE_POOLS} from '../src/simulation/content/g2-4-forges';
import {grantMechanicItem} from '../src/simulation/seat-mechanics';
import {getUnitSellPrice} from '../src/simulation/unit-stats';
import {draftPool,rewardPolicy} from '../src/simulation/shared-pool-ledger';
import {room} from './tp-helpers';
import {createCombat} from '../src/simulation/combat';
import {createRoundEnemies} from '../src/simulation/round-enemies';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import {SHOP_CATALOG_BY_COST} from '../src/simulation/match-rules';
import {M8_VERSION} from '../src/simulation/m8/version';
import {routeSaveFile} from '../src/persistence/compatibility';
import {validateResourceReceipts} from '../src/simulation/resource-provenance';
import type {FrozenDirectDrop} from '../src/simulation/loot-types';
import type {MatchState,MatchCommandResult} from '../src/simulation/match-types';
import type {LootPayload} from '../src/simulation/m8/contracts';
const oracle=createRequire(import.meta.url)('./fixtures/orb-combo-oracle.cjs');
const accepted=(r:MatchCommandResult)=>{if(!r.ok)throw Error(r.reason);return r.state;};
const layout=(seed:number,ordinal:number)=>{const r=freezeOrbLayoutThroughRound(createOrbLayout(seed),ordinal);if(!r.ok)throw Error(r.reason);return r.layout;};
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));

describe('v17 orb combination — eleven contract acceptance groups',()=>{
 it('1: original positive integer rows, exact sums, counts and upgrade boundaries',()=>{
  expect(ORB_STAGE_PLAN.highOdds).toEqual([630,300,58,10,2]);
  for(const [i,s] of ORB_STAGE_PLAN.stages.entries())for(const [j,rows] of [s.base,s.high].entries()){
   expect(rows.map(r=>[r.weight,r.components,r.gray,r.blue,r.gold,r.prismatic])).toEqual(oracle.STAGES[i][j].map((r:number[])=>Array.from({length:6},(_,n)=>r[n]??0)));
   expect(rows.reduce((n,r)=>n+r.weight,0)).toBe(i===0&&j===1?110:100);
  }
  expect(Object.values(ORB_BOXES).map(r=>r.length)).toEqual([5,5,6,4,9,9,9]);
  for(const rows of Object.values(ORB_BOXES)){expect(rows.reduce((n,r)=>n+r.weight,0)).toBe(100);rows.forEach(r=>expect(r.weight).toBeGreaterThan(0));}
  expect([orbBoxId('gray',2),orbBoxId('gray',3),orbBoxId('blue',3),orbBoxId('blue',4),orbBoxId('gold',3),orbBoxId('gold',4)]).toEqual(['copper','copperPlus','silver','silverPlus','gold','goldPlus']);
  for(let s=1;s<=4;s++)expect(orbBoxId('prismatic',s)).toBe('ultraPlus');
  expect(EPIC_LOOT.copper.map(r=>[r.id,r.weight])).toEqual(ORB_BOXES.copperPlus.map(r=>[r.id,r.weight]));
  expect(EPIC_LOOT.silver.map(r=>[r.id,r.weight])).toEqual(ORB_BOXES.silverPlus.map(r=>[r.id,r.weight]));
 });
 it('2: 5000 fixed seeds satisfy bounds and independently enumerated conditional frequencies',()=>{
  const exact=oracle.distribution(),components=Array(5).fill(0),high=Array(5).fill(0);
  for(let seed=0;seed<5000;seed++){
   const p=sampleOrbStagePlan(seed),t=orbPlanTotals(p.stages),independent=oracle.plan(seed);
   expect([t.components>=11,t.components<=15,t.bonus>=20,t.bonus<=79]).toEqual([true,true,true,true]);
   expect(p.stages.map(r=>[r.weight,r.components,r.gray,r.blue,r.gold,r.prismatic])).toEqual(independent.rows.map((r:number[])=>Array.from({length:6},(_,n)=>r[n]??0)));
   expect(p.highStages).toEqual(independent.high);expect(p.rng).toEqual(independent.rng);
   components[t.components-11]++;high[p.highStages.length]++;
  }
  // Predeclared absolute tolerances: 3 percentage points for common bins,
  // 1 point for rare bins. Fixed seeds make this check reproducible.
  components.forEach((n,i)=>expect(Math.abs(n/5000-exact.components[i])).toBeLessThan(0.03));
  high.forEach((n,i)=>expect(Math.abs(n/5000-exact.high[i])).toBeLessThan(i<2?0.03:0.01));
  expect(exact.mean).toBeGreaterThan(12);expect(exact.mean).toBeLessThan(12.2);
 });
 it('3: rejects 64 invalid attempts, then returns the bounded all-Base-first fallback',()=>{
  let calls=0;const p=sampleOrbStagePlan(42,(rng,n)=>{calls++;return {index:n-1,rng:{state:rng.state,draws:rng.draws+1}};});
  expect(p).toMatchObject({attempts:64,fallback:true,highStages:[]});expect(calls).toBe(320);
  expect(p.stages).toEqual(ORB_STAGE_PLAN.stages.map(s=>s.base[0]));expect(orbPlanTotals(p.stages)).toEqual({components:12,bonus:30});
 });
 it('4: eight seats share shape/carriers, retain private contents and replay identically',()=>{
  const l=layout(42,24),plans=Array.from({length:8},(_,i)=>freezeLootThroughRound(i+1,24,l));
  const shape=(p:typeof plans[number])=>p.rounds.map(r=>r.orbs.map(o=>[o.orbId,o.sourceUnitId,o.slotOrdinal,o.tier,o.templateId]));
  plans.forEach((p,i)=>{expect(shape(p)).toEqual(shape(plans[0]));expect(p.rounds).toEqual(oracle.lootPlan(i+1,24,42).rounds);expect(freezeLootThroughRound(i+1,24,restoreOrbLayout(clone(l)))).toEqual(p);});
  expect(new Set(plans.map(p=>JSON.stringify(p.rounds))).size).toBe(8);
  const initialized=room(undefined,8);for(const s of initialized.states)expect(s.m8.loot.frozen.rounds[0].orbs.map(o=>[o.orbId,o.tier])).toEqual(initialized.states[0].m8.loot.frozen.rounds[0].orbs.map(o=>[o.orbId,o.tier]));
 });
 it('5: through 1-3 only entered rounds exist in ledger, private view and public summary',()=>{
  const l=layout(42,2),loot=prepareMatchLoot(42,2),state={...createMatch(42),round:2,roundDefinitionId:'1-3',m8:{...createMatch(42).m8,round:getCatalogRoundById('1-3'),loot}};
  expect(l.rounds.map(r=>r.roundId)).toEqual(['1-2','1-3']);expect(loot.frozen.rounds.map(r=>r.encounterPlan.roundId)).toEqual(['1-2','1-3']);
  expect(readPublicOrbSummary(state)).toEqual({count:0,tiers:[]});
  for(const v of [l,loot,toPrivateSeatView(state),readLootView(state),readPublicOrbSummary(state)]){
   const visit=(node:unknown):void=>{if(!node||typeof node!=='object')return;
    if('roundId' in node)expect(['1-2','1-3']).toContain(node.roundId);
    expect(node).not.toHaveProperty('stages');expect(node).not.toHaveProperty('highStages');Object.values(node).forEach(visit);};visit(v);
  }
 });
 it('6: pre-combo shop/reforge bytes and cursors remain identical; partial/permuted kills cannot change another orb',()=>{
  const vectors=JSON.parse(readFileSync(new URL('./fixtures/orb-streams-pre-combo.json',import.meta.url),'utf8'));
  for(const v of vectors){
   let s={...createMatch(v.seed),gold:10000};const shops=[{shop:s.shop,rng:s.rngState}],reforges=[];
   for(let i=0;i<12;i++){freezeLootThroughRound(v.seed,[1,2,3,10,17,24,31,38][i%8]);s=accepted(rerollShop(s));shops.push({shop:s.shop,rng:s.rngState});}
   for(const [i,id] of ['sword','rod','warmog','vest','rageblade'].entries()){
    s=accepted(grantMechanicItem(s,{receiptId:'stream-test:'+i,source:'test',definitionId:id}));s=accepted(equipItem(s,s.items.at(-1)!.id,'unit-1',0));
    const consumableId='consumable-'+s.nextConsumableSerial;s={...s,nextConsumableSerial:s.nextConsumableSerial+1,consumables:[...s.consumables,{consumableId,definitionId:'reforger' as const}]};
    s=accepted(useConsumable(s,consumableId,{kind:'unit',unitId:'unit-1'}));reforges.push({rng:s.reforgeState,output:s.items.at(-1)!.definitionId});
   }
   expect(JSON.stringify({seed:v.seed,shops,reforges})).toBe(JSON.stringify(v));
  }
  const p=freezeLootThroughRound(42,10).rounds.at(-1)!,sources=[...new Set(p.orbs.map(o=>o.sourceUnitId))];
  const round=getCatalogRoundById('2-7'),base=createMatch(42),prepared:MatchState={...base,round:10,roundDefinitionId:'2-7',m8:{...base.m8,round,loot:prepareMatchLoot(42,10)},preparation:{...base.preparation,units:[...base.preparation.units.filter(u=>u.team==='player'),...createRoundEnemies(10)]}};
  const raw=createCombat(prepared.preparation);
  const reveal=(dead:readonly string[])=>{
   const combat={...raw,combatId:'round-10',tick:1,nextEventSeq:sources.length+1,status:'finished' as const,result:'playerWin' as const,units:raw.units.map(u=>dead.includes(u.id)?{...u,alive:false,hp:0}:u),neutralReceipts:{deaths:dead.map((unitId,i)=>({unitId,tick:1,eventSeq:i+1})),controls:[]}};
   return revealMatchLoot(prepared,combat).state;
  };
  const all=reveal(sources),reversed=reveal([...sources].reverse()),partial=reveal(sources.slice(1));
  for(const o of p.orbs){const payloads=o.entries.map(e=>e.payload);expect(all.m8.loot.frozen.rounds.at(-1)!.orbs.find(x=>x.orbId===o.orbId)!.entries.map(e=>e.payload)).toEqual(payloads);expect(reversed.m8.loot.frozen).toBe(all.m8.loot.frozen);expect(partial.m8.loot.frozen).toBe(all.m8.loot.frozen);}
  expect(partial.m8.loot.direct.filter(d=>d.status==='forfeited').map(d=>d.dropId)).toEqual(p.orbs.filter(o=>o.sourceUnitId===sources[0]).flatMap(o=>o.entries.map(e=>e.dropId)));
 });
 it('7: every box row opens correctly, D2 omits only unsupported atoms; two-star pool/shortage/capacity accounting',()=>{
  for(const [id,rows] of Object.entries(ORB_BOXES)){
   const seen=new Set<string>();
   for(let n=0;n<5000&&seen.size<rows.length;n++){
    const orbId='synthetic:'+n,actual=sampleOrbBox(42,orbId,id);seen.add(actual.rowId);
    expect(actual.payloads).toEqual(oracle.box(42,orbId,id));
    for(const p of actual.payloads)if(p.kind==='unit')expect(Object.values(SHOP_CATALOG_BY_COST).flat()).toContain(p.definitionId);
   }expect(seen.size).toBe(rows.length);
  }
  expect(ORB_BOXES.gold[1].rewards).toEqual([{kind:'gold',quantity:4},{kind:'consumable',definitionId:'reforger',quantity:1}]);
  expect(ORB_BOXES.ultraPlus[2].rewards).toEqual([{kind:'gold',quantity:24}]);expect(ORB_BOXES.ultraPlus[8].rewards).toEqual([{kind:'forge',definitionId:'TFT_ArmoryKeyOrnn',quantity:1},{kind:'consumable',definitionId:'magnetic-remover',quantity:1}]);
  const {pool,states}=room(undefined,1),state=states[0],definitionId='nami';
  const drop={...state.m8.loot.frozen.rounds[0].encounterPlan.drops[0],dropId:'two-star-drop',payload:{kind:'unit',definitionId,quantity:1,starLevel:2}} as FrozenDirectDrop;
  for(const [available,full] of [[3,false],[2,false],[3,true]] as const){
   const draft=draftPool(pool);draft.available[definitionId]=available;const events:Parameters<typeof rewardPolicy>[2]=[];
   const result=rewardPolicy(draft,state,events)(drop,full);
   if(available===3&&!full){expect(result).toEqual(drop.payload);expect(draft.available[definitionId]).toBe(0);expect(draft.pending.at(-1)).toMatchObject({starLevel:2,definitionId});}
   else{const price=full?getUnitSellPrice({id:'orb',team:'player',definitionId,starLevel:2,location:{kind:'bench',slot:0}}):3;expect(result).toMatchObject({kind:'gold',quantity:price,resolution:full?'capacity-sold':'gold'});expect(draft.available[definitionId]).toBe(available);}
  }
  // Grant the complete two-star payload, rather than three independent 1-stars.
  const solo=createMatch(42),grantState={...solo,m8:{...solo.m8,loot:{...solo.m8.loot,direct:[{dropId:drop.dropId,status:'revealed' as const,receiptId:null}]}}};
  const paid=grantDirectLoot(grantState,false,undefined,[drop]).state;
  expect(paid.preparation.units.find(u=>u.definitionId===definitionId)).toMatchObject({starLevel:2});
 });
 it('8: duplicators come only from selected box rows; legacy loot cursor is reserved for unchanged epic structure',()=>{
  for(let seed=0;seed<100;seed++){
   const early=freezeLootThroughRound(seed,24);expect(early.rng).toEqual({state:(seed^0xdeadbeef)>>>0,draws:0});
   for(const r of early.rounds)for(const o of r.orbs)expect(o.entries.map(e=>e.payload)).toEqual(sampleOrbBox(seed,o.orbId,o.templateId).payloads);
   const full=freezeLootThroughRound(seed,38),expected=oracle.lootPlan(seed,38);expect(full.rng).toEqual(expected.rng);expect(full.rounds.slice(6)).toEqual(expected.rounds.slice(6));
  }
 });
 it('9: rejected claims/wrong phase preserve original state, RNG and serials',()=>{
  const state=createMatch(42),before=JSON.stringify(state);
  for(const result of [claimOrb(state,'absent',1),claimOrb(state,'absent',2),useConsumable(state,'absent',{kind:'unit',unitId:'unit-1'})]){
   expect(result.ok).toBe(false);expect(result.state).toBe(state);expect(JSON.stringify(result.state)).toBe(before);
  }
  const shared=room(undefined,1).states[0],terminal:MatchState={...shared,phase:'gameOver',combat:null,outcome:'defeat'};
  for(const [source,expectedRound,reason] of [[shared,shared.round+1,'stale-round'],[shared,shared.round,'unknown-orb'],[terminal,terminal.round,'wrong-phase']] as const){
   const result=claimOrb(source,'absent',expectedRound);expect(result).toEqual({ok:false,state:source,reason});expect(result.state).toBe(source);
  }
 });
 it('10: component forge offers four unique ordinary components and follows the existing choice/receipt path',()=>{
  expect(G24_FORGE_POOLS.TFT_ArmoryKeyComponent).toEqual(['belt','bow','cloak','gloves','rod','sword','tear','vest']);
  for(let seed=0;seed<100;seed++){const offers=epicForgeOffers(seed,'synthetic','TFT_ArmoryKeyComponent');expect(new Set(offers).size).toBe(4);for(const id of offers)expect(G24_FORGE_POOLS.TFT_ArmoryKeyComponent).toContain(id);}
  let state=createMatch(42);const drop=state.m8.loot.frozen.rounds[0].encounterPlan.drops[0],receiptId=JSON.stringify([drop.dropId,'grant']);
  const payload:LootPayload={kind:'forge',definitionId:'TFT_ArmoryKeyComponent',quantity:1};
  state={...state,m8:{...state.m8,loot:{...state.m8.loot,receipts:[{receiptId,dropId:drop.dropId,payload,grantedItemIds:[],grantedUnitIds:[]}]}}};
  for(const definitionId of Object.keys(G24_FORGE_POOLS))expect(()=>validateResourceReceipts({scheduleReceipts:[],lootReceipts:[{...state.m8.loot.receipts[0],payload:{kind:'forge',definitionId:definitionId as typeof payload.definitionId,quantity:1}}],throughRoundOrdinal:1})).not.toThrow();
  expect(()=>validateResourceReceipts({scheduleReceipts:[],lootReceipts:[{...state.m8.loot.receipts[0],payload:{kind:'forge',definitionId:'unknown-forge' as typeof payload.definitionId,quantity:1}}],throughRoundOrdinal:1})).toThrow('forge grant');
  const opened=openEpicForge(state).state,c=opened.pendingChoice!;expect(c.choiceId).toBe(epicForgeId(receiptId));
  const paid=accepted(selectChoice(opened,c.choiceId,c.generation,c.offers[0]));expect(paid.items.at(-1)!.definitionId).toBe(c.offers[0]);expect(openEpicForge(paid).state).toBe(paid);
 });
 it('11: current saves replay-authenticate layout/loot; prior schema/save versions and forged ledgers reject',()=>{
  expect(M8_VERSION).toMatchObject({schemaVersion:12,saveFormatVersion:8,replayFormatVersion:6});const s=createMatch(42);expect(restoreMatch(serializeMatch(s))).toEqual(s);
  for(const schemaVersion of [7,6])expect(()=>restoreMatch({...s,schemaVersion})).toThrow();
  expect(routeSaveFile({kind:'hex-autobattler-save',saveFormatVersion:3,replayFormatVersion:3,match:{...s,rulesVersion:'s13-g2-3-v16'}}).view).toMatchObject({status:'rejected',reason:'unsupported-version'});
  expect(()=>restoreMatch({...s,rulesVersion:'s13-g2-3-v16',contentVersion:'s13-14.24b-g2-3-v16'})).toThrow();
  const l=clone(layout(42,2));Object.assign(l.rounds[0].orbs[0],{tier:'prismatic'});expect(()=>restoreOrbLayout(l)).toThrow();
  const loot=clone(freezeLootThroughRound(42,2));Object.assign(loot.rounds[0].encounterPlan.drops[0],{payload:{kind:'gold',quantity:999}});expect(()=>restoreFrozenLootLedger(loot,{seed:42,throughRoundOrdinal:2})).toThrow();
  const corrupt=clone(s);Object.assign(corrupt.m8.loot.frozen.rounds[0].orbs[0].entries[0],{payload:{kind:'gold',quantity:999}});expect(()=>restoreMatch(corrupt)).toThrow();
 });
});
