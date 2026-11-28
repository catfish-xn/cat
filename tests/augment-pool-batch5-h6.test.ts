import { needsOpponentHp } from '../src/simulation/augment-settlement-gold';
import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { contestedAmount } from '../src/simulation/augment-pool-batch5-h6';
import { AUGMENT_BATCH5_H6 } from '../src/simulation/content/augment-pool-batch5-h6';
import { offeredAt } from './augment-stage-helpers';
import { reachRound, accepted, resolveM5Choices } from './match-helpers';
import { selectChoice, startMatchCombat, stepMatch } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
const RESEARCH_FILE='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
/** v25 pool drift: first bounded 3-2 seed whose public offers include contested (STAGE_SEEDS still lists 12 for reroll-only routes).
 * v26 D5 (7953c99a) added four cards and stage bans, moving the 2-1 and 3-2 draws (old seed 14). Re-searched the same
 * reachRound('3-2', false) route from 0: seed 159 is the first whose unrerolled 3-2 offer includes contested. */
const CONTESTED_OFFER_SEED=159;
/** v25 pool drift: first bounded 2-1 seed whose public offers include scoreboard-scrapper.
 * v26 D5 (7953c99a) moved the 2-1 draws (old seed 11); re-searched from 0: seed 1 offers it without rerolls. */
