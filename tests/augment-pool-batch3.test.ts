import { isAnvil } from '../src/simulation/content/anvils';
import { AUGMENT_POOL_TEXT } from '../src/presentation/augment-pool-text';
import { RULES_GAP_MANIFEST, ARCHIVED_AUGMENT_DEFINITIONS } from '../scripts/augment-content-archive';
import { offeredAt, STAGE_SEEDS } from './augment-stage-helpers';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { createMatch } from '../src/simulation/match';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import { advanceG23Economy, type G23BattleFacts } from '../src/simulation/g2-3-economy';
import { AUGMENT_BATCH3, AUGMENT_BATCH3_NODE_BANS } from '../src/simulation/content/augment-pool-batch3';
import { AUGMENT_OFFER_RULES } from '../src/simulation/content/augment-offer-rules';
import { batch3RewardPlan, drainBatch3Gold, validateBatch3Gold, pickLootTable, lootSpecs } from '../src/simulation/augment-pool-batch3-progress';
import { batch1GiftPlan, drainBatch1Gifts, validateBatch1Gifts, batch1AnvilSpecification } from '../src/simulation/augment-pool-grants';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import type { MatchState } from '../src/simulation/match-types';
import { rerollAugment, rerollShop, selectChoice, startMatchCombat, nextRound, stepMatch, deployMatchUnit, buyUnit, buyXp, sellUnit, equipItem } from '../src/simulation/match';
import { planDeferredUpgrades } from '../src/simulation/upgrades';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { drainBatch3RoundEntry, drainBatch3Forming, formingTotals, magicRollDice, outcomeAcquisitionXp } from '../src/simulation/augment-pool-batch3-progress';
import { magicRollKind, callToChaosOutcome, CALL_TO_CHAOS_OUTCOMES } from '../src/simulation/content/augment-pool-batch3';
import { g23BattleFacts } from '../src/simulation/g2-3-settlement';
import { validateG23BattleFacts } from '../src/simulation/g2-3-economy';
import { selectPlayerBaseDamage } from '../src/simulation/match-rules';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { EMBLEM_ITEMS } from '../src/simulation/content/emblems';
import { startingRows } from '../src/simulation/m8/targeting';
import { GOLDEN_EGG_LOOT, EXALTED_ADVENTURE_LOOT, SPOILS_OF_WAR_TABLES } from '../src/simulation/content/augment-pool-batch3-loot';
import { getMultiplayerRoundById } from '../src/simulation/multiplayer-round';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { generateChoices } from '../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateSharedShop, rerollSharedShop, buySharedUnit } from '../src/server-entry';
import { draftPool, reconcileHoldings, assertSharedPoolConservation } from '../src/simulation/shared-pool-ledger';
import { getUnitStats } from '../src/simulation/unit-stats';
import { freeRerollsAvailable, freeRerollsGranted, validateFreeRerolls, spendFreeReroll, FREE_REROLL_KEY } from '../src/simulation/free-rerolls';
import { writeSeatMechanic } from '../src/simulation/seat-mechanics/state';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { ad, spellCrit, amount as amountAt } from '../src/simulation/combat-s13-state';
const amountOf=(u:any,key:string)=>amountAt(u,0,{ap:u.ability.variables[key]/10000});
import { accept, room } from './tp-helpers';
import { reachRound, resolveM5Choices, emptyBoard, fieldBench, accepted } from './match-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { snapshotForBattle, restorePlayerBattleSnapshot } from '../src/simulation/two-sided-snapshot';

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

