import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { createBatch1VfxEvents } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { catchUpBatch, leadTicksFor, realUnits, runRealCombat } from '../dev/castcmp/real-combat';

// castcmp real windows that open mid-combat: the renderer must still count what came before (Zeri's every third attack,
// Twitch's shots after her cast), or the recorded attack is drawn plain.
const record = (units: any[], ticks: number, castNumber = 1, anchor?: any) => {
  const events: DisplayCombatEvent[][] = [];
  const run = runRealCombat(units, ticks, (_state, shown) => { events.push(shown as DisplayCombatEvent[]); }, castNumber, anchor);
  return { events, run, defs: Object.fromEntries(units.map(u => [u.id, u.definitionId as string])) };
};
/** The variant the renderer's planner gives `me`'s attack on `tick`, replaying from `from` with or without the catch-up. */
const attackVariant = (events: DisplayCombatEvent[][], defs: Record<string, string>, from: number, tick: number, catchUp: boolean) => {
  const planner = createBatch1VfxEvents(id => defs[id]);
  if (catchUp) planner.batch(catchUpBatch(events, from) as DisplayCombatEvent[]);
  let variant: string | undefined | null = null;
  for (let at = from + 1; at <= tick; at++) for (const plan of planner.batch(events[at]!))
    if (at === tick && plan.event.type === 'attack' && (plan.event as { attackerId: string }).attackerId === 'me') variant = plan.variant;
  return variant;
};

describe('castcmp catch-up before a real window', () => {
  it('hands over every event before the window, then a marker that keeps all of them out of the effect ticks', () => {
    expect(catchUpBatch([[{ tick: 0 }], [{ tick: 1 }]], 0)).toEqual([]);
    const batch = catchUpBatch([[{ tick: 0 }], [], [{ tick: 2 }, { tick: 2 }], [{ tick: 3 }]], 3) as { tick: number; type?: string }[];
    expect(batch.map(e => e.tick)).toEqual([0, 2, 2, 4]);
    expect(batch.at(-1)!.type).toBe('effectTriggered');
    // The renderer starts effects only for a batch's last two ticks (EFFECT_TICKS): the marker's tick puts every real event below them.
    expect(batch.slice(0, -1).every(e => e.tick <= batch.at(-1)!.tick - 2)).toBe(true);
  });

  it('Zeri: her third attack, anchored mid-combat, is empowered only with the catch-up', () => {
    const units = realUnits({ unit: 'zeri', star: 1, form: null, foe: 'amumu', dist: 4, nfoes: 2, foestar: 2, ally: 'amumu', allystar: 2, allyCell: { row: 3, col: 2 } });
    const { events, run, defs } = record(units, 20, 3, { kind: 'attack-hit' });
    const from = run.castIndex - leadTicksFor(run.castIndex, { anchor: { kind: 'attack-hit' } });
    expect(from).toBeGreaterThan(0);
    expect(attackVariant(events, defs, from, run.castIndex, false)).toBeUndefined();
    expect(attackVariant(events, defs, from, run.castIndex, true)).toBe('empowered');
  });

  it('Twitch: an attack after her cast, in a window that opens after the cast, is empowered only with the catch-up', () => {
    const units = realUnits({ unit: 'twitch', star: 1, form: null, foe: 'amumu', dist: 4, nfoes: 2, foestar: 2, ally: 'amumu', allystar: 2, allyCell: { row: 3, col: 2 } });
    const { events, run, defs } = record(units, 120);
    expect(run.castIndex).toBeGreaterThan(0);
    const attack = events.findIndex((batch, at) => at > run.castIndex + 5 && batch.some(e => e.type === 'attack' && (e as { attackerId: string }).attackerId === 'me'));
    expect(attack).toBeGreaterThan(0);
    const from = attack - 3;
    expect(from).toBeGreaterThan(run.castIndex);
    expect(attackVariant(events, defs, from, attack, false)).toBeUndefined();
    expect(attackVariant(events, defs, from, attack, true)).toBe('empowered');
  });
});
