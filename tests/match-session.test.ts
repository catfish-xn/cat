import { deferredRoundIncome } from '../src/simulation/deferred-income';
import { G23_CATALOG as G2_CATALOG } from './fixtures/g2-3-roster';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { describe, expect, it } from 'vitest';
import { MatchSession } from '../src/rendering/match-session';
import { createCombatWithEvents, type CombatEvent } from '../src/simulation/combat';
import { createMatch, deployMatchUnit, nextRound, startMatchCombat, type MatchCommandResult, type MatchState } from '../src/simulation/match';
import { readyMatch, emptyBoard, accepted, reachRound, purchasedThreeHeroMatch } from './match-helpers';
import { withB1Offers } from './fixtures/b1-scripted-offers';
import { settlement } from './fixtures/m5/oracle.g2.cjs';
import { nextRandom } from '../src/simulation/rng';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';
import { freezeLootThroughRound } from '../src/simulation/loot-freeze';
import {lootPlan} from './fixtures/orb-combo-oracle.cjs';

// Seed 7216: opening Irelia casts/shields; the v17 first-round silver box grants Nami.
function preparation(): MatchState {
  return deployMatchUnit(readyMatch(7216), 'unit-1', { kind: 'board', cell: { col: 2, row: 7 } }).state;
}
const players = (state: MatchState) => state.preparation.units.filter(unit => unit.team === 'player');
// Independent v17 box oracle; these vectors have one first-round hero and none in 1-3.
function expectOpeningHeroSource(session:MatchSession,roundId:'1-2'|'1-3') {
 const rounds=lootPlan(session.state.seed,roundId==='1-2'?1:2).rounds;
 const expected=rounds.flatMap(r=>r.encounterPlan.drops).filter(d=>d.payload.kind==='unit');
 const receipts=session.state.m8.loot.receipts.filter(r=>r.payload.kind==='unit');
 expect(receipts.map(r=>[r.dropId,r.payload])).toEqual(expected.map(d=>[d.dropId,d.payload]));
 for(const d of expected.filter(d=>d.roundId===roundId)){
  const receipt=receipts.find(r=>r.dropId===d.dropId)!;
  if(session.state.roundDefinitionId!==roundId)continue;
  const deaths=session.combatEvents.filter(e=>e.type==='death'&&e.unitId===d.sourceUnitId);expect(deaths).toHaveLength(1);
  expect(session.state.m8.loot.earnedEvidence.filter(e=>e.dropId===d.dropId)).toEqual([{dropId:d.dropId,death:{combatId:roundId==='1-2'?'round-1':'round-2',tick:deaths[0].tick,eventSeq:deaths[0].eventSeq}}]);
  expect(session.state.resourceProvenance.entries.filter(e=>e.kind==='unit-acquired'&&e.source.kind==='loot'&&e.source.receiptId===receipt.receiptId)).toEqual([expect.objectContaining({roundId,kind:'unit-acquired',unitId:receipt.grantedUnitIds[0],source:{kind:'loot',receiptId:receipt.receiptId}})]);
 }
}

function rejected(session: MatchSession, result: MatchCommandResult, reason: string, before: MatchState) {
  expect(result).toEqual({ ok: false, state: before, reason });
  expect(result.state).toBe(before); expect(session.state).toBe(before);
}
function resolveSessionChoices(session: MatchSession, priorities:readonly string[]=[]): void {
  while (session.phase === 'choice') {
    const choice = session.state.pendingChoice!;
    const result = choice.step === 'target'
      ? session.anomalyTarget(choice.choiceId, choice.generation, players(session.state)[0].id)
      : session.choose(choice.choiceId, choice.generation, priorities.find(id=>choice.offers.includes(id))??choice.offers[0]);
    expect(result.ok).toBe(true);
  }
}

it.each([7216,6240])('seed %i opening follows the independent v17 box oracle',seed=>{
 const ledger=freezeLootThroughRound(seed,2);expect(ledger.rounds).toEqual(lootPlan(seed,2).rounds);expect(ledger.rng).toEqual({state:(seed^0xdeadbeef)>>>0,draws:0});
});