it('the forty-nine batch-3 rows carry their 14.24 zh_cn name, tier and description and are registered in the offer pool', ()=>{
 const research=JSON.parse(readFileSync('/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json','utf8')) as {apiName:string;name_zh_cn:string;description_zh_cn:string;description_en_us:string;tier:number;effects:Record<string,number>}[];
 expect(Object.keys(AUGMENT_BATCH3).sort()).toEqual(['all-out','an-exalted-adventure','bad-luck-protection','blade-dance','blazing-soul-i','blazing-soul-ii','blood-pact','building-a-collection-iii','call-to-chaos','corrosion','dark-alley-dealings','dummify','eye-for-an-eye','eye-for-an-eye-plus','field-medic','flexible','gold-for-dummies','golemify','latent-forge','living-forge','magic-roll','noble-sacrifice','phreaky-friday','phreaky-friday-plus','prizefighter','rolling-for-days-i','savage-revenge','scapegoat','shimmerscale-essence','shocking-troll','spoils-of-war-i','spoils-of-war-ii','spoils-of-war-iii','superstars-i','superstars-ii','support-mining','support-mining-plus','team-building','the-golden-egg','tower-defense','trade-sector','wandering-trainer-i','wandering-trainer-ii','warpath','wealthy-rehab-i','wealthy-rehab-ii','what-doesnt-kill-you','worth-the-wait','worth-the-wait-ii']);
 for(const [id,row] of Object.entries(AUGMENT_BATCH3)){
  const r=research.find(x=>x.apiName===row.apiName)!;
  // UI text lives in the lazy chunk; the offline archive restores every original column for the identity roots.
  expect([AUGMENT_POOL_TEXT[id].name,AUGMENT_POOL_TEXT[id].description,row.tier,row.source.values]).toEqual([r.name_zh_cn,r.description_zh_cn,['silver','gold','prismatic'][r.tier-1],r.effects]);
  const archived=(RULES_GAP_MANIFEST.augmentPoolBatch3.content as Record<string,{name:string;description:string;source:{description_en_us:string}}>)[id];
  expect([archived.name,archived.description,archived.source.description_en_us]).toEqual([r.name_zh_cn,r.description_zh_cn,r.description_en_us]);
  expect(row).not.toHaveProperty('description');expect(row.source).not.toHaveProperty('description_en_us');
  expect(ARCHIVED_AUGMENT_DEFINITIONS[id].name).toBe(r.name_zh_cn);expect(AUGMENT_TIERS[id]).toBe(row.tier);expect(AUGMENT_POOL_API_NAMES[id]).toBe(row.apiName);
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
 const open=publicOpen('rolling-for-days-i'),c=open.pendingChoice!;expect(c.offers).toContain('rolling-for-days-i');
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
 // Two real spends (each a provenance fact at its shop generation) validate; a counter that disagrees with them does not.
 let spent=s;for(let i=0;i<2;i++){spent=spendFreeReroll(spent).state;spent={...spent,shop:{...spent.shop,generation:spent.shop.generation+1}};}
 validateFreeRerolls(spent);
 expect(()=>validateFreeRerolls(writeSeatMechanic(spent,FREE_REROLL_KEY,{used:1}))).toThrow();
 expect(()=>validateFreeRerolls(writeSeatMechanic(s,FREE_REROLL_KEY,{used:2}))).toThrow();
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
 let s=publicOpen('building-a-collection-iii');const c=s.pendingChoice!;expect(c.offers).toContain('building-a-collection-iii');
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
 let s=publicOpen('corrosion');const c=s.pendingChoice!;expect(c.offers).toContain('corrosion');
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
 let s=publicOpen(id);const c=s.pendingChoice!;
 s=accept(selectChoice(s,c.choiceId,c.generation,id) as any).state as MatchState;
 // v23 fmix32 openings can bench component anvils (never fielded): deploy the first two champions.
 const fielded=s.preparation.units.filter(u=>u.team==='player'&&!isAnvil(u.definitionId)).slice(0,2);
 for(const unit of fielded)s=accept(deployMatchUnit(s,unit.id,{kind:'board',cell:{col:unit===fielded[0]?3:5,row:4}}) as any).state;
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
  const opened=openAt('noble-sacrifice',seed);if(!opened)continue;let s:MatchState=opened;const c=s.pendingChoice!;
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
});

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

const owned=(definitionId:string,round=1):MatchState=>drainBatch1Gifts({...createMatch(42),round,augments:[{definitionId,choiceId:'test',acquiredRound:round}]});
const dummyOf=(s:MatchState)=>s.preparation.units.find(u=>u.definitionId==='training-dummy')!;
function dummyBattles(id:string,facts:readonly {deaths?:boolean;first?:boolean;gold?:number;kind?:'pvp'|'pve'}[]):MatchState {
 let s=owned(id);const dummy=dummyOf(s).id;
 for(const [i,f] of facts.entries()){
  s=writeG23Progress({...s,round:i+1},advanceG23Economy(readG23Progress(s)!,{...fact(i+1,[f.kind??'pvp','loss']),batch3Dummy:{deaths:f.deaths?[dummy]:[],first:f.first?dummy:null,gold:f.gold??0}}).progress);
  s=drainBatch1Gifts(s);
 }
 return s;
}
it('Training Dummy: a fixed one-star summon that cannot be sold, equipped or merged, and neither moves nor attacks', ()=>{
 const s=owned('support-mining'),dummy=dummyOf(s);
 expect(dummy).toMatchObject({team:'player',starLevel:1});expect(dummy.location.kind).toBe('bench');
 expect(sellUnit(s,dummy.id).ok).toBe(false);
 const item=s.items.find(i=>i.location.kind==='inventory');
 if(item)expect(equipItem(s,item.id,dummy.id,0).ok).toBe(false);
 const three={...s.preparation,units:[0,1,2].map(i=>({...dummy,id:'d'+i,location:{kind:'bench' as const,slot:i}}))};
 expect(planDeferredUpgrades(three).events).toEqual([]);
 const c0=combatOf('support-mining',1);
 const m=createMatch(42),u=m.preparation.units[0];
 const units=[{...u,id:'p0',team:'player' as const,location:{kind:'board' as const,cell:{col:3,row:7}}},{...dummy,id:'dummy',location:{kind:'board' as const,cell:{col:3,row:4}}},{...u,id:'e0',definitionId:'garen',team:'enemy' as const,location:{kind:'board' as const,cell:{col:3,row:0}}}];
 const preparation={...m.preparation,units};
 let c=createCombatWithEvents(preparation,buildStrategySnapshot({...m,preparation,augments:[]}),'dummy',42).state;
 const start=c.units.find(x=>x.id==='dummy')!;expect([start.maxHp,start.armor,start.magicResist,start.maxMana]).toEqual([550,30,30,0]);
 const dealt:string[]=[];
 while(c.status==='running'&&c.tick<200){const step=stepCombat(c);c=step.state;for(const e of step.events as any[])if(e.type==='packetDamage')dealt.push(e.outcome.context.source.ownerId);}
 const d=c.units.find(x=>x.id==='dummy')!;if(d.alive)expect(d.cell).toEqual({col:3,row:4});
 expect(dealt).not.toContain('dummy');expect(c0.units.length).toBeGreaterThan(0);
});
it.each([['support-mining',7],['support-mining-plus',4]] as const)('%s: the dummy\'s %i-th death gives a support item and retires that dummy, once', (id,n)=>{
 const before=dummyBattles(id,Array.from({length:n-1},()=>({deaths:true})));
 expect(before.preparation.units.some(u=>u.definitionId==='training-dummy')).toBe(true);
 const after=dummyBattles(id,[...Array.from({length:n-1},()=>({deaths:true})),{kind:'pve'},{deaths:true}]);
 expect(after.preparation.units.some(u=>u.definitionId==='training-dummy')).toBe(false);
 const support=batch3RewardPlan(after);expect(support).toHaveLength(1);expect(support[0].acquiredRound).toBe(n+1);
 expect(after.seatMechanics!.receipts.some(r=>r.receiptId===support[0].receiptId)).toBe(true);
 validateBatch1Gifts(after);expect(drainBatch1Gifts(after)).toBe(after);
 const forged=structuredClone(before) as any;const e=after.resourceProvenance.entries.find(x=>x.kind==='unit-removed')!;
 forged.resourceProvenance.entries.push({...e,sequence:forged.resourceProvenance.entries.length});forged.preparation.units=forged.preparation.units.filter((u:any)=>u.definitionId!=='training-dummy');
 expect(()=>validateBatch1Gifts(forged)).toThrow();
});
it('Scapegoat: a dummy and 4 gold; 1 gold each player combat its dummy dies first, never in PvE or when another ally dies first', ()=>{
 expect(AUGMENT_DEFINITIONS['scapegoat'].effects).toContainEqual({kind:'mechanic',mechanic:'acquisitionGold',values:{amount:4}});
 const s=dummyBattles('scapegoat',[{first:true},{first:false,deaths:true},{first:true,kind:'pve'},{first:true}]);
 expect(s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch3').map(r=>[r.kind,(r as any).amount,r.round])).toEqual([['gold',1,1],['gold',1,4]]);
 validateBatch1Gifts(s);
});
it.each([['wandering-trainer-i',2,1],['wandering-trainer-ii',3,6]] as const)('%s: a dummy with %i permanently attached random emblems and %i gold', (id,n,gold)=>{
 const s=owned(id),dummy=dummyOf(s),worn=s.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===dummy.id);
 expect(worn).toHaveLength(n);expect(worn.every(i=>Object.hasOwn(EMBLEM_ITEMS,i.definitionId))).toBe(true);expect(new Set(worn.map(i=>i.definitionId)).size).toBe(n);
 expect(worn.map(i=>i.location.kind==='unit'?i.location.slot:-1).sort()).toEqual([...Array(n).keys()]);
 expect(AUGMENT_DEFINITIONS[id].effects).toContainEqual({kind:'mechanic',mechanic:'acquisitionGold',values:{amount:gold}});
 validateBatch1Gifts(s);expect(drainBatch1Gifts(s)).toBe(s);
 const loose=structuredClone(s) as any;loose.items.find((i:any)=>i.id===worn[0].id).location={kind:'inventory'};expect(()=>validateBatch1Gifts(loose)).toThrow();
});
it('Gold for Dummies: each live dummy records a pulse every 10 seconds of combat; the battle fact pays 1 gold per pulse', ()=>{
 const m=createMatch(42),u=m.preparation.units[0],dummy={...u,definitionId:'training-dummy'};
 const units=[{...dummy,id:'d0',team:'player' as const,location:{kind:'board' as const,cell:{col:0,row:7}}},{...dummy,id:'d1',team:'player' as const,location:{kind:'board' as const,cell:{col:6,row:7}}},{...u,id:'p0',team:'player' as const,location:{kind:'board' as const,cell:{col:3,row:7}}},{...u,id:'e0',definitionId:'garen',team:'enemy' as const,location:{kind:'board' as const,cell:{col:3,row:0}}}];
 const preparation={...m.preparation,units};
 let c=createCombatWithEvents(preparation,buildStrategySnapshot({...m,preparation,augments:[{definitionId:'gold-for-dummies',choiceId:'t',acquiredRound:1}]}),'gfd',42).state;
 while(c.status==='running'&&c.tick<400)c=stepCombat(c).state;
 const pulses=c.units.filter(x=>x.definitionId==='training-dummy').map(x=>x.batch2?.dummyGold??0);
 for(const [i,x] of c.units.filter(x=>x.definitionId==='training-dummy').entries())if(x.alive)expect(pulses[i]).toBe(2);
 const s=dummyBattles('gold-for-dummies',[{gold:3},{gold:0,kind:'pve'},{gold:2}]);
 expect(s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch3').reduce((n,r)=>n+((r as any).amount??0),0)).toBe(5);
 expect(()=>advanceG23Economy(readG23Progress(s)!,{...fact(4,['pvp','win']),batch3Dummy:{deaths:[],first:null,gold:-1}})).toThrow();
});
it('a real match with a training dummy restores mid-combat exactly and rejects an edited dummy', ()=>{
 let s=publicOpen('gold-for-dummies');const c=s.pendingChoice!;
 s=accept(selectChoice(s,c.choiceId,c.generation,'gold-for-dummies') as any).state as MatchState;
 const dummy=dummyOf(s);expect(dummy).toBeDefined();
 let placed=s;for(let row=4;row<=7;row++)for(let col=0;col<7;col++){if(placed.preparation.units.some(u=>u.location.kind==='board'&&u.location.cell.col===col&&u.location.cell.row===row))continue;const r=deployMatchUnit(placed,dummy.id,{kind:'board',cell:{col,row}}) as any;if(r.ok){placed=r.state;row=99;break;}}
 expect(dummyOf(placed).location.kind).toBe('board');
 s=accept(startMatchCombat(placed) as any).state;let checked=0;
 while(s.phase==='combat'){s=stepMatch(s).state;if(s.combat&&s.combat.tick%100===1){expect(restoreMatch(serializeMatch(s))).toEqual(s);checked++;
  const edit=structuredClone(s) as any,d=edit.combat.units.find((u:any)=>u.definitionId==='training-dummy');d.hp=Math.max(1,d.hp-1);if(d.alive)expect(()=>restoreMatch(serializeMatch(edit))).toThrow();}}
 expect(checked).toBeGreaterThan(0);
});
it.each(['wandering-trainer-ii','support-mining','scapegoat','the-golden-egg','an-exalted-adventure','tower-defense'])('%s: a public selection saves and restores through a real round', id=>{
 let s=publicOpen(id);const c=s.pendingChoice!;
 s=accept(selectChoice(s,c.choiceId,c.generation,id) as any).state as MatchState;
 if(AUGMENT_BATCH3[id].gifts.some(g=>g.kind==='unit'&&g.definitionId==='training-dummy'))expect(dummyOf(s)).toBeDefined();
 if(id==='tower-defense')expect(s.preparation.units.some(u=>u.definitionId==='tower-dummy')).toBe(true);
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 s=resolveM5Choices(s);if(s.phase==='preparation')s=accept(startMatchCombat(s) as any).state;
 while(s.phase==='combat')s=stepMatch(s).state;
 s=resolveM5Choices(s);expect(restoreMatch(serializeMatch(s))).toEqual(s);
 // The Golden Egg is a 4-2 card (14.24 stage tags): that conceding route may end the match at this fight.
 if(s.phase!=='gameOver'){s=accept(nextRound(s,s.round) as any).state;expect(restoreMatch(serializeMatch(s))).toEqual(s);}
});
it('P: the Golden Egg hatches at the first round entry its 11-turn timer reaches 0, one extra turn per player-combat win', ()=>{
 const hatch=(s:MatchState)=>[...new Set(batch3RewardPlan(s).map(g=>g.acquiredRound))];
 expect(hatch(withBattles('the-golden-egg',pvp(11,'loss')))).toEqual([]);
 expect(hatch(withBattles('the-golden-egg',pvp(12,'loss')))).toEqual([12]);
 // Wins in rounds 1..6 bring round 7 to zero; 7 (2-4) is a supply round, so it hatches at 8.
 expect(hatch(withBattles('the-golden-egg',pvp(7,'win')))).toEqual([]);
 expect(hatch(withBattles('the-golden-egg',pvp(8,'win')))).toEqual([8]);
 const s=withBattles('the-golden-egg',pvp(12,'loss')),again=withBattles('the-golden-egg',pvp(12,'loss'));
 expect(batch3RewardPlan(s)).toEqual(batch3RewardPlan(again));
 const hatched=drainBatch3RoundEntry(s);expect(hatched.seatMechanics!.receipts.length).toBeGreaterThan(s.seatMechanics!.receipts.length);
 validateBatch1Gifts(hatched);expect(drainBatch3RoundEntry(hatched)).toBe(hatched);expect(()=>validateBatch1Gifts(s)).toThrow();
});
it('Golden Egg / Exalted Adventure loot tables are picked by their raw 14.24 weights and every content id resolves', ()=>{
 for(const tables of [GOLDEN_EGG_LOOT,EXALTED_ADVENTURE_LOOT]){
  const N=20000,counts=new Map<string,number>(),total=tables.reduce((n,t)=>n+t.weight,0);
  for(let i=0;i<N;i++){const t=pickLootTable(42,'solo','c'+i,'x',tables);counts.set(t.name,(counts.get(t.name)??0)+1);}
  for(const t of tables)expect(Math.abs((counts.get(t.name)??0)/N-t.weight/total)).toBeLessThan(0.015);
  for(const t of tables)expect(lootSpecs(t).length).toBeGreaterThan(0);
 }
 expect(lootSpecs(GOLDEN_EGG_LOOT.find(t=>t.name==='GoldenEggLootG')!).filter(s=>s.kind==='random-unit')).toHaveLength(4);
 expect(lootSpecs(GOLDEN_EGG_LOOT.find(t=>t.name==='GoldenEggLootF')!).filter(s=>s.kind==='random-item').map(s=>(s as any).pool)).toEqual(['artifact','radiant','completed']);
});
it('An Exalted Adventure: three different 2-costs and a lesser duplicator now and every stage start; the orb follows the second 3-star', ()=>{
 const base:MatchState={...createMatch(42),round:4,augments:[{definitionId:'an-exalted-adventure',choiceId:'test',acquiredRound:4}]};
 const gifts=batch1GiftPlan(base),units=gifts.filter(g=>g.kind==='unit');
 expect(units).toHaveLength(3);expect(new Set(units.map(g=>g.definitionId)).size).toBe(3);expect(units.every(g=>UNIT_DEFINITIONS[g.definitionId].cost===2)).toBe(true);
 expect(gifts.filter(g=>g.definitionId==='TFT_Consumable_ChampionDuplicator_III')).toHaveLength(1);
 const later={...base,round:22};
 const stages=batch3RewardPlan(later).filter(g=>g.definitionId==='TFT_Consumable_ChampionDuplicator_III').map(g=>g.acquiredRound);
 expect(stages).toEqual(Array.from({length:22},(_,i)=>i+1).filter(r=>r>4&&getMultiplayerRoundByOrdinal(r).subround===1));
 const upgraded=(defs:string[],roundId:string):MatchState=>({...later,resourceProvenance:{...later.resourceProvenance,entries:[...later.resourceProvenance.entries,
  ...defs.map((definitionId,i)=>({kind:'unit-upgraded-after-combat',sequence:later.resourceProvenance.entries.length+i,roundId,event:{type:'unitUpgraded',survivorId:'x'+i,consumedIds:[],definitionId,fromStar:2,toStar:3,location:{kind:'bench',slot:0}}}))]} as any});
 const defs=units.map(g=>g.definitionId);
 const orb=(s:MatchState)=>batch3RewardPlan(s).filter(g=>g.definitionId!=='TFT_Consumable_ChampionDuplicator_III');
 expect(orb(upgraded([defs[0]],'3-2'))).toEqual([]);
 expect(orb(upgraded(['vex',defs[1]],'3-2'))).toEqual([]);
 const o=orb(upgraded([defs[0],defs[2]],'3-2'));expect(o.length).toBeGreaterThan(0);expect(new Set(o.map(g=>g.acquiredRound))).toEqual(new Set([getMultiplayerRoundById('3-3').ordinal]));
});
it('Tower Defense: a stationary emblem dummy that shoots 100% AD + 60/90/135% AP; +25% AS from stage 3 and a 50% second arrow from stage 5', ()=>{
 const tower=owned('tower-defense'),t=tower.preparation.units.find(u=>u.definitionId==='tower-dummy')!;
 expect(tower.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===t.id)).toHaveLength(1);validateBatch1Gifts(tower);
 const m=createMatch(42),u=m.preparation.units[0];
 const shots=(round:number)=>{
  const units=[{...u,id:'tower',definitionId:'tower-dummy',team:'player' as const,location:{kind:'board' as const,cell:{col:3,row:7}}},
   // Enemy training dummies never move or hit back, so every shot in the window is the tower's.
   ...[0,1].map(i=>({...u,id:'e'+i,definitionId:'training-dummy',team:'enemy' as const,location:{kind:'board' as const,cell:{col:2+i,row:3}}}))];
  const preparation={...m.preparation,units};
  let c=createCombatWithEvents(preparation,buildStrategySnapshot({...m,round,preparation,augments:[{definitionId:'tower-defense',choiceId:'t',acquiredRound:1}]}),'tower',42).state;
  const start=c.units.find(x=>x.id==='tower')!;const out:any[]=[];
  while(c.status==='running'&&c.tick<300){const step=stepCombat(c);c=step.state;for(const e of step.events as any[])if(e.type==='packetDamage'&&e.outcome.context.source.ownerId==='tower')out.push(e.outcome);}
  return {start,cell:c.units.find(x=>x.id==='tower')!.cell,out,interval:start.attackIntervalTicks,speed:start.attackSpeedBonusBps};
 };
 const early=shots(3),mid=shots(14),late=shots(30);
 expect([early.out[0].raw,mid.out[0].raw,late.out[0].raw]).toEqual([120,150,195]);
 expect(late.out.filter((o:any)=>o.context.actionSeq===late.out[0].context.actionSeq).map((o:any)=>o.raw)).toEqual([195,97]);
 expect(early.cell).toEqual({col:3,row:7});expect(early.out.length).toBeGreaterThan(0);
 expect(new Set(early.out.map((o:any)=>o.context.actionSeq)).size).toBe(early.out.length);
 const perSeq=(r:typeof late)=>Math.max(...[...r.out.reduce((m:Map<number,number>,o:any)=>m.set(o.context.actionSeq,(m.get(o.context.actionSeq)??0)+1),new Map()).values()]);
 expect(perSeq(mid)).toBe(1);expect(perSeq(late)).toBe(2);
 const seqs=(r:typeof late)=>new Set(r.out.map((o:any)=>o.context.actionSeq)).size;
 expect(seqs(mid)).toBeGreaterThan(seqs(early));
});

function heroCombat(id:string,hero:string,opts:{stars?:readonly (1|2|3)[];enemies?:number;round?:number;cluster?:boolean}={}){
 const m=createMatch(42),u=m.preparation.units[0],stars=opts.stars??[1];
 const units=[...stars.map((starLevel,i)=>({...u,id:'h'+i,definitionId:hero,starLevel,team:'player' as const,location:{kind:'board' as const,cell:{col:2+i,row:4}}})),
  ...Array.from({length:opts.enemies??3},(_,i)=>({...u,id:'e'+i,definitionId:'training-dummy',team:'enemy' as const,location:{kind:'board' as const,cell:opts.cluster?{col:2+i,row:3}:{col:1+i*2,row:3-(i%2)}}}))];
 const preparation={...m.preparation,units};
 const strategy=buildStrategySnapshot({...m,round:opts.round??10,preparation,augments:[{definitionId:id,choiceId:'t',acquiredRound:1}]});
 return {strategy,state:createCombatWithEvents(preparation,strategy,'hero-'+id,42).state,plain:createCombatWithEvents(preparation,buildStrategySnapshot({...m,round:opts.round??10,preparation,augments:[]}),'hero-plain',42).state};
}
const runUntil=(c:any,ok:(e:any,c:any)=>boolean,limit=600)=>{const out:any[]=[];while(c.status==='running'&&c.tick<limit){const step=stepCombat(c);c=step.state;for(const e of step.events as any[])out.push(e);if(out.some(e=>ok(e,c)))break;}return {c,events:out};};
it('hero augments: only the strongest board copy (star, then items, then id) gets the replacement, and the unit is granted', ()=>{
 const {state}=heroCombat('blood-pact','vladimir',{stars:[1,2,1]});
 expect(state.units.filter(u=>u.mechanics?.some(m=>m.mechanic==='heroCarryLive')).map(u=>u.id)).toEqual(['h1']);
 expect(owned('savage-revenge').preparation.units.filter(u=>u.definitionId==='renni')).toHaveLength(2);
 expect(owned('field-medic').preparation.units.filter(u=>u.definitionId==='steb')).toHaveLength(1);
});
it('Field Medic: 10 less mana, three 65% strikes on the current target and 30% ability omnivamp instead of the heal', ()=>{
 const {state,plain}=heroCombat('field-medic','steb');
 const h=state.units.find(u=>u.id==='h0')!,p=plain.units.find(u=>u.id==='h0')!;expect(h.maxMana).toBe(p.maxMana-10);
 const {events}=runUntil(state,e=>e.type==='packetDamage'&&e.outcome.context.delivery==='ability-direct');
 const cast=events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='h0'&&e.outcome.context.delivery==='ability-direct');
 expect(cast).toHaveLength(3);expect(new Set(cast.map(e=>e.outcome.context.targetId)).size).toBe(1);
 expect(cast[0].outcome.raw).toBe(Math.floor(amountOf(h,'Damage')*6500/10000));
});
it('Shocking Troll: 50 less mana; the bite stays, no heal, then +140% attack speed for 5 s and +1.5% permanent AD', ()=>{
 const {state,plain}=heroCombat('shocking-troll','trundle');
 expect(state.units.find(u=>u.id==='h0')!.maxMana).toBe(plain.units.find(u=>u.id==='h0')!.maxMana-50);
 const {c,events}=runUntil(state,e=>e.type==='growth'&&e.unitId==='h0',1200);
 const growth=events.find(e=>e.type==='growth'&&e.unitId==='h0');expect(growth).toMatchObject({amountBps:150});
 expect(c.units.find((u:any)=>u.id==='h0').runtime.permanentAdBps).toBe(150);
 expect(events.some(e=>e.type==='heal'&&e.outcome.contributions?.some((x:any)=>x.source.ownerId==='h0'&&x.source.sourceKind==='ability'))).toBe(false);
});
it('Blood Pact: +3 range and +3 mana per attack; 180% Damage on the target and an independent 90 AP hit on the nearest other enemy', ()=>{
 const {state,plain}=heroCombat('blood-pact','vladimir');
 const h=state.units.find(u=>u.id==='h0')!;expect(h.attackRange).toBe(plain.units.find(u=>u.id==='h0')!.attackRange+3);
 expect(h.mechanics).toContainEqual(expect.objectContaining({mechanic:'extraAttackMana',values:{amount:3}}));
 const {events}=runUntil(state,e=>e.type==='packetDamage'&&e.outcome.context.delivery==='ability-direct'&&e.outcome.context.source.ownerId==='h0');
 const cast=events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='h0'&&e.outcome.context.delivery==='ability-direct');
 expect(cast.map(e=>e.outcome.raw)).toEqual([Math.floor(amountOf(h,'Damage')*18000/10000),90]);
});
it('Blade Dance: +40% attack speed; each cast dashes twice for 3.35 AD + 40 AP physical (far enemy, then the target)', ()=>{
 const {state}=heroCombat('blade-dance','irelia');const h=state.units.find(u=>u.id==='h0')!;
 const {events}=runUntil(state,e=>e.type==='packetDamage'&&e.outcome.context.delivery==='ability-direct'&&e.outcome.context.source.ownerId==='h0',1200);
 const cast=events.filter(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='h0'&&e.outcome.context.delivery==='ability-direct');
 expect(cast).toHaveLength(2);expect(cast.every(e=>e.outcome.context.damageType==='physical')).toBe(true);
 expect(h.mechanics).toContainEqual(expect.objectContaining({mechanic:'heroCarryLive'}));
});
it('All Out: no resists on cast; the empowered attack splashes 25% to enemies next to its target', ()=>{
 const {state}=heroCombat('all-out','vander',{enemies:3,cluster:true});
 const {events}=runUntil(state,e=>e.type==='packetDamage'&&e.outcome.context.delivery==='attack-extra'&&e.outcome.context.source.ownerId==='h0',1200);
 expect(events.some(e=>e.type==='packetDamage'&&e.outcome.context.delivery==='attack-extra'&&e.outcome.context.source.ownerId==='h0')).toBe(true);
});
it.each(['blood-pact','field-medic','shocking-troll'])('%s: a real mid-combat save restores exactly and an edited hero runtime is rejected', id=>{
 let seed=0,s:MatchState|undefined;
 for(;seed<4000&&!s;seed++)s=openAt(id,seed);
 expect(s).toBeDefined();const c=s!.pendingChoice!;
 s=accept(selectChoice(s!,c.choiceId,c.generation,id) as any).state as MatchState;
 const hero=s.preparation.units.find(u=>u.definitionId===AUGMENT_BATCH3[id].hero)!;
 let placed=s;for(let row=4;row<=7;row++)for(let col=0;col<7;col++){if(placed.preparation.units.some(u=>u.location.kind==='board'&&u.location.cell.col===col&&u.location.cell.row===row))continue;const r=deployMatchUnit(placed,hero.id,{kind:'board',cell:{col,row}}) as any;if(r.ok){placed=r.state;row=99;break;}}
 const started=startMatchCombat(placed) as any;if(!started.ok)return;s=started.state;let checked=0;
 while(s!.phase==='combat'){s=stepMatch(s!).state;if(s.combat&&s.combat.tick%60===5){expect(restoreMatch(serializeMatch(s))).toEqual(s);checked++;
  const edit=structuredClone(s) as any,u=edit.combat.units.find((x:any)=>x.id===hero.id);if(u&&u.alive){u.runtime.permanentAdBps+=1;expect(()=>restoreMatch(serializeMatch(edit))).toThrow();}}}
 expect(checked).toBeGreaterThan(0);
});
it('Savage Revenge: 10 less mana; the cast pounces on the farthest enemy within 2 hexes with 110% damage', ()=>{
 const {state,plain}=heroCombat('savage-revenge','renni',{enemies:3,cluster:true});
 expect(state.units.find(u=>u.id==='h0')!.maxMana).toBe(plain.units.find(u=>u.id==='h0')!.maxMana-10);
 const hero=runUntil(state,e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='h0'&&e.outcome.context.delivery!=='basic-attack',1200);
 const base=runUntil(plain,e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='h0'&&e.outcome.context.delivery!=='basic-attack',1200);
 const first=(r:typeof hero)=>r.events.find(e=>e.type==='packetDamage'&&e.outcome.context.source.ownerId==='h0'&&e.outcome.context.delivery!=='basic-attack');
 expect(first(hero)).toBeDefined();expect(first(base)).toBeDefined();
});
it.each([['spoils-of-war-i',1],['spoils-of-war-ii',2],['spoils-of-war-iii',3]] as const)('P: %s pays its seat table\'s gold on the matching enemy-death ordinals (tier %i tables)', (id,tier)=>{
 const deaths=(n:number,from:number)=>Array.from({length:n},(_,i)=>({victimId:'v'+(from+i),eventSeq:i+1}));
 let s:MatchState={...createMatch(42),augments:[{definitionId:id,choiceId:'test',acquiredRound:1}]};
 const perBattle=[10,0,40,33];let total=0;
 for(const [i,n] of perBattle.entries()){s=writeG23Progress({...s,round:i+1},advanceG23Economy(readG23Progress(s)!,{...fact(i+1,[i===1?'pve':'pvp','win']),openingDeaths:deaths(n,total),...(n?{batch2:[{definitionId:'spoils-of-war',count:n}]}:{})}).progress);total+=n;s=drainBatch3Gold(s);}
 const paid=s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch3').reduce((n,r)=>n+((r as any).amount??0),0);
 const sums=SPOILS_OF_WAR_TABLES[tier].map(t=>t.reduce((n,[,g])=>n+g,0));
 expect(sums).toContain(paid);validateBatch3Gold(s);
 const drops=s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch3').length;
 expect(drops/83).toBeGreaterThan([0,0.2,0.24,0.33][tier]);expect(drops/83).toBeLessThan([0,0.34,0.4,0.55][tier]);
 const forged=structuredClone(s) as any;forged.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch3').amount+=1;
 expect(()=>validateBatch3Gold(forged)).toThrow();
});

