import { AnimationClip, Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createBatch3Vfx, type Batch3Unit } from '../src/rendering/three-mode/vfx-ltk/batch3/controller';
import { createSummonProxies } from '../src/rendering/three-mode/vfx-ltk/batch3/proxies';
import { batch3Timelines } from '../src/rendering/three-mode/vfx-ltk/batch3';
import { SionAnimation } from '../src/rendering/three-mode/vfx-ltk/batch3/sion';
import { UnitActionState } from '../src/rendering3d/animation-state';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';
import type { BoardFrame } from '../src/rendering/board-feed';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import type { ModelLease } from '../src/rendering3d';
import { syntheticSystem } from './vfx-ltk-synthetic';
const unit = (definitionId: string, form: 'front' | 'back' = 'front'): Batch3Unit => ({ root: new Group(), body: null, alive: true, definitionId, form, starLevel: 1, team: 'player' });
const event = (value: unknown) => value as DisplayCombatEvent;
function fixture(hero: string) {
  const source = unit(hero), enemy = { ...unit('enemy'), team: 'enemy' }, units = new Map([['s', source], ['t', enemy]]);
  const runtime = { playVariant: vi.fn((_champion: string, _variant: string, _source: string, _targets?: readonly string[], _group?: string) => true), stopGroup: vi.fn() };
  const controller = createBatch3Vfx(runtime as unknown as ReturnType<typeof createLtkRuntime>, new Scene(), id => units.get(id));
  const shield = (remaining: number, reason: string, key = 'a') => controller.event(event({ type: 'shieldLayerChanged', tick: 2, targetId: 's', remaining, reason,
    key: JSON.stringify(['combat', 's', 'ability', hero + '-ability', key, 0, null, 's', 'source']) }), true);
  return { source, runtime, controller, units, shield };
}
describe('batch 3 display lifecycle', () => {
  it('plays supplied Sion bound/unshackle/revived model clips without changing the action state', () => {
    const state = new UnitActionState('s'), pose = new SionAnimation(), idle = state.output;
    expect(pose.map(idle, 0)).toMatchObject({loop:true,playback:{clips:['cabal_idle']}});
    pose.bind(false, 1, true); const transitioning = pose.map(idle, 1.1);
    expect(transitioning).toMatchObject({loop:false,playback:{clips:['tft13_sion_unshackle_enter'],durationSeconds:.8}});
    expect(pose.map(idle, 2)).toBe(idle); expect(state.output).toEqual(idle);
    pose.revive(); const attack = state.consume({type:'attack',attackerId:'s'});
    expect(pose.map(attack, 2).playback?.clips).toEqual(['tft13_sion_spell4_attack1']);
    const historical = new SionAnimation(); historical.bind(false, 1, false); expect(historical.map(idle, 1)).toBe(idle);
  });
  it('keeps independent shield layers beyond the old fixed window and stops after the last layer ends', () => {
    const { controller, runtime, shield } = fixture('rell');
    shield(100, 'granted'); controller.update(.01); expect(runtime.playVariant).toHaveBeenCalledWith('rell', 'rell-shield', 's', [], 's:rell-shield');
    shield(80, 'granted', 'b'); shield(0, 'depleted'); controller.update(2);
    expect(runtime.stopGroup).not.toHaveBeenCalled();
    controller.update(7); expect(runtime.playVariant).toHaveBeenCalledTimes(2);
    shield(80, 'replaced', 'b'); expect(runtime.stopGroup).toHaveBeenCalledWith('s:rell-shield');
    const calls = runtime.playVariant.mock.calls.length; controller.update(20); expect(runtime.playVariant).toHaveBeenCalledTimes(calls);
  });
  it('separates Rell self shield from actual enemy hits and selects frozen shapeshifter forms', () => {
    const f = fixture('rell'); f.controller.cast('s', ['s', 't']);
    expect(f.runtime.playVariant).toHaveBeenCalledWith('rell', 'rell', 's', ['t'], undefined);
    for (const hero of ['elise', 'swain']) {
      const { controller, source, runtime } = fixture(hero);
      controller.cast('s', ['t']); source.form = 'back'; controller.cast('s', ['t']);
      expect(runtime.playVariant.mock.calls.map(c => c[1])).toEqual([hero + '-front', hero + '-back']);
    }
  });
  it('never restores Sion chains after historical unbinding, and defers revive until the piece returns', () => {
    const { controller, runtime, source } = fixture('g23-sion');
    const frame = (): BoardFrame => ({ fighting: true, rows: 8, columns: 7, hexRadius: 30, origin: {x:0,y:0}, bench: [], dragging: null,
      pieces: [{ id: 's', definitionId: 'g23-sion', team: 'player', starLevel: 1, x:0, y:0, alive: source.alive, visible: source.alive }] });
    controller.frame(frame()); controller.update(.01); expect(runtime.playVariant).toHaveBeenCalledWith('g23-sion', 'g23-sion-bound', 's', [], 's:g23-sion-bound');
    controller.event(event({type: 'bindingChanged', unitId: 's', tick: 4, bound: false}), false);
    controller.frame(frame()); controller.update(10); expect(runtime.playVariant).toHaveBeenCalledTimes(1);
    source.alive = false; controller.event(event({type: 'unitRevived', unitId: 's', tick: 5}), true);
    source.alive = true; controller.frame(frame()); expect(runtime.playVariant).toHaveBeenLastCalledWith('g23-sion', 'g23-sion-revive', 's', [], undefined);
    controller.clear(); controller.update(20); expect(runtime.stopGroup).toHaveBeenCalledWith('s:g23-sion-bound');
  });
  it('uses actual Illaoi endpoints and the magic slam event, never the self-cast receipt as a missile', () => {
    const { controller, runtime } = fixture('illaoi');
    controller.event(event({type: 'cast', tick: 1, sourceId: 's', targetIds: ['s']}), true); controller.cast('s', ['s']); controller.update(.01);
    controller.event(event({type: 'packetDamage', tick: 21, sourceId: 's', targetId: 't', damageType: 'true'}), true);
    expect(runtime.playVariant).toHaveBeenCalledWith('illaoi', 'illaoi-drain', 's', ['t'], undefined);
    const mapping = mapSkillTimeline(batch3Timelines.illaoi['illaoi-drain'], 's', ['t']);
    expect(mapping.unsupported).toEqual([]); expect(mapping.spawns[0]).toMatchObject({ event: 'link', sourceId: 's', targetId: 't' });
    controller.event(event({type: 'packetDamage', tick: 31, sourceId: 's', targetId: 't', damageType: 'magic'}), true);
    expect(runtime.stopGroup).not.toHaveBeenCalled();
    controller.event(event({type: 'statusChanged', tick: 61, targetId: 's', kind: 'damage-reduction', reason: 'expired'}), true);
    controller.event(event({type: 'packetDamage', tick: 61, sourceId: 's', targetId: 't', damageType: 'magic'}), true);
    expect(runtime.stopGroup).toHaveBeenCalledWith('s:illaoi-channel');
    expect(runtime.playVariant).toHaveBeenLastCalledWith('illaoi', 'illaoi-slam', 's', ['t'], undefined);
  });
  it('keeps Swain ascension for observed extended pulses and removes the drawing when pulses stop', () => {
    const { controller, runtime } = fixture('swain');
    controller.event(event({type: 'cast', tick: 1, sourceId: 's', targetIds: []}), true); controller.update(.01);
    for (let i = 0; i < 12; i++) { controller.update(1); controller.event(event({type: 'heal', targetId: 's', shares: [{sourceId: 's', actual: 0}]}), true); }
    expect(runtime.playVariant.mock.calls.filter(c => c[1] === 'swain-ascension')).toHaveLength(2);
    expect(runtime.stopGroup).not.toHaveBeenCalled(); controller.update(1.3); expect(runtime.stopGroup).toHaveBeenCalledWith('s:swain-ascension');
  });
  it('does not leak a late model lease or leave a proxy after reset or endpoint death', async () => {
    let finish!: (lease: ModelLease) => void;
    const source = unit('silco'), target = unit('enemy'), scene = new Scene(), release = vi.fn();
    const manager = createSummonProxies(scene, id => id === 's' ? source : target, () => new Promise(r => { finish = r; }));
    manager.spawn('s', 'v20-silco-minion', 1, 12, 't'); expect(manager.count).toBe(1); manager.clear();
    finish({ scene: new Group(), animations: [new AnimationClip('run', 1, [])], animationNames: {move: 'run'}, placeholder: false, release }); await Promise.resolve();
    expect(release).toHaveBeenCalledTimes(1); expect(scene.children).toHaveLength(0);
    manager.spawn('s', 'v20-silco-minion', 1, 12, 't'); target.alive = false; manager.update(.01); expect(manager.count).toBe(0);
  });
  it('uses an observed Silco cast for visible proxies and clears their leases when motion is disabled', async () => {
    const source = unit('silco'), target = { ...unit('enemy'), team: 'enemy' }, scene = new Scene(); source.starLevel = 3;
    let reduced = false;
    const releases: ReturnType<typeof vi.fn>[] = [];
    const runtime = { playVariant: vi.fn(() => true), stopGroup: vi.fn() };
    const controller = createBatch3Vfx(runtime as unknown as ReturnType<typeof createLtkRuntime>, scene, id => id === 's' ? source : target,
      { reduced: () => reduced, load: async () => { const release = vi.fn(); releases.push(release); return {scene:new Group(), animations:[], animationNames:{}, placeholder:false, release}; } });
    const cast = event({type:'cast',tick:1,sourceId:'s',targetIds:['t']});
    controller.event(cast, false); expect(controller.proxyCount).toBe(0);
    controller.event(cast, true); expect(controller.proxyCount).toBe(8); await Promise.resolve(); controller.update(.01);
    expect(scene.children.every(o => o.userData.visualProxy === true)).toBe(true);
    reduced = true; controller.update(.01); expect(controller.proxyCount).toBe(0); expect(scene.children).toHaveLength(0);
    expect(releases).toHaveLength(8); for (const release of releases) expect(release).toHaveBeenCalledTimes(1);
  });
  it('warms champion variants atomically, then releases long lived systems and queued cues on group end', async () => {
    const skills = { hero: [{system: 'a', event: 'cast-start', delay: 0, duration: .1}], 'hero-shield': [{system: 'b', event: 'cast-start', delay: 0, duration: 9}, {system: 'b', event: 'cast-start', delay: 2, duration: 1}], other: [{system:'c',event:'cast-start',delay:0,duration:1}] };
    const library = createVfxLibrary('/', { readJson: async url => url.endsWith('index.json') ? {version: 1, systems:{a:'a.json',b:'b.json',c:'c.json'}, assets:{'synthetic.tex':'t.png'}, skills} : syntheticSystem(), readTexture: async () => new Texture() });
    const scene = new Scene(), runtime = createLtkRuntime(library, scene, () => unit('hero'));
    await runtime.warm('hero'); expect(library.get('c')).toBeUndefined(); expect(runtime.playVariant('hero', 'hero-shield', 's', [], 'shield')).toBe(true);
    runtime.update(.01, new Camera()); expect(runtime.active).toBe(1); expect(runtime.queued).toBe(1);
    runtime.stopGroup('shield'); runtime.update(.51, new Camera()); expect(runtime.active).toBe(0); expect(runtime.queued).toBe(0); runtime.dispose(); expect(scene.children).toHaveLength(0);
  });
});
