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

it('the eight 3a-1 rows carry their 14.24 zh_cn name, tier and description and are registered in the offer pool', ()=>{
 const research=JSON.parse(readFileSync('/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json','utf8')) as {apiName:string;name_zh_cn:string;description_zh_cn:string;tier:number;effects:Record<string,number>}[];
 expect(Object.keys(AUGMENT_BATCH3).sort()).toEqual(['dark-alley-dealings','eye-for-an-eye','latent-forge','living-forge','phreaky-friday','phreaky-friday-plus','team-building','what-doesnt-kill-you']);
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
 ['dark-alley-dealings',3,'TFT9_Item_OrnnTrickstersGlass'],
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
 for(const [id,item] of [['phreaky-friday','TFT4_Item_OrnnInfinityForce'],['dark-alley-dealings','TFT_Item_Artifact_SuspiciousTrenchCoat']] as const){
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