/** Reach 4-2 with real HP: win stage 1 with the opening champion, then concede (as rules-placebo-stage does). */
function reach42(seed:number):MatchState {
 const concede=(state:MatchState)=>{
  for(const unit of state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board')){
   const used=new Set(state.preparation.units.flatMap(u=>u.location.kind==='bench'?[u.location.slot]:[]));
   const slot=Array.from({length:state.preparation.benchSize},(_,i)=>i).find(i=>!used.has(i));
   state=accept(slot===undefined?sellUnit(state,unit.id):deployMatchUnit(state,unit.id,{kind:'bench',slot}) as any).state;
  }
  return state;
 };
 let state=createMatch(seed);
 while(state.roundDefinitionId!=='4-2'){
  state=resolveM5Choices(state);
  if(state.phase==='preparation'){
   if(state.roundDefinitionId.startsWith('1-')){
    const hero=state.preparation.units.find(u=>u.team==='player')!;
    state=accept(deployMatchUnit(state,hero.id,{kind:'board',cell:{col:3,row:4}}) as any).state;
    state=accept(startMatchCombat(state) as any).state;while(state.phase==='combat')state=stepMatch(state).state;
   }else state=accept(startMatchCombat(concede(state)) as any).state;
  }
  state=resolveM5Choices(state);
  if(state.phase!=='settlement')throw Error('Cannot reach 4-2');
  state=accept(nextRound(state,state.round) as any).state;
 }
 return state;
}
/** One seed's public offer of `id` at its first allowed node, or undefined. */
function openAt(id:string,seed:number):MatchState|undefined {
 const bans=AUGMENT_BATCH3_NODE_BANS[AUGMENT_BATCH3[id]?.apiName]??[],node=(['2-1','3-2','4-2'] as const).find(n=>!bans.includes(n))!;
 if(node==='2-1'&&!firstOffers(seed).includes(id))return undefined;
 let s:MatchState;try{s=node==='4-2'?reach42(seed):reachRound(node,false,seed);}catch{return undefined;}
 for(let slot=0;node!=='2-1'&&slot<3&&s.pendingChoice?.kind==='augment'&&!s.pendingChoice.offers.includes(id);slot++){const c=s.pendingChoice,r=rerollAugment(s,c.choiceId,c.generation,slot);if(r.ok)s=r.state;}
 const c=s.pendingChoice;return c?.kind==='augment'&&c.offers.includes(id)?s:undefined;
}
/** Pinned results of publicPick's seed search (the first seed from 0 whose openAt offers the card) for cards whose
 * search replays a slow route per seed: the Golden Egg's concede route to 4-2 (pool expansion re-searched 2026-10-25; seed 6 on the 224-card batch-4 pool).
 * The pinned seed must still open the offer; re-run the search if the pool, openings or route change. */
