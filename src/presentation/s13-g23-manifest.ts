/*
 * G2-3 player-facing names and icons, keyed by the 14.24 client apiName (not by content id, which G2-3 has not
 * fixed yet; g23-display.ts bridges content ids to apiNames). Names: CommunityDragon 14.24 zh_cn stringtable
 * (archived under src/simulation/content/source/s13-14.24b/raw/, see docs/evidence/g2-3/README.md), cross-checked
 * with cdragon/tft/zh_cn.json 14.24; English names from raw/en_us.json.gz and the en_us stringtable. `zh: null` means
 * the client only has a placeholder string, so the UI keeps the content name. The client calls anomalies
 * 异常突变; the UI keeps its short label 异常.
 *
 * Icons: CommunityDragon 14.24 mirror (Riot Games assets, free non-commercial fan use; see README), downloaded
 * 2026-10-16 by a one-off script outside the repo; scripts/fetch-s13-assets.cjs and s13-asset-manifest.ts are untouched.
 * G2-4b artifacts (21) and support items (11) were added the same way on 2026-10-18, from the icon paths in
 * cdragon/tft/zh_cn.json 14.24 (kinds `artifact-items` and `support`; not `artifacts`, which .gitignore excludes).
 * Per-file byte counts and SHA-256 checks: s13-g23-asset-checks.ts.
 *
 * Item names and icons (radiant, loot, G2-4b support and artifact icons) moved to s13-g23-items.ts, loaded after the
 * first screen (2D bundle split, 11-19); heroes, traits and anomalies stay here.
 */
