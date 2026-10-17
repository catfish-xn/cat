# PR168同步实际最新multiplayer与B7鸟反应20秒验证

## 固定身份、环境恢复

原环境worktree已丢失，从现存仓库仅fetch并新建独立cat-restore-b worktree恢复远端B=e6d9725654c643edec2d17293878783aac2974a5，无未提交改动丢弃。22:19首次ls-remote见multiplayer d6156abbb71c3126bea0f130de37d3901fb55d96，fetch完成时已前进至0719ced60ade353a238024d757cf9440701f6aaa（含#157/#161/#162），实际同步后者，未另合候选分支。

固定受测合并代码：32849209f4a6c4aa100ee9796ad4732209492314。父提交：
1. e6d9725654c643edec2d17293878783aac2974a5
2. 0719ced60ade353a238024d757cf9440701f6aaa

Node v24.19.0 / npm11.9.0 / Vitest5.0.3；使用现存相同Vitest版本依赖。日志程序时区显示00:xx，工具UTC为22:xx，二者相差2小时，按原日志保留。

## 冲突解决与边界

文本冲突只有serialization.ts和replay/history.ts。上游把结构验证及档案验证抽到serialization-structure.ts、battle-record-validation.ts；保留这份拆分，并把B验证接入对应新位置：
- serialization-structure.ts:106–112、330–334：结构/预检/护盾验证全部保留，在独立detached状态上执行B账本验证，默认严格验证，也支持当次内部session。
- serialization.ts:11–30：保留restoreMatch/serializeMatch的battles参数、每次withHistory验证和缺冠冕历史拒绝；添加原B私有session，没有因热缓存绕过history层。
- replay/history.ts:34–57：完整envelope规范数据快照作为缓存身份（含完整battles、equipmentCommands和currentBattle），miss使用当次自产重演session；所有checkHistoryCarry仍由上游matchHistoryChecks执行。
- battle-record-validation.ts:123起：session proof仍须全版本/shape/事件/终点/hash核对；仅record没有装备命令且自产proof命令全为start/step时可复用。有equip/combine/consumable等即回退真实命令重演，不能用proof给被删equipmentCommands补证。
- tests/restore-audit/preparation-ledger-scope.test.ts补删除equipmentCommands仍拒绝；相应执行次数断言明确装备场景多执行一次该场记录核验，不删原状态/拒绝断言。
- tests/m8-b7-match-wiring.test.ts:221–234：仅鸟反应用例显式20000ms，旁注用户10-17批准首次真实恢复计算原因；此前三冷恢复20秒保持，其他时限未改。

上游CI、版本、合同、raw夹具及界面变更作为被授权merge内容保留；本轮没有自行新增这些修改，没有再次升revision/digest或重录raw。

## 脚本顺序与结果

先阅读record-g2-3-herald.cjs，默认只生成并验证字节，只有--write才落盘。依次执行：
1. node tests/fixtures/record-g2-3-herald.cjs：退出1。真实完整公共轨迹生成5份raw；5/5生产恢复及后续15tick比较通过；最后与旧ionic-spark.json逐字节比较失败。保留旧缺账本输入，不--write、不迁移。脚本整体不是通过。
2. node scripts/record-g2-3-inputs.cjs：退出0。
3. node scripts/record-g2-3-inputs.cjs --check：退出0。
两次inputs输出一致，未产生额外字节改动。禁止的verify-m8-herald-fixtures.cjs --write没有执行。

## 相关测试结果（没有全套）

固定32849209上先跑ledger专项16/16、scope/cache专项8/8，然后19个明确相关文件串行（--no-file-parallelism --maxWorkers=1），333例：266通过、67失败、0跳过，退出1。专项是复用/调试证据，不重复计入333总数。未跑全套或CI，未做额外typecheck。完整命令在b-sync-related.log；逐例耗时/堆栈见per-case-results.json与failures.json。