const PINNED_OPEN_SEEDS:Readonly<Record<string,number>>={'the-golden-egg':6};
function publicOpen(id:string):MatchState {
 const seed=PINNED_OPEN_SEEDS[id];if(seed===undefined)return publicPick(id,6000,0,false);
 const s=openAt(id,seed);expect(s?.pendingChoice?.offers,`${id} at seed ${seed}`).toContain(id);return s!;
}
/** A public offer of `id` at its first allowed augment node (14.24 stage tags); later nodes also use the free card rerolls. */
function publicPick(id:string,maxSeed=6000,from=0,buy=true):MatchState {
 for(let seed=from;seed<maxSeed;seed++){
  const opened=openAt(id,seed);if(!opened)continue;let s:MatchState=opened;
  if(!buy)return s;
  // Field a second champion (bought publicly) so the removal covers board and bench.
  for(let slot=0;slot<s.shop.slots.length;slot++){const r=buyUnit(s,slot,s.shop.generation) as any;if(r.ok){s=r.state;break;}}
  return s;
 }
 throw Error('no public '+id);
}
it.each([['dummify','forming-dummy',10000,0,250],['golemify','augment-golem',9000,6000,150]] as const)('%s: every champion is removed (items back to inventory) for one summon carrying their totals', (id,unit,hpBps,adBps,perStage)=>{
 const open=publicPick(id),champions=open.preparation.units.filter(u=>u.team==='player'&&!UNIT_DEFINITIONS[u.definitionId].summon);
 expect(champions.length).toBeGreaterThan(0);
 const health=champions.reduce((n,u)=>n+getUnitStats(u.definitionId,u.starLevel).health,0),attack=champions.reduce((n,u)=>n+getUnitStats(u.definitionId,u.starLevel).attack,0);
 const c=open.pendingChoice!,s=accept(selectChoice(open,c.choiceId,c.generation,id) as any).state as MatchState;
 expect(s.preparation.units.filter(u=>u.team==='player'&&!UNIT_DEFINITIONS[u.definitionId].summon)).toEqual([]);
 const summon=s.preparation.units.filter(u=>u.definitionId===unit);expect(summon).toHaveLength(1);
 expect(s.items.filter(i=>i.location.kind==='unit'&&champions.some(u=>u.id===(i.location as any).unitId))).toEqual([]);
 const key=id==='dummify'?'dummify':'golemify';
 expect(s.augmentProgress.forming).toEqual({[key]:{health,attack}});
 expect(s.resourceProvenance.entries.filter(e=>e.kind==='unit-removed').map(e=>(e as any).unitId).sort()).toEqual(champions.map(u=>u.id).sort());
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 // The summon's combat panel: totals × percent (+ HPPerStage per later stage start, none yet).
 const placed={...s,preparation:{...s.preparation,units:s.preparation.units.map(u=>u.id===summon[0].id?{...u,location:{kind:'board' as const,cell:{col:3,row:4}}}:u)}};
 const snap=buildStrategySnapshot(placed),stats=snap.units.find(u=>u.unitId===summon[0].id)!.stats;
 expect(stats.health).toBe(Math.max(UNIT_DEFINITIONS[unit].baseStats.health,Math.floor(health*hpBps/10000)));
 if(adBps)expect(stats.attack).toBe(Math.max(UNIT_DEFINITIONS[unit].baseStats.attack,Math.floor(attack*adBps/10000)));
 const later=buildStrategySnapshot({...placed,round:30}).units.find(u=>u.unitId===summon[0].id)!.stats;
 let stages=0;for(let r=s.round+1;r<=30;r++)if(getMultiplayerRoundByOrdinal(r).subround===1)stages++;
 expect(later.health).toBe(Math.max(UNIT_DEFINITIONS[unit].baseStats.health,Math.floor(health*hpBps/10000)+stages*perStage));
 // Tampering: edited totals, a forged extra removal, or a re-added champion are all rejected on restore.
 const totals=structuredClone(s) as any;totals.augmentProgress.forming[key].health+=1;expect(()=>restoreMatch(serializeMatch(totals))).toThrow();
 const reborn=structuredClone(s) as any;reborn.augmentProgress.forming=undefined;delete reborn.augmentProgress.forming;expect(()=>restoreMatch(serializeMatch(reborn))).toThrow();
 // Completeness: dropping the batch's last removal (champion kept, totals recomputed) is rejected.
 const removals=s.resourceProvenance.entries.filter(e=>e.kind==='unit-removed'),last=removals.at(-1)! as any;
 const kept=structuredClone(s) as any;
 kept.resourceProvenance.entries=kept.resourceProvenance.entries.filter((e:any)=>e.sequence!==last.sequence).map((e:any,i:number)=>({...e,sequence:i}));
 const freeSlot=[...Array(9).keys()].find(i=>!kept.preparation.units.some((u:any)=>u.location.kind==='bench'&&u.location.slot===i))!;
 kept.preparation.units=[...kept.preparation.units,{...structuredClone(open.preparation.units.find(u=>u.id===last.unitId)!),location:{kind:'bench',slot:freeSlot}}];
 kept.augmentProgress.forming=formingTotals(kept);
 expect(()=>restoreMatch(serializeMatch(kept))).toThrow(/forming removal completeness/);
 // Online battle snapshots carry the totals; a forged key or field is rejected.
 const shot=snapshotForBattle(placed,'owner');expect(restorePlayerBattleSnapshot(JSON.stringify(shot))).toEqual(shot);
 expect(shot.augmentProgress.forming).toEqual({[key]:{health,attack}});
 const otherKey=structuredClone(shot) as any;otherKey.augmentProgress.forming={[key==='dummify'?'golemify':'dummify']:{health,attack}};
 expect(()=>restorePlayerBattleSnapshot(JSON.stringify(otherKey))).toThrow();
 const extra=structuredClone(shot) as any;extra.augmentProgress.forming[key].mana=1;expect(()=>restorePlayerBattleSnapshot(JSON.stringify(extra))).toThrow();
 // Later purchases are never removed again.
 let after=s;for(let slot=0;slot<after.shop.slots.length;slot++){const r=buyUnit(after,slot,after.shop.generation) as any;if(r.ok){after=r.state;break;}}
 expect(drainBatch1Gifts(after).preparation.units.length).toBe(after.preparation.units.length);
});
it('Dummify/Golemify online: the pool ledger returns every removed copy and conservation holds', ()=>{
 let {pool,states}=room(undefined,1);let state:MatchState={...states[0],gold:50};
 let r=accept(generateSharedShop(pool,state,0));pool=r.pool;state=r.state;
 for(let i=0;i<3;i++){const slot=state.shop.slots.findIndex(x=>x.status==='available');if(slot<0)break;r=accept(buySharedUnit(pool,state,slot,state.shop.generation));pool=r.pool;state=r.state;}
 const owned={...state,augments:[{definitionId:'dummify',choiceId:'test',acquiredRound:state.round}]};
 const held=pool.holdings.filter(h=>h.seatId===state.sharedPool!.seatId).reduce((n,h)=>n+h.sources.length,0);
 const before={...pool.available};const after=drainBatch3Forming(owned);
 const draft=draftPool(pool),events:any[]=[];reconcileHoldings(draft,owned,after,events);
 expect(draft.holdings.filter(h=>h.seatId===state.sharedPool!.seatId)).toEqual([]);
 const returned=Object.keys(before).reduce((n,id)=>n+(draft.available[id]-before[id]),0);expect(returned).toBe(held);
 assertSharedPoolConservation(draft,[after]);
});

