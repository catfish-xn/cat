import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES, ROOT_ROOM_MOST } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { ROOT_PARTICLES_ATTACK_MOST, ROOT_PARTICLES_MOST, rootRoomOf } from '../src/rendering/three-mode/vfx-ltk/particles';
import { rootRoomMost } from '../src/rendering/three-mode/vfx-ltk/runtime';

// Garen's cast: his package's cast burst and its falling sword play from the cast beside the shield, the sky beam and the
// landing burst; the landing burst may take more room than the usual skill cap so its later waves are not starved.
describe("Garen's cast", () => {
  it('plays the cast burst and the falling sword from the cast, on his own ground', () => {
    const cast = CUE_OVERRIDES.garen!.filter(cue => cue.action === 'cast');
    expect(cast.map(cue => cue.system)).toEqual(['cbccc667', '97c28077', 'ea21ae27', '44aa54ff', '5bbccb8c']);
    for (const id of ['cbccc667', '97c28077']) expect(cast.find(cue => cue.system === id)).toMatchObject({ event: 'cast-start', delay: 0, bone: 'BUFFBONE_GLB_GROUND_LOC' });
    // The sword's fall reaches the ground with the landing burst: it outlives the burst's start.
    const sword = cast.find(cue => cue.system === '97c28077')!, burst = cast.find(cue => cue.system === '5bbccb8c')!;
    expect(sword.delay + sword.duration).toBeGreaterThan(burst.delay);
    expect(CUE_OVERRIDES.garen!.filter(cue => cue.action === 'attack')).toHaveLength(1);
  });
  it('lets the landing burst take more than the usual skill room, and only it', () => {
    expect(Object.keys(ROOT_ROOM_MOST)).toEqual(['5bbccb8c']);
    const most = ROOT_ROOM_MOST['5bbccb8c']!;
    expect(most).toBeGreaterThan(ROOT_PARTICLES_MOST);
    // A measure past the usual cap now gets its quarter more, up to the system's own cap.
    expect(rootRoomOf(ROOT_PARTICLES_MOST + 100, most)).toBeGreaterThan(ROOT_PARTICLES_MOST);
    expect(rootRoomOf(10_000, most)).toBe(most);
  });
  it('is the cap the runtime measures the landing burst under; every other system keeps the usual caps', () => {
    expect(rootRoomMost('5bbccb8c', true)).toBe(ROOT_ROOM_MOST['5bbccb8c']);
    expect(rootRoomMost('44aa54ff', true)).toBe(ROOT_PARTICLES_MOST);
    expect(rootRoomMost('0f2af66b', false)).toBe(ROOT_PARTICLES_ATTACK_MOST);
  });
});
