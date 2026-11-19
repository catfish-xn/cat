import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { S13_ABILITY_DATA } from '../src/simulation/content/abilities';
import { createSustainStops } from '../src/rendering/three-mode/vfx-ltk/sustain-stops';
import { CAMILLE_KICK_TICKS, CUE_END_STOPS, CUE_OVERRIDES, CUE_RULE_STOPS, SUSTAIN_CAPS, SUSTAIN_RANKS, SUSTAIN_READMIT, SUSTAIN_REFRESH } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';
import { CAMILLE_KICK_TICKS as SIM_CAMILLE_KICK_TICKS } from '../src/simulation/combat-g2-2';

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
    // Draven's spinning axe, Amumu's passive and Kog'Maw's stacks last until death or the fight's end; Ekko's mark shows its
    // own time after each hit (SUSTAIN_REFRESH).
    const untilDeath = ['d86cc9bc', '56e6971e', '6889455c', '9f805f6e', '5af49b76'];
    for (const system of Object.keys(SUSTAIN_CAPS)) expect(ended.has(system) || untilDeath.includes(system), system).toBe(true);
    for (const seconds of Object.values(SUSTAIN_CAPS)) expect(seconds).toBeGreaterThan(0);
  });

  it('Camille\'s heal layer waits for her kick, the same ticks the simulation waits', () => {
    expect(CAMILLE_KICK_TICKS).toBe(SIM_CAMILLE_KICK_TICKS);
    expect(CUE_OVERRIDES.camille!.find(cue => cue.system === '174f1125')!.delay).toBe(CAMILLE_KICK_TICKS / 20);
  });
});

describe('fallback caps of held layers (Fable 11-19)', () => {
  // The rule's longest time for the state a layer shows, over every star, from the ability data.
  const longest = (ability: string, variable: string) => Math.max(...(S13_ABILITY_DATA[ability] as unknown as { variables: Record<string, number[]> }).variables[variable]!);
  it('a layer whose state has a time limit is capped at that limit plus 1 s, so the rule event always ends it first', () => {
    const limited: [string, string, string][] = [['8d9a4ccc', 'leona-ability', 'Duration'], ['afb2ec69', 'jayce-ranged-ability', 'ASDuration'],
      ['ea21ae27', 'garen-ability', 'ShieldDuration'], ['e22b48b0', 'loris-ability', 'Duration'], ['8682c9ee', 'vex-ability', 'DOTDuration'], ['eb9da1d5', 'vex-ability', 'DOTDuration']];
    for (const [system, ability, variable] of limited) expect(SUSTAIN_CAPS[system], system).toBeCloseTo(longest(ability, variable) + 1, 6);
    // Swain's form also grows with each takedown: its cap is our own, above the base time plus 1 s.
    expect(SUSTAIN_CAPS['796b6af2']).toBeGreaterThan(longest('swain-ability', 'Duration') + 1);
  });
  it('Ekko\'s mark refreshes per target for 2 s; Draven\'s axes and Kog\'Maw\'s stacks are decoration that comes back', () => {
    expect(SUSTAIN_CAPS['5af49b76']).toBe(2);
    const allFight = ['d86cc9bc', '6889455c', '9f805f6e'];
    expect([...SUSTAIN_REFRESH]).toEqual(['5af49b76', ...allFight]);
    expect(SUSTAIN_RANKS).toEqual(Object.fromEntries(allFight.map(system => [system, 'decorative'])));
    expect([...SUSTAIN_READMIT]).toEqual(allFight);
    // Held all fight long: never quietly gone after a short cap.
    for (const system of [...allFight, '56e6971e']) expect(SUSTAIN_CAPS[system]).toBeGreaterThanOrEqual(60);
  });
});
