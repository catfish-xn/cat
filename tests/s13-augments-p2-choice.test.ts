import { grantMechanicItem } from '../src/simulation/seat-mechanics';
import { expect, it } from 'vitest';
import type { MatchState } from '../src/simulation/match-types';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { S13_P2_SOURCE } from '../src/simulation/content/s13-augments-p2-source';
import { S13_P2_AUGMENTS, S13_P2_ANOMALIES, S13_P2_TIERS, P2_ITEM_GRANTS } from '../src/simulation/content/s13-augments-p2';
import { generateChoices } from '../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../src/simulation/augment-offers';
import { createMatch, selectChoice, deployMatchUnit, startMatchCombat, stepMatch, sellUnit, buyUnit, nextRound, equipItem } from '../src/simulation/match';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { drainP2Gifts, p2GiftPlan, validateP2Gifts } from '../src/simulation/s13-augments-p2-grants';
import { accepted, reachRound, resolveM5Choices, emptyBoard } from './match-helpers';
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
function seedFor(id:string){for(let seed=0;seed<1000;seed++){const state=createMatch(seed);if(generateChoices(augmentCandidates(resolveAugmentTier(state,'round:2-1:augment'),[],[],null,{node:'2-1',fieldedTraits:[],blocked:[]}),state.choiceRngState).offers.includes(id))return seed;}throw Error('seed budget');}
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

function pendingFullBench(seed=42):MatchState{
  const base=createMatch(seed);
  return {...base,phase:'preparation' as const,combat:null,pendingChoice:null,level:9,gold:100,nextUnitSerial:100,
    augments:[{definitionId:'all-for-one-ii',choiceId:'pending',acquiredRound:1}],
    preparation:{...base.preparation,units:[...base.preparation.units,...Array.from({length:9},(_,i)=>({id:`b${i}`,definitionId:'lux',team:'player' as const,starLevel:3 as const,location:{kind:'bench' as const,slot:i}}))]}};
}
it('deploying off a full bench immediately retries pending P2 gifts',()=>{
  const before=pendingFullBench(),s=accepted(deployMatchUnit(before,'b0',{kind:'board',cell:{col:6,row:7}}));
  expect(s.seatMechanics!.receipts.filter(r=>r.source==='s13-augments-p2')).toHaveLength(1);
  expect(s.preparation.units.filter(u=>u.location.kind==='bench')).toHaveLength(9);
  expect(drainP2Gifts(s)).toBe(s);
});
it('a purchased triple frees capacity and immediately retries pending P2 gifts',()=>{
  let s=pendingFullBench();
  s={...s,preparation:{...s.preparation,units:s.preparation.units.map(u=>['b0','b1'].includes(u.id)?{...u,definitionId:'darius',starLevel:1 as const}:u)},shop:{...s.shop,slots:[{status:'available',definitionId:'darius'},...s.shop.slots.slice(1)]}};
  const result=buyUnit(s,0,s.shop.generation);s=accepted(result);
  expect(s.preparation.units.some(u=>u.definitionId==='darius'&&u.starLevel===2)).toBe(true);
  expect(s.seatMechanics!.receipts.some(r=>r.source==='s13-augments-p2')).toBe(true);
  expect(result.ok&&result.events.some(e=>e.type==='mechanicGranted')).toBe(true);
});
it('later gift triple revisits a previously blocked gift in the same drain',()=>{
  let s=pendingFullBench(),plan=p2GiftPlan(s);
  for(let seed=0;(plan[0].definitionId===plan[1].definitionId||plan[0].definitionId===plan[2].definitionId);seed++){s=pendingFullBench(seed);plan=p2GiftPlan(s);}
  const merge=plan[1].definitionId,other=plan[2].definitionId;
  s={...s,preparation:{...s.preparation,units:s.preparation.units.map(u=>['b0','b1'].includes(u.id)?{...u,definitionId:merge,starLevel:1 as const}:['b2','b3'].includes(u.id)?{...u,definitionId:other,starLevel:1 as const}:u)}};
  const after=drainP2Gifts(s),receipts=after.seatMechanics!.receipts.filter(r=>r.source==='s13-augments-p2');
  expect(receipts.some(r=>r.receiptId===plan[0].receiptId)).toBe(true);
  expect(receipts[0].receiptId).toBe(plan[1].receiptId);
  expect(new Set(receipts.map(r=>r.receiptId)).size).toBe(receipts.length);
  expect(drainP2Gifts(after)).toBe(after);
});

