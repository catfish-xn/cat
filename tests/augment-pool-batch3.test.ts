import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { advanceG23Economy, type G23BattleFacts } from '../src/simulation/g2-3-economy';
import { AUGMENT_BATCH3 } from '../src/simulation/content/augment-pool-batch3';
import { batch3RewardPlan, drainBatch3Gold, validateBatch3Gold } from '../src/simulation/augment-pool-batch3-progress';
import { batch1GiftPlan, drainBatch1Gifts, validateBatch1Gifts, batch1AnvilSpecification } from '../src/simulation/augment-pool-grants';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import type { MatchState } from '../src/simulation/match-types';
import { rerollShop, selectChoice, startMatchCombat, nextRound } from '../src/simulation/match';
import { drainBatch3RoundEntry } from '../src/simulation/augment-pool-batch3-progress';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { generateChoices } from '../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateSharedShop, rerollSharedShop } from '../src/server-entry';
import { freeRerollsAvailable, freeRerollsGranted, validateFreeRerolls, FREE_REROLL_KEY } from '../src/simulation/free-rerolls';
import { writeSeatMechanic } from '../src/simulation/seat-mechanics/state';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { accept, room } from './tp-helpers';
import { reachRound, resolveM5Choices, emptyBoard } from './match-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';

type Battle = readonly ['pvp'|'pve', G23BattleFacts['result']];
const fact=(round:number,[roundKind,result]:Battle):G23BattleFacts=>({battleId:'battle-'+round,round,roundKind,result,conquerorTier:0,conquestTakedowns:[],chemBaronTier:0,alliedDeaths:0,rumbleStar:0,highRollerGold:0});
/** Battles occupy rounds 1..n; the augment is owned from `acquiredRound`.
 * `drain` replays settlement order: each battle's receipt is followed by that round's grant drain. */
function withBattles(id:string,battles:readonly Battle[],acquiredRound=1,drain?:(s:MatchState)=>MatchState):MatchState {
 let s:MatchState={...createMatch(42),augments:[{definitionId:id,choiceId:'test',acquiredRound}]};
 for(const [i,b] of battles.entries()){
  s=writeG23Progress({...s,round:i+1},advanceG23Economy(readG23Progress(s)!,fact(i+1,b)).progress);
  if(drain)s=drain(s);
 }
 return s;
}
const pvp=(n:number,result:G23BattleFacts['result']='win'):Battle[]=>Array.from({length:n},()=>['pvp',result] as const);
const scheduled=(s:MatchState)=>batch3RewardPlan(s).map(g=>[g.definitionId,g.acquiredRound]);

