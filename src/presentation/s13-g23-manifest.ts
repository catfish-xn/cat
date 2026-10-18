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
 * cdragon/tft/zh_cn.json 14.24 (kinds `artifacts` and `support`).
 * Per-file byte counts and SHA-256 checks: s13-g23-asset-checks.ts.
 */
export interface G23Name { readonly apiName: string; readonly en: string; readonly zh: string | null }
export type G23IconKind = 'champions' | 'traits' | 'items' | 'anomalies' | 'loot' | 'artifacts' | 'support';
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
/**
 * Radiant (光明) version of each of the 36 completed items, keyed by the base item apiName. Five base items use an older
 * internal name, so their radiant apiName does not follow `TFT5_Item_<base>Radiant`; each of those pairings was checked
 * against the radiant description (e.g. Willbreaker = TrapClawRadiant carries the Guardbreaker text with doubled values).
 */
export const G23_RADIANT_ITEMS: readonly (G23Name & { readonly base: string })[] = [
  {"base": "TFT_Item_Bloodthirster", "apiName": "TFT5_Item_BloodthirsterRadiant", "en": "Blessed Bloodthirster", "zh": "福佑饮血剑"},
  {"base": "TFT_Item_GuardianAngel", "apiName": "TFT5_Item_GuardianAngelRadiant", "en": "Brink of Dawn", "zh": "黎明锋刃"},
  {"base": "TFT_Item_InfinityEdge", "apiName": "TFT5_Item_InfinityEdgeRadiant", "en": "Zenith Edge", "zh": "天顶锋刃"},
  {"base": "TFT_Item_MadredsBloodrazor", "apiName": "TFT5_Item_GiantSlayerRadiant", "en": "Demonslayer", "zh": "恶魔杀手"},
  {"base": "TFT_Item_SteraksGage", "apiName": "TFT5_Item_SteraksGageRadiant", "en": "Sterak's Megashield", "zh": "斯特拉克的究极盾牌"},
  {"base": "TFT_Item_LastWhisper", "apiName": "TFT5_Item_LastWhisperRadiant", "en": "Eternal Whisper", "zh": "永恒轻语"},
  {"base": "TFT_Item_Leviathan", "apiName": "TFT5_Item_LeviathanRadiant", "en": "The Baron's Gift", "zh": "男爵赠礼"},
  {"base": "TFT_Item_RapidFireCannon", "apiName": "TFT5_Item_RapidFirecannonRadiant", "en": "Crest of Cinders", "zh": "余烬之冠"},
  {"base": "TFT_Item_RunaansHurricane", "apiName": "TFT5_Item_RunaansHurricaneRadiant", "en": "Runaan's Tempest", "zh": "卢安娜的风暴"},
  {"base": "TFT_Item_StatikkShiv", "apiName": "TFT5_Item_StatikkShivRadiant", "en": "Statikk's Favor", "zh": "斯塔缇克狂热"},
  {"base": "TFT_Item_TitansResolve", "apiName": "TFT5_Item_TitansResolveRadiant", "en": "Titan's Vow", "zh": "泰坦的誓言"},
  {"base": "TFT_Item_Crownguard", "apiName": "TFT5_Item_CrownguardRadiant", "en": "Royal Crownshield", "zh": "皇家冕盾"},
  {"base": "TFT_Item_IonicSpark", "apiName": "TFT5_Item_IonicSparkRadiant", "en": "Covalent Spark", "zh": "神圣离子火花"},
  {"base": "TFT_Item_JeweledGauntlet", "apiName": "TFT5_Item_JeweledGauntletRadiant", "en": "Glamorous Gauntlet", "zh": "圣洁珠光护手"},
  {"base": "TFT_Item_Morellonomicon", "apiName": "TFT5_Item_MorellonomiconRadiant", "en": "More More-ellonomicon", "zh": "莫雷洛圣典"},
  {"base": "TFT_Item_AdaptiveHelm", "apiName": "TFT5_Item_AdaptiveHelmRadiant", "en": "Jak'sho the Protean", "zh": "千变者贾修"},
  {"base": "TFT_Item_BlueBuff", "apiName": "TFT5_Item_BlueBuffRadiant", "en": "Blue Blessing", "zh": "圣蓝祝福"},
  {"base": "TFT_Item_FrozenHeart", "apiName": "TFT5_Item_FrozenHeartRadiant", "en": "Bulwark's Oath", "zh": "壁垒的誓言"},
  {"base": "TFT_Item_Redemption", "apiName": "TFT5_Item_RedemptionRadiant", "en": "Absolution", "zh": "赦除"},
  {"base": "TFT_Item_UnstableConcoction", "apiName": "TFT5_Item_HandOfJusticeRadiant", "en": "Fist of Fairness", "zh": "绝对正义之拳"},
  {"base": "TFT_Item_BrambleVest", "apiName": "TFT5_Item_BrambleVestRadiant", "en": "Rosethorn Vest", "zh": "瑰刺背心"},
  {"base": "TFT_Item_NightHarvester", "apiName": "TFT5_Item_NightHarvesterRadiant", "en": "Legacy of the Colossus", "zh": "巨像的传承"},
  {"base": "TFT_Item_RedBuff", "apiName": "TFT5_Item_SunfireCapeRadiant", "en": "Sunlight Cape", "zh": "日光斗篷"},
  {"base": "TFT_Item_Quicksilver", "apiName": "TFT5_Item_QuicksilverRadiant", "en": "Quickestsilver", "zh": "至速水银"},
  {"base": "TFT_Item_SpectralGauntlet", "apiName": "TFT5_Item_SpectralGauntletRadiant", "en": "Equinox", "zh": "星体结界"},
  {"base": "TFT_Item_PowerGauntlet", "apiName": "TFT5_Item_TrapClawRadiant", "en": "Willbreaker", "zh": "意志破坏者"},
  {"base": "TFT_Item_ThiefsGloves", "apiName": "TFT5_Item_ThiefsGlovesRadiant", "en": "Rascal's Gloves", "zh": "光明窃贼手套"},
  {"base": "TFT_Item_GuinsoosRageblade", "apiName": "TFT5_Item_GuinsoosRagebladeRadiant", "en": "Guinsoo's Reckoning", "zh": "鬼索的清算"},
  {"base": "TFT_Item_Deathblade", "apiName": "TFT5_Item_DeathbladeRadiant", "en": "Luminous Deathblade", "zh": "光辉之刃"},
  {"base": "TFT_Item_SpearOfShojin", "apiName": "TFT5_Item_SpearOfShojinRadiant", "en": "Spear of Hirana", "zh": "希拉娜之矛"},
  {"base": "TFT_Item_ArchangelsStaff", "apiName": "TFT5_Item_ArchangelsStaffRadiant", "en": "Urf-Angel's Staff", "zh": "阿福天使之杖"},
  {"base": "TFT_Item_RabadonsDeathcap", "apiName": "TFT5_Item_RabadonsDeathcapRadiant", "en": "Rabadon's Ascended Deathcap", "zh": "灭世者的飞升之帽"},
  {"base": "TFT_Item_WarmogsArmor", "apiName": "TFT5_Item_WarmogsArmorRadiant", "en": "Warmog's Pride", "zh": "狂徒之傲"},
  {"base": "TFT_Item_DragonsClaw", "apiName": "TFT5_Item_DragonsClawRadiant", "en": "Dragon's Will", "zh": "巨龙意志"},
  {"base": "TFT_Item_GargoyleStoneplate", "apiName": "TFT5_Item_GargoyleStoneplateRadiant", "en": "Dvarapala Stoneplate", "zh": "天神石板甲"},
  {"base": "TFT_Item_HextechGunblade", "apiName": "TFT5_Item_HextechGunbladeRadiant", "en": "Hextech Lifeblade", "zh": "海克斯科技生命之刃"},
];
/**
 * conqueror: rewards named by map22 ArmoryContent_TFT13_Warband_Cashout*; chembaron: every TFT13_Crime_* / TFT13_ChampionItem_*
 * item (black market loot, Chem-Baron equipment, shimmer consumables); junkerking: the Junker King armory upgrades.
 */
