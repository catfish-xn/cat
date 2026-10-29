import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// D3 is not registered until D5. Keep the real gift rules/commands/restore, but
// swap one dormant definition and script the draw within the eligible catalog.
const fixture = vi.hoisted(() => ({ firstTier: 'silver' as 'silver' | 'gold' }));
vi.mock('../src/simulation/content/augments', async original => {
  const actual = await original<typeof import('../src/simulation/content/augments')>();
  const { placebo: _replaced, ...definitions } = actual.AUGMENT_DEFINITIONS;
  return { ...actual, AUGMENT_DEFINITIONS: { ...definitions, 'over-encumbered': {
    id: 'over-encumbered', name: '运力不足', description: 'D3 restore fixture',
    effects: [{ kind: 'mechanic', mechanic: 'acquisitionBundle', values: { enabled: 1 } }],
  } } };
});
vi.mock('../src/simulation/content/augment-policy', async original => {
  const actual = await original<typeof import('../src/simulation/content/augment-policy')>();
  return { ...actual, AUGMENT_TIERS: { ...actual.AUGMENT_TIERS, 'over-encumbered': 'silver' },
    AUGMENT_OFFER_POLICY: { ...actual.AUGMENT_OFFER_POLICY, get tierCombinations() {
      return actual.AUGMENT_OFFER_POLICY.tierCombinations.map(r => ({ ...r, tiers: [fixture.firstTier, 'silver', 'silver'] }));
    } } };
});

import { buyUnit, combineItems, deployMatchUnit, nextRound, openAnvil, selectChoice, sellUnit,
  startMatchCombat, type MatchState } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { batch5InventoryPlan } from '../src/simulation/augment-pool-batch5-s3a';
import { academicGiftPlan } from '../src/simulation/augment-pool-batch5-s3b';
import { validateBatch5Inventory } from '../src/simulation/restore-checks/batch5-inventory-check';
import { validateAcademicGifts } from '../src/simulation/restore-checks/academic-gifts-check';
import { G24_FORGE_POOLS } from '../src/simulation/content/g2-4-forges';
import { isAnvil } from '../src/simulation/content/anvils';
import { isOverflowUnit } from '../src/simulation/bench-capacity';
import { placeCarouselUnit } from '../src/simulation/carousel-units';
import { returnLocation } from '../src/simulation/d14-runtime';
import { accepted, fieldBench, finish, freeze, reachRoundFielded, resolveM5Choices } from './match-helpers';
import { installB1Offers } from './fixtures/b1-scripted-offers';
import { claimAllOrbs, makeRoom, runUntil } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import type { ClientCommand } from '../src/server/protocol';
import { createOpeningEncounter } from '../src/simulation/opening-encounter';
import { getMultiplayerRoundById } from '../src/simulation/multiplayer-round';

