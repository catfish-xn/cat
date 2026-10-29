import { existsSync, readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AUGMENT_BATCH5_H12 } from '../src/simulation/content/augment-pool-batch5-h12';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { buyUnit, buyXp, equipItem, nextRound, rerollShop, selectChoice, startMatchCombat, type MatchState } from '../src/simulation/match';
import { headStartShopDisabled } from '../src/simulation/augment-pool-batch5-h12';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { getUnitSellPrice } from '../src/simulation/unit-stats';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { accepted, emptyBoard, resolveM5Choices, reachRoundFielded } from './match-helpers';
import { claimAllOrbs, runUntil } from './server/helpers';
import { assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { firstOffer, pick, trip, reject, roomOffer, onlineTripAndReject, RESEARCH_FILE } from './augment-pool-batch5-h12-helpers';

let before:MatchState,chosen:MatchState;
beforeAll(()=>{
 before=reachRoundFielded('2-1',firstOffer('head-start').seed);
 const unit=before.preparation.units.find(u=>u.team==='player')!,item=before.items.find(i=>i.location.kind==='inventory')!;
 expect(item).toBeDefined();before=accepted(equipItem(before,item.id,unit.id,0));
 chosen=pick(before,'head-start');
});
it('B5-80 offers only 2-1 as silver, including the independent oracle',()=>{
 expect(AUGMENT_TIERS['head-start']).toBe('silver');
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed('head-start',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='2-1');
  expect(augmentPool('silver',[],[],`round:${node}:augment`,[]).includes('head-start')).toBe(node==='2-1');
 }
});
it.skipIf(!existsSync(RESEARCH_FILE))('B5-80 matches the independent 14.24 archive',()=>{
 const r=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT_Augment_HeadStart');
 expect(AUGMENT_BATCH5_H12['head-start'].source.values).toEqual(r.effects);
 expect(AUGMENT_BATCH5_H12['head-start'].description).toBe(r.description_zh_cn);
});
it('B5-80 public selection sells the frozen army at normal prices, returns equipment and grants four 2-star 1-costs once',()=>{
 const heroes=before.preparation.units.filter(u=>u.team==='player');
 expect(chosen.gold-before.gold).toBe(heroes.reduce((n,u)=>n+getUnitSellPrice(u),0));
 expect(chosen.preparation.units.some(u=>heroes.some(old=>old.id===u.id))).toBe(false);
 expect(chosen.items.filter(i=>i.location.kind==='inventory')).toHaveLength(before.items.length);
 const gifts=chosen.seatMechanics!.receipts.filter(r=>r.kind==='unit'&&r.receiptId.includes('head-start'));
 expect(gifts).toHaveLength(4);
 for(const gift of gifts){expect(gift).toMatchObject({starLevel:2});if(gift.kind==='unit')expect(UNIT_DEFINITIONS[gift.definitionId].cost).toBe(1);}
 const c=before.pendingChoice!,again=selectChoice(chosen,c.choiceId,c.generation,'head-start');expect(again.ok).toBe(false);expect(again.state).toBe(chosen);
 trip(chosen);
});
it('B5-80 blocks buy and manual reroll for exactly three natural rounds; XP/income/natural shops continue',()=>{
 let state=chosen;
 for(let offset=0;offset<3;offset++){
  expect(state.round).toBe(chosen.round+offset);expect(headStartShopDisabled(state)).toBe(true);
  for(const result of [buyUnit(state,0,state.shop.generation),rerollShop(state)]){expect(result).toMatchObject({ok:false,reason:'wrong-phase'});expect(result.state).toBe(state);expect('events' in result).toBe(false);}
  if(offset===0){const xp=accepted(buyXp(state));expect(xp.gold).toBe(state.gold-4);state=xp;}
  const previous=state;state=resolveM5Choices(accepted(nextRound(resolveM5Choices(accepted(startMatchCombat(emptyBoard(state)))),state.round)));
  expect(state.shop.generation).toBeGreaterThan(previous.shop.generation);
 }
 expect(headStartShopDisabled(state)).toBe(false);
 state=resolveM5Choices(accepted(nextRound(state,state.round)));expect(rerollShop(state).ok).toBe(true);
 const slot=state.shop.slots.findIndex(s=>s.status==='available');expect(buyUnit(state,slot,state.shop.generation).ok).toBe(true);trip(state);
});
it.each(['object evidence','missing history','gold','gift star','sold roster','choice round'])('B5-80 rejects %s tampering at all three offline entries',kind=>{
 reject(chosen,s=>{
  if(kind==='object evidence')s.augmentHistory.facts[0].resourcePrefix++;
  if(kind==='missing history')delete s.augmentHistory;
  if(kind==='gold')s.gold++;
  if(kind==='gift star')s.seatMechanics.receipts.find((r:any)=>r.kind==='unit'&&r.receiptId.includes('head-start')).starLevel=1;
  if(kind==='sold roster')s.augmentHistory.facts.find((f:any)=>f.kind==='acquire').roster.units=[];
  if(kind==='choice round')s.augments.find((a:any)=>a.definitionId==='head-start').acquiredRound++;
 });
});
describe('B5-80 online',()=>{
 let ctx:ReturnType<typeof roomOffer>;
 beforeAll(()=>{ctx=roomOffer('head-start');});
 for(const round of [2,3,4])beforeAll(()=>runUntil(ctx.room,ctx.clock,s=>s.round===round&&s.phase==='preparation'));
 afterAll(()=>ctx.room.dispose());
 it('B5-80 real Room handles choose/buy/reroll/XP/orb claims and pool-authenticated restore',()=>{
 const {room,seatId}=ctx;
  const get=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
  const old=get(),c=old.pendingChoice!;expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'head-start'})).toMatchObject({ok:true});
  expect(requireAugmentFacts(get(),'acquire',get().round)[0].roster.units).toEqual(old.preparation.units.filter(u=>u.team==='player'));
  expect(room.handle(seatId,{type:'buy',slot:0,generation:get().shop.generation})).toMatchObject({ok:false,reason:'wrong-phase'});
  expect(room.handle(seatId,{type:'reroll'})).toMatchObject({ok:false,reason:'wrong-phase'});
  expect(room.handle(seatId,{type:'buyXp'})).toMatchObject({ok:true});
  claimAllOrbs(room,[seatId]);
  expect(get().seatMechanics!.receipts.filter(r=>r.kind==='unit'&&r.receiptId.includes('head-start'))).toHaveLength(4);
  assertSharedPoolConservation(room.state.pool,room.state.seats.map(s=>s.match));
  onlineTripAndReject(ctx,s=>{s.augmentHistory.facts[0].goldBefore++;});
 });
 for(const round of [5,6,8])it(`continues through real room round ${round}`,()=>{
  runUntil(ctx.room,ctx.clock,s=>s.round===round&&s.phase==='preparation');
  expect(headStartShopDisabled(ctx.room.state.seats.find(s=>s.seatId===ctx.seatId)!.match)).toBe(round<7);
 });
});
