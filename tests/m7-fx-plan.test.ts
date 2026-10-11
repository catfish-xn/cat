/** Audit F04/F06: one pure event→feedback mapping for live and replay; numbers stay with the DOM renderer. */
import { beforeAll, describe, expect, it } from 'vitest';
import * as api from '../src/simulation/match';
import { run } from '../scripts/generate-m5-route.cjs';
import { planFx } from '../src/presentation/fx-plan';
import type { CombatState, LedgerCombatEvent } from '../src/simulation/combat-types';

// B9 (D2-A): M7 battle records are never replayed, so this mapping is exercised on the replay2 ledger of the
// fixed cannon seed-42 route instead of the archived M7 export; the asserted properties are unchanged.
let battles: { initial: CombatState; events: LedgerCombatEvent[] }[] = [];
beforeAll(async () => {
  const route = await run(api, { build: 'cannon', seed: 42, retainStates: true }) as unknown as { rounds: { before: api.MatchState; events: readonly { domain?: string }[] }[] };
  battles = route.rounds.map(round => {
    const start = api.startMatchCombat(round.before); if (!start.ok) throw Error(start.reason);
    return { initial: start.state.combat!, events: round.events.filter(event => event.domain === 'combat') as LedgerCombatEvent[] };
  });
}, 120000);

describe('M7 fx plan', () => {
  it('maps every attack and cast exactly once and is deterministic', () => {
    for (const record of battles.slice(0, 8)) {
      const specs = planFx(record.events, record.initial, false);
      expect(planFx(record.events, record.initial, false)).toEqual(specs);
      const attacks = record.events.filter(event => event.type === 'attack' && record.initial.units.some(u => u.id === event.attackerId) && record.initial.units.some(u => u.id === event.targetId)).length;
      expect(specs.filter(spec => spec.kind === 'slash' || spec.kind === 'bolt')).toHaveLength(attacks);
      expect(specs.filter(spec => spec.kind === 'cast')).toHaveLength(record.events.filter(event => event.type === 'cast').length);
    }
  });
  it('never renders heal/damage/shield amounts as canvas text', () => {
    const heals = battles.flatMap(record => record.events.filter(event => event.type === 'heal' && event.outcome.actual > 0).map(event => ({ record, event })));
    expect(heals.length).toBeGreaterThan(0);
    for (const record of battles) for (const spec of planFx(record.events, record.initial, false)) {
      if (spec.kind === 'label' || spec.kind === 'cast') expect(spec.kind === 'label' ? spec.text : spec.label).not.toMatch(/^[+−-]?\d+$/);
    }
    const { record, event } = heals[0];
    const specs = planFx([event], record.initial, false);
    expect(specs.map(spec => spec.kind)).toEqual(['ring']);
  });
  it('reduced motion only changes how projectiles travel', () => {
    const record = battles.find(r => r.events.some(event => event.type === 'attack'))!;
    const normal = planFx(record.events, record.initial, false), reduced = planFx(record.events, record.initial, true);
    expect(reduced.map(spec => spec.kind)).toEqual(normal.map(spec => spec.kind));
    for (const spec of reduced) if (spec.kind === 'bolt') expect(spec.travel).toBe(false);
  });
});
