# H1 原始快照保留路径分析（诊断，未签收）

## 输入与方法

- 证据固定提交 `e0bcc67a36b0bc3d4e5c7eff47ee07d338da4cce`，运行代码 `97f38a0e787a4edcb35df4a59823bb1d106def67`。
- 输入为 `docs/evidence/h1-claude-runs/snapshot-1/{before,after}.heapsnapshot.gz`；Chromium 141.0.7390.37，CI 为 153.0.8010.12。只有一个 30 循环窗口，且快照采集会扰动测量。
- `scripts/diagnostics/analyze-h1-retention.py` 仅使用 Python 标准库，解析快照 metadata，而非依赖固定 V8 版本类型编号。执行：`python analyze.py before.heapsnapshot.gz after.heapsnapshot.gz retention-evidence.json`。第三参数指定输出路径；省略时写入脚本同目录 `retention-evidence.json`，stdout 是可读摘要。
- 从 synthetic root 做广度优先搜索，排除 weak 边及 `part of key -> value pair in ephemeron table` 条件边。保留并明确标注 root shortcut 边；它是快照根别名，不代表应用属性。输出是一条非弱最短可达路径，**不是支配树、独占所有权或 retained-size 测算**。
- after 共259,473节点，259,184可从上述图到达，289不可到达，排除71,967条weak边。不可达不等于泄漏或垃圾，可能涉及被保守剔除的条件边/特殊根语义。
- 节点ID跨快照有110例同ID标签不同，详见 JSON `id_label_changes`。例如306483由Object变成FeedbackVector，10824由InternalNode变成DOMRectReadOnly。只记录观察，不推断其产生原因。ID交集不能普遍证明对象存活；`same_id_same_label`也只是条件性身份匹配。`new_ids`表示after ID不在before集合，不把它绝对解释成新分配对象。类型汇总self_size净变化不依赖该身份假设。

## 发现1：性能条目及DOMRect有具体浏览器性能对象保留链

最短代表链（边类型和全部ID见机器证据）：

`root#1 → (GC roots)#3 → (Global handles)#23 → internal "2 / DevTools console" → UtilityScript#7067 → property builtins → Object#99505 → property performance → Performance#43457`

从Performance再分流：

- element 13 → InternalNode#15264 → element59 → PerformanceLongAnimationFrameTiming#15266。
- element11 → InternalNode#17594 → element117 → PerformanceLongTaskTiming#16510。
- element9 → InternalNode#16430 → element143 → LayoutShift#16090 → element1 → LayoutShiftAttribution#16092。
- DOMRect样本#17866：Performance→element9→InternalNode#16430→element116→LayoutShift#16468→element5→LayoutShiftAttribution#17864→element1→DOMRectReadOnly#17866。

性能对象另有普通Window路径：

`root shortcut3 → Window#7099 → property globalThis → Window#46909 → element29 → InternalNode#10160 → element1 → InternalNode#6726 → element1 → Performance#43457`。

还存在 InjectedScript#7073→utils#99477→builtins#136055→performance 路径。因此最短路径经过UtilityScript/DevTools，并不能证明它独占保留这些对象，也不能证明禁用Playwright就消失。当前可支持的结论是：这些样本经浏览器Performance及native条目容器可达，DOMRect由布局偏移归因条目可达，不是仅由构造器名推断。原始native边是数字element，容器没有公开属性名；不擅自把它改名为某个具体Blink字段。

量化：LongAnimationFrameTiming 58→200，LongTaskTiming及TaskAttributionTiming54→200，LayoutShift91→150，LayoutShiftAttribution145→354，DOMRectReadOnly290→708。窗口末200/150等值不证明达到固定缓冲上限，更不证明后续平台期；需连续窗口验证。

## 发现2：代码类型增长最大，但有应用与测试工具两类路径

所有 `type=code` 的净self_size增加878,904B；总快照self_size增加1,070,504B。约82.1%的净增量落在code类型。该统计包括负增量，不是只累加正项；与Runtime.getHeapUsage的739,288B不同口径，不能直接拆解门禁heapDelta。

具体样本：

