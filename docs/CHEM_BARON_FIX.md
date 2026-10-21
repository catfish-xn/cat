# Chem-Baron 修正：v20-chem-baron（2026-10-21）

基线为本地 `origin/multiplayer` / `0484e4072ca390de37e16d25b8f3b2b19f94f5cf`。本任务离线完成。用户提示并行 PR #364 使用 v19；本地尚无 `verify-v19-epoch.cjs`，为避免标识冲突，本批独立使用 `v20-chem-baron`，不声称已包含 #364 的改动。

## B 补丁采纳覆盖

证据为已归档的官方 2024-12-17 公告摘录 `evidence/g2-3/external-sources.json` 的 `/groups/8/changes/1` 至 `/15`（数组下标；第 10 条同时修改 AP/AS）。`src/simulation/content/chem-baron-b-overrides.ts` 在每组字段处标注公告条目。八件装备共 16 个具名字段：

| 公告条目 | 装备（省略 TFT13_Crime_） | 采纳字段 |
| --- | --- | --- |
| 1 / 2 | Silver / Gold DestabilizedChemtank | InitialPercentShield=0.25 / 0.5 |
| 3–5 | Prismatic_DestabilizedChemtank | Health=999、PercentShield=0.2、PrismaticDamagePercent=0.15 |
| 6 | Prismatic_FleshRipper | AD=0.6 |
| 7 | Prismatic_PiltovenHexplating | ArmorPerStack=5 |
| 8–10 | Prismatic_ShimmerBloom | IncreasedHealShieldPercent=0.5、ShieldAmount=400、PrismaticAllyAP=25、PrismaticAllyAS=0.25 |
| 11–12 | Prismatic_UnleashedToxins | PrismaticWaveDamage=200、PrismaticWaveStunDuration=1 |
| 13–15 | Prismatic_VirulentVirus | AP=50、PrismaticReducedDamage=0.2、PrismaticZombieHealth=1200 |

`G23_ARCHIVED_SPECIAL_ITEM_SOURCE` 保留旧表，离线 `g2-3-special-item-source.ts` 继续用它还原 archive mirror；运行时 `G23_SPECIAL_ITEM_SOURCE` 合并覆盖。原 raw 和归档投影值不变，覆盖清单进入 RULES_GAP_MANIFEST 与两种 digest。基础 HP/AD/AP 编译成实际属性；本批未实现化工专属被动。`{992e2747}=10` 含义缺证据，保留未知，不按双抗文案猜别名。

## 标准模式微光

确认为标准模式分支误用：`g23SoloFacts` 把目录 PvE 映射为 `roundKind:'pve'`；单机及联机野怪都由 Match 的本地战斗结算进入 `commitG23Settlement → advanceG23Economy`。双边玩家对战在 `two-sided-battle.ts` 明确传 `pvp`，再由 `round-settlement.ts` 提交同一个经济入口。此处没有 PVEMODE/HR 模式开关。

标准归档 `en_us.json.gz /setData/1/traits/18/desc`、`g2-3-trait-source.ts` 的 `TFT13_Crime.description` 写明 “after each player combat”。另有 PvE 工厂描述及 `_PVE` 参数，但参数存在不足以让标准野怪走其他模式语义。故标准 PvE 不涨微光、不新开黑市、连败保持；PvP 第三败起增强，赢/平清连败，未激活羁绊仍按原规则记录连败。原 `_PVE` 数据原样保留。旧 RECONCILIATION 将该标准分支列作“源数据”的说法由本说明覆盖。

## 黑市三选一与保留

N=3，**项目自定（用户要求多选一）**。本地 14.24 归档的 `map22.bin.json.gz` 八张 `TFT13_Crime_BlackMarket1…8` 的 `mConstants` 只有命名奖励权重；标准 `TFT13_Crime` 羁绊变量也没有候选数。未找到可采用的候选数常量，不宣称 3 是原版数量。运行策略位于 `G23_POLICY.chemBaron`。

每次开 offer 从对应档正权重奖励包中按源顺序、原权重无放回抽 `min(3,正权重包数)` 个。每个候选消耗独立进度流的一个显式 `lcg32-v1` 词，移除已选包后按剩余权重重新缩放；800 档仅一包，抽一词。不把包内装备候选当成黑市包。打开/投影/选择/保留/失败命令都不消耗该流，冠冕仍在本战所有黑市候选抽样之后掷骰。

公共命令仍为 `selectChoice(state, choiceId, generation, optionId, unitLootPolicy?)`；投影仍用 `choiceId/generation/options`（内部 PendingChoice.offers）。optionId 为源奖励包 apiName；所有包都 `grantItem:false`，通用选择层只记决策，规则层发且只发选中包全部奖励。包内物品仍由原有派生流抽样，英雄法球/复制托管/容量政策不变。`@skip` 就是“保留”：本轮不领，微光保留；超时也沿用它。下一次更高档 offer 使用累计微光，保持已有跨档及领取清零约定。

内部 `G23MarketOffer.optionIds:readonly string[]` 为候选；`optionId:string` 保留为首候选兼容别名。`rollG23BlackMarket(tier:number,rngState:number)` 返回 `options`、`draws`、`rngState`，同时保留首候选的 `id/reward/weightBps`。未知档或非法 seed 抛 RangeError。`decideG23Market(p,id,take,round,optionId?)` 返回新进度；省略 optionId 接受首项；过期/无候选/非布尔 take/非整数或过早 round/不在候选内的领取抛 RangeError，原进度不变。领取经济收据新增 optionId，恢复按同一显式流重放并核对通用选择收据。命令失败枚举仍为原有 `invalid-choice` / `stale-choice` / `wrong-phase` 等，不增加协议字段或服务器实现。

## 版本、录制与验证

规则 `s13-g2-3-v20-chem-baron`；内容 `s13-14.24b-g2-3-v20-chem-baron`；schema/save/replay/command 仍 8/4/3/4。CONTENT `fnv1a32-utf16:c1084e68`，LOOT_REPLAY `fnv1a32-utf16:e4289c1d`，均由 `update-content-identities.cjs` 完整重算。旧身份拒绝，无迁移。

独立入口 `scripts/verify-v20-chem-baron-epoch.cjs`、`docs/evidence/v20-chem-baron/`、`tests/fixtures/v20-chem-baron-*`；历史 v18 及更早录制保留。CURRENT Herald 和当前夹具消费者改指本 epoch。通用路线保存完整当前身份以验证恢复，不能把旧存档改版本字符串冒充当前录制；与既有路线的命令/事件差异由 release-audit 单独记录。化工专用旧测试的首次市场从第 8 轮推迟至第 12 轮，派生奖励候选随 offer 身份变化，已用独立 BigInt LCG/权重 oracle 核对新的进度流。

回归输入为合成棋盘/战斗事实及已存在公共命令路线。独立公告数值断言覆盖 16 字段、归档不变及实际 HP/AD/AP；标准 PvE 五档/死亡数/第三败；无放回抽样、非首项领取、保留/超时、过期和无效选择零变更，以及三候选各自恢复与防重发。仅执行相关测试、typecheck 和 epoch 录制/校验；未声称跑完全套测试、浏览器或上线验收。

最终相关验证为 **23 文件、662 项通过**；分组文件、结果及已解决的中间失败见 [validation.json](evidence/v20-chem-baron/validation.json)。typecheck、digest 复算通过。Git 工作树元数据位于工作区外的只读目录，`git add` 创建 index.lock 被文件系统拒绝，故本环境无法 commit；英文提交说明已备于忽略目录 `artifacts/chem-baron-commit-message.txt`，含指定 Co-Authored-By。没有联网或 push。
