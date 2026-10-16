// G2-3 display tables (presentation only): client names and icons keyed by apiName, the content-id bridge, and the
// bundled icon manifests (G2-3 and the #122 augment icons) checked byte-for-byte against the files under public/.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANOMALY_DEFINITIONS } from '../../src/simulation/content/anomalies';
import { ITEM_DEFINITIONS } from '../../src/simulation/content/items';
import { TRAIT_DEFINITIONS } from '../../src/simulation/content/traits';
import { UNIT_DEFINITIONS } from '../../src/simulation/units';
import { displayUnitName } from '../../src/rendering/display-names';
import {
  G23_HERO_IDS, G23_HERO_STYLE, G23_HERO_TRAITS, anomalyDisplayName, anomalyIconUrl, g23AnomalyApiName, g23ChampionApiName,
  g23TraitApiName, itemDisplayName, lootEntry, radiantItem,
} from '../../src/presentation/g23-display';
import { G23_ANOMALIES, G23_ASSETS, G23_CHAMPIONS, G23_LOOT, G23_RADIANT_ITEMS, G23_TRAITS } from '../../src/presentation/s13-g23-manifest';
import { S13_AUGMENT_ASSETS } from '../../src/presentation/s13-augment-asset-manifest';
import { G22_HERO_STYLE, HERO_STYLE, heroTraitTags, traitDisplayName } from '../../src/presentation/hero-identity';
import { s13AssetUrl } from '../../src/presentation/s13-assets';

const file = (path: string) => readFileSync(new URL(`../../public/${path}`, import.meta.url));

