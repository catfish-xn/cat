import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { G23_UNITS, G23_MEMBERSHIP } from '../src/simulation/content/g2-3-units';
import { G23_ABILITIES } from '../src/simulation/content/g2-3-abilities';
import { G23_TRAIT_SOURCE } from '../src/simulation/content/g2-3-trait-source';
import { G23_LOOT_SOURCE } from '../src/simulation/content/g2-3-loot-source';
import { G23_ANOMALY_SOURCE } from '../src/simulation/content/g2-3-anomaly-source';
import manifest from '../src/simulation/content/source/s13-14.24b/provenance/manifest.json';

type Raw = Record<string, any>;
const rawRoot = '../src/simulation/content/source/s13-14.24b/raw/';
const readArchive = (name: string): Raw => JSON.parse(gunzipSync(readFileSync(new URL(rawRoot + name + '.gz', import.meta.url))).toString());
const quantize = (x: number): number => Math.round(x * 10000) / 10000;
let map: Raw, set: Raw, strings: Raw;
beforeAll(() => {
  map = readArchive('map22.bin.json');
  set = readArchive('en_us.json').setData.find((s: Raw) => s.mutator === 'TFTSet13');
  strings = Object.fromEntries(Object.entries(readArchive('en_us.tft.stringtable.json').entries).map(([k, v]) => [k.toLowerCase(), v]));
});

