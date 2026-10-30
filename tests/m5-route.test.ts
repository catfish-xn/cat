import { lootPlan as independentLootPlan } from './fixtures/orb-combo-oracle.cjs';
import { readComponentEquivalent } from '../src/simulation/loot-view';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
const FINAL_ROUND=ROUND_CATALOG.at(-1)!.ordinal;
const BATTLE_COUNT=ROUND_CATALOG.filter(r=>r.kind!=='supply').length;
import { beforeAll, describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import assertGolden from './fixtures/m5/assert-golden.cjs';
import { run } from '../scripts/generate-m5-route.cjs';
import { routeOptions } from '../scripts/v26-neutrals-1424-route.cjs';
import { roundRouteCache } from './fixtures/round-route-cache';

// Every consuming describe owns its setup. Hooks run even with -t and are not
// shuffled with tests; each hook advances only one bounded live-tick segment.
// Assertion cases can only read completed routes, never finish a cold route.
function routeFixture(build:string,seed=42,augmentPriorities:string[]=[]){
 let result:Awaited<ReturnType<typeof run>>|undefined;
 const progress=roundRouteCache(async onRound=>{
  // The existing driver implements these callbacks; its older declaration only lists onStep.
  const options={build,seed,...routeOptions(build,seed),augmentPriorities,onRound,onBattleProgress:onRound};
  result=await run(api,options);return result.final;
 });
 for(let round=1;round<=FINAL_ROUND;round++)for(const tick of [300,600,900,1200,1201])beforeAll(async()=>{
  await progress.through(round-1+tick/1201);
 });
 beforeAll(async()=>{await progress.finish();});
 return ()=>{
  if(!result)throw new Error(`Route fixture not completed: ${build}:${seed}`);
  return result;
 };
}
describe('M5 ordinary three-build routes and independent resource ledger',()=>{
 for(const build of ['sniper-caitlyn','cannon','sniper','mage'])describe(build,()=>{
  const ordinary=routeFixture(build);
  // These real first offers avoid unrelated history owners on the alternate routes.
  const alternate=build==='sniper-caitlyn'?routeFixture(build,44,['pit-fighter-crest']):build==='sniper'?routeFixture(build,782,['rebel-crest']):ordinary;
 if(build==='sniper-caitlyn'){
 it('normally buys five-cost Caitlyn and fields her for at least two real battles',()=>{
  const goldenRoute=ordinary();assertGolden(goldenRoute);
  expect(goldenRoute.summary.outcome).toBe('victory');expect(goldenRoute.summary.round).toBe(FINAL_ROUND);
  // #265 restores the v15 loot cursor. Seed42 no longer fields Caitlyn;
  // retain its entire golden and use a second ordinary paid route for the
  // unchanged two-battle spell/damage assertions (seed44: four battles, six casts).
  const route=alternate();
  expect(route.summary.outcome).toBe('victory');expect(route.summary.round).toBe(FINAL_ROUND);
  expect(route.summary.caitlynBattles).toBeGreaterThanOrEqual(2);expect(route.summary.caitlynCasts).toBeGreaterThanOrEqual(2);
  expect(route.final.preparation.units.some(u=>u.team==='player'&&u.definitionId==='caitlyn')).toBe(true);
  expect(route.rounds.filter(r=>r.events.some((e:unknown)=>{const event=e as {type:string;outcome?:{context:{source:{definitionId:string}};hpDamage:number}};return event.type==='packetDamage'&&event.outcome?.context.source.definitionId==='caitlyn-ability'&&(event.outcome?.hpDamage??0)>0;})).length).toBeGreaterThanOrEqual(2);
 });
 }else it(`${build}: ordinary purchases/rewards to 6-7 with a complete build`,()=>{
  const route=ordinary();assertGolden(route);
  expect(route.summary.outcome).toBe('victory');expect(route.summary.round).toBe(FINAL_ROUND);
  expect(route.summary.boundBattles).toBeGreaterThanOrEqual(2);
  expect(route.ledger.rounds).toHaveLength(ROUND_CATALOG.length);
  expect(route.rounds.filter(r=>{if(!r.binding)return false;const sources=r.snapshot.units.find(u=>u.unitId===r.binding!.unitId)?.sources??[];return ['trait','item','augment','anomaly'].every(kind=>sources.some(s=>s.source.sourceKind===kind));}).length).toBeGreaterThanOrEqual(2);
  expect(route.final.augments).toHaveLength(3);expect(route.final.anomalyBinding).not.toBeNull();
  expect(route.rounds).toHaveLength(BATTLE_COUNT);
  expect(route.actions.some(a=>a.command.type==='lock')).toBe(true);
  expect(route.actions.some(a=>a.events.some((e:unknown)=>(e as {type:string}).type==='unitUpgraded'))).toBe(true);

  const end=route.final;
  for(const result of [api.rerollShop(end),api.buyXp(end),api.nextRound(end,FINAL_ROUND),api.startMatchCombat(end),api.sellUnit(end,end.preparation.units[0].id)]){
   expect(result).toEqual({ok:false,reason:'wrong-phase',state:end});expect(result.state).toBe(end);
  }
  expect(api.stepMatch(end)).toEqual({state:end,events:[]});
  expect(api.createMatch(42)).toEqual(route.initial);
 });
 // Signed R3/R4: 2–3 opening component value + four 2-value PvE packages + five supply choices.
 // Prismatic packages substitute a completed item (value 2); 6-7 grants gold/tool only.
 it(`[B8] ${build}: complete-build battles and full component grant chain`,()=>{
  const route=ordinary();
  expect(route.summary.formedBattles).toBeGreaterThanOrEqual(3);
  // Terminal victory: the final 6-7 drop is already granted in the same gameOver state (no later award),
  // read-only, and identical after strict restore.
  const end=route.final,view=api.readLootView(end),final=end.m8.loot.frozen.rounds.find(r=>r.encounterPlan.roundId==='6-7')!;
  expect(end.phase).toBe('gameOver');
  expect(view).toMatchObject({roundId:'6-7',pendingClaims:[],canContinue:false,reason:'game-over'});
  expect(view.revealedDrops.map(d=>[d.dropId,d.status])).toEqual(final.encounterPlan.drops.map(d=>[d.dropId,'granted']));
  expect(view.revealedDrops.every(d=>end.m8.loot.receipts.some(r=>r.receiptId===d.receiptId&&r.dropId===d.dropId))).toBe(true);
  expect(api.readLootView(restoreMatch(serializeMatch(end)))).toEqual(view);
  if(build!=='sniper-caitlyn'){
   expect(route.summary.transitioned).toBe(true);
   const transferRoute=build==='sniper'?alternate():route;
   expect(transferRoute.actions.some(a=>a.command.type==='sell'&&a.events.some((e:unknown)=>{const event=e as {type:string;itemIds?:string[]};return event.type==='itemsReturned'&&(event.itemIds?.length??0)>0;}))).toBe(true);
   const supply=route.final.scheduleReceipts.reduce((n,r)=>n+r.itemIds.length,0);
   const loot=route.final.m8.loot.receipts.filter(r=>r.payload.kind==='item');
   expect(supply).toBe(5);
   // Keep the full reward chain exact: every independently planned entry is
   // earned once. v26 seed-42 routes (2-1 public rerolls) win every PvE round,
   // including the restored 14.24 krugs at 2-7, so nothing is forfeited.
   const independent=independentLootPlan(42).rounds.flatMap(r=>r.encounterPlan.drops);
   const lost:typeof independent=[];
   expect(route.final.m8.loot.direct.filter(d=>d.status==='forfeited').map(d=>d.dropId).sort()).toEqual(lost.map(d=>d.dropId).sort());
   expect(route.final.roundResults.filter(r=>r.roundKind==='pve'&&r.result!=='playerWin').map(r=>[r.roundId,r.result,r.survivingEnemyCount,r.playerDamage])).toEqual([]);
   const planned=independent.filter(d=>d.payload.kind==='item'&&!lost.includes(d));
   expect(loot.map(r=>r.dropId).sort()).toEqual(planned.map(d=>d.dropId).sort());
   const lostValue=0;
   expect(loot.every(r=>r.grantedItemIds.length===1&&r.payload.quantity===1)).toBe(true);
   const value=loot.reduce((n,r)=>n+(r.payload.kind==='item'&&ITEM_DEFINITIONS[r.payload.definitionId].kind==='completed'?2:1),0);
   // v22: loot forges are bench anvils (opened by selling, 4 picks); the 4-7 component anvil is extra.
   const anvils=route.final.m8.loot.receipts.flatMap(r=>r.payload.kind==='forge'?r.grantedUnitIds.map(id=>({id,definitionId:(r.payload as {definitionId:string}).definitionId})):[]);
   const opened=new Set(route.final.seatMechanics!.receipts.filter(r=>r.source==='anvil-unit'&&r.kind==='choice'&&r.itemId!==null).map(r=>r.receiptId));
   const forges=anvils.filter(a=>a.definitionId==='TFT_ArmoryKeyCompleted'),componentAnvils=anvils.filter(a=>a.definitionId==='TFT_ArmoryKeyComponent');
   const isOpened=(a:{id:string})=>opened.has(JSON.stringify(['anvil',a.id]));
   // Independent #265 reward oracle: seed42 has two standard epic variants,
   // eleven planned item value + five supply components + two completed forges.
   expect(forges).toHaveLength(2);expect(componentAnvils).toHaveLength(1);expect(supply+value+forges.length*2).toBe(20-lostValue);
   // The 6-7 forge lands with the final settlement, so it stays an unopened anvil.
   expect(forges.map(isOpened)).toEqual([true,false]);expect(componentAnvils.every(isOpened)).toBe(true);
   expect(readComponentEquivalent(route.final)).toBe(20-lostValue-2+componentAnvils.length);
  }
 });
 });
});
