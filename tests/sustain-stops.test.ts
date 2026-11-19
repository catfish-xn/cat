import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createSustainStops } from '../src/rendering/three-mode/vfx-ltk/sustain-stops';
import { CAMILLE_KICK_TICKS, CUE_END_STOPS, CUE_OVERRIDES, CUE_RULE_STOPS, SUSTAIN_CAPS } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { CAMILLE_KICK_TICKS as SIM_CAMILLE_KICK_TICKS } from '../src/simulation/combat-g2-2';
import { CAST_WINDUP_TICKS as SIM_CAST_WINDUP_TICKS } from '../src/simulation/cast-windup';

const status = (targetId: string, kind: string, reason: string, tick = 10) =>
  ({ type: 'statusChanged', tick, eventSeq: tick, targetId, kind, effectiveMagnitudeBps: 0, reason }) as unknown as DisplayCombatEvent;
const hit = (sourceId: string, targetId: string, tick: number, delivery = 'ability-direct') =>
  ({ type: 'packetDamage', tick, eventSeq: tick, sourceId, targetId, sourceKind: 'ability', delivery }) as unknown as DisplayCombatEvent;
const DEFS: Record<string, string> = { leona: 'leona', jayce: 'jayce', ally: 'garen', vex: 'vex', foe: 'amumu' };

describe('persistent layers ended by rule events (sustain-stops.ts)', () => {
  it('Leona\'s W layer ends only with her own damage reduction ending, not when it is applied or refreshed', () => {
    const stops = createSustainStops(id => DEFS[id]);
    expect(stops.next(status('leona', 'damage-reduction', 'applied'))).toEqual([]);
    expect(stops.next(status('leona', 'damage-reduction', 'refreshed'))).toEqual([]);
    // Another kind ending on her, or the same kind ending on someone else, leaves it.
    expect(stops.next(status('leona', 'stun', 'expired'))).toEqual([]);
    expect(stops.next(status('ally', 'damage-reduction', 'expired'))).toEqual([]);
    expect(stops.next(status('leona', 'damage-reduction', 'expired'))).toEqual([{ by: 'source', id: 'leona', systems: ['8d9a4ccc'] }]);
    expect(stops.next(status('leona', 'damage-reduction', 'dispelled'))).toEqual([{ by: 'source', id: 'leona', systems: ['8d9a4ccc'] }]);
  });

  it('Jayce\'s hexgate attack speed ends on the ally whose buff ran out, whoever cast it', () => {
    const stops = createSustainStops(id => DEFS[id]);
    expect(stops.next(status('ally', 'stat-buff', 'applied'))).toEqual([]);
    expect(stops.next(status('ally', 'stat-buff', 'expired'))).toEqual([{ by: 'target', id: 'ally', systems: ['afb2ec69'] }]);
  });

  it('Vex\'s area waits for her second direct hit on that target, and a death forgets the first', () => {
    const stops = createSustainStops(id => DEFS[id]);
    expect(stops.next(hit('vex', 'foe', 10))).toEqual([]);
    // Another packet on the same tick is still the first strike; a damage-over-time packet is not her second hit.
    expect(stops.next(hit('vex', 'foe', 10))).toEqual([]);
    expect(stops.next(hit('vex', 'foe', 20, 'dot'))).toEqual([]);
    expect(stops.next(hit('vex', 'foe', 30))).toEqual([{ by: 'target', id: 'foe', systems: CUE_RULE_STOPS.vexSecondHit.systems }]);
    expect(stops.next(hit('vex', 'foe', 40))).toEqual([]);
    stops.next({ type: 'death', tick: 41, eventSeq: 41, unitId: 'foe' } as unknown as DisplayCombatEvent);
    expect(stops.next(hit('vex', 'foe', 50))).toEqual([]);
    // Someone else's hits never count.
    expect(createSustainStops(id => DEFS[id]).next(hit('ally', 'foe', 10))).toEqual([]);
  });

  it('a cleared combat starts with no first hit waiting', () => {
    const stops = createSustainStops(id => DEFS[id]);
    stops.next(hit('vex', 'foe', 10)); stops.clear();
    expect(stops.next(hit('vex', 'foe', 30))).toEqual([]);
  });

  it('every held layer has its end: a rule stop, an ability end, or (the ones that last the whole fight) a death', () => {
    const ended = new Set([...Object.values(CUE_END_STOPS).flat(), ...Object.values(CUE_RULE_STOPS).flatMap(rule => {
      const systems = rule.systems as unknown;
      if (Array.isArray(systems)) return systems as string[];
      return Object.values(systems as Record<string, unknown>).flatMap(v => Array.isArray(v) ? v as string[] : (v as { systems: string[] }).systems);
    })]);
    // Draven's spinning axe, Amumu's passive, Kog'Maw's stacks and Ekko's mark on the foe last until death or the fight's end.
    const untilDeath = ['d86cc9bc', '56e6971e', '6889455c', '9f805f6e', '5af49b76'];
    for (const system of Object.keys(SUSTAIN_CAPS)) expect(ended.has(system) || untilDeath.includes(system), system).toBe(true);
    for (const seconds of Object.values(SUSTAIN_CAPS)) expect(seconds).toBeGreaterThan(0);
  });

  it('Camille\'s heal layer waits for her kick, the same ticks the simulation waits', () => {
    expect(CAMILLE_KICK_TICKS).toBe(SIM_CAMILLE_KICK_TICKS);
    expect(CUE_OVERRIDES.camille!.find(cue => cue.system === '174f1125')!.delay).toBe(CAMILLE_KICK_TICKS / 20);
  });
});

describe('skill bodies that never yield their slot (Fable 11-19)', () => {
  it('Mordekaiser\'s aura and LeBlanc\'s channel are played at the critical rank', async () => {
    const { effectImportance } = await import('../src/rendering/three-mode/effect-budget');
    for (const [champion, system] of [['mordekaiser', '938c104f'], ['leblanc', 'acd84091']] as const) {
      const cue = CUE_OVERRIDES[champion]!.find(c => c.system === system)!;
      expect(cue.rank).toBe('critical');
      expect(effectImportance(cue)).toBe('critical');
    }
    // Mordekaiser's aura starts with his slam's damage, which the rules deal at the cast tick (no wind-up for him).
    expect(CUE_OVERRIDES.mordekaiser!.find(c => c.system === '938c104f')!.delay).toBe(0);
    expect(Object.hasOwn(SIM_CAST_WINDUP_TICKS, 'mordekaiser')).toBe(false);
  });
});
