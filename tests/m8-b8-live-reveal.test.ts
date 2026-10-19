import { describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { revealMatchLoot } from '../src/simulation/loot-runtime';
import { accepted } from './match-helpers';
import {simultaneousB8Preparation,partialB8Preparation} from './fixtures/g2-3-b8-public';
import { configuredPrefix } from './fixtures/t13-loot-public';

// A command-only route recreates the original eight two-star holders and four-item
// loadout. Supply choices fund the recipes; every sale, reroll, removal and deployment
// is a public Match command, preserving the exact tick/eventSeq assertions below.
async function simultaneousPrefix():Promise<api.MatchState>{
 const equipmentTargets={'sunfire-cape':{definitionId:'irelia'},'ionic-spark':{definitionId:'loris'},gunblade:{definitionId:'zoe'},shojin:{definitionId:'zoe'}};
 const board=[
  {definitionId:'irelia',col:1,row:4},{definitionId:'lux',col:5,row:7},
  {definitionId:'rell',col:3,row:4},{definitionId:'nami',col:0,row:7},
  {definitionId:'zoe',col:3,row:7},{definitionId:'loris',col:5,row:4},
  {definitionId:'leona',col:0,row:5},{definitionId:'zyra',col:1,row:7},
 ];
 let state=await configuredPrefix('4-7',{build:'mage',seed:242874,goldReserves:{'4-7':0},goldReserveByRound:{'4-5':100,'4-7':100},
  augmentPriorities:['bronze-for-life-ii','pumping-up-iii','item-collector-ii'],anomalyDefinitionId:'protective-shielding',anomalyTargetDefinitionId:'zoe',
  equipmentTargets,reservedComponents:['sword','vest','belt','rod','cloak','bow','gloves','tear'],supplyChoices:['sword','rod','sword']});
 while(state.level<8){const r=api.buyXp(state);if(!r.ok)break;state=r.state;}
 const wanted=new Set(board.map(u=>u.definitionId));
 for(const unit of state.preparation.units.filter(u=>u.team==='player'&&!wanted.has(u.definitionId)))state=accepted(api.sellUnit(state,unit.id));
 const complete=()=>board.every(w=>state.preparation.units.some(u=>u.team==='player'&&u.definitionId===w.definitionId&&u.starLevel===2));
 for(let rolls=0;rolls<100&&!complete();rolls++){
  for(let slot=0;slot<5;slot++){
   const offer=state.shop.slots[slot];
   if(offer.status==='available'&&wanted.has(offer.definitionId)&&!state.preparation.units.some(u=>u.team==='player'&&u.definitionId===offer.definitionId&&u.starLevel===2)){
    const result=api.buyUnit(state,slot,state.shop.generation);if(result.ok)state=result.state;
   }
  }
  if(complete())break;
  const result=api.rerollShop(state);if(!result.ok)break;state=result.state;
 }
 if(state.level<8||!complete())throw Error('Public simultaneous route did not form eight two-star holders');
 const kept=board.map(w=>state.preparation.units.find(u=>u.team==='player'&&u.definitionId===w.definitionId&&u.starLevel===2)!);
 const keep=new Set(kept.map(u=>u.id));
 for(const unit of state.preparation.units.filter(u=>u.team==='player'&&!keep.has(u.id)))state=accepted(api.sellUnit(state,unit.id));
 for(const unit of kept)if(state.items.some(i=>i.location.kind==='unit'&&i.location.unitId===unit.id)){
  const tool=state.consumables.find(c=>c.definitionId==='magnetic-remover')!;
  state=accepted(api.useConsumable(state,tool.consumableId,{kind:'unit',unitId:unit.id}));
 }
 for(const [slot,unit]of kept.entries())state=accepted(api.deployMatchUnit(state,unit.id,{kind:'bench',slot}));
 for(const w of board)state=accepted(api.deployMatchUnit(state,kept.find(u=>u.definitionId===w.definitionId)!.id,{kind:'board',cell:{col:w.col,row:w.row}}));
 for(const [definitionId,target]of Object.entries(equipmentTargets))state=accepted(api.equipItem(state,state.items.find(i=>i.definitionId===definitionId)!.id,kept.find(u=>u.definitionId===target.definitionId)!.id,definitionId==='shojin'?1:0));
 return state;
}
const prefix=await simultaneousPrefix();
// Recreate each bare two-star holder by public sales, purchases and an earned remover.
async function barePartialPrefix(name:'zyra'|'loris',seed:number,augmentPriorities:string[]):Promise<api.MatchState>{
 let state=await configuredPrefix('4-7',{build:'mage',seed,goldReserves:{'4-7':0},augmentPriorities,anomalyDefinitionId:'protective-shielding'});
 let target=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===name)!;
 for(const unit of state.preparation.units.filter(u=>u.team==='player'&&u.id!==target.id))state=accepted(api.sellUnit(state,unit.id));
 for(let rolls=0;rolls<100&&target.starLevel!==2;rolls++){
  const slot=state.shop.slots.findIndex(o=>o.status==='available'&&o.definitionId===name);
  state=accepted(slot<0?api.rerollShop(state):api.buyUnit(state,slot,state.shop.generation));
  target=state.preparation.units.find(u=>u.id===target.id)!;
 }
 if(state.items.some(i=>i.location.kind==='unit'&&i.location.unitId===target.id)){
  const tool=state.consumables.find(c=>c.definitionId==='magnetic-remover')!;
  state=accepted(api.useConsumable(state,tool.consumableId,{kind:'unit',unitId:target.id}));
 }
 return accepted(api.deployMatchUnit(state,target.id,{kind:'board',cell:{col:name==='zyra'?0:6,row:4}}));
}
const zyraPrefix=await barePartialPrefix('zyra',8606,['blistering-strikes','pumping-up-ii','bronze-for-life-ii']);
const lorisPrefix=await barePartialPrefix('loris',59439,['bronze-for-life-i','pumping-up-ii','bronze-for-life-ii']);
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
  it('reveals four orb entries while two neutral sources die on the same tick, then restores and grants each exactly once', () => {
    let state = accepted(api.startMatchCombat(clone(simultaneousB8Preparation(prefix))));
    while (state.phase === 'combat' && state.combat.tick < 43) state = api.stepMatch(state).state;
    expect(state.phase).toBe('combat');
    expect(state.combat!.tick).toBe(43);
    const before = state, resumedBefore = clone(before);
    const transition = api.stepMatch(before), resumedTransition = api.stepMatch(resumedBefore);
    expect(resumedTransition).toEqual(transition);
    state = transition.state;
    expect(state.phase).toBe('combat');
    const revealed = transition.events.filter(event => event.type === 'lootRevealed');
    expect(revealed).toHaveLength(4);
    const plan = state.m8.loot.frozen.rounds.find(round => round.encounterPlan.roundId === '4-7')!;
    expect(revealed.map(event => event.dropId)).toEqual([
      ...plan.encounterPlan.drops.map(drop => drop.dropId), ...plan.choices.map(choice => choice.dropId),
    ]);
    const deaths = state.combat!.neutralReceipts!.deaths;
    expect(deaths).toEqual([
      // G23 lawful Lux/Nami position swap: both sources die in the same tick-44 action batch.
      { unitId: '["pve","4-7","razorbeaks-v1","r00"]', tick: 44, eventSeq: 382 },
      { unitId: '["pve","4-7","razorbeaks-v1","r01"]', tick: 44, eventSeq: 383 },
    ]);
    expect(transition.events.filter(event => event.type === 'death').map(event => [event.type === 'death' && event.unitId, event.tick, event.eventSeq])).toEqual(deaths.map(death => [death.unitId, death.tick, death.eventSeq]));
    expect(revealed.map(event => event.death.eventSeq)).toEqual([382, 382, 382, 382]); // All four frozen drops belong to r00.
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
    forged.m8.loot.earnedEvidence.at(-1).death.eventSeq = 383; // Substitute r01's real death identity for r00's drop evidence.
    expect(() => restoreMatch(forged)).toThrow('Invalid B8 Match: source death conflict');
    let resumed = restoredReveal;
    while (state.phase === 'combat') {
      const a = api.stepMatch(state), b = api.stepMatch(resumed);
      expect(b).toEqual(a); state = a.state; resumed = b.state;
    }
    expect(state.phase).toBe('settlement');
    expect(state.pendingChoice).toBeNull();expect(clone(state)).toEqual(state);
    const ids=new Set(plan.encounterPlan.drops.map(drop=>drop.dropId));
    expect(state.m8.loot.receipts.filter(receipt=>ids.has(receipt.dropId))).toHaveLength(4);
    unchangedStep(state);
    rejected(state,()=>api.selectChoice(state,'obsolete-pve-choice',0,'tear'),'wrong-phase');
    expect(api.nextRound(clone(state),state.round)).toEqual(api.nextRound(state,state.round));
  });

  it.each([
    ['loris', 'r00', 381, 'settlement', 4],
    ['zyra', 'r01', 152, 'settlement', 0],
  ] as const)('earns only killed source rewards after an actual partial defeat with %s', (survivor, source, deathTick, phase, directReceipts) => {
    let state = clone(partialB8Preparation(survivor === 'zyra' ? zyraPrefix : lorisPrefix, survivor));
    const targetId=state.preparation.units.find(u=>u.team==='player'&&u.definitionId===survivor)!.id;
    expect(state.preparation.units.find(unit => unit.id === targetId)).toMatchObject({
      definitionId: survivor, starLevel: 2, team: 'player',
    });
    state = clone(state);
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
    expect(state.m8.loot.direct.slice(-4).map(drop => drop.status)).toEqual(directReceipts ? Array(4).fill('granted') : Array(4).fill('forfeited'));
    expect(state.m8.loot.choiceEligibility).toEqual([]);
    expect(state.nextUnitSerial).toBe(unitSerial);
    expect(state.nextItemSerial).toBe(beforeItemSerial + (directReceipts ? 2 : 0));
    expect(state.m8.loot.frozen).toBe(frozen);
    expect(clone(state)).toEqual(state);
    const forged = JSON.parse(serializeMatch(state));
    forged.m8.loot.direct.at(-1).status = directReceipts ? 'forfeited' : 'revealed';
    forged.m8.loot.direct.at(-1).receiptId = null;
    expect(() => restoreMatch(forged)).toThrow(/qualification evidence/);
    unchangedStep(state);
    expect(api.nextRound(clone(state), state.round)).toEqual(api.nextRound(state, state.round));
  });

});
