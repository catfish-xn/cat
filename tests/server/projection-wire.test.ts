import { prepareInput, copyInput } from '../fixtures/prepared-input';
/**
 * Work order B7: every state that leaves the room is the rules' private seat view (§14.1), every battle
 * also leaves as a compact replay (§14.2) mirrored for side B, and overtime (§11.5) runs a match to a
 * unique ranking in a bounded number of rounds.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { applyCombatReplayTick, stepCombat, type CombatReplay, type CombatReplayInput, type CombatState, type CombatViewState } from '../../src/server-entry';
import type { ServerMessage } from '../../src/server/net/messages';
import type { PlayerView } from '../../src/server/protocol';
import { toCombatReplayFor, mirrorCombatReplay, toSeatPrivateView } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { Room } from '../../src/server/room/room';
import type { BattleInput, BattleResult, RoomState, TwoSidedBattleResult } from '../../src/server/room/types';
import type { BattleResolver } from '../../src/server/room/battle-resolver';
import type { TestClient } from '../../src/server/net/test-client';
import { LocalRoomClient } from '../../src/rendering/online/local-room-client';
import { toDisplayMatch } from '../../src/rendering/online/seat-view-adapter';
import { ManualClock } from '../../src/server/room/clock';
import { expectUniqueRanking, makeRoom, runUntil, answerOpenChoices } from './helpers';
import { expectOk, flush, seatTwo, startServer, type NetHarness } from './net/helpers';

/** Fields of MatchState that must never reach a client (contract §14.1, work order B7 item 2). */
const PRIVATE_KEYS = ['rngState', 'battleSeedRngState', 'choiceRngState', 'rewardRngState', 'resourceProvenance', 'combatInputBasis',
  'seed', 'scheduleReceipts', 'equipmentState', 'multiplayer', 'sharedPool', 'combat', 'outcome', 'nextItemSerial', 'nextUnitSerial', 'nextMatchEventSeq',
  'loot', 'frozen', 'encounterPlan', 'settlementId', 'g23Facts', 'economyReceipts'] as const;
function privateKeysIn(value: unknown, path = '$', found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item, index) => privateKeysIn(item, `${path}[${index}]`, found));
  else if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if ((PRIVATE_KEYS as readonly string[]).includes(key)) found.push(`${path}.${key}`);
      privateKeysIn(child, `${path}.${key}`, found);
    }
  }
  return found;
}
const stateMessages = (inbox: readonly ServerMessage[]) => inbox.filter((message): message is Extract<ServerMessage, { type: 'state' }> => message.type === 'state');
const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
/**
 * Size baseline of the per-tick frame transport that C6 removed: one CombatState per tick plus the ledger.
 * Rebuilt here from the battle itself (test only) so the replay can still be compared with what it replaced.
 */
function legacyFrameBytes(battle: CombatReplayInput): number {
  let state: CombatState = battle.initial, total = bytes(state) + bytes(battle.events);
  while (state.status === 'running' && state.tick < battle.terminal.tick) { state = stepCombat(state).state; total += bytes(state); }
  return total;
}
const flip = (cell: { col: number; row: number }, rows: number) => ({ col: cell.col, row: rows - 1 - cell.row });
/** Plays a replay with the rules' display reducer; the result must be the terminal view (§14.2). */
function play(replay: CombatReplay): CombatViewState {
  let view = replay.initial;
  for (const frame of replay.ticks.slice(1)) view = applyCombatReplayTick(view, frame);
  return view;
}
/** Runs the room to the battle phase of its first PvP round with two real participants on each side. */
function firstPvpBattle(room: Room, clock: ManualClock): { state: RoomState; battle: TwoSidedBattleResult } {
  const state = runUntil(room, clock, current => current.phase === 'battle' && current.battles.some(battle => battle.kind === 'two-sided' && battle.participants.length === 2), 400);
  const battle = state.battles.find((candidate): candidate is TwoSidedBattleResult => candidate.kind === 'two-sided' && candidate.participants.length === 2 && candidate.battle.initial.units.length > 1)
    ?? state.battles.find((candidate): candidate is TwoSidedBattleResult => candidate.kind === 'two-sided' && candidate.participants.length === 2)!;
  return { state, battle };
}

