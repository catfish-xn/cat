import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createMatch, buyUnit, rerollShop } from '../src/simulation/match';
import { AUGMENT_SHOP } from '../src/simulation/content/augment-pool-shop';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { enterShopAugmentRound, validateShopAugments, SHOP_AUGMENT_KEY, SHOP_AUGMENT_SOURCE } from '../src/simulation/shop-augments';
import { freeRerollsAvailable, freeRerollsGranted } from '../src/simulation/free-rerolls';
import { validateBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { readSeatMechanic, writeSeatMechanic } from '../src/simulation/seat-mechanics/state';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { generateSharedShop, rerollSharedShop, buySharedUnit, buySharedXp, refreshSharedShops, nextSharedRound, runSharedMatchCommand,
  type MatchState, type SharedPoolState } from '../src/server-entry';
import { applySeatCommand } from '../src/server/room/room';
import { accept, batch, room, conserved, fight } from './tp-helpers';

const owning=(s:MatchState,definitionId:string,acquiredRound=s.round):MatchState=>({...s,augments:[...s.augments,{definitionId,choiceId:'test-'+definitionId,acquiredRound}]});
const record=(s:MatchState)=>readSeatMechanic(s,SHOP_AUGMENT_KEY) as unknown as {credits:number;rounds?:[number,number][];rolls?:number;rigAnchor?:number;reinforced?:number}|undefined;
const costOf=(s:MatchState)=>s.shop.slots.map(x=>x.status==='available'?UNIT_DEFINITIONS[x.definitionId].cost:0);

it('the nine shop-rule rows carry their 14.24 zh_cn name, tier, description and values and are registered in the offer pool', ()=>{
 const research=JSON.parse(readFileSync('/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json','utf8')) as {apiName:string;name_zh_cn:string;description_zh_cn:string;tier:number;effects:Record<string,number>}[];
 expect(Object.keys(AUGMENT_SHOP).sort()).toEqual(['dual-purpose','firesale','invested-plus','invested-plus-plus','patience-is-a-virtue','prismatic-ticket','reinfourcement','rigged-shop-plus','subscription-service']);
 for(const [id,row] of Object.entries(AUGMENT_SHOP)){
  const r=research.find(x=>x.apiName===row.apiName)!;
  expect([row.name,row.description,row.tier,row.source.values]).toEqual([r.name_zh_cn,r.description_zh_cn,['silver','gold','prismatic'][r.tier-1],r.effects]);
  expect(AUGMENT_DEFINITIONS[id].name).toBe(r.name_zh_cn);expect(AUGMENT_TIERS[id]).toBe(row.tier);expect(AUGMENT_POOL_API_NAMES[id]).toBe(row.apiName);
 }
 expect(AUGMENT_DEFINITIONS['invested-plus-plus'].effects).toContainEqual({kind:'mechanic',mechanic:'acquisitionGold',values:{amount:45}});
 expect(AUGMENT_DEFINITIONS['reinfourcement'].effects).toContainEqual({kind:'mechanic',mechanic:'acquisitionGold',values:{amount:12}});
 expect(AUGMENT_DEFINITIONS['subscription-service'].effects).toContainEqual({kind:'mechanic',mechanic:'acquisitionGold',values:{amount:6}});
 const own=(id:string)=>[{definitionId:id,choiceId:'old',acquiredRound:1}],ctx={node:'3-2',fieldedTraits:[],blocked:[]};
 expect(augmentOfferAllowed('firesale',own('patience-is-a-virtue'),ctx)).toBe(false);
 expect(augmentOfferAllowed('subscription-service',own('rigged-shop-plus'),ctx)).toBe(false);
 expect(augmentOfferAllowed('invested-plus',own('invested-plus-plus'),ctx)).toBe(false);
});

it('Patience is a Virtue: 2 free rerolls at each round entry whose previous round had no shop purchase', ()=>{
 let s:MatchState={...owning(createMatch(42),'patience-is-a-virtue',1),gold:50};
 const slot=s.shop.slots.findIndex(x=>x.status==='available');
 s=accept(buyUnit(s,slot,s.shop.generation) as any).state as MatchState; // round 1 purchase
 s=enterShopAugmentRound({...s,round:2});expect(record(s)?.credits??0).toBe(0);
 s=enterShopAugmentRound({...s,round:3});expect(record(s)!.credits).toBe(2);expect(freeRerollsAvailable(s)).toBe(2);
 validateShopAugments(s);validateBatch1Gifts(s);
 expect(()=>validateShopAugments(writeSeatMechanic(s,SHOP_AUGMENT_KEY,{credits:4}))).toThrow();
 // A free reroll spends the credit before gold.
 const rolled=accept(rerollShop(s) as any).state as MatchState;expect(rolled.gold).toBe(s.gold);expect(freeRerollsAvailable(rolled)).toBe(1);
});

it('Invested+: round-entry gold above 50 gives one reroll per 10, counting at most 80; restore re-derives the credits', ()=>{
 let s=owning(createMatch(42),'invested-plus',1);
 for(const [round,gold] of [[2,55],[3,60],[4,79],[5,140]])s=enterShopAugmentRound({...s,round,gold});
 expect(record(s)).toEqual({credits:0+1+2+3,rounds:[[2,55],[3,60],[4,79],[5,140]]});
 expect(freeRerollsGranted(s)).toBe(6);validateShopAugments(s);
 for(const rounds of [[[2,55],[3,60],[4,79]],[[2,55],[3,60],[4,79],[6,140]],[[2,55],[3,60],[4,79],[5,-1]]])
  expect(()=>validateShopAugments(writeSeatMechanic(s,SHOP_AUGMENT_KEY,{credits:6,rounds}))).toThrow();
 expect(()=>validateShopAugments(writeSeatMechanic(s,SHOP_AUGMENT_KEY,{credits:6,rounds:[[2,55],[3,60],[4,79],[5,90]]}))).not.toThrow();
 expect(()=>validateShopAugments(writeSeatMechanic(createMatch(42),SHOP_AUGMENT_KEY,{credits:0,rounds:[[2,55]]}))).toThrow();
});

it('Rigged Shop+: the first shop after acquisition and every 4th one are all 3-cost; its 5 rerolls are free', ()=>{
 const {pool,states}=room(undefined,1);
 let r=accept(generateSharedShop(pool,{...owning(states[0],'rigged-shop-plus'),gold:20},0));
 expect(costOf(r.state)).toEqual([3,3,3,3,3]);expect(record(r.state)!.rigAnchor).toBe(1);
 const gold=r.state.gold,shops:number[][]=[costOf(r.state)];
 for(let i=0;i<8;i++){r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));shops.push(costOf(r.state));}
 expect(shops[4]).toEqual([3,3,3,3,3]);expect(shops[8]).toEqual([3,3,3,3,3]);
 expect(shops[1].some(c=>c!==3)).toBe(true);
 expect(r.state.gold).toBe(gold-3*2);conserved(r.pool,[r.state]);validateShopAugments(r.state);
 expect(()=>validateShopAugments(writeSeatMechanic(r.state,SHOP_AUGMENT_KEY,{credits:0,rigAnchor:99}))).toThrow();
});

