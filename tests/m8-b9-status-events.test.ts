/** B9 replay2 status ledger (PR #29 review point A): an end event lists exactly the ended contributions, and the
 * authoritative group stays in Combat state. Same strong/weak burn setup as m8-b3-periodic-integration. */
import { describe, expect, it } from 'vitest';
import { stepCombat, type CombatState, type CombatUnit, type CombatEvent } from '../src/simulation/combat';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { EMPTY_RUNTIME } from '../src/simulation/combat-s13-state';
import { EMPTY_MECHANISMS } from '../src/simulation/m8/runtime-types';
import { applyStatusContribution, effectiveStatuses } from '../src/simulation/m8/status';
import { effectIdentity } from '../src/simulation/m8/identity';
import type { StatusApplication } from '../src/simulation/m8/contracts';
import { source } from './fixtures/m8-contract-cases';
import { battle, unit } from './combat-helpers';
import { statusEvents } from './helpers/replay2-views';

function dummy(id: string, team: 'player' | 'enemy', col: number): CombatUnit {
  return unit(id, team, col, 3, { definitionId: 'neutral-stage-2', ability: resolveAbility('neutral-attack', 1), hp: 1000, maxHp: 1000, armor: 0, magicResist: 0,
    mana: 0, maxMana: 1, cooldownTicks: 1000, moveCooldownTicks: 1000, attackRange: 6, attackDamage: 0, statuses: [], shieldLayers: [], tasks: [], runtime: { ...EMPTY_RUNTIME } });
}
const burn = (bps: number, ticks: number): StatusApplication => ({ kind: 'burn', magnitudeBps: bps, activation: 'immediate', duration: { kind: 'ticks', ticks },
  stackPolicy: { kind: 'strongest-category', category: 'burn', retainSuppressed: true }, polarity: 'harmful', removable: true, damageFilter: null, onEnd: null });

describe('B9 partial status end', () => {
  it('the strong burn ending publishes only its contribution; the weak one stays effective in state until its own end', () => {
    const weak = effectIdentity('standalone', source('unknown-weak', 'w', 'p'), 'e'), strong = effectIdentity('standalone', source('unknown-strong', 's', 'p'), 'e');
    let groups = applyStatusContribution([], weak, burn(100, 80), 0).groups;
    groups = applyStatusContribution(groups, strong, burn(200, 40), 0).groups;
    const keyOf = (instanceId: string) => groups[0].contributions.find(c => c.source.instanceId === instanceId)!.key;
    const [weakKey, strongKey] = [keyOf('w'), keyOf('s')];
    let state: CombatState = battle([dummy('p', 'player', 1), { ...dummy('e', 'enemy', 2), mechanismState: { ...EMPTY_MECHANISMS, statuses: groups } }]);
    const events: CombatEvent[] = [];
    let atStrongEnd: CombatState | null = null;
    while (state.tick < 80 && state.status === 'running') {
      const next = stepCombat(state); state = next.state; events.push(...next.events);
      if (statusEvents(next.events).some(e => e.reason === 'expired' && e.keys.includes(strongKey))) atStrongEnd = state;
    }
    const ends = statusEvents(events).filter(e => e.reason !== 'applied' && e.reason !== 'refreshed');
    // One end per contribution, each listing exactly the contribution that ended.
    expect(ends.map(e => [e.reason, e.unitId, e.kind, e.keys])).toEqual([['expired', 'e', 'burn', [strongKey]], ['expired', 'e', 'burn', [weakKey]]]);
    // When the strong one ends, the authoritative state still has the weak one, now effective (not cleared by the event).
    const current = atStrongEnd!.units.find(u => u.id === 'e')!.mechanismState!.statuses;
    const effective = effectiveStatuses(current, atStrongEnd!.tick).filter(g => g.targetId === 'e' && g.kind === 'burn');
    expect(effective).toHaveLength(1);
    expect(effective[0].effectiveSourceKey).toBe(weakKey);
    expect(effective[0].contributions.map(c => c.key)).toEqual([weakKey]);
  });
});

import { wearing, enemy, run } from './fixtures/m8-b4-items';
import { combatEventText } from '../src/rendering/combat-feedback';
describe('N2-P2-4 status events name the contribution they changed', () => {
  it('two Last Whispers: the tick-16 refresh of i0 to 76 is reported as i0/76, never the other instance i1/61', () => {
    const r = run(wearing(['last-whisper', 'last-whisper']), 20, [enemy('e', 1, 3, { armor: 100 })]);
    const sunder = r.events.filter(e => e.type === 'statusChanged' && e.group.kind === 'sunder') as Extract<CombatEvent, { type: 'statusChanged' }>[];
    const view = (e: typeof sunder[number]) => [e.tick, e.reason, e.group.contributions.map(c => [c.source.instanceId, c.appliedAtTick, c.expiresAtTick])];
    expect(sunder.map(view)).toEqual([
      [1, 'applied', [['i0', 1, 61]]], [1, 'applied', [['i1', 1, 61]]],
      [16, 'refreshed', [['i0', 1, 76]]], [16, 'refreshed', [['i1', 1, 76]]],
    ]);
    const text = combatEventText(sunder[2] as never, id => id ?? '无')!;
    expect(text).toContain('至第 76 刻');
    expect(text).toContain('刷新');
    // The event's effective summary is the authoritative post-change group; current state still holds both instances.
    expect(sunder[2].group.effectiveSourceKey).not.toBeNull();
    const current = r.state.units.find(u => u.id === 'e')!.mechanismState!.statuses.find(g => g.kind === 'sunder')!;
    expect(current.contributions.map(c => c.source.instanceId).sort()).toEqual(['i0', 'i1']);
  });
});
