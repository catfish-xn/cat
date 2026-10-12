import { afterEach, describe, expect, it } from 'vitest';
import { TwoSidedBattleResolver } from '../../../src/server/room/two-sided-resolver';
import { CLOSE_CODES } from '../../../src/server/net/server';
import { COMBAT_SPLIT, type ServerMessage } from '../../../src/server/net/messages';
import type { Receipt } from '../../../src/server/net/test-client';
import { DamageResolver, TIMINGS } from '../helpers';
import { expectOk, flush, hasKey, messagesOfType, seatTwo, startServer, type NetHarness } from './helpers';

let harness: NetHarness | null = null;
afterEach(async () => { await harness?.close(); harness = null; });

const appliedRevision = (receipt: Receipt): number => receipt.ok && receipt.result.kind === 'applied' ? receipt.result.seatRevision : -1;

describe('game server: visibility', () => {
  it('shows the other seat its level and HP changes but never its shop or private state', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const [a, b] = await seatTwo(harness);
    const room = harness.server.room!;
    const seatA = a.seatId!, seatB = b.seatId!;
    const seatOf = (seatId: string) => room.state.seats.find(seat => seat.seatId === seatId)!;
    // Round 1 starts with 0 gold: play rounds on the manual clock until A can afford experience in a preparation phase.
    let guard = 0;
    while (!(room.state.phase === 'preparation' && seatOf(seatA).match.gold >= 24) && guard++ < 400) harness.clock.runNext();
    expect(seatOf(seatA).alive).toBe(true);
    const roundsPlayed = room.state.round - 1;
    expect(roundsPlayed).toBeGreaterThan(0);
    await Promise.all([a, b].map(client => client.waitForView(view => view.phase.round === room.state.round && view.phase.kind === 'preparation')));
    await a.waitFor(message => message.type === 'state' && message.seatRevision === seatOf(seatA).seatRevision);
    // Both clients already saw everyone's HP as the rules settled it (B4: SeatState.hp is the rules' playerHp).
    expect(seatOf(seatA).hp).toBe(seatOf(seatA).match.playerHp);
    expect(b.view!.seats.find(seat => seat.seatId === seatA)!.hp).toBe(seatOf(seatA).hp);
    const levelBefore = b.view!.seats.find(seat => seat.seatId === seatA)!.level;
    let levelAfter = levelBefore;
    for (let attempt = 0; attempt < 8 && levelAfter === levelBefore; attempt++) {
      const receipt = await a.command({ type: 'buyXp' });
      if (!receipt.ok) break;
      await a.waitFor(message => message.type === 'state' && message.seatRevision === appliedRevision(receipt));
      levelAfter = seatOf(seatA).match.level;
    }
    expect(levelAfter).toBeGreaterThan(levelBefore);
    const seen = await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.level === levelAfter);
    expect(seen.seats.find(seat => seat.seatId === seatA)!.level).toBe(levelAfter);
    // One more round: the deadline freezes, resolves and (at the battle deadline) publishes the rules' settlement to everyone.
    const roundBefore = room.state.round;
    harness.clock.advance(TIMINGS.preparationMs);
    while (room.state.phase === 'battle') harness.clock.runNext();
    expect(room.state.settlements).toContain(`net-room:round-${roundBefore}`);
    // The committed view: same round, past the battle, every public HP equal to the room's authoritative HP.
    const hpView = await b.waitForView(view => view.phase.round === roundBefore && view.phase.kind !== 'combat' && view.phase.kind !== 'preparation' && view.seats.every(seat => seat.hp === seatOf(seat.seatId).hp));
    for (const seat of hpView.seats) expect(seat.hp).toBe(seatOf(seat.seatId).match.playerHp);
    await a.waitForView(view => view.seats.find(seat => seat.seatId === seatB)!.hp === seatOf(seatB).hp);
    // Nothing B received carries a shop except B's own private state, and that state is B's seat.
    const seedB = room.state.seats.find(seat => seat.seatId === seatB)!.seed;
    const seedA = room.state.seats.find(seat => seat.seatId === seatA)!.seed;
    expect(seedA).not.toBe(seedB);
    for (const message of b.inbox) {
      if (message.type === 'state') { expect(message.state.seed).toBe(seedB); continue; }
      // B3: combat frames are CombatState views, not MatchState; they carry no shop and belong to B's own battle.
      if (message.type === 'combat') { for (const frame of message.frames) expect(hasKey(frame.state, 'shop')).toBe(false); continue; }
      expect(hasKey(message, 'shop'), `${message.type} leaked a shop`).toBe(false);
      expect(hasKey(message, 'rngState'), `${message.type} leaked an rng state`).toBe(false);
    }
    expect(messagesOfType(b.inbox, 'state').length).toBeGreaterThan(0);
    expect(b.inbox.some(message => message.type === 'view' && message.view.mySeatId === seatB)).toBe(true);
    expect(b.inbox.some(message => message.type === 'view' && message.view.mySeatId !== seatB)).toBe(false);
    // Every combat message B got is B's own battle (frames carry B's seed, checked above) and only one per round.
    const combatsB = messagesOfType(b.inbox, 'combat');
    expect(combatsB.length).toBeGreaterThan(0);
    expect(new Set(combatsB.map(combat => combat.round)).size).toBe(combatsB.filter(combat => (combat.part ?? 1) === 1).length); // one battle per round; large ones arrive in parts
  }, 30_000);
});

