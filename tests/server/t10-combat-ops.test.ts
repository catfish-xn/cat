/**
 * T10 server wiring (contract §15.2–15.4): the room's (RoomPhase, command) gate, the preparation-deadline
 * auto-deployment, the PvP roster lock and the settlement on the latest live seat. The rules themselves are
 * covered by tests/t10-*.test.ts; here only what the room orchestrates.
 */
import { describe, expect, it } from 'vitest';
import { PlaceholderBattleResolver, type BattleResolver } from '../../src/server/room/battle-resolver';
import { ROOM_COMMAND_GATE } from '../../src/server/room/room';
import { seatPushEvents } from '../../src/server/room/projection';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import type { BattleInput, BattleResult, RoomPhase, RoomState, SeatState, SharedPoolState } from '../../src/server/room/types';
import type { MatchState } from '../../src/simulation/match-types';
import type { Unit } from '../../src/simulation/units';
import { makeRoom, runUntil } from './helpers';

const OPS = ['buy', 'sell', 'reroll', 'buyXp', 'shopLock', 'deploy', 'combine', 'equip', 'useConsumable'];
const CHOICES = ['choose', 'anomalyTarget', 'anomalyReroll'];
const seat = (state: RoomState, seatId: string): SeatState => state.seats.find(candidate => candidate.seatId === seatId)!;
const own = (match: MatchState): Unit[] => match.preparation.units.filter(unit => unit.team === 'player');
const onBoard = (match: MatchState) => own(match).filter(unit => unit.location.kind === 'board');
const where = (unit: Unit) => unit.location.kind === 'bench' ? `bench:${unit.location.slot}` : `${unit.location.cell.col},${unit.location.cell.row}`;

/** Records every frozen envelope it is handed, then resolves with the real resolver. */
function recording(inner: BattleResolver = new TwoSidedBattleResolver()) {
  const inputs: BattleInput[] = [];
  const resolver: BattleResolver = { resolveBattle(input: BattleInput, pool: SharedPoolState): BattleResult { inputs.push(input); return inner.resolveBattle(input, pool); } };
  return { inputs, resolver };
}

