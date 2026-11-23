import { describe, expect, it } from 'vitest';
import type { DisplayCombatEvent } from '../src/presentation/combat-display';
import { G2_ABILITY_DATA } from '../src/simulation/content/g2-abilities';
import { createBatch1VfxEvents, LEBLANC_EMPOWERED_ATTACKS } from '../src/rendering/three-mode/vfx-ltk/batch1-events';
import { CUE_OVERRIDES } from '../src/rendering/three-mode/vfx-ltk/cue-overrides';

// LeBlanc's cast empowers her next attacks (combat-g2.ts planG2Attack): those attacks play her empowered missile
// (Fable 11-21). The display counts them from each cast as the rules do.
const attack = (attackerId: string, eventSeq: number): DisplayCombatEvent => ({ type: 'attack', attackerId, targetId: 'enemy', eventSeq, tick: eventSeq });
const cast = (sourceId: string, eventSeq: number): DisplayCombatEvent => ({ type: 'cast', sourceId, eventSeq, tick: eventSeq,
  actionSeq: eventSeq, completed: true, actualManaSpent: 50, refundedMana: 0, targetIds: ['enemy'], completionCell: { col: 0, row: 0 } });
const variants = (events: ReturnType<typeof createBatch1VfxEvents>, list: DisplayCombatEvent[]) =>
  events.batch(list).filter((_, i) => list[i]!.type === 'attack').map(plan => plan.variant);

describe('LeBlanc\'s empowered attacks', () => {
  it('the count mirrors the rules\' NumAttacks at every star', () => {
    const data = Object.values(G2_ABILITY_DATA).find(a => a.championId === 'leblanc')!;
    expect(data.variables.NumAttacks).toEqual([LEBLANC_EMPOWERED_ATTACKS, LEBLANC_EMPOWERED_ATTACKS, LEBLANC_EMPOWERED_ATTACKS]);
  });
  it('the attacks after a cast are empowered, as many as the rules count; before any cast and after them, plain', () => {
    const events = createBatch1VfxEvents(id => id.replace(/\d+$/, ''));
    const n = LEBLANC_EMPOWERED_ATTACKS;
    const list = [attack('leblanc1', 1), cast('leblanc1', 2), ...Array.from({ length: n + 1 }, (_, i) => attack('leblanc1', 3 + i))];
    expect(variants(events, list)).toEqual([undefined, ...Array(n).fill('empowered'), undefined]);
  });
  it('a new cast starts the count again; each LeBlanc counts her own', () => {
    const events = createBatch1VfxEvents(id => id.replace(/\d+$/, ''));
    const list = [cast('leblanc1', 1), attack('leblanc1', 2), cast('leblanc2', 3), cast('leblanc1', 4),
      ...Array.from({ length: LEBLANC_EMPOWERED_ATTACKS }, (_, i) => attack('leblanc1', 5 + i)), attack('leblanc2', 20), attack('leblanc1', 21)];
    expect(variants(events, list)).toEqual(['empowered', ...Array(LEBLANC_EMPOWERED_ATTACKS).fill('empowered'), 'empowered', undefined]);
  });
  it('an interrupted cast empowers nothing; a death or a combat end (clear) drops the count', () => {
    const events = createBatch1VfxEvents(id => id.replace(/\d+$/, ''));
    expect(variants(events, [{ ...cast('leblanc1', 1), completed: false } as DisplayCombatEvent, attack('leblanc1', 2)])).toEqual([undefined]);
    expect(variants(events, [cast('leblanc1', 3), { type: 'death', eventSeq: 4, tick: 4, unitId: 'leblanc1' } as DisplayCombatEvent, attack('leblanc1', 5)])).toEqual([undefined]);
    events.batch([cast('leblanc1', 6)]); events.clear();
    expect(variants(events, [attack('leblanc1', 7)])).toEqual([undefined]);
  });
  it('her empowered attack flies the empowered missile with the plain attack\'s timing, bones and hit', () => {
    const row = CUE_OVERRIDES.leblanc!;
    const plain = row.filter(c => c.action === 'attack' && !c.variant), empowered = row.filter(c => c.action === 'attack' && c.variant === 'empowered');
    expect(empowered.map(c => c.system)).toEqual(['0ea87983', '0f2af66b']);
    expect(empowered.map(({ system, variant, ...rest }) => rest)).toEqual(plain.map(({ system, variant, ...rest }) => rest));
    expect(empowered[1]!.system).toBe(plain[1]!.system);
  });
});
