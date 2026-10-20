import { describe, expect, it } from 'vitest';
import { generateSharedShop, refreshSharedShops, nextSharedRound, runSharedMatchCommand, sellSharedUnit,
  releaseSeatOnElimination, buySharedUnit, snapshotForBattle, compileBattle, resolveTwoSidedBattle,
  proposeSettlement, applyRoundSettlement, ROUND_SETTLEMENT_VERSION, type MatchState, type CombatState } from '../src/server-entry';
import { stepCombat } from '../src/simulation/combat';
import { revealMatchLoot } from '../src/simulation/loot-runtime';
import { readLootView } from '../src/simulation/loot-view';
import { freeze } from './combat-helpers';
import { accept,batch,room,conserved,rejected,fight,fullBench } from './tp-helpers';

describe('TP opening and earned reward sources',()=>{
  it('frozen future rewards reserve nothing; earned hero competes for one last copy then compensates gold once',()=>{
    const {pool,states}=room({irelia:2,darius:1});expect(pool.pending).toEqual([]);expect(pool.available.darius).toBe(1);
    const revealedA=fight(pool,states[0]);expect(revealedA.pool.available.darius).toBe(1);expect(revealedA.pool.pending).toEqual([]);
    const a=accept(runSharedMatchCommand(revealedA.pool,revealedA.state,{type:'claimOrb',round:1,orbId:readLootView(revealedA.state).unclaimedOrbs![0].orbId}));expect(a.pool.available.darius).toBe(0);
    expect(a.pool.rewards[0]).toMatchObject({seatId:'seat-0',definitionId:'darius',resolution:'held',gold:0});
    const revealedB=fight(a.pool,states[1]),b=accept(runSharedMatchCommand(revealedB.pool,revealedB.state,{type:'claimOrb',round:1,orbId:readLootView(revealedB.state).unclaimedOrbs![0].orbId}));
    expect(b.pool.rewards[1]).toMatchObject({seatId:'seat-1',definitionId:'darius',resolution:'gold',gold:1});
    expect(b.state.gold-a.state.gold).toBe(1); // same battle/economy, only shortage conversion differs
    expect(b.state.preparation.units.filter(u=>u.team==='player')).toHaveLength(1);
    expect(b.state.m8.loot.receipts[0]).toMatchObject({payload:{kind:'unit',definitionId:'darius',quantity:1},resolution:'gold',gold:1});
    expect(readLootView(b.state).claimReceipts![0]).toMatchObject({resolution:'gold',gold:1});
    const again=accept(runSharedMatchCommand(b.pool,b.state,{type:'claimLoot',round:1}));
    expect(again.pool).toBe(b.pool);expect(again.state).toBe(b.state);expect(again.events).toEqual([]);
    conserved(b.pool,[a.state,b.state]);
  });
  it('full bench reserves nothing at reveal or deadline; explicit claim sells once',()=>{
    const full=fullBench(),available=full.pool.available.darius;
    const pending=fight(full.pool,full.state);
    expect(pending.pool.pending).toHaveLength(0);expect(pending.pool.available.darius).toBe(available);
    expect(pending.state.m8.loot.direct[0].status).toBe('revealed');
    const discard=accept(runSharedMatchCommand(freeze(pending.pool),freeze(pending.state),{type:'claimLoot',round:1}));
    expect(discard.pool.pending).toEqual([]);expect(discard.pool.available.darius).toBe(available);
    expect(discard.pool.rewards).toEqual([]);expect(discard.state.m8.loot.direct[0].status).toBe('revealed');
    const claimed=accept(runSharedMatchCommand(discard.pool,discard.state,{type:'claimOrb',round:1,orbId:readLootView(discard.state).unclaimedOrbs![0].orbId}));
    expect(claimed.pool.rewards.at(-1)).toMatchObject({resolution:'capacity-sold',gold:1});expect(claimed.pool.available.darius).toBe(available);conserved(claimed.pool,[claimed.state]);
    const again=accept(runSharedMatchCommand(discard.pool,discard.state,{type:'claimLoot',round:1}));expect(again.pool).toBe(discard.pool);
    const next=batch(nextSharedRound(discard.pool,[discard.state],1));expect(next.states[0].round).toBe(2);conserved(next.pool,next.states);
  });
  it('selling to make space leaves the orb untouched until claim transfers a unique source',()=>{
    const full=fullBench(),pending=fight(full.pool,full.state);
    const unit=pending.state.preparation.units.find(u=>u.team==='player'&&u.location.kind==='bench')!;
    const sold=accept(sellSharedUnit(pending.pool,pending.state,unit.id));
    expect(sold.pool.pending).toEqual([]);expect(sold.pool.available[unit.definitionId]).toBe(pending.pool.available[unit.definitionId]+1);
    expect(sold.pool.available.darius).toBe(pending.pool.available.darius);expect(sold.pool.rewards).toEqual([]);
    const claimed=accept(runSharedMatchCommand(sold.pool,sold.state,{type:'claimOrb',round:1,orbId:readLootView(sold.state).unclaimedOrbs![0].orbId}));
    expect(claimed.pool.available.darius).toBe(sold.pool.available.darius-1);expect(claimed.pool.rewards.at(-1)?.resolution).toBe('held');
    expect(claimed.pool.holdings.some(h=>h.definitionId==='darius')).toBe(true);conserved(claimed.pool,[claimed.state]);
  });
  it('elimination returns pending, held and shop copies without granting sale gold; duplicate is inert',()=>{
    const full=fullBench(),pending=fight(full.pool,full.state);
    const state:MatchState={...pending.state,playerHp:0,multiplayer:{...pending.state.multiplayer!,status:'eliminated'}};
    const out=accept(releaseSeatOnElimination(pending.pool,state));
    expect(out.pool.available).toEqual(out.pool.initial);expect(out.pool.pending).toEqual([]);expect(out.pool.holdings).toEqual([]);expect(out.pool.shops).toEqual([]);
    expect(out.state.gold).toBe(state.gold);expect(out.events.map(e=>e.type)).toContain('lootForfeited');
    rejected(releaseSeatOnElimination(out.pool,out.state),out.pool,out.state,'duplicate-release');conserved(out.pool,[out.state]);
  });
  it('unit reward upgrade uses the same 3-source ownership ledger as a shop purchase',()=>{
    const {pool,states}=room({irelia:1,darius:3},1);let r=accept(generateSharedShop(pool,{...states[0],gold:20},0));
    for(let slot=0;slot<2;slot++)r=accept(buySharedUnit(r.pool,r.state,slot,1));
    // Release the third shop offer by elimination is not appropriate; sell one then acquire reward
    // from the returned copy while another card remains reserved in the shop.
    const one=r.state.preparation.units.find(u=>u.definitionId==='darius')!;
    const sold=accept(sellSharedUnit(r.pool,r.state,one.id));
    const bought=accept(buySharedUnit(sold.pool,sold.state,2,1));
    expect(bought.pool.available.darius).toBe(1);
    const finished=fight(bought.pool,bought.state),won=accept(runSharedMatchCommand(finished.pool,finished.state,{type:'claimOrb',round:1,orbId:readLootView(finished.state).unclaimedOrbs![0].orbId})),held=won.pool.holdings.find(h=>h.definitionId==='darius')!;
    expect(held.sources).toHaveLength(3);expect(won.state.preparation.units.find(u=>u.id===held.unitId)?.starLevel).toBe(2);
    expect(won.pool.rewards.at(-1)?.resolution).toBe('held');conserved(won.pool,[won.state]);
  });
  it('late compensation overflow rolls back policy reservations, receipts, assets and events together',()=>{
    const {pool,states}=room({irelia:1},1);let r=accept(runSharedMatchCommand(pool,states[0],{type:'startCombat'}));
    // Observe the real finished combat before invoking the Match grant transaction.
    let combat:CombatState=r.state.combat!;while(combat.status==='running')combat=stepCombat(combat).state;
    if(combat.result===null)throw new Error('combat');
    const revealed=revealMatchLoot(r.state,combat).state;
    const state:MatchState={...revealed,gold:Number.MAX_SAFE_INTEGER,phase:'settlement',combat:{...combat,status:'finished',result:combat.result}};
    const before=JSON.stringify([r.pool,state]);
    rejected(runSharedMatchCommand(freeze(r.pool),freeze(state),{type:'claimOrb',round:1,orbId:readLootView(state).unclaimedOrbs![0].orbId}),r.pool,state,'invalid-loot');
    expect(JSON.stringify([r.pool,state])).toBe(before);
  });
  it('unearned neutral drops never reserve or compensate; mirrors and combat summons never appear in holdings',()=>{
    const {pool,states}=room({irelia:1,darius:1},1);
    // A legitimate sale empties the real army, so the PvE concession kills no source.
    const sold=accept(sellSharedUnit(pool,states[0],'unit-1')),lost=fight(sold.pool,sold.state);
    expect(lost.pool.rewards).toEqual([]);expect(lost.pool.pending).toEqual([]);expect(lost.pool.available).toEqual(lost.pool.initial);
    expect(lost.state.m8.loot.direct[0].status).toBe('forfeited');conserved(lost.pool,[lost.state]);
  });
});

