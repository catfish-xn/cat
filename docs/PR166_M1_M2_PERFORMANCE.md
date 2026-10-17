# PR #166：M1/M2、三入口回归与恢复/capture 提速

M1、M2 和两条审查建议已实现。炮手修复后三轮全部通过，capture p95 三轮均低于 50ms；M6 整体 2/3 轮通过，失败详情完整保留在下文与机器证据中。

## 版本、约束与测量边界

- 施工起点：`3d63b123ec2aac428767743c53f3a5b659d003ff`；分支 `codex/fix-task-mechanism-restore`；目标 `multiplayer`。
- 用户指定性能对照：`d23b7afe0c74ae830bcb945d42f41a08fe0684a9`。没有合并 multiplayer、rebase 或强推。
- 最终源码指纹：`85b6618975b745a675666dacfdd21c4291170ac46a2cdd02c9283675375b6065`。修复后正式 M6 各轮均记录相同指纹，测量期间没有修改源码。
- 不改规则、数值、版本常量、测试时限和性能门槛；没有删测试、跳过测试或放宽读档校验。仅执行用户指定的测试及指纹录制/核对，没有跑全套。
- Linux，4 逻辑 CPU，Intel Xeon Skylake，8GB 内存，Node v24.21.0、Vitest 5.0.3、Playwright 1.63.0、Chromium 153.0.8010.12。每轮独立进程、原始配置、原始时限；本任务发起的性能测试串行。M6 开始前等待已存在的其他 M6 结束，等待不计入耗时；仍无法阻止其他任务随后在同机运行，因此不声称有独占机器。
- d23 与本分支包含不同上游规则版本，作为用户指定的性能水平参照；不能将跨版本差值解释为本次代码的严格单因素收益。3d 修复前后保持同一规则和内容。

## 修复位置

| 文件:行号（交付版本） | 改动及验证意义 |
| --- | --- |
| src/simulation/combat-runtime-facts.ts:28 | M1：按目标 unitId 比较 reaveBps、reaveUntilTick，缺省为零；同时验证应有和应无状态。完整任务队列、Sion 与 buddy 历史检查保留。 |
| src/simulation/combat-runtime-facts.ts:33 | M2：从认证名册识别每个黑玫瑰成员，按 unitId 比较个人 runtime.castCount，不能用团队总计或候选收据自洽代替。 |
| src/simulation/serialization.ts:257 | 创建本次恢复的惰性重演上下文，供 sampled-stat 与 :292 的任务/召唤事实比较共用。 |
| src/simulation/m8/sampled-stat-facts.ts:18 | 复用同一 opening 和保存 tick 事实；M1/M2 没有增加第二遍重演。 |
| src/simulation/restore-combat-replay.ts:51 | 只在恢复时创建精确证据上下文，跨恢复有界复用独立模拟轨迹。 |
| src/replay/history.ts:173 | 私有录制器复用已计算或在恢复时已验证的 terminal/events 两个哈希，:201 在 observe 更新时同时失效。 |
| src/persistence/capture-ownership.ts:20 | live Match 复用现有 snapshotData 共享认证不可变子图，mutable 图仍复制和冻结；外部/解析图保留原生 structuredClone。:10 只跳过已证明全图不可变的子树。 |

## 热点及处理

原 3d 的 `combat-runtime-facts.ts:14` 和 :15 每次恢复都从开局重演到保存 tick；`serialization.ts:319` 的 serializeMatch 本身也执行恢复认证。B7 一个往返检查点调用三次恢复认证，重复支付相同轨迹成本。原提交保留的埋点报告记录任务比较 555 次、推进 27,462 tick、累计约 15.049s（含埋点，不能当成本次无埋点三轮数据）。

中间缓存候选的 CPU profile 将约 51.8s / 26.6% 归于 atSaveTick；克隆声明后重新认证/驻留又占约 4.8%。这是定位用的中间候选，不是原 3d 的完整 CPU profile。最终 `restore-combat-replay.ts:83` 直接用纯 stepCombat 推进私有 cursor，:94 仅深拷贝全部待比较事实，避免每个恢复 tick 克隆、解冻并重新驻留无用声明。

