import { beforeAll, describe, expect, it } from 'vitest';
import {
  buyUnit, buyXp, combineItems, createMatch, deployMatchUnit, equipItem, nextRound, rerollShop,
  selectChoice, sellUnit, setShopLock, startMatchCombat, stepMatch,
  type MatchCommandResult, type MatchEvent, type MatchState,
} from '../src/simulation/match';
import { freezeLootThroughRound } from '../src/simulation/loot-freeze';
import type { FrozenDirectDrop } from '../src/simulation/loot-types';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import type { ResourceProvenanceEntry } from '../src/simulation/resource-provenance';
import { accepted } from './match-helpers';

// A fixed domain prefix discovered with the normal cannon route, buying only two Tristana
// copies and deploying both. Every resource, ID, star and growth value below comes from
// public commands and actual battles. This is not a persisted-state fixture or a B9 app route.
type PrefixCommand =
  | readonly ['fight' | 'continue' | 'xp' | 'reroll']
  | readonly ['buy', number, number]
  | readonly ['board', number, number, number]
  | readonly ['bench', number, number]
  | readonly ['select', string]
  | readonly ['combine', number, number]
  | readonly ['equip', number, number, 0 | 1 | 2]
  | readonly ['lock', boolean]
  | readonly ['sell', number];
const PREFIX: readonly PrefixCommand[] = [
  ["fight"],
  ["continue"],
  // Round 2.
  ["buy", 0, 2],
  ["buy", 2, 2],
  ["board", 2, 1, 7],
  ["fight"],
  ["select", "sword"],
  ["continue"],
  // Round 3.
  ["board", 5, 3, 7],
  ["fight"],
  ["select", "sword"],
  ["continue"],
  // Round 4.
  ["select", "pumping-up-i"],
  ["combine", 1, 2],
  ["equip", 3, 2, 0],
  ["fight"],
  ["continue"],
  // Round 5.
  ["lock", true],
  ["fight"],
  ["continue"],
  // Round 6.
  ["lock", false],
  ["xp"],
  ["fight"],
  ["continue"],
  // Round 7.
  ["select", "sword"],
  ["continue"],
  // Round 8.
  ["buy", 3, 7],
  ["board", 6, 5, 7],
  ["fight"],
  ["continue"],
  // Round 9.
  ["buy", 0, 8],
  ["buy", 3, 8],
  ["xp"],
  ["sell", 5],
  ["board", 7, 3, 4],
  ["fight"],
  ["continue"],
  // Round 10.
  ["buy", 1, 9],
  ["board", 9, 5, 4],
  ["fight"],
  ["select", "belt"],
  ["continue"],
  // Round 11.
  ["buy", 2, 10],
  ["sell", 10],
  ["combine", 4, 5],
  ["equip", 7, 2, 1],
  ["bench", 2, 0],
  ["board", 11, 0, 4],
  ["fight"],
  ["continue"],
  // Round 12.
  ["select", "placebo"],
  ["buy", 0, 11],
  ["buy", 1, 11],
  ["buy", 4, 11],
  ["bench", 9, 2],
  ["board", 13, 1, 7],
  ["fight"],
  ["continue"],
  // Round 13.
  ["buy", 4, 12],
  ["xp"],
  ["xp"],
  ["xp"],
  ["reroll"],
  ["reroll"],
  ["buy", 2, 14],
  ["buy", 3, 14],
  ["buy", 4, 14],
  ["reroll"],
  ["reroll"],
  ["buy", 1, 16],
  ["reroll"],
  ["buy", 0, 17],
  ["buy", 2, 17],
  ["sell", 2],
  ["equip", 3, 19, 0],
  ["equip", 7, 19, 1],
  ["bench", 7, 0],
  ["board", 17, 3, 7],
  ["board", 19, 0, 7],
  ["fight"],
  ["continue"],
  // Round 14.
  ["select", "belt"],
  ["continue"],
  // Round 15.
  ["buy", 0, 19],
  ["buy", 2, 19],
  ["reroll"],
  ["reroll"],
  ["reroll"],
  ["buy", 1, 22],
  ["reroll"],
  ["reroll"],
  ["reroll"],
  ["combine", 6, 8],
  ["equip", 9, 11, 0],
  ["bench", 6, 1],
  ["board", 7, 3, 4],
  ["fight"],
  ["continue"],
  // Round 16.
  ["reroll"],
  ["reroll"],
  ["reroll"],
  ["reroll"],
  ["reroll"],
  ["fight"],
  ["continue"],
  // Round 17.
  ["xp"],
  ["xp"],
  ["xp"],
  ['bench', 19, 0], // A public deployment leaves Tristana time to gain a real 3-7 delta.
];

