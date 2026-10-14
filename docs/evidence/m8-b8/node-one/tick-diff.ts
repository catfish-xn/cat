// Differential check: baseline (c0109ac) vs candidate advanceCombatTick/stepMatch on identical inputs.
import * as base from '/tmp/claude-0/base/src/simulation/match';
import * as cand from '/home/user/cat/src/simulation/match';
import { canonicalContent as baseCanon } from '/tmp/claude-0/base/src/simulation/content';
import { canonicalContent as candCanon } from '/home/user/cat/src/simulation/content';
import { publicEquipmentPreparation, finishPublicEquipmentBattle, resolvePublicEquipmentChoices } from '/tmp/claude-0/base/tests/fixtures/b8-public-equipment';
let ticks = 0, battles = 0, units = 0;
function reachable(value: unknown, into: Set<object>) {
  if (typeof value !== 'object' || value === null || into.has(value)) return;
  into.add(value); for (const v of Object.values(value)) reachable(v, into);
}
const SHARED = new Set(['mechanismDefinitions', 'mechanismState', 'triggerLedger']);
function checkTick(state: any) {
  const a = base.stepMatch(state), b = cand.stepMatch(state);
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`Mismatch at ${state.roundDefinitionId} tick ${state.combat?.tick}`);
  if (baseCanon(a.state) !== candCanon(b.state)) throw new Error('canonical mismatch');
  // Detachment: every non-shared object in candidate output units is fresh, as structuredClone made it.
  const input = new Set<object>(); reachable(state, input);
  for (const unit of b.state.combat?.units ?? []) {
    units++;
    for (const [key, value] of Object.entries(unit)) {
      if (SHARED.has(key) && value) continue;
      if (key === 'startingCell') continue; // original also reuses unit.startingCell by reference
      const seen = new Set<object>(); reachable(value, seen);
      for (const o of seen) if (input.has(o)) {
        // Only acceptable if baseline shares the same object at the same path too.
        const baseUnit = a.state.combat!.units.find((u: any) => u.id === unit.id) as any;
        const bs = new Set<object>(); reachable(baseUnit[key], bs);
        if (!bs.has(o)) throw new Error(`Candidate aliases input at ${unit.id}.${key}`);
      }
    }
  }
  ticks++;
  return b;
}
function battle(input: any) {
  let state = (base.startMatchCombat(input) as any).state; battles++;
  for (let t = 0; t < 1201 && state.phase === 'combat'; t++) state = checkTick(state).state;
  return state;
}
const seeds = Array.from({ length: Number(process.argv[2] ?? 12) }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0);
for (const seed of seeds) {
  // Real public opening plus four more rounds (2-1..2-4), every tick compared.
  let state: any = base.createMatch(seed);
  state = battle(state);
  state = (base.nextRound(state, state.round) as any).state;
  const deploy = (id: string, col: number) => { const u = state.preparation.units.find((u: any) => u.team === 'player' && u.definitionId === id); if (u) state = (base.deployMatchUnit(state, u.id, { kind: 'board', cell: { col, row: 7 } }) as any).state; };
  deploy('maddie', 3); state = battle(state); state = resolvePublicEquipmentChoices(state);
  state = (base.nextRound(state, state.round) as any).state; deploy('lux', 5); state = battle(state); state = resolvePublicEquipmentChoices(state);
  for (let r = 0; r < 6 && state.phase !== 'gameOver'; r++) {
    state = resolvePublicEquipmentChoices((base.nextRound(state, state.round) as any).state);
    if (state.phase === 'preparation') state = battle(state);
    state = resolvePublicEquipmentChoices(state);
  }
}
console.log(JSON.stringify({ seeds: seeds.length, battles, ticks, unitsChecked: units }));
