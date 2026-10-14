import { describe, expect, it } from 'vitest';
import { toPrivateSeatView, runSharedMatchCommand, type MatchState } from '../src/server-entry';
import { readLootView } from '../src/simulation/loot-view';
import { lootReceiptId } from '../src/simulation/loot-identity';
import { ROUND_CATALOG } from '../src/simulation/content/round-catalog';
import type { DirectLootProgress } from '../src/simulation/loot-types';
import type { LootPayload } from '../src/simulation/m8/contracts';
import { catalogPreparation } from './t5r-helpers';
import { freeze } from './combat-helpers';
import { room, fight, fullBench, accept } from './tp-helpers';

const planOf = (state: MatchState) => state.m8.loot.frozen.rounds.find(r => r.encounterPlan.roundId === state.roundDefinitionId)!;
/** Projection fixture only; visibility transitions are isolated from combat and grant execution. */
function withDrop(status: DirectLootProgress['status'], payload: LootPayload = {kind:'unit',definitionId:'maddie',quantity:1}): MatchState {
  const state=catalogPreparation('2-7'),plan=planOf(state),drop=plan.encounterPlan.drops[0];
  const receiptId=lootReceiptId(drop.dropId);
  return {...state,m8:{...state.m8,loot:{...state.m8.loot,
    frozen:{...state.m8.loot.frozen,rounds:state.m8.loot.frozen.rounds.map(r=>r===plan?{...r,encounterPlan:{...r.encounterPlan,
      drops:[...r.encounterPlan.drops].map(d=>d===drop?{...d,payload}:d)}}:r)},
    direct:state.m8.loot.direct.map(d=>d.dropId===drop.dropId?(status==='granted'?{dropId:d.dropId,status,receiptId}:{dropId:d.dropId,status,receiptId:null}):d),
    receipts:status==='granted'?[{receiptId,dropId:drop.dropId,payload,grantedItemIds:[],grantedUnitIds:[]}]:[],
  }}};
}
function check(state: MatchState) {
  const before=JSON.stringify(state),view=toPrivateSeatView(freeze(state));
  expect(view.revealedLoot).toEqual({roundId:state.roundDefinitionId,revealedDrops:readLootView(state).revealedDrops,revealedOrbs:readLootView(state).revealedOrbs});
  expect(view.m8).not.toHaveProperty('loot');
  expect(Object.keys(view.revealedLoot!).sort()).toEqual(['revealedDrops','revealedOrbs','roundId']);
  expect(JSON.parse(JSON.stringify(view)).revealedLoot).toEqual(view.revealedLoot);
  expect(JSON.stringify(state)).toBe(before);
  return view.revealedLoot!;
}

