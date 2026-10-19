import { deepStrictEqual } from 'node:assert';
import { syntheticSharedRound } from './tp-helpers';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  combineItems, equipItem, deployMatchUnit, startMatchCombat, stepMatch, nextRound,
  buyUnit, buyXp, rerollShop, sellUnit, setShopLock,
  enableMultiplayerSettlement, lockMatchCombatRoster, snapshotForBattle,
  restorePlayerBattleSnapshot, compileBattle, restoreBattleInput, resolveTwoSidedBattle,
  serializeMatch, restoreMatch, runSharedMatchCommand, generateSharedShop, buySharedUnit,
  proposeSettlement, applyRoundSettlement, ROUND_SETTLEMENT_VERSION,
  createMatch, selectChoice, type MatchState, type MatchCommandResult, type RoundSettlementReceipt,
} from '../src/server-entry';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { previewCombine, previewEquip } from '../src/simulation/item-selectors';
import { accepted, prepared, board } from './t10-helpers';
import { freeze } from './combat-helpers';
import { publicInventory } from './fixtures/b8-public-acquisition';
import { finishPublicEquipmentBattle, resolvePublicEquipmentChoices } from './fixtures/b8-public-equipment';
import { room, accept, conserved } from './tp-helpers';
import { catalogPreparation } from './t5r-helpers';

const stock = (id: string, definitionId: string) => ({ id, definitionId, location: { kind: 'inventory' as const } });
const held = (id: string, definitionId: string, unitId = 'unit-1', slot = 0) =>
  ({ id, definitionId, location: { kind: 'unit' as const, unitId, slot } });
function rejected(state: MatchState, call: (s: MatchState) => MatchCommandResult, reason: string) {
  const bytes = JSON.stringify(state), result = call(freeze(state));
  deepStrictEqual(result, { ok: false, state, reason });
  expect(result.state).toBe(state); expect('events' in result).toBe(false);
  expect(JSON.stringify(state)).toBe(bytes); // RNG, IDs, event sequence and every resource.
}
function unchangedBattle(before: MatchState, after: MatchState) {
  expect(after.combatInputBasis).toBe(before.combatInputBasis);
  expect(after.combat).toBe(before.combat);
  expect(after.battleSeedRngState).toBe(before.battleSeedRngState);
  expect(after.rngState).toBe(before.rngState);
  expect(after.m8.loot).toBe(before.m8.loot);
  expect(after.pendingChoice).toBe(before.pendingChoice);
}

describe('T12 equipment matrix (permission vectors, not saved fixtures)', () => {
  for (const online of [false, true]) for (const kind of ['pve', 'pvp']) {
    for (const phase of ['preparation', 'combat', 'choice', 'settlement'] as const) {
      it(`${online ? 'online' : 'offline'} ${kind} ${phase}: inventory, bench, board and in-place combine; ownership/phase rejects`, () => {
        const base = prepared(), { multiplayer, ...offline } = base;
        let state = { ...(online ? base : offline), phase } as MatchState;
        if (kind === 'pvp') state = { ...state, m8: catalogPreparation('2-1').m8,
          ...(online && phase === 'combat' ? { multiplayer: { ...multiplayer!, combatRosterLocked: true } } : {}) };
        for (const unitId of ['unit-1', 'unit-2']) {
          expect(previewEquip(state, 'item-1', unitId, 0).allowed).toBe(true);
          const equipped = accepted(equipItem(freeze(state), 'item-1', unitId, 0));
          unchangedBattle(state, equipped);
          const combined = equipItem(equipped, 'item-2', unitId, 0), result = accepted(combined);
          deepStrictEqual(combined.ok && combined.events.map(e => e.type), ['itemCombined', 'itemEquipped']);
          deepStrictEqual(result.items, [held('item-3', 'giant-slayer', unitId)]);
          expect(result.nextItemSerial).toBe(4); unchangedBattle(equipped, result);
        }
        expect(previewCombine(state, 'item-1', 'item-2').allowed).toBe(true);
        unchangedBattle(state, accepted(combineItems(state, 'item-1', 'item-2')));
        rejected(state, s => equipItem(s, 'item-1', 'enemy-or-mirror-or-summon', 0), 'unknown-unit');
        rejected({ ...state, phase: 'gameOver', combat: null }, s => equipItem(s, 'item-1', 'unit-1', 0), 'wrong-phase');
        if (online) rejected({ ...state, multiplayer: { ...multiplayer!, status: 'eliminated' } },
          s => combineItems(s, 'item-1', 'item-2'), 'wrong-phase');
        if (!online && phase !== 'preparation') {
          for (const call of [buyXp, rerollShop, s => buyUnit(s, 0, s.shop.generation),
            s => sellUnit(s, 'unit-2'), s => setShopLock(s, true, s.shop.generation),
            s => deployMatchUnit(s, 'unit-2', board(1))] as ((s: MatchState) => MatchCommandResult)[])
            rejected(state, call, 'wrong-phase');
        }
      });
    }
  }
});

