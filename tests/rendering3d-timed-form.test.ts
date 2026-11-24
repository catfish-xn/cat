import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, NumberKeyframeTrack, Skeleton, SkinnedMesh, Uint16BufferAttribute, VectorKeyframeTrack, type Object3D } from 'three';
import { UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import { CUTOUT_ALPHA, CUTOUT_SUBMESHES, TIMED_FORMS, cutOutSubmeshes } from '../src/rendering3d/submesh-visibility';
import { createTimedFormEvents } from '../src/rendering/three-mode/timed-form-events';
import { DRMUNDO_BLAST_AFTER_PULSE_TICKS as DRMUNDO_BLAST_3D, TIMED_FORM_STOPS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { DRMUNDO_BLAST_AFTER_PULSE_TICKS } from '../src/simulation/cast-windup';
import { assertManifest } from '../src/rendering3d/contracts';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';

let seq = 0;
const ev = (event: Record<string, unknown>) => ({ eventSeq: seq++, ...event }) as unknown as DisplayCombatEvent;
const cast = (tick: number, id = 'm') => ev({ type: 'cast', tick, sourceId: id, targetIds: ['t'] });
const heal = (tick: number, id = 'm', sourceKind = 'ability') => ev({ type: 'heal', tick, targetId: id, actual: 10, shares: [{ sourceId: id, sourceKind, definitionId: 'x', delivery: 'ability', actual: 10 }] });
const ended = (tick: number, id = 'm') => ev({ type: 'abilityEffectEnded', tick, unitId: id, effect: 'drmundo-heal', targetIds: [] });
const hit = (tick: number, id = 'm') => ev({ type: 'packetDamage', tick, sourceId: id, targetId: 't', sourceKind: 'ability', delivery: 'ability-direct', hit: true, hpDamage: 5, absorbed: 0 });
const attack = (tick: number, id = 'm') => ev({ type: 'attack', tick, attackerId: id, targetId: 't' });
const death = (tick: number, id = 'm') => ev({ type: 'death', tick, unitId: id });

describe('timed form events (rule events only)', () => {
  const forms = () => createTimedFormEvents(id => (id === 'm' || id === 'm2' ? 'drmundo' : 'other'));
  it('turns on with the first own ability heal after a cast and off with the first ability hit after the heal ends', () => {
    const f = forms();
    expect(f.next(cast(100))).toBeUndefined();
    expect(f.next(heal(105, 'm', 'item'))).toBeUndefined();
    expect(f.next(heal(110))).toEqual({ id: 'm', on: true });
    expect(f.next(heal(130))).toBeUndefined();
    expect(f.next(hit(130))).toBeUndefined();
    expect(f.next(ended(150))).toBeUndefined();
    expect(f.next(hit(150))).toBeUndefined();
    expect(f.next(hit(155))).toEqual({ id: 'm', on: false });
    expect(f.next(hit(156))).toBeUndefined();
  });
  it('ends on death at once, and at the blast\'s tick when the closing blast hits no one', () => {
    expect(DRMUNDO_BLAST_3D).toBe(DRMUNDO_BLAST_AFTER_PULSE_TICKS);
    expect(TIMED_FORM_STOPS.drmundo).toEqual(['5443cd9f', '4caada37']);
    const f = forms();
    f.next(cast(0)); f.next(heal(10));
    expect(f.next(attack(30))).toBeUndefined();
    expect(f.next(death(31))).toEqual({ id: 'm', on: false });
    f.next(cast(0, 'm2')); f.next(heal(10, 'm2')); f.next(ended(50, 'm2'));
    expect(f.next(attack(52, 'm2'))).toBeUndefined();
    expect(f.advance(50 + DRMUNDO_BLAST_AFTER_PULSE_TICKS - 1)).toEqual([]);
    expect(f.advance(50 + DRMUNDO_BLAST_AFTER_PULSE_TICKS)).toEqual([{ id: 'm2', on: false }]);
    expect(f.advance(80)).toEqual([]);
  });
  it('ignores other units, replayed events and an interrupted cast; a new combat starts with every form off', () => {
    const f = forms();
    expect(f.next(cast(0, 'o'))).toBeUndefined(); expect(f.next(heal(10, 'o'))).toBeUndefined();
    const first = cast(0); f.next(first); const on = heal(10);
    expect(f.next(on)).toEqual({ id: 'm', on: true });
    expect(f.next(on)).toBeUndefined();
    expect(f.next(ev({ type: 'cast', tick: 20, sourceId: 'm', targetIds: [], completed: false }))).toBeUndefined();
    f.clear();
    expect(f.next(heal(30))).toBeUndefined();
  });
});

describe('Swain\'s wings (rule events only)', () => {
  const swainEnded = (tick: number, id = 's') => ev({ type: 'abilityEffectEnded', tick, unitId: id, effect: 'swain-ascension', targetIds: [] });
  const forms = (form: 'front' | 'back' | undefined = 'front') => createTimedFormEvents(id => (id === 's' || id === 's2' ? 'swain' : id === 'm' ? 'drmundo' : 'other'), () => form);
  it('turns on with a completed front-form cast and off when the ascension ends; a recast while on changes nothing', () => {
    expect(TIMED_FORMS.swain).toEqual({ show: ['wings'], hide: [] });
    const f = forms();
    expect(f.next(cast(100, 's'))).toEqual({ id: 's', on: true });
    expect(f.next(cast(140, 's'))).toBeUndefined();
    expect(f.next(swainEnded(150, 'm'))).toBeUndefined();
    expect(f.next(swainEnded(260, 's'))).toEqual({ id: 's', on: false });
    expect(f.next(swainEnded(261, 's'))).toBeUndefined();
    // The heal ending of Dr. Mundo's ascension-like effect never touches Swain.
    expect(f.next(cast(300, 's'))).toEqual({ id: 's', on: true });
    expect(f.next(ended(301, 's'))).toBeUndefined();
  });
  it('ends on death; a back-form cast, an interrupted cast or a replayed event turns nothing on; clear() drops it', () => {
    const f = forms();
    f.next(cast(0, 's'));
    expect(f.next(death(10, 's'))).toEqual({ id: 's', on: false });
    expect(forms('back').next(cast(0, 's2'))).toBeUndefined();
    expect(createTimedFormEvents(() => 'swain', () => undefined).next(cast(0, 's2'))).toBeUndefined();
    const g = forms();
    expect(g.next(ev({ type: 'cast', tick: 5, sourceId: 's2', targetIds: [], completed: false }))).toBeUndefined();
    const on = cast(6, 's2');
    expect(g.next(on)).toEqual({ id: 's2', on: true });
    expect(g.next(on)).toBeUndefined();
    g.clear();
    expect(g.next(swainEnded(20, 's2'))).toBeUndefined();
  });
});

describe('cut-out submeshes', () => {
  it('gives only the named submeshes\' materials the alpha cut-out', () => {
    expect(CUTOUT_SUBMESHES.swain).toEqual(['wings']);
    const root = model('Swain_Body_Mat', 'wings');
    cutOutSubmeshes(root, CUTOUT_SUBMESHES.swain);
    const tests: Record<string, number> = {};
    root.traverse(o => { const m = o as Mesh; if (m.isMesh) tests[(m.material as MeshBasicMaterial).name] = (m.material as MeshBasicMaterial).alphaTest; });
    expect(tests).toEqual({ Swain_Body_Mat: 0, wings: CUTOUT_ALPHA });
    cutOutSubmeshes(root, undefined);
    expect(CUTOUT_ALPHA).toBeGreaterThan(0); expect(CUTOUT_ALPHA).toBeLessThan(1);
  });
});

/** A model with one mesh per submesh (material of the same name). */
function model(...submeshes: string[]): Group {
  const root = new Group(), bone = new Bone(); bone.name = 'joint'; root.add(bone);
  for (const name of submeshes) { const material = new MeshBasicMaterial(); material.name = name; root.add(new Mesh(new BoxGeometry(1, 1, 1), material)); }
  return root;
}
const visible = (root: Object3D) => { const v: string[] = []; root.traverse(o => { const m = o as Mesh; if (m.isMesh && m.visible) v.push((m.material as MeshBasicMaterial).name); }); return v.sort(); };
const clip = (name: string) => new AnimationClip(name, 1, [new NumberKeyframeTrack('joint.position[x]', [0, 1], [0, 1])]);

describe('timed form over clips', () => {
  const form = { show: ['Alt'], hide: ['Base'] };
  it('shows the form over every clip while on, including clips that switch the same submeshes, and drops it when off', () => {
    expect(TIMED_FORMS.drmundo).toEqual({ show: ['BodyUlt'], hide: ['BodyNormal'] });
    const root = model('Base', 'Alt');
    const mixer = new UnitAnimationMixer(root, [clip('rest'), clip('swing'), clip('enter')], { idle: 'rest', attack: 'swing', cast: 'enter' },
      { castSequence: { main: 'enter' }, timedForm: form, submeshVisibility: { initiallyHidden: ['Alt'], events: { enter: [{ frame: 0, show: ['Base'], hide: ['Alt'] }] } } });
    let rev = 0;
    const go = (state: 'idle' | 'attack' | 'cast', clips?: string[]) => mixer.apply({ state, previous: 'idle', blendSeconds: 0.1, loop: state === 'idle', revision: ++rev, ...(clips ? { playback: { clips, durationSeconds: 1 } } : {}) });
    go('idle'); mixer.update(0.1); expect(visible(root)).toEqual(['Base']);
    mixer.setTimedForm(true); expect(visible(root)).toEqual(['Alt']);
    for (const step of [() => go('attack', ['swing']), () => go('cast', ['enter']), () => go('idle')]) { step(); for (let i = 0; i < 4; i++) { mixer.update(0.1); expect(visible(root)).toEqual(['Alt']); } }
    mixer.setTimedForm(false); expect(visible(root)).toEqual(['Base']);
    mixer.dispose();
  });
  it('stays off on a model that lacks the form\'s submeshes', () => {
    const root = model('Base');
    const mixer = new UnitAnimationMixer(root, [clip('rest')], { idle: 'rest' }, { timedForm: form });
    mixer.apply({ state: 'idle', previous: 'idle', blendSeconds: 0, loop: true, revision: 1 });
    mixer.setTimedForm(true); mixer.update(0.1);
    expect(visible(root)).toEqual(['Base']);
    mixer.dispose();
  });
});

/** A skinned model: body on bone 'root', the form's submesh 'Alt' on bone 'arm' only. */
function skinned(): Group {
  const root = new Group(), rootBone = new Bone(), arm = new Bone(); rootBone.name = 'root'; arm.name = 'arm'; rootBone.add(arm); root.add(rootBone);
  const skeleton = new Skeleton([rootBone, arm]);
  for (const [name, bone] of [['Base', 0], ['Alt', 1]] as const) {
    const geometry = new BoxGeometry(1, 1, 1), count = geometry.getAttribute('position').count;
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Array(count * 4).fill(0).map((_, i) => i % 4 === 0 ? bone : 0), 4));
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(new Array(count * 4).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0), 4));
    const material = new MeshBasicMaterial(); material.name = name;
    const mesh = new SkinnedMesh(geometry, material); mesh.bind(skeleton); root.add(mesh);
  }
  return root;
}
const moving = (name: string, bone: string, to: number) => new AnimationClip(name, 1, [new VectorKeyframeTrack(`${bone}.position`, [0, 1], [0, 0, 0, to, 0, 0])]);

