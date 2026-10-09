import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
const FINAL_ROUND=ROUND_CATALOG.at(-1)!.ordinal;
const BATTLE_COUNT=ROUND_CATALOG.filter(r=>r.kind!=='supply').length;
import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import assertGolden from './fixtures/m5/assert-golden.cjs';
import { run } from '../scripts/generate-m5-route.cjs';

describe('M5 ordinary three-build routes and independent resource ledger',()=>{
 it('normally buys five-cost Caitlyn and fields her for at least two real battles',async()=>{
  const route=await run(api,{build:'sniper-caitlyn',seed:42});assertGolden(route);
  expect(route.summary.outcome).toBe('victory');expect(route.summary.round).toBe(FINAL_ROUND);
  expect(route.summary.formedBattles).toBeGreaterThanOrEqual(3);
  expect(route.summary.caitlynBattles).toBeGreaterThanOrEqual(2);expect(route.summary.caitlynCasts).toBeGreaterThanOrEqual(2);
  expect(route.final.preparation.units.some(u=>u.team==='player'&&u.definitionId==='caitlyn')).toBe(true);
  expect(route.rounds.filter(r=>r.events.some((e:unknown)=>{const event=e as {type:string;source?:{definitionId:string};hpDamage?:number};return event.type==='packetDamage'&&event.source?.definitionId==='caitlyn-ability'&&(event.hpDamage??0)>0;})).length).toBeGreaterThanOrEqual(2);
 },120000);
 for(const build of ['cannon','sniper','mage'])it(`${build}: ordinary purchases/rewards to 6-7 with a complete build`,async()=>{
  const route=await run(api,{build,seed:42});assertGolden(route);
  expect(route.summary.outcome).toBe('victory');expect(route.summary.round).toBe(FINAL_ROUND);
  expect(route.summary.formedBattles).toBeGreaterThanOrEqual(3);expect(route.summary.boundBattles).toBeGreaterThanOrEqual(2);
  expect(route.summary.transitioned).toBe(true);expect(route.ledger.rounds).toHaveLength(ROUND_CATALOG.length);
  expect(route.rounds.filter(r=>{if(!r.binding)return false;const sources=r.snapshot.units.find(u=>u.unitId===r.binding!.unitId)?.sources??[];return ['trait','item','augment','anomaly'].every(kind=>sources.some(s=>s.source.sourceKind===kind));}).length).toBeGreaterThanOrEqual(2);
  expect(route.final.augments).toHaveLength(3);expect(route.final.anomalyBinding).not.toBeNull();
  expect(route.rounds).toHaveLength(BATTLE_COUNT);expect(route.final.scheduleReceipts.reduce((n,r)=>n+r.itemIds.length,0)).toBe(15);
  expect(route.actions.some(a=>a.command.type==='lock')).toBe(true);
  expect(route.actions.some(a=>a.events.some((e:unknown)=>(e as {type:string}).type==='unitUpgraded'))).toBe(true);
  expect(route.actions.some(a=>a.command.type==='sell'&&a.events.some((e:unknown)=>{const event=e as {type:string;itemIds?:string[]};return event.type==='itemsReturned'&&(event.itemIds?.length??0)>0;}))).toBe(true);
  const end=route.final;
  for(const result of [api.rerollShop(end),api.buyXp(end),api.nextRound(end,FINAL_ROUND),api.startMatchCombat(end),api.sellUnit(end,end.preparation.units[0].id)]){
   expect(result).toEqual({ok:false,reason:'wrong-phase',state:end});expect(result.state).toBe(end);
  }
  expect(api.stepMatch(end)).toEqual({state:end,events:[]});
  expect(api.createMatch(42)).toEqual(route.initial);
 },120000);
});
