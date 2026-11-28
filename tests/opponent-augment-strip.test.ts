import { describe, expect, it } from 'vitest';
import { opponentAugmentIds } from '../src/rendering/online/opponent-augment-strip';
import type { PlayerView, SeatPublic } from '../src/rendering/online/protocol';

const seat = (seatId: string, augments: string[]): SeatPublic => ({ seatId, name: `玩家 ${seatId}`, kind: 'bot', hp: 80, level: 5, alive: true, rank: null,
  connected: true, controller: 'bot', publicBoard: { units: [], augments } } as unknown as SeatPublic);
const view = (kind: string, opponentSeatId: string | null): PlayerView => ({ mySeatId: 's1', opponentSeatId,
  phase: { kind, round: 7, roundName: '2-5', endsAt: null, serverNow: 0 },
  seats: [seat('s1', ['mine']), seat('s2', ['pandoras-items', 'cybernetic-uplink-2']), seat('s3', ['other'])] } as unknown as PlayerView);
const base = { playing: true, battlePlaying: false, scouting: false };

describe('opponent augments on their side of the board', () => {
  it('shows the drawn PvP opponent\'s public augments in acquisition order during combat', () => {
    expect(opponentAugmentIds({ ...base, view: view('combat', 's2') })).toEqual(['pandoras-items', 'cybernetic-uplink-2']);
  });
  it('stays up while my own battle still plays back after the combat phase', () => {
    expect(opponentAugmentIds({ ...base, battlePlaying: true, view: view('settlement', 's2') })).toEqual(['pandoras-items', 'cybernetic-uplink-2']);
    expect(opponentAugmentIds({ ...base, view: view('settlement', 's2') })).toEqual([]);
  });
  it('is hidden outside a PvP battle, while scouting, and when I am not playing', () => {
    expect(opponentAugmentIds({ ...base, view: view('combat', null) })).toEqual([]); // PvE / supply round
    expect(opponentAugmentIds({ ...base, view: view('preparation', 's2') })).toEqual([]);
    expect(opponentAugmentIds({ ...base, scouting: true, view: view('combat', 's2') })).toEqual([]);
    expect(opponentAugmentIds({ ...base, playing: false, view: view('combat', 's2') })).toEqual([]);
    expect(opponentAugmentIds({ ...base, view: null })).toEqual([]);
  });
  it('tolerates an older view without publicBoard', () => {
    const old = view('combat', 's2'); (old.seats[1] as { publicBoard?: unknown }).publicBoard = undefined;
    expect(opponentAugmentIds({ ...base, view: old })).toEqual([]);
  });
});