let harness: NetHarness | null = null;
afterEach(async () => { await harness?.close(); harness = null; });

describe('V26 public streak over the wire', () => {
  describe('Called Shot acquired between settlements', () => {
    let owner: TestClient, observer: TestClient, room: Room;
    beforeAll(async () => {
      harness = await startServer({ seed: 8 }, new TwoSidedBattleResolver());
      const first = await harness.connect(); observer = await harness.connect(); owner = await harness.connect();
      for (const [index, client] of [first, observer, owner].entries()) expectOk(await client.join(`玩家 ${index}`));
      expectOk(await first.start());
      await owner.waitFor(message => message.type === 'state');
      room = harness.server.room!;
    });
    for (const round of [2, 3, 4]) beforeAll(async () => {
      runUntil(room, harness!.clock, state => state.round === round && state.phase === 'preparation');
      await owner.waitForView(view => view.phase.round === round && view.phase.kind === 'preparation');
    });
    it('broadcasts the new streak with the owned augment immediately and keeps it on resume', async () => {
      const before = room.state.seats.find(seat => seat.seatId === owner.seatId)!, choice = before.match.pendingChoice!;
      expect(choice.offers).toContain('called-shot');
      expect(before.streak).not.toEqual({ kind: 'win', count: 4 });
      await owner.waitFor(message => message.type === 'state' && message.seatRevision === before.seatRevision);
      const settlements = room.state.settlements;
      expectOk(await owner.command({ type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: 'called-shot' }));
      const hasAugment = (view: PlayerView) => view.seats.some(seat => seat.seatId === owner.seatId && seat.publicBoard?.augments?.includes('called-shot'));
      for (const client of [owner, observer]) {
        const view = await client.waitForView(hasAugment);
        expect(view.seats.find(seat => seat.seatId === owner.seatId)!.streak).toEqual({ kind: 'win', count: 4 });
        expect(privateKeysIn(view)).toEqual([]);
      }
      const privateState = await owner.waitFor<Extract<ServerMessage, { type: 'state' }>>(message => message.type === 'state' && message.state.augments.some(augment => augment.definitionId === 'called-shot'));
      expect(privateState.state.streak).toEqual({ kind: 'win', count: 4 });
      expect(room.state.settlements).toEqual(settlements);
      expect(room.state.phase).toBe('preparation');
      const token = owner.token!;
      await owner.close();
      const resumed = await harness!.connect();
      expectOk(await resumed.resume(token));
      const view = await resumed.waitForView(hasAugment);
      expect(view.seats.find(seat => seat.seatId === owner.seatId)!.streak).toEqual({ kind: 'win', count: 4 });
      expect(privateKeysIn(view)).toEqual([]);
      expect(room.state.fault).toBeNull();
    });
  });

  it('keeps an empty-board PvE result private through battle commands and resume until the room commits HP and streak', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const [a, b] = await seatTwo(harness), room = harness.server.room!;
    const mine = () => room.state.seats.find(seat => seat.seatId === a.seatId)!;
    const publicSeat = (view: PlayerView) => view.seats.find(seat => seat.seatId === a.seatId)!;
    runUntil(room, harness.clock, state => state.round === 2 && state.phase === 'preparation');
    for (const unit of mine().match.preparation.units.filter(unit => unit.team === 'player')) expectOk(room.handle(a.seatId!, { type: 'sell', unitId: unit.id }));
    runUntil(room, harness.clock, state => state.round === 2 && state.phase === 'battle');
    expect(mine().match).toMatchObject({ phase: 'settlement', playerHp: 97, streak: { kind: 'loss', count: 1 } });
    for (const client of [a, b]) {
      const battle = await client.waitForView(view => view.phase.round === 2 && view.phase.kind === 'combat');
      expect(publicSeat(battle)).toMatchObject({ hp: 100, streak: { kind: 'win', count: 1 } });
    }
    // The frozen public view already maps to combat; send against the latest locked private snapshot.
    await a.waitFor(message => message.type === 'state' && message.round === 2 && message.seatRevision === mine().seatRevision);
    const fromIndex = b.inbox.length;
    expectOk(await a.command({ type: 'shopLock', locked: true, generation: mine().match.shop.generation }));
    const operated = await b.waitFor<Extract<ServerMessage, { type: 'view' }>>(message => message.type === 'view', undefined, fromIndex);
    expect(publicSeat(operated.view)).toMatchObject({ hp: 100, streak: { kind: 'win', count: 1 } });
    const token = a.token!;
    await a.close();
    const disconnected = await b.waitForView(view => !publicSeat(view).connected);
    expect(publicSeat(disconnected)).toMatchObject({ hp: 100, streak: { kind: 'win', count: 1 } });
    const resumed = await harness.connect();
    expectOk(await resumed.resume(token));
    const battle = await resumed.waitForView(view => view.phase.round === 2 && view.phase.kind === 'combat');
    expect(publicSeat(battle)).toMatchObject({ hp: 100, streak: { kind: 'win', count: 1 } });
    runUntil(room, harness.clock, state => state.round === 2 && state.phase === 'settlement');
    expect(room.state.fault).toBeNull();
    // awaiting-settlement also maps to a settlement view, so select the room's actual committed publication.
    const committedRevision = room.state.roomRevision;
    for (const client of [b, resumed]) {
      const { view: settled } = await client.waitFor<Extract<ServerMessage, { type: 'view' }>>(message => message.type === 'view' && message.roomRevision === committedRevision);
      expect(settled.phase).toMatchObject({ round: 2, kind: 'settlement' });
      expect(publicSeat(settled)).toMatchObject({ hp: 97, streak: { kind: 'loss', count: 1 } });
    }
    expect(publicSeat(battle)).toMatchObject({ hp: 100, streak: { kind: 'win', count: 1 } });
    expect(mine().match.roundResults).toHaveLength(2);
    for (const client of [a, b, resumed]) for (const message of client.inbox) if (message.type === 'view') expect(privateKeysIn(message.view)).toEqual([]);
  }, 20_000);

  it('publishes the settled streak with HP to every player, and resumes without resetting or recounting', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const [a, b] = await seatTwo(harness), room = harness.server.room!;
    for (const client of [a, b]) for (const seat of client.view!.seats) expect(seat.streak).toEqual({ kind: null, count: 0 });
    // A real PvE settlement changes the authoritative economy streak; no network-side calculation.
    runUntil(room, harness.clock, state => state.phase === 'settlement');
    expect(room.state.fault).toBeNull(); expect(room.state.roundId).toBe('1-2');
    const stats = (seats: PlayerView['seats']) => seats.map(({ seatId, hp, streak }) => ({ seatId, hp, streak }));
    const expected = room.state.seats.map(seat => ({ seatId: seat.seatId, hp: seat.hp, streak: seat.streak }));
    for (const seat of room.state.seats) {
      expect(seat.hp).toBe(seat.match.playerHp);
      expect(seat.streak).toEqual(seat.match.streak);
    }
    for (const seat of expected) expect(seat.streak.count).toBe(1);
    for (const client of [a, b]) {
      const settled = await client.waitForView(view => view.phase.kind === 'settlement');
      expect(stats(settled.seats)).toEqual(expected);
      for (const seat of settled.seats) {
        expect(Object.keys(seat.streak!).sort()).toEqual(['count', 'kind']);
        for (const key of ['shop', 'gold', 'xp', 'rngState', 'seed', 'pendingChoice', 'roundResults']) expect(seat).not.toHaveProperty(key);
      }
    }
    const token = a.token!, matches = room.state.seats.map(seat => seat.match);
    await a.close();
    expect(stats((await b.waitForView(view => view.seats.some(seat => seat.seatId === a.seatId && !seat.connected))).seats)).toEqual(expected);
    const resumeIndex = b.inbox.length;
    const resumed = await harness.connect();
    expectOk(await resumed.resume(token));
    await resumed.waitFor(message => message.type === 'state');
    expect(stats((await resumed.waitForView(view => view.phase.kind === 'settlement')).seats)).toEqual(expected);
    const seen = await b.waitFor<Extract<ServerMessage, { type: 'view' }>>(message => message.type === 'view' && message.view.seats.some(seat => seat.seatId === a.seatId && seat.connected), undefined, resumeIndex);
    expect(stats(seen.view.seats)).toEqual(expected);
    expect(room.state.seats.map(seat => seat.match)).toEqual(matches);
    for (const seat of room.state.seats) expect(seat.match.roundResults).toHaveLength(1);
    for (const client of [a, b, resumed]) for (const message of client.inbox) if (message.type === 'view') expect(privateKeysIn(message.view)).toEqual([]);
  });
});

