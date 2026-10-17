# 冠冕历史校验提速：测量与验证

分支 codex/g2-4a-crown-win-gold，PR #157；修前 47bcff0a42b3a765c9b09bf273153ea77b21830b。本报告对应随本文件提交的代码。

## 结果

- 保留历史校验内部的不可变证明引用，省去每轮取缓存时复制完整 VerifiedReplay，以及首次入缓存的重复复制。公开回放返回值仍独立可变；所有历史前缀每次检查，外部对象每次完整重演。
- 33 战公开命令控制组：暖恢复五次中位数 **113.12 → 24.94 ms**（-78.0%）；冷恢复 8769.55 → 8512.92 ms；外部回放导入 9965.87 → 9523.16 ms。冷/外部各一次，仅诊断；三种恢复均全状态一致。
- 普通 B7/B8 62 项中，**58/62** 的三次中位数处于 148d6a2 基线 +5% 内；逐项目标未全部达到，见完整表和超标表。没有按文件合计掩盖单项退化，也没有把 profiler 计时混入验收样本。
- 相关测试 **41 文件，661/661 通过，0 跳过**。另 typecheck、build:server、git diff --check 通过。全套及 CI 满负载性能留给 CI。

## 方法与边界

Windows / Node v22.17.0，同一台机器；baseline、47bcff0、最终代码各三个新进程。固定五个完整文件、单 worker，未拆小、未改超时或门槛。取各用例 duration 的中位数，表中单位为 ms，不含用例外模块加载和公共夹具生成。文件行是每轮文件用例总和再取中位数，可能不同于逐项中位数之和。计时期间没有并跑本任务的其他测试；不是 CI 满负载模拟。

基线选择 148d6a2d87a438f580a41bf55f1651c2d5a9d8a3（直接祖先，相同 B7/B8 文件和依赖锁）。已查明 d3112d681ecff96140c451a842c36f29537e1c07 属于 G2-4b artifacts 分支，内容和规则有 62 文件差异，未当作相同规则基线混算。本轮没有复现先前单样本报告的 B8 +16.4%，不能据此断言 CI 风险消失。

命令：

`node node_modules/vitest/vitest.mjs run --project fast tests/m8-b7-match-wiring.test.ts tests/m8-b7-cleanup.test.ts tests/m8-b8-restore.test.ts tests/m8-b8-restore-fold-reuse.test.ts tests/b8-resumable-battle.test.ts --maxWorkers=1 --reporter=json --outputFile=<sample.json>`

TEMP/TMP 指向工作区 test-temp；没有调整测试配置。JSON 附件保留每项三个样本及精确数值。

## 热点与实际改动

Node inspector CPU Profiler 加函数调用计时（单独运行四个完整文件）。B7 的 711 次结构校验、B8 restore 的 249 次结构校验均没有调用冠冕历史重演。B7 修前策略编译 469 次 / 241.93 ms，而 canonicalContent 自身约 2122 ms、structuredClone 自身约 1141 ms、GC 约 802 ms；因此重复编译并非主因。计数器含嵌套调用，不可累加为总耗时；同模块内部调用不会经过导出 spy，不能把 replayBattleRecord 的零计数当作没有重演。

- 每次历史验证仍从第一条遍历并核对前缀；已有 recorder 所有权标记的冻结记录在首次完整验证后复用单场结果。新增轮次只重演没有证明的新记录。未跳过旧轮次前缀核对。
- 旧代码每轮从缓存取出完整 Match/Combat 时 structuredClone，首次又复制后冻结。现在由私有 replaySnapshot 交给内部只读历史遍历；重演本来就在独立图上，直接冻结即可。公开 replayBattleRecord / validateBattleRecord 仍复制返回值，调用者修改不影响缓存。WeakMap 生命周期和信任边界不变。
- 外部解析的记录、外部自行冻结的记录不获得 recorder 标记；每次验证重新执行真实战斗。没有新增解析缓存、已验证标志或存档字段。
- 普通对象恢复的快比较/提前复制候选，经三轮发现 B7 两项稳定退化（3-7 tick0 约 97.93→175.55 ms；空装备 Herald 约 224.04→279.85 ms），已完整撤回。对象编译缓存候选也因 B7 独立防御校验的报错阶段改变而撤回。最终普通结构恢复、装备编译、immutable-json 与 47bcff0 完全相同。
- SR-B8 resumable 的 restore/history/资源折叠调用均为零；修前 CPU 自身主要是 structuredClone 约 6580 ms、战斗 tick 及冻结/投影。它的剩余耗时需要另评估战斗快照路径，不能靠历史证明缓存消除。本次没有扩大到战斗引擎改写。