describe('game server: rejections leave the room untouched', () => {
  it('refuses forged seats, uploaded gold, wrong protocol, wrong types and stale versions', async () => {
    harness = await startServer();
    const [a, b] = await seatTwo(harness);
    const room = harness.server.room!;
    const before = room.state;
    const generation = a.state!.shop.generation;
    const base = { roomId: before.roomId, round: before.round, seatRevision: a.stateRevision };
    const receipts = await Promise.all([
      a.send({ type: 'command', ...base, command: { type: 'reroll' }, seatId: b.seatId } as never),
      a.send({ type: 'command', ...base, command: { type: 'buy', slot: 0, generation, gold: 999 } as never }),
      a.send({ type: 'command', ...base, command: { type: 'setGold', gold: 999 } as never }),
      a.send({ type: 'command', ...base, command: { type: 'buy', slot: '0', generation } as never }),
      a.send({ type: 'command', ...base, command: { type: 'buy', slot: 0, generation: generation - 1 } }),
      a.send({ type: 'command', ...base, round: before.round + 1, command: { type: 'reroll' } }),
      a.send({ type: 'command', ...base, seatRevision: base.seatRevision + 5, command: { type: 'reroll' } }),
      a.send({ type: 'command', ...base, roomId: 'another-room', command: { type: 'reroll' } }),
      a.send({ type: 'resume', token: 'guessed-token-0000000000000000000000' }),
    ]);
    const reasons = receipts.map(receipt => receipt.ok ? 'ok' : receipt.reason);
    expect(reasons).toEqual(['invalid-message', 'invalid-message', 'invalid-message', 'invalid-message', 'stale-shop', 'stale-round', 'seat-revision-mismatch', 'wrong-room', 'invalid-token']);
    // Wrong protocol version: refused before anything else, still answered on its commandId.
    a.sendRaw(JSON.stringify({ protocolVersion: 2, commandId: 500, type: 'command', ...base, command: { type: 'reroll' } }));
    const stale = await a.waitFor(message => message.type === 'receipt' && message.commandId === 500);
    expect(stale).toMatchObject({ ok: false, reason: 'unsupported-protocol' });
    // Unparseable frames are answered with an error, not dropped silently.
    a.sendRaw('{nope');
    const error = await a.waitFor(message => message.type === 'error');
    expect(error).toMatchObject({ type: 'error', code: 'invalid-json', commandId: null });
    await flush();
    expect(room.state).toBe(before);
    // A connection without a seat cannot act or start.
    const stranger = await harness.connect();
    expect(await stranger.send({ type: 'command', ...base, command: { type: 'reroll' } })).toMatchObject({ ok: false, reason: 'not-authenticated' });
    expect(await stranger.start()).toMatchObject({ ok: false, reason: 'not-authenticated' });
    expect(room.state).toBe(before);
  });
});