describe('T12 in-place recipes and atomic failures', () => {
  // Explicit nine original vectors, independent of the production recipe lookup.
  const recipes = [
    ['sword','sword','deathblade'], ['rod','rod','deathcap'], ['bow','bow','red-buff'],
    ['sword','rod','gunblade'], ['sword','bow','giant-slayer'], ['rod','bow','rageblade'],
    ['tear','tear','blue-buff'], ['vest','vest','bramble-vest'], ['gloves','gloves','thiefs-gloves'],
  ];
  it.each(recipes)('%s + worn %s yields %s with one permanent ID', (incoming, worn, resultId) => {
    const state = { ...prepared(), items: [stock('item-1', incoming), held('item-2', worn, 'unit-1', 2)] };
    const preview = previewEquip(freeze(state), 'item-1', 'unit-1', 2);
    expect(preview).toMatchObject({ allowed: true, combination: { resultDefinitionId: resultId } });
    const command = equipItem(state, 'item-1', 'unit-1', 2), next = accepted(command);
    deepStrictEqual(next.items, [held('item-3', resultId, 'unit-1', resultId === 'thiefs-gloves' ? 0 : 2)]);
    deepStrictEqual(command.ok && command.events.slice(0, 2).map(e => e.type), ['itemCombined','itemEquipped']);
    expect(next.nextItemSerial).toBe(state.nextItemSerial + 1);
    expect(next.nextMatchEventSeq).toBe(state.nextMatchEventSeq + (command.ok ? command.events.length : 0));
    if (resultId === 'thiefs-gloves') {
      expect(next.equipmentState.rolls).toHaveLength(1); expect(next.temporaryEquipment).toHaveLength(2);
      deepStrictEqual(command.ok && command.events.map(e => e.type), ['itemCombined','itemEquipped','equipmentRolled','temporaryEquipmentChanged']);
    } else expect(next.equipmentState).toBe(state.equipmentState);
    unchangedBattle(state, next);
  });
  it('also accepts every current ordinary recipe with a full final three-slot set', () => {
    for (const definition of Object.values(ITEM_DEFINITIONS).filter(d => d.recipe && d.slotCost !== 3)) {
      const state = { ...prepared(), nextItemSerial: 5, items: [stock('item-1', definition.recipe![0]),
        held('item-2', definition.recipe![1], 'unit-1', 1), held('item-3','deathblade'), held('item-4','deathcap','unit-1',2)] };
      const next = accepted(equipItem(state, 'item-1', 'unit-1', 1));
      deepStrictEqual(next.items.find(i => i.id === 'item-5'), held('item-5', definition.id, 'unit-1', 1));
      expect(next.items).toHaveLength(3);
    }
  });
  it('retains ownership, slot, unique and exclusive failures without a resource/ID/RNG/event change', () => {
    const base = prepared();
    rejected(base, s => equipItem(s,'missing','unit-1',0), 'unknown-item');
    rejected(base, s => equipItem(s,'item-1','missing',0), 'unknown-unit');
    rejected(base, s => equipItem(s,'item-1',s.preparation.units.find(u => u.team === 'enemy')!.id,0), 'unknown-unit');
    rejected(base, s => equipItem(s,'item-1','unit-1',3), 'invalid-slot');
    rejected(base, s => combineItems(s,'item-1','item-1'), 'same-item');
    const equipped = accepted(equipItem(base,'item-1','unit-1',0));
    rejected(equipped, s => equipItem(s,'item-1','unit-2',0), 'item-not-inventory');
    rejected(equipped, s => combineItems(s,'item-1','item-2'), 'item-not-inventory');
    rejected({...base,items:[stock('item-1','sword'),held('item-2','deathblade')]}, s=>equipItem(s,'item-1','unit-1',0),'item-slot-occupied');
    rejected({...base,items:[stock('item-1','deathblade'),stock('item-2','sword')]}, s=>combineItems(s,'item-1','item-2'),'invalid-recipe');
    rejected({...base,items:[stock('item-1','deathblade'),held('item-2','sword')]}, s=>equipItem(s,'item-1','unit-1',0),'invalid-recipe');
    rejected({...base,nextItemSerial:4,items:[stock('item-1','gloves'),held('item-2','gloves'),held('item-3','sword','unit-1',1)]},
      s=>equipItem(s,'item-1','unit-1',0),'exclusive-slots');
    rejected({...base,nextItemSerial:4,items:[stock('item-1','tear'),held('item-2','tear'),held('item-3','blue-buff','unit-1',1)]},
      s=>equipItem(s,'item-1','unit-1',0),'unique-conflict');
    const tg = accepted(equipItem({...base,items:[stock('item-1','thiefs-gloves'),stock('item-2','sword')]},'item-1','unit-1',0));
    rejected(tg,s=>equipItem(s,tg.temporaryEquipment[0].temporaryId,'unit-2',0),'temporary-item');
    rejected(tg,s=>equipItem(s,'item-2','unit-1',1),'exclusive-slots');
  });
});

