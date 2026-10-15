import { restoreMatch } from '../src/simulation/serialization';
import { describe, it, expect } from 'vitest';
import { createSharedPool, initializeSharedSeat, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { createCarouselMatch, prepareCarouselParticipants, createCarousel, advanceCarousel, pickFromCarousel, autoPickFromCarousel, pickCarouselForSeat, autoPickCarouselForSeat, grantCarouselPick, restoreCarouselSeat, restoreCarousel, schedule, opensCarousel } from '../src/simulation/carousel';
import { validateB8Resources } from '../src/simulation/b8-restore';
import type { MatchState } from '../src/simulation/match-types';
import type { CarouselState } from '../src/simulation/carousel-types';
import { generateSharedShop, runSharedMatchCommand, nextSharedRound, buySharedUnit, rerollSharedShop, sellSharedUnit } from '../src/simulation/shared-pool';
import { releaseCarouselParticipant, completeCarouselForSeat, releaseCarouselSeat, resolvePendingCarouselUnits, sellPendingCarouselUnit } from '../src/simulation/carousel';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
function must<T extends {
    ok: boolean;
}>(r: T): Extract<T, {
    ok: true;
}> { if (!r.ok)
    throw Error('reason' in r ? String(r.reason) : 'fixture transaction failed'); return r as Extract<T, {
    ok: true;
}>; }
function opening(seats = 8) {
    let pool = createSharedPool('p7', 42, { seatCount: seats });
    const states: MatchState[] = [];
    for (let i = 0; i < seats; i++) {
        const r = must(initializeSharedSeat(pool, createCarouselMatch(42 + i), `s${i}`, i));
        pool = r.pool;
        states.push(r.state);
    }
    pool = must(prepareCarouselParticipants(pool, states.map((state, i) => ({ seatId: `s${i}`, state })))).pool;
    return { states, state: must(createCarousel(pool, '1-1', { algorithm: 'lcg32-v1', state: 9 })).state };
}
describe('P7 carousel rule transactions', () => {
    it('deterministic nine-slot creation reserves real pool copies without mutating inputs', () => {
        const a = opening(), b = opening();
        expect(a.state).toEqual(b.state);
        expect(a.state.slots).toHaveLength(9);
        expect(a.state.pool.carouselReservations).toHaveLength(9);
        expect(a.state.rngAfter.state).not.toBe(9);
        assertSharedPoolConservation(a.state.pool, a.states);
        const r = createCarousel(a.state.pool, '1-1', { algorithm: 'lcg32-v1', state: 9 });
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.reason).toBe('carousel-exists');
            expect(r.pool).toBe(a.state.pool);
        }
    });
    it('scheme B includes opening: HP pairs, original cutoff, and no early close', () => {
        const { state } = opening();
        expect(schedule('1-1')).toEqual({ firstBatchMs: 6000, batchIntervalMs: 6000, tailMs: 6000 });
        expect(state.deadlineMs).toBe(30000);
        const locked = pickFromCarousel(state, 's0', 0);
        expect(locked).toMatchObject({ ok: false, reason: 'seat-locked', state });
        let current = must(advanceCarousel(state, 24000)).state;
        for (let i = 0; i < 8; i++)
            current = must(pickFromCarousel(current, `s${i}`, i)).state;
        expect(current.status).toBe('open');
        expect(current.pool.carouselReservations).toHaveLength(9);
        const closed = must(advanceCarousel(current, 30000));
        expect(closed.state.status).toBe('closed');
        expect(closed.state.pool.carouselReservations).toHaveLength(8);
        expect(closed.events).toHaveLength(1);
        assertSharedPoolConservation(closed.state.pool);
    });
    it('grants one opening champion/component, zero gold/XP and restores without granting twice', () => {
        const initial = opening(2);
        let current = must(advanceCarousel(initial.state, 6000)).state;
        let match = initial.states[0];
        expect(match.gold).toBe(0);
        expect(match.items).toHaveLength(0);
        expect(match.preparation.units.filter(u => u.team === 'player')).toHaveLength(0);
        expect(opensCarousel(match)).toBe(true);
        const r = must(pickCarouselForSeat(current.pool, current, match, 's0', 0));
        current = r.carousel;
        match = r.state;
        expect(match.gold).toBe(0);
        expect(match.xp).toBe(0);
        expect(match.items).toHaveLength(1);
        expect(match.preparation.units.filter(u => u.team === 'player')).toHaveLength(1);
        expect(match.nextUnitSerial).toBe(2);
        expect(opensCarousel(match)).toBe(false);
        validateB8Resources(match);
        const recovered = restoreCarousel(JSON.stringify(current));
        const repeat = must(grantCarouselPick(recovered, restoreCarouselSeat(recovered,JSON.stringify(match)), 's0'));
        expect(repeat.events).toEqual([]);
        expect(repeat.match).toEqual(match);
        expect(repeat.state).toBe(recovered);
        assertSharedPoolConservation(recovered.pool, [match]);
    });
    it('rejects duplicate seats and occupied slots with exact original state and no events', () => {
        let { state } = opening(2);
        state = must(advanceCarousel(state, 6000)).state;
        state = must(pickFromCarousel(state, 's0', 0)).state;
        for (const [seat, slot, reason] of [['s0', 1, 'already-picked'], ['s1', 0, 'slot-taken'], ['absent', 1, 'unknown-seat'], ['s1', 9, 'invalid-slot']] as const) {
            const r = pickFromCarousel(state, seat, slot);
            expect(r).toEqual({ ok: false, state, reason, events: [] });
            expect(r.state).toBe(state);
        }
    });
    it('timeout bot strategy is deterministic and all grants conserve the shared bag', () => {
        const a = opening();
        let state = must(advanceCarousel(a.state, 30000)).state;
        for (const seatId of state.releaseOrder) {
            const i = Number(seatId.slice(1)), r = must(autoPickCarouselForSeat(state.pool, state, a.states[i], seatId, 'timeout'));
            state = r.carousel;
            a.states[i] = r.state;
            assertSharedPoolConservation(state.pool, a.states);
            validateB8Resources(r.state);
        }
        expect(state.status).toBe('closed');
        expect(state.pool.carouselReservations).toHaveLength(0);
        expect(state.pool.holdings).toHaveLength(8);
        expect(state.pool.carouselReceipts.every(r => r.status === 'granted')).toBe(true);
        const invalid = JSON.parse(JSON.stringify(state)) as CarouselState;
        Object.assign(invalid.slots[0], { pickedBy: 'absent' });
        expect(() => restoreCarousel(invalid)).toThrow();
    });
});
function atSupply() {
    const first = opening(1);
    let carousel = must(advanceCarousel(first.state, 12000)).state;
    const picked = must(autoPickCarouselForSeat(carousel.pool, carousel, first.states[0], 's0', 'timeout'));
    let pool = picked.pool, state = picked.state;
    const shop = must(generateSharedShop(pool, state, 0));
    pool = shop.pool;
    state = shop.state;
    while (state.roundDefinitionId !== '2-4') {
        let guard = 0;
        while (state.phase !== 'settlement') {
            if (++guard > 1500)
                throw Error('fixture round guard');
            const command = state.phase === 'choice' ? { type: 'timeoutChoice' as const, round: state.round, choiceId: state.pendingChoice!.choiceId, generation: state.pendingChoice!.generation } : state.m8.round.kind === 'pvp' ? { type: 'settleRound' as const, receipt: { version: 'multiplayer-settlement-v1' as const, settlementId: `p7-${state.round}`, battleId: `battle-${state.round}`, seatId: 's0', round: state.round, roundId: state.roundDefinitionId, settlementEligible: true, result: 'win' as const, damage: 0, baseDamage: 2, opposingSurvivors: 0, growth: [], combatTicks: 1, combatEventCount: 1 } } : { type: state.phase === 'combat' ? 'step' as const : 'startCombat' as const };
            const r = must(runSharedMatchCommand(pool, state, command));
            pool = r.pool;
            state = r.state;
        }
        const next = must(nextSharedRound(pool, [state], state.round));
        pool = next.pool;
        state = next.states[0];
    }
    pool = must(prepareCarouselParticipants(pool, [{ seatId: 's0', state }])).pool;
    return { pool, state };
}
function supply() { const { pool, state } = atSupply(); return { state, carousel: must(createCarousel(pool, '2-4', { algorithm: 'lcg32-v1', state: 123 })).state }; }
describe('P7 supply and capacity integration', () => {
    it('retains catalog ordinal, suppresses the old component choice, settles natural economy once at close', () => {
        let { carousel, state } = supply();
        expect(state.round).toBe(7);
        expect(state.phase).toBe('preparation');
        expect(state.pendingChoice).toBeNull();
        expect(opensCarousel(state)).toBe(true);
        const before = { gold: state.gold, items: state.items.length, roundResults: state.roundResults.length };
        carousel = must(advanceCarousel(carousel, 6000)).state;
        const picked = must(autoPickCarouselForSeat(carousel.pool, carousel, state, 's0', 'bot'));
        state = picked.state;
        carousel = picked.carousel;
        expect(state.items).toHaveLength(before.items + 1);
        expect(state.gold).toBe(before.gold);
        expect(carousel.status).toBe('open');
        expect(completeCarouselForSeat(carousel, state, 's0').ok).toBe(false);
        carousel = must(advanceCarousel(carousel, 12000)).state;
        const complete = must(completeCarouselForSeat(carousel, state, 's0'));
        expect(complete.match.roundResults).toHaveLength(before.roundResults + 1);
        expect(complete.match.phase).toBe('settlement');
        expect(complete.match.pendingChoice).toBeNull();
        const repeat = must(completeCarouselForSeat(complete.state, complete.match, 's0'));
        expect(repeat.match).toBe(complete.match);
        expect(repeat.events).toEqual([]);
    });
    it('full bench keeps real pool-owned pending card and grants its item; legal slots resolve the queue without another birth', () => {
        let { pool, state } = atSupply();
        state = { ...state, gold: 1000 };
        let carousel: CarouselState;
        for (let guard = 0; state.preparation.units.filter(u => u.location.kind === 'bench').length < 9 && guard < 100; guard++) {
            const index = state.shop.slots.findIndex(s => s.status === 'available' && state.preparation.units.filter(u => u.team === 'player' && u.definitionId === s.definitionId && u.starLevel === 1).length < 2);
            const result = must(index < 0 ? rerollSharedShop(pool, state, state.shop.generation) : buySharedUnit(pool, state, index, state.shop.generation));
            pool = result.pool;
            state = result.state;
        }
        pool = must(prepareCarouselParticipants(pool, [{ seatId: 's0', state }])).pool;
        carousel = must(createCarousel(pool, '2-4', { algorithm: 'lcg32-v1', state: 123 })).state;
        carousel = must(advanceCarousel(carousel, 6000)).state;
        const slot = carousel.slots.find(s => state.preparation.units.filter(u => u.team === 'player' && u.definitionId === s.definitionId && u.starLevel === 1).length < 2)!.slot;
        const picked = must(pickCarouselForSeat(carousel.pool, carousel, state, 's0', slot));
        state = picked.state;
        pool = picked.pool;
        expect(state.carousel!.pendingUnits).toHaveLength(1);
        const pending = state.carousel!.pendingUnits[0], serial = state.nextUnitSerial;
        pool = must(advanceCarousel(picked.carousel, 12000)).state.pool;
        const discarded = must(sellPendingCarouselUnit(pool, state, pending.unitId));
        expect(discarded.state.gold).toBe(state.gold + UNIT_DEFINITIONS[pending.definitionId].cost);
        expect(discarded.state.items).toEqual(state.items);
        expect(discarded.state.carousel!.pendingUnits).toEqual([]);
        assertSharedPoolConservation(discarded.pool, [discarded.state]);
        const sold = must(sellSharedUnit(pool, state, state.preparation.units.find(u => u.location.kind === 'bench')!.id));
        const moved = must(resolvePendingCarouselUnits(sold.pool, sold.state));
        expect(moved.state.carousel!.pendingUnits).toHaveLength(0);
        expect(moved.state.nextUnitSerial).toBe(serial);
        expect(moved.state.preparation.units.some(u => u.id === pending.unitId)).toBe(true);
        assertSharedPoolConservation(moved.pool, [moved.state]);
    });
    it('release is inert on repeat and returns its reserved copy once', () => {
        let { state } = opening(2);
        const before = Object.values(state.pool.available).reduce((a, b) => a + b, 0);
        state = must(releaseCarouselSeat(state, 's0')).state;
        expect(Object.values(state.pool.available).reduce((a, b) => a + b, 0)).toBe(before + 1);
        const again = must(releaseCarouselSeat(state, 's0'));
        expect(again.state).toBe(state);
        expect(again.events).toEqual([]);
        assertSharedPoolConservation(state.pool);
        expect(() => restoreCarousel(state)).not.toThrow();
    });
    it('bots prefer a completing triple, then higher cost, then the stable slot; invalid picks do not advance RNG', () => {
        const { state, states } = opening(2), unlocked = must(advanceCarousel(state, 6000)).state;
        const sample = unlocked.slots[0].definitionId, match = { ...states[0], preparation: { ...states[0].preparation, units: [{ id: 'score-1', definitionId: sample, team: 'player' as const, starLevel: 1 as const, location: { kind: 'bench' as const, slot: 0 } }, { id: 'score-2', definitionId: sample, team: 'player' as const, starLevel: 1 as const, location: { kind: 'bench' as const, slot: 1 } }] } };
        const automatic = must(autoPickFromCarousel(unlocked, 's0', match));
        expect(automatic.state.receipts[0].slot).toBe(0);
        expect(automatic.state.rngAfter).toBe(unlocked.rngAfter);
        expect(UNIT_DEFINITIONS[sample].cost).toBe(1);
    });
});
describe('P7 boundary rejection and recovery authentication', () => {
    it('fails exhausted pools without creating a round or advancing caller RNG', () => {
        let pool = createSharedPool('small', 0, { seatCount: 1, capacities: { darius: 8 } });
        const seat = must(initializeSharedSeat(pool, createCarouselMatch(1), 's0', 0));
        pool = must(prepareCarouselParticipants(seat.pool, [{ seatId: 's0', state: seat.state }])).pool;
        const rng = { algorithm: 'lcg32-v1' as const, state: 0 }, r = createCarousel(pool, '1-1', rng);
        expect(r).toEqual({ ok: false, pool, rng, reason: 'pool-exhausted', events: [] });
        if (!r.ok) {
            expect(r.pool).toBe(pool);
            expect(r.rng).toBe(rng);
        }
        expect(pool.carouselRounds).toEqual([]);
    });
    it('requires complete registered seats and authoritative seat bindings', () => {
        const { state, states } = opening(2), pool = state.pool;
        const incomplete = prepareCarouselParticipants(pool, [{ seatId: 's0', state: states[0] }]);
        expect(incomplete).toEqual({ ok: false, pool, reason: 'invalid-participants' });
        const wrong = prepareCarouselParticipants(pool, [{ seatId: 's0', state: states[1] }, { seatId: 's1', state: states[0] }]);
        expect(wrong.ok).toBe(false);
    });
    it('freezes low HP pairs and uses seatIndex for equal HP, including odd final batches', () => {
        const a = opening(5), states = a.states.map((s, i) => ({ ...s, playerHp: [80, 20, 20, 100, 50][i] }));
        // A new pool with matching initialized seats is used; the first creation cannot be repeated.
        let pool = createSharedPool('hp', 42, { seatCount: 5 });
        for (let i = 0; i < 5; i++) {
            const r = must(initializeSharedSeat(pool, createCarouselMatch(42 + i), `s${i}`, i));
            pool = r.pool;
            states[i] = { ...r.state, playerHp: states[i].playerHp };
        }
        pool = must(prepareCarouselParticipants(pool, states.map((state, i) => ({ seatId: `s${i}`, state })))).pool;
        const c = must(createCarousel(pool, '1-1', { algorithm: 'lcg32-v1', state: 1 })).state;
        expect(c.releaseOrder).toEqual(['s1', 's2', 's4', 's0', 's3']);
        expect(c.releaseAtMs).toEqual({ s1: 6000, s2: 6000, s4: 12000, s0: 12000, s3: 18000 });
        expect(c.deadlineMs).toBe(24000);
        expect(advanceCarousel(c, -1)).toMatchObject({ ok: false, reason: 'invalid-time', state: c });
    });
    it('rejects edited item/definition/RNG on recovery even when the edited item exists in content', () => {
        const { state } = opening(1);
        for (const mutate of [(s: CarouselState) => Object.assign(s.slots[0], { itemId: s.slots[0].itemId === 'tear' ? 'vest' : 'tear' }), (s: CarouselState) => Object.assign(s.rngAfter, { state: 0 })]) {
            const c = JSON.parse(JSON.stringify(state)) as CarouselState;
            mutate(c);
            expect(() => restoreCarousel(c)).toThrow();
        }
        expect(() => restoreCarousel({ ...state, extra: () => 0 })).toThrow();
    });
    it('does not write another pool or unlock another participant on stale state', () => {
        const { state, states } = opening(2), pool = { ...state.pool, revision: state.pool.revision + 1 }, r = pickCarouselForSeat(pool, state, states[0], 's0', 0);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.reason).toBe('stale-pool');
            expect(r.pool).toBe(pool);
            expect(r.carousel).toBe(state);
            expect(r.state).toBe(states[0]);
            expect(r.events).toEqual([]);
        }
    });
});
it('atomically releases granted and unpicked eliminated seats; repeated elimination does not return more copies', () => {
    const a = opening(2);
    let state = must(advanceCarousel(a.state, 6000)).state;
    const selected = must(pickCarouselForSeat(state.pool, state, a.states[0], 's0', 0));
    state = selected.carousel;
    const eliminated: MatchState = { ...selected.state, playerHp: 0, multiplayer: { ...selected.state.multiplayer!, status: 'eliminated' } };
    const released = must(releaseCarouselParticipant(state, eliminated, 's0'));
    state = released.state;
    assertSharedPoolConservation(state.pool, [released.match]);
    expect(state.receipts[0].status).toBe('released');
    expect(()=>restoreCarouselSeat(state,released.match)).not.toThrow();
    const repeated = must(releaseCarouselParticipant(state, released.match, 's0'));
    expect(repeated.state).toBe(state);
    expect(repeated.match).toBe(released.match);
    expect(repeated.events).toEqual([]);
    const other: MatchState = { ...a.states[1], playerHp: 0, multiplayer: { ...a.states[1].multiplayer!, status: 'eliminated' } };
    const last = must(releaseCarouselParticipant(state, other, 's1'));
    state = must(advanceCarousel(last.state, 12000)).state;
    expect(state.status).toBe('closed');
    expect(state.pool.available).toEqual(state.pool.initial);
    expect(() => restoreCarousel(state)).not.toThrow();
});

it('restores trusted carousel seat snapshots without births and rejects missing, duplicate or edited provenance', () => {
    const a = opening(2), ready = must(advanceCarousel(a.state,6000)).state;
    const r = must(pickCarouselForSeat(ready.pool,ready,a.states[0],'s0',0));
    expect(restoreCarouselSeat(r.carousel,JSON.stringify(r.state))).toEqual(r.state);
    expect(()=>restoreMatch(r.state)).toThrow();
    for (const mutate of [
        (s:MatchState)=>{(s.carousel!.receipts as unknown[]).push(s.carousel!.receipts[0]);},
        (s:MatchState)=>{(s.items as import('../src/simulation/strategy-types').ItemInstance[])[0] = {...s.items[0],definitionId:s.items[0].definitionId==='sword'?'bow':'sword'};},
        (s:MatchState)=>{(s.resourceProvenance.entries as unknown[]).splice(0,1);},
    ]) {
        const edited = structuredClone(r.state); mutate(edited);
        expect(()=>restoreCarouselSeat(r.carousel,edited)).toThrow();
    }
});