function command(state: MatchState, action: PrefixCommand): MatchCommandResult {
  switch (action[0]) {
    case 'fight': return startMatchCombat(state);
    case 'continue': return nextRound(state, state.round);
    case 'xp': return buyXp(state);
    case 'reroll': return rerollShop(state);
    case 'buy': return buyUnit(state, action[1], action[2]);
    case 'board': return deployMatchUnit(state, `unit-${action[1]}`, {kind:'board',cell:{col:action[2],row:action[3]}});
    case 'bench': return deployMatchUnit(state, `unit-${action[1]}`, {kind:'bench',slot:action[2]});
    case 'select': {
      const choice = state.pendingChoice!;
      return selectChoice(state, choice.choiceId, choice.generation, action[1]);
    }
    case 'combine': return combineItems(state, `item-${action[1]}`, `item-${action[2]}`);
    case 'equip': return equipItem(state, `item-${action[1]}`, `unit-${action[2]}`, action[3]);
    case 'lock': return setShopLock(state, action[1], state.shop.generation);
    case 'sell': return sellUnit(state, `unit-${action[1]}`);
  }
}
const copy = <T>(value: T): T => structuredClone(value);
function roundTrip(state: MatchState): MatchState {
  const before = copy(state), restored = restoreMatch(serializeMatch(state));
  expect(restored).toEqual(before);
  expect(state).toEqual(before);
  expect(restored).not.toBe(state);
  return restored;
}
function fixture() {
  let prepared = createMatch(49);
  const priorGrowth: {roundId:string; unitId:string; amountBps:number}[] = [];
  for (const action of PREFIX) {
    prepared = accepted(command(prepared, action));
    if (action[0] !== 'fight') continue;
    for (let tick = 0; prepared.phase === 'combat' && tick < 1201; tick++) {
      const step = stepMatch(prepared);
      priorGrowth.push(...step.events.filter(event => event.type === 'growth' && ['unit-13','unit-17'].includes(event.unitId))
        .map(event => {
          if (event.type !== 'growth') throw new Error('Expected growth');
          return {roundId:prepared.roundDefinitionId,unitId:event.unitId,amountBps:event.amountBps};
        }));
      prepared = step.state;
    }
    expect(prepared.phase).not.toBe('combat');
  }
  expect(prepared.roundDefinitionId).toBe('3-7');
  expect(prepared.phase).toBe('preparation');
  const start = startMatchCombat(prepared), started = accepted(start);
  if (!start.ok) throw new Error(start.reason);
  let ended = started, revealed: MatchState | undefined, beforeFinal: MatchState | undefined;
  let revealPrefix: MatchEvent[] = [];
  const events: MatchEvent[] = [...start.events];
  while (ended.phase === 'combat' && ended.combat.tick < 1201) {
    const before = ended, step = stepMatch(ended);
    events.push(...step.events); ended = step.state;
    if (step.events.some(event => event.type === 'lootRevealed') && ended.phase === 'combat' && !revealed) {
      revealed = ended; revealPrefix = [...events];
    }
    if (ended.phase !== 'combat') beforeFinal = before;
  }
  if (!revealed || !beforeFinal) throw new Error('Expected live reveal and natural final tick');
  expect(ended.phase).toBe('choice');
  const choice = ended.pendingChoice!;
  const selected = accepted(selectChoice(ended, choice.choiceId, choice.generation, 'sword'));
  return {prepared, started, revealed, beforeFinal, ended, selected, events, revealPrefix, priorGrowth, startEvents:start.events};
}
type Fixture = ReturnType<typeof fixture>;
let live: Fixture;
beforeAll(() => { live = fixture(); });
const currentCommit = (state: MatchState) => state.resourceProvenance.entries.find(
  (entry): entry is Extract<ResourceProvenanceEntry, {kind:'combat-growth-committed'}> =>
    entry.kind === 'combat-growth-committed' && entry.combatId === 'round-17')!;