- 空名code#634957（704B）：Global handles→DevTools console→UtilityScript#7067→prototype#99507→jsonValue#226363→internal code#499907→instruction_stream→该节点。可关联到测试工具代码路径。
- ProtectedFixedArray#636333（68B）：Window→__CAT_DEBUG__→read→Context→this（scene#98771）→strategyPanel#98981→actions#226585→selectedUnit#226941→code#517881→deoptimization_data→该节点。可关联到应用函数代码路径。
- FeedbackVector#494171：Window→__CAT_DEBUG__→read→context→previous→context Cr→feedback_cell→value FeedbackVector#530389→ClosureFeedbackCellArray→FeedbackCell→value#494171。
- BASELINE instruction stream#495175 经应用闭包Nl/shared-function/code链可达，具体所有边保存在JSON。

这支持“编译代码/反馈数据是该窗口显著增量来源”，不证明预热增加多少次就能解决、不证明无真实泄漏，也不支持把全部JIT增量归因给Playwright。

## 发现3：可观察的应用会话是替换而非多份累计，但覆盖有限

- scene样本（minified constructor `id`）两快照均1个，ID98771；其session从`ii#98967`切为`ii#500207`；该constructor两快照均1个。
- session→combatLedger：before Array#426657，after Array#500211。after由当前scene.session强路径到达，不把新的数组自动判定为旧战斗历史泄漏。
- 所有普通Object为18,535→18,564（净+29），Array为4,188→4,204（净+16）；绝大多数对象ID发生替换。不能从新增对象数量直接断言累计泄漏。
- 仅以名称及明确属性链识别此样本，不能据此证明所有应用对象、撤销栈、监听器和其他类都无泄漏；没有完整dominator分析，也没有连续窗口证明。

## 尚不能回答

不能估计误报率、不能判定持续增长、不能证明B4重触发负载表现、不能替代CI。下一轮应保持同SHA并在同浏览器进程采集连续等长post-GC窗口（先无快照趋势，后单独快照定位），并记录Performance各entryType数量及当前会话/撤销/监听器计数。若比较工具插桩开关，应作为独立诊断实验保留原门禁不变，不能拿更改后的数值替代原门禁。最终仍需CI153版本验证。

## 复现与身份核验

三个manifest的runnerHash、开始/结束sourceFingerprint与固定源码独立计算结果一致；独立生命周期JSON和manifest内报告一致，详见 `docs/evidence/h1-retention/manifest-checks.json`。作者README称退出码均0；该证据提交没有README中提到的run.log，因此我们仅核实manifest中的passed/errors，不声称读取了退出日志。

```bash
git fetch origin diag/h1-claude-runs
mkdir -p /tmp/h1-reproduce
git show e0bcc67a36b0bc3d4e5c7eff47ee07d338da4cce:docs/evidence/h1-claude-runs/snapshot-1/before.heapsnapshot.gz > /tmp/h1-reproduce/before.gz
git show e0bcc67a36b0bc3d4e5c7eff47ee07d338da4cce:docs/evidence/h1-claude-runs/snapshot-1/after.heapsnapshot.gz > /tmp/h1-reproduce/after.gz
python scripts/diagnostics/analyze-h1-retention.py /tmp/h1-reproduce/before.gz /tmp/h1-reproduce/after.gz /tmp/h1-reproduce/retention-evidence.json
cmp /tmp/h1-reproduce/retention-evidence.json docs/evidence/h1-retention/retention-evidence.json
```

离线分析已复跑，机器证据逐字节一致；结果SHA256为 `7e666922da4093d9c7c316e7ed1290dfcfa619607112da11453c7ff959f463fd`。这验证解析可复现，不是浏览器测试或独立审计签收。现有门禁、测试预期、CI、运行代码均未修改。

## 下一步与状态

补测的可执行包装和分组说明见 [H1_FOLLOWUP_RUNS.md](H1_FOLLOWUP_RUNS.md)：先追加8次原参数正常组，以及独立的3次历史预热实验连续窗口组。新旧预热组不可混算。误报率、现行参数连续趋势、dev、B4重触发负载和CI153验证仍未完成；H1尚未签收，完整诊断报告后续再送新的独立Pro审计对话。
