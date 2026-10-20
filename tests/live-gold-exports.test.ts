import { describe, expect, it } from 'vitest';
import {
  compileBattle, snapshotForBattle, startTwoSidedBattle, resolveTwoSidedBattle, proposeSettlement,
  readBattleLiveGoldReaders, readMatchLiveGoldReaders, sampleD11CombatGold, startTwoSidedCombat, toCombatReplay,
  applyCombatReplayTick, createCombatReplayRecorder, startMatchCombat, stepMatch, stepCombat,
  enableMultiplayerSettlement, toPrivateSeatView,
  type MatchState, type CombatState, type CombatReplayTick, type CombatBankSample, type LedgerCombatEvent,
} from '../src/server-entry';
import { catalogPreparation, accepted } from './t5r-helpers';

function seat(bound = true): MatchState {
  const base = catalogPreparation('2-1');
  return { ...base, level: 9, gold: 20, items: [], temporaryEquipment: [], augments: [], pendingChoice: null,
    preparation: { ...base.preparation, units: [
      { id: 'unit-1', definitionId: 'lux', team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 0, row: 4 } } },
      { id: 'unit-2', definitionId: 'leona', team: 'player', starLevel: 2, location: { kind: 'board', cell: { col: 1, row: 4 } } },
    ] },
    anomalyBinding: bound ? { definitionId: 'avarice-incarnate', unitId: 'unit-1', choiceId: 'avarice', boundRound: 1 } : null };
}
function input(a = true, b = true, mirror = false, empty = false) {
  const left = seat(a), right = seat(b);
  const snapshot = (state: MatchState, id: string) => snapshotForBattle(empty
    ? { ...state, anomalyBinding: null, preparation: { ...state.preparation, units: [] } } : state, id);
  return compileBattle(snapshot(left, 'A'), snapshot(right, 'B'), 42,
    { battleId: 'live-gold', ...(mirror ? { mirrorOfSeatId: 'B' } : {}) });
}
const bytes = (value: unknown) => JSON.stringify(value);

