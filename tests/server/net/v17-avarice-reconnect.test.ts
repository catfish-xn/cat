/**
 * v17 server acceptance 6 (docs/V17_AVARICE_ONLINE.md): a human seat picks avarice-incarnate over the wire, changes its
 * gold in a battle, drops its connection after the sample and comes back with its seat token while the live run goes
 * on, then once more after the battle. What each connection was sent (replay plus replay-tail records) adds up to the
 * replay the room settled; the settlement matches the live run; the +5 is paid once; no bank value is ever sent.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { ServerMessage } from '../../../src/server/net/messages';
import type { TestClient } from '../../../src/server/net/test-client';
import { toCombatReplayFor } from '../../../src/server/room/projection';
import type { Room } from '../../../src/server/room/room';
import { TwoSidedBattleResolver } from '../../../src/server/room/two-sided-resolver';
import type { WireCommand } from '../../../src/server/protocol';
import type { CombatReplay } from '../../../src/server-entry';
import { claimAllOrbs } from '../helpers';
import { AVARICE, avariceReceipts, boardTarget, DRAINED_GOLD, fieldBench, PRIVATE_BANK, pvpBattleOf, seatOf } from '../v17-avarice-helpers';
import { expectOk, flush, hasKey, seatTwo, startServer, type NetHarness } from './helpers';

let harness: NetHarness | null = null;
afterEach(async () => { await harness?.close(); harness = null; });

/** Sends a command once the client holds the seat's current revision. */
async function send(client: TestClient, room: Room, command: WireCommand) {
  const revision = seatOf(room.state, client.seatId!).seatRevision;
  await client.waitFor(message => message.type === 'state' && message.seatRevision === revision, 10_000);
  await client.waitFor(message => message.type === 'view' && message.view.phase.round === room.state.round, 10_000);
  const receipt = await client.command(command);
  expectOk(receipt);
  return receipt;
}
/** What a connection was shown of one battle: its replay with every later replay-tail spliced in. */
function shown(inbox: readonly ServerMessage[], battleId: string): CombatReplay | null {
  let replay: CombatReplay | null = null;
  for (const message of inbox) {
    if (message.type === 'replay' && message.battleId === battleId) replay = message.replay;
    if (message.type === 'replay-tail' && message.battleId === battleId && replay) replay = { initial: replay.initial, ticks: [...replay.ticks.slice(0, message.fromTick), ...message.ticks], terminal: message.terminal };
  }
  return replay;
}
/** Read through functions so later phase checks are not narrowed by the earlier ones. */
const phaseOf = (room: Room) => room.state.phase;
const inPvp = (room: Room, seatId: string) => room.state.phase === 'battle' && pvpBattleOf(room.state, seatId) !== undefined;
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
const PRIVATE_KEYS = ['bankSamples', 'liveGold', 'currentItemBankGold', 'openingItemBankGold', 'proposals', 'mapping', 'combat'];