it('Prismatic Ticket: every reroll rolls 45% for a free reroll from a seed-bound stream; restore recomputes it', ()=>{
 const {pool,states}=room(undefined,1);
 let r=accept(generateSharedShop(pool,{...owning(states[0],'prismatic-ticket'),gold:200},0)),paid=0;
 for(let i=0;i<40;i++){const before=r.state.gold;r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));paid+=(before-r.state.gold)/2;}
 const rec=record(r.state)!;expect(rec.rolls).toBe(40);expect(rec.credits).toBeGreaterThan(8);expect(rec.credits).toBeLessThan(30);
 expect(paid).toBe(40-(rec.credits-freeRerollsAvailable(r.state)));
 validateShopAugments(r.state);conserved(r.pool,[r.state]);
 expect(()=>validateShopAugments(writeSeatMechanic(r.state,SHOP_AUGMENT_KEY,{...rec,credits:rec.credits+1}))).toThrow();
 expect(()=>validateShopAugments(writeSeatMechanic(r.state,SHOP_AUGMENT_KEY,{...rec,rolls:9999}))).toThrow();
});

/** Rerolls a rich level-9 seat until the shop offers a 4-cost. */
function withFourCost(augment:string){
 const {pool,states}=room(undefined,1);
 let r=accept(generateSharedShop(pool,{...owning(states[0],augment),gold:1000,level:9,xp:0},0));
 for(let i=0;i<60&&!costOf(r.state).includes(4);i++)r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));
 return r;
}
it('ReinFOURcement: the first 4-cost bought arrives at 2 stars as two more pool copies; later 4-costs are normal', ()=>{
 let r=withFourCost('reinfourcement');const slot=costOf(r.state).indexOf(4),id=(r.state.shop.slots[slot] as {definitionId:string}).definitionId;
 const available=r.pool.available[id];
 r=accept(buySharedUnit(r.pool,r.state,slot,r.state.shop.generation));
 expect(r.state.preparation.units.filter(u=>u.team==='player'&&u.definitionId===id).map(u=>u.starLevel)).toEqual([2]);
 expect(r.pool.available[id]).toBe(available-2);expect(record(r.state)!.reinforced).toBeGreaterThan(0);
 expect(r.state.seatMechanics!.receipts.filter(x=>x.source===SHOP_AUGMENT_SOURCE).map(x=>x.kind==='unit'&&[x.definitionId,x.resolution])).toEqual([[id,'held'],[id,'held']]);
 conserved(r.pool,[r.state]);validateShopAugments(r.state);validateBatch1Gifts(r.state);
 for(let i=0;i<60&&!costOf(r.state).includes(4);i++)r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));
 const second=costOf(r.state).indexOf(4),count=r.state.preparation.units.filter(u=>u.team==='player').length;
 r=accept(buySharedUnit(r.pool,r.state,second,r.state.shop.generation));
 expect(r.state.seatMechanics!.receipts.filter(x=>x.source===SHOP_AUGMENT_SOURCE)).toHaveLength(2);
 expect(r.state.preparation.units.filter(u=>u.team==='player').length).toBeLessThanOrEqual(count+1);
 const forged={...r.state,seatMechanics:{...r.state.seatMechanics!,receipts:r.state.seatMechanics!.receipts.filter(x=>!x.receiptId.endsWith(',1]')||x.source!==SHOP_AUGMENT_SOURCE)}};
 expect(()=>validateShopAugments(forged)).toThrow();
 expect(()=>validateShopAugments(writeSeatMechanic(r.state,SHOP_AUGMENT_KEY,{credits:0}))).toThrow();
});

