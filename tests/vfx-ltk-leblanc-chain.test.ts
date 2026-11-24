import { readFileSync } from 'node:fs';
import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { CUE_END_STOPS, CUE_OVERRIDES, LEBLANC_CHAIN_FROM_PRIMARY } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { syntheticSystem, num } from './vfx-ltk-synthetic';

// 11-25 (Fable): LeBlanc's chain runs from her primary target to each other enemy it binds, chest to chest as its spell data
// starts and ends it; never from her weapon and never to the primary itself.

const CHAIN = '29d01632';

describe('the chain cue', () => {
  it('is a link from chest to chest played from the primary (passive), no longer a cast link from her weapon', () => {
    const chain = CUE_OVERRIDES.leblanc!.filter(cue => cue.system === CHAIN);
    expect(chain).toHaveLength(1);
    expect(chain[0]).toMatchObject({ action: 'passive', event: 'link', bone: 'C_BUFFBONE_GLB_CHEST_LOC', targetBone: 'C_BUFFBONE_GLB_CHEST_LOC' });
    expect(chain[0]!.primary).toBeUndefined();
    expect(LEBLANC_CHAIN_FROM_PRIMARY).toEqual({ system: CHAIN, effect: 'leblanc-chain' });
    // Ended on the bound units, not on her: it is no longer in her own end list.
    expect(CUE_END_STOPS['leblanc-chain']).not.toContain(CHAIN);
  });
  it('the renderer plays it from the first target the cast names to the others, and ends it on every bound unit', () => {
    const source = readFileSync(new URL('../src/rendering/three-mode/placeholder-renderer.ts', import.meta.url), 'utf8');
    expect(source).toContain("const [primary, ...others] = [...new Set(event.targetIds)];");
    expect(source).toContain("if (primary && others.length) ltk?.play('leblanc', primary, others, 'passive');");
    expect(source).toContain('for (const id of event.targetIds ?? []) ltk?.stopSystems(id, [LEBLANC_CHAIN_FROM_PRIMARY.system]);');
  });
});

describe('the runtime: one link from the primary to each other bound enemy', () => {
  async function setup() {
    const chain = CUE_OVERRIDES.leblanc!.find(cue => cue.system === CHAIN)!;
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: { [CHAIN]: `systems/${CHAIN}.json` }, assets: { 'synthetic.tex': 'texture.png' }, skills: { leblanc: [chain] } }
      // Synthetic only (made-up numbers): emits far longer than the cue.
      : syntheticSystem({ lifetime: num(30) }), readTexture: async () => new Texture() });
    const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
    ['leblanc', 'b', 'c', 'd'].forEach((id, i) => { const root = new Group(); root.position.set(10 + i * 120, 0, 20); scene.add(root); root.updateMatrixWorld(); units.set(id, { root, body: null, alive: true }); });
    const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
    await runtime.warm('leblanc');
    const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
    return { runtime, step };
  }
  it('three bound enemies draw two links, both ending when the chain ends on its source', async () => {
    const { runtime, step } = await setup();
    expect(runtime.play('leblanc', 'b', ['c', 'd'], 'passive')).toBe(true);
    step(1.2); expect(runtime.active).toBe(2);
    // Her own end list does not reach them: they are the primary's.
    runtime.stopSystems('leblanc', [CHAIN]); step(0.6); expect(runtime.active).toBe(2);
    runtime.stopSystems('b', [CHAIN]); step(0.6); expect(runtime.active).toBe(0);
  });
});
