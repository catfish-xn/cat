import { describe, expect, it, vi } from 'vitest';
import { AnimationClip, Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial, NumberKeyframeTrack, type Object3D } from 'three';
import { UnitAnimationMixer } from '../src/rendering3d/animation-mixer';
import type { ActionOutput } from '../src/rendering3d/animation-state';
import { ModelCache } from '../src/rendering3d/assets';
import { assertManifest, type AssetManifest, type SubmeshVisibility } from '../src/rendering3d/contracts';
import { HELD_SUBMESHES, SUBMESH_EVENT_FPS, SubmeshSwitch, hideInitialSubmeshes, unswitchedClips } from '../src/rendering3d/submesh-visibility';

/** A model with one mesh per submesh (material of the same name), as the exporter writes a multi-submesh skin. */
function model(...submeshes: string[]): Group {
  const root = new Group(), bone = new Bone(); bone.name = 'joint'; root.add(bone);
  for (const name of submeshes) {
    const material = new MeshBasicMaterial(); material.name = name;
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), material); mesh.name = `${name}-mesh`; root.add(mesh);
  }
  return root;
}
const visible = (root: Object3D) => {
  const shown: string[] = [];
  root.traverse(object => { const mesh = object as Mesh; if (mesh.isMesh && mesh.visible) shown.push((mesh.material as MeshBasicMaterial).name); });
  return shown.sort();
};
const clip = (name: string, frames: number) => new AnimationClip(name, frames / SUBMESH_EVENT_FPS, [new NumberKeyframeTrack('joint.position[x]', [0, frames / SUBMESH_EVENT_FPS], [0, 1])]);
let revision = 0;
const output = (state: ActionOutput['state'], clips?: string[], seconds = 1, loop = false, blendSeconds = 0): ActionOutput =>
  ({ state, previous: 'idle', blendSeconds, loop, revision: ++revision, ...(clips ? { playback: { clips, durationSeconds: seconds } } : {}) });

