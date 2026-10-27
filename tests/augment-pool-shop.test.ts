import { recordAugmentAcquisition } from '../src/simulation/augment-history';
import { AUGMENT_BATCH5 } from '../src/simulation/content/augment-pool-batch5';
import { BATCH5_SOURCE } from '../src/simulation/augment-pool-batch5-progress';
import { shopOwner } from './fixtures/shop-history-match';
import { accepted } from './match-helpers';
import { grantMechanicGold } from '../src/simulation/seat-mechanics/grants';
import { validateB8Loot, validateB8Resources } from '../src/simulation/b8-restore';
import { soloPveLoot } from '../src/simulation/shop-orbs';
import * as oracle from './fixtures/m5/oracle.g2.cjs';
import { validateRewards } from './fixtures/m5/augment-rewards-oracle.cjs';
import { shopForState, shopWord, freeRerollCredits } from './fixtures/m5/oracle.g2.cjs';
import { existsSync, readFileSync } from 'node:fs';
import { AUGMENT_STAGE_BANS } from '../src/simulation/content/augment-stage-bans';
import { expect, it } from 'vitest';
import { createMatch, buyUnit, buyXp, rerollShop, sellUnit, claimOrb, startMatchCombat } from '../src/simulation/match';
import { AUGMENT_SHOP } from '../src/simulation/content/augment-pool-shop';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { drawSoloAugmentShop, planFiresale, stealFiresaleUnit, validateShopAugments, starryChanceBps, SHOP_AUGMENT_KEY, SHOP_AUGMENT_SOURCE } from '../src/simulation/shop-augments';
import { freeRerollsAvailable, freeRerollsGranted } from '../src/simulation/free-rerolls';
import { validateBatch1Gifts } from '../src/simulation/augment-pool-grants';
import { readSeatMechanic, writeSeatMechanic } from '../src/simulation/seat-mechanics/state';
import { sixCostShopContext } from '../src/simulation/six-cost-shop';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { generateSharedShop, rerollSharedShop, buySharedUnit, buySharedXp, setSharedShopLock, refreshSharedShops, nextSharedRound, runSharedMatchCommand, restoreSharedOrbSnapshot,
  type MatchState, type SharedPoolState } from '../src/server-entry';
import { applySeatCommand } from '../src/server/room/room';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accept, batch, room, conserved, fight } from './tp-helpers';

const owning=(s:MatchState,definitionId:string,acquiredRound=s.round):MatchState=>recordAugmentAcquisition(s,{...s,augments:[...s.augments,{definitionId,choiceId:'test-'+definitionId,acquiredRound}]});
const record=(s:MatchState)=>readSeatMechanic(s,SHOP_AUGMENT_KEY) as unknown as {credits:number;rolls?:number;rigAnchor?:number;reinforced?:number}|undefined;
const costOf=(s:MatchState)=>s.shop.slots.map(x=>x.status==='available'?UNIT_DEFINITIONS[x.definitionId].cost:0);

it('the shared snapshot boundary rejects invented shop credits and counters without an owner',()=>{
 const initial=room(undefined,1),drawn=accept(generateSharedShop(initial.pool,initial.states[0],0));
 expect(restoreSharedOrbSnapshot(drawn.pool,JSON.stringify(drawn.state))).toEqual(drawn.state);
 const forgeries:Record<string,number>[]=[{credits:1},{credits:0,rolls:1},{credits:0,rigAnchor:1},{credits:0,reinforced:0}];
 for(const forged of forgeries){
  const state=writeSeatMechanic(drawn.state,SHOP_AUGMENT_KEY,forged);
  expect(()=>restoreSharedOrbSnapshot(drawn.pool,JSON.stringify(state))).toThrow('Invalid shop augment authority');
 }
});

