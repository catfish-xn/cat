import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatUnit, type CombatState, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { CUE_END_STOPS, CUE_OVERRIDES, CUE_RULE_STOPS, SUSTAIN_CAPS, TIMED_FORM_STOPS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { warwickSkills } from '../src/rendering/three-mode/vfx-ltk/champions/warwick';
import { battle, unit } from './combat-helpers';
import { readFileSync } from 'node:fs';
import { CAST_WINDUP_TICKS } from '../src/simulation/cast-windup';

// Same fixed-seed setup as tests/g2-1-skills.test.ts.
function hero(name: string, patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit('p', 'player', 1, 3, { definitionId: name, ability: resolveAbility(name + '-ability', 1),
    hp: 4000, maxHp: 5000, armor: 0, magicResist: 0, mana: 100, maxMana: 100,
    attackDamage: 100, attackRange: 6, abilityPower: 100, baseAttackSpeedBps: 10000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], mechanics: [], ...patch });
}
function dummy(id = 'e', patch: Partial<CombatUnit> = {}): CombatUnit {
  return unit(id, 'enemy', 2, 3, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1),
    hp: 10000, maxHp: 10000, mana: 0, maxMana: 1, attackDamage: 0, cooldownTicks: 1000, moveCooldownTicks: 1000,
    runtime: { ...EMPTY_RUNTIME }, statuses: [], shieldLayers: [], tasks: [], ...patch });
}
function advance(initial: CombatState, count: number, onStep: (state: CombatState) => void = () => {}) {
  let state = initial; const events: CombatEvent[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const step = stepCombat(state); state = step.state; events.push(...step.events); onStep(state); }
  return { state, events };
}
const ended = (events: readonly CombatEvent[]) => events.filter(e => e.type === 'abilityEffectEnded') as Extract<CombatEvent, { type: 'abilityEffectEnded' }>[];