describe('bundled icon manifests match the files on disk', () => {
  for (const [name, assets] of [['G2-3', G23_ASSETS], ['augments (#122)', S13_AUGMENT_ASSETS]] as const) {
    it(`${name}: every row's bytes and sha256 are the bundled PNG`, () => {
      for (const asset of assets) {
        const bytes = file(asset.path);
        expect(bytes.subarray(0, 4).toString('hex'), asset.path).toBe('89504e47');
        expect({ path: asset.path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
          .toEqual({ path: asset.path, bytes: asset.bytes, sha256: asset.sha256 });
        expect(asset.source, asset.path).toMatch(/^https:\/\/raw\.communitydragon\.org\/14\.24\/game\//);
      }
    });
  }
  it('G2-3 paths and apiNames are unique per kind', () => {
    expect(new Set(G23_ASSETS.map(asset => asset.path)).size).toBe(G23_ASSETS.length);
    expect(new Set(G23_ASSETS.map(asset => `${asset.kind}:${asset.apiName}`)).size).toBe(G23_ASSETS.length);
  });
});

describe('G2-3 name tables', () => {
  it('cover 12 heroes, 12 traits, 30 anomalies and one radiant per completed item', () => {
    expect(G23_CHAMPIONS.filter(row => !row.summon)).toHaveLength(12);
    expect(G23_TRAITS).toHaveLength(12);
    expect(G23_ANOMALIES).toHaveLength(30);
    expect(G23_ANOMALIES.some(row => row.apiName.endsWith('CosmicRhythm'))).toBe(false);
    const completed = Object.values(ITEM_DEFINITIONS).filter(item => item.kind === 'completed');
    expect(completed).toHaveLength(36);
    expect(new Set(G23_RADIANT_ITEMS.map(row => row.base))).toEqual(new Set(completed.map(item => item.apiName)));
  });
  it('every hero, trait, anomaly, radiant and reward row has a client name and an icon (Silco summon excepted)', () => {
    const icons = new Set(G23_ASSETS.map(asset => asset.apiName));
    for (const row of [...G23_CHAMPIONS, ...G23_TRAITS, ...G23_ANOMALIES, ...G23_RADIANT_ITEMS, ...G23_LOOT]) {
      if (row.apiName === 'TFT13_Silco_Monstrosity') { expect(row.zh).toBeNull(); continue; }
      expect(row.zh, row.apiName).toMatch(/\S/);
    }
    for (const row of [...G23_CHAMPIONS, ...G23_TRAITS, ...G23_RADIANT_ITEMS, ...G23_LOOT]) {
      // Swain's portrait and Thief's Gloves' icon are already bundled by the generated manifest.
      if (row.apiName === 'TFT13_Swain' || row.apiName === 'TFT_Item_ThiefsGloves') continue;
      expect(icons.has(row.apiName), row.apiName).toBe(true);
    }
  });
  it('pins sample client names', () => {
    const zh = (rows: readonly { apiName: string; zh: string | null }[], api: string) => rows.find(row => row.apiName === api)?.zh;
    expect(zh(G23_CHAMPIONS, 'TFT13_Chainsaw')).toBe('荏妮');
    expect(zh(G23_CHAMPIONS, 'TFT13_JayceSummon')).toBe('海克斯科技锻炉');
    expect(zh(G23_CHAMPIONS, 'TFT13_GangplankBarrel')).toBe('普朗克 火药桶');
    expect(zh(G23_CHAMPIONS, 'TFT13_Sion')).toBe('赛恩');
    expect(zh(G23_TRAITS, 'TFT13_FormSwapper')).toBe('双形战士');
    expect(zh(G23_ANOMALIES, 'TFT13_GoopBuff_HardenedMind')).toBe('防御专家');
    expect(zh(G23_RADIANT_ITEMS, 'TFT5_Item_TrapClawRadiant')).toBe('意志破坏者');
    expect(zh(G23_LOOT, 'TFT13_JunkerKing_RepairingMicrobots')).toBe('微型维修机器人');
    expect(zh(G23_LOOT, 'TFT13_Crime_Prismatic_VoltaicSaber')).toBe('完美电震军刀');
  });
});

describe('content id bridge', () => {
  it('resolves the RECONCILIATION candidate hero ids to client names and portraits', () => {
    const expected: Record<string, string> = {
      renata: '烈娜塔', cassiopeia: '卡西奥佩娅', nunu: '努努和威朗普', renni: '荏妮', smeech: '史密奇', drmundo: '蒙多医生',
      elise: '伊莉丝', silco: '希尔科', sevika: '塞薇卡', swain: '斯维因', jayce: '杰斯', gangplank: '普朗克',
    };
    expect(Object.keys(G23_HERO_IDS).sort()).toEqual(Object.keys(expected).sort());
    for (const [id, name] of Object.entries(expected)) {
      expect(displayUnitName(id)).toBe(name);
      expect(s13AssetUrl('champion', id), id).not.toBeNull();
    }
    expect(heroTraitTags('renata')).toEqual([{ name: '炼金男爵', open: false }, { name: '先知', open: false }]);
    expect(G23_HERO_TRAITS.TFT13_Lieutenant).toEqual(['High Roller', 'Chem-Baron', 'Pit Fighter']);
  });
  it('resolves summons by apiName-derived id', () => {
    expect(g23ChampionApiName('jaycesummon')).toBe('TFT13_JayceSummon');
    expect(g23ChampionApiName('TFT13_GangplankBarrel')).toBe('TFT13_GangplankBarrel');
    expect(displayUnitName('sion')).toBe('赛恩');
  });
  it('resolves trait ids spelled from the English name or the apiName', () => {
    for (const [id, name] of [['chem-baron', '炼金男爵'], ['chembaron', '炼金男爵'], ['crime', '炼金男爵'], ['visionary', '先知'], ['invoker', '先知'],
      ['form-swapper', '双形战士'], ['pit-fighter', '搏击手'], ['black-rose', '黑色玫瑰'], ['quickstriker', '迅击战士'], ['high-roller', '百变铁手']] as const) {
      expect(traitDisplayName(id), id).toBe(name);
      expect(s13AssetUrl('trait', id), id).not.toBeNull();
    }
  });
  it('resolves anomaly ids and keeps the three existing content names', () => {
    for (const id of Object.keys(ANOMALY_DEFINITIONS)) expect(anomalyDisplayName(id)).toBe(ANOMALY_DEFINITIONS[id].name);
    expect(anomalyDisplayName('defense-expert')).toBe('防御专家');
    expect(anomalyDisplayName('hardened-mind')).toBe('防御专家');
    expect(anomalyDisplayName('protective-shielding')).toBe('防御型护盾');
    expect(anomalyDisplayName('legacy-of-shurima')).toBe('恕瑞玛的传承');
    expect(anomalyDisplayName('no-such-anomaly')).toBe('未知异常');
    expect(anomalyIconUrl()).toMatch(/assets\/s13\/g23\/anomalies\/tft13_goopitem_icon\.png$/);
  });
  it('never captures an existing hero, trait or item id', () => {
    for (const id of Object.keys(UNIT_DEFINITIONS)) if (id !== 'swain') expect(g23ChampionApiName(id), id).toBeUndefined();
    for (const id of Object.keys(TRAIT_DEFINITIONS)) expect(g23TraitApiName(id), id).toBeUndefined();
    for (const id of Object.keys(ITEM_DEFINITIONS)) expect(itemDisplayName(id)).toBe(ITEM_DEFINITIONS[id].name);
    for (const id of Object.keys(ANOMALY_DEFINITIONS)) expect(g23AnomalyApiName(id)).toBeDefined();
  });
});

describe('radiant items and rewards', () => {
  it('maps every completed item to its radiant name and icon, including the five renamed bases', () => {
    for (const [id, name] of [['guardbreaker', '意志破坏者'], ['red-buff', '余烬之冠'], ['sunfire-cape', '日光斗篷'], ['giant-slayer', '恶魔杀手'],
      ['hand-of-justice', '绝对正义之拳'], ['gargoyle', '天神石板甲'], ['rageblade', '鬼索的清算']] as const) {
      expect(radiantItem(id)?.name, id).toBe(name);
    }
    for (const item of Object.values(ITEM_DEFINITIONS)) {
      const radiant = radiantItem(item.id);
      if (item.kind === 'completed') expect(radiant?.iconUrl, item.id).toMatch(/assets\/s13\/g23\/items\/tft5_item_\w+radiant\.png$/);
      else expect(radiant).toBeNull();
    }
    expect(radiantItem('TFT_Item_InfinityEdge')?.name).toBe('天顶锋刃');
  });
  it('names Conqueror, Chem-Baron and Junker King rewards', () => {
    expect(lootEntry('TFT_Item_ForceOfNature')?.name).toBe('金铲铲冠冕');
    expect(lootEntry('TFT_ArmoryKeyOrnn')?.name).toBe('神器装备锻造器');
    expect(lootEntry('TFT13_Crime_Gold_FleshRipper')?.name).toBe('裂肉者 II');
    expect(lootEntry('TFT13_JunkerKing_SuperPass')?.name).toBe('画龙点睛！');
    expect(lootEntry('TFT13_JunkerKing_Flamethrower')?.iconUrl).not.toBeNull();
    expect(lootEntry('TFT_Item_InfinityEdge')).toBeNull();
  });
});

describe('G2-3 hero emblem styles', () => {
  const rgb = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16));
  const luminance = (hex: string) => {
    const [r, g, b] = rgb(hex).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  it('keeps short names unique and colors distinct and readable', () => {
    const all = [...Object.values(HERO_STYLE), ...Object.values(G22_HERO_STYLE), ...Object.values(G23_HERO_STYLE)];
    expect(Object.keys(G23_HERO_STYLE)).toHaveLength(12);
    expect(new Set(all.map(style => style.short)).size).toBe(all.length);
    for (const style of Object.values(G23_HERO_STYLE)) {
      for (const other of all) if (other !== style) {
        const distance = Math.hypot(...rgb(style.color).map((v, i) => v - rgb(other.color)[i]));
        expect(distance, `${style.short}/${other.short}`).toBeGreaterThanOrEqual(52);
      }
      const l = luminance(style.color), contrast = Math.max((l + 0.05) / (luminance('#0b151f') + 0.05), 1.05 / (l + 0.05));
      expect(contrast, style.short).toBeGreaterThanOrEqual(4.6);
    }
  });
});