describe('B7 private seat view on every state path', () => {
  describe('private wire snapshots', () => {
    let a: TestClient, b: TestClient, room: Room;
    beforeAll(async () => { harness = await startServer({}, new TwoSidedBattleResolver()); });
    beforeAll(async () => { [a, b] = await seatTwo(harness!); room = harness!.server.room!; });
    afterAll(async () => { await harness?.close(); harness = null; });
    it('sends only the private view: first snapshot, increments, resume snapshot and the fault snapshot', async () => {
    const seatOf = (client: TestClient) => room.state.seats.find(seat => seat.seatId === client.seatId)!;
    // First snapshot.
    const first = stateMessages(a.inbox)[0]!;
    expect(first.state).toEqual(JSON.parse(JSON.stringify(toSeatPrivateView(seatOf(a).match))));
    // Increment after a command.
    const revision = a.stateRevision;
    expectOk(await a.command({ type: 'shopLock', locked: !a.state!.shop.locked, generation: a.state!.shop.generation }));
    const increment = await a.waitFor<Extract<ServerMessage, { type: 'state' }>>(message => message.type === 'state' && message.seatRevision === revision + 1);
    expect(increment.state).toEqual(JSON.parse(JSON.stringify(toSeatPrivateView(seatOf(a).match))));
    // A refused command carries no state at all over the network.
    const refused = await a.command({ type: 'buy', slot: 0, generation: a.state!.shop.generation + 9 });
    expect(refused.ok).toBe(false);
    expect(Object.keys(refused)).not.toContain('state');
    // Resume snapshot on a new connection.
    const token = a.token!;
    await a.close();
    const a2 = await harness!.connect();
    expectOk(await a2.resume(token));
    const resumed = await a2.waitFor<Extract<ServerMessage, { type: 'state' }>>(message => message.type === 'state');
    expect(resumed.state).toEqual(JSON.parse(JSON.stringify(toSeatPrivateView(seatOf(a2).match))));
    for (const client of [a, a2, b]) for (const message of client.inbox) {
      expect(privateKeysIn(message.type === 'state' ? message.state : message.type === 'view' ? message.view : null), `${message.type} leaked`).toEqual([]);
    }
  });
  });

  it('keeps the fault snapshot projected', async () => {
    const failing: BattleResolver = { resolveBattle(input: BattleInput): BattleResult { throw new Error(`boom ${input.battleId}`); } };
    harness = await startServer({}, failing);
    const [a, b] = await seatTwo(harness);
    for (let fired = 0; fired < 50 && harness.server.room!.state.phase !== 'ended'; fired++) harness.clock.runNext();
    await a.waitForView(view => view.fault !== null);
    await b.waitForView(view => view.fault !== null);
    await flush();
    for (const client of [a, b]) {
      expect(stateMessages(client.inbox).length).toBeGreaterThan(0);
      for (const message of client.inbox) expect(privateKeysIn(message.type === 'state' ? message.state : null)).toEqual([]);
    }
  });

  it('hands the local client the same projection on pushes, accepted and refused commands', () => {
    const clock = new ManualClock();
    const client = new LocalRoomClient({ seed: 42, preparationMs: 1_000, choiceMs: 500, settlementMs: 200, myName: '本地', faultAtRound: null, pvpMode: 'two-sided', clock });
    const pushed: unknown[] = [];
    client.listen({ lobby: () => {}, view: () => {}, state: state => pushed.push(state), replay: () => {} });
    client.joinQueue('本地'); client.startMatch();
    const room = client.currentRoom!;
    const mine = () => room.state.seats[0]!.match;
    const expected = () => toDisplayMatch(toSeatPrivateView(mine()));
    expect(pushed.at(-1)).toEqual(expected());
    const refused = client.send({ type: 'buy', slot: 0, generation: mine().shop.generation + 5 });
    expect(refused.ok).toBe(false);
    expect(refused.state).toEqual(expected());
    // Placeholders never carry the room's RNG: the display copy's rng fields are not the seat's.
    expect(refused.state.rngState).not.toBe(mine().rngState);
    const accepted = client.send({ type: 'shopLock', locked: true, generation: mine().shop.generation });
    expect(accepted.ok).toBe(true);
    expect(accepted.state).toEqual(expected());
    client.dispose();
  });
});

