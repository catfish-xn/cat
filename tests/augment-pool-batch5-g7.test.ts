import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { AUGMENT_BATCH5_G7, LOOT_EXPLOSION_BASE_DROP_CHANCE, LOOT_EXPLOSION_RULES, LOOT_EXPLOSION_LOOT_VALUES } from '../src/simulation/content/augment-pool-batch5-g7';
import { rollLootExplosion, drainLootExplosionRewards, lootExplosionRewardPlan, validateLootExplosionRewards } from '../src/simulation/augment-pool-batch5-g7';
import { lootExplosionKillSample } from '../src/simulation/augment-pool-batch5-g7-combat';
import { AUGMENT_DEFINITIONS } from '../src/simulation/content/augments';
import { AUGMENT_POOL_API_NAMES } from '../src/simulation/content/augment-offer-rules';
import { AUGMENT_TIERS } from '../src/simulation/content/augment-policy';
import { AUGMENT_STAGE_BANS } from '../src/simulation/content/augment-stage-bans';
import { augmentCandidates } from '../src/simulation/augment-offers';
import { selectChoice, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { firstNodeSeed } from './augment-stage-helpers';
import { accepted, reachRound, fieldBench, resolveM5Choices } from './match-helpers';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { lootExplosionPlan } from './fixtures/m5/augment-rewards-oracle.cjs';
import type { CombatUnit } from '../src/simulation/combat-types';
import type { StrategySnapshot } from '../src/simulation/strategy-types';
import { appendAugmentFact } from '../src/simulation/augment-history';
import { getMultiplayerRoundById } from '../src/simulation/multiplayer-round';
import { validateLootExplosionReceipts } from './fixtures/m5/augment-rewards-oracle.cjs';

const require=createRequire(import.meta.url);
const pools=require('./augment-reward-pools-oracle-data.cjs').pools;
const ID='loot-explosion';
const word=(fraction:number)=>Math.floor(fraction*0x100000000);
const dice=(...words:number[])=>{let i=0;return ()=>{expect(i).toBeLessThan(words.length);return words[i++];};};

it('transcribes only B5-69 source values and registers the gold Ambusher augment',()=>{
  const path='/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';
  const source=existsSync(path)?JSON.parse(readFileSync(path,'utf8')).find((r:{apiName:string})=>r.apiName==='TFT13_Augment_Ambusher'):{apiName:'TFT13_Augment_Ambusher',effects:{'{51972fee}':2,'{a59e2760}':0.5,'{c209103c}':0.10999999940395355,'{ca332ec1}':0.5,'{d89481f4}':1.75},description_zh_cn:'【伏击专家】击杀敌人时有几率掉落战利品，掉落几率受益于暴击几率。所获战利品的价值也可以触发暴击，从而提供更多战利品。获得1个【卡蜜尔】和1个【爆爆】。'};
  expect(AUGMENT_BATCH5_G7[ID].source.values).toEqual(source.effects);
  expect(AUGMENT_BATCH5_G7[ID].description).toBe(source.description_zh_cn);
  expect(AUGMENT_DEFINITIONS[ID].name).toBe('战利品爆炸');
  expect(AUGMENT_TIERS[ID]).toBe('gold');expect(AUGMENT_POOL_API_NAMES[ID]).toBe(source.apiName);
  expect(AUGMENT_STAGE_BANS[source.apiName as keyof typeof AUGMENT_STAGE_BANS]).toEqual(['4-2']);
  expect(LOOT_EXPLOSION_BASE_DROP_CHANCE).toBe(1100);
  expect(LOOT_EXPLOSION_RULES.components).toEqual(pools.component);
  expect(LOOT_EXPLOSION_RULES.completed).toEqual(pools.completed);
  expect(LOOT_EXPLOSION_RULES.components).not.toContain('spatula');
  expect(LOOT_EXPLOSION_RULES.components).not.toContain('frying-pan');
});
it.each(['2-1','3-2','4-2'])('respects %s offers, tailoring and built-different exclusivity, with an independent pool',node=>{
  for(const traits of [[],['ambusher']])for(const owned of [[],[{definitionId:'built-different',choiceId:'prior',acquiredRound:1}]]){
    const expected=node!=='4-2'&&!owned.length&&(node==='2-1'||traits.includes('ambusher'));
    expect(augmentCandidates('gold',owned,[],null,{node,fieldedTraits:traits,blocked:[]}).includes(ID)).toBe(expected);
    expect(augmentPool('gold',owned,[],`round:${node}:augment`,traits).includes(ID)).toBe(expected);
  }
  expect(augmentCandidates('gold',[{definitionId:ID,choiceId:'prior',acquiredRound:1}],[],null,{node,fieldedTraits:['ambusher'],blocked:[]})).not.toContain('built-different');
});
it.each([0,2500,7500,8900,10000])('uses 11%% + %i bps for drop chance with the exact 100%% cap',crit=>{
  const threshold=Math.ceil(Math.min(10000,1100+crit)*0x100000000/10000);
  expect(rollLootExplosion(2,crit,dice(threshold-1,0,0xffffffff))).not.toBeNull();
  if(threshold<0x100000000)expect(rollLootExplosion(2,crit,dice(threshold))).toBeNull();
  else expect(rollLootExplosion(2,crit,dice(0xffffffff,0,0xffffffff))).not.toBeNull();
});
it.each([2,3,4,5,6,7,8])('draws every stage %i bucket at its weight boundary, ignoring missing values',stage=>{
  const weights=stage===2?[80,20]:stage===3?[30,60,5,5]:stage===4?[30,35,25,5,5]:[15,30,35,13,5,2];
  expect(LOOT_EXPLOSION_LOOT_VALUES[stage].filter(r=>r.mValue!==undefined).map(r=>r.mValue)).toEqual(weights);
  let before=0;
  for(const [i,w]of weights.entries()){
    for(const ticket of [Math.ceil(before*0x100000000/100),Math.ceil((before+w)*0x100000000/100)-1]){
      const drop=rollLootExplosion(stage,0,dice(0,ticket,0xffffffff,0,0xffffffff))!;
      expect(drop).toMatchObject({baseTier:i+1,tier:i+1,valueCrit:false});
      if(i<3)expect(drop.rewards).toEqual([{kind:'gold',amount:i+1}]);
      else {
        expect(drop.rewards).toHaveLength(i===4?2:1);
        for(const reward of drop.rewards)expect(reward.kind==='item'&&(i===5?pools.completed:pools.component).includes(reward.definitionId)).toBe(true);
      }
    }
    before+=w;
  }
});
it('uses a separate value crit, raises exactly one tier, caps tier 6, and allows two independent component draws',()=>{
  expect(rollLootExplosion(2,2500,dice(0,0,word(0.25)))).toMatchObject({baseTier:1,tier:1,valueCrit:false});
  expect(rollLootExplosion(2,2500,dice(0,0,word(0.25)-1))).toMatchObject({baseTier:1,tier:2,valueCrit:true,rewards:[{kind:'gold',amount:2}]});
  expect(rollLootExplosion(5,10000,dice(0,word(0.82),0,0,0xffffffff))).toMatchObject({baseTier:4,tier:5,valueCrit:true,rewards:[{kind:'item',definitionId:'belt'},{kind:'item',definitionId:'vest'}]});
  expect(rollLootExplosion(5,10000,dice(0,0xffffffff,0,0xffffffff))).toMatchObject({baseTier:6,tier:6,valueCrit:true,rewards:[{kind:'item',definitionId:pools.completed.at(-1)}]});
});

// Combat observation seam: no candidate resource state, forged receipt or injected combat result.
const fighter=(id:string,team:'player'|'enemy',definitionId='camille')=>({id,team,definitionId,unitKind:'champion',ability:{kind:'s13',championId:definitionId},baseCritChanceBps:7500,sources:[{source:{sourceKind:'augment',sourceDefinitionId:ID}}]}) as unknown as CombatUnit;
const strategy=(members=['camille'],memberUnitIds?:string[])=>({units:[],traits:[{team:'player',traitId:'ambusher',tier:0,memberDefinitionIds:members,...(memberUnitIds?{memberUnitIds}:{})}]}) as unknown as StrategySnapshot;
it('samples actual Ambusher last hits, including emblem-only membership below the trait threshold',()=>{
  const killer=fighter('k','player'),victim=fighter('v','enemy','maddie');
  expect(lootExplosionKillSample(killer,victim,strategy())).toMatchObject({killerUnitId:'k',critChanceBps:7500});
  const emblem=fighter('emblem','player','maddie');
  expect(lootExplosionKillSample(emblem,victim,strategy(['maddie'],['emblem']))).toBeDefined();
  expect(lootExplosionKillSample({...emblem,id:'without-emblem'},victim,strategy(['maddie'],['emblem']))).toBeUndefined();
  for(const invalid of [{...killer,team:'enemy' as const},{...killer,sources:[]},{...killer,definitionId:'maddie'}])expect(lootExplosionKillSample(invalid,victim,strategy())).toBeUndefined();
  expect(lootExplosionKillSample(undefined,victim,strategy())).toBeUndefined();
  for(const v of [{...victim,unitKind:'neutral' as const},{...victim,definitionId:'training-dummy'},{...victim,itemSummon:{} as CombatUnit['itemSummon']},{...victim,anomalySummon:{} as CombatUnit['anomalySummon']},{...victim,v20Traits:{minion:{}} as CombatUnit['v20Traits']}])expect(lootExplosionKillSample(killer,v,strategy())).toBeUndefined();
});

describe('real public acquisition and solo error compatibility',()=>{
  let chosen:MatchState;
  it('selects a real offer, grants Camille and Powder once, and rejects retry atomically',()=>{
    const seed=firstNodeSeed(ID,101);const before=reachRound('2-1',false,seed),c=before.pendingChoice!;
    expect(c.offers).toContain(ID);const result=selectChoice(before,c.choiceId,c.generation,ID);chosen=accepted(result);
    expect(chosen.augmentHistory?.facts[0]).toMatchObject({kind:'acquire',definitionId:ID});
    expect(chosen.seatMechanics?.receipts.filter(r=>r.receiptId.includes(ID))).toMatchObject([{kind:'unit',definitionId:'camille'},{kind:'unit',definitionId:'powder'}]);
    const retry=selectChoice(chosen,c.choiceId,c.generation,ID);expect(retry.ok).toBe(false);expect(retry.state).toBe(chosen);expect('events' in retry?retry.events:[]).toEqual([]);
    for(const input of [chosen,JSON.stringify(chosen),serializeMatch(chosen)])expect(restoreMatch(input)).toEqual(chosen);
  });
  it('finishes an ordinary solo PvP without errors and independently authenticates its rewards',()=>{
    let s=fieldBench(resolveM5Choices(chosen));s=accepted(startMatchCombat(s));while(s.phase==='combat')s=stepMatch(s).state;
    const independent=lootExplosionPlan(s),actual=s.seatMechanics!.receipts.filter(r=>r.source==='augment-pool-batch5-g7');
    expect(actual.map(r=>r.receiptId).sort()).toEqual([...independent.gold,...independent.gifts].map(r=>r.receiptId).sort());
    expect(()=>validateLootExplosionRewards(s)).not.toThrow();expect(drainLootExplosionRewards(s)).toBe(s);
    expect(lootExplosionRewardPlan(s)).toHaveLength(actual.length);
  });
  it('issues gold, single/double components and completed items through the existing receipt grants, with independent expectations',()=>{
    // Explicit observation vector for every late-stage reward family, not a claimed played/saveable trajectory.
    // The real room above/below supplies the execution/restore evidence; this vector exercises inventory grants.
    const round=getMultiplayerRoundById('5-1');
    let s={...chosen,round:round.ordinal,roundDefinitionId:round.roundId,phase:'settlement' as const,m8:{...chosen.m8,round},roundResults:[...chosen.roundResults,{round:round.ordinal,roundId:round.roundId,roundKind:'pvp',combatTicks:10}]} as MatchState;
    s=appendAugmentFact(s,{kind:'deaths',battleId:'items-vector',completeThroughTick:10,deaths:Array.from({length:60},(_,i)=>({combatId:'items-vector',eventSeq:i,tick:10,unitId:`v${i}`,definitionId:'maddie',team:'enemy' as const,ownerSeatId:'opponent',originalUnitId:`v${i}`,ordinaryHero:true,equipment:[],combatItemGrants:[],lootExplosion:{killerUnitId:'camille',originalKillerUnitId:'camille',killerSeatId:'solo',critChanceBps:10000}}))});
    const independent=lootExplosionPlan(s),beforeGold=s.gold,beforeSerial=s.nextItemSerial;
    expect(independent.gold.length).toBeGreaterThan(0);expect(independent.gifts.length).toBeGreaterThan(0);
    expect(independent.gifts.some(g=>pools.completed.includes(g.definitionId))).toBe(true);
    expect(independent.gifts.some(g=>JSON.parse(g.receiptId).at(-1)===1)).toBe(true);
    s=drainLootExplosionRewards(s);
    expect(s.gold-beforeGold).toBe(independent.gold.reduce((n,g)=>n+g.amount,0));
    expect(s.nextItemSerial-beforeSerial).toBe(independent.gifts.length);
    for(const gift of independent.gifts){
      const r=s.seatMechanics!.receipts.find(r=>r.receiptId===gift.receiptId)!;
      expect(r).toMatchObject({kind:'item',definitionId:gift.definitionId});
      if(r.kind!=='item')throw new Error('item grant expected');
      expect(s.items.find(i=>i.id===r.itemId)).toMatchObject({definitionId:gift.definitionId,location:{kind:'inventory'}});
    }
    expect(()=>validateLootExplosionRewards(s)).not.toThrow();expect(()=>validateLootExplosionReceipts(s)).not.toThrow();
    const bad=structuredClone(s) as any;bad.seatMechanics.receipts.find((r:any)=>r.source==='augment-pool-batch5-g7'&&r.kind==='item').definitionId='spatula';
    expect(()=>validateLootExplosionRewards(bad)).toThrow();expect(()=>validateLootExplosionReceipts(bad)).toThrow();
    expect(drainLootExplosionRewards(s)).toBe(s);
  });
});
