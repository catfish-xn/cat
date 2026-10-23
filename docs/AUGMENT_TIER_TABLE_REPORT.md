# 强化等级组合简报（2026-10-23）

已在 `codex/augment-tier-table` 完成；基于 v22 候选 `c2179b9e`，未联网、未提交。仅调整强化等级相关代码、测试和文档。

- 原表 16 组合、整数权重总和/分母 101，来源为用户提供的 Wiki TFT:Augment “Augment choices”（最后表改动 V12.9），用户 10-23 批准用于 14.24b；不宣称取得新的 14.24b 独立证据。
- 沿用 FNV-1a32 + 根种子 XOR `0x61756774` + lcg32-v1，固定专用流 `augment-tier-sequence-v1` 的首词抽完整组合；节点只读取对应位置。读/恢复时由不可变根重推同一逻辑样本，不新增存档字段，不推进其他 RNG。单机取 Match.seed，全桌取 pool.seed。
- 表与来源已纳入 `AUGMENT_OFFER_POLICY`，通过原 augmentPolicy 摘要输入覆盖；版本为 `augment-tier-table-v22`。合同和 `S13_RULES_GAP.md` 已更新，**待 v22 统一录制**。

全部等级覆盖点（继续经同一 `resolveAugmentTier`，PR2 的 augment-policy 激活收据不变）：

| 奇遇 | 覆盖节点 |
| --- | --- |
| 范德尔 golden-gala | 2-1 / 3-2 / 4-2 全金 |
| 艾克 prismatic-party | 2-1 / 3-2 / 4-2 全彩 |
| 黑默丁格 prismatic-prelude | 仅 2-1 彩 |
| 黑默丁格 prismatic-finale | 仅 4-2 彩 |

未指定位置保留原组合，不重抽、不按奇遇归一化；其他奇遇无等级覆盖。

验证：`npm run typecheck` 通过。9 项新增测试通过，覆盖原表/101、全部票值边界、独立 BigInt 首词 oracle、101000 不同种子频数误差界、八席/单机同源、四种奇遇和恢复；原八席服务器测试另验证三节点初抽/换牌后的共享快照恢复。核心 6 文件 138 通过，仅 PR2 旧启用名单 1 失败（HEAD 原逻辑同样失败）。扩大至 20 文件共 **561 通过、14 用例失败，另 1 个套件初始化失败**。

epoch/digest/golden 与历史路线失败清单（未修改其断言、常量或录制数据）：

| 文件 / 用例 | 结果与安排 |
| --- | --- |
| content-identity-constants：full content root、full loot replay root | 2 项摘要不一致；HEAD 已不一致，待 v22 联合更新 |
| opening-encounters：full table and conventions in both freshly recomputed digests | 1 项摘要不一致；HEAD 已失败，待 v22 联合更新 |
| s13-augments-p2-choice：public Crown + Trifecta；seed 18 Nami + crownguard；seed 18 Nami + TrickstersGlass | 3 条固定种子路线因组合变更失效；待 v22 统一重选种子/录制 |
| s13-augments-p2-choice：trifecta-ii public acquisition | 新种子下篡改仍被拒绝，但先报 Invalid authoritative V19 replay，旧断言要求 S13 P2 opening；保留原断言并列入验收迁移 |

其余 HEAD 已有失败保持：g2-augments-static 的 placebo/plus 2 项（阶段金币字段）；g2-augments-combat 的 Epitaph 1 项（护盾期限）；opening-encounters 的 disabled identities/config 2 项；opening-encounters-integration 的 whitelist 1 项；PR2 启用名单 1 项；D11 套件初始化报 earned source must be dead。以上通过仅替换两份生产强化文件为 HEAD 原文的临时 Vite 覆盖配置对照确认，未回写工作区。

独立测试 oracle 的等级算法已按批准表更新；P2 动态选种子改读含奇遇覆盖的解析器；原“银银银”换牌场景改为表内“银银金”，仍覆盖跨节点永久排除。没有改强化池、其他数值、UI、服务器生产代码或 CI。完整命令、原始日志及逐项失败清单位于本地 `artifacts/augment-tier-table/`（生成物不提交）；因共享 node_modules 只读，Vitest 使用 `--configLoader runner --no-cache --maxWorkers=2`。未执行完整 epoch/浏览器/全局 golden 重录。
