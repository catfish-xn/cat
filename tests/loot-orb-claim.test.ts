import {describe,it,expect} from 'vitest';
import {runSharedMatchCommand,sellSharedUnit,assertSharedPoolConservation,refreshSharedShops,nextSharedRound,restoreSharedOrbSnapshot} from '../src/simulation/shared-pool';
import {claimOrb,createMatch,startMatchCombat,stepMatch,lockMatchCombatRoster} from '../src/simulation/match';
import {ROUND_SETTLEMENT_VERSION, type RoundSettlementReceipt} from '../src/simulation/round-settlement';
import {validateMultiplayerOrbLedger} from '../src/simulation/orb-restore';
import {grantMechanicUnit} from '../src/simulation/seat-mechanics/grants';
import {drainP2Gifts} from '../src/simulation/s13-augments-p2-grants';
import {drainG23Rewards} from '../src/simulation/g2-3-runtime';
import {g23RewardAtoms} from '../src/simulation/g2-3-rewards';
import {G23_BLACK_MARKETS,G23_CONQUEROR_CHESTS,g23ConquerorReward} from '../src/simulation/content/g2-3-policy';
import {writeG23Progress,readG23Progress} from '../src/simulation/g2-3-state';
import {readLootView,readPublicOrbSummary} from '../src/simulation/loot-view';
import {toPrivateSeatView} from '../src/simulation/private-seat-view';
import {claimBotPreparationOrbs} from '../src/simulation/bot';
import {freezeOrbLayoutThroughRound} from '../src/simulation/orb-layout';
import {prepareMatchLoot,revealMatchLoot} from '../src/simulation/loot-runtime';
import {createRoundEnemies} from '../src/simulation/round-enemies';
import {getCatalogRoundById} from '../src/simulation/round-selectors';
import {createCombat} from '../src/simulation/combat';
import {foldResourceProvenance} from '../src/simulation/resource-provenance';
import type {MatchState} from '../src/simulation/match-types';
import type {SharedPoolState} from '../src/simulation/shared-pool-types';
import {accept,room,fullBench,fight,batch,syntheticSharedRound} from './tp-helpers';
import {CAPACITY_VECTORS,CLAIM_EXPECTATIONS,receiptTotals,independentConservation} from './oracles/multiplayer-orb-oracle';
import {forfeitTerminalOrbs,forfeitUnclaimedOrbs} from '../src/server-entry/index';

function gift(state:MatchState,id:string,starLevel:1|2|3=1,receiptId='test-gift') {
  const r=grantMechanicUnit(state,{receiptId,source:'test',definitionId:id,starLevel});
  if(!r.ok)throw Error(r.reason);return r.state;
}
const ids=(state:MatchState)=>readLootView(state).unclaimedOrbs!.map(o=>o.orbId);
function claim(pool:SharedPoolState,state:MatchState,orbId=ids(state)[0]) {
  return accept(runSharedMatchCommand(pool,state,{type:'claimOrb',round:state.round,orbId}));
}
function unchanged(pool:SharedPoolState,state:MatchState,orbId:string,reason:string,round=state.round) {
  const before=JSON.stringify({pool,state}),r=runSharedMatchCommand(pool,state,{type:'claimOrb',round,orbId});
  expect(r).toEqual({ok:false,pool,state,reason});expect(r.pool).toBe(pool);expect(r.state).toBe(state);
  expect(JSON.stringify({pool,state})).toBe(before);
}
const twoCost=['leona','vander','rell','tristana','urgot','renata','sett'];
function unusedTwoCost(state:MatchState){return twoCost.find(id=>!state.preparation.units.some(u=>u.definitionId===id))!;}
function finish(pool:SharedPoolState,state:MatchState) {
  let r={pool,state},budget=1201;
  while(r.state.phase==='combat'&&budget-->0)r=accept(runSharedMatchCommand(r.pool,r.state,{type:'step'}));
  expect(budget).toBeGreaterThanOrEqual(0);return r;
}
function expectQueueOnly(before:MatchState,after:MatchState) {
  const {sharedPool:_beforePool,m8:beforeM8,...beforeRest}=before;
  const {sharedPool:_afterPool,m8:afterM8,...afterRest}=after;
  const {queuedOrbClaims:_beforeQueue,...beforeLoot}=beforeM8.loot;
  const {queuedOrbClaims:_afterQueue,...afterLoot}=afterM8.loot;
  expect(afterRest).toEqual(beforeRest);expect({...afterM8,loot:afterLoot}).toEqual({...beforeM8,loot:beforeLoot});
}
function expectTerminalForfeitNoop(state:MatchState) {
  const before=structuredClone(state),receipts=state.m8.loot.receipts,seq=state.nextMatchEventSeq;
  const result=forfeitTerminalOrbs(state);
  expect(result.events).toEqual([]);expect(result.state).toBe(state);
  expect(result.state).toEqual(before);
  expect(result.state.m8.loot.receipts).toBe(receipts);
  expect(result.state.m8.loot.receipts).toHaveLength(before.m8.loot.receipts.length);
  expect(result.state.nextMatchEventSeq).toBe(seq);
}
function pvpSeat() {
  const initial=room(undefined,1);let {pool,states}=batch(refreshSharedShops(initial.pool,initial.states,1)),state=states[0];
  for(let round=1;round<=3;round++) {
    const done=fight(pool,state);pool=done.pool;state=done.state;
    while(state.phase==='choice') {
      const c=state.pendingChoice!,r=accept(runSharedMatchCommand(pool,state,{type:'timeoutChoice',round,choiceId:c.choiceId,generation:c.generation}));
      pool=r.pool;state=r.state;
    }
    const next=batch(nextSharedRound(pool,[state],round));pool=next.pool;state=next.states[0];
  }
  while(state.phase==='choice') {
    const c=state.pendingChoice!,r=accept(runSharedMatchCommand(pool,state,{type:'timeoutChoice',round:4,choiceId:c.choiceId,generation:c.generation}));
    pool=r.pool;state=r.state;
  }
  return {pool,state};
}
function pvpReceipt(state:MatchState,loss=false):RoundSettlementReceipt {
  return {version:ROUND_SETTLEMENT_VERSION,settlementId:'queue-settlement',battleId:'queue-battle',seatId:state.multiplayer!.seatId,
    round:state.round,roundId:state.roundDefinitionId,settlementEligible:true,result:loss?'loss':'win',damage:loss?2:0,baseDamage:2,
    opposingSurvivors:0,growth:[],combatTicks:88,combatEventCount:20};
}

