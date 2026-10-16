import { beforeAll, describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import type { MatchEvent, MatchState } from '../src/simulation/match-types';
import { run } from '../scripts/generate-m5-route.cjs';
import { Ledger, COMPONENTS, investment, lootIndex, lootPlan, settlement, validateLoot, validateLootTransition } from './fixtures/m5/oracle.g2.cjs';

type Command = { type: string; [key: string]: unknown } | undefined;
type Transition = { before: MatchState; after: MatchState; command: Command; events: readonly MatchEvent[] };
let initial: MatchState, timeline: Transition[], pending: MatchState;
async function openingWithRealConsumedReward() {
  initial=api.createMatch(48);timeline=[];
  const stop=new Error('captured 3-7 settlement');
  try {await run(api,{seed:48,build:'cannon',copyLimits:{tristana:2},fieldCopies:['tristana'],onStep(before,result,command){
    if(!('events' in result))throw Error(result.reason);
    timeline.push({before,after:result.state,events:result.events,command});
    if(before.roundDefinitionId==='2-4'&&before.phase==='choice')pending??=before;
    if(result.state.roundDefinitionId==='3-7'&&result.state.phase==='settlement')throw stop;
  }});}catch(e){if(e!==stop)throw e;}
}
function prefixLedger(count = timeline.length) {
  const ledger = new Ledger(initial);
  for (const t of timeline.slice(0, count)) ledger.apply(t.before, t.after, t.command, t.events);
  return ledger;
}
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const copy = <T>(value: T): Mutable<T> => structuredClone(value) as Mutable<T>;

beforeAll(openingWithRealConsumedReward, 30000);

describe('independent B8 oracle arithmetic and frozen reference', () => {
  it.each([
    [9, 10, 1, 16, 88, 0, 14, 80],
    [49, 50, 5, 60, 120, 4, 58, 112],
    [50, 51, 5, 61, 120, 5, 60, 120],
  ])('pins LOOT A3 at %iG: direct gold before interest, heroes never become gold', (gold, basis, interest, after, hp, heroInterest, heroAfter, heroHp) => {
    // Isolated oracle inputs, not a forged production Match or an implementation-generated expectation.
    const before = { round: 10, gold, level: 4, xp: 0, playerHp: 64, streak: { kind: null, count: 0 },
      augments: [{ definitionId: 'investment-strategy-i' }], augmentProgress: { pumpingRounds: 0, investmentHp: 80 } };
    const combat = { result: 'playerWin' as const, tick: 23, nextEventSeq: 147, units: [] };
    const goldResult = settlement({ ...before, gold: gold + 1 }, combat);
    expect(goldResult).toMatchObject({ interestBasis: basis, goldBefore: basis, goldAfter: after,
      incomeBreakdown: { base: 5, win: 0, interest, streak: 0 }, hpAfter: 64, combatEventCount: 147 });
    expect(investment(before, goldResult).investmentHp).toBe(hp);
    const heroResult = settlement(before, combat);
    expect(heroResult).toMatchObject({ interestBasis: gold, goldAfter: heroAfter, incomeBreakdown: { interest: heroInterest } });
    expect(investment(before, heroResult).investmentHp).toBe(heroHp);
    expect(investment({ ...before, augments: [] }, goldResult).investmentHp).toBe(80);
  });

  it('pins accepted and rejected words using independent unbounded integer arithmetic', () => {
    expect(lootIndex({ state: 2463395136, draws: 41 }, 100)).toEqual({ index: 99, rng: { state: 4294967199, draws: 42 } });
    expect(lootIndex({ state: 2444543493, draws: 41 }, 100)).toEqual({ index: 23, rng: { state: 854109823, draws: 43 } });
    expect(lootIndex({ state: 653637408, draws: 41 }, 5)).toEqual({ index: 3, rng: { state: 1012239698, draws: 43 } });
    expect(lootIndex({ state: 653637408, draws: 41 }, 3)).toEqual({ index: 2, rng: { state: 1012239698, draws: 43 } });
    expect(lootIndex({ state: 653637408, draws: 41 }, 8)).toEqual({ index: 7, rng: { state: 4294967295, draws: 42 } });
  });

  it('pins randomized orb source/order, all eight components and terminal gold/tool', () => {
    const plan=lootPlan(230,38);
    expect(plan.rounds.map(r=>r.encounterPlan.roundId)).toEqual(['1-2','1-3','1-4','2-7','3-7','4-7','5-7','6-7']);
    expect(plan.rounds.flatMap(r=>r.choices)).toEqual([]);
    expect(plan.rounds.slice(3,7).map(r=>r.encounterPlan.drops.slice(0,2).map(d=>d.payload.kind!=='gold'&&d.payload.definitionId))).toEqual([['sword','tear'],['cloak','rod'],['sword','tear'],['cloak','rod']]);
    expect(plan.rounds.slice(3,7).map(r=>r.encounterPlan.drops[2].payload)).toEqual([1,2,3,4].map(quantity=>({kind:'gold',quantity})));
    expect(plan.rounds[7].encounterPlan.drops.map(d=>d.payload)).toEqual([{kind:'gold',quantity:5},{kind:'consumable',definitionId:'magnetic-remover',quantity:1}]);
    expect(lootPlan(230,31).rng).toEqual(plan.rng);
    expect(COMPONENTS).toEqual(['sword','vest','belt','rod','cloak','bow','gloves','tear']);
  });
});

describe('independent B8 oracle checks authentic command transitions', () => {
  it('counts a real reward candidate even when immediately consumed by its upgrade', () => {
    const transition = timeline.find(t => t.after.roundDefinitionId==='3-7' && t.events.some(e => e.type === 'unitUpgraded'))!;
    expect(transition).toBeDefined();
    const receipt = transition.after.m8.loot.receipts.find(r => r.payload.kind === 'unit' && r.payload.definitionId === 'tristana')!;
    const reward=`unit-${transition.before.nextUnitSerial}`;
    const oldCopies=transition.before.preparation.units.filter(u=>u.definitionId==='tristana'&&u.starLevel===1).map(u=>u.id).sort();
    expect(oldCopies).toHaveLength(2);
    // Retention prefers the deployed copy, then board position; lexical ID is only a tie-break.
    const survivor=transition.before.preparation.units.filter(u=>oldCopies.includes(u.id)).sort((a,b)=>{
      const key=(u:typeof a)=>u.location.kind==='board'?[0,u.location.cell.row,u.location.cell.col]:[1,u.location.slot,0];
      const ka=key(a),kb=key(b);return ka[0]-kb[0]||ka[1]-kb[1]||ka[2]-kb[2]||(a.id<b.id?-1:1);
    })[0].id;
    expect(receipt.grantedUnitIds).toEqual([reward]);
    expect(transition.after.preparation.units.some(u => u.id === reward)).toBe(false);
    expect(transition.after.preparation.units.find(u => u.id === survivor)?.starLevel).toBe(2);
    expect(prefixLedger().cards).toBe(transition.after.preparation.units.filter(u=>u.team==='player').reduce((n,u)=>n+3**(u.starLevel-1),0));
    const invalid = copy(transition.after);
    invalid.m8.loot.receipts.find(r=>r.grantedUnitIds.includes(reward))!.grantedUnitIds = [survivor];
    const events = copy(transition.events);
    events.filter(e=>e.type==='lootGranted').find(e=>e.receipt.payload.kind==='unit')!.receipt = invalid.m8.loot.receipts.find(r=>r.payload.kind==='unit'&&r.payload.definitionId==='tristana')!;
    expect(() => prefixLedger(timeline.indexOf(transition)).apply(transition.before, invalid, transition.command, events)).toThrow('true loot candidate serial');
  });

  it.each(['sword', 'vest', 'belt', 'rod', 'cloak', 'bow', 'gloves', 'tear'])('validates actual .4 %s choice, one ScheduleReceipt and no extra LootReceipt', definitionId => {
    const c = pending.pendingChoice!;
    const result = api.selectChoice(pending, c.choiceId, c.generation, definitionId);
    expect(result.ok).toBe(true); if (!result.ok) return;
    const ledger = prefixLedger(timeline.findIndex(t=>t.before===pending));
    ledger.apply(pending, result.state, { type: 'select', choiceId: c.choiceId, generation: c.generation, definitionId }, result.events);
    expect(result.state.scheduleReceipts).toHaveLength(pending.scheduleReceipts.length+1);
    expect(result.state.m8.loot.receipts).toEqual(pending.m8.loot.receipts);
    expect(result.state.scheduleReceipts.at(-1)).toMatchObject({definitionId,kind:'component'});
    const repeated = api.selectChoice(result.state, c.choiceId, c.generation, definitionId);
    expect(repeated.ok).toBe(false); expect(repeated.state).toBe(result.state);
    ledger.apply(result.state, repeated.state, undefined, []);
  });

  it('rejects duplicate grant, reveal and resolution events independently of event-sequence checks', () => {
    for (const type of ['lootGranted', 'lootRevealed']) {
      const t = timeline.find(t => t.events.some(e => e.type === type))!;
      const event = t.events.find(e => e.type === type)!;
      expect(() => validateLootTransition(t.before, t.after, t.command, [...t.events, event])).toThrow('exactly one event');
    }
    const c = pending.pendingChoice!, result = api.selectChoice(pending, c.choiceId, c.generation, 'gloves');
    if (!result.ok) throw Error(result.reason);
    const command = { type: 'select', choiceId: c.choiceId, generation: c.generation, definitionId: 'gloves' };
    expect(() => validateLootTransition(pending, result.state, command,
      [...result.events,{type:'lootChoiceResolved',dropId:'forged',receiptId:'forged',method:'player-choice'}])).toThrow('exactly one event');
  });

  it.each(['wrong payload', 'wrong source', 'duplicate receipt', 'unearned receipt', 'wrong fallback', 'missing candidate'])('rejects %s instead of blessing mutated production output', corruption => {
    const t = timeline.find(t => t.events.some(e => e.type === 'lootGranted'))!;
    const invalid = copy(corruption === 'wrong fallback' || corruption === 'missing candidate' ? pending : t.after);
    if (corruption === 'wrong payload') invalid.m8.loot.receipts[0].payload = { kind: 'unit', definitionId: 'caitlyn', quantity: 1 };
    if (corruption === 'wrong source') invalid.m8.loot.frozen.rounds[0].encounterPlan.drops[0].sourceUnitId = '["pve","1-2","minions-a-v1","m02"]';
    if (corruption === 'duplicate receipt') invalid.m8.loot.receipts.push(copy(invalid.m8.loot.receipts[0]));
    if (corruption === 'unearned receipt') invalid.m8.loot.earnedEvidence = [];
    if (corruption === 'wrong fallback') invalid.m8.loot.choiceResolutions.push({dropId:invalid.m8.loot.frozen.rounds[1].encounterPlan.drops[0].dropId,receiptId:'forged',method:'terminal-fallback'});
    if (corruption === 'missing candidate') invalid.pendingChoice!.eventId='round:1-3:supply';
    expect(() => validateLoot(invalid)).toThrow();
  });

  it('rejects obsolete PvE fallback resolutions and a second schedule grant', () => {
    const c=pending.pendingChoice!,result=api.selectChoice(pending,c.choiceId,c.generation,'tear');
    if(!result.ok)throw Error(result.reason);
    expect(()=>validateLoot(result.state)).not.toThrow();
    const fallback=copy(result.state);
    fallback.m8.loot.choiceResolutions.push({dropId:fallback.m8.loot.receipts[0].dropId,receiptId:fallback.m8.loot.receipts[0].receiptId,method:'terminal-fallback'});
    expect(()=>validateLoot(fallback)).toThrow('resolution requires actual choice receipt');
    const doubled=copy(result.state);
    doubled.scheduleReceipts.push({eventId:'round:1-3:supply',round:2,kind:'component',itemIds:['item-999'],gold:0,unitId:null,definitionId:'tear'});
    expect(()=>validateLoot(doubled)).toThrow('approved schedule receipt source');
  });

  it.each([42, 230])('runs the complete real cannon route, seed %i, through the unchanged public-command driver', async seed => {
    const route = await run(api, { seed, build: 'cannon' });
    expect(route.final.roundDefinitionId).toBe('6-7');
    expect(route.final.roundResults).toHaveLength(38);
    expect(route.rounds).toHaveLength(33);
    expect(route.final.m8.loot.receipts.filter((r: MatchState['m8']['loot']['receipts'][number]) => r.payload.kind === 'item')).toHaveLength(10);
    expect(route.final.scheduleReceipts.filter((r: MatchState['scheduleReceipts'][number]) => r.kind === 'component')).toHaveLength(5);
    expect(Object.values(route.final.m8.loot.guaranteeCounters)).toEqual([0, 1, 1, 2, 2, 2, 2, 0]);
    if (seed === 230) expect(route.final.m8.loot.receipts.filter((r: MatchState['m8']['loot']['receipts'][number]) => r.payload.kind === 'unit')
      .map((r: MatchState['m8']['loot']['receipts'][number]) => r.payload)).toEqual(
        ['darius','irelia'].map(definitionId => ({ kind: 'unit', definitionId, quantity: 1 })));
  }, 120000);
});