// Cache independent public setup; the case still executes all combat/restore assertions.
const roundFixtures = new Map<string, MatchState>();
for (const roundId of ['3-5', '3-7']) for (const pair of [['sword', 'rod'], ['gloves', 'gloves']]) {
  beforeAll(() => { atRound(publicInventory(pair).state, roundId); });
}
beforeAll(() => { atRound(publicInventory(['sword', 'sword']).state, '3-6'); });
beforeAll(() => { publicInventory(['thiefs-gloves', 'gloves', 'gloves']); });
function atRound(input: MatchState, roundId: string): MatchState {
  const key = JSON.stringify([input, roundId]);
  let state = roundFixtures.get(key) ?? input;
  for (let budget = 0; state.roundDefinitionId !== roundId && budget < 40; budget++) {
    state = resolvePublicEquipmentChoices(state);
    if (state.phase === 'preparation') state = finishPublicEquipmentBattle(state);
    state = resolvePublicEquipmentChoices(state);
    state = accepted(nextRound(state, state.round));
  }
  expect(state.roundDefinitionId).toBe(roundId);
  state = resolvePublicEquipmentChoices(state);
  roundFixtures.set(key, freeze(state));
  return state;
}
function restored(state: MatchState): MatchState {
  const value = restoreMatch(serializeMatch(freeze(state)));
  deepStrictEqual(value, state); return value;
}
function compareTicks(initial: MatchState, changed: MatchState) {
  let a = initial, b = changed, resume = restored(changed), budget = 1201;
  while (a.phase === 'combat' && budget-- > 0) {
    const x = stepMatch(a), y = stepMatch(b), z = stepMatch(resume);
    deepStrictEqual(z, y);
    expect(JSON.stringify(y.state.combat)).toBe(JSON.stringify(x.state.combat));
    deepStrictEqual(y.events.filter(e => e.domain === 'combat'), x.events.filter(e => e.domain === 'combat'));
    a = x.state; b = y.state; resume = z.state;
  }
  expect(budget).toBeGreaterThan(0); restored(b); return b;
}