const SCOREBOARD_OFFER_SEED=1;
it.skipIf(!existsSync(RESEARCH_FILE))('archive values and stage tags',()=>{
 const row=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT_Augment_Contested');
 expect(row.effects).toEqual(AUGMENT_BATCH5_H6.contested.source.values);
 expect(['2-1','3-2','4-2'].map(n=>offeredAt('contested',n as '2-1'|'3-2'|'4-2'))).toEqual([false,true,false]);
});
it('selects via real 3-2 offer, freezes a solo PvP roster, and authenticates three restore entries',()=>{
 let s=reachRound('3-2',false,CONTESTED_OFFER_SEED);
 expect(s.pendingChoice?.offers).toContain('contested');
 const c=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,'contested'));
 s=resolveM5Choices(s);s=accepted(startMatchCombat(s));
 while(s.phase==='combat')s=stepMatch(s).state;
 expect(contestedAmount(s,s.round)).toBe(0);
 for(const form of ['object','json','serialized'] as const){
  const input=form==='object'?s:form==='json'?JSON.stringify(s):serializeMatch(s);
  expect(restoreMatch(input)).toEqual(s);
  const bad:any=form==='serialized'?JSON.parse(serializeMatch(s)):structuredClone(s);bad.augmentHistory.facts.find((f:any)=>f.kind==='pvp-roster').seats[0].hp--;
  const badInput=form==='object'?bad:JSON.stringify(bad);
  expect(()=>restoreMatch(badInput)).toThrow();
 }
});
it('settlement pays once per two other live players from the frozen roster, ignoring duplicate heroes and eliminated players',async()=>{
 const {enableMultiplayerSettlement,applyRoundSettlement,ROUND_SETTLEMENT_VERSION}=await import('../src/simulation/round-settlement');
 const {recordAugmentPvpRoster,historyRoster,prepareAugmentAcquisition,captureAugmentHistoryAuthority}=await import('../src/simulation/augment-history');
 const {validateAugmentHistory}=await import('../src/simulation/augment-history-restore');
 let s=reachRound('3-2',false,CONTESTED_OFFER_SEED);
 const enabled=enableMultiplayerSettlement(s,'s0');expect(enabled.ok).toBe(true);if(!enabled.ok)throw new Error(enabled.reason);s=enabled.state;
 prepareAugmentAcquisition(s,{status:'none'},0,[{...historyRoster(s),seatId:'s0',index:0,hp:s.playerHp,alive:true,rank:1,eliminatedRound:null}]);
 const c=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,'contested'));s=resolveM5Choices(s);
 const roster=historyRoster(s), hero=roster.units.find(u=>u.location.kind==='bench')!;expect(hero).toBeDefined();
 const board={...hero,location:{kind:'board' as const,cell:{col:0,row:4}}};
 const seat=(id:string,index:number,alive:boolean,units:typeof roster.units)=>({...roster,seatId:id,index,hp:alive?90:0,alive,rank:index+1,eliminatedRound:alive?null:s.round-1,units});
 s=recordAugmentPvpRoster(s,'battle-1',[seat('s0',0,true,roster.units),seat('s1',1,true,[board,board]),seat('s2',2,true,[board]),seat('s3',3,true,[board]),seat('s4',4,false,[board])],null);
 expect(contestedAmount(s,s.round)).toBe(2);
 const {resolveRoundEconomy}=await import('../src/simulation/round-economy');
 const plan=resolveRoundEconomy({augments:s.augments,roundId:s.roundDefinitionId,result:'playerWin',gold:s.gold,streak:s.streak,level:s.level,xp:s.xp,hp:s.playerHp,enemySurvivors:0});
 const {openingEncounterId}=await import('../src/simulation/opening-encounter');
 const openingFacts=openingEncounterId(s)==='warwicks-hunger'?{g23Facts:{battleId:'battle-1',round:s.round,roundKind:'pvp' as const,result:'win' as const,conquerorTier:0,chemBaronTier:0,conquestTakedowns:[],alliedDeaths:0,rumbleStar:0 as const,highRollerGold:0,openingDeaths:[]}}:{};
 const result=applyRoundSettlement(s,{version:ROUND_SETTLEMENT_VERSION,settlementId:'settlement-1',battleId:'battle-1',seatId:'s0',round:s.round,roundId:s.roundDefinitionId,settlementEligible:true,result:'win',damage:plan.playerDamage,baseDamage:plan.baseDamage,opposingSurvivors:0,growth:[],combatTicks:1,combatEventCount:1,...(needsOpponentHp(s.augments,s.round)?{opponentHp:90}:{}),...openingFacts});
 expect(result.ok, result.ok?undefined:result.reason).toBe(true);if(!result.ok)throw new Error(result.reason);
 expect(result.state.seatMechanics?.receipts.filter(r=>r.source==='augment-pool-batch5-h6')).toMatchObject([{kind:'gold',amount:2}]);
 expect(result.events.some(e=>e.type==='mechanicGranted'&&e.receipt.source==='augment-pool-batch5-h6')).toBe(true);
 const authority=captureAugmentHistoryAuthority(result.state);expect(()=>validateAugmentHistory(result.state,authority)).not.toThrow();
 for(const form of ['object','json','serialized'] as const){
  const bad:any=form==='object'?structuredClone(result.state):JSON.parse(JSON.stringify(result.state));
  bad.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5-h6').amount++;
  expect(()=>validateAugmentHistory(bad,authority)).toThrow();
 }
 const retry=applyRoundSettlement(result.state,{version:ROUND_SETTLEMENT_VERSION,settlementId:'settlement-1'});expect(retry.ok).toBe(false);expect(retry.state).toBe(result.state);
});
it.skipIf(!existsSync(RESEARCH_FILE))('scoreboard source and offer stages',()=>{
 const row=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT11_Augment_ScoreboardScrapper');
 expect(row.effects).toEqual(AUGMENT_BATCH5_H6['scoreboard-scrapper'].source.values);
 expect(['2-1','3-2','4-2'].map(n=>offeredAt('scoreboard-scrapper',n as '2-1'|'3-2'|'4-2'))).toEqual([true,false,false]);
});
it('scoreboard entry records 150 bps AD and 150 centi AP on every current ordinary hero',async()=>{
 const {nextRound}=await import('../src/simulation/match');
 const {recordAugmentTable,historyRoster,readAugmentGrowth}=await import('../src/simulation/augment-history');
 const {scoreboardCombatGrowth}=await import('../src/simulation/augment-pool-batch5-h6-scoreboard');
 const {enableMultiplayerSettlement,applyRoundSettlement,ROUND_SETTLEMENT_VERSION}=await import('../src/simulation/round-settlement');
 const {prepareAugmentAcquisition,captureAugmentHistoryAuthority}=await import('../src/simulation/augment-history');
 const {validateAugmentHistory}=await import('../src/simulation/augment-history-restore');
 const {resolveRoundEconomy}=await import('../src/simulation/round-economy');
 const {buildStrategySnapshot}=await import('../src/simulation/strategy-snapshot');
 const {readCombatStrategyInputs}=await import('../src/simulation/combat-input');
 const {fieldBench}=await import('./match-helpers');
 const seed=SCOREBOARD_OFFER_SEED;
 let s=reachRound('2-1',false,seed);
 const enabled=enableMultiplayerSettlement(s,'s0');expect(enabled.ok).toBe(true);if(!enabled.ok)throw new Error(enabled.reason);s=enabled.state;
 prepareAugmentAcquisition(s,{status:'none'},0,[{...historyRoster(s),seatId:'s0',index:0,hp:s.playerHp,alive:true,rank:5,eliminatedRound:null}]);
 const c=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,'scoreboard-scrapper'));s=resolveM5Choices(s);
 const plan=resolveRoundEconomy({augments:s.augments,roundId:s.roundDefinitionId,result:'playerWin',gold:s.gold,streak:s.streak,level:s.level,xp:s.xp,hp:s.playerHp,enemySurvivors:0});
 const settled=applyRoundSettlement(s,{version:ROUND_SETTLEMENT_VERSION,settlementId:'score-1',battleId:'battle-1',seatId:'s0',round:s.round,roundId:s.roundDefinitionId,settlementEligible:true,result:'win',damage:plan.playerDamage,baseDamage:plan.baseDamage,opposingSurvivors:0,growth:[],combatTicks:1,combatEventCount:1,...(needsOpponentHp(s.augments,s.round)?{opponentHp:90}:{})});
 expect(settled.ok).toBe(true);if(!settled.ok)throw new Error(settled.reason);s=settled.state;
 s=accepted(nextRound(s,s.round));const roster=historyRoster(s);
 s=recordAugmentTable(s,'entry',[{...roster,seatId:'s0',index:0,hp:s.playerHp,alive:true,rank:5,eliminatedRound:null}]);
 for(const hero of roster.units)expect(readAugmentGrowth(s,hero.id)).toMatchObject({attackDamageBps:150,abilityPowerCenti:150});
 expect(scoreboardCombatGrowth(s,roster.units.map(u=>u.id))?.every(g=>g.healthBps===0)).toBe(true);
 s=fieldBench(s);
 const strategy=buildStrategySnapshot(readCombatStrategyInputs(s));
 expect(strategy.units.some(u=>u.sources.some(x=>x.source.sourceDefinitionId==='scoreboard-scrapper'&&x.effect.kind==='statPercentBps'&&x.effect.stat==='attackDamage'&&x.effect.bps===150))).toBe(true);
 expect(strategy.units.some(u=>u.sources.some(x=>x.source.sourceDefinitionId==='scoreboard-scrapper'&&x.effect.kind==='mechanic'&&x.effect.mechanic==='fractionalFlat'&&x.effect.values.abilityPowerCenti===150))).toBe(true);
 const authority=captureAugmentHistoryAuthority(s);expect(()=>validateAugmentHistory(s,authority)).not.toThrow();
 for(const form of ['object','json','serialized'] as const){
  const bad:any=form==='object'?structuredClone(s):JSON.parse(JSON.stringify(s));
  bad.augmentHistory.facts.find((f:any)=>f.kind==='growth').deltas[0].abilityPowerCenti++;
  expect(()=>validateAugmentHistory(bad,authority)).toThrow();
 }
 const entry=s.augmentHistory!.facts.find(f=>f.kind==='growth');expect(entry?.kind).toBe('growth');
});
it('scoreboard solo entry uses its single-seat rank, applies HP in combat, and rejects tampering at three restore entries',async()=>{
 const {nextRound}=await import('../src/simulation/match');
 const {fieldBench}=await import('./match-helpers');
 const seed=SCOREBOARD_OFFER_SEED;
 let s=reachRound('2-1',false,seed);const c=s.pendingChoice!;s=accepted(selectChoice(s,c.choiceId,c.generation,'scoreboard-scrapper'));
 s=resolveM5Choices(s);s=accepted(startMatchCombat(s));while(s.phase==='combat')s=stepMatch(s).state;s=resolveM5Choices(s);
 s=accepted(nextRound(s,s.round));s=resolveM5Choices(s);s=fieldBench(s);s=accepted(startMatchCombat(s));
 expect(s.combatInputBasis?.inputs.h6Growth?.some(g=>g.healthBps===1000)).toBe(true);
 expect(s.combat?.strategy?.units.some(u=>u.sources.some(x=>x.source.sourceDefinitionId==='scoreboard-scrapper'&&x.effect.kind==='statPercentBps'&&x.effect.stat==='maxHp'&&x.effect.bps===1000))).toBe(true);
 for(const form of ['object','json','serialized'] as const){
  const input=form==='object'?s:form==='json'?JSON.stringify(s):serializeMatch(s);
  expect(restoreMatch(input)).toEqual(s);
  for(const edit of [(x:any)=>{x.augmentHistory.facts.find((f:any)=>f.kind==='table'&&f.stage==='entry').seats[0].rank=5;},(x:any)=>{x.combatInputBasis.inputs.h6Growth[0].healthBps++;}]){
   const bad:any=form==='serialized'?JSON.parse(serializeMatch(s)):structuredClone(s);edit(bad);
   expect(()=>restoreMatch(form==='object'?bad:JSON.stringify(bad))).toThrow();
  }
 }
});