describe('v17 avarice: reconnect during and after a live battle', () => {
  it('a seat that left and came back is shown the settled live replay and settles once', async () => {
    harness = await startServer({}, new TwoSidedBattleResolver());
    const [a] = await seatTwo(harness);
    const room = harness.server.room!, seatId = a.seatId!, token = a.token!;
    // To the 4-6 anomaly node (orbs claimed and the seat's reward units fielded, so it lives that long under v22).
    for (let guard = 0; !(room.state.phase === 'choice' && seatOf(room.state, seatId).match.pendingChoice?.kind === 'anomaly'); guard++) {
      expect(guard).toBeLessThan(5_000);
      expect(seatOf(room.state, seatId).alive).toBe(true);
      claimAllOrbs(room);
      fieldBench(room, seatId);
      expect(harness.clock.runNext()).toBe(true);
    }
    // Over the wire: target, paid rerolls until avarice is offered, then choose it.
    let choice = seatOf(room.state, seatId).match.pendingChoice!;
    await send(a, room, { type: 'anomalyTarget', choiceId: choice.choiceId, generation: choice.generation, unitId: boardTarget(seatOf(room.state, seatId).match) });
    for (let rerolls = 0; !seatOf(room.state, seatId).match.pendingChoice!.offers.includes(AVARICE); rerolls++) {
      expect(rerolls).toBeLessThan(400);
      choice = seatOf(room.state, seatId).match.pendingChoice!;
      await send(a, room, { type: 'anomalyReroll', choiceId: choice.choiceId, generation: choice.generation });
    }
    choice = seatOf(room.state, seatId).match.pendingChoice!;
    await send(a, room, { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: AVARICE });
    expect(avariceReceipts(seatOf(room.state, seatId).match)).toHaveLength(1);
    // Spend down under the bonus cap (an idle seat holds 200-odd gold), so a gold change moves the fight.
    while (seatOf(room.state, seatId).match.gold > DRAINED_GOLD) await send(a, room, { type: 'reroll' });
    // To the seat's next two-sided battle.
    for (let guard = 0; !inPvp(room, seatId); guard++) {
      expect(guard).toBeLessThan(5_000);
      claimAllOrbs(room);
      expect(harness.clock.runNext()).toBe(true);
    }
    const frozen = pvpBattleOf(room.state, seatId)!, battleId = frozen.battleId, round = room.state.round;
    const side = frozen.battle.a.seatId === seatId ? 'a' : 'b';
    const hp = seatOf(room.state, seatId).hp;
    await a.waitFor(message => message.type === 'replay' && message.battleId === battleId, 10_000);
    harness.clock.advance(400);
    await send(a, room, { type: 'reroll' });
    const gold = seatOf(room.state, seatId).match.gold;
    // Leave right after the sample, before the live run got to it.
    expect(room.liveFrames(battleId)).toBeNull();
    await a.close();
    await flush();
    for (let step = 0; step < 6; step++) { harness.clock.advance(200); await flush(5); }
    expect(room.state.phase).toBe('battle');
    expect(room.liveFrames(battleId)).not.toBeNull();
    // Back during the battle, then the battle plays out.
    const b = await harness.connect();
    expectOk(await b.resume(token));
    await b.waitFor(message => message.type === 'replay' && message.battleId === battleId, 10_000);
    for (let guard = 0; phaseOf(room) === 'battle' && guard < 400; guard++) { harness.clock.advance(200); await flush(5); }
    await flush();
    expect(room.state.fault).toBeNull();
    expect(room.state.round).toBe(round);
    const settled = pvpBattleOf(room.state, seatId)!;
    expect(settled).not.toBe(frozen);
    expect(settled.battle.bankSamples!.filter(sample => sample.team === (side === 'a' ? 'player' : 'enemy')).map(sample => sample.liveGold)).toEqual([gold]);
    const final = plain(toCombatReplayFor(room.state, seatId)!.replay);
    expect(plain(shown(b.inbox, battleId))).toEqual(final);
    // The first connection's records agree with the settled replay as far as they go.
    const first = shown(a.inbox, battleId)!;
    expect(plain(first.initial)).toEqual(final.initial);
    // Settled once, from the live run; the +5 was not paid again.
    expect(seatOf(room.state, seatId).hp).toBe(Math.max(0, hp - settled.proposals[side].damage));
    expect(avariceReceipts(seatOf(room.state, seatId).match)).toHaveLength(1);
    // Back once more after the battle: the replay it gets is the settled one.
    await b.close();
    const c = await harness.connect();
    expectOk(await c.resume(token));
    await flush();
    const again = shown(c.inbox, battleId);
    if (again) expect(plain(again)).toEqual(final);
    expect(avariceReceipts(seatOf(room.state, seatId).match)).toHaveLength(1);
    for (const client of [a, b, c]) for (const message of client.inbox) {
      expect(JSON.stringify(message)).not.toMatch(PRIVATE_BANK);
      if (message.type === 'replay' || message.type === 'replay-tail') for (const key of PRIVATE_KEYS) expect(hasKey(message, key)).toBe(false);
    }
  }, 180_000);
});
