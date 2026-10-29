import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Room } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { BotDriver, type BotStepRecord } from '../../src/server/room/bot-driver';
import { LocalRoomClient } from '../../src/rendering/online/local-room-client';
import { createMatch, resolveAugmentTier } from '../../src/simulation/match';
import { createOpeningEncounter } from '../../src/simulation/opening-encounter';
import { assertSharedPoolConservation } from '../../src/simulation/shared-pool-ledger';
import { whatYouReallyAreProgress } from '../../src/simulation/augment-d1';
import { restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { CAROUSEL_RULES_BINDING } from '../../src/server/room/carousel';
import { installB1Offers } from '../fixtures/b1-scripted-offers';
import { RouteClock } from './route-clock';
import { runUntil, TIMINGS } from './helpers';
import { getMultiplayerRoundById, getMultiplayerRoundByOrdinal } from '../../src/simulation/multiplayer-round';

// Script only the draw inside the production candidate pool. Stage/tier, bot policy,
// all commands, battles, rewards, projection and history authentication remain real.
const cases = [
  ['brb', '2-1', 'gold', '2-5'],
  ['over-encumbered', '2-1', 'silver', '4-1'],
  ['restart-mission', '3-2', 'silver', '3-3'],
  ['what-you-really-are', '4-2', 'prismatic', '4-3'],
] as const;
function seedFor(node: string, tier: string): number {
  const seed = Array.from({ length: 101 }, (_, i) => i).find(i => createOpeningEncounter(i).selection.encounterId === 'none'
    && resolveAugmentTier(createMatch(i), `round:${node}:augment`) === tier);
  if (seed === undefined) throw new Error('No matching tier seed in 0..100');
  return seed;
}

export function registerD5RoomRoutes(mode: 'bots' | 'two-sided' | 'placeholder'): void {
if (mode === 'bots') for (const [id, node, tier, through] of cases) describe(`real bot route: ${id}`, () => {
  let room: Room, clock: ManualClock, bots: BotDriver, restoreOffers: () => void;
  const log: BotStepRecord[] = [];
  beforeAll(() => {
    restoreOffers = installB1Offers([id]); clock = new ManualClock(); const seed = seedFor(node, tier);
    room = new Room(Array.from({ length: 8 }, (_, i) => ({ seatId: `b${i}`, name: `bot ${i}`, kind: 'bot' })), {
      roomId: 'd5-bots', seed, clock, resolver: new TwoSidedBattleResolver(), carousel: CAROUSEL_RULES_BINDING, ...TIMINGS,
    });
    bots = new BotDriver(room, seed, { onStep: record => log.push(record) }); room.start();
  });
  afterAll(() => { bots?.dispose(); room?.dispose(); restoreOffers?.(); });
  for (let round = 1; round <= getMultiplayerRoundById(through).ordinal; round++) {
    it(`reaches ${getMultiplayerRoundByOrdinal(round).roundId} on normal deadlines`, () => {
      runUntil(room, clock, s => s.round === round && (s.phase === 'preparation' || s.phase === 'carousel'));
      expect(room.state.fault).toBeNull();
    });
  }
  it('selected the registered card through bot policy, without a refused intention or pool drift', () => {
    expect(room.state.seats.some(s => s.match.augments.some(a => a.definitionId === id))).toBe(true);
    expect(log.filter(r => r.action !== 'done' && r.ok !== true)).toEqual([]);
    assertSharedPoolConservation(room.state.pool, room.state.seats.map(s => s.match));
  });
  for (let i = 0; i < 8; i++) it(`authenticates b${i} after the effect and its automatic transitions`, () => {
    const owner = room.state.seats[i], state = owner.match;
    expect(restoreSharedOrbSnapshot(room.state.pool, state, room.augmentHistoryAuthority(owner.seatId))).toEqual(state);
    if (!state.augments.some(a => a.definitionId === id)) return;
    if (id === 'brb') {
      expect(state.shop.locked).toBe(false);
      expect(state.seatMechanics?.receipts.filter(r => r.receiptId.includes('"brb"'))).toHaveLength(2);
      expect(state.carousel?.receipts.some(r => r.carouselId.endsWith(':2-4'))).toBe(true);
    }
    if (id === 'restart-mission') expect(state.resourceProvenance.entries.filter(e => e.kind === 'restart-mission-completed')).toHaveLength(1);
    if (id === 'what-you-really-are') expect(whatYouReallyAreProgress(state).count).toBeGreaterThanOrEqual(0);
  });
});

for (const [id, node, tier] of cases) for (const pvpMode of mode === 'bots' ? [] : [mode])
  describe(`local ${pvpMode} route: ${id}`, () => {
    let restoreOffers: () => void, clock: RouteClock, client: LocalRoomClient;
    let mySeatId: string | null = null, chosenRound = 0;
    async function until(predicate: () => boolean) {
      for (let i = 0; i < 20000; i++) {
        await Promise.resolve(); if (predicate()) return;
        if (!(pvpMode === 'placeholder' ? clock.fireNext() : clock.runNext())) break;
      }
      throw new Error(`Local route did not reach ${id}; last round ${client.currentRoom?.state.roundId}, fault ${JSON.stringify(client.currentRoom?.state.fault)}`);
    }
    beforeAll(() => {
      restoreOffers = installB1Offers([id]); clock = new RouteClock();

      client = new LocalRoomClient({ seed: seedFor(node, tier), clock, myName: 'D5', pvpMode,
        preparationMs: 1000, choiceMs: 500, settlementMs: 200, faultAtRound: null, carousel: true });
      client.listen({ lobby: () => {}, view: view => { mySeatId = view.mySeatId; }, state: () => {}, replay: () => {}, legend: () => {} });
      client.joinQueue('D5'); client.startMatch();
      // Scheduling seam only: bound each resolver callback, keeping every combat tick and rule.
      if (pvpMode === 'placeholder') (client.currentRoom as unknown as { options: { sliceTicks: number } }).options.sliceTicks = 25;
    });
    afterAll(() => { client?.dispose(); restoreOffers?.(); });
    function resolverCheckpoints(targetRound: () => number, label: string): void {
      if (pvpMode !== 'placeholder') return;
      for (let seat = 0; seat < 8; seat++) it(`${label}: resolves seat job ${seat + 1}/8 within the normal timeout`, async () => {
        await until(() => {
          const room = client.currentRoom!, state = room.state;
          if (state.round >= targetRound()) return true;
          if (['battle', 'settlement', 'carousel'].includes(state.phase)) return true;
          // Observe completed jobs only, never modify assets, commands, RNG or results.
          const work = (room as unknown as { resolution: { results: unknown[] } | null }).resolution;
          return state.phase === 'frozen' && (work?.results.length ?? 0) > seat;
        });
        expect(client.currentRoom!.state.fault).toBeNull();
      });
    }
    for (let round = 1; round <= getMultiplayerRoundById(node).ordinal; round++) {
      resolverCheckpoints(() => round, `before ${getMultiplayerRoundByOrdinal(round).roundId}`);
      it(`reaches ${getMultiplayerRoundByOrdinal(round).roundId}`, async () => {
        await until(() => client.currentRoom?.state.round === round && ['preparation', 'carousel'].includes(client.currentRoom.state.phase));
        expect(client.currentRoom!.state.fault).toBeNull();
      });
    }
    it('selects through the normal client command and projects its acquisition', () => {
      const room = client.currentRoom!, seat = room.state.seats.find(s => s.seatId === mySeatId)!;
      const choice = seat.match.pendingChoice!; expect(choice.offers).toContain(id);
      if (id === 'brb') expect(client.send({ type: 'shopLock', locked: true, generation: seat.match.shop.generation }).ok).toBe(true);
      expect(client.send({ type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: id }).ok).toBe(true);
      const chosen = room.state.seats.find(s => s.seatId === mySeatId)!.match; chosenRound = chosen.round;
      expect(chosen.augments.some(a => a.definitionId === id)).toBe(true);
      if (id === 'brb') expect(chosen.shop.locked).toBe(false);
    });
    resolverCheckpoints(() => chosenRound + 1, 'after acquisition');
    it('commits the next round without a room fault', async () => {
      const room = client.currentRoom!;
      await until(() => room.state.round > chosenRound && room.state.phase === 'preparation');
      expect(room.state.fault).toBeNull();
    });
    it('authenticates the resulting snapshot and placeholder counter', () => {
      const room = client.currentRoom!;
      const after = room.state.seats.find(s => s.seatId === mySeatId)!.match;
      if (id === 'what-you-really-are' && pvpMode === 'placeholder') expect(whatYouReallyAreProgress(after)).toEqual({ count: 0 });
      expect(restoreSharedOrbSnapshot(room.state.pool, after, room.augmentHistoryAuthority(mySeatId!))).toEqual(after);
    });
  });

}
