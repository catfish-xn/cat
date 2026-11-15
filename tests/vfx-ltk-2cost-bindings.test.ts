import { Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime, LTK_RUN_STATS } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { mapSkillTimeline } from '../src/rendering/three-mode/vfx-ltk/timeline';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { realUnits, runRealCombat } from '../dev/castcmp/real-combat';
import { syntheticSystem } from './vfx-ltk-synthetic';

// 11-15 two-cost rebinds: Nocturne's cast loses the purple disc (the original shows it under empowered swings only);
// Ziggs's cast throws his main bomb (Q_mis_01) that lands on the index's explosion.
const casts = (champion: string) => CUE_OVERRIDES[champion]!.filter(cue => (cue.action ?? 'cast') === 'cast');

/** The runtime over the index's own rows for one champion (synthetic systems): whether play() takes the cast itself. */
async function playsCast(champion: string, exported: TimelineCue[], targets: string[]) {
  const ids = [...new Set([...exported, ...CUE_OVERRIDES[champion]!].map(cue => cue.system))];
  const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
    ? { version: 1, systems: Object.fromEntries(ids.map(s => [s, `systems/${s}.json`])), assets: { 'synthetic.tex': 'texture.png' }, skills: { [champion]: exported } }
    : syntheticSystem(),
  readTexture: async () => new Texture() });
  const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
  const find = (id: string) => { let unit = units.get(id); if (!unit) { unit = { root: new Group(), body: null, alive: true }; unit.root.position.set(units.size * 40, 0, 0); scene.add(unit.root); unit.root.updateMatrixWorld(); units.set(id, unit); } return unit; };
  const runtime = createLtkRuntime(library, scene, find);
  await runtime.warm(champion);
  const refused = { ...LTK_RUN_STATS.refused };
  const played = runtime.play(champion, 'me', targets, 'cast');
  const same = JSON.stringify(LTK_RUN_STATS.refused) === JSON.stringify(refused);
  runtime.dispose();
  return played && same;
}

describe('two-cost cue bindings (11-15)', () => {
  it('Nocturne: his cast plays only his buff, the disc stays on the empowered swing, and the runtime still plays the cast', async () => {
    expect(casts('nocturne').map(cue => [cue.system, cue.event])).toEqual([['97366927', 'cast-start']]);
    const swing = CUE_OVERRIDES.nocturne!.filter(cue => cue.action === 'attack' && cue.variant === 'empowered').map(cue => cue.system);
    expect(swing).toEqual(['3e224f4a', '6fb6c5e5']);
    // The index's rows as exported (the disc on the empowered swing only), then the overrides: the cast is not refused.
    const exported: TimelineCue[] = [
      { system: '0f2af66b', action: 'attack', event: 'hit', delay: 0.3, duration: 1.5 },
      { system: '97366927', action: 'cast', event: 'cast-start', delay: 0, duration: 6 },
      { system: '3e224f4a', action: 'attack', variant: 'empowered', event: 'cast-start', delay: 0.3, duration: 0.5 },
      { system: '6fb6c5e5', action: 'attack', variant: 'empowered', event: 'hit', delay: 0.3, duration: 0.6 },
    ];
    expect(await playsCast('nocturne', exported, ['foe'])).toBe(true);
  });

  it('Nocturne: in a real combat every swing in the 6 s after his cast is empowered (one disc each), and at least two are', () => {
    const units = realUnits({ unit: 'nocturne', star: 1, form: null, foe: 'amumu', dist: 1, nfoes: 1, foestar: 3 });
    const events: DisplayCombatEvent[] = [];
    runRealCombat(units, 120, (_state, shown) => { events.push(...shown as DisplayCombatEvent[]); });
    const defs = Object.fromEntries(units.map(u => [u.id, u.definitionId as string]));
    const plans = createBatch1VfxEvents(id => defs[id]).batch(events);
    const tickOf = (e: DisplayCombatEvent) => (e as { tick: number }).tick;
    const firstCast = events.find(e => e.type === 'cast' && e.sourceId === 'me' && e.completed !== false)!;
    expect(firstCast).toBeDefined();
    const swings = plans.filter(p => p.event.type === 'attack' && p.event.attackerId === 'me' && tickOf(p.event) > tickOf(firstCast) && tickOf(p.event) < tickOf(firstCast) + 120);
    expect(swings.length).toBeGreaterThanOrEqual(2);
    expect(swings.every(p => p.variant === 'empowered')).toBe(true);
  });

  it('Ziggs: his cast throws the main bomb, which lands as the explosion starts; both map to the target', async () => {
    const [bomb, blast] = casts('ziggs');
    expect([bomb.system, bomb.event, blast.system, blast.event]).toEqual(['52963b0a', 'projectile', '04c3cba0', 'hit']);
    expect(bomb.delay + bomb.travelSeconds!).toBeCloseTo(blast.delay, 9);
    const mapped = mapSkillTimeline(casts('ziggs'), 'me', ['foe']);
    expect(mapped.unsupported).toEqual([]);
    expect(mapped.spawns.map(s => [s.system, s.targetId])).toEqual([['52963b0a', 'foe'], ['04c3cba0', 'foe']]);
    const exported: TimelineCue[] = [
      { system: '7f403068', action: 'attack', event: 'projectile', delay: 0.33, duration: 1.5, travelSeconds: 0.3 },
      { system: '0f2af66b', action: 'attack', event: 'hit', delay: 0.63, duration: 1.5 },
      { system: '04c3cba0', action: 'cast', event: 'hit', delay: 0.8, duration: 1.2 },
    ];
    expect(await playsCast('ziggs', exported, ['foe'])).toBe(true);
  });
});