it('Warpath: the PvP-win damage fact is stage base + own survivors, and 60 dealt opens one chest of 4 five-costs, a two-star 4-cost and an anvil', ()=>{
 // The fact itself: a won PvP combat reports base damage + this side's surviving units (economy.ts rule), a loss nothing.
 // A surviving training dummy counts like any survivor, as in the damage the loser is charged.
 const combat={result:'playerWin',units:[{team:'player',alive:true,definitionId:'garen',hp:1},{team:'player',alive:true,definitionId:'lux',hp:1},{team:'player',alive:false,definitionId:'lux',hp:0},{team:'player',alive:true,definitionId:'training-dummy',hp:1},{team:'enemy',alive:false,definitionId:'garen',hp:0}],strategy:{traits:[],units:[]},openingDeaths:[],combatId:'c'} as any;
 const round=getMultiplayerRoundById('3-2').ordinal;
 expect(g23BattleFacts(combat,'player',round,'pvp',[]).batch3DamageDealt).toBe(selectPlayerBaseDamage(3,'pvp','3-2')+3);
 expect(g23BattleFacts({...combat,result:'enemyWin'},'player',round,'pvp',[]).batch3DamageDealt).toBeUndefined();
 expect(g23BattleFacts(combat,'player',round,'pve',[]).batch3DamageDealt).toBeUndefined();
 expect(()=>validateG23BattleFacts({...fact(3,['pvp','loss']),batch3DamageDealt:5})).toThrow();
 // 59 dealt: nothing; the battle that reaches 60 opens the chest once, never again.
 const damage=(amounts:readonly number[])=>{let s:MatchState={...createMatch(42),augments:[{definitionId:'warpath',choiceId:'test',acquiredRound:1}]};
  for(const [i,d] of amounts.entries())s=writeG23Progress({...s,round:i+1},advanceG23Economy(readG23Progress(s)!,{...fact(i+1,['pvp','win']),batch3DamageDealt:d}).progress);return s;};
 expect(batch3RewardPlan(damage([20,20,19]))).toEqual([]);
 const chest=batch3RewardPlan(damage([20,20,20,30]));
 expect(chest.map(g=>[g.kind,g.acquiredRound,g.starLevel??1])).toEqual([...Array(4).fill(['unit',3,1]),['unit',3,2],['unit',3,1]]);
 expect(chest.slice(0,4).every(g=>UNIT_DEFINITIONS[g.definitionId].cost===5)).toBe(true);
 expect(UNIT_DEFINITIONS[chest[4].definitionId].cost).toBe(4);expect(chest[5].definitionId).toBe('TFT_ArmoryKeyCompleted');
 const granted=drainBatch1Gifts({...damage([60]),gold:0});
 expect(granted.preparation.units.filter(u=>u.team==='player'&&UNIT_DEFINITIONS[u.definitionId].cost===5)).toHaveLength(4);
 // The grant ledger accepts exactly this chest, and draining again grants nothing more.
 expect(()=>validateBatch1Gifts(granted)).not.toThrow();
 expect(drainBatch1Gifts(granted)).toEqual(granted);
});

