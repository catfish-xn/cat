import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { augmentCandidates } from '../../src/simulation/augment-offers';
import { AUGMENT_DEFINITIONS } from '../../src/simulation/content/augments';
import { AUGMENT_BATCH5_R5 } from '../../src/simulation/content/augment-pool-batch5-r5';
import { starryChanceBps, starryUpgrade } from '../../src/simulation/augment-pool-batch5-r5';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';
import { generateSharedShop, rerollSharedShop, buySharedUnit, sellSharedUnit, setSharedShopLock, restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import type { MatchState, ShopSlot } from '../../src/simulation/match-types';
import { makeRoom, runUntilClaiming } from '../server/helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { accept, conserved, fullBench, room as poolFixture } from '../tp-helpers';
import * as oracle from './m5/oracle.g2.cjs';
import { validateRewards } from './m5/augment-rewards-oracle.cjs';

const chances = [0,0,1800,2000,2200,2500,3000,5000,8000,10000];
const withOwner = (s: MatchState, id: string, level: number): MatchState => ({...s, level, xp:0, gold:100,
  augments:[{definitionId:id,choiceId:'test-starry',acquiredRound:1}]});
const returnedStock = (s: MatchState, stock: Readonly<Record<string,number>>) => {
  const result={...stock};
  for(const o of s.shop.slots)if(o.status==='available')result[o.definitionId]+=o.starLevel===2?3:1;
  return result;
};

export function checkStarryRules(id: 'starry-night' | 'starry-night-plus') {
 describe(id+' rules',()=>{
  it('matches the archived row and offers only at the approved node, with mutual exclusion',()=>{
   const source=JSON.parse(readFileSync(new URL('./m5/augment-shop-source-14.24.json',import.meta.url),'utf8'));
   const row=(AUGMENT_BATCH5_R5 as Record<string,{apiName:string;source:{values:unknown}}>)[id];
   expect(row).toBeDefined();expect(row.source.values).toEqual(source.find((x:any)=>x.apiName===row.apiName).effects);
   expect(AUGMENT_DEFINITIONS[id].effects).toContainEqual({kind:'mechanic',mechanic:'acquisitionGold',values:{amount:id==='starry-night'?6:8}});
   const other=id==='starry-night'?'starry-night-plus':'starry-night';
   for(const node of ['2-1','3-2','4-2']){
    const filter={node,fieldedTraits:[],blocked:[]};
    const allowed=node===(id==='starry-night'?'2-1':'3-2');
    expect(augmentCandidates('gold',[],[],undefined,filter).includes(id)).toBe(allowed);
    expect(oracle.augmentPool('gold',[],[],`round:${node}:augment`).includes(id)).toBe(allowed);
    expect(augmentCandidates('gold',[{definitionId:other,choiceId:'other',acquiredRound:1}],[],undefined,filter)).not.toContain(id);
   }
  });
  it.each(chances.map((chance,i)=>[i+1,chance]))('level %i has %i Bps for both costs and no upgrade for higher costs',(level,chance)=>{
   const f=poolFixture(undefined,1),s=withOwner(f.states[0],id,level);
   expect(starryChanceBps(s)).toBe(chance);expect(oracle.starryChanceBps(level)).toBe(chance);
   for(let generation=1;generation<=8;generation++)for(let slot=0;slot<5;slot++){
    const hit=oracle.shopWord(s,['starry','test-starry',generation,slot])*10000n/4294967296n<BigInt(chance);
    for(const hero of ['irelia','rell'])expect(starryUpgrade(s,generation,slot,hero)).toBe(hit);
    for(const hero of ['nami','garen','caitlyn','mel'])expect(starryUpgrade(s,generation,slot,hero)).toBe(false);
   }
   const expected=oracle.starrySharedShop(s,f.pool.available),actual=accept(generateSharedShop(f.pool,s,0));
   expect(actual.state.shop).toEqual(expected.shop);expect(actual.state.rngState).toBe(expected.rngState);
   expect(actual.pool.available).toEqual(expected.available);conserved(actual.pool,[actual.state]);
  });
  it.each([1,2,3])('stock of %i copies keeps one star unless all three can be reserved',stock=>{
   const f=poolFixture({irelia:stock+1},1),s=withOwner(f.states[0],id,10);
   expect(f.pool.available.irelia).toBe(stock);
   const expected=oracle.starrySharedShop(s,f.pool.available),r=accept(generateSharedShop(f.pool,s,0));
   expect(r.state.shop).toEqual(expected.shop);expect(r.pool.available).toEqual(expected.available);
   const offers=r.state.shop.slots.filter(x=>x.status==='available');
   expect(offers).toHaveLength(stock===3?1:stock);
   expect(offers.every(x=>x.starLevel===2)).toBe(stock===3);conserved(r.pool,[r.state]);
  });
  it('returns three unbought copies before a locked manual reroll; purchases cost three copies and combine nine into three stars',()=>{
   const f=poolFixture({irelia:30},1);let r=accept(generateSharedShop(f.pool,withOwner(f.states[0],id,10),0));
   expect(r.pool.shops.every(s=>s.starLevel===2)).toBe(true);
   r=accept(setSharedShopLock(r.pool,r.state,true,r.state.shop.generation));
   const stock=returnedStock(r.state,r.pool.available),expected=oracle.starrySharedShop(r.state,stock),gold=r.state.gold;
   r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));
   expect(r.state.shop).toEqual(expected.shop);expect(r.pool.available).toEqual(expected.available);expect(r.state.gold).toBe(gold-2);
   for(let i=0;i<3;i++){
    const slot=r.state.shop.slots.findIndex(o=>o.status==='available'),before=r,bank=r.state.gold;
    r=accept(buySharedUnit(r.pool,r.state,slot,r.state.shop.generation));
    expect(r.state.gold).toBe(bank-3);expect(r.pool.available).toEqual(before.pool.available);
    expect(r.state.rngState).toBe(before.state.rngState);
    expect(r.pool.holdings.reduce((n,h)=>n+h.sources.length,0)).toBe(1+(i+1)*3);conserved(r.pool,[r.state]);
   }
   expect(r.state.preparation.units.filter(u=>u.team==='player').map(u=>u.starLevel).sort()).toEqual([1,3]);
   const three=r.state.preparation.units.find(u=>u.starLevel===3)!;
   expect(r.pool.holdings.find(h=>h.unitId===three.id)!.sources).toHaveLength(9);
   const count=r.pool.available.irelia;r=accept(sellSharedUnit(r.pool,r.state,three.id));
   expect(r.pool.available.irelia).toBe(count+9);conserved(r.pool,[r.state]);
  });
  it('charges six gold for a two-cost two-star offer and returns all three copies on sale',()=>{
   const f=poolFixture({irelia:1,rell:9},1),drawn=accept(generateSharedShop(f.pool,withOwner(f.states[0],id,10),0));
   const slot=drawn.state.shop.slots.findIndex(o=>o.status==='available'&&o.definitionId==='rell'&&o.starLevel===2);
   expect(slot).toBeGreaterThanOrEqual(0);
   const bought=accept(buySharedUnit(drawn.pool,drawn.state,slot,drawn.state.shop.generation));
   expect(bought.state.gold).toBe(drawn.state.gold-6);expect(bought.pool.available).toEqual(drawn.pool.available);
   const unit=bought.state.preparation.units.find(u=>u.team==='player'&&u.definitionId==='rell')!;
   expect(unit.starLevel).toBe(2);expect(bought.pool.holdings.find(h=>h.unitId===unit.id)!.sources).toHaveLength(3);
   const sold=accept(sellSharedUnit(bought.pool,bought.state,unit.id));
   expect(sold.pool.available.rell).toBe(bought.pool.available.rell+3);conserved(sold.pool,[sold.state]);
  });
  it('rejects a two-star purchase on a full bench without losing its reservation or gold',()=>{
   const f=fullBench();let r=accept(rerollSharedShop(f.pool,withOwner(f.state,id,10),f.state.shop.generation));
   for(let n=0;n<12&&!r.state.shop.slots.some(o=>o.status==='available'&&o.starLevel===2);n++)
    r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));
   const slot=r.state.shop.slots.findIndex(o=>o.status==='available'&&o.starLevel===2);expect(slot).toBeGreaterThanOrEqual(0);
   const result=buySharedUnit(r.pool,r.state,slot,r.state.shop.generation);
   expect(result).toEqual({ok:false,reason:'bench-full',pool:r.pool,state:r.state});
   expect(result.pool).toBe(r.pool);expect(result.state).toBe(r.state);conserved(r.pool,[r.state]);
  });
  it('rejects stale and unaffordable purchases atomically without pool or RNG changes',()=>{
   const f=poolFixture({irelia:30},1),r=accept(generateSharedShop(f.pool,withOwner(f.states[0],id,10),0));
   for(const [s,g,reason] of [[r.state,0,'stale-shop'],[{...r.state,gold:2},r.state.shop.generation,'insufficient-gold']] as const){
    const result=buySharedUnit(r.pool,s,0,g);expect(result.ok).toBe(false);
    if(result.ok)throw Error('accepted invalid purchase');
    expect(result.reason).toBe(reason);expect(result.state).toBe(s);expect(result.pool).toBe(r.pool);expect('events' in result).toBe(false);
   }
  });
 });
}

