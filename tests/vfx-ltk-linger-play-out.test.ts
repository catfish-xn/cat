import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';

// Each particle set the runtime builds, in build order.
const built: any[] = [];
vi.mock('../src/rendering/three-mode/vfx-ltk/particles', async importOriginal => {
  const real: any = await importOriginal();
  return { ...real, createLtkParticles: (prepared: unknown, options: unknown) => { const fx = real.createLtkParticles(prepared, options); built.push(fx); return fx; } };
});
import { createVfxLibrary, attachedMeshOfItsOwn, withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, PLAY_OUT_CAP } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { ATTACHED_HELD_BACK, DISABLED_EMITTERS, LINGER_PLAY_OUT, MUTED_EMITTERS, PLAY_OUT_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { readVfxSystem } from '../src/rendering/three-mode/vfx-ltk/engine/parsing/readVfxSystem';
import { drawnEmitters } from '../src/rendering/three-mode/vfx-ltk/rendering/utils/definitions';
import { QUAD_TYPE } from '../src/rendering/three-mode/vfx-ltk/engine/model/enums';
import { constant, num, syntheticSystem } from './vfx-ltk-synthetic';

// Projectiles whose emitters author a particleLinger play out when they land (cue-overrides.ts LINGER_PLAY_OUT, Fable
// 11-21): their lingering trails finish on their own instead of the whole system going at the cue's end.
const LISTED = [...LINGER_PLAY_OUT][0]!, PLAIN = 'sample';
const flight = (system: string): TimelineCue => ({ system, event: 'projectile', delay: 0, duration: 0.6, travelSeconds: 0.6, bone: 'ground', targetBone: 'ground' });
async function setup() {
  built.length = 0;
  // Both systems emit for the whole flight; each particle lives 0.5 s and lingers 0.5 s after its emitter stops.
  const system = () => syntheticSystem({ lifetime: num(5), particleLifetime: constant(num(0.5)), particleLinger: num(0.5) });
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { [LISTED]: `systems/${LISTED}.json`, [PLAIN]: `systems/${PLAIN}.json` }, assets: { 'synthetic.tex': 'texture.png' }, skills: { gangplank: [flight(LISTED), flight(PLAIN)] } }
    : system(), readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map(['caster', 'target'].map((id, i) => {
    const root = new Group(); root.position.set(i * 20 + 5, 0, i * 30); scene.add(root); root.updateMatrixWorld();
    return [id, { root, body: null, alive: true }];
  }));
  const runtime = createLtkRuntime(library, scene, id => units.get(id));
  await runtime.warm('gangplank');
  expect(runtime.play('gangplank', 'caster', ['target'])).toBe(true);
  runtime.update(1 / 30, new Camera()); runtime.update(1 / 30, new Camera());
  const fx = (id: string) => built.find(f => f.object.userData.ltkSystem === id);
  return { runtime, scene, listed: fx(LISTED), plain: fx(PLAIN), advance: (seconds: number) => { for (let t = 0; t < seconds; t += 1 / 30) runtime.update(1 / 30, new Camera()); } };
}

describe('projectiles whose trails linger play out when they land (LINGER_PLAY_OUT)', () => {
  it('a listed projectile stays after landing while its lingering particles finish, then goes on its own; an unlisted one ends whole', async () => {
    const { runtime, scene, listed, plain, advance } = await setup();
    const stop = vi.spyOn(listed, 'stop'), ends = vi.spyOn(listed, 'endWithin');
    advance(0.65);
    expect(plain.object.parent).toBeNull();
    expect(listed.object.parent).toBe(scene);
    expect(stop).toHaveBeenCalledTimes(1);
    // No forced end or fade: its own curves end it.
    expect(ends).not.toHaveBeenCalled();
    expect(runtime.playing('caster')).toBe(false);
    advance(PLAY_OUT_CAP + 0.2);
    expect(listed.object.parent).toBeNull();
    runtime.dispose();
  });
  it('the same system fired twice: both tails play out side by side, and a clear (a combat ending) removes both at once', async () => {
    const { runtime, scene, advance } = await setup();
    expect(runtime.play('gangplank', 'caster', ['target'])).toBe(true);
    runtime.update(1 / 30, new Camera()); runtime.update(1 / 30, new Camera());
    advance(0.7);
    const tails = built.filter(f => f.object.userData.ltkSystem === LISTED);
    expect(tails).toHaveLength(2);
    expect(tails.every(f => f.object.parent === scene)).toBe(true);
    runtime.clear();
    expect(tails.every(f => f.object.parent === null)).toBe(true);
    runtime.dispose();
  });
  it('the set holds ids, none of them already ending by PLAY_OUT_SYSTEMS', () => {
    expect(LINGER_PLAY_OUT.size).toBeGreaterThan(0);
    for (const id of LINGER_PLAY_OUT) { expect(id).toMatch(/^[0-9a-f]{8}$/); expect(Object.hasOwn(PLAY_OUT_SYSTEMS, id)).toBe(false); }
  });
});

// With the assets (VFX_LTK_ROOT = an asset root's vfx-ltk folder), the set must be exactly the rule applied to them: every
// system the lists fire as a projectile (no PLAY_OUT_SYSTEMS entry, no cue playOut) whose drawn emitters author a linger.
const root = process.env.VFX_LTK_ROOT;
describe.skipIf(!root)('LINGER_PLAY_OUT is the rule applied to the assets (VFX_LTK_ROOT)', () => {
  it('every lingering projectile, and nothing else', () => {
    const read = (path: string) => JSON.parse(readFileSync(join(root!, path), 'utf8'));
    const top = read('index.json'), skills = { ...top.skills }, systems: Record<string, string> = { ...top.systems }, files: Record<string, string> = { ...top.systems };
    for (const path of new Set(Object.values(top.champions ?? {})) as Set<string>) {
      const one = read(path); Object.assign(skills, one.skills); Object.assign(systems, one.systems);
      for (const [id, file] of Object.entries(one.systems as Record<string, string>)) files[id] = join(path, '..', file);
    }
    const lists = (withCueOverrides({ version: 1, systems, assets: {}, skills } as never) as unknown as { skills: Record<string, TimelineCue[]> }).skills;
    const fired = new Map<string, boolean>();
    for (const cues of Object.values(lists)) for (const cue of cues ?? []) if (cue.event === 'projectile') fired.set(cue.system, (fired.get(cue.system) ?? false) || cue.playOut !== undefined);
    const expected: string[] = [];
    for (const [id, ownPlayOut] of fired) {
      if (ownPlayOut || Object.hasOwn(PLAY_OUT_SYSTEMS, id) || !files[id]) continue;
      const parsed = readVfxSystem(read(files[id]!)) as any, off = DISABLED_EMITTERS[id] ?? [];
      const model = { ...parsed, emitters: parsed.emitters.map((e: any) => off.includes(e.name ?? '') ? { ...e, disabled: true } : e) };
      const muted = [...(MUTED_EMITTERS[id] ?? []), ...(ATTACHED_HELD_BACK[id] ?? [])];
      const drawn = drawnEmitters(model, true).map(({ emitter }: any) => emitter).filter((e: any) => !e.disabled && !(e.quadType === QUAD_TYPE.mesh && e.mesh === null && !e.childSet)
        && !muted.includes(e.name ?? '') && !attachedMeshOfItsOwn(e));
      if (drawn.some((e: any) => (e.particleLinger ?? 0) > 0)) expected.push(id);
    }
    expect([...LINGER_PLAY_OUT].sort()).toEqual(expected.sort());
  });
});
