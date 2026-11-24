import { readFileSync } from 'node:fs';
import { Camera, Group, Scene, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { createVfxLibrary } from '../src/rendering/three-mode/vfx-ltk/loader';
import { createLtkRuntime } from '../src/rendering/three-mode/vfx-ltk/runtime';
import { AKALI_EXPOSURE, AKALI_MARK_DELAY, AKALI_MARK_SECONDS, CUE_OVERRIDES, CUE_RULE_STOPS, SUSTAIN_CAPS, SUSTAIN_REFRESH } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { createControlEndStops } from '../src/rendering/three-mode/vfx-ltk/sustain-stops';
import type { TimelineCue } from '../src/rendering/three-mode/vfx-ltk/timeline';
import { stepCombat, type CombatUnit, type CombatState } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { COMBAT_TICK_MS } from '../src/simulation/combat-types';
import { S13_ABILITY_DATA } from '../src/simulation/content/abilities';
import { battle, unit } from './combat-helpers';
import { num, syntheticSystem } from './vfx-ltk-synthetic';

// 11-24: status displays follow the rules' state. Lux's and Renata's shields go when their layer breaks or runs out, Akali's
// mark lasts exactly the rules' exposure and goes with its target, Elise's cocoon goes when its target is no longer stunned.

const SHIELD = '44c9516a', RENATA = 'fdf79734', MARK = 'bc4a9e0d', COCOON = '6d6525e8';

describe('which rule state ends each display', () => {
  it('Lux and Renata shields end with their layer on the holder; Elise cocoon with the stun; Akali mark is held for the exposure', () => {
    expect(CUE_RULE_STOPS.abilityShieldEndedOnHolder.systems['lux-ability']).toEqual([SHIELD]);
    expect(CUE_RULE_STOPS.abilityShieldEndedOnHolder.systems['renata-ability']).toEqual([RENATA]);
    expect(CUE_RULE_STOPS.abilityShieldEndedOnSelf).toEqual({ systems: { 'lux-ability': [SHIELD] }, on: 'self' });
    expect(CUE_RULE_STOPS.stunEnded.systems).toEqual([COCOON]);
    expect(SUSTAIN_CAPS[MARK]).toBe(AKALI_MARK_SECONDS);
    expect(SUSTAIN_REFRESH.has(MARK)).toBe(true);
    const mark = CUE_OVERRIDES.akali!.filter(cue => cue.system === MARK);
    expect(mark).toHaveLength(1);
    expect(mark[0]).toMatchObject({ event: 'hit', primary: true, delay: AKALI_MARK_DELAY });
    // Her spider form's lists are not touched.
    expect(Object.hasOwn(CUE_OVERRIDES, 'elise-spider')).toBe(false);
  });

  it('the renderer runs the holder stop on her self-cast too, and the stun stop from each board frame', () => {
    const source = readFileSync(new URL('../src/rendering/three-mode/placeholder-renderer.ts', import.meta.url), 'utf8');
    expect(source).toContain('CUE_RULE_STOPS.abilityShieldEndedOnSelf.systems');
    expect(source).toContain('ltk?.stopSystemsOnSelf(event.targetId, systems)');
    expect(source).toContain('controlEndStops.frame(frame.pieces, frame.fighting)');
    expect(source).toContain('controlEndStops.clear()');
  });
});

describe('Akali mark: the rules exposure time, read from the rules', () => {
  function hero(name: string): CombatUnit {
    return unit('p', 'player', 1, 3, { definitionId: name, ability: resolveAbility(name + '-ability', 1),
      hp: 4000, maxHp: 5000, armor: 0, magicResist: 0, mana: 100, maxMana: 100, attackDamage: 100, attackRange: 6, abilityPower: 100,
      baseAttackSpeedBps: 10000, runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [] });
  }
  const dummy = () => unit('e', 'enemy', 2, 3, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    hp: 100000, maxHp: 100000, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [] });

  it('mirrors the ability data: every star level, in rule ticks', () => {
    expect(AKALI_EXPOSURE.ticksPerSecond).toBe(1000 / COMBAT_TICK_MS);
    for (const seconds of S13_ABILITY_DATA['akali-ability']!.variables.Duration!) expect(Math.round(seconds * AKALI_EXPOSURE.ticksPerSecond)).toBe(AKALI_EXPOSURE.ticks);
  });
  it('ends on the tick the exposure on her target ends, counted from when the mark lands', () => {
    let state: CombatState = battle([hero('akali'), dummy()], { rngState: 42 }), castTick = -1, until = 0;
    for (let n = 0; n < 200 && state.status === 'running' && !until; n++) {
      const step = stepCombat(state); state = step.state;
      const cast = step.events.find(e => e.type === 'cast'); if (cast && castTick < 0) castTick = cast.tick;
      until = (state.units.find(u => u.id === 'e') as { g22?: { exposureUntilTick: number } } | undefined)?.g22?.exposureUntilTick ?? 0;
    }
    expect(castTick).toBeGreaterThanOrEqual(0);
    expect(until).toBeGreaterThan(castTick);
    expect(AKALI_MARK_DELAY + AKALI_MARK_SECONDS).toBeCloseTo((until - castTick) * COMBAT_TICK_MS / 1000, 9);
  });
});

