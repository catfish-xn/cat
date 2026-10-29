import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_G1, LUCKY_GLOVES_CHAMPION_ROLES, LUCKY_GLOVES_ROLE_ITEMS } from '../src/simulation/content/augment-pool-batch5-g1';
import { augmentCandidates, augmentOfferAllowed } from '../src/simulation/augment-offers';
import { AUGMENT_STAGE_BANS } from '../src/simulation/content/augment-stage-bans';
import { luckyGlovesSelection, selectLuckyGlovesPair } from '../src/simulation/augment-pool-batch5-g1-equipment';
import { luckyGlovesRewardPlan } from '../src/simulation/augment-pool-batch5-g1';
import { createMatch, selectChoice, combineItems, equipItem } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { augmentPool, luckyGlovesPair, CATALOG, COST, ROUNDS, xp, entryXp, benchXp } from './fixtures/m5/oracle.g2.cjs';
import { rewardPlan, validateRewards } from './fixtures/m5/augment-rewards-oracle.cjs';
import { accepted, reachRound } from './match-helpers';
import { firstNodeSeed } from './augment-stage-helpers';
import { nextRandom } from '../src/simulation/rng';
import { ITEM_DEFINITIONS } from '../src/simulation/content/g2-3-item-registry';
import { SHOP_CATALOG } from '../src/simulation/match-rules';
import { readFileSync } from 'node:fs';

it('B5-53 uses the exact 14.24 quantities and retains its stage bans', () => {
  expect(AUGMENT_BATCH5_G1['lucky-gloves'].source.values).toEqual({NumGloves:2,NumRounds:5});
  expect(AUGMENT_STAGE_BANS.TFT7_Augment_LuckyGloves).toEqual(['3-2','4-2']);
  for (const node of ['2-1','3-2','4-2']) {
    const pool=augmentCandidates('prismatic',[],[],null,{node,fieldedTraits:[],blocked:[]});
    expect([...pool].sort()).toEqual(augmentPool('prismatic',[],[],`round:${node}:augment`,[]));
    expect(augmentOfferAllowed('lucky-gloves',[],{node,fieldedTraits:[],blocked:[]})).toBe(node==='2-1');
    expect(pool.includes('lucky-gloves')).toBe(node==='2-1');
  }
});

it('every hero has eight legal recommendations and every ordered pair occurs exactly once among the 56 equal draws', () => {
  const raw=JSON.parse(readFileSync(new URL('./fixtures/m5/lucky-gloves-role-source.json',import.meta.url),'utf8'));
  expect(LUCKY_GLOVES_CHAMPION_ROLES).toEqual(raw.champions);
  expect(SHOP_CATALOG.filter(id=>!LUCKY_GLOVES_CHAMPION_ROLES[id])).toEqual([]);
  const byApi=new Map(Object.values(ITEM_DEFINITIONS).map(d=>[d.apiName,d.id]));
  for (const role of new Set(Object.values(LUCKY_GLOVES_CHAMPION_ROLES))) {
    expect(LUCKY_GLOVES_ROLE_ITEMS[role]).toHaveLength(8);
    expect(LUCKY_GLOVES_ROLE_ITEMS[role].map(api=>byApi.get(api))).toEqual(raw.roles[role]);
    const pairs=new Set<string>();
    for(let first=0;first<8;first++)for(let second=0;second<7;second++){
      const words=[first,second];
      const pair=selectLuckyGlovesPair(role,false,()=>words.shift()!);
      expect(new Set(pair).size).toBe(2);
      expect(pair.every(id=>ITEM_DEFINITIONS[id]?.kind==='completed')).toBe(true);
      pairs.add(JSON.stringify(pair));
    }
    expect(pairs.size).toBe(56);
    for(const radiant of [false,true]){
      let rng=42;const draw=()=>{const d=nextRandom(rng);rng=d.state;return d.word;};
      expect(selectLuckyGlovesPair(role,radiant,draw)).toEqual(luckyGlovesPair(42,0,role,radiant).children);
    }
  }
});

it.each(['elise','swain','gangplank','jayce'])('uses %s form at the actual starting row',definitionId=>{
  const base=createMatch(1),parent={id:'test-parent',definitionId:'thiefs-gloves',location:{kind:'unit' as const,unitId:'holder',slot:0 as const}};
  const context=(row:number)=>({...base,augments:[{definitionId:'lucky-gloves',choiceId:'choice',acquiredRound:4}],
    preparation:{...base.preparation,units:[{id:'holder',definitionId,team:'player' as const,starLevel:1 as const,location:{kind:'board' as const,cell:{col:1,row}}}]}});
  expect(luckyGlovesSelection(context(4),parent)?.role).toBe(['elise','swain'].includes(definitionId)?'APTank':'ADFighter');
  expect(luckyGlovesSelection(context(7),parent)?.role).toBe(['elise','swain'].includes(definitionId)?'APCaster':'ADCaster');
});

it('B5-53 delays one glove until the fifth subsequent natural entry, independently of production receipts',()=>{
  const base=createMatch(1),a={definitionId:'lucky-gloves',choiceId:'test-choice',acquiredRound:4};
  for(let round=4;round<=10;round++){
    const s={...base,round,augments:[a]};
    const expected=rewardPlan(s,{}).gifts;
    expect(expected.filter(g=>g.definitionId==='gloves')).toHaveLength(round<9?2:3);
    expect(luckyGlovesRewardPlan(s).map(g=>({...g,source:'augment-pool-batch1',starLevel:1}))).toEqual(expected.filter(g=>g.acquiredRound===9));
  }
});

it('solo smoke: selects, combines, equips and restores the same public command result',()=>{
  const open=reachRound('2-1',false,firstNodeSeed('lucky-gloves',101)),c=open.pendingChoice!;
  const chosen=selectChoice(open,c.choiceId,c.generation,'lucky-gloves');
  let state=accepted(chosen);
  if(!chosen.ok)throw Error(chosen.reason);
  const command={type:'select',choiceId:c.choiceId,generation:c.generation,definitionId:'lucky-gloves'};
  const env={CATALOG,COST,ROUNDS,xp,entryXp,benchXp};
  expect(()=>validateRewards(open,state,command,chosen.events,env)).not.toThrow();
  const missing=structuredClone(state) as any;
  missing.seatMechanics.receipts=missing.seatMechanics.receipts.filter((r:any)=>!r.receiptId.includes('lucky-gloves'));
  expect(()=>validateRewards(open,missing,command,chosen.events,env)).toThrow();
  const gloves=state.items.filter(i=>i.definitionId==='gloves'&&i.location.kind==='inventory');
  expect(gloves.length).toBeGreaterThanOrEqual(2);
  state=accepted(combineItems(state,gloves[0].id,gloves[1].id));
  const parent=state.items.find(i=>i.definitionId==='thiefs-gloves')!,holder=state.preparation.units.find(u=>u.team==='player')!;
  state=accepted(equipItem(state,parent.id,holder.id,0));
  expect(state.temporaryEquipment).toHaveLength(2);
  const text=serializeMatch(state);expect(restoreMatch(text)).toEqual(state);
});
