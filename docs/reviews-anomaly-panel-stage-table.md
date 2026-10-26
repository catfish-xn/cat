【完成】分支 codex/anomaly-panel-stage-table-tests，HEAD da2bedb5；仅新增两个指定测试文件，未提交、未修改现有文件。
【完成】tests/presentation/v23-anomaly-panel.test.ts：12 项，覆盖目标与报价步骤、己方棋盘/备战席、中文说明、回调令牌、1 金币刷新、零金币确认、过期选择、超时自动选定/空目标跳过、淘汰关闭及私有投影。
【完成】tests/presentation/v23-augment-stage-table.test.ts：68 项，逐行核对客户端全部 27 个组合（18 个非零、9 个零权重）、整数权重/109、概率、中文等级，以及规则目录全部 38 回合的阶段条。
【完成】客户端依据为 /home/aiapps/workspace/augments-research-2026-10-23/data/odds-all27.csv；完整内嵌快照已逐行比对一致（仅规范化换行），保留源文件 SHA-256，CI 不依赖外部研究目录。
【完成】真实 Room + ManualClock 验证 2-1、3-2、4-2 共用 50000 ms 准备期；公开倒计时与私有选择同步，30000/49999 ms 不关闭、50000 ms 自动选择首项，且不进入独立 choice 房间阶段。
【完成】定向命令：export PATH=$HOME/.local/bin:$PATH；npm test -- --configLoader runner tests/presentation/v23-anomaly-panel.test.ts tests/presentation/v23-augment-stage-table.test.ts；结果 79 通过、1 预期失败，共 80 项。未运行全量测试。
【完成】npm run typecheck 通过；configLoader runner 用于避开只读 node_modules/.vite-temp 的配置打包写入。
【未完成】已发现的 UI 缺陷未修复，遵守本任务禁止修改 src/ 的限制。
【需要我决定】无。
【风险】精确缺陷：src/rendering/strategy-panel.ts:989–990 仅以 choiceId:generation:step 缓存弹窗；联机异变报价打开后，购买使余额从 1 降到 0、选择令牌不变时，余额文字仍显示 1，1062 行创建的刷新按钮仍启用。服务端仍拒绝刷新并返回 insufficient-gold；这是展示状态过期。
【风险】上述缺陷由 v23-anomaly-panel.test.ts:136 的唯一 it.fails 记录；临时改为普通测试已确认在 disabled 应为 true、实际为 false 处失败。DOM 记录器调用真实 renderChoice/button 与投影适配器，不覆盖浏览器布局或视觉效果。
【下一步】由 Claude 修复异变弹窗对同代金币变化的更新，再将该 it.fails 改为普通 it 并重跑这两个文件。
