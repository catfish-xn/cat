# v17 第 1–4 阶段法球随机组合

当前合并收尾以文末“合入最新 multiplayer 后的收尾”及对应机器证据为准；此前各轮数字是历史记录。

本次基于 `codex/v17-orb-combo` 的 `3a786fa8f8c7217ec3e1518313b4e1ff0afebd77`，沿用 v17 贪财化身身份。依据为本地任务书 §3 及仓库归档 `content/source/s13-14.24b/raw/map22.bin.json.gz`，没有联网。任务书 §1 的阶段/箱子整数权重原样落表；`Stage1High` 的总权重确为 110，其他阶段表为 100；空权重行不入表。

另直接解压本地原始 map22：对八张阶段表逐行比较整数化权重及 Items/Silver/Blue/Gold/Prismatic，全部与独立字面 oracle 一致；HighOdds 与四个 Min/Max 边界也一致。检查结果位于 `artifacts/orb-combo/raw-stage-check.json`。

## 改动与 D1–D3

- D1：并入 v17。rules/content 仍为 `s13-g2-3-v17` / `s13-14.24b-g2-3-v17`；schema **7→8**、save **3→4**，replay=3、command=4 不变。layout `s13-orb-layout-v1→v2`，policy/freeze/runtime 修订为 v17。旧 v16 和改动前 v17 存档均拒绝，不改头、不迁移，不接受旧账本。部署前排空旧局；回退需保留旧程序和原始存档，禁止把旧存档送入新版本继续。
- D2：金铲铲、金锅锅、杰作升级和 6 费只删除对应奖励原子，行内其他奖励及该行权重保留。两条内容相同的 Ultra 行仍各占原权重，不合并。没有额外补偿或替换物。
- D3：第 1 阶段按组件→灰→蓝排列，依次轮流分给 1-2 / 1-3 / 1-4。第 2–4 阶段分别落在 x-7。一轮内按组件→灰→蓝→金→棱彩，再按该轮 `NEUTRAL_ENCOUNTERS.slots.slotId` 代码点顺序轮流挂载；同载体的后续珠递增 slotOrdinal。仅已击杀载体揭示奖励。

组件是独立 `blue` 法球、`templateId='component'`，八种普通组件等权。灰在 3 阶段升级铜 Plus，蓝/金在 4 阶段升级银/金 Plus，棱彩始终 Ultra Plus。箱子英雄使用相应费用**全部已上线商店英雄**、按 id 排序等概率抽。可出 5 费，不出 6 费；金箱可出完整 2 星 3 费，复用既有完整星级发放与共享卡池路径：入库扣 3 份，不足 3 份按现行一次基础费用补金，满席按该 2 星卖价补金，两个补偿互斥。

新增锻造器 `TFT_ArmoryKeyComponent`，显示名“基础装备锻造器”，池为按 id 排序的八个普通组件、四选一，复用既有 G24 派生流、选择、超时首选和唯一收据；不存在专用组件领取规则。组件锻造器与普通组件法球分别计数。资源收据恢复校验按 `G24_FORGE_POOLS` 的四种已准入 forge id 校验，拒绝未知 id；修复旧校验器只接受成装/神器的漏接。真实 Junker/Academy 获取与恢复路线、四种 forge 收据和未知 forge 拒绝均有回归证据。

5-7 / 6-7 的史诗算法及表行顺序、id 均保留；铜/银 Plus 从其原有有序表映射奖励内容。五次补给、单机自动发奖、联机点击领取、战中排队、跨轮保留和满席出售规则不变。`orb-bonuses.ts` 和额外复制器流删除，前四阶段复制器只来自箱子行。

## 共享计划与 RNG