// Unlike the algebra-only 1000 and runtime-only 1750 vectors, this route yields a live 500:
// unit-13 stock 250 + unit-17 stock 125 + unit-17 current delta 125, then reward unit-25 is consumed.
describe('B8 live growth plus immediate loot merge, with strict restoration', () => {
  it('pins seed 49 freeze and proves prior stock and this-combat delta from actual public battles', () => {
    const frozen = freezeLootThroughRound(49,17).rounds.at(-1)!;
    const drops: readonly FrozenDirectDrop[] = frozen.encounterPlan.drops;
    expect(frozen.encounterPlan.roundId).toBe('3-7');
    expect(drops.map(drop => ({sourceUnitId:drop.sourceUnitId,slotOrdinal:drop.slotOrdinal,payload:drop.payload}))).toEqual([
      {sourceUnitId:'["pve","3-7","wolves-v1","w00"]',slotOrdinal:0,payload:{kind:'item',definitionId:'rod',quantity:1}},
      {sourceUnitId:'["pve","3-7","wolves-v1","w00"]',slotOrdinal:1,payload:{kind:'unit',definitionId:'tristana',quantity:1}},
    ]);
    expect(frozen.choices[0]).toMatchObject({sourceUnitId:'["pve","3-7","wolves-v1","w01"]',terminalFallbackDefinitionId:'sword'});
    expect(live.prepared.m8.loot.frozen.rounds.at(-1)).toEqual(frozen);
    expect(live.priorGrowth).toEqual([
      {roundId:'3-2',unitId:'unit-13',amountBps:125},
      {roundId:'3-5',unitId:'unit-17',amountBps:125},
      {roundId:'3-6',unitId:'unit-13',amountBps:125},
    ]);
    expect(live.prepared.persistentGrowth).toEqual([
      {unitId:'unit-13',attackDamageBps:250}, {unitId:'unit-17',attackDamageBps:125},
    ]);
    expect(live.prepared.preparation.units.filter(unit => unit.team === 'player' && unit.definitionId === 'tristana')
      .map(({id,starLevel,location}) => ({id,starLevel,location}))).toEqual([
        {id:'unit-13',starLevel:1,location:{kind:'board',cell:{col:1,row:7}}},
        {id:'unit-17',starLevel:1,location:{kind:'board',cell:{col:3,row:7}}},
      ]);
    const birth = live.prepared.resourceProvenance.entries.filter(entry => entry.kind === 'unit-acquired'
      && ['unit-13','unit-17'].includes(entry.unitId));
    expect(birth).toHaveLength(2);
    expect(birth.every(entry => entry.kind === 'unit-acquired' && entry.source.kind === 'shop')).toBe(true);
    const sourceIds = ['unit-13','unit-17'];
    const originalDeltas = sourceIds.map(id => ({sourceUnitId:id,
      attackDamageBps:live.ended.combat!.units.find(unit => unit.id === id)!.runtime!.permanentAdBps}));
    expect(originalDeltas).toEqual([{sourceUnitId:'unit-13',attackDamageBps:0},{sourceUnitId:'unit-17',attackDamageBps:125}]);
    expect(live.events.filter(event => event.type === 'growth')).toEqual([
      {type:'growth',tick:74,unitId:'unit-17',amountBps:125,totalBps:125,domain:'combat',combatId:'round-17',eventSeq:131},
    ]);
    // Deliberately sum by original source ID without the production merge/fold helper.
    const stock = sourceIds.reduce((total,id) => total + live.prepared.persistentGrowth.find(value => value.unitId === id)!.attackDamageBps,0);
    const delta = originalDeltas.reduce((total,value) => total + value.attackDamageBps,0);
    expect({stock,delta,total:stock+delta}).toEqual({stock:375,delta:125,total:500});
    expect(live.ended.persistentGrowth).toEqual([{unitId:'unit-13',attackDamageBps:stock+delta}]);
    expect(currentCommit(live.ended).sourceDeltas).toEqual([{sourceUnitId:'unit-17',attackDamageBps:125}]);
  });

  it('keeps the consumed reward birth and original combat roster without resurrecting either consumed ID', () => {
    const {prepared,ended,events} = live, candidate = `unit-${prepared.nextUnitSerial}`;
    expect(candidate).toBe('unit-25');
    const receipt = ended.m8.loot.receipts.find(value => value.payload.kind === 'unit' && value.payload.definitionId === 'tristana')!;
    expect(receipt.grantedUnitIds).toEqual([candidate]);
    const births = ended.resourceProvenance.entries.filter(entry => entry.kind === 'unit-acquired' && entry.unitId === candidate);
    expect(births).toHaveLength(1);
    expect(births[0]).toMatchObject({roundId:'3-7',source:{kind:'loot',receiptId:receipt.receiptId}});
    const upgrades = events.filter(event => event.type === 'unitUpgraded');
    expect(upgrades).toHaveLength(1);
    expect(upgrades[0]).toMatchObject({survivorId:'unit-13',consumedIds:['unit-17',candidate],fromStar:1,toStar:2});
    expect(ended.resourceProvenance.entries.filter(entry => entry.kind === 'unit-upgraded' && entry.roundId === '3-7'))
      .toEqual([{kind:'unit-upgraded',roundId:'3-7',sequence:births[0].sequence+1,acquisitionSequence:births[0].sequence,
        event:{type:'unitUpgraded',survivorId:'unit-13',consumedIds:['unit-17',candidate],definitionId:'tristana',fromStar:1,toStar:2,
          location:{kind:'board',cell:{col:1,row:7}}}}]);
    expect(currentCommit(ended).sequence).toBe(births[0].sequence+2);
    expect(currentCommit(ended).combatStartProvenancePrefixLength).toBe(prepared.resourceProvenance.entries.length);
    expect(ended.nextUnitSerial).toBe(prepared.nextUnitSerial+1);
    for (const state of [ended,roundTrip(ended),live.selected,roundTrip(live.selected)]) {
      expect(state.preparation.units.find(unit => unit.id === 'unit-13')?.starLevel).toBe(2);
      for (const id of ['unit-17',candidate]) {
        expect(state.preparation.units.some(unit => unit.id === id)).toBe(false);
        expect(state.persistentGrowth.some(value => value.unitId === id)).toBe(false);
      }
      expect(state.combatInputBasis!.inputs.preparation).toEqual(prepared.preparation);
      expect(state.combatInputBasis!.inputs.persistentGrowth).toEqual(prepared.persistentGrowth);
      expect(state.combat!.units.filter(unit => ['unit-13','unit-17'].includes(unit.id)).map(({id,starLevel}) => ({id,starLevel})))
        .toEqual([{id:'unit-13',starLevel:1},{id:'unit-17',starLevel:1}]);
      expect(state.combat!.units.some(unit => unit.id === candidate)).toBe(false);
      expect(state.combat!.strategy).toEqual(buildStrategySnapshot(state.combatInputBasis!.inputs));
    }
  });

  it('strictly restores preparation, start, live reveal, pre-final tick, settlement choice and selected settlement', () => {
    for (const state of [live.prepared,live.started,live.revealed,live.beforeFinal,live.ended,live.selected]) roundTrip(state);
    expect(live.revealed.combat!.tick).toBe(74);
    expect(live.revealed.phase).toBe('combat');
    expect(live.revealed.persistentGrowth).toEqual(live.prepared.persistentGrowth);
    expect(live.revealed.preparation).toEqual(live.prepared.preparation);
    expect(live.revealed.resourceProvenance).toEqual(live.prepared.resourceProvenance);
    expect(live.revealed.nextUnitSerial).toBe(live.prepared.nextUnitSerial);
    expect(live.revealed.m8.loot.receipts).toEqual(live.prepared.m8.loot.receipts);
    expect(live.revealed.pendingChoice).toBeNull();
    expect(currentCommit(live.revealed)).toBeUndefined();
    expect(live.beforeFinal.combat!.tick).toBe(165);
    expect(live.ended.combat!.tick).toBe(166);
    expect(live.selected.phase).toBe('settlement');
  });

  it('resumes the real growth source and compares every remaining complete state/event batch through Continue', () => {
    const restarted = startMatchCombat(roundTrip(live.prepared));
    expect(accepted(restarted)).toEqual(live.started);
    if (!restarted.ok) throw new Error(restarted.reason);
    expect(restarted.events).toEqual(live.startEvents);
    let uninterrupted = live.revealed, resumed = roundTrip(live.revealed);
    const replayEvents: MatchEvent[] = [...live.revealPrefix];
    while (uninterrupted.phase === 'combat') {
      const a = stepMatch(uninterrupted), b = stepMatch(resumed);
      expect(b).toEqual(a); replayEvents.push(...b.events);
      uninterrupted = a.state; resumed = b.state;
    }
    expect(replayEvents).toEqual(live.events);
    expect(resumed).toEqual(live.ended);
    const combatEvents = replayEvents.filter(event => event.domain === 'combat');
    expect(combatEvents.map(event => event.eventSeq)).toEqual(combatEvents.map((_,index) => index));
    expect(combatEvents.filter(event => event.type === 'combatFinished')).toHaveLength(1);
    const choice = resumed.pendingChoice!;
    const a = selectChoice(uninterrupted,choice.choiceId,choice.generation,'sword');
    const b = selectChoice(roundTrip(resumed),choice.choiceId,choice.generation,'sword');
    expect(b).toEqual(a);
    const selected = accepted(b);
    expect(selected).toEqual(live.selected);
    const next = nextRound(roundTrip(selected),17);
    expect(next).toEqual(nextRound(accepted(a),17));
    const nextPrepared = accepted(next);
    expect(nextPrepared.roundDefinitionId).toBe('4-1');
    expect(nextPrepared.combatInputBasis).toBeNull();
    expect(nextPrepared.persistentGrowth).toEqual([{unitId:'unit-13',attackDamageBps:500}]);
    roundTrip(nextPrepared);
  });

  it('cannot duplicate grants, growth, IDs or any RNG via repeated steps, choice requests or Continue', () => {
    const rejected = (state: MatchState, action: () => MatchCommandResult) => {
      const before = serializeMatch(state), result = action();
      expect(result).toEqual({ok:false,state,reason:'wrong-phase'});
      expect(result.state).toBe(state);
      expect(serializeMatch(state)).toBe(before);
    };
    const choice = live.ended.pendingChoice!;
    for (const state of [live.ended,live.selected,roundTrip(live.selected)]) {
      const before = serializeMatch(state), result = stepMatch(state);
      expect(result).toEqual({state,events:[]});
      expect(result.state).toBe(state);
      expect(serializeMatch(state)).toBe(before);
      rejected(state, () => startMatchCombat(state));
      expect(state.resourceProvenance.entries.filter(entry => entry.kind === 'combat-growth-committed' && entry.combatId === 'round-17')).toHaveLength(1);
    }
    rejected(live.selected, () => selectChoice(live.selected,choice.choiceId,choice.generation,'sword'));
    rejected(live.ended, () => nextRound(live.ended,17));
    const advanced = accepted(nextRound(live.selected,17));
    rejected(advanced, () => nextRound(advanced,17));
    expect(advanced.nextUnitSerial).toBe(live.selected.nextUnitSerial);
    expect(advanced.nextItemSerial).toBe(live.selected.nextItemSerial);
    expect(advanced.resourceProvenance).toEqual(live.selected.resourceProvenance);
    expect(advanced.m8.loot.receipts).toEqual(live.selected.m8.loot.receipts);
  });

  it('binds the two w00 slots to one natural death and keeps frozen source/slot grant order', () => {
    const plan = live.ended.m8.loot.frozen.rounds.at(-1)!;
    const evidence = plan.encounterPlan.drops.map(drop => live.ended.m8.loot.earnedEvidence.find(value => value.dropId === drop.dropId)!);
    expect(evidence.map(value => value.death)).toEqual([
      {combatId:'round-17',tick:166,eventSeq:340}, {combatId:'round-17',tick:166,eventSeq:340},
    ]);
    expect(live.ended.combat!.neutralReceipts!.deaths.filter(death => death.unitId === plan.encounterPlan.drops[0].sourceUnitId)).toHaveLength(1);
    const relevant = new Set(plan.encounterPlan.drops.map(drop => drop.dropId));
    expect(live.events.filter(event => event.type === 'lootRevealed' && relevant.has(event.dropId))
      .map(event => event.type === 'lootRevealed' ? event.dropId : null)).toEqual(plan.encounterPlan.drops.map(drop => drop.dropId));
    expect(live.events.filter(event => event.type === 'lootGranted').map(event => event.type === 'lootGranted' ? event.receipt.dropId : null))
      .toEqual(plan.encounterPlan.drops.map(drop => drop.dropId));
  });
});