describe('TP actual round integration',()=>{
  it('eight public openings, choices, shared natural shops, T2/T3 and next round conserve without infinite offers',()=>{
    const init=room(undefined,8),first=batch(refreshSharedShops(init.pool,init.states,1));
    let pool=first.pool,states=[...first.states];
    for(let round=1;round<=3;round++) {
      for(let i=0;i<states.length;i++) {
        let r=fight(pool,states[i]);pool=r.pool;states[i]=r.state;
        while(states[i].phase==='choice') {
          const s=states[i],p=s.pendingChoice!;r=accept(runSharedMatchCommand(pool,s,{type:'timeoutChoice',round,choiceId:p.choiceId,generation:p.generation}));pool=r.pool;states[i]=r.state;
        }
        r=accept(runSharedMatchCommand(pool,states[i],{type:'claimLoot',round}));pool=r.pool;states[i]=r.state;
      }
      const next=batch(nextSharedRound(pool,states,round));pool=next.pool;states=[...next.states];conserved(pool,states);
    }
    for(let i=0;i<states.length;i++) {
      const p=states[i].pendingChoice!;const r=accept(runSharedMatchCommand(pool,states[i],{type:'timeoutChoice',round:4,choiceId:p.choiceId,generation:p.generation}));pool=r.pool;states[i]=r.state;
    }
    const poolBefore=JSON.stringify(pool);
    for(let i=0;i<8;i+=2) {
      const battle=resolveTwoSidedBattle(compileBattle(snapshotForBattle(states[i],`seat-${i}`),snapshotForBattle(states[i+1],`seat-${i+1}`),42,{battleId:`pair:${i}`}),1201);
      for(const p of Object.values(proposeSettlement(battle))) {
        const index=Number(p.seatId.slice(5)),s=states[index];
        const result=applyRoundSettlement(s,{version:ROUND_SETTLEMENT_VERSION,settlementId:`4:${p.seatId}`,battleId:battle.battleId,
          seatId:p.seatId,round:4,roundId:'2-1',settlementEligible:p.settlementEligible,result:p.result,damage:p.damage,
          baseDamage:p.baseDamage,opposingSurvivors:p.opposingSurvivors,growth:p.growth,combatTicks:battle.terminal.tick,combatEventCount:battle.events.length});
        if(!result.ok)throw new Error(result.reason);states[index]=result.state;
      }
    }
    expect(JSON.stringify(pool)).toBe(poolBefore);conserved(pool,states);
    const next=batch(nextSharedRound(pool,states,4));expect(next.states.every(s=>s.roundDefinitionId==='2-2')).toBe(true);conserved(next.pool,next.states);
    expect(next.pool.naturalRound).toBe(5);
  },20_000); // 24 real PvE battles plus four two-sided PvP battles across all eight seats.
  it('a late nextRound failure publishes no earlier seat, free shop, loot plan or RNG update',()=>{
    const initial=room(undefined,2),first=batch(refreshSharedShops(initial.pool,initial.states,1));
    const a=fight(first.pool,first.states[0]);const states=[a.state,first.states[1]],before=JSON.stringify([a.pool,states]);
    const failed=nextSharedRound(freeze(a.pool),freeze(states),1);
    expect(failed).toEqual({ok:false,pool:a.pool,states,reason:'wrong-phase'});expect(failed.pool).toBe(a.pool);expect(failed.states).toBe(states);
    expect(JSON.stringify([a.pool,states])).toBe(before);
  });
});
