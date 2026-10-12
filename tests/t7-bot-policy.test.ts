import { describe, expect, it } from 'vitest';
import { createMatch, decideBotAction, BOT_MAX_STEPS, type MatchState, type Unit } from '../src/server-entry';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { getUnitSellPrice } from '../src/simulation/unit-stats';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { prepareMatchLoot } from '../src/simulation/loot-runtime';
import { freeze } from './combat-helpers';
import { accepted, aligned, context, execute } from './t7-helpers';
const opening=()=>aligned(createMatch(42));
function shop(state:MatchState,ids:readonly string[],gold:number):MatchState {
  return {...state,gold,shop:{...state.shop,slots:ids.map(definitionId=>({status:'available' as const,definitionId}))}};
}
function unit(id:string,definitionId:string,slot:number,starLevel:1|2|3=1):Unit {
  return {id,definitionId,team:'player',starLevel,location:{kind:'bench',slot}};
}
function roster(state:MatchState,units:readonly Unit[]):MatchState {
  return {...state,preparation:{...state.preparation,units:[...units,...state.preparation.units.filter(u=>u.team==='enemy')]}};
}
function decision(state:MatchState,rng=0) {return decideBotAction(state,context(state),rng);}
function applied(state:MatchState) {
  const d=decision(freeze(state));if(d.action==='done')throw new Error('Expected an action');
  return {action:d.action,state:accepted(execute(state,d.action))};
}
describe('T7 pure, finite decision contract',()=>{
  it('freezes inputs; deterministic tie uses exactly one independent LCG word, with a hand-calculated oracle',()=>{
    const state=shop({...opening(),level:2,xp:0},['maddie','lux'],9),ctx=context(state),before=JSON.stringify([state,ctx]);
    const result=decideBotAction(freeze(state),freeze(ctx),0);
    // First LCG word from zero is 1013904223, floor(word * 2 / 2^32) = 0.
    expect(result).toEqual({action:{type:'buy',slot:0,generation:state.shop.generation},rng:1013904223});
    expect(decideBotAction(state,ctx,0)).toEqual(result);expect(JSON.stringify([state,ctx])).toBe(before);
  });
  it('ignores opponents and hidden future RNG when ranking the same visible choices',()=>{
    const a=shop({...opening(),level:2,xp:0},['maddie','lux'],9);
    const b={...a,seed:777,rngState:999,choiceRngState:888,battleSeedRngState:111,rewardRngState:222};
    expect(decision(a,42)).toEqual(decideBotAction(b,{...context(b),opponents:[{seatId:'other',hp:1,level:9,units:[]}]},42));
  });
  it('stops at caller and hard attempt budgets without consuming RNG, even on unchanged input',()=>{
    const state=shop(opening(),['maddie'],9);
    for(const maxSteps of [0,3,1000]) {
      const ctx={...context(state),maxSteps};let stopped=-1;
      for(let stepsTaken=0;stepsTaken<=BOT_MAX_STEPS;stepsTaken++) {
        const r=decideBotAction(state,{...ctx,stepsTaken},7);
        if(r.action==='done'){expect(r.rng).toBe(7);stopped=stepsTaken;break;}
      }
      expect(stopped).toBe(Math.min(maxSteps,BOT_MAX_STEPS));
    }
  });
  it.each(['stale-shop','bench-full','pool-empty','seat-revision-mismatch'])('failure feedback %s terminates retrying',reason=>{
    const state=shop(opening(),['maddie'],9),a=decision(state).action;if(a==='done')throw new Error('fixture');
    expect(decideBotAction(state,{...context(state),lastFailure:{action:a,reason}},7)).toEqual({action:'done',rng:7});
  });
  it('returns done for stale observations, wrong phases and eliminated seats; rejects invalid configuration',()=>{
    const state=opening();expect(decideBotAction(state,{...context(state),self:{...context(state).self,round:99}},0).action).toBe('done');
    expect(decision({...state,phase:'settlement',combat:null}).action).toBe('done');
    expect(decision({...state,phase:'gameOver',combat:null,playerHp:0}).action).toBe('done');
    expect(()=>decision(state,-1)).toThrow(RangeError);
    expect(()=>decideBotAction(state,{...context(state),stepsTaken:-1},0)).toThrow(RangeError);
  });
});
describe('T7 economy, acquisition and formation',()=>{
  it('preserves current interest threshold; low HP and stage five spend down, never buys unaffordable cards',()=>{
    const state=shop(opening(),['caitlyn'],50);
    expect(decision(state)).toEqual({action:'done',rng:0});
    expect(applied({...state,playerHp:30}).action.type).toBe('buy');
    expect(applied({...state,m8:{...state.m8,round:{...state.m8.round,stage:5}}}).action.type).toBe('buy');
    const poor=shop(opening(),['caitlyn'],1);expect(decision(poor).action).toBe('done');
    expect(applied({...state,gold:55}).state.gold).toBe(50);
  });
  it('completes three copies ahead of a higher-cost new hero, using actual upgrade commands',()=>{
    let state=opening();state=roster(state,[...state.preparation.units.filter(u=>u.team==='player'),unit('u2','maddie',0),unit('u3','maddie',1)]);
    state=aligned(shop(state,['caitlyn','maddie'],9));
    const r=applied(state);expect(r.action).toMatchObject({type:'buy',slot:1});
    expect(r.state.preparation.units.some(u=>u.definitionId==='maddie'&&u.starLevel===2)).toBe(true);
  });
  it('prefers the higher-cost affordable offer when no upgrade is pending',()=>{
    const state=shop(opening(),['maddie','caitlyn'],9);
    expect(applied(state).action).toMatchObject({type:'buy',slot:1});
  });
  it('full bench sells its lowest-price expendable reserve, then accepts the desired card',()=>{
    let state=opening();
    state=roster(state,[...state.preparation.units.filter(u=>u.team==='player').map(u=>({...u,definitionId:'caitlyn',starLevel:2 as const})),...Array.from({length:9},(_,i)=>unit(`b${i}`,i===0?'lux':'leona',i))]);
    state=aligned(shop(state,['caitlyn'],9));const r=applied(state);
    expect(r.action).toEqual({type:'sell',unitId:'b0'});
    expect(getUnitSellPrice(state.preparation.units.find(u=>u.id==='b0')!)).toBe(1);
    expect(applied({...r.state,playerHp:30}).action).toMatchObject({type:'buy'});
  });
  it('buys XP within reserve and never at max level',()=>{
    const state=shop(opening(),[],54),r=applied(state);expect(r.action.type).toBe('buyXp');expect(r.state.gold).toBe(50);
    expect(decision({...state,level:9,xp:0,gold:0}).action).toBe('done');
  });
  it('places melee front/ranged back, obeys population and converges after a position cycle',()=>{
    let state:MatchState={...createMatch(42),level:2,xp:0};
    state=roster(state,[{...unit('a','irelia',0),location:{kind:'board',cell:{col:3,row:7}}},
      {...unit('b','maddie',1),location:{kind:'board',cell:{col:3,row:4}}},unit('c','lux',2)]);
    const enemyBefore=state.preparation.units.filter(u=>u.team==='enemy');
    state=aligned(state);
    const field=state.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');expect(field).toHaveLength(2);
    for(const u of field) {if(u.location.kind!=='board')throw new Error('fixture');expect(u.location.cell.row).toBe(UNIT_DEFINITIONS[u.definitionId].attackRange<=1?4:7);}
    expect(state.preparation.units.filter(u=>u.team==='enemy')).toEqual(enemyBefore);expect(decision(state).action).toBe('done');
  });
  it('replaces a weaker field unit by a stronger reserve without exceeding population',()=>{
    const state=roster(opening(),[...opening().preparation.units.filter(u=>u.team==='player'),unit('carry','caitlyn',0,2)]);
    const next=aligned(state);expect(next.preparation.units.find(u=>u.id==='carry')?.location.kind).toBe('board');
    expect(next.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board')).toHaveLength(1);
  });
});
describe('T7 legal equipment and every choice node',()=>{
  it('combines only a supported recipe, equips its result, and does not move equipped items',()=>{
    const recipe=Object.values(ITEM_DEFINITIONS).find(d=>d.recipe)!;
    const state:MatchState={...opening(),nextItemSerial:3,items:recipe.recipe!.map((definitionId,i)=>({id:`item-${i+1}`,definitionId,location:{kind:'inventory'}}))};
    const combined=applied(state);expect(combined.action.type).toBe('combine');
    const worn=applied(combined.state);expect(worn.action.type).toBe('equip');
    expect(decision(worn.state).action).toBe('done');
  });
  it('skips an exclusive-slot conflict and leaves unplaceable gear in inventory',()=>{
    const exclusive=Object.values(ITEM_DEFINITIONS).find(d=>d.slotCost===3)!;
    const regular=Object.values(ITEM_DEFINITIONS).find(d=>d.kind==='completed'&&d.slotCost!==3)!;
    const state:MatchState={...opening(),items:[{id:'held',definitionId:exclusive.id,location:{kind:'unit',unitId:'unit-1',slot:0}},
      {id:'free',definitionId:regular.id,location:{kind:'inventory'}}]};
    expect(decision(freeze(state)).action).toBe('done');
  });
  it.each([['2-1','augment','placebo'],['2-4','component','sword'],['4-6','anomaly','titanic-strikes']] as const)(
    'picks the first valid offer at %s / %s for free', (roundId,kind,definitionId)=>{
      const base=opening(),round=getCatalogRoundById(roundId),eventId=`round:${roundId}:${kind==='component'?'supply':kind}`;
      const state:MatchState={...base,round:round.ordinal,roundDefinitionId:roundId,phase:'choice',combat:null,
        m8:{...base.m8,round,loot:prepareMatchLoot(base.seed,round.ordinal)},
        pendingChoice:{kind,step:'offer',choiceId:eventId,eventId,generation:0,offers:[definitionId],targetId:kind==='anomaly'?'unit-1':null,rerollCount:0}};
      const r=applied(state);expect(r.action).toMatchObject({type:'choose',definitionId});expect(r.state.gold).toBeGreaterThanOrEqual(state.gold);
    });
  it('anomaly target chooses first legal owned ID and then the first offered anomaly',()=>{
    const base=opening(),round=getCatalogRoundById('4-6'),eventId='round:4-6:anomaly';
    const state:MatchState={...base,round:round.ordinal,roundDefinitionId:round.roundId,phase:'choice',combat:null,
      m8:{...base.m8,round},pendingChoice:{kind:'anomaly',step:'target',choiceId:eventId,eventId,generation:0,offers:[],targetId:null,rerollCount:0}};
    const target=applied(state);expect(target.action).toMatchObject({type:'anomalyTarget',unitId:'unit-1'});
    const chosen=applied(target.state);expect(chosen.action).toMatchObject({type:'choose',definitionId:target.state.pendingChoice!.offers[0]});
    expect(chosen.state.anomalyBinding?.unitId).toBe('unit-1');expect(chosen.state.gold).toBe(state.gold);
    expect(decision(roster(state,[])).action).toBe('done');
  });
});