export const G23_LOOT: readonly (G23Name & { readonly group: G23LootGroup })[] = [
  {"apiName": "TFT_Item_ThiefsGloves", "en": "Thief's Gloves", "zh": "窃贼手套", "group": "conqueror"},
  {"apiName": "TFT11_Item_ThiefsGlovesSupport", "en": "Accomplice's Gloves", "zh": "辅助手套", "group": "conqueror"},
  {"apiName": "TFT_Item_ForceOfNature", "en": "Tactician's Crown", "zh": "金铲铲冠冕", "group": "conqueror"},
  {"apiName": "TFT_Item_Chalice", "en": "Chalice of Power", "zh": "能量圣杯", "group": "conqueror"},
  {"apiName": "TFT_Item_LocketOfTheIronSolari", "en": "Locket of the Iron Solari", "zh": "钢铁烈阳之匣", "group": "conqueror"},
  {"apiName": "TFT_Item_ZekesHerald", "en": "Zeke's Herald", "zh": "基克的先驱", "group": "conqueror"},
  {"apiName": "TFT_Consumable_ChampionDuplicator_III", "en": "Lesser Champion Duplicator", "zh": "次级英雄复制器", "group": "conqueror"},
  {"apiName": "TFT_Consumable_ItemRemover", "en": "Magnetic Remover", "zh": "装备拆卸器", "group": "conqueror"},
  {"apiName": "TFT_Consumable_ItemReroller", "en": "Reforger", "zh": "装备重铸器", "group": "conqueror"},
  {"apiName": "TFT_Consumable_MasterworkUpgrade", "en": "Masterwork Upgrade", "zh": "杰作升级", "group": "conqueror"},
  {"apiName": "TFT_ArmoryKeyCompleted", "en": "Completed Item Anvil", "zh": "成装锻造器", "group": "conqueror"},
  {"apiName": "TFT_ArmoryKeyOrnn", "en": "Artifact Item Anvil", "zh": "神器装备锻造器", "group": "conqueror"},
  {"apiName": "TFT_ArmoryKeySupport", "en": "Support item anvil", "zh": "辅助装锻造器", "group": "conqueror"},
  {"apiName": "TFT13_ChampionItem_Chainsaw", "en": "1-star Renni", "zh": "1星【荏妮】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Chainsaw_2Star", "en": "2-star Renni", "zh": "2星【荏妮】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Chainsaw_3Star", "en": "3-star Renni", "zh": "3星【荏妮】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Gremlin", "en": "1-star Smeech", "zh": "1星【史密奇】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Gremlin_2Star", "en": "2-star Smeech", "zh": "2星【史密奇】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Gremlin_3Star", "en": "3-star Smeech", "zh": "3星【史密奇】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Lieutenant", "en": "1-star Sevika", "zh": "1星【塞薇卡】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Lieutenant_2Star", "en": "2-star Sevika", "zh": "2星【塞薇卡】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Lieutenant_3Star", "en": "3-star Sevika", "zh": "3星【塞薇卡】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_RenataGlasc", "en": "1-star Renata Glasc", "zh": "1星【烈娜塔】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_RenataGlasc_2Star", "en": "2-star Renata Glasc", "zh": "2星【烈娜塔】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_RenataGlasc_3Star", "en": "3-star Renata Glasc", "zh": "3星【烈娜塔】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Silco", "en": "1-star Silco", "zh": "1星【希尔科】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Silco_2Star", "en": "2-star Silco", "zh": "2星【希尔科】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Silco_3Star", "en": "3-star Silco", "zh": "3星【希尔科】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Singed", "en": "1-star Singed", "zh": "1星【辛吉德】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Singed_2Star", "en": "2-star Singed", "zh": "2星【辛吉德】", "group": "chembaron"},
  {"apiName": "TFT13_ChampionItem_Singed_3Star", "en": "3-star Singed", "zh": "3星【辛吉德】", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Bronze_ChemGrips", "en": "Salvaged Contraption", "zh": "回收装置", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Bronze_MageGuard", "en": "Salvaged Revolver", "zh": "回收左轮枪", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Bronze_MiningGauntlet", "en": "Salvaged Gauntlet", "zh": "回收护手", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Consumable_LesserShimmerDuplicator", "en": "Lesser Shimmer Duplicator", "zh": "次级微光复制器", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Consumable_PerfectedShimmer", "en": "Perfected Shimmer", "zh": "完美微光", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Consumable_ShimmerDuplicator", "en": "Shimmer Duplicator", "zh": "微光复制器", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Gold", "en": "Gold", "zh": "金币", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Gold_DestabilizedChemtank", "en": "Destabilized Chemtank II", "zh": "失稳炼金罐 II", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Gold_ExecutionersVorpalblade", "en": "Executioner's Chainblade II", "zh": "行刑官链锯刃 II", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Gold_FleshRipper", "en": "Flesh Ripper II", "zh": "裂肉者 II", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Gold_PiltovenHexplating", "en": "Piltoven Hexarmor II", "zh": "皮城海克斯护甲 II", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Gold_ShimmerBloom", "en": "Shimmer Bloom II", "zh": "微光绽放 II", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Gold_UnleashedToxins", "en": "Unleashed Toxins II", "zh": "毒素倾泻 II", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Gold_VirulentVirus", "en": "Virulent Virus II", "zh": "烈性病毒 II", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Gold_VoltaicSaber", "en": "Voltaic Saber II", "zh": "电震军刀 II", "group": "chembaron"},
  {"apiName": "TFT13_Crime_OmegaPrismatic_DimensionalHeirloom", "en": "Dimensional Heirloom", "zh": "高维传家宝", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Prismatic_DestabilizedChemtank", "en": "Perfected Destabilized Chemtank", "zh": "完美失稳炼金罐", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Prismatic_ExecutionersVorpalblade", "en": "Perfected Executioner's Chainblade", "zh": "完美行刑官链锯刃", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Prismatic_FleshRipper", "en": "Perfected Flesh Ripper", "zh": "完美裂肉者", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Prismatic_PiltovenHexplating", "en": "Perfected Piltoven Hexarmor", "zh": "完美皮城海克斯护甲", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Prismatic_ShimmerBloom", "en": "Perfected Shimmer Bloom", "zh": "完美微光绽放", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Prismatic_UnleashedToxins", "en": "Perfected Unleashed Toxins", "zh": "完美毒素倾泻", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Prismatic_VirulentVirus", "en": "Perfected Virulent Virus", "zh": "完美烈性病毒", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Prismatic_VoltaicSaber", "en": "Perfected Voltaic Saber", "zh": "完美电震军刀", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Silver_DestabilizedChemtank", "en": "Destabilized Chemtank", "zh": "失稳炼金罐", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Silver_ExecutionersVorpalblade", "en": "Executioner's Chainblade", "zh": "行刑官链锯刃", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Silver_FleshRipper", "en": "Flesh Ripper", "zh": "裂肉者", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Silver_PiltovenHexplating", "en": "Piltoven Hexarmor", "zh": "皮城海克斯护甲", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Silver_ShimmerBloom", "en": "Shimmer Bloom", "zh": "微光绽放", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Silver_UnleashedToxins", "en": "Unleashed Toxins", "zh": "毒素倾泻", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Silver_VirulentVirus", "en": "Virulent Virus", "zh": "烈性病毒", "group": "chembaron"},
  {"apiName": "TFT13_Crime_Silver_VoltaicSaber", "en": "Voltaic Saber", "zh": "电震军刀", "group": "chembaron"},
  {"apiName": "TFT13_Item_Crime_ArmoryCashout", "en": "Convert to Vials", "zh": "转换为药瓶", "group": "chembaron"},
  {"apiName": "TFT13_Item_Crime_ArmoryContinue", "en": "Continue", "zh": "继续", "group": "chembaron"},
  {"apiName": "TFT13_JunkerKing_3Star", "en": "Junkyard Titan!", "zh": "机械重组！", "group": "junkerking"},
  {"apiName": "TFT13_JunkerKing_Flamethrower", "en": "Flamethrower", "zh": "喷火器", "group": "junkerking"},
  {"apiName": "TFT13_JunkerKing_Pass", "en": "Spare Parts!", "zh": "备用零件！", "group": "junkerking"},
  {"apiName": "TFT13_JunkerKing_PertriciteRod", "en": "Petricite Rod", "zh": "禁魔杵", "group": "junkerking"},
  {"apiName": "TFT13_JunkerKing_RepairingMicrobots", "en": "Repairing Microbots", "zh": "微型维修机器人", "group": "junkerking"},
  {"apiName": "TFT13_JunkerKing_SelfDestructButton", "en": "Self Destruct Button", "zh": "自毁按钮", "group": "junkerking"},
  {"apiName": "TFT13_JunkerKing_SuperPass", "en": "Finishing Touch!", "zh": "画龙点睛！", "group": "junkerking"},
  {"apiName": "TFT13_JunkerKing_Tankbuster", "en": "Tankbuster", "zh": "坦克克星", "group": "junkerking"},
];
/**
 * G2-4b support items whose content name is still the English client string (g2-4-support-items.ts); the UI shows the
 * 14.24 zh_cn client name instead. Artifacts need no table: their content names already equal the zh_cn client names.
 * Names from cdragon/tft/zh_cn.json and en_us.json 14.24.
 */
export const G24_SUPPORT_ITEMS: readonly G23Name[] = [
  {"apiName": "TFT4_Item_OrnnRanduinsSanctum", "en": "Randuin's Omen", "zh": "兰顿之兆"},
  {"apiName": "TFT4_Item_OrnnObsidianCleaver", "en": "Obsidian Cleaver", "zh": "黑曜石切割者"},
  {"apiName": "TFT_Item_AegisOfTheLegion", "en": "Aegis of the Legion", "zh": "军团圣盾"},
  {"apiName": "TFT_Item_RadiantVirtue", "en": "Virtue of the Martyr", "zh": "殉道美德"},
  {"apiName": "TFT7_Item_ShimmerscaleHeartOfGold", "en": "Needlessly Big Gem", "zh": "无用大宝石"},
  {"apiName": "TFT_Item_BansheesVeil", "en": "Banshee's Veil", "zh": "女妖面纱"},
  {"apiName": "TFT_Item_EternalFlame", "en": "The Eternal Flame", "zh": "永恒烈焰"},
  {"apiName": "TFT_Item_SupportKnightsVow", "en": "Knight's Vow", "zh": "骑士之誓"},
  {"apiName": "TFT_Item_Moonstone", "en": "Moonstone Renewer", "zh": "月石再生器"},
  {"apiName": "TFT_Item_Spite", "en": "Spite", "zh": "恶意"},
  {"apiName": "TFT_Item_UnstableTreasureChest", "en": "Unstable Treasure Chest", "zh": "不稳定的财宝箱"},
];
/** apiNames that ship an icon, per kind; the file is public/assets/s13/g23/<kind>/<apiName lowercased>.png (see g23IconPath).
 * Byte counts and SHA-256 per file live in s13-g23-asset-checks.ts, which only tests import, so they stay out of the bundle. */
export const G23_ICONS: Readonly<Record<G23IconKind, readonly string[]>> = {
  champions: ["TFT13_RenataGlasc", "TFT13_Cassiopeia", "TFT13_NunuWillump", "TFT13_Chainsaw", "TFT13_Gremlin", "TFT13_DrMundo", "TFT13_Elise", "TFT13_Silco", "TFT13_Lieutenant", "TFT13_Jayce", "TFT13_Gangplank", "TFT13_JayceSummon", "TFT13_GangplankBarrel", "TFT13_Sion", "TFT13_SwainDemonForm", "TFT13_EliseSpider", "TFT13_Silco_Monstrosity"],
  traits: ["TFT13_FormSwapper", "TFT13_Ambusher", "TFT13_Invoker", "TFT13_HighRoller", "TFT13_Crime", "TFT13_Infused", "TFT13_Pugilist", "TFT13_Experiment", "TFT13_Bruiser", "TFT13_JunkerKing", "TFT13_Cabal", "TFT13_Challenger"],
  items: ["TFT5_Item_BloodthirsterRadiant", "TFT5_Item_GuardianAngelRadiant", "TFT5_Item_InfinityEdgeRadiant", "TFT5_Item_GiantSlayerRadiant", "TFT5_Item_SteraksGageRadiant", "TFT5_Item_LastWhisperRadiant", "TFT5_Item_LeviathanRadiant", "TFT5_Item_RapidFirecannonRadiant", "TFT5_Item_RunaansHurricaneRadiant", "TFT5_Item_StatikkShivRadiant", "TFT5_Item_TitansResolveRadiant", "TFT5_Item_CrownguardRadiant", "TFT5_Item_IonicSparkRadiant", "TFT5_Item_JeweledGauntletRadiant", "TFT5_Item_MorellonomiconRadiant", "TFT5_Item_AdaptiveHelmRadiant", "TFT5_Item_BlueBuffRadiant", "TFT5_Item_FrozenHeartRadiant", "TFT5_Item_RedemptionRadiant", "TFT5_Item_HandOfJusticeRadiant", "TFT5_Item_BrambleVestRadiant", "TFT5_Item_NightHarvesterRadiant", "TFT5_Item_SunfireCapeRadiant", "TFT5_Item_QuicksilverRadiant", "TFT5_Item_SpectralGauntletRadiant", "TFT5_Item_TrapClawRadiant", "TFT5_Item_ThiefsGlovesRadiant", "TFT5_Item_GuinsoosRagebladeRadiant", "TFT5_Item_DeathbladeRadiant", "TFT5_Item_SpearOfShojinRadiant", "TFT5_Item_ArchangelsStaffRadiant", "TFT5_Item_RabadonsDeathcapRadiant", "TFT5_Item_WarmogsArmorRadiant", "TFT5_Item_DragonsClawRadiant", "TFT5_Item_GargoyleStoneplateRadiant", "TFT5_Item_HextechGunbladeRadiant"],
  anomalies: ["TFT13_GoopItem_Icon"],
  loot: ["TFT11_Item_ThiefsGlovesSupport", "TFT_Item_ForceOfNature", "TFT_Item_Chalice", "TFT_Item_LocketOfTheIronSolari", "TFT_Item_ZekesHerald", "TFT_Consumable_ChampionDuplicator_III", "TFT_Consumable_ItemRemover", "TFT_Consumable_ItemReroller", "TFT_Consumable_MasterworkUpgrade", "TFT_ArmoryKeyCompleted", "TFT_ArmoryKeyOrnn", "TFT_ArmoryKeySupport", "TFT13_ChampionItem_Chainsaw", "TFT13_ChampionItem_Chainsaw_2Star", "TFT13_ChampionItem_Chainsaw_3Star", "TFT13_ChampionItem_Gremlin", "TFT13_ChampionItem_Gremlin_2Star", "TFT13_ChampionItem_Gremlin_3Star", "TFT13_ChampionItem_Lieutenant", "TFT13_ChampionItem_Lieutenant_2Star", "TFT13_ChampionItem_Lieutenant_3Star", "TFT13_ChampionItem_RenataGlasc", "TFT13_ChampionItem_RenataGlasc_2Star", "TFT13_ChampionItem_RenataGlasc_3Star", "TFT13_ChampionItem_Silco", "TFT13_ChampionItem_Silco_2Star", "TFT13_ChampionItem_Silco_3Star", "TFT13_ChampionItem_Singed", "TFT13_ChampionItem_Singed_2Star", "TFT13_ChampionItem_Singed_3Star", "TFT13_Crime_Bronze_ChemGrips", "TFT13_Crime_Bronze_MageGuard", "TFT13_Crime_Bronze_MiningGauntlet", "TFT13_Crime_Consumable_LesserShimmerDuplicator", "TFT13_Crime_Consumable_PerfectedShimmer", "TFT13_Crime_Consumable_ShimmerDuplicator", "TFT13_Crime_Gold", "TFT13_Crime_Gold_DestabilizedChemtank", "TFT13_Crime_Gold_ExecutionersVorpalblade", "TFT13_Crime_Gold_FleshRipper", "TFT13_Crime_Gold_PiltovenHexplating", "TFT13_Crime_Gold_ShimmerBloom", "TFT13_Crime_Gold_UnleashedToxins", "TFT13_Crime_Gold_VirulentVirus", "TFT13_Crime_Gold_VoltaicSaber", "TFT13_Crime_OmegaPrismatic_DimensionalHeirloom", "TFT13_Crime_Prismatic_DestabilizedChemtank", "TFT13_Crime_Prismatic_ExecutionersVorpalblade", "TFT13_Crime_Prismatic_FleshRipper", "TFT13_Crime_Prismatic_PiltovenHexplating", "TFT13_Crime_Prismatic_ShimmerBloom", "TFT13_Crime_Prismatic_UnleashedToxins", "TFT13_Crime_Prismatic_VirulentVirus", "TFT13_Crime_Prismatic_VoltaicSaber", "TFT13_Crime_Silver_DestabilizedChemtank", "TFT13_Crime_Silver_ExecutionersVorpalblade", "TFT13_Crime_Silver_FleshRipper", "TFT13_Crime_Silver_PiltovenHexplating", "TFT13_Crime_Silver_ShimmerBloom", "TFT13_Crime_Silver_UnleashedToxins", "TFT13_Crime_Silver_VirulentVirus", "TFT13_Crime_Silver_VoltaicSaber", "TFT13_Item_Crime_ArmoryCashout", "TFT13_Item_Crime_ArmoryContinue", "TFT13_JunkerKing_3Star", "TFT13_JunkerKing_Flamethrower", "TFT13_JunkerKing_Pass", "TFT13_JunkerKing_PertriciteRod", "TFT13_JunkerKing_RepairingMicrobots", "TFT13_JunkerKing_SelfDestructButton", "TFT13_JunkerKing_SuperPass", "TFT13_JunkerKing_Tankbuster", "TFT_Assist_Gold"],
  artifacts: ["TFT4_Item_OrnnAnimaVisage", "TFT4_Item_OrnnInfinityForce", "TFT4_Item_OrnnZhonyasParadox", "TFT9_Item_OrnnDeathfireGrasp", "TFT_Item_Artifact_TalismanOfAscension", "TFT_Item_Artifact_Mittens", "TFT_Item_Artifact_RapidFirecannon", "TFT_Item_Artifact_SeekersArmguard", "TFT_Item_Artifact_SilvermereDawn", "TFT9_Item_OrnnHorizonFocus", "TFT9_Item_OrnnHullbreaker", "TFT_Item_Artifact_HorizonFocus", "TFT_Item_Artifact_UnendingDespair", "TFT_Item_Artifact_InnervatingLocket", "TFT4_Item_OrnnMuramana", "TFT_Item_Artifact_LudensTempest", "TFT_Item_Artifact_BlightingJewel", "TFT_Item_Artifact_LightshieldCrest", "TFT_Item_Artifact_ProwlersClaw", "TFT_Item_Artifact_WitsEnd", "TFT_Item_Artifact_LichBane"],
  support: ["TFT4_Item_OrnnRanduinsSanctum", "TFT4_Item_OrnnObsidianCleaver", "TFT_Item_AegisOfTheLegion", "TFT_Item_RadiantVirtue", "TFT7_Item_ShimmerscaleHeartOfGold", "TFT_Item_BansheesVeil", "TFT_Item_EternalFlame", "TFT_Item_SupportKnightsVow", "TFT_Item_Moonstone", "TFT_Item_Spite", "TFT_Item_UnstableTreasureChest"],
};
export const g23IconPath = (kind: G23IconKind, apiName: string): string => `assets/s13/g23/${kind}/${apiName.toLowerCase()}.png`;

