# #260：v15 CI 非服务器失败收口

基线：`codex/loot-orb-claim` / `46454b77`，2026-10-20。改动留工作区；未联网、安装依赖、写 Git 或修改禁改目录。本轮新增终局入口；版本与内容 digest 未主动修改，源码指纹受影响，重录及验证状态见下。

## 逐项判定与处理

| 文件（`tests/` 下） | 分类 | 原因与处理；保留的验收目标 |
| --- | --- | --- |
| d11-wiring-match.test.ts | 计时 | 两个异常用例的完整历史回放超过默认 5 秒。仅这两条改为 60 秒，附 `Temporarily … (user-approved 2026-10-20)` 注释；获得、战斗、唯一结算、篡改拒绝及历史恢复断言全部保留。旧身份断言实际位于 artifacts 测试，见下。 |
| g2-4b-artifact-forge.test.ts | 期望过时 | tier 10/14 共用夹具仍要求联机赠送立即得到 unitId。修改 `helpers/g24-forge-states.ts`：先验证法球收据及领取前未入席，再用 `claimOrb` 领取后部署；保留手动/超时、恢复、重复及篡改拒绝。 |
| g2-4b-artifacts.test.ts | 期望过时 | 精确身份由 v14 改为 `g2-4b-multiplayer-orb-claim-v15`，29 项来源池与所有数值断言不变。 |
| g2-4b-resists-restore.test.ts | 夹具路线过时 | 死亡持有者移至 (2,4)，仍实测死亡时的盾并恢复；胸甲来源改为公开 seed 27，精确钉住 tick 169 获得 Gargoyle、tick 180 周期盾，保留全部篡改拒绝。 |
| g2-4b-support-forge.test.ts | 期望过时 | 与 artifact-forge 相同的法球夹具原因；3 条均由同一领取步骤修复，支持装池、数量、收据及拒绝断言保留。 |
| g2-4b-trench-gold.test.ts | 夹具路线过时 | 扩池改变自然战斗与金装抽取时序。改用公开 seed 1；仍要求原身 Gambler、分身 Gambler、分身 Collector 各一次成功，共 3 笔唯一发放，并逐词校验独立 RNG。 |
| presentation/g2-3-display.test.ts | 界面实现缺口，未改 | `avarice-incarnate`、`headhunter` 的 `g23AnomalyApiName` 返回 undefined。测试要求完整内容桥接，不能删掉这两个 ID 或放宽断言；需 Claude 修改 `src/presentation/`，本轮按指令停止该项修改。 |
| combat-first-pass-frames.test.ts | 期望过时 | 双边任务新增 `sampleBankGold`。两处精确形状改为 `['sampleBankGold','advance']`；关闭录制、tick-zero、字节一致性检查保留。 |
| g2-4a-crown-history.test.ts | 期望过时 | 猎头者与冠冕共用历史证据错误文案；4 例改断言完整当前错误字符串，保留伪造历史、完整历史恢复等检查。 |
| m5-growth.test.ts | 夹具路线过时 | 新强化组合使原站位未触发致死弹跳。保留真实收入、9 张付费卡、两件合成装备，改部署到 (0,7)；仍要求实际成长事件，每次 125 Bps、唯一结算、恢复不重发、出售及合成守恒。 |
| bracer-multikill-stacks.test.ts | 夹具路线过时 | 无贡献改 seed 5 / Manaflow I / tick 192，有贡献保留 seed 3151248 并明确选择 Manaflow II / tick 369。仍要求 Sion 自己击杀，持有者分别 +0 / +15，绝不冒领 +20，并逐 tick 比较完整恢复。 |
| g2-4b-pr161-restore.test.ts | 期望过时 + 测试环境缺陷 | D11 赠送增加英雄出生序号，Swain 收据精确改为 unit-65，仍将同一实际英雄及收据一起伪造成未持有 Zeri 并要求三个入口拒绝。冷进程用例的 esbuild 服务扫描受限祖先目录失败，改为 Node 侧解析并加载本地领域依赖；保留真实冷 Node 进程、所有档案及完整恢复比较。 |
| m8-b8-equipment-fixture.test.ts | 计时 | 本轮原时限下也通过；CI 报告的 components three/four 用例仅放宽到 30 秒并加指定临时授权注释，所有出生、合成、强化、数值及恢复断言不变。 |
| chest-bracer-integration-trial.test.ts | 夹具路线过时 | 原 seed 580279 已不提供 Manaflow I，回落成 Lineup，不能维持原战斗。公开 seed 554 提供 Manaflow I：Archangel tick 80，首 pulse 180，首次/重复 Bracer 220/344，持有者死亡 452。完整 8 边界、+30 AP、两层收益、3 次周期、死亡清理、两种恢复与篡改拒绝保留。 |
| task-mechanism-restore.test.ts | 夹具路线过时 | 两个 Sion 案例同 bracer；Forge 复活改为提供 Bulky Buddies I 的公开 seed 53（死亡 211、复活 264），仍要求持有者活着且触发事实在三个入口严格验证。 |

