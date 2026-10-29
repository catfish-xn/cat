import { salvageRecipe } from '../src/simulation/augment-pool-batch5-h13-salvage';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeRoom, runUntil, claimAllOrbs } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { CAROUSEL_RULES_BINDING } from '../src/server/room/carousel';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation } from '../src/simulation/shared-pool';
import { restoreCarouselSeat } from '../src/simulation/carousel';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';

// Integrated-pool public routes: Salvage Bin+ at seed 11, Pandora III at seed 6; no runtime seed scan.
for (const [id, seed, at, supply] of [
  ['salvage-bin-plus', 11, 12, 14], ['artifactory', 0, 12, 14], ['pandoras-items-iii', 6, 4, 7],
] as const) describe(`${id} with the production carousel binding`, () => {
  const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed, carousel: CAROUSEL_RULES_BINDING });
  let seatId: string;
  const match = () => room.state.seats.find(s => s.seatId === seatId)!.match;
  beforeAll(() => room.start());
  for (let round = 2; round <= at; round++) beforeAll(() => {
    runUntil(room, clock, s => s.round === round && (s.phase === 'preparation' || s.roundKind === 'supply'));
  });
  afterAll(() => room.dispose());

  it('acquires through a public offer and prepares a real component/completed transformation', () => {
    for (const seat of room.state.seats) {
      for (let slot = -1; slot < 3; slot++) {
        let c = room.state.seats.find(s => s.seatId === seat.seatId)!.match.pendingChoice!;
        if (slot >= 0) {
          expect(room.handle(seat.seatId, { type: 'rerollAugment', choiceId: c.choiceId, generation: c.generation, optionIndex: slot }).ok).toBe(true);
          c = room.state.seats.find(s => s.seatId === seat.seatId)!.match.pendingChoice!;
        }
        if (c.offers.includes(id)) { seatId = seat.seatId; break; }
      }
      if (seatId) break;
    }
    expect(seatId, `${id} must be offered by round ${at}, seed ${seed}, after at most three slot rerolls per seat`).toBeDefined();
    const c = match().pendingChoice!;
    expect(room.handle(seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: id }).ok).toBe(true);
    claimAllOrbs(room, [seatId]);
    const components = match().items.filter(i => i.location.kind === 'inventory' && ITEM_DEFINITIONS[i.definitionId]?.kind === 'component');
    expect(components.length).toBeGreaterThanOrEqual(2);
    expect(room.handle(seatId, { type: 'combine', a: components[0].id, b: components[1].id }).ok).toBe(true);
    if (id === 'salvage-bin-plus') {
      const item = match().items.find(item=>item.location.kind==='inventory'&&salvageRecipe(item.definitionId))!;
      expect(item).toBeDefined();
      const unit = match().preparation.units.find(u => u.team === 'player' && u.definitionId !== 'trainer-golem')!;
      const slot = [0, 1, 2].find(slot => !match().items.some(i => i.location.kind === 'unit' && i.location.unitId === unit.id && i.location.slot === slot))!;
      expect(room.handle(seatId, { type: 'equip', itemId: item.id, unitId: unit.id, slot }).ok).toBe(true);
      expect(room.handle(seatId, { type: 'sell', unitId: unit.id }).ok).toBe(true);
      expect(requireAugmentFacts(match(), 'augment-item-transform', at).some(f => f.input.id === item.id)).toBe(true);
    }
  });
  for (let round = at + 1; round < supply; round++) it(`advances real combat to round ${round}`, () => {
    runUntil(room, clock, s => s.round === round && s.phase === 'preparation');
    if (id !== 'salvage-bin-plus') expect(requireAugmentFacts(match(), 'augment-item-transform', round).length).toBeGreaterThan(0);
  });
  it('both online restore boundaries preserve transforms and reject JSON/object fact forgeries', () => {
    runUntil(room, clock, s => s.round === supply && s.phase === 'carousel');
    const s = match(), carousel = room.state.carousel!.state, authority = room.augmentHistoryAuthority(seatId);
    const restoreEntries = [
      (input: unknown) => restoreSharedOrbSnapshot(room.state.pool, input, authority),
      (input: unknown) => restoreCarouselSeat(carousel, input, authority),
    ];
    for (const restore of restoreEntries) {
      for (const input of [s, JSON.stringify(s)]) expect(restore(input)).toEqual(s);
      for (const edit of [
        (x: any) => { delete x.augmentHistory; },
        (x: any) => {
          const output = x.augmentHistory.facts.find((f: any) => f.kind === 'augment-item-transform').outputs[0];
          output.definitionId = output.definitionId === 'sword' ? 'tear' : 'sword';
        },
        (x: any) => { x.augmentHistory.facts.find((f: any) => f.kind === 'augment-item-transform').resourcePrefix++; },
      ]) {
        const bad = structuredClone(s); edit(bad); expect(bad).not.toEqual(s);
        for (const input of [bad, JSON.stringify(bad)]) expect(() => restore(input)).toThrow();
      }
    }
    assertSharedPoolConservation(room.state.pool, room.state.seats.map(s => s.match));
  });
});
