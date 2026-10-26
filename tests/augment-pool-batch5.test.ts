import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5 } from '../src/simulation/content/augment-pool-batch5';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { buyXp, combineItems, equipItem, nextRound, rerollShop, selectChoice, setShopLock, startMatchCombat, type MatchState } from '../src/simulation/match';
import { batch5RerollsGranted, batch5Streak, batch5XpPurchases } from '../src/simulation/augment-pool-batch5-progress';
import { freeRerollsAvailable } from '../src/simulation/free-rerolls';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted, emptyBoard, reachRound, reachRoundFielded, resolveM5Choices } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { augmentPool, freeRerollCredits, augmentGold, shop } from './fixtures/m5/oracle.g2.cjs';
import { RULES_GAP_MANIFEST } from '../scripts/augment-content-archive';

const ids=['called-shot','crafted-crafting','dual-purpose','a-change-of-fate'];
it.each(ids)('%s: exact public allowed nodes and independent tier catalog',id=>{
 const tier=id==='called-shot'||id==='crafted-crafting'?'silver':'prismatic';
 expect(AUGMENT_TIERS[id]).toBe(tier);
 for(const node of ['2-1','3-2','4-2']){
  const allowed=node===(id==='a-change-of-fate'?'4-2':'2-1');
  expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(allowed);
  expect(augmentPool(tier,[],[],`round:${node}:augment`,[]).includes(id)).toBe(allowed);
 }
});
it.skipIf(!existsSync(RESEARCH_FILE)).each(ids)('%s preserves every 14.24 value and archived description',id=>{
 const row=AUGMENT_BATCH5[id],source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===row.apiName);
 expect(row.source.values).toEqual(source.effects);
 const archived=(RULES_GAP_MANIFEST.augmentPoolBatch5.content as any)[id];
 expect([archived.name,archived.description,archived.source.description_en_us]).toEqual([source.name_zh_cn,source.description_zh_cn,source.description_en_us]);
});
function choose(id:string):MatchState {
 const open=id==='crafted-crafting'?reachRoundFielded('2-1',firstNodeSeed(id)):reachRound('2-1',false,firstNodeSeed(id)),c=open.pendingChoice!;
 expect(c.offers).toContain(id);return resolveM5Choices(accepted(selectChoice(open,c.choiceId,c.generation,id)));
}
function trip(s:MatchState){const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);expect(restoreMatch(s)).toEqual(s);}
function reject(s:MatchState,mutate:(x:any)=>void){const x=JSON.parse(serializeMatch(s));mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();}
it('Called Shot sets exactly four wins, pays four once and survives a subsequent economy settlement',()=>{
 const open=reachRound('2-1',false,firstNodeSeed('called-shot')),c=open.pendingChoice!,s=accepted(selectChoice(open,c.choiceId,c.generation,'called-shot'));
 expect(s.streak).toEqual({kind:'win',count:4});expect(s.gold-open.gold).toBe(4);expect(augmentGold('called-shot','2-1')).toBe(4);trip(s);
 expect(batch5Streak(s,s.round,{kind:'win',count:9})).toEqual({kind:'win',count:4});
 for(const streak of [{kind:'loss',count:3},{kind:null,count:0},{kind:'win',count:3}])reject(s,x=>{x.streak=streak;});
 reject(s,x=>{x.scheduleReceipts.find((r:any)=>r.definitionId==='called-shot').gold=5;});
 const again=selectChoice(s,c.choiceId,c.generation,'called-shot');expect(again.ok).toBe(false);expect(again.state).toBe(s);
 const settled=accepted(startMatchCombat(emptyBoard(s)));expect(settled.roundResults.at(-1)?.streakBefore).toEqual({kind:'win',count:4});expect(settled.streak).toEqual({kind:'loss',count:1});trip(settled);
});
it('Dual Purpose pays only first successful XP purchase each round; each refresh preserves lock and credits',()=>{
 let s=choose('dual-purpose');expect(batch5XpPurchases(s,s.round)).toBe(0);trip(s);
 s=accepted(setShopLock(s,true,s.shop.generation));
 const before=s;s=accepted(buyXp(s));expect(s.gold).toBe(before.gold-2);expect(s.shop.generation).toBe(before.shop.generation+1);expect(s.shop.locked).toBe(true);expect(batch5XpPurchases(s,s.round)).toBe(1);
 expect(s.shop).toEqual(shop(before.rngState,before.shop.generation+1,s.level,true,s.round,{seed:s.seed,viktor:false}).shop);trip(s);
 reject(s,x=>{x.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5').amount++;});
 reject(s,x=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-pool-batch5');});
 reject(s,x=>{x.resourceProvenance.entries.find((e:any)=>e.kind==='dual-purpose-xp-purchased').xpBefore++;});
 reject(s,x=>{x.resourceProvenance.entries=x.resourceProvenance.entries.filter((e:any)=>e.kind!=='dual-purpose-xp-purchased');});
 reject(s,x=>{x.resourceProvenance.entries.find((e:any)=>e.kind==='dual-purpose-xp-purchased').settled=true;});
 reject(s,x=>{x.resourceProvenance.entries.find((e:any)=>e.kind==='dual-purpose-selected').xp++;});
 const second=s;s=accepted(buyXp(s));expect(s.gold).toBe(second.gold-4);expect(s.shop.generation).toBe(second.shop.generation+1);expect(s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5')).toHaveLength(1);trip(s);
 const noGold={...s,gold:0},failed=buyXp(noGold);expect(failed.ok).toBe(false);expect(failed.state).toBe(noGold);
 s=accepted(nextRound(accepted(startMatchCombat(emptyBoard(s))),s.round));s=resolveM5Choices(s);const next=s;s=accepted(buyXp(s));expect(s.gold).toBe(next.gold-2);expect(s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5')).toHaveLength(2);trip(s);
});
it('Crafted Crafting rewards real inventory and equip-time combinations; spends credits and rejects forged history',()=>{
 let s=choose('crafted-crafting');expect(batch5RerollsGranted(s)).toBe(0);expect(freeRerollCredits(s)).toBe(0);trip(s);
 // Public component choices before 2-1 provide two components on this deterministic route.
 const components=s.items.filter(i=>i.location.kind==='inventory');expect(components.length).toBeGreaterThanOrEqual(2);
 const holder=s.preparation.units.find(u=>u.team==='player')!;let equipped=accepted(equipItem(s,components[0].id,holder.id,0));equipped=accepted(equipItem(equipped,components[1].id,holder.id,0));expect(batch5RerollsGranted(equipped)).toBe(2);trip(equipped);
 const before=s;s=accepted(combineItems(s,components[0].id,components[1].id));expect(batch5RerollsGranted(s)).toBe(2);expect(freeRerollCredits(s)).toBe(2);expect(s.gold).toBe(before.gold);trip(s);
 const combined=s;s=accepted(rerollShop(s));expect(s.gold).toBe(combined.gold);expect(freeRerollsAvailable(s)).toBe(1);trip(s);
 reject(s,x=>{x.seatMechanics.seat['free-shop-rerolls'].used++;});reject(s,x=>{delete x.seatMechanics.seat['free-shop-rerolls'];});
 reject(s,x=>{x.resourceProvenance.entries.find((e:any)=>e.kind==='item-combined').event.definitionId='blue-buff';});
 const repeated=combineItems(s,components[0].id,components[1].id);expect(repeated.ok).toBe(false);expect(repeated.state).toBe(s);
});