describe('live gold server exports', () => {
  function pveSeat(bound = true): MatchState {
    const base = catalogPreparation('1-2', 5);
    const holder = base.preparation.units.find(u => u.team === 'player')!;
    return { ...base, anomalyBinding: bound
      ? { definitionId: 'avarice-incarnate', unitId: holder.id, choiceId: 'avarice', boundRound: 1 } : null };
  }

  it.each([true, false])('R1 PvE preparation and running combat eligibility (bound=%s) is pure', bound => {
    const preparation = pveSeat(bound), running = accepted(startMatchCombat(preparation));
    expect(running.phase).toBe('combat');
    for (const state of [preparation, running]) {
      const before = bytes(state);
      expect(readMatchLiveGoldReaders(state)).toBe(bound);
      expect(bytes(state)).toBe(before);
    }
  });

  it('R1 PvE rejects bench, absent, enemy and other-anomaly holders', () => {
    const state = pveSeat(), holderId = state.anomalyBinding!.unitId;
    const benched: MatchState = { ...state, preparation: { ...state.preparation,
      units: state.preparation.units.map(u => u.id === holderId ? { ...u, location: { kind: 'bench', slot: 0 } } : u) } };
    expect(readMatchLiveGoldReaders(benched)).toBe(false);
    expect(readMatchLiveGoldReaders(accepted(startMatchCombat(benched)))).toBe(false);
    expect(readMatchLiveGoldReaders({ ...state, preparation: { ...state.preparation,
      units: state.preparation.units.filter(u => u.id !== holderId) } })).toBe(false);
    expect(readMatchLiveGoldReaders({ ...state, anomalyBinding: { ...state.anomalyBinding!,
      unitId: state.preparation.units.find(u => u.team === 'enemy')!.id } })).toBe(false);
    expect(readMatchLiveGoldReaders({ ...state, anomalyBinding: { ...state.anomalyBinding!, definitionId: 'other' } })).toBe(false);
  });

  it('R1 PvE reads the live combat roster, rejecting dead and missing holders', () => {
    const running = accepted(startMatchCombat(pveSeat()));
    if (running.phase !== 'combat') throw new Error('expected running combat');
    const holderId = running.anomalyBinding!.unitId;
    // Combat trading can change preparation; the current battle keeps its own roster.
    expect(readMatchLiveGoldReaders({ ...running, preparation: { ...running.preparation, units: [] } })).toBe(true);
    for (const units of [
      running.combat.units.map(u => u.id === holderId ? { ...u, alive: false, hp: 0 } : u),
      running.combat.units.filter(u => u.id !== holderId),
    ]) expect(readMatchLiveGoldReaders({ ...running, combat: { ...running.combat, units } })).toBe(false);
    let finished: MatchState = running;
    while (finished.phase === 'combat') finished = stepMatch(finished).state;
    expect(readMatchLiveGoldReaders(finished)).toBe(false);
    expect(readMatchLiveGoldReaders({ ...finished, phase: 'gameOver' })).toBe(false);
  });

  it('R1 nonbattle phases and non-PvE rounds are false', () => {
    const state = pveSeat();
    expect(readMatchLiveGoldReaders({ ...state, phase: 'choice', combat: null })).toBe(false);
    expect(readMatchLiveGoldReaders({ ...state, phase: 'settlement', combat: null })).toBe(false);
    expect(readMatchLiveGoldReaders(seat())).toBe(false);
    expect(readMatchLiveGoldReaders({ ...catalogPreparation('2-4'), anomalyBinding: state.anomalyBinding })).toBe(false);
  });

  it.each(['bound', 'unbound', 'bench', 'absent'] as const)('R1 PvE and PvP agree on the same seat roster (%s)', scenario => {
    let state = pveSeat(scenario !== 'unbound');
    const holderId = state.preparation.units.find(u => u.team === 'player')!.id;
    if (scenario === 'bench') state = { ...state, preparation: { ...state.preparation,
      units: state.preparation.units.map(u => u.id === holderId ? { ...u, location: { kind: 'bench', slot: 0 } } : u) } };
    if (scenario === 'absent') state = { ...state, preparation: { ...state.preparation,
      units: state.preparation.units.filter(u => u.id !== holderId) } };
    const a = snapshotForBattle(state, 'A');
    const readers = readBattleLiveGoldReaders({ a, b: { ...a, seatId: 'B' }, mirrorOfSeatId: null });
    expect(readMatchLiveGoldReaders(state)).toBe(scenario === 'bound');
    expect(readers.map(r => r.readsLiveGold)).toEqual([readMatchLiveGoldReaders(state), readMatchLiveGoldReaders(state)]);
  });

  it.each([[true, true], [true, false], [false, true], [false, false]])('R1 binding flags A=%s B=%s, pure snapshots and input agree', (a, b) => {
    const battle = input(a, b), before = bytes(battle);
    const expected = [{ seatId: 'A', team: 'player', readsLiveGold: a }, { seatId: 'B', team: 'enemy', readsLiveGold: b }];
    expect(readBattleLiveGoldReaders(battle)).toEqual(expected);
    expect(readBattleLiveGoldReaders({ a: battle.a, b: battle.b, mirrorOfSeatId: null })).toEqual(expected);
    expect(bytes(battle)).toBe(before);
  });

  it('R1 mirror B is false even when bound; unbound and missing on-board holders are false', () => {
    expect(readBattleLiveGoldReaders(input(true, true, true)).map(r => r.readsLiveGold)).toEqual([true, false]);
    const battle = input();
    expect(readBattleLiveGoldReaders({ ...battle, a: { ...battle.a, units: [] } })[0].readsLiveGold).toBe(false);
  });

  it('R3 changed result, reference identity, invalid input and frozen mirrors', () => {
    const battle = input(), start = startTwoSidedCombat(battle), before = bytes(start);
    expect(sampleD11CombatGold(start, 'player', 20)).toBe(start);
    const sampled = sampleD11CombatGold(start, 'player', 40);
    expect(sampled).not.toBe(start);
    expect(sampleD11CombatGold(sampled, 'player', 40)).toBe(sampled);
    expect(sampled.rngState).toBe(start.rngState);
    expect(sampled.rngDraws).toBe(start.rngDraws);
    expect(bytes(start)).toBe(before);
    const task = startTwoSidedBattle(battle);
    expect(task.sampleBankGold('A', 20)).toBe(false);
    expect(task.sampleBankGold('A', 40)).toBe(true);
    expect(task.sampleBankGold('A', 40)).toBe(false);
    expect(() => task.sampleBankGold('unknown', 40)).toThrow('invalid-bank-sample');
    expect(() => task.sampleBankGold('A', -1)).toThrow('invalid-bank-sample');
    const mirrorInput = input(true, true, true), mirror = startTwoSidedBattle(mirrorInput);
    expect(mirror.sampleBankGold('B', 99)).toBe(false);
    expect(bytes(mirror.advance(1201))).toBe(bytes(resolveTwoSidedBattle(mirrorInput, 1201)));
    const unbound = startTwoSidedBattle(input(false, false));
    expect(unbound.sampleBankGold('A', 99)).toBe(false);
    expect(unbound.advance(1201)?.bankSamples).toBeUndefined();
  });

  it.each([false, true])('R2/R4 streamed ticks and sampled PvP rerun match every frame (mirror=%s)', mirror => {
    const task = startTwoSidedBattle(input(true, true, mirror), { captureReplay: true });
    const frames: CombatReplayTick[] = [task.initialFrame];
    expect(task.replay()).toBeNull();
    expect(task.sampleBankGold('A', 51)).toBe(true);
    expect(task.sampleBankGold('B', 6)).toBe(!mirror);
    // Two different samples at one tick remain ordered, not sorted/deduplicated.
    expect(task.sampleBankGold('A', 50)).toBe(true);
    for (let tick = 0; tick < 1201; tick++) {
      if (tick === 5) expect(task.sampleBankGold('A', 0)).toBe(true);
      const next = task.advanceTick();
      if (next.frame) frames.push(next.frame);
      if (!next.result) continue;
      const result = next.result, replay = toCombatReplay(JSON.parse(bytes(result)));
      expect(bytes(frames)).toBe(bytes(replay.ticks));
      expect(bytes(task.replay())).toBe(bytes(replay));
      expect(result.bankSamples?.slice(0, mirror ? 2 : 3)).toEqual(mirror
        ? [{ tick: 0, team: 'player', liveGold: 51 }, { tick: 0, team: 'player', liveGold: 50 }]
        : [{ tick: 0, team: 'player', liveGold: 51 }, { tick: 0, team: 'enemy', liveGold: 6 }, { tick: 0, team: 'player', liveGold: 50 }]);
      expect(proposeSettlement(JSON.parse(bytes(result))).a.settlementEligible).toBe(true);
      let view = task.initial;
      for (const frame of frames) view = applyCombatReplayTick(view, frame);
      expect(view).toEqual(replay.terminal);
      expect(frames.some(f => f.events.some(e => e.type === 'unitUpdated'))).toBe(true);
      expect(bytes(replay)).not.toMatch(/bankSamples|liveGold|currentItemBankGold|openingItemBankGold/);
      expect(task.advanceTick()).toEqual({ frame: null, result });
      expect(() => task.sampleBankGold('A', 30)).toThrow('wrong-phase');
      const forged = { ...result, bankSamples: result.bankSamples!.map((s, i) => i === result.bankSamples!.length - 1 ? { ...s, liveGold: 40 } : s) };
      expect(() => toCombatReplay(forged)).toThrow('replay-divergence');
      expect(() => proposeSettlement(forged)).toThrow('invalid-result');
      return;
    }
    throw new Error('battle did not finish');
  });

  it.each([false, true])('R2 no-sample and tick-zero-finish compatibility (empty=%s)', empty => {
    const battle = input(false, false, false, empty), expected = resolveTwoSidedBattle(battle, 1201);
    const task = startTwoSidedBattle(battle, { captureReplay: true });
    const frames = [task.initialFrame];
    let next = task.advanceTick();
    while (!next.result) {
      if (next.frame) frames.push(next.frame);
      next = task.advanceTick();
    }
    if (next.frame) frames.push(next.frame);
    expect(bytes(next.result)).toBe(bytes(expected));
    expect(bytes(frames)).toBe(bytes(toCombatReplay(expected).ticks));
    expect(bytes(task.replay())).toBe(bytes(toCombatReplay(expected)));
    if (empty) expect(frames).toHaveLength(1);
  });

  it('R4 malformed, unbound and mirror-side transcripts are rejected', () => {
    const task = startTwoSidedBattle(input());
    task.sampleBankGold('A', 40);
    const result = task.advance(1201)!;
    for (const sample of [
      { tick: -1, team: 'player', liveGold: 40 }, { tick: result.terminal.tick, team: 'player', liveGold: 40 },
      { tick: 0, team: 'player', liveGold: -1 }, { tick: 0, team: 'player', liveGold: 1.5 },
      { tick: 0, team: 'other', liveGold: 40 }, { tick: 0, team: 'player', liveGold: 40, extra: 1 },
    ]) expect(() => toCombatReplay({ ...result, bankSamples: [sample as CombatBankSample] })).toThrow();
    expect(() => toCombatReplay({ ...result, bankSamples: [] })).toThrow();
    expect(() => toCombatReplay({ ...result, bankSamples: [{ tick: 1, team: 'player', liveGold: 40 }, { tick: 0, team: 'player', liveGold: 20 }] })).toThrow();
    const unbound = resolveTwoSidedBattle(input(false, false), 1201);
    expect(() => toCombatReplay({ ...unbound, bankSamples: [{ tick: 0, team: 'player', liveGold: 40 }] })).toThrow();
    const mirror = resolveTwoSidedBattle(input(true, true, true), 1201);
    expect(() => toCombatReplay({ ...mirror, bankSamples: [{ tick: 0, team: 'enemy', liveGold: 40 }] })).toThrow('invalid-replay-input');
    expect(() => proposeSettlement({ ...mirror, bankSamples: [{ tick: 0, team: 'enemy', liveGold: 40 }] })).toThrow('invalid-result');
  });

  it.each([true, false])('R4 real PvE stepMatch samples survive JSON, receipt, replay and public projection (bound=%s)', bound => {
    const base = catalogPreparation('1-2', 5), holder = base.preparation.units.find(u => u.team === 'player')!;
    let state = accepted(enableMultiplayerSettlement({ ...base, gold: 20,
      anomalyBinding: bound ? { definitionId: 'avarice-incarnate', unitId: holder.id, choiceId: 'avarice', boundRound: 1 } : null }, 'A'));
    const start = startMatchCombat(state); state = accepted(start);
    const initial = state.combat!;
    const events: LedgerCombatEvent[] = (start.ok ? start.events : []).filter((e): e is LedgerCombatEvent => e.domain === 'combat');
    const recorder = createCombatReplayRecorder(initial, events), frames = [recorder.initialFrame];
    while (state.phase === 'combat') {
      // Stand in for already-authorized server bank commands; settlement still uses Match rules.
      if (state.combat.tick === 0) state = { ...state, gold: 50 };
      if (state.combat.tick === 5) state = { ...state, gold: 0 };
      const before = state.combat, next = stepMatch(state); state = next.state;
      const ledger = next.events.filter((e): e is LedgerCombatEvent => e.domain === 'combat');
      frames.push(recorder.record(before, { state: state.combat!, events: ledger })); events.push(...ledger);
    }
    const terminal = state.combat!;
    expect(terminal.tick).toBeGreaterThan(5);
    const bankSamples = terminal.bankSamples;
    expect(state.roundResults.at(-1)?.bankSamples).toEqual(bankSamples);
    if (bound) expect(bankSamples).toEqual([{ tick: 0, team: 'player', liveGold: 50 }, { tick: 5, team: 'player', liveGold: 0 }]);
    else expect(bankSamples).toBeUndefined();
    const source = { initial, terminal, events, ...(bankSamples ? { bankSamples } : {}) };
    const replay = toCombatReplay(JSON.parse(bytes(source)));
    expect(bytes(replay.ticks)).toBe(bytes(frames));
    expect(bytes(replay)).toBe(bytes(recorder.finish(terminal)));
    // The terminal transcript alone also suffices when servers retain whole CombatState.
    expect(bytes(toCombatReplay({ initial, terminal, events }))).toBe(bytes(replay));
    expect(bytes(toPrivateSeatView(state))).not.toMatch(/bankSamples|liveGold|currentItemBankGold/);
    expect(bytes(replay)).not.toMatch(/bankSamples|liveGold|currentItemBankGold/);
    if (bound) {
      const { bankSamples: _samples, ...withoutSamples } = terminal;
      expect(() => toCombatReplay({ initial, terminal: withoutSamples, events })).toThrow('replay-divergence');
      expect(() => toCombatReplay({ ...source, bankSamples: bankSamples!.map(s => ({ ...s, liveGold: 13 })) })).toThrow('replay-divergence');
    } else {
      let cursor: CombatState = initial;
      while (cursor.status === 'running') cursor = stepCombat(cursor).state;
      expect(bytes(cursor)).toBe(bytes(terminal));
    }
  });
});