1. 共享计划初态为 `FNV1a32_UTF16(JSON.stringify(['orb-stage-plan-v17',layoutSeed]))`。高额阶段数以 `[630,300,58,10,2]` 在 n=1000 抽取；按字典序枚举 C(4,k) 个阶段集合后等概率抽一个（k=0/4 不抽）；按 1..4 顺序各抽 Base/High 一行。每次尝试必须同时满足组件 11–15、价值 20–79；整局拒绝并续用局部游标，最多 64 次，之后取四个 Base 的第一行（12 组件、30 价值点）。
2. 每颗内容初态为 `FNV1a32_UTF16(JSON.stringify(['orb-box-v17',seatSeed,orbId]))`。组件珠只抽 n=8；箱子先抽 n=100 的行，再按行内顺序抽英雄，n 为对应费用完整商店池大小。固定金币、工具、装备、锻造器不抽内容词。每珠互不串联。
3. FNV 从 2166136261 起，逐 UTF-16 code unit 执行 `imul(hash XOR codeUnit,16777619)>>>0`。两条新流均用 lcg32-v1 拒绝取模，拒绝词计入 draws。`sampleOrbStagePlan(seed)` 返回四阶段组合、高额阶段集合、尝试数、fallback 和局部 rng，仅供可信领域调用/测试。
4. 旧 layout 流不推进，账本 rng 保持 `(layoutSeed XOR 0x4f524253)>>>0, draws=0`。共享计划仅作私有临时计算，`rounds` 只存已进入轮次，不保存未来行、高额阶段、尝试数或组合游标。restore 按 seed 重推已进入前缀并严格比较。私有视图和公开摘要都没有未来数量/颜色。
5. 旧每席 loot 流 `(seatSeed XOR 0xdeadbeef)>>>0` 只供 5-7 / 6-7，前四阶段 draws=0；史诗仍先变体、再全部箱子行、最后箱内英雄。相同 seed 的史诗结果相对旧版变化是预期结果，算法没有改。
6. 商店、重铸、装备、战斗流不参与组合或开箱。领取和拒绝命令仍不重抽奖励。新装备实际入库后触发的既有装备钩子照常执行。

## 商店 / 重铸不变的证据

改动前用 `scripts/verify-orb-streams.cjs --capture` 捕获本分支旧法球实现（v16 算法）的六个 seed：0、1、42、230、3735928559、4294967295。原始对照位于 `tests/fixtures/orb-streams-pre-combo.json`。改后 `node scripts/verify-orb-streams.cjs` 对每个序列的序列化字节严格比较：78 组商店（初次及 12 次刷新）和 30 组重铸（实际原类物品及 RNG 游标）完全相同；期间冻结全部 PvE 边界，不领取英雄。

`tests/v17-orb-combo.test.ts` 同时执行上述对照，并验证逆序/少杀一个载体仍保留其他法球的相同内容；旧 loot 流在 4-7 前零消耗。对照不承诺领取英雄后有限卡池供给相同，那会受到已批准的掉落内容变化影响。

## 指纹与兼容

| 标识 | 改前 | 改后 |
| --- | --- | --- |
| CONTENT_DIGEST | `fnv1a32-utf16:8a955c10` | `fnv1a32-utf16:05439fc4` |
| LOOT_REPLAY_DIGEST | `fnv1a32-utf16:62c76cb9` | `fnv1a32-utf16:132ae758` |
| schema/save/replay/command | 7/3/3/4 | 8/4/3/4 |
| layout/freeze | v1/v16 | v2/v17 |

由 `update-content-identities.cjs --write` 完整重算，随后 `--check` 验证；阶段表、箱子表、完整英雄池、锻造器池、RNG 修订均受指纹覆盖。规则实现阶段未重录 v17 epoch、golden 和录制状态；本轮链收口统一重录 v17，结果见文末。v15/v16 历史 fixture 及 `g2-4b-herald-raw/manifest.json` 字节不动。

## 数值预算与验证

`node scripts/analyze-orb-combo.cjs` 使用独立字面表按精确乘积枚举并对接受条件归一。单次接受概率 0.684299908；组件 11/12/13/14/15 的条件概率为 35.8083/33.5318/20.1637/8.0245/2.4717%，期望 12.0781955；第 1 阶段组件期望 2.9649069。价值点、64 次上限、阶段分轮和载体分配为项目约定，原始表和 11/15/20/79 为归档依据；不能把客户端没有提供的服务器脚本机制称为已还原。

全清并解决锻造器时，早期装备当量期望 12.2542704，加五次补给及两轮史诗后总期望 21.6542704、范围 20–34；直接掉落金币期望 15.4655975。英雄、利息、售卡、缺货补偿不计入直接金币。神器/辅助装备按 2 当量单列，不能说是实际普通组件。更完整数据见 M8B_LOOT §11.4 / §12。

合成验收的 11 组覆盖权重、5000 seed 分布、64 次 fallback、八席共享/恢复、未来隐私、RNG 隔离、逐箱逐行与星级卡池/补偿、复制器来源、失败无副作用、组件锻造器、严格存档验证。独立测试 oracle 使用字面表及 BigInt FNV/LCG，不调用生产采样器。旧 `epic-loot-oracle.cjs` 保留原样；当前 epic 测试与 M5 规划 oracle 使用新的独立 `orb-combo-oracle.cjs`。

