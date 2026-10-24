import { describe, expect, it } from 'vitest';
import { CAST_PARTICLE_CAP, HITSTOP_SECONDS, SKILL_FEEL_SAMPLE, WINDUP_SECONDS, castEffectTuning, createSkillFeel, impactDelay, impactFeel, simplifyCast, windupEnvelope } from '../src/rendering/three-mode/skill-feel';
import { Group, Vector3 } from 'three';

const entry = (id: string, anchor: 'source' | 'target' | 'projectile', delay: number) => ({ id, playback: { anchor, delay, maxDuration: 1 } });

describe('skill feel sample', () => {
  it('samples four champions, one of them melee', () => {
    expect([...SKILL_FEEL_SAMPLE].sort()).toEqual(['jayce', 'jinx', 'renata', 'vi']);
    expect(WINDUP_SECONDS).toBeGreaterThanOrEqual(0.2); expect(WINDUP_SECONDS).toBeLessThanOrEqual(0.3);
    expect(HITSTOP_SECONDS).toBeLessThan(0.1);
  });

  it('trims a listed cast to its kept effects and starts none before the charge ends', () => {
    const plan = [entry('jinx_tft13_jinx_base_r_muzzleflash', 'source', 0), entry('jinx_tft13_jinx_base_r_cast_mouth', 'source', 0),
      entry('jinx_tft13_jinx_base_r_rocket_child', 'projectile', 0.1), entry('jinx_tft13_jinx_base_r_tar', 'target', 0.8)];
    const kept = simplifyCast('jinx', plan);
    expect(kept.map(e => [e.id.split('_r_')[1], e.playback.delay])).toEqual([['muzzleflash', WINDUP_SECONDS], ['rocket_child', WINDUP_SECONDS], ['tar', 0.8]]);
    expect(plan[0]!.playback.delay).toBe(0); // the reviewed playback table is never written
  });

  it('keeps an unlisted plan whole, only shifted past the charge', () => {
    const plan = [entry('renata_tft13_renataglasc_base_e_cas_center', 'source', 0.1), entry('renata_tft13_renataglasc_base_e_tar', 'target', 0.9)];
    expect(simplifyCast('renata', plan).map(e => e.playback.delay)).toEqual([WINDUP_SECONDS, 0.9]);
  });

  it('lands the impact on the first effect at the target, else just after the release', () => {
    expect(impactDelay([entry('a', 'source', 0.25), entry('b', 'target', 0.9), entry('c', 'target', 0.45)])).toBe(0.45);
    expect(impactDelay([entry('a', 'source', 0.25)])).toBeCloseTo(WINDUP_SECONDS + 0.15);
  });

  it('closes the ring and brightens through the charge, then releases and ends', () => {
    const start = windupEnvelope(0)!, charged = windupEnvelope(WINDUP_SECONDS - 0.001)!, released = windupEnvelope(WINDUP_SECONDS + 0.07)!;
    expect(charged.ring).toBeLessThan(start.ring); expect(charged.opacity).toBeGreaterThan(start.opacity);
    expect(released.ring).toBeGreaterThan(charged.ring); expect(released.opacity).toBeLessThan(charged.opacity);
    expect(windupEnvelope(WINDUP_SECONDS + 0.2)).toBeNull();
  });

  it('draws attacks from a fixed pool and gives every sprite back', () => {
    const feel = createSkillFeel(), count = feel.object.children.length;
    for (let i = 0; i < 40; i++) feel.attack(new Vector3(0, 40, 0), new Vector3(0, 40, -100), true, 0);
    feel.update(0.05);
    expect(feel.object.children.length).toBe(count);
    expect(feel.object.children.filter(child => child.visible).length).toBeGreaterThan(0);
    feel.update(1);
    feel.update(0.01);
    expect(feel.object.children.filter(child => child.visible)).toEqual([]);
    feel.dispose();
  });

  it('charges under its piece, kicks the camera once per gap, then rests', () => {
    const feel = createSkillFeel(), root = new Group(), parent = new Group(); parent.add(root); root.position.set(50, 0, 20);
    feel.charge(root, 0xff0000, 30, 40);
    feel.update(0.1);
    expect(feel.object.children.filter(child => child.visible).length).toBe(2);
    feel.kick(); feel.update(0.01);
    expect(feel.shake(new Vector3()).length()).toBeGreaterThan(0);
    feel.update(1);
    expect(feel.shake(new Vector3()).length()).toBe(0);
    expect(feel.object.children.filter(child => child.visible)).toEqual([]);
    feel.dispose();
  });

  it('hits harder for Vi and Renata and turns Jinx\'s impact down (10-24 GPU review)', () => {
    for (const id of ['vi', 'renata']) expect(impactFeel(id)).toEqual({ hold: 0.1, kick: 1.5, ring: true });
    for (const id of ['jinx', 'jayce']) expect(impactFeel(id)).toEqual({ hold: HITSTOP_SECONDS, kick: 1, ring: false });
    expect(castEffectTuning('jinx_tft13_jinx_base_r_tar')).toEqual({ scale: 0.6, particles: 50 });
    expect(castEffectTuning('jinx_tft13_jinx_base_r_muzzleflash')).toEqual({ scale: 1, particles: CAST_PARTICLE_CAP });
  });

  it('bursts an impact ring from its pool and lets it go', () => {
    const feel = createSkillFeel(), count = feel.object.children.length;
    for (let i = 0; i < 20; i++) feel.impact(new Vector3(10, 0, 10), 0x00ff00, 40);
    feel.update(0.05);
    expect(feel.object.children.length).toBe(count);
    expect(feel.object.children.filter(child => child.visible).length).toBe(16); // 8 rings and their flashes, no more
    feel.update(0.5);
    expect(feel.object.children.filter(child => child.visible)).toEqual([]);
    feel.dispose();
  });
});