it('the eight additional shop-rule rows carry their 14.24 zh_cn name, tier, description and values and are registered in the offer pool', ()=>{
 const research=JSON.parse(readFileSync(new URL('./fixtures/m5/augment-shop-source-14.24.json',import.meta.url),'utf8')) as {apiName:string;name_zh_cn:string;description_zh_cn:string;description_en_us:string;tier:number;effects:Record<string,number>;item_tags_raw:string[]}[];
 const archive='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
 const external=existsSync(archive)?JSON.parse(readFileSync(archive,'utf8')):null;
 const rows={...AUGMENT_SHOP,'dual-purpose':AUGMENT_BATCH5['dual-purpose']};
 const tags:Readonly<Record<string,string>>={'{d02ae323}':'2-1','{d12ae4b6}':'3-2','{d22ae649}':'4-2'};
 expect(Object.keys(rows).sort()).toEqual(['dual-purpose','firesale','prismatic-ticket','reinfourcement','rigged-shop-plus','starry-night','starry-night-plus','subscription-service']);
 for(const [id,row] of Object.entries(rows)){
  const r=research.find(x=>x.apiName===row.apiName)!;
  if(external){const original=external.find((x:any)=>x.apiName===row.apiName);expect(Object.fromEntries(Object.keys(r).map(k=>[k,original[k]]))).toEqual(r);}
  expect(row.source.description_en_us).toBe(r.description_en_us);
  const bans=r.item_tags_raw.filter(t=>tags[t]).map(t=>tags[t]);expect([...(AUGMENT_STAGE_BANS[row.apiName]??[])].sort()).toEqual([...bans].sort());
  for(const node of ['2-1','3-2','4-2'])expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(!bans.includes(node));
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

it('Dual Purpose: an XP purchase rerolls the shop (including locked shops) for free and the first one each round pays 2 gold', ()=>{
 const {pool,states}=room(undefined,1);
 let r=accept(generateSharedShop(pool,{...owning(states[0],'dual-purpose'),gold:30},0));
 const gen=r.state.shop.generation,gold=r.state.gold;
 const first=applySeatCommand(r.pool,r.state,{type:'buyXp'});if(!first.ok)throw Error(first.reason);
 expect([first.state.gold,first.state.shop.generation]).toEqual([gold-4+2,gen+1]);
 const second=applySeatCommand(first.pool,first.state,{type:'buyXp'});if(!second.ok)throw Error(second.reason);
 expect([second.state.gold,second.state.shop.generation]).toEqual([gold-8+2,gen+2]);
 conserved(second.pool,[second.state]);validateShopAugments(second.state);
 const locked={...second.state,shop:{...second.state.shop,locked:true}},pool2:SharedPoolState={...second.pool,seats:second.pool.seats.map(s=>({...s,shop:locked.shop}))};
 const third=accept(buySharedXp(pool2,locked));expect(third.state.shop.generation).toBe(gen+3);expect(third.state.shop.locked).toBe(true);
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
  const beforeSeq=state.nextMatchEventSeq,next=batch(nextSharedRound(pool,[state],round));
  const events=next.events.flatMap(row=>row.events),domain=events.filter(e=>e.domain==='match');
  expect(domain.map(e=>e.eventSeq)).toEqual(domain.map((_,i)=>beforeSeq+i));
  expect(next.states[0].nextMatchEventSeq).toBe(beforeSeq+domain.length);
  expect(events.filter(e=>e.type==='mechanicGranted'&&e.receipt.source===SHOP_AUGMENT_SOURCE).every(e=>e.domain==='match')).toBe(true);
  pool=next.pool;state=next.states[0];conserved(pool,[state]);
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
 expect(freeRerollsGranted(state)).toBe(freeRerollCredits(state));
 expect(freeRerollsGranted(state)).toBeGreaterThanOrEqual(6);
 expect(record(state)).toBeUndefined();
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

it('Starry Night: 1- and 2-cost offers become 2-star at the level chance, reserve three copies and cost three times the base price', ()=>{
 expect(starryChanceBps({augments:[{definitionId:'starry-night',choiceId:'x',acquiredRound:1}],level:9})).toBe(8000);
 expect([1,2,3,4,5,6,7,8,10].map(level=>starryChanceBps({augments:[{definitionId:'starry-night-plus',choiceId:'x',acquiredRound:1}],level}))).toEqual([1800,1800,1800,2000,2200,2500,3000,5000,10000]);
 const {pool,states}=room(undefined,1);
 let r=accept(generateSharedShop(pool,{...owning(states[0],'starry-night'),gold:300,level:10,xp:0},0));
 for(let i=0;i<30&&!r.state.shop.slots.some(s=>s.status==='available'&&s.starLevel===2);i++)r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));
 // Level 10 is 100%: every 1- or 2-cost offer with three copies in stock is 2-star; 3+ costs never are.
 for(const s of r.state.shop.slots)if(s.status==='available')expect(s.starLevel===2).toBe(UNIT_DEFINITIONS[s.definitionId].cost<=2);
 conserved(r.pool,[r.state]);
 const slot=r.state.shop.slots.findIndex(s=>s.status==='available'&&s.starLevel===2),offer=r.state.shop.slots[slot] as {definitionId:string;starLevel:2};
 const gold=r.state.gold,shopHeld=r.pool.shops.filter(x=>x.definitionId===offer.definitionId).length;void shopHeld;
 r=accept(buySharedUnit(r.pool,r.state,slot,r.state.shop.generation));
 expect(r.state.gold).toBe(gold-3*UNIT_DEFINITIONS[offer.definitionId].cost);
 expect(r.state.preparation.units.find(u=>u.id===`unit-${r.state.nextUnitSerial-1}`)).toMatchObject({definitionId:offer.definitionId,starLevel:2});
 expect(r.pool.holdings.find(h=>h.unitId===`unit-${r.state.nextUnitSerial-1}`)!.sources).toHaveLength(3);
 conserved(r.pool,[r.state]);
 // Reroll returns all three copies of an unbought 2-star offer.
 const rerolled=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));conserved(rerolled.pool,[rerolled.state]);
 // Without the augment no offer is 2-star.
 const plain=accept(generateSharedShop(room(undefined,1).pool,{...room(undefined,1).states[0],level:10},0));
 expect(plain.state.shop.slots.some(s=>s.status==='available'&&s.starLevel===2)).toBe(false);
});
it('a 2-star shop purchase folds to a 2-star unit on restore; a forged star on a 3-cost is rejected', ()=>{
 const three=SHOP_CATALOG_BY_COST[3][0];
 let s=accepted(grantMechanicGold(shopOwner(95,'starry-night'),{receiptId:'starry-test',source:'test',amount:100}));
 const eligible=()=>s.shop.slots.findIndex(x=>x.status==='available'&&x.starLevel===2&&UNIT_DEFINITIONS[x.definitionId].cost===1);
 for(let i=0;i<40&&eligible()<0;i++)s=accepted(rerollShop(s));
 const slot=eligible();expect(slot).toBeGreaterThanOrEqual(0);
 const gold=s.gold;
 const bought=accepted(buyUnit(s,slot,s.shop.generation));
 expect(bought.gold).toBe(gold-3);expect(bought.preparation.units.find(u=>u.id===`unit-${bought.nextUnitSerial-1}`)!.starLevel).toBe(2);
 expect(restoreMatch(serializeMatch(bought))).toEqual(bought);
 const forged={...bought,shop:{...bought.shop,slots:[{status:'available' as const,definitionId:three,starLevel:2 as const},...bought.shop.slots.slice(1)]}};
 expect(()=>restoreMatch(serializeMatch(forged))).toThrow();
});

it.each(['rigged-shop-plus','starry-night','starry-night-plus','prismatic-ticket'])('solo %s matches independently calculated shop and credit draws',id=>{
 let state={...owning(createMatch(42),id),gold:200,level:7,xp:0};
 for(let n=0;n<12;n++){
  const expected=shopForState(state),rolled=rerollShop(state);expect(rolled.ok).toBe(true);if(!rolled.ok)throw Error(rolled.reason);
  expect(rolled.state.shop).toEqual(expected.shop);expect(rolled.state.rngState).toBe(expected.rngState);
  const used=(state.seatMechanics?.seat['free-shop-rerolls'] as {used:number}|undefined)?.used??0;
  expect(rolled.state.gold).toBe(state.gold-(freeRerollCredits(state)>used?0:2));
  state=rolled.state;expect(freeRerollsGranted(state)).toBe(freeRerollCredits(state));validateShopAugments(state);
 }
});
it('Dual Purpose pays an independently audited first purchase receipt, then only refreshes',()=>{
 const before={...owning(createMatch(42),'dual-purpose'),gold:30};
 const first=buyXp(before);expect(first.ok).toBe(true);if(!first.ok)throw Error(first.reason);
 expect([first.state.gold,first.state.shop.generation]).toEqual([28,before.shop.generation+1]);
 expect(first.events).toContainEqual(expect.objectContaining({type:'mechanicGranted',domain:'match',eventSeq:before.nextMatchEventSeq,receipt:expect.objectContaining({kind:'gold',amount:2,source:BATCH5_SOURCE})}));
 expect([...validateRewards(before,first.state,{type:'buyXp'},first.events,{...oracle,lootReceipts:[]}).gold.values()].map((x:any)=>x.amount)).toEqual([2]);
 const second=buyXp(first.state);expect(second.ok).toBe(true);if(!second.ok)throw Error(second.reason);
 expect(second.state.gold).toBe(24);expect(second.events.filter(e=>e.type==='mechanicGranted')).toHaveLength(0);
 const forged={...structuredClone(first.state),gold:first.state.gold+1};const receipt=forged.seatMechanics!.receipts.find(r=>r.source===BATCH5_SOURCE)!;
 (receipt as any).amount=3;
 const forgedEvents=first.events.map(e=>e.type==='mechanicGranted'&&e.receipt.source===BATCH5_SOURCE?{...e,receipt}:e);
 expect(()=>validateRewards(before,forged,{type:'buyXp'},forgedEvents,{...oracle,lootReceipts:[]})).toThrow();
 const deleted={...structuredClone(first.state),gold:first.state.gold-2};(deleted.seatMechanics as any).receipts=[];
 expect(()=>validateRewards(before,deleted,{type:'buyXp'},[],{...oracle,lootReceipts:[]})).toThrow();
});
it('Firesale picks the independent stream slot and grants its exact star level without a purchase',()=>{
 const state=owning(createMatch(42),'firesale',0),a=state.augments.at(-1)!;
 const open=state.shop.slots.flatMap((x,i)=>x.status==='available'?[i]:[]);
 const slot=open[Number(shopWord(state,['firesale',a.choiceId,state.round])*BigInt(open.length)/4294967296n)];
 expect(planFiresale(state,state.round)?.slot).toBe(slot);
 const offer=state.shop.slots[slot];if(offer.status!=='available')throw Error('offer');
 const result=stealFiresaleUnit(state,a,slot);
 expect(result.state.gold).toBe(state.gold);expect(result.state.shop.slots[slot]).toEqual({status:'purchased'});
 expect(result.state.preparation.units).toContainEqual(expect.objectContaining({id:'unit-'+state.nextUnitSerial,definitionId:offer.definitionId,starLevel:offer.starLevel??1}));
});
it('solo Subscription Service uses exactly four independent distinct draws and normal refresh keeps its unlock behavior',()=>{
 const base=createMatch(42),sub=owning(base,'subscription-service'),expected=shopForState(sub,sub.round,true);
 const actual=drawSoloAugmentShop(sub,sixCostShopContext(sub),true);
 expect(actual.shop).toEqual(expected.shop);expect(actual.rngState).toBe(expected.rngState);
 const lockedSub={...sub,shop:{...sub.shop,locked:true}},lockedDraw=drawSoloAugmentShop(lockedSub,sixCostShopContext(lockedSub),true);
 expect(lockedDraw.shop).toEqual(shopForState(lockedSub,lockedSub.round,true).shop);expect(lockedDraw.shop.locked).toBe(true);
 const locked={...base,gold:10,shop:{...base.shop,locked:true}};
 expect(drawSoloAugmentShop(locked,sixCostShopContext(locked)).shop.locked).toBe(false);
 const result=rerollShop(locked);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason);expect(result.state.shop.locked).toBe(true);
});

