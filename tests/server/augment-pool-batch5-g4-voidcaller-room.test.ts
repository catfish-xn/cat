import { afterAll, expect, it } from 'vitest';
import { makeRoom, runUntilClaiming, claimAllOrbs } from './helpers';
import { TwoSidedBattleResolver } from '../../src/server/room/two-sided-resolver';
import { restoreSharedOrbSnapshot, assertSharedPoolConservation } from '../../src/simulation/shared-pool';
import { canonicalContent } from '../../src/simulation/content';

// v26 D5 (7953c99a) drifted the seed-65 2-1 draws (old route: seed 65, s2, now dominator/visionary/watcher crests).
// Seed 32 offers Voidcaller to s2 in the real initial 2-1 draw.
const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 32 });
const seatId = 's2', mine = () => room.state.seats.find(s => s.seatId === seatId)!.match;
afterAll(() => room.dispose());
it('B5-72 starts a real eight-seat room', () => { room.start(); });
for (const round of ['1-3','1-4','2-1']) it(`B5-72 reaches ${round}`, () => {
  runUntilClaiming(room, clock, s => s.roundId === round && s.phase === 'preparation');
});
it('B5-72 selects through the room and claims both real shared-pool hero rewards', () => {
  const c = mine().pendingChoice!; expect(c.offers).toContain('voidcaller');
  expect(room.handle(seatId, { type: 'choose', choiceId: c.choiceId, generation: c.generation, definitionId: 'voidcaller' })).toMatchObject({ ok: true });
  claimAllOrbs(room, [seatId]);
  for (const unit of mine().preparation.units.filter(u => u.team === 'player' && u.location.kind === 'board' && !['rell','morgana'].includes(u.definitionId))) {
    const used = new Set(mine().preparation.units.flatMap(u => u.location.kind === 'bench' ? [u.location.slot] : []));
    const slot = Array.from({length:9},(_,i)=>i).find(i=>!used.has(i))!;
    expect(room.handle(seatId,{type:'deploy',unitId:unit.id,target:{kind:'bench',slot}})).toMatchObject({ok:true});
  }
  for (const id of ['rell','morgana']) {
    const hero = mine().preparation.units.find(u => u.definitionId === id && u.team === 'player')!; expect(hero).toBeDefined();
    const occupied = new Set(mine().preparation.units.flatMap(u => u.location.kind === 'board' ? [u.location.cell.col] : []));
    const col = [2,3,4,5,6,1,0].find(c => !occupied.has(c))!;
    const deployed = room.handle(seatId, { type: 'deploy', unitId: hero.id, target: { kind: 'board', cell: { col, row: 4 } } });
    expect(deployed,deployed.ok?'':deployed.reason).toMatchObject({ ok: true });
  }
  assertSharedPoolConservation(room.state.pool, room.state.seats.map(s => s.match));
});
it('B5-72 round-trips object/JSON/canonical saves with independent server authority and rejects forged gifts/history', () => {
  const s = mine(), authority = room.augmentHistoryAuthority(seatId);
  for (const form of ['object','json','serialized'] as const) {
    const input = form === 'object' ? s : form === 'json' ? JSON.stringify(s) : canonicalContent(s);
    expect(restoreSharedOrbSnapshot(room.state.pool, input, authority)).toEqual(s);
    for (const edit of [
      (x: any) => { delete x.augmentHistory; },
      (x: any) => { x.augmentHistory.facts[0].goldBefore++; },
      (x: any) => { x.seatMechanics.receipts.find((r: any) => r.definitionId === 'rell').definitionId = 'morgana'; },
    ]) {
      const bad = structuredClone(s); edit(bad);
      expect(() => restoreSharedOrbSnapshot(room.state.pool, form === 'object' ? bad : JSON.stringify(bad), authority)).toThrow();
    }
  }
  expect(() => restoreSharedOrbSnapshot(room.state.pool, s)).toThrow(/authority/);
  const erased=structuredClone(s) as any;erased.augments=erased.augments.filter((a:any)=>a.definitionId!=='voidcaller');delete erased.augmentHistory;
  expect(()=>restoreSharedOrbSnapshot(room.state.pool,erased)).toThrow();
});
it('B5-72 actual room combat consumes the shared Visionary pool', () => {
  runUntilClaiming(room, clock, s => s.roundId === '2-1' && s.phase === 'settlement');
  const battle = room.state.battles.find(b => b.kind === 'two-sided' && b.participants.includes(seatId));
  expect(battle?.kind).toBe('two-sided'); if (battle?.kind !== 'two-sided') throw Error('missing battle');
  expect(battle.battle.terminal.voidcaller?.some(c => c.remainder > 0 || c.summoned > 0)).toBe(true);
  expect(room.state.fault).toBeNull();
  expect(restoreSharedOrbSnapshot(room.state.pool, canonicalContent(mine()), room.augmentHistoryAuthority(seatId))).toEqual(mine());
});
