import {openingEncounter} from './fixtures/m5/oracle.g2.cjs';
import {lootPlan as independentLootPlan} from './fixtures/orb-combo-oracle.cjs';
import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { revealMatchLoot } from '../src/simulation/loot-runtime';
import { accepted } from './match-helpers';
import {simultaneousB8Preparation,partialB8Preparation} from './fixtures/g2-3-b8-public';
import { publicNeutralPreparation } from './fixtures/m8-neutral-public-route';
import { simultaneousPrefix, barePartialPrefix, PARTIAL_REVEAL_SEEDS } from './fixtures/b8-live-reveal-routes';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const prefix=await simultaneousPrefix();
expect(openingEncounter(prefix.seed)).toBe('none');
expect(prefix.preparation.units.filter(u=>u.team==='player').map(u=>[u.definitionId,u.starLevel]).sort()).toEqual(
 ['irelia','leona','loris','lux','nami','rell','zoe','zyra'].map(id=>[id,2]));
expect(prefix.items.filter(i=>i.location.kind==='unit').map(i=>i.definitionId).sort()).toEqual(['gunblade','ionic-spark','shojin','sunfire-cape']);
const independentDrops=independentLootPlan(prefix.seed,24).rounds.at(-1)!.encounterPlan.drops;
expect(independentDrops).toHaveLength(9);
const sourceDrops=(slot:string)=>independentDrops.filter(d=>d.sourceUnitId===JSON.stringify(['pve','4-7','razorbeaks-v1',slot]));
expect(sourceDrops('r03').map(d=>d.payload.kind)).toEqual(['unit']);
expect(sourceDrops('r04')).toHaveLength(3);expect(sourceDrops('r04').some(d=>d.payload.kind==='unit')).toBe(true);
expect([...new Set(independentDrops.map(d=>JSON.parse(d.sourceUnitId!)[3]))]).toEqual(['r00','r01','r02','r03','r04']);
const lorisPrefix=await barePartialPrefix('loris',PARTIAL_REVEAL_SEEDS.loris,['visionary-crest','building-a-collection-iii','enforcer-crown']);
for(const state of [lorisPrefix]){
 expect(openingEncounter(state.seed)).toBe('none');
 expect(state.augments.find(a=>a.choiceId==='round:2-1:augment')?.definitionId).toBe('visionary-crest');
 expect(state.augmentOffers.find(a=>a.choiceId==='round:2-1:augment')?.rerolledIndices).toEqual([]);
}
expect(lorisPrefix.augments.map(a=>a.definitionId)).toEqual(['visionary-crest','building-a-collection-iii','enforcer-crown']);
// First serialize of either 4-7 proof replays ~10k commands (~11s at 0c676fac).
// CI kills the case at 20s. Warm both proofs once, then prove a tick-126 checkpoint
// of the simultaneous route does not evict the Loris proof (that miss was ~11s).
serializeMatch(prefix);
serializeMatch(lorisPrefix);
{
  let checkpoint = accepted(api.startMatchCombat(simultaneousB8Preparation(prefix)));
  while (checkpoint.phase === 'combat' && checkpoint.combat!.tick < 126) checkpoint = api.stepMatch(checkpoint).state;
  serializeMatch(checkpoint);
  const started = performance.now();
  serializeMatch(lorisPrefix);
  serializeMatch(prefix);
  expect(performance.now() - started).toBeLessThan(8_000);
}
function unchangedStep(state: api.MatchState): void {
  const saved = serializeMatch(state), result = api.stepMatch(state);
  expect(result).toEqual({ state, events: [] }); expect(result.state).toBe(state);
  expect(serializeMatch(state)).toBe(saved);
}
function rejected(state: api.MatchState, call: () => api.MatchCommandResult, reason: string): void {
  const saved = serializeMatch(state), result = call();
  expect(result).toEqual({ ok: false, state, reason }); expect(result.state).toBe(state);
  expect(serializeMatch(state)).toBe(saved);
}
const clone = (state: api.MatchState): api.MatchState => {
  const saved = serializeMatch(state), restored = restoreMatch(saved);
  expect(restored).toEqual(state); expect(restored).not.toBe(state);
  expect(serializeMatch(state)).toBe(saved);
  return restored;
};

