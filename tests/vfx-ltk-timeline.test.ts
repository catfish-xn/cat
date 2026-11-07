import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { mapSkillTimeline, selectTimeline, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { createLtkRuntime, ltkRenderNeeds, LTK_PASS_DEGRADE_AT, MAX_LTK_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { syntheticIndex, syntheticSystem, struct } from './vfx-ltk-synthetic';
import { S13_TIMELINES, convertedTimelines } from '../src/rendering/three-mode/vfx-ltk/s13-timelines';
import { parseIndex } from '../src/rendering/three-mode/vfx-ltk/loader';
const cues: TimelineCue[] = [
  { system: 'cast', event: 'cast-start', delay: 0, duration: 1, bone: 'R_Hand', stopAfter: 0.2 },
  { system: 'missile', event: 'projectile', delay: 0.2, duration: 0.5, travelSeconds: 0.5 },
  { system: 'impact', event: 'hit', delay: 0.7, duration: 0.3 },
];
async function setup(budget?: { live: number; max: number }) {
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(), readTexture: async () => new Texture() });
  const source = { root: new Group(), body: null, alive: true }, scene = new Scene();
  const runtime = createLtkRuntime(library, scene, id => id === 'caster' || id === 'target' ? source : undefined, { budget });
  await library.load('sample');
  return { runtime, library, scene, source, camera: new Camera() };
}
describe('cast timeline replacement and fallback', () => {
  it('prepares an empty definition without reserving runtime particle slots', async () => {
    const doc = syntheticSystem(); doc.root = struct('VfxSystemDefinitionData', {});
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : doc, readTexture: async () => new Texture() });
    await library.load('sample');
    const source = { root: new Group(), body: null, alive: true }, scene = new Scene(), budget = { live: 0, max: 1500 };
    const runtime = createLtkRuntime(library, scene, () => source, { budget });
    expect(runtime.play('jinx', 'caster', [])).toBe(true); runtime.update(0.01, new Camera());
    expect(runtime.queued).toBe(0); expect(runtime.active).toBe(0); expect(budget.live).toBe(0); expect(scene.children).toEqual([]); runtime.dispose();
  });
  it('binds the real export IDs, cast rotation and original source/target bones with explicit visual timing', () => {
    const jinx = S13_TIMELINES.jinx;
    expect(mapSkillTimeline(jinx, 'j', ['a', 'b'], 0).spawns.map(c => c.system)).toEqual(['a6a2b1cc', '3496e112', '10fede7e', '10fede7e']);
    expect(mapSkillTimeline(jinx, 'j', ['a', 'b'], 1).spawns.map(c => c.system)).toEqual(['9bd80364', 'cd05488e', 'cd05488e']);
    const rocket = mapSkillTimeline(jinx, 'j', ['a', 'b'], 2).spawns;
    expect(rocket.map(c => c.system)).toEqual(['7e6f06b5', '449d6617', '8b59c09d', '809da1b1']);
    expect(rocket.find(c => c.system === '8b59c09d')).toMatchObject({ bone: 'Cstm_Buffbone_Rocket_Launcher', targetBone: 'BUFFBONE_GLB_GROUND_LOC', targetId: 'a' });
    expect(mapSkillTimeline(jinx, 'j', ['a', 'b'], 3)).toEqual(mapSkillTimeline(jinx, 'j', ['a', 'b'], 0));
    const vi = mapSkillTimeline(S13_TIMELINES.vi, 'v', ['a', 'b']).spawns;
    expect(vi.find(c => c.system === 'c11e6814')).toMatchObject({ bone: 'R_Buffbone_Glb_Hand_Loc', stopAfter: 17 / 30 });
    expect(vi.find(c => c.system === '18e22631')).toMatchObject({ bone: 'BUFFBONE_GLB_GROUND_LOC', delay: 17 / 30 });
    expect(vi.filter(c => c.system === 'd27b3044').map(c => c.targetId)).toEqual(['a']);
    expect(vi.filter(c => c.system === '66c600e8').map(c => c.targetId)).toEqual(['a', 'b']);
    expect(vi.find(c => c.system === '66c600e8')!.bone).toBe('C_BUFFBONE_GLB_CHEST_LOC');
  });
  it('fills only complete converted exports and preserves explicit manifest timelines', () => {
    const systems = Object.fromEntries(Object.values(S13_TIMELINES).flatMap(cues => cues.map(c => [c.system, `systems/${c.system}.json`])));
    const index = parseIndex({ version: 1, systems, assets: {}, skills: {} });
    expect(index.skills).toEqual(S13_TIMELINES);
    const explicit = [{ system: '3496e112', event: 'cast-start', delay: 0, duration: 1 }];
    expect(parseIndex({ version: 1, systems, assets: {}, skills: { jinx: explicit } }).skills.jinx).toEqual(explicit);
    delete systems['3496e112']; expect(convertedTimelines(systems).jinx).toBeUndefined();
    expect(convertedTimelines(systems).vi).toEqual(S13_TIMELINES.vi);
    expect(() => parseIndex({ version: 1, systems, assets: {}, skills: { vi: [{ ...explicit[0], system: '0314626c', phase: 4 }] } })).toThrow('timeline-cue');
  });
  it('maps cast start, primary projectile, unique per-target impacts without creating gameplay commands', () => {
    const mapped = mapSkillTimeline(cues, 'caster', ['target', 'target', 'other', 'caster']);
    expect(mapped.spawns.map(c => [c.event, c.sourceId, c.targetId, c.delay])).toEqual([
      ['cast-start', 'caster', undefined, 0], ['projectile', 'caster', 'target', 0.2],
      ['hit', 'caster', 'target', 0.7], ['hit', 'caster', 'other', 0.7], ['hit', 'caster', 'caster', 0.7],
    ]);
    expect(mapped.unsupported).toEqual([]);
    const empty = mapSkillTimeline(cues, 'caster', []);
    expect(empty.spawns).toHaveLength(1);
    expect(empty.unsupported).toEqual(cues.slice(1).map(cue => ({ cue, reason: 'missing-target' })));
  });
  it.each(['jinx', 'vi'])('%s replaces only a fully prepared timeline', champion => {
    expect(selectTimeline(champion, cues, id => id !== 'missile')).toBeNull();
    expect(selectTimeline(champion, cues, () => true)).toBe(cues);
    expect(selectTimeline(champion, undefined, () => true)).toBeNull();
    expect(selectTimeline('renata', cues, () => true)).toBeNull();
  });
  it('leaves out an optional target cue with no recipient instead of refusing the cast', () => {
    const optional: TimelineCue[] = [cues[0], { ...cues[2], optional: true }, { ...cues[1], optional: true }];
    const none = mapSkillTimeline(optional, 'caster', []);
    expect(none.unsupported).toEqual([]);
    expect(none.spawns.map(spawn => spawn.system)).toEqual(['cast']);
    expect(mapSkillTimeline(optional, 'caster', ['caster']).spawns.map(spawn => spawn.system)).toEqual(['cast', 'impact']);
    // A required one still refuses.
    expect(mapSkillTimeline(cues, 'caster', []).unsupported).toHaveLength(2);
    expect(() => parseIndex({ version: 1, systems: { a: 'a.json' }, assets: {}, skills: { probe: [{ system: 'a', event: 'cast-start', delay: 0, duration: 1, optional: true }] } })).toThrow('timeline-cue');
  });
  it('aims a cast-start at the primary target, never at the caster itself', () => {
    const cues: TimelineCue[] = [{ system: 'a', event: 'cast-start', delay: 0, duration: 1 }];
    expect(mapSkillTimeline(cues, 'caster', ['enemy', 'other']).spawns[0]?.aimId).toBe('enemy');
    expect(mapSkillTimeline(cues, 'caster', ['caster']).spawns[0]?.aimId).toBeUndefined();
    expect(mapSkillTimeline(cues, 'caster', []).spawns[0]?.aimId).toBeUndefined();
  });
  it('turns a cast on itself toward the nearest foe, and a targeted cast toward its own target (Irelia W, 11-07)', async () => {
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(), readTexture: async () => new Texture() });
    const caster = { root: new Group(), body: null, alive: true }, target = { root: new Group(), body: null, alive: true };
    const foe = vi.fn((_: string) => new Group());
    const runtime = createLtkRuntime(library, new Scene(), id => id === 'caster' ? caster : id === 'target' ? target : undefined, { foe });
    await library.load('sample');
    expect(runtime.play('jinx', 'caster', [])).toBe(true);
    runtime.update(0.01, new Camera()); runtime.update(0.05, new Camera());
    expect(foe).toHaveBeenCalledWith('caster');
    runtime.dispose(); foe.mockClear();
    const again = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(), readTexture: async () => new Texture() });
    const aimed = createLtkRuntime(again, new Scene(), id => id === 'caster' ? caster : id === 'target' ? target : undefined, { foe });
    await again.load('sample');
    expect(aimed.play('jinx', 'caster', ['target'])).toBe(true);
    aimed.update(0.01, new Camera()); aimed.update(0.05, new Camera());
    expect(foe).not.toHaveBeenCalled();
    aimed.dispose();
  });
  it('leaves a mesh primitive that names no mesh undrawn instead of failing the system (Darius Q_Heal)', async () => {
    const meshless = syntheticSystem({ primitive: struct('VfxPrimitiveMesh', {}) });
    const doc = syntheticSystem();
    (doc.root as { fields: unknown[] }).fields = [{ ...(doc.root as { fields: { value: { items: unknown[] } }[] }).fields[0],
      value: { type: 'container', items: [
        ...((doc.root as { fields: { value: { items: unknown[] } }[] }).fields[0].value.items),
        ...((meshless.root as { fields: { value: { items: unknown[] } }[] }).fields[0].value.items),
      ] } }];
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : doc, readTexture: async () => new Texture() });
    const prepared = await library.load('sample');
    expect(prepared.model.emitters).toHaveLength(2);
    expect(prepared.drawn).toHaveLength(1);
    expect(prepared.empty).toBeFalsy();
  });
  it('keeps legacy during missing manifest/load, then owns a ready cast, starts/stops/disposes it', async () => {
    const { runtime, scene, camera } = await setup();
    expect(runtime.play('vi', 'caster', ['target'])).toBe(false);
    expect(runtime.play('jinx', 'absent', [])).toBe(false);
    expect(runtime.play('jinx', 'caster', [])).toBe(true);
    runtime.update(0.01, camera); expect(runtime.active).toBe(1); expect(scene.children).toHaveLength(1);
    runtime.stopUnit('caster'); runtime.update(1.1, camera);
    expect(runtime.active).toBe(0); expect(scene.children).toHaveLength(0);
    runtime.dispose(); expect(runtime.play('jinx', 'caster', [])).toBe(false);
  });
  it('phase reset cancels queued and live effects; stale tab-resume bursts do not spawn', async () => {
    const { runtime, scene, camera } = await setup();
    runtime.play('jinx', 'caster', []); runtime.clear(); runtime.update(0.01, camera); expect(runtime.active).toBe(0);
    runtime.play('jinx', 'caster', []); runtime.update(1, camera); expect(runtime.active).toBe(0);
    runtime.play('jinx', 'caster', []); runtime.update(0.01, camera); runtime.clear();
    expect(runtime.active).toBe(0); expect(runtime.queued).toBe(0); expect(scene.children).toHaveLength(0); runtime.dispose();
  });
  it('shares the existing fallback particle budget and releases every reservation once', async () => {
    // A plain attack waits for shared room once half the LTK slots are live; skills are covered by the next test.
    const index = { ...syntheticIndex(), skills: { jinx: [
      { system: 'sample', event: 'cast-start' as const, delay: 0, duration: 1 },
      { system: 'sample', action: 'attack' as const, event: 'hit' as const, delay: 0, duration: 1 },
    ] } };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(), readTexture: async () => new Texture() });
    const source = { root: new Group(), body: null, alive: true }, camera = new Camera(), budget = { live: 1499, max: 1500 };
    const runtime = createLtkRuntime(library, new Scene(), id => id === 'caster' || id === 'target' ? source : undefined, { budget });
    await library.load('sample');
    // Below half: a hit takes a free LTK slot even when fallback particles fill the shared budget.
    runtime.play('jinx', 'caster', ['target'], 0, 'attack'); runtime.update(0.01, camera); expect(runtime.active).toBe(1); expect(budget.live).toBe(1749);
    runtime.clear(); expect(budget.live).toBe(1499);
    budget.live = 0;
    for (let i = 0; i < 3; i++) { runtime.play('jinx', 'caster', []); runtime.update(0.01, camera); }
    expect(runtime.active).toBe(3); budget.live += 501;
    runtime.play('jinx', 'caster', ['target'], 0, 'attack'); runtime.update(0.01, camera); expect(runtime.active).toBe(3); expect(budget.live).toBe(1251);
    budget.live = 1200; runtime.play('jinx', 'caster', ['target'], 0, 'attack'); runtime.update(0.01, camera);
    expect(runtime.active).toBe(4); expect(budget.live).toBe(1450);
    runtime.clear(); expect(budget.live).toBe(450); runtime.dispose(); runtime.dispose(); expect(budget.live).toBe(450);
  });
  it('queues a critical cue for up to 0.3 s while six runs fill the board, instead of dropping it (11-07 brawl)', async () => {
    const index = { ...syntheticIndex(), skills: { jinx: [{ system: 'sample', event: 'cast-start' as const, delay: 0, duration: 0.2 }],
      vi: [{ system: 'sample', event: 'hit' as const, delay: 0, duration: 1 }],
      ezreal: [{ system: 'sample', event: 'hit' as const, delay: 0, duration: 0.15 }] } };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(), readTexture: async () => new Texture() });
    const source = { root: new Group(), body: null, alive: true }, camera = new Camera();
    const runtime = createLtkRuntime(library, new Scene(), id => id === 'caster' || id === 'target' ? source : undefined);
    await library.load('sample');
    // Six hits (critical, nothing evictable) fill the board for a second.
    for (let i = 0; i < 6; i++) { runtime.play('vi', 'caster', ['target']); runtime.update(0.01, camera); }
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    // A seventh hit waits; a decorative flourish is dropped as before.
    runtime.play('vi', 'caster', ['target']); runtime.play('jinx', 'caster', []); runtime.update(0.01, camera);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS); expect(runtime.queued).toBe(1);
    // Past 0.3 s the waiting hit is dropped too.
    runtime.update(0.35, camera); expect(runtime.queued).toBe(0); expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    runtime.clear();
    // Slots that end within the wait let the queued hit in.
    for (let i = 0; i < 6; i++) { runtime.play('ezreal', 'caster', ['target']); runtime.update(0.01, camera); }
    runtime.play('vi', 'caster', ['target']); runtime.update(0.01, camera); expect(runtime.queued).toBe(1);
    runtime.update(0.12, camera); runtime.update(0.01, camera);
    expect(runtime.queued).toBe(0); expect(runtime.active).toBeGreaterThanOrEqual(1);
    runtime.dispose();
  });
  it('starts a skill system beside a budget the fallback particles filled, up to the LTK reservations alone (11-06 field drops)', async () => {
    const budget = { live: 1499, max: 1500 }, { runtime, camera } = await setup(budget);
    runtime.play('jinx', 'caster', []); runtime.update(0.01, camera);
    expect(runtime.active).toBe(1); expect(budget.live).toBe(1749);
    // The LTK reservations alone still stop at the cap: six systems of 250 fill 1500.
    for (let i = 0; i < 10; i++) { runtime.play('jinx', 'caster', []); runtime.update(0.01, camera); }
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    runtime.clear(); expect(budget.live).toBe(1499); runtime.dispose();
  });
  it('bounds simultaneous particle reservations and cancels deaths before delayed spawn', async () => {
    const { runtime, camera } = await setup();
    for (let i = 0; i < 20; i++) runtime.play('jinx', 'caster', []);
    runtime.update(0.01, camera); runtime.update(0.01, camera);
    expect(runtime.active).toBeLessThanOrEqual(MAX_LTK_SYSTEMS);
    runtime.clear(); runtime.play('jinx', 'caster', []); runtime.stopUnit('caster'); runtime.update(0.01, camera);
    expect(runtime.active).toBe(0); runtime.dispose();
  });
  it('drops distortion and soft passes once four systems are live, and keeps them below that', () => {
    const heavy = { passes: { early: true, late: true, soft: true } };
    expect(LTK_PASS_DEGRADE_AT).toBe(4);
    expect(ltkRenderNeeds([heavy, heavy, heavy])).toEqual({ early: true, late: true, soft: true });
    expect(ltkRenderNeeds([heavy, heavy, heavy, heavy])).toEqual({ early: false, late: false, soft: false });
    expect(ltkRenderNeeds([{ passes: { early: false, late: false, soft: true } }])).toEqual({ early: false, late: false, soft: true });
  });
});

