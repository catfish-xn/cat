# v17 第 1–4 阶段法球随机组合

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

由 `update-content-identities.cjs --write` 完整重算，随后 `--check` 验证；阶段表、箱子表、完整英雄池、锻造器池、RNG 修订均受指纹覆盖。v17 epoch、golden、录制状态和所有历史 fixture 均不重录；`g2-4b-herald-raw/manifest.json` 字节不动。本链最后由协调者在 LF 克隆统一重录，不能使用本次旧录制数据宣称新版本全量回归通过。

## 数值预算与验证

`node scripts/analyze-orb-combo.cjs` 使用独立字面表按精确乘积枚举并对接受条件归一。单次接受概率 0.684299908；组件 11/12/13/14/15 的条件概率为 35.8083/33.5318/20.1637/8.0245/2.4717%，期望 12.0781955；第 1 阶段组件期望 2.9649069。价值点、64 次上限、阶段分轮和载体分配为项目约定，原始表和 11/15/20/79 为归档依据；不能把客户端没有提供的服务器脚本机制称为已还原。

全清并解决锻造器时，早期装备当量期望 12.2542704，加五次补给及两轮史诗后总期望 21.6542704、范围 20–34；直接掉落金币期望 15.4655975。英雄、利息、售卡、缺货补偿不计入直接金币。神器/辅助装备按 2 当量单列，不能说是实际普通组件。更完整数据见 M8B_LOOT §11.4 / §12。

合成验收的 11 组覆盖权重、5000 seed 分布、64 次 fallback、八席共享/恢复、未来隐私、RNG 隔离、逐箱逐行与星级卡池/补偿、复制器来源、失败无副作用、组件锻造器、严格存档验证。独立测试 oracle 使用字面表及 BigInt FNV/LCG，不调用生产采样器。旧 `epic-loot-oracle.cjs` 保留原样；当前 epic 测试与 M5 规划 oracle 使用新的独立 `orb-combo-oracle.cjs`。

本次同步更新了 match-session、opening-random-1cost、B8 冻结/发奖、R3/R4 oracle/掉落、schema/save 接口断言。m5-growth 的新数值路线保留九张付费 Tristana、自然收入/HP/异常获取，使用真实 4-7 PvE 检查成长、独立恢复与防重发；没有修改英雄属性或成长数值。

最终定向回归17文件、244项通过：`v17-orb-combo`（11项）、`match-session`、`opening-random-1cost`、`r3r4-loot`、`r3r4-loot-weights`、`r3r4-oracle`、`m8-b8-loot-freeze`、`m8-b8-loot-runtime`、`m8-contracts`、`match-contract`、`content-identity-constants`、`v17-avarice-online`、`m5-growth`、`g2-3-netcode-hooks`、`restore-audit/g23-grant-evidence`、`m6-persistence`、`m8-b9-compatibility`。命令为 `npx vitest run --configLoader runner --project fast <上述文件> --maxWorkers 4`；机器 JSON 在 `artifacts/orb-combo/targets-final.json`。

首轮fast全量5461项：4864通过、463失败、134待执行/跳过，耗时约801秒。该轮已定位并修复新forge恢复漏接、save版本负向测试及growth场景；最后一轮全量另记最终结果，不以定向通过替代全量通过。剩余旧epoch/固定掉落场景、服务器测试及环境限制须如实报告。

### 最终验收结果（2026-10-21）

- `npm.cmd run build -- --configLoader runner`：**通过**，包含 `tsc --noEmit`；完整日志 `artifacts/orb-combo/build-final.log`。Windows 默认配置打包加载器遇到父目录访问限制，使用 Vite 支持的 runner 加载配置，未改构建配置/依赖锁文件，未联网安装。
- `update-content-identities.cjs --check`：通过；完整指纹与上表一致。`verify-orb-streams.cjs`：78商店/30重铸输出及游标再次逐字节一致。11组合成验收全部通过，最终定向17文件244项全部通过。
- 最终 fast：`--project fast --maxWorkers 4`，**418文件：354通过 / 64失败；5462项：4884通过 / 448失败 / 130跳过，716.53秒**。完整机器结果 `artifacts/orb-combo/fast-final.json`；可随交接保留的逐文件失败与示例见 [orb-combo-fast-report.json](evidence/v17/orb-combo-fast-report.json)。导入/beforeAll失败导致部分测试未执行，不能计为通过。
- 2D顶层JS以gzip level9实测 **627432 / 424763 = 1.4771343078 ≤ 1.49**；分母同时从本地已签基线 dist 重算一致。3D单独加载，不在2D入口预加载，相关隔离构建测试通过。
- 只读Git核对：分支/HEAD不变；禁改目录、v17 epoch、历史归档和 `g2-4b-herald-raw/manifest.json` 无改动；`git diff --check` 通过。没有暂存、提交、重录或部署。

**尚未收口，不能称全量通过或发布就绪：**

1. `opening-random-identity`、`m8-content-equivalence`、`m5-route`、M6 integration、epic的3个已录制状态恢复等仍使用旧schema/digest/golden。按本次授权边界不重录，留给本链最后在LF克隆统一生成与复验。
2. `m8-b8-live-*`、部分装备/成长/异常/容量场景、R3/R4消耗品/共享用例仍假设旧种子的固定英雄、组件、工具和到达时机。需要适配真实获取路线、资源容量与独立场景断言，**不是只重录摘要就能全部解决**。本次未把这些失败删除、跳过或降低断言以换绿。
3. `explorer-bracer-restore-pressure` 的子进程esbuild报 `Cannot read directory "../../..": Access is denied`，属于本机受限环境的未完成验证，需在允许该构建访问的环境重跑。
4. 服务器仍有4个测试文件失败：`c18b-consumable-preview`、`c18b-use-consumable`、`e2e-replay-errors`、`t10-combat-ops`。目录按约定未改，需服务器负责人适配/核验。服务器整局到排名、生命周期、断线重连、加时与回放投影等正例已经通过，不能代替这4个失败的验收。

## 接线边界

`createOrbLayout` / `freezeOrbLayoutThroughRound` / `freezeLootThroughRound` 函数参数、成功/失败联合不变；导出的 ledger/binding 的版本字面量升为 v2。`invalid-orb-layout` / `stale-orb-layout` / `invalid-orb-round` 不增加枚举。`OrbTier` 不变。服务器应保存返回值，不能自己计算组合。新 forge id、5 费和完整 2 星的投影按现有通用字段读取；界面须检查每轮多珠摆放及新锻造器名称。本次未改 `src/server/`、`tests/server/`、渲染或表现目录，端到端联机接线待对应负责人验收。

建议提交信息：`feat(simulation): sample v17 stage orb combinations and independent box streams`。
