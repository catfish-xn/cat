import { existsSync,readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { AUGMENT_BATCH5_S3D } from '../src/simulation/content/augment-pool-batch5-s3d';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { combineItems,deployMatchUnit,equipItem,selectChoice,startMatchCombat } from '../src/simulation/match';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { qualityProjection,qualityHealth } from '../src/simulation/augment-pool-batch5-s3d';
import { readCombatStrategyInputs } from '../src/simulation/combat-input';
import { restoreMatch,serializeMatch } from '../src/simulation/serialization';
import { accepted,reachRoundFielded,resolveM5Choices } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';

const id='quality-over-quantity';
it.skipIf(!existsSync(RESEARCH_FILE))('transcribes the research numbers',()=>{
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===AUGMENT_BATCH5_S3D[id].apiName);
 expect(AUGMENT_BATCH5_S3D[id].source.values).toEqual(source.effects);
});
it('offers at the two permitted nodes',()=>{
 expect(AUGMENT_TIERS[id]).toBe('prismatic');
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(node!=='4-2');
  expect(augmentPool('prismatic',[],[],`round:${node}:augment`,[]).includes(id)).toBe(node!=='4-2');
 }
});
it('real selection and item commands freeze a radiant projection without changing inventory; restore rejects tampering',()=>{
 let open=reachRoundFielded('2-1',firstNodeSeed(id,101));
 for(let seed=firstNodeSeed(id,101)+1;open.items.filter(i=>i.location.kind==='inventory').length<2&&seed<=100;seed++){
  try { firstNodeSeed(id,1,seed); } catch { continue; }
  const candidate=reachRoundFielded('2-1',seed);if(candidate.pendingChoice?.offers.includes(id))open=candidate;
 }
 const choice=open.pendingChoice!;expect(choice.offers).toContain(id);
 let state=resolveM5Choices(accepted(selectChoice(open,choice.choiceId,choice.generation,id)));
 expect(state.consumables.filter(c=>c.definitionId==='magnetic-remover').length-open.consumables.filter(c=>c.definitionId==='magnetic-remover').length).toBe(2);
 const components=state.items.filter(i=>i.location.kind==='inventory');expect(components.length).toBeGreaterThanOrEqual(2);
 state=accepted(combineItems(state,components[0].id,components[1].id));
 const item=state.items.find(i=>i.location.kind==='inventory'&&i.definitionId!=='bow'&&!components.some(c=>c.id===i.id))!;
 const unit=state.preparation.units.find(u=>u.team==='player')!;
 state=accepted(deployMatchUnit(state,unit.id,{kind:'board',cell:{col:0,row:4}}));
 state=accepted(equipItem(state,item.id,unit.id,0));
 const projected=buildStrategySnapshot(readCombatStrategyInputs(state)).units.find(u=>u.unitId===unit.id)!;
 expect(projected.sources.some(s=>s.source.sourceKind==='item'&&s.source.sourceInstanceId===item.id&&s.source.sourceDefinitionId!==item.definitionId)).toBe(true);
 expect(projected.sources.some(s=>s.source.sourceDefinitionId===id&&s.effect.kind==='statPercentBps'&&s.effect.bps===1200)).toBe(true);
 expect(state.items.find(i=>i.id===item.id)!.definitionId).toBe(item.definitionId);
 const input=readCombatStrategyInputs(state), projectedInput=qualityProjection(input);
 const withSecond={...input,items:[...input.items,{id:'test-second',definitionId:'bow',location:{kind:'unit' as const,unitId:unit.id,slot:1}}]};
 expect(qualityProjection(withSecond).items.find(i=>i.id===item.id)!.definitionId).toBe(item.definitionId);
 const glove={...input,items:input.items.map(i=>i.id===item.id?{...i,definitionId:'thiefs-gloves'}:i)};
 expect(qualityProjection(glove).items.find(i=>i.id===item.id)!.definitionId).toBe('thiefs-gloves');
 expect(qualityHealth(projectedInput,unit.id)).toBe(true);
 const natural={...withSecond,items:withSecond.items.map(i=>i.id===item.id?{...i,definitionId:'TFT5_Item_WarmogsArmorRadiant'}:i)};
 expect(qualityHealth(qualityProjection(natural),unit.id)).toBe(true);
 expect(qualityHealth(qualityProjection(withSecond),unit.id)).toBe(false);
 const text=serializeMatch(state);expect(restoreMatch(text)).toEqual(state);expect(restoreMatch(JSON.parse(text))).toEqual(state);expect(restoreMatch(state)).toEqual(state);
 for(const mutate of [(x:any)=>{x.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch1').definitionId='reforger';},(x:any)=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>r.source!=='augment-pool-batch1');}]){
  const x=JSON.parse(text);mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();
 }
 const combat=accepted(startMatchCombat(state)),combatText=serializeMatch(combat);
 expect(restoreMatch(combatText)).toEqual(combat);expect(restoreMatch(JSON.parse(combatText))).toEqual(combat);expect(restoreMatch(combat)).toEqual(combat);
 const forged=JSON.parse(combatText);forged.combatInputBasis.inputs.items.find((i:any)=>i.id===item.id).definitionId='bow';
 expect(()=>restoreMatch(forged)).toThrow();expect(()=>restoreMatch(JSON.stringify(forged))).toThrow();expect(()=>serializeMatch(forged)).toThrow();
});
