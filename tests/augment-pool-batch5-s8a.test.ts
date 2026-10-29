import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { AUGMENT_BATCH5_S8A } from '../src/simulation/content/augment-pool-batch5-s8a';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { createMatch, nextRound, sellUnit, selectChoice, startMatchCombat, stepMatch, type MatchState, type MatchEvent } from '../src/simulation/match';
import { grantMechanicUnit } from '../src/simulation/seat-mechanics/grants';
import { SHOP_CATALOG } from '../src/simulation/match-rules';
import { pilferBattleCount, pilferRewardPlan } from '../src/simulation/augment-pool-batch5-s8a';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { digestContent, canonicalContent } from '../src/simulation/content';
import { ownBattleRecord, deepFreeze, recordVersion } from '../src/simulation/battle-record-validation';
import type { BattleRecord } from '../src/m6/contracts';
import { accepted, fieldBench, resolveM5Choices } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { readG23Progress } from '../src/simulation/g2-3-state';

it.skipIf(!existsSync(RESEARCH_FILE))('Pilfer copies the archived 14.24 effects and text',()=>{
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName==='TFT_Augment_Pilfer');
 expect(AUGMENT_BATCH5_S8A.pilfer.source.values).toEqual(source.effects);
 expect(AUGMENT_BATCH5_S8A.pilfer.description).toBe(source.description_zh_cn);
});
it('Pilfer is gold and offered on all three nodes',()=>{
 expect(AUGMENT_TIERS.pilfer).toBe('gold');
 for(const node of ['2-1','3-2','4-2']){const filter={node,fieldedTraits:[],blocked:[]};expect(augmentOfferAllowed('pilfer',[],filter)).toBe(true);expect(augmentCandidates('gold',[],[],null,filter)).toContain('pilfer');}
});
let state:MatchState;const battles:BattleRecord[]=[];
function fight(s:MatchState):MatchState {
 const context=fieldBench(s),started=startMatchCombat(context);let next=accepted(started);const initial=next.combat!,events:MatchEvent[]=[...(started.ok?started.events:[])];
 while(next.phase==='combat'){const step=stepMatch(next);next=step.state;events.push(...step.events);}
 const terminal=next.combat!,ledger=events.filter((e):e is BattleRecord['events'][number]=>e.domain==='combat');
 battles.push(ownBattleRecord(deepFreeze({version:recordVersion(context),roundId:context.roundDefinitionId,runId:'pilfer-s8a',combatId:terminal.combatId!,context,initial,events:ledger,endTick:terminal.tick,nextEventSeq:terminal.nextEventSeq!,result:terminal.result,stateHash:digestContent(terminal),eventHash:digestContent(ledger)})));
 return resolveM5Choices(next);
}
it('selects the actual 2-1 offer through Match commands',()=>{
 const seed=firstNodeSeed('pilfer',101);state=createMatch(seed);
 while(state.roundDefinitionId!=='2-1'){state=resolveM5Choices(state);state=fight(state);state=accepted(nextRound(state,state.round));}
 const choice=state.pendingChoice!;expect(choice.offers).toContain('pilfer');state=resolveM5Choices(accepted(selectChoice(state,choice.choiceId,choice.generation,'pilfer')));
 expect(pilferRewardPlan(state)).toEqual([]);
});
it('records a real first enemy hero death and grants the one-star copy once at next round',()=>{
 state=accepted(grantMechanicUnit(state,{receiptId:'pilfer-test-viktor',source:'test',definitionId:'viktor',starLevel:3}));
 state=fight(state);const combat=state.combat!;const count=pilferBattleCount(combat,'player',battles.at(-1)!.initial.units);expect(count).toBeGreaterThan(0);
 const victim=combat.units.find(u=>u.id===(combat.openingDeaths??[]).find(d=>combat.units.some(x=>x.id===d.unitId&&x.team==='enemy'&&!x.itemSummon&&!x.anomalySummon&&SHOP_CATALOG.includes(x.definitionId)))!.unitId)!;
 expect(SHOP_CATALOG[count!-1]).toBe(victim.definitionId);
 expect(readG23Progress(state)!.economyReceipts.at(-1)).toMatchObject({kind:'battle',facts:{batch2:expect.arrayContaining([{definitionId:'pilfer',count}])}});
 const previous=state.round;state=resolveM5Choices(accepted(nextRound(state,previous)));
 const gift=pilferRewardPlan(state).find(g=>g.acquiredRound===previous+1)!;expect(gift).toMatchObject({kind:'unit',definitionId:victim.definitionId,starLevel:1});
 expect(state.seatMechanics!.receipts.filter(r=>r.receiptId===gift.receiptId)).toHaveLength(1);
 const retry=nextRound(state,previous);expect(retry.ok).toBe(false);
});
it('all restore entries authenticate target, history and reward using completed replays',()=>{
 const text=serializeMatch(state,battles);expect(text).toBe(canonicalContent(state));
 const entries=[(x:any)=>restoreMatch(x,battles),(x:any)=>restoreMatch(JSON.stringify(x),battles),(x:any)=>serializeMatch(x,battles)];
 for(const entry of entries){entry(JSON.parse(text));for(const mutate of [
  (x:any)=>{x.seatMechanics.hidden.progress.economyReceipts.find((r:any)=>r.facts?.batch2?.some((v:any)=>v.definitionId==='pilfer')).facts.batch2.find((v:any)=>v.definitionId==='pilfer').count=1;},
  (x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.receiptId.includes('pilfer')&&r.kind==='unit').definitionId='mel';},
  (x:any)=>{x.seatMechanics.hidden.progress.economyReceipts.find((r:any)=>r.facts?.batch2?.some((v:any)=>v.definitionId==='pilfer')).facts.batch2=[];},
 ]){const altered=JSON.parse(text);mutate(altered);expect(()=>entry(altered)).toThrow();}}
 expect(()=>restoreMatch(text)).toThrow('missing historical evidence');
});
it('death-order filtering excludes summons and neutrals, admits six-costs and returns no target',()=>{
 const original=battles.at(-1)!.initial, ally=original.units.find(u=>u.team==='player')!,enemy=original.units.find(u=>u.team==='enemy')!;
 const make=(id:string,definitionId:string,extra:Record<string,unknown>={})=>({...enemy,id,definitionId,team:'enemy' as const,...extra});
 const combat={...original,units:[ally,make('neutral','pve-minion'),make('summon','viktor',{itemSummon:true}),make('six','viktor'),make('ordinary','amumu')],openingDeaths:[{unitId:'neutral',eventSeq:4},{unitId:'summon',eventSeq:5},{unitId:'six',eventSeq:6},{unitId:'ordinary',eventSeq:7}]};
 expect(pilferBattleCount(combat,'player',combat.units)).toBe(SHOP_CATALOG.indexOf('viktor')+1);
 expect(pilferBattleCount(combat,'player',combat.units.filter(u=>u.id!=='six'))).toBe(SHOP_CATALOG.indexOf('amumu')+1);
 expect(pilferBattleCount({...combat,openingDeaths:combat.openingDeaths.slice(0,2)},'player',combat.units)).toBe(0);
 expect(pilferBattleCount({...combat,openingDeaths:[combat.openingDeaths[3],combat.openingDeaths[2]]},'player',combat.units)).toBe(SHOP_CATALOG.indexOf('amumu')+1);
});

