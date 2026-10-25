import { createRequire } from 'node:module';
import { afterAll, describe, expect, it } from 'vitest';
import { readLootView } from '../../src/simulation/loot-view';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { BotDriver } from '../../src/server/room/bot-driver';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { toPlayerView, toSeatPrivateView } from '../../src/server/room/projection';
import { NET_PROTOCOL_VERSION, parseClientMessage } from '../../src/server/net/messages';
import { grantMechanicGold, grantMechanicItem, grantMechanicConsumable, grantMechanicUnit } from '../../src/simulation/seat-mechanics/grants';
import { openMechanicChoice } from '../../src/simulation/seat-mechanics/choices';
import { readG23Progress, writeG23Progress } from '../../src/simulation/g2-3-state';
import { G23_CONQUEROR_CHESTS, g23ConquerorReward } from '../../src/simulation/content/g2-3-policy';
import type { WireCommand } from '../../src/server/protocol';
import { answerOpenChoices, makeRoom, runUntil } from './helpers';
import { claimAnvils, openAnvil, seatOf } from './anvil-room-helpers';
import { expectOk, hasKey, seatTwo, startServer } from './net/helpers';

const driver = createRequire(import.meta.url)('../../scripts/room-command-robustness.cjs');
const api = { readLootView, Room, ROOM_TIMING_DEFAULTS, ManualClock, BotDriver, TwoSidedBattleResolver, toPlayerView, toSeatPrivateView,
  NET_PROTOCOL_VERSION, parseClientMessage, grantMechanicGold, grantMechanicItem, grantMechanicConsumable, grantMechanicUnit,
  openMechanicChoice, readG23Progress, writeG23Progress, G23_CONQUEROR_CHESTS, g23ConquerorReward };
const factory = (seed: number) => makeRoom(new TwoSidedBattleResolver(), { seed });
function staged() {
  const context = factory(230025);
  context.room.start(); driver.seedAssets(context.room, api);
  return context;
}
function refused(room: Room, seatId: string, command: WireCommand) {
  const before = room.state, bytes = JSON.stringify(before);
  expect(room.handle(seatId, command).ok).toBe(false);
  expect(room.state).toBe(before);
  expect(JSON.stringify(room.state)).toBe(bytes);
}

