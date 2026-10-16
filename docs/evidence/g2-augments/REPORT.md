# W4 强化 6→30：验收报告（已合入 #118，验收日志已重建）

- 指定起点：`80b893ac66c01b79ec6606b493e141eca3bf00cb`。
- 分支：`codex/g2-augments-30`；PR #118 合入 `multiplayer`（merge `599b2e7`）。
- 最终受测代码提交：`0f7de219ac152abe96e53f9908ea2d2f69ae9feb`（`80b893a..0f7de219` 两提交，经 git bundle 原样推送）；此前WIP专项通过不计入最终验收。
- 环境：Linux x64，Node v24.19.0，npm 11.9.0；Node报告availableParallelism=9，totalMemory=10,451,464,192 B。

## 范围与实现

原六项保留，新增24项的精确列表和raw字段见 [RECONCILIATION.md](RECONCILIATION.md) 与 [source-selection.json](source-selection.json)。
本批不修改英雄/羁绊定义、基础经济、XP、日程、选秀、服务器、UI或图片资源。
取得金币复用唯一schedule receipt；失败命令保留原对象、事件和RNG。
新增静态条件编译、整数百分之一累计、战斗周期/死亡贡献，以及现有攻击触发器的灼烧/重伤接线。

新增机制：mentorship、itemCollector、backup、lineup、findCenter、littleBuddies、bronzeForLife、builtDifferent、
fractionalFlat、clockworkAccelerator、loneHero、climbLadder、inspiringEpitaph、blisteringStrikes。
最后一项复用现有trigger/status/periodic框架；fractionalFlat只是整数定点内部表示。
每个机制在 `g2-augments-static.test.ts` 或 `g2-augments-combat.test.ts` 有独立断言。
同族组合和来源未细化的行为已在MATCH_CONTRACT末节明确标U。

## 身份与迁移

CONTENT原值 `fnv1a32-utf16:bb66f4f8`；新值 `fnv1a32-utf16:8914b323`（见 `tests/g2-augments-content-baseline.json`）。
rules/content：`s13-g2-2-aug30-v1` / `s13-14.24b-g2-2-aug30-v1`。
LOOT_REPLAY不变；schema/save/replay/command 7/3/3/3、NET_PROTOCOL 3不变。

新夹具必须由真实命令录制，保留旧原始字节，详情见 [FIXTURE_MIGRATION.md](FIXTURE_MIGRATION.md)。
扩池导致固定seed真实offers改变；路线只适配真实选择优先级，依据与前后证据见 [ROUTE_ADAPTATION.md](ROUTE_ADAPTATION.md)。
全量/计时与生成器结果见下文“验收日志”；不通过重录后的绿色结果自行证明玩法正确。

## 实现中发现并修复

- 联机双边snapshot不带roundResults：旧Pumping I保留原严格校验counter；II/III按各自取得轮到当前轮之前的战斗日程计算，排除supply、包含overtime。真实双边snapshot测试覆盖。
- Spirit Link需要玩家HP历史而双边snapshot不带：最终选择Blistering Strikes替代，未新增输入合同。
- Bulky多档原共用flag导致只发第一份盾：同一死亡边界逐来源发盾后标记，保持唯一性。
- Glass多档原只取首个初始HP：按合同U相加损失比例，I+II为60%HP与32%增伤。
- 新Clockwork公开路线暴露既有Singed合法状态恢复误拒，精确修复与拒绝反例见 [SINGED_RESTORE_FIX.md](SINGED_RESTORE_FIX.md)。

恢复保证明确来源、系数、时间与贡献完整性，不宣称快照能认证全部历史；联合伪造同一死者所有贡献到另一合法较早tick的限制见合同。真实生产恢复后续算与死亡不重发已有专项，最终以固定SHA重测为准。

## 必需验收

- npm run typecheck
- npm test（默认fast，无额外worker/pool/isolate参数）
- npm run test:timing（原32项与阈值）
- npm run test:server-entry
- npm run build

前期专项日志只是诊断，最终记录见下文“验收日志”，逐项附提交、命令、通过数与耗时；不把旧版本结果覆盖新代码。

## 验收日志

