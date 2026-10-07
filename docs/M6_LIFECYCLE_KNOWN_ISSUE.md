# M6-MEM-01：生命周期测量中的持续保留

记录日期：2026-10-07。状态：**M6 已有问题；用户已授权在 `feat/m8-b0-baseline` 单独修复，修复实现与验证进行中。** B3 第二批已于 `eb9c03c` 通过复审签收，R5 独立跟踪、不阻塞该签收；历史 CI 失败保留，不授权合并分支。

此前“仅定位、等待 M7 合并后再修复”的阶段限制按历史保留；本次用户明确要求基于当前 `feat/m8-b0-baseline` 修复，并允许为释放对象做最小范围修改。调查分支 `codex/m6-lifecycle-retention@fcf9199` 仅用作定位依据，不合并该旧 M6 分支；不修改冻结合同、B3 战斗机制代码、视觉、布局、操作流程、原内存门禁或测试路径。


## 本次独立修复（2026-10-07）

撤销记录的所有者是跨局复用的 seed 文本输入。真实浏览器中填写五次同值产生5个UndoStep，移除旧编辑宿主后为0。`SaveControls.releaseRunResources()` 仅在 `MatchApplication.install()` 成功接管新局/导入/继续存档后更新输入宿主，保留值、属性、焦点、选择范围和方向；普通刷新、取消或失败不更换宿主，当前局内Ctrl+Z仍可用。销毁控件时原宿主也移除，释放对应撤销/重做记录；不调用全局清空撤销栈或更改原测试输入。

媒体查询链已进一步缩小到Chromium的[UA表头分页规则](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/html/resources/html.css)：`thead`的`break-inside: if(media(overflow-block: paged): avoid;)`在重算时产生新查询；[StyleEngine](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/css/style_engine.cc)的functional媒体结果表强引用这些查询。独立表格隐藏/显示30次，MediaQueryFeatureExpNode从1到31；新回归在真实StatsPanel中从11到41，复现旧问题。

StatsPanel以一份面板持有的MediaQueryList保持同一分页语义：屏幕为auto、分页打印为avoid，监听媒体变化，销毁时解除监听。这避免每次重算生成留在文档缓存中的新查询，而不改变最终显示/分页规则。真实回归30次重算为11→11；销毁后MediaQueryList1→0、查询节点11→10。独立最小对照中对应查询最终为0；不是通过改变媒体环境或清空全页缓存掩盖增长。

`tests/m6-retention-browser.cjs` 在实现前分别因缺少交接释放和媒体节点41≠11失败，实现后两项通过；同时核对字段值/属性/焦点/选择、固定种子回调读取新宿主、同局撤销和销毁、屏幕/打印语义。typecheck通过，相关5文件/72测试通过；构建96模块、6.88秒通过，保留既有chunk提示。原完整preview生命周期的独立快照诊断已完成：2预热/30组合循环，UndoStep0→0、MediaQueryFeatureExpNode9→9、MediaQueryList1→1，源码指纹前后一致；原脚本退出0（该诊断增长524,072B，快照扰动测量，不计入六次正式测量）。接着在干净修复提交上运行同机dev/preview各3次原生命周期验收（2预热/30循环、无快照/额外预热），最后在精确最终SHA上顺序触发两次完整CI，逐次等待全部作业结束。正式脚本、阈值、路径与冻结合同保持原样；后续结果绑定验证记录，不用诊断快照代替门禁。

## 出现在哪个版本

