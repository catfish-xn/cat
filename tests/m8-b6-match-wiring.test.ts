import { describe, expect, it, vi } from 'vitest';
import { buyUnit, buyXp, createMatch, deployMatchUnit, nextRound, selectChoice, selectAnomalyTarget, setShopLock, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readRoundInfo, getCatalogRoundById } from '../src/simulation/round-selectors';
import { ROUND_CATALOG, ROUND_SEMANTIC_NODES } from '../src/simulation/content/round-catalog';
import { getRoundKind, getRoundSchedule, getStageRound } from '../src/simulation/round-schedule';
import { planCatalogRoundEconomy, OPENING_INITIAL_STATE, OPENING_ECONOMY_RULES } from '../src/simulation/opening-economy';
import { CONTENT_DIGEST, digestContent } from '../src/simulation/content';
import * as enemies from '../src/simulation/round-enemies';
import { accepted } from './match-helpers';

const roundTrip = (state:MatchState) => {
  const restored=restoreMatch(serializeMatch(state));
  expect(restored).toEqual(state);
  expect(restored).not.toBe(state);
  expect(Object.isFrozen(restored.m8.round)).toBe(true);expect(Object.isFrozen(restored.m8.preparation)).toBe(true);
  return restored;
};
const concede = (state:MatchState) => {
  for(const [slot,unit] of state.preparation.units.filter(u=>u.team==='player').entries())
    state=accepted(deployMatchUnit(state,unit.id,{kind:'bench',slot}));
  return accepted(startMatchCombat(state));
};