describe('B7 compact replay', () => {
  describe('first PvP input', () => {
    let pvpInput: ReturnType<typeof firstPvpBattle> | undefined;
    beforeAll(() => {
      const { room, clock } = makeRoom(new TwoSidedBattleResolver());
      room.start();
      pvpInput = prepareInput(firstPvpBattle(room, clock));
      room.dispose();
    });
    afterAll(() => { pvpInput = undefined; });

    it('mirrors side B (cells, movement, cast cells, unitUpdated, teams, result) and plays to the terminal view', () => {
      const { state, battle } = copyInput(pvpInput!);
      const [seatA, seatB] = [battle.battle.a.seatId, battle.battle.b.seatId];
      const a = toCombatReplayFor(state, seatA)!, b = toCombatReplayFor(state, seatB)!;
      expect(a.battleId).toBe(battle.battleId); expect(b.battleId).toBe(battle.battleId);
      // Built once per battle: every later request returns the same immutable replay.
      expect(toCombatReplayFor(state, seatA)!.replay).toBe(a.replay);
      expect(toCombatReplayFor(state, seatB)!.replay).toBe(b.replay);
      const rows = a.replay.initial.board.rows;
      expect(b.replay.initial.units.length).toBe(a.replay.initial.units.length);
      expect(a.replay.initial.units.length).toBeGreaterThan(0);
      a.replay.initial.units.forEach((unit, index) => {
        const mirrored = b.replay.initial.units[index]!;
        expect(mirrored.id).toBe(unit.id);
        expect(mirrored.cell).toEqual(flip(unit.cell, rows));
        expect(mirrored.team).toBe(unit.team === 'player' ? 'enemy' : 'player');
        if (unit.startingCell) expect(mirrored.startingCell).toEqual(flip(unit.startingCell, rows));
        expect(mirrored.hp).toBe(unit.hp);
      });
      expect(b.replay.initial.board.deploymentZones).toEqual({ player: a.replay.initial.board.deploymentZones.enemy, enemy: a.replay.initial.board.deploymentZones.player });
      const swap = (result: string | null) => result === 'playerWin' ? 'enemyWin' : result === 'enemyWin' ? 'playerWin' : result;
      expect(b.replay.terminal.result).toBe(swap(a.replay.terminal.result));
      expect(b.replay.ticks.length).toBe(a.replay.ticks.length);
      let movements = 0;
      a.replay.ticks.forEach((frame, index) => {
        const other = b.replay.ticks[index]!;
        expect(other.tick).toBe(frame.tick);
        frame.events.forEach((event, at) => {
          const mirrored = other.events[at]!;
          expect(mirrored.type).toBe(event.type);
          if (event.type === 'movement' && mirrored.type === 'movement') { movements++; expect(mirrored.from).toEqual(flip(event.from, rows)); expect(mirrored.to).toEqual(flip(event.to, rows)); }
          if (event.type === 'cast' && mirrored.type === 'cast') expect(mirrored.completionCell).toEqual(flip(event.completionCell, rows));
          if (event.type === 'combatFinished' && mirrored.type === 'combatFinished') expect(mirrored.result).toBe(swap(event.result));
          if (event.type === 'unitUpdated' && mirrored.type === 'unitUpdated' && event.changes.cell) expect(mirrored.changes.cell).toEqual(flip(event.changes.cell, rows));
          if ('eventSeq' in event && 'eventSeq' in mirrored) expect(mirrored.eventSeq).toBe(event.eventSeq);
        });
      });
      // Both orientations reduce to their own terminal view, and B is exactly the mirror of A.
      expect(JSON.stringify(play(a.replay))).toBe(JSON.stringify(a.replay.terminal));
      expect(JSON.stringify(play(b.replay))).toBe(JSON.stringify(b.replay.terminal));
      expect(b.replay).toEqual(mirrorCombatReplay(a.replay));
      // Size: the replay is a small fraction of the per-tick frames it replaced (B7 item 5: < 5%; C6 acceptance: ≥ 90% less).
      const replayBytes = bytes(a.replay), framesBytes = legacyFrameBytes(battle.battle);
      console.log(`[c6-wire] first PvP battle: replay ${replayBytes} B, legacy frames ${framesBytes} B (${(replayBytes / framesBytes * 100).toFixed(2)}%)`);
      expect(replayBytes / framesBytes).toBeLessThan(0.05);
    }, 60_000);
  });

  it('mirrors every coordinate-bearing replay field, including ones a short battle may not produce', () => {
    const unit = { id: 'u1', definitionId: 'irelia', team: 'player' as const, starLevel: 1, hp: 10, maxHp: 10, mana: 0, maxMana: 50, shield: 0, alive: true, targetId: null,
      attackDamage: 1, attackRange: 1, attackIntervalTicks: 20, armor: 0, magicResist: 0, abilityPower: 100, cell: { col: 2, row: 6 }, startingCell: { col: 2, row: 7 } };
    const view = { combatId: 'c', tick: 0, maxTicks: 1200, status: 'running', result: null,
      board: { columns: 7, rows: 8, deploymentZones: { player: { firstRow: 4, lastRow: 7 }, enemy: { firstRow: 0, lastRow: 3 } } }, units: [unit] };
    const replay = {
      initial: view,
      ticks: [{ tick: 0, events: [] }, { tick: 1, events: [
        { tick: 1, eventSeq: 3, type: 'movement', unitId: 'u1', from: { col: 2, row: 6 }, to: { col: 2, row: 5 } },
        { tick: 1, eventSeq: 4, type: 'cast', sourceId: 'u1', actionSeq: 1, completed: true, actualManaSpent: 50, refundedMana: 0, targetIds: ['u2'], completionCell: { col: 3, row: 1 } },
        { type: 'unitUpdated', unitId: 'u1', changes: { cell: { col: 2, row: 5 }, startingCell: { col: 2, row: 4 }, team: 'enemy', hp: 7 } },
        { tick: 1, eventSeq: 5, type: 'combatFinished', result: 'playerWin', reason: 'elimination' },
      ], keyframe: { ...view, tick: 1, status: 'finished', result: 'playerWin', units: [{ ...unit, cell: { col: 2, row: 5 } }] } }],
      terminal: { ...view, tick: 1, status: 'finished', result: 'playerWin', units: [{ ...unit, cell: { col: 2, row: 5 } }] },
    } as unknown as CombatReplay;
    const mirrored = mirrorCombatReplay(replay) as unknown as { initial: typeof view; ticks: { events: Record<string, unknown>[]; keyframe: typeof view }[]; terminal: typeof view };
    expect(mirrored.initial.units[0]).toMatchObject({ team: 'enemy', cell: { col: 2, row: 1 }, startingCell: { col: 2, row: 0 }, hp: 10 });
    expect(mirrored.initial.board.deploymentZones).toEqual({ player: { firstRow: 0, lastRow: 3 }, enemy: { firstRow: 4, lastRow: 7 } });
    const [movement, cast, updated, finished] = mirrored.ticks[1]!.events;
    expect(movement).toMatchObject({ eventSeq: 3, from: { col: 2, row: 1 }, to: { col: 2, row: 2 } });
    expect(cast).toMatchObject({ eventSeq: 4, completionCell: { col: 3, row: 6 }, targetIds: ['u2'] });
    expect(updated).toEqual({ type: 'unitUpdated', unitId: 'u1', changes: { cell: { col: 2, row: 2 }, startingCell: { col: 2, row: 3 }, team: 'player', hp: 7 } });
    expect(finished).toMatchObject({ result: 'enemyWin', reason: 'elimination' });
    expect(mirrored.ticks[1]!.keyframe).toMatchObject({ result: 'enemyWin', units: [{ cell: { col: 2, row: 2 }, team: 'enemy' }] });
    expect(mirrored.terminal.result).toBe('enemyWin');
    // Mirroring twice gives the original back.
    expect(mirrorCombatReplay(mirrorCombatReplay(replay))).toEqual(replay);
  });

  it('builds PvE replays from the rules own combat (start, finish and ledger; no per-tick frames kept)', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    const state = runUntil(room, clock, current => current.phase === 'battle' && current.roundKind === 'pve');
    for (const seat of state.seats) {
      const replay = toCombatReplayFor(state, seat.seatId)!;
      expect(replay).not.toBeNull();
      const outcome = state.battles.flatMap(battle => battle.kind === 'placeholder' ? battle.outcomes : []).find(candidate => candidate.seatId === seat.seatId)!;
      expect(outcome).not.toHaveProperty('frames');
      expect(replay.replay.ticks.length).toBe(outcome.combat!.terminal.tick + 1);
      expect(JSON.stringify(play(replay.replay))).toBe(JSON.stringify(replay.replay.terminal));
      expect(replay.replay.terminal.tick).toBe(outcome.combat!.terminal.tick);
    }
  }, 30_000);

  it('sends each battle once as the room\'s own replay and never as combat frames (C6)', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const [a] = await seatTwo(harness);
    const room = harness.server.room!;
    for (let fired = 0; fired < 400 && room.state.phase !== 'battle'; fired++) harness.clock.runNext();
    expect(room.state.phase).toBe('battle');
    const expected = toCombatReplayFor(room.state, a.seatId!)!;
    const message = await a.waitFor<Extract<ServerMessage, { type: 'replay' }>>(candidate => candidate.type === 'replay');
    expect(message.battleId).toBe(expected.battleId);
    // The replay on the wire is the room's own replay for this seat.
    expect(message.replay).toEqual(JSON.parse(JSON.stringify(expected.replay)));
    // C15: my own unit ids of this battle ride along, exactly as the projection built them.
    expect(message.unitIds).toEqual(JSON.parse(JSON.stringify(expected.unitIds)));
    await flush();
    expect(a.inbox.filter(candidate => candidate.type === 'replay' && candidate.battleId === expected.battleId)).toHaveLength(1);
    expect(a.inbox.some(candidate => (candidate as { type: string }).type === 'combat')).toBe(false);
  }, 60_000);
});

