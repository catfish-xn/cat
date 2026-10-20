import { describe, expect, it } from 'vitest';
import * as api from '../src/server-entry';
import type { ClientCommand } from '../src/server/protocol';
import { accepted, context, execute } from './t7-helpers';
import { room, batch, accept, conserved, fight } from './tp-helpers';
import { freeze } from './combat-helpers';

function executePool(pool:api.SharedPoolState,state:api.MatchState,a:ClientCommand):api.SharedPoolResult {
  switch(a.type) {
    case 'buy': return api.buySharedUnit(pool,state,a.slot,a.generation);
    case 'sell': return api.sellSharedUnit(pool,state,a.unitId);
    case 'reroll': return api.rerollSharedShop(pool,state,state.shop.generation);
    case 'shopLock': return api.setSharedShopLock(pool,state,a.locked,a.generation);
    case 'choose': return api.runSharedMatchCommand(pool,state,{type:'choose',choiceId:a.choiceId,generation:a.generation,definitionId:a.definitionId});
    default: {const r=execute(state,a);return r.ok?{...r,pool,poolEvents:[]}:{...r,pool};}
  }
}
describe('T7 public-command traversal',()=>{
  it('twenty consecutive real rounds from seed 1 accept every intention, with no synthetic gold, HP or choices',()=>{
    // Seed 42 now picks Radiant Relics at 4-2; seed 1 keeps the two-choice traversal.
    let state=api.createMatch(1),rng=1,steps=0,commands=0,ticks=0;
    const actions=new Set<string>(),choices=new Set<string>();
    for(let budget=0;state.roundResults.length<20;budget++) {
      expect(budget).toBeLessThan(40000);expect(state.phase).not.toBe('gameOver');
      if(state.phase==='combat') {state=api.stepMatch(state).state;ticks++;continue;}
      const d=api.decideBotAction(state,context(state,steps),rng);rng=d.rng;
      if(d.action!=='done') {
        if(state.phase==='choice') choices.add(state.pendingChoice!.kind);
        actions.add(d.action.type);state=accepted(execute(state,d.action));commands++;steps++;
        expect(steps).toBeLessThanOrEqual(api.BOT_MAX_STEPS);continue;
      }
      if(state.phase==='preparation') state=accepted(api.startMatchCombat(state));
      else if(state.phase==='settlement'){state=accepted(api.nextRound(state,state.round));steps=0;}
      else throw new Error(`Unresolved ${state.phase}`);
    }
    expect(state.roundResults.map(r=>r.round)).toEqual(Array.from({length:20},(_,i)=>i+1));
    expect(commands).toBeGreaterThan(30);expect(ticks).toBeGreaterThan(100);
    for(const kind of ['deploy','buy','buyXp','combine','equip','choose']) expect(actions.has(kind)).toBe(true);
    expect([...choices].sort()).toEqual(['augment','component']);
  },30_000);
  it('eight bot seats use actual TP commands across opening rounds, conserving after every action',()=>{
    const initial=room(undefined,8),first=batch(api.refreshSharedShops(initial.pool,initial.states,1));
    let pool=first.pool,states=[...first.states];const rngs=states.map((_,i)=>i);
    for(let round=1;round<=3;round++) {
      for(let i=0;i<states.length;i++) {
        let steps=0;
        // One budget per round, including post-combat choices.
        for(let guard=0;guard<140;guard++) {
          const s=states[i],d=api.decideBotAction(freeze(s),context(s,steps),rngs[i]);rngs[i]=d.rng;
          if(d.action!=='done') {
            const r=accept(executePool(pool,s,d.action));pool=r.pool;states[i]=r.state;steps++;conserved(pool,states);continue;
          }
          if(s.phase==='preparation') {const r=fight(pool,s);pool=r.pool;states[i]=r.state;continue;}
          expect(s.phase).toBe('settlement');break;
        }
        expect(states[i].phase).toBe('settlement');expect(steps).toBeLessThanOrEqual(api.BOT_MAX_STEPS);
        const claim=accept(api.runSharedMatchCommand(pool,states[i],{type:'claimLoot',round}));pool=claim.pool;states[i]=claim.state;
      }
      const next=batch(api.nextSharedRound(pool,states,round));pool=next.pool;states=[...next.states];conserved(pool,states);
    }
    expect(states.every(s=>s.round===4)).toBe(true);
  },30_000);
  it('rerolls a pooled shop only when its own returned offer guarantees stock, with no double consumption',()=>{
    const initial=room({irelia:1,maddie:10},1),first=batch(api.refreshSharedShops(initial.pool,initial.states,1));
    let pool=first.pool,state:api.MatchState={...first.states[0],level:9,xp:0,gold:100,playerHp:30},rng=0;
    // Build a real three-star holding first, leaving the tenth copy displayed but unwanted.
    for(let i=0;i<9;i++) {
      let slot=state.shop.slots.findIndex(s=>s.status==='available');
      if(slot<0) {const r=accept(api.rerollSharedShop(pool,state,state.shop.generation));pool=r.pool;state=r.state;slot=0;}
      const r=accept(api.buySharedUnit(pool,state,slot,state.shop.generation));pool=r.pool;state=r.state;
    }
    for(let steps=0;steps<64;steps++) {
      const d=api.decideBotAction(state,context(state,steps),rng);rng=d.rng;
      if(d.action==='done')throw new Error('Expected one shared reroll');
      const r=accept(executePool(pool,state,d.action));pool=r.pool;state=r.state;conserved(pool,[state]);
      if(d.action.type==='reroll') {expect(state.shop.slots.some(s=>s.status==='available')).toBe(true);return;}
    }
    throw new Error('Expected a finite purchase/refresh sequence');
  });
  it('does not gamble on hidden stock for an empty shared shop',()=>{
    const initial=room({irelia:1,maddie:1},1),first=batch(api.refreshSharedShops(initial.pool,initial.states,1));
    let pool=first.pool,state:api.MatchState={...first.states[0],level:9,xp:0,gold:0};
    // Position with no spending before isolating the stock-dependent decision.
    for(let i=0;i<10;i++) {
      const d=api.decideBotAction(state,context(state,i),0);if(d.action==='done')break;
      const r=accept(executePool(pool,state,d.action));pool=r.pool;state=r.state;
    }
    state={...state,gold:100};const buy=api.decideBotAction(state,context(state),0);expect(buy.action).toMatchObject({type:'buy'});
    if(buy.action==='done')throw new Error('buy');let r=accept(executePool(pool,state,buy.action));pool=r.pool;state=r.state;
    for(let i=0;i<10;i++) {
      const d=api.decideBotAction(state,context(state,i),0);
      if(d.action==='done') {expect(state.shop.slots.every(s=>s.status==='purchased')).toBe(true);conserved(pool,[state]);return;}
      expect(d.action.type).not.toBe('reroll');r=accept(executePool(pool,state,d.action));pool=r.pool;state=r.state;
    }
    throw new Error('Empty pooled shop should finish');
  });
});