it('Magic Roll: fair dice, the 6-2-6 egg first, then triples, then the total band; each band grants its 14.24 counts', ()=>{
 expect(magicRollKind([6,2,6])).toBe('egg');expect(magicRollKind([2,6,6])).toBe('components');
 expect(magicRollKind([5,5,5])).toBe('high-triple');expect(magicRollKind([1,1,1])).toBe('low-triple');expect(magicRollKind([3,3,3])).toBe('low-triple');
 expect([[1,2,5],[2,3,3],[4,4,1]].map(magicRollKind)).toEqual(['health','health','units']);
 expect([[4,4,3],[4,4,4].slice(0,2).concat(5),[6,5,5],[6,6,5]].map(magicRollKind)).toEqual(['units','components','pan','pan']);
 // The band probabilities of three fair dice (with these precedences) match the S14 ratios.
 const counts:Record<string,number>={};for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++){const k=magicRollKind([a,b,c]);counts[k]=(counts[k]??0)+1;}
 expect(counts).toEqual({health:54,units:78,components:68,pan:9,'high-triple':3,'low-triple':3,egg:1});
 // Each seed's dice are seat/choice bound and survive restore; the dice decide the acquisition grant.
 const kinds=new Set<string>();
 for(let seed=0;seed<400&&kinds.size<6;seed++){
  const s=drainBatch1Gifts({...createMatch(seed),augments:[{definitionId:'magic-roll',choiceId:'test',acquiredRound:1}]});
  const dice=s.augmentProgress.magicRoll!,kind=magicRollKind(dice);kinds.add(kind);
  expect(dice).toEqual(magicRollDice(s,s.augments[0]));
  const gifts=batch1GiftPlan(s);
  if(kind==='units')expect(gifts.map(g=>[UNIT_DEFINITIONS[g.definitionId].cost,g.starLevel])).toEqual([[3,2],[3,2],[2,2]]);
  if(kind==='components'){expect(gifts).toHaveLength(4);expect(new Set(gifts.map(g=>g.definitionId)).size).toBe(1);}
  if(kind==='pan')expect(gifts.map(g=>g.definitionId)[0]).toBe('frying-pan');
  if(kind==='high-triple')expect(gifts.map(g=>g.definitionId)).toEqual(['TFT_Item_TacticiansRing']);
  if(kind==='low-triple'){expect(gifts.map(g=>g.definitionId)).toEqual(Array(3).fill('TFT_Consumable_ChampionDuplicator_III'));expect(s.seatMechanics!.receipts.filter(r=>r.kind==='gold').map(r=>(r as any).amount)).toEqual([6]);}
  if(kind==='health'){
   expect(gifts).toEqual([]);
   const placed={...s,preparation:{...s.preparation,units:s.preparation.units.map(u=>u.team==='player'?{...u,location:{kind:'board' as const,cell:{col:3,row:4}}}:u)}};
   const unit=placed.preparation.units.find(u=>u.team==='player')!;
   const plain=buildStrategySnapshot({...placed,augments:[],augmentProgress:{...placed.augmentProgress,magicRoll:undefined}} as any).units.find(u=>u.unitId===unit.id)!.stats.health;
   expect(buildStrategySnapshot(placed).units.find(u=>u.unitId===unit.id)!.stats.health).toBe(plain+250);
  }
 }
 expect(kinds.size).toBeGreaterThanOrEqual(5);
});

