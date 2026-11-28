# tgtp0：v26 索敌 P0 实施报告

基线：`claude/v26-targeting-p0`，HEAD `43a6163bc37c084a156d7bf586a74fcefce54a6a`，开始时工作区干净。依据用户 2026-10-29 14:14 批准及 `codex-briefs/reports-1029/targeting-research.md`；没有提交、没有写 .git、没有重录 fixture。

## 【完成】

- [combat-targeting.ts:13](../src/simulation/combat-targeting.ts#L13)：按原邻居顺序找一步内恢复有效射程的空格；检查原移动资格，冷却／首步竞争不提前使追击失效。
- [combat-targeting.ts:22](../src/simulation/combat-targeting.ts#L22)：保持合法射程内目标；已接战且一步可追则追；否则走原距离／字典序 ID 回退。首次未接战的多步接近仍用原 BFS，不新增路径缓存、等距随机或备选落点。
- [combat-s13.ts:330](../src/simulation/combat-s13.ts#L330)、[combat-s13.ts:378](../src/simulation/combat-s13.ts#L378)：普通移动与行动复核传递同 tick 决策；在原行动屏障发 targetChanged，不提前改账本／动作顺序。复核继续看当时可选资格、射程和显式 override。
- [s13-augments-p2-combat.ts:82](../src/simulation/s13-augments-p2-combat.ts#L82)：保留嘲讽、背叛、剔除弱者的原优先级与周期；普通候选资格明确读本 tick。三参数直接调用仍返回原默认选择，第四参数只注入普通 P0 策略。
- [combat-types.ts:41](../src/simulation/combat-types.ts#L41)：新增可选 `targetEngaged:true`，区分首次多步接近和已接战目标的等待追击。行动复核写入；死亡、赛恩待复活、机制清目标、名单移除清除；迅击专用改目标不继承旧标记，鱼骨头普攻更新为已接战。
- [combat-runtime-facts.ts:49](../src/simulation/combat-runtime-facts.ts#L49)、[restore-combat-replay.ts:55](../src/simulation/restore-combat-replay.ts#L55)、[serialization-structure.ts:419](../src/simulation/serialization-structure.ts#L419)：从可信输入重演认证目标与交战标记，包含缺失值；结构不合法或篡改均拒绝。
- [m8/version.ts:10](../src/simulation/m8/version.ts#L10)、[s13-rules.ts:15](../src/simulation/s13-rules.ts#L15)、[identity-constants.ts:3](../src/simulation/content/identity-constants.ts#L3)：升 v26 规则／内容身份，摘要加入索敌语义；生产摘要为 content=`fnv1a32-utf16:1d3bc95f`、loot=`fnv1a32-utf16:73d95fed`。schema/save/replay/command 保持 12/8/8/7，50 ms、lcg32-v1 不变。
- [COMBAT_CONTRACT.md:3](COMBAT_CONTRACT.md#L3)：写明规则、状态、内部签名与恢复失败原因。没有修改界面、src/server、随机源或计时 API。

## 【调用点】

以下是普通索敌的全部生产入口，以及召唤／技能的交互边界；没有在服务器另建索敌。

| 路径 | 调用点与作用 |
| --- | --- |
| 统一分发 | `combat.ts:166 stepCombat → combat-tick.ts:38 advanceCombatTick → combat-s13.ts:186 advanceS13Tick`；名单有 S13 ability 即进本次规则。历史非 S13 M3/M4 独立分支保留旧行为，其既有最近目标断言未改。 |
| 单人 PvP／PvE | `match.ts:575/595` 同步／分段建战；`:615/646` 流式／普通步进均调 stepCombat。普通中立怪与英雄共享 S13 索敌，开场巨蟹另走专用移动／跳跃。 |
| two-sided | `two-sided-battle.ts:157/162` 同步开战，`:268/271` 分段开战；`:336/344` 同步／分段步进、`:223` 认证重演全调同一 stepCombat。双方使用同一规则，没有镜像方特判。 |
| 移动选择 | `combat-s13.ts:332 → decideCombatTarget → p2Target`；`:346 → chaseStep` 或原 `move` BFS。占格、原格保留、ID 提交和 reserved 冲突直接等待不变。 |
| 行动选择 | `combat-s13.ts:378 → decideCombatTarget → p2Target`；普通攻击 `:439 planS13Attack`，普通施法 `:404 planS13Cast`；资格失效会重新决策，已提交伤害包不重新绑定。 |
| 显式 override | `s13-augments-p2-combat.ts:83/84/85` 依次调用 `b5VoidSwarmTarget`、`batch2Target`、Cull；嘲讽仍按原来源有效性，背叛仍跟随同队安蓓萨，Cull 每 60 tick 选射程内最低生命比、期间保持合法旧目标。 |
| 普通实体召唤 | 赛恩（解缚后）、虚空生物／虚灵、镜像、战壕／实验复制体、蓝发复制体等进入同一 units 名单，走上述普通入口；出生仍无旧锁定。赛恩解缚冲锋在 `combat-g2-3-summons.ts:68` 独立选最近敌人，非本次普通追击；`:88` 待复活清标记。熔炉／假人仍服从原不可行动资格。 |
| 攻击代理 | `combat-s13.ts:375` 跳过普通行动；`:452 scheduleAnomalyAttacks`：`anomalies/summons.ts:51` 微型分身仍读绑定任务目标，`:64` 狼仍优先主人的 targetId、无合法目标才最近回退；`combat-g2.ts:221` 希尔科代理仍读主人目标。它们不获得独立普通移动／交战标记。 |
| v20 小兵／专用冲刺 | `combat-s13.ts:319 advanceV20Minions → combat-v20-traits.ts:105` 仍按原独立机制；`:320 quickDashV20 → combat-v20-traits.ts:75/83` 保留原冲刺目标／落点，只在改目标时清旧交战标记。 |
| 鱼骨头 | `combat-s13.ts:425 chooseFishbonesTarget` 仍在每次实际普攻时消费原装备独立流；其随机目标覆盖普通保持，攻击次数与装备抽词数仍一一对应。 |
| 技能锁定与专用选敌 | `combat-s13-abilities.ts:51/205/253` 分别为施法、既定任务、普攻计划。普通 current target 仅作为技能默认 primary；麦迪最远目标、史密奇装备数选敌、安蓓萨突进等专用选择不改；已排任务继续用 task.targetId，不被普通换锁改写。麦迪远目标五个剩余任务有独立回归。 |
| 技能几何／资格 | `m8/s13-targeting.ts:14` 将 targetId 投成 primary；`m8/targeting.ts:24/59/74` 的 selector／shortestPath／技能路径维持原 new-selection、bound-packet、area-hit 资格，不替换成普通占格 BFS。 |
| 疯化学家／巨蟹 | `combat-s13.ts:337/342/379/390` 保留最近敌人奔跑、专用 crabMove／crabJump 等原分支；P0 不给无普攻者改技能机制。 |
| 状态清理 | `combat-s13.ts:384/806`、`m8/s13-mechanisms.ts:77`、`combat-g2-3-summons.ts:88`、`seat-mechanics/combat-events.ts:50` 清失效标记；`combat-v20-traits.ts:83` 清专用换锁的旧标记。 |
| 恢复 | `restore-combat-replay.ts` 通过同一 stepCombat 重建，再由 `combat-runtime-facts.ts` 比较 targetId／targetEngaged；不消费候选 RNG 或发布重演奖励。 |

## 【替换的断言】

没有删除、放宽或改写旧规则断言，没有通过修改 golden 让测试变绿。旧 S13 测试里未发现要求“合法射程内旧目标必须因更近敌人而换锁”的显式断言；历史独立引擎的最近目标断言仍保留。

仅 [task-mechanism-restore.test.ts:72](../tests/task-mechanism-restore.test.ts#L72) 两条规则测试的输入路线被新战斗结果取代：

| 原向量／原精确检查 | 替代向量／替代精确检查 | 保持的原断言目标 |
| --- | --- | --- |
| 无贡献：seed 5；Morgana/Cassiopeia/Vladimir 站位 `(4,6)/(0,6)/(4,7)`；tick 255 击杀 enemy-r4-1 | seed 1；站位 `(6,7)/(0,4)/(3,4)`；tick 323 击杀同一 enemy-r4-1 | 真实赛恩**普攻**亲自击杀；拥有者仍活、仍有诅咒任务、此前无个人贡献；拥有者个人击杀／助攻计数 0/0，三属性增量全为 0；出生归属、致死包、冷恢复篡改与逐 tick 续战检查全部保留。 |
| 有贡献：seed 1；同上原站位；tick 225 击杀 enemy-r4-1 | seed 5；站位 `(0,7)/(3,4)/(6,4)`；tick 323 击杀同一 enemy-r4-1 | 真实赛恩**普攻**亲自击杀；拥有者本 tick 不补伤害、此前有个人贡献；个人击杀 0、助攻由 0 到 1，三属性各 +15（不是亲自击杀的 +20）；完整首轮诅咒完成、全部恢复／伪造检查保留。 |

其余旧精确 SHA／epoch 断言保持原值，列入待重录。原 30 秒测试上限不变；没有增加任何 timeout。

## 【测试】

最终命令以 `/tmp/tgtp0-final-files.json` 中的 **47 个相关文件**为输入，等价于 `vitest run --project fast <files> --maxWorkers=4 --configLoader=runner --cache=false --config=/tmp/tgtp0-vitest.config.mts`。共 **890 项：617 通过，273 失败**；42 文件全通过，5 文件含旧纪元／固定摘要失败。新增 **20 项全部通过**（规则／实例 19 项＋真实恢复 1 项）。

`npm run typecheck`、`git diff --check`、`node scripts/update-content-identities.cjs --check` 均通过。最终非漂移失败 **0**；曾失败的两条赛恩路线已按上节修复并整套 20 项通过，Vite EROFS 启动问题已解决，原 HEAD 两项生产摘要失配已纠正。

通过范围包括 two-sided 25 项、PvE 中立怪计时、首遍／重演事件逐字节相等、共享池／机器人集成、赛恩／虚空召唤物／复制体、鱼骨头独立流、控制／击飞／位移、疯化学家、技能 selector／锁定任务、真实 Match 恢复与冷重演。最终原有测试的 timeout 数值完全未改。

新增 [targeting-p0.test.ts](../tests/targeting-p0.test.ts) 覆盖：旧目标在射程内遇更近／同距新目标；死亡／零 HP／隐身／缺席／不可选／代理排除；三类 override 优先级；原受控重扫与解控边界；一步可追优先于眼前新敌；超过一步／被占格时回退；冷却等待不丢锁；首次多步接近；固定对象不能追；技能专用锁定。选敌无 RNG，等待期间零抽词、实际普通攻击仅原暴击抽词。

新增 [targeting-p0-restore.test.ts](../tests/targeting-p0-restore.test.ts) 用真实公开 PvE 路线检查对象／JSON 恢复、整段逐 tick 事件与状态相等、缺失交战标记／伪造目标拒绝。

报告两个原例使用原输入生成器、真实 S13 定义重现：seed 42 德莱文 tick 6 继续锁存活且射程内的范德尔；seed 104729 范德尔 tick 1/6/11 的三步与 p6 目标逐条保留，证明 P1 动态占格折返仍存在。完整事件／终态同 seed 重跑、输入数组反序相等；冷却等待跨 JSON 检查点也相等。

实际测试始终 `--maxWorkers=4`，只选相关文件；没有跑浏览器或全仓测试。共享 node_modules 只读导致默认 Vite bundle 配置加载 EROFS，改用 `--configLoader=runner --cache=false` 和 `/tmp/tgtp0-vitest.config.mts`：继承原测试配置／setup，仅把全局浏览器启动替换为相同临时 fixture 缓存生命周期。未改仓库配置、未启动 Chrome、未提高权限。最终文件清单和 Vitest JSON/日志分别在 `/tmp/tgtp0-final-files.json`、`/tmp/tgtp0-final.json`、`/tmp/tgtp0-final.log`。

`playtest-1022b-bench` 已完成；其 bench-timing.json 已用 `git show HEAD:...` 恢复为 HEAD 原始字节，避免只读 .git 下 checkout 尝试创建 index.lock。生产摘要只用 `--check` 复核，没有执行任何 `--write`。

## 【需要重录】

最终实际失败分布如下；都保留原断言，没有重写期望值：

| 检查 | 失败数 | 已观察到的原因／交给 Claude 的处理 |
| --- | ---: | --- |
| `augment-pool-batch5-g4-swarm.test.ts:47` | 1 | 固定运行中存档 SHA：旧 `8dedd866…`，现 `e3973dad…`；版本／摘要及新交战字段进入存档，需要重录该内嵌 SHA。 |
| `d11-wiring-bank.test.ts` | 1 | 当前生产 content digest `1d3bc95f` 与 `v25-online-rules-content-baseline.json` 的 `f671ab88` 不同；更新最终 v26 baseline 引用。 |
| `m8-content-equivalence.test.ts` | 134 | cannon／sniper 各 67 个旧录制状态被 v26 以 `unsupported-version` 拒绝；重录完整状态，不能只改版本字符串。 |
| `opening-random-identity.test.ts` | 136 | 当前身份／digest 及同一批旧 134 状态不匹配；最终 v26 联合重录。 |
| `ur-i3-combat-statuses.test.ts:82` | 1 | 固定战斗终态 SHA：旧 `432c237b…`，现 `d4ad3cac…`；交战字段改变终态，内嵌 SHA／随后 epoch 身份断言需统一更新，逐 tick 显示等价检查本身通过。 |
| **合计** | **273** | **没有剩余已观察到的非漂移失败。** |

固定 SHA 断言在首处失败后，同一 case 的后续断言未执行；不能把这些未执行语句算作已通过。相关行为由独立规则、恢复和其余集成 case 验证。

未修改上述固定 SHA、JSON baseline、goldenStates、epoch、回放／存档录制。其他读取旧 v25 身份的完整路线检查预计也需 Claude 在最终 v26 集成后统一重录：m5-route／m5-replay、m6-integration／replay、m8-b8/b9 golden、identity baseline、CI route/state/event hashes，以及 compare/headless 证据。这里是影响清单，不声称这些未运行的检查已失败。

补充原基线事实：将 `s13-rules.ts` 和 `m8/version.ts` 仅在内存替换回 HEAD 源码后，完整根重算得到 content=`fnv1a32-utf16:454f55db`、loot=`fnv1a32-utf16:73d95fed`，而 HEAD 生产常量仍为 `f671ab88/36ebfac2`；两条 identity-constants 检查在本单前已有失配。本次手动同步的是**生产身份常量**，没有修写录制；当前 `update-content-identities.cjs --check` 与 identity-constants 单测均通过。

## 【风险】

- seed 104729 的动态占格折返仍在，这是明确保留的 P1；P0 不承诺消除全部往返、拥堵或固定 ID 抢格偏差。
- 等距仍按字符串 ID 决胜，受控期间重扫／解控最近目标、专用技能、移动冲突等待保持原规则；未引入 AI 随机流、控制暂停锁存器或重寻路。
- v26 会拒绝旧 v25 存档／回放身份。录制与内嵌 SHA 未更新，因此相关 CI 暂时红；须由 Claude 在其余 v26 改动合齐后统一重录，再复核摘要。
- 本单只做领域／相关集成测试，没有浏览器视觉验收；没有修改服务端计时机制。