本次同步更新了 match-session、opening-random-1cost、B8 冻结/发奖、R3/R4 oracle/掉落、schema/save 接口断言。m5-growth 的新数值路线保留九张付费 Tristana、自然收入/HP/异常获取，使用真实 4-7 PvE 检查成长、独立恢复与防重发；没有修改英雄属性或成长数值。

最终定向回归17文件、244项通过：`v17-orb-combo`（11项）、`match-session`、`opening-random-1cost`、`r3r4-loot`、`r3r4-loot-weights`、`r3r4-oracle`、`m8-b8-loot-freeze`、`m8-b8-loot-runtime`、`m8-contracts`、`match-contract`、`content-identity-constants`、`v17-avarice-online`、`m5-growth`、`g2-3-netcode-hooks`、`restore-audit/g23-grant-evidence`、`m6-persistence`、`m8-b9-compatibility`。命令为 `npx vitest run --configLoader runner --project fast <上述文件> --maxWorkers 4`；机器 JSON 在 `artifacts/orb-combo/targets-final.json`。

首轮fast全量5461项：4864通过、463失败、134待执行/跳过，耗时约801秒。该轮已定位并修复新forge恢复漏接、save版本负向测试及growth场景；最后一轮全量另记最终结果，不以定向通过替代全量通过。剩余旧epoch/固定掉落场景、服务器测试及环境限制须如实报告。

### 上轮交接记录（2026-10-21，本轮收口前）

- `npm.cmd run build -- --configLoader runner`：**通过**，包含 `tsc --noEmit`；完整日志 `artifacts/orb-combo/build-final.log`。Windows 默认配置打包加载器遇到父目录访问限制，使用 Vite 支持的 runner 加载配置，未改构建配置/依赖锁文件，未联网安装。
- `update-content-identities.cjs --check`：通过；完整指纹与上表一致。`verify-orb-streams.cjs`：78商店/30重铸输出及游标再次逐字节一致。11组合成验收全部通过，最终定向17文件244项全部通过。
- 最终 fast：`--project fast --maxWorkers 4`，**418文件：354通过 / 64失败；5462项：4884通过 / 448失败 / 130跳过，716.53秒**。完整机器结果 `artifacts/orb-combo/fast-final.json`；可随交接保留的逐文件失败与示例见 [orb-combo-fast-report.json](evidence/v17/orb-combo-fast-report.json)。导入/beforeAll失败导致部分测试未执行，不能计为通过。
- 2D顶层JS以gzip level9实测 **627432 / 424763 = 1.4771343078 ≤ 1.49**；分母同时从本地已签基线 dist 重算一致。3D单独加载，不在2D入口预加载，相关隔离构建测试通过。
- 只读Git核对：分支/HEAD不变；禁改目录、v17 epoch、历史归档和 `g2-4b-herald-raw/manifest.json` 无改动；`git diff --check` 通过。没有暂存、提交、重录或部署。

**当时尚未收口；以下是本轮开始前的待办记录，当前结果以文末为准：**

1. `opening-random-identity`、`m8-content-equivalence`、`m5-route`、M6 integration、epic的3个已录制状态恢复等仍使用旧schema/digest/golden。按本次授权边界不重录，留给本链最后在LF克隆统一生成与复验。
2. `m8-b8-live-*`、部分装备/成长/异常/容量场景、R3/R4消耗品/共享用例仍假设旧种子的固定英雄、组件、工具和到达时机。需要适配真实获取路线、资源容量与独立场景断言，**不是只重录摘要就能全部解决**。本次未把这些失败删除、跳过或降低断言以换绿。
3. `explorer-bracer-restore-pressure` 的子进程esbuild报 `Cannot read directory "../../..": Access is denied`，属于本机受限环境的未完成验证，需在允许该构建访问的环境重跑。
4. 服务器仍有4个测试文件失败：`c18b-consumable-preview`、`c18b-use-consumable`、`e2e-replay-errors`、`t10-combat-ops`。目录按约定未改，需服务器负责人适配/核验。服务器整局到排名、生命周期、断线重连、加时与回放投影等正例已经通过，不能代替这4个失败的验收。

## 接线边界

