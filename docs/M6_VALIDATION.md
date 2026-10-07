# M6 验证记录

> 2026-10-07 状态索引：下文保留 M6 当时的中间验证与失败记录；最终技术复验见 [M6 最终复验](M6_FINAL_REVIEW.md)。M6（PR #7）和 M7（PR #8）均已合入 main；M7 最新状态及独立 M6 内存问题见 [M7_STATUS.md](M7_STATUS.md)，不要把下文历史“暂不进入 M7”当作当前任务指令。

状态：W3/F3修复与独立验证进行中，尚未最终F4同提交验收。F1冻结提交为 `d78be2a`；F1原型数值与限制见 `docs/evidence/M6_F1_LOAD.md`、`M6_F1_STORAGE.md`、`M6_F1_LAYOUT.md`。最终G09门禁必须在同一干净提交执行，当前局部结果不能替代最终结果。

## 独立预期

`tests/m6-stats-oracle.test.ts` 由E编写，预期全为手写整数，不调用生产聚合器生成：475分担238/237与100/200护盾得到175HP伤害、300吸收；100请求治疗/30缺血得到30有效、70过量；同tick多段伤害、过量伤害、多个盾层、死亡/出售来源、增量游标和seek前缀。已运行通过6项。另 `tests/m6-integration.test.ts` 四路线每条30战完整状态/事件重演、39/40/41恢复、历史出售英雄、漏战拒绝及时间隔离通过，共10项独立集成/数字测试通过（277.48s，与另一全套测试并行，非性能数值）。

## 原生存储集成

`node scripts/verify-m6-storage.cjs` 在独立命名的真实Chromium IndexedDB测试库调用生产repository/format；直接模块测试，不声称覆盖公开UI路径。W2首轮真实执行24项检查通过，W3扩展到33项通过（脏树局部证据，非最终门禁）。覆盖JSON/版本/schema/digest/runtime边界、裸M5拒绝、导出往返、超限文件先拒绝、双连接并发CAS、同runId重新激活epoch、旧run写、原生事务abort、同步QuotaExceededError与失败后导出。证据写入 `artifacts/m6-storage/manifest.json`，包含SHA、dirty和sourceFingerprint。

扩展33项包含真实30战完成局的第四局归档abort保留原三档、成功后精确淘汰最旧档、保留局完整包装不变，以及不可变历史记录覆盖拒绝/事务回滚。领域集成已单独覆盖漏整战/漏事件段/错误初态与Playback隔离。

## 浏览器门禁适配

已有 `scripts/verify-m5-browser.cjs` 与 `scripts/verify-m5-input.cjs` 启动及重开改为通过公开 `m6-seed-input` 填入42，点击 `m6-fixed-start`，等待active模式和新runId。未完局替换接受原生确认。原有golden、完整Match/事件、正常战斗时钟、真实输入断言保留。新版布局消除旧sticky-shop遮挡tab前提，原生门禁明确记录非sticky几何后验证实际目标命中与完整状态不变；没有强造遮挡或删除choice/dismissal原有真实遮挡用例。主控修复滚动后hover坐标后，完整77项原生输入dev通过237.856s，开始/结束sourceFingerprint一致（脏树局部证据，见 `artifacts/m6-input-dev/manifest.json`）。F2短回路 `scripts/verify-m6-flow.cjs` 在dev首次通过：正常前两战、第三战tick55导出/刷新继续/同runId导入新epoch、第三战完整state/events、回看前两战、播放/暂停/End/Home/D-F-E隔离、返回Match/ledger/revision不变，150.558s，证据 `artifacts/m6-f2-dev/manifest.json`；后续增强精确恢复点续算、坏历史UI导入、种子边界/随机复现与完整native日志仍需复跑。`--m6-journey` 可在原完整路线嵌入同样场景后继续30战，供dev/preview炮手CI使用。

## 最终待执行