describe('game server: commandId dedupe', () => {
  it('executes a repeated commandId once and refuses the same id with other content', async () => {
    harness = await startServer();
    const [a] = await seatTwo(harness);
    const room = harness.server.room!;
    const seatA = () => room.state.seats.find(seat => seat.seatId === a.seatId)!;
    const generation = a.state!.shop.generation;
    const first = await a.command({ type: 'shopLock', locked: true, generation }, { seatRevision: 0 }, 40);
    expectOk(first);
    expect(appliedRevision(first)).toBe(1);
    // The retry must repeat the exact content (same seatRevision); a different seatRevision is different content.
    const again = await a.command({ type: 'shopLock', locked: true, generation }, { seatRevision: 0 }, 40);
    expect(again).toEqual(first);
    expect(await a.command({ type: 'shopLock', locked: true, generation }, { seatRevision: 1 }, 40)).toMatchObject({ ok: false, reason: 'commandId-conflict' });
    expect(seatA().seatRevision).toBe(1); // applied once: the replay did not run the rules again
    expect(seatA().match.shop.locked).toBe(true);
    const afterReplay = room.state;
    const conflict = await a.command({ type: 'shopLock', locked: false, generation }, { seatRevision: 0 }, 40);
    expect(conflict).toMatchObject({ ok: false, reason: 'commandId-conflict' });
    expect(room.state).toBe(afterReplay);
    // A refused command is replayed as the same refusal, never re-run as a new attempt.
    const refused = await a.command({ type: 'buy', slot: 0, generation: 999 }, { seatRevision: 1 }, 41);
    expect(refused).toMatchObject({ ok: false, reason: 'stale-shop' });
    expect(await a.command({ type: 'buy', slot: 0, generation: 999 }, { seatRevision: 1 }, 41)).toEqual(refused);
  });
  it('refuses an id that fell out of the retention window and demands a resync', async () => {
    harness = await startServer({ limits: { maxMessagesPerWindow: 10_000, dedupeWindow: 4 } });
    const [a] = await seatTwo(harness);
    const generation = a.state!.shop.generation;
    for (let index = 0; index < 5; index++) {
      const receipt = await a.command({ type: 'shopLock', locked: index % 2 === 0, generation }, {}, 100 + index);
      expectOk(receipt);
      await a.waitFor(message => message.type === 'state' && message.seatRevision === appliedRevision(receipt));
    }
    const old = await a.command({ type: 'reroll' }, {}, 3);
    expect(old).toMatchObject({ ok: false, reason: 'resync-required' });
    const evicted = await a.command({ type: 'shopLock', locked: true, generation }, {}, 100);
    expect(evicted).toMatchObject({ ok: false, reason: 'resync-required' });
  });
});

describe('game server: disconnect and resume', () => {
  it('returns a dropped seat to its owner by token, snapshot before increments, and disarms the old socket', async () => {
    harness = await startServer();
    const [a, b] = await seatTwo(harness);
    const room = harness.server.room!;
    const seatA = a.seatId!, token = a.token!;
    await a.close();
    const dropped = await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.connected === false);
    expect(dropped.seats.find(seat => seat.seatId === seatA)!.alive).toBe(true);
    expect(room.state.seats.find(seat => seat.seatId === seatA)!.connected).toBe(false);
    // Resume on a fresh connection.
    const a2 = await harness.connect();
    const resumed = await a2.resume(token);
    expect(resumed).toMatchObject({ ok: true, result: { kind: 'resumed', seatId: seatA, roomId: room.state.roomId, connectionEpoch: 2, lastCommandId: 2 } });
    expect(a2.commandCounter).toBe(3); // the client continues the seat's commandId sequence
    await a2.waitFor(message => message.type === 'state');
    const kinds = a2.inbox.map(message => message.type);
    expect(kinds.slice(0, 4)).toEqual(['lobby', 'receipt', 'view', 'state']);
    expect(a2.view!.mySeatId).toBe(seatA);
    expect(a2.state!.seed).toBe(room.state.seats.find(seat => seat.seatId === seatA)!.seed);
    await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.connected === true);
    // Increments after the snapshot: a command works and the state revision follows.
    const snapshotRevision = a2.stateRevision;
    const applied = await a2.command({ type: 'shopLock', locked: !a2.state!.shop.locked, generation: a2.state!.shop.generation });
    expectOk(applied);
    const next = await a2.waitFor(message => message.type === 'state' && message.seatRevision === snapshotRevision + 1);
    expect(next.type).toBe('state');
    // A second resume while a2 is still open: a2 is told, loses the seat and cannot act; a3 can.
    const a3 = await harness.connect();
    expect(await a3.resume(token)).toMatchObject({ ok: true, result: { kind: 'resumed', connectionEpoch: 3 } });
    const superseded = await a2.waitFor(message => message.type === 'error' && message.code === 'session-superseded');
    expect(superseded.type).toBe('error');
    await a3.waitFor(message => message.type === 'state');
    const stateBefore = room.state;
    expect(await a2.command({ type: 'reroll' }, { seatRevision: a3.stateRevision })).toMatchObject({ ok: false, reason: 'not-authenticated' });
    expect(room.state).toBe(stateBefore);
    const revisionA3 = a3.stateRevision;
    expectOk(await a3.command({ type: 'shopLock', locked: !a3.state!.shop.locked, generation: a3.state!.shop.generation }));
    expect(room.state.seats.find(seat => seat.seatId === seatA)!.seatRevision).toBe(revisionA3 + 1);
    // The superseded socket is closed by the server once the grace period on the room clock passes.
    harness.clock.advance(1_000);
    expect((await a2.closed).code).toBe(CLOSE_CODES.superseded);
    // A token the old connection re-presents still works: it is the credential, not the socket, that owns the seat.
    const stranger = await harness.connect();
    expect(await stranger.resume('nope')).toMatchObject({ ok: false, reason: 'invalid-token' });
  });
  it('drops a queued player that disconnects before the match and frees the seat', async () => {
    harness = await startServer();
    const a = await harness.connect(), b = await harness.connect();
    expectOk(await a.join('甲')); expectOk(await b.join('乙'));
    await b.waitFor(message => message.type === 'lobby' && message.view.queue.length === 2);
    const token = a.token!;
    await a.close();
    const lobby = await b.waitFor(message => message.type === 'lobby' && message.view.queue.length === 1);
    expect(lobby.type).toBe('lobby');
    const a2 = await harness.connect();
    expect(await a2.resume(token)).toMatchObject({ ok: false, reason: 'invalid-token' });
  });
});

