import { describe, expect, it, vi } from 'vitest';
import { buyUnit, buyXp, createMatch, deployMatchUnit, nextRound, selectChoice, selectAnomalyTarget, setShopLock, startMatchCombat, stepMatch, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { readRoundInfo, getCatalogRoundById } from '../src/simulation/round-selectors';
import { ROUND_CATALOG, ROUND_SEMANTIC_NODES } from '../src/simulation/content/round-catalog';
import { getRoundKind, getRoundSchedule, getStageRound } from '../src/simulation/round-schedule';
import { planCatalogRoundEconomy, OPENING_INITIAL_STATE, OPENING_ECONOMY_RULES } from '../src/simulation/opening-economy';
import { CONTENT_DIGEST, digestContent } from '../src/simulation/content';
import * as enemies from '../src/simulation/round-enemies';
import { augmentNeedsHistory } from '../src/simulation/augment-history-owners';
import { accepted, resolveM5Choices } from './match-helpers';
import { publicNeutralPreparation } from './fixtures/m8-neutral-public-route';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

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

// Handwritten OPENING expectations with B7 encounters and B8 earned/forfeited loot.
describe('B6 installed round, opening and restore transactions',()=>{
  it('starts directly in 1-2 with one permanent hero, no legacy package and one five-slot shop',()=>{
    const state=createMatch(42);
    expect(state).toMatchObject({phase:'preparation',round:1,roundDefinitionId:'1-2',gold:0,level:1,xp:0,playerHp:100,nextUnitSerial:2,
      items:[],augments:[],scheduleReceipts:[],pendingChoice:null,roundResults:[]});
    expect(state.preparation.units.filter(u=>u.team==='player')).toEqual([{id:'unit-1',definitionId:'irelia',team:'player',starLevel:1,location:{kind:'board',cell:{col:1,row:4}}}]);
    expect(state.shop.generation).toBe(1); expect(state.shop.slots).toHaveLength(5);
    expect(readRoundInfo(state)).toBe(state.m8.round);
    expect(state.m8.preparation).toMatchObject({roundId:'1-2',encounterId:'minions-a-v1',contentStatus:'ready-b8-loot'});
    expect(state.m8.encounterPlan).toBeNull();
    roundTrip(state);
  });
  it('concedes the three opening battles once: 2/3/4 base + 0/1/1 streak, 2/2/2XP and 2/3/4HP from surviving monsters',()=>{
    let state=createMatch(42);
    // pve-loot-carryover (8f794062, docs/CURSOR_pve-loot-carryover.md, M8B_POLICY D4, user-approved 2026-10-29):
    // each surviving opening loss carries its unearned drops to the next PvE, which pays them even if it is lost too.
    const counter=(roundId:string)=>JSON.stringify(['s13-orbs-project-v17',roundId,'components-granted']);
    for(const expected of [
      {id:'1-2',gold:2,level:2,hp:98,damage:2,base:2,bonus:0,count:1,xp:2,next:'1-3',delivered:[] as string[][],counted:null as string|null},
      {id:'1-3',gold:6,level:3,hp:95,damage:3,base:3,bonus:1,count:2,xp:2,next:'1-4',delivered:[['1-2','item','belt','item-1'],['1-2','unit','tristana','unit-2']],counted:'1-2'},
      {id:'1-4',gold:11,level:3,hp:91,damage:4,base:4,bonus:1,count:3,xp:2,next:'2-7',delivered:[['1-3','item','gloves','item-2'],['1-3','unit','singed','unit-3'],['1-3','unit','powder','unit-4']],counted:'1-3'},
    ]) {
      expect(readRoundInfo(state).roundId).toBe(expected.id);
      roundTrip(state);
      const frozen=structuredClone(state.m8);
      const current=new Set(frozen.loot.frozen.rounds.find(r=>r.encounterPlan.roundId===expected.id)!.encounterPlan.drops.map(d=>d.dropId));
      const due=new Set((frozen.loot.carry??[]).filter(r=>r.deliverRoundId===expected.id).map(r=>r.dropId));
      expect(current.size).toBeGreaterThan(0);
      state=concede(state);
      // Round income is paid at the next round entry (deferred-income.ts): settlement still shows the previous gold.
      expect(state).toMatchObject({phase:'settlement',gold:expected.gold-expected.base-expected.bonus,level:expected.level,xp:expected.id==='1-4'?2:0,playerHp:expected.hp,streak:{kind:'loss',count:expected.count}});
      const paid=state.m8.loot.receipts.slice(frozen.loot.receipts.length);
      expect(paid.map(r=>[JSON.parse(JSON.parse(r.dropId)[0])[1],r.payload.kind,'definitionId' in r.payload?r.payload.definitionId:null,...r.grantedItemIds,...r.grantedUnitIds])).toEqual(expected.delivered);
      expect(paid.every(r=>due.has(r.dropId)&&r.claimedRoundId===expected.id&&r.resolution==='held'&&r.gold===0)).toBe(true);
      expect(paid.map(r=>r.dropId).sort()).toEqual([...due].sort());
      expect(frozen.loot.choiceEligibility).toEqual([]);
      expect(state.m8).toEqual({...frozen,loot:{...frozen.loot,
        direct:frozen.loot.direct.map(drop=>current.has(drop.dropId)?{...drop,status:'carried'}
          :due.has(drop.dropId)?{...drop,status:'granted',receiptId:paid.find(r=>r.dropId===drop.dropId)!.receiptId}:drop),
        receipts:[...frozen.loot.receipts,...paid],
        carry:[...(frozen.loot.carry??[]),...[...current].map(dropId=>({dropId,deliverRoundId:expected.next}))],
        guaranteeCounters:expected.counted?{...frozen.loot.guaranteeCounters,[counter(expected.counted)]:frozen.loot.guaranteeCounters[counter(expected.counted)]+1}:frozen.loot.guaranteeCounters,
      }});
      expect(state.roundResults.at(-1)).toMatchObject({roundId:expected.id,incomeBreakdown:{base:expected.base,win:0,interest:0,streak:expected.bonus},xpRequested:expected.xp,baseDamage:0,survivingEnemyCount:expected.damage,playerDamage:expected.damage});
      roundTrip(state);
      expect(stepMatch(state)).toEqual({state,events:[]}); expect(stepMatch(state).state).toBe(state);
      const old=state;
      state=accepted(nextRound(state,state.round));
      expect(state.gold).toBe(expected.gold);
      const duplicate=nextRound(state,old.round);
      expect(duplicate).toEqual({ok:false,state,reason:'wrong-phase'});expect(duplicate.state).toBe(state);
      roundTrip(state);
    }
    expect(state).toMatchObject({round:4,roundDefinitionId:'2-1',phase:'choice',gold:11,level:3,xp:2,playerHp:91});
    expect(state.pendingChoice).toMatchObject({kind:'augment',eventId:'round:2-1:augment'});
    // Carried 1-2/1-3 loot was paid at 1-3/1-4; the 1-4 drops wait for 2-7. Schedule entitlements are still forfeited.
    expect(state.items).toEqual([{id:'item-1',definitionId:'belt',location:{kind:'inventory'}},{id:'item-2',definitionId:'gloves',location:{kind:'inventory'}}]);
    expect(state.preparation.units.filter(u=>u.team==='player').map(u=>[u.id,u.definitionId])).toEqual([['unit-1','irelia'],['unit-2','tristana'],['unit-3','singed'],['unit-4','powder']]);
    expect(state.m8.loot.direct.filter(d=>d.status==='carried')).toHaveLength(4);
    expect(state.scheduleReceipts).toEqual([]);
    expect(state.shop.generation).toBe(4);
  });
  it('restores real preparation, running combat and settlement at all three opening identities without generating again',()=>{
    let state=createMatch(42);
    for(const id of ['1-2','1-3','1-4']) {
      expect(state.roundDefinitionId).toBe(id);roundTrip(state);
      state=accepted(startMatchCombat(state));expect(state.phase).toBe('combat');
      const restored=roundTrip(state);expect(stepMatch(restored)).toEqual(stepMatch(state));
      while(state.phase==='combat') state=stepMatch(state).state;
      roundTrip(state);
      if(state.phase==='choice') {
        const blocked=nextRound(state,state.round);
        expect(blocked).toEqual({ok:false,state,reason:'wrong-phase'});expect(blocked.state).toBe(state);
        state=resolveM5Choices(state);roundTrip(state);
      }
      expect(state.phase).toBe('settlement');
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
    state=accepted(buyXp(state));expect([state.gold,state.level,state.xp]).toEqual([1,3,4]);
    state=concede(state);state=accepted(nextRound(state,state.round));
    expect([state.gold,state.level,state.xp]).toEqual([6,4,0]);roundTrip(state);
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
  it('uses the old economy only from 2-1 and preserves the independent 184G base budget',()=>{
    let gold=0,level=1,xp=0,hp=100;
    let bases=0;
    for(const r of ROUND_CATALOG) {
      const plan=planCatalogRoundEconomy({roundId:r.roundId,result:r.kind==='supply'?null:'playerWin',gold,level,xp,hp,streak:{kind:null,count:0},enemySurvivors:0});
      bases+=plan.incomeBreakdown.base;gold=plan.goldAfter;level=plan.progression.level;xp=plan.progression.xp;
      if(r.roundId==='2-1') expect(plan.incomeBreakdown).toEqual({base:5,win:1,interest:1,streak:0});
    }
    expect(bases).toBe(184);
    expect(Object.isFrozen(OPENING_INITIAL_STATE)).toBe(true);expect(Object.isFrozen(OPENING_ECONOMY_RULES.rounds['1-4'])).toBe(true);
    expect(CONTENT_DIGEST).toMatch(/^fnv1a32-utf16:/);
    expect(digestContent(OPENING_ECONOMY_RULES)).not.toBe(digestContent({...OPENING_ECONOMY_RULES,rounds:{...OPENING_ECONOMY_RULES.rounds,'1-4':{baseGold:5,naturalXp:0}}}));
  });
  // One case per late round: restoring a settled combat independently replays
  // it, so each case round-trips only its own round of the same public route.
  it.each(['6-5','6-6','6-7'])('restores %s preparation/combat/settlement; the match ends only at 6-7 with no regeneration',restoredRound=>{
    // The full public driver has already fought the preceding battles, bought
    // and upgraded the army, and earned/combined every item in this prefix.
    let state=publicNeutralPreparation('6-5');
    const seen:string[]=[];let lateRestoreCount=0;
    while(state.phase!=='gameOver') {
      while(state.phase==='choice') {
        const c=state.pendingChoice!;
        state=accepted(c.step==='target'?selectAnomalyTarget(state,c.choiceId,c.generation,'unit-1'):
          selectChoice(state,c.choiceId,c.generation,c.offers.find(id=>id!=='glass-cannon-i')!));
      }
      if(state.phase==='settlement') {
        if(seen.at(-1)===restoredRound&&restoredRound!=='6-7') break;
        state=accepted(nextRound(state,state.round));continue;
      }
      const late=state.round>=getCatalogRoundById('6-5').ordinal;
      if(late) seen.push(state.roundDefinitionId);
      const restore=late&&state.roundDefinitionId===restoredRound;
      if(restore) {roundTrip(state);lateRestoreCount++;}
      state=accepted(startMatchCombat(state));
      if(restore) {
        // v26: D5 (3ce71065) moved the seed-65 route's 2-1 offer to history-dependent rebel-resurgence;
        // the route's public 2-1 pick (family-crest, scripts/v26-neutrals-1424-route.cjs) keeps it history-free again.
        // Without an augment-history proof, restore must not generate enemies at all.
        expect(state.augments.map(a=>a.definitionId).filter(augmentNeedsHistory)).toEqual([]);
        expect(state.augmentHistory).toBeUndefined();
        const generation=vi.spyOn(enemies,'createRoundEnemies'),items=vi.spyOn(enemies,'getRoundEnemyItems');
        try {roundTrip(state);lateRestoreCount++;expect(generation).not.toHaveBeenCalled();expect(items).not.toHaveBeenCalled();}
        finally {generation.mockRestore();items.mockRestore();}
      }
      while(state.phase==='combat') state=stepMatch(state).state;
      if(restore) {roundTrip(state);lateRestoreCount++;}
    }
    expect(lateRestoreCount).toBe(3);
    expect(seen).toEqual(['6-5','6-6','6-7'].slice(0,['6-5','6-6','6-7'].indexOf(restoredRound)+1));
    if(restoredRound!=='6-7') {expect(state.phase).toBe('settlement');return;}
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