describe('T12 real offline provenance and frozen combat', () => {
  for (const roundId of ['3-5','3-7']) for (const pair of [['sword','rod'],['gloves','gloves']]) {
    it(`${roundId} ${pair.join('+')}: consumed frozen component survives restoration; every tick is unchanged`, () => {
      const acquired = publicInventory(pair);
      let state = atRound(acquired.state, roundId);
      state = accepted(deployMatchUnit(state, 'unit-1', board(3)));
      state = accepted(equipItem(state, acquired.itemIds[0], 'unit-1', 2));
      restored(state);
      const start = accepted(startMatchCombat(state));
      expect(start.phase).toBe('combat');
      const changed = accepted(equipItem(start, acquired.itemIds[1], 'unit-1', 0));
      unchangedBattle(start, changed);
      expect(changed.items.some(item => item.id === acquired.itemIds[0])).toBe(false);
      expect(changed.combatInputBasis!.inputs.items.some(item => item.id === acquired.itemIds[0])).toBe(true);
      const end = compareTicks(start, changed);
      expect(end.items.some(item => item.definitionId === (pair[0] === 'gloves' ? 'thiefs-gloves' : 'gunblade'))).toBe(true);
      const corrupt = structuredClone(changed);
      Object.assign(corrupt.resourceProvenance.entries.at(-1)!.kind === 'item-combined' ?
        (corrupt.resourceProvenance.entries.at(-1)! as {event: object}).event : {}, {definitionId:'deathblade'});
      expect(()=>restoreMatch(corrupt)).toThrow(/combination/);
    });
  }
  it('running restore rejects free detachment, cross-unit combining, non-equipment mutation and illegal suffixes', () => {
    const acquired = publicInventory(['sword','rod']);
    let state = accepted(deployMatchUnit(acquired.state,'unit-1',board(3)));
    state = accepted(equipItem(state,acquired.itemIds[0],'unit-1',0));
    const start = accepted(startMatchCombat(state));
    const detached = structuredClone(start);
    Object.assign(detached.items.find(i=>i.id===acquired.itemIds[0])!,{location:{kind:'inventory'}});
    expect(()=>restoreMatch(detached)).toThrow(/equipment projection/);
    const deployed = structuredClone(start);
    Object.assign(deployed.preparation.units.find(u=>u.id==='unit-1')!,{location:{kind:'board',cell:{col:2,row:4}}});
    expect(()=>restoreMatch(deployed)).toThrow(/running input mutation/);
    const changed = accepted(equipItem(start,acquired.itemIds[1],'unit-1',0));
    const badPrefix = structuredClone(changed);
    Object.assign(badPrefix.combatInputBasis!,{provenancePrefixLength:badPrefix.resourceProvenance.entries.length});
    expect(()=>restoreMatch(badPrefix)).toThrow();
  });
});

