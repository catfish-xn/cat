import { afterAll, expect, it } from 'vitest';
import { SEATS, TIMINGS, runUntilClaiming, answerOpenChoices } from './helpers';
import { Room, ROOM_TIMING_DEFAULTS } from '../../src/server/room/room';
import { ManualClock } from '../../src/server/room/clock';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { ghostFriendsGrowth } from '../../src/simulation/augment-pool-batch5-g2';
import { ghostFriendsGrowth as expectedGrowth } from '../fixtures/m5/oracle.g2.cjs';
import { compileBattle } from '../../src/simulation/two-sided-battle';
import { snapshotForBattle } from '../../src/simulation/two-sided-snapshot';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation } from '../../src/simulation/shared-pool';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';
import { canonicalContent } from '../../src/simulation/content';

// v26 D5 pool (7953c99a): real 2-1 draw with Ghost of Friends Past for s0 is now seed 403 (was 28).
const clock = new ManualClock();
const room = new Room(SEATS.map(s=>({...s,kind:'human'})), {...ROOM_TIMING_DEFAULTS,...TIMINGS,roomId:'g2-ghost-room',seed:403,clock,resolver:new TwoSidedBattleResolver()});
const mine = () => room.state.seats.find(s => s.seatId === 's0')!;
afterAll(() => room.dispose());

for (const round of ['1-2', '1-3', '1-4', '2-1']) it(`B5-63 room reaches ${round}`, () => {
  if (round === '1-2') room.start();
  expect(runUntilClaiming(room, clock, s => s.roundId === round && s.phase === 'preparation').roundId).toBe(round);
});

it('B5-63 is acquired by a real online command and rejects a duplicate command atomically', () => {
  const c = mine().match.pendingChoice!;
  expect(c.offers).toContain('ghost-of-friends-past');
  const command = {type: 'choose' as const, choiceId: c.choiceId, generation: c.generation, definitionId: 'ghost-of-friends-past'};
  expect(room.handle('s0', command)).toMatchObject({ok: true});
  expect(mine().match.augmentHistory?.version).toBe('augment-history-v1');
  const before = room.state;
  expect(room.handle('s0', command)).toMatchObject({ok: false});
  expect(room.state).toBe(before);
  answerOpenChoices(room, ['s1','s2','s3','s4','s5','s6','s7']);
  // Build stronger opponents using real buy/deploy commands, leaving one exposed allied hero.
  for (const seatId of ['s1','s2','s3','s4','s5','s6','s7']) {
    for (let n=0;n<3;n++) {
      const m=room.state.seats.find(s=>s.seatId===seatId)!.match;
      const slot=m.shop.slots.findIndex(o=>o.status==='available'&&UNIT_DEFINITIONS[o.definitionId].cost<=m.gold);
      if(slot<0)break;
      expect(room.handle(seatId,{type:'buy',slot,generation:m.shop.generation})).toMatchObject({ok:true});
    }
    const m=room.state.seats.find(s=>s.seatId===seatId)!.match;
    const board=m.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='board');
    for(const [index,u] of m.preparation.units.filter(u=>u.team==='player'&&u.location.kind==='bench').slice(0,m.level-board.length).entries()) {
      const cell={col:index*2,row:5};
      expect(room.handle(seatId,{type:'deploy',unitId:u.id,target:{kind:'board',cell}})).toMatchObject({ok:true});
    }
  }
  const own=mine().match.preparation.units.filter(u=>u.team==='player');
  for(const u of own.slice(1))expect(room.handle('s0',{type:'sell',unitId:u.id})).toMatchObject({ok:true});

});

