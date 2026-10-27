import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_S6C } from '../src/simulation/content/augment-pool-batch5-s6c';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { advanceMultiplayerRound, selectChoice, startMatchCombat, type MatchState } from '../src/simulation/match';
import { applyRoundSettlement, enableMultiplayerSettlement, ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import { deferredRoundIncome } from '../src/simulation/deferred-income';
import { resolveRoundEconomy } from '../src/simulation/round-economy';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { validateBatch5S6cGold } from '../src/simulation/augment-pool-batch5-s6c';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { firstNodeSeed, offerFor } from './augment-stage-helpers';
import { emptyBoard, reachRound, resolveM5Choices } from './match-helpers';
import { augmentPool, augmentGold } from './fixtures/m5/oracle.g2.cjs';

function accepted(r:{readonly ok:true;readonly state:MatchState}|{readonly ok:false;readonly reason:string}):MatchState {
 expect(r.ok).toBe(true);if(!r.ok)throw new Error(r.reason);return r.state;
}
const id='tiniest-titan';
it.skipIf(!existsSync(RESEARCH_FILE))('B5-48 preserves independent 14.24 source',()=>{
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===AUGMENT_BATCH5_S6C[id].apiName);
 expect(AUGMENT_BATCH5_S6C[id].source.values).toEqual(source.effects);
 expect(AUGMENT_BATCH5_S6C[id].description).toBe(source.description_zh_cn);
});
it('B5-48 tier, offer nodes and independent offer table',()=>{
 expect(AUGMENT_TIERS[id]).toBe('prismatic');
 for(const node of ['2-1','3-2','4-2']){
  const allowed=node==='2-1';
  expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(allowed);
  expect(augmentPool('prismatic',[],[],`round:${node}:augment`,[]).includes(id)).toBe(allowed);
 }
});
function choose():MatchState {
 const open=reachRound('2-1',false,firstNodeSeed(id,10000)),choice=open.pendingChoice!;
 expect(choice.offers).toContain(id);
 return resolveM5Choices(accepted(selectChoice(open,choice.choiceId,choice.generation,id)));
}
function receipt(s:MatchState,result:'win'|'loss'|'draw'='loss') {
 const combatResult=result==='win'?'playerWin':result==='loss'?'enemyWin':'draw';
 const plan=resolveRoundEconomy({augments:s.augments,roundId:s.roundDefinitionId,result:combatResult,gold:s.gold,streak:s.streak,level:s.level,xp:s.xp,hp:s.playerHp,enemySurvivors:0});
 return {version:ROUND_SETTLEMENT_VERSION,settlementId:`s6c:${s.round}`,battleId:`battle:${s.round}`,seatId:'seat',round:s.round,roundId:s.roundDefinitionId,settlementEligible:true,result,damage:plan.playerDamage,baseDamage:plan.baseDamage,opposingSurvivors:0,growth:[],combatTicks:10,combatEventCount:2};
}
function trip(s:MatchState) {const json=serializeMatch(s);expect(restoreMatch(json)).toEqual(s);expect(restoreMatch(JSON.parse(json))).toEqual(s);expect(restoreMatch(s)).toEqual(s);}
function reject(s:MatchState,mutate:(x:any)=>void){const x=JSON.parse(serializeMatch(s));mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();}
it('B5-48 real pick and PvP settlement pay once after damage; restore rejects forged hp and receipts',()=>{
 let s=choose();trip(s);
 s=accepted(enableMultiplayerSettlement(s,'seat'));const before=s,r=receipt(s);
 const outcome=applyRoundSettlement(s,r),settled=accepted(outcome);
 expect(outcome.ok&&outcome.events.some(e=>e.type==='mechanicGranted'&&e.receipt.source==='augment-pool-batch5-s6c')).toBe(true);
 expect(settled.roundResults.at(-1)!.hpAfter).toBe(before.playerHp-r.damage);
 expect(settled.playerHp).toBe(Math.min(100,before.playerHp-r.damage+2));
 expect(settled.gold).toBe(settled.roundResults.at(-1)!.goldAfter-deferredRoundIncome(settled.roundResults.at(-1)!)+1);
 expect(settled.seatMechanics!.receipts.filter(x=>x.source==='augment-pool-batch5-s6c')).toHaveLength(1);
 expect(()=>validateBatch5S6cGold(settled)).not.toThrow();
 for(const mutate of [(x:any)=>{x.seatMechanics.receipts.find((v:any)=>v.source==='augment-pool-batch5-s6c').amount++;},
  (x:any)=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((v:any)=>v.source!=='augment-pool-batch5-s6c');},
  (x:any)=>{x.seatMechanics.receipts.find((v:any)=>v.source==='augment-pool-batch5-s6c').roundId='2-2';}]){
  const changed=structuredClone(settled);mutate(changed);expect(()=>validateBatch5S6cGold(changed)).toThrow();
 }
 const again=applyRoundSettlement(settled,r);expect(again.ok).toBe(false);expect(again.state).toBe(settled);
 const next=accepted(advanceMultiplayerRound(settled,settled.round));const nextReceipt=receipt(next);
 const nextSettled=accepted(applyRoundSettlement(next,nextReceipt));
 expect(nextSettled.playerHp).toBe(Math.min(100,next.playerHp-nextReceipt.damage+2));
 expect(nextSettled.seatMechanics!.receipts.filter(x=>x.source==='augment-pool-batch5-s6c')).toHaveLength(2);
 expect(()=>validateBatch5S6cGold(nextSettled)).not.toThrow();
 const mirror=applyRoundSettlement(before,{...r,settlementEligible:false});expect(mirror.ok).toBe(false);expect(mirror.state).toBe(before);
});
it('B5-48 ignores offline opponent and lethal PvP; healing never revives',()=>{
 const solo=choose(),offline=accepted(startMatchCombat(emptyBoard(solo)));
 expect(offline.seatMechanics?.receipts.filter(x=>x.source==='augment-pool-batch5-s6c')??[]).toHaveLength(0);
 let s=accepted(enableMultiplayerSettlement(solo,'seat'));s={...s,playerHp:1};
 const dead=accepted(applyRoundSettlement(s,receipt(s)));
 expect(dead.playerHp).toBe(0);expect(dead.multiplayer!.status).toBe('eliminated');
 expect(dead.seatMechanics?.receipts.filter(x=>x.source==='augment-pool-batch5-s6c')??[]).toHaveLength(0);
});

