import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { D11_FILL_SOURCE } from '../src/simulation/content/d11-fill-source';
import { D11_FILL_ACTIVATION, D11_FILL_DEFINITIONS, D11_FILL_TIERS } from '../src/simulation/content/d11-fill';
import { AUGMENT_DEFINITIONS, ANOMALY_DEFINITIONS, CONTENT_DIGEST } from '../src/simulation/content';
import { SOURCE_MANIFEST } from '../src/simulation/content/source-manifest';
import { augmentPool } from './fixtures/m5/oracle.g2.cjs';
import { S13_P2_SOURCE } from '../src/simulation/content/s13-augments-p2-source';
import { S13_P3_SOURCE } from '../src/simulation/content/s13-p3-source';
import { G23_ANOMALY_SOURCE } from '../src/simulation/content/g2-3-anomaly-source';
import { P4_SOURCE } from '../src/simulation/anomalies/source';
import { createMatch } from '../src/simulation/match';
const root='src/simulation/content/source/s13-14.24b/raw/';
const load=(name:string)=>JSON.parse(gunzipSync(readFileSync(root+name)).toString());
const raw=load('map22.bin.json.gz'), en=load('en_us.json.gz'), zh=load('zh_cn.tft.stringtable.json.gz').entries;

it.each(Object.entries(D11_FILL_SOURCE))('%s has exact retained fields, translated identity and positive standard-pool admission', (id,s)=>{
  const record=raw[s.pointer];
  expect(record.mName??record.name).toBe(s.apiName);
  expect(zh[s.nameKey]).toBe(s.name);expect(zh[s.descriptionKey]).toBe(s.description);
  expect(D11_FILL_DEFINITIONS[id as keyof typeof D11_FILL_SOURCE].name).toBe(s.name);
  if(s.kind==='augment'){
    for(const mutator of ['TFTSet13','TFTSet13_Evolved'])
      expect(en.setData.find((d:{mutator:string})=>d.mutator===mutator).augments).toContain(s.apiName);
    const values=Object.fromEntries(Object.entries(en.items.find((d:{apiName:string})=>d.apiName===s.apiName).effects)
      .filter(([,v])=>v!==null).map(([k,v])=>[k,Math.round((v as number)*1e6)/1e6]));
    expect(s.values).toEqual(values);
    // Tier identity comes from the source tag, not the icon's filename.
    expect(record.ItemTags).toContain(s.tier==='silver'?'{d11fd6d5}':'{ce1fd21c}');
    expect(D11_FILL_TIERS[id as keyof typeof D11_FILL_TIERS]).toBe(s.tier);
  } else {
    expect(s.values).toEqual(Object.fromEntries(record.effectAmounts.map((e:{name:string;value?:number})=>[e.name,Math.round((e.value??0)*1e6)/1e6])));
    for(const set of ['TFTSet13','TFTSet13_Evolved']){
      const ptr=raw['Maps/Shipping/Map22/Sets/'+set]['{e6c62bd9}'];
      const entry=raw[ptr]['{9a7587b2}'].find((e:Record<string,string>)=>e['{16c534fd}']===s.pointer);
      expect(entry).toBeDefined();expect(entry['{bc58e0e5}']??1).toBeGreaterThan(0);
    }
  }
});
it('de-duplicates by API identity across aliases, including previously implemented Mind and AllForOne anomalies',()=>{
  const existing=new Set<string>([...Object.values(SOURCE_MANIFEST.augmentApiNames),
    ...Object.values(S13_P2_SOURCE).map(s=>s.apiName),...Object.values(S13_P3_SOURCE).map(s=>s.apiName),
    ...Object.values(G23_ANOMALY_SOURCE).map(s=>s.sourceName),...Object.values(P4_SOURCE).map(s=>s.id),
    'TFT6_Augment_RadiantRelics','TFT6_Augment_PortableForge','TFT9_Augment_BlindingSpeed','TFT10_Augment_GoingLong','TFT9_Augment_HedgeFund','TFT_Augment_InvestmentStrategy2']);
  for(const [id,s] of Object.entries(D11_FILL_SOURCE)){
    expect(existing.has(s.apiName)).toBe(false);expect((AUGMENT_DEFINITIONS[id]??ANOMALY_DEFINITIONS[id]).name).toBe(s.name);
  }
  for(const name of ['TFT13_GoopBuff_HardenedMind','TFT13_GoopBuff_MagicMind','TFT13_GoopBuff_SharpenedMind','TFT13_GoopBuff_AllForOne'])expect(existing.has(name)).toBe(true);
});
it('registers the D11 pack with v20 totals from the independent catalog and retains all 14.24b overrides and the current digest identity',()=>{
  expect(D11_FILL_ACTIVATION).toBe('wired-v15');
  expect(Object.keys(D11_FILL_DEFINITIONS)).toHaveLength(5);
  expect(Object.keys(AUGMENT_DEFINITIONS).sort()).toEqual((['silver','gold','prismatic'] as const).flatMap(tier=>augmentPool(tier,[])).sort());expect(Object.keys(ANOMALY_DEFINITIONS)).toHaveLength(56);
  expect(createMatch().contentDigest).toBe(CONTENT_DIGEST);
  expect(AUGMENT_DEFINITIONS['built-different'].effects).toContainEqual({kind:'mechanic',mechanic:'builtDifferent',values:{health2:300,health3:400,health4:500,health5:600,speed2:4500,speed3:5500,speed4:6500,speed5:7500}});
});
