import {G24_MECHANISM_ITEMS} from '../src/simulation/content/g2-4b-mechanism-items';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import extracted from '../src/simulation/content/source/s13-14.24b/normalized/g2-4b-mechanism-items.json';
import { vi } from 'vitest';
// Temporarily 20 s for slow CI runners (user-approved 2026-10-20 04:22: "Ci 超时可以放宽时限，或者直接验收").
vi.setConfig({ testTimeout: 20_000 });

const root = 'src/simulation/content/source/s13-14.24b/raw/';
const archive = (name: string) => JSON.parse(gunzipSync(readFileSync(root + name)).toString());

it('pins all eleven exact Set13 identities, bilingual descriptions and map22 values', () => {
  const english = archive('en_us.json.gz'), map = archive('map22.bin.json.gz');
  const chinese = archive('zh_cn.tft.stringtable.json.gz').entries;
  const members = english.setData.find((s: {mutator: string}) => s.mutator === 'TFTSet13').items;
  expect(extracted.items).toHaveLength(11);
  expect(new Set(extracted.items.map(i => i.apiName)).size).toBe(11);
  for (const [file, hash] of Object.entries(extracted.archives))
    expect(createHash('sha256').update(readFileSync(root + file)).digest('hex')).toBe(hash);
  for (const item of extracted.items) {
    const raw = english.items[Number(item.provenance.englishPointer.split('/').at(-1))];
    const binary = map[item.provenance.mapKey];
    expect(members).toContain(item.apiName);
    expect(raw.apiName).toBe(item.apiName);
    expect(binary.mName).toBe(item.apiName);
    expect(item.description).toBe(raw.desc);
    expect(item.unique).toBe(raw.unique);
    expect(item.values).toEqual(raw.effects);
    expect(item.values).toEqual(Object.fromEntries(Object.entries(binary.constants['{df085b93}'])
      .map(([key, value]) => [key, (value as {mValue: number}).mValue])));
    expect(item.name).toBe(chinese[item.provenance.nameKey]);
    expect(item.chineseDescription).toBe(chinese[item.provenance.descriptionKey]);
  }
});

it('keeps normal-mode economy values and the original 14.24 trench threshold', () => {
  const values = (id: string) => extracted.items.find(i => i.apiName === id)!.values;
  expect(values('TFT7_Item_ShimmerscaleMogulsMail').GoldAtFullStacks).toBe(1);
  expect(values('TFT7_Item_ShimmerscaleGamblersBlade').AS).toBe(45);
  expect(values('TFT_Item_Artifact_SuspiciousTrenchCoat')).toMatchObject({PercentHealthTrigger: 50, PercentHealthOfCopies: 30});
  expect(extracted.items.find(i => i.apiName === 'TFT5_Item_ZzRotPortalRadiant')!.name).toBe('兹若特传送门');
});

it('keeps every admitted runtime identity/name/uniqueness equal to the pinned original data',()=>{
 for(const definition of Object.values(G24_MECHANISM_ITEMS)){
  const source=extracted.items.find(i=>i.apiName===definition.id);
  expect(source).toBeDefined();expect(definition.apiName).toBe(source!.apiName);
  expect(definition.name).toBe(source!.name);expect(definition.unique).toBe(source!.unique);
 }
});