## 验证不变性

原 crowns:84 / +5 联合伪造继续在文本、对象、同步/异步集合、文件/对象导入中被拒绝；缺历史仍明确报“缺少冠冕历史证据”。公开命令合法控制组恢复和续战完全一致。新增回归验证：暖缓存不再次开战或深拷贝证明；增加一轮只重演新轮；修改最终结算即使已暖缓存也拒绝；外部记录连续导入两次均重演，事后篡改仍拒绝；公开返回值污染防护沿用 g4-replay-snapshot。对象分离、Proxy、负零、getter 改账本等测试保留。

API、调用方和 MATCH_CONTRACT 的既有缓存边界没有变化。本次未改规则/数值、存档字段、digest、版本、夹具、超时/门槛或 src/server/、src/rendering/。S1/S2 已在 47bcff0 中完成。等用户明确通知 #148 合入后，才改 PR 目标到 multiplayer、merge 最新 multiplayer，按其当时版本 +1 升版并重录/校验夹具。

## 文件耗时

| 文件 | 基线 | 修前 47bcff0 | 修后 | 对修前 | 对基线 |
| --- | ---: | ---: | ---: | ---: | ---: |
| b8-resumable-battle.test.ts | 17380.00 | 17780.28 | 17406.50 | -2.1% | +0.2% |
| m8-b7-cleanup.test.ts | 75.14 | 72.36 | 71.64 | -1.0% | -4.7% |
| m8-b7-match-wiring.test.ts | 9467.67 | 9217.14 | 9349.03 | +1.4% | -1.3% |
| m8-b8-restore-fold-reuse.test.ts | 90.37 | 67.54 | 69.06 | +2.3% | -23.6% |
| m8-b8-restore.test.ts | 1051.62 | 1055.17 | 1048.87 | -0.6% | -0.3% |

## 超出基线 +5% 的用例

| 用例 | 基线 | 修前 | 修后 | 对基线 |
| --- | ---: | ---: | ---: | ---: |
| SR-B8-02 resumable pure tasks PvP/PvE replay bytes and deferred tick0 at slice 13 | 1755.92 | 1978.16 | 1961.75 | +11.7% |
| SR-B8-02 resumable pure tasks defers early and trailing animation divergence until the terminal slice | 1562.79 | 1661.81 | 1667.09 | +6.7% |
| B7 installed encounters and trusted Match restore keeps neutral registration out of all hero acquisition, traits, equipment and PvP templates | 6.52 | 6.77 | 7.71 | +18.4% |
| B8 within-restore complete resource projection reuse preserves object rejection if a preparation accessor changes the already-read ledger | 4.24 | 4.19 | 4.55 | +7.4% |

这些用例不调用本次修改的历史遍历。修前/修后源码路径相同；三次样本不足以把单项波动归因于某一种 GC/调度因素。已撤回有稳定退化证据的普通恢复候选，未用扩大超时或重新挑选有利样本消除超标。现有热点仍是规范化输出、结构校验、战斗快照复制与 GC；满负载下贴近 20 秒的风险仍存在。

## 全部 62 项逐项耗时

### b8-resumable-battle.test.ts

