import { describe, expect, it } from 'vitest';
import { createCarousel, listCarouselSlots, restoreCarousel } from '../src/simulation/carousel';
import { carouselCostCounts } from '../src/simulation/carousel-policy';
import { placeCarouselUnit } from '../src/simulation/carousel-units';
import { COMPONENT_IDS, ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { createCarouselMatch } from '../src/simulation/match';
import { SHOP_CATALOG_BY_COST } from '../src/simulation/match-rules';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { createSharedPool, initializeSharedSeat, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { prepareCarouselParticipants } from '../src/simulation/carousel';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import type { CarouselRoundId, CarouselState } from '../src/simulation/carousel-types';
import type { SharedPoolState } from '../src/simulation/shared-pool-types';
import { must } from './p7-carousel-helper';

// Independent approved oracle: cost order 1..6. Never import production counts/odds.
const ordinary = [1, 2, 2, 2, 2, 0];
const sixCost = [1, 0, 2, 2, 2, 2];
const rounds = [
    ['2-4', [1, 4, 4, 0, 0, 0]],
    ['3-4', [1, 3, 3, 2, 0, 0]],
    ['4-4', ordinary],
    ['5-4', [0, 0, 3, 3, 3, 0]],
    ['6-4', null],
] as const;
const histogram = (carousel: CarouselState) => [1, 2, 3, 4, 5, 6].map(cost =>
    carousel.slots.filter(s => UNIT_DEFINITIONS[s.definitionId].cost === cost).length);
const seedFor = (seed: number) => (Math.imul(seed, 0x9e3779b9) ^ 0x4341524f) >>> 0;
function wordsFor(seed: number) {
    const words: number[] = [];
    for (let i = 0; i < 27; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        words.push(seed);
    }
    return words;
}
function fixture(capacities?: Record<string, number>) {
    const pool = createSharedPool('composition', 42, { seatCount: 1, ...(capacities ? { capacities } : {}) });
    const seat = must(initializeSharedSeat(pool, createCarouselMatch(42), 's0', 0));
    return { state: seat.state, pool: must(prepareCarouselParticipants(seat.pool, [{ seatId: 's0', state: seat.state }])).pool };
}
function create(pool: SharedPoolState, roundId: CarouselRoundId, seed: number) {
    return must(createCarousel({ ...pool, naturalRound: getCatalogRoundById(roundId).ordinal }, roundId,
        { algorithm: 'lcg32-v1', state: seed })).state;
}

describe('approved carousel champion composition (2026-10-29)', () => {
    it.each(rounds)('%s: 1000 seeds keep exact counts, one star, item words and the 27-word stream', (roundId, fixed) => {
        const { pool, state } = fixture(), before = structuredClone(pool);
        const items = Number(roundId[0]) >= 5
            ? Object.keys(ITEM_DEFINITIONS).filter(id => ITEM_DEFINITIONS[id].kind === 'completed').sort() : COMPONENT_IDS;
        const totals = [0, 0, 0, 0, 0, 0];
        let sixCostGroups = 0;
        for (let seed = 0; seed < 1000; seed++) {
            const initial = seedFor(seed), words = wordsFor(initial), carousel = create(pool, roundId, initial);
            const lateSix = Math.floor(words[24] * 10000 / 4294967296) < 2000;
            const expected = fixed ?? (lateSix ? sixCost : ordinary);
            const actual = histogram(carousel);
            expect(actual).toEqual(expected);
            actual.forEach((n, i) => totals[i] += n);
            if (actual[5]) sixCostGroups++;
            expect(carousel.rngBefore.state).toBe(initial);
            expect(carousel.rngAfter.state).toBe(words[26]);
            expect(carousel.slots.map(s => s.itemId)).toEqual(Array.from({ length: 9 }, (_, i) =>
                items[Math.floor(words[i * 3 + 2] * items.length / 4294967296)]));
            expect(listCarouselSlots(carousel).map(s => s.starLevel)).toEqual(Array(9).fill(1));
            if (seed < 10) {
                expect(create(pool, roundId, initial)).toEqual(carousel);
                expect(restoreCarousel(JSON.stringify(carousel))).toEqual(carousel);
                for (const slot of carousel.slots) {
                    const placed = placeCarouselUnit(state, { receiptId: 'test', unitId: 'picked', definitionId: slot.definitionId });
                    expect(placed!.units.find(u => u.id === 'picked')?.starLevel).toBe(1);
                }
            }
            assertSharedPoolConservation(carousel.pool, [state]);
        }
        expect(pool).toEqual(before);
        console.info(JSON.stringify({ roundId, seeds: 1000, totals, sixCostGroups }));
    });

    it.each([[6, 2000], [7, 5000], [8, 10000], [9, 10000], [20, 10000]])(
        'stage %i uses exactly %i Bps six-cost groups, including both threshold edges', (stage, bps) => {
            const firstNormalWord = Math.ceil(bps * 4294967296 / 10000);
            expect(carouselCostCounts(stage, 0)).toEqual(sixCost);
            expect(carouselCostCounts(stage, firstNormalWord - 1)).toEqual(sixCost);
            if (bps < 10000) expect(carouselCostCounts(stage, firstNormalWord)).toEqual(ordinary);
            expect(carouselCostCounts(stage, 0xffffffff)).toEqual(bps === 10000 ? sixCost : ordinary);
            let groups = 0;
            for (let seed = 0; seed < 10000; seed++) {
                const word = wordsFor(seedFor(seed))[24];
                const expectedSix = Math.floor(word * 10000 / 4294967296) < bps;
                expect(carouselCostCounts(stage, word)).toEqual(expectedSix ? sixCost : ordinary);
                if (expectedSix) groups++;
            }
            // This is a policy probe; the existing overtime schedule has no 7-4/8-4 carousel.
            console.info(JSON.stringify({ stage, policySeeds: 10000, sixCostGroups: groups }));
        });

    it('recovery rejects a balanced definition swap even though every cost count and pool total still matches', () => {
        const carousel = create(fixture().pool, '3-4', seedFor(0)), edited = structuredClone(carousel);
        const a = edited.slots[0], b = edited.slots.find(s => s.definitionId !== a.definitionId)!;
        Object.assign(a, { definitionId: b.definitionId });
        Object.assign(b, { definitionId: carousel.slots[0].definitionId });
        for (const slot of [a, b]) Object.assign(edited.pool.carouselReservations[slot.slot], { definitionId: slot.definitionId });
        expect(histogram(edited)).toEqual(histogram(carousel));
        assertSharedPoolConservation(edited.pool);
        expect(() => restoreCarousel(edited)).toThrow('invalid-carousel');
    });

    it.each([3, 4])('missing tiers fall back to costs 1/%i by nearest cost, lower first, decrementing each real copy', upper => {
        const { pool } = fixture();
        // Keep registered holdings; cost 2 ties between 1 and 3, and must prefer 1.
        const available = { ...pool.available }, initial = { ...pool.initial };
        for (const [id, count] of Object.entries(available)) {
            if (![1, upper].includes(UNIT_DEFINITIONS[id].cost)) { available[id] = 0; initial[id] -= count; }
        }
        const sparse = { ...pool, initial, available };
        assertSharedPoolConservation(sparse);
        const carousel = create(sparse, '2-4', seedFor(0));
        expect(histogram(carousel)).toEqual(upper === 3 ? [5, 0, 4, 0, 0, 0] : [5, 0, 0, 4, 0, 0]);
        for (const id of Object.keys(available)) expect(carousel.pool.available[id]).toBe(
            available[id] - carousel.slots.filter(s => s.definitionId === id).length);
        expect(restoreCarousel(carousel)).toEqual(carousel);
    });

    it('a depleted six-cost tier falls back to five; a six-only pool uses the existing Mel/Viktor/Warwick catalog', () => {
        const { pool } = fixture(), available = { ...pool.available }, initial = { ...pool.initial };
        for (const id of SHOP_CATALOG_BY_COST[6]) { initial[id] -= available[id]; available[id] = 0; }
        let seed = 0;
        while (Math.floor(wordsFor(seedFor(seed))[24] * 10000 / 4294967296) >= 2000) seed++;
        const noSix = create({ ...pool, initial, available }, '6-4', seedFor(seed));
        expect(histogram(noSix)).toEqual([1, 0, 2, 2, 4, 0]);
        assertSharedPoolConservation(noSix.pool);
        const sixAvailable = { ...pool.available }, sixInitial = { ...pool.initial };
        for (const [id, count] of Object.entries(sixAvailable)) {
            if (UNIT_DEFINITIONS[id].cost !== 6) { sixAvailable[id] = 0; sixInitial[id] -= count; }
        }
        const sixOnly = create({ ...pool, initial: sixInitial, available: sixAvailable }, '6-4', seedFor(seed));
        expect(histogram(sixOnly)).toEqual([0, 0, 0, 0, 0, 9]);
        expect(sixOnly.slots.every(s => ['mel', 'viktor', 'warwick'].includes(s.definitionId))).toBe(true);
        assertSharedPoolConservation(sixOnly.pool);
        expect(restoreCarousel(sixOnly)).toEqual(sixOnly);
    });
});