const plus='tiniest-titan-plus';
it.skipIf(!existsSync(RESEARCH_FILE))('B5-49 preserves independent 14.24 values and descriptions',()=>{
 const row=AUGMENT_BATCH5_S6C[plus],source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===row.apiName);
 expect(row.source.values).toEqual(source.effects);expect(row.description).toBe(source.description_zh_cn);expect(row.source.description_en_us).toBe(source.description_en_us);
});
it('B5-49 exact offer node, tier and mutual exclusion',()=>{
 expect(AUGMENT_TIERS[plus]).toBe('prismatic');
 for(const node of ['2-1','3-2','4-2']){
  const allowed=node==='3-2';expect(augmentOfferAllowed(plus,[],{node,fieldedTraits:[],blocked:[]})).toBe(allowed);
  expect(augmentPool('prismatic',[],[],`round:${node}:augment`,[]).includes(plus)).toBe(allowed);
 }
 for(const [a,b] of [[id,plus],[plus,id]])expect(augmentOfferAllowed(a,[{definitionId:b,choiceId:'held',acquiredRound:1}],{node:a===id?'2-1':'3-2',fieldedTraits:[],blocked:[]})).toBe(false);
});
it('B5-49 public 3-2 selection pays 15 once and offline snapshots authenticate it',()=>{
 const open=offerFor(plus),choice=open.pendingChoice!;expect(choice.offers).toContain(plus);
 const s=accepted(selectChoice(open,choice.choiceId,choice.generation,plus));expect(s.gold-open.gold).toBe(15);expect(augmentGold(plus,'3-2')).toBe(15);trip(s);
 const finished=accepted(startMatchCombat(emptyBoard(resolveM5Choices(s))));trip(finished);reject(finished,x=>{x.gold++;});
 reject(s,x=>{x.scheduleReceipts.find((r:any)=>r.definitionId===plus).gold++;});
 const again=selectChoice(s,choice.choiceId,choice.generation,plus);expect(again.ok).toBe(false);expect(again.state).toBe(s);
});
it('B5-49 authentic multiplayer PvP pays recurring 2 HP and 1 gold only for survivors',()=>{
 const open=offerFor(plus),choice=open.pendingChoice!;
 let s=resolveM5Choices(accepted(selectChoice(open,choice.choiceId,choice.generation,plus)));
 s=accepted(enableMultiplayerSettlement(s,'seat'));const r=receipt(s),settled=accepted(applyRoundSettlement(s,r));
 expect(settled.playerHp).toBe(Math.min(100,s.playerHp-r.damage+2));
 expect(settled.gold).toBe(settled.roundResults.at(-1)!.goldAfter-deferredRoundIncome(settled.roundResults.at(-1)!)+1);
 expect(settled.seatMechanics!.receipts.filter(v=>v.source==='augment-pool-batch5-s6c')).toHaveLength(1);
 expect(()=>validateBatch5S6cGold(settled)).not.toThrow();
 const dead={...s,playerHp:1},deadResult=accepted(applyRoundSettlement(dead,receipt(dead)));
 expect(deadResult.playerHp).toBe(0);expect(deadResult.seatMechanics?.receipts.filter(v=>v.source==='augment-pool-batch5-s6c')??[]).toHaveLength(0);
});
