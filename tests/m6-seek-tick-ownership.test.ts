import { expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/simulation/board';
import { copyCombatUnitForTick } from '../src/simulation/combat-static';
import { EMPTY_RUNTIME, type S13Unit } from '../src/simulation/combat-s13-state';
import type { AbilityContext } from '../src/simulation/combat-s13-abilities';
import { applyStatusContribution, effectiveStatuses, hasEffectiveStatus, removeStatusContributions, statusMagnitude } from '../src/simulation/m8/status';
import { refreshMechanismAuras } from '../src/simulation/m8/s13-mechanisms';
import { EMPTY_MECHANISMS } from '../src/simulation/m8/runtime-types';
import type { Effect, PeriodicTask, StatusApplication } from '../src/simulation/m8/contracts';
import { effectIdentity } from '../src/simulation/m8/identity';
import { unit, freeze } from './combat-helpers';
import { selector, source } from './fixtures/m8-contract-cases';

const status = (kind: StatusApplication['kind'], magnitudeBps: number, ticks: number): StatusApplication => ({
  kind, magnitudeBps, activation: 'immediate', duration: { kind: 'ticks', ticks },
  stackPolicy: { kind: 'strongest-category', category: kind, retainSuppressed: true },
  removable: true, polarity: 'harmful', damageFilter: null, onEnd: null,
});

it('shares only detached P2 opening facts, retaining the caller and every native byte', () => {
  const input = unit('p', 'player', 1, 4, { s13P2Opening: { selected: ['trifecta-ii'], shared: [] } });
  const before = JSON.stringify(input), first = copyCombatUnitForTick(input), second = copyCombatUnitForTick(first);
  expect(JSON.stringify(first)).toBe(before);
  expect(JSON.stringify(second)).toBe(before);
  expect(first.s13P2Opening).not.toBe(input.s13P2Opening);
  expect(second.s13P2Opening).toBe(first.s13P2Opening);
  expect(Object.isFrozen(input.s13P2Opening!.selected)).toBe(false);
  (input.s13P2Opening!.selected as string[]).push('calculated-enhancement');
  expect(second.s13P2Opening!.selected).toEqual(['trifecta-ii']);
  expect(Object.isFrozen(second.s13P2Opening!.selected)).toBe(true);
});

it('queries current status kinds and re-summarizes suppressed/expired contributions without skipping predicates', () => {
  let groups = applyStatusContribution([], effectIdentity('query', source('weak'), 'p'), status('sunder', 2000, 10), 0).groups;
  groups = applyStatusContribution(groups, effectIdentity('query', source('strong'), 'p'), status('sunder', 4000, 2), 0).groups;
  groups = applyStatusContribution(groups, effectIdentity('query', source('stun'), 'p'), { ...status('stun', 0, 2), activation: 'next-tick' }, 0).groups;
  freeze(groups);
  for (const tick of [0, 1, 2, 3, 10]) for (const kind of ['stun', 'sunder', 'untargetable'] as const) {
    const reference = effectiveStatuses(groups, tick).filter(g => g.kind === kind);
    expect(hasEffectiveStatus(groups, kind, tick)).toBe(reference.length > 0);
    expect(statusMagnitude(groups, kind, tick)).toBe(Math.max(0, ...reference.map(g => g.effectiveMagnitudeBps)));
  }
  const calls: string[] = [];
  const next = removeStatusContributions(groups, c => { calls.push(c.key); return false; }, 'expired', 2);
  expect(calls).toEqual(groups.flatMap(g => g.contributions.map(c => c.key)));
  expect(next.ended).toEqual([]);
  expect(next.groups.find(g => g.kind === 'sunder')!.effectiveMagnitudeBps).toBe(2000);
  expect(groups.find(g => g.kind === 'sunder')!.effectiveMagnitudeBps).toBe(4000);
});

it('invalidates an aura projection after effects and removals, including within one refresh', () => {
  const makeUnit = (id: string, team: S13Unit['team']): S13Unit => ({ ...unit(id, team, 3, team === 'player' ? 4 : 3),
    runtime: { ...EMPTY_RUNTIME }, tasks: [], statuses: [], shieldLayers: [],
    mechanismState: { ...EMPTY_MECHANISMS, combatId: 'aura-query', sampledAtTick: 1 },
    mechanismDefinitions: { periodicTasks: [], survivalTriggers: [], vamp: [] },
  });
  const hide = makeUnit('hide', 'player'), mana = makeUnit('mana', 'player'), target = makeUnit('target', 'enemy');
  const aura = (holder: S13Unit, effect: Effect): PeriodicTask => ({ ...effectIdentity('aura-query', source(holder.id, holder.id, holder.id), holder.id),
    nextPulseAtTick: 1, periodTicks: 1, endsAtTick: null, pulseOrdinal: 0, pulseLimit: null, remainders: [],
    finalPulse: 'none', onSourceDeath: 'cancel', onTargetDeath: 'cancel',
    program: { definitionId: holder.id, selector: selector({ relation: 'enemy', sample: 'each-tick' }), targetSnapshot: 'once-per-pulse', effects: [effect] },
  });
  hide.mechanismDefinitions = { ...hide.mechanismDefinitions!, periodicTasks: [aura(hide, { kind: 'apply-status', status: status('untargetable', 0, 10) })] };
  mana.mechanismDefinitions = { ...mana.mechanismDefinitions!, periodicTasks: [aura(mana, { kind: 'grant-mana', amount: 7, reason: 'periodic', bypassLock: 'none' })] };
  // First project all units via a source which cannot affect any enemy. The
  // subsequent hiding effect must invalidate that earlier projection too.
  const probe = makeUnit('probe', 'player');
  probe.mechanismDefinitions = { ...probe.mechanismDefinitions!, periodicTasks: [{ ...aura(probe, { kind: 'grant-mana', amount: 0, reason: 'periodic', bypassLock: 'none' }),
    program: { ...aura(probe, { kind: 'grant-mana', amount: 0, reason: 'periodic', bypassLock: 'none' }).program, selector: selector({ relation: 'enemy', sample: 'each-tick', maxTargets: 0 }) } }] };
  const ctx: AbilityContext = { board: DEFAULT_BOARD, combatId: 'aura-query', tick: 1, units: [probe, hide, mana, target], events: [], packets: [], heals: [], manaRequests: [], draw: () => { throw Error('Unexpected RNG'); } };
  refreshMechanismAuras(ctx);
  expect(hasEffectiveStatus(target.mechanismState!.statuses, 'untargetable', 1)).toBe(true);
  expect(ctx.manaRequests).toEqual([]);
  hide.hp = 0; hide.alive = false;
  refreshMechanismAuras(ctx);
  expect(hasEffectiveStatus(target.mechanismState!.statuses, 'untargetable', 1)).toBe(false);
  expect(ctx.manaRequests).toEqual([expect.objectContaining({ targetId: target.id, amount: 7 })]);
});