`createOrbLayout` / `freezeOrbLayoutThroughRound` / `freezeLootThroughRound` 函数参数、成功/失败联合不变；导出的 ledger/binding 的版本字面量升为 v2。`invalid-orb-layout` / `stale-orb-layout` / `invalid-orb-round` 不增加枚举。`OrbTier` 不变。服务器应保存返回值，不能自己计算组合。新 forge id、5 费和完整 2 星的投影按现有通用字段读取；界面须检查每轮多珠摆放及新锻造器名称。本次未改 `src/server/`、`tests/server/`、渲染或表现目录，端到端联机接线待对应负责人验收。

建议提交信息：`feat(simulation): sample v17 stage orb combinations and independent box streams`。

## v17 链收口：原始失败分类（2026-10-21）

原始 fast：5462 项，4884 通过、448 失败、130 跳过；64 个失败文件。按主因分为 epoch 301 项、旧场景 136 项、服务器 9 项、环境 2 项。`0 + suite` 表示导入/钩子失败，不代表其中用例通过；这类未执行用例包含在原始跳过统计中。逐条断言和错误见 [分类证据](evidence/v17/closure-failure-classification.json)。

| 文件 | 失败用例 | 主分类 |
| --- | ---: | --- |
| `tests/bracer-multikill-stacks.test.ts` | 0 + suite | 旧场景适配 |
| `tests/c19-missed-pulse.test.ts` | 1 | v17 epoch 待重录 |
| `tests/d11-wiring-bank.test.ts` | 1 | v17 epoch 待重录 |
| `tests/d14-anomalies-source.test.ts` | 1 | v17 epoch 待重录 |
| `tests/d14-wiring-match.test.ts` | 0 + suite | 旧场景适配 |
| `tests/epic-loot-reforger.test.ts` | 3 | v17 epoch 待重录 |
| `tests/explorer-bracer-restore-pressure.test.ts` | 2 | 环境 |
| `tests/explorer-bracer-restore.test.ts` | 0 + suite | 旧场景适配 |
| `tests/g2-3-lesser-shimmer-duplicator.test.ts` | 2 | 旧场景适配 |
| `tests/g2-4a-crown-history.test.ts` | 20 | 旧场景适配 |
| `tests/g2-4b-artifact-forge.test.ts` | 2 | 旧场景适配 |
| `tests/g2-4b-artifacts.test.ts` | 1 | 旧场景适配 |
| `tests/g2-4b-mirror-forge-restore.test.ts` | 2 | 旧场景适配 |
| `tests/g2-4b-pr161-restore.test.ts` | 10 | 旧场景适配 |
| `tests/g2-4b-support-forge.test.ts` | 1 | 旧场景适配 |
| `tests/g2-4b-trench.test.ts` | 1 | 旧场景适配 |
| `tests/m5-route.test.ts` | 7 | v17 epoch 待重录 |
| `tests/m6-integration-mage.test.ts` | 2 | v17 epoch 待重录 |
| `tests/m6-integration-sniper-caitlyn.test.ts` | 2 | v17 epoch 待重录 |
| `tests/m6-integration-sniper.test.ts` | 2 | v17 epoch 待重录 |
| `tests/m6-integration.test.ts` | 3 | v17 epoch 待重录 |
| `tests/m8-b10-encounter-outcomes.test.ts` | 1 | 旧场景适配 |
| `tests/m8-b10-temporary-replay.test.ts` | 1 | 旧场景适配 |
| `tests/m8-b4-audit-regressions.test.ts` | 2 | 旧场景适配 |
| `tests/m8-b4-integration.test.ts` | 1 | 旧场景适配 |
| `tests/m8-b4-r3b-lifecycle.test.ts` | 3 | 旧场景适配 |
| `tests/m8-b5-equipment-history.test.ts` | 0 | 旧场景适配 |
| `tests/m8-b5-grant-upgrade.test.ts` | 0 | 旧场景适配 |
| `tests/m8-b5-instances.test.ts` | 0 + suite | 旧场景适配 |
| `tests/m8-b7-audit-vectors.test.ts` | 1 | v17 epoch 待重录 |
| `tests/m8-b7-match-wiring.test.ts` | 7 | v17 epoch 待重录 |
| `tests/m8-b8-equipment-fixture.test.ts` | 3 | 旧场景适配 |
| `tests/m8-b8-input-evidence.test.mjs` | 0 + suite | 旧场景适配 |
| `tests/m8-b8-live-capacity.test.ts` | 0 + suite | 旧场景适配 |
| `tests/m8-b8-live-cross-round.test.ts` | 0 + suite | 旧场景适配 |
| `tests/m8-b8-live-economy.test.ts` | 0 + suite | 旧场景适配 |
| `tests/m8-b8-live-growth.test.ts` | 14 | 旧场景适配 |
| `tests/m8-b8-live-reveal.test.ts` | 0 + suite | 旧场景适配 |
| `tests/m8-b8-live-transfer.test.ts` | 0 + suite | 旧场景适配 |
| `tests/m8-b8-loot-view.test.ts` | 4 | 旧场景适配 |
| `tests/m8-b8-oracle.test.ts` | 5 | 旧场景适配 |
| `tests/m8-b8-restore.test.ts` | 3 | 旧场景适配 |
| `tests/m8-b8-token-lifecycle.test.ts` | 3 | 旧场景适配 |
| `tests/m8-content-equivalence.test.ts` | 134 | v17 epoch 待重录 |
| `tests/match-lifecycle.test.ts` | 2 | 旧场景适配 |
| `tests/opening-random-identity.test.ts` | 136 | v17 epoch 待重录 |
| `tests/r3r4-consumable-targets.test.ts` | 4 | 旧场景适配 |
| `tests/r3r4-consumables.test.ts` | 15 | 旧场景适配 |
| `tests/r3r4-shared.test.ts` | 5 | 旧场景适配 |
| `tests/t11-opening-xp.test.ts` | 1 | 旧场景适配 |
| `tests/t12-combat-equip.test.ts` | 0 + suite | 旧场景适配 |
| `tests/t12-offline-transfer.test.ts` | 1 | 旧场景适配 |
| `tests/t3-timeout-loot.test.ts` | 4 | 旧场景适配 |
| `tests/t5r-loot-view.test.ts` | 2 | 旧场景适配 |
| `tests/t7-integration.test.ts` | 1 | 旧场景适配 |
| `tests/task-mechanism-restore.test.ts` | 14 | 旧场景适配 |
| `tests/tp-rewards-and-rounds.test.ts` | 5 | 旧场景适配 |
| `tests/ur-i3-combat-statuses.test.ts` | 1 | v17 epoch 待重录 |
| `tests/restore-audit/bounds-preflight.test.ts` | 2 | 旧场景适配 |
| `tests/restore-audit/cd-replay-facts.test.ts` | 1 | 旧场景适配 |
| `tests/server/c18b-consumable-preview.test.ts` | 3 | 服务器测试 |
| `tests/server/c18b-use-consumable.test.ts` | 1 | 服务器测试 |
| `tests/server/e2e-replay-errors.test.ts` | 4 | 服务器测试 |
| `tests/server/t10-combat-ops.test.ts` | 1 | 服务器测试 |

