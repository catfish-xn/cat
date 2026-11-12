import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, Object3D } from 'three';
import { FX_SCALE, missingLocatorLift, unitAnchor } from '../src/rendering/three-mode/vfx-ltk/particles';
import { CHEST, type TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { BATCH1_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/batch1-timelines';
import { S13_TIMELINES } from '../src/rendering/three-mode/vfx-ltk/s13-timelines';

// Every repository cue list: the reviewed overrides, the converted timelines and each champion / batch-3 module.
const modules = import.meta.glob(['../src/rendering/three-mode/vfx-ltk/champions/*.ts', '../src/rendering/three-mode/vfx-ltk/batch3/*.ts'], { eager: true }) as Record<string, Record<string, unknown>>;
const isCue = (value: unknown): value is TimelineCue => !!value && typeof value === 'object' && typeof (value as TimelineCue).system === 'string' && typeof (value as TimelineCue).event === 'string';
function collect(): { where: string; cue: TimelineCue }[] {
  const out: { where: string; cue: TimelineCue }[] = [];
  const list = (where: string, value: unknown) => { if (Array.isArray(value)) for (const cue of value) if (isCue(cue)) out.push({ where, cue }); };
  const table = (prefix: string, value: unknown) => {
    if (Array.isArray(value)) list(prefix, value);
    else if (value && typeof value === 'object') for (const [key, cues] of Object.entries(value)) list(`${prefix}.${key}`, cues);
  };
  table('CUE_OVERRIDES', CUE_OVERRIDES); table('BATCH1_TIMELINES', BATCH1_TIMELINES); table('S13_TIMELINES', S13_TIMELINES);
  for (const [file, exports] of Object.entries(modules)) for (const [name, value] of Object.entries(exports)) table(`${file.split('/').pop()}:${name}`, value);
  return out;
}
/**
 * Attack hits and flights that deliberately name no anchor on the target. A new entry needs a reason here, or the
 * guard below fails: an unnamed anchor falls back to the target's feet (11-12: Jinx's hit sparks on Garen's legs).
 * Keyed `where|system|event`.
 */
const NO_TARGET_ANCHOR: Readonly<Record<string, string>> = {
  'CUE_OVERRIDES.scar|0f2af66b|hit': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
  'CUE_OVERRIDES.irelia|0f2af66b|hit': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
  'elise.ts:elise.elise|a0484f04|projectile': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
  'elise.ts:elise.elise|0f2af66b|hit': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
  'illaoi.ts:illaoi.illaoi|0f2af66b|hit': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
  'loris.ts:loris.loris|0f2af66b|hit': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
  'rell.ts:rell.rell|0f2af66b|hit': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
  'silco.ts:silco.silco|a6bde11c|projectile': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
  'silco.ts:silco.silco|0f2af66b|hit': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
  'sion.ts:sion.g23-sion|0f2af66b|hit': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
  'swain.ts:swain.swain|f4e3e1bc|projectile': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
  'swain.ts:swain.swain|0f2af66b|hit': 'pending: found by this guard on 11-12, outside the approved Jinx/Mel/Jayce/Viktor/Sevika/Warwick fix; the local 14.24 export has no mHitBoneName for it, decision with Fable',
};

/**
 * Fable 11-12: the pending list may only shrink. These are the twelve keys it held when the guard landed (#627); a key
 * outside this set cannot be parked in NO_TARGET_ANCHOR, so any new attack cue must name its anchor. Remove a key here
 * when its cue is fixed; never add one.
 */
const PENDING_AT_627: ReadonlySet<string> = new Set([
  'CUE_OVERRIDES.scar|0f2af66b|hit', 'CUE_OVERRIDES.irelia|0f2af66b|hit', 'elise.ts:elise.elise|a0484f04|projectile',
  'elise.ts:elise.elise|0f2af66b|hit', 'illaoi.ts:illaoi.illaoi|0f2af66b|hit', 'loris.ts:loris.loris|0f2af66b|hit',
  'rell.ts:rell.rell|0f2af66b|hit', 'silco.ts:silco.silco|a6bde11c|projectile', 'silco.ts:silco.silco|0f2af66b|hit',
  'sion.ts:sion.g23-sion|0f2af66b|hit', 'swain.ts:swain.swain|f4e3e1bc|projectile', 'swain.ts:swain.swain|0f2af66b|hit',
]);

describe('basic-attack hits and flights anchor on the target body', () => {
  const attacks = collect().filter(({ cue }) => cue.action === 'attack' && (cue.event === 'hit' || cue.event === 'projectile'));

  it('finds the attack cues it guards', () => {
    expect(attacks.length).toBeGreaterThan(20);
    expect(attacks.some(({ where }) => where.startsWith('jinx.ts'))).toBe(true);
  });

  it('every attack hit names a bone and every flying attack missile a target bone, unless registered with a reason', () => {
    const missing = attacks.filter(({ cue }) => cue.location !== 'board' && (cue.event === 'hit' ? !cue.bone : !cue.stationary && !cue.targetBone))
      .map(({ where, cue }) => `${where}|${cue.system}|${cue.event}`);
    expect(missing.filter(key => !NO_TARGET_ANCHOR[key])).toEqual([]);
    for (const key of Object.keys(NO_TARGET_ANCHOR)) expect(missing, `stale NO_TARGET_ANCHOR entry ${key}`).toContain(key);
  });

  it('the pending list only shrinks: every parked key was pending when the guard landed (#627)', () => {
    const added = Object.keys(NO_TARGET_ANCHOR).filter(key => !PENDING_AT_627.has(key));
    expect(added, 'NO_TARGET_ANCHOR may not grow; name the anchor on the new cue instead').toEqual([]);
    expect(PENDING_AT_627.size).toBeLessThanOrEqual(12);
  });

  it('the six champions fixed on 11-12 hit and aim at the chest (14.24 BasicAttack mHitBoneName)', () => {
    for (const [file, system, event] of [
      ['jinx.ts', '0f2af66b', 'hit'], ['jinx.ts', '6d9e0430', 'projectile'], ['mel.ts', '0f2af66b', 'hit'], ['mel.ts', '539901e6', 'projectile'],
      ['jayce.ts', '0f2af66b', 'hit'], ['jayce.ts', '53b93f82', 'projectile'], ['viktor.ts', 'a7e3596a', 'hit'], ['viktor.ts', '87913524', 'projectile'],
      ['sevika.ts', '0f2af66b', 'hit'], ['warwick.ts', '9371a532', 'hit'],
    ] as const) {
      const found = attacks.filter(({ where, cue }) => where.startsWith(file) && cue.system === system && cue.event === event);
      expect(found.length, `${file} ${system} ${event}`).toBeGreaterThan(0);
      for (const { cue } of found) expect(event === 'hit' ? cue.bone : cue.targetBone).toBe(CHEST);
    }
  });
});

describe('a body locator the target model lacks does not drop to the feet', () => {
  const unit = (withChest: boolean) => {
    const root = new Group(); root.position.set(10, 0, 5);
    const body = new Group(); root.add(body);
    const mesh = new Mesh(new BoxGeometry(20, 80, 20)); mesh.position.y = 40; body.add(mesh); // 80 tall, standing on the origin
    if (withChest) { const chest = new Object3D(); chest.name = 'C_Buffbone_Glb_Chest_Loc'; chest.position.y = 55; body.add(chest); }
    root.updateMatrixWorld(true);
    return { root, body };
  };

  it('missingLocatorLift: body locators take their share of the height, other bones stay on the origin', () => {
    expect(missingLocatorLift('C_BUFFBONE_GLB_CHEST_LOC', 80)).toBeCloseTo(48);
    expect(missingLocatorLift('c_buffbone_glb_center_loc', 80)).toBeCloseTo(40);
    expect(missingLocatorLift('C_Buffbone_Glb_Head_Loc', 80)).toBeCloseTo(72);
    expect(missingLocatorLift('BUFFBONE_GLB_GROUND_LOC', 80)).toBe(0);
    expect(missingLocatorLift('Buffbone_Glb_Weapon_1', 80)).toBe(0);
    expect(missingLocatorLift(CHEST, 0)).toBe(0);
  });

  it('uses the real chest bone when the model has one', () => {
    const { root, body } = unit(true);
    expect(unitAnchor(root, body, CHEST).originAt(0)[1]).toBeCloseTo(55 / FX_SCALE);
  });

  it('without a chest bone the hit stands at 0.6 of the body height, not on the floor', () => {
    const { root, body } = unit(false);
    const [x, y, z] = unitAnchor(root, body, CHEST).originAt(0);
    expect(y).toBeCloseTo(48 / FX_SCALE);
    expect(Math.abs(x) * FX_SCALE).toBeCloseTo(10); expect(z * FX_SCALE).toBeCloseTo(5);
  });

  it('a missing ground or weapon bone still binds to the unit origin', () => {
    const { root, body } = unit(false);
    expect(unitAnchor(root, body, 'BUFFBONE_GLB_GROUND_LOC').originAt(0)[1]).toBeCloseTo(0);
    expect(unitAnchor(root, body, 'Buffbone_Glb_Weapon_1').originAt(0)[1]).toBeCloseTo(0);
  });

  it('no body at all (model not loaded) binds to the unit origin', () => {
    const root = new Group(); root.updateMatrixWorld(true);
    expect(unitAnchor(root, null, CHEST).originAt(0)[1]).toBeCloseTo(0);
  });
});
