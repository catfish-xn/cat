# 索敌 P1（cursor/targeting-p1）

基线：`origin/cursor/v26-integration` @ `0ebf828f8ca7937edf1f94a8945a92989fdf03d8`。开工前 `git merge-base --is-ancestor 28fd974a1504372ae5e0f3127e23547735c7bd01 HEAD` 退出码 0（P0 提交 `28fd974a` 已在这条历史上）。本分支只改 S13 普通索敌的等距决胜和硬控暂停。没有重录 fixture，没有 `--write`，没有改超时，没有改 `src/server` 或界面，没有提交素材，不开 PR。

## 改了哪里

- [combat-targeting.ts](../src/simulation/combat-targeting.ts)：`ordinaryNearestTies` 收集最小六角距离上的可选敌人，只按代码点 ID 排序当抽词下标。`resolveDistanceTie` 在当前目标已在该集合时直接沿用且不抽词；否则对战斗流做拒绝采样。不传 `draw` 时仍返回最低 ID，供直接调用。`decideCombatTarget` 增加 `hardControlled` 与 `draw`。硬控时普通回调固定返回当前目标（死亡、出射程、出现更近敌人都不换），`targetEngaged` 在同一目标上原样保留。解控 tick 不传强制重扫，走 P0：射程内继续打，否则一步追击，再否则最近目标（含等距抽词）。
- [combat-s13.ts:326](../src/simulation/combat-s13.ts#L326)–[combat-s13.ts:331](../src/simulation/combat-s13.ts#L331)、[combat-s13.ts:384](../src/simulation/combat-s13.ts#L384)：删掉“受控或刚解控强制最近”的重扫集合。移动阶段和行动复核都传 `hardControlled = isControlled && !permanentFrenzy` 和 `ctx.draw`。`reselect` 在生产路径恒为 false，参数留给直接测试。
- [s13-augments-p2-combat.ts](../src/simulation/s13-augments-p2-combat.ts)：`p2Target` 的最近扫描仍是最低 ID。嘲讽、背叛、剔除弱者仍在回调之前返回。真正的等距替换只发生在 `decideCombatTarget`。
- [s13-rules.ts](../src/simulation/s13-rules.ts)：`ordinaryTargeting` 改为 `v26-p1-retain-in-range-one-step-equal-distance-lcg32-hard-cc-hold`。规则版本字符串仍是 `s13-g2-3-v26-neutrals-1424` / `s13-14.24b-g2-3-v26-neutrals-1424`，schema/save/replay/command 仍是 12/8/8/7。
- [m8/version.ts](../src/simulation/m8/version.ts)：注释写明等距抽词和眩晕／击飞保持。版本号未改。
- [identity-constants.ts](../src/simulation/content/identity-constants.ts)：生产摘要改为下面的重算值。没有跑 `--write`。
- [COMBAT_CONTRACT.md](COMBAT_CONTRACT.md)：新增「v26 索敌 P1」；P0 里“等距按 ID”和“受控重扫／刚解控强制最近”改指向 P1。遗留 M3/M4 引擎仍按 ID。

`byDistance`、技能专用选敌、鱼骨头、疯化学家、河蟹、引导、根深蒂固、剔除弱者脉冲期间的换锁都没改。硬控判定沿用 `isControlled`：眩晕，以及带 `knockup` 的眩晕。永久狂暴与原先可行动例外一致，仍选目标。

## 确定性怎么保证

抽词用本场已有的 `lcg32-v1`（`nextRandom`，与普攻暴击同一条流），不新增 RNG、不使用 `Math.random`。单位先按 ID 排序再决策，所以输入数组反序不改变抽到谁。

均匀下标与装备池相同：`limit = floor(2^32 / size) * size`，词 `>= limit` 则拒绝并计入 `rngDraws`，再抽下一个。size 为 2 时 2^32 整除，永不拒绝。size 为 3 时只有 `0xffffffff` 被拒。空候选返回 undefined；唯一最近不抽词；当前目标已在并列集合里不抽词，避免每 tick 换锁和重复抽词。移动阶段先抽；行动复核把该决策当作 previous，先前选择仍在落点后的并列集合里就不再抽。落点把并列拆成唯一更近时直接改锁、不再抽。不传 draw 的 `decideCombatTarget` / `p2Target` 仍是最低 ID。

种子 0 的第一个词 `1013904223 % 2 === 1`（`['a','z']` 取 `z`）；种子 1 的第一个词 `1015568748 % 2 === 0`（取 `a`）。三方并列把 `rngState` 设为 `653637408` 时先拒 `0xffffffff`，下一词 `0x3c558d52 % 3 === 2`，取排序后的 `z`，`rngDraws` 为 2。

## 范德尔 seed 104729

这两条规则解决不了折返。[targeting-p1.test.ts](../tests/targeting-p1.test.ts) 只回放前 11 tick，锁住原轨迹：tick 1 `(2,0)→(2,1)`，tick 6 `(2,1)→(3,1)`，tick 11 `(3,1)→(2,1)`。每个决策 tick 目标都是唯一最近的 `p6`，`isControlled` 为 false，没有等距抽词，也没有硬控。tick 11 开始范德尔在 `(3,1)`、射程 1，`p6` 在 `(3,3)`、距离 2。能走进射程的邻居只有 `(4,2)=e7` 和 `(3,2)=e5`，两格都被占。现有 BFS（邻居序 E, SE, SW, W, NW, NE，跳过占格）进不了射程，第一步空路回到 `(2,1)`。这是未批准的抢格绕路，不是平局或控制。P0 全场反序相等用例仍在 [targeting-p0.test.ts](../tests/targeting-p0.test.ts)。

## 补了哪些测试

[targeting-p1.test.ts](../tests/targeting-p1.test.ts) 共 9 项：

- 等距：种子 1 取 `a`、种子 0 取 `z`，各抽 1 词；反序输入与 JSON 恢复的目标和 `rngState` 相同。
- 当前目标已在并列里（含第二 tick）不抽词。当前目标更远时照常抽，种子 0 取 `z`。
- 直接 `decideCombatTarget` / `p2Target` 不传 draw 仍取最低 ID `a`。
- 三方拒绝采样：`rngDraws === 2`，目标 `z`，反序 `rngState` 相同。
- 眩晕与击飞（`knockup` true/false）：持续 2 tick 的期间保持出射程的 `old`，不移动、不攻击、不抽词；解控 tick 改锁更近的 `near` 并攻击。
- 硬控中把旧目标打死仍保持该 id；解控后改锁 `near`。
- 眩晕中的虚空嘲讽仍切到 `forced`。引导不冻结。永久狂暴在眩晕中仍改锁并攻击。
- 范德尔折返与占格原因，见上一节。

既有断言因规则变了结果、但没有放宽：

- [targeting-p0.test.ts](../tests/targeting-p0.test.ts)：受控重扫改为“眩晕两 tick 保持，解控后射程内的旧目标继续打”。预留落点例里，移动时 `old` 对 `a`/`p` 等距，种子 42 抽一次（下标 1 会是 `p`）；`a` 再走到 `(2,3)` 变成严格更近，行动复核改锁 `a` 且不再抽。`rngDraws` 从 0 改为 1，反序相等仍在。
- [m5-combat.test.ts](../tests/m5-combat.test.ts)：数值断言未改。把攻击者或崔丝塔娜的 `targetId` 钉在 P1 之前的最低 ID（`a`、`e`、`ea`），使保持生效、不再抽词，暴击序列不变。这不是规则回退，只是让该例不进入新的平局。
- [task-mechanism-restore.test.ts](../tests/task-mechanism-restore.test.ts)：`contribution: true`、种子 5 的击杀从 tick 323 移到 294，仍是 `unit-9:g23-sion` 普攻击杀 `enemy-r4-1`，贡献者、主人生命 500、诅咒、助攻 +15 不变。`contribution: false` 仍是种子 1、tick 323。
- 遗留 M3/M4“等距按代码点 ID”用例未改，并已通过。

## 测试

`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` 通过。`git diff --check` 通过。`node scripts/update-content-identities.cjs --check` 通过：content `fnv1a32-utf16:2a01c771`，loot `fnv1a32-utf16:10ece6a9`。

相关测试 `npx vitest run tests/targeting-p0.test.ts tests/targeting-p0-restore.test.ts tests/targeting-p1.test.ts tests/s13-augments-p2-combat.test.ts tests/combat-simulation.test.ts tests/m5-combat.test.ts tests/task-mechanism-restore.test.ts tests/t2-two-sided-battle.test.ts --maxWorkers=4`：177 项通过。没有跑浏览器、全仓或 `playtest-1022b-bench`。

基线 `0ebf828f` 在改 `ordinaryTargeting` 之前，`--check` 已经对不上：常量是 content `1d3bc95f`、loot `73d95fed`，重算是 content `eec631f4`、loot `10ece6a9`。loot 差异是合入前就有的，这条索敌字符串不进 loot 摘要。改字符串后 content 重算为 `2a01c771`，loot 仍是 `10ece6a9`。两个生产常量都改成重算值，使 `--check` 通过；没有 `--write`，没有改录制基线。

## 纪元／固定哈希漂移（不重录）

同一组 5 个文件、316 项：42 通过，273 失败。非漂移失败 0。

| 位置 | 失败 | 原因 |
| --- | ---: | --- |
| `augment-pool-batch5-g4-swarm.test.ts` | 1 | 整段存档 SHA。录制 `8dedd86620e10240…`。P0 审查现值为 `e3973dad…`。本分支现前缀 `dfe9564a46ec784245988135f55724654be96…`。 |
| `d11-wiring-bank.test.ts` | 1 | 行为与自洽重演已过。生产 content `2a01c771` ≠ v25 baseline `f671ab88`。 |
| `m8-content-equivalence.test.ts` | 134 | cannon／sniper 各 67 份旧状态，`restoreMatch` 报 `unsupported-version`。 |
| `opening-random-identity.test.ts` digest | 1 | 同上，`2a01c771` ≠ `f671ab88`。 |
| `opening-random-identity.test.ts` checkpoint | 134 | 录制状态各 67 份，`unsupported-version`。 |
| `opening-random-identity.test.ts:881` | 1 | seed 42 首战。录制 `firstBattle.ticks` 是 164；现值为 274。P0 审查时仍是 164 tick、只有哈希变。后面的 trace SHA 没执行到。 |
| `ur-i3-combat-statuses.test.ts` | 1 | 终态 SHA。录制 `432c237bd3225a4b…`，现前缀仍是 `d4ad3cac130a70b6…`（与 P0 审查相同，这场合成战斗没有被平局抽词带动）。同文件的 loot 断言没执行到。 |
| **合计** | **273** | |

## 未完成

- 抢格绕路未做。范德尔 seed 104729 仍在 tick 11 折回 `(2,1)`。
- 纪元统一重录、旧存档迁移、浏览器实机未做。
