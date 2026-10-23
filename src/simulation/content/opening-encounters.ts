import { OPENING_BATCH_A } from './opening-batch-a';
import { freezeContent } from './freeze';
import { TRAINER_GOLEMS_POLICY } from './trainer-golems';

/** Local, read-only source: tft_s13_opening_encounters_14.24b.json (2026-10-22).
 * Every sourcePath below refers to that research JSON: id/portal_id/champion,
 * name_zh/name_en, weight (percent × 100), effects[0].description_zh/parameters/source_keys,
 * timing.effect_trigger_zh/stage_rounds, excluded_augments/portal_banned_augment_references.
 * Historical banned references do not expand the active augment pool. No network lookup or downloaded assets.
 * Internal rule IDs, enabled/readiness, PR mapping and conventions are project metadata.
 * User approved plan §§2–6,9 on 2026-10-22. null remains unknown, never zero.
 * enabled controls EFFECTS only; all sixteen entries always participate in selection.
 */
export const OPENING_ENCOUNTERS = freezeContent([
  {
    "id": "none",
    "encounterId": "TFT_OpeningEncounter_NoPortalA",
    "portalId": "TFT_Portals_Default_NoPortal",
    "champion": null,
    "nameZh": "没有奇遇",
    "nameEn": "No encounter",
    "weightBps": 1000,
    "enabled": true,
    "effectStatus": "no-additional-rules",
    "readiness": "ready-for-followup",
    "followupPr": 1,
    "descriptionZh": "本局没有开局奇遇附加效果。",
    "trigger": "本局不附加奇遇规则",
    "stageRounds": null,
    "researchParameters": {},
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [],
    "projectConventions": [],
    "sourcePath": "encounters[0]",
    "sourceKeys": [
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "scuttle-puddle",
    "encounterId": "TFT_OpeningEncounter_ScuttlePuddle",
    "portalId": "TFT_Portals_Unique_ScuttlePuddle",
    "champion": {
      "name_zh": "金克丝",
      "name_en": "Jinx"
    },
    "nameZh": "迅捷蟹水潭",
    "nameEn": "Scuttle Puddle",
    "weightBps": 750,
    "enabled": false,
    "effectStatus": "not-implemented",
    "readiness": "blocked-evidence",
    "followupPr": 7,
    "descriptionZh": "野怪替换为掉落额外战利品的迅捷蟹。",
    "trigger": "各野怪回合",
    "stageRounds": null,
    "researchParameters": {
      "replacement": "crabs",
      "bonus_loot_table": null,
      "combat_stats": null
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [
      "bonus_loot_table",
      "combat_stats"
    ],
    "projectConventions": [],
    "sourcePath": "encounters[1]",
    "sourceKeys": [
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "crab-rave",
    "encounterId": "TFT_OpeningEncounter_CrabRave",
    "portalId": "TFT_Portals_Unique_CrabRave",
    "champion": {
      "name_zh": "金克丝",
      "name_en": "Jinx"
    },
    "nameZh": "蟹之狂欢",
    "nameEn": "Crab Rave",
    "weightBps": 250,
    "enabled": false,
    "effectStatus": "not-implemented",
    "readiness": "blocked-evidence",
    "followupPr": 7,
    "descriptionZh": "野怪替换为带额外战利品的蟹；第 5 阶段及以后的蟹极其危险。",
    "trigger": "各野怪回合；第 5 阶段及以后强化危险性",
    "stageRounds": null,
    "researchParameters": {
      "dangerous_from_stage": 5,
      "bonus_loot_table": null,
      "combat_stats": null
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [
      "bonus_loot_table",
      "combat_stats"
    ],
    "projectConventions": [],
    "sourcePath": "encounters[2]",
    "sourceKeys": [
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "golden-gala",
    "encounterId": "TFT_OpeningEncounter_GoldAll",
    "portalId": "TFT_Portals_Augments_TripleGold",
    "champion": {
      "name_zh": "范德尔",
      "name_en": "Vander"
    },
    "nameZh": "金金金之旅",
    "nameEn": "Golden Gala",
    "weightBps": 1000,
    "enabled": true,
    "effectStatus": "active",
    "readiness": "ready-for-followup",
    "followupPr": 2,
    "descriptionZh": "三次强化选择均为黄金阶。",
    "trigger": "三次正常强化选择",
    "stageRounds": [
      "2-1",
      "3-2",
      "4-2"
    ],
    "researchParameters": {
      "augment_indices": [
        1,
        2,
        3
      ],
      "tier": "gold"
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [],
    "projectConventions": [],
    "sourcePath": "encounters[3]",
    "sourceKeys": [
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "prismatic-party",
    "encounterId": "TFT_OpeningEncounter_PrismaticAll",
    "portalId": "TFT_Portals_Augments_TriplePrismatic",
    "champion": {
      "name_zh": "艾克",
      "name_en": "Ekko"
    },
    "nameZh": "彩彩彩之旅",
    "nameEn": "Prismatic Party",
    "weightBps": 500,
    "enabled": true,
    "effectStatus": "active",
    "readiness": "ready-for-followup",
    "followupPr": 2,
    "descriptionZh": "三次强化选择均为棱彩阶。",
    "trigger": "三次正常强化选择",
    "stageRounds": [
      "2-1",
      "3-2",
      "4-2"
    ],
    "researchParameters": {
      "augment_indices": [
        1,
        2,
        3
      ],
      "tier": "prismatic"
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [],
    "projectConventions": [],
    "sourcePath": "encounters[4]",
    "sourceKeys": [
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "prismatic-prelude",
    "encounterId": "TFT_OpeningEncounter_PrismaticFirst",
    "portalId": "TFT_Portals_Augments_PrismaticFirst",
    "champion": {
      "name_zh": "黑默丁格",
      "name_en": "Heimerdinger"
    },
    "nameZh": "棱彩前奏",
    "nameEn": "Prismatic Prelude",
    "weightBps": 600,
    "enabled": true,
    "effectStatus": "active",
    "readiness": "ready-for-followup",
    "followupPr": 2,
    "descriptionZh": "第一次强化为棱彩阶；后两次的条件分布不能仅据此名称推断。",
    "trigger": "第一次正常强化选择",
    "stageRounds": [
      "2-1"
    ],
    "researchParameters": {
      "augment_indices": [
        1
      ],
      "tier": "prismatic",
      "other_augment_conditional_distribution": null
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [],
    "projectConventions": [
      "未强制节点沿现有等权档位约定；非官方条件分布"
    ],
    "sourcePath": "encounters[5]",
    "sourceKeys": [
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "prismatic-finale",
    "encounterId": "TFT_OpeningEncounter_PrismaticLast",
    "portalId": "TFT_Portals_Augments_PrismaticThird",
    "champion": {
      "name_zh": "黑默丁格",
      "name_en": "Heimerdinger"
    },
    "nameZh": "棱彩终章",
    "nameEn": "Prismatic Finale",
    "weightBps": 400,
    "enabled": true,
    "effectStatus": "active",
    "readiness": "ready-for-followup",
    "followupPr": 2,
    "descriptionZh": "最后一次强化为棱彩阶；前两次的条件分布待核实。",
    "trigger": "第三次正常强化选择",
    "stageRounds": [
      "4-2"
    ],
    "researchParameters": {
      "augment_indices": [
        3
      ],
      "tier": "prismatic",
      "other_augment_conditional_distribution": null
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [],
    "projectConventions": [
      "未强制节点沿现有等权档位约定；非官方条件分布"
    ],
    "sourcePath": "encounters[6]",
    "sourceKeys": [
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "gold-subscription",
    "encounterId": "TFT_OpeningEncounter_GoldSubscription",
    "portalId": "TFT_Portals_Gold_GoldSubscription",
    "champion": {
      "name_zh": "凯特琳",
      "name_en": "Caitlyn"
    },
    "nameZh": "金币订阅",
    "nameEn": "Gold Subscription",
    "weightBps": 400,
    "enabled": true,
    "effectStatus": "active",
    "readiness": "ready-for-followup",
    "followupPr": 3,
    "descriptionZh": "每阶段给所有玩家同额的随机金币。",
    "trigger": "每阶段发放",
    "stageRounds": null,
    "researchParameters": {
      "frequency": "each_stage",
      "shared_amount": true,
      "amount_by_stage_and_bucket": null,
      "raw_reward_bucket_weights_percent": {
        "XSmall": 15,
        "Small": 35,
        "Medium": 25,
        "Large": 23,
        "Giga": 2
      }
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [],
    "projectConventions": ["2026-10-23批准值；见OPENING_BATCH_A与批次报告"],
    "sourcePath": "encounters[7]",
    "sourceKeys": [
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "loot-subscription",
    "encounterId": "TFT_OpeningEncounter_LootSubscription",
    "portalId": "TFT_Portals_Unique_LootSubscription",
    "champion": {
      "name_zh": "塞薇卡",
      "name_en": "Sevika"
    },
    "nameZh": "战利品订阅",
    "nameEn": "Loot Subscription",
    "weightBps": 400,
    "enabled": true,
    "effectStatus": "active",
    "readiness": "ready-for-followup",
    "followupPr": 3,
    "descriptionZh": "每阶段从九类战利品中抽取奖励。",
    "trigger": "每阶段发放",
    "stageRounds": null,
    "researchParameters": {
      "frequency": "each_stage",
      "shared_loot_category": true,
      "random_unit_or_component_identity_shared": null,
      "outcomes": [
        {
          "weight": 14,
          "reward": "金铲铲",
          "count": 1
        },
        {
          "weight": 14,
          "reward": "神器锻造器",
          "count": 1
        },
        {
          "weight": 14,
          "reward": "随机基础装备",
          "count": 1
        },
        {
          "weight": 14,
          "reward": "金币",
          "formula": "stage * 5"
        },
        {
          "weight": 14,
          "reward": "二星弈子",
          "count": 1,
          "star_level": 2,
          "cost_formula_from_source": "stage - 1",
          "cost_cap": null
        },
        {
          "weight": 13,
          "reward": "辅助装锻造器",
          "count": 1
        },
        {
          "weight": 13,
          "reward": "装备重铸器",
          "count": 1
        },
        {
          "weight": 3,
          "reward": "Boot / 靴子",
          "count": 1,
          "exact_behavior": null
        },
        {
          "weight": 1,
          "reward": "金铲铲冠冕 / Tactician's Crown",
          "count": 1,
          "item_id": "TFT_Item_ForceOfNature"
        }
      ]
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [],
    "projectConventions": ["2026-10-23批准值；见OPENING_BATCH_A与批次报告"],
    "sourcePath": "encounters[8]",
    "sourceKeys": [
      "L03",
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "trainer-golems",
    "encounterId": "TFT_OpeningEncounter_WanderingTrainer",
    "portalId": "TFT_Portals_Unique_WanderingTrainers",
    "champion": {
      "name_zh": "安蓓萨",
      "name_en": "Ambessa"
    },
    "nameZh": "魔像训练师",
    "nameEn": "Trainer Golems",
    "weightBps": 400,
    "enabled": false,
    "effectStatus": "not-implemented",
    "readiness": "blocked-evidence",
    "followupPr": 4,
    "descriptionZh": "开局获得 1 个携带 3 个永久附着纹章的魔像。",
    "trigger": "开局获得",
    "stageRounds": null,
    "researchParameters": {
      "golem_count": 1,
      "permanently_attached_emblems": 3,
      "emblem_sampling_pool": null,
      "same_emblems_for_all_players": null
    },
    "excludedAugmentReferences": [
      {
        "id": "TFT_Augment_CookingPot",
        "name": {
          "en_us": "Cooking Pot",
          "zh_cn": "金色炊具"
        }
      }
    ],
    "portalBannedAugmentReferences": [
      {
        "id": "TFT9_Augment_OneHundredDuckSizedHorses",
        "name_zh": "无尽部落",
        "name_en": "Endless Hordes"
      },
      {
        "id": "TFT9_Augment_OneHundredDuckSizedHorsesPlus",
        "name_zh": "无尽部落+",
        "name_en": "Endless Hordes +"
      },
      {
        "id": "TFT6_Augment_Traitless3",
        "name_zh": "卓尔不群 III",
        "name_en": "Built Different III"
      },
      {
        "id": "TFT6_Augment_Traitless2",
        "name_zh": "卓尔不群",
        "name_en": "Built Different"
      },
      {
        "id": "TFT_Augment_TraitTracker",
        "name_zh": "羁绊追踪者",
        "name_en": "Trait Tracker"
      }
    ],
    "missingEvidence": TRAINER_GOLEMS_POLICY.missingEvidence,
    "projectConventions": [
      "各席独立抽三个不同可执行纹章；完整池与魔像数值仍待补证"
    ],
    "sourcePath": "encounters[9]",
    "sourceKeys": [
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "wind-up-monkey",
    "encounterId": "TFT13_Encounter_Powder_RandomMonkey",
    "portalId": "TFT_Portals_Unique_PowderMonkey",
    "champion": {
      "name_zh": "爆爆",
      "name_en": "Powder"
    },
    "nameZh": "发条猴子",
    "nameEn": "Wind-up Monkey",
    "weightBps": 500,
    "enabled": true,
    "effectStatus": "active",
    "readiness": "ready-for-followup",
    "followupPr": 5,
    "descriptionZh": "四种结果各 25%；14.24 普通模式未公告改变结果。",
    "trigger": "3-5 触发猴子事件",
    "stageRounds": [
      "3-5"
    ],
    "researchParameters": {
      "outcome_roll_scope": null,
      "outcomes": [
        {
          "weight": 25,
          "type": "player_damage",
          "amount": 10,
          "scope": "all_players"
        },
        {
          "weight": 25,
          "type": "gold",
          "amount": 25,
          "scope": "all_players"
        },
        {
          "weight": 25,
          "type": "masterwork_upgrade",
          "count": 1,
          "description": "对弈子使用，在武器库选择其携带的一件可合成成装，升级为对应光明版并卸下",
          "target": "champion",
          "eligible_item_kind": "craftable_completed_items",
          "opens_armory": true,
          "unequip_after_upgrade": true,
          "cross_player_result_identity": null
        },
        {
          "weight": 25,
          "type": "random_components",
          "count": 4,
          "cross_player_item_identity": null
        }
      ]
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [],
    "projectConventions": [
      "全局一次四分支抽样；伤害可致死并原子处理淘汰；工具选择及组件身份各席独立"
    ],
    "sourcePath": "encounters[10]",
    "sourceKeys": [
      "L02",
      "D01",
      "D02",
      "D03",
      "S03"
    ]
  },
  {
    "id": "component-anvils",
    "encounterId": "TFT_OpeningEncounter_ComponentAnvils",
    "portalId": "TFT_Portals_Items_ComponentAnvil",
    "champion": {
      "name_zh": "蔚",
      "name_en": "Vi"
    },
    "nameZh": "基础装备锻造器",
    "nameEn": "Component Anvils",
    "weightBps": 1000,
    "enabled": true,
    "effectStatus": "active",
    "readiness": "ready-for-followup",
    "followupPr": 2,
    "descriptionZh": "1-2 获得 2 个基础装备锻造器。",
    "trigger": "1-2 发放",
    "stageRounds": [
      "1-2"
    ],
    "researchParameters": {
      "anvil_type": "component",
      "count": 2,
      "stage": 1,
      "round": 2,
      "offered_options_per_anvil": null
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [],
    "projectConventions": [
      "每个锻造器四个不同候选，沿现有项目约定"
    ],
    "sourcePath": "encounters[11]",
    "sourceKeys": [
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "viktors-vision",
    "encounterId": "TFT13_Encounter_Anomaly_SixCosts",
    "portalId": "TFT_Portals_Unique_SixCosts",
    "champion": {
      "name_zh": "维克托",
      "name_en": "Viktor"
    },
    "nameZh": "维克托的愿景",
    "nameEn": "Viktor's Vision",
    "weightBps": 800,
    "enabled": true,
    "effectStatus": "active",
    "readiness": "ready-for-followup",
    "followupPr": 7,
    "descriptionZh": "六费弈子从 4-1 起可出现，出现概率为常态的 3 倍。",
    "trigger": "从 4-1 开始",
    "stageRounds": [
      "4-1"
    ],
    "researchParameters": {
      "start_stage": 4,
      "start_round": 1,
      "odds_multiplier": 3,
      "base_odds_table_14_24b": null,
      "applies_to": "all_six_cost_champions"
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [],
    "projectConventions": ["2026-10-23批准值；见OPENING_BATCH_A与批次报告"],
    "sourcePath": "encounters[12]",
    "sourceKeys": [
      "S03",
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "mels-blessing",
    "encounterId": "TFT13_Encounter_Mel_SupportAnvils",
    "portalId": "TFT_Portals_Unique_RadiantBlessing",
    "champion": {
      "name_zh": "梅尔",
      "name_en": "Mel"
    },
    "nameZh": "梅尔的赐福",
    "nameEn": "Mel's Blessing",
    "weightBps": 800,
    "enabled": true,
    "effectStatus": "active",
    "readiness": "ready-for-followup",
    "followupPr": 6,
    "descriptionZh": "到达文案所述 40 玩家生命值门槛时获得强力战利品。",
    "trigger": "与个人 40 玩家生命值门槛相关",
    "stageRounds": null,
    "researchParameters": {
      "health_threshold": 40,
      "comparison_operator": null,
      "reward_table": null,
      "reward_weights": null,
      "max_triggers_per_player": null,
      "known_b_patch_reward_override": {
        "reward": "金铲铲冠冕 / Tactician's Crown",
        "item_id": "TFT_Item_ForceOfNature",
        "old_count": 3,
        "new_count": 2,
        "applies_to": "one reward outcome; not every player's fixed reward"
      }
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [
      {
        "id": "TFT7_Augment_SacrificialPact",
        "name_zh": "恶魔契约",
        "name_en": "Cruel Pact"
      }
    ],
    "missingEvidence": [],
    "projectConventions": ["2026-10-23批准值；见OPENING_BATCH_A与批次报告"],
    "sourcePath": "encounters[13]",
    "sourceKeys": [
      "S03",
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "warwicks-hunger",
    "encounterId": "TFT13_Encounter_Warwick_Violence",
    "portalId": "TFT_Portals_Unique_WarwickHunt",
    "champion": {
      "name_zh": "沃里克",
      "name_en": "Warwick"
    },
    "nameZh": "沃里克的饥饿",
    "nameEn": "Warwick's Hunger",
    "weightBps": 800,
    "enabled": false,
    "effectStatus": "not-implemented",
    "readiness": "blocked-evidence",
    "followupPr": 6,
    "descriptionZh": "击杀敌方弈子时，沃里克有时吞噬尸体并留下战利品。",
    "trigger": "战斗中击杀敌方弈子时",
    "stageRounds": null,
    "researchParameters": {
      "drop_probability": null,
      "reward_table": null,
      "pity_system": null,
      "per_round_cap": null,
      "requires_fielding_warwick": false
    },
    "excludedAugmentReferences": [
      {
        "id": "TFT9_Augment_DravenSpoilsOfWar",
        "name": {
          "en_us": "Spoils of War I",
          "zh_cn": "战争财宝 I"
        }
      },
      {
        "id": "TFT9_Augment_DravenSpoilsOfWar2",
        "name": {
          "en_us": "Spoils of War II",
          "zh_cn": "战争财宝 II"
        }
      },
      {
        "id": "TFT9_Augment_DravenSpoilsOfWar3",
        "name": {
          "en_us": "Spoils of War III",
          "zh_cn": "战争财宝 III"
        }
      }
    ],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [
      "drop_probability",
      "reward_table",
      "pity_system",
      "per_round_cap"
    ],
    "projectConventions": [],
    "sourcePath": "encounters[14]",
    "sourceKeys": [
      "S03",
      "D01",
      "D02",
      "D03"
    ]
  },
  {
    "id": "artifact-anvil",
    "encounterId": "TFT_OpeningEncounter_ArtifactAnvil",
    "portalId": "TFT_Portals_Items_ArtifactAnvil",
    "champion": {
      "name_zh": "杰斯",
      "name_en": "Jayce"
    },
    "nameZh": "神器锻造器",
    "nameEn": "Artifact Anvil",
    "weightBps": 400,
    "enabled": true,
    "effectStatus": "active",
    "readiness": "ready-for-followup",
    "followupPr": 2,
    "descriptionZh": "1-2 获得 1 个神器锻造器。",
    "trigger": "1-2 发放",
    "stageRounds": [
      "1-2"
    ],
    "researchParameters": {
      "anvil_type": "artifact",
      "count": 1,
      "stage": 1,
      "round": 2,
      "offered_options_per_anvil": null
    },
    "excludedAugmentReferences": [],
    "portalBannedAugmentReferences": [],
    "missingEvidence": [],
    "projectConventions": [
      "每个锻造器四个不同候选，沿现有项目约定"
    ],
    "sourcePath": "encounters[15]",
    "sourceKeys": [
      "D01",
      "D02",
      "D03"
    ]
  }
] as const);
export type OpeningEncounterId = typeof OPENING_ENCOUNTERS[number]['id'];
export const OPENING_ENCOUNTER_CONFIG = freezeContent({
  version: 'opening-encounters-14.24b-batch-a-v1',
  batchA: OPENING_BATCH_A,
  trainerGolems: TRAINER_GOLEMS_POLICY,
  entries: OPENING_ENCOUNTERS,
  selectionStream: 'opening-encounter-v1/select',
  derivation: 'uint32(matchSeed XOR fnv1a32-utf16(streamName))',
  selection: 'one-lcg32-v1-word/floor(word*10000/4294967296)/fixed-cumulative-order',
  sharedEffectStream: 'opening-encounter-v1/shared/<effectKey>',
  seatEffectStream: 'opening-encounter-v1/seat/<seatId>/<effectKey>',
  displayStream: 'opening-encounter-v1/display',
  disabledPolicy: 'retain-selected-identity/no-rewards/no-reroll/no-renormalization',
  initialization: 'solo-before-first-preparation/shared-root-before-seat-import-bind-after-import',
  melReceiptKey: 'JSON([instanceId,effectKey,seatId,nodeId])',
  melThreshold: { hp: 40, maxTriggers: 1, order: 'damage/mel-unit-save/elimination-status/threshold-receipt',
    crossing: 'oldHp>40 && 0<newHp<=40', history: 'first-qualifying-round-result',
    receipt: 'first-crossing/once/reward-entitlement/no-retroactive-repair', enabled: true },
  warwickHunger: { executor: 'blocked-evidence', killFacts: 'reserved-not-consumed', rngDraws: 0 },
  receiptKey: 'JSON([opening-receipt,JSON([opening-effect,configVersion,fnv1a32-utf16(opening-instance/rootSeed),encounterId,effectKey,nodeId]),seatId])',
  pr2: { activationNode: '1-2', augmentNodes: ['2-1','3-2','4-2'],
    unforcedTier: 'existing-equal-tier-project-convention-approved-2026-10-22',
    forgeStream: 'opening-encounter-v1/seat/<seatId>/anvil/<index>',
    forgeSampling: 'sorted-pool/partial-fisher-yates/word-mod-remaining/4-lcg32-v1-words',
    forgeChoices: 4, componentCount: 2, artifactCount: 1, timeout: 'first-offer',
    order: 'opening-forge-before-epic-and-other-mechanic-choices',
    policyReceipt: '1-2/augment-policy-once', forgeReceipt: '1-2/anvil/0-or-1',
    restore: 'exact-activation-receipts/rederive-offers/ordered-resolution/provenance/no-regrant',
  },
  pr5: { node: '3-5', timing: 'preparation-entry-before-choices-and-shared-shops',
    outcomes: ['damage', 'gold', 'masterwork', 'components'], weightsBps: [2500,2500,2500,2500],
    damage: 10, gold: 25, tools: 1, components: 4,
    outcomeStream: 'opening-encounter-v1/shared/wind-up-monkey/outcome',
    componentStream: 'opening-encounter-v1/seat/<seatId>/wind-up-monkey/components',
    sampling: 'outcome-floor-word-times-4-over-2^32/components-sorted-ordinary-eight-with-replacement-four-words',
    damagePolicy: 'living-seats/simultaneous/lethal/no-combat-mel-save/raw-hp-desc-before-hp-desc-index-asc',
    masterwork: 'ordinary-36-recipe-to-existing-radiant-mapping/one-permanent-equipped-item/unequip',
    toolSelection: 'personal-unit-then-armory-instance-id/preparation-only/freeze-target-equipment-trading-and-orb-claims/first-offer-timeout/no-rng',
  },
  melBOverride: { source: 'S03 / encounters[13].patch_history.14.24b_changes_zh', crownsInAffectedBranch: 2 },
} as const);
