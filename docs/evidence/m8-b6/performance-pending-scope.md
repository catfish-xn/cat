# 性能准备依赖：待用户决定，尚未实施

本稿是一次性完整范围说明，不授权修改，也不构成性能通过证据。截止检查点五，`verify-m6-performance.cjs`、`verify-m6-full-load-helper.cjs`及`compare-m6-evidence.cjs`性能分组均未修改。应用分组的既有B8/B9 skip透明消费不属于本稿待决内容。

## 固定事实

- 现完整领域路线33战，而完整应用导入路径仍限制30战；complete/current/fullLoad的`validateFile(..., validateBattleCollection)`可能直接在此失败。
- full-load第五路线仍必须用真实命令生成并参与最大complete/incremental/单战payload选择；缺B8导致15装备输入不可达，不能补装备、去掉第五路线或改轻夹具。
- helper旧源码策略锚点18/28对应原4-4/5-7，后续只可迁到同roundId，不改加garen/9级目标/逐库存装备策略。
- 原activation共12个真样本，确切执行顺序为complete第1次（`activate(null)`冷DB）、current1次、complete第2/3次、fullLoad8次；计时仅包围repository.activate。不能额外先做一次未计时activate或额外预热后再“补到12”。
- 即使保留上述12个计时callback，去掉前面的完整验证/候选构建也会改变预热、对象图和GC压力。因此替代准备不能冒称原activation门禁通过。

## 建议的精确待办清单

| 原项 | 归属/原因 | 建议状态；原代码保留与恢复条件 |
| --- | --- | --- |
| full-load 9玩家/8敌/15装备覆盖断言 | B8，真实装备链缺失 | 显式skipped，记录实际负载；原15不改。B8接入后恢复最大装备覆盖。 |
| completeImport，3次 | B9，33战完整格式/历史验证不能通过 | 原完整测量callback与30000ms门槛保留，skipped；不造0ms、不返回passed:true。 |
| activation，12次 | B9，原完整导入准备不可执行 | 原payload/顺序/null-token/计时/阈值保留，skipped。若另获准storage-only诊断，另列数据、preconditionChanged=true，不计入该门禁。 |
| capture、write，各12次 | B9，依赖current通过原验证后进入repository/coordinator | 同上。若替代前置被批准，只能明确storage-only诊断；原门禁待B9。 |
| current-prefix格式验证 | B9，仅当实际completed+current超过30 | 只在真实超限时skipped；容量内必须执行原validateFile；不得泛化全跳。 |
| fullLoadRoundTrip及其预算 | B9（最大装备覆盖另归B8），完整导入不可达 | 原callback/完整对象比较/预算保留，skipped；不得返回verified:true或虚构毫秒。 |

## 可独立继续的原测量

保持原计时callback、样本数、统计公式和阈值：fullCapture×12；单战firstSeek×3/cachedSeek×12；原每40tick增量stats与整批结果比较；生命周期原3次预热+30轮、GC/监听器/DOM门槛。这些只证明当前实际领域payload的相应模块表现，不能补充证明被B8阻塞的15装备最大负载或B9完整应用导入。

## 聚合器必须透明对应

`compare-m6-evidence.cjs`当前要求8个测量项都有真实samples、sample-derived actual、passed:true，以及fullLoadRoundTrip.verified=true。若用户批准上述拆分，只对精确的capture/write/activation/completeImport及fullLoad覆盖/导入项保留原检查callback并消费显式skipped元数据；其余4个统计项和生命周期继续原样硬门禁。未知pending、缺真实非跳过样本、额外skip、伪造0ms/passed:true必须失败。CI配置、数值阈值和统计公式一律不改。

## 决策边界

建议先批准上述最窄显式pending拆分；若需要storage-only诊断，再单独明确它是补充观测、不是替代原性能门禁。未经用户明确回复，不修改相关性能实现或聚合分组。
