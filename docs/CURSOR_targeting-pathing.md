# 近战抢格（cursor/targeting-pathing）

基线：`origin/cursor/targeting-p1` @ `8106acee4c456baea8ef60bb163f52aedbc10701`。原版抢格算法未公开，按用户批准的本地方案实现。只改 S13 射程 1 的接近走位。没有重录 fixture，没有 `--write`，没有改超时，没有改 `src/server` 或界面，没有提交素材，不开 PR。

## 设计

攻击格是目标的棋盘邻居（`getNeighbors`，奇数行偏移，顺序 E、SE、SW、W、NW、NE）。只作用于射程 1、尚未接战、且本 tick 可以移动的普通单位。远程首次接近仍走原来的“任意进射程格子”BFS；已接战的一步追击、疯化学家、河蟹不变。遗留 M3/M4 的 `nextStep` 不动。

1. 要去的攻击格被占时，在目标周围的空攻击格里选可达路径最短的。长度相同，用本场已有的 `ctx.draw`（`lcg32-v1`，与普攻暴击同一条流）拒绝采样一次。下标是邻居序，不是单位 ID。`limit = floor(2^32 / size) * size`，词 `>= limit` 则拒绝并计入 `rngDraws`。不新增 RNG，不用 `Math.random`。
2. 选定后记在 `CombatUnit.meleeApproach = { targetId, cell }`，一直保持。失效只有三种：有单位停在该格上、目标换了、该格不再是当前目标的攻击格。别人只是路过，或正处在移动冷却里，不使锁定失效，也不把人往后拉。
3. 目标周围每个攻击格上都有人时，原地等待，不退回上一步。
4. 同一 tick 抢同一个攻击格：先按 ID 升序种下已有锁定（先写者保留，后来者不能抢走）；还没有锁定的单位再按同一 ID 序挑选。输的单位改去下一条路径的攻击格。单位数组在 tick 开始已按 `compareIds` 排序，输入反序结果相同。

“停在上面”是 `standsStill`：永不移动、当前不能移动（眩晕、引导、根深蒂固）、没有活着的目标、已经进入自己目标的射程，或者冷却已好但四周没有空邻居。移动冷却中的身体不算停下。卡住且冷却为 0 算停下。

已锁定且仍然有效时不抽词。锁定格的第一步被本 tick 更早的单位占成落点时：若这一步就是攻击格本身，放弃该锁定并重选（可能抽词）；若只是走廊被占，原地等，锁定保留。新选时若最短格的第一步已被占，跳过它试下一条；全部第一步都被占则锁住排序后的第一格并等待，不再走旧 BFS 的后退。进入射程后，锁定改写成自己脚下这一格。目标在行动复核或鱼骨头里换成别人时清掉锁定。死亡时清掉。

## 改了哪里

- [combat-movement.ts](../src/simulation/combat-movement.ts)：`planMeleeApproach`、`route`、`standsStill`。`canMove` / `isControlled` / `neverMoves` 的原语义未改。
- [combat-s13.ts](../src/simulation/combat-s13.ts)：射程 1 且未接战的意图不再进旧 `move()`。提交移动前按上面的顺序调用 `planMeleeApproach`，把落点交给原有的预留。行动复核和鱼骨头换目标、死亡清理各删一次锁定。
- [combat-types.ts](../src/simulation/combat-types.ts)：可选 `meleeApproach`。`copyCombatUnitForTick` 用已有的展开和 `clonePlainData` 带上它，没有新的拷贝分支。
- [s13-rules.ts](../src/simulation/s13-rules.ts)：`meleePathing` 为 `v26-melee-shortest-attack-hex-hold-lcg32-tie-id-contest-wait-if-surrounded`。`ordinaryTargeting` 未改。规则版本字符串仍是 `s13-g2-3-v26-neutrals-1424` / `s13-14.24b-g2-3-v26-neutrals-1424`，schema/save/replay/command 仍是 12/8/8/7。
- [m8/version.ts](../src/simulation/m8/version.ts)：注释写明最短攻击格、保持和同 tick 的 ID 序。版本号未改。
- [identity-constants.ts](../src/simulation/content/identity-constants.ts)：生产 content 摘要改成重算值。没有跑 `--write`。
- [COMBAT_CONTRACT.md](COMBAT_CONTRACT.md)：新增「v26 近战抢格」。P0 里“远程首次多步 BFS 不变”保留；射程 1 的首次接近改指向这一节。

