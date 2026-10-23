import { freezeCombatInput } from '../src/simulation/combat-input';
import { validateDynamicCombat } from '../src/simulation/g2-4b-gold-restore';
import { stepCombat } from '../src/simulation/combat';
import { expect, it } from 'vitest';
import { createMatch, snapshotForBattle, compileBattle, resolveTwoSidedBattle, startTwoSidedBattle,
  startCombatReplay, equipItem, type MatchState } from '../src/server-entry';
import { grantMechanicItem } from '../src/simulation/seat-mechanics';
import { getCatalogRoundById } from '../src/simulation/round-selectors';
import { canonicalContent } from '../src/simulation/content';

function tankSeat(): MatchState {
  const base = createMatch(42), round = getCatalogRoundById('4-2');
  let state: MatchState = { ...base, round: round.ordinal, roundDefinitionId: round.roundId,
    m8: { ...base.m8, round }, preparation: { ...base.preparation, units: [
      { id: 'unit-1', definitionId: 'leona', starLevel: 3, team: 'player', location: { kind: 'board', cell: { col: 3, row: 4 } } },
    ] } };
  for (const [slot, definitionId] of ['warmog', 'warmog', 'dragons-claw'].entries()) {
    const grant = grantMechanicItem(state, { receiptId: `overtime-${slot}`, source: 'test', definitionId });
    if (!grant.ok) throw Error(grant.reason);
    const equip = equipItem(grant.state, grant.state.items.at(-1)!.id, 'unit-1', slot);
    if (!equip.ok) throw Error(equip.reason);
    state = equip.state;
  }
  return state;
}
it('real two-sided tanks cross overtime: sync, sliced 1/7 ticks, first-pass and rerun replay agree', () => {
  const input = compileBattle(snapshotForBattle(tankSeat(), 'A'), snapshotForBattle(tankSeat(), 'B'), 42, { battleId: 'overtime-paths' });
  const sync = resolveTwoSidedBattle(input, 901);
  expect(sync.terminal.tick).toBe(900);
  expect(sync.terminal.result).toBe('draw');
  expect(sync.events.some(e => e.type === 'heal' && e.tick >= 720 && e.outcome.actual > 0)).toBe(true);
  const replay = startCombatReplay(sync).advance(901)!;
  const base = freezeCombatInput(tankSeat(), 42, 0);
  // Direct restore-validator vector: production first authenticates these inputs.
  const basis = { ...base, combatId: input.battleId, inputs: { ...base.inputs, preparation: input.preparation } };
  let checkpoint = sync.initial;
  while (checkpoint.tick < 620) checkpoint = stepCombat(checkpoint).state;
  const restored = JSON.parse(JSON.stringify(checkpoint));
  expect(validateDynamicCombat(restored, basis, input.strategy)).toBe(true);
  const forged = { ...restored, units: restored.units.map((u: typeof checkpoint.units[number], i: number) => i ? u : { ...u, hp: u.hp - 1 }) };
  expect(() => validateDynamicCombat(forged, basis, input.strategy)).toThrow('authoritative overtime replay');
  let resumed = restored;
  while (resumed.status === 'running') resumed = stepCombat(resumed).state;
  expect(canonicalContent(resumed)).toBe(canonicalContent(sync.terminal));
  for (const budget of [1, 7]) {
    const task = startTwoSidedBattle(input, { captureReplay: true });
    let result = null;
    while (!result) result = task.advance(budget);
    expect(canonicalContent(result)).toBe(canonicalContent(sync));
    expect(canonicalContent(task.replay())).toBe(canonicalContent(replay));
    expect(task.advance(1)).toBe(result);
  }
}, 20000);