// P-B5-59 says next natural round: the 3-3 victim must also arrive during 3-4 supply.
for(let target=6;target<=14;target++)it(`Pilfer supply-boundary route to round ${target}`,()=>{
 state=resolveM5Choices(state);
 if(state.phase==='preparation'){
  for(const unit of state.preparation.units.filter(u=>u.team==='player'&&!['irelia','viktor'].includes(u.definitionId))) {
   const sold=sellUnit(state,unit.id);if(sold.ok)state=sold.state;
  }
  state=fight(state);
 }
 state=resolveM5Choices(accepted(nextRound(resolveM5Choices(state),state.round)));
 expect(state.round).toBe(target);
});
let supplyText:string;
it('grants exactly the authenticated 3-3 victim once at the 3-4 supply entry',()=>{
 expect(state.roundDefinitionId).toBe('3-4');
 const battle=readG23Progress(state)!.economyReceipts.find(r=>r.kind==='battle'&&r.facts.round===13)!;
 if(battle.kind!=='battle')throw Error('missing 3-3 battle');
 const count=battle.facts.batch2!.find(f=>f.definitionId==='pilfer')!.count;
 expect(count).toBeGreaterThan(0);
 const gift=pilferRewardPlan(state).find(g=>g.acquiredRound===14)!;
 expect(gift).toMatchObject({kind:'unit',definitionId:SHOP_CATALOG[count-1],starLevel:1});
 expect(state.seatMechanics!.receipts.filter(r=>r.receiptId===gift.receiptId)).toHaveLength(1);
 expect(state.resourceProvenance.entries.some(e=>e.kind==='unit-acquired'&&e.roundId==='3-4'&&e.source.kind==='mechanic'&&e.source.receiptId===gift.receiptId)).toBe(true);
});
it('serializes the authenticated supply-round copy with complete battle evidence',()=>{supplyText=serializeMatch(state,battles);});
it.each(['object','JSON','serialized'] as const)('restores the supply-round copy from %s',kind=>{
 expect(restoreMatch(kind==='object'?state:kind==='JSON'?JSON.stringify(state):supplyText,battles)).toEqual(state);
});
it('still refuses an unrelated co-forged mechanic birth during supply',()=>{
 const gift=pilferRewardPlan(state).find(g=>g.acquiredRound===14)!;
 const bad=structuredClone(state) as any,receipt=bad.seatMechanics.receipts.find((r:any)=>r.receiptId===gift.receiptId);
 receipt.receiptId='unrelated-supply-birth';receipt.source='test';
 bad.resourceProvenance.entries.find((e:any)=>e.kind==='unit-acquired'&&e.source.receiptId===gift.receiptId).source.receiptId=receipt.receiptId;
 expect(()=>restoreMatch(bad,battles)).toThrow();
});