describe('B8 real simultaneous loot-source deaths', () => {
  it('reveals both carrier entries while two neutral sources die on the same tick, then restores and grants each exactly once', () => {
    let state = accepted(api.startMatchCombat(clone(simultaneousB8Preparation(prefix))));
    while (state.phase === 'combat' && state.combat.tick < 126) state = api.stepMatch(state).state;
    expect(state.phase).toBe('combat');
    expect(state.combat!.tick).toBe(126);
    const before = state, resumedBefore = clone(before);
    const transition = api.stepMatch(before), resumedTransition = api.stepMatch(resumedBefore);
    expect(resumedTransition).toEqual(transition);
    state = transition.state;
    expect(state.phase).toBe('combat');
    const revealed = transition.events.filter(event => event.type === 'lootRevealed');
    expect(revealed).toHaveLength(3); // r02's two entries and r03's hero, in a live combat batch.
    const plan = state.m8.loot.frozen.rounds.find(round => round.encounterPlan.roundId === '4-7')!;
    expect(revealed.map(event => event.dropId)).toEqual([
      ...plan.encounterPlan.drops.filter(d=>d.sourceUnitId!.endsWith('r02"]')||d.sourceUnitId!.endsWith('r03"]')).map(drop => drop.dropId), ...plan.choices.map(choice => choice.dropId),
    ]);
    const expectedDeaths = [
      // Seed 15972 after the lawful Leona/Loris swap. r04 dies alone, then
      // r02/r03 die in the tick-127 batch, and r00/r01 close the fight together.
      // These are recorded public-combat checkpoints, not independently derived constants.
      { unitId: '["pve","4-7","razorbeaks-v1","r04"]', tick: 40, eventSeq: 446 },
      { unitId: '["pve","4-7","razorbeaks-v1","r02"]', tick: 127, eventSeq: 1226 },
      { unitId: '["pve","4-7","razorbeaks-v1","r03"]', tick: 127, eventSeq: 1227 },
      { unitId: '["pve","4-7","razorbeaks-v1","r00"]', tick: 165, eventSeq: 1504 },
      { unitId: '["pve","4-7","razorbeaks-v1","r01"]', tick: 165, eventSeq: 1505 },
    ];
    expect(state.combat!.neutralReceipts!.deaths).toEqual(expectedDeaths.slice(0,3));
    expect(transition.events.filter(event => event.type === 'death').map(event => [event.type === 'death' && event.unitId, event.tick, event.eventSeq])).toEqual(expectedDeaths.slice(1,3).map(death => [death.unitId, death.tick, death.eventSeq]));
    expect(revealed.map(event => event.death.eventSeq)).toEqual([1226, 1226, 1227]);
    for (const field of ['gold', 'items', 'preparation', 'persistentGrowth', 'nextUnitSerial', 'nextItemSerial',
      'resourceProvenance', 'rngState', 'choiceRngState', 'rewardRngState', 'equipmentState'] as const)
      expect(state[field]).toEqual(before[field]);
    expect(state.m8.loot.frozen).toBe(before.m8.loot.frozen);
    expect(state.m8.loot.receipts).toBe(before.m8.loot.receipts);
    const restoredReveal = clone(state);
    const duplicate = revealMatchLoot(restoredReveal, restoredReveal.combat!);
    expect(duplicate).toEqual({ state: restoredReveal, events: [] });
    expect(duplicate.state).toBe(restoredReveal);
    const forged = JSON.parse(serializeMatch(state));
    forged.m8.loot.earnedEvidence.find((e:{dropId:string})=>e.dropId===revealed[2].dropId).death.eventSeq = 1226; // Substitute r02's real death identity for r03's evidence.
    expect(() => restoreMatch(forged)).toThrow('Invalid B8 Match: duplicate death identity');
    let resumed = restoredReveal, terminalEvents:readonly api.MatchEvent[]=[];
    while (state.phase === 'combat') {
      const a = api.stepMatch(state), b = api.stepMatch(resumed);
      expect(b).toEqual(a); state = a.state; resumed = b.state;
      if(state.phase!=='combat')terminalEvents=a.events;
    }
    expect(state.phase).toBe('settlement');
    expect(state.combat!.neutralReceipts!.deaths).toEqual(expectedDeaths);
    // The last two birds die in the action that ends combat.
    // Preserve both obligations: live reveal above, and atomic terminal reveal+grant here.
    const terminalRevealed=terminalEvents.filter(e=>e.type==='lootRevealed');
    expect(terminalRevealed).toHaveLength(3);
    expect(terminalRevealed.map(e=>e.dropId)).toEqual(plan.encounterPlan.drops.filter(d=>d.sourceUnitId!.endsWith('r00"]')||d.sourceUnitId!.endsWith('r01"]')).map(d=>d.dropId));
    expect(terminalRevealed.map(e=>e.death.eventSeq)).toEqual([1504,1504,1505]);
    expect(terminalEvents.flatMap(e=>e.type==='death'?[[e.unitId,e.tick,e.eventSeq]]:[])).toEqual(expectedDeaths.slice(3).map(d=>[d.unitId,d.tick,d.eventSeq]));
    const forgedTerminal=JSON.parse(serializeMatch(state));
    forgedTerminal.m8.loot.earnedEvidence.find((e:{dropId:string})=>e.dropId===terminalRevealed[2].dropId).death.eventSeq=1504;
    expect(()=>restoreMatch(forgedTerminal)).toThrow('Invalid B8 Match: duplicate death identity');
    expect(revealMatchLoot(state,state.combat!)).toEqual({state,events:[]});
    expect(state.pendingChoice).toBeNull();expect(clone(state)).toEqual(state);
    const ids=new Set(plan.encounterPlan.drops.map(drop=>drop.dropId));
    expect(state.m8.loot.receipts.filter(receipt=>ids.has(receipt.dropId))).toHaveLength(9); // v22 adds the 4-7 component anvil entry.
    unchangedStep(state);
    rejected(state,()=>api.selectChoice(state,'obsolete-pve-choice',0,'tear'),'wrong-phase');
    expect(api.nextRound(clone(state),state.round)).toEqual(api.nextRound(state,state.round));
  });

  it.each([
    // Restored birds defeat bare two-star Loris before he scores a kill.
    // Seed 54239 inventory, Shojin/Gargoyle/Crownguard: (6,7) kills only r04 and
    // (0,6) kills only r01. Counts are that fight's granted receipts.
    ['r04', 520, 'settlement', 2, 0, 1],
    ['r01', 353, 'settlement', 1, 1, 0],
  ] as const)('earns only killed source rewards after an actual equipped Loris partial defeat at %s', (source, deathTick, phase, directReceipts, itemBirths, unitBirths) => {
    let prepared=partialB8Preparation(lorisPrefix,'loris');
    const holder=prepared.preparation.units.find(u=>u.team==='player'&&u.definitionId==='loris')!;
    const loadout=['shojin','gargoyle','crownguard'];
    for(const [slot,definitionId]of loadout.entries()){
      const item=prepared.items.find(i=>i.location.kind==='inventory'&&i.definitionId===definitionId)!;
      expect(item).toBeDefined();prepared=accepted(api.equipItem(prepared,item.id,holder.id,slot));
    }
    prepared=accepted(api.deployMatchUnit(prepared,holder.id,{kind:'board',cell:source==='r04'?{col:6,row:7}:{col:0,row:6}}));
    expect(prepared.augments.map(a=>a.definitionId)).toEqual(['visionary-crest','building-a-collection-iii','enforcer-crown']);
    let state=clone(prepared);
    const targetId=state.preparation.units.find(u=>u.team==='player'&&u.definitionId==='loris')!.id;
    expect(state.preparation.units.find(unit => unit.id === targetId)).toMatchObject({
      definitionId: 'loris', starLevel: 2, team: 'player',
    });
    // The clone above already checked this equipped board. A second cold restore replayed the same proof again.
    const beforeReceipts = state.m8.loot.receipts.length, beforeItemSerial = state.nextItemSerial;
    const unitSerial = state.nextUnitSerial, frozen = state.m8.loot.frozen;
    state = accepted(api.startMatchCombat(state));
    while (state.phase === 'combat' && state.combat.tick < deathTick) state = api.stepMatch(state).state;
    expect(state.phase).toBe('combat');
    expect(state.combat!.neutralReceipts!.deaths.map(death => [death.unitId, death.tick])).toEqual([
      [JSON.stringify(['pve', '4-7', 'razorbeaks-v1', source]), deathTick],
    ]);
    expect(state.m8.loot.receipts).toHaveLength(beforeReceipts);
    expect(state.nextItemSerial).toBe(beforeItemSerial); expect(state.nextUnitSerial).toBe(unitSerial);
    let resumed = clone(state);
    const events: api.MatchEvent[] = [], resumedEvents: api.MatchEvent[] = [];
    while (state.phase === 'combat') {
      const a = api.stepMatch(state), b = api.stepMatch(resumed);
      events.push(...a.events); resumedEvents.push(...b.events); state = a.state; resumed = b.state;
    }
    expect(resumedEvents).toEqual(events); expect(resumed).toEqual(state);
    expect(state.phase).toBe(phase); expect(state.combat!.result).toBe('enemyWin');
    expect(state.combat!.neutralReceipts!.deaths).toHaveLength(1);
    expect(state.m8.loot.receipts).toHaveLength(beforeReceipts + directReceipts);
    // A non-lethal loss carries every unrevealed 4-7 drop to the next PvE. Only the killed source is granted.
    expect(state.m8.loot.direct.filter(d=>frozen.rounds.at(-1)!.encounterPlan.drops.some(p=>p.dropId===d.dropId)).map(drop => drop.status)).toEqual(independentLootPlan(state.seed,24).rounds.at(-1)!.encounterPlan.drops.map(d=>d.sourceUnitId===JSON.stringify(['pve','4-7','razorbeaks-v1',source])?'granted':'carried'));
    expect(state.m8.loot.choiceEligibility).toEqual([]);
    expect(state.nextUnitSerial).toBe(unitSerial + unitBirths);
    expect(state.nextItemSerial).toBe(beforeItemSerial + itemBirths);
    expect(state.m8.loot.frozen).toBe(frozen);
    expect(clone(state)).toEqual(state);
    const forged = JSON.parse(serializeMatch(state));
    const corrupted=forged.m8.loot.direct.find((d:{dropId:string})=>d.dropId===frozen.rounds.at(-1)!.encounterPlan.drops.find(d=>d.sourceUnitId===JSON.stringify(['pve','4-7','razorbeaks-v1',source]))!.dropId);
    corrupted.status = directReceipts ? 'forfeited' : 'revealed';corrupted.receiptId = null;
    expect(() => restoreMatch(forged)).toThrow(/qualification evidence/);
    unchangedStep(state);
    expect(api.nextRound(clone(state), state.round)).toEqual(api.nextRound(state, state.round));
  });

  it('an unloaded carrier death adds zero reveal evidence; terminal awards only previously killed loaded carriers',()=>{
    // Every 4-7 bird now carries an orb (five carriers, at least five orbs).
    // The live 1-4 round still has unloaded minions: m01 carries two hero entries,
    // while m02/r01/r02 carry nothing. Use that real encounter for the same obligation.
    const prepared=publicNeutralPreparation('1-4');
    const expected=independentLootPlan(prepared.seed,3).rounds.at(-1)!.encounterPlan.drops;
    expect(expected).toHaveLength(2);
    expect(expected.map(d=>d.sourceUnitId)).toEqual(Array(2).fill('["pve","1-4","minions-c-v1","m01"]'));
    const loaded=new Set(expected.map(d=>d.sourceUnitId));
    const unloaded=prepared.m8.preparation.enemies.map(u=>u.id).filter(id=>!loaded.has(id));
    expect(unloaded).toHaveLength(3);
    let state=accepted(api.startMatchCombat(clone(prepared))),before=state,result=api.stepMatch(state);
    while(state.phase==='combat') {before=state;result=api.stepMatch(state);state=result.state;}
    expect(api.stepMatch(clone(before))).toEqual(result);
    expect(state.combat!.result).toBe('playerWin');
    const deaths=result.events.filter(e=>e.type==='death');
    expect(deaths).toHaveLength(1);
    expect(unloaded).toContain(deaths[0].unitId);
    expect(result.events.filter(e=>e.type==='lootRevealed')).toEqual([]);
    expect(result.state.m8.loot.earnedEvidence).toEqual(before.m8.loot.earnedEvidence);
    expect(result.state.m8.loot.frozen).toBe(before.m8.loot.frozen);
    expect(result.state.m8.loot.receipts.slice(before.m8.loot.receipts.length).map(r=>[r.dropId,r.payload])).toEqual(expected.map(d=>[d.dropId,d.payload]));
    expect(result.state.m8.loot.earnedEvidence.some(e=>e.death.eventSeq===deaths[0].eventSeq)).toBe(false);
    expect(clone(result.state)).toEqual(result.state);
    const lastEvidence=result.state.m8.loot.earnedEvidence.at(-1)!;
    const source=expected.find(d=>d.dropId===lastEvidence.dropId)!.sourceUnitId;
    expect(result.state.m8.loot.earnedEvidence.filter(e=>expected.some(d=>d.dropId===e.dropId&&d.sourceUnitId===source))).toHaveLength(2);
    const bad=JSON.parse(serializeMatch(result.state));
    bad.m8.loot.earnedEvidence.at(-1).death.eventSeq--;
    expect(()=>restoreMatch(bad)).toThrow('source death conflict');
  });

});
