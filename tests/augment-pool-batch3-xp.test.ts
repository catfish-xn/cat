import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { createMatch, buyXp, rerollShop, selectChoice, startMatchCombat, nextRound } from '../src/simulation/match';
import type { MatchState } from '../src/simulation/match-types';
import { AUGMENT_BATCH3_XP, AUGMENT_BATCH3_XP_BLOCKED } from '../src/simulation/content/augment-pool-batch3-xp';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { augmentOfferAllowed, augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { generateChoices } from '../src/simulation/choices';
import { batch3EntryXp, xpPurchaseAmount, batch3XpFreeRerolls, AUGMENT_ACQUISITION_LEVEL_KEY } from '../src/simulation/augment-xp';
import { freeRerollsAvailable } from '../src/simulation/free-rerolls';
import { getMultiplayerRoundByOrdinal } from '../src/simulation/multiplayer-round';
import { writeSeatMechanic } from '../src/simulation/seat-mechanics/state';
import { validateBatch1Gifts } from '../src/simulation/augment-pool-grants';
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

it('the five XP rows carry their 14.24 zh_cn name, tier, description and values; Upward Mobility stays out of the pool', ()=>{
 const research=JSON.parse(readFileSync('/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json','utf8')) as {apiName:string;name_zh_cn:string;description_zh_cn:string;tier:number;effects:Record<string,number>}[];
 expect(Object.keys(AUGMENT_BATCH3_XP).sort()).toEqual(['epoch','epoch-plus','level-up','patient-study','shopping-spree']);
 for(const [id,row] of Object.entries(AUGMENT_BATCH3_XP)){
  const r=research.find(x=>x.apiName===row.apiName)!;
  expect([row.name,row.description,row.tier,row.source.values]).toEqual([r.name_zh_cn,r.description_zh_cn,['silver','gold','prismatic'][r.tier-1],r.effects]);
  expect(AUGMENT_DEFINITIONS[id].name).toBe(r.name_zh_cn);expect(AUGMENT_TIERS[id]).toBe(row.tier);expect(AUGMENT_POOL_API_NAMES[id]).toBe(row.apiName);
 }
 for(const id of Object.keys(AUGMENT_BATCH3_XP_BLOCKED))expect([AUGMENT_DEFINITIONS[id],AUGMENT_TIERS[id],AUGMENT_POOL_API_NAMES[id]]).toEqual([undefined,undefined,undefined]);
 expect(Object.values(AUGMENT_POOL_API_NAMES)).not.toContain('TFT_Augment_UpwardMobility');
});
it('Epoch and Epoch+ exclude each other, Shopping Spree excludes Trade Sector (14.24 static mutex)', ()=>{
 const own=(id:string)=>owned(id,1),ctx={node:'3-2',fieldedTraits:[],blocked:[]};
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
