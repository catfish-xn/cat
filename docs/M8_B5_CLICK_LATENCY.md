# B5 双触延迟对照调查

本文前半记录只读调查；后续用户明确授权仅修改 `verify-m7-presentation.cjs` 的双触输入驱动。400ms 产品防护、全部断言、界面和 CI 配置不变，授权后的改动与验收在文末单列。

## 结论及边界

- **未观察到 B5 使本场景的点击处理或双触间隔稳定变慢。** 基线五次中两次、B5 五次中一次复现原双触断言失败，证明该失败不需要 B5 代码。这个小样本不能证明所有机器和所有装备负载下完全没有性能回归。
- 几百毫秒主要花在第二次 tap 请求到原生 click 派发之间；两版主线程 trace 均显示既有渲染提交的大量等待。不是中间的 40ms 定时器实际睡了几百毫秒，也没有发现预览/装备查询被这个按钮调用。
- B5 确实增加了换轮装备计划，不能说“没有新增计算”：单次采样约 1.1ms，预热隔离测量约 0.008ms/次。它位于第一次同步处理内；产品在处理结束后才启动防护计时。现有证据不支持它是防护结束后数百毫秒输入延迟的来源，因此本轮不凭空改 B5 或跳过校验。
- 原先的 **562.5ms** 仅有事件时刻，没有对应完整 trace，无法事后还原那个单次样本的全部因果。此前从该数字直接归因“驱动额外等待”的结论过早，本报告以多次对照、分段计时和主线程采样取代该推断。
- 原 CI #113 仍为失败；本报告不冒充修复、重跑成功、签收或送审。PR #16 保持 Draft。

## 方法与版本

| 项目 | 固定条件 |
| --- | --- |
| 基线 | `97f38a0e787a4edcb35df4a59823bb1d106def67` |
| B5 | `e10c2541e57797b38bbd62a98b600739a94eb0b7`（领域代码与审计 HEAD 7002998 相同，之后仅交接文档） |
| 浏览器/运行时 | Chromium `153.0.8010.12`，Playwright `1.63.0`，Node `v24.21.0`，同一台 4 vCPU 环境 |
| 构建 | 两份 `git archive` 独立源码、相同 node_modules，分别 `vite build --sourcemap`；无源码插桩 |
| 原脚本 SHA256 | 两版均为 `518ef64aa54a272baed1e8e59cf0d82ac8c60c83ac09ae529461222476b93fda` |
| 主测量顺序 | base/B5、B5/base、base/B5、B5/base、base/B5；每次新 Chromium，失败保留，不重试覆盖 |
| 前置负载 | 原帮助面板检查、normal/reduced 两场真实对局、鼠标双击；保留原页面，再执行原 touch 场景 |
| 输入及断言 | 原 `await touchscreen.tap()` → `await waitForTimeout(40)` → `await touchscreen.tap()`，原后续等待及双触断言均不变 |
| 观察器 | 只读原生事件 capture/bubble、Long Tasks、Node API 时间；没有 DOM click、改状态、改时限或减掉后台页面 |
| 单独采样 | 主测量完成后各一次 CPU Profiler + trace + Long Animation Frames；不混入五次主统计 |

每次完整前置对局的耗时远高于双触本身，普通十次及两次采样约半小时。没有同时运行构建或另一套本任务浏览器测试；机器仍有其他常驻进程，无法宣称宿主负载绝对恒定。交替顺序用于减少顺序偏差，没有人为施加 CPU 节流或关闭其他用户进程。

采集脚本：[diagnose-m8-b5-click-latency.cjs](../scripts/diagnose-m8-b5-click-latency.cjs)。分析脚本：[analyze-m8-b5-click-latency.cjs](../scripts/analyze-m8-b5-click-latency.cjs)。精简机器证据：[M8_B5_CLICK_LATENCY.json](evidence/M8_B5_CLICK_LATENCY.json)，含全部样本、时间分解、调用栈摘要、trace 摘要、原始文件 SHA256 与构建指纹。完整生成物保留在 `artifacts/m8-b5-click-study`，不提交生成物目录。

## 十次主测量

单位 ms。同步处理为第一次 click 的 window capture→bubble；防护在 `strategy-panel.ts:281–285` 的 `actions.control()` 返回后设置，接近第一次 bubble 时刻。因此有效比较是“处理结束→第二次 click”，不是 click 总间隔直接与 400ms 比较。