it('a failed Dual Purpose XP purchase preserves pool, state, events and RNG',()=>{
 const initial=room(undefined,1),drawn=accept(generateSharedShop(initial.pool,owning(initial.states[0],'dual-purpose'),0));
 const state={...drawn.state,gold:0},result=buySharedXp(drawn.pool,state);
 expect(result.ok).toBe(false);if(result.ok)throw Error('unexpected purchase');
 expect(result.reason).toBe('insufficient-gold');expect(result.state).toBe(state);expect(result.pool).toBe(drawn.pool);
 expect('events' in result).toBe(false);expect(state.rngState).toBe(drawn.state.rngState);conserved(drawn.pool,[state]);
});
it('Starry Night keeps one star when the finite pool cannot reserve three copies',()=>{
 const initial=room({irelia:2},1),drawn=accept(generateSharedShop(initial.pool,{...owning(initial.states[0],'starry-night'),level:10},0));
 expect(drawn.state.shop.slots.filter(x=>x.status==='available')).toHaveLength(1);
 expect(drawn.state.shop.slots.find(x=>x.status==='available')).toEqual({status:'available',definitionId:'irelia'});
 expect(drawn.pool.available.irelia).toBe(0);conserved(drawn.pool,[drawn.state]);
});

it.each([['firesale','patience-is-a-virtue'],['rigged-shop-plus','subscription-service'],['starry-night','starry-night-plus']])('the independent offer oracle enforces %s / %s exclusion in both directions',(left,right)=>{
 for(const [id,other] of [[left,right],[right,left]]){
  const tier=AUGMENT_TIERS[id],owned=[{definitionId:other,choiceId:'owned',acquiredRound:1}];
  expect(oracle.augmentPool(tier,owned)).not.toContain(id);
  const node=({'firesale':'3-2','patience-is-a-virtue':'2-1','rigged-shop-plus':'3-2','subscription-service':'2-1','starry-night':'2-1','starry-night-plus':'3-2'} as Record<string,string>)[id];
  expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(true);
  expect(augmentOfferAllowed(id,owned,{node,fieldedTraits:[],blocked:[]})).toBe(false);
 }
});