describe('T12 shared wrappers and PvP frozen descriptors', () => {
  it('online PvE equipment commands conserve pool holdings and failed transactions retain both references', () => {
    const setup = room(undefined,1);
    let state: MatchState = {...setup.states[0],items:[stock('item-1','gloves'),held('item-2','gloves')],nextItemSerial:3};
    let result = accept(runSharedMatchCommand(setup.pool,state,{type:'startCombat'}));
    const poolBefore = structuredClone(result.pool);
    state = result.state;
    const command = equipItem(state,'item-1','unit-1',0);
    expect(command.ok).toBe(true); if (!command.ok) throw new Error(command.reason);
    // Existing room wiring commits equip/combine as plain Match commands with the same pool.
    result = {...result,state:command.state,events:command.events};
    expect(result.state.combatInputBasis).toBe(state.combatInputBasis);
    expect(result.state.combat).toBe(state.combat);
    deepStrictEqual(result.pool.available, poolBefore.available);
    deepStrictEqual(result.pool.holdings, poolBefore.holdings);
    deepStrictEqual(result.pool.shops, poolBefore.shops); deepStrictEqual(result.pool.pending, poolBefore.pending);
    deepStrictEqual(result.events.map(e=>e.type), ['itemCombined','itemEquipped','equipmentRolled','temporaryEquipmentChanged']);
    conserved(result.pool,[result.state]);
    rejected(result.state,s=>equipItem(s,'missing','unit-1',0),'unknown-item');
    deepStrictEqual(result.pool, poolBefore);
  });
  it('locked live-seat in-place combination preserves both sides and mirror frozen result byte-for-byte', () => {
    const acquired = publicInventory(['gloves','gloves']);
    let live = accepted(deployMatchUnit(acquired.state,'unit-1',board(3)));
    live = accepted(equipItem(live,acquired.itemIds[0],'unit-1',0));
    live = accepted(enableMultiplayerSettlement(live,'A'));
    const a = snapshotForBattle(live,'A'), b = {...snapshotForBattle(live,'B'),seatId:'B'};
    const original = JSON.stringify({a,b});
    const inputs = [undefined, 'B'].map(mirrorOfSeatId=>compileBattle(a,b,123,
      {battleId:mirrorOfSeatId ? 't12-mirror' : 't12-real',...(mirrorOfSeatId ? {mirrorOfSeatId} : {})}));
    const expected = inputs.map(input=>JSON.stringify(resolveTwoSidedBattle(input,1201)));
    live = accepted(lockMatchCombatRoster(live));
    live = accepted(equipItem(live,acquired.itemIds[1],'unit-1',0));
    expect(()=>snapshotForBattle(live,'A')).toThrow(/wrong-phase/);
    expect(JSON.stringify({a,b})).toBe(original);
    deepStrictEqual(restorePlayerBattleSnapshot(JSON.stringify(a)), a);
    inputs.forEach((input,i)=>expect(JSON.stringify(resolveTwoSidedBattle(restoreBattleInput(JSON.stringify(input)),1201))).toBe(expected[i]));
    expect(live.items.some(i=>i.definitionId==='thiefs-gloves')).toBe(true);
  });
});


describe('T12 public saves across equipment phases', () => {
  for (const roundId of ['3-5', '3-7']) for (const phase of ['preparation', 'settlement'] as const) {
    it(`${roundId} ${phase}: equip and in-place combine restore and continue identically`, () => {
      const acquired = publicInventory(['gloves', 'gloves']);
      let state = atRound(acquired.state, roundId);
      if (phase === 'settlement') state = resolvePublicEquipmentChoices(finishPublicEquipmentBattle(state));
      state = accepted(equipItem(state, acquired.itemIds[0], 'unit-1', 0));
      restored(state);
      state = accepted(equipItem(state, acquired.itemIds[1], 'unit-1', 1));
      const copy = restored(state);
      deepStrictEqual(phase === 'preparation' ? startMatchCombat(copy) : nextRound(copy, copy.round), phase === 'preparation' ? startMatchCombat(state) : nextRound(state, state.round));
    });
  }
  it('augment choice and supply choice retain offers while equipment saves resume', () => {
    let state = createMatch(42);
    for (const component of [null, 'sword', 'rod']) {
      for (const [i,unit] of state.preparation.units.filter(u => u.team === 'player').entries())
        state = accepted(deployMatchUnit(state,unit.id,{kind:'board',cell:{col:i*2+1,row:7}}));
      state = finishPublicEquipmentBattle(state);
      if (component) state = resolvePublicEquipmentChoices(state,component);
      state = accepted(nextRound(state,state.round));
    }
    expect(state.phase).toBe('choice'); expect(state.pendingChoice!.kind).toBe('augment');
    for (const target of ['2-1','2-4']) {
      if (target === '2-4') {
        state = resolvePublicEquipmentChoices(state);
        while (state.roundDefinitionId !== '2-4') state = accepted(nextRound(resolvePublicEquipmentChoices(finishPublicEquipmentBattle(state)),state.round));
      }
      expect(state.phase).toBe('choice');
      const ids = state.items.filter(i=>i.location.kind==='inventory').map(i=>i.id);
      if (target === '2-1') {
        const choice = state.pendingChoice;
        state = accepted(equipItem(state,ids[0],'unit-1',0)); restored(state);
        state = accepted(equipItem(state,ids[1],'unit-1',1)); restored(state);
        expect(state.pendingChoice).toBe(choice);
      } else {
        // The existing completed item remains equipped through the supply choice.
        restored(state);
      }
      const c = state.pendingChoice!;
      deepStrictEqual(selectChoice(restored(state),c.choiceId,c.generation,c.offers[0]), selectChoice(state,c.choiceId,c.generation,c.offers[0]));
    }
  });
  it('PvE settlement permits in-place combination and preserves direct grant order on restore', () => {
    const acquired = publicInventory(['sword','rod']);
    let state = atRound(acquired.state,'3-7');
    state = accepted(deployMatchUnit(state,'unit-1',board(3)));
    state = finishPublicEquipmentBattle(state);
    expect(state.phase).toBe('settlement');expect(state.pendingChoice).toBeNull();
    const choice = state.pendingChoice;
    state = accepted(equipItem(state,acquired.itemIds[0],'unit-1',0)); restored(state);
    state = accepted(equipItem(state,acquired.itemIds[1],'unit-1',1)); restored(state);
    expect(state.pendingChoice).toBe(choice);
    deepStrictEqual(resolvePublicEquipmentChoices(restored(state)), resolvePublicEquipmentChoices(state));
  });
  it('rejects the T11 digest without migration', () => {
    expect(()=>restoreMatch({...createMatch(42),contentDigest:'fnv1a32-utf16:b4a5c2e2'})).toThrow(/content-digest/);
  });
});


