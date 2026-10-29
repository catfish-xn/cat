import { SHOP_CATALOG } from '../src/simulation/match-rules';
import { selectOpeningUnit } from '../src/simulation/opening-unit';
import {must,supplySeats,atSupply} from './p7-carousel-helper';
import { createMatch } from '../src/simulation/match';
import { restoreMatch } from '../src/simulation/serialization';
import { describe, it, expect, beforeAll } from 'vitest';
import { createSharedPool, initializeSharedSeat, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { createCarouselMatch, prepareCarouselParticipants, createCarousel, advanceCarousel, pickFromCarousel, autoPickFromCarousel, pickCarouselForSeat, autoPickCarouselForSeat, grantCarouselPick, restoreCarouselSeat, restoreCarousel, schedule, opensCarousel } from '../src/simulation/carousel';
import type { MatchState } from '../src/simulation/match-types';
import type { CarouselState } from '../src/simulation/carousel-types';
import { buySharedUnit, rerollSharedShop } from '../src/simulation/shared-pool';
import { releaseCarouselParticipant, completeCarouselForSeat, releaseCarouselSeat } from '../src/simulation/carousel';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
function opening(seats = 8) {
    const {pool,states}=supplySeats(seats);
    return {states,state:must(createCarousel(pool,'2-4',{algorithm:'lcg32-v1',state:9})).state};
}
beforeAll(()=>{supplySeats(8);});
describe('P7 carousel rule transactions', () => {
    it('deterministic nine-slot creation reserves real pool copies without mutating inputs', () => {
        const a = opening(), b = opening();
        expect(a.state).toEqual(b.state);
        expect(a.state.slots).toHaveLength(9);
        expect(a.state.pool.carouselReservations).toHaveLength(9);
        expect(a.state.rngAfter.state).not.toBe(9);
        assertSharedPoolConservation(a.state.pool, a.states);
        const r = createCarousel(a.state.pool, '2-4', { algorithm: 'lcg32-v1', state: 9 });
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.reason).toBe('carousel-exists');
            expect(r.pool).toBe(a.state.pool);
        }
    });
    it('scheme B supply: HP pairs, original cutoff, and no early close', () => {
        const { state } = opening();
        expect(schedule('2-4')).toEqual({ firstBatchMs: 6000, batchIntervalMs: 6000, tailMs: 6000 });
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
    it('restores free Irelia and existing opening economy, rejects 1-1, grants a supply pick once',()=>{
        const initial=createCarouselMatch(42),solo=createMatch(42,{mode:'shared-deferred'});
        expect(initial.preparation).toEqual(solo.preparation);expect(initial.gold).toBe(solo.gold);
        expect(initial.xp).toBe(solo.xp);expect(initial.nextUnitSerial).toBe(solo.nextUnitSerial);
        expect(initial.resourceProvenance).toEqual(solo.resourceProvenance);expect(opensCarousel(initial)).toBe(false);
        const pool=createSharedPool('no-opening',42,{seatCount:1}),rng={algorithm:'lcg32-v1' as const,state:9};
        expect(createCarousel(pool,'1-1',rng)).toEqual({ok:false,pool,rng,reason:'invalid-round',events:[]});
        expect(()=>schedule('1-1')).toThrow('invalid-round');
        const a=opening(2),ready=must(advanceCarousel(a.state,6000)).state;
        const r=must(pickCarouselForSeat(ready.pool,ready,a.states[0],'s0',0));
        expect(r.state.nextUnitSerial).toBe(a.states[0].nextUnitSerial+1);
        const restored=restoreCarousel(JSON.stringify(r.carousel));
        const repeat=must(grantCarouselPick(restored,restoreCarouselSeat(restored,JSON.stringify(r.state)),'s0'));
        expect(repeat.events).toEqual([]);expect(repeat.match).toEqual(r.state);expect(opensCarousel(r.state)).toBe(false);
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
            expect(r.events.some(e=>e.type==='carousel-picked')).toBe(true);
            expect(r.events.some(e=>e.type==='carouselGranted')).toBe(true);
            if (i===7) expect(r.events.some(e=>e.type==='carousel-closed')).toBe(true);
            a.states[i] = r.state;
            assertSharedPoolConservation(state.pool, a.states);
            }
        expect(state.status).toBe('closed');
        expect(state.pool.carouselReservations).toHaveLength(0);
        // Only shop-pool champions hold pool copies (a Gold for Dummies training dummy does not).
        expect(state.pool.holdings).toHaveLength(a.states.reduce((n,s)=>n+s.preparation.units.filter(u=>u.team==='player'&&SHOP_CATALOG.includes(u.definitionId)).length,0));
        expect(state.pool.carouselReceipts.every(r => r.status === 'granted')).toBe(true);
        const invalid = JSON.parse(JSON.stringify(state)) as CarouselState;
        Object.assign(invalid.slots[0], { pickedBy: 'absent' });
        expect(() => restoreCarousel(invalid)).toThrow();
    });
});
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
    it('full bench places a pick straight on a legal board cell and grants its item without merging', () => {
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
        expect(state.carousel!.heldCarouselUnits).toEqual([]);
        const receipt=state.carousel!.receipts.at(-1)!;
        expect(state.preparation.units.find(u=>u.id===receipt.unitId)?.location.kind).toBe('board');
        expect(picked.events.filter(e=>e.type==='unitUpgraded')).toEqual([]);
        assertSharedPoolConservation(pool,[state]);
        expect(()=>restoreCarouselSeat(picked.carousel,state)).not.toThrow();
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
        expect([1,2,3]).toContain(UNIT_DEFINITIONS[sample].cost);
        expect([1,2,3].map(cost=>unlocked.slots.filter(s=>UNIT_DEFINITIONS[s.definitionId].cost===cost).length)).toEqual([1,4,4]);
    });
});
describe('P7 boundary rejection and recovery authentication', () => {
    it('fails exhausted pools without creating a round or advancing caller RNG', () => {
        let pool = createSharedPool('small', 0, { seatCount: 1, capacities: { [selectOpeningUnit(0,'s0')]:1,darius:8 } });
        const seat = must(initializeSharedSeat(pool, createCarouselMatch(1), 's0', 0));
        pool = must(prepareCarouselParticipants(seat.pool, [{ seatId: 's0', state: seat.state }])).pool;
        pool={...pool,naturalRound:7};
        const rng = { algorithm: 'lcg32-v1' as const, state: 0 }, r = createCarousel(pool, '2-4', rng);
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
        const hp = [80, 20, 20, 100, 50], states: MatchState[] = [];
        // This ordering test needs initialized seats, not a discarded five-seat
        // simulation through 2-4: all match data below comes from the new pool.
        let pool = createSharedPool('hp', 42, { seatCount: 5 });
        for (let i = 0; i < 5; i++) {
            const r = must(initializeSharedSeat(pool, createCarouselMatch(42 + i), `s${i}`, i));
            pool = r.pool;
            states[i] = { ...r.state, playerHp: hp[i] };
        }
        pool = must(prepareCarouselParticipants(pool, states.map((state, i) => ({ seatId: `s${i}`, state })))).pool;
        pool={...pool,naturalRound:7};
        const c = must(createCarousel(pool, '2-4', { algorithm: 'lcg32-v1', state: 1 })).state;
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
    expect(released.events.some(e=>e.type==='carousel-seat-released')).toBe(true);
    expect(released.poolEvents.some(e=>e.type==='sharedSeatReleased')).toBe(true);
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
        (s:MatchState)=>{const index=s.items.findIndex(i=>i.id===s.carousel!.receipts[0].itemInstanceId);(s.items as import('../src/simulation/strategy-types').ItemInstance[])[index] = {...s.items[index],definitionId:s.items[index].definitionId==='sword'?'bow':'sword'};},
        (s:MatchState)=>{(s.resourceProvenance.entries as unknown[]).splice(r.state.resourceProvenance.entries.findIndex(e=>e.kind==='unit-acquired'&&e.source.kind==='carousel'),1);},
    ]) {
        const edited = structuredClone(r.state); mutate(edited);
        expect(()=>restoreCarouselSeat(r.carousel,edited)).toThrow();
    }
});
