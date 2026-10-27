import { existsSync,readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
import { AUGMENT_BATCH5_S3D } from '../src/simulation/content/augment-pool-batch5-s3d';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { augmentOfferAllowed } from '../src/simulation/augment-offers';
import { selectChoice,nextRound,startMatchCombat } from '../src/simulation/match';
import { restoreMatch,serializeMatch } from '../src/simulation/serialization';
import { accepted,emptyBoard,reachRound,resolveM5Choices } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { RESEARCH_FILE } from './augment-pool-source-expectations';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { G24_FORGE_POOLS } from '../src/simulation/content/g2-4-forges';
const id='replication';
const trip=(s:any)=>{const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);expect(restoreMatch(s)).toEqual(s);};
const reject=(s:any,mutate:(x:any)=>void)=>{const x=JSON.parse(serializeMatch(s));mutate(x);expect(()=>restoreMatch(x)).toThrow();expect(()=>restoreMatch(JSON.stringify(x))).toThrow();expect(()=>serializeMatch(x)).toThrow();};
it.skipIf(!existsSync(RESEARCH_FILE))('preserves source values',()=>{
 const source=JSON.parse(readFileSync(RESEARCH_FILE,'utf8')).find((r:any)=>r.apiName===AUGMENT_BATCH5_S3D[id].apiName);
 expect(AUGMENT_BATCH5_S3D[id].source.values).toEqual(source.effects);
});
it('offers at permitted nodes',()=>{
 expect(AUGMENT_TIERS[id]).toBe('gold');
 for(const node of ['2-1','3-2','4-2']){
  expect(augmentOfferAllowed(id,[],{node,fieldedTraits:[],blocked:[]})).toBe(node!=='4-2');
  expect(augmentPool('gold',[],[],`round:${node}:augment`,[]).includes(id)).toBe(node!=='4-2');
 }
});
it('selection grants the chosen component and one copy at each of two natural round entries',()=>{
 let s=reachRound('2-1',false,firstNodeSeed(id,101)),c=s.pendingChoice!;
 s=accepted(selectChoice(s,c.choiceId,c.generation,id));c=s.pendingChoice!;
 expect(c.kind).toBe('forge');expect(c.offers).toHaveLength(3);expect(new Set(c.offers).size).toBe(3);
 expect(c.offers.every(x=>G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(x))).toBe(true);trip(s);
 reject(s,x=>{x.pendingChoice.offers.reverse();});
 const picked=c.offers[1];s=accepted(selectChoice(s,c.choiceId,c.generation,picked));
 let receipts=s.seatMechanics!.receipts.filter(r=>r.kind==='choice'&&r.choiceKind==='forge'&&r.optionId===picked);expect(receipts).toHaveLength(1);trip(s);
 for(let n=1;n<=2;n++){
  s=accepted(startMatchCombat(emptyBoard(s)));s=resolveM5Choices(s);
  s=accepted(nextRound(s,s.round));s=resolveM5Choices(s);
  const gifts=s.seatMechanics!.receipts.filter(r=>r.kind==='item'&&r.source==='augment-pool-batch1'&&r.receiptId.includes('replication'));
  expect(gifts).toHaveLength(n);expect(gifts.every(r=>r.kind==='item'&&r.definitionId===picked)).toBe(true);trip(s);
 }
 s=accepted(startMatchCombat(emptyBoard(s)));s=resolveM5Choices(s);
 const previous=s;s=accepted(nextRound(s,s.round));
 expect(s.seatMechanics!.receipts.filter(r=>r.kind==='item'&&r.source==='augment-pool-batch1'&&r.receiptId.includes('replication'))).toHaveLength(2);
 expect(nextRound(s,previous.round).ok).toBe(false);trip(s);
 reject(s,x=>{x.seatMechanics.receipts.find((r:any)=>r.kind==='item'&&r.receiptId.includes('replication')).definitionId='reforger';});
 reject(s,x=>{x.seatMechanics.receipts=x.seatMechanics.receipts.filter((r:any)=>!(r.kind==='item'&&r.receiptId.includes('replication')));});
 reject(s,x=>{x.seatMechanics.receipts.find((r:any)=>r.kind==='choice'&&r.choiceKind==='forge').optionId='invalid';});
});