第三轮预热实验 [37499113340](https://github.com/catfish-xn/cat/actions/runs/37499113340) 的失败项是 **M6 main `a8be9fc151b9ebb895eb4097828bb74c590e2559` / preview**。同轮 M7 dev、preview 均通过；三轮中 M7 共六项均通过。完整原始数据见 [M7_WARMUP_VALIDATION](M7_WARMUP_VALIDATION.md)。

M6 预热 12 次后的三个 30 次窗口分别增加 121,980 / 32,080 / 166,592 B，90 次合计 **320,652 B（313.1 KiB）**。失败原因是实验额外设置的“三个窗口连续正增长”断言；**三个窗口都没有超过冻结的 1MiB 上限**。所有三轮共 36 个窗口也均未超 1MiB。资源探针保持 listeners=80、RAF=1，application/session/observer 各 1。

这证明持续增长现象在 M7 之前的基线已经存在，不能定性为 M7 新引入。有限样本不能证明两分支不存在其他泄漏，也不能仅凭三段正增量判定具体应用对象泄漏。保留原失败，继续按潜在真实泄漏定位。

## 独立跟踪

从 main `a8be9fc` 建立调查分支 [codex/m6-lifecycle-retention](https://github.com/catfish-xn/cat/tree/codex/m6-lifecycle-retention)。诊断脚本、分操作对照和后续定位在该分支维护，与 M7 的规则、UI、交互及验收驱动分开。

前次完整生命周期堆快照已确认旧 MatchSession / BattleHistory / SaveCoordinator 实例被释放，但发现两条持续保留链：

- `LocalFrame → Editor → UndoStack → UndoStep`，90 次增加 90 个。
- `HTMLDocument → StyleEngine → media-query cache → MediaQueryFeatureExpNode`，90 次增加 450 个。

本次在 M6 生产构建上做独立输入对照：不新开局、不导入、不回放，只反复执行原驱动的 `seed.fill('42')`。12 次预热后，再执行三个 30 次窗口，UndoStep 为 **13 → 43 → 73 → 103**；只填写一次、随后只读取输入值的对照为 **1 → 1 → 1 → 1**。游戏状态始终不变。仅查询回放按钮的对照同样没有 UndoStep 增长。

这已证明反复填写同样的种子足以产生测试中观察到的撤销历史增长，无须发生应用生命周期切换。三组输入探针的 MediaQueryFeatureExpNode 都保持 4，故不能用填写种子解释另一条媒体查询缓存保留链。快照诊断会扰动 GC，不能用其 self-size 直接扣减正式 JS `usedSize`，也没有因此修改正式测试输入或预算。

后续分操作探针已完成：仅导入、仅进出回放各 90 次，MediaQueryFeatureExpNode 都从 30 → 90 → 150 → 210，即每次 +2；UndoStep 均保持 1。仅点击固定种子新局并选择，媒体查询节点保持 7、UndoStep 保持 1。完全不加载游戏、只切换原生控件 disabled/hidden 的对照未重现，页面主世界的 matchMedia 追踪也没有观察到调用。因此缓存的淘汰条件和完整触发机制仍待定位；详见独立分支的 [诊断记录](https://github.com/catfish-xn/cat/blob/codex/m6-lifecycle-retention/docs/M6_RETENTION_INVESTIGATION.md) 与机器摘要。

## 实际玩家影响

包含 Claude `b252c34` 的 M7 `77600c8` 在 [最新完整 CI](https://github.com/catfish-xn/cat/actions/runs/37540777240) 中，正式生命周期样本（原 2 次预热、30 次测量）dev 增长 **56,668 B**，preview 增长 **1,032,868 B**，都通过 1MiB。preview 距上限仅 **15,708 B（约 15.3 KiB / 1.50%）**，因此仍有后续波动导致门禁失败的风险，不能宣称测量已稳定。两组监听器分别保持 83 / 82，RAF 保持 1。这个短窗口与预热实验口径不同，不用它直接推算每局持续泄漏量。

当前没有“连续玩 N 局必然变卡”的证据：测试的一次循环是新局、填写种子、选择、导入、进出回放的组合，**不等于玩家完成一整局**；没有同步测得帧时间或输入延迟随增长恶化。

仅作量级估算，若将失败 M6 样本的 90 次净增线性外推：平均约 **3.48 KiB/测试循环**，100 次约 **0.34 MiB**，1,000 次约 **3.40 MiB**。这既不是长期增长上限，也不是卡顿阈值；其他样本存在回落，实际使用也未必反复编辑种子和导入。现有证据不足以认为玩几局或几十局就会因这项小幅增长明显变卡，但还不能排除长时间会话、移动设备或其他分配来源的风险。

后续需在独立分支延长真实操作会话，同时记录 GC 后堆、浏览器原生对象、帧时间与长任务，确认增长是否收敛及是否实际影响操作。现阶段不提高 1MiB，不推广 12 次预热为正式门禁，不通过清空浏览器撤销历史等交互变更掩盖问题。
