# 迷你弈子（DeftHands / Mini Mees）3D 缩放依据审计

**分支**：`cursor/mini-scale-evidence`（基于 `claude/v26-model-mappings`）  
**审计对象**：`src/rendering/three-mode/unit-model.ts` 的 `MINI_MODEL_SCALE`（当前 **0.5**）  
**内容版本**：TFT Set 13 / 补丁 **14.24b**（与本仓库 `s13-14.24b` 切片一致）  
**结论摘要**：**未在 14.24 客户端可核对数据中找到迷你弈子相对本体的确切视觉缩放常数**；`MINI_MODEL_SCALE` **保持 0.5**，标记为 **待核，来源未知**。下文按可信度列出已查来源。

---

## 1. 本仓库 3D 语义（实现上下文）

| 项 | 说明 |
| --- | --- |
| 规则身份 | 领域层 `s13-mini`（DeftHands 攻击代理），见 `src/simulation/anomalies/summons.ts` |
| 3D 表现 | 解析拥有者 `definitionId`，在 **已完成 `fitModel`（含官方 `unitScale` 与体积上限）之后**，对 GLB 根节点再乘 `MINI_MODEL_SCALE`（见 `placeholder-renderer.ts` 注释：避免先改 `unitScale` 导致宽/高弈子 mini 偏大） |
| 当前常量 | `export const MINI_MODEL_SCALE = 0.5` — **非已验证的 Riot 常数** |

---

## 2. CommunityDragon / map22 客户端数据（14.24）

### 2.1 DeftHands（小我多多）GoopBuff 记录 — **可信度高（数据存在且可复现）**

| 字段 | 值 | 含义 |
| --- | --- | --- |
| 指针 / API | `{3ef46724}` / `TFT13_GoopBuff_DeftHands` | 与仓库 `P4_SOURCE.DeftHands`、`docs/evidence/s13-anomalies-p4/source-audit.json` 一致 |
| `PercentAD` | `0.3` | 迷你攻击伤害系数（live 14.24；Riot 预告文曾写 40%，以 map22 为准） |
| `MiniCount` | `3` | 迷你数量 |
| `ArmorReduction` | `5` | 护甲削减 |
| `AttackCadence` | `3` | 每 3 次攻击触发 |

**出处（任选其一核对）：**

- 本仓库离线包：`src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz`（解压后键 `{3ef46724}`）
- CommunityDragon 同补丁 map 数据镜像（路径随 CDTB 导出；与本仓库 raw 为同一 patch **14.24** 的 Map22）

**缺失项（与缩放直接相关）：** 该记录的 `effectAmounts` **没有** 任何尺寸/模型缩放字段；全表检索 named 字段亦仅有 `HexRadius*` 等范围项，**不含** Mini Mees 专用 scale。

### 2.2 对照：Giant-Sized（巨人体型）**在同一数据结构里确有尺寸系数 — 可信度高**

| 指针 | `{6d87cae9}` / `TFT13_GoopBuff_GiantSized` |
| --- | --- |
| `BonusHP` | `1000` |
| `{88bfedc3}` | **`≈ 1.8`**（hash 命名字段；官方描述为 “grow greatly in size”） |

仓库引用：`src/simulation/content/g2-3-anomaly-source.ts`（`"giant-sized".values`）。

**推论（中等可信，逻辑归纳）：** 若 14.24 把 anomaly 的 **可数据化体型倍率** 放在 GoopBuff `effectAmounts` 里，Giant-Sized 已给出 **1.8**；DeftHands **未给出对称的缩小倍率**。迷你体型更可能由 **运行时克隆/脚本** 施加，而非该 Buff 表字段。

### 2.3 Mini Mees 相关 spell / 粒子 — **可信度高（无 scale 字段）**