| 实际顺序 | 版本/样本 | click 总间隔 | 第一次同步处理 | 处理结束→第二次 click | 原断言 |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | base-1 | 317.8 | 58.9 | 258.9 | 通过 |
| 2 | B5-1 | 421.0 | 45.3 | 375.7 | 通过 |
| 3 | B5-2 | 365.7 | 44.8 | 320.9 | 通过 |
| 4 | base-2 | 502.0 | 34.4 | 467.6 | **失败：combat** |
| 5 | base-3 | 472.0 | 46.7 | 425.3 | **失败：combat** |
| 6 | B5-3 | 280.9 | 38.5 | 242.4 | 通过 |
| 7 | B5-4 | 448.7 | 37.5 | 411.2 | **失败：combat** |
| 8 | base-4 | 434.1 | 45.5 | 388.6 | 通过 |
| 9 | base-5 | 313.3 | 45.2 | 268.1 | 通过 |
| 10 | B5-5 | 323.9 | 53.1 | 270.8 | 通过 |

| 指标：min / median / max | 基线 | B5 |
| --- | --- | --- |
| click 总间隔 | 313.3 / 434.1 / 502.0 | 280.9 / 365.7 / 448.7 |
| 第一次同步处理 | 34.4 / 45.5 / 58.9 | 37.5 / 44.8 / 53.1 |
| 处理结束→第二次 click | 258.9 / 388.6 / 467.6 | 242.4 / 320.9 / 411.2 |
| 第一次处理结束→tap API 返回 | 5.0 / 9.8 / 14.2 | 4.4 / 7.0 / 8.6 |
| 原 40ms 等待实际耗时 | 41.1 / 41.6 / 44.2 | 41.1 / 41.2 / 44.1 |
| 第二次 tap API 发起→第二次 click | 207.4 / 330.2 / 421.4 | 190.1 / 275.3 / 364.5 |

对应五组的 B5−base 同步处理差值为 **−13.6、+10.4、−8.2、−8.0、+7.9ms**，并非每组 B5 都更快；总间隔差值为 +103.2、−136.3、−191.1、+14.6、+10.6ms。不能把两组中位数误写成 B5 优化了输入。

跨 Node/浏览器分段使用 `timeOrigin + performance.now()` 对齐，存在跨进程时钟误差；同一浏览器内的总间隔、同步处理和处理后间隔不依赖这种对齐。`eventTimeStamp` 的年龄不等于单独的队列等待，原采集字段 `eventQueueMs` 不用于精确归因。

## 时间花在哪里

### 两次独立采样

| 观察窗口 | 基线 | B5 |
| --- | ---: | ---: |
| 第一次同步处理（trace mark） | 48.496ms | 54.998ms |
| 处理结束→第二次 click | 323.755ms | 373.356ms |
| 该窗口两次 Chromium `Commit` 总墙钟时间 | 224.050ms | 304.535ms |
| 对应 `Commit` 总线程 CPU 时间 | 5.929ms | 6.443ms |
| 该窗口 `FireAnimationFrame` 时间 | 48.354ms | 23.168ms |

两版 `Commit` 分别为 89.156+134.894ms、155.521+149.014ms。主线程被这些提交占住，墙钟时间远大于线程 CPU 时间，说明大部分是原生渲染提交/调度等待，不能说成 JavaScript 在做几百毫秒的装备计算。当前 trace 能定位到提交等待，不能进一步证明每一毫秒具体等待哪条 GPU/操作系统信号。

按 source map 还原 CPU 采样，第一次处理的 `BoardScene.sync` 含子调用约为 43.435/50.796ms；共同热点是 `reconcileTokens → createToken → UnitView`、Phaser 文本测量/纹理更新，以及 `StrategyPanel.render`。两版采样中的渲染耗时有波动，相关源码/渲染调用未由 B5 改动。采样值是约 1ms 精度的栈区间归属，不是精确函数计时，嵌套值不能相加。

第二次 click 之前的间隔中，两版均没有采到领域规则调用。B5 有约 6ms 的既有 IndexedDB 回调；主要部分仍为上述提交等待。这与普通样本“第二次 tap 发起之后才消耗大部分间隔”的分解一致。

### B5 新增工作与查询路径

