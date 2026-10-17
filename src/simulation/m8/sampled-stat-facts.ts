import type { CombatState } from '../combat';
import { createRestoreCombatReplay } from '../restore-combat-replay';
import type { CombatInputBasis } from '../combat-input';
import type { StrategySnapshot } from '../strategy-types';
import type { Effect } from './contracts';
import { canonicalSource } from './identity';
import { EMPTY_TRIGGER_LEDGER } from './triggers';

const sampledGrowth = (e: Effect) => e.kind === 'modify-stat' && (e.modifier.stat === 'abilityPower' || e.modifier.stat === 'attackDamage')
  && e.modifier.value.kind === 'constant' && e.stackPolicy.kind === 'add-stacks';
function check(value: unknown, label: string): asserts value {
  if (!value) throw new Error(`Invalid Match save: sampled stat trigger ${label}`);
}

/** The caller has validated the immutable input basis and strategy. Reconstruct
 * evidence in an isolated combat, never from candidate counters/AP/HP or RNG.
 * No reconstructed state, effects or events are committed to the restored match. */
export function validateSampledStatTriggerFacts(combat: CombatState, basis: CombatInputBasis, strategy: StrategySnapshot,
  same: (a: unknown, b: unknown) => boolean, replay = createRestoreCombatReplay(basis, strategy, combat.tick)): void {
  if (!strategy.units.some(u => u.itemPrograms?.some(p => p.program.triggers?.some(t => t.effects.some(sampledGrowth))))) return;
  const opening = replay.opening();
  const holders = opening.units.filter(u => u.mechanismDefinitions?.eventTriggers?.some(t => t.effects.some(sampledGrowth)));
  // In this content, only Forge can revive, once per Jayce cast, at most once
  // per tick. Other units have one life. This deliberately overestimates deaths
  // on both teams; it never truncates a reachable count, including Forge kills.
  const deathBound = opening.units.length + combat.tick * opening.units.filter(u => u.definitionId === 'g23-forge').length;
  for (const owner of holders) {
    const candidate = combat.units.find(u => u.id === owner.id)!;
    const ledger = candidate.triggerLedger ?? EMPTY_TRIGGER_LEDGER;
    check(Array.isArray(ledger.runtimes), 'ledger');
    for (const d of owner.mechanismDefinitions!.eventTriggers!.filter(t => t.effects.some(sampledGrowth))) {
      for (const r of ledger.runtimes) {
        check(r && r.source, 'runtime');
        if (canonicalSource(r.source) !== canonicalSource(d.source)) continue;
        check(Number.isSafeInteger(r.triggerCount) && r.triggerCount >= 0, 'count');
        if (d.event === 'kill-or-assist') check(r.triggerCount <= (combat.tick === 0 ? 0 : deathBound), 'count bound');
      }
    }
  }
  // tick was validated against MAX_COMBAT_TICKS before entering this function.
  // The work bound depends on that clock and trusted content, never triggerCount.
  const expected = replay.atSaveTick();
  check(expected.tick === combat.tick, 'fact tick');
  for (const owner of holders) {
    const candidate = combat.units.find(u => u.id === owner.id)!;
    const proven = expected.units.find(u => u.id === owner.id)!;
    // Full keys bind owner, equipped instance, effect block, trigger kind,
    // actor/root action and processed event sequence, including absent receipts.
    check(same(candidate.triggerLedger ?? EMPTY_TRIGGER_LEDGER, proven.triggerLedger ?? EMPTY_TRIGGER_LEDGER), 'facts');
  }
}