type Mutable<T> = T extends readonly (infer Value)[] ? Mutable<Value>[]
  : T extends object ? {-readonly [Key in keyof T]:Mutable<T[Key]>} : T;
type MutableMatch = Mutable<MatchState>;
const badCommit = (state: MutableMatch) => state.resourceProvenance.entries.find(
  (entry): entry is Mutable<Extract<ResourceProvenanceEntry,{kind:'combat-growth-committed'}>> =>
    entry.kind === 'combat-growth-committed' && entry.combatId === 'round-17')!;
const badUpgrade = (state: MutableMatch) => state.resourceProvenance.entries.find(
  (entry): entry is Mutable<Extract<ResourceProvenanceEntry,{kind:'unit-upgraded'}>> =>
    entry.kind === 'unit-upgraded' && entry.roundId === '3-7')!;
const badBirth = (state: MutableMatch) => state.resourceProvenance.entries.find(
  (entry): entry is Mutable<Extract<ResourceProvenanceEntry,{kind:'unit-acquired'}>> =>
    entry.kind === 'unit-acquired' && entry.unitId === 'unit-25')!;
const reindex = (state: MutableMatch) => {
  state.resourceProvenance.entries.forEach((entry,sequence) => { entry.sequence = sequence; });
};
const tamperings: readonly [string, (state:MutableMatch) => void, string][] = [
  ['missing commit with otherwise continuous sequence', state => {
    state.resourceProvenance.entries.splice(badCommit(state).sequence,1); reindex(state);
  }, 'Invalid resource provenance: missing combat growth commit'],
  ['second commit with a valid new sequence', state => {
    state.resourceProvenance.entries.push({...copy(badCommit(state)),sequence:state.resourceProvenance.entries.length});
  }, 'Invalid resource provenance: combat settlement identity/uniqueness'],
  ['altered settlement identity', state => { badCommit(state).settlementId = 'round-16-settled'; },
    'Invalid resource provenance: combat settlement identity/uniqueness'],
  ['start prefix moved beyond a real loot birth', state => { badCommit(state).combatStartProvenancePrefixLength++; },
    'Invalid resource provenance: loot before combat start'],
  ['delta attributed to survivor instead of consumed original source, preserving final total', state => {
    badCommit(state).sourceDeltas[0].sourceUnitId = 'unit-13';
  }, 'Invalid B8 Match: original combat growth deltas'],
  ['missing delta with a matching forged final stock', state => {
    badCommit(state).sourceDeltas = []; state.persistentGrowth[0].attackDamageBps = 375;
  }, 'Invalid B8 Match: original combat growth deltas'],
  ['inflated delta with a matching forged final stock', state => {
    badCommit(state).sourceDeltas[0].attackDamageBps = 250; state.persistentGrowth[0].attackDamageBps = 625;
  }, 'Invalid B8 Match: original combat growth deltas'],
  ['delta attributed to the new reward outside the original combat prefix', state => {
    badCommit(state).sourceDeltas[0].sourceUnitId = 'unit-25';
  }, 'Invalid resource provenance: combat growth source/step'],
  ['duplicate original delta', state => {
    badCommit(state).sourceDeltas.push(copy(badCommit(state).sourceDeltas[0]));
  }, 'Invalid resource provenance: combat growth source/step'],
  ['final growth resurrected under consumed source', state => {
    state.persistentGrowth = [{unitId:'unit-13',attackDamageBps:375},{unitId:'unit-17',attackDamageBps:125}];
  }, 'Invalid Match save: persistent growth'],
  ['birth bound to the component receipt', state => {
    const receipt = state.m8.loot.receipts.find(value => value.grantedItemIds.includes('item-10'))!;
    badBirth(state).source = {kind:'loot',receiptId:receipt.receiptId};
  }, 'Invalid resource provenance: receipt birth binding'],
  ['birth assigned the consumed old source ID', state => { badBirth(state).unitId = 'unit-17'; },
    'Invalid resource provenance: unit serial'],
  ['missing candidate birth while keeping its upgrade', state => {
    state.resourceProvenance.entries.splice(badBirth(state).sequence,1); reindex(state);
  }, 'Invalid resource provenance: upgrade transaction'],
  ['receipt candidate changed to survivor', state => {
    state.m8.loot.receipts.find(value => value.grantedUnitIds.includes('unit-25'))!.grantedUnitIds = ['unit-13'];
  }, 'Invalid resource provenance: receipt birth binding'],
  ['missing upgrade transaction', state => {
    state.resourceProvenance.entries.splice(badUpgrade(state).sequence,1); reindex(state);
  }, 'Invalid resource provenance: missing upgrade'],
  ['upgrade linked to a different acquisition', state => { badUpgrade(state).acquisitionSequence--; },
    'Invalid resource provenance: upgrade transaction'],
  ['duplicated consumed old source', state => { badUpgrade(state).event.consumedIds = ['unit-17','unit-17']; },
    'Invalid resource provenance: upgrade participants'],
  ['wrong old source in consumption', state => { badUpgrade(state).event.consumedIds = ['unit-19','unit-25']; },
    'Invalid resource provenance: upgrade ownership'],
  ['wrong star for immediate merge', state => { badUpgrade(state).event.fromStar = 2; badUpgrade(state).event.toStar = 3; },
    'Invalid resource provenance: upgrade transaction'],
  ['basis rewritten with reward-upgraded star', state => {
    state.combatInputBasis!.inputs.preparation.units.find(unit => unit.id === 'unit-13')!.starLevel = 2;
  }, 'Invalid combat input basis'],
];
describe('B8 live merged-growth corruption', () => {
  it.each(tamperings)('rejects %s at the intended strict boundary', (_label,change,message) => {
    // Only adversarial copies are edited. The positive route never injects state.
    const before = serializeMatch(live.selected), bad: MutableMatch = JSON.parse(before);
    change(bad);
    expect(() => restoreMatch(bad)).toThrow(message);
    expect(serializeMatch(live.selected)).toBe(before);
  });
});
