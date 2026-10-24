# 海克斯等级表与时限简报（2026-10-23，第 6–8 条）

分支 `codex/augment-tier-table`，起点 `7e3f8dcfc57923689b6646b6abf4fa15dcd360d8`。只实施用户批准的 `perf-1022/rules-1023/approved-1023-batch2.md` 第 6、7、8 条；全程离线、未提交、不录 epoch。本文替换上一轮 Wiki 16 组合/101 报告。

## 实现位置与合同

| 位置 | 结果 |
| --- | --- |
| `src/simulation/content/augment-policy.ts:8`、`:29` | 按 CSV 顺序替换为 14.24 客户端 18 个非零组合，保留原整数权重/109；9 个零权重组合不入基础表。原版来源 `TFT9_AugmentArmoryConfiguration_Table`，`RandomizeProbabilityTableGlobally=true`。 |
| `src/simulation/content/augment-policy.ts:86` | `geniuses`（羁绊：天才）金→彩；能力、赠卡及其他强化档位不变。 |
| `src/server/room/room.ts:99` | 当时改为 `ROOM_TIMING_DEFAULTS.choiceMs=48_000`；后续海克斯并入 50 秒准备阶段，`choiceMs` 回到 30_000，只用于其他选择。 |
| `tests/fixtures/m5/oracle.g2.cjs:51`、`:77` | 独立 oracle 同步天才档位及客户端组合表，不导入生产配置。历史录制未改。 |
| `docs/MATCH_CONTRACT.md:1`、`docs/S13_RULES_GAP.md:1` | 完整权重、来源/P、RNG/恢复及待 v22 统一录制；发布配置示例与 V2 时限说明一并同步。战斗合同无变化。 |

本地数据：`/home/aiapps/workspace/augments-research-2026-10-23/data/odds-all27.csv`，SHA-256 `d081f1cc2ea60ed6935b707d03d54ed88267fa3a64fc63913c10923b60f2d62e`。离线逐行比对生产表与 CSV：18/18 相同，非零权重合计 109。等级表为原版数据；天才改彩与48秒未另给独立原版依据，按用户批准记项目决定 **P**。

沿用原 `augment-tier-sequence-v1`、FNV-1a32、根种子 XOR 与 `lcg32-v1` 首词；仅模数/累计区间变更，不新增 RNG 消耗或存档字段。单机根为 Match.seed，全桌根为 SharedPoolState.seed；恢复按不可变根重推。保留范德尔全金、艾克全彩、黑默丁格前奏仅 2-1 彩/终章仅 4-2 彩，未指定位置不重抽、不重归一化。奇遇覆盖后的组合不受基础表零权重限制。

## 独立手算向量

`FNV1a32('augment-tier-sequence-v1')=0x9cacfe8b`；`x=(seed xor 0x61756774 xor 0x9cacfe8b)>>>0`，`word=(1664525*x+1013904223) mod 2^32`，`ticket=word mod 109`。测试采用独立 BigInt 算术。

| seed | x | 首词 word | ticket | 基础组合与半开区间 |
| --- | --- | --- | --- | --- |
| 0 | 0xfdd999ff | 3720240978 | 19 | 银金金 [10,22) |
| 1 | 0xfdd999fe | 3718576453 | 33 | 金银金 [28,46) |
| 42 | 0xfdd999d5 | 3650330928 | 62 | 金金金 [48,70) |
| 2147483648 | 0x7dd999ff | 1572757330 | 36 | 金银金 [28,46) |
| 4294967295 | 0x02266600 | 2600870239 | 93 | 金彩金 [88,98) |

按 CSV 累加，各节点银/金/彩边际权重分别为 `28/71/10`、`35/54/20`、`6/74/29`（各除109）。测试穷尽109票值，并在109000个不同根种子中核验18组合频数；零权重组合未出现。时限向量：开窗 t，t+30000 与 t+47999 状态原引用不变；t+48000 超时只选一次，重复 advance(0) 不再发奖。

## 验证与失败旧测试

