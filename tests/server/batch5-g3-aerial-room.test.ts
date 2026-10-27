import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming, claimAllOrbs } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { createMatch } from '../../src/simulation/match';
import { bindSharedOpeningEncounter, createOpeningEncounter, openingEncounterId } from '../../src/simulation/opening-encounter';
import { nextRandom } from '../../src/simulation/rng';
import { generateChoices } from '../../src/simulation/choices';
import { augmentCandidates, resolveAugmentTier } from '../../src/simulation/augment-offers';
import { assertSharedPoolConservation, restoreSharedOrbSnapshot } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';
import { proposeSettlement } from '../../src/simulation/two-sided-battle';
import { rewardPlan, aerialWarfareExpected } from '../fixtures/m5/augment-rewards-oracle.cjs';

let found: { seed: number; seatId: string } | undefined;
for (let seed = 0; seed <= 100 && !found; seed++) {
  let rng = seed;
  for (let index = 0; index < 4; index++) {
    const draw = nextRandom(rng); rng = draw.state;
    const state = { ...createMatch(draw.word, { mode: 'shared-deferred' }), augmentTierSeed: seed,
      openingEncounter: bindSharedOpeningEncounter(createOpeningEncounter(seed), 'test-room', `s${index}`) };
    const pool = augmentCandidates(resolveAugmentTier(state, 'round:2-1:augment'), [], [], openingEncounterId(state), { node: '2-1', fieldedTraits: [], blocked: [] });
    if (generateChoices(pool, state.choiceRngState).offers.includes('aerial-warfare')) { found = { seed, seatId: `s${index}` }; break; }
  }
}
if (!found) throw new Error('no aerial room seed in 0..100');
const { seed, seatId } = found, { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed });
const own = () => room.state.seats.find(s => s.seatId === seatId)!.match;
afterAll(() => room.dispose());
it('starts a real online room', () => { room.start(); });
for (const round of ['1-3', '1-4', '2-1']) it(`reaches ${round} through room commands`, () => {
  runUntilClaiming(room, clock, s => s.roundId === round && s.phase === 'preparation');
});
it('selects the offered card, claims Scar/Zeri once from shared-pool orbs, deploys through real commands', () => {
  const before = own(), choice = before.pendingChoice!;
  expect(choice.offers).toContain('aerial-warfare');
  expect(room.handle(seatId, { type: 'choose', choiceId: choice.choiceId, generation: choice.generation, definitionId: 'aerial-warfare' })).toMatchObject({ ok: true });
  const expected = rewardPlan(own(), {}).gifts.filter(g => g.definitionId === 'scar' || g.definitionId === 'zeri');
  expect(expected.map(g => g.definitionId)).toEqual(['scar', 'zeri']);
  const receipts = own().seatMechanics!.receipts.filter(r => r.source === 'augment-pool-batch1');
  for (const gift of expected) expect(receipts).toContainEqual(expect.objectContaining({ receiptId: gift.receiptId, definitionId: gift.definitionId }));
  const count = receipts.length; claimAllOrbs(room, [seatId]); claimAllOrbs(room, [seatId]);
  expect(own().seatMechanics!.receipts.filter(r => r.source === 'augment-pool-batch1')).toHaveLength(count);
  const ids = ['scar', 'zeri'].map(def => own().preparation.units.find(u => u.team === 'player' && u.definitionId === def)!.id);
  for (const unit of own().preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board' && u.definitionId !== 'trainer-golem' && !ids.includes(u.id))) {
    const slot = Array.from({ length: 9 }, (_, i) => i).find(i => !own().preparation.units.some(u => u.location.kind === 'bench' && u.location.slot === i))!;
    expect(room.handle(seatId, { type: 'deploy', unitId: unit.id, target: { kind: 'bench', slot } })).toMatchObject({ ok: true });
  }
  for (const [i, id] of ids.entries()) { const r = room.handle(seatId, { type: 'deploy', unitId: id, target: { kind: 'board', cell: { col: 2, row: 4 + i * 3 } } }); expect(r, r.ok ? '' : r.reason).toMatchObject({ ok: true }); }
  assertSharedPoolConservation(room.state.pool, room.state.seats.map(s => s.match));
  for (const encode of [(s: unknown) => s, (s: unknown) => JSON.stringify(s), (s: unknown) => canonicalContent(s)]) {
    expect(restoreSharedOrbSnapshot(room.state.pool, encode(own()))).toEqual(own());
    const bad: any = structuredClone(own()); bad.seatMechanics.receipts.find((r: any) => r.receiptId === expected[0].receiptId).definitionId = 'warwick';
    expect(() => restoreSharedOrbSnapshot(room.state.pool, encode(bad))).toThrow();
  }
});
it('real online battle counts actual movement and scheduled dashes, authenticates the round trip and rejects forged stacks', () => {
  runUntilClaiming(room, clock, s => s.roundId === '2-1' && s.phase === 'settlement');
  const result = room.state.battles.find(b => b.kind === 'two-sided' && b.participants.includes(seatId));
  expect(result?.kind).toBe('two-sided'); if (!result || result.kind !== 'two-sided') throw new Error('missing online battle');
  const battle = result.battle;
  const ids = battle.mapping.filter(m => m.seatId === seatId && m.kind === 'unit').map(m => m.combatId);
  const firelights = battle.terminal.units.filter(u => ids.includes(u.id) && u.mechanics?.some(m => m.mechanic === 'aerialWarfare'));
  expect(firelights.map(u => u.definitionId).sort()).toEqual(['scar', 'zeri']);
  for (const unit of firelights) {
    const moves = battle.events.filter(e => e.type === 'movement' && e.unitId === unit.id);
    const death = battle.events.find(e => e.type === 'death' && e.unitId === unit.id), until = death?.tick ?? battle.terminal.tick;
    const expected = aerialWarfareExpected(moves as any, Math.floor(until / 120));
    expect(unit.aerialWarfare ?? { hexes: 0, dashes: 0 }).toEqual({ hexes: expected.hexes, dashes: Math.floor(until / 120) });
  }
  expect(firelights.some(u => (u.aerialWarfare?.hexes ?? 0) > 0)).toBe(true);
  expect(proposeSettlement(JSON.parse(JSON.stringify(battle)))).toEqual(result.proposals);
  for (const mutate of [
    (b: any) => { b.terminal.units.find((u: any) => u.aerialWarfare).aerialWarfare.hexes++; },
    (b: any) => { delete b.terminal.units.find((u: any) => u.aerialWarfare).aerialWarfare; },
    (b: any) => { b.terminal.units.find((u: any) => u.aerialWarfare).aerialWarfare.dashes++; },
  ]) { const bad = structuredClone(battle); mutate(bad); expect(() => proposeSettlement(bad)).toThrow(); }
  for (const encode of [(s: unknown) => s, (s: unknown) => JSON.stringify(s), (s: unknown) => canonicalContent(s)]) expect(restoreSharedOrbSnapshot(room.state.pool, encode(own()))).toEqual(own());
});