| 用例 | 基线 | 修前 | 修后 | 对修前 | 对基线 | +5% 内 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| SR-B8-02 resumable pure tasks pre-change byte fingerprint: 0 units per side | 8.48 | 8.72 | 8.63 | -1.0% | +1.8% | 是 |
| SR-B8-02 resumable pure tasks pre-change byte fingerprint: 1 units per side | 208.34 | 212.67 | 205.23 | -3.5% | -1.5% | 是 |
| SR-B8-02 resumable pure tasks pre-change byte fingerprint: 9 units per side | 1423.53 | 1503.07 | 1429.60 | -4.9% | +0.4% | 是 |
| SR-B8-02 resumable pure tasks PvP and mirror equal synchronous bytes at slice 1 | 1089.94 | 1146.75 | 1079.99 | -5.8% | -0.9% | 是 |
| SR-B8-02 resumable pure tasks PvP and mirror equal synchronous bytes at slice 7 | 1044.74 | 1060.68 | 1066.40 | +0.5% | +2.1% | 是 |
| SR-B8-02 resumable pure tasks PvP and mirror equal synchronous bytes at slice 100 | 1017.35 | 999.67 | 995.97 | -0.4% | -2.1% | 是 |
| SR-B8-02 resumable pure tasks PvP and mirror equal synchronous bytes at slice 1201 | 1016.15 | 996.98 | 990.91 | -0.6% | -2.5% | 是 |
| SR-B8-02 resumable pure tasks PvP/PvE replay bytes and deferred tick0 at slice 1 | 1743.95 | 1764.08 | 1763.13 | -0.1% | +1.1% | 是 |
| SR-B8-02 resumable pure tasks PvP/PvE replay bytes and deferred tick0 at slice 13 | 1755.92 | 1978.16 | 1961.75 | -0.8% | +11.7% | 否 |
| SR-B8-02 resumable pure tasks PvP/PvE replay bytes and deferred tick0 at slice 100 | 1724.10 | 1688.82 | 1668.17 | -1.2% | -3.2% | 是 |
| SR-B8-02 resumable pure tasks PvP/PvE replay bytes and deferred tick0 at slice 1201 | 1743.93 | 1707.36 | 1676.23 | -1.8% | -3.9% | 是 |
| SR-B8-02 resumable pure tasks invalid budgets never consume a slice, including after completion; old total cap still faults | 1295.45 | 1304.82 | 1273.86 | -2.4% | -1.7% | 是 |
| SR-B8-02 resumable pure tasks tick0 terminal completes once without stepping | 2.31 | 2.27 | 2.15 | -5.6% | -7.2% | 是 |
| SR-B8-02 resumable pure tasks owns mutable input through pauses and retains replay divergence validation | 1725.99 | 1711.70 | 1699.06 | -0.7% | -1.6% | 是 |
| SR-B8-02 resumable pure tasks defers early and trailing animation divergence until the terminal slice | 1562.79 | 1661.81 | 1667.09 | +0.3% | +6.7% | 否 |

### m8-b7-cleanup.test.ts

| 用例 | 基线 | 修前 | 修后 | 对修前 | 对基线 | +5% 内 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| B7 cleanup independent restore boundaries derives execution 1 + duration 7 as [2, 9) | 12.57 | 12.66 | 12.14 | -4.1% | -3.4% | 是 |
| B7 cleanup independent restore boundaries derives execution 1 + duration 17 as [2, 19) | 18.94 | 18.86 | 18.23 | -3.4% | -3.8% | 是 |
| B7 cleanup independent restore boundaries derives execution 4 + duration 7 as [5, 12) | 11.12 | 11.08 | 10.65 | -3.9% | -4.3% | 是 |
| B7 cleanup independent restore boundaries round-trips neutral 0/0 while rejecting hero zero mana and negative neutral mana | 18.86 | 18.30 | 17.62 | -3.7% | -6.6% | 是 |
| B7 cleanup independent restore boundaries retains the hero minimum even if a future trusted strategy resolves zero maximum mana | 12.68 | 12.22 | 11.22 | -8.2% | -11.5% | 是 |