it('expires Vi flight at landing even after a frame-quantized start, leaving room for every impact', async () => {
  const cues = S13_TIMELINES.vi, systems = Object.fromEntries(cues.map(c => [c.system, `systems/${c.system}.json`]));
  const library = createVfxLibrary('/root/', {
    readJson: async url => {
      if (url.endsWith('index.json')) return { version: 1, systems, assets: { 'synthetic.tex': 'texture.png' }, skills: { vi: cues } };
      const doc = syntheticSystem(); if (url.includes('25afa6a6')) doc.root = struct('VfxSystemDefinitionData', {}); return doc;
    }, readTexture: async () => new Texture(),
  });
  const scene = new Scene(), source = { root: new Group(), body: null, alive: true }, budget = { live: 0, max: 1500 };
  const runtime = createLtkRuntime(library, scene, () => source, { budget });
  await runtime.warm('vi'); expect(runtime.play('vi', 'source', ['target'])).toBe(true);
  for (let frame = 0; frame < 17; frame++) runtime.update(1 / 30, new Camera());
  const live = scene.children.map(o => o.userData.ltkSystem);
  expect(live).toContain('66c600e8'); expect(live).toContain('d27b3044'); expect(live).toContain('18e22631');
  expect(live).not.toContain('84b969e0'); expect(runtime.active).toBe(6); expect(budget.live).toBe(1500);
  runtime.dispose(); expect(budget.live).toBe(0); expect(scene.children).toHaveLength(0);
});
