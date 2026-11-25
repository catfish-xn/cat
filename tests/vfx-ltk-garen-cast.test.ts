import { describe, expect, it } from 'vitest';
import { Texture } from 'three';
import { CUE_OVERRIDES, EMITTER_BLEND, GAREN_BURST_PLAY_OUT, GAREN_SWORD_DELAY, GAREN_SWORD_INTO_BODY, ROOT_ROOM_MOST, WORLD_ACCELERATION_OFF } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { BLEND_MODE } from '../src/rendering/three-mode/vfx-ltk/engine/model/enums';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { struct, syntheticIndex, syntheticSystem, vec } from './vfx-ltk-synthetic';
import { ROOT_PARTICLES_ATTACK_MOST, ROOT_PARTICLES_MOST, rootRoomOf } from '../src/rendering/three-mode/vfx-ltk/particles';
import { PLAY_OUT_CAP, rootRoomMost } from '../src/rendering/three-mode/vfx-ltk/runtime';

// Garen's cast: his package's cast burst and its falling sword play from the cast beside the shield, the sky beam and the
// landing burst; the landing burst may take more room than the usual skill cap so its later waves are not starved, and
// plays out past its end; the sword is drawn with alpha blending.
describe("Garen's cast", () => {
  it('plays the cast burst from the cast and the falling sword a beat later, both on his own ground', () => {
    const cast = CUE_OVERRIDES.garen!.filter(cue => cue.action === 'cast');
    expect(cast.map(cue => cue.system)).toEqual(['cbccc667', '97c28077', 'ea21ae27', '44aa54ff', '5bbccb8c']);
    expect(cast.find(cue => cue.system === 'cbccc667')).toMatchObject({ event: 'cast-start', delay: 0, bone: 'BUFFBONE_GLB_GROUND_LOC' });
    expect(cast.find(cue => cue.system === '97c28077')).toMatchObject({ event: 'cast-start', delay: GAREN_SWORD_DELAY, bone: 'BUFFBONE_GLB_GROUND_LOC' });
    expect(GAREN_SWORD_DELAY).toBeGreaterThan(0);
    expect(CUE_OVERRIDES.garen!.filter(cue => cue.action === 'attack')).toHaveLength(1);
  });
  it("starts the landing burst on the beat the sword's tip comes down into Garen, while the sword still plays", () => {
    const cast = CUE_OVERRIDES.garen!.filter(cue => cue.action === 'cast');
    const sword = cast.find(cue => cue.system === '97c28077')!, burst = cast.find(cue => cue.system === '5bbccb8c')!;
    expect(burst.delay).toBeCloseTo(sword.delay + GAREN_SWORD_INTO_BODY, 10);
    expect(GAREN_SWORD_INTO_BODY).toBeGreaterThan(0);
    expect(sword.delay + sword.duration).toBeGreaterThan(burst.delay);
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
  it('draws the falling sword at its own steady speed: its world acceleration is left out, and no other emitter loses one', async () => {
    expect(WORLD_ACCELERATION_OFF).toEqual({ '97c28077': ['sword_drop'] });
    // Synthetic emitter (made-up numbers) named like the sword, with a world acceleration and a steady fall.
    const pushed = { emitterName: { type: 'string' as const, value: 'sword_drop' }, birthVelocity: struct('ValueVector3', { constantValue: vec(0, -100, 0) }),
      worldAcceleration: struct('IntegratedValueVector3', { constantValue: vec(0, -5000, 0) }) };
    const accelerationOf = async (id: string) => {
      const index = { ...syntheticIndex(), systems: { [id]: 'systems/sword.json' }, skills: {} };
      const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(pushed), readTexture: async () => new Texture() });
      const emitter = (await library.load(id)).model.emitters[0]!;
      library.dispose();
      return { acceleration: emitter.worldAcceleration.constant, keys: emitter.worldAcceleration.keys.length, velocity: emitter.birthVelocity.constant };
    };
    expect(await accelerationOf('97c28077')).toEqual({ acceleration: [0, 0, 0], keys: 0, velocity: [0, -100, 0] });
    expect((await accelerationOf('0badc0de')).acceleration).toEqual([0, -5000, 0]);
  });
  it('draws the falling sword with alpha blending, keeping its steady fall; a sword of another system keeps its additive default', async () => {
    expect(EMITTER_BLEND).toEqual({ '97c28077': { sword_drop: BLEND_MODE.alpha } });
    // Synthetic emitter (made-up numbers) named like the sword: no blend mode written, a world acceleration.
    const sword = { emitterName: { type: 'string' as const, value: 'sword_drop' }, worldAcceleration: struct('IntegratedValueVector3', { constantValue: vec(0, -5000, 0) }) };
    const drawnOf = async (id: string) => {
      const index = { ...syntheticIndex(), systems: { [id]: 'systems/sword.json' }, skills: {} };
      const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(sword), readTexture: async () => new Texture() });
      const emitter = (await library.load(id)).model.emitters[0]!;
      library.dispose();
      return { blend: emitter.blendMode, acceleration: emitter.worldAcceleration.constant };
    };
    expect(await drawnOf('97c28077')).toEqual({ blend: BLEND_MODE.alpha, acceleration: [0, 0, 0] });
    expect(await drawnOf('0badc0de')).toEqual({ blend: BLEND_MODE.add, acceleration: [0, -5000, 0] });
  });
  it('lets the landing burst play out past its end for at most a second, so its pebbles and dust finish their own lives', () => {
    const burst = CUE_OVERRIDES.garen!.find(cue => cue.system === '5bbccb8c')!;
    expect(burst.playOut).toBe(GAREN_BURST_PLAY_OUT);
    expect(GAREN_BURST_PLAY_OUT).toBeGreaterThan(0);
    expect(GAREN_BURST_PLAY_OUT).toBeLessThanOrEqual(PLAY_OUT_CAP);
    // Only the burst plays out; the sword and the cast burst keep their usual end.
    expect(CUE_OVERRIDES.garen!.filter(cue => cue.playOut !== undefined).map(cue => cue.system)).toEqual(['5bbccb8c']);
  });
});
