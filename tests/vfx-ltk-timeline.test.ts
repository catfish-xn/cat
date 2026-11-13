import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { mapSkillTimeline, selectTimeline, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { createLtkRuntime, ltkRenderNeeds, LTK_PASS_DEGRADE_AT, MAX_LTK_SYSTEMS, MIN_RESERVE } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { createLtkParticles, measurePeak, pointAnchor } from '../src/rendering/three-mode/vfx-ltk/particles';
import { constant, num, syntheticIndex, syntheticSystem, struct } from './vfx-ltk-synthetic';
import { S13_TIMELINES, VI_LANDING, VI_ROW_SHOCKWAVE, convertedTimelines } from '../src/rendering/three-mode/vfx-ltk/s13-timelines';
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
    // The cast's branch comes from the rule's cast event; the runtime keeps only that branch's cues (and untagged ones).
    const jinxCues = S13_TIMELINES.jinx, jinx = (branch: string) => jinxCues.filter(c => c.branch === undefined || c.branch === branch);
    expect(mapSkillTimeline(jinx('zap'), 'j', ['a', 'b']).spawns.map(c => c.system)).toEqual(['a6a2b1cc', '3496e112', '10fede7e', '10fede7e']);
    expect(mapSkillTimeline(jinx('chompers'), 'j', ['a', 'b']).spawns.map(c => c.system)).toEqual(['9bd80364', 'cd05488e', 'cd05488e']);
    const rocket = mapSkillTimeline(jinx('rocket'), 'j', ['a', 'b']).spawns;
    expect(rocket.map(c => c.system)).toEqual(['7e6f06b5', '449d6617', '8b59c09d', '809da1b1']);
    expect(rocket.find(c => c.system === '8b59c09d')).toMatchObject({ bone: 'Cstm_Buffbone_Rocket_Launcher', targetBone: 'BUFFBONE_GLB_GROUND_LOC', targetId: 'a' });
    expect(new Set(jinxCues.map(c => c.branch))).toEqual(new Set(['zap', 'chompers', 'rocket']));
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
    expect(() => parseIndex({ version: 1, systems, assets: {}, skills: { vi: [{ ...explicit[0], system: '0314626c', branch: 'not a branch' }] } })).toThrow('timeline-cue');
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
  it('leaves the muted white flashes of Nunu\'s stretched R_Cas undrawn and keeps its other emitters (11-07)', async () => {
    const named = (name: string) => syntheticSystem({ emitterName: { type: 'string', value: name } });
    const items = (doc: ReturnType<typeof syntheticSystem>) => (doc.root as { fields: { value: { items: unknown[] } }[] }).fields[0].value.items;
    const doc = named('Dark glow');
    (doc.root as { fields: unknown[] }).fields = [{ ...(doc.root as { fields: unknown[] }).fields[0] as object,
      value: { type: 'container', items: [...items(named('Dark glow')), ...items(named('Explosion_Flash_ground')), ...items(named('Explosion_Flash_ground1'))] } }];
    const index = { ...syntheticIndex(), systems: { '78d04f27': 'systems/r_cas.json', other: 'systems/other.json' }, skills: {} };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : doc, readTexture: async () => new Texture() });
    const pool = await library.load('78d04f27');
    expect(pool.model.emitters).toHaveLength(3);
    expect(pool.drawn.map(d => d.emitter.name)).toEqual(['Dark glow']);
    // The same emitters in another system are drawn.
    expect((await library.load('other')).drawn).toHaveLength(3);
  });
  it('leaves Sevika punch hit BUBBLE_START1 (attached mesh at bubble scale) undrawn and keeps its other emitters (11-10)', async () => {
    const named = (name: string) => syntheticSystem({ emitterName: { type: 'string', value: name } });
    const items = (doc: ReturnType<typeof syntheticSystem>) => (doc.root as { fields: { value: { items: unknown[] } }[] }).fields[0].value.items;
    const doc = named('BIGGEST_Flash');
    (doc.root as { fields: unknown[] }).fields = [{ ...(doc.root as { fields: unknown[] }).fields[0] as object,
      value: { type: 'container', items: [...items(named('BIGGEST_Flash')), ...items(named('BUBBLE_START1'))] } }];
    const index = { ...syntheticIndex(), systems: { '95fb90ce': 'systems/punch_hit.json' }, skills: {} };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : doc, readTexture: async () => new Texture() });
    const pool = await library.load('95fb90ce');
    expect(pool.model.emitters).toHaveLength(2);
    expect(pool.drawn.map(d => d.emitter.name)).toEqual(['BIGGEST_Flash']);
  });
  it('draws the Trench of Vi\'s row shockwave again, with its stopped head faded (a fit), beside its other emitters', async () => {
    const named = (name: string) => syntheticSystem({ emitterName: { type: 'string', value: name } });
    const items = (doc: ReturnType<typeof syntheticSystem>) => (doc.root as { fields: { value: { items: unknown[] } }[] }).fields[0].value.items;
    const doc = named('Dust');
    (doc.root as { fields: unknown[] }).fields = [{ ...(doc.root as { fields: unknown[] }).fields[0] as object,
      value: { type: 'container', items: [...items(named('SpikeShapes1')), ...items(named('Dust')), ...items(named('Trench'))] } }];
    const index = { ...syntheticIndex(), systems: { '84b969e0': 'systems/landing_mis.json' }, skills: {} };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : doc, readTexture: async () => new Texture() });
    const pool = await library.load('84b969e0');
    expect(pool.model.emitters).toHaveLength(3);
    expect(pool.drawn.map(d => d.emitter.name)).toEqual(['SpikeShapes1', 'Dust', 'Trench']);
    expect([...pool.endFade ?? []]).toEqual(['Trench']);
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
    runtime.play('jinx', 'caster', ['target'], 'attack'); runtime.update(0.01, camera); expect(runtime.active).toBe(1); expect(budget.live).toBe(1749);
    runtime.clear(); expect(budget.live).toBe(1499);
    // From half the systems on (six), it waits for shared room; a larger shared budget lets six first plays in.
    budget.live = 0; budget.max = 3000;
    for (let i = 0; i < 6; i++) { runtime.play('jinx', 'caster', []); runtime.update(0.01, camera); }
    expect(runtime.active).toBe(6); budget.live += 1251;
    runtime.play('jinx', 'caster', ['target'], 'attack'); runtime.update(0.01, camera); expect(runtime.active).toBe(6); expect(budget.live).toBe(2751);
    budget.live = 2700; runtime.play('jinx', 'caster', ['target'], 'attack'); runtime.update(0.01, camera);
    expect(runtime.active).toBe(7); expect(budget.live).toBe(2950);
    runtime.clear(); expect(budget.live).toBe(1200); runtime.dispose(); runtime.dispose(); expect(budget.live).toBe(1200);
  });
  it('queues a critical cue for up to 0.3 s while critical runs fill the board, instead of dropping it (11-07 brawl)', async () => {
    const index = { ...syntheticIndex(), skills: { jinx: [{ system: 'sample', event: 'cast-start' as const, delay: 0, duration: 0.2 }],
      vi: [{ system: 'sample', event: 'hit' as const, delay: 0, duration: 1 }],
      ezreal: [{ system: 'sample', event: 'hit' as const, delay: 0, duration: 0.15 }] } };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(), readTexture: async () => new Texture() });
    const source = { root: new Group(), body: null, alive: true }, camera = new Camera();
    const runtime = createLtkRuntime(library, new Scene(), id => id === 'caster' || id === 'target' ? source : undefined);
    await library.load('sample');
    // Hits (critical, nothing evictable) fill the board for a second.
    for (let i = 0; i < MAX_LTK_SYSTEMS; i++) { runtime.play('vi', 'caster', ['target']); runtime.update(0.01, camera); }
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    // One more hit waits; a decorative flourish is dropped as before.
    runtime.play('vi', 'caster', ['target']); runtime.play('jinx', 'caster', []); runtime.update(0.01, camera);
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS); expect(runtime.queued).toBe(1);
    // Past 0.3 s the waiting hit is dropped too.
    runtime.update(0.35, camera); expect(runtime.queued).toBe(0); expect(runtime.active).toBe(MAX_LTK_SYSTEMS);
    runtime.clear();
    // Slots that end within the wait let the queued hit in.
    // Six start per frame, so the board fills in a few frames, well inside the 0.15 s these hits last.
    for (let i = 0; i < MAX_LTK_SYSTEMS; i++) { runtime.play('ezreal', 'caster', ['target']); if (i % 6 === 5 || i === MAX_LTK_SYSTEMS - 1) runtime.update(0.01, camera); }
    runtime.play('vi', 'caster', ['target']); runtime.update(0.01, camera); expect(runtime.queued).toBe(1);
    runtime.update(0.12, camera); runtime.update(0.01, camera);
    expect(runtime.queued).toBe(0); expect(runtime.active).toBeGreaterThanOrEqual(1);
    runtime.dispose();
  });
  it('starts a skill system beside a budget the fallback particles filled, up to the LTK reservations alone (11-06 field drops)', async () => {
    const budget = { live: 1499, max: 1500 }, { runtime, camera } = await setup(budget);
    runtime.play('jinx', 'caster', []); runtime.update(0.01, camera);
    expect(runtime.active).toBe(1); expect(budget.live).toBe(1749);
    // The LTK reservations alone still stop at the cap: six first plays of 250 fill 1500.
    for (let i = 0; i < 10; i++) { runtime.play('jinx', 'caster', []); runtime.update(0.01, camera); }
    expect(runtime.active).toBe(6);
    runtime.clear(); expect(budget.live).toBe(1499); runtime.dispose();
  });
  it('reserves what a system was seen to need once it has played to its end, so more small systems fit (11-07 brawl)', async () => {
    const budget = { live: 0, max: 1500 }, { runtime, camera } = await setup(budget);
    runtime.play('jinx', 'caster', []); runtime.update(0.01, camera); expect(budget.live).toBe(250);
    runtime.update(1.2, camera); expect(runtime.active).toBe(0); expect(budget.live).toBe(0);
    // The synthetic system peaks at a few particles: later plays reserve the floor, not 250 each.
    for (let i = 0; i < MAX_LTK_SYSTEMS + 8; i++) { runtime.play('jinx', 'caster', []); runtime.update(0.01, camera); }
    expect(runtime.active).toBe(MAX_LTK_SYSTEMS); expect(budget.live).toBe(MAX_LTK_SYSTEMS * MIN_RESERVE);
    // Every slot comes back, and a play cut short (cleared before its end) records nothing.
    runtime.clear(); expect(budget.live).toBe(0);
    runtime.play('jinx', 'caster', []); runtime.update(0.01, camera); expect(budget.live).toBe(MIN_RESERVE);
    runtime.dispose();
  });
  it('never lowers a system\'s reservation after a play that peaked lower', async () => {
    // One busy system on two cues: a full second, and a 0.03 s cue that ends before many particles are born.
    const index = { ...syntheticIndex(), skills: {
      jinx: [{ system: 'sample', event: 'cast-start' as const, delay: 0, duration: 1 }],
      vi: [{ system: 'sample', event: 'cast-start' as const, delay: 0, duration: 0.03 }] } };
    const busy = syntheticSystem({ rate: constant(num(600)), lifetime: num(1), particleLifetime: constant(num(1)) });
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : busy, readTexture: async () => new Texture() });
    const source = { root: new Group(), body: null, alive: true }, camera = new Camera(), budget = { live: 0, max: 1500 };
    const runtime = createLtkRuntime(library, new Scene(), () => source, { budget });
    await library.load('sample');
    const reserved = (skill: string) => { runtime.play(skill, 'caster', []); runtime.update(0.01, camera); const held = budget.live; runtime.clear(); return held; };
    const playOut = (skill: string) => { runtime.play(skill, 'caster', []); for (let t = 0; t < 1.2; t += 0.01) runtime.update(0.01, camera); };
    playOut('jinx');
    const full = reserved('jinx');
    expect(full).toBeGreaterThan(MIN_RESERVE);
    playOut('vi'); // peaks far lower
    expect(reserved('jinx')).toBe(full);
    runtime.dispose();
  });
  it('bounds simultaneous particle reservations and cancels deaths before delayed spawn', async () => {
    const { runtime, camera } = await setup();
    for (let i = 0; i < 20; i++) runtime.play('jinx', 'caster', []);
    runtime.update(0.01, camera); runtime.update(0.01, camera);
    expect(runtime.active).toBeLessThanOrEqual(MAX_LTK_SYSTEMS);
    runtime.clear(); runtime.play('jinx', 'caster', []); runtime.stopUnit('caster'); runtime.update(0.01, camera);
    expect(runtime.active).toBe(0); runtime.dispose();
  });
  it('drops the late distortion and soft passes once four systems are live, keeps them below that, and always keeps the early pass', () => {
    const heavy = { passes: { early: true, late: true, soft: true } };
    expect(LTK_PASS_DEGRADE_AT).toBe(4);
    expect(ltkRenderNeeds([heavy, heavy, heavy])).toEqual({ early: true, late: true, soft: true });
    expect(ltkRenderNeeds([heavy, heavy, heavy, heavy])).toEqual({ early: true, late: false, soft: false });
    // Early is still only drawn when a live system asks for it.
    const soft = { passes: { early: false, late: true, soft: true } };
    expect(ltkRenderNeeds([soft, soft, soft, soft])).toEqual({ early: false, late: false, soft: false });
    expect(ltkRenderNeeds([{ passes: { early: false, late: false, soft: true } }])).toEqual({ early: false, late: false, soft: true });
  });
});

