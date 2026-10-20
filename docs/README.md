# 文档导航

`docs/` 里同时放着**现行规则**和**开发过程记录**。新读者先看第 1 节；第 3 节的文件按当时日期阅读，不代表现状。项目概况和运行方法见根目录 [README](../README.md)。

## 1 现行规则与接口

| 文档 | 内容 |
| --- | --- |
| [MATCH_CONTRACT.md](MATCH_CONTRACT.md) | 整局状态机、命令、事件与失败原因（`src/simulation/match.ts` 的契约） |
| [COMBAT_CONTRACT.md](COMBAT_CONTRACT.md) | 战斗 tick、技能、护盾、状态与伤害结算 |
| [../M5_RULES.md](../M5_RULES.md) | 经济、经验、商店概率、利息与连胜败等基础规则 |
| [MULTIPLAYER_CONTRACT.md](MULTIPLAYER_CONTRACT.md) | 八人联机：规则侧导出的函数签名、输入输出与失败原因 |
| [SAVE_CONTRACT.md](SAVE_CONTRACT.md)、[REPLAY_CONTRACT.md](REPLAY_CONTRACT.md) | 单人存档与回放格式 |
| [M8_RULES.md](M8_RULES.md)、[M8B_POLICY.md](M8B_POLICY.md)、[M8B_LOOT.md](M8B_LOOT.md)、[M8B_OPENING.md](M8B_OPENING.md)、[M8B_ENCOUNTERS.md](M8B_ENCOUNTERS.md)、[R3R4_LOOT_DESIGN.md](R3R4_LOOT_DESIGN.md) | 装备、野怪、开局与法球掉落规则 |
| [S13_RULES_GAP.md](S13_RULES_GAP.md)、[S13_OWNERSHIP_TRANSACTIONS.md](S13_OWNERSHIP_TRANSACTIONS.md)、[S13_TRAIT_PROJECTION.md](S13_TRAIT_PROJECTION.md)、[S13_AUGMENTS_P3.md](S13_AUGMENTS_P3.md)、[S13_ANOMALIES_P4.md](S13_ANOMALIES_P4.md) | S13 强化、异常、羁绊与资源所有权的规则和与原版的差异 |
| [M9_DATA_LEDGER.md](M9_DATA_LEDGER.md) | 英雄与羁绊数据台账 |
| [AI_STRATEGY_DESIGN.md](AI_STRATEGY_DESIGN.md) | 机器人策略 |

## 2 联机方案、部署与协作

| 文档 | 内容 |
| --- | --- |
| [MULTIPLAYER_RENOVATION_V2.md](MULTIPLAYER_RENOVATION_V2.md) | 八人联机改造的主方案（任务包 T0–T9、TP） |
| [MULTIPLAYER_N0_BASELINE.md](MULTIPLAYER_N0_BASELINE.md) | 联机施工起点与任务划分 |
| [MULTIPLAYER_RELEASE_NOTES.md](MULTIPLAYER_RELEASE_NOTES.md) | 服务器部署、环境变量、压测与故障处理 |
| [UI_REQUESTS.md](UI_REQUESTS.md) | 界面和服务器向规则侧提的数据需求 |
| [PROJECT_GUIDE.md](PROJECT_GUIDE.md) | 文件职责表、完整验收命令、CI 说明（部分内容停在 2026-10-07 的单人阶段，见文首提示） |
| [ZH_REVIEW.md](ZH_REVIEW.md) | 中文显示文本校对清单 |

`AGENTS.md`（根目录）记录两个 AI 助手的分工和项目的硬性约定；`CONTRIBUTING.md` 是给所有贡献者的简明版。

联机方案中"房间、邀请码、房主开始"的设计已被取消：现在是单一对局队列，玩家只有一个"匹配"按钮（见 AGENTS.md「八人联机分工」）。

## 3 开发过程记录

这些文件记录某个阶段的计划、验收、审计、交接和派单，内容可能已被后续改动推翻：

- 根目录 `M1_PLAN.md` … `M8_PLAN.md`、`M2_GOAL.txt`、`M4_*`、`M5_PLAN.md`、`M5_ACCEPTANCE.md`、`M6_GOAL.md`、`M6_PLAN.md`、`M7_PLAN.md`
- `docs/M1_*` … `docs/M9_*` 中的 `*_VALIDATION`、`*_REVIEW`、`*_STATUS`、`*_HANDOFF`、`*_AUDIT*`、`*_BASELINE`、`*_PLAN` 等阶段文档
- 早期联机设计 [MULTIPLAYER_ARCHITECTURE.md](MULTIPLAYER_ARCHITECTURE.md)、[MULTIPLAYER_RENOVATION_PLAN.md](MULTIPLAYER_RENOVATION_PLAN.md)、[SERVER_AUTHORITY_ARCHITECTURE_AUDIT.md](SERVER_AUTHORITY_ARCHITECTURE_AUDIT.md)，以及 `MULTIPLAYER_T*_WORK_ORDER.md`
- 派单与交接：`CLAUDE_WORK_ORDERS.md`、`DISPATCH_2026-10-14.md`、`IMPLEMENTATION_PHASE1.md`、`PLAN_GOALS_2026-10-15.md`、`PR166_*`、`PR_P3P4P5.md`
- 各功能批次的发布与修复记录：`*_RELEASE.md`、`G2_*`、`T11_T12_FIXTURE_REPAIR.md`、`MP_OVERTIME_*`、`SAVE_AUDIT_*`、`AUGMENT_TIER_V14_IMPLEMENTATION.md`、`H1_WARN_ONLY.md`

`docs/evidence/` 和 `docs/audits/` 是测试与审计的原始证据，部分被脚本和 CI 按路径读取，请勿移动或改写。

部分过程记录被测试或脚本按文件名引用，所以暂时没有挪进单独的归档目录。
