import { AUGMENT_POOL_TEXT } from '../src/presentation/augment-pool-text';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { existsSync } from 'node:fs';
import { RULES_GAP_MANIFEST, ARCHIVED_AUGMENT_DEFINITIONS } from '../scripts/augment-content-archive';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createMatch, buyXp, rerollShop, selectChoice, startMatchCombat, nextRound, stepMatch } from '../src/simulation/match';
import { enableMultiplayerSettlement, applyRoundSettlement, forfeitPendingChoice, claimOrDiscardLoot, ROUND_SETTLEMENT_VERSION, type RoundSettlementReceipt } from '../src/server-entry';
import { KINGSLAYER_SOURCE, RISKY_MOVES_SOURCE, drainSettlementGold } from '../src/simulation/augment-settlement-gold';
import { batch2HpBeforeBattle } from '../src/simulation/augment-pool-batch2-health';
import { applyAcquisitionHealthLoss } from '../src/simulation/augment-xp';
import { explainedHp } from '../src/simulation/player-hp';
import type { MatchState } from '../src/simulation/match-types';
import { AUGMENT_BATCH3_XP, AUGMENT_BATCH3_XP_BLOCKED } from '../src/simulation/content/augment-pool-batch3-xp';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { augmentOfferAllowed, augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { batch3EntryXp, xpPurchaseAmount, xpPurchaseCost, applyLevelUpHealth, batch3XpFreeRerolls, AUGMENT_ACQUISITION_LEVEL_KEY } from '../src/simulation/augment-xp';
import { freeRerollsAvailable } from '../src/simulation/free-rerolls';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { writeSeatMechanic } from '../src/simulation/seat-mechanics/state';
import { validateBatch1Gifts } from '../src/simulation/restore-checks/batch1-gifts-check';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { XP_TO_NEXT_LEVEL } from '../src/simulation/match-rules';
import { grantXp } from '../src/simulation/progression';
import { accept } from './tp-helpers';
import { reachRound, resolveM5Choices, emptyBoard } from './match-helpers';

const total=(s:Pick<MatchState,'level'|'xp'>)=>{let n=s.xp;for(let l=1;l<s.level;l++)n+=XP_TO_NEXT_LEVEL[l];return n;};
const owned=(definitionId:string,acquiredRound:number)=>[{definitionId,choiceId:'c-'+definitionId,acquiredRound}];
const firstOffers=(seed:number)=>{const state=createMatch(seed);return generateChoices(augmentCandidates(resolveAugmentTier(state,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),state.choiceRngState).offers;};
/** Public 2-1 selection, so saves carry the acquisition receipt and the offline chain checks the XP. */
let opened:MatchState;
function pick(id:string):MatchState {
 let seed=0;while(!firstOffers(seed).includes(id)){seed++;if(seed>20000)throw new Error('no seed for '+id);}
 const open=opened=reachRound('2-1',false,seed),c=open.pendingChoice!;expect(c.offers).toContain(id);
 return accept(selectChoice(open,c.choiceId,c.generation,id) as any).state as MatchState;
}
/** Fight with an empty board, settle and enter the next round. */
function advance(s:MatchState):MatchState {
 s=resolveM5Choices(s);if(s.phase==='preparation')s=accept(startMatchCombat(emptyBoard(s)) as any).state;
 s=resolveM5Choices(s);return resolveM5Choices(accept(nextRound(s,s.round) as any).state);
}

it.skipIf(!existsSync(RESEARCH_FILE))('the eight batch rows carry their 14.24 zh_cn name, tier, description and values and are registered in the offer pool', ()=>{
 const research=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')) as {apiName:string;name_zh_cn:string;description_zh_cn:string;description_en_us:string;tier:number;effects:Record<string,number>}[];
 expect(Object.keys(AUGMENT_BATCH3_XP).sort()).toEqual(['epoch','epoch-plus','kingslayer','level-up','patient-study','risky-moves','shopping-spree','upward-mobility']);
 for(const [id,row] of Object.entries(AUGMENT_BATCH3_XP)){
  const r=research.find(x=>x.apiName===row.apiName)!;
  // UI text lives in the lazy chunk; the offline archive restores every original column for the identity roots.
  expect([AUGMENT_POOL_TEXT[id].name,AUGMENT_POOL_TEXT[id].description,row.tier,row.source.values]).toEqual([r.name_zh_cn,r.description_zh_cn,['silver','gold','prismatic'][r.tier-1],r.effects]);
  const archived=(RULES_GAP_MANIFEST.augmentPoolBatch3Xp.content as Record<string,{name:string;description:string;source:{description_en_us:string}}>)[id];
  expect([archived.name,archived.description,archived.source.description_en_us]).toEqual([r.name_zh_cn,r.description_zh_cn,r.description_en_us]);
  expect(row).not.toHaveProperty('description');expect(row.source).not.toHaveProperty('description_en_us');
  expect(ARCHIVED_AUGMENT_DEFINITIONS[id].name).toBe(r.name_zh_cn);expect(AUGMENT_TIERS[id]).toBe(row.tier);expect(AUGMENT_POOL_API_NAMES[id]).toBe(row.apiName);
 }
 expect(AUGMENT_BATCH3_XP_BLOCKED).toEqual({});
});
it('Epoch and Epoch+ exclude each other, Shopping Spree excludes Trade Sector (14.24 static mutex)', ()=>{
 // No node: only the mutex is under test here (stage bans have their own test below).
 const own=(id:string)=>owned(id,1),ctx={node:null,fieldedTraits:[],blocked:[]};
 expect(augmentOfferAllowed('epoch',own('epoch-plus'),ctx)).toBe(false);
 expect(augmentOfferAllowed('epoch-plus',own('epoch'),ctx)).toBe(false);
 expect(augmentOfferAllowed('shopping-spree',own('trade-sector'),ctx)).toBe(false);
 expect(augmentOfferAllowed('trade-sector',own('shopping-spree'),ctx)).toBe(false);
 expect(augmentOfferAllowed('level-up',own('epoch'),ctx)).toBe(true);
});
it('entry XP: Epoch 6/8 at every stage start after acquisition; Patient Study 2 per player win, 3 per loss or draw, from the acquisition round', ()=>{
 const starts=Array.from({length:30},(_,i)=>i+1).filter(r=>getMultiplayerRoundByOrdinal(r).subround===1);
 for(const [id,xp] of [['epoch',6],['epoch-plus',8]] as const)for(let round=1;round<=30;round++)
  expect(batch3EntryXp(owned(id,5),[],round)).toBe(round>5&&starts.includes(round)?xp:0);
 const h=(round:number,roundKind:'pvp'|'pve',result:'playerWin'|'enemyWin'|'draw')=>[{round,roundKind,result}] as const;
 const ps=owned('patient-study',5);
 expect([batch3EntryXp(ps,h(5,'pvp','playerWin'),6),batch3EntryXp(ps,h(5,'pvp','enemyWin'),6),batch3EntryXp(ps,h(5,'pvp','draw'),6)]).toEqual([2,3,3]);
 expect([batch3EntryXp(ps,h(5,'pve','playerWin'),6),batch3EntryXp(ps,h(4,'pvp','enemyWin'),5),batch3EntryXp(ps,h(5,'pvp','enemyWin'),5)]).toEqual([0,0,0]);
 expect(batch3EntryXp([],h(5,'pvp','enemyWin'),6)).toBe(0);
});
it('Level Up!: 12 XP on acquisition and 6 XP per purchase from then on; the save restores and an off-chain XP is rejected', ()=>{
 let s=pick('level-up');const before=opened;
 expect(xpPurchaseAmount(s.augments,s.round)).toBe(6);expect(xpPurchaseAmount(s.augments,s.round-1)).toBe(4);expect(xpPurchaseAmount([],s.round)).toBe(4);
 expect(total(s)-total(before)).toBe(12);
 s={...s,gold:20};const bought=accept(buyXp(s) as any).state as MatchState;
 expect(total(bought)-total(s)).toBe(6);expect(bought.gold).toBe(16);
 expect(restoreMatch(serializeMatch(bought))).toEqual(bought);
 const plain=grantXp(1,0,total(bought)+4-6),forged={...bought,level:plain.level,xp:plain.xp};
 expect(()=>restoreMatch(serializeMatch(forged))).toThrow();
 // A later round keeps the 6-XP purchase step in the history chain.
 const next=advance(accept(buyXp({...bought,gold:20}) as any).state);
 expect(restoreMatch(serializeMatch(next))).toEqual(next);
});
it('Epoch: 6 XP and 2 free rerolls now, again at the next stage start through real round entries; saves restore', ()=>{
 let s=pick('epoch');const before=opened;
 expect(total(s)-total(before)).toBe(6);expect(freeRerollsAvailable(s)).toBe(2);
 s=accept(rerollShop(s) as any).state;expect(freeRerollsAvailable(s)).toBe(1);
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const acquired=s.round;let checked=0;
 while(getMultiplayerRoundByOrdinal(s.round).stage===getMultiplayerRoundByOrdinal(acquired).stage){
  const prev=s;s=advance(s);
  const stageStart=getMultiplayerRoundByOrdinal(s.round).subround===1;
  expect(freeRerollsAvailable(s)-freeRerollsAvailable(prev)).toBe(stageStart?2:0);
  if(stageStart){expect(total(s)-total(prev)).toBe(Math.min(2+6,total({level:10,xp:0})-total(prev)));checked++;}
  validateBatch1Gifts(s);expect(restoreMatch(serializeMatch(s))).toEqual(s);
 }
 expect(checked).toBe(1);
});
it('Patient Study: after each player combat the next round entry adds 2 or 3 XP beside the round XP; saves restore', ()=>{
 let s=pick('patient-study');let seen=0;
 // Same seed, another offer: the XP difference per round is exactly Patient Study's.
 const c=opened.pendingChoice!;let base=accept(selectChoice(opened,c.choiceId,c.generation,c.offers.find(o=>o!=='patient-study')!) as any).state as MatchState;
 for(let n=0;n<3;n++){
  const prev=s,prevBase=base;s=advance(s);base=advance(base);
  const fought=s.roundResults.find(r=>r.round===s.round-1)!;
  const extra=fought.roundKind==='pvp'?(fought.result==='playerWin'?2:3):0;seen+=extra?1:0;
  expect(batch3EntryXp(s.augments,s.roundResults,s.round)).toBe(extra);
  expect(total(s)-total(prev)).toBe(total(base)-total(prevBase)+extra);
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
 }
 expect(seen).toBeGreaterThan(0);
});
it('Shopping Spree: records the acquisition level and grants the new level in free rerolls at each later level-up; tampering is rejected', ()=>{
 let s=pick('shopping-spree');
 expect(s.seatMechanics!.seat[AUGMENT_ACQUISITION_LEVEL_KEY]).toEqual({[s.augments.at(-1)!.choiceId]:s.level});
 expect(freeRerollsAvailable(s)).toBe(0);
 const from=s.level;s={...s,gold:60};
 while(s.level<from+2)s=accept(buyXp(s) as any).state;
 expect(batch3XpFreeRerolls(s)).toBe((from+1)+(from+2));expect(freeRerollsAvailable(s)).toBe(2*from+3);
 const gold=s.gold;s=accept(rerollShop(s) as any).state;expect(s.gold).toBe(gold);
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const choiceId=s.augments.at(-1)!.choiceId;
 for(const bad of [{[choiceId]:from-1},{[choiceId]:s.level+1},{},{[choiceId]:from,other:1},[from]])
  expect(()=>restoreMatch(serializeMatch(writeSeatMechanic(s,AUGMENT_ACQUISITION_LEVEL_KEY,bad as any)))).toThrow();
 expect(()=>validateBatch1Gifts(writeSeatMechanic(s,AUGMENT_ACQUISITION_LEVEL_KEY,undefined))).toThrow();
});
it('Upward Mobility: XP costs 3 gold from acquisition; each later level-up heals a living player 2 (cap 100) and adds 3 free rerolls; restore is exact', ()=>{
 let s=pick('upward-mobility');const from=s.level,choiceId=s.augments.at(-1)!.choiceId;
 expect(s.seatMechanics!.seat[AUGMENT_ACQUISITION_LEVEL_KEY]).toEqual({[choiceId]:from});
 expect([xpPurchaseCost(s.augments,s.round),xpPurchaseCost(s.augments,s.round-1),xpPurchaseCost([],s.round)]).toEqual([3,4,4]);
 let r={...s,gold:s.gold+30};const hp0=r.playerHp;expect(hp0).toBeLessThan(96);
 while(r.level<from+2){const before=r;r=accept(buyXp(r) as any).state;expect(before.gold-r.gold).toBe(3);}
 expect(r.playerHp).toBe(Math.min(100,hp0+4));expect(batch3XpFreeRerolls(r)).toBe(6);expect(freeRerollsAvailable(r)).toBe(6);
 expect(restoreMatch(serializeMatch(r))).toEqual(r);
 // Settlement and entry level-ups keep healing through real rounds; every save is checked against the derived chain.
 let levelUps=0;
 for(let n=0;n<12&&!levelUps&&r.phase!=='gameOver';n++){
  const prev=r;r=advance(r);levelUps+=r.level-prev.level;
  const gained=r.level-prev.level,settledHp=r.roundResults.at(-1)!.hpAfter;
  if(settledHp>0)expect(r.playerHp).toBeGreaterThanOrEqual(Math.min(100,settledHp));
  expect(freeRerollsAvailable(r)-freeRerollsAvailable(prev)).toBe(3*gained);
  expect(restoreMatch(serializeMatch(r))).toEqual(r);
 }
 expect(levelUps).toBeGreaterThan(0);
 // Tampering: an HP off by the heal, or a moved acquisition level, is rejected.
 for(const bad of [{...r,playerHp:r.playerHp-2},{...r,playerHp:Math.min(100,r.playerHp+2)}].filter(b=>b.playerHp!==r.playerHp))
  expect(()=>restoreMatch(serializeMatch(bad))).toThrow();
 expect(()=>restoreMatch(serializeMatch(writeSeatMechanic(r,AUGMENT_ACQUISITION_LEVEL_KEY,{[choiceId]:from+1})))).toThrow();
 expect(applyLevelUpHealth({level:3},{...r,level:5,playerHp:99}).playerHp).toBe(100);
 expect(applyLevelUpHealth({level:3},{...r,level:5,playerHp:0}).playerHp).toBe(0);
 expect(applyLevelUpHealth({level:3},{...r,augments:[],level:5,playerHp:50}).playerHp).toBe(50);
});

// Kingslayer: multiplayer receipts carry the opponent's frozen health; offline opponents are not players.
function mpOpening():MatchState {
 let state=accept(enableMultiplayerSettlement(createMatch(5),'A') as any).state as MatchState;
 const timeout=(s:MatchState)=>accept(forfeitPendingChoice(s,s.round,s.pendingChoice?.choiceId??null,s.pendingChoice?.generation??null) as any).state as MatchState;
 while(state.roundDefinitionId!=='2-1'){
  if(state.phase==='choice')state=timeout(state);
  else if(state.phase==='preparation')state=accept(startMatchCombat(state) as any).state;
  else if(state.phase==='combat')state=stepMatch(state).state;
  else state=accept(nextRound(accept(claimOrDiscardLoot(state,state.round) as any).state,state.round) as any).state;
 }
 return state.phase==='choice'?timeout(state):state;
}
const settlement=(s:MatchState,extra:Partial<RoundSettlementReceipt>={}):RoundSettlementReceipt=>({version:ROUND_SETTLEMENT_VERSION,settlementId:`${s.round}:A`,battleId:`battle:${s.round}`,
 seatId:s.multiplayer!.seatId,round:s.round,roundId:s.roundDefinitionId,settlementEligible:true,result:'win',damage:0,baseDamage:2,opposingSurvivors:0,growth:[],combatTicks:88,combatEventCount:20,...extra});
const kingGold=(s:MatchState)=>s.seatMechanics?.receipts.filter(r=>r.source===KINGSLAYER_SOURCE).map(r=>r.kind==='gold'?r.amount:0)??[];
it('Kingslayer: a player win pays 1 gold, 4 when the opponent had more health; the receipt must carry exactly that health', ()=>{
 const base=mpOpening(),s={...base,playerHp:80,augments:[...base.augments,{definitionId:'kingslayer',choiceId:'k',acquiredRound:base.round}]};
 expect(AUGMENT_DEFINITIONS.kingslayer.effects).toContainEqual({kind:'mechanic',mechanic:'acquisitionGold',values:{amount:1}});
 for(const [hp,gold] of [[90,4],[80,1],[50,1]] as const){
  const r=applyRoundSettlement(s,settlement(s,{opponentHp:hp}));if(!r.ok)throw new Error(r.reason);
  expect(kingGold(r.state)).toEqual([gold]);validateBatch1Gifts(r.state);
  const forged=structuredClone(r.state) as any;forged.seatMechanics.receipts.find((x:any)=>x.source===KINGSLAYER_SOURCE).amount=gold===4?1:4;
  expect(()=>validateBatch1Gifts(forged)).toThrow();
 }
 const lost=applyRoundSettlement(s,settlement(s,{result:'loss',damage:2,opponentHp:90}));if(!lost.ok)throw new Error(lost.reason);
 expect(kingGold(lost.state)).toEqual([]);
 for(const bad of [settlement(s),settlement(s,{opponentHp:101}),settlement(s,{opponentHp:-1})])expect(applyRoundSettlement(s,bad)).toMatchObject({ok:false,reason:'invalid-receipt'});
 expect(applyRoundSettlement(base,settlement(base,{opponentHp:90}))).toMatchObject({ok:false,reason:'invalid-receipt'});
 // A forged settled history without its receipt is refused as well.
 const r=applyRoundSettlement(s,settlement(s,{opponentHp:90}));if(!r.ok)throw new Error(r.reason);
 const dropped={...r.state,seatMechanics:{...r.state.seatMechanics!,receipts:r.state.seatMechanics!.receipts.filter(x=>x.source!==KINGSLAYER_SOURCE)}};
 expect(()=>validateBatch1Gifts(dropped)).toThrow();
});
it('Kingslayer offline: the AI opponent is not a player, so a player-combat win pays the plain 1 gold; real saves restore', ()=>{
 let s=pick('kingslayer');expect(kingGold(s)).toEqual([]);expect(restoreMatch(serializeMatch(s))).toEqual(s);
 const last=s.roundResults.at(-1)!,won={...s,roundResults:[...s.roundResults,{...last,round:s.round,roundKind:'pvp' as const,result:'playerWin' as const,hpBefore:1}]};
 expect(kingGold(drainSettlementGold(won))).toEqual([1]);
 expect(kingGold(drainSettlementGold({...won,roundResults:[...s.roundResults,{...won.roundResults.at(-1)!,result:'draw' as const}]}))).toEqual([]);
 s=advance(s);expect(restoreMatch(serializeMatch(s))).toEqual(s);
});

const riskyGold=(s:MatchState)=>s.seatMechanics?.receipts.filter(r=>r.source===RISKY_MOVES_SOURCE).map(r=>r.kind==='gold'?r.amount:0)??[];
it('Risky Moves: selecting it loses 20 HP (never below 1); the save restores and any other HP is rejected', ()=>{
 const s=pick('risky-moves'),before=opened.playerHp;
 expect(s.playerHp).toBe(Math.max(1,before-20));expect(before).toBeGreaterThan(21);
 expect(restoreMatch(serializeMatch(s))).toEqual(s);
 for(const hp of [s.playerHp-1,s.playerHp+1,before])expect(()=>restoreMatch(serializeMatch({...s,playerHp:hp}))).toThrow();
 expect(()=>restoreMatch(serializeMatch(writeSeatMechanic(s,AUGMENT_ACQUISITION_LEVEL_KEY,undefined)))).toThrow();
 const a=s.augments.at(-1)!;
 expect([applyAcquisitionHealthLoss({...s,playerHp:15},a).playerHp,applyAcquisitionHealthLoss({...s,playerHp:21},a).playerHp,applyAcquisitionHealthLoss({...s,playerHp:0},a).playerHp]).toEqual([1,1,0]);
 // A real later round keeps the chain: the loss belongs to the acquisition round only.
 const next=advance(s);expect(restoreMatch(serializeMatch(next))).toEqual(next);
});
it('Risky Moves: 30 gold at the settlement of the 7th player combat from the acquisition round, once; PvE does not count', ()=>{
 const base=pick('risky-moves'),a=base.augments.at(-1)!,last=base.roundResults.at(-1)!;
 const history=(kinds:readonly ('pvp'|'pve')[])=>({...base,roundResults:[...base.roundResults.filter(r=>r.round<a.acquiredRound),...kinds.map((roundKind,i)=>({...last,round:a.acquiredRound+i,roundKind,result:'enemyWin' as const}))]});
 expect(riskyGold(drainSettlementGold(history(['pvp','pvp','pvp','pvp','pvp','pvp'])))).toEqual([]);
 expect(riskyGold(drainSettlementGold(history(['pvp','pve','pvp','pvp','pvp','pvp','pvp','pvp','pvp'])))).toEqual([30]);
 const once=drainSettlementGold(history(['pvp','pvp','pvp','pvp','pvp','pvp','pvp','pvp']));
 expect(riskyGold(drainSettlementGold(once))).toEqual([30]);
});
it('Risky Moves with Upward Mobility: entry level-ups heal before the loss, later ones after (cap 100 in between)', ()=>{
 const s=pick('risky-moves'),risky=s.augments.at(-1)!,start=s.roundResults.find(r=>r.round===s.round-1)!.levelAfter;
 const state={...s,level:start+2,augments:[{definitionId:'upward-mobility',choiceId:'um',acquiredRound:1},...s.augments],
  seatMechanics:{...s.seatMechanics!,seat:{...s.seatMechanics!.seat,[AUGMENT_ACQUISITION_LEVEL_KEY]:{um:1,[risky.choiceId]:start+1}}}};
 // 99 → entry level-up +2 (capped 100) → -20 = 80 → a later level-up +2 = 82; a single combined step would give 83.
 expect(batch2HpBeforeBattle(state,s.roundDefinitionId,99)).toBe(82);
 // The room accepts exactly the rules' selection: heal for levels, then the loss of the newly selected augment.
 const prior={...s,augments:s.augments.filter(x=>x.choiceId!==risky.choiceId),playerHp:60};
 expect(explainedHp(prior,{...s,playerHp:40})).toBe(40);
 expect(explainedHp(prior,{...prior,playerHp:40})).toBe(60);
 expect(explainedHp({...prior,playerHp:10},{...s,playerHp:1})).toBe(1);
});
it.skipIf(!existsSync(RESEARCH_FILE))('offer nodes follow the 14.24 stage tags: {d02ae323}/{d12ae4b6}/{d22ae649} mean not at 2-1/3-2/4-2; Risky Moves only at 2-1', ()=>{
 const research=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')) as {apiName:string;item_tags_raw:string[]}[];
 const tag:Record<string,string>={'{d02ae323}':'2-1','{d12ae4b6}':'3-2','{d22ae649}':'4-2'};
 // The same reading reproduces the patch-note ban already in the rules: Black Rose crest/crown never at 2-1.
 for(const api of ['TFT13_Augment_CabalCrest','TFT13_Augment_CabalCrown'])expect(research.find(r=>r.apiName===api)!.item_tags_raw.filter(t=>tag[t]).map(t=>tag[t])).toEqual(['2-1']);
 for(const [id,row] of Object.entries(AUGMENT_BATCH3_XP)){
  const banned=research.find(r=>r.apiName===row.apiName)!.item_tags_raw.filter(t=>tag[t]).map(t=>tag[t]);
  expect([...row.nodes].sort()).toEqual(['2-1','3-2','4-2'].filter(n=>!banned.includes(n)));
  for(const node of ['2-1','3-2','4-2'])expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe((row.nodes as readonly string[]).includes(node));
 }
 expect(AUGMENT_BATCH3_XP['risky-moves'].nodes).toEqual(['2-1']);
 expect(AUGMENT_BATCH3_XP['epoch-plus'].nodes).toEqual(['3-2']);
});