| 文件 | 通过 | 失败 | 单例耗时合计ms |
|---|---:|---:|---:|
| crown-restore-cache.test.ts | 3 | 1 | 354 |
| g2-4a-crown-gold.test.ts | 8 | 1 | 1266 |
| g2-4a-crown-history.test.ts | 4 | 52 | 6996 |
| g2-4b-resists-restore.test.ts | 15 | 6 | 2004 |
| m5-command-phases.test.ts | 13 | 0 | 39 |
| m5-economy.test.ts | 42 | 0 | 5 |
| m5-serialization.test.ts | 33 | 0 | 396 |
| m6-persistence.test.ts | 44 | 0 | 1139 |
| m6-replay.test.ts | 9 | 0 | 1309 |
| m8-b5-equipment-history.test.ts | 9 | 0 | 8793 |
| m8-b7-match-wiring.test.ts | 25 | 5 | 30927 |
| m8-b8-restore-fold-reuse.test.ts | 5 | 0 | 80 |
| m8-b8-restore.test.ts | 7 | 0 | 2948 |
| restore-audit/bounds-preflight.test.ts | 14 | 2 | 4237 |
| restore-audit/match-authority.test.ts | 10 | 0 | 128 |
| restore-audit/preparation-history-cache.test.ts | 1 | 0 | 711 |
| restore-audit/preparation-ledger-scope.test.ts | 4 | 0 | 952 |
| restore-audit/preparation-ledger.test.ts | 16 | 0 | 992 |
| restore-audit/verified-restore-cache.test.ts | 4 | 0 | 235 |

B7为25通过/5失败，5个均旧raw `preparation-ledger-missing`。4-7/5-7/6-7分别4288/5779/8081ms；鸟反应3559ms，均通过各自获批20秒；未修改其余测试时间或skip任何例。

## 失败归类（5旧Herald + 62其他）

按本次实际错误输出分类，不把尚未重建合法正控的失败武断全称为夹具：
- 5：旧Herald缺账本。确证，按旧档政策预期拒绝；这不是整文件全绿。
- 34：命令账本重演返回失败。确证原始错误；已定位常用fixture直接grant后equip/升级，seed重演没有该授予事实。包括盾6、bounds2及多项冠冕。仍需用真实公开来源重建逐项正控才能完成端到端验证。
- 9：resourceProvenance与真实账本重演不等。确证错误；M5 openingWithBlade、M8 swords、M10 reforger的目标装备均有直接grant（后者虽工具获取路线真实，测试仍另外grant目标装备）。不是授权将内部授予作为可自报命令。
- 15：旧预期特定history错误未匹配，实际被B账本更早拒绝。确证拒因顺序变化；不能仅换正则宣称下游history校验覆盖仍有效，应先修正合法来源或独立验证真正history边界。
- 3：M9把两处装备tick一起改后的完整状态相等失败；新增preparationLedger保留实际命令/事件身份，测试原先按无账本状态等价。需核实重建两条真实合法轨迹的期望，不直接重写golden。
- 1：crown-restore-cache旧期望startMatchCombat一次，实际两次。B独立账本验证会重演真实命令，旧测试只计上游历史证明；本轮只记录，没有改计数断言或省略验证。

来源定位（确证代码，非所有失败都已额外最小化）：
- tests/g2-4a-crown-history.test.ts:79–86冠冕正控直接grant；:102起transferFixture；:271起openingWithBlade；:409起swords；:476起reforger使用前额外grant目标装备。
- tests/g2-4b-resists-restore.test.ts:11–24仍直接grant；新增chest正控也未具备B真实准备命令来源。本次总6失败，不能继续只报旧5项。
- tests/fixtures/g24-natural-forge.ts虽名为natural，:32起仍直接grant金币及英雄；不能直接拿它替代严格公共获得路线。
- tests/restore-audit/bounds-preflight.test.ts:81、129调用startBracerFight，须迁移其护臂来源；其余14项本次通过。

下面列全部67失败，文件、用例、第一次测试栈位置和耗时均可回查JSON。未更改这些上游fixture/拒因/断言来让数字变绿。