describe('multiplayer explicit orb claims',()=>{
  it.each(['survivor', 'queued survivor', 'gameOver', 'eliminated'] as const)('terminal finalization forfeits only unclaimed earned entries with Match sequence numbers: %s', mode=>{
    const initial=room(undefined,1),done=mode==='queued survivor'?pvpSeat():fight(initial.pool,initial.states[0]);
    const gifted=gift(done.state,'singed',1,'terminal-first');
    let paid=claim(done.pool,gifted,ids(gifted).at(-1)!);
    let state=gift(paid.state,'singed',2,'terminal-unclaimed');
    const orbs=readLootView(state).unclaimedOrbs!;
    expect(orbs.some(o=>o.source==='pve')).toBe(true);
    expect(orbs.some(o=>o.source==='mechanic')).toBe(true);
    const plans=[...state.m8.loot.frozen.rounds.flatMap(r=>r.orbs),...state.m8.loot.rewardOrbs??[]];
    const dropIds=plans.flatMap(o=>o.entries).filter(e=>state.m8.loot.direct.some(d=>d.dropId===e.dropId&&d.status==='revealed')).map(e=>e.dropId);
    const planned=state.m8.loot.direct.filter(d=>d.status==='planned');
    expect(dropIds.length).toBeGreaterThan(0);
    if(mode==='queued survivor'){
      const locked=lockMatchCombatRoster(state);if(!locked.ok)throw Error(locked.reason);
      state=locked.state;
      for(const orb of orbs){paid=claim(paid.pool,state,orb.orbId);state=paid.state;}
      expect(state.m8.loot.queuedOrbClaims).toEqual(orbs.map(o=>o.orbId));
      expect(restoreSharedOrbSnapshot(paid.pool,state)).toEqual(state);
    }
    if(mode==='gameOver'){
      if(state.combat&&state.combat.status!=='finished')throw Error('Terminal fixture requires a finished battle');
      state={...state,phase:'gameOver',pendingChoice:null,combat:state.combat};
    }
    if(mode==='eliminated')state={...state,multiplayer:{...state.multiplayer!,status:'eliminated'}};
    const before=structuredClone(state),poolBefore=structuredClone(paid.pool);
    const result=forfeitTerminalOrbs(state),receipts=result.state.m8.loot.receipts.slice(state.m8.loot.receipts.length);
    expect(state).toEqual(before);
    expect(receipts.map(r=>r.dropId)).toEqual(dropIds);
    expect(receipts.every(r=>r.resolution==='forfeited'&&r.gold===0&&r.claimedRoundId===state.roundDefinitionId&&r.grantedUnitIds.length===0&&r.grantedItemIds.length===0)).toBe(true);
    expect(result.state.m8.loot.receipts.slice(0,state.m8.loot.receipts.length)).toEqual(state.m8.loot.receipts);
    expect(result.state.m8.loot.direct.filter(d=>d.status==='planned')).toEqual(planned);
    expect(result.state.m8.loot.direct.filter(d=>d.status==='revealed')).toEqual([]);
    expect(result.state.m8.loot.queuedOrbClaims??[]).toEqual([]);
    expect(result.events).toHaveLength(dropIds.length*2);
    for(const [i,event] of result.events.entries()){
      expect(event).toMatchObject({domain:'match',eventSeq:state.nextMatchEventSeq+i});
      expect(event.type).toBe(i%2===0?'lootForfeited':'lootGranted');
    }
    expect(result.events.filter(e=>e.type==='lootForfeited').map(e=>e.dropId)).toEqual(dropIds);
    expect(result.events.filter(e=>e.type==='lootGranted').map(e=>e.receipt)).toEqual(receipts);
    expect(result.state.nextMatchEventSeq).toBe(state.nextMatchEventSeq+result.events.length);
    const {m8:oldM8,nextMatchEventSeq:_oldSeq,...oldRest}=state;
    const {m8:newM8,nextMatchEventSeq:_newSeq,...newRest}=result.state;
    expect(newRest).toEqual(oldRest);expect({...newM8,loot:oldM8.loot}).toEqual(oldM8);
    const {direct:_oldDirect,receipts:_oldReceipts,queuedOrbClaims:_oldQueue,...oldLootRest}=oldM8.loot;
    const {direct:_newDirect,receipts:_newReceipts,queuedOrbClaims:_newQueue,...newLootRest}=newM8.loot;
    expect(newLootRest).toEqual(oldLootRest);
    const restored=restoreSharedOrbSnapshot(paid.pool,JSON.stringify(result.state));
    expect(restored).toEqual(result.state);
    for(const finalized of [result.state,restored]){
      const retry=forfeitTerminalOrbs(finalized);
      expect(retry.state).toBe(finalized);expect(retry.events).toEqual([]);
    }
    expect(paid.pool).toEqual(poolBefore);assertSharedPoolConservation(paid.pool,[result.state]);
  });
  it('terminal finalization is an exact no-op for offline seats and empty online seats',()=>{
    for(const state of [createMatch(5),room(undefined,1).states[0]]){
      const result=forfeitTerminalOrbs(state);
      expect(result.state).toBe(state);expect(result.events).toEqual([]);
    }
  });
  it.each(['planner-first','terminal-first'] as const)('legacy planner and terminal entry forfeit each entry only once: %s',order=>{
    const initial=room(undefined,1),done=fight(initial.pool,initial.states[0]);
    const state=gift(done.state,'singed',2,'cross-forfeit'),before=structuredClone(state);
    const dropIds=state.m8.loot.direct.filter(d=>d.status==='revealed').map(d=>d.dropId);
    expect(dropIds.length).toBeGreaterThan(1);
    const first=order==='planner-first'?forfeitUnclaimedOrbs(state):forfeitTerminalOrbs(state);
    const second=order==='planner-first'?forfeitTerminalOrbs(first.state):forfeitUnclaimedOrbs(first.state);
    expect(state).toEqual(before);
    const receipts=first.state.m8.loot.receipts.slice(state.m8.loot.receipts.length);
    expect(receipts.map(r=>r.dropId).sort()).toEqual([...dropIds].sort());
    expect(receipts.every(r=>r.resolution==='forfeited'&&r.gold===0&&r.grantedUnitIds.length===0&&r.grantedItemIds.length===0)).toBe(true);
    expect(new Set(first.state.m8.loot.receipts.map(r=>r.receiptId)).size).toBe(first.state.m8.loot.receipts.length);
    expect(new Set(first.state.m8.loot.receipts.map(r=>r.dropId)).size).toBe(first.state.m8.loot.receipts.length);
    expect(first.events).toHaveLength(dropIds.length*2);
    expect(first.events.filter(e=>e.type==='lootForfeited').map(e=>e.dropId)).toEqual(receipts.map(r=>r.dropId));
    expect(first.events.filter(e=>e.type==='lootGranted').map(e=>e.receipt)).toEqual(receipts);
    for(const [i,event] of first.events.entries()){
      expect(event.type).toBe(i%2===0?'lootForfeited':'lootGranted');
      // The legacy planner leaves stamping to its caller; the terminal entry stamps immediately.
      if(order==='planner-first')expect(event.eventSeq).toBeUndefined();
      else expect(event).toMatchObject({domain:'match',eventSeq:state.nextMatchEventSeq+i});
    }
    const numberedCount=order==='terminal-first'?first.events.length:0;
    expect(first.state.nextMatchEventSeq).toBe(state.nextMatchEventSeq+numberedCount);
    expect(second.events).toEqual([]);expect(second.state).toBe(first.state);
    expect(second.state.m8.loot.receipts).toBe(first.state.m8.loot.receipts);
    expect(second.state.nextMatchEventSeq).toBe(first.state.nextMatchEventSeq);
    expect(second.state.m8.loot.direct.filter(d=>d.status==='revealed')).toEqual([]);
    expectTerminalForfeitNoop(second.state);
    // A later batch starts exactly at the next free number, including after a raw planner call.
    const later=gift(second.state,'singed',1,'cross-forfeit-later'),next=forfeitTerminalOrbs(later);
    expect(next.events.length).toBeGreaterThan(0);
    expect(next.events.map(e=>e.eventSeq)).toEqual(Array.from({length:next.events.length},(_,i)=>second.state.nextMatchEventSeq+i));
    expect(next.state.nextMatchEventSeq).toBe(second.state.nextMatchEventSeq+next.events.length);
    expect(new Set([...first.events,...second.events,...next.events].flatMap(e=>e.eventSeq===undefined?[]:[e.eventSeq])).size).toBe(numberedCount+next.events.length);
    expectTerminalForfeitNoop(next.state);
  });
  it('retains a revealed 2-7 orb into 3-1 and pays its entries once in entryOrdinal order',()=>{
    const initial=room(undefined,1),round=getCatalogRoundById('2-7');
    const layout=freezeOrbLayoutThroughRound(initial.pool.orbLayout,round.ordinal+1);if(!layout.ok)throw Error(layout.reason);
    const pool={...initial.pool,orbLayout:layout.layout},old=initial.states[0],record=fight(initial.pool,old).state.roundResults[0];
    const loot=prepareMatchLoot(old.seed,round.ordinal,old.m8.loot,layout.layout),enemies=createRoundEnemies(round.ordinal);
    let state:MatchState={...old,round:round.ordinal,roundDefinitionId:round.roundId,m8:{...old.m8,round,loot},
      preparation:{...old.preparation,units:[...old.preparation.units.filter(u=>u.team==='player'),...enemies]}};
    const plan=loot.frozen.rounds.at(-1)!,sources=[...new Set(plan.orbs.map(o=>o.sourceUnitId))],raw=createCombat(state.preparation);
    const combat={...raw,combatId:`round-${state.round}`,status:'finished' as const,result:'draw' as const,tick:5,nextEventSeq:30,
      units:raw.units.map(u=>sources.includes(u.id)?{...u,alive:false,hp:0}:u),neutralReceipts:{deaths:sources.map((unitId,i)=>({unitId,tick:4,eventSeq:7+i})),controls:[]}};
    state={...revealMatchLoot(state,combat).state,phase:'settlement',combat};
    const source=readLootView(state).unclaimedOrbs![0];expect(source.roundId).toBe(CLAIM_EXPECTATIONS.sourceRound);
    const next=getCatalogRoundById('3-1');
    state={...state,phase:'preparation',round:next.ordinal,roundDefinitionId:next.roundId,combat:null,
      m8:{...state.m8,round:next,loot:prepareMatchLoot(state.seed,next.ordinal,state.m8.loot,layout.layout)},
      roundResults:Array.from({length:round.ordinal},(_,i)=>({...record,round:i+1,combatTicks:5,combatEventCount:30}))};
    expect(readLootView(state).unclaimedOrbs).toContainEqual(source);
    const r=claim(pool,state,source.orbId),paid=r.state.m8.loot.receipts;
    expect(r.state.roundDefinitionId).toBe(CLAIM_EXPECTATIONS.carriedRound);
    expect(paid.map(r=>r.payload)).toEqual(source.entries);
    expect(receiptTotals(paid).count).toBe(source.entries.length);
    const gold=source.entries.reduce((n,e)=>n+(e.kind==='gold'?e.quantity:0),0);
    expect(r.state.gold-state.gold).toBe(gold);expect(paid.every(r=>r.claimedRoundId==='3-1')).toBe(true);
    unchanged(r.pool,r.state,source.orbId,'already-claimed');independentConservation(r.pool);
  });
  it.each(CAPACITY_VECTORS)('full bench: cost $cost star $starLevel pays +$gold without taking $copies copies',v=>{
    const full=fullBench(),id=v.cost===2?unusedTwoCost(full.state):'singed';
    const state=gift(full.state,id,v.starLevel),orbId=ids(state)[0],available=full.pool.available[id];
    const r=claim(full.pool,state,orbId),receipt=r.state.m8.loot.receipts.at(-1)!;
    expect(r.state.gold-state.gold).toBe(v.gold);expect(receipt).toMatchObject({resolution:'capacity-sold',gold:v.gold,grantedUnitIds:[]});
    expect(r.pool.available[id]).toBe(available);expect(r.pool.pending).toEqual([]);
    expect(r.state.nextUnitSerial).toBe(state.nextUnitSerial);independentConservation(r.pool);assertSharedPoolConservation(r.pool,[r.state]);
  });
  it('selling before claiming creates one full-star unit; its pool holding has three copies',()=>{
    const full=fullBench(),id=unusedTwoCost(full.state),state=gift(full.state,id,2),victim=state.preparation.units.find(u=>u.location.kind==='bench')!;
    const sold=accept(sellSharedUnit(full.pool,state,victim.id)),r=claim(sold.pool,sold.state),born=r.state.preparation.units.find(u=>u.id===`unit-${state.nextUnitSerial}`)!;
    expect(born).toMatchObject({definitionId:id,starLevel:2});expect(r.state.gold).toBe(sold.state.gold);
    expect(r.state.preparation.units.length-sold.state.preparation.units.length).toBe(CLAIM_EXPECTATIONS.soldBeforeClaim.born);
    expect(r.pool.holdings.find(h=>h.unitId===born.id)?.sources).toHaveLength(3);independentConservation(r.pool);
  });
  it('a capacity merge uses the existing triple planner and consumes the pool once',()=>{
    let {pool,states}=room(undefined,1),state=states[0];const id='leona';
    for(let i=0;i<2;i++){state=gift(state,id,1,`leona-${i}`);const r=claim(pool,state);pool=r.pool;state=r.state;}
    // Fill the remaining seven slots with distinct heroes, so only Leona can free capacity.
    for(const [i,hero] of ['singed','vander','rell','tristana','urgot','renata','sett'].entries()){
      state=gift(state,hero,1,`fill-${i}`);const r=claim(pool,state);pool=r.pool;state=r.state;
    }
    expect(state.preparation.units.filter(u=>u.location.kind==='bench')).toHaveLength(9);
    state=gift(state,id,1,'third');const before=state.preparation.units.length,r=claim(pool,state),unit=r.state.preparation.units.find(u=>u.definitionId===id)!;
    expect(unit.starLevel).toBe(CLAIM_EXPECTATIONS.mergesAtCapacity.starLevel);
    expect(r.state.preparation.units.length-before).toBe(CLAIM_EXPECTATIONS.mergesAtCapacity.rosterDelta);
    expect(r.state.gold-state.gold).toBe(0);expect(r.state.m8.loot.receipts.at(-1)?.resolution).toBe('held');independentConservation(r.pool);
  });
  it('duplicate, stale and unknown claims preserve state/pool/RNG before and after JSON snapshot restore/reconnect',()=>{
    const {pool,states}=room(undefined,1),state=gift(states[0],'leona',2),orbId=ids(state)[0];
    unchanged(pool,state,'missing','unknown-orb');unchanged(pool,state,orbId,'stale-round',state.round+1);
    const r=claim(pool,state),restored=restoreSharedOrbSnapshot(JSON.parse(JSON.stringify(r.pool)),JSON.stringify(r.state));
    expect(restored).toEqual(r.state);expect(toPrivateSeatView(restored).unclaimedOrbs).toEqual([]);
    unchanged(r.pool,restored,orbId,CLAIM_EXPECTATIONS.duplicate.reason);
    unchanged(r.pool,r.state,orbId,'already-claimed');
    const tampered=structuredClone(r.state) as any;tampered.m8.loot.receipts[0].gold=99;
    expect(()=>restoreSharedOrbSnapshot(r.pool,tampered)).toThrow();
  });
  it('replays complete-star births and a two-star triple as one three-star holding',()=>{
    let {pool,states}=room(undefined,1),state=states[0];
    for(let i=0;i<3;i++){
      state=gift(state,'leona',2,`star-two-${i}`);const r=claim(pool,state);pool=r.pool;state=r.state;
    }
    const units=state.preparation.units.filter(u=>u.team==='player').map(({id,definitionId,starLevel})=>({id,definitionId,starLevel}));
    const folded=foldResourceProvenance(state.resourceProvenance,{scheduleReceipts:state.scheduleReceipts,
      lootReceipts:state.m8.loot.receipts,mechanicReceipts:state.seatMechanics?.receipts,throughRoundOrdinal:1,combatSettlements:[]});
    expect(folded.units).toEqual(units.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));
    expect(folded.units.find(u=>u.definitionId==='leona')?.starLevel).toBe(3);
    expect(pool.holdings.find(h=>h.definitionId==='leona')?.sources).toHaveLength(9);independentConservation(pool);
  });
  it('shortage takes precedence over full-bench sale, including a partial three-copy stock',()=>{
    const full=fullBench(),id=unusedTwoCost(full.state),available=full.pool.available[id];
    // All outstanding copies are valid foreign shop reservations, never a negative or discarded pool total.
    const other=room({irelia:1,leona:2},1),state=gift({...other.states[0],preparation:{...other.states[0].preparation,benchSize:0}},'leona',2);
    const r=claim(other.pool,state);expect(r.state.gold-state.gold).toBe(CLAIM_EXPECTATIONS.shortageWithCapacity.gold);
    expect(r.state.m8.loot.receipts.at(-1)).toMatchObject({resolution:'gold',gold:2});expect(r.pool.available.leona).toBe(2);
    expect(available).toBeGreaterThan(0);independentConservation(r.pool);
  });
  it('P2, Conqueror and a black-market two-star hero enqueue rewards without capacity retry',()=>{
    const full=fullBench(),p2={...full.state,augments:[{definitionId:'pair-of-fours',choiceId:'test-p2',acquiredRound:1}]};
    const gifts=drainP2Gifts(p2);expect(ids(gifts)).toHaveLength(1);expect(drainP2Gifts(gifts)).toEqual(gifts);
    const paid=claim(full.pool,gifts);expect(paid.state.m8.loot.receipts.at(-1)?.resolution).toBe('capacity-sold');
    const market=G23_BLACK_MARKETS.flatMap(m=>m.options.map(o=>({m,o}))).find(({o})=>Object.hasOwn(o.reward,'Champions_2Star'))!;
    const bundle={id:'test-market',round:1,source:'black-market' as const,tier:market.m.tier,reward:market.o.reward};
    const atom=g23RewardAtoms(bundle,full.state.seed,true).find(a=>a.kind==='unit'&&a.starLevel===2)!;
    expect(atom.quantity).toBe(1);expect(g23RewardAtoms(bundle,full.state.seed).find(a=>a.id===atom.id)?.quantity).toBe(3);
    const p=readG23Progress(full.state)!;
    const queued=drainG23Rewards(writeG23Progress(full.state,{...p,rewards:[bundle]}));
    const fullStar=readLootView(queued).unclaimedOrbs!.find(o=>o.entries.some(e=>e.kind==='unit'&&e.starLevel===2&&e.quantity===1))!;
    expect(fullStar).toBeDefined();
    const marketPaid=claim(full.pool,queued,fullStar.orbId),paidReceipt=marketPaid.state.m8.loot.receipts.at(-1)!;
    expect(paidReceipt).toMatchObject({resolution:'capacity-sold',grantedUnitIds:[],payload:{kind:'unit',starLevel:2,quantity:1}});
    expect(paidReceipt.payload).toMatchObject({definitionId:'singed'});
    expect(paidReceipt.gold).toBe(CAPACITY_VECTORS[3].gold);independentConservation(marketPaid.pool);
    const chest=G23_CONQUEROR_CHESTS.find(c=>g23RewardAtoms({id:'test-chest',round:1,source:'conqueror',tier:c.tier,reward:g23ConquerorReward(c)},1,true).some(a=>a.kind==='unit'))!;
    const conqueror={id:'test-chest',round:1,source:'conqueror' as const,tier:chest.tier,reward:g23ConquerorReward(chest)};
    expect(ids(drainG23Rewards(writeG23Progress(full.state,{...p,rewards:[conqueror]}))).length).toBeGreaterThan(0);
  });
  it('deadline keeps every orb; the next shared round is not blocked',()=>{
    const initial=room(undefined,1),ready=batch(refreshSharedShops(initial.pool,initial.states,1)),finished=fight(ready.pool,ready.states[0]),before=ids(finished.state);
    const deadline=accept(runSharedMatchCommand(finished.pool,finished.state,{type:'claimLoot',round:1}));
    expect(ids(deadline.state)).toEqual(before);expect(deadline.state.m8.loot.receipts).toEqual([]);
    const next=batch(nextSharedRound(deadline.pool,[deadline.state],1));expect(ids(next.states[0])).toEqual(before);independentConservation(next.pool);
  });
  it.each([false,true])('combat accepts FIFO intent, then settles using actual capacity (sell during combat: %s)',sell=>{
    const full=fullBench(),id=unusedTwoCost(full.state),state=gift(full.state,id,2),orbId=ids(state)[0];
    const started=accept(runSharedMatchCommand(full.pool,state,{type:'startCombat'})),queued=claim(started.pool,started.state,orbId);
    expectQueueOnly(started.state,queued.state);
    for(const key of ['available','pending','holdings','shops','rewards'] as const)expect(queued.pool[key]).toEqual(started.pool[key]);
    expect(queued.events).toEqual([]);expect(queued.poolEvents).toEqual([]);
    expect(queued.state.m8.loot.queuedOrbClaims).toEqual([orbId]);
    expect(toPrivateSeatView(queued.state).unclaimedOrbs).toContainEqual(expect.objectContaining({orbId,queued:true}));
    expect(readPublicOrbSummary(queued.state)).toEqual(readPublicOrbSummary(started.state));
    unchanged(queued.pool,queued.state,orbId,'already-claimed');
    let current=queued;
    if(sell)current=accept(sellSharedUnit(current.pool,current.state,current.state.preparation.units.find(u=>u.location.kind==='bench')!.id));
    const restored=restoreSharedOrbSnapshot(current.pool,JSON.stringify(current.state));
    expect(restored).toEqual(current.state);unchanged(current.pool,restored,orbId,'already-claimed');
    const done=finish(current.pool,restored),replay=finish(JSON.parse(JSON.stringify(current.pool)),restored);
    expect(done).toEqual(replay);expect(done.state.m8.loot.queuedOrbClaims).toEqual([]);
    const expected=sell?CLAIM_EXPECTATIONS.queued.held:CLAIM_EXPECTATIONS.queued.capacitySale;
    const receipts=done.state.m8.loot.receipts.filter(r=>JSON.parse(r.dropId)[0]===orbId);
    expect(receiptTotals(receipts)).toEqual({count:1,gold:expected.gold});
    expect(receipts[0].resolution).toBe(expected.resolution);
    expect(done.pool.available[id]).toBe(current.pool.available[id]-expected.copies);
    expect(done.state.gold).toBe(done.state.roundResults.at(-1)!.goldAfter+expected.gold);
    expect(done.state.preparation.units.some(u=>u.definitionId===id&&u.starLevel===2)).toBe(sell);
    const after=restoreSharedOrbSnapshot(done.pool,JSON.stringify(done.state));unchanged(done.pool,after,orbId,'already-claimed');
    const retry=accept(runSharedMatchCommand(done.pool,after,{type:'step'}));expect(retry.state).toBe(after);expect(retry.pool).toBe(done.pool);
    independentConservation(done.pool);assertSharedPoolConservation(done.pool,[done.state]);
  });
  it('FIFO order wins scarce copies, including after restore; malformed queues are rejected',()=>{
    const {pool,states}=room({irelia:1,leona:3},1);
    let state=gift(states[0],'leona',1,'a');state=gift(state,'leona',2,'z');
    const [small,big]=ids(state),started=accept(runSharedMatchCommand(pool,state,{type:'startCombat'}));
    const a=claim(started.pool,started.state,big),b=claim(a.pool,a.state,small);
    expect(b.state.m8.loot.queuedOrbClaims).toEqual([big,small]);
    const restored=restoreSharedOrbSnapshot(b.pool,JSON.stringify(b.state));
    for(const queue of [[big,big],['missing'],[ids(restored)[0],42],null]) {
      const tampered=structuredClone(restored) as any;tampered.m8.loot.queuedOrbClaims=queue;
      expect(()=>restoreSharedOrbSnapshot(b.pool,tampered)).toThrow();
    }
    const badPhase={...restored,phase:'settlement'} as MatchState;expect(()=>validateMultiplayerOrbLedger(badPhase)).toThrow();
    const done=finish(b.pool,restored),paid=done.state.m8.loot.receipts;
    expect(paid.map(r=>JSON.parse(r.dropId)[0])).toEqual([big,small]);
    expect(paid.map(r=>r.resolution)).toEqual(CLAIM_EXPECTATIONS.queued.competition.resolutions);
    expect(receiptTotals(paid)).toEqual({count:2,gold:CLAIM_EXPECTATIONS.queued.competition.gold});
    expect(done.pool.available.leona).toBe(pool.available.leona-CLAIM_EXPECTATIONS.queued.competition.copies);
    expect(done.state.gold).toBe(done.state.roundResults.at(-1)!.goldAfter+2);independentConservation(done.pool);
    assertSharedPoolConservation(done.pool,[done.state]);
  });
  it.each([false,true])('locked PvP queues; authoritative settlement pays or forfeits exactly once (eliminated: %s)',loss=>{
    const initial=pvpSeat(),gifted=gift({...initial.state,playerHp:loss?1:100},'leona',2),orbId=ids(gifted).at(-1)!;
    const locked=lockMatchCombatRoster(gifted);if(!locked.ok)throw Error(locked.reason);
    const queued=claim(initial.pool,locked.state,orbId);expectQueueOnly(locked.state,queued.state);
    const restored=restoreSharedOrbSnapshot(queued.pool,JSON.stringify(queued.state)),receipt=pvpReceipt(restored,loss);
    const done=accept(runSharedMatchCommand(queued.pool,restored,{type:'settleRound',receipt}));
    const paid=done.state.m8.loot.receipts.find(r=>JSON.parse(r.dropId)[0]===orbId)!;
    const expected=loss?CLAIM_EXPECTATIONS.queued.forfeited:CLAIM_EXPECTATIONS.queued.held;
    expect(paid).toMatchObject({resolution:expected.resolution,gold:expected.gold});
    expect(done.pool.available.leona).toBe(queued.pool.available.leona-expected.copies);
    expect(done.state.m8.loot.queuedOrbClaims).toEqual([]);
    expect(done.state.gold).toBe(done.state.roundResults.at(-1)!.goldAfter);
    expect(done.state.preparation.units.some(u=>u.definitionId==='leona'&&u.starLevel===2)).toBe(!loss);
    const after=restoreSharedOrbSnapshot(done.pool,JSON.stringify(done.state));
    unchanged(done.pool,after,orbId,loss?'seat-eliminated':'already-claimed');
    if(loss){
      expect(done.state.multiplayer?.status).toBe('eliminated');
      expectTerminalForfeitNoop(done.state);expectTerminalForfeitNoop(after);
    }
    const retry=runSharedMatchCommand(done.pool,after,{type:'settleRound',receipt});
    expect(retry).toMatchObject({ok:false,reason:loss?'seat-eliminated':'duplicate-settlement'});expect(retry.state).toBe(after);expect(retry.pool).toBe(done.pool);
    expect(stepMatch(after).state).toBe(after);independentConservation(done.pool);assertSharedPoolConservation(done.pool,[after]);
  });
  it('PvE damage eliminates before queued rewards can allocate any copies or sale gold',()=>{
    const initial=room(undefined,1),round=getCatalogRoundById('2-7');
    // Isolate the later PvE damage boundary with its real enemies and a real shared holding.
    const advanced=syntheticSharedRound(initial.pool,initial.states,round.ordinal),base=advanced.states[0];
    const state=gift({...base,roundDefinitionId:round.roundId,playerHp:1,m8:{...base.m8,round},
      preparation:{...base.preparation,units:[...base.preparation.units.filter(u=>u.team==='player'),...createRoundEnemies(round.ordinal)]}},'leona',2);
    const orbId=ids(state)[0],started=accept(runSharedMatchCommand(advanced.pool,state,{type:'startCombat'}));
    const queued=claim(started.pool,started.state,orbId),done=finish(queued.pool,queued.state);
    expect(done.state.multiplayer?.status).toBe('eliminated');expect(done.state.m8.loot.queuedOrbClaims).toEqual([]);
    expect(done.state.m8.loot.receipts.filter(r=>JSON.parse(r.dropId)[0]===orbId)).toEqual([
      expect.objectContaining({resolution:CLAIM_EXPECTATIONS.queued.forfeited.resolution,gold:0,grantedUnitIds:[]})]);
    expect(done.pool.available.leona).toBe(queued.pool.available.leona);
    expect(done.state.gold).toBe(done.state.roundResults.at(-1)!.goldAfter);expect(stepMatch(done.state).state).toBe(done.state);
    expectTerminalForfeitNoop(done.state);
    independentConservation(done.pool);assertSharedPoolConservation(done.pool,[done.state]);
  });
  it('bot preparation claims all orbs by code point order, using the same full-bench sale',()=>{
    const full=fullBench();let state=gift(full.state,unusedTwoCost(full.state),2,'z');state=gift(state,'singed',2,'a');
    const before=ids(state).sort((a,b)=>a<b?-1:a>b?1:0),r=accept(claimBotPreparationOrbs(full.pool,state));
    expect(ids(r.state)).toEqual([]);expect(r.state.m8.loot.receipts.map(r=>JSON.parse(r.dropId)[0])).toEqual(before);
    expect(r.state.m8.loot.receipts.every(r=>r.resolution==='capacity-sold')).toBe(true);independentConservation(r.pool);
    expect(readPublicOrbSummary(state)).toEqual({count:2,tiers:['gray','gray']});
  });
  it('offline keeps automatic grants and rejects explicit orb claims without changing state',()=>{
    const initial=createMatch(5);expect(claimOrb(initial,'missing',1)).toEqual({ok:false,state:initial,reason:'multiplayer-required'});
    const r=startMatchCombat(initial);if(!r.ok)throw Error(r.reason);let state=r.state;while(state.phase==='combat')state=stepMatch(state).state;
    expect(state.m8.loot.receipts.length).toBeGreaterThan(0);expect(readLootView(state)).not.toHaveProperty('unclaimedOrbs');
  });
});
