import { performance } from 'node:perf_hooks';
import { validateArtifactCombatFixture } from './artifact-combat-validation';
import { abilityPowerCandidates, attackDamageCandidates } from '../../src/simulation/m8/item-restore';
import { itemMatch } from './m8-b4-match';
import { BRACER, stackedBracerSave } from './explorer-bracer-public';

const scenario = process.argv[2];
if (scenario === 'huge-count') {
  const state = structuredClone(stackedBracerSave()), unit = state.combat!.units.find(u => u.definitionId === 'lux')!;
  const receipt = unit.triggerLedger!.runtimes.find(r => r.source.definitionId === BRACER)!;
  Object.assign(receipt, { triggerCount: 5_000_000 });
  Object.assign(unit.runtime!, { abilityPowerFlat: 100_000_000 });
  const started = performance.now();
  let outcome = 'accepted', reason = '';
  try { validateArtifactCombatFixture(JSON.stringify(state)); } catch (error) { outcome = 'rejected'; reason = String(error); }
  console.log(JSON.stringify({ scenario, outcome, reason, elapsedMs: performance.now() - started }));
} else if (scenario === 'dedup-titan') {
  const state = itemMatch('titans-resolve'), unit = state.combat!.units.find(u => u.team === 'player')!;
  const first = unit.itemPrograms![0];
  // Candidate arithmetic stress, not a whole Match save: twelve distinct copies
  // of the real 25-stack declaration have only 301 reachable sums, not 26^12.
  const itemPrograms = Array.from({ length: 12 }, (_, i) => ({ ...first, source: { ...first.source, instanceId: `titan-${i}` } }));
  const stacked = { ...unit, itemPrograms }, started = performance.now();
  const ap = abilityPowerCandidates(stacked, 0, state.combat!.combatId!), ad = attackDamageCandidates(stacked, 0, state.combat!.combatId!);
  console.log(JSON.stringify({ scenario, outcome: 'enumerated', apCount: ap.size, apMin: Math.min(...ap), apMax: Math.max(...ap),
    adCount: ad.size, elapsedMs: performance.now() - started }));
} else throw new Error(`Unknown bracer stress scenario: ${scenario}`);