| 文件 | 用例 | ms | 观察分组 | 首个测试栈位置 |
|---|---|---:|---|---|
| tests/crown-restore-cache.test.ts | reuses owned battle proofs but still checks each candidate and only replays a new round | 228 | 重演调用次数差异 | tests/crown-restore-cache.test.ts:28:17 |
| tests/g2-4a-crown-gold.test.ts | real combat saves restore crown receipts and Continue never pays the completed battle twice | 11 | 命令重演拒绝 | tests/g2-4a-crown-gold.test.ts:143:23 |
| tests/g2-4a-crown-history.test.ts | rejects the crowns:84/+5 coordinated forgery in text and object restoration, with or without genuine history | 132 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:52:41 |
| tests/g2-4a-crown-history.test.ts | rejects the unchanged genuine replay collection paired with the forgery, synchronously and asynchronously | 73 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:58:54 |
| tests/g2-4a-crown-history.test.ts | does not let a later record context authorize its own forged historical prefix | 166 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:68:62 |
| tests/g2-4a-crown-history.test.ts | restores and continues a legal provenance-backed crown control, seed 1 | 51 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:86:39 |
| tests/g2-4a-crown-history.test.ts | restores and continues a legal provenance-backed crown control, seed 42 | 39 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:86:39 |
| tests/g2-4a-crown-history.test.ts | rejects seed 7 cross-round crown transfer despite self-consistent production replay and rewards | 87 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:128:80 |
| tests/g2-4a-crown-history.test.ts | accepts legal sale and subsequent re-equipping | 43 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:191:18 |
| tests/g2-4a-crown-history.test.ts | accepts legal remover and subsequent re-equipping | 38 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:191:18 |
| tests/g2-4a-crown-history.test.ts | accepts legal upgrade and subsequent re-equipping | 43 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:191:18 |
| tests/g2-4a-crown-history.test.ts | accepts legal upgrade-remover-equip and subsequent re-equipping | 54 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:191:18 |
| tests/g2-4a-crown-history.test.ts | accepts legal combine-equip and subsequent re-equipping | 37 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:191:18 |
| tests/g2-4a-crown-history.test.ts | replays survivor equipment before-upgrade in exact order (M4) | 39 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:227:18 |
| tests/g2-4a-crown-history.test.ts | replays survivor equipment after-upgrade in exact order (M4) | 39 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:227:18 |
| tests/g2-4a-crown-history.test.ts | also rejects moving a non-crown equipped instance | 19 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:266:56 |
| tests/g2-4a-crown-history.test.ts | replays combat equip before settlement, restores through all three entries and continues tick for tick | 10 | 资源谱系重演不等 |  |
| tests/g2-4a-crown-history.test.ts | rejects a claimed pre-first-battle equip left in inventory, with or without an empty history | 65 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:329:61 |
| tests/g2-4a-crown-history.test.ts | accepts legal pre-first-battle equipment and validates the first opening prefix | 5 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:337:20 |
| tests/g2-4a-crown-history.test.ts | records combat consumable use with remove at all three entries and resumes tick for tick (M10) | 44 | 命令重演拒绝 |  |
| tests/g2-4a-crown-history.test.ts | records combat consumable use with reequip at all three entries and resumes tick for tick (M10) | 34 | 命令重演拒绝 |  |
| tests/g2-4a-crown-history.test.ts | records combat consumable use with combine at all three entries and resumes tick for tick (M10) | 30 | 命令重演拒绝 |  |
| tests/g2-4a-crown-history.test.ts | records combat consumable use with component-reforger at all three entries and resumes tick for tick (M10) | 698 | 资源谱系重演不等 |  |
| tests/g2-4a-crown-history.test.ts | records combat consumable use with completed-reforger at all three entries and resumes tick for tick (M10) | 702 | 资源谱系重演不等 |  |
| tests/g2-4a-crown-history.test.ts | rejects changing the remove command tick at all three entries (M10) | 29 | 命令重演拒绝 |  |
| tests/g2-4a-crown-history.test.ts | rejects changing the component-reforger command tick at all three entries (M10) | 698 | 资源谱系重演不等 |  |
| tests/g2-4a-crown-history.test.ts | rejects changing the completed-reforger command tick at all three entries (M10) | 765 | 资源谱系重演不等 |  |
| tests/g2-4a-crown-history.test.ts | rejects changing the remove resource tick at all three entries (M10) | 33 | 命令重演拒绝 |  |
| tests/g2-4a-crown-history.test.ts | rejects changing the component-reforger resource tick at all three entries (M10) | 808 | 资源谱系重演不等 |  |
| tests/g2-4a-crown-history.test.ts | rejects changing the completed-reforger resource tick at all three entries (M10) | 685 | 资源谱系重演不等 |  |
| tests/g2-4a-crown-history.test.ts | records inventory combination followed by equip=false and resumes the next battle tick for tick (M8) | 8 | 资源谱系重演不等 |  |
| tests/g2-4a-crown-history.test.ts | records inventory combination followed by equip=true and resumes the next battle tick for tick (M8) | 10 | 资源谱系重演不等 |  |
| tests/g2-4a-crown-history.test.ts | rejects changing only the command tick to 0, 2 or 69 for ordinary (M9) | 36 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:383:33 |
| tests/g2-4a-crown-history.test.ts | rejects changing only the command tick to 0, 2 or 69 for in-place (M9) | 35 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:383:33 |
| tests/g2-4a-crown-history.test.ts | rejects changing only the command tick to 0, 2 or 69 for inventory (M9) | 35 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:383:33 |
| tests/g2-4a-crown-history.test.ts | certifies the same ordered result when both tick claims move to 0 (M9 boundary) | 75 | 人工轨迹完整相等失败 | tests/g2-4a-crown-history.test.ts:571:21 |
| tests/g2-4a-crown-history.test.ts | certifies the same ordered result when both tick claims move to 2 (M9 boundary) | 88 | 人工轨迹完整相等失败 | tests/g2-4a-crown-history.test.ts:571:21 |
| tests/g2-4a-crown-history.test.ts | certifies the same ordered result when both tick claims move to 69 (M9 boundary) | 92 | 人工轨迹完整相等失败 | tests/g2-4a-crown-history.test.ts:571:21 |
| tests/g2-4a-crown-history.test.ts | rejects existing-target in-place combination tampering at all three entries | 41 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:383:33 |
| tests/g2-4a-crown-history.test.ts | rejects missing-first inventory combination commands at all three entries | 43 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:383:33 |
| tests/g2-4a-crown-history.test.ts | rejects missing-second inventory combination commands at all three entries | 43 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:383:33 |
| tests/g2-4a-crown-history.test.ts | rejects ordinary-equip inventory combination commands at all three entries | 40 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:383:33 |
| tests/g2-4a-crown-history.test.ts | rejects a structurally valid command with an invalid recipe through production replay | 56 | 旧特定拒因未匹配 | tests/g2-4a-crown-history.test.ts:383:33 |
| tests/g2-4a-crown-history.test.ts | binds combat equip order to the temporary item roll prefix (M9) | 67 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:375:18 |
| tests/g2-4a-crown-history.test.ts | keeps combat equips before terminal resources and crown gold (M9) | 39 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:375:18 |
| tests/g2-4a-crown-history.test.ts | records in-place sword combination at tick 1 (requested slot 0) and resumes the next battle tick for tick | 7 | 命令重演拒绝 |  |
| tests/g2-4a-crown-history.test.ts | records in-place sword combination at tick 1 (requested slot 2) and resumes the next battle tick for tick | 7 | 命令重演拒绝 |  |
| tests/g2-4a-crown-history.test.ts | rejects reordered commands at all three save/restore entries | 34 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:375:18 |
| tests/g2-4a-crown-history.test.ts | rejects duplicated commands at all three save/restore entries | 35 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:375:18 |
| tests/g2-4a-crown-history.test.ts | rejects extra commands at all three save/restore entries | 33 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:375:18 |
| tests/g2-4a-crown-history.test.ts | rejects missing commands at all three save/restore entries | 42 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:375:18 |
| tests/g2-4a-crown-history.test.ts | rejects unknown-target commands at all three save/restore entries | 33 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:375:18 |
| tests/g2-4a-crown-history.test.ts | accepts combat equipment targeting a bench unit at all three entries | 40 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:375:18 |
| tests/g2-4a-crown-history.test.ts | accepts combat equipment targeting a dead unit at all three entries | 217 | 命令重演拒绝 | tests/g2-4a-crown-history.test.ts:375:18 |
| tests/g2-4b-resists-restore.test.ts | public equipped live shield restores unchanged and continues identically | 39 | 命令重演拒绝 | tests/g2-4b-resists-restore.test.ts:58:22 |
| tests/g2-4b-resists-restore.test.ts | restores live targeting-dependent resists, refreshes, absorption, expiry and combat end | 47 | 命令重演拒绝 | tests/g2-4b-resists-restore.test.ts:92:12 |
| tests/g2-4b-resists-restore.test.ts | restores the holder-death grant after live defenses and periodic history | 346 | 命令重演拒绝 | tests/g2-4b-resists-restore.test.ts:114:20 |
| tests/g2-4b-resists-restore.test.ts | restores stacked crest/gargoyle/bracer from object and matches every tick through the next battle | 521 | 命令重演拒绝 | tests/g2-4b-resists-restore.test.ts:174:36 |
| tests/g2-4b-resists-restore.test.ts | restores stacked crest/gargoyle/bracer from JSON and matches every tick through the next battle | 510 | 命令重演拒绝 | tests/g2-4b-resists-restore.test.ts:173:47 |
| tests/g2-4b-resists-restore.test.ts | restores crest shields after a chest grants the holder dual resists, and rejects coherent amount edits | 115 | 命令重演拒绝 | tests/g2-4b-resists-restore.test.ts:219:48 |
| tests/m8-b7-match-wiring.test.ts | restores Herald action identity after earlier tick-one aura maintenance: "ionic-spark" | 12 | 旧Herald缺账本 | tests/m8-b7-match-wiring.test.ts:131:26 |
| tests/m8-b7-match-wiring.test.ts | restores Herald action identity after earlier tick-one aura maintenance: "evenshroud" | 7 | 旧Herald缺账本 | tests/m8-b7-match-wiring.test.ts:131:26 |
| tests/m8-b7-match-wiring.test.ts | restores Herald action identity after earlier tick-one aura maintenance: "ionic-spark" | 7 | 旧Herald缺账本 | tests/m8-b7-match-wiring.test.ts:131:26 |
| tests/m8-b7-match-wiring.test.ts | round-trips legal Herald item immunity/cleanup boundaries with quicksilver | 7 | 旧Herald缺账本 | tests/m8-b7-match-wiring.test.ts:154:11 |
| tests/m8-b7-match-wiring.test.ts | round-trips legal Herald item immunity/cleanup boundaries with edge-of-night | 8 | 旧Herald缺账本 | tests/m8-b7-match-wiring.test.ts:154:11 |
| tests/restore-audit/bounds-preflight.test.ts | bounds sampled kill triggerCount by trusted roster/lives before the fact replay | 31 | 命令重演拒绝 | tests/restore-audit/bounds-preflight.test.ts:82:23 |
| tests/restore-audit/bounds-preflight.test.ts | preserves a real long fight with growing trigger counts and resumes every tick | 123 | 命令重演拒绝 | tests/restore-audit/bounds-preflight.test.ts:113:16 |

## 未闭环与后续决定

本轮完成最新基线merge与明确鸟反应时限调整；不是签收/可合入。67失败完整保留。冠冕真实赢金多轮B账本正控、盾6与护臂来源迁移尚未完成，不能把内部grant正控的早拒当已验证冠冕/护盾机制。需后续安排真实可达授予路线与新旧验证期望梳理，保持所有非法状态拒绝。PR未合，版本仍等待合并时统一决定。
