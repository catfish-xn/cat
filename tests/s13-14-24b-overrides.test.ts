import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { G2_UNIT_DEFINITIONS } from '../src/simulation/content/g2-units';
import { G22_UNITS } from '../src/simulation/content/g2-2-units';
import { S13_ABILITY_DATA } from '../src/simulation/content/abilities';
import { ABILITY_DISPLAY_SOURCE } from '../src/simulation/ability-display-source';

const bPatch = JSON.parse(readFileSync(new URL('../src/simulation/content/source/s13-14.24b/b-patch-overrides.json', import.meta.url), 'utf8'));

// The user-approved 14.24b list (2026-11-12, items 1-7 of the 14.24b check), from Riot's 12/17 mid-patch notes. The override
// file must hold exactly these heroes, fields and star values: one more or one fewer fails.
const APPROVED = {
  units: { violet: { attack: 46 }, camille: { attack: 52 }, nocturne: { attack: 63 }, zeri: { attack: 48 } },
  abilities: {
    singed: { DR: [0.5, 0.5, 0.55] },
    ekko: { TargetDamage: [300, 450, 1200], SecondaryDamage: [150, 225, 450] },
    malzahar: { InfectionDamage: [15, 22, 400] },
  },
};

it('the 14.24b override file holds exactly the approved heroes, fields and values', () => {
  expect(Object.keys(bPatch).sort()).toEqual(['abilities', 'source', 'units']);
  expect(bPatch.units).toEqual(APPROVED.units);
  expect(bPatch.abilities).toEqual(APPROVED.abilities);
});

it('combat data and ability tooltips both carry the approved values', () => {
  for (const [id, stats] of Object.entries(APPROVED.units))
    expect((G2_UNIT_DEFINITIONS[id] ?? G22_UNITS[id]).baseStats.attack).toBe(stats.attack);
  for (const [id, fields] of Object.entries(APPROVED.abilities)) for (const [name, values] of Object.entries(fields)) {
    expect(S13_ABILITY_DATA[`${id}-ability`].variables[name]).toEqual(values);
    expect((ABILITY_DISPLAY_SOURCE as any)[id].variables[name]).toEqual(values);
  }
});