describe('v23 room command robustness: offline seeded driver', () => {
  for (const seed of [230025, 230026, 230027]) it(`same input has the same complete checkpoint digest, seed ${seed}`, () => {
    const first = driver.runRoom(api, seed, { factory, maxTurns: 18 });
    const second = driver.runRoom(api, seed, { factory, maxTurns: 18 });
    expect(first.error, first.stack).toBeNull(); expect(second.error, second.stack).toBeNull();
    expect(second.hash).toBe(first.hash); expect(second.stats).toEqual(first.stats);
    expect(Object.values(first.stats.accepted).reduce((sum: number, n) => sum + Number(n), 0)).toBeGreaterThan(0);
  });

  it('reduces an injected driver failure to one necessary command', () => {
    class ThrowingRoom extends Room {
      override handle(seatId: string, command: WireCommand) {
        if (command.type === 'sell') throw new Error('qa-synthetic-throw');
        return super.handle(seatId, command);
      }
    }
    const injected = { ...api, Room: ThrowingRoom };
    const failed = driver.runRoom(injected, 230025, { maxTurns: 18 });
    expect(failed.error).toBe('qa-synthetic-throw');
    const minimal = driver.minimize(injected, failed);
    expect(minimal).toHaveLength(1);
    expect(driver.runRoom(injected, failed.seed, { trace: minimal }).error).toBe(failed.error);
    expect(driver.runRoom(injected, failed.seed, { trace: [] }).error).toBeNull();
  });

  it('rejects every malformed shape before dispatch, including injected seat identity', () => {
    const { room } = staged();
    try {
      const before = room.state, bytes = JSON.stringify(before);
      for (const command of driver.MALFORMED) {
        expect(parseClientMessage(JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId: 99, type: 'command', roomId: before.roomId, round: before.round, seatRevision: 0, command }))).toMatchObject({ ok: false });
        expect(room.state).toBe(before); expect(JSON.stringify(room.state)).toBe(bytes);
      }
    } finally { room.dispose(); }
  });

  it('keeps invalid shop, unit, equipment, consumable and orb commands atomic; valid commands still apply', () => {
    const { room } = staged();
    try {
      const mine = () => seatOf(room.state, 's0').match;
      for (const command of [
        { type: 'buy', slot: 0, generation: mine().shop.generation + 1 },
        { type: 'sell', unitId: 'unknown-unit' },
        { type: 'deploy', unitId: 'unknown-unit', target: { kind: 'bench', slot: 0 } },
        { type: 'equip', unitId: 'unknown-unit', itemId: 'unknown-item', slot: 0 },
        { type: 'useConsumable', consumableId: 'unknown-tool', target: { kind: 'unit', unitId: 'unknown-unit' } },
        { type: 'claimOrb', round: mine().round, orbId: 'unknown-orb' },
      ] as const) refused(room, 's0', command);
      refused(room, 'unknown-seat', { type: 'reroll' });
      const unit = mine().preparation.units.find(u => u.team === 'player')!;
      const sword = mine().items.find(i => i.definitionId === 'sword')!;
      const tool = mine().consumables.find(c => c.definitionId === 'magnetic-remover')!;
      expectOk(room.handle('s0', { type: 'equip', itemId: sword.id, unitId: unit.id, slot: 0 }));
      expect(mine().items.find(i => i.id === sword.id)?.location).toEqual({ kind: 'unit', unitId: unit.id, slot: 0 });
      expectOk(room.handle('s0', { type: 'useConsumable', consumableId: tool.consumableId, target: { kind: 'unit', unitId: unit.id } }));
      refused(room, 's0', { type: 'useConsumable', consumableId: tool.consumableId, target: { kind: 'unit', unitId: unit.id } });
      const beforeXp = mine().xp, beforeLevel = mine().level;
      expectOk(room.handle('s0', { type: 'buyXp' }));
      expect(mine().level > beforeLevel || mine().xp > beforeXp).toBe(true);
      const generation = mine().shop.generation;
      expectOk(room.handle('s0', { type: 'reroll' })); expect(mine().shop.generation).toBe(generation + 1);
    } finally { room.dispose(); }
  });

  it('claims an orb and opens its authenticated anvil; stale, foreign and repeated choices do not pay twice', () => {
    const { room } = staged();
    try {
      const [anvil] = claimAnvils(room, 's0'); expect(anvil).toBeDefined();
      const choice = openAnvil(room, 's0', anvil!.id);
      const command = { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[0]! } as const;
      refused(room, 's0', { ...command, generation: choice.generation + 1 });
      refused(room, 's1', command);
      refused(room, 's0', { ...command, definitionId: 'not-offered' });
      expectOk(room.handle('s0', command));
      refused(room, 's0', command); refused(room, 's0', { type: 'openAnvil', unitId: anvil!.id });
      expect(seatOf(room.state, 's0').match.seatMechanics!.receipts.filter(r => r.receiptId === choice.choiceId)).toHaveLength(1);
    } finally { room.dispose(); }
  });

  it('charges a paid armory option once, and exposes no private fields in either public projection', () => {
    const { room, clock } = staged();
    try {
      const seat = seatOf(room.state, 's1'), choice = seat.match.pendingChoice!;
      const command = { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: 'paid' } as const;
      expectOk(room.handle('s1', command)); expect(seatOf(room.state, 's1').match.gold).toBe(seat.match.gold - 3);
      refused(room, 's1', command);
      for (const owner of ['s0', 's1']) {
        const publicView = toPlayerView(room.state, owner, clock.now());
        for (const key of ['shop', 'gold', 'xp', 'pendingChoice', 'rngState', 'seatMechanics', 'unclaimedOrbs', 'consumables']) expect(hasKey(publicView, key), key).toBe(false);
      }
    } finally { room.dispose(); }
  });

  it('rejects a command while waiting and a choice during battle, without changing room state', () => {
    const { room, clock } = factory(230025);
    try {
      refused(room, 's0', { type: 'reroll' }); room.start();
      runUntil(room, clock, state => state.phase === 'battle');
      refused(room, 's0', { type: 'choose', choiceId: 'expired-augment', generation: 0, definitionId: 'missing' });
    } finally { room.dispose(); }
  });
});

