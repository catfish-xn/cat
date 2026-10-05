import { describe, expect, it } from 'vitest';
import { MatchSession } from '../src/rendering/match-session';
import { createCombatWithEvents, type CombatEvent } from '../src/simulation/combat';
import { createMatch, deployMatchUnit, type MatchCommandResult, type MatchState } from '../src/simulation/match';
import { readyMatch, emptyBoard } from './match-helpers';
import { settlement } from './fixtures/m5/oracle.cjs';
import { nextRandom } from '../src/simulation/rng';
import { buildStrategySnapshot } from '../src/simulation/strategy-snapshot';

function preparation(): MatchState {
  return deployMatchUnit(readyMatch(), 'unit-1', { kind: 'board', cell: { col: 2, row: 7 } }).state;
}
const players = (state: MatchState) => state.preparation.units.filter(unit => unit.team === 'player');
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
    expect(settled.xp).toBe(2);
  });

  it('Continue preserves player stars/positions while resetting combat Mana, shield and partial clock', () => {
    const prep = preparation(), session = new MatchSession(prep), before = structuredClone(players(prep));
    expect(session.continue(1).ok).toBe(false);
    session.start(); session.advance(60_025);
    expect(session.combat?.units.some(unit => !unit.alive)).toBe(true);
    expect(session.combat?.units.some(unit => unit.hp < unit.maxHp)).toBe(true);
    expect(players(session.state)).toEqual(before);
    expect(session.continue(1).ok).toBe(true);
    expect(session.phase).toBe('preparation');
    expect(session.advance(1000)).toEqual([]);
    resolveSessionChoices(session);
    expect(session.phase).toBe('preparation'); expect(session.combat).toBeNull();
    expect(players(session.state)).toEqual(before);
    expect(session.advance(1000)).toEqual([]);
    expect(session.deploy('unit-1', { kind: 'board', cell: { col: 4, row: 6 } }).ok).toBe(true);
    const secondRoster = structuredClone(players(session.state));
    const secondInitial = createCombatWithEvents(session.state.preparation, buildStrategySnapshot(session.state), 'round-2', nextRandom(session.state.battleSeedRngState).word).state;
    session.start();
    expect(session.combat).toEqual(secondInitial);
    expect(session.combat?.units.every(unit => unit.hp === unit.maxHp && unit.alive && unit.targetId === null
      && unit.cooldownTicks === 0 && unit.moveCooldownTicks === 0)).toBe(true);
    expect(session.combat?.units.find(unit => unit.id === 'unit-1')?.cell).toEqual({ col: 4, row: 6 });
    expect(session.advance(25)).toEqual([]); expect(session.combat?.tick).toBe(0);
    session.advance(25); expect(session.combat?.tick).toBe(1);
    session.advance(60_000); session.continue(2);
    expect(players(session.state)).toEqual(secondRoster); expect(players(prep)).toEqual(before);
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
    expect(session.state).toMatchObject({ gold: 16, playerHp: 95, xp: 2 });
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
    const session = new MatchSession(readyMatch());
    expect(session.buy(0, 1).ok).toBe(true);
    const owned = players(session.state);
    const stale = session.state; rejected(session, session.buy(0, 0), 'stale-shop', stale);
    session.deploy(owned[0].id, { kind: 'board', cell: { col: 2, row: 7 } });
    const roster = structuredClone(players(session.state));
    for (let round = 1; round <= 5; round++) {
      if(session.phase === 'preparation') { expect(session.start().ok).toBe(true); session.advance(60_025); }
      expect(session.state.roundResults.at(-1)?.goldAfter).toBe(session.state.gold);
      expect(session.state.roundResults).toHaveLength(round);
      expect(session.continue(round).ok).toBe(true);
      resolveSessionChoices(session);
      const next = session.state; rejected(session, session.continue(round), next.phase === 'settlement' ? 'stale-round' : 'wrong-phase', next);
      expect(players(session.state)).toEqual(roster); expect(session.combat).toBeNull();
    }
    expect(session.state.round).toBe(6); expect(session.state.shop.generation).toBe(6);
  });

  it('F commits synchronously, preserves the shop, and immediately enables another deployment', () => {
    const session = new MatchSession(readyMatch());
    expect(session.buy(0,session.state.shop.generation).ok).toBe(true);
    for (let i = 1; i <= 3; i++) expect(session.deploy(`unit-${i}`, { kind: 'board', cell: { col: i, row: 6 } }).ok).toBe(true);
    const capped = session.state; rejected(session, session.deploy('unit-4', { kind: 'board', cell: { col: 4, row: 7 } }), 'population-cap', capped);
    const shop = structuredClone(session.state.shop), rng = session.state.rngState;
    expect(session.buyXp().ok).toBe(true); expect(session.buyXp().ok).toBe(true);
    expect(session.state).toMatchObject({ level: 4, xp: 2, gold: 1, rngState: rng, shop });
    expect(session.deploy('unit-4', { kind: 'board', cell: { col: 4, row: 7 } }).ok).toBe(true);
  });

  it('returns upgrade events without delaying the next sell or allocating a second purchase', () => {
    const initial = readyMatch();
    const session = new MatchSession({ ...initial, nextUnitSerial: 5, preparation:{...initial.preparation,units:[...initial.preparation.units,
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
  const odds: Record<number, number[]> = { 3: [75,25,0,0,0], 4: [55,30,15,0,0], 5: [45,33,20,2,0] };
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
    let gold = 200, level = 3, xp = 0, generation = 1, serial = 4, reference = referenceShop(seed, level);
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
      while (xp >= ({ 3: 6, 4: 10, 5: 20 } as Record<number, number>)[level]) { xp -= ({ 3: 6, 4: 10, 5: 20 } as Record<number, number>)[level]; level++; }
      check(session.buyXp()); reroll(); buyDeploySell(4);
    }
    expect(initial).toEqual(original); return { state: session.state, trace };
  }
  it('commits six mixed D/buy/deploy/E/F/D/buy/E cycles with an independent RNG and XP ledger', () => {
    const { state } = runBurst(42);
    expect(state).toMatchObject({ gold: 152, level: 5, xp: 8, nextUnitSerial: 16, shop: { generation: 13 } });
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