it('Dual Purpose makes one Ticket decision per actual XP refresh without spending free reroll credits',()=>{
 const initial=room(undefined,1);
 let r=accept(generateSharedShop(initial.pool,{...owning(owning(initial.states[0],'dual-purpose'),'prismatic-ticket'),gold:40},0));
 const ticket=r.state.augments.find(a=>a.definitionId==='prismatic-ticket')!,generation=r.state.shop.generation;
 let credits=0;
 for(let n=1;n<=3;n++){
  let rng=BigInt(r.state.rngState);for(let i=0;i<10;i++)rng=(rng*1664525n+1013904223n)%4294967296n;
  if(shopWord(r.state,['ticket',ticket.choiceId,n-1])*100n/4294967296n<45n)credits++;
  r=accept(buySharedXp(r.pool,r.state));
  expect(r.state.rngState).toBe(Number(rng));expect(r.state.shop.generation).toBe(generation+n);
  expect(record(r.state)).toMatchObject({rolls:n,credits});expect(freeRerollsAvailable(r.state)).toBe(credits);
  expect(r.state.gold).toBe(40-4*n+2);conserved(r.pool,[r.state]);validateShopAugments(r.state);
 }
 r=accept(setSharedShopLock(r.pool,r.state,true,r.state.shop.generation));
 const before=r.state;r=accept(buySharedXp(r.pool,r.state));
 let rng=BigInt(before.rngState);for(let i=0;i<10;i++)rng=(rng*1664525n+1013904223n)%4294967296n;
 if(shopWord(before,['ticket',ticket.choiceId,3])*100n/4294967296n<45n)credits++;
 expect([r.state.shop.generation,r.state.rngState]).toEqual([before.shop.generation+1,Number(rng)]);expect(r.state.shop.locked).toBe(true);
 expect(record(r.state)).toMatchObject({rolls:4,credits});expect(freeRerollsAvailable(r.state)).toBe(credits);
 expect(r.state.gold).toBe(before.gold-4);conserved(r.pool,[r.state]);
});

