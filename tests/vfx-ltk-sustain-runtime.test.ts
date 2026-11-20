import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, MAX_LTK_SYSTEMS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { SUSTAIN_CAPS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem } from './vfx-ltk-synthetic';

// Synthetic systems under the ids of the held layers (cue-overrides.ts SUSTAIN_*); the cues are short, as an export gives them.
const MARK = '5af49b76', AXES = 'd86cc9bc', MOUTH = '6889455c', BUFF = '9f805f6e';
const index = { version: 1, systems: { [MARK]: 's.json', [AXES]: 's.json', [MOUTH]: 's.json', [BUFF]: 's.json', filler: 's.json' }, assets: { 'synthetic.tex': 't.png' },
  skills: { ekko: [{ system: MARK, event: 'hit', delay: 0, duration: 0.5 }], draven: [{ system: AXES, event: 'cast-start', delay: 0, duration: 1, stopAfter: 0.5 }],
    kogmaw: [{ system: MOUTH, event: 'cast-start', delay: 0, duration: 2.6 }, { system: BUFF, event: 'cast-start', delay: 0, duration: 2.6 }],
    filler: [{ system: 'filler', event: 'hit', delay: 0, duration: 2 }] } };
async function board() {
  const scene = new Scene(), camera = new Camera();
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json') ? index : syntheticSystem(), readTexture: async () => new Texture() });
  const units = new Map<string, { root: Group; body: Group; alive: boolean }>();
  const unit = (id: string) => { let u = units.get(id); if (!u) { const root = new Group(), body = new Group(); root.add(body); u = { root, body, alive: true }; units.set(id, u); } return u; };
  const runtime = createLtkRuntime(library, scene, id => unit(id));
  for (const champion of ['ekko', 'draven', 'kogmaw', 'filler']) await runtime.warm(champion);
  const step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 0.05) runtime.update(0.05, camera); };
  const shown = (system: string) => scene.children.filter(o => o.name === 'ltk-vfx' && o.userData.ltkSystem === system);
  return { runtime, library, step, shown };
}

describe('held layers: refreshed marks and decoration that comes back (Fable 11-19)', () => {
  it('Ekko\'s mark shows its 2 s after each hit on that target, a new hit replacing it, one per target', async () => {
    const { runtime, library, step, shown } = await board();
    runtime.play('ekko', 'ekko', ['b']); step(1);
    expect(shown(MARK)).toHaveLength(1);
    runtime.play('ekko', 'ekko', ['b']); step(0.1);
    expect(shown(MARK)).toHaveLength(1);
    runtime.play('ekko', 'ekko', ['c']); step(0.1);
    expect(shown(MARK)).toHaveLength(2);
    // Past its 2 s from the last hit on each, it is gone; not before.
    step(SUSTAIN_CAPS[MARK]! - 0.5); expect(shown(MARK)).toHaveLength(2);
    step(0.6); expect(shown(MARK)).toHaveLength(0);
    runtime.dispose(); library.dispose();
  });

  it('Draven\'s axes are one layer however often he casts: a recast replaces them', async () => {
    const { runtime, library, step, shown } = await board();
    runtime.play('draven', 'draven', []); step(0.5);
    runtime.play('draven', 'draven', []); step(0.5);
    runtime.play('draven', 'draven', []); step(0.5);
    expect(shown(AXES)).toHaveLength(1);
    runtime.dispose(); library.dispose();
  });

  it('a refresh replaces only the same system: one caster\'s two held systems both stay, one layer each', async () => {
    const { runtime, library, step, shown } = await board();
    runtime.play('kogmaw', 'kog', []); step(1);
    runtime.play('kogmaw', 'kog', []); step(1);
    expect(shown(MOUTH)).toHaveLength(1);
    expect(shown(BUFF)).toHaveLength(1);
    // Another caster's play of the same system is its own layer.
    runtime.play('kogmaw', 'kog2', []); step(0.1);
    expect(shown(MOUTH)).toHaveLength(2);
    runtime.dispose(); library.dispose();
  });

  it('a held layer replayed by every pulse stays one layer (Amumu\'s passive: 24 stacked runs pushed Draven\'s axes out)', async () => {
    const { runtime, library, step, shown } = await board();
    for (let n = 0; n < 10; n++) { runtime.play('draven', 'draven', []); step(1); }
    expect(shown(AXES)).toHaveLength(1);
    runtime.dispose(); library.dispose();
  });

  it('Draven\'s axes give their slot to any skill visual and come back when room frees', async () => {
    const { runtime, library, step, shown } = await board();
    runtime.play('draven', 'draven', []); step(0.1);
    expect(shown(AXES)).toHaveLength(1);
    // Every slot taken by skill hits (six start a frame).
    for (let n = 0; n < MAX_LTK_SYSTEMS; n++) runtime.play('filler', `s${n}`, [`t${n}`]);
    step(0.25);
    expect(shown(AXES)).toHaveLength(0);
    expect(shown('filler').length).toBe(MAX_LTK_SYSTEMS);
    // The hits end after their 2 s; the axes return for the rest of their time.
    step(2);
    expect(shown('filler')).toHaveLength(0);
    expect(shown(AXES)).toHaveLength(1);
    runtime.dispose(); library.dispose();
  });
});
