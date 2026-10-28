import { withB1Offers } from './fixtures/b1-scripted-offers';
import { freeRerollsAvailable } from '../src/simulation/free-rerolls';
import { NET_PROTOCOL_VERSION, parseClientMessage } from '../src/server/net/messages';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { accept as sharedAccept } from './tp-helpers';
import { BattleHistory } from '../src/replay/history';
import { recordCommand, recordedEmptyRoute } from './fixtures/recorded-empty-route';
import { exportFile, validateFile } from '../src/persistence/format';
import { M8_VERSION } from '../src/simulation/m8/version';
import type { SaveEnvelope } from '../src/m6/contracts';
import { beforeAll, describe, expect, it } from 'vitest';
import { deepStrictEqual } from 'node:assert/strict';
import { buyUnit, buyXp, combineItems, createMatch, nextRound, openAnvil, rerollShop, selectChoice, setShopLock, startMatchCombat, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { grantMechanicGold } from '../src/simulation/seat-mechanics/grants';
import { accepted, emptyBoard, reachRoundFielded, resolveM5Choices } from './match-helpers';
import { validateShopHistory } from '../src/simulation/shop-history';
import { SHOP_AUGMENT_KEY } from '../src/simulation/shop-augments';
import { readSeatMechanic, writeSeatMechanic } from '../src/simulation/seat-mechanics/state';
import { createSharedPool, initializeSharedSeat, generateSharedShop, runSharedMatchCommand, nextSharedRound, restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { applySeatCommand } from '../src/server/room/room';
import { makeRoom, runUntil } from './server/helpers';

const entries=['JSON','object','serialized'] as const;
const restore=(s:MatchState,entry:typeof entries[number])=>entry==='JSON'?restoreMatch(JSON.stringify(s)):entry==='object'?restoreMatch(s):restoreMatch(serializeMatch(s));
const rich=(s:MatchState)=>accepted(grantMechanicGold(s,{receiptId:'shop-history-test-gold',source:'test',amount:200}));
import { shopOwner } from './fixtures/shop-history-match';
import { boundedFirstNodeOffer, firstNodeSeed } from './augment-stage-helpers';
// Detached saves are the only values modified in the attack matrix.
type Json=any;
let ticket:MatchState,starry:MatchState,bought:MatchState;
beforeAll(()=>{ticket=shopOwner(0,'prismatic-ticket');});
beforeAll(()=>{
 const open=boundedFirstNodeOffer('starry-night'),choice=open.pendingChoice!;
 starry=rich(accepted(selectChoice(open,choice.choiceId,choice.generation,'starry-night')));
 expect(starry).toBeDefined();
 for(let i=0;i<40&&!starry.shop.slots.some(s=>s.status==='available'&&s.starLevel===2);i++)starry=accepted(rerollShop(starry));
 const slot=starry.shop.slots.findIndex(s=>s.status==='available'&&s.starLevel===2);expect(slot).toBeGreaterThanOrEqual(0);
 bought=accepted(buyUnit(starry,slot,starry.shop.generation));
});
for(const entry of entries)describe(entry,()=>{
 it('round-trips acquisition, offers and purchases; continues identical paid/free rerolls and XP',()=>{
  for(const s of [ticket,starry,bought]){
   const copy=restore(s,entry);deepStrictEqual(copy,s);
   deepStrictEqual(rerollShop(copy),rerollShop(s));deepStrictEqual(buyXp(copy),buyXp(s));
  }
  let a=rich(ticket),b=restore(a,entry);
  for(let i=0;i<12;i++){const x=rerollShop(a),y=rerollShop(b);deepStrictEqual(x,y);a=accepted(x);b=restore(accepted(y),entry);}
  expect(a.shopHistory!.entries.filter(e=>e.kind==='draw'&&e.credit)).not.toHaveLength(0);
 });
 const attacks:readonly [string,(s:Json)=>void,()=>MatchState][]=[
  ['original Ticket joint rolls/credits',s=>{s.seatMechanics??={version:'seat-mechanics-v1',seat:{},hidden:{},receipts:[]};s.seatMechanics.seat[SHOP_AUGMENT_KEY]={rolls:4,credits:2};},()=>ticket],
  ['missing history',s=>{delete s.shopHistory;},()=>ticket],
  ['unknown history version',s=>{s.shopHistory.version='shop-history-v999';},()=>ticket],
  ['invented generation and counters',s=>{const d=structuredClone(starry.shopHistory!.entries.find(e=>e.kind==='draw'));s.shopHistory.entries.push(d);s.seatMechanics.seat[SHOP_AUGMENT_KEY]={rolls:4,credits:2};},()=>rich(ticket)],
  ['generation-time level with joint offer',s=>{const d=s.shopHistory.entries.find((e:Json)=>e.kind==='draw');d.point.level=10;d.point.xp=0;d.shop.slots[0].starLevel=2;s.shop.slots[0].starLevel=2;},()=>starry],
  ['joint random outcome and offer',s=>{const d=s.shopHistory.entries.filter((e:Json)=>e.kind==='draw').at(-1);const i=d.shop.slots.findIndex((x:Json)=>x.status==='available'&&x.starLevel===2);delete d.shop.slots[i].starLevel;d.starry[i]=false;delete s.shop.slots[i].starLevel;},()=>starry],
  ['joint purchase provenance, unit, history star and price',s=>{const b=s.shopHistory.entries.find((e:Json)=>e.kind==='buy');const p=s.resourceProvenance.entries[b.point.resourcePrefix];delete p.source.starLevel;b.starLevel=1;b.goldCost/=3;s.gold+=2*b.goldCost;const u=s.preparation.units.find((u:Json)=>u.id===p.unitId);u.starLevel=1;},()=>bought],
  ['deleted purchase evidence',s=>{s.shopHistory.entries=s.shopHistory.entries.filter((e:Json)=>e.kind!=='buy');},()=>bought],
 ];
 for(const [name,edit,get] of attacks)it(`rejects ${name}`,()=>{const s=structuredClone(get());edit(s);expect(()=>restore(s,entry)).toThrow();});
 it('rejects a two-star offer or jointly forged purchase with no Starry Night',()=>{
  const s:Json=structuredClone(createMatch(42)),slot=s.shop.slots.findIndex((x:Json)=>x.status==='available');s.shop.slots[slot].starLevel=2;
  expect(()=>restore(s,entry)).toThrow();
  const plain=rich(createMatch(42)),index=plain.shop.slots.findIndex(x=>x.status==='available');
  const b:Json=structuredClone(accepted(buyUnit(plain,index,plain.shop.generation)));
  const p=b.resourceProvenance.entries.find((e:Json)=>e.kind==='unit-acquired'&&e.source.kind==='shop');p.source.starLevel=2;b.preparation.units.find((u:Json)=>u.id===p.unitId).starLevel=2;
  expect(()=>restore(b,entry)).toThrow();
 });
});
it('rejects joint Ticket counter/history deletion, free-to-paid and grant-source substitutions',()=>{
 let s=rich(ticket);for(let i=0;i<12;i++)s=accepted(rerollShop(s));
 validateShopHistory(s);
 for(const entry of entries)for(const edit of [
  (x:Json)=>{x.shopHistory.entries.pop();const r=readSeatMechanic(x,SHOP_AUGMENT_KEY) as Json;r.rolls--;},
  (x:Json)=>{const d=x.shopHistory.entries.find((e:Json)=>e.kind==='draw'&&e.credit);d.credit=null;d.goldCost=2;},
  (x:Json)=>{const d=x.shopHistory.entries.find((e:Json)=>e.kind==='draw'&&e.credit);d.credit.ordinal++;},
  (x:Json)=>{const d=x.shopHistory.entries.find((e:Json)=>e.kind==='draw');d.cause='natural';},
  (x:Json)=>{x.gold+=2;},
  (x:Json)=>{x.shopHistory.initial.gold+=2;x.shopHistory.entries.forEach((e:Json)=>e.point.gold+=2);x.gold+=2;},
 ]){const x=structuredClone(s);edit(x);expect(()=>restore(x,entry)).toThrow();}
});
it('natural and locked round continuation retain the acquisition boundary',()=>{
 for(const lock of [false,true]){
  let s=emptyBoard(rich(ticket));s=accepted(setShopLock(s,lock,s.shop.generation));
  s=accepted(rerollShop(s));expect(restoreMatch(serializeMatch(s))).toEqual(s);
  s=accepted(startMatchCombat(s));expect(s.phase).not.toBe('combat');s=resolveM5Choices(s);
  const restored=restoreMatch(serializeMatch(s));deepStrictEqual(nextRound(restored,s.round),nextRound(s,s.round));
  const next=accepted(nextRound(restored,s.round));expect(restoreMatch(serializeMatch(next))).toEqual(next);
 }
});
it('keeps legacy saves without shop augments unchanged and refuses missing owner evidence clearly',()=>{
 const s=createMatch(42),text=serializeMatch(s);expect(text).not.toContain('shopHistory');expect(serializeMatch(restoreMatch(text))).toBe(text);
 const old:Json=structuredClone(ticket);delete old.shopHistory;expect(()=>restoreMatch(old)).toThrow('legacy shop augment saves cannot be authenticated');
 const bad=writeSeatMechanic(ticket,SHOP_AUGMENT_KEY,{rolls:4,credits:2});expect(()=>restoreMatch(bad)).toThrow();
});
describe('online room',()=>{
 const {room,clock}=makeRoom(undefined,{seed:255});
 beforeAll(()=>{room.start();});
 for(const round of [2,3,4])beforeAll(()=>{runUntil(room,clock,s=>s.round===round&&s.phase==='preparation');});
 it('real Room.handle acquisition, buy/reroll/XP dispatch, authoritative snapshot and continuation',()=>{
 const wanted=['prismatic-ticket','starry-night','starry-night-plus','rigged-shop-plus','subscription-service','dual-purpose','reinfourcement','firesale'];
 for(const seat of room.state.seats){
  for(let slot=0;slot<3&&!room.state.seats.some(s=>s.match.pendingChoice?.offers.some(id=>wanted.includes(id)));slot++){
   const c=room.state.seats.find(s=>s.seatId===seat.seatId)!.match.pendingChoice!;
   expect(room.handle(seat.seatId,{type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot}).ok).toBe(true);
  }
 }
 const seat=room.state.seats.find(s=>s.match.pendingChoice?.offers.some(id=>['prismatic-ticket','starry-night','starry-night-plus','rigged-shop-plus','subscription-service','dual-purpose','reinfourcement','firesale'].includes(id)));
 expect(seat).toBeDefined();const c=seat!.match.pendingChoice!,id=c.offers.find(id=>['prismatic-ticket','starry-night','starry-night-plus','rigged-shop-plus','subscription-service','dual-purpose','reinfourcement','firesale'].includes(id))!;
 expect(room.handle(seat!.seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:id}).ok).toBe(true);
 for(const type of ['reroll','buyXp'] as const){const result=room.handle(seat!.seatId,{type});expect(result.ok).toBe(true);}
 const state=room.state.seats.find(s=>s.seatId===seat!.seatId)!.match,pool=room.state.pool;
 const authority=room.augmentHistoryAuthority(seat!.seatId);
 expect(restoreSharedOrbSnapshot(pool,JSON.stringify(state),authority)).toEqual(state);
 deepStrictEqual(applySeatCommand(pool,restoreSharedOrbSnapshot(pool,state,authority),{type:'reroll'}),applySeatCommand(pool,state,{type:'reroll'}));
 const old:Json=structuredClone(state);delete old.shopHistory;expect(()=>restoreSharedOrbSnapshot(pool,old,authority)).toThrow('legacy shop augment saves cannot be authenticated');
 room.dispose();
});

});

it.each([
 [14,'dual-purpose','2-1'],[160,'subscription-service','2-1'],[9,'rigged-shop-plus','3-2'],
 [8,'starry-night-plus','3-2'],[95,'firesale','3-2'],
] as const)('real %s %s at %s authenticates XP, lock, reroll and round continuation',(seed,id,node)=>{
 let state=shopOwner(seed,id,node);if(id!=='subscription-service')state=rich(state);validateShopHistory(state);
 state=accepted(buyXp(state));validateShopHistory(state);
 state=accepted(setShopLock(state,true,state.shop.generation));
 state=accepted(buyXp(state));validateShopHistory(state);
 state=accepted(rerollShop(state));validateShopHistory(state);
 state=accepted(setShopLock(state,false,state.shop.generation));
 state=accepted(startMatchCombat(emptyBoard(state)));state=resolveM5Choices(state);
 state=accepted(nextRound(state,state.round));validateShopHistory(state);
 expect(restoreMatch(serializeMatch(state))).toEqual(state);
});
it('M6 envelope round-trips the versioned history and carries authenticated prefixes across a recorded battle',async()=>{
 const history=new BattleHistory('shop-history-persistence');
 let state=recordedEmptyRoute(firstNodeSeed('starry-night'),'2-1',history),c=state.pendingChoice!;
 state=rich(accepted(selectChoice(state,c.choiceId,c.generation,'starry-night')));
 state=accepted(rerollShop(state));state=emptyBoard(state);
 state=accepted(recordCommand(history,state,startMatchCombat(state)));state=resolveM5Choices(state);
 state=accepted(nextRound(state,state.round));
 const envelope:SaveEnvelope={kind:'hex-autobattler-save',saveFormatVersion:M8_VERSION.saveFormatVersion,replayFormatVersion:M8_VERSION.replayFormatVersion,runId:'shop-history-persistence',createdAt:'2026-10-27T00:00:00.000Z',match:state,battles:history.completedRecords,currentBattle:null};
 const restored=await validateFile(exportFile(envelope),()=>{});deepStrictEqual(restored,envelope);
 deepStrictEqual(rerollShop(restored.match),rerollShop(state));
 const forged:Json=structuredClone(envelope);delete forged.match.shopHistory;
 await expect(validateFile(exportFile(forged),()=>{})).rejects.toThrow('legacy shop augment saves cannot be authenticated');
});

it('online finite-pool Starry Night purchases authenticate both shared restore entries and room dispatch continuation',()=>{
 const seed=starry.seed;
 let pool=createSharedPool('shop-history-online',seed,{seatCount:1});
 let result=sharedAccept(initializeSharedSeat(pool,createMatch(seed,{mode:'shared-deferred'}),'audit',0));pool=result.pool;
 result=sharedAccept(generateSharedShop(pool,result.state,0));let state=result.state;pool=result.pool;
 for(let round=1;round<=3;round++){
  for(const u of state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board')){
   const r=applySeatCommand(pool,state,{type:'deploy',unitId:u.id,target:{kind:'bench',slot:0}});expect(r.ok).toBe(true);state=r.state;pool=r.pool;
  }
  result=sharedAccept(runSharedMatchCommand(pool,state,{type:'startCombat'}));state=result.state;pool=result.pool;expect(state.phase).not.toBe('combat');
  result=sharedAccept(runSharedMatchCommand(pool,state,{type:'claimLoot',round}));state=result.state;pool=result.pool;
  const advanced=nextSharedRound(pool,[state],round);expect(advanced.ok).toBe(true);if(!advanced.ok)throw Error(advanced.reason);pool=advanced.pool;state=advanced.states[0];
 }
 for(let slot=0;slot<3&&!state.pendingChoice!.offers.includes('starry-night');slot++){
  const choice=state.pendingChoice!,r=applySeatCommand(pool,state,{type:'rerollAugment',choiceId:choice.choiceId,generation:choice.generation,optionIndex:slot});
  expect(r.ok).toBe(true);pool=r.pool;state=r.state;
 }
 const c=state.pendingChoice!;expect(c.offers).toContain('starry-night');
 let picked=applySeatCommand(pool,state,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'starry-night'});expect(picked.ok).toBe(true);pool=picked.pool;state=rich(picked.state);
 for(let i=0;i<40&&!state.shop.slots.some(x=>x.status==='available'&&x.starLevel===2);i++){
  const r=applySeatCommand(pool,state,{type:'reroll'});expect(r.ok).toBe(true);pool=r.pool;state=r.state;
 }
 const slot=state.shop.slots.findIndex(x=>x.status==='available'&&x.starLevel===2);expect(slot).toBeGreaterThanOrEqual(0);
 const offer=state.shop.slots[slot];if(offer.status!=='available')throw Error('missing Starry offer');
 const before=state.gold;
 const purchased=applySeatCommand(pool,state,{type:'buy',slot,generation:state.shop.generation});expect(purchased.ok).toBe(true);pool=purchased.pool;state=purchased.state;
 expect(state.gold).toBe(before-3*UNIT_DEFINITIONS[offer.definitionId].cost);
 for(const input of [state,JSON.stringify(state)])deepStrictEqual(restoreSharedOrbSnapshot(pool,input),state);
 deepStrictEqual(applySeatCommand(pool,restoreSharedOrbSnapshot(pool,state),{type:'buyXp'}),applySeatCommand(pool,state,{type:'buyXp'}));
 for(const json of [false,true]){
  const forged:Json=structuredClone(state),buy=forged.shopHistory.entries.find((e:Json)=>e.kind==='buy');buy.starLevel=1;buy.goldCost/=3;
  const fact=forged.resourceProvenance.entries[buy.point.resourcePrefix];delete fact.source.starLevel;forged.preparation.units.find((u:Json)=>u.id===fact.unitId).starLevel=1;
  expect(()=>restoreSharedOrbSnapshot(pool,json?JSON.stringify(forged):forged)).toThrow();
 }
});

