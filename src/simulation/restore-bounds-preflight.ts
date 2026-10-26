import type { CombatState } from './combat-types';
import { MAX_COMBAT_TICKS } from './combat-types';
import type { GameState } from './game';
import type { StrategySnapshot } from './strategy-types';
import { canonicalSource } from './m8/identity';
import { compileRestoreMechanisms } from './m8/item-restore';
import { sampledGrowth, validateSampledStatTriggerCount } from './m8/sampled-stat-facts';

function authenticate(value: unknown, reason: string): asserts value {
  if (!value) throw new Error(`Invalid Match save: ${reason}`);
}
function check(value: unknown, field: string): asserts value {
  authenticate(value, `bounds preflight ${field}`);
}
function count(value: unknown, maximum: number, field: string): asserts value is number {
  check(Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= maximum, field);
}

/** Run after input-basis/strategy/roster validation, before any per-unit or
 * cross-unit restore consumer. Never compile declarations from an unauthenticated
 * unit: an earlier target may inspect a later holder's programs and counters.
 * This is an allocation preflight; occurrence authenticity remains the job of
 * the existing runtime/fact validators. No candidate count constructs a combat.
 */
export function validateRestoreBoundsPreflight(combat: CombatState, preparation: GameState, strategy: StrategySnapshot,
  same: (a: unknown, b: unknown) => boolean): void {
  count(combat.tick, MAX_COMBAT_TICKS, 'tick');
  // Complete this pass for ALL owners before compiling/consuming any of them.
  for (const unit of combat.units) {
    const origin = preparation.units.find(u => u.id === unit.id);
    const resolved = strategy.units.find(u => u.unitId === unit.id);
    authenticate(origin?.location.kind === 'board' && resolved, 'combat unit origin');
    authenticate(unit.team === origin.team && unit.definitionId === origin.definitionId && unit.starLevel === origin.starLevel && unit.effectiveStarLevel===resolved.effectiveStarLevel,
      'combat unit identity');
    authenticate(same(unit.ability, resolved.ability), 'resolved ability');
    if (resolved.ability.kind !== 's13') continue;
    authenticate(same(unit.mechanics, resolved.mechanics), 'resolved mechanics');
    authenticate(same(unit.itemPrograms ?? [], resolved.itemPrograms ?? []), 'resolved item programs');
    authenticate(same(unit.sources, resolved.sources) && same(unit.triggers, resolved.triggers), 'resolved effect source/trigger');
    // Conditional periodic declarations use the frozen starting row, never a
    // candidate current cell. Legacy missing startingCell is valid only at it.
    authenticate(same(unit.startingCell ?? unit.cell, origin.location.cell), 'neutral starting cell');
  }
  // Forge has one initial life and can revive at most once per Jayce cast,
  // hence at most once per tick. Use the authenticated projected roster, not
  // candidate alive flags, castCount, nextActionSeq or triggerCount.
  const roster = preparation.units.filter(u => u.location.kind === 'board');
  const deathBound = combat.tick === 0 ? 0 : roster.length
    + combat.tick * roster.filter(u => u.definitionId === 'g23-forge').length;
  for (const unit of combat.units) {
    if (unit.ability.kind !== 's13') continue;
    const compiled = compileRestoreMechanisms(unit, combat.combatId!);
    authenticate(same(unit.mechanismDefinitions, compiled), 'uncompiled mechanism definitions');
    authenticate(unit.mechanismState?.sampledAtTick === combat.tick, 'mechanism initialization/namespace');
    count(unit.runtime?.attackCount, combat.tick, 'attackCount');
    count(unit.runtime?.castCount, combat.tick, 'castCount');
    check(unit.runtime!.attackCount + unit.runtime!.castCount <= combat.tick, 'action counts');
    const ledger = unit.triggerLedger;
    authenticate(!ledger || Array.isArray(ledger.runtimes), 'item event runtime');
    for (const runtime of ledger?.runtimes ?? []) {
      const declaration = compiled.eventTriggers?.find(d => canonicalSource(d.source) === canonicalSource(runtime.source));
      authenticate(declaration, 'item event runtime');
      // Only counts expanded by sampledStatCandidates need a clock/death
      // bound here. All sampled stacking ledgers are subsequently replayed by
      // validateSampledStatTriggerFacts before any candidate enumeration.
      if (declaration.event === 'kill-or-assist' && declaration.effects.some(sampledGrowth))
        validateSampledStatTriggerCount(runtime.triggerCount, deathBound);
      else if (declaration.event === 'kill-or-assist') count(runtime.triggerCount, deathBound, 'triggerCount');
      if (declaration.maxPerCombat !== null) count(runtime.triggerCount, declaration.maxPerCombat, 'triggerCount');
      if (declaration.event === 'attack-completed' || declaration.event === 'cast-completed')
        count(runtime.triggerCount, combat.tick * roster.length * declaration.maxPerAction, 'triggerCount');
      for (const [id, value] of Object.entries(runtime.counters)) {
        const counter = declaration.counters.find(c => c.id === id);
        authenticate(counter, 'item event runtime');
        if (counter.cap !== null) count(value, counter.cap, 'counter');
      }
    }
    authenticate(Array.isArray(unit.mechanismState.periodicTasks), 'mechanism arrays');
    for (const task of unit.mechanismState.periodicTasks) {
      const declaration = compiled.periodicTasks.find(d => d.key === task.key);
      // Attached burn tasks have a rule-defined period of 20. Their full source
      // and program binding is checked by validateMechanisms after preflight.
      const period = declaration?.periodTicks ?? 20;
      const first = declaration?.nextPulseAtTick ?? 0;
      authenticate(task.periodTicks === period, declaration ? 'periodic program/source binding' : 'item burn program');
      count(task.pulseOrdinal, Math.max(0, Math.floor((combat.tick - first) / period) + 1), 'pulseOrdinal');
    }
  }
}