describe('G2-3 staged source data (runtime admission is a separate gate)', () => {
  it('verifies every extended archive against the independent acquisition manifest', () => {
    for (const row of manifest.extendedSourceAcquisition.sources) {
      const archive = readFileSync(new URL('../' + row.archivePath, import.meta.url));
      expect(archive.length, row.id).toBe(row.archiveBytes);
      expect(createHash('sha256').update(archive).digest('hex'), row.id).toBe(row.archiveSha256);
      const original = gunzipSync(archive);
      expect(original.length, row.id).toBe(row.bytes);
      expect(createHash('sha256').update(original).digest('hex'), row.id).toBe(row.sha256);
    }
  });
  it('has twelve champions and four extra fixed ranged definitions, with matched skill identities', () => {
    expect(Object.keys(G23_UNITS).sort()).toEqual('renata cassiopeia nunu renni smeech drmundo elise silco sevika swain jayce gangplank elise-ranged swain-ranged jayce-ranged gangplank-ranged'.split(' ').sort());
    for (const unit of Object.values(G23_UNITS)) {
      const ability = G23_ABILITIES[unit.abilityId];
      expect(ability.championId).toBe(unit.id);
      expect(ability.name.length).toBeGreaterThan(0);
      expect(ability.description.length).toBeGreaterThan(0);
      expect(unit.traits).not.toContain('form-swapper');
      expect(unit.traits).toEqual(G23_MEMBERSHIP[unit.id]);
      for (const values of Object.values(ability.variables)) {
        expect(values).toHaveLength(3);
        expect(values.every(Number.isFinite)).toBe(true);
      }
    }
  });
  it.each(['elise', 'swain', 'gangplank', 'jayce'])('takes both %s forms from FormSwapperStats, retaining only declared overrides', name => {
    const source = set.champions.find((c: Raw) => c.apiName.toLowerCase() === 'tft13_' + name);
    const constants = Object.values(map).find((v: Raw) => v.mName?.toLowerCase() === 'tft13_' + name + 'formswapperstats')!.mConstants;
    for (const form of ['Melee', 'Ranged']) {
      const unit = G23_UNITS[name + (form === 'Ranged' ? '-ranged' : '')];
      const value = (key: string): number => constants[key + '_' + form]?.mValue ?? 0;
      expect(unit.baseStats.health).toBe(source.stats.hp + (form === 'Melee' ? value('BonusHealth') : 0));
      expect(unit.baseStats.attack).toBe(name === 'gangplank' && form === 'Melee' ? 65 : value('AttackDamage'));
      expect(unit.baseStats.armor).toBe(value('Resists'));
      expect(unit.baseStats.magicResist).toBe(value('Resists'));
      expect(unit.initialMana).toBe(value('StartingMana'));
      expect(unit.maxMana).toBe(value('MaxMana'));
      expect(unit.baseAttackSpeedBps).toBe(Math.round(value('AttackSpeed') * 10000));
      expect(unit.attackRange).toBe(form === 'Ranged' ? 4 : 1); // explicit project convention
      if (form !== 'Ranged') continue;
      const bin = readArchive('tft13_' + name + '.cdtb.bin.json');
      const spell = Object.values(bin).find((v: Raw) => v.mScriptName?.toLowerCase() === 'tft13_' + name + 'spell_ranged')!.mSpell;
      expect(G23_ABILITIES[unit.abilityId].variables).toEqual(Object.fromEntries(spell.mDataValues.map((v: Raw) => [v.mName, v.mValues.slice(1, 4).map(quantize)])));
      const keys = spell.mClientData.mTooltipData.mLocKeys;
      expect(G23_ABILITIES[unit.abilityId].name).toBe(strings[keys.keyName.toLowerCase()]);
      expect(G23_ABILITIES[unit.abilityId].description).toBe(strings[keys.keyTooltip.toLowerCase()]);
    }
  });
  it('records the Silco B override and Mundo experiment values exactly', () => {
    expect(G23_ABILITIES['silco-ability'].variables.MinionDamage).toEqual([36, 55, 100]);
    expect(G23_ABILITIES['drmundo-ability'].variables.BaseExperimentHealthGain).toEqual([120, 120, 120]);
    expect(G23_ABILITIES['drmundo-ability'].variables.ExperimentHealthGain).toEqual([60, 60, 60]);
  });
  it('preserves all 26 non-Teamup source traits and admits Form Swapper in v19', () => {
    const traits = set.traits.filter((t: Raw) => !t.apiName.includes('Teamup'));
    expect(Object.values(G23_TRAIT_SOURCE).map(t => t.apiName).sort()).toEqual(traits.map((t: Raw) => t.apiName).sort());
    expect(G23_TRAIT_SOURCE['form-swapper'].enabled).toBe(true);
    for (const trait of Object.values(G23_TRAIT_SOURCE)) {
      const source = traits.find((t: Raw) => t.apiName === trait.apiName);
      expect(trait.tiers).toEqual(source.effects.map((t: Raw) => ({ threshold: t.minUnits, values: Object.fromEntries(Object.entries(t.variables).map(([k, v]) => [k, v === null ? null : quantize(v as number)])) })));
    }
  });
  it('preserves 20 chest tables, eight black markets and exact named source weights, including zero defaults', () => {
    for (let n = 1; n <= 20; n++) expect(G23_LOOT_SOURCE).toHaveProperty('ArmoryTable_TFT13_Warband_Cashout' + n);
    for (let n = 1; n <= 8; n++) expect(G23_LOOT_SOURCE).toHaveProperty('TFT13_Crime_BlackMarket' + n);
    for (const table of Object.values(G23_LOOT_SOURCE)) {
      expect(table.values).toEqual(Object.fromEntries(Object.entries(map[table.pointer].mConstants).map(([k, v]) => [k, typeof (v as Raw).mValue === 'number' ? quantize((v as Raw).mValue) : (v as Raw).mValue ?? 0])));
    }
    // Source has 20 content tables but only 15 standard breakpoints; never invent source evidence.
    expect(Object.keys(G23_LOOT_SOURCE.ArmoryTable_TFT13_Warband_CashoutBreakpoints.values)).toHaveLength(15);
  });
  it('selects 30 traceable anomaly records and resolves the HardenedMind/Defense Expert identity from source', () => {
    expect(Object.keys(G23_ANOMALY_SOURCE)).toHaveLength(30);
    expect(G23_ANOMALY_SOURCE).not.toHaveProperty('cosmic-rhythm');
    expect(G23_ANOMALY_SOURCE).not.toHaveProperty('hivemind');
    expect(G23_ANOMALY_SOURCE['defense-expert'].sourceName).toBe('TFT13_GoopBuff_HardenedMind');
    for (const row of Object.values(G23_ANOMALY_SOURCE)) {
      expect(row.values).toEqual(Object.fromEntries(map[row.pointer].effectAmounts.map((v: Raw) => [v.name, quantize(v.value ?? 0)])));
      expect(row.name).toBe(strings[row.titleKey.toLowerCase()]);
      expect(row.description).toBe(strings[row.descriptionKey.toLowerCase()]);
      expect(row.zhName.length).toBeGreaterThan(0);
      expect(row.zhDescription.length).toBeGreaterThan(0);
    }
  });
});