it('Dual Purpose: an XP purchase rerolls the unlocked shop for free and the first one each round pays 2 gold', ()=>{
 const {pool,states}=room(undefined,1);
 let r=accept(generateSharedShop(pool,{...owning(states[0],'dual-purpose'),gold:30},0));
 const gen=r.state.shop.generation,gold=r.state.gold;
 const first=applySeatCommand(r.pool,r.state,{type:'buyXp'});if(!first.ok)throw Error(first.reason);
 expect([first.state.gold,first.state.shop.generation]).toEqual([gold-4+2,gen+1]);
 const second=applySeatCommand(first.pool,first.state,{type:'buyXp'});if(!second.ok)throw Error(second.reason);
 expect([second.state.gold,second.state.shop.generation]).toEqual([gold-8+2,gen+2]);
 conserved(second.pool,[second.state]);validateShopAugments(second.state);
 const locked={...second.state,shop:{...second.state.shop,locked:true}},pool2:SharedPoolState={...second.pool,seats:second.pool.seats.map(s=>({...s,shop:locked.shop}))};
 const third=accept(buySharedXp(pool2,locked));expect(third.state.shop.generation).toBe(gen+2);
 // Without the augment the XP purchase never touches the pool.
 const plain=applySeatCommand(r.pool,states[0],{type:'buyXp'});expect(plain.pool).toBe(r.pool);
});

