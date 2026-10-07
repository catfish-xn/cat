# M6 Review

> 2026-10-07 状态索引：本文保留原始 Review 过程；最终技术复验见 [M6_FINAL_REVIEW.txt](../M6_FINAL_REVIEW.txt)，M6 已由 PR #7 合入 main。M7 与独立内存问题的当前状态见 [M7_STATUS.md](M7_STATUS.md)。

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


### 用户 Review 的三项 P2 修复

旧生产提交438f35b在隔离git archive中独立复现：真实鼠标从左/右/上离开viewport后E仍误售；打开回放→返回→原生popup同项重选未进入；完成局的真实IDB档案读取延迟后，新局导入已经完成并淘汰旧档，但旧结果会恢复已淘汰列表。证据保留在仓库外work/m6-p2-baseline-evidence；复现不受主工作树HMR影响。合法并发调度已证实，未声称自然使用频率。

主控的鼠标修复只在relatedTarget=null的mouseout及blur清悬停坐标，保留dragging/selected优先级和D/F后按当前canvas bounds计算；所有新增监听器配套SHUTDOWN移除。B在ReplayPanel非null→null退出边界重置选择，避免每帧清除异步打开中的选项。主控给档案刷新加请求代号、runId/activationEpoch/Session身份检查，每个await及内部catch均受约束；install先失效旧读取并清档案引用，dispose失效。正常保存revision或只读回放operation变化不废弃当前请求，真正当前读取失败仍报告。A只读交叉审查无阻断。

E回归覆盖三方向离窗全Match/账本/token不变、重入可出售、显式选中与拖拽离窗仍可出售；同场原生popup重入保持全Match/账本/revision；跨run迟到成功与同run新epoch迟到失败均保持新列表/status/Match/账本/token。延迟仅控制真实IDB结果Promise，等待自动refresh真实settle后才断言，不以固定等待抢在旧请求完成前判通过。最终比较器强制两模式新input/reopen证据及两类迟到结果；Goal、合同、阈值和领域/golden均未改。此段为修复记录，最终同SHA运行结论由新CI生成的机器附录决定。

CI47（clean 6c1522f）新增同场重入回归首次失败，dev/preview均记录revision36→37；真实失败ZIP及digest保留于仓库外work/m6-ci47-failed-preview.zip。查明新用例错误沿用早先quota故障区间基线：第一次从active进入回放按既有设计flush积压保存，因此合法前置写入已完成。原quota区间的完整state/ledger/token与原生IDB等式恢复在该区间结束处，未放宽或删除；新增用例在首次open完成后独立采集基线，再执行返回→同场原生popup重选，严格比较完整state/ledger/token及再次读取的真实IDB版本。生产代码未变；A只读复核确认两段隔离语义分别保留。该测试修订仍待最终同SHA门禁。

### R2 Review：R4终局归档触发顺序

用户确认R1–R3复验通过并关闭；CI48全绿未覆盖本轮R4，不等于最终用户验收通过。隔离aa606645的真实IDB事务回归在45.522s复现：A导入tick79后revision4，tick80战中写入被保持在途，正常推进至tick117终局且pending1；旧写入成功revision5即提前刷新/占savedArchiveRun，终局写入revision6成功后无第二刷新。两笔与所有刷新settle后数据库C,D,A与终局存档正确，但UI120战和validation错误“找不到已完成对局”。原始失败及完整事务顺序证据保留于仓库外work/m6-r4-baseline-evidence，不宣称自然发生频率或丢档。

A/C最小修复给SaveCoordinator成功状态回调提供本次in-flight固定快照的只读阶段元信息，await commit前冻结；保存失败或未完成不提供成功元信息。application只以committed.phase===gameOver触发归档并设置已刷新标记，不再用live session.phase。保存格式/SaveStatus/SlotToken契约和所有R3请求、Session、runId、epoch栅栏保持原样。B/D只读复核无阻断。38项协调器单测及TypeScript/构建通过；新增真实事务门禁仍待当前干净提交与完整CI。

E新增R4必需回归：严格revision4→5→6、旧战中commit刷新0/标记未占、终局commit唯一刷新1；两native事务与全部异步刷新实际结束后完整终局Match/账本/存档相同、DB与UI仅C,D,A90战、B消失，实际保存控件成功且无failed回调。原8组及R1–R3门禁不删不放宽，比较器强制新字段。P3施法英雄中文及README文档仍待该P2定向回归通过后收尾，均在冻结Goal现有范围。暂不进入M7。

R4本地正式应用九组在clean9848c909d2faf316bb10818322f56034c8365575通过（192.013s，errors=[]），精确tick80→117、revision4→5→6，旧commit刷新0且标记未占，终局commit唯一刷新1；全部事务/异步完成后DB/UI仅C,D,A90，完整终局快照与账本相等、failed回调为空、真实控件最近保存成功。该中间提交证据不替代最终SHA全套门禁。

在P2定向回归通过后收尾用户指出两项P3：BoardScene施法飘字仅改为已有displayUnitName中文英雄映射，未改领域事件或其他反馈；README同步真实M6控件、保存成功语义、三档案、回放/统计、冻结Goal及合同与专项验证入口，保留M5规则/历史和非目标，不增加玩法或声称已最终用户验收。所有相对文档/脚本链接已核验存在。最终同提交CI及同F1性能重测仍须完成。
