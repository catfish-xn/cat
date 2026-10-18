import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { S13_P2_SOURCE } from '../src/simulation/content/s13-augments-p2-source';
import { S13_P2_AUGMENTS, S13_P2_ANOMALIES, S13_P2_TIERS, P2_ITEM_GRANTS } from '../src/simulation/content/s13-augments-p2';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { generateChoices } from '../src/simulation/choices';
import { createMatch, selectChoice, deployMatchUnit, startMatchCombat, stepMatch, sellUnit } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { drainP2Gifts, p2GiftPlan, validateP2Gifts } from '../src/simulation/s13-augments-p2-grants';
import { accepted, reachRound } from './match-helpers';
import { UNIT_DEFINITIONS } from '../src/simulation/units';

it('all seventeen API identities, names, tiers and coefficients match the retained raw B-patch source',()=>{
  const raw=JSON.parse(gunzipSync(readFileSync('src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz')).toString());
  const zh=JSON.parse(gunzipSync(readFileSync('src/simulation/content/source/s13-14.24b/raw/zh_cn.tft.stringtable.json.gz')).toString()).entries;
  expect(Object.keys(S13_P2_AUGMENTS)).toHaveLength(14);expect(Object.keys(S13_P2_ANOMALIES)).toHaveLength(3);
  for(const [id,source] of Object.entries(S13_P2_SOURCE)){
    const original=raw[source.rawKey];expect(original.mName??original.name).toBe(source.apiName);
    const values=original.effectAmounts?Object.fromEntries(original.effectAmounts.map((e:any)=>[e.name,Number((e.value??0).toFixed(6))]))
      :Object.fromEntries(Object.entries(original.constants['{df085b93}']).map(([k,v])=>[k,Number(((v as any).mValue??0).toFixed(6))]));
    expect(source.values).toEqual(values);
    expect(source.name).toBe(zh[(original.mDisplayNameTra??source.apiName+'_Title').toLowerCase()]);
    if('tier' in source){expect(S13_P2_TIERS[id]).toBe(source.tier);expect(original.ItemTags).toContain(source.tier==='gold'?'{ce1fd21c}':'{cf1fd3af}');}
    expect((S13_P2_AUGMENTS[id]??S13_P2_ANOMALIES[id]).description).not.toMatch(/@[a-z0-9_*]+@/i);
  }
});
function seedFor(id:string){for(let seed=0;seed<1000;seed++)if(generateChoices(Object.keys(AUGMENT_DEFINITIONS),createMatch(seed).choiceRngState).offers.includes(id))return seed;throw Error('seed budget');}
it.each(Object.keys(S13_P2_AUGMENTS))('%s public acquisition grants once, restores strictly, and continues the same seeded combat',id=>{
  let s=reachRound('2-1',false,seedFor(id));const before=s,c=s.pendingChoice!;expect(c.offers).toContain(id);
  s=accepted(selectChoice(s,c.choiceId,c.generation,id));
  const gifts=p2GiftPlan(s),receipts=s.seatMechanics!.receipts.filter(r=>r.source==='s13-augments-p2');
  expect(receipts).toHaveLength(gifts.length);expect(gifts.length).toBe(P2_ITEM_GRANTS[id]?.count??(id==='all-for-one-ii'||id==='trifecta-ii'?3:id==='pair-of-fours'?1:0));
  expect(s.choiceRngState).toBe(before.choiceRngState);expect(s.rewardRngState).toBe(before.rewardRngState);
  expect(drainP2Gifts(s)).toBe(s);expect(selectChoice(s,c.choiceId,c.generation,id)).toEqual({ok:false,state:s,reason:'wrong-phase'});
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
  if(id==='trifecta-ii'){
    const targets=s.preparation.units.filter(u=>u.team==='player'&&UNIT_DEFINITIONS[u.definitionId].cost===3);
    for(const [i,u] of targets.entries())s=accepted(deployMatchUnit(s,u.id,{kind:'board',cell:{col:i,row:7}}));
  }else {const first=s.preparation.units.find(u=>u.team==='player')!;s=accepted(deployMatchUnit(s,first.id,{kind:'board',cell:{col:1,row:7}}));}
  s=accepted(startMatchCombat(s));
  expect(restoreMatch(serializeMatch(s))).toEqual(s);
  if(['calculated-enhancement','trifecta-ii'].includes(id)){
    expect(s.combat!.rngDraws).toBeGreaterThan(0);
    const forged=JSON.parse(serializeMatch(s));delete forged.combat.units.find((u:any)=>u.s13P2Opening).s13P2Opening;
    expect(()=>restoreMatch(forged)).toThrow('S13 P2 opening');
  }
  for(let tick=0;tick<3&&s.phase==='combat';tick++)s=stepMatch(s).state;
  const restored=restoreMatch(serializeMatch(s));expect(restored).toEqual(s);expect(stepMatch(restored)).toEqual(stepMatch(s));
  if(gifts.length){const forged=structuredClone(s) as any;forged.seatMechanics.receipts.find((r:any)=>r.source==='s13-augments-p2').definitionId='lux';expect(()=>validateP2Gifts(forged)).toThrow();}
});
it('full bench escrows all hero gifts, selling retries the same plan and never duplicates a receipt',()=>{
  let s=reachRound('2-1',false,seedFor('all-for-one-ii'));const c=s.pendingChoice!;
  const heroes=Object.keys(UNIT_DEFINITIONS).filter(id=>!UNIT_DEFINITIONS[id].summon).slice(0,9);
  s={...s,preparation:{...s.preparation,units:[...s.preparation.units.map(u=>u.team==='player'?{...u,location:{kind:'board' as const,cell:{col:0,row:4}}}:u),...heroes.map((definitionId,i)=>({id:`unit-${i+100}`,definitionId,starLevel:3 as const,team:'player' as const,location:{kind:'bench' as const,slot:i}}))]},nextUnitSerial:200};
  s=accepted(selectChoice(s,c.choiceId,c.generation,'all-for-one-ii'));
  expect(s.seatMechanics!.receipts.filter(r=>r.source==='s13-augments-p2')).toHaveLength(0);
  const planned=p2GiftPlan(s);s=accepted(sellUnit(s,'unit-100'));
  expect(s.seatMechanics!.receipts.filter(r=>r.source==='s13-augments-p2')).toHaveLength(1);
  expect(s.seatMechanics!.receipts.find(r=>r.source==='s13-augments-p2')).toMatchObject({receiptId:planned[0].receiptId,definitionId:planned[0].definitionId});expect(drainP2Gifts(s)).toBe(s);
});
