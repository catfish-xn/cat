import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { describe, expect, it } from 'vitest';
import { buyUnit, buyXp, createMatch, nextRound, deployMatchUnit, getDeploymentCap, matchStartFailure, startMatchCombat, stepMatch, validateMatchDeployment } from '../src/simulation/match';
import { accepted, freeze, readyMatch, emptyBoard, purchasedThreeHeroMatch } from './match-helpers';
import type { UnitLocation } from '../src/simulation/units';

describe('M5 public contract (M4 command invariants retained)', () => {
  it('starts with versioned independent streams, public single-hero roster and immediate preparation', () => {
    const first=createMatch(); let rng=42n;
    for(let i=0;i<10;i++)rng=(rng*1664525n+1013904223n)%4294967296n;
    expect(first).toEqual(createMatch(42));
    expect(first).toMatchObject({schemaVersion:5,rulesVersion:'m5-14.24b-v1',contentVersion:'s13-14.24b-slice-v1',commandProtocolVersion:2,
      phase:'preparation',round:1,gold:0,level:1,xp:0,playerHp:100,rngState:Number(rng),nextUnitSerial:2,combat:null,roundResults:[],pendingChoice:null});
    expect(first.shop.slots).toHaveLength(5);expect(first.preparation.benchSize).toBe(9);
    expect(first.preparation).not.toBe(createMatch().preparation);
    expect(first.preparation.units.every(unit=>unit.starLevel===1)).toBe(true);
  });
  it('concedes an empty deployment at tick zero once, with stage-one base income and fixed PvE failure damage', () => {
    const state=freeze(emptyBoard()),result=startMatchCombat(state);
    expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason);
    expect(result.events.map(e=>e.type)).toEqual(['combatFinished','roundSettled']);
    expect(result.state).toMatchObject({phase:'settlement',playerHp:97,gold:2,level:2,xp:0});
    expect(result.state.roundResults).toHaveLength(1);expect(result.state.roundResults[0]).toMatchObject({result:'enemyWin',combatTicks:0,playerDamage:3});
    expect(stepMatch(result.state)).toEqual({state:result.state,events:[]});expect(stepMatch(result.state).state).toBe(result.state);expect(state.playerHp).toBe(100);
  });
  it('rejects stale shop and missing enemies atomically', () => {
    const state=readyMatch();expect(buyUnit(state,0,0)).toEqual({ok:false,state,reason:'stale-shop'});expect(buyUnit(state,0,0).state).toBe(state);
    const empty={...state,preparation:{...state.preparation,units:[]}};
    expect(startMatchCombat(empty)).toEqual({ok:false,state:empty,reason:'missing-both'});
    const playerOnly={...state,preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.team==='player')}};
    expect(matchStartFailure(playerOnly)).toBe('missing-enemy');
  });
  it.each([-1,0.5,4294967296,NaN,Infinity])('rejects invalid seed %s',seed=>expect(()=>createMatch(seed)).toThrow(RangeError));
  it.each([0,4294967295])('accepts boundary seed %s',seed=>{expect(createMatch(seed).seed).toBe(seed);expect(createMatch(seed)).toEqual(createMatch(seed));});
  it('shares population guard between preview/commit, permits repositioning, and F unlocks another deployment',()=>{
    let staged=accepted(nextRound(accepted(startMatchCombat(emptyBoard(purchasedThreeHeroMatch()))),getCatalogRoundById('2-1').ordinal));
    for(const [index,u] of staged.preparation.units.filter(u=>u.team==='player').entries()) staged=accepted(deployMatchUnit(staged,u.id,{kind:'board',cell:{col:index+1,row:6}}));
    const slot=staged.shop.slots.findIndex(o=>o.status==='available'&&o.definitionId!=='irelia'&&o.definitionId!=='maddie'&&o.definitionId!=='lux');
    const state=accepted(buyUnit(staged,slot,staged.shop.generation)),target:UnitLocation={kind:'board',cell:{col:4,row:4}};
    expect(getDeploymentCap(state)).toBe(3);expect(validateMatchDeployment(state,'unit-4',target)).toBe('population-cap');
    expect(deployMatchUnit(state,'unit-4',target)).toEqual({ok:false,state,reason:'population-cap'});
    const moved=accepted(deployMatchUnit(state,'unit-1',target));expect(validateMatchDeployment(moved,'unit-1',{kind:'bench',slot:1})).toBeUndefined();
    const upgraded=accepted(buyXp(state));expect(upgraded.level).toBe(4);expect(upgraded.shop).toBe(state.shop);expect(upgraded.rngState).toBe(state.rngState);
    expect(deployMatchUnit(upgraded,'unit-4',target).ok).toBe(true);
    const over={...state,preparation:{...state.preparation,units:state.preparation.units.map(u=>u.id==='unit-4'?{...u,location:target}:u)}};
    expect(matchStartFailure(over)).toBe('population-cap');
  });
  it('prioritizes phase, max-level, then affordability for F',()=>{
    const state=readyMatch(),max={...state,level:9,gold:0},poor={...state,gold:3};
    expect(buyXp(max)).toEqual({ok:false,state:max,reason:'max-level'});expect(buyXp(poor)).toEqual({ok:false,state:poor,reason:'insufficient-gold'});
    const settled=accepted(startMatchCombat(emptyBoard(max)));expect(buyXp(settled)).toEqual({ok:false,state:settled,reason:'wrong-phase'});
  });
});
