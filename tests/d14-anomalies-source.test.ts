import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { D14_FOURTH_ABILITY } from '../src/simulation/d14-anomalies/fourth-ability';
import { ANOMALY_DEFINITIONS } from '../src/simulation/content/anomalies';
import { SHOP_CATALOG } from '../src/simulation/match-rules';
import { UNIT_DEFINITIONS } from '../src/simulation/units';
import { S13_ABILITY_DATA } from '../src/simulation/content/abilities';
import { CONTENT_DIGEST } from '../src/simulation/content';
import currentBaseline from './v20-traits-content-baseline.json';
import { M8_VERSION } from '../src/simulation/m8/version';

const root='src/simulation/content/source/s13-14.24b/raw/';
const raw=(name:string)=>JSON.parse(gunzipSync(readFileSync(root+name)).toString());
const evidence=JSON.parse(readFileSync('docs/evidence/d14-anomalies/source-excerpts.json','utf8'));
const map=raw('map22.bin.json.gz');
const aliases:Record<string,string>={fish:'steb',shooter:'maddie',blue:'powder',red:'violet'};

it('hash-gates the retained 14.24 archive and independently reconciles both standard pool identities and effect amounts',()=>{
  for(const [file,hash] of Object.entries(evidence.files))expect(createHash('sha256').update(readFileSync(root+file)).digest('hex')).toBe(hash);
  for(const [pointer,name,values] of [
    ['{cf1ee294}','TFT13_GoopBuff_UltimateHero',{NumRounds:3}],
    ['{711fd99c}','TFT13_GoopBuff_IntoTheUnknown',{GainedAD:0.5,GainedAP:50,NumRounds:3}],
  ] as const) {
    expect(map[pointer]).toEqual(evidence[pointer]);expect(map[pointer].name).toBe(name);
    expect(Object.fromEntries(map[pointer].effectAmounts.map((x:{name:string;value:number})=>[x.name,x.value]))).toEqual(values);
    expect(map[pointer].ExcludedAugments).toEqual(['TFT13_Augment_AnotherAnomaly']);
    for(const mutator of ['TFTSet13','TFTSet13_Evolved']) {
      const pool=map['Maps/Shipping/Map22/Sets/'+mutator]['{e6c62bd9}'];
      const entry=map[pool]['{9a7587b2}'].find((x:Record<string,unknown>)=>x['{16c534fd}']===pointer);
      expect(entry).toBeDefined();expect(entry).not.toHaveProperty('weight',0);
      expect(evidence[mutator].entries).toContainEqual(entry);
    }
  }
});
it('reconciles every four-star one-cost spell variable against raw rank 4, without extrapolating three-star spells',()=>{
  const source=raw('en_us.json.gz').setData.find((s:{mutator:string})=>s.mutator==='TFTSet13');
  const expected:Record<string,Record<string,number>>={};
  for(const champion of source.champions)if(champion.cost===1&&champion.apiName.startsWith('TFT13_')) {
    const suffix=champion.apiName.slice(6).toLowerCase(),id=aliases[suffix]??suffix;
    expected[id]=Object.fromEntries(champion.ability.variables.map((v:{name:string;value:number[]})=>[v.name,Math.round(v.value[4]*10000)/10000]));
  }
  expect(Object.keys(expected)).toHaveLength(14);expect(D14_FOURTH_ABILITY).toEqual(expected);
  expect(Object.keys(D14_FOURTH_ABILITY).sort()).toEqual(SHOP_CATALOG.filter(id=>UNIT_DEFINITIONS[id].cost===1&&!UNIT_DEFINITIONS[id].summon).sort());
  expect(D14_FOURTH_ABILITY.lux.Damage).toBe(1260);expect(D14_FOURTH_ABILITY.irelia.ShieldHealth).toBe(675);
  expect(D14_FOURTH_ABILITY.singed.DR).toBe(0.7); // deliberately raw; projection separately applies documented B-patch 0.6
});
it('reconciles the official Chinese description keys and keeps selection semantics separate from placement conventions',()=>{
  const strings=raw('zh_cn.tft.stringtable.json.gz').entries;
  for(const [key,text] of Object.entries(evidence.strings))expect(strings[key]).toBe(text);
  expect(strings.tft13_goopbuff_intotheunknown_desc).toContain('@NumRounds@');
  expect(strings.tft13_goopbuff_ultimatehero_description).toContain('4');
  expect(map['{560f71cc}'].name).toBe('TFT13_GoopBuff_IntoTheUnknown_ReturnState');
});
it('retains the two D14 anomalies in the current epoch without overwriting source values',()=>{
  expect(ANOMALY_DEFINITIONS['ultimate-hero'].effects).toEqual([{kind:'mechanic',mechanic:'d14Anomaly',values:{enabled:1}}]);expect(ANOMALY_DEFINITIONS['into-the-unknown'].effects).toEqual([{kind:'mechanic',mechanic:'d14Anomaly',values:{enabled:1}}]);
  expect(Object.keys(ANOMALY_DEFINITIONS)).toHaveLength(56);expect(CONTENT_DIGEST).toBe(currentBaseline.contentDigest);expect(M8_VERSION.rulesVersion).toBe(currentBaseline.rulesVersion);
  // Protect existing live source values; this pack never replaces lower-star tables.
  expect(S13_ABILITY_DATA['singed-ability'].variables.DR).toEqual([0.5,0.5,0.6]);
});
