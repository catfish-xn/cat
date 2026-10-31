/** Audit F04/F06: one pure event→feedback mapping for live and replay; numbers stay with the DOM renderer. */
import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as api from '../src/simulation/match';
import { stepCombat } from '../src/simulation/combat';
import { toLedgerEvents } from '../src/simulation/combat-ledger';
import { planFx } from '../src/presentation/fx-plan';
import type { CombatState, LedgerCombatEvent } from '../src/simulation/combat-types';

// Reuse the signed v25 cannon seed-42 preparation states; run every battle with the current engine.
// The visual mapping needs all combat events, not another expensive economic-route acquisition/hash pass.
let battles: { initial: CombatState; events: LedgerCombatEvent[] }[] = [];
beforeAll(async () => {
  const { states } = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/v26-neutrals-1424-recorded-states/cannon.json.gz', import.meta.url))).toString()) as { states: api.MatchState[] };
  for (const before of states.filter(state => state.phase === 'preparation')) {
    const start = api.startMatchCombat(before); if (!start.ok) throw Error(start.reason);
    const initial = start.state.combat!, events = start.events.filter(event => 'domain' in event && event.domain === 'combat') as LedgerCombatEvent[];
    let combat: CombatState = initial;
    while (combat.status === 'running') { const step = stepCombat(combat); events.push(...toLedgerEvents(step.events)); combat = step.state; }
    battles.push({ initial, events });
    await new Promise(resolve => setTimeout(resolve, 0));
  }
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
      if (spec.kind === 'label') expect(spec.text).not.toMatch(/^[+−-]?\d+$/);
      if (spec.kind === 'cast') { expect(spec).not.toHaveProperty('label'); expect(spec).not.toHaveProperty('text'); }
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