describe('T12 latest assets survive death, settlement and upgrades', () => {
  it('a permanent unit killed in this combat can equip; next battle uses the new stats', () => {
    const acquired = publicInventory(['sword','sword']);
    let state = atRound(acquired.state,'3-6');
    for (const [i,u] of state.preparation.units.filter(u=>u.team==='player').slice(0,state.level).entries())
      state = accepted(deployMatchUnit(state,u.id,{kind:'board',cell:{col:i%7,row:i===0?4:7}}));
    state = accepted(startMatchCombat(state));
    let budget=1201;
    while(state.phase==='combat' && !state.combat!.units.some(u=>u.team==='player'&&u.hp===0) && budget-->0) state=stepMatch(state).state;
    expect(state.phase).toBe('combat');
    const dead=state.combat!.units.find(u=>u.team==='player'&&u.hp===0)!;
    expect(dead).toBeDefined();
    let changed=accepted(equipItem(state,acquired.itemIds[0],dead.id,0));
    changed=accepted(equipItem(changed,acquired.itemIds[1],dead.id,0));
    expect(changed.combat!.units.find(u=>u.id===dead.id)!.hp).toBe(0);
    const end=compareTicks(state,changed);
    const next=resolvePublicEquipmentChoices(accepted(nextRound(resolvePublicEquipmentChoices(end),end.round)));
    const started=accepted(startMatchCombat(next));
    expect(started.combat!.units.find(u=>u.id===dead.id)!.attackDamage).toBeGreaterThan(dead.attackDamage);
  });
  for(const kind of ['pve','pvp']) it(`${kind}: latest board/bench gear migrates after deferred merge, frozen rewards commit once`,()=>{
    const setup=room({irelia:20},1);
    let r=accept(generateSharedShop(setup.pool,{...setup.states[0],gold:100,items:[stock('item-1','sword'),stock('item-2','rod'),stock('item-3','bow')],nextItemSerial:4},0));
    if(kind==='pvp') {
      const catalog=catalogPreparation('2-1');
      r={...r,state:{...r.state,round:4,roundDefinitionId:'2-1',m8:catalog.m8,
        roundResults:Array.from({length:3},(_,i)=>({...r.state.roundResults[0],round:i+1})),
        preparation:{...r.state.preparation,units:r.state.preparation.units.filter(u=>u.team==='player')}}};
    }
    const bound=syntheticSharedRound(r.pool,[r.state],r.state.round);r={...r,pool:bound.pool,state:bound.states[0]};
    const snap=snapshotForBattle(r.state,r.state.multiplayer!.seatId);
    const restoredSnap=restorePlayerBattleSnapshot(JSON.stringify(snap));
    expect(JSON.stringify(restoredSnap)).toBe(JSON.stringify(snap));
    const input=kind==='pvp'?compileBattle(snap,{...snap,seatId:'opponent'},42,{battleId:'t12-settle'}):null;
    const result=input?resolveTwoSidedBattle(restoreBattleInput(JSON.stringify(input)),1201):null;
    r=kind==='pve'?accept(runSharedMatchCommand(r.pool,r.state,{type:'startCombat'})):{...r,state:accepted(lockMatchCombatRoster(r.state))};
    const frozenCombat=r.state.combat, frozenBasis=r.state.combatInputBasis;
    for(const slot of [0,1]) r=accept(buySharedUnit(r.pool,r.state,slot,r.state.shop.generation));
    r={...r,state:accepted(equipItem(r.state,'item-1','unit-2',0))};
    r={...r,state:accepted(equipItem(r.state,'item-2','unit-2',0))};
    r={...r,state:accepted(equipItem(r.state,'item-3','unit-1',1))};
    expect(r.state.combat).toBe(frozenCombat);expect(r.state.combatInputBasis).toBe(frozenBasis);
    deepStrictEqual(restorePlayerBattleSnapshot(JSON.stringify(snap)), snap);
    if(result){
      deepStrictEqual(resolveTwoSidedBattle(restoreBattleInput(JSON.stringify(input)),1201), result);
      const {events: _events,...proposal}=proposeSettlement(result).a;
      const receipt: RoundSettlementReceipt={...proposal,version:ROUND_SETTLEMENT_VERSION,settlementId:'t12:settle',battleId:result.battleId,
        round:4,roundId:'2-1',combatTicks:result.terminal.tick,combatEventCount:result.events.length};
      r=accept(runSharedMatchCommand(r.pool,r.state,{type:'settleRound',receipt}));
      deepStrictEqual(applyRoundSettlement(r.state,receipt), {ok:false,state:r.state,reason:'duplicate-settlement'});
    } else {
      let budget=1201;
      while(r.state.phase==='combat'&&budget-->0) r=accept(runSharedMatchCommand(r.pool,r.state,{type:'step'}));
      expect(budget).toBeGreaterThan(0);
      deepStrictEqual(stepMatch(r.state), {state:r.state,events:[]});
    }
    expect(r.state.preparation.units.find(u=>u.id==='unit-1')!.starLevel).toBe(2);
    deepStrictEqual(r.state.items.find(i=>i.definitionId==='gunblade')!.location, {kind:'unit',unitId:'unit-1',slot:0});
    deepStrictEqual(r.state.items.find(i=>i.id==='item-3')!.location, {kind:'unit',unitId:'unit-1',slot:1});
    conserved(r.pool,[r.state]);
  });
});


