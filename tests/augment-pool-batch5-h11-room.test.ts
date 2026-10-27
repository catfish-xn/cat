import { beforeAll, afterAll, expect, it } from 'vitest';
import { makeRoom, runUntil, answerOpenChoices } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { canonicalContent } from '../src/simulation/content';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { toPlayerView } from '../src/server/room/projection';
import { proposeSettlement } from '../src/simulation/two-sided-battle';
import { startCombatReplay } from '../src/simulation/combat-replay-view';

const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 19, combatStreaming: true });
let seatId: string;
beforeAll(() => room.start());
for (const round of [2, 3, 4]) beforeAll(() => { runUntil(room, clock, s => s.round === round && s.phase === 'preparation'); });
beforeAll(() => {
  const seat = room.state.seats.find(s => s.match.pendingChoice?.offers.includes('scavenger'));
  expect(seat, JSON.stringify(room.state.seats.map(s => [s.seatId, s.match.pendingChoice?.offers]))).toBeDefined();
  seatId = seat!.seatId;
  const c = seat!.match.pendingChoice!;
  expect(room.handle(seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'scavenger' })).toMatchObject({ ok: true });
  answerOpenChoices(room);
  for (let slot = 0; slot < 5; slot++) {
    const match = room.state.seats.find(s => s.seatId === seatId)!.match;
    room.handle(seatId, { type: 'buy', slot, generation: match.shop.generation });
  }
});
beforeAll(() => { runUntil(room, clock, s => s.round === 4 && s.phase === 'settlement'); });
afterAll(() => room.dispose());
it('B5-76 real room choice → shared pool purchase → two-sided combat grants and authenticated deaths', () => {
  expect(room.state.fault).toBeNull();
  const result = room.state.battles.find(r => r.kind === 'two-sided' && r.participants.includes(seatId));
  expect(result?.kind).toBe('two-sided'); if (result?.kind !== 'two-sided') throw new Error('missing battle');
  expect(result.battle.events.filter(e => e.type === 'combatItemGranted' && e.source.definitionId === 'scavenger').length).toBeGreaterThan(0);
  const match = room.state.seats.find(s => s.seatId === seatId)!.match;
  expect(requireAugmentFacts(match, 'pvp-roster', 4)).toHaveLength(1);
  expect(requireAugmentFacts(match, 'deaths', 4).flatMap(f => f.deaths).some(d => d.ordinaryHero)).toBe(true);
  expect(JSON.stringify(toPlayerView(room.state, seatId, clock.now()))).not.toContain('augmentHistory');
});
it.each(['object', 'JSON', 'serialized'] as const)('B5-76 room %s restore requires independent authority and rejects tampering', entry => {
  const match = room.state.seats.find(s => s.seatId === seatId)!.match, authority = room.augmentHistoryAuthority(seatId);
  const input = (s: typeof match) => entry === 'object' ? s : entry === 'JSON' ? JSON.stringify(s) : canonicalContent(s);
  expect(restoreSharedOrbSnapshot(room.state.pool, input(match), authority)).toEqual(match);
  expect(() => restoreSharedOrbSnapshot(room.state.pool, input(match))).toThrow('independent server authority');
  const bad = structuredClone(match) as any;
  bad.augmentHistory.facts.find((f: any) => f.kind === 'deaths').deaths[0].ordinaryHero = false;
  expect(() => restoreSharedOrbSnapshot(room.state.pool, input(bad), authority)).toThrow();
});
it('B5-76 deserialized two-sided settlement replays H11 equipment and rejects a forged grant', () => {
  const result = room.state.battles.find(r => r.kind === 'two-sided' && r.participants.includes(seatId));
  if (result?.kind !== 'two-sided') throw new Error('missing battle');
  const copy = JSON.parse(JSON.stringify(result.battle));
  expect(proposeSettlement(copy)).toEqual(proposeSettlement(result.battle));
  const replay = startCombatReplay(copy);
  expect(replay.advance(900)?.terminal.tick).toBe(copy.terminal.tick);
  const unit = copy.terminal.units.find((u: any) => u.combatItemGrants?.some((g: any) => g.chest.definitionId === 'scavenger'));
  unit.combatItemGrants[0].ordinal++;
  expect(() => proposeSettlement(copy)).toThrow();
});