原 `src/replay/history.ts:171` 在每次 capture 对未变化的私有 terminal 和全量事件重新算两个哈希；恢复构造已验证这两个哈希，本次将认证留在恢复时，capture 只读取私有有效结果，observe 更新时失效重算。原 `src/persistence/capture-ownership.ts:16`、:17 对 Match 的整图 native clone 并重新递归冻结；现在只共享经完整图认证的不可变元数据，动态内容仍深复制。

精确缓存的边界：

- 键为完整 `{version: M8_VERSION, basis, strategy}` 的编码内容哈希；:64 命中后再次比较完整编码串，哈希碰撞不能串用。没有使用对象引用作为认证键，也没有缓存候选的通过结论。
- LRU 最多 8 条轨迹；编码超过 1Mi UTF-16 代码单元不入缓存。相同轨迹递增 tick 只推进增量，倒退则由 opening 重算。
- :75 的 opening 和 :94 的事实图均深拷贝；缓存中的 cursor、tasks、ledger 不向调用方暴露。每次仍完整验证当前候选，包括刚通过后在同一对象上的篡改。
- 正常对局步进不导入这个恢复上下文；capture 不填充该缓存。BattleHistory 的哈希复用属于录制器私有增量状态，依赖其自身拥有权及更新失效，不作为外部输入或候选的认证证据。

## 新增及补齐测试

三个入口指 `serializeMatch(bad)`、`restoreMatch(bad)`、`restoreMatch(JSON.stringify(bad))`。

| 测试位置 | 覆盖 |
| --- | --- |
| tests/task-mechanism-restore.test.ts:105 | 建议1：取同一次施法 actionSeq，等待最后一条诅咒任务完成，确认实际 tick 等于该次计划最晚执行 tick，交给 :43 原往返 helper，续战逐 tick 比较状态与事件。 |
| tests/task-mechanism-restore.test.ts:152 | M1拒绝：指定 seed3151248，第4轮 tick89、十条任务、enemy-r4-1 的 5000/289；分别改比例为0、期限为89、双零，另测未命中目标凭空添加状态，三个入口均拒绝。 |
| tests/task-mechanism-restore.test.ts:171 | M1合法对照：对象/JSON恢复相同，续至104，艾瑞莉娅护盾维持200。 |
| tests/task-mechanism-restore.test.ts:191 | M2拒绝：指定 seed42、第8轮三人阵位、tick20，unit-13 施法数0改5；另将真实施法从莫甘娜转给弗拉基米尔而保持团队总数，三个入口均拒绝。 |
| tests/task-mechanism-restore.test.ts:208 | M2合法对照：续至tick21，无 bindingChanged，赛恩仍绑定、护盾0。 |
| tests/task-mechanism-restore.test.ts:117、:230、:247、:261、:295、:337 | 建议2：原Sion、诅咒变体/转移/伪造任务、buddy与同对象篡改负例补 serializeMatch 断言。 |
| tests/restore-audit/combat-accumulators.test.ts:21 | 原伪造Maddie负例补 serializeMatch 断言，三个入口齐全。 |
| tests/task-mechanism-restore.test.ts:304 | 两个原重演 spy 用例按用户授权的精确缓存调整，验证相同内容的对象和JSON命中、每次仍拒绝当前篡改、返回图不污染证据、下一tick仅补一步。 |
| tests/task-mechanism-restore.test.ts:358 | 容量淘汰、同seed但完整输入改变必miss、返回opening/facts深拷贝、强制哈希碰撞仍独立重建。 |
| tests/task-mechanism-restore.test.ts:395 | 仅复用已验证的私有前缀哈希；下一次observe必须恰好重新计算两个哈希。 |

最终定向回归：task **20/20**，文件执行 **19.569207s**；combat-accumulators **1/1**，**0.027319s**；合计 **21/21**，进程 **23.785s**。新增6条，没有单独设置时限；原有时限未改。

## 三轮性能结果

以下 wall 是整个进程墙钟时间，含加载、转换和夹具；case 是 Vitest 用例时间，B7 为30条之和。全部正式轮次按原始结果保留。

### m5-replay-cannon

