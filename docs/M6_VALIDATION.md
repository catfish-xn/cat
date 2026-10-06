# M6 验证记录

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