describe('v23 network envelope regression with the existing test client and fake clock', () => {
  it('rejects stale revisions/rounds and spoofed seats, deduplicates requests and still applies a fresh command', async () => {
    const harness = await startServer();
    try {
      const [a, b] = await seatTwo(harness);
      const room = harness.server.room!, seat = seatOf(room.state, a.seatId!);
      const command = { type: 'shopLock', locked: true, generation: seat.match.shop.generation } as const;
      for (const overrides of [{ seatRevision: seat.seatRevision + 1 }, { round: room.state.round + 1 }, { round: room.state.round - 1 }]) {
        const before = room.state, bytes = JSON.stringify(before);
        expect(await a.command(command, overrides)).toMatchObject({ ok: false, reason: 'seatRevision' in overrides ? 'seat-revision-mismatch' : 'stale-round' });
        expect(room.state).toBe(before); expect(JSON.stringify(room.state)).toBe(bytes);
      }
      const before = room.state, index = a.inbox.length, commandId = a.commandCounter++;
      a.sendRaw(JSON.stringify({ protocolVersion: NET_PROTOCOL_VERSION, commandId, type: 'command', roomId: before.roomId,
        round: before.round, seatRevision: seat.seatRevision, seatId: b.seatId, command }));
      expect(await a.waitFor(m => m.type === 'receipt' && m.commandId === commandId, undefined, index)).toMatchObject({ ok: false, reason: 'invalid-message' });
      expect(room.state).toBe(before);
      const id = a.commandCounter, revision = seat.seatRevision;
      const accepted = await a.command(command, { seatRevision: revision }, id); expectOk(accepted);
      await a.waitFor(m => m.type === 'state' && m.seatRevision === revision + 1);
      const after = room.state, bytes = JSON.stringify(after);
      expect(await a.command(command, { seatRevision: revision }, id)).toEqual(accepted);
      expect(room.state).toBe(after); expect(JSON.stringify(room.state)).toBe(bytes);
      expect(await a.command({ ...command, locked: false }, { seatRevision: revision }, id)).toMatchObject({ ok: false, reason: 'commandId-conflict' });
      expect(room.state).toBe(after);
      expect(await a.command({ ...command, locked: false }, { seatRevision: revision })).toMatchObject({ ok: false, reason: 'seat-revision-mismatch' });
      expect(room.state).toBe(after); expect(JSON.stringify(room.state)).toBe(bytes);
      expectOk(await a.command({ ...command, locked: false }));
      expect(seatOf(room.state, b.seatId!).match).toBe(seatOf(before, b.seatId!).match);
      await a.waitFor(m => m.type === 'state' && m.seatRevision === seatOf(room.state, a.seatId!).seatRevision);
      for (const client of [a, b]) {
        const ownSeat = seatOf(room.state, client.seatId!);
        expect(client.state).toEqual(toSeatPrivateView(ownSeat.match, ownSeat.choiceDeadline));
        for (const key of ['rngState', 'sharedPool', 'battleSeedRngState']) expect(hasKey(client.state, key), key).toBe(false);
      }
      for (const client of [a, b]) for (const key of ['shop', 'gold', 'xp', 'pendingChoice', 'rngState', 'seatMechanics']) expect(hasKey(client.view, key), key).toBe(false);
    } finally { await harness.close(); }
  });
});

// Bound each real-route slice; the last slice of every round asserts the target phase.
describe('v23 real augment and component-loot choice route', () => {
  let route: ReturnType<typeof makeRoom> | undefined;
  afterAll(() => route?.room.dispose());
  const checked = new Set<number>();
  for (let round = 1; round <= 7; round++) for (let part = 1; part <= 16; part++) it(`round ${round}, clock slice ${part}`, () => {
    if (!route) { route = makeRoom(new TwoSidedBattleResolver(), { seed: 42, sliceTicks: 100 }); route.room.start(); }
    const { room, clock } = route;
    if (part === 1 && room.state.round < round) answerOpenChoices(room);
    const reached = () => room.state.round === round && (room.state.phase === 'preparation' || room.state.phase === 'choice');
    for (let fired = 0; fired < 16 && !reached(); fired++) expect(clock.fireNext()).toBe(true);
    expect(room.state.fault).toBeNull();
    if (part === 16) { expect(reached()).toBe(true); expect(room.state.round).toBe(round); }
    if (reached() && !checked.has(round) && (round === 4 || round === 7)) {
      const own = seatOf(room.state, 's0').match, choice = own.pendingChoice!;
      expect(choice.kind).toBe(round === 4 ? 'augment' : 'component');
      const command = { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: choice.offers[0]! } as const;
      refused(room, 's0', { ...command, generation: choice.generation + 1 });
      const otherBefore = seatOf(room.state, 's1').match;
      const mineBefore = seatOf(room.state, 's0').match;
      if (otherBefore.pendingChoice?.choiceId === choice.choiceId && otherBefore.pendingChoice.offers.includes(command.definitionId)) {
        expectOk(room.handle('s1', command));
        expect(seatOf(room.state, 's0').match).toBe(mineBefore);
      } else refused(room, 's1', command);
      expectOk(room.handle('s0', command)); refused(room, 's0', command);
      if (round === 4) expect(seatOf(room.state, 's0').match.augments.some(a => a.choiceId === choice.choiceId)).toBe(true);
      else expect(seatOf(room.state, 's0').match.items.some(i => i.definitionId === command.definitionId)).toBe(true);
      checked.add(round);
    }
  });
});
