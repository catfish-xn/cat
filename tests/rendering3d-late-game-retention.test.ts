import { describe, expect, it, vi } from 'vitest';
import { Camera, Group, Scene, Texture, Vector3 } from 'three';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, unitAnchor, unitJoints } from '../src/rendering/three-mode/vfx-ltk/particles';
import { createSkillFeel } from '../src/rendering/three-mode/skill-feel';
import { createScoutStage } from '../src/rendering/three-mode/scout-stage';
import { DEFAULT_METER_COLORS } from '../src/rendering/three-mode/unit-overhead';
import { syntheticIndex, syntheticSystem, num } from './vfx-ltk-synthetic';
import type { BoardFrame } from '../src/rendering/board-feed';

describe('late-game visual resource counts (synthetic CPU-only)', () => {
  it('releases all 240 LTK draw geometries/materials over 40 rounds, retaining only the shared texture until library disposal', async () => {
    const texture = new Texture(), releaseTexture = vi.spyOn(texture, 'dispose');
    const library = createVfxLibrary('/synthetic/', { readJson: async url => url.endsWith('index.json') ? syntheticIndex() : syntheticSystem({ lifetime: num(5) }), readTexture: async () => texture });
    const prepared = await library.load('sample'), root = new Group(), camera = new Camera(), scene = new Scene();
    let geometries = 0, materials = 0, created = 0;
    try {
      for (let round = 0; round < 40; round++) {
        const effects = Array.from({ length: 6 }, (_, seed) => createLtkParticles(prepared, {
          anchor: unitAnchor(root, null), target: null, joints: unitJoints(root, null), duration: .5, seed,
        }));
        for (const fx of effects) {
          scene.add(fx.object);
          for (const draw of fx.draws) {
            created++; geometries++; materials++;
            draw.object.geometry.addEventListener('dispose', () => geometries--);
            draw.material.addEventListener('dispose', () => materials--);
          }
        }
        for (let frame = 0; frame < 32; frame++) for (const fx of effects) fx.update(1 / 60, camera);
        for (const fx of effects) { expect(fx.finished).toBe(true); fx.dispose(); fx.dispose(); }
        expect({ round, geometries, materials, sceneNodes: scene.children.length }).toEqual({ round, geometries: 0, materials: 0, sceneNodes: 0 });
        expect(releaseTexture).not.toHaveBeenCalled();
      }
      expect(created).toBe(240);
    } finally { library.dispose(); }
    expect(releaseTexture).toHaveBeenCalledTimes(1);
  });

  it('keeps attack pools and scouting resources constant across 40 rounds and empties their scene on cleanup', () => {
    const scene = new Scene(), owned: { dispose(): void }[] = [], feel = createSkillFeel();
    scene.add(feel.object);
    const poolSize = feel.object.children.length;
    const scout = createScoutStage({ scene, championHeight: 92, championWidth: 110, pawnHeight: 56, pawnWidth: 40,
      loadModel: null, legendModel: () => null, myLegend: () => null, starColor: () => '#fff', itemIcon: () => null,
      overhead: { colors: () => DEFAULT_METER_COLORS, itemTexture: async () => null }, own: r => { owned.push(r); return r; } });
    const resources = owned.length, counts: number[] = [];
    const frame: BoardFrame = { rows: 8, columns: 7, hexRadius: 34, origin: { x: 50, y: 50 }, bench: [], pieces: [], fighting: false, dragging: null };
    for (let round = 0; round < 40; round++) {
      for (let i = 0; i < 48; i++) feel.attack(new Vector3(), new Vector3(100, 0, 100), true, 0);
      for (let i = 0; i < 60; i++) feel.update(1 / 60);
      expect(feel.object.children).toHaveLength(poolSize);
      expect(feel.object.children.filter(n => n.visible)).toHaveLength(0);
      scout.show({ seatId: `s${round % 8}`, name: 'synthetic', board: { units: Array.from({ length: 12 }, (_, i) => ({
        definitionId: 'vex', starLevel: 2, items: [], cell: { row: 4 + Math.floor(i / 7), col: i % 7 },
      })) } }, frame);
      let count = 0; scout.group.traverse(() => count++); counts.push(count);
      expect(owned).toHaveLength(resources);
    }
    expect(new Set(counts).size).toBe(1);
    scout.show(null, null); expect(scout.group.children).toHaveLength(0);
    scout.dispose(); feel.dispose(); owned.forEach(r => r.dispose());
    expect(scene.children).toHaveLength(0);
  });
});
