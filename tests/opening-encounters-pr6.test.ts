import { describe, expect, it } from 'vitest';
import { createMatch, startMatchCombat, stepMatch, nextRound, selectChoice, sellUnit } from '../src/simulation/match';
import { enableMultiplayerSettlement, applyRoundSettlement, ROUND_SETTLEMENT_VERSION } from '../src/simulation/round-settlement';
import { createOpeningEncounter, OPENING_ENCOUNTERS, OPENING_ENCOUNTER_CONFIG, isMelBlessingCrossing,
  commitOpeningEncounterHealth, validateOpeningEncounterState, readOpeningMelProgress, readOpeningForgeProgress, readOpeningEncounterView,
  applyOpeningEffects, applyWarwickHunger, type OpeningMelThresholdReceipt, type OpeningWarwickKillFact } from '../src/simulation/opening-encounter';
import { createSharedPool, initializeSharedSeat, restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { serializeMatch, restoreMatch } from '../src/simulation/serialization';
import { toPrivateSeatView } from '../src/simulation/private-seat-view';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { melCanSave, commitMelSave } from '../src/simulation/mel-save';
import { createG23Progress } from '../src/simulation/g2-3-match-progress';
import { readG23Progress, writeG23Progress } from '../src/simulation/g2-3-state';
import type { MatchState, MatchEvent, RoundResult } from '../src/simulation/match-types';
import type { G23BattleFacts } from '../src/simulation/g2-3-economy';
import { openingRewardAtoms, openingRewardOrbs, BATCH_SOURCE } from '../src/simulation/opening-batch-rewards';

function seedFor(id: string) {
  for (let seed=0; seed<20000; seed++) if (createOpeningEncounter(seed).selection.encounterId===id) return seed;
  throw Error(id);
}
const melSeed=seedFor('mels-blessing'), warwickSeed=seedFor('warwicks-hunger');
function accepted<T extends {ok:boolean;state:MatchState;reason?:string}>(result:T) {
  if (!result.ok) throw Error(result.reason); return result.state;
}
function receipts(state:MatchState) {
  if (state.openingEncounter.mode==='shared-deferred') throw Error('unbound');
  return state.openingEncounter.receipts as readonly OpeningMelThresholdReceipt[];
}
// Isolated HP-history vectors, NOT purported full restorable offline saves.
const template = accepted(startMatchCombat({...createMatch(42),preparation:{...createMatch(42).preparation,units:createMatch(42).preparation.units.filter(u=>u.team==='enemy')}})).roundResults[0];
function hpRecord(oldHp:number,newHp:number,round=1):RoundResult {
  return {...template,round,settlementId:`round-${round}-settled`,hpBefore:oldHp,hpAfter:newHp,hpLost:oldHp-newHp};
}
function observed(oldHp:number,newHp:number,base=createMatch(melSeed)):MatchState {
  return {...base,playerHp:newHp,roundResults:[hpRecord(oldHp,newHp)]};
}
function facts(state:MatchState,melCasts=0):G23BattleFacts {
  return {battleId:`battle-${state.round}`,round:state.round,roundKind:'pvp',result:'loss',
    conquerorTier:0,chemBaronTier:0,conquestTakedowns:[],alliedDeaths:0,rumbleStar:0,highRollerGold:0,melCasts};
}
function pvp(base:MatchState,hp:number) {
  const round=getCatalogRoundById('2-1');
  const state={...accepted(enableMultiplayerSettlement(base,base.sharedPool?.seatId??'A')),
    round:round.ordinal,roundDefinitionId:round.roundId,phase:'preparation' as const,combat:null,playerHp:hp,
    m8:{...base.m8,round},roundResults:[1,2,3].map(r=>({...hpRecord(100,100,r)}))};
  return state;
}
function loss(state:MatchState,survivors=0,extra?:G23BattleFacts) {
  return {version:ROUND_SETTLEMENT_VERSION,settlementId:`settle-${state.round}`,battleId:`battle-${state.round}`,
    seatId:state.multiplayer!.seatId,round:state.round,roundId:state.roundDefinitionId,settlementEligible:true,
    result:'loss' as const,damage:2+survivors,baseDamage:2,opposingSurvivors:survivors,growth:[],combatTicks:1,combatEventCount:1,
    ...(extra?{g23Facts:extra}:{})};
}

const streams=(s:MatchState)=>[s.rngState,s.choiceRngState,s.rewardRngState,s.battleSeedRngState];
/** Batch A (v22): a Mel crossing issues every reward atom once, either granted or left as a claimable orb. */
function expectMelRewardIssued(state:MatchState){
  const atoms=openingRewardAtoms(state),orbs=openingRewardOrbs(state).map(o=>o.orbId);
  const granted=(state.seatMechanics?.receipts??[]).filter(r=>r.source===BATCH_SOURCE).map(r=>r.receiptId);
  expect(atoms.length).toBeGreaterThan(0);
  for(const atom of atoms)expect(granted.includes(atom.id)!==orbs.includes(atom.id)).toBe(true);
  expect(state.pendingChoice).toBeNull();
}

describe('PR6 Mel threshold observation (reward enabled by batch A)',()=>{
  it.each([
    [41,40,true],[41,39,true],[100,40,true],[41,41,false],[40,39,false],[39,38,false],
    [40,40,false],[40,41,false],[41,0,false],[1,0,false],[0,0,false],[0,40,false],[41,1,true],
  ])('%i → %i crosses after save: %s',(before,after,expected)=>{
    expect(isMelBlessingCrossing(before,after)).toBe(expected);
    const state=observed(before,after),result=commitOpeningEncounterHealth(state);
    expect(receipts(result)).toHaveLength(expected?1:0);
    expect(readOpeningMelProgress(result)?.thresholdReached).toBe(expected);
    expect(()=>validateOpeningEncounterState(result)).not.toThrow();
    if(expected) {
      expect(receipts(result)[0]).toMatchObject({kind:'mel-threshold',hpBefore:before,hpAfter:after,rewardStatus:'granted'});
      expectMelRewardIssued(result);
      expect(streams(result)).toEqual(streams(state));
      expect(commitOpeningEncounterHealth(result)).toBe(result);
    }
    else expect(result).toBe(state);
  });
  it.each([-1,0.5,101,NaN,Infinity])('rejects invalid HP %s',hp=>{
    expect(()=>isMelBlessingCrossing(hp,40)).toThrow(RangeError);
    expect(()=>isMelBlessingCrossing(41,hp)).toThrow(RangeError);
  });
  it('enables both rewards and preserves only the evidenced B-patch branch override',()=>{
    const mel=OPENING_ENCOUNTERS.find(e=>e.id==='mels-blessing')!;
    const warwick=OPENING_ENCOUNTERS.find(e=>e.id==='warwicks-hunger')!;
    // Batches A/B (v22) implement Mel's reward and Warwick's hunger.
    expect([mel.enabled,warwick.enabled]).toEqual([true,true]);
    expect([mel.weightBps,warwick.weightBps]).toEqual([800,800]);
    expect(mel.researchParameters).toMatchObject({reward_table:null,reward_weights:null,
      known_b_patch_reward_override:{old_count:3,new_count:2,applies_to:"one reward outcome; not every player's fixed reward"}});
    expect(warwick.researchParameters).toMatchObject({drop_probability:null,reward_table:null,pity_system:null,per_round_cap:null});
    expect(OPENING_ENCOUNTER_CONFIG.melBOverride.crownsInAffectedBranch).toBe(2);
    const state=commitOpeningEncounterHealth(observed(41,40));
    expectMelRewardIssued(state);
    expect(applyOpeningEffects(state,[])).toEqual({ok:true,state,events:[]});
    const disabled=structuredClone(OPENING_ENCOUNTER_CONFIG) as any;
    disabled.entries.find((e:any)=>e.id==='mels-blessing').enabled=false;
    expect(()=>createOpeningEncounter(melSeed,disabled)).toThrow('opening-config-incomplete');
  });
  it('observes once across retries, HP recovery and a second crossing; never backfills missing receipts',()=>{
    const first=commitOpeningEncounterHealth(observed(41,40));
    expect(commitOpeningEncounterHealth(first)).toBe(first);
    const later={...first,round:3,playerHp:39,roundResults:[...first.roundResults,hpRecord(40,50,2),hpRecord(50,39,3)]};
    expect(commitOpeningEncounterHealth(later)).toBe(later);
    expect(receipts(later)).toHaveLength(1);expect(receipts(later)[0].round).toBe(1);
    expect(()=>validateOpeningEncounterState(later)).not.toThrow();
    const missing={...later,openingEncounter:{...later.openingEncounter,receipts:[]}} as MatchState;
    expect(()=>commitOpeningEncounterHealth(missing)).toThrow('opening-context-mismatch');
  });
  it('authenticates every receipt field and rejects duplicates, missing records, and foreign encounters',()=>{
    const state=commitOpeningEncounterHealth(observed(41,40)),receipt=receipts(state)[0];
    for(const patch of [{receiptId:'fake'},{factId:'fake'},{seatId:'other'},{nodeId:'other'},{round:2},
      {hpBefore:42},{hpAfter:39},{kind:'reward'},{rewardStatus:'blocked-evidence'},{unknown:true}]) {
      const forged={...state,openingEncounter:{...state.openingEncounter,receipts:[{...receipt,...patch}]}} as MatchState;
      expect(()=>validateOpeningEncounterState(forged)).toThrow('opening-context-mismatch');
      expect(applyOpeningEffects(forged,[])).toEqual({ok:false,state:forged,reason:'opening-context-mismatch'});
    }
    for(const records of [[],[receipt,receipt]]) expect(()=>validateOpeningEncounterState({
      ...state,openingEncounter:{...state.openingEncounter,receipts:records}} as MatchState)).toThrow('opening-context-mismatch');
    expect(()=>validateOpeningEncounterState({...state,roundResults:[]})).toThrow('opening-context-mismatch');
    const other=createMatch(warwickSeed);
    expect(commitOpeningEncounterHealth(observed(41,40,other)).openingEncounter).toBe(other.openingEncounter);
    expect(()=>validateOpeningEncounterState({...other,openingEncounter:{...other.openingEncounter,receipts:[receipt]}} as MatchState))
      .toThrow('opening-context-mismatch');
  });
  it('evaluates the approved lethal boundary after the separate unit save, never revives an eliminated seat',()=>{
    // 41-point lethal damage is a policy vector; current ordinary PvP cannot deal that much.
    const base=writeG23Progress({...createMatch(melSeed),playerHp:41},
      {...createG23Progress(melSeed),mel:{pvpCasts:12,savedBattleId:null}});
    expect(melCanSave(base,facts(base),0)).toBe(true);
    const events:MatchEvent[]=[];
    const saved=commitMelSave(observed(41,1,base),'battle-1',events);
    const committed=commitOpeningEncounterHealth(saved);
    expect(readG23Progress(committed)?.mel?.savedBattleId).toBe('battle-1');
    expect(events).toEqual([{type:'playerSaved',battleId:'battle-1',playerHp:1,source:'mel'}]);
    expect(receipts(committed)[0]).toMatchObject({hpBefore:41,hpAfter:1});
    expect(melCanSave(committed,facts(committed),0)).toBe(false);
    expect(receipts(commitOpeningEncounterHealth(observed(41,0)))).toEqual([]);
  });
  it('single-player settlement really records the threshold and Continue does not duplicate it',()=>{
    // Empty 1-2 is two pve-minion-melee-a (minions-a-v1). Both survive, stage base is 0, so damage is 2.
    // 42 − 2 = 40 crosses the Mel threshold. The old 43 assumed damage 3.
    const base={...createMatch(melSeed),playerHp:42};
    const empty={...base,preparation:{...base.preparation,units:base.preparation.units.filter(u=>u.team==='enemy')}};
    const result=startMatchCombat(empty),settled=accepted(result);
    expect(settled.playerHp).toBe(40);expect(receipts(settled)).toHaveLength(1);
    expect(result.ok&&result.events.some(e=>e.type==='playerSaved')).toBe(false);
    const next=accepted(nextRound(settled,settled.round));
    expect(next.openingEncounter).toBe(settled.openingEncounter);
  });
  it('multiplayer settlement records 41 → 39 atomically with the Mel reward, rejects retries and mirrors without RNG',()=>{
    const state=pvp(createMatch(melSeed),41),r=loss(state);
    expect(applyRoundSettlement(state,{...r,settlementEligible:false})).toMatchObject({ok:false,state,reason:'mirror-settlement'});
    const result=applyRoundSettlement(state,r),settled=accepted(result);
    expect(settled.playerHp).toBe(39);expect(receipts(settled)).toHaveLength(1);
    // The rolled Mel reward decides the tail: a seat mechanic grant emits mechanicGranted, an all-orb reward does not.
    // v23 seed 21 (first mels-blessing seed) rolls two Thief's Gloves: both arrive as gray orbs, no seat mechanic grant.
    expect(melSeed).toBe(21);
    expect(openingRewardAtoms(settled).map(a=>a.payload)).toEqual([{kind:'item',definitionId:'thiefs-gloves',quantity:1},{kind:'item',definitionId:'thiefs-gloves',quantity:1}]);
    expect(openingRewardOrbs(settled).map(o=>[o.orbId,o.tier,o.source])).toEqual(openingRewardAtoms(settled).map(a=>[a.id,'gray','mechanic']));
    expect((settled.seatMechanics?.receipts??[]).filter(r=>r.source===BATCH_SOURCE)).toEqual([]);
    expect(result.ok&&result.events.map(e=>e.type)).toEqual(['roundSettled','openingEffectApplied','openingRewardResolved']);
    expectMelRewardIssued(settled);
    for(const key of ['rngState','choiceRngState','rewardRngState','battleSeedRngState','equipmentState'] as const)
      expect(settled[key]).toEqual(state[key]);
    expect(applyRoundSettlement(settled,r)).toEqual({ok:false,state:settled,reason:'duplicate-settlement'});
    expect(receipts(accepted(applyRoundSettlement(pvp(createMatch(melSeed),2),loss(state))))).toEqual([]);
  });
  it('real lethal PvP saves once at low HP without manufacturing a threshold crossing',()=>{
    const original=pvp(createMatch(melSeed),2);
    const state=writeG23Progress(original,{...readG23Progress(original)!,mel:{pvpCasts:11,savedBattleId:null}});
    const result=applyRoundSettlement(state,loss(state,0,facts(state,1))),saved=accepted(result);
    expect(saved.playerHp).toBe(1);expect(saved.multiplayer?.status).toBe('active');
    expect(result.ok&&result.events.filter(e=>e.type==='playerSaved')).toHaveLength(1);
    expect(readG23Progress(saved)?.mel?.savedBattleId).toBe('battle-4');expect(receipts(saved)).toEqual([]);
  });
  it('eight shared seats observe independently; snapshot restore rejects missing/foreign receipts',()=>{
    let pool=createSharedPool('mel-eight',melSeed);
    const states:MatchState[]=[];
    for(let i=0;i<8;i++) {
      const result=initializeSharedSeat(pool,createMatch(200+i,{mode:'shared-deferred'}),`seat-${i}`,i);
      if(!result.ok)throw Error(result.reason);pool=result.pool;states.push(result.state);
    }
    const globalBefore=JSON.stringify(pool.openingEncounter);
    // Same empty 1-2: every seat loses 2 (two surviving melee minions, base 0).
    // 42 → 40 records a receipt; 43 → 41 stays above the threshold.
    const crossed=states.map((s,i)=>accepted(startMatchCombat({...s,playerHp:i===7?43:42,
      preparation:{...s.preparation,units:s.preparation.units.map(u=>u.team==='player'?
        {...u,location:{kind:'bench' as const,slot:0}}:u)}})));
    expect(crossed.map(s=>receipts(s).length)).toEqual([1,1,1,1,1,1,1,0]);
    expect(new Set(crossed.slice(0,7).map(s=>receipts(s)[0].receiptId)).size).toBe(7);
    for(const state of crossed) {
      expect(()=>validateOpeningEncounterState(state,pool.openingEncounter)).not.toThrow();
      const restored=restoreSharedOrbSnapshot(pool,JSON.stringify(state));
      expect(restored).toEqual(state);expect(commitOpeningEncounterHealth(restored)).toBe(restored);
    }
    for(const bad of [[],receipts(crossed[1])]) expect(()=>restoreSharedOrbSnapshot(pool,
      {...crossed[0],openingEncounter:{...crossed[0].openingEncounter,receipts:bad}})).toThrow('invalid-seat-state');
    expect(JSON.stringify(pool.openingEncounter)).toBe(globalBefore);
  });
  it('owner-only progress is detached and reports the granted reward; public view contains no personal receipt',()=>{
    const state=structuredClone(commitOpeningEncounterHealth(observed(41,40)));
    Object.assign(receipts(state)[0],{futureReward:'SECRET',rngState:'SECRET'});
    const progress=readOpeningMelProgress(state)!;
    expect(progress).toEqual({encounterId:'mels-blessing',thresholdHp:40,thresholdReached:true,rewardStatus:'granted',
      triggeredRound:1,hpBefore:41,hpAfter:40});
    expect(toPrivateSeatView(state).openingMelProgress).toEqual(progress);
    expect(readOpeningForgeProgress(state)).toBeNull();
    expect(toPrivateSeatView(state)).not.toHaveProperty('openingForgeProgress');
    expect(toPrivateSeatView(state)).not.toHaveProperty('openingEncounterProgress');
    expect(JSON.stringify(progress)).not.toMatch(/SECRET|seed|receiptId|factId|rng/i);
    expect(readOpeningEncounterView(state)).toEqual(readOpeningEncounterView(createMatch(melSeed)));
    expect(readOpeningEncounterView(state)).toMatchObject({enabled:true,statusTextZh:'本局奇遇效果已启用'});
    expect(readOpeningMelProgress(createMatch(warwickSeed))).toBeNull();
  });
  it('a Mel settlement ID matching the monkey node remains an observation, not a monkey grant',()=>{
    const state=observed(41,40);
    const result=commitOpeningEncounterHealth({...state,roundResults:[{...state.roundResults[0],settlementId:'3-5'}]});
    expect(receipts(result)[0]).toMatchObject({kind:'mel-threshold',nodeId:'3-5'});
    expect(()=>validateOpeningEncounterState(result)).not.toThrow();
    expect(applyOpeningEffects(result,[])).toEqual({ok:true,state:result,events:[]});
  });
  it.each(['component-anvils','artifact-anvil','golden-gala','prismatic-party','prismatic-prelude','prismatic-finale'])(
    '%s: preserves effect receipts and rejects mixed or missing observations',id=>{
      const state=createMatch(seedFor(id)),opening=state.openingEncounter;
      if(opening.mode==='shared-deferred')throw Error('unbound');
      expect(opening.receipts.length).toBeGreaterThan(0);
      expect(commitOpeningEncounterHealth(state)).toBe(state);
      expect(commitOpeningEncounterHealth(observed(41,40,state)).openingEncounter).toBe(opening);
      expect(()=>validateOpeningEncounterState(state)).not.toThrow();
      expect(readOpeningMelProgress(state)).toBeNull();
      expect(toPrivateSeatView(state).openingMelProgress).toBeNull();
      expect(toPrivateSeatView(state)).not.toHaveProperty('openingEncounterProgress');
      if(id==='component-anvils'||id==='artifact-anvil')expect(readOpeningForgeProgress(state)?.forgesGranted).toBe(id==='component-anvils'?2:1);
      else expect(readOpeningForgeProgress(state)).toBeNull();
      const mel=commitOpeningEncounterHealth(observed(41,40)),observation=receipts(mel)[0];
      for(const records of [[],[...opening.receipts,observation],[observation]])
        expect(()=>validateOpeningEncounterState({...state,openingEncounter:{...opening,receipts:records}})).toThrow('opening-context-mismatch');
      expect(()=>validateOpeningEncounterState({...mel,openingEncounter:{...mel.openingEncounter,receipts:[...receipts(mel),opening.receipts[0]]}} as MatchState)).toThrow('opening-context-mismatch');
    });
  it('a public-command solo loss route restores before/after crossing without replaying or removing the receipt',()=>{
    let state=createMatch(melSeed);
    state=accepted(sellUnit(state,state.preparation.units.find(u=>u.team==='player')!.id));
    let previous=state, steps=0;
    while(receipts(state).length===0 && steps++<200) {
      previous=state;
      if(state.phase==='choice') {
        const c=state.pendingChoice!;
        // Mel's threshold receipt is the subject here; Pilfer needs a separate battles archive,
        // while Anger Issues adds unrelated exact-command history to this empty-board loss route.
        const id=c.offers.find(id=>!['clear-mind','cluttered-mind','slammin','slammin-plus','spoils-of-war-i','spoils-of-war-ii','spoils-of-war-iii','pilfer','anger-issues'].includes(id))!;
        expect(id).toBeDefined();state=accepted(selectChoice(state,c.choiceId,c.generation,id));
      } else if(state.phase==='preparation') state=accepted(startMatchCombat(state));
      else if(state.phase==='combat') state=stepMatch(state).state;
      else state=accepted(nextRound(state,state.round));
    }
    expect(steps).toBeLessThan(200);expect(receipts(state)).toHaveLength(1);
    expect(restoreMatch(serializeMatch(previous))).toEqual(previous);
    const restored=restoreMatch(serializeMatch(state));
    expect(restored).toEqual(state);expect(commitOpeningEncounterHealth(restored)).toBe(restored);
    expect(()=>restoreMatch({...restored,openingEncounter:{...restored.openingEncounter,receipts:[]}})).toThrow('opening-context-mismatch');
    const continued=accepted(nextRound(restored,restored.round));
    expect(receipts(continued)).toEqual(receipts(restored));
    expect(restoreMatch(serializeMatch(continued))).toEqual(continued);
  });
});

describe('PR6 Warwick interface accepts only settled PvP kills',()=>{
  const kill:OpeningWarwickKillFact={battleId:'battle',eventSeq:1,victimId:'enemy',victimKind:'champion',settlementEligible:true};
  it.each([[],[kill],[kill,kill],[{...kill,victimKind:'summon' as const}],[{...kill,victimKind:'monster' as const}],
    [{...kill,settlementEligible:false}]].map(facts=>({facts})))('never rolls or grants for reserved facts %#',({facts})=>{
    const state=createMatch(warwickSeed),before=JSON.stringify(state);
    const result=applyWarwickHunger(state,facts);
    // Batch B (v22) rolls Warwick loot at battle settlement; this interface only authenticates settled kills.
    expect(result).toEqual(facts.length?{ok:false,state,reason:'invalid-opening-effect'}:{ok:true,state,events:[]});expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(applyWarwickHunger(restoreMatch(serializeMatch(state)),facts)).toEqual(result);
    expect(receipts(state)).toEqual([]);
  });
  it('rejects another encounter or corrupt binding before accepting any input',()=>{
    const other=createMatch(melSeed);
    expect(applyWarwickHunger(other,[kill])).toEqual({ok:false,state:other,reason:'invalid-opening-effect'});
    const state=createMatch(warwickSeed),bad={...state,openingEncounter:{mode:'shared-deferred' as const}};
    expect(applyWarwickHunger(bad,[kill])).toEqual({ok:false,state:bad,reason:'opening-context-mismatch'});
  });
});