describe('abilityEffectEnded: display-only end signals for timed ability effects', () => {
  it('LeBlanc: one event the tick her chain runs out, naming the chained units', () => {
    // The tick the rule set the chain to run out (its ChainDuration after the cast), read off LeBlanc's own state.
    let chainUntil = 0;
    const r = advance(battle([hero('leblanc'), dummy(), dummy('e2', { cell: { col: 3, row: 3 } })], { rngState: 42 }), 140,
      state => { chainUntil = Math.max(chainUntil, (state.units.find(u => u.id === 'p') as { expansion?: { chainUntilTick: number } } | undefined)?.expansion?.chainUntilTick ?? 0); });
    const cast = r.events.find(e => e.type === 'cast')!;
    const chain = ended(r.events).filter(e => e.effect === 'leblanc-chain');
    expect(chain).toHaveLength(1);
    expect(chainUntil).toBeGreaterThan(cast.tick);
    expect(chain[0]!.tick).toBe(chainUntil);
    expect(chain[0]).toMatchObject({ unitId: 'p', targetIds: ['e', 'e2'] });
  });

  it('Twitch: one event per cast, the tick the last empowered bolt of that cast is spent', () => {
    const r = advance(battle([hero('twitch'), dummy()], { rngState: 42 }), 200);
    const casts = r.events.filter(e => e.type === 'cast'), volley = ended(r.events).filter(e => e.effect === 'twitch-volley');
    expect(casts.length).toBeGreaterThan(0);
    // Every finished volley signals once; a volley still running at the end has not signalled yet.
    expect(volley.length === casts.length || volley.length === casts.length - 1).toBe(true);
    expect(volley[0]).toMatchObject({ unitId: 'p', targetIds: [] });
    expect(volley[0]!.tick).toBeGreaterThan(casts[0]!.tick);
  });

  it('Dr. Mundo: one event the tick his heal over time pays its last part', () => {
    const r = advance(battle([hero('drmundo'), dummy()], { rngState: 42 }), 200);
    const cast = r.events.find(e => e.type === 'cast')!;
    const heal = ended(r.events).filter(e => e.effect === 'drmundo-heal');
    expect(heal.length).toBeGreaterThan(0);
    expect(heal[0]).toMatchObject({ unitId: 'p', targetIds: [] });
    // Parts are paid once a second after the wind-up (CAST_WINDUP_TICKS, 2026-11-16); the signal comes with the last one.
    expect(heal[0]!.tick).toBeGreaterThan(cast.tick + CAST_WINDUP_TICKS.drmundo + 20);
    expect(heal[0]!.tick % 20).toBe((cast.tick + CAST_WINDUP_TICKS.drmundo) % 20);
  });

  it('Vander: one event when his cast brace (channel) ends', () => {
    const r = advance(battle([hero('vander'), dummy()], { rngState: 42 }), 120);
    const cast = r.events.find(e => e.type === 'cast')!;
    const brace = ended(r.events).filter(e => e.effect === 'vander-brace');
    expect(brace.length).toBeGreaterThan(0);
    expect(brace[0]!.unitId).toBe('p');
    expect(brace[0]!.tick).toBeGreaterThan(cast.tick);
  });

  it('Swain: one event the first tick past his demon form (takedown extensions included)', () => {
    let until = 0;
    const r = advance(battle([hero('swain'), dummy()], { rngState: 42 }), 400,
      state => { until = Math.max(until, (state.units.find(u => u.id === 'p') as { g23?: { ascension: { untilTick: number } | null } } | undefined)?.g23?.ascension?.untilTick ?? 0); });
    const cast = r.events.find(e => e.type === 'cast')!;
    const form = ended(r.events).filter(e => e.effect === 'swain-ascension');
    expect(form.length).toBeGreaterThan(0);
    expect(form[0]).toMatchObject({ unitId: 'p', targetIds: [] });
    expect(form[0]!.tick).toBeGreaterThan(cast.tick);
    expect(form.map(e => e.tick)).toContain(until + 1);
  });

  it('the rule events the persistent layers end on are there: Garen and Loris shields, Leona damage reduction, Jayce attack speed', () => {
    for (const name of ['garen', 'loris']) {
      const run = advance(battle([hero(name), dummy()], { rngState: 42 }), 260);
      const own = run.events.filter(e => e.type === 'shieldLayerChanged' && e.layer.key.includes(JSON.stringify(`${name}-ability`))) as Extract<CombatEvent, { type: 'shieldLayerChanged' }>[];
      expect(own.some(e => e.reason === 'granted' && e.layer.targetId === 'p'), name).toBe(true);
      expect(own.some(e => e.reason !== 'granted' && e.reason !== 'absorbed' && e.reason !== 'decayed'), name).toBe(true);
    }
    const leona = advance(battle([hero('leona'), dummy()], { rngState: 42 }), 220);
    const dr = leona.events.filter(e => e.type === 'statusChanged' && e.group.kind === 'damage-reduction' && e.group.targetId === 'p') as Extract<CombatEvent, { type: 'statusChanged' }>[];
    expect(dr.some(e => e.reason === 'applied')).toBe(true);
    expect(dr.some(e => e.reason !== 'applied' && e.reason !== 'refreshed')).toBe(true);
  });

  it('the existing rule events the renderer ends visuals on are there: Blitzcrank and Vi shield layers, Malzahar shred', () => {
    for (const name of ['vi', 'blitzcrank']) {
      const run = advance(battle([hero(name), dummy()], { rngState: 42 }), 220);
      const own = run.events.filter(e => e.type === 'shieldLayerChanged' && e.layer.key.includes(JSON.stringify(`${name}-ability`))) as Extract<CombatEvent, { type: 'shieldLayerChanged' }>[];
      expect(own.some(e => e.reason === 'granted' && e.layer.targetId === 'p'), name).toBe(true);
      expect(own.some(e => e.reason !== 'granted' && e.reason !== 'absorbed' && e.reason !== 'decayed'), name).toBe(true);
    }
    const blitz = advance(battle([hero('blitzcrank'), dummy()], { rngState: 42 }), 220);
    const layers = blitz.events.filter(e => e.type === 'shieldLayerChanged') as Extract<CombatEvent, { type: 'shieldLayerChanged' }>[];
    expect(layers.some(e => e.reason === 'granted' && e.layer.targetId === 'p' && e.layer.key.includes('blitzcrank'))).toBe(true);
    expect(layers.some(e => e.reason !== 'granted' && e.reason !== 'absorbed' && e.reason !== 'decayed' && e.layer.key.includes('blitzcrank'))).toBe(true);
    const malz = advance(battle([hero('malzahar'), dummy()], { rngState: 42 }), 120);
    const shred = malz.events.filter(e => e.type === 'statusChanged' && e.group.kind === 'shred') as Extract<CombatEvent, { type: 'statusChanged' }>[];
    expect(shred.some(e => e.reason === 'applied')).toBe(true);
    expect(shred.some(e => e.reason === 'expired' && e.group.targetId === 'e')).toBe(true);
  });

  it('each listed cue plays its own life (no early stop beyond a fade-out tail), so the event is what ends it', () => {
    const cues = [...CUE_OVERRIDES.leblanc!, ...CUE_OVERRIDES.twitch!, ...CUE_OVERRIDES.drmundo!, ...CUE_OVERRIDES.vander!, ...CUE_OVERRIDES.blitzcrank!,
      ...CUE_OVERRIDES.malzahar!, ...warwickSkills.warwick!, ...CUE_OVERRIDES.vi!, ...CUE_OVERRIDES.viktor!,
      // 2026-11-16: shields on others (Mel's, Jayce's forge) end with the shielded ally's layer (abilityShieldEndedOnHolder).
      ...CUE_OVERRIDES['mel-shield']!, ...CUE_OVERRIDES['jayce-forge-front']!];
    const ruleLists = Object.entries(CUE_RULE_STOPS).flatMap(([k, v]): [string, readonly string[]][] =>
      Array.isArray(v.systems) ? [[k, v.systems as readonly string[]]] : Object.entries(v.systems as Record<string, readonly string[] | { systems: readonly string[] }>)
        .map(([a, l]) => [`${k} ${a}`, Array.isArray(l) ? l as readonly string[] : (l as { systems: readonly string[] }).systems]));
    // Dr. Mundo's heal end stops nothing: his systems end with his timed form (TIMED_FORM_STOPS), listed here instead.
    expect(CUE_END_STOPS['drmundo-heal']).toEqual([]);
    const endLists = Object.entries(CUE_END_STOPS).filter(([k]) => k !== 'drmundo-heal');
    // Layers held by SUSTAIN_CAPS keep their index cue (not an override): their cap, not their own life, bounds them.
    const held = (list: readonly string[]) => list.filter(s => !Object.hasOwn(SUSTAIN_CAPS, s));
    const lists: Record<string, readonly string[]> = { ...Object.fromEntries(endLists.map(([k, v]): [string, readonly string[]] => [k, held(v)]).filter(([, v]) => v.length)),
      ...Object.fromEntries(ruleLists.map(([k, v]): [string, readonly string[]] => [k, held(v)]).filter(([, v]) => v.length)),
      ...Object.fromEntries(Object.entries(TIMED_FORM_STOPS).map(([k, v]) => [`form ${k}`, v])) };
    for (const [effect, systems] of Object.entries(lists)) {
      expect(systems.length, effect).toBeGreaterThan(0);
      for (const system of systems) {
        const cue = cues.find(c => c.system === system);
        expect(cue, `${effect} ${system}`).toBeDefined();
        // Its own life: no early stop, or only the fade-out's last moments before the system's own end.
        if (cue!.stopAfter !== undefined) expect(cue!.fadeOut && cue!.duration - cue!.stopAfter <= 0.5, `${effect} ${system}`).toBe(true);
      }
    }
  });

  it('the renderer handles the end events before its animation-only gate (they move no unit, so the gate would drop them)', () => {
    const source = readFileSync(new URL('../src/rendering/three-mode/placeholder-renderer.ts', import.meta.url), 'utf8');
    const gate = source.indexOf('if (!ANIMATION_EVENTS.has(event.type)) continue;');
    expect(gate).toBeGreaterThan(0);
    for (const handler of ["event.type === 'abilityEffectEnded'", "event.type === 'bloodFrenzyChanged' && !event.active",
      "event.type === 'shieldLayerChanged' && event.reason !== 'granted'", "event.type === 'statusChanged' && event.kind === 'shred'"]) {
      const at = source.indexOf(handler);
      expect(at, handler).toBeGreaterThan(0);
      expect(at, handler).toBeLessThan(gate);
    }
  });
});

