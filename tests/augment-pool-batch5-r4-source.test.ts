import { existsSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AUGMENT_BATCH5_R4 } from '../src/simulation/content/augment-pool-batch5-r4';

const research = '/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json';

it('transcribes the Mad Chemist spell coefficients and approved trail constants', () => {
  expect(AUGMENT_BATCH5_R4['mad-chemist'].apiName).toBe('TFT13_Augment_SingedCarry');
  expect(AUGMENT_BATCH5_R4['mad-chemist'].spell).toEqual({
    totalDamageByStar: [140, 210, 315, 420], damageDurationTicks: 100,
    cloudDurationTicks: 60, abilityDurationTicks: 80, moveSpeed: 250,
    omnivampBps: 2000, manaPerSecondPerAttackSpeed: 10,
    trailIntervalTicks: 10, trailWidthCells: 1,
  });
});

it.skipIf(!existsSync(research))('transcribes the original augment effect and gift', () => {
  const rows = JSON.parse(readFileSync(research, 'utf8')) as { apiName: string; effects: unknown; tier: number }[];
  const row = rows.find(x => x.apiName === 'TFT13_Augment_SingedCarry');
  expect(row?.effects).toEqual(AUGMENT_BATCH5_R4['mad-chemist'].source.values);
  expect(row?.tier).toBe(1);
  expect(AUGMENT_BATCH5_R4['mad-chemist'].gifts).toEqual([{ kind: 'unit', definitionId: 'singed' }]);
});