it('warm measures each system in place, so a first play reserves what a run of it holds, not the full room', async () => {
  const rich = syntheticSystem({ rate: constant(num(120)), lifetime: num(1), particleLifetime: constant(num(0.5)) });
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: { rich: 'systems/rich.json' }, assets: { 'synthetic.tex': 'texture.png' }, skills: { jinx: [{ system: 'rich', event: 'cast-start', delay: 0, duration: 1 }] } }
    : rich, readTexture: async () => new Texture() });
  const budget = { live: 0, max: 1500 }, scene = new Scene(), runtime = createLtkRuntime(library, scene, () => ({ root: new Group(), body: null, alive: true }), { budget });
  await runtime.warm('jinx');
  const measured = measurePeak(library.get('rich')!, 1);
  expect(measured).toBeGreaterThan(MIN_RESERVE); expect(Math.ceil(measured * 1.25)).toBeLessThan(250);
  expect(runtime.play('jinx', 'caster', [])).toBe(true);
  runtime.update(1 / 30, new Camera());
  expect(budget.live).toBe(Math.ceil(measured * 1.25));
  // The measure is the engine's own run: a drawn run of the same system peaks the same.
  const fx = createLtkParticles(library.get('rich')!, { anchor: pointAnchor([0, 0, 0]), target: null, joints: () => pointAnchor([0, 0, 0]), duration: 1, seed: 1 });
  let drawn = 0; for (let f = 0; f < 30; f++) { fx.update(1 / 30, new Camera()); drawn = Math.max(drawn, fx.peak); }
  expect(drawn).toBe(measured); fx.dispose(); runtime.dispose();
});