it('the unchanged WebSocket command grammar carries shop commands and rejects client-supplied history or free flags',()=>{
 const commands=[{type:'reroll'},{type:'buyXp'},{type:'buy',slot:0,generation:4},{type:'shopLock',locked:true,generation:4},{type:'choose',choiceId:'choice',generation:0,definitionId:'starry-night'}];
 for(const command of commands){
  const envelope={type:'command',protocolVersion:NET_PROTOCOL_VERSION,commandId:1,roomId:'room',round:4,seatRevision:0,command};
  expect(parseClientMessage(JSON.stringify(envelope))).toMatchObject({ok:true,message:{command}});
  expect(parseClientMessage(JSON.stringify({...envelope,command:{...command,shopHistory:{version:'shop-history-v1',entries:[]}}}))).toMatchObject({ok:false,code:'invalid-message'});
  expect(parseClientMessage(JSON.stringify({...envelope,command:{...command,free:true}}))).toMatchObject({ok:false,code:'invalid-message'});
 }
});


it('Crafted Crafting cannot lend a later same-round combination credit to an earlier shop-history refresh',()=>withB1Offers(['crafted-crafting','starry-night-plus'],()=>{
 let open=reachRoundFielded('2-1',1212);
 // Scripted draw (withB1Offers): this toContain is a fixture self-check; the subject is same-round combination credit.
 expect(open.pendingChoice!.offers).toContain('crafted-crafting');
 while(open.roundDefinitionId!=='3-2'){
  open=resolveM5Choices(open,['crafted-crafting']);
  if(open.phase==='preparation')open=resolveM5Choices(accepted(startMatchCombat(emptyBoard(open))));
  open=accepted(nextRound(open,open.round));
 }
 expect(open.augments.some(a=>a.definitionId==='crafted-crafting')).toBe(true);
 const actual=open.pendingChoice!;expect(actual.offers).toContain('starry-night-plus');
 let state=rich(accepted(selectChoice(open,actual.choiceId,actual.generation,'starry-night-plus')));
 // Keep the original opening's genuine component anvils; only the augment draws are scripted.
 const anvil=state.preparation.units.find(u=>u.definitionId==='TFT_ArmoryKeyComponent');expect(anvil).toBeDefined();
 state=accepted(openAnvil(state,anvil!.id));const component=state.pendingChoice!;
 state=accepted(selectChoice(state,component.choiceId,component.generation,component.offers[0]));
 while(freeRerollsAvailable(state)>0)state=accepted(rerollShop(state));
 const paid=state;state=accepted(rerollShop(state));expect(state.gold).toBe(paid.gold-2);
 validateShopHistory(state);
 const components=state.items.filter(i=>i.location.kind==='inventory'&&['sword','bow','rod','tear','vest','cloak','belt','gloves'].includes(i.definitionId));
 expect(components.length).toBeGreaterThanOrEqual(2);
 state=accepted(combineItems(state,components[0].id,components[1].id));
 expect(freeRerollsAvailable(state)).toBe(2);validateShopHistory(state);
 const combined=state;state=accepted(rerollShop(state));expect(state.gold).toBe(combined.gold);expect(freeRerollsAvailable(state)).toBe(1);
 for(const entry of entries)expect(restore(state,entry)).toEqual(state);
 // Removing the real combination cannot preserve the free draw or its claimed credit.
 const forged=structuredClone(state) as any;
 forged.resourceProvenance.entries=forged.resourceProvenance.entries.filter((e:any)=>e.kind!=='item-combined');
 for(const entry of entries)expect(()=>restore(forged,entry)).toThrow();
}));