it('the nineteen batch-3 rows carry their 14.24 zh_cn name, tier and description and are registered in the offer pool', ()=>{
 const research=JSON.parse(readFileSync('/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json','utf8')) as {apiName:string;name_zh_cn:string;description_zh_cn:string;tier:number;effects:Record<string,number>}[];
 expect(Object.keys(AUGMENT_BATCH3).sort()).toEqual(['building-a-collection-iii','dark-alley-dealings','eye-for-an-eye','eye-for-an-eye-plus','flexible','latent-forge','living-forge','phreaky-friday','phreaky-friday-plus','prizefighter','rolling-for-days-i','shimmerscale-essence','superstars-i','superstars-ii','team-building','trade-sector','what-doesnt-kill-you','worth-the-wait','worth-the-wait-ii']);
 for(const [id,row] of Object.entries(AUGMENT_BATCH3)){
  const r=research.find(x=>x.apiName===row.apiName)!;
  expect([row.name,row.description,row.tier,row.source.values]).toEqual([r.name_zh_cn,r.description_zh_cn,['silver','gold','prismatic'][r.tier-1],r.effects]);
  expect(AUGMENT_DEFINITIONS[id].name).toBe(r.name_zh_cn);expect(AUGMENT_TIERS[id]).toBe(row.tier);expect(AUGMENT_POOL_API_NAMES[id]).toBe(row.apiName);
 }
});
it('Phreaky Friday variants exclude each other and Dark Alley Dealings through the static 14.24 mutex', ()=>{
 const own=(id:string)=>[{definitionId:id,choiceId:'old',acquiredRound:1}],ctx={node:'3-2',fieldedTraits:[],blocked:[]};
 expect(augmentOfferAllowed('phreaky-friday',own('phreaky-friday-plus'),ctx)).toBe(false);
 expect(augmentOfferAllowed('phreaky-friday-plus',own('phreaky-friday'),ctx)).toBe(false);
 expect(augmentOfferAllowed('dark-alley-dealings',own('phreaky-friday-plus'),ctx)).toBe(false);
 expect(augmentOfferAllowed('dark-alley-dealings',own('phreaky-friday'),ctx)).toBe(true);
});
it.each([
 ['team-building',7,'TFT_Consumable_ChampionDuplicator_III'],['latent-forge',8,'TFT_ArmoryKeyOrnn'],
 ['phreaky-friday',5,'TFT4_Item_OrnnInfinityForce'],['phreaky-friday-plus',3,'TFT4_Item_OrnnInfinityForce'],
 ['dark-alley-dealings',3,'TFT9_Item_OrnnTrickstersGlass'],['shimmerscale-essence',5,'TFT7_Item_ShimmerscaleGamblersBlade'],
] as const)('%s grants once after exactly %i player combats, counting the acquisition round and skipping PvE', (id,n,reward)=>{
 expect(scheduled(withBattles(id,pvp(n-1)))).toEqual([]);
 expect(scheduled(withBattles(id,pvp(n)))).toEqual([[reward,n]]);
 expect(scheduled(withBattles(id,[['pve','win'],...pvp(n)]))).toEqual([[reward,n+1]]);
 expect(scheduled(withBattles(id,[...pvp(n),...pvp(3*n)]))).toEqual([[reward,n]]);
 // Battles before acquisition never count.
 expect(scheduled(withBattles(id,pvp(n),2))).toEqual([]);
});
it('Living Forge gives an Artifact anvil now and after every 9 player combats, each with its own four receipt-bound options', ()=>{
 const s=withBattles('living-forge',[...pvp(9),['pve','loss'],...pvp(9)]);
 expect(scheduled(s)).toEqual([['TFT_ArmoryKeyOrnn',9],['TFT_ArmoryKeyOrnn',19]]);
 const anvils=batch1GiftPlan(s).filter(g=>g.definitionId==='TFT_ArmoryKeyOrnn');expect(anvils).toHaveLength(3);
 expect(new Set(anvils.map(g=>g.receiptId)).size).toBe(3);
 for(const g of anvils)expect(batch1AnvilSpecification(s,g.receiptId)?.offers).toHaveLength(4);
});
it('immediate rewards are granted at acquisition through the shared grant ledger', ()=>{
 for(const [id,item] of [['phreaky-friday','TFT4_Item_OrnnInfinityForce'],['dark-alley-dealings','TFT_Item_Artifact_SuspiciousTrenchCoat'],['shimmerscale-essence','TFT7_Item_ShimmerscaleMogulsMail']] as const){
  const s=drainBatch1Gifts({...createMatch(42),augments:[{definitionId:id,choiceId:'test',acquiredRound:1}]});
  expect(s.items.filter(i=>i.definitionId===item)).toHaveLength(1);validateBatch1Gifts(s);
 }
 const t=drainBatch1Gifts({...createMatch(42),augments:[{definitionId:'team-building',choiceId:'test',acquiredRound:1}]});
 expect(t.consumables.map(c=>c.definitionId)).toEqual(['TFT_Consumable_ChampionDuplicator_III']);
});
it('What Doesn\'t Kill You pays 2 gold per player-combat loss and a component every 4 losses; wins, draws and PvE losses do not count', ()=>{
 const history:Battle[]=[['pvp','loss'],['pvp','draw'],['pve','loss'],['pvp','win'],['pvp','loss'],['pvp','loss'],['pvp','loss'],['pvp','loss']];
 const s=withBattles('what-doesnt-kill-you',history),plan=batch3RewardPlan(s);
 expect(plan.map(g=>[g.kind,g.acquiredRound])).toEqual([['item',7]]);
 const after=withBattles('what-doesnt-kill-you',history,1,drainBatch3Gold);expect(after.gold-s.gold).toBe(10);
 expect(after.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch3').map(r=>r.round)).toEqual([1,5,6,7,8]);
 expect(drainBatch3Gold(after)).toBe(after);validateBatch3Gold(after);
});
it('scheduled rewards drain exactly once and restored receipts are authenticated against the battle history', ()=>{
 const s=withBattles('what-doesnt-kill-you',pvp(4,'loss')),granted=withBattles('what-doesnt-kill-you',pvp(4,'loss'),1,x=>drainBatch1Gifts(x));
 expect(granted.items).toHaveLength(s.items.length+1);expect(granted.gold-s.gold).toBe(8);
 expect(drainBatch1Gifts(granted)).toBe(granted);validateBatch1Gifts(granted);
 const tampered=structuredClone(granted) as any;
 tampered.seatMechanics.receipts.find((r:{source:string})=>r.source==='augment-pool-batch3').amount=3;expect(()=>validateBatch1Gifts(tampered)).toThrow();
 expect(()=>validateBatch1Gifts(s)).toThrow();
 const p=readG23Progress(granted)!,rewritten=writeG23Progress(granted,{...p,economyReceipts:p.economyReceipts.slice(0,3)});
 expect(()=>validateBatch1Gifts(rewritten)).toThrow();
});
it('P: Eye for an Eye+ gives a component now and caps the 13-death components at three more', ()=>{
 let s:MatchState={...createMatch(42),augments:[{definitionId:'eye-for-an-eye-plus',choiceId:'test',acquiredRound:1}]};
 for(let i=0;i<3;i++)s=writeG23Progress({...s,round:i+1},advanceG23Economy(readG23Progress(s)!,{...fact(i+1,['pvp','loss']),alliedDeaths:26}).progress);
 expect(batch3RewardPlan(s).map(g=>[g.kind,g.acquiredRound])).toEqual([['item',1],['item',1],['item',2]]);
 expect(batch1GiftPlan(s).filter(g=>g.kind==='item')).toHaveLength(4);
});
it('P: Prizefighter gives two components now and one per five player-combat wins; PvE wins, draws and losses do not count', ()=>{
 const history:Battle[]=[...pvp(4),['pve','win'],['pvp','draw'],['pvp','loss'],['pvp','win'],...pvp(5)];
 expect(batch3RewardPlan(withBattles('prizefighter',history)).map(g=>[g.kind,g.acquiredRound])).toEqual([['item',8],['item',13]]);
 const now=drainBatch1Gifts({...createMatch(42),augments:[{definitionId:'prizefighter',choiceId:'test',acquiredRound:1}]});
 expect(now.items.length-createMatch(42).items.length).toBe(2);
});
it('Eye for an Eye counts allied deaths in every combat from acquisition, carries the remainder and stops at four components', ()=>{
 const deaths=(counts:number[])=>{
  let s:MatchState={...createMatch(42),augments:[{definitionId:'eye-for-an-eye',choiceId:'test',acquiredRound:2}]};
  for(const [i,alliedDeaths] of counts.entries())s=writeG23Progress({...s,round:i+1},advanceG23Economy(readG23Progress(s)!,{...fact(i+1,[i%2?'pve':'pvp','loss']),alliedDeaths}).progress);
  return batch3RewardPlan(s).map(g=>[g.kind,g.acquiredRound]);
 };
 expect(deaths([9,8,6])).toEqual([]);
 expect(deaths([9,8,7])).toEqual([['item',3]]);
 // 30 deaths in one battle cross two thresholds at once; the cap holds no matter how many more die.
 expect(deaths([0,30,0])).toEqual([['item',2],['item',2]]);
 expect(deaths([0,30,30,30])).toEqual([['item',2],['item',2],['item',3],['item',3]]);
 const plan=batch3RewardPlan(withBattles('eye-for-an-eye',[]));expect(plan).toEqual([]);
});

const firstOffers=(seed:number)=>{const state=createMatch(seed);return generateChoices(augmentCandidates(resolveAugmentTier(state,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),state.choiceRngState).offers;};
const owning=(s:MatchState,definitionId:string,acquiredRound=s.round):MatchState=>({...s,augments:[...s.augments,{definitionId,choiceId:'test-'+definitionId,acquiredRound}]});
it('free shop rerolls: Rolling for Days I grants 11, Superstars 2/4; each free reroll costs no gold and the 12th costs 2', ()=>{
 // Public selection, so the save carries the acquisition receipt and the restore validates the spend counter.
 let seed=0;while(!firstOffers(seed).includes('rolling-for-days-i'))seed++;
 const open=reachRound('2-1',false,seed),c=open.pendingChoice!;expect(c.offers).toContain('rolling-for-days-i');
 let s=accept(selectChoice(open,c.choiceId,c.generation,'rolling-for-days-i') as any).state as MatchState;s={...s,gold:s.gold+2};
 expect(freeRerollsGranted(owning(s,'superstars-i'))-freeRerollsGranted(s)).toBe(2);expect(freeRerollsGranted(owning(s,'superstars-ii'))-freeRerollsGranted(s)).toBe(4);
 for(let i=0;i<11;i++){const next=accept(rerollShop(s) as any).state as MatchState;expect(next.gold).toBe(s.gold);expect(next.shop.generation).toBe(s.shop.generation+1);s=next;}
 expect(freeRerollsAvailable(s)).toBe(0);validateFreeRerolls(s);
 const paid=(rerollShop(s) as any).state as MatchState;expect(paid.gold).toBe(s.gold-2);
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
});
it('Trade Sector adds one free reroll every round from the acquisition round and 1 gold on acquisition; credits carry over', ()=>{
 const s={...createMatch(42),round:5};
 expect(freeRerollsGranted(owning(s,'trade-sector',5))).toBe(1);
 expect(freeRerollsGranted({...owning(s,'trade-sector',5),round:9})).toBe(5);
 expect(AUGMENT_DEFINITIONS['trade-sector'].effects).toContainEqual({kind:'mechanic',mechanic:'acquisitionGold',values:{amount:1}});
});
it('the shared-pool reroll spends a free credit before gold and keeps the pool conserved', ()=>{
 let {pool,states}=room(undefined,1);let r=accept(generateSharedShop(pool,{...owning(states[0],'superstars-i'),gold:10},0));
 const gold=r.state.gold;
 r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));
 expect(r.state.gold).toBe(gold);expect(freeRerollsAvailable(r.state)).toBe(0);
 r=accept(rerollSharedShop(r.pool,r.state,r.state.shop.generation));expect(r.state.gold).toBe(gold-2);
});
it('a restored spend counter above the derived credits, zero, or malformed is rejected', ()=>{
 const s=owning(createMatch(42),'superstars-i',1);
 for(const bad of [{used:3},{used:0},{used:1,extra:1},{used:1.5},[1]])expect(()=>validateFreeRerolls(writeSeatMechanic(s,FREE_REROLL_KEY,bad as any))).toThrow();
 validateFreeRerolls(writeSeatMechanic(s,FREE_REROLL_KEY,{used:2}));
 expect(()=>validateBatch1Gifts(writeSeatMechanic(createMatch(42),FREE_REROLL_KEY,{used:1}))).toThrow();
});
it('Superstars I/II give 5%/7% team damage amp plus 2%/5% per 3-star ally on the board', ()=>{
 const base=createMatch(42),unit=base.preparation.units[0];
 const board=(stars:readonly (1|2|3)[])=>stars.map((starLevel,i)=>({...unit,id:'p'+i,starLevel,location:{kind:'board' as const,cell:{col:i,row:4}}}));
 for(const [id,b,p] of [['superstars-i',500,200],['superstars-ii',700,500]] as const)for(const stars of [[1,2],[3,1],[3,3,2]] as const){
  const snap=buildStrategySnapshot({...base,preparation:{...base.preparation,units:board(stars)},augments:[{definitionId:id,choiceId:'t',acquiredRound:1}]});
  const amp=snap.units[0].mechanics?.filter(m=>m.mechanic==='damageAmp'&&m.source.definitionId===id).reduce((n,m)=>n+m.values.bps,0);
  expect(amp).toBe(b+p*stars.filter(x=>x===3).length);
 }
});