| 版本 | wall 第1 / 2 / 3轮（s） | case 第1 / 2 / 3轮（s） | wall 中位数（s） | 各轮通过数 |
| --- | --- | --- | --- | --- |
| multiplayer d23b7af | 179.439 / 143.046 / 135.326 | 173.815 / 137.752 / 131.354 | 143.046 | 1/1 / 1/1 / 1/1 |
| 修复前 3d63b123 | 207.357 / 209.319 / 203.309 | 191.210 / 193.229 / 188.741 | 207.357 | 0/1 / 0/1 / 0/1 |
| 本次修复后 | 157.744 / 155.412 / 150.747 | 152.683 / 150.143 / 146.723 | 155.412 | 1/1 / 1/1 / 1/1 |

修复后用例中位数150.143s，指定基线137.752s，约慢9.0%；修复前三轮均触及原180s时限，修复后三轮均在原时限内完成。修复后三轮均完整执行206条命令、8703 tick。原版失败已经由Vitest发出超时结果后，runner才终止仍在运行的异步路线，失败照记，未修改测试时限。

### m8-b7-match-wiring

| 版本 | wall 第1 / 2 / 3轮（s） | case合计 第1 / 2 / 3轮（s） | wall 中位数（s） | 各轮通过数 |
| --- | --- | --- | --- | --- |
| multiplayer d23b7af | 36.239 / 37.703 / 36.478 | 11.721 / 12.670 / 12.230 | 36.478 | 30/30 / 30/30 / 30/30 |
| 修复前 3d63b123 | 52.704 / 54.860 / 53.765 | 29.344 / 30.326 / 29.084 | 53.765 | 30/30 / 30/30 / 30/30 |
| 本次修复后 | 41.215 / 40.901 / 39.128 | 16.857 / 16.283 / 16.642 | 40.901 | 30/30 / 30/30 / 30/30 |

修复前后 wall 中位数53.765→40.901s，下降23.9%；相对指定基线36.478s约慢12.1%。每轮30/30通过。

### M6 原性能预算

| 版本/轮次 | wall（s） | capture p95（ms，门槛50） | 显式门槛通过 | 独立full-load往返（ms，门槛30000） | 整体结果 |
| --- | --- | --- | --- | --- | --- |
| multiplayer d23b7af，第 1 轮 | 343.687 | 23.3 | 8/8 | 11270.3 | 通过 |
| 修复前 3d63b123，第 1 轮 | 370.184 | 39.3 | 7/8 | 12316.1 | 失败 |
| 修复前 3d63b123，第 2 轮 | 352.388 | 42.9 | 8/8 | 10980.0 | 通过 |
| 修复前 3d63b123，第 3 轮 | 349.366 | 35.1 | 8/8 | 11672.6 | 通过 |
| 本次修复后，第 1 轮 | 335.527 | 11.4 | 8/8 | 47969.7 | 失败 |
| 本次修复后，第 2 轮 | 347.307 | 9.9 | 8/8 | 12567.4 | 通过 |
| 本次修复后，第 3 轮 | 345.404 | 10.6 | 8/8 | 12599.4 | 通过 |

修复后 capture p95 为 **11.4 / 9.9 / 10.6ms**，三轮均低于50。每轮8个显式门槛以及独立full-load、生命周期和传输保真是分别检查的，不能以capture通过替代整轮通过。

用户提供的CI原版capture 52.6ms和#167炮手约2分半属于任务输入；本机原版三轮capture没有复现超过50ms，不能将不同机器的CI样本混入本机正式三轮。本次capture收益依据同机前后对照，CI表现仍需实际复验。

必须保留的失败：修复前第1轮 statsBatch 8.6ms >5；修复后第1轮8/8显式门槛通过，但独立full-load 47969.7ms >30000，整轮失败。修复后第2轮完整通过（full-load12567.4ms，生命周期30次、无额外listener/root，传输值及alias指纹一致）。第3轮和d23对照的完整结果见表及机器数据。未改门槛，也未用成功重跑替换失败轮次。

另有中间诊断M6失败：最终源码的trial capture10ms、full-load13460.6ms，但第三次完整导入49811.8ms超限，末尾独立传输验证页崩溃；当时观察到另一M6同时运行。本报告保留该诊断，不纳入正式三轮，也不将所有波动归因于外部争用。

## 指纹与历史夹具