it('T12 supply choice permits fresh component transactions and single-save continuation',()=>{
  const acquired=publicInventory(['gloves','gloves'],false,9);let state=acquired.state;
  while(state.roundDefinitionId!=='4-4')state=accepted(nextRound(resolvePublicEquipmentChoices(finishPublicEquipmentBattle(resolvePublicEquipmentChoices(state))),state.round));
  expect(state.pendingChoice!.kind).toBe('component');
  state=accepted(equipItem(state,acquired.itemIds[0],'unit-1',0));restored(state);
  state=accepted(equipItem(state,acquired.itemIds[1],'unit-1',1));
  deepStrictEqual(resolvePublicEquipmentChoices(restored(state)), resolvePublicEquipmentChoices(state));
});
it('T12 an existing frozen glove roll and a new parent roll remain independent',()=>{
  const acquired=publicInventory(['thiefs-gloves','gloves','gloves']);
  let state=accepted(deployMatchUnit(acquired.state,'unit-1',board(3)));
  state=accepted(equipItem(state,acquired.itemIds[0],'unit-1',0));
  const start=accepted(startMatchCombat(state)),roll=start.equipmentState.rolls.at(-1);
  let changed=accepted(equipItem(start,acquired.itemIds[1],'unit-2',0));
  changed=accepted(equipItem(changed,acquired.itemIds[2],'unit-2',0));
  expect(changed.equipmentState.rolls).toHaveLength(start.equipmentState.rolls.length+1);
  deepStrictEqual(changed.equipmentState.rolls[start.equipmentState.rolls.length-1], roll);
  const before=JSON.stringify(changed);
  for(let n=0;n<3;n++){previewEquip(changed,changed.items[0].id,'unit-1',0);restored(changed);}
  expect(JSON.stringify(changed)).toBe(before);compareTicks(start,changed);
});
it('T12 online PvE restores the frozen player descriptor and keeps every live-seat combat tick unchanged',()=>{
  const acquired=publicInventory(['sword','rod']);
  let prep=atRound(acquired.state,'3-7');
  prep=accepted(deployMatchUnit(prep,'unit-1',board(3)));
  prep=accepted(equipItem(prep,acquired.itemIds[0],'unit-1',0));
  prep=accepted(enableMultiplayerSettlement(prep,'A'));
  const snapshot=snapshotForBattle(prep,'A'), frozen=restorePlayerBattleSnapshot(JSON.stringify(snapshot));
  // PvE uses the catalog encounter, not compileBattle (which is PvP-only).
  const frozenPrep={...prep,items:[...prep.items.filter(i=>i.location.kind==='inventory'),...frozen.items].sort((a,b)=>a.id.localeCompare(b.id)),
    preparation:{...prep.preparation,units:prep.preparation.units.map(u=>frozen.units.find(x=>x.id===u.id)??u)}};
  let control=accepted(startMatchCombat(prep));
  const rebuilt=accepted(startMatchCombat(frozenPrep));
  deepStrictEqual(rebuilt.combat, control.combat);
  let changed=accepted(equipItem(control,acquired.itemIds[1],'unit-1',0));
  let budget=1201;
  while(control.phase==='combat'&&budget-->0){
    const x=stepMatch(control),y=stepMatch(changed);
    expect(JSON.stringify(y.state.combat)).toBe(JSON.stringify(x.state.combat));
    deepStrictEqual(y.events.filter(e=>e.domain==='combat'), x.events.filter(e=>e.domain==='combat'));control=x.state;changed=y.state;
  }
  expect(budget).toBeGreaterThan(0);expect(changed.items.some(i=>i.definitionId==='gunblade')).toBe(true);
  deepStrictEqual(changed.roundResults, control.roundResults);
});