describe('timed form entry and exit clips', () => {
  const build = () => {
    const root = skinned();
    const clips = [new AnimationClip('rest', 1, [new VectorKeyframeTrack('root.position', [0, 1], [5, 0, 0, 5, 0, 0]), new VectorKeyframeTrack('arm.position', [0, 1], [1, 0, 0, 1, 0, 0])]),
      moving('grow', 'arm', 9), moving('shrink', 'arm', -9)];
    const mixer = new UnitAnimationMixer(root, clips, { idle: 'rest' }, { timedForm: { show: ['Alt'], hide: [] }, submeshVisibility: { initiallyHidden: ['Alt'] }, timedFormClips: { enter: 'grow', exit: 'shrink' } });
    mixer.apply({ state: 'idle', previous: 'idle', blendSeconds: 0, loop: true, revision: 1 });
    const bone = (name: string) => { let b: Bone | undefined; root.traverse(o => { if ((o as Bone).isBone && o.name === name) b = o as Bone; }); return b!; };
    return { root, mixer, bone };
  };
  it('plays the entry clip on the form\'s bones only, then hands them back to the body\'s clip', () => {
    const { root, mixer, bone } = build();
    mixer.update(0.1);
    expect(visible(root)).toEqual(['Base']);
    mixer.setTimedForm(true); mixer.update(0.5);
    expect(visible(root)).toEqual(['Alt', 'Base']);
    expect(bone('arm').position.x).toBeCloseTo(4.5, 1);
    expect(bone('root').position.x).toBeCloseTo(5, 3);
    mixer.update(0.6); mixer.update(0.3);
    expect(bone('arm').position.x).toBeCloseTo(1, 3);
    mixer.dispose();
  });
  it('keeps the form shown through the exit clip and hides it when that ends; immediate hides it at once', () => {
    const { root, mixer } = build();
    mixer.setTimedForm(true); mixer.update(1.5);
    mixer.setTimedForm(false); mixer.update(0.5);
    expect(visible(root)).toEqual(['Alt', 'Base']);
    mixer.update(0.6);
    expect(visible(root)).toEqual(['Base']);
    mixer.setTimedForm(true); mixer.update(0.2);
    mixer.setTimedForm(false, true);
    expect(visible(root)).toEqual(['Base']);
    mixer.dispose();
  });
  it('two combats in a row: the second starts with the form off and turns it on again on its own cast', () => {
    const f = createTimedFormEvents(id => (id === 's' ? 'swain' : 'other'), () => 'front');
    const { root, mixer } = build();
    const run = (from: number) => {
      const on = f.next(cast(from, 's'))!; expect(on).toEqual({ id: 's', on: true }); mixer.setTimedForm(on.on); mixer.update(1.5);
      expect(visible(root)).toEqual(['Alt', 'Base']);
    };
    run(10);
    // The combat ends mid-form (no ascension end): the renderer clears its events and turns every form off at once.
    f.clear(); mixer.setTimedForm(false, true);
    expect(visible(root)).toEqual(['Base']);
    run(400);
    mixer.dispose();
  });
});