没有改伤害、经济、索敌优先级、冷却长度或移动间隔。平局抽词仍在移动阶段、攻击之前，所以近战平局会挪后同一条流上的暴击词。

## 范德尔 seed 104729

调研用合成开局（与 [targeting-p0.test.ts](../tests/targeting-p0.test.ts) 的 `reportInput` 相同，不是 `createMatch`）。P0/P1 锁住的轨迹是：tick 1 `(2,0)→(2,1)`，tick 6 `(2,1)→(3,1)`，tick 11 `(3,1)→(2,1)`。tick 11 开始范德尔在 `(3,1)`、射程 1，`p6` 在 `(3,3)`。能打到的邻居 `(4,2)=e7`、`(3,2)=e5` 都被占，旧 BFS 的第一步退回 `(2,1)`。

本规则在 tick 1 就把攻击格定为当时唯一最短的 `(3,3)`（`p6` 还在 `(4,4)`，该格路径长度 3）。之后一直保持，走 `(2,0)→(2,1)→(3,2)→(3,3)`，不再出现 `(3,1)→(2,1)`。tick 7 起 `p3` 与 `p6` 等距，目标仍是 `p6`，因为 P1 规定当前目标已在并列里就不换、不抽词。

整场合成战斗里 tick 323 会再踏上 `(3,3)`，那时目标已经是 `p1`、锁定是 `(4,4)`，不是开局折返。

替换掉的锁现状断言：

- [targeting-p1.test.ts](../tests/targeting-p1.test.ts) 的 “still backtracks”：那条只是把未批准的 BFS 后退记下来。换成前 11 tick 的新轨迹、锁定格 `(3,3)`，以及上面的等距轨迹。没有放宽别的断言。
- [targeting-p0.test.ts](../tests/targeting-p0.test.ts) 的 “records Vander’s initial-approach backtrack”：同样换成这三步，并保留全场反序相等。德莱文 seed 42 用例未改。

## 第一场战斗时长

两组棋盘不是同一场，分开记。都在改走位之前和之后各跑一次，只读 tick，没有 `--write`。

`createMatch(seed)` 后 `startMatchCombat`，一直 `stepMatch` 到离开 combat。这是 [opening-random-identity.test.ts](../tests/opening-random-identity.test.ts) 说的首战。

| 种子 | 8106acee | 本分支 | 结果 |
| --- | --- | --- | --- |
| 42 | 274 tick，playerWin，带 tick 的事件 149 | 274 tick，playerWin，带 tick 的事件 147 | 时长和胜负不变，事件少 2 条 |
| 104729 | 273 tick，playerWin，带 tick 的事件 94 | 273 tick，playerWin，带 tick 的事件 94 | 时长、胜负、事件条数不变 |

seed 42 相对录制基线仍是 274 对 164。P1 已经是 274，本分支没有再拉长。事件字节没有单独做 SHA，不能说和 8106acee 逐条相同。

调研合成开局（`reportInput`，`rngState = seed`）时长变了，而且 seed 42 的胜负翻了。这不是正式对局首战。

| 种子 | 8106acee | 本分支 |
| --- | --- | --- |
| 42 | 290 tick，enemyWin，`rngDraws` 533 | 293 tick，playerWin，`rngDraws` 445 |
| 104729 | 615 tick，enemyWin，`rngDraws` 1362 | 611 tick，enemyWin，`rngDraws` 813 |

## 补了哪些测试

[targeting-p1.test.ts](../tests/targeting-p1.test.ts) 的近战段：

- 范德尔前 11 tick 不折返，锁定 `(3,3)`，目标保持 `p6`。
- 六个攻击格都被友军占住：玩家停在 `(3,1)`，没有移动事件，`rngDraws` 为 0，反序仍停在原格。
- 同 tick 抢格：`a` 得到 `(3,4)`，`b` 改去 `(2,3)` 并先走到 `(2,4)`。不抽词。输入反序后格子和锁定相同。
- 等长路径：种子 0 落到 `(3,4)`，种子 1 落到 `(4,4)`，各抽 1 词。反序的落点和 `rngState` 相同。下一 tick 保持该格且不再抽词。
- 别人只是停在冷却上：锁定不丢，自己不后退，不抽词。