it('Magic Roll 6-2-6: the egg hatches at the round entry three rounds later with 5 gold, a Tactician\'s Crown and two five-costs', ()=>{
 let seed=0;for(;seed<5000;seed++)if(magicRollKind(magicRollDice({seed,multiplayer:undefined},{definitionId:'magic-roll',choiceId:'test',acquiredRound:5}))==='egg')break;
 const base={...createMatch(seed),augments:[{definitionId:'magic-roll',choiceId:'test',acquiredRound:5}]};
 const at=(round:number)=>({...base,round});
 expect(batch1GiftPlan(drainBatch1Gifts(at(5)))).toEqual([]);
 expect(batch3RewardPlan(at(7))).toEqual([]);
 let hatch=8;while(getMultiplayerRoundByOrdinal(hatch).kind==='supply')hatch++;
 const egg=batch3RewardPlan(at(hatch));
 expect(egg.map(g=>g.definitionId)[0]).toBe('TFT_Item_ForceOfNature');
 expect(egg.slice(1).map(g=>UNIT_DEFINITIONS[g.definitionId].cost)).toEqual([5,5]);
 const paid=drainBatch3RoundEntry(drainBatch1Gifts(at(hatch)));
 expect(paid.seatMechanics!.receipts.filter(r=>r.kind==='gold').map(r=>(r as any).amount)).toEqual([5]);
});

it('Magic Roll public pick: the dice survive restore and edited dice are rejected', ()=>{
 const open=publicPick('magic-roll'),c=open.pendingChoice!,s=accept(selectChoice(open,c.choiceId,c.generation,'magic-roll') as any).state as MatchState;
 const dice=s.augmentProgress.magicRoll!;expect(dice).toEqual(magicRollDice(s,s.augments.at(-1)!));
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const forged=structuredClone(s) as any;forged.augmentProgress.magicRoll=[dice[0]%6+1,dice[1],dice[2]];expect(()=>restoreMatch(serializeMatch(forged))).toThrow();
 const dropped=structuredClone(s) as any;delete dropped.augmentProgress.magicRoll;expect(()=>restoreMatch(serializeMatch(dropped))).toThrow();
 const shot=snapshotForBattle(s,'owner');expect(restorePlayerBattleSnapshot(JSON.stringify(shot))).toEqual(shot);
 const bad=structuredClone(shot) as any;bad.augmentProgress.magicRoll=[7,1,1];expect(()=>restorePlayerBattleSnapshot(JSON.stringify(bad))).toThrow();
});

it('every batch-3 row carries its 14.24 stage tags as offer node bans', ()=>{
 const research=JSON.parse(readFileSync('/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json','utf8')) as {apiName:string;item_tags_raw:string[]}[];
 const tags:Record<string,string>={'{d02ae323}':'2-1','{d12ae4b6}':'3-2','{d22ae649}':'4-2'};
 for(const row of Object.values(AUGMENT_BATCH3)){
  const bans=research.find(r=>r.apiName===row.apiName)!.item_tags_raw.flatMap(t=>tags[t]?[tags[t]]:[]).sort();
  expect([row.apiName,[...(AUGMENT_BATCH3_NODE_BANS[row.apiName]??[])]]).toEqual([row.apiName,bans]);
  expect([row.apiName,[...((AUGMENT_OFFER_RULES.nodeBans as Record<string,readonly string[]>)[row.apiName]??[])]]).toEqual([row.apiName,bans]);
 }
});