### 收口适配与断言边界

- 不改规则实现、服务器或界面。公共命令路线处理新增英雄带来的真实容量阻塞；装备场景从新独立 `orb-combo-oracle.cjs` 选择种子和成分，用真实掉落、补给、付费购买、出售、合成和装备命令推进。完整收据、资源守恒、失败原状态、恢复及逐 tick 状态/事件断言保留。
- 商店/重铸原对照 fixture 不变：六个种子、78 组商店、30 组重铸的输出与游标继续逐字节一致。没有通过修改历史 golden、删断言、跳过失败或宽松匹配换绿。
- 鸟群原来所有奖励在 r00；v17 分散到多个载体。原 Zyra 在 tick 152 击杀 r01，现在依法获得一件组件，不能再断言零奖励。另用同一真实双死亡路线验证 **r05 在 tick 106/eventSeq 822 死亡时新增揭示和资格证据均为零**；该 tick 的终局结算只支付此前其他载体已挣得的八个条目。无奖励载体的资格篡改仍严格拒绝。同 tick 双死亡仍精确为 tick 44、eventSeq 382/383。
- 两处纯计时适配：`t12-combat-equip` 的死亡单位装备用例四 worker 实测 5.74s，临时时限 12s；`m5-route` 的 sniper 装备出售证明新增一条真实 seed-782 付费路线，实测 34.78s，临时时限 70s。均按本任务用户批准的“约实测两倍”，注释标明临时；所有行为断言保留。
- 并行 worker 的临时缓存发布文件加独立 publisher UUID，避免同进程重新导入模块后计数器重置导致临时文件名冲突；仅影响测试生成缓存。
- 全量额外发现 `m5-growth` 的旧 seed-8 路线在筹资阶段于 4-3 阵亡。改用独立法球 oracle 找到的 seed 22（第一阶段实际组件为剑、棒、斗篷、剑），先把真实合成装备交给自然阵容，按独立商店 oracle 精确计算九张付费 Tristana 与刷新总价，通过普通战斗收入筹足，再出售原阵容、回收原 ID 装备并完成九次购买。实际金币差严格等于 oracle 总价；三星、125 Bps 成长、完整资源折叠、篡改拒绝和重复 step/Continue 断言保留。路线更早开始，遍历到同一 4-7 所需阶段数改为有界 16 次；这不是数值容差或放宽成长判定。