## 测试

`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` 通过。`git diff --check` 通过。`node scripts/update-content-identities.cjs --check` 通过：content `fnv1a32-utf16:bbfbe0dd`，loot `fnv1a32-utf16:10ece6a9`。P1 的 content 是 `2a01c771`，loot 未变。

`npx vitest run tests/targeting-p0.test.ts tests/targeting-p0-restore.test.ts tests/targeting-p1.test.ts tests/s13-augments-p2-combat.test.ts tests/combat-simulation.test.ts tests/m5-combat.test.ts tests/task-mechanism-restore.test.ts tests/t2-two-sided-battle.test.ts --maxWorkers=4`：179 通过，2 失败。失败的两项都在 `tests/task-mechanism-restore.test.ts`，断言没有改、没有放宽。没有跑浏览器、全仓或 `playtest-1022b-bench`。

## 纪元／固定哈希漂移（不重录）

同一组 5 个文件、315 项：42 通过，273 失败。和 P1 的失败数相同。非漂移失败 0。没有 `--write`。

| 位置 | 失败 | 原因 |
| --- | ---: | --- |
| `augment-pool-batch5-g4-swarm.test.ts` | 1 | 开战存档 SHA。录制 `8dedd86620e10240b954970b1f2c544e9dc8275ab65c5c5a2bb59c889bd8178d`。P1 现前缀 `dfe9564a…`。本分支现前缀 `02fdb4ead911cf203708b7178762ce66fa226…`。这是 tick 0 的存档，变的是规则字符串进了内容摘要，不是范德尔走位。 |
| `d11-wiring-bank.test.ts` | 1 | 行为与自洽重演已过。生产 content `bbfbe0dd` ≠ v25 baseline `f671ab88`。 |
| `m8-content-equivalence.test.ts` | 134 | cannon／sniper 各 67 份旧状态，`restoreMatch` 报 `unsupported-version`。P1 已有。 |
| `opening-random-identity.test.ts` digest | 1 | 同上，`bbfbe0dd` ≠ `f671ab88`。 |
| `opening-random-identity.test.ts` checkpoint | 134 | 录制状态各 67 份，`unsupported-version`。P1 已有。 |
| `opening-random-identity.test.ts:881` | 1 | seed 42 首战。录制 `firstBattle.ticks` 是 164；现值为 274。和 P1 的 tick 数相同，后面的 trace SHA 没执行到。 |
| `ur-i3-combat-statuses.test.ts` | 1 | 终态 SHA。录制 `432c237bd3225a4b75ac5436bb370194689cab64f4be002007bbd703b65afdd9`。P1 现前缀仍是 `d4ad3cac…`（那场没被平局抽词带动）。本分支现前缀 `fe62d6308eb3e57308b4e28e1458d182c992a…`。同文件的 loot 断言没执行到。 |
| **合计** | **273** | |

## 未改、因而失败的断言

- `task-mechanism-restore.test.ts` 赛恩击杀：`contribution: true`、种子 5、tick 294 的断言仍要求 `unit-9:g23-sion` 在这一 tick 普攻击杀 `enemy-r4-1`。走位变了之后这一 tick 没有击杀事件。`contribution: false`、种子 1、tick 323 仍按原断言。没有把 294 改成别的 tick。
- 同文件 “rejects altered or invented target reave facts”：仍期望莫甘娜诅咒出现在 tick 70。现在存档上的 tick 是 60。注释里的 v22 说明（从 89 提到 70）没有改，也没有把 70 改成 60。

## 未完成

- `meleeApproach` 会随单位进 JSON 存档，tick 复制也会带上。正式重演认证清单（`targetId` / `targetEngaged` 那一组）还没有这个字段，伪造锁定不会被 “target binding facts” 拒绝。从 tick 0 重演能自己算出来。动态战斗检查点走整状态相等时，伪造会和重演对不上。
- 纪元统一重录、旧存档迁移、浏览器实机未做。
