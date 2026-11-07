import { beforeAll, afterAll, expect, it } from 'vitest';
import { makeRoom, runUntil, answerOpenChoices, claimAllOrbs } from './server/helpers';
import { TwoSidedBattleResolver } from '../src/server/room/two-sided-resolver';
import { ITEM_DEFINITIONS } from '../src/simulation/content/items';
import { G24_CHEST_PAYLOADS } from '../src/simulation/content/g2-4-chest-pool';
import { restoreSharedOrbSnapshot } from '../src/simulation/shared-pool';
import { canonicalContent } from '../src/simulation/content';
import { requireAugmentFacts } from '../src/simulation/augment-history';
import { proposeSettlement } from '../src/simulation/two-sided-battle';
import { startCombatReplay } from '../src/simulation/combat-replay-view';
import type { MatchState } from '../src/simulation/match';
import type { SharedPoolState } from '../src/simulation/shared-pool';
import type { AugmentHistoryAuthority } from '../src/simulation/augment-history';

const { room, clock } = makeRoom(new TwoSidedBattleResolver(), { seed: 138, combatStreaming: true });
let seatId: string;
let prepared: { match: MatchState; pool: SharedPoolState; authority: AugmentHistoryAuthority };
beforeAll(() => room.start());
for (let round = 2; round <= 12; round++) beforeAll(() => {
  claimAllOrbs(room); answerOpenChoices(room);
  for (const seat of room.state.seats) for (let slot = 0; slot < 5; slot++) {
    const match = room.state.seats.find(s => s.seatId === seat.seatId)!.match;
    if (match.preparation.units.filter(u => u.team === 'player').length >= 3) break;
    room.handle(seat.seatId, {type:'buy',slot,generation:match.shop.generation});
  }
  runUntil(room, clock, s => {
    if (s.round > round) throw new Error(`missed H11 setup round ${round}: reached ${s.round}/${s.phase}`);
    return s.round === round && (s.phase === 'preparation' || s.phase === 'carousel' || s.phase === 'choice');
  });
});
beforeAll(() => {
  // Seed 28’s first sponging offer is s4, a bot. autoDeployToCap only fields humans, so the
  // bench never entered combat and opening copy had no recipient. Seed 16’s first human
  // is s2 and does field a donor plus recipients, but the three chest combines spend every
  // component, so round 13 has nothing to live-equip. Seed 138’s first human within one
  // reroll per slot is s1. The same commands leave one belt in inventory after those
  // combines, and autoDeploy fields one 3-item donor and four empty recipients
  // (room seeds 0..139).
  for (const seat of [...room.state.seats].sort((a,b)=>Number(b.seatId==='s3')-Number(a.seatId==='s3')).filter(s => s.alive)) {
    for (let slot = 0; slot < 3; slot++) {
      const c = room.state.seats.find(s => s.seatId === seat.seatId)!.match.pendingChoice!;
      if (c.offers.includes('sponging')) { seatId = seat.seatId; break; }
      expect(room.handle(seat.seatId, {type:'rerollAugment',choiceId:c.choiceId,generation:c.generation,optionIndex:slot})).toMatchObject({ok:true});
    }
    if (room.state.seats.find(s => s.seatId === seat.seatId)!.match.pendingChoice!.offers.includes('sponging')) seatId = seat.seatId;
    if (seatId) break;
  }
  expect(seatId,JSON.stringify(room.state.seats.map(s => [s.seatId,s.match.pendingChoice?.offers]))).toBeDefined();
  const current = () => room.state.seats.find(s => s.seatId === seatId)!.match;
  const c = current().pendingChoice!;
  expect(c.offers).toContain('sponging');
  expect(room.handle(seatId,{type:'choose',choiceId:c.choiceId,generation:c.generation,definitionId:'sponging'})).toMatchObject({ok:true});
  answerOpenChoices(room); claimAllOrbs(room,[seatId]); answerOpenChoices(room,[seatId]);
  const completed = () => current().items.filter(i => i.location.kind === 'inventory' && Object.hasOwn(G24_CHEST_PAYLOADS,i.definitionId));
  for (let n = 0; n < 3 && completed().length < 3; n++) {
    const items = current().items.filter(i => i.location.kind === 'inventory');
    const pair = items.flatMap((a,i) => items.slice(i+1).map(b => [a,b] as const)).find(([a,b]) => Object.values(ITEM_DEFINITIONS).some(d => Object.hasOwn(G24_CHEST_PAYLOADS,d.id) && d.recipe?.slice().sort().join() === [a.definitionId,b.definitionId].sort().join()));
    expect(pair,JSON.stringify(items)).toBeDefined();
    expect(room.handle(seatId,{type:'combine',a:pair![0].id,b:pair![1].id})).toMatchObject({ok:true});
  }
  expect(completed().length).toBeGreaterThanOrEqual(3);
  const donor = current().preparation.units.find(u => u.team === 'player' && u.location.kind === 'board')!;
  expect(donor).toBeDefined();
  for (const [slot,item] of completed().slice(0,3).entries()) expect(room.handle(seatId,{type:'equip',itemId:item.id,unitId:donor.id,slot})).toMatchObject({ok:true});
  // autoDeployToCap fills the player board before round-12 combat; no manual deploy loop here.
  prepared = {match:current(),pool:room.state.pool,authority:room.augmentHistoryAuthority(seatId)};
});
beforeAll(() => { runUntil(room,clock,s => s.round === 12 && s.phase === 'settlement'); });
afterAll(() => room.dispose());
it('B5-79 real room choose / orb claim / combine / equip path copies on the two-sided opening', () => {
  expect(room.state.fault).toBeNull();
  const result = room.state.battles.find(r => r.kind === 'two-sided' && r.participants.includes(seatId));
  expect(result?.kind).toBe('two-sided'); if (result?.kind !== 'two-sided') throw new Error('missing battle');
  const grants = result.battle.events.filter(e => e.type === 'combatItemGranted' && e.source.definitionId === 'sponging');
  expect(grants.length).toBeGreaterThan(0); expect(grants.every(e => e.tick === 0)).toBe(true);
  const match = room.state.seats.find(s => s.seatId === seatId)!.match;
  expect(requireAugmentFacts(match,'pvp-roster',12)).toHaveLength(1);
});
it.each(['object','JSON','serialized'] as const)('B5-79 online %s restore authenticates the full table independently', entry => {
  const match = room.state.seats.find(s => s.seatId === seatId)!.match, authority = room.augmentHistoryAuthority(seatId);
  const input = (s: typeof match) => entry === 'object' ? s : entry === 'JSON' ? JSON.stringify(s) : canonicalContent(s);
  expect(restoreSharedOrbSnapshot(prepared.pool,input(prepared.match),prepared.authority)).toEqual(prepared.match);
  expect(restoreSharedOrbSnapshot(room.state.pool,input(match),authority)).toEqual(match);
  expect(() => restoreSharedOrbSnapshot(room.state.pool,input(match))).toThrow('independent server authority');
  const bad = structuredClone(match) as any;
  bad.augmentHistory.facts.find((f:any) => f.kind === 'pvp-roster').seats.find((s:any) => s.seatId === seatId).items.pop();
  expect(() => restoreSharedOrbSnapshot(room.state.pool,input(bad),authority)).toThrow();
  for (const edit of [
    (s:any) => { delete s.augmentHistory; },
    (s:any) => { s.augmentHistory.version = 'augment-history-v2'; },
    (s:any) => { s.augmentHistory.seatId = 'wrong-seat'; },
    (s:any) => { s.augmentHistory.facts.pop(); },
    (s:any) => { s.augmentHistory.facts.find((f:any) => f.kind === 'pvp-roster').battleId = 'other-battle'; },
    (s:any) => { s.augmentHistory.facts.find((f:any) => f.kind === 'acquire').roster.units[0].starLevel = 3; },
  ]) {
    const edited = structuredClone(match); edit(edited);
    expect(() => restoreSharedOrbSnapshot(room.state.pool,input(edited),authority)).toThrow();
  }
});
it('B5-79 deserialized online battle results authenticate copies without any live equip receipt', () => {
  const result = room.state.battles.find(r => r.kind === 'two-sided' && r.participants.includes(seatId));
  if (result?.kind !== 'two-sided') throw new Error('missing battle');
  const copy = JSON.parse(JSON.stringify(result.battle));
  expect(copy.inputLog).toBeUndefined();
  expect(proposeSettlement(copy)).toEqual(proposeSettlement(result.battle));
  const replay = startCombatReplay(copy);
  expect(replay.advance(900)?.terminal.tick).toBe(copy.terminal.tick);
  copy.terminal.units.find((u:any) => u.combatItemGrants?.some((g:any) => g.chest.definitionId === 'sponging')).combatItemGrants[0].grantedAtTick++;
  expect(() => proposeSettlement(copy)).toThrow();
});
it('B5-79 next-round streaming combat accepts a genuine live equip and keeps copied items temporary', () => {
  const current = () => room.state.seats.find(s => s.seatId === seatId)!.match;
  expect(current().items).toEqual(prepared.match.items);
  runUntil(room,clock,s => s.round === 13 && s.phase === 'preparation');
  const match = current(), authority = room.augmentHistoryAuthority(seatId);
  expect(restoreSharedOrbSnapshot(room.state.pool,canonicalContent(match),authority)).toEqual(match);
  const receiver = match.preparation.units.find(u => u.team === 'player' && u.location.kind === 'board'
    && !match.items.some(i => i.location.kind === 'unit' && i.location.unitId === u.id))!;
  const item = match.items.find(i => i.location.kind === 'inventory' && ITEM_DEFINITIONS[i.definitionId]?.kind === 'component')!;
  expect(receiver).toBeDefined(); expect(item).toBeDefined();
  runUntil(room,clock,s => s.round === 13 && s.phase === 'battle');
  const before = current();
  expect(room.handle(seatId,{type:'equip',itemId:'absent',unitId:receiver.id,slot:0})).toMatchObject({ok:false});
  expect(current()).toBe(before);
  expect(room.handle(seatId,{type:'equip',itemId:item.id,unitId:receiver.id,slot:0})).toMatchObject({ok:true});
  runUntil(room,clock,s => s.round === 13 && s.phase === 'settlement');
  expect(room.state.fault).toBeNull();
  const result = room.state.battles.find(r => r.kind === 'two-sided' && r.participants.includes(seatId));
  if (result?.kind !== 'two-sided') throw new Error('missing battle');
  expect(result.battle.inputLog).toHaveLength(1);
  const id = result.battle.mapping.find(m => m.kind === 'unit' && m.seatId === seatId && m.originalId === receiver.id)!.combatId;
  const terminal = result.battle.terminal.units.find(u => u.id === id)!;
  expect(terminal.combatItemGrants?.some(g => g.chest.definitionId === 'sponging')).toBe(true);
  expect(terminal.equipment).toContainEqual({definitionId:item.definitionId,slot:0,temporary:false});
  expect(proposeSettlement(JSON.parse(JSON.stringify(result.battle)))).toEqual(result.proposals);
  expect(restoreSharedOrbSnapshot(room.state.pool,canonicalContent(current()),room.augmentHistoryAuthority(seatId))).toEqual(current());
});