it('T12 restore rejects a fabricated cross-unit recipe although births and recipe are valid',()=>{
  const acquired=publicInventory(['sword','rod']);
  const first=accepted(equipItem(acquired.state,acquired.itemIds[0],'unit-1',0));
  const base=accepted(deployMatchUnit(first,'unit-1',board(3)));
  const stockStart=accepted(startMatchCombat(base));
  const legal=accepted(equipItem(stockStart,acquired.itemIds[1],'unit-1',0));
  const heldStart=accepted(startMatchCombat(accepted(equipItem(base,acquired.itemIds[1],base.preparation.units.find(u=>u.team==='player'&&u.id!=='unit-1')!.id,0))));
  // Equipment placements are ordered facts, so the forged save also carries the held placement before the combat-time combination.
  const combinedFact=legal.resourceProvenance.entries.at(-1)!; expect(combinedFact.kind).toBe('item-combined');
  const resourceProvenance={...heldStart.resourceProvenance,entries:[...heldStart.resourceProvenance.entries,{...combinedFact,sequence:heldStart.resourceProvenance.entries.length}]};
  const forged={...legal,combat:heldStart.combat,combatInputBasis:heldStart.combatInputBasis,resourceProvenance};
  expect(()=>restoreMatch(forged)).toThrow(/combination requires inventory input/);
});