| 命令 | 结果 | wall（s） |
| --- | --- | --- |
| `node tests/fixtures/record-g2-3-herald.cjs --write` | 退出0 | 80.629 |
| `node tests/fixtures/record-g2-3-herald.cjs` | 退出0 | 81.755 |
| `node scripts/record-g2-3-inputs.cjs` | 退出0 | 6.600 |
| `node scripts/record-g2-3-inputs.cjs --check` | 退出0 | 5.713 |

当前Herald重新生成并独立校验 **5/5场景、7文件**；inputs **9/9**，内容digest仍为 `fnv1a32-utf16:b58e35ae`。当前Herald sourceSha256为 `3b846f501fae684e9694c5e8f0adc0640e83c0e703e3c3aad2bda6c6af7925b0`；payload及轨迹字节不变，只更新当前生成清单的源码指纹。

早期误用过历史wrapper；已经按用户更正执行 `git checkout origin/multiplayer -- tests/fixtures/g2-augments-herald-raw/`，再只用当前录制器重新计算。最终历史目录与 `origin/multiplayer` **完全一致**：比较引用 `1d1a07edd774f7e796635edda96e7a9cd0b19fad`，逐文件名和所有blob比对，**7文件、namesEqual=true、allBlobsEqual=true**，目录tree `17047371cc4e93e7d99b27a656f839176b234801`。提交中没有该历史目录改动。

最后执行 `npm run typecheck`：**退出0，20.055s**。没有执行全套测试。

## 自行决定

1. **选有界完整内容证据缓存**：仅调用内共享无法消除跨三个认证入口的同轨迹成本，用户已明确允许精确缓存；选8条LRU、完整编码碰撞复核和每次候选比较。备选是每次从0重演，正确但无法恢复当前性能；对象引用缓存不满足约束。
2. **选私有cursor和事实投影深拷贝**：纯stepCombat保证动态状态独立，避免每tick重新克隆声明；投影包含现有全部待认证事实，任何新增事实仍须明确纳入投影和比较。备选为每次返回完整CombatState深拷贝，诊断显示明显增加重复声明工作。
3. **选私有前缀哈希失效机制和认证不可变子树共享**：将已验证的工作留在恢复时，capture继续复制动态状态，observe时失效。备选为每次重算两个哈希、复制所有静态metadata；对parsed/external图仍保留native clone，因为先尝试JS复制更慢。
4. **选保留全部正式失败、串行测量**：三轮均如实报告，不降低门槛、不改时限、不做最好三轮筛选。备选为只报告成功重跑，会掩盖full-load波动，未采用；更稳的后续是独占CI资源重验。
5. **选当前Herald录制器--write后再默认核对**：该脚本默认只重生并验证，显式--write仅更新当前g2-3目录；先恢复历史目录后再独立逐字节验证，遵守用户更正。备选为手工改指纹或历史wrapper，前者不可复核、后者会覆盖历史夹具，均未采用。
6. **选留在3d分支修复而不吸收目标分支规则**：d23只作指定性能水平对照，避免引入版本/规则变化。备选合并multiplayer会扩大范围且触及用户约束，未采用；两个原spy用例保留并改为验证已授权缓存语义，没有删除测试。
7. **选沿用本分支最近两次提交的Codex署名**：本机没有Git author配置，仅对本次提交使用临时-c参数，不修改全局或仓库配置。备选是设置全局身份或等待用户配置，前者影响其他任务、后者会中断已授权交付，均未采用。

## 未完成与风险

功能修复、建议、指定回归、指纹、typecheck和三轮测量均已完成。性能目标中的炮手与capture已达到本机证据要求；**M6正式三轮未达到全部整轮通过**，首轮独立full-load超限需继续关注。已有完整成功轮次，仍不能保证共享服务器/CI上的尾延迟。建议在独占CI执行同一原脚本，若仍复现full-load异常，再针对该阶段采样；不改任何门槛或测试。

机器数据见 [MEASUREMENTS.json](evidence/restore-audit/pr166-m1m2/MEASUREMENTS.json)，包含25次正式运行、定向回归每条断言耗时、M6各门槛/传输/生命周期、全部诊断失败、指纹命令与历史blob核验；原始日志与profile保留在服务器 /tmp/hex-pr166-m1m2/。没有合并PR，审查与用户最终合并决定仍保留。