const at=(definitionId:string,acquiredRound:number,round:number):MatchState=>({...createMatch(42),round,augments:[{definitionId,choiceId:'test',acquiredRound}]});
it('Building a Collection III: one component now and at each of the next five round entries, then none', ()=>{
 expect(batch3RewardPlan(at('building-a-collection-iii',5,5))).toEqual([]);
 expect(batch3RewardPlan(at('building-a-collection-iii',5,20)).map(g=>[g.kind,g.acquiredRound])).toEqual([6,7,8,9,10].map(r=>['item',r]));
 expect(batch1GiftPlan(at('building-a-collection-iii',5,20)).filter(g=>g.kind==='item')).toHaveLength(6);
});
it('Worth the Wait: a 2-star 1-cost now, 1-star copies of that champion from the second round entry on; II copies its 2-cost from the next entry', ()=>{
 const gold=batch1GiftPlan(at('worth-the-wait',5,9)),first=gold.find(g=>g.acquiredRound===5)!;
 expect(first).toMatchObject({kind:'unit',starLevel:2});
 expect(gold.filter(g=>g.acquiredRound>5).map(g=>[g.definitionId,g.acquiredRound,g.starLevel])).toEqual([7,8,9].map(r=>[first.definitionId,r,undefined]));
 const ii=batch1GiftPlan(at('worth-the-wait-ii',5,7)),base=ii.find(g=>g.acquiredRound===5)!;
 expect(ii.filter(g=>g.acquiredRound>5).map(g=>[g.definitionId,g.acquiredRound])).toEqual([[base.definitionId,6],[base.definitionId,7]]);
});
it('Flexible: an emblem now and one at each later stage start; board allies gain 40 HP per emblem held on the board', ()=>{
 const starts=Array.from({length:30},(_,i)=>i+1).filter(r=>r>3&&getMultiplayerRoundByOrdinal(r).subround===1);
 expect(batch3RewardPlan(at('flexible',3,30)).map(g=>g.acquiredRound)).toEqual(starts);
 expect(batch3RewardPlan(at('flexible',3,30)).every(g=>Object.hasOwn(EMBLEM_ITEMS,g.definitionId))).toBe(true);
 const base=createMatch(42),unit=base.preparation.units[0],emblem=Object.keys(EMBLEM_ITEMS)[0];
 const units=[0,1].map(i=>({...unit,id:'p'+i,location:{kind:'board' as const,cell:{col:i,row:4}}}));
 const items=[...base.items,{id:'e1',definitionId:emblem,location:{kind:'unit',unitId:'p0',slot:0}},{id:'e2',definitionId:emblem,location:{kind:'unit',unitId:'p0',slot:1}}] as MatchState['items'];
 const input={...base,preparation:{...base.preparation,units},items};
 const zero=buildStrategySnapshot({...input,augments:[]}),snap=buildStrategySnapshot({...input,augments:[{definitionId:'flexible',choiceId:'t',acquiredRound:1}]});
 for(const i of [0,1])expect(snap.units[i].stats.health-zero.units[i].stats.health).toBe(80);
});
it('round-start gifts arrive through real round entries, once, with receipts the restore accepts', ()=>{
 let seed=0;while(!firstOffers(seed).includes('building-a-collection-iii'))seed++;
 let s=reachRound('2-1',false,seed);const c=s.pendingChoice!;expect(c.offers).toContain('building-a-collection-iii');
 s=accept(selectChoice(s,c.choiceId,c.generation,'building-a-collection-iii') as any).state as MatchState;
 const acquired=s.round,count=()=>s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch1'&&r.kind==='item').length;
 expect(count()).toBe(1);
 for(let n=0;n<3;n++){
  s=resolveM5Choices(s);if(s.phase==='preparation')s=accept(startMatchCombat(emptyBoard(s)) as any).state;
  s=resolveM5Choices(s);s=accept(nextRound(s,s.round) as any).state;
  expect(count()).toBe(Math.min(6,1+s.round-acquired));expect(drainBatch3RoundEntry(s)).toBe(s);
  validateBatch1Gifts(s);expect(restoreMatch(serializeMatch(s))).toEqual(s);
 }
});
