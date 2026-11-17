import { describe, expect, it } from 'vitest';
import { AnimationClip, Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial, NumberKeyframeTrack, type Object3D } from 'three';
import { UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import { TIMED_FORMS } from '../src/rendering3d/submesh-visibility';
import { createTimedFormEvents } from '../src/rendering/three-mode/timed-form-events';
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
  it('ends on death at once, and with the next attack when the closing blast hits no one', () => {
    const f = forms();
    f.next(cast(0)); f.next(heal(10));
    expect(f.next(attack(30))).toBeUndefined();
    expect(f.next(death(31))).toEqual({ id: 'm', on: false });
    f.next(cast(0, 'm2')); f.next(heal(10, 'm2')); f.next(ended(50, 'm2'));
    expect(f.next(attack(62, 'm2'))).toEqual({ id: 'm2', on: false });
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
