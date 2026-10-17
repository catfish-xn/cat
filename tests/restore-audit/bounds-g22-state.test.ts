import { expect, it } from 'vitest';
import { battle } from '../match-helpers';
import { restoreMatch, serializeMatch } from '../../src/simulation/serialization';
import { stepMatch } from '../../src/simulation/match';
import { EMPTY_EXPANSION } from '../../src/simulation/combat-g2';

// Characterization of accepted tampering; these assertions document audit gaps,
// not intended acceptance rules. Preparation uses only public Match commands.
it('audit: source-less G22 exposure is accepted and changes actual continuation', () => {
  const legal = battle();
  expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
  const forged = structuredClone(legal);
  const target = forged.combat!.units.find(u => u.team === 'player')!;
  Object.assign(target, { g22: { initialized:false,rebelTriggered:false,wanted:[],wantedDeaths:0,mordeUntilTick:0,
    reaveUntilTick:0,reaveBps:0,exposureFromTick:0,exposureUntilTick:81,exposureBps:10000 } });
  for (const input of [forged, JSON.stringify(forged)]) expect(restoreMatch(input)).toEqual(forged);
  let normal = legal, altered = restoreMatch(JSON.stringify(forged));
  while (normal.phase === 'combat' && altered.phase === 'combat' && normal.combat!.tick < 81) {
    normal = stepMatch(normal).state; altered = stepMatch(altered).state;
  }
  expect(altered.combat!.units.find(u=>u.id===target.id)!.hp).not.toBe(normal.combat!.units.find(u=>u.id===target.id)!.hp);
});

it('audit: G22 source-less reave counters are accepted at combat start', () => {
  const legal = battle(), forged = structuredClone(legal);
  const target = forged.combat!.units.find(u => u.team === 'player')!;
  Object.assign(target, { g22: { initialized:false,rebelTriggered:false,wanted:[],wantedDeaths:0,mordeUntilTick:0,
    reaveUntilTick:200,reaveBps:10000,exposureFromTick:0,exposureUntilTick:0,exposureBps:0 } });
  expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
  for (const input of [forged, JSON.stringify(forged)]) expect(restoreMatch(input)).toEqual(forged);
});

it.each(['damageDealt', 'damageTaken', 'crystalDamage'] as const)('audit: expansion %s accepts invented damage before any combat tick', field => {
  const legal = battle(), forged = structuredClone(legal);
  const target = forged.combat!.units.find(u => u.team === 'player')!;
  expect(forged.combat!.tick).toBe(0);
  Object.assign(target, { expansion: { ...structuredClone(EMPTY_EXPANSION), [field]: 99999999 } });
  expect(restoreMatch(serializeMatch(legal))).toEqual(legal);
  for (const input of [forged, JSON.stringify(forged)]) expect(restoreMatch(input)).toEqual(forged);
});