describe('B7 overtime (§11.5)', () => {
  it('runs a match past 6-7 into overtime-N rounds and ends with a unique ranking', () => {
    // Public seed 4 reaches overtime under the 2026-10-29 PvE damage rule.
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 4 });
    room.start();
    const names = new Map<number, string>();
    const ids = new Map<number, string>();
    const unsubscribe = room.subscribe(state => { names.set(state.round, state.roundName); ids.set(state.round, state.roundId); });
    const state = runUntil(room, clock, current => current.phase === 'ended', 20_000);
    unsubscribe();
    expect(state.fault).toBeNull();
    expectUniqueRanking(state);
    expect(state.settlements.length).toBe(state.round);
    // overtime-N follows the catalog's final round 6-7 with strictly increasing ordinals and names "加时 N".
    const final = [...ids].find(([, id]) => id === '6-7')![0];
    const overtime = [...ids].filter(([, id]) => id.startsWith('overtime-'));
    expect(overtime.length).toBeGreaterThanOrEqual(1);
    for (const [round, id] of overtime) {
      expect(id).toBe(`overtime-${round - final}`);
      expect(names.get(round)).toBe(`加时 ${round - final}`);
    }
    expect(state.roundId).toBe(overtime.at(-1)![1]);
    expect(state.seats.filter(seat => seat.alive).length).toBeLessThanOrEqual(1);
    // Each overtime round the rules recorded was published once by the room.
    for (const seat of state.seats) {
      for (const record of seat.match.roundResults.filter(entry => entry.roundId.startsWith('overtime-'))) expect(state.settlements).toContain(`${state.roomId}:round-${record.round}`);
    }
  }, 60_000);

  it('ends a match of eight empty boards in a bounded number of rounds (every draw costs both real seats HP)', () => {
    // Seed 0 now chooses I'm the Carry Now at 4-2: its unsellable carry-golem breaks the empty-board precondition.
    // Seed 3 keeps all eight PvP boards empty through public sell commands; the zero-unit assertion below stays exact.
    const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 3 });
    room.start();
    const hpByRound: { kind: string | null; hp: number }[] = [];
    let lastCleared = -1;
    const clearBoards = (state: RoomState) => {
      if (state.phase !== 'preparation' || state.round === lastCleared) return;
      lastCleared = state.round;
      answerOpenChoices(room);
      // Sell every own unit: a benched one would be put back on the board at the deadline (T10 auto-deploy).
      for (const seat of state.seats) {
        if (!seat.alive) continue;
        for (const unit of seat.match.preparation.units) if (unit.team === 'player') room.handle(seat.seatId, { type: 'sell', unitId: unit.id });
      }
    };
    let state = room.state;
    for (let fired = 0; fired < 20_000 && state.phase !== 'ended'; fired++) {
      clearBoards(room.state);
      if (room.state.phase === 'battle') {
        for (const battle of room.state.battles) if (battle.kind === 'two-sided') expect(battle.battle.initial.units).toHaveLength(0);
      }
      if (room.state.phase === 'settlement' && hpByRound[room.state.round] === undefined) hpByRound[room.state.round] = { kind: room.state.roundKind, hp: room.state.seats.reduce((sum, seat) => sum + seat.hp, 0) };
      if (!clock.runNext()) break;
      state = room.state;
    }
    expect(state.phase).toBe('ended');
    expect(state.fault).toBeNull();
    expectUniqueRanking(state);
    // Bounded: at most 800 committed rounds after the catalog (contract §11.5); in practice far fewer.
    expect(state.round).toBeLessThan(38 + 800);
    // Every committed PvP round (overtime included) costs the survivors HP: an empty-board draw is never free.
    const recorded = hpByRound.flatMap((entry, round) => entry === undefined ? [] : [{ round, ...entry }]);
    expect(recorded.filter(entry => entry.kind === 'pvp').length).toBeGreaterThan(0);
    for (let index = 1; index < recorded.length; index++) if (recorded[index]!.kind === 'pvp') expect(recorded[index]!.hp, `round ${recorded[index]!.round}`).toBeLessThan(recorded[index - 1]!.hp);
  }, 60_000);
});
