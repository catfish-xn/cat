import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatUnit, type CombatState, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { CUE_END_STOPS, CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { battle, unit } from './combat-helpers';
import { readFileSync } from 'node:fs';

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
function advance(initial: CombatState, count: number) {
  let state = initial; const events: CombatEvent[] = [];
  for (let n = 0; n < count && state.status === 'running'; n++) { const step = stepCombat(state); state = step.state; events.push(...step.events); }
  return { state, events };
}
const ended = (events: readonly CombatEvent[]) => events.filter(e => e.type === 'abilityEffectEnded') as Extract<CombatEvent, { type: 'abilityEffectEnded' }>[];

describe('abilityEffectEnded: display-only end signals for timed ability effects', () => {
  it('LeBlanc: one event the tick her chain runs out, naming the chained units', () => {
    const r = advance(battle([hero('leblanc'), dummy(), dummy('e2', { cell: { col: 3, row: 3 } })], { rngState: 42 }), 140);
    const cast = r.events.find(e => e.type === 'cast')!;
    const chain = ended(r.events).filter(e => e.effect === 'leblanc-chain');
    expect(chain).toHaveLength(1);
    // The rule's ChainDuration is 5 s = 100 ticks after the cast.
    expect(chain[0]!.tick).toBe(cast.tick + 100);
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

  it('each listed cue plays its own life (no early stop beyond a fade-out tail), so the event is what ends it', () => {
    const cues = [...CUE_OVERRIDES.leblanc!, ...CUE_OVERRIDES.twitch!];
    for (const [effect, systems] of Object.entries(CUE_END_STOPS)) {
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
    for (const handler of ["event.type === 'abilityEffectEnded'"]) {
      const at = source.indexOf(handler);
      expect(at, handler).toBeGreaterThan(0);
      expect(at, handler).toBeLessThan(gate);
    }
  });
});
