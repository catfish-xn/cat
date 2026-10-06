# M6 Review

状态：W3 修复与独立验证进行中；尚未最终 F4 同提交验收，不是合并许可。M6_GOAL 与公共合同已在 `d78be2a` 冻结，当前工作没有重新规划或扩大范围。

| 发现 | 修复与证据状态 |
|---|---|
| IDB request 回调内同步 QuotaExceededError 未捕获，可能退化为 abort 并产生 pageerror | A 增加 guarded 回调；E 原生 IndexedDB quota/abort/回滚检查通过。扩展33检查包括真实完成局第四档安全淘汰及不可变战斗拒绝覆盖。 |
| 新纵向布局下鼠标悬停 E 错失目标，快速 D/D/F 正常但 E 没有出售 | 主控按原生 client 坐标与当前 canvas bounds 命中，并同步滚动/input bounds；E 完整77项原生输入通过，237.856s。原预期不变。 |
| 旧 shop-sticky 遮挡 tab 用例的物理前提被新布局消除 | 独立测得 shop/tabs 都非 sticky，目标中心 elementFromPoint 为目标自身。保留原生滚动命中、唯一目标 pointerdown、完整 Match/RNG/金币/收据不变与选择正确的断言；真实 choice/dismissal 遮挡用例全部保留。未制造 CSS 遮挡，也未静默删用例。 |
| 长期 quota/abort 时 coordinator 积累完整快照 | B→A 交叉审查提出；A 改为一个 in-flight 与一个 pending，合并最新合法快照与所有未写入新增战斗，冲突永久停写。A 独立 retry gate 覆盖100次capture、重复quota/abort、三场新增历史、一次合法重试与零pageerror；其结果不冒称E执行。 |
| stats 单位详情使用冻结 AD/AP/双抗；敌方选中立即清空 | D→C 发现；C 改用当前运行时 readCombatStats，主控允许显示敌方选中但出售仍由领域限制。C组件测试与E手写6项统计oracle交叉覆盖，待最终相同提交重跑。 |
| 玩家事件记录暴露来源类型/单位/技能内部ID | D 用冻结上下文单位名与中文来源/状态映射修复；数值仍来自权威事件，未改变规则或digest。 |
| choice 弹窗只有 aria-modal，自动焦点可能在 import-awaitArchives 隐藏阶段丢失 | D 加焦点移入、Tab/ShiftTab圈定、body模式提交观察；取消/撤盾恢复中性焦点，保留D/F/E原生语义；修后五视口公开入口/焦点/旋转真实浏览器dev gate通过50.826s。 |
| replay hidden 或切换战斗可能重试 pending save，改变 revision | 主控将 active 入口与 replay 内切战分开，busy/fence 与 visibility 路径按只读合同约束。E新增真实IDB quota边界故障 + 回放切战/返回/持久化revision检查待运行。headless始终visible，visibility使用明确标注的浏览器环境注入，不声称真实切后台。 |
| 第四完成局/同runId旧文件再次完成可能留下陈旧 ReplayPanel 档案 | 主控在成功激活/归档后刷新档案并调整同runId去重；A真实MatchApplication gate已通过对应场景（4cases总计48.956s，pageerror0）；最终同SHA仍待CI。 |
| dispose 后异步失败可能回调旧UI或遗留候选会话 | 主控加入 operation/disposed fence 与 finally候选释放；A真实原生IDB/File.text异步失败gate已通过对应场景（4cases总计48.956s，pageerror0）；最终同SHA仍待CI。 |

E 的统计预期为独立手写数字。四条已有路线每场原始 Match/全事件与历史/回放一致；后续加强为原路线每tick独立SHA256轨迹及检查点邻域seek，没有把生产Playback作为预期生成器。加强版待最终执行。

F1 的 SHA/dirty/环境/容量/预算原始证据仍保持历史身份，不能当作生产 F4 性能结果。生产 performance gate 将复测四路线与同 F1 的9玩家/8敌人/15装备完整合法30战样本，真实capture/hash/clone/IDB/完整导入/seek/统计与模块回收。完整应用30次公开新局/导入/回放循环另由F2验证。全部最终门禁必须在一个干净提交完成；当前没有未知缺陷不存在的保证，未自动合并或进入M7。

