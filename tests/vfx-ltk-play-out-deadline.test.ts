import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary, withCueOverrides } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { CUE_OVERRIDES, CUE_RULE_STOPS, PLAY_OUT_AT_DEADLINE, SUSTAIN_SKILL_CAPS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { S13_ABILITY_DATA } from '../src/simulation/content/abilities';
import { constant, num, syntheticSystem } from './vfx-ltk-synthetic';

describe('cues that play out at their end (Fable 11-19 cut-off evidence)', () => {
  it('only Ezreal\'s W bolt, Nami\'s W bounce and Viktor\'s rising knock-up play out, each for the same capped time', () => {
    const playing = Object.entries(CUE_OVERRIDES).flatMap(([champion, cues]) => cues.filter(cue => cue.playOut !== undefined).map(cue => [champion, cue.system, cue.playOut]));
    expect(playing.sort()).toEqual([['ezreal', '9cb99eb2', PLAY_OUT_AT_DEADLINE], ['nami', 'a64f66ee', PLAY_OUT_AT_DEADLINE], ['viktor', '26c2f2d9', PLAY_OUT_AT_DEADLINE]]);
  });

  it('at its end such a cue stops emitting and its live particles stay at most its play-out time; a plain cue is cut there', async () => {
    // Long-lived particles, emitted throughout: at the cue's end many are still alive.
    const system = syntheticSystem({ rate: constant(num(30)), lifetime: num(5), particleLifetime: constant(num(2)),
      // Its particles may outlive the stop (the engine cuts a stopped emitter's particles to its own linger).
      particleLinger: num(2) });
    const index = { version: 1, systems: { s: 's.json' }, assets: { 'synthetic.tex': 't.png' },
      skills: { jinx: [{ system: 's', event: 'cast-start', delay: 0, duration: 0.5 }], zeri: [{ system: 's', event: 'cast-start', delay: 0, duration: 0.5, playOut: 0.5 }] } };
    const scene = new Scene(), camera = new Camera(), root = new Group(), body = new Group(); root.add(body);
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : system, readTexture: async () => new Texture() });
    const runtime = createLtkRuntime(library, scene, () => ({ root, body, alive: true }));
    await runtime.warm('jinx'); await runtime.warm('zeri');
    const step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 0.05) runtime.update(0.05, camera); };
    const shown = () => scene.children.filter(o => o.name === 'ltk-vfx').length;
    runtime.play('jinx', 'u', []); step(0.3); expect(shown()).toBe(1); step(0.3); expect(shown()).toBe(0);
    runtime.play('zeri', 'u', []); step(0.6); expect(shown()).toBe(1);
    step(0.5); expect(shown()).toBe(0);
    runtime.dispose(); library.dispose();
  });

  it('Loris\'s Q ground ring holds until his shield layer ends, capped at the rules\' longest shield time plus 1 s; his blast\'s ring stays short', () => {
    expect(CUE_RULE_STOPS.abilityShieldEnded.systems['loris-ability']).toContain('2f1f3b60');
    const longest = Math.max(...(S13_ABILITY_DATA['loris-ability'] as unknown as { variables: Record<string, number[]> }).variables.Duration!);
    expect(SUSTAIN_SKILL_CAPS.loris!['2f1f3b60']).toBeCloseTo(longest + 1, 6);
    const ring = { system: '2f1f3b60', event: 'cast-start' as const, delay: 0.3, duration: 3 };
    const index = withCueOverrides({ version: 1, systems: { '2f1f3b60': 'r.json' }, assets: {},
      skills: { loris: [ring], 'loris-retaliation': [{ ...ring, delay: 0, duration: 0.7 }] } });
    expect(index.skills.loris).toEqual([{ ...ring, duration: longest + 1, refresh: true }]);
    // The blast's ring keeps its short cue (cue-ranks.ts may label its rank; not checked here).
    expect(index.skills['loris-retaliation']).toMatchObject([{ ...ring, delay: 0, duration: 0.7 }]);
    expect(index.skills['loris-retaliation']![0]!.refresh).toBeUndefined();
  });
});
