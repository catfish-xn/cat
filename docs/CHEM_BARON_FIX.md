# Chem-Baron 修正：v20-chem-baron（2026-10-22 第二次同步）

父 epoch 为 v20-traits；基线为已合入 PR #379 的 `origin/multiplayer` / `ce60a8b9dd2b0c3a0c34c527405d44939233fb5b`。离线合并保留迅击、野火、五组搭档、共用移动禁止判定、66 张强化，以及 v19 家人/Mel 账本；同时保留本 PR 的 B 补丁覆盖、标准 PvE 零微光、黑市多选一/保留。v20-traits、v19 及更早 fixtures、证据、录制脚本和归档字节保持不变。

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

规则 `s13-g2-3-v20-chem-baron`；内容 `s13-14.24b-g2-3-v20-chem-baron`；schema/save/replay/command 为 11/7/4/4（父 v20-traits 为 10/6/4/4）：候选 optionIds 和领取决策 optionId 新增持久化字段，因此 schema 与 save 各递增一；战斗回放事件结构与命令协议未变。CONTENT `fnv1a32-utf16:2d1eafb8`，LOOT_REPLAY `fnv1a32-utf16:7fd08770`，均由 `update-content-identities.cjs` 完整重算。旧身份拒绝，无迁移。

独立入口 `scripts/verify-v20-chem-baron-epoch.cjs`、`docs/evidence/v20-chem-baron/`、`tests/fixtures/v20-chem-baron-*`；历史 v20-traits、v19 及更早录制保留。CURRENT Herald 和当前夹具消费者改指本 epoch。通用路线保存完整当前身份以验证恢复，不能把旧存档改版本字符串冒充当前录制；与既有路线的命令/事件差异由 release-audit 单独记录。化工专用旧测试的首次市场从第 8 轮推迟至第 12 轮，派生奖励候选随 offer 身份变化，已用独立 BigInt LCG/权重 oracle 核对新的进度流。

回归输入为合成棋盘/战斗事实及已存在公共命令路线。独立公告数值断言覆盖 16 字段、归档不变及实际 HP/AD/AP；标准 PvE 五档/死亡数/第三败；无放回抽样、非首项领取、保留/超时、过期和无效选择零变更，以及三候选各自恢复与防重发。已执行指定相关测试、v19 补充回归、typecheck、epoch 录制/校验及 fast 四分片；浏览器及上线验收尚未完成。

第二次同步专项 58 文件 / 1396 项及最终 typecheck 通过，epoch 11 步与 220 份历史字节校验通过；完整 fast 四片 6384 通过 / 53 环境失败（0 跳过，无计时或规则断言失败）。U6 DOM 仍被监听权限阻断，父/当前 RSS 均超过本环境 256 MiB 门槛。详细测试、四分片分类和环境限制以 [同步报告](evidence/v20-chem-baron/SYNC2_RESULTS.md) 为准；先前 v19 父基线结果只作历史记录，不能证明本次通过。

本次验证结果见 [validation.json](evidence/v20-chem-baron/validation.json)，epoch 顺序录制见 [epoch-verification.json](evidence/v20-chem-baron/epoch-verification.json)。新增 transfer-route 独立录制及复核，当前消费者也使用 v20 输入。独立 `oracle.g2.cjs` 手录标准五档微光和八档源权重，用 BigInt LCG 校验每候选一词、保留、非首项领取和冠冕抽样顺序，不 import 运行时规则；额外覆盖家人任务、Mel 救援与黑市共享同一本账后完整重放。

环境限制：Node 24 同步管道报 EPERM，当前 epoch 工具直接用普通文件描述符捕获输出，保留真实退出码，不加载预加载器；U6 原脚本监听 127.0.0.1 被沙箱拒绝，浏览器验收须在可监听环境复核。本次原 U6 脚本已完成公共路线采集、存档验证和结算预检，不能替代 DOM 验收。Git index 位于只读元数据目录，无法在本环境登记冲突；冲突文件内容已解决，索引待用户提交时登记。未联网、未 push，未手动修改界面目录。