最终相同干净SHA：typecheck/build、全单元测试、四条命令/逐tick恢复、原有多seed门禁、桌面炮手/狙神/法师dev+preview、正常时间触摸炮手dev+preview、两模式原生输入、M6存档回放和五视口、最后证据比较。不得削弱旧领域预期或靠超时扩张获得通过。实际命令、总时长、版本/digest、seed、环境与限制在执行后补录。

## 已准备的生产专项门禁

`verify-m6-performance.cjs` 从正式命令重新生成四路线和同F1满载路线，不依赖work文件，也不覆写F1证据。capture/write/fullCapture/activation/cachedSeek各12样本，完整import/firstSeek各3样本；预算从src/m6/limits.ts读取；full-load完整校验/候选/IDB往返单独覆盖9玩家+8敌+15装备/30战。模块生命周期30次与完整应用30次分开描述，不能以模块结果替代Phaser应用回收。

F2追加门禁包括独立原路线精确恢复点续算、坏历史UI导入原子性、公开seed边界/随机seed复现、quota失败后回放不重试写、原生输入跨refresh完整累积，以及2次预热后30次公开新局→正常选择→导入真实导出文件→回放/返回循环。GC前将观测器自己的native事件日志转存Node，避免把测量器保留日志当成产品内存增长；仍保存完整可信输入证据。visibility事件的临时hidden getter/合成事件是独立环境故障注入，不混入trusted输入证据，也不宣称真实隐藏标签页验收。以上增强门禁待运行。

A执行并确认真实MatchApplication故障gate退出0：ROOT03同runId旧末战前缀重新完成与归档/ReplayPanel淘汰一致；ROOT04 dispose后IDB/File.text异步失败无旧UI回调及候选泄漏，共4cases、48.956s、pageerror0。此为当前脏树局部结果，最终CI同SHA尚未执行。

## 生产性能专项局部结果（所有权优化后）

首次生产路径实测 capture p95 为74.10ms，超过已冻结50ms；其余7项预算通过。失败原始manifest保留于 `artifacts/m6-performance-pre-optimization/manifest.json`。没有删除样本、放宽阈值或引入同tick缓存。

A 改为模块私有WeakSet仅识别已独立拷贝且递归冻结的捕获，省去Coordinator→Repository重复克隆；外部浅冻结输入仍独立复制。B在接收context/initial/event时独立clone+deepFreeze，捕获仅复制事件数组并复用已冻结子图；每次仍计算完整权威摘要，不缓存同tick结果。不同合法0/40/80tick到结束的所有权/不可变测试以及真实IDB浅冻结输入隔离/反复quota重试通过。

随后同样本、同预算、无并行本地测试的生产复测全部通过，实际164.569s：capture p95 37.80/50ms，write p95 63.70/250ms，fullCapture p95 148/500ms，activation max 285.70/1000ms，完整import max8494.10/30000ms，首次seek max1360.60/2000ms，缓存seek max32.30/100ms，40tick统计批次max0.30/5ms。真实模块30次回收后GC堆增长137,820 bytes，新增监听器0、遗留组件DOM0。合法满载样本9玩家/8敌/15装备、30战完整验证及IDB往返也通过。证据 `artifacts/m6-performance/manifest.json`。

该复测启动于优化尚未提交的591525c脏树，sourceFingerprint首尾一致；它是定位修复的局部历史证据，不能冒称新提交最终门禁。增强F2（精确恢复、quota回放隔离、公开seed相同命令与完整应用30cycle）及最终新SHA CI仍待执行。

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

## Final-candidate 06b4e59 local performance failure (preserved)

The clean final-candidate run at 06b4e59, with source fingerprint 5ee323030b52dcdc717782dc9e271325e8a6b5436dee64a2edbbe7ea0c31a7d7, failed the original 12-sample budgets: capture p95 57.8/50ms; write p95 440.3/250ms (the first write was 440.3ms). The other six gates and the legal full-load roundtrip passed. No sample was removed and the first write remains included. Raw evidence is retained at artifacts/m6-final-local-performance/manifest.json. A subsequent source change must receive complete clean-SHA verification; an earlier green run does not qualify this candidate.