describe('T10 room gate (contract §15.2)', () => {
  it('passes exactly OPS and CHOICES per room phase', () => {
    const expected: Record<RoomPhase, readonly string[]> = {
      waiting: [], preparation: [...OPS, ...CHOICES], choice: [...OPS, ...CHOICES], frozen: [],
      battle: OPS, 'awaiting-settlement': OPS, settlement: OPS, ended: [],
    };
    for (const phase of Object.keys(expected) as RoomPhase[]) expect([...ROOM_COMMAND_GATE[phase]].sort()).toEqual([...expected[phase]].sort());
  });

  it('in a PvP battle: shop, XP and bench pass; choices and board targets are refused with wrong-phase and change nothing', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === 5 && state.phase === 'battle');
    const s4 = () => seat(room.state, 's4');
    const before = room.state;
    // Board targets: the rules refuse them under the roster lock, without publishing anything.
    const boardUnit = onBoard(s4().match)[0]!;
    expect(room.handle('s4', { type: 'sell', unitId: boardUnit.id })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(room.handle('s4', { type: 'deploy', unitId: boardUnit.id, target: { kind: 'bench', slot: 5 } })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    const benchUnit = own(s4().match).find(unit => unit.location.kind === 'bench')!;
    expect(room.handle('s4', { type: 'deploy', unitId: benchUnit.id, target: { kind: 'board', cell: { col: 3, row: 5 } } })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(room.handle('s4', { type: 'choose', choiceId: 'x', generation: 0, definitionId: 'x' })).toMatchObject({ ok: false, reason: 'wrong-phase' });
    expect(room.state).toBe(before);
    // Operations pass the gate and the rules apply them on the live seat.
    const gold = s4().match.gold, level = s4().match.level, xp = s4().match.xp;
    expect(room.handle('s4', { type: 'buyXp' })).toMatchObject({ ok: true });
    expect(s4().match.gold).toBe(gold - 4);
    expect(s4().match.level * 1000 + s4().match.xp).toBeGreaterThan(level * 1000 + xp);
    expect(room.handle('s4', { type: 'reroll' })).toMatchObject({ ok: true });
    expect(room.handle('s4', { type: 'deploy', unitId: benchUnit.id, target: { kind: 'bench', slot: 8 } })).toMatchObject({ ok: true });
    expect(room.handle('s4', { type: 'sell', unitId: benchUnit.id })).toMatchObject({ ok: true });
    expect(room.state.phase).toBe('battle');
  }, 60_000);
});

describe('T10 settlement on the latest live seat (contract §15.2)', () => {
  /** Plays to round `round` with or without operations by `seatId` during its battle; returns what the commit published. */
  function playRound(round: number, seatId: string, operate: boolean) {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === round && state.phase === 'battle');
    const battles = room.state.battles;
    const goldBefore = seat(room.state, seatId).match.gold;
    let spent = 0, bought: string | null = null;
    if (operate) {
      const match = seat(room.state, seatId).match;
      const slot = match.shop.slots.findIndex(offer => offer.status === 'available');
      const result = room.handle(seatId, { type: 'buy', slot, generation: match.shop.generation });
      expect(result.ok).toBe(true);
      if (result.ok) bought = own(result.state).find(unit => !own(match).some(old => old.id === unit.id))?.id ?? null;
      expect(room.handle(seatId, { type: 'reroll' })).toMatchObject({ ok: true });
      // 1-4 seats hold 5 gold: XP is bought where it is affordable, and refused for gold (never for the phase) otherwise.
      const affordable = seat(room.state, seatId).match.gold >= 4;
      expect(room.handle(seatId, { type: 'buyXp' })).toMatchObject(affordable ? { ok: true } : { ok: false, reason: 'insufficient-gold' });
      spent = goldBefore - seat(room.state, seatId).match.gold;
    }
    const live = seat(room.state, seatId).match;
    runUntil(room, clock, state => state.round === round && state.phase !== 'battle');
    return { room, battles, live, spent, bought, settled: seat(room.state, seatId), state: room.state };
  }

  for (const [label, round, seatId] of [['PvE (1-4)', 3, 's4'], ['PvP (2-2)', 5, 's4'], ['PvP human seat (2-2)', 5, 's0']] as const) {
    it(`${label}: operations during the battle survive the commit; gold, XP and level settle from the live state; the battle is unchanged`, () => {
      const idle = playRound(round, seatId, false), busy = playRound(round, seatId, true);
      expect(busy.state.fault).toBeNull(); expect(idle.state.fault).toBeNull();
      // The battles (replays) are the frozen ones: identical with and without the operations.
      expect(busy.battles).toEqual(idle.battles);
      expect(busy.settled.hp).toBe(idle.settled.hp);
      const record = busy.settled.match.roundResults.at(-1)!;
      expect(record.round).toBe(round);
      // Settlement read the gold left after the operations, not the pre-battle gold.
      expect(busy.spent).toBeGreaterThan(0);
      expect(record.goldBefore).toBe(busy.live.gold);
      expect(record.goldAfter).toBe(busy.settled.match.gold);
      expect(busy.settled.match.gold).toBe(busy.live.gold + record.income);
      expect(record.levelBefore).toBe(busy.live.level);
      // The bought unit is still owned (possibly merged), the shop is the rerolled one.
      expect(busy.bought).not.toBeNull();
      const idleRecord = idle.settled.match.roundResults.at(-1)!;
      expect(busy.settled.match.shop.generation).toBe(idle.settled.match.shop.generation + 1);
      expect(idleRecord.goldBefore).toBe(idle.live.gold);
      expect(own(busy.settled.match).length).toBeGreaterThan(own(idle.settled.match).length - 1);
    }, 120_000);
  }
});

