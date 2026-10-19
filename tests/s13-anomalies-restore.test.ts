import { expect, it } from 'vitest';
import { anomalyInputs } from './helpers/s13-anomalies';
import { createCombatWithEvents, stepCombat } from '../src/simulation/combat';
import { validateDynamicCombat } from '../src/simulation/g2-4b-gold-restore';
import { CONTENT_DIGEST } from '../src/simulation/content';
import { COMBAT_INPUT_VERSION, type CombatInputBasis } from '../src/simulation/combat-input';
const names = ['UnstoppableForce', 'CertainDeath', 'DramaticEntrance', 'Repulsor', 'Invisibility', 'EvenInDeath', 'ScuttleFamiliar',
  'WolfFamiliars', 'HungerForPower', 'CenteroftheUniverse', 'DeftHands'];
it.each(names)('%s admits exact reconstruction, rejects coordinated runtime/HP/roster edits, and is deterministic under input order', name => {
  const { inputs, preparation, strategy } = anomalyInputs(name, 'lux', [
    { id: 'ally', definitionId: 'darius', team: 'player', starLevel: 1, location: { kind: 'board', cell: { col: 2, row: 4 } } },
  ]);
  // Direct dynamic-validator vector: production supplies this only after authenticating the input basis.
  const basis: CombatInputBasis = { version: COMBAT_INPUT_VERSION, combatId: 'p4-anomaly', roundId: '1-1',
    battleSeed: 42, contentDigest: CONTENT_DIGEST, playerLevel: 9, nextUnitSerial: 4, nextItemSerial: 1,
    mechanicReceiptPrefixLength: 0, equipmentRollPrefixLength: 0, provenancePrefixLength: 0, inputs };
  let state = createCombatWithEvents(preparation, strategy, basis.combatId, basis.battleSeed).state;
  const before = JSON.stringify(state), forward = stepCombat(state), reverse = stepCombat({ ...state, units: [...state.units].reverse() });
  expect(JSON.stringify(state)).toBe(before);
  expect(reverse).toEqual(forward);
  state = forward.state;
  while (state.tick < 140 && state.status === 'running') state = stepCombat(state).state;
  expect(validateDynamicCombat(JSON.parse(JSON.stringify(state)), basis, strategy)).toBe(true);
  const altered = structuredClone(state);
  Object.assign(altered.units.find(u => u.id === 'p')!, { hp: 1, anomalyState: { absentUntilTick: 999, invisibleUntilTick: 999 } });
  expect(() => validateDynamicCombat(altered, basis, strategy)).toThrow('authoritative anomaly replay');
  expect(() => validateDynamicCombat({ ...state, units: state.units.slice(1) }, basis, strategy)).toThrow();
});
