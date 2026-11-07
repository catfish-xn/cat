# 任务 2：异变 UI 收尾

基准：`claude/v26-anomaly-ui` @ `cd507207`。分支：`cursor/anomaly-ui`。未开 PR，未强推。

## 合入说明

远程没有 `cursor/anomaly-rules`（任务 1 仍在另一个代理上进行）。本分支先合并 `origin/claude/v26-anomaly-r1r3r4` @ `d07724e6`（合并提交 `db615f4c`）。规则、私有投影 `anomalyTargetIds` 和房间禁售以该分支为准，合同见 `docs/V26_ANOMALY_R1_R3_R4A.md`。

**待任务 1 完成后补合 `cursor/anomaly-rules`。** 若该分支改了资格或投影字段，目标按钮只读投影，不在界面重算；合入后复跑下面的界面测试即可。

## 改动

| 位置 | 内容 |
| --- | --- |
| `src/rendering/online/seat-view-adapter.ts:34-49` | `DisplayMatch.anomalyTargetIds`；`readProjectedAnomalyTargetIds`。有该字段时（含空数组）只认服务器名单；没有该字段才是离线完整状态。 |
| `src/rendering/strategy-panel.ts:13,19,21,92-100` | 目标单位取投影，离线回退 `readAnomalyTargetIds`（与投影同一公共查询）。不把全部己方单位列出来。 |
| `src/rendering/strategy-panel.ts:1067-1068,1107` | 目标步按钮只渲染这份名单，顺序与投影一致。名单变化计入 choice token，购买新增合格单位后按钮会刷新。 |
| `tests/presentation/v23-anomaly-panel.test.ts:245-267` | 锻造器、未知定义、敌方不出现；训练假人按手动资格保留；颠倒花名册后按钮仍按 `anomalyTargetIds`；新增单位后名单刷新。 |
| `tests/presentation/v26-anomaly-board-input.test.ts:89,125-140` | 见下方断言替换。 |
| `tests/presentation/v26-anomaly-hidden-move.test.ts:1-205` | 联机房间与本地房间，2D 拖拽与 3D `boardControls`：界面打开时不发部署；隐藏后部署被服务器接受；备战席出售手势不发命令并提示；同一备战席单位的 `sell` 被服务器以 `wrong-phase` 拒绝，房间 state 引用不变。 |

未改 `src/server` 的时钟。未把新界面拆成懒加载 chunk：改动是已经进主包的几行，生产顶层 `dist/assets/*.js` gzip-9 = **634,357**（上限 637,144，余量 2,787）。`tests/rendering3d-isolation.test.ts` 的内存构建断言也通过。3D 代码没有进 2D 入口。没有提交素材。

## 被新规则替换的断言

`tests/presentation/v26-anomaly-board-input.test.ts` 单机隐藏后的部署：

- 旧：`deploy` 返回 `wrong-phase`（合入前的领域策略）。
- 现：`deploy` 为 `ok: true`，单位落到 `{col:1,row:4}`，阶段仍是 `choice`（界面没有改权威阶段）；随后 `sell('bench')` 返回 `wrong-phase`、没有 `events`、返回的 state 与当前 state 是同一引用。出售拒绝比旧断言更严，部署改为新规则下的真实成功。

其余异变界面断言没有删除或放宽。

## 测试

`npx vitest run --project fast --maxWorkers=4`，未加 `--write`，未改超时：

- `tests/presentation/v23-anomaly-panel.test.ts`
- `tests/presentation/v26-anomaly-board-input.test.ts`
- `tests/presentation/v26-anomaly-command.test.ts`
- `tests/presentation/v26-anomaly-display.test.ts`
- `tests/presentation/v26-anomaly-transport.test.ts`
- `tests/presentation/v26-anomaly-hidden-move.test.ts`
- `tests/server/v26-anomaly-preparation.test.ts`
- `tests/v26-anomaly-choice.test.ts`
- `tests/rendering3d-isolation.test.ts`

9 个文件、99 项通过。`npx tsc --noEmit` 通过。未跑全量纪元套件，也没有重录。

## 未完成与执行端待办

- 任务 1 分支 `cursor/anomaly-rules` 出现后补合，并复跑本节测试。
- 纪元 / 内容摘要统一重录仍按 `docs/V26_ANOMALY_MERGE_TEST_RESULTS.md` 与 `docs/V26_ANOMALY_R1_R3_R4A.md` 的清单，由执行端处理。不要 `--write` 覆盖已发布 v25 证据。
- 素材下载、提取、上传测试服（ssh tencent）和测试服部署：未做。
- 浏览器 / GPU 实机验收（codex-browser）：按本任务要求未做。隐藏后的移动与备战席禁售只在 Vitest 里走到真实房间和本地房间。