没有为上述失败修改领域规则、数值或生产恢复校验。已有测试实现问题为冷进程构建路径解析；不把它归为游戏规则缺陷。终局入口是本轮单独新增的领域能力。

## 服务器边界（续任务更正）

`tests/server/` 的处理已交由配套 PR #262；调度方撤掉上轮修改。本轮不修改或修复这些文件，也不沿用旧日志中的服务器通过数。按续二要求，在非服务器全套之后单独运行服务器测试并列结果，不计入非服务器验收分母。

## 新终局领域入口

`forfeitTerminalOrbs(state: MatchState): MatchStep`，由 `src/simulation/match.ts` 和 `src/server-entry/index.ts` 导出，返回 `{state, events}`，无失败枚举。服务器确认整局结束后逐席调用，包括赢家与其他 active 存活席位，不要求已转 gameOver/eliminated；调用者提交返回状态与事件，不重复编号。

复用原作废计划器与 Match 编号器：清领取队列，对已赚未领条目各写唯一 forfeited/gold=0 收据，依次发 lootForfeited / lootGranted，domain=match、eventSeq 连续推进。保留已领、未赚 planned 条目、资源、RNG、池与 phase/status；不执行获取/选择/装备钩子。重复调用、快照恢复后重试无事件/收据；无待清理队列时返回原 state 引用。新增测试覆盖存活席、排队、gameOver、淘汰、单机/空席、编号、顺序、池守恒及 JSON 恢复幂等。

MATCH_CONTRACT / MULTIPLAYER_CONTRACT 已补完整签名与调用边界；UI_REQUESTS / LOOT_ORB_CLAIM_V15 同步交接用语，避免服务器再次编号。

## 本轮 epoch

续二已按 release → herald → inputs → live-reveal 顺序完成重录；inputs --check、Herald verify、live-reveal --check、三份 audit 的 sourceDigests 核对全部通过。四路线各 33 战、两个 67 检查点存取、Herald 五组七文件、inputs 九条证据和 live-reveal 四分支均通过原断言。生成数据与旧 v15 字节一致，仅 release/input/live-reveal audit 和 Herald manifest 更新 match.ts / server-entry/index.ts 的源码 SHA；没有手写指纹。

历史审计通过：86 个文件按原基线逐字节一致；manifestReference=`6392f319^`，G2-4b 基线仍为 `430017516a18fb38ee028cec000a44fb94bb638f`。原 G2-3 content baseline 额外核对通过。日志与逐步退出码见未提交的 `artifacts/task260-resumed/epoch-*.log`、`epoch-summary.json` 和 `record-release.log`。

## 需 Claude 补齐的展示桥接

`tests/presentation/g2-3-display.test.ts:132` 的完整目录检查失败。独立遍历全部异常确认仅以下两个 ID 返回 undefined（证据：`artifacts/task260-resumed/ui-bridge.json`）：

| content ID | apiName | 客户端名称 |
| --- | --- | --- |
| avarice-incarnate | TFT13_GoopBuff_AvariceIncarnate | 贪财化身 |
| headhunter | TFT13_GoopBuff_Headhunter | 猎头者 |

建议 Claude 在 `src/presentation/s13-g23-manifest.ts` 的 `S13_EXTRA_ANOMALIES` 补这两项，由 `src/presentation/g23-display.ts` 现有 ALL_ANOMALIES 桥接读取，必要时补显式映射；原 G23_ANOMALIES 的 30 项历史表无需扩容。名称与说明来源为 `src/simulation/content/d11-fill-source.ts`，不要编造图标路径。验收保持完整目录桥接断言，两个 ID 均解析为上表 apiName，再复跑该文件。本轮没有修改 presentation 或放宽其测试。

## 续二新增修正