describe('game server: queue', () => {
  it('refuses the ninth join with "full" and leaves the queue at eight', async () => {
    harness = await startServer();
    const clients = await Promise.all(Array.from({ length: 9 }, () => harness!.connect()));
    const receipts = [];
    for (const [index, client] of clients.entries()) receipts.push(await client.join(`玩家 ${index + 1}`));
    expect(receipts.slice(0, 8).every(receipt => receipt.ok)).toBe(true);
    expect(receipts[8]).toMatchObject({ ok: false, reason: 'full' });
    expect(harness.server.lobby.queued).toHaveLength(8);
    const ninth = clients[8]!;
    await flush();
    expect(ninth.lobby!.queue).toHaveLength(8);
    expect(ninth.lobby!.joined).toBe(false);
    expect(ninth.seatId).toBeNull();
    // leaveQueue frees a seat and the ninth can take it.
    expectOk(await clients[0]!.leaveQueue());
    expect(await ninth.join('玩家 9')).toMatchObject({ ok: true, result: { kind: 'joined' } });
    expect(harness.server.lobby.queued.map(entry => entry.name)).toContain('玩家 9');
    expect(await clients[1]!.join('again')).toMatchObject({ ok: false, reason: 'already-joined' });
  });
  it('refuses a join while a match runs and lets a new queue form after it ends', async () => {
    harness = await startServer({}, new DamageResolver(() => 100, 0));
    const [a] = await seatTwo(harness);
    const late = await harness.connect();
    expect(await late.join('迟到')).toMatchObject({ ok: false, reason: 'in-progress' });
    harness.clock.advance(TIMINGS.preparationMs); // everyone dies at once → ended
    expect(harness.server.room!.state.phase).toBe('ended');
    const ended = await a.waitForView(view => view.phase.kind === 'ended');
    expect(ended.ranking).toHaveLength(8);
    expectOk(await late.join('迟到'));
    expectOk(await a.join('再来一局'));
    expect(harness.server.lobby.queued).toHaveLength(2);
  });
});

describe('game server: single writer', () => {
  it('runs 50 pipelined commands strictly in arrival order with no interleaving', async () => {
    harness = await startServer();
    const [a, b] = await seatTwo(harness);
    const room = harness.server.room!;
    const baseA = a.stateRevision, baseB = b.stateRevision;
    const generationA = a.state!.shop.generation, generationB = b.state!.shop.generation;
    // Each command names the revision it expects if every earlier command of the same seat was applied first.
    const sendAll = (client: typeof a, base: number, generation: number) => Array.from({ length: 50 }, (_, index) =>
      client.command({ type: 'shopLock', locked: index % 2 === 0, generation }, { seatRevision: base + index }));
    const [receiptsA, receiptsB] = await Promise.all([Promise.all(sendAll(a, baseA, generationA)), Promise.all(sendAll(b, baseB, generationB))]);
    for (const [receipts, base] of [[receiptsA, baseA], [receiptsB, baseB]] as const) {
      expect(receipts.every(receipt => receipt.ok)).toBe(true);
      expect(receipts.map(appliedRevision)).toEqual(receipts.map((_, index) => base + index + 1));
    }
    const seatA = room.state.seats.find(seat => seat.seatId === a.seatId)!, seatB = room.state.seats.find(seat => seat.seatId === b.seatId)!;
    expect(seatA.seatRevision).toBe(baseA + 50); expect(seatB.seatRevision).toBe(baseB + 50);
    expect(seatA.match.shop.locked).toBe(false); // the 50th command (index 49) unlocks
    // The receipts came back in the order the commands were sent.
    const idsA = messagesOfType(a.inbox, 'receipt').map(receipt => receipt.commandId).filter(id => id > 2);
    expect(idsA).toEqual([...idsA].sort((x, y) => x - y));
    expect(harness.server.processed).toBeGreaterThanOrEqual(100);
  });
});

