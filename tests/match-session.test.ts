import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { describe, expect, it } from 'vitest';
import { MatchSession } from '../src/rendering/match-session';
import { createCombatWithEvents, type CombatEvent } from '../src/simulation/combat';
import { createMatch, deployMatchUnit, nextRound, startMatchCombat, type MatchCommandResult, type MatchState } from '../src/simulation/match';
import { readyMatch, emptyBoard, accepted, reachRound, purchasedThreeHeroMatch } from './match-helpers';
import { settlement } from './fixtures/m5/oracle.cjs';
import { nextRandom } from '../src/simulation/rng';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';

function preparation(): MatchState {
  return deployMatchUnit(readyMatch(), 'unit-1', { kind: 'board', cell: { col: 2, row: 7 } }).state;
}
const players = (state: MatchState) => state.preparation.units.filter(unit => unit.team === 'player');
// Independent M8B_LOOT §2 opening transcription: no receipt or unit fields copied from the result.
function openingHeroReceipt(roundId: '1-2' | '1-3') {
  const encounterId = roundId === '1-2' ? 'minions-a-v1' : 'minions-b-v1';
  const sourceUnitId = JSON.stringify(['pve', roundId, encounterId, 'm01']);
  const dropId = JSON.stringify([roundId, encounterId, sourceUnitId, 0]);
  return { receiptId: JSON.stringify([dropId, 'grant']), dropId,
    payload: { kind: 'unit', definitionId: roundId === '1-2' ? 'maddie' : 'lux', quantity: 1 },
    grantedItemIds: [], grantedUnitIds: [roundId === '1-2' ? 'unit-2' : 'unit-3'] };
}
function expectOpeningHeroSource(session: MatchSession, roundId: '1-2' | '1-3') {
  const receipt = openingHeroReceipt(roundId), sourceUnitId = JSON.stringify(['pve', roundId, roundId === '1-2' ? 'minions-a-v1' : 'minions-b-v1', 'm01']);
  expect(session.state.m8.loot.receipts.filter(r => r.dropId === receipt.dropId)).toEqual([receipt]);
  const deaths = session.combatEvents.filter(event => event.type === 'death' && event.unitId === sourceUnitId);
  expect(deaths).toHaveLength(1);
  expect(session.state.m8.loot.earnedEvidence.filter(e => e.dropId === receipt.dropId)).toEqual([
    { dropId: receipt.dropId, death: { combatId: roundId === '1-2' ? 'round-1' : 'round-2', tick: deaths[0].tick, eventSeq: deaths[0].eventSeq } },
  ]);
  expect(session.state.resourceProvenance.entries.filter(e => e.kind === 'unit-acquired' && e.unitId === receipt.grantedUnitIds[0])).toEqual([
    { sequence: roundId === '1-2' ? 1 : 3, roundId, kind: 'unit-acquired', unitId: receipt.grantedUnitIds[0], source: { kind: 'loot', receiptId: receipt.receiptId } },
  ]);
}

