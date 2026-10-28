# V25 显示动态值按需加载

工作区基线：`claude/v25-dynamic-lazy @ 686f3086`（包含 `97068956`），没有执行 Git 写操作。
环境：Node 22.23.4、Vite 7.3.6。没有修改规则、数值、内容身份、录制夹具或预算门槛。

## 根因与修改

客户端有两条静态依赖把显示动态值投影拉进入口：

1. `src/rendering/strategy-panel.ts:40` 原先为单机显示直接导入 `augmentDynamicValues`。联机实际使用服务器私有视图中的同名字段。
2. `src/presentation/d14-display.ts:6` 原先为单机 D14 提示导入整个 `toPrivateSeatView`，后者也会计算动态值。

现在 `src/presentation/augment-text-loader.ts:34` 同时按需导入强化文本与原有动态值投影；加载完成后沿用原有通知、缓存、去重和失败重试机制。`strategy-panel.ts:556` 联机仍直接读取私有视图，单机通过已加载模块计算；说明尚未加载时使用原有加载提示，完成后重绘。

为保留 isolation 中“UI 文本包只能包含 presentation 模块、不能静态导入领域或入口”的原断言，没有将领域依赖强塞进纯文本包。`vite.config.ts:72` 将配套计算 chunk 放入 `assets/solo/augment-dynamic-values-*.js`，与 `assets/ui/augment-text-*.js` 由同一次 `loadAugmentText()` 请求一起加载。该计算仅供客户端单机显示调用；在线显示读取服务器结果。

`src/simulation/private-seat-display.ts:9` 抽出原有 preparation/item/D14 显示选择器，供 `private-seat-view.ts:21` 与 `presentation/d14-display.ts:6` 共用。已用脚本逐字核对：去掉新增的 export 后，抽出的全部函数体与原文件一致。

服务器的 `private-seat-view` 仍静态导入原有同步 `augmentDynamicValues`。h4 `portfolioRoundGold`、h7 `lunchMoneyDamage`、h8 `forwardThinkingReceiptId`、s8b `gloriousEvolutionProgress` 等实现没有改动或复制，显示与结算继续共用。

## 生产构建与 moduleIds

沿用 `scripts/m7-budget.cjs` 算法：顶层 `assets/*.js` 逐文件 `gzipSync(bytes, { level: 9 })` 求和，不使用 Vite 控制台默认 gzip 数字。

| 项目 | 改动前 | 改动后 |
| --- | ---: | ---: |
| index gzip-9 | 509,509 | 506,553 |
| Phaser gzip-9 | 125,978 | 125,978 |
| 2D 顶层合计 | 635,487 | **632,531** |

净减少 **2,956 字节**，较 637,144 上限余 **4,613 字节**；相对固定签收 M7 基线 424,763 为 **1.489138649 ≤ 1.50**。本地基线比任务描述快照少 10 字节，以本工作区同工具链前后构建为准。

Rollup `OutputChunk.moduleIds` 检查结果：

- 改动前 index 同时包含 `augment-dynamic-values.ts`、`private-seat-view.ts` 及 h4/h7/h8/s8b 模块。
- 改动后入口及全部静态可达 chunk 均不含 `augment-dynamic-values.ts`、`private-seat-view.ts` 或 `restore-checks/`。
- 投影模块只出现在动态可达的 `assets/solo/augment-dynamic-values-YMjYKp1X.js`，gzip-9 为 2,182 字节；共用结算模块仍留在入口。
- 原 augment-text、tooltip-text、Phaser 和 3D chunk 内容/hash 未变。没有将 2D 计算归入 3D。
- 完整前后 moduleIds、静态/动态边与 gzip-9 记录在忽略提交的 `artifacts/v25-dynamic-lazy/{before,after}.json`。

原 isolation 断言全部保留，并新增入口不得包含上述两个模块及投影确实按需输出的断言。loader 测试新增函数引用一致性断言。

## 验证

所有 Vitest 命令使用 `--configLoader runner --maxWorkers=3`，补跑增加 `--no-file-parallelism`，没有修改任何超时。

- 指定动态值、说明覆盖、h4/h7/h8/s8b、loader、rendering3d-isolation、rendering3d-budget 等首轮 22 文件：406 项通过，h8-room round 17 一项触及原有 5 秒超时（当时另有构建并行）。
- 单独文件顺序复跑 h8-room，并补验 D14 显示、价格、公开标记、私有视图和服务器 projection：6 文件通过；另加的 projection-wire 因沙盒禁止监听 `127.0.0.1` 而失败（`listen EPERM`，2 failed、1 skipped）。这轮合计 64 passed。
- 再次顺序执行 D14 wiring、rendering3d-isolation、rendering3d-budget：3 文件、54 项全部通过。
- `npm run typecheck`、生产 Vite build、`git diff --check` 通过。

额外运行 `npm run test:server-entry` 时，现有 `src/simulation/combat-replay-view.ts:18` 导入 `src/presentation/combat-status.ts`，触发 `scripts/build-server.cjs:18` 的既有目录边界检查。用 HEAD 原版 `private-seat-view.ts` 替换本次修改重新构建，也得到完全相同的违规输入；本次未修改这些文件。

未运行 M7 首交互浏览器实测：本会话没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，按 AGENTS.md 不自行启动 Chromium。执行端需要 Claude 使用 `codex-browser exec` 新启动浏览器测试任务，复用桥接浏览器完成首交互预算及可选 wire 测试；静态 JS 预算已按原口径通过。

## src 修改清单

- `src/presentation/augment-text-loader.ts`
- `src/presentation/d14-display.ts`
- `src/rendering/strategy-panel.ts`
- `src/simulation/private-seat-view.ts`
- `src/simulation/private-seat-display.ts`（新增）

另修改 `vite.config.ts`、两个测试文件及本文档；未修改 `src/server/`。