### m8-b7-match-wiring.test.ts

| 用例 | 基线 | 修前 | 修后 | 对修前 | 对基线 | +5% 内 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| B7 installed encounters and trusted Match restore 1-2 freezes, starts, runs to settlement and resumes canonical saves | 146.68 | 141.46 | 147.47 | +4.2% | +0.5% | 是 |
| B7 installed encounters and trusted Match restore 1-3 freezes, starts, runs to settlement and resumes canonical saves | 119.68 | 114.09 | 113.79 | -0.3% | -4.9% | 是 |
| B7 installed encounters and trusted Match restore 1-4 freezes, starts, runs to settlement and resumes canonical saves | 205.69 | 208.83 | 211.44 | +1.3% | +2.8% | 是 |
| B7 installed encounters and trusted Match restore 2-7 freezes, starts, runs to settlement and resumes canonical saves | 352.61 | 338.96 | 343.28 | +1.3% | -2.6% | 是 |
| B7 installed encounters and trusted Match restore 3-7 freezes, starts, runs to settlement and resumes canonical saves | 502.84 | 531.13 | 510.95 | -3.8% | +1.6% | 是 |
| B7 installed encounters and trusted Match restore 4-7 freezes, starts, runs to settlement and resumes canonical saves | 838.53 | 794.01 | 818.56 | +3.1% | -2.4% | 是 |
| B7 installed encounters and trusted Match restore 5-7 freezes, starts, runs to settlement and resumes canonical saves | 845.23 | 827.70 | 818.11 | -1.2% | -3.2% | 是 |
| B7 installed encounters and trusted Match restore 6-7 freezes, starts, runs to settlement and resumes canonical saves | 971.44 | 978.27 | 987.05 | +0.9% | +1.6% | 是 |
| B7 installed encounters and trusted Match restore 3-7 separates captured initial events from tick-zero opening moves committed by the first step | 97.34 | 97.93 | 97.35 | -0.6% | +0.0% | 是 |
| B7 installed encounters and trusted Match restore 6-7 separates captured initial events from tick-zero opening moves committed by the first step | 213.22 | 151.17 | 171.39 | +13.4% | -19.6% | 是 |
| B7 installed encounters and trusted Match restore replaces the B6 stage-one placeholder with independently enumerated 2/3/4 minions | 0.37 | 0.37 | 0.36 | -1.6% | -2.0% | 是 |
| B7 installed encounters and trusted Match restore returns public immutable previews without draws, hidden loot or manufacturing a special encounter pool | 73.70 | 72.13 | 73.67 | +2.1% | -0.0% | 是 |
| B7 installed encounters and trusted Match restore keeps neutral registration out of all hero acquisition, traits, equipment and PvP templates | 6.52 | 6.77 | 7.71 | +14.0% | +18.4% | 否 |
| B7 installed encounters and trusted Match restore rejects injected or mutated authored inputs, including neutral capabilities placed on a champion | 99.46 | 100.86 | 100.27 | -0.6% | +0.8% | 是 |
| B7 installed encounters and trusted Match restore rejects replayed, removed, cancelled and geometry-mutated opening consumption for 3-7 | 190.24 | 186.03 | 184.64 | -0.8% | -2.9% | 是 |
| B7 installed encounters and trusted Match restore rejects replayed, removed, cancelled and geometry-mutated opening consumption for 6-7 | 417.96 | 450.79 | 409.36 | -9.2% | -2.1% | 是 |
| B7 installed encounters and trusted Match restore restores Herald action identity after earlier tick-one aura maintenance: undefined | 225.50 | 224.04 | 232.95 | +4.0% | +3.3% | 是 |
| B7 installed encounters and trusted Match restore restores Herald action identity after earlier tick-one aura maintenance: "ionic-spark" | 186.13 | 190.30 | 184.85 | -2.9% | -0.7% | 是 |
| B7 installed encounters and trusted Match restore restores Herald action identity after earlier tick-one aura maintenance: "evenshroud" | 187.22 | 183.55 | 183.70 | +0.1% | -1.9% | 是 |
| B7 installed encounters and trusted Match restore restores Herald action identity after earlier tick-one aura maintenance: "ionic-spark" | 186.13 | 190.30 | 184.85 | -2.9% | -0.7% | 是 |
| B7 installed encounters and trusted Match restore round-trips legal Herald item immunity/cleanup boundaries with quicksilver | 816.95 | 787.98 | 768.39 | -2.5% | -5.9% | 是 |
| B7 installed encounters and trusted Match restore round-trips legal Herald item immunity/cleanup boundaries with edge-of-night | 796.89 | 781.04 | 746.35 | -4.4% | -6.3% | 是 |
| B7 installed encounters and trusted Match restore pins the current catalog assumptions used by pure opening restore, without executing combatStart | 1.06 | 1.15 | 1.05 | -8.2% | -0.9% | 是 |
| B7 installed encounters and trusted Match restore rejects re-dating an executed krug heal into a new pending reaction and validates independent death facts | 199.78 | 216.55 | 190.22 | -12.2% | -4.8% | 是 |
| B7 installed encounters and trusted Match restore rejects deletion of active Herald control, its receipt, or both, and forged cleanup | 357.28 | 317.44 | 330.13 | +4.0% | -7.6% | 是 |
| B7 installed encounters and trusted Match restore stage-one combat clears with random one-star opening heroes, seed 0 through actual orb grants | 204.89 | 212.30 | 207.67 | -2.2% | +1.4% | 是 |
| B7 installed encounters and trusted Match restore stage-one combat clears with random one-star opening heroes, seed 1 through actual orb grants | 199.86 | 195.53 | 192.61 | -1.5% | -3.6% | 是 |
| B7 installed encounters and trusted Match restore stage-one combat clears with random one-star opening heroes, seed 42 through actual orb grants | 181.05 | 184.84 | 176.37 | -4.6% | -2.6% | 是 |
| B7 installed encounters and trusted Match restore stage-one combat clears with random one-star opening heroes, seed 4294967295 through actual orb grants | 211.16 | 205.95 | 213.57 | +3.7% | +1.1% | 是 |
| B7 installed encounters and trusted Match restore restores real bird next-tick reactions and rejects changed effects, death identity and missing consumption | 517.87 | 512.74 | 477.90 | -6.8% | -7.7% | 是 |

