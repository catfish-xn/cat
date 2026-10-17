# PR168：精确已完成历史复用与剩余冷计算瓶颈

起点 c3587d73c0a42367b805001a92cde1dd8fd1a8ba，本次 fetch/ls-remote 远端仍8e81bc5，因此依用户授权从本地继续，未合其他分支。

第一阶段生产代码 ef1ee43f5e88b6e0ae6e7d87a9d87f18eb8b881c：单独src/simulation/preparation-ledger.ts与新安全测试。

## 设计

- 只在最后一次真实成功 nextRound 返回处保存自产可信状态；不是存档的中间快照，也不是任意前缀复用。
- 实际 rules/policy/content身份、seed和截止该nextRound的完整命令（含该命令参数）精确定位；还必须逐字核对候选历史events/roundResults全文，长度来自缓存中已独立生成的状态，不取候选自报长度。无round事件也完整纳入。
- 当前轮全部准备命令、开战及当前tick尾段每次真实执行，最终当前gold、XP、shop、四RNG、事件seq与其他原字段完整比较。只有整个候选通过后才准许入库。
- 新history缓存8条/8MiB，原standalone8MiB和collection64MiB保留，累计80MiB canonical UTF16计账上限；仍是LRU与条目/字节双上限，不代表实际heap上限。collection不跨namespace借用此缓存。
- 旧任意prefix缓存限制保持；本次允许的是精确完整已完成历史，当前尾段始终复验。

## 诊断与中间结果

原11项超时完整证据在 ../multiplayer-sync/。2-7分段诊断29次账本共9253ms，测试约9.7s；是实际重演，不是哈希成本。第一次诊断过滤字符串未选中任何用例，随后修正过滤名；两份日志均保留，未把未执行算通过。

opening初版中间工作树（尚未最终nextRound边界）整B7：19过/6真实超时/5旧档缺账本。单例耗时详见b7-history-file.json；2-7 2583ms、3-7 4848ms已过，其余实际超时保留。不将这个中间工作树结果宣称为最终代码验收。

进一步6-7分段：35次账本累计18.56s，其中准备期首次8.32s、开战tick0再次8.58s；尾段每次约0.15–0.20s。最终nextRound边界针对两次冷建重复，当前准备命令也逐次重演。

最终边界一次cold6-7 CPUprofile诊断9075.7ms（插桩，非验收）：structuredClone约1.8s，主要每tick单位动态状态复制；advanceS13Tick自身和匿名回调约2.56s、GC约0.57s，记账command clone仅约64ms。临时诊断源码和profile存本文目录，没有放入默认测试；诊断超过原5秒也按失败记录，未修改门槛。

新回归最初误选emptyBoard准备路线，历史combat step为0，断言失败；改用真实三英雄完整战斗再nextRound，保留首次日志。新测试验证非空历史、当前尾段步数、历史无round事件/roundResults一字节改变全重打并拒、重复gold+1明确拒因、RNG/命令篡改、getter与返回对象污染隔离、续战一致。

## 执行次数断言适配

verified-restore-cache.test.ts 中原当前gold+1负例要求每次执行全部历史steps；新已批准完整历史缓存使历史复用，改断言为0历史steps。原精确拒因 preparation-ledger-gold、重复调用拒绝、失败结果不被接受全部保留。新测试另明确历史字节篡改必须重打historySteps+2并拒，合法/非法当前尾段仍按2或3步实际执行。这是执行次数依据变化，没有减少恢复要求。

最终nextRound设计相关12文件188/188已过；B5完整文件9/9已过；B7完整文件22/30通过，剩3项真实5秒超时与5项旧raw缺账本拒绝。没有全套/CI全绿结论。

## 已批准暂缓

护盾5个正控等PR161神器锻造器真实可达路径，不改任意grant成白名单，不跳测试。Herald5旧raw缺账本按明确旧档政策保留，统一版本升级时再迁移。#157未入实际基线，冠冕金组合不在本轮执行。