describe('A3: cue stops that came before an emitter first emission (2026-11-16)', () => {
  it('Mel shield and Jayce forge shield play their own life and end with the holder\'s layer', () => {
    const cue = (key: string, system: string) => CUE_OVERRIDES[key]!.find(c => c.system === system)!;
    // Was stopAfter 0.1 / 0.5, before some of their layers began. Durations are caps past each system's own end (fitted). Mel's
    // save stays as it is until the recording tool can trigger the Banished Mage ceremony.
    for (const [key, system, end] of [['mel-shield', '71e871c8', 4.2], ['jayce-forge-front', 'e8cd793f', 4.5]] as const) {
      expect(cue(key, system).stopAfter, system).toBeUndefined();
      expect(cue(key, system).duration, system).toBe(end);
    }
    expect(CUE_RULE_STOPS.abilityShieldEndedOnHolder.systems).toEqual({ 'mel-ability': ['71e871c8'], 'jayce-ability': ['e8cd793f'] });
    const source = readFileSync(new URL('../src/rendering/three-mode/placeholder-renderer.ts', import.meta.url), 'utf8');
    expect(source).toContain('CUE_RULE_STOPS.abilityShieldEndedOnHolder.systems');
    expect(source).toContain('ltk?.stopSystemsOn(event.targetId, systems)');
  });
});

describe('A3: the shields those stops listen for really carry their ability in the layer key (real combat)', () => {
  it('Mel\'s and Jayce\'s cast shields name mel-ability / jayce-ability, on the caster and on an ally', async () => {
    const { realUnits, runRealCombat } = await import('../dev/castcmp/real-combat');
    for (const [unit, form, ability] of [['mel', null, 'mel-ability'], ['jayce', 'front', 'jayce-ability']] as const) {
      const units = realUnits({ unit, star: 1, form, foe: 'amumu', dist: unit === 'mel' ? 4 : 1, nfoes: 2, foestar: 2, ally: 'amumu', allystar: 2,
        ...(unit === 'mel' ? { allyCell: { col: 3, row: 4 }, meCell: { col: 3, row: 6 } } : {}) } as any);
      const granted: { holder: string; key: string }[] = [];
      runRealCombat(units, 20, (_s, shown) => { for (const e of shown) if (e.type === 'shieldLayerChanged' && e.reason === 'granted') granted.push({ holder: e.targetId, key: e.key }); });
      const mine = granted.filter(g => g.key.includes(JSON.stringify(ability)));
      expect(mine.map(g => g.holder).sort(), unit).toEqual(['ally', 'me']);
      // The renderer's holder stop matches on exactly this text (placeholder-renderer.ts).
      expect(CUE_RULE_STOPS.abilityShieldEndedOnHolder.systems[ability].length, unit).toBe(1);
    }
  }, 60_000);
});