describe('T10 deadline auto-deployment (contract §15.4)', () => {
  it('fills human boards to the cap from the bench, left slot first, front row centre-out 3/2/4/1/5/0/6; bots are left alone', () => {
    const { inputs, resolver } = recording();
    const { room, clock } = makeRoom(resolver);
    room.start();
    runUntil(room, clock, state => state.round === 5 && state.phase === 'preparation');
    // Human s0: send its whole board to the bench, so the deadline must place every unit itself.
    for (const unit of onBoard(seat(room.state, 's0').match)) {
      const used = new Set(own(seat(room.state, 's0').match).flatMap(other => other.location.kind === 'bench' ? [other.location.slot] : []));
      let slot = 0; while (used.has(slot)) slot++;
      expect(room.handle('s0', { type: 'deploy', unitId: unit.id, target: { kind: 'bench', slot } })).toMatchObject({ ok: true });
    }
    const before = seat(room.state, 's0').match, botBefore = seat(room.state, 's4').match;
    const cap = before.level;
    const reserves = own(before).sort((a, b) => (a.location as { slot: number }).slot - (b.location as { slot: number }).slot);
    expect(onBoard(before)).toHaveLength(0);
    expect(reserves.length).toBeGreaterThanOrEqual(cap);
    const revision = seat(room.state, 's0').seatRevision;
    clock.runNext(); // preparation deadline → frozen → battle
    expect(room.state.phase).toBe('battle');
    const after = seat(room.state, 's0');
    // Independent expectation from the contract text: front row 4 first, columns 3,2,4,1,5,0,6.
    const cells = [4, 5, 6, 7].flatMap(row => [3, 2, 4, 1, 5, 0, 6].map(col => `${col},${row}`));
    const expected = reserves.slice(0, cap).map((unit, index) => [unit.id, cells[index]]);
    expect(onBoard(after.match).map(unit => [unit.id, where(unit)]).sort()).toEqual(expected.sort());
    expect(after.match.multiplayer?.combatRosterLocked).toBe(true);
    // One publication for deployment and lock; its events go out with that state push, one per moved unit, in order.
    expect(after.seatRevision).toBe(revision + 1);
    const events = seatPushEvents(after);
    expect(events.map(event => event.type === 'unitDeployed' ? [event.unitId, where({ location: event.to } as Unit)] : null)).toEqual(expected);
    // The frozen PvP envelope is the deployed lineup.
    const envelope = inputs.find(input => input.round === 5 && input.seats.some(entry => entry.seatId === 's0'))!;
    const frozen = envelope.seats.find(entry => entry.seatId === 's0')!.state;
    expect(onBoard(frozen).map(where).sort()).toEqual(expected.map(([, cell]) => cell).sort());
    // A bot seat is not auto-deployed (its board stays as it chose).
    expect(onBoard(seat(room.state, 's4').match).map(where)).toEqual(onBoard(botBefore).map(where));
  }, 60_000);

  it('a full board or an empty bench publishes no deployment', () => {
    const { room, clock } = makeRoom(new PlaceholderBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === 2 && state.phase === 'preparation');
    // Round 1-3: s0 has one unit on the board at level 2 and one on the bench; sell the bench one.
    const match = seat(room.state, 's0').match;
    for (const unit of own(match).filter(unit => unit.location.kind === 'bench')) room.handle('s0', { type: 'sell', unitId: unit.id });
    const board = onBoard(seat(room.state, 's0').match).map(where);
    clock.runNext();
    expect(onBoard(seat(room.state, 's0').match).map(where)).toEqual(board);
    expect(seatPushEvents(seat(room.state, 's0')).filter(event => event.type === 'unitDeployed')).toEqual([]);
  }, 30_000);
});

describe('T10 deferred merge after the battle (contract §15.3)', () => {
  it('board A + bench A + a third A bought during the battle merges only after the settlement, onto the board copy', () => {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === 5 && state.phase === 'preparation');
    const s4 = () => seat(room.state, 's4');
    // Seat s4 (a bot seat: no auto-deployment) has irelia on the board and two irelia offers in its shop.
    const definitionId = onBoard(s4().match)[0]!.definitionId;
    const offers = s4().match.shop.slots.flatMap((offer, slot) => offer.status === 'available' && offer.definitionId === definitionId ? [slot] : []);
    expect(offers.length).toBeGreaterThanOrEqual(2);
    expect(room.handle('s4', { type: 'buy', slot: offers[0]!, generation: s4().match.shop.generation })).toMatchObject({ ok: true });
    const copies = () => own(s4().match).filter(unit => unit.definitionId === definitionId);
    expect(copies().map(unit => [unit.starLevel, unit.location.kind]).sort()).toEqual([[1, 'bench'], [1, 'board']]);
    const boardCopy = copies().find(unit => unit.location.kind === 'board')!;
    clock.runNext(); // deadline → battle
    expect(room.state.phase).toBe('battle');
    const battle = room.state.battles.find(result => result.kind === 'two-sided' && result.participants.includes('s4'))!;
    const bought = room.handle('s4', { type: 'buy', slot: offers[1]!, generation: s4().match.shop.generation });
    expect(bought).toMatchObject({ ok: true });
    if (!bought.ok) return;
    // During the battle the board copy does not take part: three one-star copies, no upgrade event.
    expect(bought.events.some(event => event.type === 'unitUpgraded')).toBe(false);
    expect(copies().map(unit => [unit.starLevel, unit.location.kind]).sort()).toEqual([[1, 'bench'], [1, 'bench'], [1, 'board']]);
    runUntil(room, clock, state => state.round === 5 && state.phase !== 'battle');
    expect(room.state.fault).toBeNull();
    // After the settlement: one two-star copy, the board one survives where it stood; the battle itself is unchanged.
    expect(copies().map(unit => [unit.id, unit.starLevel, where(unit)])).toEqual([[boardCopy.id, 2, where(boardCopy)]]);
    expect(room.state.battles).toContain(battle);
    const upgrades = seatPushEvents(s4()).filter(event => event.type === 'unitUpgraded');
    expect(upgrades).toHaveLength(1);
    expect(upgrades[0]).toMatchObject({ survivorId: boardCopy.id, fromStar: 1, toStar: 2 });
  }, 60_000);
});

