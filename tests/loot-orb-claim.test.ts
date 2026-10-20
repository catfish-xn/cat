import {describe,it,expect} from 'vitest';
import {runSharedMatchCommand,sellSharedUnit,assertSharedPoolConservation,refreshSharedShops,nextSharedRound,restoreSharedOrbSnapshot} from '../src/simulation/shared-pool';
import {claimOrb,createMatch,startMatchCombat,stepMatch} from '../src/simulation/match';
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
import {accept,room,fullBench,fight,batch} from './tp-helpers';
import {CAPACITY_VECTORS,CLAIM_EXPECTATIONS,receiptTotals,independentConservation} from './oracles/multiplayer-orb-oracle';

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

describe('multiplayer explicit orb claims',()=>{
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
  it('combat rejects; elimination forfeits all earned entries exactly once without pool reservations',()=>{
    const {pool,states}=room(undefined,1),state=gift(states[0],'leona'),orbId=ids(state)[0];
    const started=accept(runSharedMatchCommand(pool,state,{type:'startCombat'}));
    unchanged(started.pool,started.state,orbId,'wrong-phase');
    const fragile={...state,playerHp:1,preparation:{...state.preparation,units:state.preparation.units.filter(u=>u.team==='enemy')}};
    // Isolate domain elimination; the pool roster deliberately remains unmodified for the failure check above.
    const initial=startMatchCombat(fragile);if(!initial.ok)throw Error(initial.reason);let lost=initial.state;
    while(lost.phase==='combat')lost=stepMatch(lost).state;
    expect(lost.multiplayer?.status).toBe('eliminated');expect(lost.m8.loot.receipts.filter(r=>r.resolution==='forfeited')).toHaveLength(1);
    expect(claimOrb(lost,orbId,lost.round)).toMatchObject({ok:false,reason:'seat-eliminated',state:lost});
    expect(stepMatch(lost).state).toBe(lost);
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