it('B5-63 online PvP records real deaths with the correct owning seat', () => {
  runUntilClaiming(room, clock, s => s.roundId === '2-1' && s.phase === 'settlement');
  const match = mine().match;
  const deaths = match.augmentHistory!.facts.flatMap(f => f.kind === 'deaths' ? f.deaths : []);
  expect(deaths.filter(d => d.ownerSeatId === 's0' && d.ordinaryHero).length, JSON.stringify({deaths:deaths.map(d=>[d.unitId,d.definitionId,d.ownerSeatId,d.ordinaryHero]),pairings:room.state.pairings,own:match.preparation.units.map(u=>[u.id,u.definitionId,u.location])})).toBeGreaterThan(0);
  expect(new Set(deaths.map(d => `${d.combatId}:${d.eventSeq}`)).size).toBe(deaths.length);
  expect(room.state.fault).toBeNull();
  assertSharedPoolConservation(room.state.pool, room.state.seats.map(s => s.match));
});

it('B5-63 online saves round trip and reject missing authority and independently edited death facts', () => {
  const match = mine().match, authority = room.augmentHistoryAuthority('s0');
  for (const input of [match, JSON.stringify(match), canonicalContent(match)]) expect(restoreSharedOrbSnapshot(room.state.pool, input, authority)).toEqual(match);
  expect(() => restoreSharedOrbSnapshot(room.state.pool, match)).toThrow('independent server authority');
  for (const edit of [
    (s: any) => { delete s.augmentHistory; },
    (s: any) => { s.augmentHistory.facts.find((f: any) => f.kind === 'deaths').deaths[0].ordinaryHero = false; },
    (s: any) => { s.augmentHistory.facts.find((f: any) => f.kind === 'deaths').deaths[0].ownerSeatId = 's7'; },
    (s: any) => { s.augmentHistory.facts.find((f: any) => f.kind === 'deaths').deaths.pop(); },
  ]) {
    const forged = structuredClone(match); edit(forged);
    for (const input of [forged, JSON.stringify(forged)]) expect(() => restoreSharedOrbSnapshot(room.state.pool, input, authority)).toThrow();
  }
});

it('B5-63 current and newly purchased future heroes receive independent cumulative growth on the next online round', () => {
  runUntilClaiming(room, clock, s => s.roundId === '2-2' && s.phase === 'preparation');
  const before = mine().match, expected = expectedGrowth(before)!;
  expect(expected.healthFlat + expected.attackDamageBps + expected.abilityPower).toBeGreaterThan(0);
  expect(ghostFriendsGrowth(before)).toEqual(expected);
  const slot = before.shop.slots.findIndex(o => o.status === 'available');
  expect(room.handle('s0', {type: 'buy', slot, generation: before.shop.generation})).toMatchObject({ok: true});
  const newcomer = mine().match.preparation.units.find(u => u.team==='player'&&!before.preparation.units.some(old=>old.id===u.id));
  expect(newcomer).toBeDefined();
  expect(room.handle('s0',{type:'deploy',unitId:newcomer!.id,target:{kind:'board',cell:{col:2,row:6}}})).toMatchObject({ok:true});
  const snapshot = snapshotForBattle(mine().match, 's0');
  expect(snapshot.ghostFriendsGrowth).toEqual(expected);
  expect(snapshot.units.some(u=>u.id===newcomer!.id)).toBe(true);
  const opponent = room.state.seats.find(s=>s.seatId==='s1')!;
  const input = compileBattle(snapshot,snapshotForBattle(opponent.match,'s1'),17,{battleId:'future-ghost'});
  const mapped = input.mapping.find(m=>m.seatId==='s0'&&m.kind==='unit'&&m.originalId===newcomer!.id)!;
  const fighter = input.strategy.units.find(u=>u.unitId===mapped.combatId)!;
  const effects = fighter.sources.filter(s=>s.source.sourceDefinitionId==='ghost-of-friends-past'&&s.source.sourceInstanceId.endsWith(':growth')).map(s=>s.effect);
  expect(effects).toEqual([{kind:'statFlat',stat:'maxHp',amount:expected.healthFlat},{kind:'statPercentBps',stat:'attackDamage',bps:expected.attackDamageBps},{kind:'statFlat',stat:'abilityPower',amount:expected.abilityPower}]);
  const match = mine().match, authority = room.augmentHistoryAuthority('s0');
  expect(restoreSharedOrbSnapshot(room.state.pool, canonicalContent(match), authority)).toEqual(match);
});