function rejected(session: MatchSession, result: MatchCommandResult, reason: string, before: MatchState) {
  expect(result).toEqual({ ok: false, state: before, reason });
  expect(result.state).toBe(before); expect(session.state).toBe(before);
}
function resolveSessionChoices(session: MatchSession): void {
  while (session.phase === 'choice') {
    const choice = session.state.pendingChoice!;
    const result = choice.step === 'target'
      ? session.anomalyTarget(choice.choiceId, choice.generation, players(session.state)[0].id)
      : session.choose(choice.choiceId, choice.generation, choice.offers[0]);
    expect(result.ok).toBe(true);
  }
}

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
    const firstRoster = [...before, { id: 'unit-2', definitionId: 'maddie', team: 'player', starLevel: 1, location: { kind: 'bench', slot: 0 } }];
    expect(session.continue(1).ok).toBe(false);
    expect(session.start().ok).toBe(true); const firstBasis = session.state.combatInputBasis;
    session.advance(60_025);
    expect(session.combat?.units.some(unit => !unit.alive)).toBe(true);
    expect(session.combat?.units.some(unit => unit.hp < unit.maxHp)).toBe(true);
    expect(players(session.state)).toEqual(firstRoster);
    expect(session.state.m8.loot.receipts).toEqual([openingHeroReceipt('1-2')]);expectOpeningHeroSource(session, '1-2');
    expect(session.state.nextUnitSerial).toBe(3);expect(session.state.combatInputBasis).toEqual(firstBasis);
    expect(session.combat?.units.filter(unit => unit.team === 'player').map(unit => unit.id)).toEqual(['unit-1']);
    expect(session.continue(1).ok).toBe(true);
    expect(session.phase).toBe('preparation');
    expect(session.advance(1000)).toEqual([]);
    resolveSessionChoices(session);
    expect(session.phase).toBe('preparation'); expect(session.combat).toBeNull();
    expect(players(session.state)).toEqual(firstRoster);
    expect(session.state.m8.loot.receipts).toEqual([openingHeroReceipt('1-2')]);expect(session.state.nextUnitSerial).toBe(3);
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
    const secondSettledRoster = [...secondRoster, { id: 'unit-3', definitionId: 'lux', team: 'player', starLevel: 1, location: { kind: 'bench', slot: 1 } }];
    expect(players(session.state)).toEqual(secondSettledRoster);expectOpeningHeroSource(session, '1-3');
    expect(session.state.m8.loot.receipts).toEqual([openingHeroReceipt('1-2'), openingHeroReceipt('1-3')]);
    expect(session.state.nextUnitSerial).toBe(4);expect(session.state.combatInputBasis).toEqual(secondBasis);
    expect(session.combat?.units.map(unit => unit.id)).toEqual(secondInitial.units.map(unit => unit.id));
    const pending = session.state, pendingBefore = structuredClone(pending);expect(session.phase).toBe('choice');
    rejected(session, session.continue(2), 'wrong-phase', pending);expect(pending).toEqual(pendingBefore);
    const choiceSource = JSON.stringify(['pve', '1-3', 'minions-b-v1', 'r01']);
    const choiceDropId = JSON.stringify(['1-3', 'minions-b-v1', choiceSource, 0]), choiceId = JSON.stringify(['m8b-loot-choice', choiceDropId]);
    const choiceReceiptId = JSON.stringify([choiceDropId, 'grant']), choiceReceipt = { receiptId: choiceReceiptId, dropId: choiceDropId,
      payload: { kind: 'item', definitionId: 'sword', quantity: 1 }, grantedItemIds: ['item-1'], grantedUnitIds: [] };
    expect(pending.pendingChoice).toEqual({ kind: 'component', step: 'offer', choiceId, eventId: choiceId, generation: 0,
      returnPhase: 'settlement', offers: ['sword', 'vest', 'belt', 'rod', 'cloak', 'bow', 'gloves', 'tear'], targetId: null, rerollCount: 0 });
    const selected = session.choose(choiceId, 0, 'sword');expect(selected.ok).toBe(true);if (!selected.ok) throw Error(selected.reason);
    expect(selected.events).toEqual([
      { type: 'lootGranted', receipt: choiceReceipt, domain: 'match', eventSeq: pending.nextMatchEventSeq },
      { type: 'lootChoiceResolved', dropId: choiceDropId, receiptId: choiceReceiptId, method: 'player-choice', domain: 'match', eventSeq: pending.nextMatchEventSeq + 1 },
      { type: 'choiceSelected', choiceId, definitionId: 'sword', unitId: null, domain: 'match', eventSeq: pending.nextMatchEventSeq + 2 },
    ]);
    expect(session.phase).toBe('settlement');expect(pending).toEqual(pendingBefore);
    expect(session.state.m8.loot.receipts).toEqual([openingHeroReceipt('1-2'), openingHeroReceipt('1-3'), choiceReceipt]);
    expect(session.state.m8.loot.choiceResolutions).toEqual([{ dropId: choiceDropId, receiptId: choiceReceiptId, method: 'player-choice' }]);
    expect(session.state.items).toEqual([{ id: 'item-1', definitionId: 'sword', location: { kind: 'inventory' } }]);
    expect(players(session.state)).toEqual(secondSettledRoster);
    const resolved = session.state, resolvedBefore = structuredClone(resolved);
    expect(session.continue(2).ok).toBe(true);
    expect(players(session.state)).toEqual(secondSettledRoster);expect(session.combat).toBeNull();
    expect(session.state.m8.loot.receipts).toEqual(resolvedBefore.m8.loot.receipts);expect(session.state.nextUnitSerial).toBe(4);
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
    expect(completed.events.map(event => event.type)).toEqual(expect.arrayContaining(['cast', 'manaChanged', 'shieldLayerChanged', 'damage']));
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
    expect(session.state).toMatchObject({ gold: 2, playerHp: 97, level:2, xp: 0 });
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

  it('preserves the purchased player roster and unique results for five rounds', () => {
    const session = new MatchSession(reachRound('1-3'));
    expect(session.buy(0, session.state.shop.generation).ok).toBe(true);
    const owned = players(session.state);
    const stale = session.state; rejected(session, session.buy(0, 0), 'stale-shop', stale);
    session.deploy(owned[0].id, { kind: 'board', cell: { col: 2, row: 7 } });
    const preparationBefore = session.state, original = structuredClone(preparationBefore), roster = structuredClone(players(session.state));
    // This route conceded 1-2 and bought unit-2; 1-3 still grants Lux/unit-3 into the freed bench slot 0.
    const expectedRoster = [...roster, { id: 'unit-3', definitionId: 'lux', team: 'player', starLevel: 1, location: { kind: 'bench', slot: 0 } }];
    for (let round = 2; round <= 6; round++) {
      if(session.phase === 'preparation') { expect(session.start().ok).toBe(true); session.advance(60_025); }
      expect(session.state.roundResults.at(-1)?.goldAfter).toBe(session.state.gold);
      expect(session.state.roundResults).toHaveLength(round);
      expect(players(session.state)).toEqual(expectedRoster);
      expect(session.state.m8.loot.receipts.filter(receipt => receipt.payload.kind === 'unit')).toEqual([openingHeroReceipt('1-3')]);
      if (round === 2) expectOpeningHeroSource(session, '1-3');
      if (session.phase === 'choice') {
        const pending = session.state, before = structuredClone(pending);
        rejected(session, session.continue(round), 'wrong-phase', pending);expect(pending).toEqual(before);
        resolveSessionChoices(session);
      }
      expect(session.phase).toBe('settlement');
      expect(session.continue(round).ok).toBe(true);
      resolveSessionChoices(session);
      const next = session.state; rejected(session, session.continue(round), next.phase === 'settlement' ? 'stale-round' : 'wrong-phase', next);
      expect(players(session.state)).toEqual(expectedRoster); expect(session.combat).toBeNull();expect(session.state.nextUnitSerial).toBe(4);
    }
    expect(session.state.round).toBe(7); expect(session.state.shop.generation).toBe(7);expect(preparationBefore).toEqual(original);
  });

  it('F commits synchronously, preserves the shop, and immediately enables another deployment', () => {
    const prepared=accepted(nextRound(accepted(startMatchCombat(emptyBoard(purchasedThreeHeroMatch()))),getCatalogRoundById('2-1').ordinal));
    const session=new MatchSession(prepared);
    const slot=session.state.shop.slots.findIndex(o=>o.status==='available'&&!['irelia','maddie','lux'].includes(o.definitionId));
    expect(session.buy(slot,session.state.shop.generation).ok).toBe(true);
    for(let i=1;i<=3;i++) expect(session.deploy(`unit-${i}`,{kind:'board',cell:{col:i,row:6}}).ok).toBe(true);
    const capped=session.state;rejected(session,session.deploy('unit-4',{kind:'board',cell:{col:4,row:7}}),'population-cap',capped);
    const shop=structuredClone(session.state.shop),rng=session.state.rngState,gold=session.state.gold;
    expect(session.buyXp().ok).toBe(true);
    expect(session.state).toMatchObject({level:4,xp:0,gold:gold-4,rngState:rng,shop});
    expect(session.deploy('unit-4',{kind:'board',cell:{col:4,row:7}}).ok).toBe(true);
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
  const catalogs = [['darius','irelia','lux','maddie','zyra'], ['leona','rell','tristana','urgot','vander'],
    ['ezreal','kogmaw','loris','nami','scar'], ['corki','garen','zoe'], ['caitlyn']];
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
      const offer = reference.slots[slot], cost = catalogs.findIndex(catalog => catalog.includes(offer.definitionId)) + 1, id = `unit-${serial++}`;
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
    const session = new MatchSession({ ...readyMatch(), level: 9, xp: 0 }), before = session.state;
    for (let i = 0; i < 30; i++) rejected(session, session.buyXp(), 'max-level', before);
  });
  it('replays all accepted/rejected mixed events and isolates other sessions', () => {
    const first = runBurst(42); runBurst(0); expect(runBurst(42)).toEqual(first);
  });
});
