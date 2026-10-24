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
import { rerollShop, selectChoice, startMatchCombat, nextRound, stepMatch, deployMatchUnit, buyUnit, buyXp } from '../src/simulation/match';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { drainBatch3RoundEntry } from '../src/simulation/augment-pool-batch3-progress';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { startingRows } from '../src/simulation/m8/targeting';
import { generateChoices } from '../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateSharedShop, rerollSharedShop } from '../src/server-entry';
import { freeRerollsAvailable, freeRerollsGranted, validateFreeRerolls, FREE_REROLL_KEY } from '../src/simulation/free-rerolls';
import { writeSeatMechanic } from '../src/simulation/seat-mechanics/state';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { ad, spellCrit } from '../src/simulation/combat-s13-state';
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

it('the twenty-six batch-3 rows carry their 14.24 zh_cn name, tier and description and are registered in the offer pool', ()=>{
 const research=JSON.parse(readFileSync('/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json','utf8')) as {apiName:string;name_zh_cn:string;description_zh_cn:string;tier:number;effects:Record<string,number>}[];
 expect(Object.keys(AUGMENT_BATCH3).sort()).toEqual(['bad-luck-protection','blazing-soul-i','blazing-soul-ii','building-a-collection-iii','corrosion','dark-alley-dealings','eye-for-an-eye','eye-for-an-eye-plus','flexible','latent-forge','living-forge','noble-sacrifice','phreaky-friday','phreaky-friday-plus','prizefighter','rolling-for-days-i','shimmerscale-essence','superstars-i','superstars-ii','team-building','trade-sector','wealthy-rehab-i','wealthy-rehab-ii','what-doesnt-kill-you','worth-the-wait','worth-the-wait-ii']);
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
 expect(gold.filter(g=>g.acquiredRound>5).map(g=>[g.definitionId,g.acquiredRound,g.starLevel])).toEqual([8,8,9].map(r=>[first.definitionId,r,undefined])); // 7 (2-4) is a supply round
 const ii=batch1GiftPlan(at('worth-the-wait-ii',5,7)),base=ii.find(g=>g.acquiredRound===5)!;
 // Round 7 (2-4) is a supply round: its copy waits for round 8, which has not been entered yet.
 expect(ii.filter(g=>g.acquiredRound>5).map(g=>[g.definitionId,g.acquiredRound])).toEqual([[base.definitionId,6]]);
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

it('Corrosion: every 2 seconds each enemy that started in its own front two rows loses 3 armor and 3 magic resist, once per pulse per team', ()=>{
 const s=createMatch(42),u=s.preparation.units[0];
 const units=[
  {...u,id:'p0',team:'player' as const,location:{kind:'board' as const,cell:{col:0,row:7}}},{...u,id:'p1',team:'player' as const,location:{kind:'board' as const,cell:{col:6,row:7}}},
  {...u,id:'e-front',definitionId:'garen',team:'enemy' as const,location:{kind:'board' as const,cell:{col:3,row:3}}},{...u,id:'e-back',definitionId:'garen',team:'enemy' as const,location:{kind:'board' as const,cell:{col:3,row:0}}}];
 const preparation={...s.preparation,units};
 const strategy=buildStrategySnapshot({...s,preparation,augments:[{definitionId:'corrosion',choiceId:'t',acquiredRound:1}]});
 let c=createCombatWithEvents(preparation,strategy,'corrosion',42).state;
 const pulses=(id:string)=>c.units.find(x=>x.id===id)!.mechanismState?.statuses.flatMap(g=>g.contributions).filter(x=>x.source.definitionId==='corrosion')??[];
 const frontAt=()=>c.units.filter(x=>x.team==='enemy'&&x.alive&&x.hp>0&&startingRows('enemy',x.startingCell?.row??x.cell.row)==='front-two').map(x=>x.id).sort();
 for(const pulse of [40,80]){
  while(c.tick<pulse-1)c=stepCombat(c).state;
  const before=Object.fromEntries(c.units.map(x=>[x.id,pulses(x.id).length])),eligible=frontAt();
  c=stepCombat(c).state;expect(c.tick).toBe(pulse);
  for(const x of c.units.filter(x=>x.team==='enemy'))expect(pulses(x.id).length-before[x.id]).toBe(eligible.includes(x.id)&&x.alive?2:0);
  expect(c.units.filter(x=>x.team==='player').every(x=>pulses(x.id).length===0)).toBe(true);
  for(const x of c.units.filter(x=>x.team==='enemy'))for(const p of pulses(x.id))expect([p.source.ownerId,p.application.modifier?.value]).toEqual(['p0',{kind:'constant',amount:-3}]);
 }
 expect(c.units.some(x=>pulses(x.id).length>0)).toBe(true);
});
it('Corrosion survives a real public selection, combat and strict mid-combat save/restore', ()=>{
 let seed=0;while(!firstOffers(seed).includes('corrosion'))seed++;
 let s=reachRound('2-1',false,seed);const c=s.pendingChoice!;expect(c.offers).toContain('corrosion');
 s=accept(selectChoice(s,c.choiceId,c.generation,'corrosion') as any).state as MatchState;
 const unit=s.preparation.units.find(u=>u.team==='player')!;
 s=accept(deployMatchUnit(s,unit.id,{kind:'board',cell:{col:3,row:4}}) as any).state;
 s=accept(startMatchCombat(s) as any).state;let checked=0,seen=false;
 while(s.phase==='combat'){
  s=stepMatch(s).state;
  if(s.combat&&s.combat.tick%40===1){expect(restoreMatch(serializeMatch(s))).toEqual(s);checked++;}
  seen||=!!s.combat?.units.some(u=>u.team==='enemy'&&u.mechanismState?.statuses.some(g=>g.contributions.some(x=>x.source.definitionId==='corrosion')));
 }
 expect(checked).toBeGreaterThan(0);expect(seen).toBe(true);
});

const contributions=(c:{units:readonly {id:string;mechanismState?:{statuses:readonly {contributions:readonly any[]}[]}}[]},id:string)=>c.units.flatMap(x=>(x.mechanismState?.statuses.flatMap(g=>g.contributions)??[]).filter(k=>k.source.definitionId===id).map(k=>({unit:x.id,...k})));
function combatOf(id:string,player:number,enemy:readonly string[]=['garen']){
 const s=createMatch(42),u=s.preparation.units[0];
 const units=[...Array.from({length:player},(_,i)=>({...u,id:'p'+i,team:'player' as const,location:{kind:'board' as const,cell:{col:i*2,row:7}}})),
  ...enemy.map((definitionId,i)=>({...u,id:'e'+i,definitionId,starLevel:2 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:i*2,row:0}}}))];
 const preparation={...s.preparation,units};
 return createCombatWithEvents(preparation,buildStrategySnapshot({...s,preparation,augments:[{definitionId:id,choiceId:'t',acquiredRound:1}]}),'b3-'+id,42).state;
}
it.each([['blazing-soul-i',20,2000],['blazing-soul-ii',35,3000]] as const)('%s: a 3-second +%i AP buff moves every 3 seconds to the fastest ally other than the last recipient', (id,apAmount,bps)=>{
 let c=combatOf(id,3);const seen:string[]=[];
 for(const pulse of [1,61,121]){
  while(c.tick<pulse&&c.status==='running')c=stepCombat(c).state;
  const now=contributions(c,id).filter(g=>g.appliedAtTick===pulse);
  expect(now.map(g=>[g.expiresAtTick,g.application.modifier?.stat,g.application.modifier?.value])).toEqual([[pulse+60,'abilityPower',{kind:'constant',amount:apAmount}],[pulse+60,'attackSpeed',{kind:'constant',amount:bps}]]);
  expect(new Set(now.map(g=>g.unit)).size).toBe(1);seen.push(now[0].unit);
 }
 expect(seen[0]).not.toBe(seen[1]);expect(seen[1]).not.toBe(seen[2]);
});
it('Noble Sacrifice: the first ally death gives each survivor 25 + 10% of its opening armor and magic resist, once per combat', ()=>{
 let c=combatOf('noble-sacrifice',3,['garen','garen','garen','garen']);
 const opening=Object.fromEntries(c.units.map(u=>[u.id,[u.armor,u.magicResist]]));
 let first:string|undefined;
 while(c.status==='running'&&!first){c=stepCombat(c).state;first=c.units.filter(u=>u.team==='player'&&!u.alive).map(u=>u.id).sort()[0];}
 expect(first).toBeDefined();
 const grants=contributions(c,'noble-sacrifice');
 const survivors=c.units.filter(u=>u.team==='player'&&u.alive).map(u=>u.id).sort();
 expect([...new Set(grants.map(g=>g.unit))].sort()).toEqual(survivors);
 for(const g of grants)expect(g.application.modifier?.value).toEqual({kind:'constant',amount:25+Math.floor(opening[first!][g.application.modifier?.stat==='armor'?0:1]*1000/10000)});
 while(c.status==='running')c=stepCombat(c).state;
 expect(contributions(c,'noble-sacrifice').every(g=>JSON.parse(g.key)[8].includes(first!))).toBe(true);
});
it('Wealthy Rehab: team omnivamp is declared, healing is counted into the battle fact, and the gold pays once when the total first reaches 10000', ()=>{
 const c=combatOf('wealthy-rehab-ii',2);
 for(const u of c.units.filter(u=>u.team==='player'))expect(u.mechanismDefinitions?.vamp.map(v=>v.modifier.value)).toContainEqual({kind:'constant',amount:1500});
 let s:MatchState={...createMatch(42),augments:[{definitionId:'wealthy-rehab-i',choiceId:'test',acquiredRound:1}]};
 for(const [i,heal] of [4000,5999,1,50000].entries())s=writeG23Progress({...s,round:i+1},advanceG23Economy(readG23Progress(s)!,{...fact(i+1,['pvp','win']),batch3Healing:heal}).progress);
 expect(validateBatch3Gold).toBeDefined();
 const p=readG23Progress(s)!;expect(()=>advanceG23Economy(p,{...fact(5,['pvp','win']),batch3Healing:0})).toThrow();
 const gold=withBattles('wealthy-rehab-i',[]);expect(gold.gold).toBe(createMatch(42).gold);
 const plan=(()=>{const x=drainBatch3Gold({...s,round:3});return x.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch3');})();
 expect(plan.map(r=>[r.kind,(r as any).amount,r.round])).toEqual([['gold',8,3]]);
});
it.each(['blazing-soul-i','noble-sacrifice','wealthy-rehab-ii','bad-luck-protection'])('%s: a real mid-combat save restores exactly, and edited augment runtime or contributions are rejected', id=>{
 let seed=0;while(!firstOffers(seed).includes(id))seed++;
 let s=reachRound('2-1',false,seed);const c=s.pendingChoice!;
 s=accept(selectChoice(s,c.choiceId,c.generation,id) as any).state as MatchState;
 for(const unit of s.preparation.units.filter(u=>u.team==='player').slice(0,2))s=accept(deployMatchUnit(s,unit.id,{kind:'board',cell:{col:unit===s.preparation.units.find(u=>u.team==='player')?3:5,row:4}}) as any).state;
 s=accept(startMatchCombat(s) as any).state;let checked=0,tampered=0;
 while(s.phase==='combat'){
  s=stepMatch(s).state;if(!s.combat||s.combat.tick%30!==2)continue;
  expect(restoreMatch(serializeMatch(s))).toEqual(s);checked++;
  const edit=structuredClone(s) as any,unit=edit.combat.units.find((u:any)=>u.mechanismState?.statuses.some((g:any)=>g.contributions.some((k:any)=>k.source.sourceKind==='augment')));
  if(unit){const k=unit.mechanismState.statuses.flatMap((g:any)=>g.contributions).find((k:any)=>k.source.sourceKind==='augment');if(k.application.modifier)k.application.modifier.value.amount+=1;else k.appliedAtTick+=1;expect(()=>restoreMatch(serializeMatch(edit))).toThrow();tampered++;}
  const runtime=structuredClone(s) as any,owner=runtime.combat.units.find((u:any)=>u.team==='player');owner.batch2={...owner.batch2,healed:(owner.batch2?.healed??0)+7,blazingLast:'nobody'};
  expect(()=>restoreMatch(serializeMatch(runtime))).toThrow();
 }
 expect(checked).toBeGreaterThan(0);if(id==='blazing-soul-i')expect(tampered).toBeGreaterThan(0);
});
it('Noble Sacrifice grants from a real ally death restore exactly, and an edited grant amount is rejected', ()=>{
 let found=false;
 for(let seed=0;seed<3000&&!found;seed++){
  if(!firstOffers(seed).includes('noble-sacrifice'))continue;
  let s:MatchState;try{s=reachRound('2-1',false,seed);}catch{continue;}const c=s.pendingChoice!;if(!c.offers.includes('noble-sacrifice'))continue;
  const chosen=selectChoice(s,c.choiceId,c.generation,'noble-sacrifice') as any;if(!chosen.ok)continue;s=chosen.state;
  let placed=s,count=0;
  for(let i=0;i<3;i++){const r=buyXp(placed) as any;if(r.ok)placed=r.state;}
  for(let slot=0;slot<placed.shop.slots.length&&placed.preparation.units.filter(u=>u.team==='player').length<4;slot++){const r=buyUnit(placed,slot,placed.shop.generation) as any;if(r.ok)placed=r.state;}
  for(const unit of placed.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench'))for(let row=4;row<=7&&count<3;row++)for(let col=0;col<7;col++){if(placed.preparation.units.some(u=>u.location.kind==='board'&&u.location.cell.col===col&&u.location.cell.row===row))continue;const r=deployMatchUnit(placed,unit.id,{kind:'board',cell:{col,row}}) as any;if(r.ok){placed=r.state;count++;row=99;break;}}
  count+=placed.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board').length-count;
  if(count<2)continue;
  const started=startMatchCombat(placed) as any;if(!started.ok)continue;s=started.state;
  while(s.phase==='combat'&&!found){
   s=stepMatch(s).state;const grants=s.combat?contributions(s.combat as any,'noble-sacrifice'):[];
   if(!grants.length)continue;found=true;
   expect(restoreMatch(serializeMatch(s))).toEqual(s);
   const edit=structuredClone(s) as any;const k=edit.combat.units.flatMap((u:any)=>u.mechanismState?.statuses.flatMap((g:any)=>g.contributions)??[]).find((k:any)=>k.source.definitionId==='noble-sacrifice');
   k.application.modifier.value.amount+=1;expect(()=>restoreMatch(serializeMatch(edit))).toThrow();
  }
 }
 expect(found).toBe(true);
},600000);

it('Bad Luck Protection: the team never deals a critical hit and gains 1% AD per 1% crit chance; RNG consumption is unchanged', ()=>{
 const run=(augments:string[])=>{
  const m=createMatch(42),u=m.preparation.units[0];
  const units=[...[0,1,2].map(i=>({...u,id:'p'+i,team:'player' as const,location:{kind:'board' as const,cell:{col:i*2,row:7}}})),
   ...[0,1].map(i=>({...u,id:'e'+i,definitionId:'garen',starLevel:2 as const,team:'enemy' as const,location:{kind:'board' as const,cell:{col:i*2,row:0}}}))];
  const preparation={...m.preparation,units};
  let c=createCombatWithEvents(preparation,buildStrategySnapshot({...m,preparation,augments:augments.map(definitionId=>({definitionId,choiceId:'t',acquiredRound:1}))}),'b3-luck',42).state;
  const crits:boolean[]=[];const p0=c.units.find(u=>u.id==='p0')! as any;const adAt0=ad(p0),chance=spellCrit(p0).chanceBps;
  while(c.status==='running'){const step=stepCombat(c);c=step.state;for(const e of step.events as any[])if(e.type==='packetDamage'&&e.outcome.context.source.ownerId.startsWith('p'))crits.push(e.outcome.critical);}
  return {crits,adAt0,chance};
 };
 const plain=run([]),lucky=run(['bad-luck-protection']);
 expect(plain.crits.some(Boolean)).toBe(true);expect(lucky.crits.length).toBeGreaterThan(0);expect(lucky.crits.some(Boolean)).toBe(false);
 expect(lucky.chance).toBe(plain.chance);expect(lucky.chance).toBeGreaterThan(0);
 expect(lucky.adAt0).toBe(Math.floor(plain.adAt0*(10000+lucky.chance)/10000));
 const gifted=drainBatch1Gifts({...createMatch(42),augments:[{definitionId:'bad-luck-protection',choiceId:'test',acquiredRound:1}]});
 expect(gifted.items.filter(i=>i.definitionId==='gloves').length-createMatch(42).items.filter(i=>i.definitionId==='gloves').length).toBe(1);
});

it('P: round-entry champions never arrive on a supply (carousel) round; that copy waits for the next round entry', ()=>{
 expect(getMultiplayerRoundByOrdinal(7).kind).toBe('supply');
 const gold=batch1GiftPlan(at('worth-the-wait',5,9)).filter(g=>g.acquiredRound>5);
 expect(gold.map(g=>g.acquiredRound)).toEqual([8,8,9]);expect(new Set(gold.map(g=>g.receiptId)).size).toBe(3);
 expect(batch1GiftPlan(at('worth-the-wait',5,7)).filter(g=>g.acquiredRound>5)).toEqual([]);
 expect(batch1GiftPlan(at('worth-the-wait-ii',6,8)).filter(g=>g.acquiredRound>6).map(g=>g.acquiredRound)).toEqual([8,8]);
 // Items are not champions and still arrive on the supply round itself.
 expect(batch3RewardPlan(at('building-a-collection-iii',5,8)).map(g=>g.acquiredRound)).toEqual([6,7,8]);
});