### m8-b8-restore-fold-reuse.test.ts

| 用例 | 基线 | 修前 | 修后 | 对修前 | 对基线 | +5% 内 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| B8 within-restore complete resource projection reuse folds a running full prefix once per restore, never across inputs or calls | 21.06 | 15.48 | 14.62 | -5.6% | -30.6% | 是 |
| B8 within-restore complete resource projection reuse retains two full-ledger validations for finished combat with a shorter historical prefix | 53.30 | 40.40 | 41.08 | +1.7% | -22.9% | 是 |
| B8 within-restore complete resource projection reuse still rejects a running basis prefix mutation after the complete fold succeeded | 6.28 | 4.28 | 4.22 | -1.4% | -32.7% | 是 |
| B8 within-restore complete resource projection reuse preserves object rejection if a persistentGrowth accessor changes the already-read ledger | 4.69 | 4.05 | 4.76 | +17.5% | +1.3% | 是 |
| B8 within-restore complete resource projection reuse preserves object rejection if a preparation accessor changes the already-read ledger | 4.24 | 4.19 | 4.55 | +8.6% | +7.4% | 否 |

### m8-b8-restore.test.ts

| 用例 | 基线 | 修前 | 修后 | 对修前 | 对基线 | +5% 内 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| B8 default Match own restore round-trips preparation, running, reveal, finished choice and choice resolution without issuing anything | 543.43 | 521.49 | 542.73 | +4.1% | -0.1% | 是 |
| B8 default Match own restore resumed combat has identical complete final state and events to uninterrupted combat | 168.94 | 169.59 | 164.94 | -2.7% | -2.4% | 是 |
| B8 default Match own restore retains input and zero-delta commit for immediate empty-board finishes | 8.87 | 9.11 | 8.13 | -10.7% | -8.4% | 是 |
| B8 default Match own restore rejects missing, forged or changed basis and running resources | 12.53 | 12.96 | 12.10 | -6.7% | -3.5% | 是 |
| B8 default Match own restore rejects frozen plan, receipt, birth, evidence, counter and source-delta corruption | 84.64 | 83.35 | 84.33 | +1.2% | -0.4% | 是 |
| B8 default Match own restore keeps receipt schema rejection through the shared lineage validator | 81.08 | 79.28 | 79.55 | +0.3% | -1.9% | 是 |
| B8 default Match own restore rejects an unearned choice, wrong offered state and forged post-settlement resources | 155.04 | 154.63 | 154.01 | -0.4% | -0.7% | 是 |

