import { buffetPlan } from './fixtures/m5/augment-inventory-oracle.cjs';
// A deterministic silver tier fixture keeps solo route discovery inside seeds 0..100.
// The companion room tests use the unmodified tier policy and genuine production offers.
vi.mock('../src/simulation/content/augment-policy',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/simulation/content/augment-policy')>();
 return {...actual,AUGMENT_OFFER_POLICY:{...actual.AUGMENT_OFFER_POLICY,tierCombinations:actual.AUGMENT_OFFER_POLICY.tierCombinations.map(r=>({...r,tiers:['silver','silver','silver']}))}};
});
import { expect, it, vi } from 'vitest';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { boundedFirstNodeOffer } from './augment-stage-helpers';
import { accepted, resolveM5Choices, emptyBoard } from './match-helpers';
import { nextRound, selectChoice, startMatchCombat, openAnvil, buyUnit, rerollShop, sellUnit, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { batch5InventoryPlan, BATCH5_S3A_SOURCE } from '../src/simulation/augment-pool-batch5-s3a';
import { grantMechanicItem } from '../src/simulation/seat-mechanics/grants';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
export function trip(s:MatchState){const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);expect(restoreMatch(s)).toEqual(s);}
export function reject(s:MatchState,mutate:(x:any)=>void){const x=JSON.parse(serializeMatch(s));mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();}
export function choose(id:string){const open=boundedFirstNodeOffer(id),c=open.pendingChoice!;expect(c.offers).toContain(id);return resolveM5Choices(accepted(selectChoice(open,c.choiceId,c.generation,id)));}
export function advance(s:MatchState){s=resolveM5Choices(s);if(s.phase==='preparation')s=accepted(startMatchCombat(emptyBoard(s)));s=resolveM5Choices(s);return resolveM5Choices(accepted(nextRound(s,s.round)));}
it('B5-13 offers only at 2-1, including the independent oracle',()=>{for(const node of ['2-1','3-2','4-2']){expect(augmentOfferAllowed('component-buffet',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='2-1');expect(augmentPool('silver',[],[],`round:${node}:augment`,[]).includes('component-buffet')).toBe(node==='2-1');}});
it('B5-13 grants its initial component, converts real later rewards, opens four distinct options and restores all entries',()=>{
 let s=choose('component-buffet');expect(batch5InventoryPlan(s).anvils).toHaveLength(0);trip(s);
 const initial=s.items.map(i=>i.id);
 // 2-4's public component choice is a fresh component grant.
 while(s.roundDefinitionId!=='2-4')s=advance(s);
 const plan=batch5InventoryPlan(s);expect(plan.anvils.length).toBeGreaterThan(0);
 expect([...buffetPlan(s).consumed]).toEqual(plan.conversions.map(c=>c.itemId));expect([...buffetPlan(s).gifts.keys()]).toEqual(plan.anvils.map(g=>g.receiptId));
 expect(s.items.map(i=>i.id)).toEqual(initial);trip(s);
 s=advance(s);trip(s);
 const r=s.seatMechanics!.receipts.find(r=>r.source===BATCH5_S3A_SOURCE);expect(r?.kind).toBe('unit');if(r?.kind!=='unit')throw new Error('missing anvil');
 reject(s,x=>{x.items.push({id:plan.conversions[0].itemId,definitionId:'sword',location:{kind:'inventory'}});});
 reject(s,x=>{x.seatMechanics.receipts.find((r:any)=>r.source===BATCH5_S3A_SOURCE).definitionId='TFT_ArmoryKeySupport';});
 s=accepted(openAnvil(s,r.unitId!));expect(s.pendingChoice!.offers).toHaveLength(4);expect(new Set(s.pendingChoice!.offers).size).toBe(4);trip(s);
 const c=s.pendingChoice!,before=s.nextItemSerial;s=accepted(selectChoice(s,c.choiceId,c.generation,c.offers[1]));
 expect(s.items.find(i=>i.id===`item-${before}`)?.definitionId).toBe(c.offers[1]);expect(batch5InventoryPlan(s).anvils).toHaveLength(plan.anvils.length);trip(s);
 expect(selectChoice(s,c.choiceId,c.generation,c.offers[1])).toMatchObject({ok:false,state:s});
 reject(s,x=>{x.seatMechanics.receipts.find((r:any)=>r.receiptId===c.choiceId).optionId='fake';});
});
// A boundary fixture tests generic mechanic grants, without claiming its synthetic source is a valid save.
it('B5-13 replacement is due for new grants, never for existing inventory',()=>{
 let s=choose('component-buffet');const g=grantMechanicItem(s,{source:'boundary-fixture',receiptId:'boundary-fixture',definitionId:'sword'});expect(g.ok).toBe(true);if(!g.ok)return;s=g.state;
 expect(batch5InventoryPlan(s).conversions.map(c=>c.itemId)).toEqual([`item-${s.nextItemSerial-1}`]);
});

it('B5-13 full bench preserves a converted component entitlement across restore and pays once after a sale',()=>{
 const open=boundedFirstNodeOffer('component-buffet',true),choice=open.pendingChoice!;
 // Earn the opening loot in combat, then bench the roster before filling all nine slots.
 let s=emptyBoard(resolveM5Choices(accepted(selectChoice(open,choice.choiceId,choice.generation,'component-buffet'))));
 for(let tries=0;s.preparation.units.filter(u=>u.location.kind==='bench').length<s.preparation.benchSize&&tries<30;tries++){
  const slot=s.shop.slots.findIndex(x=>x.status==='available');
  s=slot<0?accepted(rerollShop(s)):accepted(buyUnit(s,slot,s.shop.generation));
 }
 expect(s.preparation.units.filter(u=>u.location.kind==='bench')).toHaveLength(s.preparation.benchSize);
 while(s.roundDefinitionId!=='2-5')s=advance(s);
 const plan=batch5InventoryPlan(s);expect(plan.anvils.length).toBeGreaterThan(0);
 expect([...buffetPlan(s).consumed]).toEqual(plan.conversions.map(c=>c.itemId));expect([...buffetPlan(s).gifts.keys()]).toEqual(plan.anvils.map(g=>g.receiptId));expect(s.items.some(i=>plan.conversions.some(c=>c.itemId===i.id))).toBe(false);
 expect(s.seatMechanics?.receipts.filter(r=>r.source===BATCH5_S3A_SOURCE)??[]).toHaveLength(0);trip(s);
 const unit=s.preparation.units.find(u=>u.team==='player'&&!u.definitionId.startsWith('TFT_ArmoryKey'))!;
 s=accepted(sellUnit(s,unit.id));expect(s.seatMechanics!.receipts.filter(r=>r.source===BATCH5_S3A_SOURCE)).toHaveLength(1);trip(s);
 reject(s,x=>{x.seatMechanics.receipts.find((r:any)=>r.source===BATCH5_S3A_SOURCE).receiptId+='duplicate';});
});