| 键 | 脚本名 | 备注 |
| --- | --- | --- |
| `{89bf7245}` | `TFT13_Goop_MiniMeesMis` | 迷你攻击 **飞弹**；`mTravelTime = 0.5` 秒（`tests/s13-anomalies-source.test.ts` 已钉死） |

**`0.5` 在此处是飞弹飞行时间，不是模型缩放。** 勿与 `MINI_MODEL_SCALE` 混淆。

### 2.4 英雄 `skinScale` / `unitScale` 管线 — **可信度高（不适用 mini）**

仓库 `scripts/assets3d/unit-scale.mjs` 从 **独立英雄 skin bin** 读取 `skinMeshProperties.skinScale`。DeftHands 迷你单位在 3D 层 **复用拥有者英雄 GLB**，无单独 `s13-mini` 官方 skin 记录；**不存在** “迷你专用 unitScale” 可提取项。

---

## 3. 官方与社区文案

| 来源 | 链接 | 与缩放关系 | 可信度 |
| --- | --- | --- | --- |
| Riot《Mechanics: Into the Arcane》 | https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/mechanics-into-the-arcane/ | 写明 “3 **mini versions** of your selected unit”；**无数值比例** | **中**（权威，但不含尺寸） |
| LoL Wiki 异常模块 | https://wiki.leagueoflegends.com/en-us/Module:TFTAnomalyData/data?action=raw | `Mini Mees`：3 minis、30% AD、每 3 攻击、减 5 护甲；**无体型** | **中** |
| TFT Academy（Set 13 anomalies） | https://qol-changes.tft-academy.pages.dev/learn/anomalies | 同上，**无缩放数字** | **低–中**（第三方，与 wiki 一致） |
| r/CompetitiveTFT 讨论串 | https://www.reddit.com/r/CompetitiveTFT/comments/1hbpwxn/mini_mees_anomaly_discussion_8/ | 数值/强度讨论；**未给出模型比例** | **低**（社区） |

---

## 4. 实机截图 / 视频对比

**目标：** 从实机画面测量「迷你 vs 本体」高度或包围盒比例。

| 尝试 | 结果 | 可信度 |
| --- | --- | --- |
| 公开 Wiki 独立条目 `TFT:Anomaly/Mini_Mees` | 404，无附带测量图 | — |
| 社区讨论 / 攻略 | 均描述 “mini”“small”，**无量化比例** | **低** |
| 本 Cloud Agent 环境 | **无 14.24 客户端**，无法自录可复现测量帧 | — |

**判定：** 实机可 **定性**（迷你明显小于本体），但 **无法在不跑客户端、不做像素计量的前提下** 把比例钉死为某一分数（例如 0.5、0.6、2/3）。此类证据若将来补齐，应附：**补丁号、棋盘、英雄、截图 URL、测量方法（例如本体 idle 高度像素比）**。

---

## 5. 对 `MINI_MODEL_SCALE = 0.5` 的决定

| 问题 | 答案 |
| --- | --- |
| 是否有 **确切** 原版缩放常数？ | **否**（见 §2–§4） |
| 是否修改常量？ | **否**，保持 `0.5` |
| 代码标记 | `unit-model.ts` 注释 + 本文：**待核，来源未知** |
| 测试 | `tests/rendering3d-anvil-model.test.ts`、`tests/rendering3d-jayce-forge.test.ts` 继续断言 `MINI_MODEL_SCALE`；**不弱化** |

### 若将来找到确切值

1. 在本文 **§6** 追加条目（出处、指针、测量方法）。  
2. 更新 `MINI_MODEL_SCALE` 与上述测试期望。  
3. **禁止** 用 PercentAD（0.3）、飞弹 `mTravelTime`（0.5）或 Giant-Sized 的 1.8 **反推** mini 缩放。

---

## 6. 变更日志

| 日期 | 动作 |
| --- | --- |
| 2026-10-29 | 初版审计：map22 / 官方文 / wiki / 社区检索；无确切缩放；保留 0.5 |