## 服务器侧待适配

本次只记录，未修改 `src/server/`、`tests/server/`（含 e2e harness）或界面。以下是原始九项服务器断言的逐项交接；最终全量结果见后面的验收节。

1. `tests/server/c18b-consumable-preview.test.ts`（3 项）：`the fixture holds tools of every kind (precondition)`、`online: the seat view answer equals the authority for every candidate, without reading the authority`、`online: targets the projection does not list (enemy, unknown, consumed tool) are not usable`。显式 `publicConsumables(26)` 已不再产出所需工具；服务器串应将这个真实获取场景显式换成独立 oracle 已验证的 `publicConsumables(27566)`，保留工具非空、至少一项可用、全候选与 authority 完全相等及敌人/未知/已消费拒绝断言。不要伪造工具或取消前提断言。
2. `tests/server/c18b-use-consumable.test.ts`（1 项）：`a remover on a board unit wearing an item: applied on the live seat, items back with their ids, tool gone, pool shop untouched`。旧 room seed 的灰球不再保证 remover，等待直到 round 36 ended 仍未满足前提。服务器串应按 **房间 layout seed + 座位 seed** 用新 oracle 找到确有 remover 和物品的组合，在真实源死亡后通过 `claimOrb` 领取，再装备并执行命令；保留物品 ID、工具恰好减一、只发布一次、卡池/商店不动、重复消费失败和事件白名单断言。不能只延长轮数。
3. `tests/server/e2e-replay-errors.test.ts`（4 项）：`replay.failed after readiness`、`split replay-divergence after readiness`、`replay.failed before readiness` 的失败退出及 `Server replay error:`；`unrelated server output` 的成功退出。观察到子进程启动先失败，未进入 replay guard。harness 的 `ROOT = new URL(...).pathname` 在 Windows 产生 `/C:/...`；服务器串应在 `tests/server/e2e/harness.mjs` 用 `fileURLToPath(new URL(...))` 得到原生目录，并处理 child `error` 事件，然后原样重跑四个断言。此处是平台路径适配，不是法球规则或 replay guard 改动。
4. `tests/server/t10-combat-ops.test.ts`（1 项）：`fills human boards to the cap from the bench, left slot first, front row centre-out 3/2/4/1/5/0/6; bots are left alone`。失败在 **第 155 行事件顺序断言**，此前棋盘集合断言已通过。第 150 行 `expected.sort()` 原地改变了随后用于事件顺序的数组；旧 ID 顺序偶然掩盖了问题，新法球出生 ID 暴露它。服务器串应将集合比较改成 `[...expected].sort()`（或 `expected.toSorted()`），保留原始 bench-slot 顺序用于事件、单次 revision、冻结阵容和机器人不自动上阵的断言。不要修改部署规则或直接接受新的固定 ID 顺序。

### 环境项

`tests/explorer-bracer-restore-pressure.test.ts` 的两项（五百万次伪造触发的有界拒绝、`26^12` Titan 历史去重）被 esbuild 的 `Cannot read directory "../../..": Access is denied` 阻挡，未完成子进程内存/时限验证。显式 tsconfig 未解除访问限制；诊断另发现本机无可调用的 Python 峰值内存测量器。诊断性改动均已撤回，原压力断言和测量脚本不变；需在具有所需构建访问和 Python 的环境原样重跑，不能声称压力验收通过。

## 上轮收口验收结果（2026-10-21，换基线前的历史记录）

