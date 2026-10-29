/**
 * Contract §25 推送事件: a G2-3 hook failure (`mechanicFailed`) raised inside a server-originated transition goes out
 * with that seat's own state push, field for field, and to no other seat. Inject one stamped hook failure at the
 * public rules deadline boundary, retaining the real deployment and the room's complete publication path.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
const fault = vi.hoisted(() => ({ seatId: '' }));
vi.mock('../../src/server-entry', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/server-entry')>();
  return { ...real,
    autoDeployToCap: (...args: Parameters<typeof real.autoDeployToCap>) => {
      const result=real.autoDeployToCap(...args);
      if(!result.ok||args[0].multiplayer?.seatId!==fault.seatId)return result;
      const eventSeq=result.state.nextMatchEventSeq;
      return {...result,state:{...result.state,nextMatchEventSeq:eventSeq+1},events:[...result.events,
        {type:'mechanicFailed' as const,hook:'academy' as const,reason:'invalid-mechanic-state' as const,domain:'match' as const,eventSeq}]};
    },
  };
});
import { PlaceholderBattleResolver } from '../../src/server/room/battle-resolver';
import { seatPushEvents, toPlayerView } from '../../src/server/room/projection';
import type { RoomState, SeatState } from '../../src/server/room/types';
import { makeRoom, runUntil, runUntilClaiming } from './helpers';
import { isAnvil } from '../../src/simulation/content/anvils';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';

const seat = (state: RoomState, seatId: string): SeatState => state.seats.find(candidate => candidate.seatId === seatId)!;
afterEach(() => { fault.seatId = ''; });

describe('mechanicFailed push (contract §25)', () => {
  it('pushes the failure with the own seat state only, and never in another seat\'s view', () => {
    const { room, clock } = makeRoom(new PlaceholderBattleResolver());
    room.start();
    // v15: the PvE rewards arrive as orbs each seat claims in preparation.
    runUntilClaiming(room, clock, state => state.round === 2 && state.phase === 'preparation');
    // s0 keeps a bench unit, so the preparation deadline runs a rules deployment for it.
    expect(seat(room.state, 's0').match.preparation.units.some(unit => unit.team === 'player' && unit.location.kind === 'bench')).toBe(true);
    // v25 opening orbs may hold only an anvil, which auto-deployment deliberately excludes.
    const mine=()=>seat(room.state,'s0').match;
    if(!mine().preparation.units.some(unit=>unit.team==='player'&&unit.location.kind==='bench'&&!isAnvil(unit.definitionId))){
      const slot=mine().shop.slots.findIndex(offer=>offer.status==='available'&&UNIT_DEFINITIONS[offer.definitionId].cost<=mine().gold);
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(room.handle('s0',{type:'buy',slot,generation:mine().shop.generation})).toMatchObject({ok:true});
    }
    expect(mine().preparation.units.some(unit=>unit.team==='player'&&unit.location.kind==='bench'&&!isAnvil(unit.definitionId))).toBe(true);
    for(const unit of mine().preparation.units.filter(unit=>unit.team==='player'&&unit.location.kind==='board'))
      expect(room.handle('s0',{type:'sell',unitId:unit.id})).toMatchObject({ok:true});
    fault.seatId = 's0';
    let pushed:RoomState|undefined;
    // A runNext drains same-time freeze/opening continuations. Inspect the actual
    // publication carrying the event, before a later revision replaces serverEvents.
    const unsubscribe=room.subscribe(state=>{
      if(seatPushEvents(seat(state,'s0')).some(event=>event.type==='mechanicFailed'))pushed=state;
    });
    runUntil(room,clock,()=>pushed!==undefined);unsubscribe();
    const publication=pushed!,s0 = seat(publication, 's0');
    const failed = seatPushEvents(s0).filter(event => event.type === 'mechanicFailed');
    expect(failed.length).toBeGreaterThan(0);
    for (const event of failed) expect(event).toEqual({ type: 'mechanicFailed', hook: 'academy', reason: 'invalid-mechanic-state', domain: 'match', eventSeq: expect.any(Number) });
    for (const other of publication.seats.filter(candidate => candidate.seatId !== 's0')) {
      expect(seatPushEvents(other).some(event => event.type === 'mechanicFailed')).toBe(false);
      expect(JSON.stringify(toPlayerView(publication, other.seatId, clock.now()))).not.toContain('mechanicFailed');
    }
    room.dispose();
  }, 30_000);
});