it('public Crown + Trifecta acquisition serializes and restores both entrances with historical shields',()=>{
  // v20-traits adds five gold cards. Deterministic search found this unchanged
  // Crown -> Trifecta -> Kog'Maw scenario at attempt 16003, beyond the old 10000 budget.
  // v23 batch 2: independent offer/gift seed search retains Crown → Trifecta → Kog'Maw at 7329.
  // v23 batch 3 (eight more cards): the same sequential search finds the chain at 2060.
  const seed=2060;
  let s=reachRound('2-1',false,seed),c=s.pendingChoice!;
  expect(c.offers).toContain('crown-guarded');s=accepted(selectChoice(s,c.choiceId,c.generation,'crown-guarded'));
  while(s.roundDefinitionId!=='3-2'){
    s=resolveM5Choices(s);if(s.phase==='preparation')s=accepted(startMatchCombat(emptyBoard(s)));
    s=resolveM5Choices(s);expect(s.phase).toBe('settlement');s=accepted(nextRound(s,s.round));
  }
  c=s.pendingChoice!;expect(c.offers).toContain('trifecta-ii');s=accepted(selectChoice(s,c.choiceId,c.generation,'trifecta-ii'));
  const gift=p2GiftPlan(s).find(g=>g.kind==='unit'&&g.definitionId==='kogmaw')!;
  const birth=s.seatMechanics!.receipts.find(r=>r.kind==='unit'&&r.receiptId===gift.receiptId)!;
  if(birth.kind!=='unit'||!birth.unitId)throw Error('missing KogMaw receipt');
  const hero=s.preparation.units.find(u=>u.id===birth.unitId)!;
  expect(hero.definitionId).toBe('kogmaw');
  s=accepted(deployMatchUnit(s,hero.id,{kind:'board',cell:{col:0,row:7}}));
  s=accepted(equipItem(s,s.items.find(i=>i.definitionId==='crownguard')!.id,hero.id,0));
  s=accepted(startMatchCombat(s));
  expect(s.combat!.units.find(u=>u.id===hero.id)).toMatchObject({maxHp:1080,shield:375});
  const text=serializeMatch(s);expect(restoreMatch(text)).toEqual(s);expect(restoreMatch(JSON.parse(text))).toEqual(s);
  s=stepMatch(s).state;expect(restoreMatch(serializeMatch(s))).toEqual(s);
});

it.each([['crownguard',1130,200],['TFT9_Item_OrnnTrickstersGlass',1030,0]] as const)('seed 3510 Trifecta Nami + %s passes all three save entrances',(definitionId,maxHp,shield)=>{
  // v23 expanded pool (batch 3): 3510 publicly offers Trifecta → Nami; the original stat/shield assertions remain unchanged.
  let s=reachRound('2-1',false,3510),c=s.pendingChoice!;
  s=accepted(selectChoice(s,c.choiceId,c.generation,'trifecta-ii'));
  const gift=p2GiftPlan(s).find(g=>g.kind==='unit')!,birth=s.seatMechanics!.receipts.find(r=>r.kind==='unit'&&r.receiptId===gift.receiptId)!;
  if(birth.kind!=='unit'||!birth.unitId)throw Error('missing Nami receipt');
  const unitId=birth.unitId;expect(s.preparation.units.find(u=>u.id===unitId)!.definitionId).toBe('nami');
  s=accepted(grantMechanicItem(s,{receiptId:`review:${definitionId}`,source:'test',definitionId}));
  s=accepted(equipItem(s,s.items.at(-1)!.id,unitId,0));
  s=accepted(deployMatchUnit(s,unitId,{kind:'board',cell:{col:0,row:7}}));
  s=accepted(startMatchCombat(s));
  expect(s.combat!.units.find(u=>u.id===unitId)).toMatchObject({maxHp,shield});
  if(definitionId!=='crownguard')expect(s.combat!.units.find(u=>u.itemSummon?.kind==='mirror')).toMatchObject({maxHp:721,itemSummonOpeningMaxHp:1030});
  const text=serializeMatch(s);expect(restoreMatch(structuredClone(s))).toEqual(s);expect(restoreMatch(text)).toEqual(s);
  s=stepMatch(s).state;expect(restoreMatch(serializeMatch(s))).toEqual(s);
});
it('buying a bench triple while the PvP roster is frozen retains pending gifts',()=>{
  let s=pendingFullBench();
  s={...s,multiplayer:{version:'multiplayer-settlement-v1',seatId:'A',status:'active',receipts:[],forfeitedChoices:[],combatRosterLocked:true},
    preparation:{...s.preparation,units:s.preparation.units.map(u=>['b0','b1'].includes(u.id)?{...u,definitionId:'darius',starLevel:1 as const}:u)},
    shop:{...s.shop,slots:[{status:'available',definitionId:'darius'},...s.shop.slots.slice(1)]}};
  const after=accepted(buyUnit(s,0,s.shop.generation));
  expect(after.preparation.units.some(u=>u.definitionId==='darius'&&u.starLevel===2)).toBe(true);
  expect(after.seatMechanics?.receipts.filter(r=>r.source==='s13-augments-p2')??[]).toHaveLength(0);
  expect(after.preparation.units.filter(u=>u.location.kind==='bench')).toHaveLength(8);
});