describe('match session commands and fixed clock', () => {
  it('locks all preparation commands including F throughout combat and settlement', () => {
    const session = new MatchSession(preparation());
    expect(session.start().ok).toBe(true);
    for (const phase of ['combat', 'settlement']) {
      expect(session.phase).toBe(phase);
      const before = session.state;
      for (const result of [session.start(), session.deploy('unit-1', { kind: 'bench', slot: 0 }),
        session.buy(0, before.shop.generation), session.sell('unit-1'), session.reroll(), session.buyXp()]) {
        rejected(session, result, 'wrong-phase', before);
      }
      session.advance(60_000);
    }
    const settled = session.state;
    expect(session.advance(500)).toEqual([]); expect(session.state).toBe(settled);
    expect(settled.roundResults).toHaveLength(1); expect(settled.roundResults[0]).toEqual(settlement(preparation(),settled.combat));
    expect(settled.xp).toBe(0);
    expect(settled.roundResults[0].combatEventCount).toBe(session.combatEvents.length);
    expect(session.combatEvents.map(event => event.eventSeq)).toEqual(session.combatEvents.map((_, i) => i));
  });

  it('Continue preserves player stars/positions while resetting combat Mana, shield and partial clock', () => {
    const prep = preparation(), original = structuredClone(prep), session = new MatchSession(prep), before = structuredClone(players(prep));
    // B8: preserve every original hero and independently add only the approved one-star bench grant.
    const firstRoster = [...before, { id: 'unit-2', definitionId: 'nami', team: 'player', starLevel: 1, location: { kind: 'bench', slot: 0 } }];
    expect(session.continue(1).ok).toBe(false);
    expect(session.start().ok).toBe(true); const firstBasis = session.state.combatInputBasis;
    session.advance(60_025);
    expect(session.combat?.units.some(unit => !unit.alive)).toBe(true);
    expect(session.combat?.units.some(unit => unit.hp < unit.maxHp)).toBe(true);
    expect(players(session.state)).toEqual(firstRoster);
    expectOpeningHeroSource(session,'1-2');expectOpeningHeroSource(session, '1-2');
    expect(session.state.nextUnitSerial).toBe(3);expect(session.state.combatInputBasis).toEqual(firstBasis);
    expect(session.combat?.units.filter(unit => unit.team === 'player').map(unit => unit.id)).toEqual(['unit-1']);
    expect(session.continue(1).ok).toBe(true);
    expect(session.phase).toBe('preparation');
    expect(session.advance(1000)).toEqual([]);
    resolveSessionChoices(session);
    expect(session.phase).toBe('preparation'); expect(session.combat).toBeNull();
    expect(players(session.state)).toEqual(firstRoster);
    expectOpeningHeroSource(session,'1-2');expect(session.state.nextUnitSerial).toBe(3);
    expect(session.advance(1000)).toEqual([]);
    expect(session.deploy('unit-1', { kind: 'board', cell: { col: 4, row: 6 } }).ok).toBe(true);
    const secondPreparation = session.state, secondBefore = structuredClone(secondPreparation);
    const secondRoster = [...before.map(unit => ({ ...unit, location: { kind: 'board', cell: { col: 4, row: 6 } } })), firstRoster[1]];
    expect(players(session.state)).toEqual(secondRoster);
    const secondInitial = createCombatWithEvents(session.state.preparation, buildStrategySnapshot(session.state), 'round-2', nextRandom(session.state.battleSeedRngState).word).state;
    expect(session.start().ok).toBe(true); const secondBasis = session.state.combatInputBasis;
    expect(session.combat).toEqual(secondInitial);
    expect(session.combat?.units.every(unit => unit.hp === unit.maxHp && unit.alive && unit.targetId === null
      && unit.cooldownTicks === 0 && unit.moveCooldownTicks === 0)).toBe(true);
    expect(session.combat?.units.find(unit => unit.id === 'unit-1')?.cell).toEqual({ col: 4, row: 6 });
    expect(session.advance(25)).toEqual([]); expect(session.combat?.tick).toBe(0);
    session.advance(25); expect(session.combat?.tick).toBe(1);
    session.advance(60_000);
    const secondSettledRoster = secondRoster;
    expect(players(session.state)).toEqual(secondSettledRoster);expectOpeningHeroSource(session, '1-3');
    expectOpeningHeroSource(session,'1-3');
    expect(session.state.nextUnitSerial).toBe(3);expect(session.state.combatInputBasis).toEqual(secondBasis);
    expect(session.combat?.units.map(unit => unit.id)).toEqual(secondInitial.units.map(unit => unit.id));
    // §18: PvE components are automatic orb entries; only .4 supply opens a pick.
    expect(session.phase).toBe('settlement');
    expect(session.state.pendingChoice).toBeNull();
    expect(session.state.m8.loot.choiceResolutions).toEqual([]);
    expect(session.state.items.map(i=>i.definitionId)).toEqual(['gloves','belt']);
    expect(session.state.consumables).toHaveLength(2);
    expect(players(session.state)).toEqual(secondSettledRoster);
    const resolved = session.state, resolvedBefore = structuredClone(resolved);
    expect(session.continue(2).ok).toBe(true);
    expect(players(session.state)).toEqual(secondSettledRoster);expect(session.combat).toBeNull();
    expect(session.state.m8.loot.receipts).toEqual(resolvedBefore.m8.loot.receipts);expect(session.state.nextUnitSerial).toBe(3);
    expect(resolved).toEqual(resolvedBefore);expect(secondPreparation).toEqual(secondBefore);expect(prep).toEqual(original);expect(players(prep)).toEqual(before);
  });

  it('only advances whole 50 ms ticks and ignores invalid deltas', () => {
    const session = new MatchSession(preparation()); session.start();
    const initial = session.state;
    for (const delta of [-1, NaN, Infinity, -Infinity, 0]) expect(session.advance(delta)).toEqual([]);
    expect(session.state).toBe(initial);
    session.advance(49); expect(session.combat?.tick).toBe(0);
    session.advance(1); expect(session.combat?.tick).toBe(1);
    session.advance(125); expect(session.combat?.tick).toBe(3);
    session.advance(25); expect(session.combat?.tick).toBe(4);
  });

  it('retains every tick, cast, shield, Mana, damage and settlement across frame partitions', () => {
    function run(deltas: number[]) {
      const session = new MatchSession(preparation()), events: CombatEvent[] = [];
      session.start(); for (const delta of deltas) events.push(...session.advance(delta));
      return { state: session.state, events };
    }
    expect(run([13, 7, 75, 5, 900])).toEqual(run(Array(100).fill(10)));
    expect(run([1000])).toEqual(run(Array(20).fill(50)));
    expect(run([60_000])).toEqual(run(Array(1200).fill(50)));
    const completed = run([60_000]);
    expect(completed.state.phase).toBe('settlement');
    // replay2 (M8_RULES §10): the aggregate `damage` event is no longer published; per-packet packetDamage carries the damage.
    expect(completed.events.map(event => event.type)).toEqual(expect.arrayContaining(['cast', 'manaChanged', 'shieldLayerChanged', 'packetDamage']));
    expect(completed.events.some(event => (event.type as string) === 'damage')).toBe(false);
  });

  it.each(['missing-enemy', 'missing-both'] as const)('rejects %s without creating combat or changing state', reason => {
    const prep = preparation();
    const units = reason === 'missing-enemy' ? players(prep) : [];
    const session = new MatchSession({ ...prep, preparation: { ...prep.preparation, units } }), before = session.state;
    expect(session.startFailure).toBe(reason); rejected(session, session.start(), reason, before);
    expect(session.phase).toBe('preparation'); expect(session.combat).toBeNull();
    expect(session.advance(1000)).toEqual([]); expect(session.continue(1).ok).toBe(false);
  });

  it('allows empty deployment to concede and settles tick zero exactly once', () => {
    const session = new MatchSession(emptyBoard());
    expect(session.startFailure).toBeUndefined(); expect(session.start().ok).toBe(true);
    expect(session.phase).toBe('settlement'); expect(session.combat?.tick).toBe(0);
    // Round income is paid at the next round entry (deferred-income.ts).
    expect(session.state).toMatchObject({ gold: 2 - deferredRoundIncome(session.state.roundResults.at(-1)!), playerHp: 98, level:2, xp: 0 });
    const settled = session.state;
    rejected(session, session.start(), 'wrong-phase', settled);
    expect(session.advance(60_000)).toEqual([]); expect(session.state).toBe(settled);
    expect(session.continue(1).ok).toBe(true);
    resolveSessionChoices(session);
    session.deploy('unit-1', { kind: 'board', cell: { col: 2, row: 7 } });
    session.deploy('unit-1', { kind: 'bench', slot: 0 }); session.sell('unit-1');
    expect(session.startFailure).toBeUndefined(); expect(session.start().ok).toBe(true);
    expect(session.state.roundResults).toHaveLength(2);
  });

  it('preserves the purchased player roster and unique results for five rounds', () => withB1Offers(['starry-night'], () => {
    // v24 seed 7226 route; v25 pool scripts Starry Night at 2-1 (augments.toEqual(['starry-night']) is the fixture self-check).
    // v26 PvE loot carryover (8f794062, merge c684c3ec): seed 7226's conceded 1-2 loot now delivers Smeech later, so
    // the roster is no longer purchase-only. 136 is the first seed from 1 on which this exact route acquires no loot hero
    // through round 7 (v25: 7226).
    const session = new MatchSession(reachRound('1-3',true,136));
    expect(session.buy(0, session.state.shop.generation).ok).toBe(true);
    const owned = players(session.state);
    const stale = session.state; rejected(session, session.buy(0, 0), 'stale-shop', stale);
    session.deploy(owned[0].id, { kind: 'board', cell: { col: 2, row: 7 } });
    const preparationBefore = session.state, original = structuredClone(preparationBefore), roster = structuredClone(players(session.state));
    // Concede 1-2; this seed has no heroes in 1-3/1-4, so purchases stay isolated.
    const expectedRoster = roster;
    for (let round = 2; round <= 6; round++) {
      if(session.phase === 'preparation') { expect(session.start().ok).toBe(true); session.advance(60_025); }
      expect(session.state.roundResults.at(-1)!.goldAfter - deferredRoundIncome(session.state.roundResults.at(-1)!)).toBe(session.state.gold);
      expect(session.state.roundResults).toHaveLength(round);
      expect(players(session.state)).toEqual(expectedRoster);
      expect(session.state.m8.loot.receipts.filter(receipt => receipt.payload.kind === 'unit')).toEqual([]);
      if (session.phase === 'choice') {
        const pending = session.state, before = structuredClone(pending);
        rejected(session, session.continue(round), 'wrong-phase', pending);expect(pending).toEqual(before);
        resolveSessionChoices(session,['starry-night']);
      }
      expect(session.phase).toBe('settlement');
      expect(session.continue(round).ok).toBe(true);
      resolveSessionChoices(session,['starry-night']);
      if(session.state.augments.length)expect(session.state.augments.map(a=>a.definitionId)).toEqual(['starry-night']);
      const next = session.state; rejected(session, session.continue(round), next.phase === 'settlement' ? 'stale-round' : 'wrong-phase', next);
      expect(players(session.state)).toEqual(expectedRoster); expect(session.combat).toBeNull();expect(session.state.nextUnitSerial).toBe(3);
    }
    expect(session.state.round).toBe(7); expect(session.state.shop.generation).toBe(7);expect(preparationBefore).toEqual(original);
  }));

  it('F commits synchronously, preserves the shop, and immediately enables another deployment', () => {
    const prepared=accepted(nextRound(accepted(startMatchCombat(emptyBoard(purchasedThreeHeroMatch()))),getCatalogRoundById('2-1').ordinal));
    const session=new MatchSession(prepared);
    const slot=session.state.shop.slots.findIndex(o=>o.status==='available'&&!['irelia','maddie','lux'].includes(o.definitionId));
    expect(session.buy(slot,session.state.shop.generation).ok).toBe(true);
    // v23: seed 5 now opens with Artifact Anvil, whose anvil unit takes a serial; deploy real champions only.
    const heroes=players(session.state).filter(u=>!u.definitionId.startsWith('TFT_')).map(u=>u.id);
    for(let i=1;i<=3;i++) expect(session.deploy(heroes[i-1],{kind:'board',cell:{col:i,row:6}}).ok).toBe(true);
    const capped=session.state;rejected(session,session.deploy(heroes[3],{kind:'board',cell:{col:4,row:7}}),'population-cap',capped);
    const shop=structuredClone(session.state.shop),rng=session.state.rngState,gold=session.state.gold;
    expect(session.buyXp().ok).toBe(true);
    expect(session.state).toMatchObject({level:4,xp:2,gold:gold-4,rngState:rng,shop});
    expect(session.deploy(heroes[3],{kind:'board',cell:{col:4,row:7}}).ok).toBe(true);
  });

  it('returns upgrade events without delaying the next sell or allocating a second purchase', () => {
    const initial = readyMatch();
    const session = new MatchSession({ ...initial, gold:10, nextUnitSerial: 5, preparation:{...initial.preparation,units:[...initial.preparation.units,
      {id:'unit-4',definitionId:'irelia',team:'player',starLevel:1,location:{kind:'bench',slot:0}}]},
      shop: { ...initial.shop, slots: [{ status: 'available', definitionId: 'irelia' }, ...initial.shop.slots.slice(1)] } });
    const result=session.buy(0,1);expect(result.ok).toBe(true);if(!result.ok)throw Error(result.reason);
    expect(result.events).toEqual([{type:'unitUpgraded',survivorId:'unit-1',consumedIds:['unit-4','unit-5'],definitionId:'irelia',fromStar:1,toStar:2,location:{kind:'board',cell:{col:1,row:4}},domain:'match',eventSeq:initial.nextMatchEventSeq}]);
    expect(session.state.nextUnitSerial).toBe(6);expect(players(session.state).find(u=>u.id==='unit-1')?.starLevel).toBe(2);
    expect(session.sell('unit-1').ok).toBe(true);expect(session.state.gold).toBe(12);
    const sold = session.state; rejected(session, session.sell('unit-1'), 'unknown-unit', sold);
  });

  it('Game Over locks every command and New Match clears progression and a partial clock', () => {
    const session = new MatchSession({ ...emptyBoard(), playerHp: 1 });
    session.start(); session.advance(60_025);
    expect(session.phase).toBe('gameOver'); expect(session.state.playerHp).toBe(0);
    const terminal = session.state;
    for (const result of [session.buyXp(), session.reroll(), session.sell('unit-1'), session.buy(0, terminal.shop.generation),
      session.deploy('unit-1', { kind: 'bench', slot: 0 }), session.start(), session.continue(1)]) rejected(session, result, 'wrong-phase', terminal);
    expect(session.advance(60_000)).toEqual([]); expect(session.state).toBe(terminal);
    session.newMatch(); expect(session.state).toEqual(createMatch());
    resolveSessionChoices(session);session.deploy('unit-1', { kind: 'board', cell: { col: 2, row: 7 } }); session.start(); session.advance(49);
    session.newMatch(); resolveSessionChoices(session); session.deploy('unit-1', { kind: 'board', cell: { col: 2, row: 7 } }); session.start();
    expect(session.advance(1)).toEqual([]); expect(session.combat?.tick).toBe(0);
  });
});