## 固定版本与最终验证

- 生产修复 SHA：ef1ee43f5e88b6e0ae6e7d87a9d87f18eb8b881c；最终受测代码及测试 SHA：ca17df5259ce0beffcbe2fbc4343e70a0ba3f04e。后续仅补本文与日志，无生产代码差异。
- 比较起点：c3587d73c0a42367b805001a92cde1dd8fd1a8ba；机器/工具链沿用同一环境，Node v24.19.0 / npm 11.9.0。
- 12相关文件188/188、B5 9/9、B7 22/30，共本轮重验219通过/8失败；这是选择文件合计，不是全仓库用例数。盾5项本轮未重复执行，仍按先前失败和用户决定等待PR161。
- B5两个先前明确批准20s的用例本次4521ms/3705ms，原授权仍原样保留；本轮未修改任何timeout。
- typecheck通过；record-g2-3-inputs.cjs写入与--check均通过，9案例、digest fnv1a32-utf16:793e0884，生成文件没有新字节差异。Herald未write、未迁移；旧格式仍按政策拒绝。
- B7命令：npm test -- tests/m8-b7-match-wiring.test.ts --reporter=default --reporter=json --outputFile=/tmp/b7-history-next-round.json；B5同格式替换文件名。相关12文件清单与逐例耗时见b7-history-related.json，最终B5/B7逐例耗时见相应JSON。
- 以下原始失败和最终结果均为真实原时限运行。不同测试进程、缓存热顺序及调度噪声会影响单次耗时，不把一次对比当统计显著结论。

## 原11项超时前后（毫秒）

| 用例 | 修前 | 修后 | 修后结果 |
|---|---:|---:|---|
| 2-7 freezes, starts, runs to settlement and resumes canonical saves | 9311 | 1796 | passed |
| 3-7 freezes, starts, runs to settlement and resumes canonical saves | 17670 | 3546 | passed |
| 4-7 freezes, starts, runs to settlement and resumes canonical saves | 32302 | 5508 | failed |
| 5-7 freezes, starts, runs to settlement and resumes canonical saves | 57994 | 7634 | failed |
| 6-7 freezes, starts, runs to settlement and resumes canonical saves | 91545 | 12664 | failed |
| 3-7 separates captured initial events from tick-zero opening moves committed by the first step | 5404 | 361 | passed |
| 6-7 separates captured initial events from tick-zero opening moves committed by the first step | 22406 | 606 | passed |
| rejects replayed, removed, cancelled and geometry-mutated opening consumption for 6-7 | 7767 | 797 | passed |
| restores Herald action identity after earlier tick-one aura maintenance: undefined | 22023 | 485 | passed |
| rejects deletion of active Herald control, its receipt, or both, and forged cleanup | 7791 | 629 | passed |
| restores real bird next-tick reactions and rejects changed effects, death identity and missing consumption | 11080 | 4699 | passed |

3项仍失败：4-7/5-7/6-7完整结算恢复分别5508/7634/12664ms。固定完整历史消除了后续候选的重复历史重打，但首次独立校验仍必须从seed执行真实历史；不能用存档中间快照跳过。其余8项恢复/拒绝断言保持，原5秒阈值下通过。

## 其他CPU热点与本轮未采用方案

上述cold6-7 profile是插桩诊断，不是验收。除native单位动态拷贝约1800ms和战斗执行主体约2559ms外：
- combat-static.ts:16 sharedCombatDeclarations约278ms。逐单位须检查实际声明描述符；immutable-json.ts已有WeakSet认证与声明驻留，未发现重复完整编译。按单位ID缓存会忽略外部对象变化，不采用。
- g2-3-state.ts:40 updateG23Cells→deriveTraits含内部回调约253ms。每次公开命令accept都更新实验体格；可变preparation/奖励变更都是实际依赖。单trait投影可以未来优化，但需要保留全部未知英雄/羁绊检查和getter语义，且总潜在收益不足填补本轮剩余秒级差距。
- combat-s13-state.ts:23 statusModifiers约138ms，已有statuses数组身份+tick索引；每tick效果到期和状态替换是真实依赖，不能仅按单位ID跨tick复用。
- maintainMechanisms179ms、refreshMechanismAuras85ms、dispatchTriggers73ms属于每tick机制/位置/事件变化；没有证据支持跳过。recordPreparationCommand拷贝约64ms，不是主因。
- GC约569ms是采样成本，不等同可直接删除的计算。