追加独立性能发现与关闭：生产真实capturePrefix→Coordinator→Repository路径首次p95=74.10ms，违反冻结50ms。A消除已独立深冻结捕获的重复克隆，B复用进入历史时已独立冻结的context/initial/event子图，每次仍算全量摘要；不使用同tick缓存。原失败manifest保留。原样本原阈值复测164.569s，8项全部通过，capture p95降至37.80ms；模块30次GC堆增长137,820 bytes且监听器/组件DOM归零。实际样本/数值与历史身份见M6_VALIDATION；此为未提交优化树的局部证据，仍须新干净SHA全套最终复验。

### 591525c CI runner failures and corrections

The old clean CI run 37401141157 did not pass all gates. Its storage module gate completed 33 checks, then correctly failed the zero-browser-error assertion: navigating the application root unintentionally booted Phaser while this isolated harness had dependency discovery disabled, causing its CommonJS default-export error. The runner now serves an empty dedicated same-origin harness page and imports only the production modules under test; browser-error checks remain mandatory.

Both cannon modes reached seed validation after completing the save/replay/lifecycle checks, then timed out waiting for an invalid-seed alert. The captured trusted input stream proves the empty-input Delete targeted the real choice dismissal shield, leaving the old value 42 intact; the following public button therefore legitimately started another seed-42 run. The runner now waits for that shield to disappear after choosing offers, before filling seed inputs. Invalid-input state/identity preservation assertions remain unchanged. These are runner corrections, with no production source or budget changes; new clean-SHA execution remains required.

### Later local verification and retained limitations

Enhanced public-input F2 dev passed in 332.397s, starting clean 2dc5c44, with stable source fingerprint while later test-only commits occurred: saved-file/refresh exact continuation, quota/replay revision isolation, 30 real application cycles (+272868B after GC, stable listeners/RAF and one application/session/observer), and public seed command determinism passed. The independent extended application gate passed six cases in 91.747s: thirteen legal full-envelope phase samples with native-IDB Continue and exact next transition, unavailable-IDB same-tick export, and the four earlier lifecycle/archive failure cases. These remain historical local evidence, not a replacement for final same-SHA CI.

Same-hardware production performance started clean 3f9fa8c and passed all eight unchanged budgets in 166.247s (source stable through test-only commits): capture40.4, write69.5, fullCapture224.1, activation312.5, completeImport8500.2, firstSeek1158, cachedSeek23.2, statsBatch0.2ms; module lifecycle heap +137524B. The earlier 74.10ms capture failure remains preserved.

Old CI preview exceeded the 1MiB application heap budget and is not declared resolved by a later pass. A separate preview heap-snapshot diagnostic did not reproduce that excess (+175844B; listeners78→78, RAF1→1), but failed its final random-seed display check. Static review confirmed active session installation precedes asynchronous archive refresh and final control rendering; the runner now waits for public seed buttons to become enabled before asserting the displayed seed. This diagnostic run is explicitly excluded from final evidence. NaN is also exercised as the sixth public invalid-seed input, retaining state and identity assertions.

The final authoritative machine appendix is generated only after same-SHA normal-route and M6 comparisons, required execution-job timings, frozen budgets and clean identities all pass. Committed prose records history; it does not predict a future final SHA or supersede a failed machine gate.


### 本地 heap 独立复核（非最终通过）

[B/D 独立 heap 诊断](M6_HEAP_DIAGNOSTIC.md)记录了两个 snapshot 的 SHA256、属性识别数量和强引用路径。本地样本中旧 Session／History／Coordinator 已释放，Playback 为零，Phaser 对象数量稳定；这不证明 CI41 preview 的 1 MiB 超标已修复。保留旧失败，最终仍以同一干净 SHA、正常 runner 和默认冻结预算的正式门禁为准。