describe('rapid D/F/E commands without frame or animation waits', () => {
  const odds: Record<number, number[]> = { 1:[100,0,0,0,0], 2:[100,0,0,0,0], 3: [75,25,0,0,0], 4: [55,30,15,0,0], 5: [45,33,20,2,0] };
  const catalogs = Object.values(G2_CATALOG);
  function referenceShop(initialState: number, level: number) {
    let state = BigInt(initialState);
    const draw = () => (state = (state * 1664525n + 1013904223n) % 4294967296n);
    const slots = Array.from({ length: 5 }, () => {
      const roll = Number(draw() * 100n / 4294967296n); let tier = 0, threshold = odds[level][0];
      while (roll >= threshold) threshold += odds[level][++tier];
      return { status: 'available', definitionId: catalogs[tier][Number(draw() * BigInt(catalogs[tier].length) / 4294967296n)] };
    });
    return { rngState: Number(state), slots };
  }
  function runBurst(seed: number) {
    const created = readyMatch(seed), initial: MatchState = { ...created, gold: 200, preparation: { ...created.preparation, units: created.preparation.units.filter(unit => unit.team === 'enemy') } };
    const original = structuredClone(initial), session = new MatchSession(initial), trace: MatchCommandResult[] = [];
    let gold = 200, level = 1, xp = 0, generation = 1, serial = 2, reference = referenceShop(seed, level);
    function check(result: MatchCommandResult) {
      expect(result.ok).toBe(true); expect(result.state).toBe(session.state);
      expect(session.state).toMatchObject({ gold, level, xp, nextUnitSerial: serial, rngState: reference.rngState, shop: { generation, slots: reference.slots }, phase: 'preparation', combat: null, round: 1, roundResults: [] });
      trace.push(structuredClone(result));
    }
    function reroll() { reference = referenceShop(reference.rngState, level); generation++; gold -= 2; check(session.reroll()); }
    function buyDeploySell(slot: number) {
      const offer = reference.slots[slot], cost = catalogs.findIndex(catalog => (catalog as readonly string[]).includes(offer.definitionId)) + 1, id = `unit-${serial++}`;
      reference.slots[slot] = { status: 'purchased' } as typeof offer;
      gold -= cost; check(session.buy(slot, generation));
      expect(players(session.state)[0]).toMatchObject({ id, location: { kind: 'bench', slot: 0 }, starLevel: 1 });
      check(session.deploy(id, { kind: 'board', cell: { col: 6, row: 6 } }));
      gold += cost; check(session.sell(id));
      const sold = session.state;
      for (let repeat = 0; repeat < 3; repeat++) { const result = session.sell(id); rejected(session, result, 'unknown-unit', sold); trace.push(structuredClone(result)); }
    }
    for (let cycle = 0; cycle < 6; cycle++) {
      reroll(); buyDeploySell(0);
      gold -= 4; xp += 4;
      while (xp >= ({ 1:2, 2:2, 3: 6, 4: 10, 5: 20 } as Record<number, number>)[level]) { xp -= ({ 1:2, 2:2, 3: 6, 4: 10, 5: 20 } as Record<number, number>)[level]; level++; }
      check(session.buyXp()); reroll(); buyDeploySell(4);
    }
    expect(initial).toEqual(original); return { state: session.state, trace };
  }
  it('commits six mixed D/buy/deploy/E/F/D/buy/E cycles with an independent RNG and XP ledger', () => {
    const { state } = runBurst(42);
    expect(state).toMatchObject({ gold: 152, level: 5, xp: 4, nextUnitSerial: 14, shop: { generation: 13 } });
    expect(players(state)).toHaveLength(0);
  });
  it.each(['reroll', 'buyXp'] as const)('preserves the complete state after funds run out for %s', method => {
    const session = new MatchSession({ ...readyMatch(0), gold: method === 'reroll' ? 11 : 9 });
    const successes = method === 'reroll' ? 5 : 2;
    for (let i = 0; i < successes; i++) expect(session[method]().ok).toBe(true);
    const exhausted = session.state;
    for (let i = 0; i < 30; i++) rejected(session, session[method](), 'insufficient-gold', exhausted);
    expect(session.state.gold).toBe(1);
  });
  it('rejects thirty max-level F events without spending or advancing anything', () => {
    const session = new MatchSession({ ...readyMatch(6240), level: 10, xp: 0 }), before = session.state;
    for (let i = 0; i < 30; i++) rejected(session, session.buyXp(), 'max-level', before);
  });
  it('replays all accepted/rejected mixed events and isolates other sessions', () => {
    const first = runBurst(42); runBurst(0); expect(runBurst(42)).toEqual(first);
  });
});