describe('SR-C7-02 revealed loot whitelist',()=>{
  it.each(ROUND_CATALOG.filter(round=>round.kind==='pve').map(round=>round.roundId))('matches the current catalog PvE %s, including 6-7',roundId=>{
    const state=catalogPreparation(roundId);
    expect(check(state).revealedDrops).toEqual([]);
    const currentIds=new Set(planOf(state).encounterPlan.drops.map(drop=>drop.dropId));
    const earned:MatchState={...state,m8:{...state.m8,loot:{...state.m8.loot,
      direct:state.m8.loot.direct.map(drop=>currentIds.has(drop.dropId)?{...drop,status:'revealed',receiptId:null}:drop)}}};
    // 1-4 has only an unresolved component choice, so it still exposes no payload.
    expect(check(earned).revealedDrops).toHaveLength(currentIds.size);
  });
  it('never exposes future rounds appended to the ledger, even if their progress is revealed',()=>{
    const state=withDrop('granted'),future=catalogPreparation('6-7').m8.loot;
    const later=future.frozen.rounds.filter(round=>!state.m8.loot.frozen.rounds.some(old=>old.encounterPlan.roundId===round.encounterPlan.roundId));
    const laterIds=new Set(later.flatMap(round=>round.encounterPlan.drops.map(drop=>drop.dropId)));
    const extended:MatchState={...state,m8:{...state.m8,loot:{...state.m8.loot,
      frozen:{...state.m8.loot.frozen,rounds:[...state.m8.loot.frozen.rounds,...later]},
      direct:[...state.m8.loot.direct,...future.direct.filter(drop=>laterIds.has(drop.dropId)).map(drop=>({...drop,status:'revealed' as const,receiptId:null}))],
    }}};
    expect(check(extended)).toEqual(check(state));
  });
  it.each(['revealed','pending-capacity','retained-terminal','granted'] as const)('preserves %s and its display-only reason',status=>{
    const state=withDrop(status),summary=check(state);
    expect(summary.revealedDrops).toHaveLength(1);
    expect(summary.revealedDrops[0]).toMatchObject({status,receiptId:status==='granted'?lootReceiptId(planOf(state).encounterPlan.drops[0].dropId):null,allowedActions:[]});
    expect(Object.isFrozen(summary.revealedDrops[0].payload)).toBe(true);
  });
  it.each(['planned','forfeited'] as const)('omits %s entirely, without placeholders or hidden counts',status=>{
    expect(check(withDrop(status)).revealedDrops).toEqual([]);
  });
  it.each([
    {kind:'gold',quantity:3}, {kind:'item',definitionId:'sword',quantity:1}, {kind:'unit',definitionId:'maddie',quantity:1},
  ] satisfies LootPayload[])('copies only visible payload fields for $kind',payload=>{
    const drop=check(withDrop('granted',payload)).revealedDrops[0];expect(drop.payload).toEqual(payload);
    expect(Object.keys(drop.payload).sort()).toEqual(Object.keys(payload).sort());
  });
  it('never creates a PvE choice or exposes an unearned entry',()=>{
    const state=withDrop('planned');expect(planOf(state).choices).toEqual([]);
    expect(readLootView(state).pendingChoice).toBeNull();expect(check(state).revealedDrops).toEqual([]);
  });
  it('omits PvP/supply and mismatched round/encounter summaries, even with an old earned ledger',()=>{
    const state=withDrop('granted');
    for(const changed of [
      {...state,round:state.round+1}, {...state,roundDefinitionId:'3-7'},
      {...state,m8:{...state.m8,round:{...state.m8.round,roundId:'3-7'}}},
      {...state,m8:{...state.m8,round:{...state.m8.round,encounterId:'wolves-v1'}}},
      ...['3-1','3-4'].map(id=>{const s=catalogPreparation(id);return {...s,m8:{...s.m8,loot:state.m8.loot}};}),
    ]) expect(toPrivateSeatView(changed)).not.toHaveProperty('revealedLoot');
    const missing={...state,m8:{...state.m8,loot:{...state.m8.loot,frozen:{...state.m8.loot.frozen,rounds:[]}}}};
    expect(toPrivateSeatView(missing)).not.toHaveProperty('revealedLoot');
  });
  it('drops old entries embedded in the current plan as well as old ledger progress',()=>{
    const state=withDrop('granted'),plan=planOf(state),old=state.m8.loot.frozen.rounds[0].encounterPlan.drops[0];
    const stale:MatchState={...state,m8:{...state.m8,loot:{...state.m8.loot,
      direct:[...state.m8.loot.direct.filter(d=>d.dropId!==old.dropId),{dropId:old.dropId,status:'revealed',receiptId:null}],
      frozen:{...state.m8.loot.frozen,rounds:state.m8.loot.frozen.rounds.map(r=>r===plan?{...r,encounterPlan:{...r.encounterPlan,drops:[old,...r.encounterPlan.drops]}}:r)},
    }}};
    expect(toPrivateSeatView(stale).revealedLoot).toEqual(toPrivateSeatView(state).revealedLoot);
  });
  it('ignores hidden plans/RNG and copies every nested field without mutating or freezing input',()=>{
    const state=withDrop('revealed'),expected=toPrivateSeatView(state),raw=structuredClone(state);
    const current=planOf(raw),shown=current.encounterPlan.drops[0].dropId;
    for(const round of raw.m8.loot.frozen.rounds) {
      for(const drop of round.encounterPlan.drops) if(drop.dropId!==shown) Object.assign(drop,{payload:{kind:'gold',quantity:999}});
      for(const choice of round.choices) Object.assign(choice,{terminalFallbackDefinitionId:'HIDDEN_FALLBACK'});
    }
    Object.assign(raw,{seed:999,rngState:9,choiceRngState:8,rewardRngState:7,battleSeedRngState:6});
    Object.assign(raw.m8.loot.frozen.rng,{state:123,draws:321});
    const sourceRefs=new Set<object>();
    function inject(value:unknown):void {
      if(!value||typeof value!=='object'||sourceRefs.has(value))return;
      sourceRefs.add(value);for(const child of Object.values(value))inject(child);
      if(!Array.isArray(value)){const hidden={secret:'HIDDEN_NESTED'};sourceRefs.add(hidden);Object.assign(value,{futurePlan:hidden});}
    }
    inject(raw);const before=JSON.stringify(raw),view=toPrivateSeatView(raw);
    expect(view).toEqual(expected);expect(JSON.stringify(view)).not.toMatch(/HIDDEN|futurePlan|rng|frozen|slotOrdinal|revealCondition/);
    expect(JSON.stringify(raw)).toBe(before);for(const ref of sourceRefs)expect(Object.isFrozen(ref)).toBe(false);
    function detached(value:unknown):void {
      if(!value||typeof value!=='object')return;
      expect(sourceRefs.has(value)).toBe(false);expect(Object.isFrozen(value)).toBe(true);
      for(const child of Object.values(value))detached(child);
    }
    detached(view);
  });
  it('shows real shared-pool shortage compensation from the paid receipt, not the frozen hero plan',()=>{
    const {pool,states}=room({irelia:2,darius:1}),first=fight(pool,states[0]),second=fight(first.pool,states[1]);
    expect(check(first.state).revealedDrops[0].payload).toEqual({kind:'unit',definitionId:'darius',quantity:1});
    expect(check(second.state).revealedDrops[0].payload).toEqual({kind:'gold',quantity:1});
  });
  it('shows a real pending-capacity reward and retains its timeout forfeiture',()=>{
    const full=fullBench(),pending=fight(full.pool,full.state);
    expect(check(pending.state).revealedDrops[0]).toMatchObject({status:'pending-capacity',reason:'bench-full'});
    const discarded=accept(runSharedMatchCommand(pending.pool,pending.state,{type:'claimLoot',round:pending.state.round}));
    expect(check(discarded.state).revealedDrops[0]).toMatchObject({status:'forfeited',reason:'timeout-forfeited'});
    expect(check(discarded.state).revealedDrops[1].payload.kind).toBe('consumable');
  });
});