/** One seat through the real PvE rounds 1-3 to the 2-1 entry (a stage start with an augment choice). */
function toStageTwo(augments:readonly string[]){
 const initial=room(undefined,1),first=batch(refreshSharedShops(initial.pool,initial.states,1));
 let pool=first.pool,state=augments.reduce((s,id)=>owning(s,id,1),first.states[0]);
 const pre=JSON.parse(JSON.stringify(pool.seats));void pre;
 for(let round=1;round<=3;round++){
  let r=fight(pool,state);pool=r.pool;state=r.state;
  while(state.phase==='choice'){const p=state.pendingChoice!;r=accept(runSharedMatchCommand(pool,state,{type:'timeoutChoice',round,choiceId:p.choiceId,generation:p.generation}));pool=r.pool;state=r.state;}
  r=accept(runSharedMatchCommand(pool,state,{type:'claimLoot',round}));pool=r.pool;state=r.state;
  const next=batch(nextSharedRound(pool,[state],round));pool=next.pool;state=next.states[0];conserved(pool,[state]);
 }
 expect(state.roundDefinitionId).toBe('2-1');
 return {pool,state};
}
it('online round entry: Firesale steals one shop champion each round, Patience and Invested credit, all restore-valid', ()=>{
 const {pool,state}=toStageTwo(['firesale','patience-is-a-virtue','invested-plus']);
 const stolen=state.seatMechanics!.receipts.filter(r=>r.source===SHOP_AUGMENT_SOURCE);
 expect(stolen.map(r=>r.round)).toEqual([2,3,4]);
 expect(stolen.every(r=>r.kind==='unit'&&r.resolution==='held')).toBe(true);
 expect(state.shop.slots.filter(s=>s.status==='purchased')).toHaveLength(1);
 expect(record(state)!.rounds!.map(([round])=>round)).toEqual([2,3,4]);
 expect(record(state)!.credits).toBe(3*2+record(state)!.rounds!.reduce((n,[,g])=>n+Math.max(0,Math.floor((Math.min(g,80)-50)/10)),0));
 conserved(pool,[state]);validateShopAugments(state);validateBatch1Gifts(state);
 expect(()=>validateShopAugments({...state,seatMechanics:{...state.seatMechanics!,receipts:state.seatMechanics!.receipts.map(r=>r.source===SHOP_AUGMENT_SOURCE&&r.round===3?{...r,round:1}:r)}})).toThrow();
});
it('Subscription Service: a stage start replaces the shop with 4 unique 4-costs and pays 6; acquiring it opens one at once', ()=>{
 const staged=toStageTwo(['subscription-service']);
 const fours=staged.state.shop.slots.flatMap(s=>s.status==='available'?[s.definitionId]:[]);
 expect(fours).toHaveLength(4);expect(new Set(fours).size).toBe(4);expect(fours.every(id=>SHOP_CATALOG_BY_COST[4].includes(id))).toBe(true);
 expect(staged.state.shop.slots[4]).toEqual({status:'purchased',empty:true});
 expect(staged.state.seatMechanics!.receipts.filter(r=>r.source===SHOP_AUGMENT_SOURCE).map(r=>r.kind==='gold'&&[r.round,r.amount])).toEqual([[4,6]]);
 conserved(staged.pool,[staged.state]);validateShopAugments(staged.state);
 expect(()=>validateShopAugments({...staged.state,seatMechanics:{...staged.state.seatMechanics!,receipts:staged.state.seatMechanics!.receipts.filter(r=>r.source!==SHOP_AUGMENT_SOURCE)}})).toThrow();
 // Now: the 2-1 augment pick itself (offers widened for the test) opens the 4-cost shop and pays the acquisition gold.
 const {pool,state}=toStageTwo([]),c=state.pendingChoice!;expect(c.kind).toBe('augment');
 const offered={...state,pendingChoice:{...c,offers:['subscription-service',...c.offers.slice(1)]}};
 const picked=accept(runSharedMatchCommand(pool,offered,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'subscription-service'}));
 expect(costOf(picked.state)).toEqual([4,4,4,4,0]);expect(picked.state.gold).toBe(state.gold+6);
 expect(picked.state.shop.generation).toBe(state.shop.generation+1);conserved(picked.pool,[picked.state]);
});