describe('the runtime: an early end stops the display, no end leaves it be', () => {
  // Synthetic systems only (made-up numbers), each emitting far longer than any cue here, so only the cue or a stop ends it.
  const long = () => syntheticSystem({ lifetime: num(30) });
  const skills: Record<string, TimelineCue[]> = {
    shield: [{ system: SHIELD, action: 'cast', event: 'hit', delay: 0, duration: 4, livingTarget: true }],
    self: [{ system: SHIELD, action: 'cast', event: 'cast-start', delay: 0, duration: 4 }],
    mark: [{ system: MARK, action: 'cast', event: 'hit', delay: 0, duration: 1, primary: true }],
  };
  async function setup() {
    const systems = [SHIELD, MARK];
    const library = createVfxLibrary('/root/', { readJson: async url => url.endsWith('index.json')
      ? { version: 1, systems: Object.fromEntries(systems.map(s => [s, `systems/${s}.json`])), assets: { 'synthetic.tex': 'texture.png' }, skills }
      : long(), readTexture: async () => new Texture() });
    const scene = new Scene(), units = new Map<string, { root: Group; body: null; alive: boolean }>();
    ['caster', 'ally', 'foe'].forEach((id, i) => { const root = new Group(); root.position.set(10 + i * 60, 0, 20); scene.add(root); root.updateMatrixWorld(); units.set(id, { root, body: null, alive: true }); });
    const runtime = createLtkRuntime(library, scene, id => units.get(id), {});
    for (const champion of Object.keys(skills)) await runtime.warm(champion);
    const camera = new Camera(), step = (seconds: number) => { for (let t = 0; t < seconds - 1e-9; t += 1 / 60) runtime.update(1 / 60, camera); };
    return { runtime, step };
  }

  it('a shield broken early: its display goes on the holder; one not broken keeps playing', async () => {
    const broken = await setup();
    expect(broken.runtime.play('shield', 'caster', ['ally'], 'cast')).toBe(true);
    broken.step(1); expect(broken.runtime.active).toBe(1);
    broken.runtime.stopSystemsOn('ally', [SHIELD]); broken.step(0.6);
    expect(broken.runtime.active).toBe(0);
    const kept = await setup();
    kept.runtime.play('shield', 'caster', ['ally'], 'cast'); kept.step(1);
    kept.runtime.stopSystemsOn('foe', [SHIELD]); kept.step(2);
    expect(kept.runtime.active).toBe(1);
  });

  it('her own shield ending stops her self-cast bubble, not the one on an ally', async () => {
    const { runtime, step } = await setup();
    runtime.play('shield', 'caster', ['ally'], 'cast'); runtime.play('self', 'caster', [], 'cast');
    step(0.5); expect(runtime.active).toBe(2);
    runtime.stopSystemsOnSelf('caster', [SHIELD]); step(0.6);
    expect(runtime.active).toBe(1);
    runtime.stopSystemsOnSelf('ally', [SHIELD]); step(0.6);
    expect(runtime.active).toBe(1);
  });

  it('Akali mark stays for the exposure, then goes; its target dying takes it at once', async () => {
    const full = await setup();
    full.runtime.play('mark', 'caster', ['foe'], 'cast');
    full.step(AKALI_MARK_SECONDS - 0.1); expect(full.runtime.active).toBe(1);
    full.step(0.2); expect(full.runtime.active).toBe(0);
    const killed = await setup();
    killed.runtime.play('mark', 'caster', ['foe'], 'cast'); killed.step(1);
    expect(killed.runtime.active).toBe(1);
    killed.runtime.stopUnit('foe'); killed.step(1 / 30);
    expect(killed.runtime.active).toBe(0);
  });
});

describe('Elise cocoon: the stun as each board frame shows it', () => {
  const piece = (id: string, control: unknown, alive = true) => ({ id, alive, control });
  it('stops the cocoon on the frame its target is no longer stunned', () => {
    const stops = createControlEndStops();
    expect(stops.frame([piece('a', { kind: 'stun' }), piece('b', null)], true)).toEqual([]);
    expect(stops.frame([piece('a', { kind: 'stun' }), piece('b', null)], true)).toEqual([]);
    expect(stops.frame([piece('a', null), piece('b', null)], true)).toEqual([{ by: 'target', id: 'a', systems: [COCOON] }]);
    // Once only.
    expect(stops.frame([piece('a', null)], true)).toEqual([]);
  });
  it('does not stop it while the stun holds, nor for a death (the death ends it already) or a reset', () => {
    const stops = createControlEndStops();
    stops.frame([piece('a', { kind: 'stun' })], true);
    for (let n = 0; n < 5; n++) expect(stops.frame([piece('a', { kind: 'stun' })], true)).toEqual([]);
    expect(stops.frame([piece('a', null, false)], true)).toEqual([]);
    stops.frame([piece('b', { kind: 'stun' })], true); stops.clear();
    expect(stops.frame([piece('b', null)], true)).toEqual([]);
  });
});
