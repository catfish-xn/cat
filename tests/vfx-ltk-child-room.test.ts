import { Camera, Group, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { CHILD_COUNT_CAP, CHILD_PARTICLES, CHILD_ROOM_CAP, childRoomOf, createLtkParticles, DEFAULT_CHILD_ROOM, measureChildren, unitAnchor, unitJoints, type ChildRoom } from '../src/rendering/three-mode/vfx-ltk/particles';
import { drawnEmitters } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/definitions';
import type { SystemModel } from '../src/rendering/three-mode/vfx-ltk/engine/model/model';
import { constant, num, syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';

describe('a run’s child room off what its system measured', () => {
  it('keeps the old flat room for a system never measured or spawning no child', () => {
    expect(childRoomOf(null)).toEqual(DEFAULT_CHILD_ROOM);
    expect(childRoomOf({ room: 0, live: 0 })).toEqual(DEFAULT_CHILD_ROOM);
    expect(DEFAULT_CHILD_ROOM).toEqual({ budget: CHILD_PARTICLES, most: 8 });
  });

  it('gives half again the measured room and count', () => {
    expect(childRoomOf({ room: 240, live: 6 })).toEqual({ budget: 360, most: 9 });
    expect(childRoomOf({ room: 544, live: 13 })).toEqual({ budget: 816, most: 20 });
  });

  it('never gives less than the old flat room, and never more than the caps', () => {
    expect(childRoomOf({ room: 16, live: 1 })).toEqual({ budget: CHILD_PARTICLES, most: 8 });
    expect(childRoomOf({ room: 5000, live: 100 })).toEqual({ budget: CHILD_ROOM_CAP, most: CHILD_COUNT_CAP });
  });
});

describe('every child a moving run spawns fits the room its system measured', () => {
  // Synthetic only: a parent emitting 9 a second, each particle (0.8 s) carrying a child of 30 a second, flown 0.8 s like
  // the longest board row (6.5 cells at the row shockwave's fitted speed); the measure stands still and stops at 0.875 s.
  const build = async () => {
    const parent = syntheticSystem({ lifetime: num(5), rate: constant(num(9)), particleLifetime: constant(num(0.8)) });
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : parent, readTexture: async () => new Texture() });
    const base = await library.load('sample');
    const child: SystemModel = { ...base.model, emitters: base.model.emitters.map(e => ({ ...e, childSet: null, rate: { constant: [30], keys: [], tables: [] }, lifetime: 0.2, particleLifetime: { constant: [0.5], keys: [], tables: [] } })) };
    const model: SystemModel = { ...base.model, emitters: base.model.emitters.map(e => ({ ...e, childSet: {
      children: [child], bones: [], probability: { constant: [0], keys: [], tables: [] }, onDeath: false, inheritance: null,
    } })) };
    return { library, prepared: { ...base, model, drawn: drawnEmitters(model), samplers: new Map([['0', base.samplers.get('0')!], ['0.0:0', base.samplers.get('0')!]]) } };
  };
  const fly = (prepared: any, childRoom?: ChildRoom) => {
    const source = new Group(), target = new Group(), camera = new Camera(); target.position.x = 6.5 * 59;
    const run = createLtkParticles(prepared, { anchor: unitAnchor(source, null), target: unitAnchor(target, null), joints: unitJoints(source, null), duration: 2, projectileSeconds: 0.8, seed: 1, childRoom });
    let spawned = 0;
    for (let t = 0; t < 2; t += 1 / 60) { run.update(1 / 60, camera); spawned = Math.max(spawned, run.driver.births().filter(b => b.depth === 1).length); }
    const parents = run.driver.pool.born; run.dispose();
    return { parents, spawned };
  };

  it('the old flat room refuses most of them; the measured room takes every one', async () => {
    const { library, prepared } = await build();
    const flat = fly(prepared);
    expect(flat.parents).toBeGreaterThanOrEqual(6);
    expect(flat.spawned).toBeLessThan(flat.parents);
    const measured = measureChildren(prepared, 2, 0.875);
    expect(measured).not.toBeNull();
    const room = childRoomOf(measured);
    const fitted = fly(prepared, room);
    expect(fitted.parents).toBe(flat.parents);
    expect(fitted.spawned).toBe(fitted.parents);
    library.dispose();
  });
});