最终按每文件最近一次结果去重：**26 文件 / 575 项，556 通过、19 失败、0 跳过**。新增 8 项全部通过；等级表文件 16/16，服务器等级/期限文件 3/3，原卡换牌文件 12/12。`npm run typecheck`、`git diff --check` 通过。未改任何失败旧测试的断言或数据。

一致性：`server/combat-stream` **15/15**（seed 7/42/991，八席五回合同步/流式权威字节、完整账本与回放；未完 PvE 保存恢复续跑），`b8-resumable-battle` 切片/回放等 **12/12**，仅另3条历史指纹失败；`m5-serialization` **34/34**；`g2-4b-replay` **10/10**。天才公开彩色获取、两张赠卡、保存恢复、重试拒绝和四个已存 RNG 不变均通过。

失败旧测试清单（列出本轮结果，不将全部失败推定为本单前已有）：

| 文件 / 用例 | 数量 / 现象 |
| --- | --- |
| `content-identity-constants`：full content root、full loot replay root；`opening-encounters`：full table and conventions in freshly recomputed digests | 3；内容重算 `fnv1a32-utf16:35273c97` / loot `fnv1a32-utf16:ef359464`，旧常量仍为 `8db1005e` / `b60b716e`，待 v22 统一录制。 |
| `b8-resumable-battle`：pre-change byte fingerprint，0/1/9 units | 3；历史字节指纹不同，待 v22 统一录制。 |
| `s13-augments-p2-choice`：public Crown + Trifecta；seed 18 Nami + crownguard / TrickstersGlass | 3；固定种子候选不再包含原指定卡，保留断言，待 v22 统一验收路线。 |
| `g2-augments-combat`：Epitaph；climb-the-ladder-i public selection (seed 28) | 2；旧护盾期限要求1201、当前901；种子28整战未触发预期死亡增益。 |
| `g2-augments-static`：placebo / placebo-plus exact normalized source values | 2；其他已批准批次的阶段金币字段与旧来源断言不同。 |
| `opening-encounters`：disabled identities、reject enabled configs；`opening-encounters-pr2`：exactly six PR2 effects enabled | 3；旧关闭/启用名单与当前已集成奇遇不同。 |
| `opening-encounters-integration`：explicit public whitelist | 1；旧用例要求该种子奇遇未启用，当前已启用。 |
| `server/g2-4a-forge-timeout`：never shows four offers；`server/g2-4b-artifact-forge-room`：never shows artifact offers | 2；完整对方视图字符串匹配失败：新等级路线中其他席位可公开持有 `portable-forge` 及已获神器 `TFT_Item_Artifact_WitsEnd`；神器测试日志确认命中的是 seat s2 的 `publicBoard.looseItems`，不是 s0 的候选字段。原断言逐整段禁止子串/候选ID，保持不动，留服务器方确认测试边界。 |

首轮扩展集神器锻造器 `beforeAll` 10秒超时、4项跳过；保持原限制，以1 worker独立重跑，最终4通过/1上述私密性失败，已计入去重结果。其余扩展集使用2 workers。命令统一为 `npm test -- <文件> --configLoader runner --no-cache --maxWorkers=1或2`，绕过共享只读 node_modules 的缓存；类型检查为 `npm run typecheck`。本地完整日志、原命令、逐用例 JSON 及失败清单在 `artifacts/augment-tier-table-batch2/`（生成物不提交）。未执行全仓长路线/浏览器验收或 epoch 重录。

## 集成边界

- **待 v22 统一录制**：未改 rules/content/schema/save/replay/command 版本、digest 常量、epoch、golden 或旧测试断言，当前候选不可与旧规则混跑/发布。
- `src/rendering/online/local-room-options.ts:20` 仍显式 `choiceMs:30_000`，位于 Claude 界面目录，未越权修改；Claude 需同步本地演示默认值，真服务器默认不受此覆盖影响。
- 无界面、其他玩法数值、`.github/CI`、素材改动；无新运行时辅助模块，仅替换原配置及一处服务器默认值。