for (const owner of ['fine-vintage', 'academic-research'] as const) {
  for (const mode of ['solo', 'shared'] as const) describe(`D3 ${owner} ${mode}: empty slot zero with parked units`, () => {
    let solo: MatchState, ctx: ReturnType<typeof makeRoom>, restoreOffers: () => void;
    // A checkpoint belongs to this owner/mode/round, not to the mutable route.
    // Freeze detached graphs and hand restore a fresh candidate for every case.
    const checkpoints = new Map<string, { before: MatchState; after: MatchState; text?: string }>();
    const seatId = 's0';
    const state = () => mode === 'solo' ? solo : ctx.room.state.seats.find(s => s.seatId === seatId)!.match;
    const command = (input: ClientCommand) => {
      if (mode === 'shared') { expect(ctx.room.handle(seatId, input)).toMatchObject({ ok: true }); return; }
      const s = state();
      switch (input.type) {
        case 'choose': solo = accepted(selectChoice(s, input.choiceId, input.generation, input.definitionId)); break;
        case 'buy': solo = accepted(buyUnit(s, input.slot, input.generation)); break;
        case 'sell': solo = accepted(sellUnit(s, input.unitId)); break;
        case 'deploy': solo = accepted(deployMatchUnit(s, input.unitId, input.target)); break;
        case 'combine': solo = accepted(combineItems(s, input.a, input.b)); break;
        case 'openAnvil': solo = accepted(openAnvil(s, input.unitId)); break;
        default: throw new Error(`Unsupported fixture command ${input.type}`);
      }
    };
    const choose = (definitionId: string) => {
      const c = state().pendingChoice!;
      // Fixture self-check, not a claim about the production random draw.
      expect(c.offers).toContain(definitionId);
      command({ type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId });
    };
    const checkRestore = (form: 'object' | 'JSON' | 'serialized') => {
      const s = state();
      if (mode === 'solo') {
        const text = serializeMatch(s);
        expect(restoreMatch(form === 'object' ? s : form === 'JSON' ? JSON.parse(text) : text)).toEqual(s);
      } else {
        const input = form === 'object' ? s : form === 'JSON' ? JSON.parse(JSON.stringify(s)) : JSON.stringify(s);
        expect(restoreSharedOrbSnapshot(ctx.room.state.pool, input, ctx.room.augmentHistoryAuthority(seatId))).toEqual(s);
      }
    };
    const gifts = () => owner === 'fine-vintage' ? batch5InventoryPlan(state()).anvils : academicGiftPlan(state());

    beforeAll(() => {
      fixture.firstTier = owner === 'fine-vintage' ? 'silver' : 'gold';
      restoreOffers = installB1Offers([owner, 'over-encumbered', 'rolling-for-days-i']);
      const seed = Array.from({ length: 100 }, (_, i) => i).find(i => createOpeningEncounter(i).selection.encounterId === 'none')!;
      expect(seed).toBeDefined();
      if (mode === 'solo') solo = reachRoundFielded('2-1', seed);
      else {
        ctx = makeRoom(new TwoSidedBattleResolver(), { seed, carousel: CAROUSEL_RULES_BINDING });
        ctx.room.start();
        runUntil(ctx.room, ctx.clock, s => s.round === 4 && s.phase === 'preparation');
      }
      choose(owner);
    });
    afterAll(() => { ctx?.room.dispose(); restoreOffers?.(); });

    // Shared supply rounds have a carousel phase instead of a preparation phase.
    const rounds = ['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '4-1']
      .filter(id => mode === 'solo' || !['2-4', '3-4'].includes(id));
    // Separate bounded hooks build every prefix even when a single case is
    // selected with -t. Cases never advance the route or mutate its checkpoints.
    for (const [index, roundId] of rounds.entries()) {
      beforeAll(() => {
        const before = freeze(structuredClone(state()));
        if (mode === 'shared') claimAllOrbs(ctx.room, [seatId]);
        if (roundId === '3-2') choose('over-encumbered');
        if (!roundId.startsWith('4-') && state().phase === 'preparation') {
          // Build actual reserves before the restriction, without editing state or pool.
          for (let slot = 0; slot < 5; slot++) {
            const s = state(), offer = s.shop.slots[slot];
            if (s.preparation.units.filter(u => u.location.kind === 'bench').length >= 5) break;
            if (offer.status === 'available' && s.gold >= 5) command({ type: 'buy', slot, generation: s.shop.generation });
          }
        }
        if (roundId === '4-1') {
          const s = state();
          expect(s.preparation.overflowUnitIds!.length).toBeGreaterThan(0);
          const fielded = s.preparation.units.find(u => u.team === 'player' && u.location.kind === 'board' && !isOverflowUnit(s.preparation, u.id));
          const target = fielded?.location ?? { kind: 'board' as const, cell: { col: 0, row: 4 } };
          if (fielded) command({ type: 'sell', unitId: fielded.id });
          command({ type: 'deploy', unitId: state().preparation.units.find(u => u.location.kind === 'bench')!.id, target });
        }
        if (roundId === (owner === 'fine-vintage' ? '3-5' : '4-1')) {
          const parts = state().items.filter(i => i.location.kind === 'inventory' && G24_FORGE_POOLS.TFT_ArmoryKeyComponent.includes(i.definitionId));
          expect(parts.length).toBeGreaterThanOrEqual(2);
          command({ type: 'combine', a: parts[0].id, b: parts[1].id });
        }
        if (mode === 'solo') {
          solo = resolveM5Choices(solo);
          if (solo.phase === 'preparation') solo = finish(accepted(startMatchCombat(!roundId.startsWith('4-') ? fieldBench(solo) : solo)));
          solo = accepted(nextRound(resolveM5Choices(solo), solo.round));
        } else {
          const next = getMultiplayerRoundById(rounds[index + 1] ?? '4-2').ordinal;
          runUntil(ctx.room, ctx.clock, s => s.round === next && s.phase === 'preparation');
        }
        const after = freeze(structuredClone(state()));
        // Serialization validates the same real command prefix once in setup;
        // the case times only restoration, without fighting that round again.
        checkpoints.set(roundId, freeze({ before, after,
          ...(mode === 'solo' && after.augmentHistory ? { text: serializeMatch(after) } : {}) }));
      });
      it(`progresses through ${roundId} with public commands`, () => {
        const checkpoint = checkpoints.get(roundId)!;
        expect(checkpoint.before.roundDefinitionId).toBe(roundId);
        if (checkpoint.text !== undefined) expect(restoreMatch(checkpoint.text)).toEqual(checkpoint.after);
      });
    }
    it('owes a real anvil while slot zero is empty and overflow still blocks every placement path', () => {
      expect(state().roundDefinitionId).toBe('4-2');
      choose('rolling-for-days-i');
      const s = state();
      expect(s.preparation.usableBenchSlots).toBe(1);
      expect(s.preparation.units.filter(u => u.location.kind === 'bench')).toEqual([]);
      expect(s.preparation.overflowUnitIds!.length).toBeGreaterThan(0);
      expect(gifts().length).toBeGreaterThan(0);
      expect(gifts().every(g => !s.seatMechanics?.receipts.some(r => r.receiptId === g.receiptId))).toBe(true);
      expect(returnLocation(s)).toBeNull();
      expect(placeCarouselUnit(s, { unitId: `unit-${s.nextUnitSerial}`, definitionId: 'lux', receiptId: 'd3:capacity-probe' })).toBeNull();
    });
    it.each(['object', 'JSON', 'serialized'] as const)('restores the deferred gift from %s', checkRestore);
    it('still rejects a missing gift with free capacity and no parked units', () => {
      const s = state(), unblocked = { ...s, preparation: { ...s.preparation, overflowUnitIds: [] } };
      const validate = owner === 'fine-vintage' ? validateBatch5Inventory : validateAcademicGifts;
      expect(() => validate(unblocked)).toThrow(owner === 'fine-vintage' ? 'Missing batch5 inventory anvil' : 'Invalid academic research missing anvil');
    });
    it('pays the blocked anvil once when the last parked unit is sold, and restores its birth and consumption', () => {
      const gift = gifts()[0];
      for (const unitId of [...state().preparation.overflowUnitIds!]) command({ type: 'sell', unitId });
      const receipts = () => state().seatMechanics!.receipts.filter(r => r.receiptId === gift.receiptId);
      expect(receipts()).toHaveLength(1);
      const receipt = receipts()[0];
      expect(receipt.kind).toBe('unit');
      if (receipt.kind !== 'unit') throw new Error('Missing gift unit');
      expect(state().preparation.units.find(u => u.id === receipt.unitId && isAnvil(u.definitionId))).toBeDefined();
      checkRestore('serialized');
      command({ type: 'openAnvil', unitId: receipt.unitId! });
      choose(state().pendingChoice!.offers[0]);
      expect(receipts()).toHaveLength(1);
      checkRestore('serialized');
    });
  });
}