## 相关测试清单

命令：`node node_modules/vitest/vitest.mjs run --project fast <以下完整文件> --maxWorkers=1 --reporter=json`。

| 文件 | 通过数 |
| --- | ---: |
| tests/b8-resumable-battle.test.ts | 15/15 |
| tests/crown-restore-cache.test.ts | 4/4 |
| tests/g2-3-content.test.ts | 10/10 |
| tests/g2-3-followup.test.ts | 11/11 |
| tests/g2-3-identity.test.ts | 14/14 |
| tests/g2-3-integration.test.ts | 18/18 |
| tests/g2-3-netcode-hooks.test.ts | 14/14 |
| tests/g2-3-source-pins.test.ts | 2/2 |
| tests/g2-4a-conqueror-items.test.ts | 6/6 |
| tests/g2-4a-crown-gold.test.ts | 9/9 |
| tests/g2-4a-crown-history.test.ts | 6/6 |
| tests/g2-4a-crown.test.ts | 6/6 |
| tests/g4-reference-cache.test.ts | 8/8 |
| tests/g4-replay-snapshot.test.ts | 4/4 |
| tests/m5-replay-sniper-caitlyn.test.ts | 1/1 |
| tests/m5-replay.test.ts | 1/1 |
| tests/m5-serialization.test.ts | 33/33 |
| tests/m6-persistence.test.ts | 44/44 |
| tests/m6-replay.test.ts | 9/9 |
| tests/m7-m6-save-compat.test.ts | 8/8 |
| tests/m8-b10-item-save-replay.test.ts | 45/45 |
| tests/m8-b3-audit.test.ts | 6/6 |
| tests/m8-b7-cleanup.test.ts | 5/5 |
| tests/m8-b7-match-wiring.test.ts | 30/30 |
| tests/m8-b8-resource-provenance.test.ts | 64/64 |
| tests/m8-b8-restore-fold-reuse.test.ts | 5/5 |
| tests/m8-b8-restore.test.ts | 7/7 |
| tests/m8-b9-compatibility.test.ts | 11/11 |
| tests/m8-content-equivalence.test.ts | 4/4 |
| tests/m8-contracts.test.ts | 6/6 |
| tests/match-contract.test.ts | 12/12 |
| tests/opening-random-identity.test.ts | 139/139 |
| tests/p7-restore-compilation.test.ts | 4/4 |
| tests/t12-combat-equip.test.ts | 48/48 |
| tests/t12-offline-transfer.test.ts | 1/1 |
| tests/t12-recovery-boundary.test.ts | 5/5 |
| tests/t2-two-sided-battle.test.ts | 21/21 |
| tests/t3-round-settlement.test.ts | 10/10 |
| tests/presentation/g2-4a-crown-display.test.ts | 1/1 |
| tests/server/g2-3-replay-mirror.test.ts | 1/1 |
| tests/server/two-sided-resolver.test.ts | 13/13 |
