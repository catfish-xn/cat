import { readFileSync } from 'node:fs';
import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { CUE_EXTRA_SKILLS, CUE_RULE_STOPS, STUN_END_FADE_SECONDS, SUSTAIN_CAPS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { sevikaSkills } from '../src/rendering/three-mode/vfx-ltk/champions/sevika';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { num, syntheticSystem } from './vfx-ltk-synthetic';

// 11-24, second batch: Sevika's roulette shield goes when her shield layer ends; Zyra's root cluster on her rooted target
// stays while that target is stunned and eases out when the stun ends (as Elise's cocoon now does too).

const SEVIKA_SHIELD = '518dee63', ZYRA_ROOT = 'b888a24f', ZYRA_VINE_HIT = '9d413df0', COCOON = '6d6525e8';

describe('which rule state ends them', () => {
  it('Sevika\'s shield ends with her ability\'s shield layer, on her own cast-start', () => {
    expect(CUE_RULE_STOPS.abilityShieldEnded.systems['sevika-ability']).toEqual([SEVIKA_SHIELD]);
    expect(sevikaSkills['sevika-shield']!.map(cue => [cue.system, cue.event])).toEqual([[SEVIKA_SHIELD, 'cast-start']]);
  });
  it('Zyra\'s root cluster ends with the stun, held up to the rules\' stun plus 1 s; her vines\' body hit is left alone', () => {
    expect(CUE_RULE_STOPS.stunEnded.systems).toEqual([COCOON, ZYRA_ROOT]);
    expect(SUSTAIN_CAPS[ZYRA_ROOT]).toBeGreaterThan(0);
    expect(CUE_RULE_STOPS.stunEnded.systems).not.toContain(ZYRA_VINE_HIT);
    // On her primary target only: the one her vines stun.
    const root = CUE_EXTRA_SKILLS['zyra-vines']!.filter(cue => cue.system === ZYRA_ROOT);
    expect(root).toHaveLength(1);
    expect(root[0]).toMatchObject({ event: 'hit', primary: true });
  });
  it('the renderer eases the stun layers out from each board frame', () => {
    const source = readFileSync(new URL('../src/rendering/three-mode/placeholder-renderer.ts', import.meta.url), 'utf8');
    expect(source).toContain('ltk?.fadeSystemsOn(stop.id, stop.systems, STUN_END_FADE_SECONDS)');
    expect(STUN_END_FADE_SECONDS).toBeGreaterThan(0);
    expect(STUN_END_FADE_SECONDS).toBeLessThan(0.5);
  });
});

describe('the runtime: a state that ends early ends its display, one that holds keeps it', () => {
  // Synthetic systems only (made-up numbers), each emitting far longer than any cue here.
  const long = () => syntheticSystem({ lifetime: num(30) });
  const skills: Record<string, TimelineCue[]> = {
    shield: [{ system: SEVIKA_SHIELD, action: 'cast', event: 'cast-start', delay: 0, duration: 4 }],
    root: [{ system: ZYRA_ROOT, action: 'passive', event: 'hit', delay: 0, duration: 1.4, stopAfter: 0.8, fadeOut: true, primary: true }],
  };
  async function setup() {
    const systems = [SEVIKA_SHIELD, ZYRA_ROOT];
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: Object.fromEntries(systems.map(s => [s, `systems/${s}.json`])), assets: { 'synthetic.tex': 'texture.png' }, skills }
      : long(), readTexture: async () => new Texture() });
    const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
    ['zyra', 'foe', 'other'].forEach((id, i) => { const root = new Group(); root.position.set(10 + i * 60, 0, 20); scene.add(root); root.updateMatrixWorld(); units.set(id, { root, body: null, alive: true }); });
    const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
    for (const champion of Object.keys(skills)) await runtime.warm(champion);
    const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
    return { runtime, step };
  }

  it('Sevika: her layer breaking early ends the shield; a stop for someone else leaves it', async () => {
    const broken = await setup();
    broken.runtime.play('shield', 'zyra', [], 'cast'); broken.step(1);
    expect(broken.runtime.active).toBe(1);
    broken.runtime.stopSystems('zyra', [SEVIKA_SHIELD]); broken.step(0.6);
    expect(broken.runtime.active).toBe(0);
    const kept = await setup();
    kept.runtime.play('shield', 'zyra', [], 'cast'); kept.step(1);
    kept.runtime.stopSystems('other', [SEVIKA_SHIELD]); kept.step(2);
    expect(kept.runtime.active).toBe(1);
  });

  it('Zyra: the root stays past its old end while the target is still stunned, and eases out once the stun ends', async () => {
    const { runtime, step } = await setup();
    runtime.play('root', 'zyra', ['foe'], 'passive');
    // Held (SUSTAIN_CAPS): still there after the old 1.4 s end.
    step(1.6); expect(runtime.active).toBe(1);
    // Another unit's stun ending touches nothing.
    runtime.fadeSystemsOn('other', [ZYRA_ROOT], STUN_END_FADE_SECONDS); step(0.1); expect(runtime.active).toBe(1);
    runtime.fadeSystemsOn('foe', [ZYRA_ROOT], STUN_END_FADE_SECONDS);
    step(STUN_END_FADE_SECONDS / 2); expect(runtime.active).toBe(1);
    step(STUN_END_FADE_SECONDS); expect(runtime.active).toBe(0);
  });

  it('Zyra: with no stun end it still goes by its cap', async () => {
    const { runtime, step } = await setup();
    runtime.play('root', 'zyra', ['foe'], 'passive');
    step(SUSTAIN_CAPS[ZYRA_ROOT]! + 0.1);
    expect(runtime.active).toBe(0);
  });
});