- v17 九步统一重录及复核全部退出 0；固定基线仍为 #295 的 `30cf934446719a0da0d3cea1667bf84a3df5296c`，未换基线。完整步骤及日志索引见 [epoch-verification.json](evidence/v17/epoch-verification.json)。两条录制状态、golden、herald、输入证据及 live reveal 均为当前 v17 schema/digest；没有把 v15/v16 证据改成新版本。
- 历史审计再次通过：v15/v16 的 58 个证据文件、历史 v16 断言逐字节不变；`g2-4b-herald-raw/manifest.json` 无差异。商店 78 组、重铸 30 组继续与改前对照逐字节相等。
- 最终 fast 使用 `--project fast --maxWorkers 4`：**418 文件，413 通过 / 5 失败；5573 项，5561 通过 / 11 失败 / 1 跳过，734.39 秒**。完整日志与机器结果为 `artifacts/orb-combo/fast-closure.log` / `fast-closure.json`；可随提交保留的逐项失败、完整错误、跳过项和验收证据索引见 [closure-fast-summary.json](evidence/v17/closure-fast-summary.json)。总数变化包含此前导入/钩子阻断后的动态用例展开及新增覆盖，不能把原来的未执行用例直接计作通过。
- 残留精确为：`server/c18b-consumable-preview` 3 项、`server/c18b-use-consumable` 1 项、`server/e2e-replay-errors` 4 项、`server/t10-combat-ops` 1 项、`explorer-bracer-restore-pressure` 2 项。上文“服务器侧待适配”逐条给出断言意图及所需修改，环境项说明保持原压力验收。**没有其他非服务器失败。** 唯一跳过是既有 `assets3d-paths` 的 extraction-record 条件用例，本轮未新增 skip。
- 独立 `npm.cmd run typecheck`、`npm.cmd run build -- --configLoader runner` 均退出 0；后者包括再次执行 tsc。构建后重读 JS 校验 SHA256、字节数和 gzip level 9：**627432 / 424763 = 1.4771343078 ≤ 1.49**，见 [closure-build-size.json](evidence/v17/closure-build-size.json)。既有 Vite 重复 build key 与大 chunk 警告未影响构建通过。
- 只读 Git 核对：分支仍为 `codex/v17-orb-combo`，HEAD 仍为 `bbae2e695219e2240e933695e369d060cddbb76e`。改动仅在测试、fixture、脚本和文档；领域实现、服务器及禁改界面目录无差异，`git diff --check` 通过。未联网、未做 Git 写操作、未部署。

本轮可执行的非服务器场景适配与 v17 epoch 重录已收口；**整套 fast 仍有 11 项未通过，不能称完整发布验收通过**。后续由服务器串按上述四文件交接处理，并在具备所需权限和 Python 的环境补跑原样压力测试。

建议提交信息：`test(v17): adapt randomized orb scenarios and rerecord epoch`。

## 合入最新 multiplayer 后的收尾（2026-10-21）

当前在 `codex/v17-orb-combo`（#306，HEAD `e6233c953637065cdb78292e40e54cea5744cb19`）合并 #295 的 `9b0b29fe1ad1db2c259270fb551e19ee8d65a013`；后者已含最新 multiplayer `d677a291405ac263b617844d8ae43a604139b7fb`、#291 的 seed 4 恢复、#292 的侦察四星及 v16 指纹重录、#265。以下结果覆盖这份合并工作区，不表示已写入 Git 索引或完成 merge commit。

历史基线从 `30cf934446719a0da0d3cea1667bf84a3df5296c` 换成 `d677a291405ac263b617844d8ae43a604139b7fb`（只读 `git rev-parse d677a291` 得到完整 SHA）。`v17-fixture-audit.cjs`、`verify-v17-epoch.cjs`、`compare-v17-digests.cjs` 三处同步；v15/v16 的 58 份历史文件以新基线逐字节保留，包括 #292 已重录的 v16 manifest/审计源码指纹，不能以旧 multiplayer 的字节覆盖它们。原 #295 文档的验证数字保留为历史，本轮 v17 证据全部重新生成。

四个测试文件的冲突标记已清除。共享路线固定 seed 4；独立 `orb-combo-oracle.cjs` 算得 v17 的 4-7 为 belt/tear/cloak、Tristana+1金、Leona+1金，共七条奖励，已无 Ezreal 或拆卸器。故将实际升星转移对象改为两张付费 Tristana，商店 generation/slot、出生 sequence、76 条账本、手套原 ID、slime-time 目标及掉落全量 oracle 都作精确断言。两条升星分支仍分别验证手套与临时子装备迁移、冲突退库、异常转移、原始战斗冻结、逐 tick 恢复、唯一发奖/防重发及篡改拒绝；离线分支在准备阶段给 donor 装 vest，战中才把库存手套装给 survivor，同样验证冻结装备溢出退库，不依赖本种子没有的拆卸器。没有伪造资源、改生产规则、放宽断言或时限。定向 3 文件 / 23 项全部通过，原始日志 `artifacts/v17-merge/transfer.log`。