做过有限plain数据clone微基准：3000次真实3单位输入，原snapshotData约46ms/native96ms；取消共享的草稿约73ms/native103ms。该方案未采用：JS对象遍历与native structuredClone对透明Proxy的接受语义有差异，收益也不能闭环剩余超时。临时生产改动已定向撤回，combat-s13.ts与replay/snapshot.ts相对本轮起点无差异；未新增模式或删字段。unadopted-*与clone-benchmark-*仅是诊断证据。完整克隆图/真实战斗对照的草稿测试未执行，文件名unexecuted明确标记；不能把微基准5项通过当全语义等价证明。

本轮不继续叠加低收益核心重构。下一步需要评估首次冷历史真实战斗执行的更深性能方案；目前没有证据可将其宣称已达5秒，也不建议靠删断言、改时限、信存档快照关闭。

## 文件与依赖边界

实际修复位于preparation-ledger.ts:58–79（私有有界历史缓存与核对）、:139（真实nextRound边界）、:154/170（最终完整比较保持）；新增preparation-history-cache.test.ts验证可信边界、无round历史事件、results一字节变更、当前尾段、污染隔离与getter。旧verified-restore-cache.test.ts仅两处历史执行次数断言按本节说明适配。

护盾等待PR161的5正控位置：tests/g2-4b-resists-restore.test.ts:54、79、104、164的object/JSON；共同helper:11–24在:20直接grant。g2-3-policy.ts:18/25过滤Ornn，g2-3-economy.ts:30消费过滤表；g2-3-rewards.ts:47虽支持但未启用。当前无法把这些夹具改成真实公开取得路线；不将早期账本拒绝误报为盾字段验证充分。

旧档缺账本拒绝是既定格式变化。合并时仍需统一升级存档相关身份/版本并按既有顺序迁移夹具，本轮版本常量、digest及raw fixtures完全未改。PR168未合并；本报告不是签收或可合入声明。

## 最终逐文件计数

| 文件 | 通过 | 失败 | 计时边界 |
|---|---:|---:|---|
| tests/m5-command-phases.test.ts | 13 | 0 | 原文件时限不变 |
| tests/m5-economy.test.ts | 42 | 0 | 原文件时限不变 |
| tests/m5-serialization.test.ts | 33 | 0 | 原文件时限不变 |
| tests/m6-persistence.test.ts | 44 | 0 | 原文件时限不变 |
| tests/m6-replay.test.ts | 9 | 0 | 原文件时限不变 |
| tests/m8-b8-restore-fold-reuse.test.ts | 5 | 0 | 原文件时限不变 |
| tests/m8-b8-restore.test.ts | 7 | 0 | 原文件时限不变 |
| tests/restore-audit/match-authority.test.ts | 10 | 0 | 原文件时限不变 |
| tests/restore-audit/preparation-history-cache.test.ts | 1 | 0 | 原文件时限不变 |
| tests/restore-audit/preparation-ledger-scope.test.ts | 4 | 0 | 原文件时限不变 |
| tests/restore-audit/preparation-ledger.test.ts | 16 | 0 | 原文件时限不变 |
| tests/restore-audit/verified-restore-cache.test.ts | 4 | 0 | 原文件时限不变 |
| tests/m8-b5-equipment-history.test.ts | 9 | 0 | 原文件时限不变；仅既有两例20秒授权 |
| tests/m8-b7-match-wiring.test.ts | 22 | 8 | 原文件时限不变 |