- `npx.cmd tsc --noEmit` 首次发现终局测试的 gameOver 夹具可能携带 RunningCombat。增加 finished/null 检查并显式传入已收窄的 combat 后，原命令通过；终局五条新用例与整份 loot-orb-claim 的 25 条均通过。
- 全套发现 `explorer-bracer-restore-pressure.test.ts` 两条用例在 esbuild 原生服务扫描祖先目录时失败。`scripts/profile-explorer-bracer-restore.cjs` 改为独立 Node 构建进程、本地依赖解析，保留同步 profile 接口与真实独立测量进程。
- 随后确认环境无可调用的 Python 测量器，改由 Node `process.resourceUsage().maxRSS` 在子进程退出时读取原生峰值 RSS（KiB），缺少有效峰值即报错。64 MiB Buffer 分配/GC 探针确认峰值保留：分配时 RSS 114380800 字节，GC 后 RSS 103075840 字节，原生峰值 111704 KiB。
- 两条压力用例复跑均通过；原 1 秒、256 MiB RSS、256 MiB heap、巨量伪造拒绝及 AP/AD 数值断言全部保留。独立 CLI 复核：huge-count 22.47 ms / 105896 KiB，dedup-titan 33.41 ms / 140696 KiB；AP 301 个（100..700）、AD 271 个。证据见 `pressure-node-rerun.json`、`profile-*.json`、`native-rss-probe.json`。
- 该 profile 脚本不在 v15 的 328 项 sourceDigests 中，领域源码未再变；因此已完成的 epoch 校验仍适用于当前领域代码。
- 首轮炮手恢复触发 180 秒超时，凯特琳恢复进程以 `4294967295` 退出且无 JSON。全套使用独占进程、2 GiB 堆上限复核：炮手 155.5 秒、法师 233.8 秒、凯特琳 235.2 秒均完整通过，保留各自原时限。首次异常退出根因仍未确定，不能将无报告运行计为通过；首轮证据与成功复核分开保留。

## 上轮运行证据（不代表本轮最终源码已验证）

- 首次复现：指定 21 文件，238 通过 / 36 失败。
- 类型检查：`node node_modules/typescript/bin/tsc --noEmit` 通过。
- `node scripts/v15-fixture-audit.cjs --baseline-commit=915439176f9990fe1846a506d6477cfe81640a7a --check` 通过：86 个历史文件逐字节一致，manifest 引用仍为 `6392f319^`、G2-4b 基线仍为 `430017516a18fb38ee028cec000a44fb94bb638f`。
- 每文件机器证据位于未提交的 `artifacts/task260-files/`；manifest 保留原 128、指定 21、去重后 147 文件名单。
- 全套及最终逐文件结果在全部执行完成后填入下方，运行中的记录不视为完成证据。

<!-- TASK260_RESULTS -->
续二最终：全部要求的检查与测试范围已执行，非服务器剩余 1 条展示桥接失败，按分工交 Claude。

用户已明确授权现有 Node / npx / Vitest / tsc / esbuild 工具链。本轮离线、不 npm ci、不写 .git；HEAD 仍为 46454b77，改动全部留工作区。

| 范围 | 文件数 | 通过 | 失败 | 跳过 |
| --- | --- | --- | --- | --- |
| 逐文件首轮（另 1 文件无报告） | 141 | 2227 | 2 | 0 |
| 指定范围最终复核 | 141 | 2229 | 1 | 0 |
| 全套非服务器最终 | 318 | 4400 | 1 | 0 |
| 服务器单独一次（独立统计） | 45 | 273 | 12 | 0 |

- 指定范围：A 清单 15 文件 + V15_RELEASE 测试表全部 128 文件，去重后 141；新增终局五条包含在 loot-orb-claim 的 25 条内，全部通过。
- 炮手首轮超时和凯特琳首轮无报告均已取得独立单文件通过报告；最终复核按每文件最新完整报告去重，重试不重复计数。
- 全套枚举 318 文件，分 23 批；普通批次 2 工作线程，长路线与计时文件单独 1 工作线程，Node 堆上限 2 GiB。全部实际文件与请求清单匹配，0 缺失报告。
- 原始全套批次为 4398 通过 / 3 失败 / 0 跳过；护臂压力工具链两条修复并复跑通过后，最终为 4400 / 1 / 0。
- tsc 通过；release → herald → inputs → live-reveal 重录及 inputs check / Herald verify / live-reveal check 全通过；86 历史文件逐字节通过。最终三份 audit 各 328 项源码 SHA 再核对通过。
- git diff --check 通过；禁改目录和历史 G2-3/G2-4b 文件无 diff；没有素材文件改动。
- 机器证据：`artifacts/task260-resumed/selected-summary.json`、`artifacts/task260-resumed/full-summary.json`、`artifacts/task260-resumed/final-results.json`、`artifacts/task260-resumed/final-checks.json`；逐文件、逐批和修复复跑 JSON/日志均保留。

### A 清单最终结果