describe('T10 PvE seat the rules settle when its battle starts (empty board) — P1 regression', () => {
  /**
   * Human s0 sells its whole roster in the 1-3 preparation, so its PvE battle is lost the moment it starts and the
   * live seat is already settled during the room's battle. `operate` then sends one operation in that battle.
   */
  function emptyBoardRound(operate: 'none' | 'shopLock' | 'buy') {
    const { room, clock } = makeRoom(new TwoSidedBattleResolver());
    room.start();
    runUntil(room, clock, state => state.round === 2 && state.phase === 'preparation');
    expect(room.state.roundKind).toBe('pve');
    for (const unit of own(seat(room.state, 's0').match)) expect(room.handle('s0', { type: 'sell', unitId: unit.id })).toMatchObject({ ok: true });
    expect(own(seat(room.state, 's0').match)).toHaveLength(0);
    const hpBefore = seat(room.state, 's0').hp;
    clock.runNext(); // deadline → battle
    expect(room.state.phase).toBe('battle');
    const live = seat(room.state, 's0').match;
    expect(live.phase).toBe('settlement');
    expect(live.roundResults.at(-1)?.round).toBe(2);
    let bought: string | null = null;
    if (operate === 'shopLock') {
      expect(room.handle('s0', { type: 'shopLock', locked: true, generation: live.shop.generation })).toMatchObject({ ok: true });
    } else if (operate === 'buy') {
      const slot = live.shop.slots.findIndex(offer => offer.status === 'available');
      const result = room.handle('s0', { type: 'buy', slot, generation: live.shop.generation });
      expect(result).toMatchObject({ ok: true });
      bought = own(seat(room.state, 's0').match)[0]?.id ?? null;
    }
    const operated = seat(room.state, 's0').match;
    expect(operated === live).toBe(operate === 'none');
    runUntil(room, clock, state => state.round === 2 && state.phase !== 'battle');
    return { room, clock, hpBefore, operated, bought, settled: seat(room.state, 's0') };
  }

  for (const operate of ['shopLock', 'buy'] as const) {
    it(`a ${operate} during the battle settles from the live seat instead of ending the match`, () => {
      const idle = emptyBoardRound('none'), busy = emptyBoardRound(operate);
      expect(busy.room.state.fault).toBeNull();
      expect(busy.room.state.phase).not.toBe('ended');
      expect(busy.room.state.settlements).toContain('test-room:round-2');
      // PvE loss by the rules: the same HP as without the operation, and the room HP is the rules' record.
      const record = busy.settled.match.roundResults.at(-1)!;
      expect(record.round).toBe(2);
      expect(record.result).toBe('enemyWin');
      expect(busy.settled.hp).toBeLessThan(busy.hpBefore);
      expect(busy.settled.hp).toBe(record.hpAfter);
      expect(busy.settled.hp).toBe(idle.settled.hp);
      // The live seat, with the operation, is what was published.
      expect(busy.settled.match).toBe(busy.operated);
      if (operate === 'shopLock') expect(busy.settled.match.shop.locked).toBe(true);
      else expect(own(busy.settled.match).map(unit => unit.id)).toEqual([busy.bought]);
      // The match goes on into the next round with the operation kept.
      runUntil(busy.room, busy.clock, state => state.round === 3 && state.phase === 'preparation');
      expect(busy.room.state.fault).toBeNull();
      const next = seat(busy.room.state, 's0').match;
      if (operate === 'shopLock') expect(next.shop.locked).toBe(true);
      else expect(own(next).some(unit => unit.id === busy.bought)).toBe(true);
    }, 60_000);
  }
});