`node scripts/verify-v17-epoch.cjs` 九步全部退出 0，完整顺序与日志索引见 [epoch-verification.json](evidence/v17/epoch-verification.json)。两条录制状态、四路线 golden、五案 Herald、输入和实时揭示证据均完整重录并复核；历史字节审计通过。独立双根重算得到新基线 v16 content/loot 为 `de829c8a` / `62c76cb9`，当前 v17 仍为 `05439fc4` / `132ae758`（均为 `fnv1a32-utf16:` 前缀），没有改写历史版本身份或生产规则。

独立 `npm.cmd run typecheck` 与 `npm.cmd run build -- --configLoader runner`（再次包含 tsc）均退出 0。正式 2D 顶层全部 JS（含拆分后的 Phaser）逐文件 gzip level9 求和 **629542 / 424763 = 1.4821017838 ≤ 1.49**；分母从本地原 M7 构建重新核对字节数与 SHA256。独立 3D JS gzip 228208 B，递归全部 JS 为 857750 B，保持原 2D 预算口径。逐文件证据见 [merge-build-size.json](evidence/v17/merge-build-size.json)；沿用现有大 chunk 警告，不修改构建配置。

最终 fast 命令：`node node_modules/vitest/vitest.mjs run --configLoader runner --project fast --maxWorkers 4 --reporter=default --reporter=json --outputFile=artifacts/v17-merge/fast.json`，在九步全部结束后运行，避免中途证据读入。原始退出码 **1**，耗时 **714.15 秒**；**430 文件：423 通过 / 7 失败；5688 项：5664 通过 / 23 失败 / 1 跳过，0 待执行**。原始 JSON/日志为 `artifacts/v17-merge/fast.json` / `fast.log`；可提交的逐项完整失败、分类、九步、构建和边界核对汇总见 [merge-validation.json](evidence/v17/merge-validation.json)。没有用定向结果或后续复验替换全量数字。

| 分类 | 本轮完整结果与限制 |
| --- | --- |
| 服务器，只报告 | 48 文件，44 通过 / 4 失败；288 项通过 / 9 失败，0 未执行。`c18b-consumable-preview` 3 项仍在真实工具获取前提失败；`c18b-use-consumable` 1 项到 round 36 ended 仍缺所需拆卸器场景；`e2e-replay-errors` 4 项仍为 harness 子进程 `spawn node.exe ENOENT`；`t10-combat-ops` 1 项在第 155 行事件顺序失败。处理建议沿用本文上方交接，原测试和服务器未改；其中 e2e 外层已经使用 `fileURLToPath`，失败仍在内层 harness 启动。 |
| 3D 脚本环境限制 | `assets3d-build-root` 11 项与 `assets3d-fx-pilot` 1 项：`merge-root-output.mjs:23` 沿绝对路径逐层调用 `realpath`，在 `C:\Users\Administrator` 被本机权限以 EPERM 拒绝，尚未到达目标输出策略/合并断言。没有绕过路径安全检查或改 3D 脚本；需在允许祖先路径 realpath 的环境原样补验，不能声明这 12 项目标断言已通过。 |
| 原压力测试环境限制 | `explorer-bracer-restore-pressure` 2 项：esbuild 报 `Cannot read directory "../../..": Access is denied` 且无法解析原压力入口。保留原测试与脚本，子进程的内存/时限要求仍未完成验证。 |

非服务器合计 382 文件，379 通过 / 3 失败；5376 项通过 / 14 项上述环境失败 / 1 跳过。唯一跳过仍是 `assets3d-paths` 的 extraction-record 条件用例，本轮没有新增 skip。没有其他非服务器失败，本次 23 项转移定向用例在全量中也全部通过；**全套 fast 尚未全绿，不作完整发布验收通过的声明**。

结束时只读核对分支、HEAD、MERGE_HEAD 不变；受保护的 `src/server/`、`tests/server/`、`src/rendering/`、`src/presentation/` 共 200 个已跟踪文件与任务起点 SHA256 相同。新历史基线确为 MERGE_HEAD 的祖先；历史字节复核及 `git diff --check` 通过。未联网、未写 Git、未部署。四个文件内容已解决冲突，但遵守禁止 Git 写入的约束，索引仍保留 UU、MERGE_HEAD 仍存在；后续由有写权限的执行者暂存审阅结果并完成合并。

建议提交信息：`test(v17): resolve seed-4 transfers and rerecord epoch on d677a291`。