| 文件（tests/ 下） | 通过 | 失败 | 跳过 |
| --- | --- | --- | --- |
| `bracer-multikill-stacks.test.ts` | 25 | 0 | 0 |
| `chest-bracer-integration-trial.test.ts` | 11 | 0 | 0 |
| `combat-first-pass-frames.test.ts` | 11 | 0 | 0 |
| `d11-wiring-match.test.ts` | 5 | 0 | 0 |
| `g2-4a-crown-history.test.ts` | 56 | 0 | 0 |
| `g2-4b-artifact-forge.test.ts` | 7 | 0 | 0 |
| `g2-4b-artifacts.test.ts` | 49 | 0 | 0 |
| `g2-4b-pr161-restore.test.ts` | 11 | 0 | 0 |
| `g2-4b-resists-restore.test.ts` | 21 | 0 | 0 |
| `g2-4b-support-forge.test.ts` | 8 | 0 | 0 |
| `g2-4b-trench-gold.test.ts` | 1 | 0 | 0 |
| `m5-growth.test.ts` | 2 | 0 | 0 |
| `m8-b8-equipment-fixture.test.ts` | 4 | 0 | 0 |
| `task-mechanism-restore.test.ts` | 20 | 0 | 0 |
| `presentation/g2-3-display.test.ts` | 15 | 1 | 0 |

### 全套原始批次（失败修复后的最终统计见上）

| 批次 | 文件 | 通过 | 失败 | 跳过 | 秒 |
| --- | --- | --- | --- | --- | --- |
| 1 | 24 | 257 | 2 | 0 | 58.2 |
| 2 | 24 | 452 | 0 | 0 | 56.0 |
| 3 | 24 | 174 | 0 | 0 | 32.1 |
| 4 | 24 | 495 | 0 | 0 | 48.6 |
| 5 | 24 | 370 | 0 | 0 | 29.9 |
| 6 | 24 | 359 | 0 | 0 | 53.6 |
| 7 | 24 | 370 | 0 | 0 | 85.6 |
| 8 | 24 | 457 | 0 | 0 | 82.6 |
| 9 | 24 | 282 | 0 | 0 | 29.3 |
| 10 | 24 | 329 | 1 | 0 | 45.7 |
| 11 | 24 | 296 | 0 | 0 | 35.1 |
| 12 | 24 | 244 | 0 | 0 | 45.7 |
| 13 | 20 | 280 | 0 | 0 | 44.9 |
| 14 | 1 | 1 | 0 | 0 | 155.5 |
| 15 | 1 | 1 | 0 | 0 | 233.8 |
| 16 | 1 | 1 | 0 | 0 | 235.2 |
| 17 | 1 | 1 | 0 | 0 | 239.2 |
| 18 | 1 | 8 | 0 | 0 | 56.6 |
| 19 | 1 | 2 | 0 | 0 | 85.7 |
| 20 | 1 | 2 | 0 | 0 | 95.0 |
| 21 | 1 | 2 | 0 | 0 | 96.3 |
| 22 | 1 | 3 | 0 | 0 | 56.0 |
| 23 | 1 | 12 | 0 | 0 | 11.6 |

### 剩余非服务器失败

- `tests/presentation/g2-3-display.test.ts`：`content id bridge never captures an existing hero, trait or item id`。两个缺失 apiName 及 Claude 修改建议见上文展示桥接节。

### tests/server 单独一次结果

`node --max-old-space-size=2048 node_modules/vitest/vitest.mjs run tests/server/ --config artifacts/task260-resumed.vitest.config.ts --configLoader runner --maxWorkers 1 --no-file-parallelism --reporter=json --outputFile=artifacts/task260-resumed/server-once.json`

45 文件（7 文件失败）：273 通过 / 12 失败 / 0 跳过。仅运行一次，未修改或修复 tests/server 与 src/server；结果不并入非服务器分母。

