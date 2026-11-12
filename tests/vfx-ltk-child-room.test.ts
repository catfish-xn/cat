import { describe, expect, it } from 'vitest';
import { CHILD_COUNT_CAP, CHILD_PARTICLES, CHILD_ROOM_CAP, childRoomOf, DEFAULT_CHILD_ROOM } from '../src/rendering/three-mode/vfx-ltk/particles';

describe('a run’s child room off what its system measured', () => {
  it('keeps the old flat room for a system never measured or spawning no child', () => {
    expect(childRoomOf(null)).toEqual(DEFAULT_CHILD_ROOM);
    expect(childRoomOf({ room: 0, live: 0 })).toEqual(DEFAULT_CHILD_ROOM);
    expect(DEFAULT_CHILD_ROOM).toEqual({ budget: CHILD_PARTICLES, most: 8 });
  });

  it('gives the measured room and count plus one more child, so three rock children of 80 slots each all fit', () => {
    // Three rock children (64-slot pools) each carrying a 16-slot shard child: 240 slots, 6 live systems.
    const room = childRoomOf({ room: 240, live: 6 });
    expect(room.budget).toBe(280);
    expect(room.most).toBe(8);
    expect(room.budget).toBeGreaterThan(CHILD_PARTICLES);
  });

  it('never gives less than the old flat room, and never more than the caps', () => {
    expect(childRoomOf({ room: 16, live: 1 })).toEqual({ budget: CHILD_PARTICLES, most: 8 });
    expect(childRoomOf({ room: 5000, live: 100 })).toEqual({ budget: CHILD_ROOM_CAP, most: CHILD_COUNT_CAP });
  });
});