原 Codex 会话的本地仅文档提交 `304845a`（本节原件）未进入 bundle，GitHub 与 Codex 本地仓库均已无该对象，无法找回。本节按仓库内现存记录重建，不补造原会话的机器环境与耗时；Codex 在原会话自报 `npm test` 3203 用例全过，原始日志随该提交一并丢失。

### 一、合并树验收（指挥，2026-10-16，记录于 `docs/DISPATCH_2026-10-14.md` 第十一批结果二）

受测树：`multiplayer@6f5253a`（含 #117）+ `0f7de219`，合入后 origin 树（merge `599b2e7`）与受测树代码零差异。

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm test` | 239 文件 / 3202 用例全过，450 s（比 Codex 自报少 1 例，即 #117 移入 timing 的整局用例） |
| `npm run test:timing` | 7 文件 / 33 用例全过，219 s |
| `npm run test:server-entry` | 通过 |
| `npm run build`、`npm run build:game` | 通过 |
| e2e | c7 23 / g1 20 / g2-traits-tooltips 18 / g5 78 / p7-carousel 47，全过 |

静态审查：simulation diff 无 `Math.random`/`Date.now` 等禁用 API；无 skip/todo；三选一仍精确消耗 3 个 LCG 字，等权候选池标 U 写入 MATCH_CONTRACT。

### 二、专项复跑（重建本节时，2026-10-16）

受测提交：`multiplayer@94eecbc`（`599b2e7` 之后只有文档提交；与 `0f7de219` 相比 simulation、scripts 相同，tests 只差 #117 的 tests/server 两个文件）。环境：Linux x64，Node v22.22.0，vitest 5.0.3，tsc 5.9.3。

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过，15 s |
| `npx vitest run tests/g2-augments-*.test.ts tests/p7-1-identity.test.ts tests/m8-contracts.test.ts` | 7 文件 / 262 用例全过，约 10 s：choice 35、combat 16、identity 139、multiplayer 4、static 60、m8-contracts 6、p7-1-identity 2 |
| `node scripts/record-g2-augments-fixtures.cjs --baseline-root=<80b893a 导出>` | `{"passed":true,"mode":"verify","files":7,"contentDigest":"fnv1a32-utf16:8914b323"}`，154 s；四条路线首个命令/玩法差异均为强化 offer（如 `investment-strategy-i` → `bronze-for-life-i`），与 [ROUTE_ADAPTATION.md](ROUTE_ADAPTATION.md) 一致 |
| `node scripts/record-g2-augments-economy.cjs --baseline-root=<80b893a 导出>` | `passed:true`，3 例，seed 42/13，输出与 [b8-economy-migration.json](b8-economy-migration.json) 逐字节相同，7 s |

基线导出方式：`git archive 80b893ac66c01b79ec6606b493e141eca3bf00cb`，`node_modules` 链接到当前仓库。本次只跑上述专项，未重跑全套。

## 三问

- 测试过了吗：是。合并树全套、计时、server-entry、build 与 e2e 全过，见“验收日志”。
- 越界了吗：否。最终diff 78 文件：19 simulation / 5 scripts / 39 tests / 15 docs，无 server、rendering、presentation、tests/server。
- 改玩法了吗：按授权新增24强化并改变候选池/CONTENT身份；不改变已冻结日程或基础经济，组合约定已披露。

## 明确批准的版本断言同步

用户于本轮另行明确批准 `tests/m8-contracts.test.ts` 第73行：
`currentRulesVersion: 's13-g2-2-v1'` → `'s13-g2-2-aug30-v1'` 及上传。
该字段是 `CompatibilityView` 的当前版本字面量类型，随已批准规则身份升级必须同步；
只改这一个版本字符串，不改该文件其余断言、恢复要求或M8玩法。

### 用户明确批准的旧身份测试适配

`tests/p7-1-identity.test.ts` 中旧 P7 fixture 的两处恢复正控改为旧 digest 拒绝负控，用户已明确批准此适配及上传。新 digest 的等价恢复正控位于 `tests/g2-augments-identity.test.ts`，覆盖新录制的原始存档并逐例执行生产恢复；严格 digest 校验保留，不以旧档恢复成功作为本批期望。