describe('timed form actions', () => {
  it('plays the form\'s idle, move and alternating attacks while it is on, and the model\'s own clips after', () => {
    const root = model('Base', 'Alt');
    const clips = ['rest', 'walk', 'swing', 'f_rest', 'f_walk', 'f_swing', 'f_swing2'].map(clip);
    const mixer = new UnitAnimationMixer(root, clips, { idle: 'rest', move: 'walk', attack: 'swing' },
      { timedForm: { show: ['Alt'], hide: [] }, submeshVisibility: { initiallyHidden: ['Alt'] }, timedFormAnimations: { idle: 'f_rest', move: 'f_walk', attack: 'f_swing', attackAlt: 'f_swing2' } });
    const playing = () => [...(mixer as unknown as { mixer: { _actions: { isRunning(): boolean; getClip(): { name: string }; getEffectiveWeight(): number }[] } }).mixer._actions]
      .filter(a => a.isRunning() && a.getEffectiveWeight() > 0.5).map(a => a.getClip().name);
    let rev = 0;
    const go = (state: 'idle' | 'move' | 'attack') => { mixer.apply({ state, previous: 'idle', blendSeconds: 0, loop: state !== 'attack', revision: ++rev }); mixer.update(0.05); };
    go('idle'); expect(playing()).toEqual(['rest']);
    mixer.setTimedForm(true); mixer.update(0.5);
    expect(playing()).toEqual(['f_rest']);
    go('move'); expect(playing()).toEqual(['f_walk']);
    expect(mixer.resolvePlayback('attack')?.clips).toEqual(['f_swing']);
    expect(mixer.resolvePlayback('attack')?.clips).toEqual(['f_swing2']);
    expect(mixer.resolvePlayback('attack')?.clips).toEqual(['f_swing']);
    go('idle'); mixer.setTimedForm(false, true); mixer.update(0.5);
    expect(playing()).toEqual(['rest']);
    expect(mixer.resolvePlayback('attack')?.clips).toEqual(['swing']);
    mixer.dispose();
  });
  it('the cast that turns the form on plays the form\'s own entry, then its idle; a recast while on keeps the idle', () => {
    const root = skinned();
    const clips = [...['rest', 'spell', 'f_rest', 'f_enter'].map(clip), moving('grow', 'arm', 9)];
    const mixer = new UnitAnimationMixer(root, clips, { idle: 'rest', cast: 'spell' },
      { timedForm: { show: ['Alt'], hide: [] }, submeshVisibility: { initiallyHidden: ['Alt'] }, timedFormClips: { enter: 'grow', exit: 'grow' },
        timedFormAnimations: { idle: 'f_rest', enter: 'f_enter' } });
    const running = () => [...(mixer as unknown as { mixer: { _actions: { isRunning(): boolean; getClip(): { name: string } }[] } }).mixer._actions]
      .filter(a => a.isRunning()).map(a => a.getClip().name);
    mixer.apply({ state: 'idle', previous: 'idle', blendSeconds: 0, loop: true, revision: 1 }); mixer.update(0.05);
    expect(mixer.resolvePlayback('cast')?.clips).toEqual(['spell']);
    // The renderer turns the form on from the cast event, then resolves that cast's clip, before the next update.
    mixer.setTimedForm(true);
    expect(mixer.resolvePlayback('cast')).toEqual({ clips: ['f_enter'], durationSeconds: 1 });
    // Not the overlay entry on the form's bones: the whole-body entry carries the wings.
    expect(running()).not.toContain('grow:form');
    mixer.apply({ state: 'cast', previous: 'idle', blendSeconds: 0, loop: false, revision: 2, playback: { clips: ['f_enter'], durationSeconds: 1 } });
    mixer.update(0.5);
    expect(running()).toContain('f_enter');
    mixer.apply({ state: 'idle', previous: 'cast', blendSeconds: 0, loop: true, revision: 3 }); mixer.update(0.5);
    expect(running()).toEqual(['f_rest']);
    expect(mixer.resolvePlayback('cast')).toBeNull();
    // An entry not cast before the next update is dropped; after the form ends, casts play the model's own clip.
    mixer.setTimedForm(false, true); mixer.setTimedForm(true); mixer.update(0.05);
    expect(mixer.resolvePlayback('cast')).toBeNull();
    mixer.setTimedForm(false, true);
    expect(mixer.resolvePlayback('cast')?.clips).toEqual(['spell']);
    mixer.dispose();
  });
  it('a model without the form\'s own entry clip plays the cast\'s own clip', () => {
    const root = model('Base', 'Alt');
    const mixer = new UnitAnimationMixer(root, ['rest', 'spell', 'f_rest'].map(clip), { idle: 'rest', cast: 'spell' },
      { timedForm: { show: ['Alt'], hide: [] }, submeshVisibility: { initiallyHidden: ['Alt'] }, timedFormAnimations: { idle: 'f_rest', enter: 'missing' } });
    mixer.apply({ state: 'idle', previous: 'idle', blendSeconds: 0, loop: true, revision: 1 });
    mixer.setTimedForm(true);
    expect(mixer.resolvePlayback('cast')?.clips).toEqual(['spell']);
    mixer.dispose();
  });
  it('the manifest contract takes timedFormAnimations and refuses unknown keys or empty names', () => {
    const manifest = (timedFormAnimations: unknown) => ({ schemaVersion: 1, models: { x: { path: 'models/x/model.glb', timedFormAnimations } } });
    expect(() => assertManifest(manifest({ idle: 'a', move: 'b', attack: 'c', attackAlt: 'd', enter: 'e' }))).not.toThrow();
    for (const bad of [[], { run: 'a' }, { idle: '' }, { idle: 3 }]) expect(() => assertManifest(manifest(bad))).toThrow('invalid-timed-form-animations');
  });
});