- 静态路径：`StrategyPanel → BoardScene.panelControl → MatchSession.continue → nextRound → acceptEquipment → planTemporaryEquipment → generateRoundRolls`。随后既有 commit/notify、历史/保存入队、界面 sync；没有预览或只读装备查询调用。
- 本场景真实状态为第 1 轮 settlement、2 件库存装备、无 TG、空 roll 账本和空临时子件。装备计划仍做合法池和空账本校验；没有生成子件或消耗装备 RNG。
- B5 单次采样中 `nextRound/acceptEquipment` 约 2.203ms，其中装备计划/G12 约 1.105ms；基线这段很短，未被 1ms 采样命中。不能把“未命中”当作零成本，也不以预热微基准取代冷路径采样。
- `previewCombine`、`previewEquip`、`readUnitEquipment`、`readItemInventory` 没有被此界面路径引用。没有发现“每次点击完整预览/装备查询”的新增负担。
- 保存/恢复、M6、回放及表现层相对基线无代码变化；`BoardScene.ts` 只有获准的四条失败文案。B5 新字段使此场景换轮后 JSON 从 2978 增为 3074 字符，因此仍量化了复制成本，不能仅凭这些模块没改就推断无影响。

隔离 Chromium 纯函数复测，使用采样前自然到达的真实快照；同版本源码经 esbuild 打包，500 次预热、7×1000 次调用，以下为每次耗时的批次中位数。没有 DOM/渲染/IO，不是完整点击测量，也不能解释冷 JIT 的全部成本。脚本：[diagnose-m8-b5-click-pure-cost.cjs](../scripts/diagnose-m8-b5-click-pure-cost.cjs)。

| 操作 | 基线 | B5 |
| --- | ---: | ---: |
| `nextRound` | 0.0112ms | 0.0213ms |
| `planTemporaryEquipment` | 无 | 0.0077ms |
| `fixedCapture`（换轮后 Match，空当前战斗） | 0.0588ms | 0.0491ms |
| `structuredClone`（换轮后 Match） | 0.0380ms | 0.0348ms |

B5 有约 0.01ms 的预热领域增量，绝不能表述成零开销；但它既不能解释数百毫秒等待，又在防护计时前执行。复制结果的小幅差异不构成性能改善证明。当前没有需要为本次失败修复的 B5 计算热点；不改冻结 G12，不削弱保存/恢复校验。

## 调查完成时的建议（历史记录，后续授权见文末）

证据支持：在这个既有 CI 场景及当前环境下，顺序等待两次 tap API 不能可靠表达“40ms 双触”，已有渲染提交阻塞使第二个原生 click 迟到。建议仅授权原脚本中的输入驱动例外：排队两次 Chromium 原生触摸，不等第一次 release ACK 后才开始中间 40ms；保留原结果断言、400ms 产品窗口、其他检查和 CI 配置。该方案仍**未应用**，本轮也没有用候选驱动的通过结果替代原输入。

如获授权，先验证确实产生两次 trusted click 及实际间隔，再运行原 M7 全脚本和完整 GitHub CI。若用户希望先取得 CI runner 上同样的性能 trace，可继续收集环境证据；本报告没有独立还原 CI #113 或旧 562.5ms 样本的完整等待链，不能保证候选驱动在任何负载下都通过。

## 复现

在仓库根目录、有相同依赖的环境执行；构建顺序运行，计时期间不并行其他本任务构建/浏览器。脚本会为两版启动本地静态服务器，结束后关闭。保留原门禁文件不变。

```sh
study_dir=$(mktemp -d /tmp/m8-b5-click-repro.XXXXXX)
mkdir -p "$study_dir/base" "$study_dir/b5"
git archive 97f38a0 | tar -x -C "$study_dir/base"
git archive e10c254 | tar -x -C "$study_dir/b5"
ln -s "$PWD/node_modules" "$study_dir/base/node_modules"
ln -s "$PWD/node_modules" "$study_dir/b5/node_modules"
(cd "$study_dir/base" && npx vite build --sourcemap)
(cd "$study_dir/b5" && npx vite build --sourcemap)
node scripts/diagnose-m8-b5-click-latency.cjs --gate="$study_dir/base/scripts/verify-m7-presentation.cjs" --base="$study_dir/base/dist" --b5="$study_dir/b5/dist" --out=artifacts/m8-b5-click-repro --pairs=5 --profile-pairs=1
node scripts/analyze-m8-b5-click-latency.cjs --study=artifacts/m8-b5-click-repro
node scripts/diagnose-m8-b5-click-pure-cost.cjs --study=artifacts/m8-b5-click-repro
```

