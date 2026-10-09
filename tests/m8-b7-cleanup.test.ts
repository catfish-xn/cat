import { describe, expect, it, vi } from 'vitest';
import { createCombatWithEvents, stepCombat, type CombatState } from '../src/simulation/combat';
import { DEFAULT_BOARD } from '../src/simulation/board';
import type { GameState } from '../src/simulation/game';
import type { StrategySnapshot } from '../src/simulation/strategy-types';
import { getUnitStats } from '../src/simulation/unit-stats';
import { resolveAbility } from '../src/simulation/combat-abilities';
import { COMPILED_NEUTRAL_ENCOUNTERS } from '../src/simulation/neutral-encounter-compiler';
import { validateNeutralCombat } from '../src/simulation/neutral-restore';
import { createMatch, startMatchCombat } from '../src/simulation/match';
import { restoreMatch, serializeMatch } from '../src/simulation/serialization';
import { accepted } from './match-helpers';

// Isolated hypothetical trusted definitions, never changes the production catalog.
// Delayed execution additionally proves restore derives activation from the task.
const timing = vi.hoisted(() => ({ duration: 10, executeAtTick: 1 }));
vi.mock('../src/simulation/neutral-encounter-compiler', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/simulation/neutral-encounter-compiler')>();
  return { ...actual, get COMPILED_NEUTRAL_ENCOUNTERS() {
    return actual.COMPILED_NEUTRAL_ENCOUNTERS.map(e => ({ ...e, openingDefinitions: e.openingDefinitions.map(d => d.kind !== 'path-charge' ? d : {
      ...d, effects: d.effects.map(effect => effect.kind !== 'apply-status' ? effect : {
        ...effect, status: { ...effect.status, duration: { kind: 'ticks', ticks: timing.duration } },
      }),
    }) }));
  } };
});
vi.mock('../src/simulation/m8/opening', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/simulation/m8/opening')>();
  return { ...actual, planOpening: (...args: Parameters<typeof actual.planOpening>) => {
    const state = actual.planOpening(...args);
    return { ...state, plans: state.plans.map(p => ({ ...p, task: p.task ? {
      ...p.task, executeAtTick: timing.executeAtTick as 1,
    } : null })) };
  } };
});

function fixture() {
  const encounter = COMPILED_NEUTRAL_ENCOUNTERS.find(e => e.roundId === '6-7')!;
  const preparation: GameState = { board: DEFAULT_BOARD, benchSize: 9, units: [...encounter.deployment,
    { id: 'p', definitionId: 'garen', team: 'player', starLevel: 3, location: { kind: 'board', cell: { col: 3, row: 4 } } },
  ] };
  const strategy: StrategySnapshot = { traits: [], units: preparation.units.map(u => {
    const stats = getUnitStats(u.definitionId, u.starLevel);
    return { unitId: u.id, stats, ability: resolveAbility(stats.abilityId, u.starLevel), sources: [], triggers: [] };
  }) };
  const created = createCombatWithEvents(preparation, strategy, 'b7-cleanup-timing').state;
  const combat: CombatState = { ...created, units: created.units.map(u => ({ ...u, cooldownTicks: 1000, moveCooldownTicks: 1000 })) };
  return { preparation, strategy, combat };
}

describe('B7 cleanup independent restore boundaries', () => {
  it.each([[1, 7, 2, 9], [1, 17, 2, 19], [4, 7, 5, 12]])(
    'derives execution %i + duration %i as [%i, %i)', (execution, duration, start, end) => {
      timing.executeAtTick = execution; timing.duration = duration;
      const f = fixture(); let combat = f.combat;
      for (let tick = 1; tick <= end; tick++) {
        combat = stepCombat(combat).state;
        if (tick < execution) continue;
        expect(() => validateNeutralCombat(combat, f.preparation, f.strategy)).not.toThrow();
        const control = combat.units.find(u => u.id === 'p')!.mechanismState!.statuses
          .flatMap(g => g.contributions).find(c => c.application.kind === 'stun');
        if (tick < end) {
          expect(control).toMatchObject({ appliedAtTick: start, expiresAtTick: end });
          const forged = structuredClone(combat);
          const status = forged.units.find(u => u.id === 'p')!.mechanismState!.statuses.flatMap(g => g.contributions).find(c => c.application.kind === 'stun')!;
          Object.assign(status, { appliedAtTick: start + 1, expiresAtTick: end + 1 });
          expect(() => validateNeutralCombat(forged, f.preparation, f.strategy)).toThrow('status declaration');
        } else {
          expect(control).toBeUndefined();
          expect(combat.neutralReceipts!.controls[0]).toMatchObject({ removedAtTick: end, removedReason: 'expired' });
          const forged = structuredClone(combat);
          Object.assign(forged.neutralReceipts!.controls[0], { removedAtTick: end - 1 });
          expect(() => validateNeutralCombat(forged, f.preparation, f.strategy)).toThrow('control removal reason');
        }
      }
    });
  it('round-trips neutral 0/0 while rejecting hero zero mana and negative neutral mana', () => {
    timing.executeAtTick = 1; timing.duration = 10;
    const state = accepted(startMatchCombat(createMatch(42)));
    const saved = serializeMatch(state);
    expect(restoreMatch(saved)).toEqual(state);
    expect(state.combat!.units.filter(u => u.unitKind === 'neutral').every(u => u.maxMana === 0 && u.mana === 0)).toBe(true);
    for (const [kind, mana] of [['hero', 0], ['neutral', -1]] as const) {
      const forged = JSON.parse(saved);
      const unit = forged.combat.units.find((u: { unitKind?: string }) => (u.unitKind === 'neutral') === (kind === 'neutral'));
      unit.maxMana = mana; unit.mana = 0;
      expect(() => restoreMatch(forged)).toThrow();
    }
  });
});