// Handwritten OPENING expectations; B7 now supplies the approved neutral roster, B8 loot remains pending.
describe('B6 installed round, opening and restore transactions',()=>{
  it('starts directly in 1-2 with one permanent hero, no legacy package and one five-slot shop',()=>{
    const state=createMatch(42);
    expect(state).toMatchObject({phase:'preparation',round:1,roundDefinitionId:'1-2',gold:0,level:1,xp:0,playerHp:100,nextUnitSerial:2,
      items:[],augments:[],scheduleReceipts:[],pendingChoice:null,roundResults:[]});
    expect(state.preparation.units.filter(u=>u.team==='player')).toEqual([{id:'unit-1',definitionId:'irelia',team:'player',starLevel:1,location:{kind:'board',cell:{col:1,row:4}}}]);
    expect(state.shop.generation).toBe(1); expect(state.shop.slots).toHaveLength(5);
    expect(readRoundInfo(state)).toBe(state.m8.round);
    expect(state.m8.preparation).toMatchObject({roundId:'1-2',encounterId:'minions-a-v1',contentStatus:'ready-b7-pending-b8'});
    expect(state.m8.encounterPlan).toBeNull();
    roundTrip(state);
  });
  it('concedes the three opening battles once: 2/3/5G, 2/2/0XP, fixed 3HP and no streak',()=>{
    let state=createMatch(42);
    for(const expected of [
      {id:'1-2',gold:2,level:2,hp:97,base:2,xp:2},
      {id:'1-3',gold:5,level:3,hp:94,base:3,xp:2},
      {id:'1-4',gold:10,level:3,hp:91,base:5,xp:0},
    ]) {
      expect(readRoundInfo(state).roundId).toBe(expected.id);
      roundTrip(state);
      const frozen=structuredClone(state.m8);
      state=concede(state);
      expect(state).toMatchObject({phase:'settlement',gold:expected.gold,level:expected.level,xp:0,playerHp:expected.hp,streak:{kind:null,count:0}});
      expect(state.m8).toEqual(frozen);
      expect(state.roundResults.at(-1)).toMatchObject({roundId:expected.id,incomeBreakdown:{base:expected.base,win:0,interest:0,streak:0},xpRequested:expected.xp,playerDamage:3});
      roundTrip(state);
      expect(stepMatch(state)).toEqual({state,events:[]}); expect(stepMatch(state).state).toBe(state);
      const old=state;
      state=accepted(nextRound(state,state.round));
      const duplicate=nextRound(state,old.round);
      expect(duplicate).toEqual({ok:false,state,reason:'wrong-phase'});expect(duplicate.state).toBe(state);
      roundTrip(state);
    }
    expect(state).toMatchObject({round:4,roundDefinitionId:'2-1',phase:'choice',gold:10,level:3,xp:0,playerHp:91});
    expect(state.pendingChoice).toMatchObject({kind:'augment',eventId:'round:2-1:augment'});
    expect(state.items).toEqual([]);expect(state.preparation.units.filter(u=>u.team==='player')).toHaveLength(1);
    expect(state.scheduleReceipts).toEqual([]); // B8 has not granted heroes or components.
    expect(state.shop.generation).toBe(4);
  });
  it('restores real preparation, running combat and settlement at all three opening identities without generating again',()=>{
    let state=createMatch(42);
    for(const id of ['1-2','1-3','1-4']) {
      expect(state.roundDefinitionId).toBe(id);roundTrip(state);
      state=accepted(startMatchCombat(state));expect(state.phase).toBe('combat');
      const restored=roundTrip(state);expect(stepMatch(restored)).toEqual(stepMatch(state));
      while(state.phase==='combat') state=stepMatch(state).state;
      roundTrip(state);expect(state.phase).toBe('settlement');
      state=accepted(nextRound(state,state.round));
    }
    const spy=vi.spyOn(enemies,'createRoundEnemies');
    try {roundTrip(state);expect(spy).not.toHaveBeenCalled();} finally {spy.mockRestore();}
  });
  it('preserves locked-shop RNG and does not reset paid operations to the baseline',()=>{
    let state=createMatch(42);
    state=accepted(setShopLock(state,true,state.shop.generation));
    const shop=state.shop,rng=state.rngState;
    state=concede(state);state=accepted(nextRound(state,state.round));
    expect(state.shop).toEqual(shop);expect(state.rngState).toBe(rng);
    const slot=state.shop.slots.findIndex(s=>s.status==='available');
    state=accepted(buyUnit(state,slot,state.shop.generation));
    expect(state.nextUnitSerial).toBe(3);expect(state.gold).toBe(1);
    state=concede(state);state=accepted(nextRound(state,state.round));
    state=accepted(buyXp(state));expect([state.gold,state.level,state.xp]).toEqual([0,3,4]);
    state=concede(state);state=accepted(nextRound(state,state.round));
    expect([state.gold,state.level,state.xp]).toEqual([5,3,4]);roundTrip(state);
  });
  it('maps every ordinal and semantic node through the catalog, including 36-38',()=>{
    expect(ROUND_CATALOG.filter(r=>r.kind!=='supply')).toHaveLength(33);
    for(const r of ROUND_CATALOG) {
      expect(getStageRound(r.ordinal)).toEqual({stage:r.stage,round:r.subround});expect(getRoundKind(r.ordinal)).toBe(r.kind);
      expect(getRoundSchedule(r.ordinal).map(e=>e.id)).toEqual((ROUND_SEMANTIC_NODES[r.roundId]??[]).map(n=>`round:${r.roundId}:${n}`));
    }
    expect(['6-5','6-6','6-7'].map(id=>getCatalogRoundById(id).ordinal)).toEqual([36,37,38]);
    expect(getRoundSchedule(1)).toEqual([]);expect(getRoundSchedule(4).map(e=>e.kind)).toEqual(['augment']);
  });
  it('uses the old economy only from 2-1 and preserves the independent 185G base budget',()=>{
    let gold=0,level=1,xp=0,hp=100;
    let bases=0;
    for(const r of ROUND_CATALOG) {
      const plan=planCatalogRoundEconomy({roundId:r.roundId,result:r.kind==='supply'?null:'playerWin',gold,level,xp,hp,streak:{kind:null,count:0},enemySurvivors:0});
      bases+=plan.incomeBreakdown.base;gold=plan.goldAfter;level=plan.progression.level;xp=plan.progression.xp;
      if(r.roundId==='2-1') expect(plan.incomeBreakdown).toEqual({base:5,win:1,interest:1,streak:0});
    }
    expect(bases).toBe(185);
    expect(Object.isFrozen(OPENING_INITIAL_STATE)).toBe(true);expect(Object.isFrozen(OPENING_ECONOMY_RULES.rounds['1-4'])).toBe(true);
    expect(CONTENT_DIGEST).toMatch(/^fnv1a32-utf16:/);
    expect(digestContent(OPENING_ECONOMY_RULES)).not.toBe(digestContent({...OPENING_ECONOMY_RULES,rounds:{...OPENING_ECONOMY_RULES.rounds,'1-4':{baseGold:5,naturalXp:2}}}));
  });
  it('restores 36-38 preparation/combat/settlement and ends only at 6-7 with no regeneration',()=>{
    // Strong explicit domain fixture exercises every round and strict local restore.
    // It is not an acquisition route or B9 application/history capacity acceptance.
    let state=createMatch();
    state={...state,level:9,nextUnitSerial:10,nextItemSerial:28,
      // Fixed high-damage equipment keeps this identity/restore test well below
      // the unchanged default timeout without skipping any round or combat.
      items:Array.from({length:27},(_,i)=>({id:`item-${i+1}`,definitionId:'deathblade',
        location:{kind:'unit' as const,unitId:`unit-${Math.floor(i/3)+1}`,slot:i%3}})),
      preparation:{...state.preparation,units:[
      ...state.preparation.units.filter(u=>u.team==='enemy'),
      ...Array.from({length:9},(_,i)=>({id:`unit-${i+1}`,definitionId:'caitlyn',team:'player' as const,starLevel:3 as const,
        location:{kind:'board' as const,cell:{col:i%7,row:4+Math.floor(i/7)}}})),
    ]}};
    const seen:string[]=[];
    while(state.phase!=='gameOver') {
      while(state.phase==='choice') {
        const c=state.pendingChoice!;
        state=accepted(c.step==='target'?selectAnomalyTarget(state,c.choiceId,c.generation,'unit-1'):
          selectChoice(state,c.choiceId,c.generation,c.offers.find(id=>id!=='glass-cannon-i')!));
      }
      if(state.phase==='settlement') {state=accepted(nextRound(state,state.round));continue;}
      const late=state.round>=getCatalogRoundById('6-5').ordinal;
      if(late) {seen.push(state.roundDefinitionId);roundTrip(state);}
      state=accepted(startMatchCombat(state));
      if(late) {
        const generation=vi.spyOn(enemies,'createRoundEnemies'),items=vi.spyOn(enemies,'getRoundEnemyItems');
        try {roundTrip(state);expect(generation).not.toHaveBeenCalled();expect(items).not.toHaveBeenCalled();}
        finally {generation.mockRestore();items.mockRestore();}
      }
      while(state.phase==='combat') state=stepMatch(state).state;
      if(late) roundTrip(state);
    }
    expect(seen).toEqual(['6-5','6-6','6-7']);
    expect(state).toMatchObject({roundDefinitionId:'6-7',outcome:'victory'});
    expect(state.roundResults).toHaveLength(ROUND_CATALOG.length);
    expect(state.roundResults.filter(r=>r.roundKind!=='supply')).toHaveLength(33);
    const repeated=nextRound(state,state.round);expect(repeated).toEqual({ok:false,state,reason:'wrong-phase'});expect(repeated.state).toBe(state);
  });
  it('rejects dropped progression and impossible one/two-XP preparation grants while allowing paid XP',()=>{
    let state=createMatch();state=accepted(nextRound(concede(state),1));
    expect(()=>restoreMatch({...state,level:1,xp:0})).toThrow('current XP preparation chain');
    expect(()=>restoreMatch({...state,xp:1})).toThrow('current XP preparation chain');
    const second=concede(state),forged=structuredClone(second);
    Object.assign(forged.roundResults[1],{levelBefore:1,levelAfter:2});Object.assign(forged,{level:2});
    expect(()=>restoreMatch(forged)).toThrow('history XP preparation chain');
    state=accepted(nextRound(second,2));
    expect(()=>restoreMatch({...state,xp:2})).toThrow('current XP preparation chain');
    roundTrip(accepted(buyXp(state)));
  });
  it.each(['round','prepared-id','encounter','status','enemy','plan','history-id','history-xp'] as const)('rejects tampered %s without repairing or mutating it',field=>{
    const state=concede(createMatch()),raw=structuredClone(state);
    if(field==='round') Object.assign(raw.m8.round,{ordinal:4});
    if(field==='prepared-id') Object.assign(raw.m8.preparation,{roundId:'2-1'});
    if(field==='encounter') Object.assign(raw.m8.preparation,{encounterId:'krugs-v1'});
    if(field==='status') Object.assign(raw.m8.preparation,{contentStatus:'not-pve'});
    if(field==='enemy') Object.assign(raw.m8.preparation.enemies[0],{definitionId:'irelia'});
    if(field==='plan') Object.assign(raw.m8,{encounterPlan:{roundId:'1-2',encounterId:'minions-a-v1',policyVersion:'fake',drops:[]}});
    if(field==='history-id') Object.assign(raw.roundResults[0],{roundId:'2-1'});
    if(field==='history-xp') Object.assign(raw.roundResults[0],{xpRequested:0});
    const before=JSON.stringify(raw);expect(()=>restoreMatch(raw)).toThrow();expect(JSON.stringify(raw)).toBe(before);
  });
});
