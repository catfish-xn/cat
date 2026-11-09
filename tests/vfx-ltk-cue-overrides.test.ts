import { effectImportance } from '../src/rendering/three-mode/effect-budget';
import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { CUE_OVERRIDES, cueOverride } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { sevikaSkills } from '../src/rendering/three-mode/vfx-ltk/champions/sevika';
import { createVfxLibrary, parseIndex, withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import { ARENA_UNIT_SCALE, cueSize, FX_SOURCE_SCALE, measuredAtFxScale, SKILL_FX_SIZE } from '../src/rendering/three-mode/vfx-ltk/fx-size';
import { createLtkParticles, FX_SCALE, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { AXIS_SIGN } from '../src/rendering/three-mode/vfx-ltk/space';
import { mapSkillTimeline, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { syntheticIndex, syntheticSystem } from './vfx-ltk-synthetic';
// @ts-expect-error Offline Node module.
import { BOARD_PICKS } from '../scripts/assets3d/boards-plan.mjs';

describe('reviewed vfx-ltk cue overrides', () => {
  const exported: TimelineCue[] = [{ system: 'aa', action: 'cast', event: 'hit', delay: 0.8, duration: 1 }];
  const fixed: TimelineCue[] = [{ system: 'bb', action: 'cast', event: 'cast-start', delay: 0.2, duration: 0.6 }];
  const index = (systems: Record<string, string>) => ({ version: 1, systems, assets: {}, skills: { probe: exported } });

  it('replaces a champion\'s exported list only when every overriding system was exported', () => {
    (CUE_OVERRIDES as Record<string, readonly TimelineCue[]>).probe = fixed;
    try {
      expect(withCueOverrides(parseIndex(index({ aa: 'aa.json', bb: 'bb.json' }))).skills.probe).toEqual(fixed);
      expect(withCueOverrides(parseIndex(index({ aa: 'aa.json' }))).skills.probe).toEqual(exported);
      // parseIndex itself returns the exported timeline untouched.
      expect(parseIndex(index({ aa: 'aa.json', bb: 'bb.json' })).skills.probe).toEqual(exported);
      expect(cueOverride('probe', { aa: 'x' })).toBeUndefined();
    } finally { delete (CUE_OVERRIDES as Record<string, readonly TimelineCue[]>).probe; }
  });

  it('every shipped override is a well-formed timeline', () => {
    for (const [champion, cues] of Object.entries(CUE_OVERRIDES)) {
      const systems = Object.fromEntries(cues.map(cue => [cue.system, `${cue.system}.json`]));
      expect(() => parseIndex({ version: 1, systems, assets: {}, skills: { [champion]: cues } }), champion).not.toThrow();
    }
    expect(CUE_OVERRIDES.garen.find(cue => cue.system === '5bbccb8c')?.scale).toBe(measuredAtFxScale(0.45));
    expect(CUE_OVERRIDES.vex.find(cue => cue.system === '8682c9ee')?.scale).toBe(measuredAtFxScale(0.68));
    expect(CUE_OVERRIDES.vex.find(cue => cue.system === 'eb9da1d5')?.scale).toBe(measuredAtFxScale(0.68));
    expect(CUE_OVERRIDES.vex.find(cue => cue.system === 'c4da788c')?.scale).toBeUndefined();
    // 11-06 field review: the cloud holds 3 s, then the burst (0.5, about 2.9 cells) and each target's splash.
    // Measured 5.8 cells at 0.5 against the cloud's 5 (cdacbcc9): 0.43 lands on it.
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '8c256426')?.scale).toBe(measuredAtFxScale(0.43));
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '8c256426')?.delay).toBe(3);
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '78d04f27')?.duration).toBeGreaterThanOrEqual(3);
    // The pool keeps emitting until the blast starts: no empty gap between them (clean4 frames 58-61).
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '78d04f27')?.stopAfter).toBeGreaterThanOrEqual(CUE_OVERRIDES.nunu.find(cue => cue.system === '8c256426')!.delay);
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '78d04f27')?.scale).toBe(CUE_OVERRIDES.nunu.find(cue => cue.system === '8c256426')?.scale);
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '5dfd387b')?.delay).toBeGreaterThanOrEqual(3);
    expect(CUE_OVERRIDES.nunu.find(cue => cue.system === '5dfd387b')?.scale).toBe(measuredAtFxScale(0.7));
    // Ezreal: W's orb and ring on the primary before Q's shot; both missiles aim at a target bone.
    const ezreal = CUE_OVERRIDES.ezreal.filter(cue => cue.action === 'cast');
    expect(ezreal.filter(cue => cue.event === 'projectile').every(cue => cue.targetBone)).toBe(true);
    expect(ezreal.find(cue => cue.system === 'd887e7a6')?.primary).toBe(true);
    expect(ezreal.find(cue => cue.system === 'd887e7a6')!.delay).toBeLessThan(ezreal.find(cue => cue.system === 'e4979a04')!.delay);
    // Irelia: the swipe waits for the guard's end; Darius: the hit spark is optional.
    expect(CUE_OVERRIDES.irelia.find(cue => cue.system === '08b7a939')?.delay).toBeGreaterThanOrEqual(1.4);
    expect(CUE_OVERRIDES.darius.find(cue => cue.system === 'a5373796')?.optional).toBe(true);
    // Morgana: the curse stays on its one target for the 8 pulses.
    expect(CUE_OVERRIDES.morgana.find(cue => cue.system === '7fb1a74c')?.duration).toBeGreaterThanOrEqual(8);
    // Renata: the export has no cast timeline; the override flies the missile before the blast and keeps the attack.
    const renata = CUE_OVERRIDES.renata;
    expect(renata.filter(cue => cue.action === 'attack').map(cue => cue.system)).toEqual(['06e90178', '0f2af66b']);
    const missile = renata.find(cue => cue.system === 'faf1aeac')!;
    expect(missile.event).toBe('projectile');
    expect(missile.delay + missile.travelSeconds!).toBeLessThanOrEqual(renata.find(cue => cue.system === 'f9926ae8')!.delay);
    expect(mapSkillTimeline(renata.filter(cue => cue.action === 'cast'), 'renata', ['a', 'b']).unsupported).toEqual([]);
    // The canister puffs end before the flight starts; the ally shield lasts the ability's 3 s.
    expect(renata.find(cue => cue.system === 'cff69d8a')!.duration).toBeLessThanOrEqual(missile.delay + 0.1);
    expect(renata.find(cue => cue.system === 'fdf79734')).toMatchObject({ action: 'passive', duration: 3 });
    // A full board keeps it: it ranks with receipt feedback, not with caster flourishes.
    expect(effectImportance(renata.find(cue => cue.system === 'fdf79734')!)).toBe('critical');
    // Zyra E: a ground vine crawls to the primary target, then short ones to up to two others; the root binds the primary.
    const zyra = mapSkillTimeline(CUE_OVERRIDES.zyra.filter(cue => cue.action === 'cast'), 'zyra', ['a', 'b', 'c', 'd']);
    expect(zyra.unsupported).toEqual([]);
    const vines = zyra.spawns.filter(spawn => spawn.system === '857fe049');
    expect(vines.map(spawn => [spawn.event, spawn.targetId])).toEqual([['projectile', 'a'], ['projectile', 'b'], ['projectile', 'c']]);
    const [main] = vines, root = zyra.spawns.find(spawn => spawn.system === 'b888a24f')!;
    expect(root).toMatchObject({ event: 'hit', targetId: 'a' });
    expect(Math.abs(main!.delay + main!.travelSeconds! - root.delay)).toBeLessThanOrEqual(0.05);
    expect(vines.every(spawn => effectImportance(spawn) === 'critical')).toBe(true);
    // The branching vines fade out instead of being cut at their end, and the root cluster draws larger than authored.
    expect(CUE_OVERRIDES.zyra.filter(cue => cue.system === '7ce6b652').every(cue => cue.stopAfter! < cue.duration - 0.3)).toBe(true);
    expect(root.scale).toBeGreaterThan(1);
    // The branching vines sprout on the targets the vines reach, never at Zyra's feet.
    expect(zyra.spawns.filter(spawn => spawn.system === '7ce6b652').map(spawn => [spawn.event, spawn.targetId])).toEqual([['hit', 'a'], ['hit', 'b'], ['hit', 'c']]);
    // Alone, the short vines have nobody else to reach and are left out without refusing the cast.
    const alone = mapSkillTimeline(CUE_OVERRIDES.zyra.filter(cue => cue.action === 'cast'), 'zyra', ['a']);
    expect(alone.unsupported).toEqual([]);
    expect(alone.spawns.filter(spawn => spawn.system === '857fe049').map(spawn => spawn.targetId)).toEqual(['a']);
  });

  it('parses a cue scale and rejects values outside 0.05–5', () => {
    const systems = { aa: 'aa.json' };
    const cue = { system: 'aa', event: 'hit' as const, delay: 0, duration: 1, scale: 0.45 };
    const parsed = parseIndex({ version: 1, systems, assets: {}, skills: { probe: [cue] } });
    expect(parsed.skills.probe).toEqual([cue]);
    expect(mapSkillTimeline(parsed.skills.probe ?? [], 's', ['t']).spawns[0]?.scale).toBe(0.45);
    for (const scale of [0, -1, 0.04, 5.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => parseIndex({ version: 1, systems, assets: {}, skills: { probe: [{ ...cue, scale }] } }), String(scale)).toThrow('timeline-cue');
    }
    for (const scale of [0.05, 1, 5]) {
      expect(parseIndex({ version: 1, systems, assets: {}, skills: { probe: [{ ...cue, scale }] } }).skills.probe?.[0]?.scale).toBe(scale);
    }
  });

  it('scales particle size and offset about the anchor and leaves the anchor and flight put', async () => {
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem(), readTexture: async () => new Texture() });
    const prepared = await library.load('sample');
    const root = new Group(); root.position.set(44, 22, 10);
    const camera = new Camera();
    const shared = { anchor: unitAnchor(root, null), target: null, joints: unitJoints(root, null), duration: 1, seed: 5 };
    const full = createLtkParticles(prepared, { ...shared, scale: 1 });
    const half = createLtkParticles(prepared, { ...shared, scale: 0.5 });
    for (let step = 0; step < 6; step++) { full.update(0.05, camera); half.update(0.05, camera); }
    expect(full.object.scale.x).toBe(FX_SCALE);
    expect(half.object.scale.x).toBe(FX_SCALE);
    expect(half.object.position.toArray()).toEqual(full.object.position.toArray());
    expect([...half.driver.origin]).toEqual([...full.driver.origin]);
    const world = (origin: readonly number[]) => origin.map((value, axis) => value * AXIS_SIGN[axis] * FX_SCALE);
    expect(world(full.driver.origin).map(value => Math.round(value * 1e6) / 1e6)).toEqual([44, 22, 10]);
    expect(half.driver.pool.count).toBe(full.driver.pool.count);
    expect(full.driver.pool.count).toBeGreaterThan(0);
    let moved = 0;
    for (let index = 0; index < full.driver.pool.count; index++) {
      for (let axis = 0; axis < 3; axis++) {
        const at = index * 3 + axis;
        expect(half.driver.pool.anchor[at]).toBeCloseTo(full.driver.pool.anchor[at], 5);
        expect(half.driver.pool.position[at]).toBeCloseTo(full.driver.pool.position[at] * 0.5, 4);
        expect(half.driver.pool.velocity[at]).toBeCloseTo(full.driver.pool.velocity[at] * 0.5, 4);
        expect(half.driver.pool.birthScale[at]).toBeCloseTo(full.driver.pool.birthScale[at] * 0.5, 5);
        moved = Math.max(moved, Math.abs(full.driver.pool.position[at]));
      }
    }
    expect(moved).toBeGreaterThan(0.5);
    const source = new Group(), target = new Group(); target.position.x = 44;
    const flight = { anchor: unitAnchor(source, null), target: unitAnchor(target, null), joints: unitJoints(source, null), duration: 1, projectileSeconds: 0.5, seed: 1 };
    const plain = createLtkParticles(prepared, { ...flight, scale: 1 });
    const small = createLtkParticles(prepared, { ...flight, scale: 0.45 });
    for (let step = 0; step < 11; step++) {
      plain.update(0.05, camera); small.update(0.05, camera);
      expect([...small.driver.origin]).toEqual([...plain.driver.origin]);
    }
    expect(plain.driver.origin[0]).toBeCloseTo(-100);
    expect(small.object.scale.x).toBe(FX_SCALE);
    full.dispose(); half.dispose(); plain.dispose(); small.dispose(); library.dispose();
  });

  it('does not reuse a parked system at a different scale', async () => {
    const scaled: TimelineCue[] = [
      { system: 'sample', event: 'cast-start', delay: 0, duration: 0.15, scale: 1 },
      { system: 'sample', event: 'cast-start', delay: 0.2, duration: 0.3, scale: 0.5 },
    ];
    const base = syntheticIndex();
    const index = { ...base, skills: { ...base.skills, jinx: scaled } };
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(), readTexture: async () => new Texture() });
    await library.load('sample');
    const scene = new Scene(), camera = new Camera();
    const runtime = createLtkRuntime(library, scene, () => ({ root: new Group(), body: null, alive: true }));
    expect(runtime.play('jinx', 'caster', [])).toBe(true);
    runtime.update(0.05, camera);
    expect(scene.children).toHaveLength(1);
    const first = scene.children[0];
    expect(String(first.userData.poolKey).endsWith(`\n${SKILL_FX_SIZE}`)).toBe(true);
    runtime.update(0.12, camera);
    expect(runtime.active).toBe(0);
    runtime.update(0.05, camera);
    expect(scene.children).toHaveLength(1);
    const second = scene.children[0];
    expect(second).not.toBe(first);
    expect(String(second.userData.poolKey).endsWith(`\n${0.5 * SKILL_FX_SIZE}`)).toBe(true);
    expect(String(first.userData.poolKey)).not.toBe(String(second.userData.poolKey));
    runtime.dispose();
  });

  it('draws particles at the default arena unit scale, keeping footage-measured cue sizes as drawn', () => {
    expect(FX_SOURCE_SCALE).toBe(FX_SCALE);
    const pick = BOARD_PICKS.find((p: { key: string }) => p.key === 'board-default');
    expect(ARENA_UNIT_SCALE).toBeCloseTo(0.3306 * pick!.alignmentScale!, 12);
    expect(SKILL_FX_SIZE).toBeCloseTo(0.638, 3);
    // Darius's Q ring: quad half-extent 485 → about 4.6 cells across a 58.9-unit hex step (original footage ≈ 4.5).
    expect(2 * 485 * FX_SCALE * SKILL_FX_SIZE / (Math.sqrt(3) * 34)).toBeCloseTo(4.6, 1);
    expect(measuredAtFxScale(0.45) * SKILL_FX_SIZE).toBeCloseTo(0.45, 12);
  });

  it('keeps weapon-held systems at the body scale and the arena scale elsewhere (pr572-report)', () => {
    expect(cueSize({ bone: 'Cstm_Buffbone_Pistol', event: 'cast-start' })).toBe(1); // Jinx muzzle
    expect(cueSize({ bone: 'Buffbone_Glb_Weapon_1', event: 'cast-start' })).toBe(1); // Twitch crossbow glow
    expect(cueSize({ bone: 'Cstm_Buffbone_Pistol', event: 'projectile', stationary: true })).toBe(1);
    expect(cueSize({ bone: 'Cstm_Buffbone_Pistol', event: 'projectile' })).toBe(SKILL_FX_SIZE); // a missile crosses the board
    expect(cueSize({ bone: 'BUFFBONE_GLB_GROUND_LOC', event: 'cast-start' })).toBe(SKILL_FX_SIZE);
    expect(cueSize({ bone: 'C_BUFFBONE_GLB_CHEST_LOC', event: 'hit' })).toBe(SKILL_FX_SIZE);
    expect(cueSize({ event: 'hit' })).toBe(SKILL_FX_SIZE);
    const twitch = CUE_OVERRIDES.twitch.find(cue => cue.system === '900dd2d2')!;
    expect((twitch.scale ?? 1) * cueSize(twitch)).toBe(1);
  });

  it('draws every cast cue of Zyra at the size it was measured at, so the vines and sprouts stay in proportion', () => {
    const cast = CUE_OVERRIDES.zyra.filter(cue => cue.action === 'cast');
    expect(cast.length).toBeGreaterThan(0);
    for (const cue of cast) {
      const drawn = (cue.scale ?? 1) * cueSize(cue);
      const measured = cue.system === 'b888a24f' ? 1.6 : cue.system === '7ce6b652' ? 0.5 : 1;
      expect(drawn, cue.system).toBeCloseTo(measured, 12);
    }
  });

  it('keeps the flame cone of Sevika at the arena size though it is held on the claw', () => {
    for (const skill of ['sevika-flamethrower', 'sevika-blue-flamethrower']) {
      const cone = sevikaSkills[skill].find(cue => cue.system === '5d6a1033' || cue.system === '83de8443')!;
      expect((cone.scale ?? 1) * cueSize(cone), skill).toBeCloseTo(SKILL_FX_SIZE, 12);
    }
  });
});