describe('submesh visibility from the manifest', () => {
  it('a lease starts with the initially hidden submeshes hidden, and leaves a model without them as it was', async () => {
    const visibility: SubmeshVisibility = { initiallyHidden: ['Prop'], events: { cast: [{ frame: 0, show: ['Prop'], hide: [] }] } };
    const manifest: AssetManifest = { schemaVersion: 1, models: {
      carries: { path: 'units/carries.glb', submeshVisibility: visibility },
      without: { path: 'units/without.glb', submeshVisibility: visibility },
    } };
    assertManifest(manifest);
    const templates: Record<string, Group> = { 'units/carries.glb': model('Body', 'Prop'), 'units/without.glb': model('Body') };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cache = new ModelCache(manifest, '', async url => ({ scene: templates[Object.keys(templates).find(path => url.endsWith(path))!], animations: [] }));
    const carries = await cache.load('carries'), without = await cache.load('without');
    expect(visible(carries.scene)).toEqual(['Body']);
    expect(carries.submeshVisibility).toEqual(visibility);
    // The template itself is untouched: every lease is a clone hidden on its own.
    expect(visible(templates['units/carries.glb'])).toEqual(['Body', 'Prop']);
    // Events alone (no geometry for the submesh) add nothing and hide nothing.
    expect(visible(without.scene)).toEqual(['Body']);
    expect(SubmeshSwitch.create(without.scene, visibility)).toBeUndefined();
    // A clip skipped for a missing submesh is counted and printed once, when the model loads.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe('[submesh-visibility] without: 1 clip(s) switch nothing, model lacks Prop: cast');
    expect(unswitchedClips(carries.scene, visibility)).toEqual([]);
    warn.mockRestore();
    carries.release(); without.release(); cache.dispose();
  });

  it('every state outside the clips that show it keeps the default view: no submesh stays on', () => {
    const root = model('Body', 'Prop');
    const clips = [clip('rest', 30), clip('walk', 30), clip('swing', 15), clip('cast', 20), clip('fall', 30)];
    const mixer = new UnitAnimationMixer(root, clips, { idle: 'rest', move: 'walk', attack: 'swing', cast: 'cast', death: 'fall' },
      { castSequence: { main: 'cast' }, submeshVisibility: { initiallyHidden: ['Prop'], events: { cast: [{ frame: 0, show: ['Prop'], hide: [] }] } } });
    expect(visible(root)).toEqual(['Body']);
    for (const [state, loop] of [['idle', true], ['move', true], ['attack', false]] as const) {
      mixer.apply(output(state, undefined, 1, loop));
      for (let i = 0; i < 4; i++) { mixer.update(0.2); expect(visible(root)).toEqual(['Body']); }
    }
    mixer.apply(output('cast', ['cast'], 20 / SUBMESH_EVENT_FPS));
    expect(visible(root)).toEqual(['Body', 'Prop']);
    mixer.update(0.5); expect(visible(root)).toEqual(['Body', 'Prop']);
    mixer.apply(output('idle', undefined, 1, true));
    expect(visible(root)).toEqual(['Body']);
    mixer.apply(output('death'));
    mixer.update(2); expect(visible(root)).toEqual(['Body']);
    mixer.dispose();
  });

  it('switches at the event frame inside a clip, and a looping clip starts over from the default', () => {
    const root = model('Body', 'Prop', 'Bomb');
    const visibility: SubmeshVisibility = { initiallyHidden: ['Prop'], events: {
      cast: [{ frame: 0, show: ['Prop'], hide: [] }, { frame: 15, show: [], hide: ['Prop'] }],
      swing: [{ frame: 6, show: [], hide: ['Bomb'] }],
    } };
    const mixer = new UnitAnimationMixer(root, [clip('rest', 30), clip('cast', 30), clip('swing', 12)],
      { idle: 'rest', cast: 'cast', attack: 'swing' }, { castSequence: { main: 'cast' }, submeshVisibility: visibility });
    mixer.apply(output('cast', ['cast'], 1));
    mixer.update(14 / SUBMESH_EVENT_FPS); expect(visible(root)).toEqual(['Body', 'Bomb', 'Prop']);
    mixer.update(2 / SUBMESH_EVENT_FPS); expect(visible(root)).toEqual(['Body', 'Bomb']);
    mixer.apply(output('attack', undefined, 12 / SUBMESH_EVENT_FPS, true));
    mixer.update(5 / SUBMESH_EVENT_FPS); expect(visible(root)).toEqual(['Body', 'Bomb']);
    mixer.update(2 / SUBMESH_EVENT_FPS); expect(visible(root)).toEqual(['Body']);
    // The loop wraps to frame 1: the clip starts from the default again until frame 6.
    mixer.update(6 / SUBMESH_EVENT_FPS); expect(visible(root)).toEqual(['Body', 'Bomb']);
    mixer.dispose();
  });

  it('a play-once clip that holds its last frame (a death) still switches at event frames past its end', () => {
    const root = model('Body', 'Tag');
    const mixer = new UnitAnimationMixer(root, [clip('rest', 30), clip('fall', 30)], { idle: 'rest', death: 'fall' },
      { submeshVisibility: { initiallyHidden: ['Tag'], events: { fall: [{ frame: 60, show: ['Tag'], hide: [] }, { frame: 90, show: [], hide: ['Body'] }] } } });
    mixer.apply(output('death'));
    mixer.update(1.5); expect(visible(root)).toEqual(['Body']);
    mixer.update(0.6); expect(visible(root)).toEqual(['Body', 'Tag']);
    mixer.update(1); expect(visible(root)).toEqual(['Tag']);
    mixer.dispose();
  });

  it('a body swap follows the playing stage of a cast sequence, then returns with the next action', () => {
    const root = model('BodyNormal', 'BodyUlt');
    const visibility: SubmeshVisibility = { initiallyHidden: ['BodyUlt'], events: {
      enter: [{ frame: 0, show: ['BodyNormal'], hide: ['BodyUlt'] }],
      leave: [{ frame: 0, show: ['BodyUlt'], hide: ['BodyNormal'] }],
    } };
    const mixer = new UnitAnimationMixer(root, [clip('rest', 30), clip('enter', 30), clip('leave', 30)],
      { idle: 'rest', cast: 'enter' }, { castSequence: { main: 'enter', out: 'leave' }, submeshVisibility: visibility });
    mixer.apply(output('cast', ['enter', 'leave'], 2));
    mixer.update(0.5); expect(visible(root)).toEqual(['BodyNormal']);
    mixer.update(0.6); expect(visible(root)).toEqual(['BodyUlt']);
    mixer.update(0.8); expect(visible(root)).toEqual(['BodyUlt']);
    mixer.apply(output('idle', undefined, 1, true)); expect(visible(root)).toEqual(['BodyNormal']);
    mixer.dispose();
  });

  it('during a crossfade the target clip\'s state shows from the first blended frame, without flicker', () => {
    const root = model('Body', 'Prop');
    const mixer = new UnitAnimationMixer(root, [clip('rest', 30), clip('cast', 30)], { idle: 'rest', cast: 'cast' },
      { castSequence: { main: 'cast' }, submeshVisibility: { initiallyHidden: ['Prop'], events: { cast: [{ frame: 0, show: ['Prop'], hide: [] }] } } });
    mixer.apply(output('idle', undefined, 1, true)); mixer.update(0.3);
    const seen: string[][] = [];
    const cast = output('cast', ['cast'], 1, false, 0.25); mixer.apply(cast); seen.push(visible(root));
    for (let i = 0; i < 6; i++) { mixer.update(1 / 30); seen.push(visible(root)); }
    expect(seen.every(frame => frame.join() === 'Body,Prop')).toBe(true);
    const back = output('idle', undefined, 1, true, 0.25); mixer.apply(back); seen.length = 0; seen.push(visible(root));
    for (let i = 0; i < 6; i++) { mixer.update(1 / 30); seen.push(visible(root)); }
    expect(seen.every(frame => frame.join() === 'Body')).toBe(true);
    mixer.dispose();
  });

  it('a clip that shows a submesh the model lacks switches nothing, so a swap never leaves half a body', () => {
    const root = model('BodyNormal', 'Weapon');
    const visibility: SubmeshVisibility = { initiallyHidden: ['BodyUlt'], events: {
      leave: [{ frame: 0, show: [], hide: ['BodyNormal'] }, { frame: 0, show: ['BodyUlt'], hide: [] }],
      fall: [{ frame: 0, show: [], hide: ['Weapon'] }],
    } };
    const mixer = new UnitAnimationMixer(root, [clip('rest', 30), clip('leave', 30), clip('fall', 30)],
      { idle: 'rest', cast: 'leave', death: 'fall' }, { castSequence: { main: 'leave' }, submeshVisibility: visibility });
    mixer.apply(output('cast', ['leave'], 1)); mixer.update(0.5);
    expect(visible(root)).toEqual(['BodyNormal', 'Weapon']);
    mixer.apply(output('death')); mixer.update(0.5);
    expect(visible(root)).toEqual(['BodyNormal']);
    mixer.dispose();
  });

  it('a held submesh (Dr. Mundo\'s ultimate body) stays hidden: the clip that shows it switches nothing, its geometry stays', async () => {
    expect(HELD_SUBMESHES.drmundo).toEqual(['BodyUlt']);
    const visibility: SubmeshVisibility = { initiallyHidden: ['BodyUlt', 'ToeTag'], events: {
      enter: [{ frame: 0, show: [], hide: ['BodyUlt'] }, { frame: 0, show: ['BodyNormal'], hide: [] }],
      leave: [{ frame: 0, show: [], hide: ['BodyNormal'] }, { frame: 0, show: ['BodyUlt'], hide: [] }],
      fall: [{ frame: 0, show: ['ToeTag'], hide: [] }],
    } };
    const manifest: AssetManifest = { schemaVersion: 1, models: { drmundo: { path: 'units/m.glb', animations: { idle: 'rest', cast: 'enter', death: 'fall' }, castSequence: { main: 'enter', out: 'leave' }, submeshVisibility: visibility } } };
    const cache = new ModelCache(manifest, '', async () => ({ scene: model('BodyNormal', 'BodyUlt', 'ToeTag'), animations: [clip('rest', 30), clip('enter', 30), clip('leave', 30), clip('fall', 30)] }));
    const lease = await cache.load('drmundo');
    expect(Object.keys(lease.submeshVisibility!.events!)).toEqual(['enter', 'fall']);
    expect(visible(lease.scene)).toEqual(['BodyNormal']);
    const mixer = new UnitAnimationMixer(lease.scene, lease.animations, lease.animationNames, lease);
    mixer.apply(output('cast', ['enter', 'leave'], 2));
    for (let i = 0; i < 8; i++) { mixer.update(0.25); expect(visible(lease.scene)).toEqual(['BodyNormal']); }
    mixer.apply(output('death')); mixer.update(0.1); expect(visible(lease.scene)).toEqual(['BodyNormal', 'ToeTag']);
    mixer.dispose(); lease.release(); cache.dispose();
  });

  it('ignores names the model does not carry and leaves submeshes outside the data alone', () => {
    const root = model('Body', 'Extra');
    root.traverse(object => { if ((object as Mesh).isMesh && ((object as Mesh).material as MeshBasicMaterial).name === 'Extra') object.visible = false; });
    hideInitialSubmeshes(root, { initiallyHidden: ['Missing'] });
    const visibility: SubmeshVisibility = { initiallyHidden: ['Missing'], events: { rest: [{ frame: 0, show: [], hide: ['Body', 'Missing'] }] } };
    const mixer = new UnitAnimationMixer(root, [clip('rest', 30), clip('walk', 30)], { idle: 'rest', move: 'walk' }, { submeshVisibility: visibility });
    mixer.apply(output('idle', undefined, 1, true));
    expect(visible(root)).toEqual([]);
    mixer.apply(output('move', undefined, 1, true));
    expect(visible(root)).toEqual(['Body']);
    mixer.dispose();
  });
});