describe('game server: connection limits', () => {
  it('closes a connection that sends an oversized frame', async () => {
    harness = await startServer({ limits: { maxMessageBytes: 1024, maxMessagesPerWindow: 10_000 } });
    const client = await harness.connect();
    // With permessage-deflate on, Node's built-in client reports 1006 if the close races the first (inflating) push; let it land first.
    await client.waitFor(message => message.type === 'lobby');
    client.sendRaw(JSON.stringify({ protocolVersion: 1, commandId: 1, type: 'join', name: 'x'.repeat(2048) }));
    const closed = await client.closed;
    expect(closed.code).toBe(1009);
  });
  it('rate-limits a connection on the room clock and accepts again in the next window', async () => {
    harness = await startServer({ limits: { maxMessagesPerWindow: 3, rateWindowMs: 1_000 } });
    const client = await harness.connect();
    expectOk(await client.join('甲'));
    client.sendRaw('{"protocolVersion":1,"commandId":2,"type":"start"}');
    client.sendRaw('{"protocolVersion":1,"commandId":3,"type":"leaveQueue"}');
    client.sendRaw('{"protocolVersion":1,"commandId":4,"type":"leaveQueue"}');
    const limited = await client.waitFor(message => message.type === 'error' && message.code === 'rate-limited');
    expect(limited.type).toBe('error');
    harness.clock.advance(1_000);
    client.commandCounter = 10; // ids 2–4 were spent by the raw frames above
    expect(await client.send({ type: 'leaveQueue' })).toMatchObject({ ok: false, reason: 'not-queued' }); // the room already started: not queued any more
  });
});

describe('game server: whole match over the wire', () => {
  it('drives two clients from the queue to a full ranking with combat frames on the manual clock', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const [a, b] = await seatTwo(harness);
    const room = harness.server.room!;
    const phase = () => room.state.phase;
    let guard = 0;
    while (phase() !== 'ended' && guard++ < 2_000) {
      // Answer choices like a player would; everything else idles.
      for (const client of [a, b]) {
        const seat = room.state.seats.find(candidate => candidate.seatId === client.seatId)!;
        if (phase() === 'choice' && seat.alive && seat.match.phase === 'choice' && seat.match.pendingChoice?.step === 'offer') {
          const pending = seat.match.pendingChoice;
          const receipt = await client.command({ type: 'choose', choiceId: pending.choiceId, generation: pending.generation, definitionId: pending.offers[0]! }, { round: room.state.round, seatRevision: seat.seatRevision });
          expectOk(receipt);
        }
      }
      if (phase() !== 'ended' && !harness.clock.runNext()) break;
    }
    expect(phase()).toBe('ended');
    const [endedA, endedB] = await Promise.all([a, b].map(client => client.waitForView(view => view.phase.kind === 'ended', 20_000)));
    if (room.state.fault) expect(room.state.fault.kind).toBe('overtime-unavailable'); // SR-B4-01: explicit stop after the catalog's last round
    else { expect(endedA.ranking).toHaveLength(8); expect(endedB.ranking).toHaveLength(8); expect(new Set(endedA.ranking!.map(seat => seat.rank)).size).toBe(8); }
    const combatsA = messagesOfType(a.inbox, 'combat');
    expect(combatsA.length).toBeGreaterThan(0);
    expect(combatsA.every(combat => combat.frames.length > 0 && combat.frames.every(frame => Number.isInteger(frame.state.tick)))).toBe(true);
    expect(new Set(combatsA.map(combat => combat.round)).size).toBe(combatsA.filter(combat => (combat.part ?? 1) === 1).length); // one battle per round per seat
    for (const combat of combatsA) if (combat.total !== undefined) expect(combat.frames.length).toBeLessThanOrEqual(COMBAT_SPLIT.framesPerPart);
    // Evidence for docs/UI_REQUESTS.md (wire size of full-state combat frames); the numbers are reported, not asserted.
    const bytes = (message: ServerMessage) => JSON.stringify(message).length;
    expect(Math.max(...a.inbox.map(bytes))).toBeGreaterThan(0);
  }, 60_000);
});
