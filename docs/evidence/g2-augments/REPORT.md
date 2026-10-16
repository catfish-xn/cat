# W4 强化 6→30：验收报告（进行中，未签收）

- 指定起点：`80b893ac66c01b79ec6606b493e141eca3bf00cb`。
- 分支：`codex/g2-augments-30`；PR目标：`multiplayer`，不合并。
- 最终受测代码提交：待固定；本文不将此前WIP专项通过当作最终验收。
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

CONTENT原值 `fnv1a32-utf16:bb66f4f8`；新值待正式录制结果。
rules/content：`s13-g2-2-aug30-v1` / `s13-14.24b-g2-2-aug30-v1`。
LOOT_REPLAY不变；schema/save/replay/command 7/3/3/3、NET_PROTOCOL 3不变。

新夹具必须由真实命令录制，保留旧原始字节，详情见 [FIXTURE_MIGRATION.md](FIXTURE_MIGRATION.md)。
扩池导致固定seed真实offers改变；路线只适配真实选择优先级，依据与前后证据见 [ROUTE_ADAPTATION.md](ROUTE_ADAPTATION.md)。
全量/计时与生成器结果待补，不通过重录后的绿色结果自行证明玩法正确。

## 实现中发现并修复

- 联机双边snapshot不带roundResults：旧Pumping I保留原严格校验counter；II/III按各自取得轮到当前轮之前的战斗日程计算，排除supply、包含overtime。真实双边snapshot测试覆盖。
- Spirit Link需要玩家HP历史而双边snapshot不带：最终选择Blistering Strikes替代，未新增输入合同。
- Bulky多档原共用flag导致只发第一份盾：同一死亡边界逐来源发盾后标记，保持唯一性。
- Glass多档原只取首个初始HP：按合同U相加损失比例，I+II为60%HP与32%增伤。
- 新Clockwork公开路线暴露既有Singed合法状态恢复误拒，精确修复与拒绝反例见 [SINGED_RESTORE_FIX.md](SINGED_RESTORE_FIX.md)。

恢复保证明确来源、系数、时间与贡献完整性，不宣称快照能认证全部历史；联合伪造同一死者所有贡献到另一合法较早tick的限制见合同。真实生产恢复后续算与死亡不重发已有专项，最终以固定SHA重测为准。

## 必需验收（待完成）

- npm run typecheck
- npm test（默认fast，无额外worker/pool/isolate参数）
- npm run test:timing（原32项与阈值）
- npm run test:server-entry
- npm run build

前期专项日志只是诊断，最终记录将逐项附提交、命令、通过数与耗时；不把旧版本结果覆盖新代码。

## 三问

- 测试过了吗：专项已执行，最终全套与计时尚待完成。
- 越界了吗：当前仅src/simulation、tests非server、scripts、docs；最终diff还需复核。
- 改玩法了吗：按授权新增24强化并改变候选池/CONTENT身份；不改变已冻结日程或基础经济，组合约定已披露。