## 用户 P2 Review 回归门禁

原438f35b的全部通过只证明原有覆盖；隔离旧源复现暴露了离窗悬停、同场重入及迟到档案读取的缺口。新增回归已纳入同提交最终CI和comparison，保留原全部断言、预算、正常时间路线及历史失败；不得以旧438f35b结果代替本次修复提交。具体缺陷/owner/独立检查见M6_REVIEW末节。

CI47（clean 6c1522f）新增同场重入回归首次失败，dev/preview均记录revision36→37；真实失败ZIP及digest保留于仓库外work/m6-ci47-failed-preview.zip。查明新用例错误沿用早先quota故障区间基线：第一次从active进入回放按既有设计flush积压保存，因此合法前置写入已完成。原quota区间的完整state/ledger/token与原生IDB等式恢复在该区间结束处，未放宽或删除；新增用例在首次open完成后独立采集基线，再执行返回→同场原生popup重选，严格比较完整state/ledger/token及再次读取的真实IDB版本。生产代码未变；A只读复核确认两段隔离语义分别保留。该测试修订仍待最终同SHA门禁。

### R2 Review：R4终局归档触发顺序

用户确认R1–R3复验通过并关闭；CI48全绿未覆盖本轮R4，不等于最终用户验收通过。隔离aa606645的真实IDB事务回归在45.522s复现：A导入tick79后revision4，tick80战中写入被保持在途，正常推进至tick117终局且pending1；旧写入成功revision5即提前刷新/占savedArchiveRun，终局写入revision6成功后无第二刷新。两笔与所有刷新settle后数据库C,D,A与终局存档正确，但UI120战和validation错误“找不到已完成对局”。原始失败及完整事务顺序证据保留于仓库外work/m6-r4-baseline-evidence，不宣称自然发生频率或丢档。

A/C最小修复给SaveCoordinator成功状态回调提供本次in-flight固定快照的只读阶段元信息，await commit前冻结；保存失败或未完成不提供成功元信息。application只以committed.phase===gameOver触发归档并设置已刷新标记，不再用live session.phase。保存格式/SaveStatus/SlotToken契约和所有R3请求、Session、runId、epoch栅栏保持原样。B/D只读复核无阻断。38项协调器单测及TypeScript/构建通过；新增真实事务门禁仍待当前干净提交与完整CI。

E新增R4必需回归：严格revision4→5→6、旧战中commit刷新0/标记未占、终局commit唯一刷新1；两native事务与全部异步刷新实际结束后完整终局Match/账本/存档相同、DB与UI仅C,D,A90战、B消失，实际保存控件成功且无failed回调。原8组及R1–R3门禁不删不放宽，比较器强制新字段。P3施法英雄中文及README文档仍待该P2定向回归通过后收尾，均在冻结Goal现有范围。暂不进入M7。

R4本地正式应用九组在clean9848c909d2faf316bb10818322f56034c8365575通过（192.013s，errors=[]），精确tick80→117、revision4→5→6，旧commit刷新0且标记未占，终局commit唯一刷新1；全部事务/异步完成后DB/UI仅C,D,A90，完整终局快照与账本相等、failed回调为空、真实控件最近保存成功。该中间提交证据不替代最终SHA全套门禁。

在P2定向回归通过后收尾用户指出两项P3：BoardScene施法飘字仅改为已有displayUnitName中文英雄映射，未改领域事件或其他反馈；README同步真实M6控件、保存成功语义、三档案、回放/统计、冻结Goal及合同与专项验证入口，保留M5规则/历史和非目标，不增加玩法或声称已最终用户验收。所有相对文档/脚本链接已核验存在。最终同提交CI及同F1性能重测仍须完成。
