import { syntheticSharedRound } from './tp-helpers';
import { describe, expect, it } from 'vitest';
import { advanceMultiplayerRound, snapshotForBattle, compileBattle, resolveTwoSidedBattle, proposeSettlement,
  applyRoundSettlement, restoreBattleInput, nextRound, createMatch, nextSharedRound, buySharedUnit, sellSharedUnit,
  needsAnomalyRecruitment, forfeitPendingChoice, claimOrDiscardLoot, equipItem, buyUnit, sellUnit,
  type MatchState } from '../src/server-entry';
import { FINAL_ROUND, getRoundSchedule } from '../src/simulation/round-schedule';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { getMultiplayerRoundById } from '../src/simulation/multiplayer-round';
import { freeze } from './combat-helpers';
import { accepted, finalSettlement, settle } from './t5r-helpers';
import { room, batch, accept, conserved } from './tp-helpers';

const duel = (a:MatchState,b:MatchState) => resolveTwoSidedBattle(compileBattle(snapshotForBattle(a,a.multiplayer!.seatId),
  snapshotForBattle(b,b.multiplayer!.seatId),42,{battleId:`overtime:${a.round}`}),1201);

describe('T5R online overtime',()=>{
  it('five empty-v-empty rounds have independent receipts, normal income/XP/shops and 17 raw damage each',()=>{
    const initial = finalSettlement();
    let a:MatchState={...initial,preparation:{...initial.preparation,units:[]}},
      b:MatchState={...a,multiplayer:{...a.multiplayer!,seatId:'B'}};
    const loot = a.m8.loot, rewardRng = a.rewardRngState, choiceRng = a.choiceRngState;
    let gold=25, xp=0;
    for(let n=1;n<=5;n++) {
      const prior=a;
      a=accepted(advanceMultiplayerRound(freeze(a),a.round));b=accepted(advanceMultiplayerRound(freeze(b),b.round));
      expect(a).toMatchObject({round:FINAL_ROUND+n,roundDefinitionId:`overtime-${n}`,phase:'preparation',pendingChoice:null,
        m8:{round:{kind:'pvp',isFinal:false,stage:6,encounterId:null}}});
      expect(a.gold).toBe(gold);
      expect(a.shop.generation).toBe(prior.shop.generation+1);expect(a.shop.slots).toHaveLength(5);
      expect(a.rngState).not.toBe(prior.rngState);expect(a.m8.loot).toEqual(loot);
      expect(a.rewardRngState).toBe(rewardRng);expect(a.choiceRngState).toBe(choiceRng);
      expect(needsAnomalyRecruitment(a)).toBe(false);
      expect(forfeitPendingChoice(a,a.round,null,null)).toEqual({ok:false,state:a,reason:'no-pending-choice'});
      const battle=duel(a,b),p=proposeSettlement(battle);
      const restored=restoreBattleInput(JSON.parse(JSON.stringify(compileBattle(snapshotForBattle(a,'A'),snapshotForBattle(b,'B'),42,{battleId:`overtime:${a.round}`}))));
      expect(proposeSettlement(resolveTwoSidedBattle(restored,1201))).toEqual(p);
      const oldReceipt={version:'multiplayer-settlement-v1',settlementId:`old-${n}`,battleId:battle.battleId,seatId:'A',round:a.round,roundId:a.roundDefinitionId,settlementEligible:true,result:'draw',baseDamage:12,damage:12,opposingSurvivors:0,growth:[],combatTicks:battle.terminal.tick,combatEventCount:battle.events.length};
      expect(applyRoundSettlement(a,oldReceipt)).toEqual({ok:false,state:a,reason:'invalid-receipt'});
      expect(p.a).toMatchObject({result:'draw',baseDamage:17,damage:17,opposingSurvivors:0});
      expect(p.b).toMatchObject({result:'draw',damage:17});
      a=settle(a,battle,p.a);b=settle(b,battle,p.b);
      expect(a.gold).toBe(gold); // No preparation income is paid in settlement.
      gold+=5+Math.min(5,Math.floor(gold/10))+(n>=4?2:n>=2?1:0);xp+=2;
      expect(a.roundResults.at(-1)!.goldAfter).toBe(gold);expect(a.xp).toBe(xp);expect(a.playerHp).toBe(100-17*n);
      expect(a.multiplayer!.receipts).toHaveLength(n);expect(a.roundResults).toHaveLength(FINAL_ROUND+n);
      expect(applyRoundSettlement(a,a.multiplayer!.receipts.at(-1))).toEqual({ok:false,state:a,reason:'duplicate-settlement'});
      expect(accepted(claimOrDiscardLoot(a,a.round))).toBe(a);
    }
  });
  it('simultaneous HP zero remains legal eliminated settlement; mirrors never commit',()=>{
    const initial=finalSettlement();const a=accepted(advanceMultiplayerRound({...initial,playerHp:1,preparation:{...initial.preparation,units:[]}},FINAL_ROUND));
    const b:MatchState={...a,multiplayer:{...a.multiplayer!,seatId:'B'}};
    const battle=duel(a,b),p=proposeSettlement(battle);
    for(const state of [settle(a,battle,p.a),settle(b,battle,p.b)]) {
      expect(state).toMatchObject({playerHp:0,phase:'settlement',outcome:null,multiplayer:{status:'eliminated'}});
      expect(state.roundResults.at(-1)).toMatchObject({playerDamage:17,hpLost:1});
      expect(advanceMultiplayerRound(state,state.round)).toEqual({ok:false,state,reason:'seat-eliminated'});
    }
    const mirror=resolveTwoSidedBattle(compileBattle(snapshotForBattle(a,'A'),snapshotForBattle(b,'B'),42,{battleId:'mirror',mirrorOfSeatId:'B'}),1201);
    expect(proposeSettlement(mirror).b).toMatchObject({settlementEligible:false,damage:0});
    expect(()=>settle(b,mirror,proposeSettlement(mirror).b)).toThrow('mirror-settlement');
  });
  it('shared shops use the release barrier, rotate through five overtime rounds, and permit buy/sell',()=>{
    const roomState=room();let pool={...roomState.pool,naturalRound:FINAL_ROUND};
    const bound=syntheticSharedRound(pool,roomState.states.map(finalSettlement),FINAL_ROUND);pool=bound.pool;
    let states:readonly MatchState[]=bound.states;
    for(let n=1;n<=5;n++) {
      const prior=states;
      const result=batch(nextSharedRound(freeze(pool),freeze(states),FINAL_ROUND+n-1));pool=result.pool;states=result.states;
      expect(pool.naturalRound).toBe(FINAL_ROUND+n);conserved(pool,states);
      expect(result.poolEvents.find(e=>e.type==='sharedRefreshOrder')).toMatchObject({seatIds:n%2?pool.order:[...pool.order].reverse()});
      expect(states[0].shop.generation).toBe(prior[0].shop.generation+1);
      const state=states[0];expect(advanceMultiplayerRound(state,state.round)).toEqual({ok:false,state,reason:'shared-pool-required'});
      const purchase=accept(buySharedUnit(pool,state,0,state.shop.generation));pool=purchase.pool;
      const added=purchase.state.preparation.units.find(u=>!state.preparation.units.some(old=>old.id===u.id))!;
      const sale=accept(sellSharedUnit(pool,purchase.state,added.id));pool=sale.pool;states=[sale.state,states[1]];conserved(pool,states);
      const combat=duel(states[0],states[1]),proposals=proposeSettlement(combat);
      states=[settle(states[0],combat,proposals.a),settle(states[1],combat,proposals.b)];
    }
    const missing=nextSharedRound(pool,[states[0]],states[0].round);expect(missing.ok).toBe(false);
    const invalid=[states[0],{...states[1],roundResults:[]}];
    expect(nextSharedRound(pool,invalid,states[0].round)).toEqual({ok:false,pool,states:invalid,reason:'unsettled-round'});
  });
  it('lock and temporary equipment persist correctly; online trades append provenance',()=>{
    const base=finalSettlement(),id=base.preparation.units[0].id;
    let state=accepted(advanceMultiplayerRound({...base,shop:{...base.shop,locked:true},
      items:[{id:'item-1',definitionId:'thiefs-gloves',location:{kind:'inventory'}}]},base.round));
    expect(state.shop).toEqual({...base.shop,locked:true});expect(state.rngState).toBe(base.rngState);expect(state.shop.generation).toBe(base.shop.generation);
    state=accepted(equipItem(state,'item-1',id,0));expect(state.temporaryEquipment).toHaveLength(2);
    const children=state.temporaryEquipment;
    const b={...state,multiplayer:{...state.multiplayer!,seatId:'B'}};
    const combat=duel(state,b);state=settle(state,combat,proposeSettlement(combat).a);
    state=accepted(advanceMultiplayerRound(state,state.round));
    expect(state.temporaryEquipment.every(e=>e.roundId==='overtime-2')).toBe(true);
    expect(state.temporaryEquipment.map(e=>e.temporaryId)).not.toEqual(children.map(e=>e.temporaryId));
    const oldIds=state.preparation.units.map(u=>u.id);
    state=accepted(buyUnit({...state,gold:100},0,state.shop.generation));
    const added=state.preparation.units.find(u=>!oldIds.includes(u.id))!;
    state=accepted(sellUnit(state,added.id));expect(state.resourceProvenance.entries.at(-1)!.roundId).toBe('overtime-2');
  });
  it('failures preserve identity/RNG, and offline catalog/final boundary is unchanged',()=>{
    const state=finalSettlement();
    for(const [s,round,reason] of [[createMatch(),1,'multiplayer-required'],[state,1,'stale-round'],
      [{...state,roundResults:[]},state.round,'unsettled-round'],[{...state,roundDefinitionId:'bad'},state.round,'stale-round']] as const) {
      const before=JSON.stringify(s);expect(advanceMultiplayerRound(freeze(s),round)).toEqual({ok:false,state:s,reason});expect(JSON.stringify(s)).toBe(before);
    }
    const {multiplayer:_,...offline}=state;
    expect(nextRound(offline,offline.round)).toEqual({ok:false,state:offline,reason:'wrong-phase'});
    expect(()=>getCatalogRoundById('overtime-1')).toThrow();expect(()=>getRoundSchedule(FINAL_ROUND+1)).toThrow();
    for(const id of ['overtime-0','overtime-01','overtime--1','overtime-1.5','overtime-9007199254740992']) expect(()=>getMultiplayerRoundById(id)).toThrow();
  });
});
