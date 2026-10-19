import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { P4_SOURCE } from '../src/simulation/anomalies/source';
import { ANOMALY_DEFINITIONS } from '../src/simulation/content/anomalies';
import { ORBIT_PARAMETERS } from '../src/simulation/anomalies/orbit-parameters';
const raw = JSON.parse(gunzipSync(readFileSync('src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz')).toString());
it.each(Object.entries(P4_SOURCE))('%s retains exact raw14.24b coefficients and official zh_cn name', (_name, source) => {
  const record = raw[source.pointer];
  expect(record.name).toBe(source.id);
  expect(source.values).toEqual(Object.fromEntries(record.effectAmounts.map((e: { name: string; value: number }) => [e.name, Math.round(e.value * 1000000) / 1000000])));
  expect(ANOMALY_DEFINITIONS[source.id].name).toBe(source.name);
  expect(ANOMALY_DEFINITIONS[source.id].description).not.toContain('@');
});
it('registers41anomalies, preserves raw wolf0.9 while exposing official1.0, and records the available orbit script evidence', () => {
  expect(Object.keys(ANOMALY_DEFINITIONS)).toHaveLength(41);
  expect(Object.values(P4_SOURCE).map(s => s.name)).toEqual(['势不可挡','深入敌阵','震撼登场','斥力发生器','隐形','最后机会','真的会蟹','双狼佣兽','渴望能量','星原之准','小我多多']);
  expect(P4_SOURCE.WolfFamiliars.values.TooltipAS).toBe(0.9);
  expect(ANOMALY_DEFINITIONS[P4_SOURCE.WolfFamiliars.id].description).toContain('1.0');
  const missile = raw['{f1853b8b}'].mSpell;
  expect(missile.mMissileSpec.movementComponent.__type).toBe('SyncCircleMovement');
  expect(Math.round(missile.mMissileSpec.movementComponent.mAngularVelocity * 1000)).toBe(-1950);
  expect(ORBIT_PARAMETERS.revolutionTicks).toBeLessThan(2 * Math.PI / 1.95 * 20);
  expect(raw['{89bf7245}'].mSpell.mMissileSpec.movementComponent.mTravelTime).toBe(0.5);
});
