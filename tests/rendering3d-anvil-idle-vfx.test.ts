import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ANVIL_IDLE_VFX, MAX_ANVIL_IDLES, createAnvilIdleLoop, type AnvilIdleHost } from '../src/rendering/three-mode/anvil-idle-vfx';
import { ANVIL_KINDS } from '../src/simulation/content/anvils';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticSystem } from './vfx-ltk-synthetic';

function fakeHost(ready = true) {
  const live = new Set<string>();
  const host = {
    play: vi.fn((_key: string, id: string) => { if (ready) live.add(id); return ready; }),
    playing: vi.fn((id: string) => live.has(id)),
    stop: vi.fn((id: string) => { live.delete(id); }),
  } satisfies AnvilIdleHost;
  return { host, live };
}
const anvil = (id: string, definitionId = 'TFT_ArmoryKeySupport', alive = true) => ({ id, definitionId, alive });

describe('anvil idle particles', () => {
  it('maps each anvil with an own client model to its own idle catalogue key (support is not the completed one)', () => {
    expect(Object.keys(ANVIL_IDLE_VFX).every(id => Object.hasOwn(ANVIL_KINDS, id))).toBe(true);
    expect(ANVIL_IDLE_VFX.TFT_ArmoryKeySupport).not.toBe(ANVIL_IDLE_VFX.TFT_ArmoryKeyCompleted);
    expect(new Set(Object.values(ANVIL_IDLE_VFX)).size).toBe(4);
    expect(ANVIL_IDLE_VFX.TFT_ArmoryKeyRadiant).toBeUndefined();
  });

  it('starts each shown anvil once, restarts it when its cue ends, and stops it when the anvil leaves', () => {
    const { host, live } = fakeHost(), loop = createAnvilIdleLoop(host);
    loop.update(0, [anvil('a'), anvil('b', 'TFT_ArmoryKeyCompleted'), anvil('u', 'jinx')], false);
    expect(host.play.mock.calls).toEqual([['anvil-support', 'a'], ['anvil-completed', 'b']]);
    loop.update(0.6, [anvil('a'), anvil('b', 'TFT_ArmoryKeyCompleted')], false);
    expect(host.play).toHaveBeenCalledTimes(2);
    live.delete('a');
    loop.update(0.6, [anvil('a'), anvil('b', 'TFT_ArmoryKeyCompleted')], false);
    expect(host.play).toHaveBeenCalledTimes(3);
    loop.update(0.6, [anvil('a')], false);
    expect(host.stop).toHaveBeenCalledWith('b');
    loop.update(0.6, [anvil('a', 'TFT_ArmoryKeySupport', false)], false);
    expect(host.stop).toHaveBeenCalledWith('a');
  });

  it('checks at most every half second, caps the glowing anvils and honours reduced motion', () => {
    const { host } = fakeHost(), loop = createAnvilIdleLoop(host);
    const bench = ['e', 'd', 'c', 'b', 'a'].map(id => anvil(id, 'TFT_ArmoryKeyComponent'));
    loop.update(0, bench, false);
    expect(host.play.mock.calls.map(call => call[1])).toEqual(['a', 'b', 'c'].slice(0, MAX_ANVIL_IDLES));
    loop.update(0.1, [], false);
    expect(host.stop).not.toHaveBeenCalled();
    loop.update(0.5, bench, true);
    expect(host.stop.mock.calls.map(call => call[0]).sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps retrying while the catalogue is missing or loading, and restarts everything after a reset', () => {
    const missing = fakeHost(false), loop = createAnvilIdleLoop(missing.host);
    loop.update(0, [anvil('a')], false); loop.update(0.5, [anvil('a')], false);
    expect(missing.host.play).toHaveBeenCalledTimes(2);
    const { host, live } = fakeHost(), again = createAnvilIdleLoop(host);
    again.update(0, [anvil('a')], false); live.clear(); again.reset(); again.update(0, [anvil('a')], false);
    expect(host.play).toHaveBeenCalledTimes(2);
  });

  it('runtime.playing follows a queued, running and stopped idle cue', async () => {
    const cue = { system: 'idle', action: 'passive' as const, event: 'cast-start' as const, delay: 0, duration: 2, bone: 'Root' };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: { idle: 'idle.json' }, assets: { 'synthetic.tex': 'same.png' }, skills: { 'anvil-support': [cue] } }
      : syntheticSystem(), readTexture: async () => new Texture() });
    const source = { root: new Group(), body: null, alive: true }, scene = new Scene();
    const runtime = createLtkRuntime(library, scene, () => source);
    await runtime.warm('anvil-support');
    expect(runtime.playing('anvil', 'passive')).toBe(false);
    expect(runtime.play('anvil-support', 'anvil', [], 0, 'passive')).toBe(true);
    expect(runtime.playing('anvil', 'passive')).toBe(true);
    runtime.update(0.1, new Camera()); expect(runtime.active).toBe(1); expect(runtime.playing('anvil', 'passive')).toBe(true);
    expect(runtime.playing('anvil', 'cast')).toBe(false);
    runtime.update(2, new Camera()); expect(runtime.playing('anvil', 'passive')).toBe(false);
    runtime.play('anvil-support', 'anvil', [], 0, 'passive'); runtime.update(0.1, new Camera());
    runtime.stopAction('anvil', 'passive'); expect(runtime.playing('anvil', 'passive')).toBe(false);
    runtime.dispose();
  });
});
