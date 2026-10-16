import {createSharedPool,initializeSharedSeat,refreshSharedShops as importRefresh,runSharedMatchCommand,nextSharedRound} from '../src/simulation/shared-pool';
import {createCarouselMatch,prepareCarouselParticipants} from '../src/simulation/carousel';
import type {MatchState} from '../src/simulation/match-types';
export function must<T extends {
    ok: boolean;
}>(r: T): Extract<T, {
    ok: true;
}> { if (!r.ok)
    throw Error('reason' in r ? String(r.reason) : 'fixture transaction failed'); return r as Extract<T, {
    ok: true;
}>; }
const supplies = new Map<number,{pool:ReturnType<typeof createSharedPool>;states:MatchState[]}>();
export function supplySeats(seats:number) {
    const cached=supplies.get(seats); if(cached)return structuredClone(cached);
    let pool=createSharedPool('p7',42,{seatCount:seats});
    let states:MatchState[]=[];
    for(let i=0;i<seats;i++){const r=must(initializeSharedSeat(pool,createCarouselMatch(42+i),`s${i}`,i));pool=r.pool;states.push(r.state);}
    const first=must(importRefresh(pool,states,1));pool=first.pool;states=[...first.states];
    while(states[0].roundDefinitionId!=='2-4'){
      states=states.map((initial,i)=>{
        let state=initial,guard=0;
        while(state.phase!=='settlement'){
          if(++guard>1500)throw Error('fixture round guard');
          const command = state.phase === 'choice' ? { type: 'timeoutChoice' as const, round: state.round, choiceId: state.pendingChoice!.choiceId, generation: state.pendingChoice!.generation } : state.m8.round.kind === 'pvp' ? { type: 'settleRound' as const, receipt: { version: 'multiplayer-settlement-v1' as const, settlementId: `p7-${i}-${state.round}`, battleId: `battle-${i}-${state.round}`, seatId: `s${i}`, round: state.round, roundId: state.roundDefinitionId, settlementEligible: true, result: 'win' as const, damage: 0, baseDamage: 2, opposingSurvivors: 0, growth: [], combatTicks: 1, combatEventCount: 1 } } : { type: state.phase === 'combat' ? 'step' as const : 'startCombat' as const };
          const result=must(runSharedMatchCommand(pool,state,command));pool=result.pool;state=result.state;
        }
        return state;
      });
      const next=must(nextSharedRound(pool,states,states[0].round));pool=next.pool;states=[...next.states];
    }
    pool=must(prepareCarouselParticipants(pool,states.map((state,i)=>({seatId:`s${i}`,state})))).pool;
    const result={pool,states};supplies.set(seats,result);return structuredClone(result);
}
export function atSupply(){const r=supplySeats(1);return {pool:r.pool,state:r.states[0]};}