| 文件（tests/server/ 下） | 状态 | 通过 | 失败 | 跳过 |
| --- | --- | --- | --- | --- |
| `augment-tier-consistency.test.ts` | failed | 1 | 1 | 0 |
| `bot-driver-timing.test.ts` | passed | 2 | 0 | 0 |
| `bot-driver.test.ts` | passed | 9 | 0 | 0 |
| `c15-replay-unit-ids.test.ts` | failed | 2 | 2 | 0 |
| `c18b-consumable-preview.test.ts` | passed | 6 | 0 | 0 |
| `c18b-use-consumable.test.ts` | failed | 7 | 1 | 0 |
| `c9-revealed-loot.test.ts` | passed | 5 | 0 | 0 |
| `carousel-room.test.ts` | passed | 20 | 0 | 0 |
| `clock.test.ts` | passed | 3 | 0 | 0 |
| `e2e-replay-errors.test.ts` | failed | 1 | 4 | 0 |
| `g2-2-emissary-wins.test.ts` | failed | 1 | 1 | 0 |
| `g2-3-replay-mirror.test.ts` | passed | 1 | 0 | 0 |
| `g2-4a-forge-timeout.test.ts` | passed | 5 | 0 | 0 |
| `g2-4b-artifact-forge-room.test.ts` | passed | 5 | 0 | 0 |
| `g2-4b-support-forge-room.test.ts` | passed | 5 | 0 | 0 |
| `g23-server-facts.test.ts` | passed | 3 | 0 | 0 |
| `g24-voidspawn-move.test.ts` | passed | 8 | 0 | 0 |
| `g3-ops.test.ts` | passed | 8 | 0 | 0 |
| `g5-battle-ranking.test.ts` | passed | 7 | 0 | 0 |
| `g5-economy-preview.test.ts` | passed | 2 | 0 | 0 |
| `lifecycle.test.ts` | passed | 6 | 0 | 0 |
| `lobby.test.ts` | passed | 4 | 0 | 0 |
| `local-room-client-full-match.test.ts` | passed | 2 | 0 | 0 |
| `local-room-client.test.ts` | passed | 5 | 0 | 0 |
| `mechanic-failed-push.test.ts` | failed | 0 | 1 | 0 |
| `net/dedupe-session.test.ts` | passed | 6 | 0 | 0 |
| `net/heartbeat.test.ts` | passed | 8 | 0 | 0 |
| `net/messages.test.ts` | passed | 7 | 0 | 0 |
| `net/server.test.ts` | passed | 13 | 0 | 0 |
| `net/takeover.test.ts` | passed | 3 | 0 | 0 |
| `pairing-room.test.ts` | passed | 3 | 0 | 0 |
| `pairing.test.ts` | passed | 23 | 0 | 0 |
| `projection-wire.test.ts` | passed | 9 | 0 | 0 |
| `projection.test.ts` | passed | 5 | 0 | 0 |
| `purity.test.ts` | passed | 4 | 0 | 0 |
| `real-clock.test.ts` | passed | 2 | 0 | 0 |
| `replay-client.test.ts` | passed | 6 | 0 | 0 |
| `replay-first-pass.test.ts` | passed | 7 | 0 | 0 |
| `room.test.ts` | passed | 13 | 0 | 0 |
| `round-commit-timing.test.ts` | passed | 1 | 0 | 0 |
| `round-commit.test.ts` | passed | 6 | 0 | 0 |
| `shared-pool-room.test.ts` | passed | 9 | 0 | 0 |
| `t10-combat-ops.test.ts` | failed | 8 | 2 | 0 |
| `two-sided-resolver.test.ts` | passed | 14 | 0 | 0 |
| `ws-client.test.ts` | passed | 8 | 0 | 0 |

服务器失败用例完整名称、原始错误和日志：`artifacts/task260-resumed/server-once.json`、`artifacts/task260-resumed/server-once.log`。
<!-- END_TASK260_RESULTS -->

## 实际改动文件

- `tests/bracer-multikill-stacks.test.ts`
- `tests/chest-bracer-integration-trial.test.ts`
- `tests/combat-first-pass-frames.test.ts`
- `tests/d11-wiring-match.test.ts`
- `tests/g2-4a-crown-history.test.ts`
- `tests/g2-4b-artifacts.test.ts`
- `tests/g2-4b-pr161-restore.test.ts`
- `tests/g2-4b-resists-restore.test.ts`
- `tests/g2-4b-trench-gold.test.ts`
- `tests/helpers/g24-forge-states.ts`
- `tests/m5-growth.test.ts`
- `tests/m8-b8-equipment-fixture.test.ts`
- `tests/task-mechanism-restore.test.ts`
- `tests/loot-orb-claim.test.ts`
- `src/simulation/match.ts`
- `src/server-entry/index.ts`
- `docs/MATCH_CONTRACT.md`
- `docs/MULTIPLAYER_CONTRACT.md`
- `docs/LOOT_ORB_CLAIM_V15.md`
- `docs/UI_REQUESTS.md`
- `scripts/profile-explorer-bracer-restore.cjs`
- `docs/evidence/v15/release-audit.json`
- `docs/evidence/v15/input-fixture-audit.json`
- `docs/evidence/v15/live-reveal-audit.json`
- `tests/fixtures/v15-herald-raw/manifest.json`
- `docs/V15_CI_TASK260.md`

## 建议提交信息

`fix(v15): finalize terminal orbs and refresh epoch evidence`