本次未改存档格式、digest、目录版本、冻结合同、G12 或其测试，也没有更改原门禁/阈值。只增加只读调查脚本、证据和交接文档。

## 授权后的输入驱动修复（独立审计项 B5-M7-INPUT）

用户在完成上述调查后明确授权：只调整 M7 双触检查的输入驱动，采用原生触摸排队；保留全部断言与400ms阈值，不改CI配置和其他门禁。该授权取代前文的“待决定”，不扩大到产品界面或领域代码。

### 改动与审计边界

- `scripts/verify-m7-presentation.cjs` 只替换原第140–142行：在同一CDP会话发送第一次touchStart，发送touchEnd而不等待ACK，保留40ms间隔，再按顺序排入第二次touchStart/touchEnd，最后等待全部ACK并在finally释放会话。
- 没有使用DOM `.click()`、合成JavaScript事件、修改时钟/领域状态、关闭原后台页面或改变构建负载。仍由Chromium派发真实原生触摸及click。
- 修改前脚本SHA256为 `518ef64aa54a272baed1e8e59cf0d82ac8c60c83ac09ae529461222476b93fda`，修改后为 `e14a32900b6785c6091040c16c80bd3b7151793be0f0cac058d18218a8424d50`。已验证替换块以外字节完全相同，包含原700ms等待、双击/双触结果断言、刻意Start和全部后续检查。
- `strategy-panel.ts` 的 `LIFECYCLE_QUIET_MS = 400` 与防护起点未变。没有修改其他门禁、CI配置、冻结合同、G12、存档格式、digest或目录/规则版本。
- 新增可选观察器 `scripts/probe-m7-native-touch.cjs`：通过Node preload只读监听touch页面的原生capture/bubble事件，不进入CI配置、不替代任何门禁断言。独立验证确有两次trusted click、目标continue→start-combat、总间隔及处理后间隔均在原400ms窗口内。
- 历史对照脚本增加 `--gate` 参数，用精确基线中的旧顺序驱动复现修改前数据；不悄悄用修复后的驱动覆盖旧失败。上一阶段机器证据内的脚本指纹绑定提交0298a3f，历史证据不改写。

### 对照及全脚本验证

修改前的完整十次对照见上文：基线2/5失败（502.0、472.0ms，总间隔；处理后467.6、425.3ms），B5 1/5失败（448.7ms；处理后411.2ms）。这些原始失败与trace证据保留，不通过重跑删除。

修改后在相同的基线97f38a0与B5 e10c254生产资产上，运行**当前完整M7脚本**，只附只读计时观察器；两版资产SHA256与原对照一致。当前B5相对e10c254没有产品代码差异，新增的只是文档/诊断工具/本输入驱动。两版完整M7均已通过7项检查；完整GitHub CI结果在实际结束后追加，不提前记通过。

| 产品版本 | 修改前五次click间隔 min/median/max | 修改前失败 | 修改后实测click间隔 | 修改后处理结束→第二click |
| --- | --- | --- | ---: | ---: |
| 精确基线97f38a0 | 313.3 / 434.1 / 502.0ms | 2/5 | **42.2ms** | **9.3ms** |
| B5 e10c254（当前相同产品代码） | 280.9 / 365.7 / 448.7ms | 1/5 | **61.9ms** | **8.4ms** |

修改后的两组输入均观察到两次 `trusted: true` 的原生click，目标依次为 `mobile:continue`、`mobile:start-combat`；总间隔与处理后间隔均小于未改动的400ms。没有仅凭脚本中的40ms定时器推断实际间隔。每版修改后各一次完整脚本验证，不把这个样本量写成跨机器无偶发失败的保证。

两版均通过 `help-dialog`、`reduced-motion-equivalence`、`continue-double-activation`、`replay-feedback`、`replay-identity`、`help-over-reward-choice`、`portrait-404-fallback`。原始观察记录、完整脚本report、指纹和对照资产见 [M8_B5_NATIVE_TOUCH_FIX.json](evidence/M8_B5_NATIVE_TOUCH_FIX.json)。生成的截图/日志留在 `artifacts/m8-b5-fixed-driver`，不提交生成物目录。

审计方请单独核实 **B5-M7-INPUT**：这一项是用户明确授权的门禁输入驱动修复，不是B5领域实现；重点复核替换块以外字节一致、原断言和400ms未变、基线也会失败的历史证据，以及修复后两次trusted click确实落入窗口。CI仍以无preload的正常脚本执行，不用诊断模式代验收。