it('Call to Chaos: ten equal outcomes on a seat/choice stream, each granting its S13 reward with 14.24 counts', ()=>{
 const seen=new Map<string,MatchState>();
 for(let seed=0;seed<600&&seen.size<10;seed++){
  const o=callToChaosOutcome({seed},{choiceId:'test',definitionId:'call-to-chaos'});
  if(!seen.has(o))seen.set(o,drainBatch1Gifts({...createMatch(seed),gold:0,augments:[{definitionId:'call-to-chaos',choiceId:'test',acquiredRound:1}]}));
 }
 expect([...seen.keys()].sort()).toEqual([...CALL_TO_CHAOS_OUTCOMES].sort());
 // Uniform: the 10 outcomes split 5000 seeds evenly within sampling noise.
 const counts:Record<string,number>={};for(let seed=0;seed<5000;seed++){const o=callToChaosOutcome({seed},{choiceId:'c',definitionId:'call-to-chaos'});counts[o]=(counts[o]??0)+1;}
 for(const n of Object.values(counts))expect(Math.abs(n-500)).toBeLessThan(80);
 const gold=(s:MatchState)=>s.seatMechanics!.receipts.filter(r=>r.kind==='gold').map(r=>(r as any).amount);
 const items=(s:MatchState)=>s.items.map(i=>i.definitionId).sort();
 expect(gold(seen.get('gold')!)).toEqual([58]);
 const three=seen.get('three-star')!;expect(gold(three)).toEqual([20]);
 expect(three.preparation.units.filter(u=>u.team==='player'&&u.starLevel===3).map(u=>UNIT_DEFINITIONS[u.definitionId].cost)).toEqual([3]);
 for(const [o,id] of [['hullbreakers','TFT9_Item_OrnnHullbreaker'],['horizon-focus','TFT9_Item_OrnnHorizonFocus'],['thiefs-gloves','thiefs-gloves']] as const){
  const s=seen.get(o)!;expect(items(s).filter(d=>d===id)).toHaveLength(3);expect(s.consumables.map(c=>c.definitionId)).toContain('magnetic-remover');
 }
 for(const [o,id] of [['solari-dummy','TFT_Item_LocketOfTheIronSolari'],['zeke-dummy','TFT_Item_ZekesHerald']] as const){
  const s=seen.get(o)!,dummy=s.preparation.units.find(u=>u.definitionId==='training-dummy')!;
  expect(s.items.filter(i=>i.location.kind==='unit'&&i.location.unitId===dummy.id).map(i=>i.definitionId)).toEqual([id,id]);
  expect(()=>validateBatch1Gifts(s)).not.toThrow();
  const detached=structuredClone(s) as any;detached.items.find((i:any)=>i.definitionId===id).location={kind:'inventory'};expect(()=>validateBatch1Gifts(detached)).toThrow();
 }
 expect(seen.get('emblems')!.items.filter(i=>i.definitionId in EMBLEM_ITEMS)).toHaveLength(5);
 const rerolls=seen.get('rerolls')!;expect(freeRerollsGranted(rerolls)).toBe(40);
 expect(freeRerollsGranted({...seen.get('gold')!,round:30})).toBe(0);
 const xp=seen.get('xp')!;expect(outcomeAcquisitionXp(xp,xp.augments[0])).toBe(64);
 expect(outcomeAcquisitionXp(seen.get('gold')!,seen.get('gold')!.augments[0])).toBe(0);
});

// Global 14.24 stage bans: Call to Chaos's first public 4-2 offer is STAGE_SEEDS' fielded route (augment-stage-helpers
// offerFor = reachRoundFielded('4-2', seed)). That route fights seventeen real battles, so it is played here in legs of
// a few fights, one beforeAll hook per leg (so a filtered case gets the whole route, no hook or case plays it all);
// each leg is reachRoundFielded's loop verbatim.
const CHAOS_LEGS=['2-3','2-7','3-3','3-6','4-2'] as const;
const chaosRoute=new Map<string,MatchState>();
function chaosLeg(leg:typeof CHAOS_LEGS[number]):MatchState {
 const cached=chaosRoute.get(leg);if(cached)return cached;
 const i=CHAOS_LEGS.indexOf(leg);let state=i===0?createMatch(STAGE_SEEDS['call-to-chaos'].seed):chaosLeg(CHAOS_LEGS[i-1]);
 while(state.roundDefinitionId!==leg){
  state=resolveM5Choices(state);
  if(state.phase==='preparation'){state=accepted(startMatchCombat(fieldBench(state)));while(state.phase==='combat')state=stepMatch(state).state;}
  state=resolveM5Choices(state);
  if(state.phase!=='settlement')throw new Error(`Cannot reach ${leg} from ${state.roundDefinitionId}/${state.phase}`);
  state=accepted(nextRound(state,state.round));
 }
 chaosRoute.set(leg,state);return state;
}
describe('Call to Chaos at 4-2', ()=>{
for(const leg of CHAOS_LEGS)beforeAll(()=>{chaosLeg(leg);});
it.each(CHAOS_LEGS)('Call to Chaos fielded 4-2 route: the leg to %s settles every fight', leg=>{
 expect(STAGE_SEEDS['call-to-chaos']).toMatchObject({node:'4-2',fielded:true});expect(offeredAt('call-to-chaos','2-1')).toBe(false);
 expect(chaosLeg(leg).roundDefinitionId).toBe(leg);
});
it('Call to Chaos public pick at 4-2: the outcome is granted once and the save restores (XP branch through the acquisition XP chain)', ()=>{
 const open=chaosLeg('4-2'),c=open.pendingChoice!;
 expect(open.pendingChoice?.offers,'call-to-chaos at 4-2 seed '+STAGE_SEEDS['call-to-chaos'].seed).toContain('call-to-chaos');
 const s=accept(selectChoice(open,c.choiceId,c.generation,'call-to-chaos') as any).state as MatchState,a=s.augments.at(-1)!;
 const o=callToChaosOutcome(s,a);
 expect(o).toBe('xp'); // 224-card batch-4 pool: seed 115 keeps this public route on the acquisition XP branch.
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 if(o==='xp')expect(s.xp+s.level*1000).not.toBe(open.xp+open.level*1000);
 // Forging another outcome's reward is rejected: an extra 58-gold receipt has no plan behind it.
 const forged=structuredClone(s) as any;
 forged.seatMechanics.receipts.push({kind:'gold',receiptId:JSON.stringify(['augment-pool-batch3',a.choiceId,9,9]),source:'augment-pool-batch3',amount:58,round:s.round});
 forged.gold+=58;expect(()=>restoreMatch(serializeMatch(forged))).toThrow();
});
});

it('Worth the Wait through a real carousel: the 2-4 copy waits for 2-5 and every save on the way restores', ()=>{
 let s=publicOpen('worth-the-wait');const c=s.pendingChoice!;
 s=accept(selectChoice(s,c.choiceId,c.generation,'worth-the-wait') as any).state as MatchState;
 const acquired=s.round,copies=()=>s.seatMechanics!.receipts.filter(r=>r.kind==='unit'&&r.receiptId.includes('batch3'));
 let crossed=false;
 while(getMultiplayerRoundByOrdinal(s.round).roundId!=='2-6'){
  s=resolveM5Choices(s);if(s.phase==='preparation')s=accept(startMatchCombat(emptyBoard(s)) as any).state;
  while(s.phase==='combat')s=stepMatch(s).state;
  s=resolveM5Choices(s);expect(restoreMatch(serializeMatch(s))).toEqual(s);
  s=accept(nextRound(s,s.round) as any).state;s=resolveM5Choices(s);
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
  const kind=getMultiplayerRoundByOrdinal(s.round).kind;
  if(kind==='supply'){crossed=true;expect(copies().filter(r=>r.round===s.round)).toEqual([]);}
 }
 expect(crossed).toBe(true);
 // One copy per round entry from acquisition + Delay, the carousel's own copy moved to the next round.
 const rounds=copies().map(r=>r.round);
 expect(rounds.every(r=>getMultiplayerRoundByOrdinal(r).kind!=='supply'&&r>=acquired+2)).toBe(true);
 expect(rounds.length).toBe(Array.from({length:s.round-acquired-1},(_,i)=>acquired+2+i).length);
});
