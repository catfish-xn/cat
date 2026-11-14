# 索敌 P0 审查（cursor/targeting-p0）

基线：`claude/v26-targeting-p0` @ `c4274ff1`。本分支只做独立审查和一处同 tick 追击修复。没有重录 fixture，没有 `--write`，没有改超时，没有改 `src/server`，没有提交素材。

## 改动

- [combat-s13.ts:324](../src/simulation/combat-s13.ts#L324)、[combat-s13.ts:350](../src/simulation/combat-s13.ts#L350)：普通移动胜者记入 `ordinaryMoved`。
- [combat-s13.ts:377](../src/simulation/combat-s13.ts#L377)–[combat-s13.ts:385](../src/simulation/combat-s13.ts#L385)：行动复核不再把这些落点当成障碍。静止占格和本 tick 已接受目标的当前格仍然阻挡。失去预留则保持已交战目标并等待；目标自己走出一步恢复范围则重选。
- [COMBAT_CONTRACT.md:5](COMBAT_CONTRACT.md#L5)：写明上述占格口径。
- [targeting-p0.test.ts:60](../tests/targeting-p0.test.ts#L60)：嘲讽／背叛压过一步追击；嘲讽目标死亡后回到追击。
- [targeting-p0.test.ts:75](../tests/targeting-p0.test.ts#L75)：剔除弱者非脉冲 tick 追已交战目标；tick 60 脉冲仍选射程内最低生命比。
- [targeting-p0.test.ts:171](../tests/targeting-p0.test.ts#L171)：唯一追击格被先手订走时不换锁、不攻击更近敌人；反序输入与 JSON 复核相等。修复前该例会锁到 `near`。
- [targeting-p0.test.ts:190](../tests/targeting-p0.test.ts#L190)：已交战目标同 tick 走出一步恢复范围时重选并攻击射程内敌人。

没有删除或放宽断言。德莱文 seed 42、范德尔 seed 104729 的回归在审查前已在 [targeting-p0.test.ts:231](../tests/targeting-p0.test.ts#L231)、[targeting-p0.test.ts:243](../tests/targeting-p0.test.ts#L243)，本次只复跑。

## 审查结论

- 优先级仍是虚空嘲讽 → 背叛 → 剔除弱者脉冲／其自身射程内保持 → 普通保持或一步追击。`p2Target` 在回调之前返回 override。三参数调用不传回调，行为与改前默认最近目标相同。
- 受控 tick 与解控边界继续重扫最近目标。受控暂停是明确不做的 P1，没有加锁存器。
- two-sided、单人 PvP／PvE 都进 `stepCombat` → `advanceS13Tick`。中立怪与英雄共用 `decideCombatTarget`。河蟹移动／跳跃、疯化学家最近目标、攻击代理不走普通追击。狼在行动写完 `targetId` 之后读主人目标；微型分身仍用任务上的冻结目标。赛恩冲锋不写 `targetEngaged`，待复活会清标记。新出生单位没有旧锁。
- 技能只把普通当前目标当默认 primary。麦迪最远目标与已排任务不改；鱼骨头在真正普攻时用装备流覆盖并记已交战。选敌本身不抽 RNG。平局仍是字符串 ID。等距随机、绕开占格、受控暂停都未做。
- 确定性：每 tick 按 ID 排序；追击取现有顺时针邻居的第一格；种子 42／104729 反序输入相等。范德尔 seed 104729 在 tick 11 折回 `(2,1)`，仍是 P1 占格折返。

## 测试

`npx vitest run tests/targeting-p0.test.ts tests/targeting-p0-restore.test.ts tests/task-mechanism-restore.test.ts tests/t2-two-sided-battle.test.ts tests/m5-combat.test.ts --maxWorkers=4`：5 文件、117 项通过。

`npx tsc --noEmit` 通过。`node scripts/update-content-identities.cjs --check` 通过：content `fnv1a32-utf16:1d3bc95f`，loot `fnv1a32-utf16:73d95fed`。`git diff --check` 通过。

漂移命令：`npx vitest run tests/augment-pool-batch5-g4-swarm.test.ts tests/d11-wiring-bank.test.ts tests/m8-content-equivalence.test.ts tests/opening-random-identity.test.ts tests/ur-i3-combat-statuses.test.ts --maxWorkers=4`。316 项：42 通过，273 失败。非漂移失败 0。没有跑浏览器、全仓或 `playtest-1022b-bench`。

## 纪元／固定哈希漂移（不重录）

| 位置 | 失败 | 原因 |
| --- | ---: | --- |
| `augment-pool-batch5-g4-swarm.test.ts:47` | 1 | 整段存档 SHA。录制 `8dedd86620e10240b954970b1f2c544e9dc8275ab65c5c5a2bb59c889bd8178d`，现前缀 `e3973dad1d7fcb7f…`。与实施报告相同，本审查的抢格修复没有改这条哈希。 |
| `d11-wiring-bank.test.ts:37` | 1 | 行为与自洽重演已过。生产 content `1d3bc95f` ≠ `v25-online-rules-content-baseline.json` 的 `f671ab88`。 |
| `m8-content-equivalence.test.ts` | 134 | cannon／sniper 各 67 份旧状态，`restoreMatch` 报 `unsupported-version`。版本字符串不能单独改。 |
| `opening-random-identity.test.ts:774` | 1 | 同上，`1d3bc95f` ≠ `f671ab88`。 |
| `opening-random-identity.test.ts` checkpoint | 134 | `tests/fixtures/v25-online-rules-recorded-states/{cannon,sniper}.json.gz` 各 67 份，`unsupported-version`。 |
| `opening-random-identity.test.ts:881` | 1 | seed 42 首战仍是 164 tick，但 `firstBattle.stateHash/eventHash` 不等于录制的 `fnv1a32-utf16:ef7032f4`／`fnv1a32-utf16:88c54d08`。后面的 trace SHA（state `3fc748a5…`、events `b82d46fa…`）没执行到。 |
| `ur-i3-combat-statuses.test.ts:82` | 1 | 终态 SHA。录制 `432c237bd3225a4b75ac5436bb370194689cab64f4be002007bbd703b65afdd9`，现前缀 `d4ad3cac130a70b6…`。同文件逐 tick 显示用例通过。下一行还会碰到 loot：生产 `73d95fed`，v25 baseline 是 `36ebfac2`。 |
| **合计** | **273** | |

未跑、但 v26 身份合入后预计同样要重录：m5-route／m5-replay、m6 integration／replay、m8-b8／b9 golden、其余 identity baseline、CI 的 route／state／event 哈希，以及 compare／headless 证据。这里不把它们算作已失败。

## 未完成

- P1（等距随机、受控暂停、抢格绕路）按范围未做。
- 纪元统一重录、素材、测试服部署、浏览器／GPU 实机验收未做。

## 执行端待办

- 其余 v26 改动合齐后统一重录上表，再跑 `update-content-identities.cjs --check`。不要在本分支用 `--write` 改 golden。
- 重录时保留逐 tick 行为断言；只更新被新规则取代的固定 SHA／epoch。终态哈希失败后，同一 case 里未执行的 loot／trace 断言要单独看。
- 素材下载、提取、上传测试服（ssh tencent）、测试服部署、codex-browser 实机验收仍留给执行端。