it('solo Firesale keeps a full-bench gift in the existing orb envelope and retries without losing the champion',()=>{
 let state={...owning(createMatch(42),'firesale',0),gold:2000};
 const seen=new Set(state.preparation.units.map(u=>u.definitionId));
 for(let i=0;i<100&&state.preparation.units.filter(u=>u.location.kind==='bench').length<9;i++){
  for(let slot=0;slot<state.shop.slots.length;slot++){
   const offer=state.shop.slots[slot];if(offer.status!=='available'||seen.has(offer.definitionId))continue;
   const result=buyUnit(state,slot,state.shop.generation);if(result.ok){state=result.state;seen.add(offer.definitionId);}
   if(state.preparation.units.filter(u=>u.location.kind==='bench').length===9)break;
  }
  if(state.preparation.units.filter(u=>u.location.kind==='bench').length<9)state=accept(rerollShop(state) as any).state;
 }
 expect(state.preparation.units.filter(u=>u.location.kind==='bench')).toHaveLength(9);
 state=accept(rerollShop(state) as any).state;
 const plan=planFiresale(state,state.round)!;expect(plan).toBeDefined();
 const offer=state.shop.slots[plan.slot];if(offer.status!=='available')throw Error('offer');
 const before=state,result=stealFiresaleUnit(state,plan.owner,plan.slot);state=result.state;
 expect([state.gold,state.rngState,state.nextUnitSerial]).toEqual([before.gold,before.rngState,before.nextUnitSerial]);
 expect(state.shop.slots[plan.slot]).toEqual({status:'purchased'});
 const orb=state.m8.loot.rewardOrbs!.at(-1)!;
 expect(orb.entries[0].payload).toEqual({kind:'unit',definitionId:offer.definitionId,quantity:1,starLevel:offer.starLevel??1});
 expect(soloPveLoot(state)).toEqual(before.m8.loot);expect(()=>oracle.validateLoot(state)).not.toThrow();expect(()=>validateB8Loot(state)).not.toThrow();
 const fighting=accept(startMatchCombat(state) as any).state as MatchState;const denied=claimOrb(fighting,orb.orbId,fighting.round);expect(denied.ok).toBe(false);expect(denied.state).toBe(fighting);
 const blocked=claimOrb(state,orb.orbId,state.round);expect(blocked.ok).toBe(true);if(!blocked.ok)throw Error(blocked.reason);expect(blocked.state).toBe(state);expect(blocked.events).toEqual([]);
 const sell=state.preparation.units.find(u=>u.location.kind==='bench')!;
 state=accept(sellUnit(state,sell.id) as any).state;
 const claimed=claimOrb(state,orb.orbId,state.round);expect(claimed.ok).toBe(true);if(!claimed.ok)throw Error(claimed.reason);
 expect(claimed.state.preparation.units.filter(u=>u.location.kind==='bench')).toHaveLength(9);
 expect(claimed.state.m8.loot.direct.find(d=>d.dropId===orb.entries[0].dropId)?.status).toBe('granted');
 expect(()=>soloPveLoot(claimed.state)).not.toThrow();expect(()=>validateB8Loot(claimed.state)).not.toThrow();expect(()=>validateB8Resources(claimed.state)).not.toThrow();
 expect(()=>oracle.validateLootTransition(state,claimed.state,{type:'claimOrb',orbId:orb.orbId},claimed.events)).not.toThrow();
 const again=claimOrb(claimed.state,orb.orbId,state.round);expect(again.ok).toBe(false);expect(again.state).toBe(claimed.state);
 const aliased=structuredClone(claimed.state),gift=aliased.seatMechanics!.receipts.find(r=>r.source===SHOP_AUGMENT_SOURCE)!;
 (aliased.seatMechanics!.receipts as any).push({...gift,receiptId:gift.receiptId+'-other'});
 expect(()=>soloPveLoot(aliased)).toThrow('Invalid solo shop reward orb');
 const forged=structuredClone(claimed.state);(forged.m8.loot.rewardOrbs![0].entries[0].payload as any).definitionId='irelia';
 if(offer.definitionId==='irelia')(forged.m8.loot.rewardOrbs![0].entries[0].payload as any).definitionId='vex';
 expect(()=>soloPveLoot(forged)).toThrow('Invalid solo shop reward orb');expect(()=>oracle.validateLoot(forged)).toThrow();
});