export function checkStarryRoom(id:'starry-night'|'starry-night-plus',seed:number,seatId:string){
 describe(id+' actual online room',()=>{
  const {room,clock}=makeRoom(new TwoSidedBattleResolver(),{seed});
  afterAll(()=>room.dispose());
  const current=()=>room.state.seats.find(s=>s.seatId===seatId)!.match;
  const target=id==='starry-night'?'2-1':'3-2';
  const rounds=target==='2-1'?['1-2','1-3','1-4','2-1']:['1-2','1-3','1-4','2-1','2-2','2-3','2-4','2-5','2-6','2-7','3-1','3-2'];
  for(const round of rounds)it('reaches '+round,()=>{
   if(round==='1-2')room.start();
   runUntilClaiming(room,clock,s=>s.roundId===round&&(round==='2-4'||s.phase==='preparation'));
  });
  it('selects the offered card, pays exactly once and passes the independent reward oracle',()=>{
   const before=current(),c=before.pendingChoice!;expect(c.offers).toContain(id);
   const command={type:'choose' as const,choiceId:c.choiceId,generation:c.generation,definitionId:id};
   const result=room.handle(seatId,command);expect(result.ok).toBe(true);if(!result.ok)throw Error('choose failed');
   const after=current();expect(after.gold).toBe(before.gold+(id==='starry-night'?6:8));
   const oracleCommand={...command,type:'select'};
   validateRewards(before,after,oracleCommand,result.events,{...oracle,lootReceipts:[]});
   const bad=structuredClone(after) as any;bad.gold++;bad.scheduleReceipts.find((x:any)=>x.eventId===c.choiceId).gold++;
   expect(()=>validateRewards(before,bad,oracleCommand,result.events,{...oracle,lootReceipts:[]})).toThrow('independent Starry');
   const prior=current();expect(room.handle(seatId,command).ok).toBe(false);expect(current()).toBe(prior);
   expect(after.shopHistory?.version).toBe('shop-history-v1');
  });
  it('refreshes and buys a two-star offer via Room.handle with the finite pool',()=>{
   for(let roll=0;roll<12&&!current().shop.slots.some(s=>s.status==='available'&&s.starLevel===2);roll++){
    const before=current(),stock=returnedStock(before,room.state.pool.available),expected=oracle.starrySharedShop(before,stock);
    expect(room.handle(seatId,{type:'reroll'})).toMatchObject({ok:true});
    expect(current().shop).toEqual(expected.shop);expect(room.state.pool.available).toEqual(expected.available);
   }
   const before=current(),slot=before.shop.slots.findIndex(s=>s.status==='available'&&s.starLevel===2);
   expect(slot).toBeGreaterThanOrEqual(0);const offer=before.shop.slots[slot] as Extract<ShopSlot,{status:'available'}>;
   const stock={...room.state.pool.available},held=room.state.pool.holdings.filter(h=>h.seatId===seatId).reduce((n,h)=>n+h.sources.length,0);
   const bought=room.handle(seatId,{type:'buy',slot,generation:before.shop.generation});expect(bought).toMatchObject({ok:true});
   expect(current().gold).toBe(before.gold-UNIT_DEFINITIONS[offer.definitionId].cost*3);
   expect(room.state.pool.available).toEqual(stock);
   expect(room.state.pool.holdings.filter(h=>h.seatId===seatId).reduce((n,h)=>n+h.sources.length,0)).toBe(held+3);
   conserved(room.state.pool,room.state.seats.map(s=>s.match));
  });
  it('round-trips objects and JSON; rejects star, chance, stock, missing history and coordinated gold forgeries',()=>{
   const s=current(),authority=room.augmentHistoryAuthority(seatId),pool=room.state.pool;
   for(const encode of [(v:MatchState)=>v,(v:MatchState)=>JSON.stringify(v)]){
    expect(restoreSharedOrbSnapshot(pool,encode(s),authority)).toEqual(s);
    for(const edit of [
     (v:any)=>{delete v.shopHistory;},
     (v:any)=>{v.shopHistory.version='forged';},
     (v:any)=>{v.shopHistory.entries.find((e:any)=>e.kind==='draw').starry[0]=!v.shopHistory.entries.find((e:any)=>e.kind==='draw').starry[0];},
     (v:any)=>{v.shopHistory.entries.find((e:any)=>e.kind==='draw').stock.irelia=-1;},
     (v:any)=>{v.shopHistory.entries.find((e:any)=>e.kind==='buy').starLevel=1;},
     (v:any)=>{v.scheduleReceipts.find((e:any)=>e.definitionId===id).gold++;v.gold++;},
     (v:any)=>{v.level++;},
    ]){const bad=structuredClone(s);edit(bad);expect(()=>restoreSharedOrbSnapshot(pool,encode(bad),authority)).toThrow();}
   }
  });
  it('uses the next natural shop once and resumes deterministically after restore',()=>{
   const next=target==='2-1'?'2-2':'3-3';runUntilClaiming(room,clock,s=>s.roundId===next&&s.phase==='preparation');
   const s=current();expect(s.shopHistory!.entries.some(e=>e.kind==='draw'&&e.cause==='natural'&&e.point.round===s.round)).toBe(true);
   const restored=restoreSharedOrbSnapshot(room.state.pool,JSON.stringify(s),room.augmentHistoryAuthority(seatId));
   const direct=rerollSharedShop(room.state.pool,s,s.shop.generation),resumed=rerollSharedShop(room.state.pool,restored,restored.shop.generation);
   expect(direct.ok).toBe(true);expect(resumed).toEqual(direct);
  });
 });
}