it('Vi: her landing systems start on the landing frame; her row shockwave pair starts whole on its own frame, the first cast like any later one', async () => {
  const cues = S13_TIMELINES.vi, systems = Object.fromEntries(cues.map(c => [c.system, `systems/${c.system}.json`]));
  const library = createVfxLibrary('/root/', {
    readJson: async url => {
      if (url.endsWith('index.json')) return { version: 1, systems, assets: { 'synthetic.tex': 'texture.png' }, skills: { vi: cues } };
      const doc = syntheticSystem(); if (url.includes('25afa6a6')) doc.root = struct('VfxSystemDefinitionData', {}); return doc;
    }, readTexture: async () => new Texture(),
  });
  const scene = new Scene(), units = new Map(['source', 'target'].map((id, i) => { const root = new Group(); root.position.set(i * 30, 0, 0); return [id, { root, body: null, alive: true }]; }));
  const budget = { live: 0, max: 1500 }, runtime = createLtkRuntime(library, scene, id => units.get(id), { budget });
  const live = () => scene.children.map(o => o.userData.ltkSystem as string).filter(Boolean);
  const rows = () => live().filter(id => id === '84b969e0').length;
  const step = (frames: number, each?: () => void) => { for (let f = 0; f < frames; f++) { runtime.update(1 / 30, new Camera()); each?.(); } };
  const launch = Math.ceil(VI_ROW_SHOCKWAVE.delay * 30);
  expect(VI_ROW_SHOCKWAVE.delay).toBeLessThanOrEqual(VI_LANDING); // launched with her landing
  await runtime.warm('vi');
  // Warm measured each system in place, so a first cast reserves what its systems hold, not 250 each (which filled the
  // 1500 at six and dropped the pair on every first cast before 11-12): the first cast plays like any later one.
  for (const first of [true, false]) {
    expect(runtime.play('vi', 'source', ['target'])).toBe(true);
    step(launch - 1, () => expect(rows()).toBe(0));
    step(2, () => expect([0, 2]).toContain(rows())); // both in one frame, never one side alone
    expect(rows()).toBe(2);
    for (const id of ['c11e6814', '0314626c', '9614ffb4', 'd27b3044', '18e22631', '66c600e8']) expect(live(), String(first)).toContain(id);
    expect(runtime.active).toBe(8); expect(budget.live).toBe(8 * MIN_RESERVE); // every synthetic system measures below the floor
    expect(budget.live).toBeLessThanOrEqual(budget.max);
    for (let f = 0; f < 300 && runtime.active; f++) step(1);
    expect(runtime.active).toBe(0);
  }
  runtime.dispose(); expect(budget.live).toBe(0); expect(scene.children).toHaveLength(0);
});

