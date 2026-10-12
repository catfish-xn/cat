import { afterEach, describe, expect, it } from 'vitest';
import { TIMINGS } from '../helpers';
import { expectOk, flush, seatTwo, startServer, type NetHarness } from './helpers';

let harness: NetHarness | null = null;
/** One long preparation phase: the whole disconnect/takeover/resume story happens inside round 1. */
const LONG = { ...TIMINGS, preparationMs: 120_000, choiceMs: 120_000 };
afterEach(async () => { await harness?.close(); harness = null; });

describe('game server: bot takeover of a disconnected seat (B6)', () => {
  it('shows the takeover to everyone after takeoverMs and hands the seat back on resume with reclaimed=true', async () => {
    harness = await startServer({ bots: { takeoverMs: 5_000 }, timings: LONG });
    const [a, b] = await seatTwo(harness);
    const room = harness.server.room!;
    const seatA = a.seatId!, token = a.token!;
    const controllerSeenByB = () => b.view!.seats.find(seat => seat.seatId === seatA)!.controller;
    expect(controllerSeenByB()).toBe('human');
    await a.close();
    await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.connected === false);
    harness.clock.advance(4_999);
    await flush();
    expect(controllerSeenByB()).toBe('human');
    harness.clock.advance(1);
    const taken = await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.controller === 'takeover');
    expect(taken.seats.find(seat => seat.seatId === seatA)!.connected).toBe(false);
    // Fill-in bots stay `bot`; B is untouched.
    expect(taken.seats.filter(seat => seat.kind === 'bot').every(seat => seat.controller === 'bot')).toBe(true);
    expect(taken.seats.find(seat => seat.seatId === b.seatId)!.controller).toBe('human');
    const a2 = await harness.connect();
    const resumed = await a2.resume(token);
    expect(resumed).toMatchObject({ ok: true, result: { kind: 'resumed', seatId: seatA, reclaimed: true } });
    expect(room.state.seats.find(seat => seat.seatId === seatA)).toMatchObject({ controller: 'human', connected: true });
    await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.controller === 'human');
    await a2.waitFor(message => message.type === 'state');
    // Back in control: the player's own commands are accepted again (or refused by the rules, never seat-controlled).
    const receipt = await a2.command({ type: 'shopLock', locked: !a2.state!.shop.locked, generation: a2.state!.shop.generation });
    expectOk(receipt);
  });

  it('a resume before takeoverMs is a plain reconnect: no takeover, no reclaimed flag', async () => {
    harness = await startServer({ bots: { takeoverMs: 5_000 }, timings: LONG });
    const [a, b] = await seatTwo(harness);
    const seatA = a.seatId!, token = a.token!;
    await a.close();
    await b.waitForView(view => view.seats.find(seat => seat.seatId === seatA)!.connected === false);
    harness.clock.advance(4_000);
    const a2 = await harness.connect();
    const resumed = await a2.resume(token);
    expect(resumed.ok).toBe(true);
    expect(resumed.ok && resumed.result.kind === 'resumed' && 'reclaimed' in resumed.result).toBe(false);
    harness.clock.advance(10_000);
    await flush();
    expect(harness.server.room!.state.seats.find(seat => seat.seatId === seatA)!.controller).toBe('human');
  });
});