export interface G23Name { readonly apiName: string; readonly en: string; readonly zh: string | null }
export type G23IconKind = G23ProfileIconKind | G23ItemIconKind;
/** Icons kept with the names in this (first-screen) table; the item icons and names are their own chunk (s13-g23-items.ts). */
export type G23ProfileIconKind = 'champions' | 'traits' | 'anomalies';
export type G23ItemIconKind = 'items' | 'loot' | 'artifact-items' | 'support';
export type G23LootGroup = 'conqueror' | 'chembaron' | 'junkerking';
/** 12 heroes, then summons / form units (cost 11 in the client, or absent from the set list). */
export const G23_CHAMPIONS: readonly (G23Name & { readonly summon: boolean })[] = [
  {"apiName": "TFT13_RenataGlasc", "en": "Renata Glasc", "zh": "烈娜塔", "summon": false},
  {"apiName": "TFT13_Cassiopeia", "en": "Cassiopeia", "zh": "卡西奥佩娅", "summon": false},
  {"apiName": "TFT13_NunuWillump", "en": "Nunu & Willump", "zh": "努努和威朗普", "summon": false},
  {"apiName": "TFT13_Chainsaw", "en": "Renni", "zh": "荏妮", "summon": false},
  {"apiName": "TFT13_Gremlin", "en": "Smeech", "zh": "史密奇", "summon": false},
  {"apiName": "TFT13_DrMundo", "en": "Dr. Mundo", "zh": "蒙多医生", "summon": false},
  {"apiName": "TFT13_Elise", "en": "Elise", "zh": "伊莉丝", "summon": false},
  {"apiName": "TFT13_Silco", "en": "Silco", "zh": "希尔科", "summon": false},
  {"apiName": "TFT13_Lieutenant", "en": "Sevika", "zh": "塞薇卡", "summon": false},
  {"apiName": "TFT13_Swain", "en": "Swain", "zh": "斯维因", "summon": false},
  {"apiName": "TFT13_Jayce", "en": "Jayce", "zh": "杰斯", "summon": false},
  {"apiName": "TFT13_Gangplank", "en": "Gangplank", "zh": "普朗克", "summon": false},
  {"apiName": "TFT13_JayceSummon", "en": "Hextech Forge", "zh": "海克斯科技锻炉", "summon": true},
  {"apiName": "TFT13_GangplankBarrel", "en": "GangplankBarrel", "zh": "普朗克 火药桶", "summon": true},
  {"apiName": "TFT13_Sion", "en": "Sion", "zh": "赛恩", "summon": true},
  {"apiName": "TFT13_SwainDemonForm", "en": "SwainDemonForm", "zh": "斯维因 恶魔形态", "summon": true},
  {"apiName": "TFT13_EliseSpider", "en": "EliseSpider", "zh": "伊莉丝 蜘蛛", "summon": true},
  {"apiName": "TFT13_Silco_Monstrosity", "en": "SRU_Horde_Mini", "zh": null, "summon": true},
];
/** The 12 hero-carried traits G2-3 adds (26 with the 14 already playable; the 7 Teamup traits are out of scope). */
export const G23_TRAITS: readonly G23Name[] = [
  {"apiName": "TFT13_FormSwapper", "en": "Form Swapper", "zh": "双形战士"},
  {"apiName": "TFT13_Ambusher", "en": "Ambusher", "zh": "伏击专家"},
  {"apiName": "TFT13_Invoker", "en": "Visionary", "zh": "先知"},
  {"apiName": "TFT13_HighRoller", "en": "High Roller", "zh": "百变铁手"},
  {"apiName": "TFT13_Crime", "en": "Chem-Baron", "zh": "炼金男爵"},
  {"apiName": "TFT13_Infused", "en": "Dominator", "zh": "统领"},
  {"apiName": "TFT13_Pugilist", "en": "Pit Fighter", "zh": "搏击手"},
  {"apiName": "TFT13_Experiment", "en": "Experiment", "zh": "试验品"},
  {"apiName": "TFT13_Bruiser", "en": "Bruiser", "zh": "格斗家"},
  {"apiName": "TFT13_JunkerKing", "en": "Junker King", "zh": "机械公敌"},
  {"apiName": "TFT13_Cabal", "en": "Black Rose", "zh": "黑色玫瑰"},
  {"apiName": "TFT13_Challenger", "en": "Quickstriker", "zh": "迅击战士"},
];
/** The 30 anomalies content ships (g2-3-anomaly-source.ts, TFT13_GoopBuff_*); Cosmic Rhythm excluded. Names from `<apiName>_Title`. */
export const G23_ANOMALIES: readonly G23Name[] = [
  {"apiName": "TFT13_GoopBuff_TitanicStrikes", "en": "Titanic Strikes", "zh": "泰坦打击"},
  {"apiName": "TFT13_GoopBuff_MageArmor", "en": "Mage Armor", "zh": "法师护甲"},
  {"apiName": "TFT13_GoopBuff_KillStreak", "en": "Kill Streak", "zh": "连杀"},
  {"apiName": "TFT13_GoopBuff_ArcanaOverwhelming", "en": "Arcana Overwhelming", "zh": "奥术浩荡"},
  {"apiName": "TFT13_GoopBuff_AvalancheofArmor", "en": "Avalanche of Armor", "zh": "护甲山崩"},
  {"apiName": "TFT13_GoopBuff_BerserkerRage", "en": "Berserker Rage", "zh": "狂战之怒"},
  {"apiName": "TFT13_GoopBuff_Bully", "en": "Bully", "zh": "恃强凌弱"},
  {"apiName": "TFT13_GoopBuff_ComebackStory", "en": "Comeback Story", "zh": "翻盘故事"},
  {"apiName": "TFT13_GoopBuff_Fortified", "en": "Fortified", "zh": "坚不可破"},
  {"apiName": "TFT13_GoopBuff_HardenedMind", "en": "Defense Expert", "zh": "防御专家"},
  {"apiName": "TFT13_GoopBuff_HeavyHitter", "en": "Heavy Hitter", "zh": "重量级打击手"},
  {"apiName": "TFT13_GoopBuff_LaserEyes", "en": "Laser Eyes", "zh": "镭射眼"},
  {"apiName": "TFT13_GoopBuff_LegacyOfShurima", "en": "Legacy Of Shurima", "zh": "恕瑞玛的传承"},
  {"apiName": "TFT13_GoopBuff_MagicTraining", "en": "Magic Training", "zh": "魔法训练"},
  {"apiName": "TFT13_GoopBuff_PowerAbsorption", "en": "Power Absorption", "zh": "攻击吸收"},
  {"apiName": "TFT13_GoopBuff_ShouldertheBurden", "en": "Protective Shielding", "zh": "防御型护盾"},
  {"apiName": "TFT13_GoopBuff_OneThousandCuts", "en": "One Thousand Cuts", "zh": "千刀斩"},
  {"apiName": "TFT13_GoopBuff_SlimeTime", "en": "Slime Time", "zh": "史莱姆时间"},
  {"apiName": "TFT13_GoopBuff_SlowCooker", "en": "Slow Cooker", "zh": "慢炖"},
  {"apiName": "TFT13_GoopBuff_SharpenedMind", "en": "Attack Expert", "zh": "物理专家"},
  {"apiName": "TFT13_GoopBuff_MagicMind", "en": "Magic Expert", "zh": "魔法专家"},
  {"apiName": "TFT13_GoopBuff_Bulwark", "en": "Bulwark", "zh": "壁垒"},
  {"apiName": "TFT13_GoopBuff_Freestyling", "en": "Freestyling", "zh": "即兴发挥"},
  {"apiName": "TFT13_GoopBuff_EnergyAbsorption", "en": "Energy Absorption", "zh": "法强吸收"},
  {"apiName": "TFT13_GoopBuff_GiantSized", "en": "Giant-Sized", "zh": "巨人体型"},
  {"apiName": "TFT13_GoopBuff_DeepRoots", "en": "Deep Roots", "zh": "根深蒂固"},
  {"apiName": "TFT13_GoopBuff_EagleEye", "en": "Eagle Eye", "zh": "鹰眼"},
  {"apiName": "TFT13_GoopBuff_AllForOne", "en": "Force of Friendship", "zh": "友谊之力"},
  {"apiName": "TFT13_GoopBuff_Hypervelocity", "en": "Hypervelocity", "zh": "超高速"},
  {"apiName": "TFT13_GoopBuff_StrengthTraining", "en": "Strength Training", "zh": "力量训练"},
];
/** S13 anomalies added after G2-3 (zh_CN client names); kept apart so the G2-3 table stays at its 30 rows. */
export const S13_EXTRA_ANOMALIES: readonly G23Name[] = [
  {"apiName": "TFT13_GoopBuff_AvariceIncarnate", "en": "Avarice Incarnate", "zh": "贪财化身"},
  {"apiName": "TFT13_GoopBuff_Headhunter", "en": "Headhunter", "zh": "猎头者"},
  {"apiName": "TFT13_GoopBuff_UltimateHero", "en": "Ultimate Hero", "zh": "终极英雄"},
  {"apiName": "TFT13_GoopBuff_IntoTheUnknown", "en": "Into the Unknown", "zh": "进入未知"},
  {"apiName": "TFT13_GoopBuff_CenteroftheUniverse", "en": "Center of the Universe", "zh": "星原之准"},
  {"apiName": "TFT13_GoopBuff_CertainDeath", "en": "Diving In", "zh": "深入敌阵"},
  {"apiName": "TFT13_GoopBuff_DeftHands", "en": "Mini Mees", "zh": "小我多多"},
  {"apiName": "TFT13_GoopBuff_DramaticEntrance", "en": "Dramatic Entrance", "zh": "震撼登场"},
  {"apiName": "TFT13_GoopBuff_EvenInDeath", "en": "Last Chance", "zh": "最后机会"},
  {"apiName": "TFT13_GoopBuff_HungerForPower", "en": "Hunger For Power", "zh": "渴望能量"},
  {"apiName": "TFT13_GoopBuff_Invisibility", "en": "Invisibility", "zh": "隐形"},
  {"apiName": "TFT13_GoopBuff_Repulsor", "en": "Repulsor", "zh": "斥力发生器"},
  {"apiName": "TFT13_GoopBuff_ScuttleFamiliar", "en": "Scuttle Familiar", "zh": "真的会蟹"},
  {"apiName": "TFT13_GoopBuff_UnstoppableForce", "en": "Unstoppable Force", "zh": "势不可挡"},
  {"apiName": "TFT13_GoopBuff_WolfFamiliars", "en": "Wolf Familiars", "zh": "双狼佣兽"},
  {"apiName": "TFT13_GoopBuff_DualWielding", "en": "Dual Wielding", "zh": "双刀流"},
  {"apiName": "TFT13_GoopBuff_ShareYourEnergy", "en": "Share Your Energy", "zh": "分享你的能量"},
  {"apiName": "TFT13_GoopBuff_CullTheWeak", "en": "Cull The Weak", "zh": "剔除弱者"},
  {"apiName": "TFT13_GoopBuff_Stoneskin", "en": "Stoneskin", "zh": "石头皮肤"},
  // P3 names from the archived 14.24 stringtables.
  {"apiName": "TFT13_GoopBuff_TheFinisher", "en": "The Finisher", "zh": "终结者"},
  {"apiName": "TFT13_GoopBuff_TouchofFrost", "en": "Touch of Frost", "zh": "冰霜触摸"},
  {"apiName": "TFT13_GoopBuff_Fireball", "en": "Fireball", "zh": "火球"},
  {"apiName": "TFT13_GoopBuff_Dragonsoul", "en": "Dragonsoul", "zh": "龙魂"},
  {"apiName": "TFT13_GoopBuff_NothingWasted", "en": "Nothing Wasted", "zh": "绝不浪费"},
  {"apiName": "TFT13_GoopBuff_Thornskin", "en": "Thornskin", "zh": "荆棘满途"},
  {"apiName": "TFT13_GoopBuff_Knockout", "en": "Knockout", "zh": "地下拳王"},
];
/** apiNames that ship an icon, per kind; the file is public/assets/s13/g23/<kind>/<apiName lowercased>.png (see g23IconPath).
 * Byte counts and SHA-256 per file live in s13-g23-asset-checks.ts, which only tests import, so they stay out of the bundle. */
export const G23_ICONS: Readonly<Record<G23ProfileIconKind, readonly string[]>> = {
  champions: ["TFT13_RenataGlasc", "TFT13_Cassiopeia", "TFT13_NunuWillump", "TFT13_Chainsaw", "TFT13_Gremlin", "TFT13_DrMundo", "TFT13_Elise", "TFT13_Silco", "TFT13_Lieutenant", "TFT13_Jayce", "TFT13_Gangplank", "TFT13_JayceSummon", "TFT13_GangplankBarrel", "TFT13_Sion", "TFT13_SwainDemonForm", "TFT13_EliseSpider", "TFT13_Silco_Monstrosity"],
  traits: ["TFT13_FormSwapper", "TFT13_Ambusher", "TFT13_Invoker", "TFT13_HighRoller", "TFT13_Crime", "TFT13_Infused", "TFT13_Pugilist", "TFT13_Experiment", "TFT13_Bruiser", "TFT13_JunkerKing", "TFT13_Cabal", "TFT13_Challenger"],
  anomalies: ["TFT13_GoopItem_Icon"],
};
export const g23IconPath = (kind: G23IconKind, apiName: string): string => `assets/s13/g23/${kind}/${apiName.toLowerCase()}.png`;

