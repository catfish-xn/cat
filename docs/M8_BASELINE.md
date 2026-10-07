# M8 B0 接手基线（2026-10-07）

## 范围与结论

本次仅执行 B0 可在当前环境完成的核对，并在独立数据分支准备 CommunityDragon 获取工具。没有开始 B1 历史内容冻结或 B2–B10；没有改动游戏、界面、规则、存档、普通 CI 或 Pages。

B0 的 Git/决策/源树核对及现有 CI 性能基线现已完成；下文保留首次本机受限的历史记录，新增 CI 实测作为当前结果。此次只重用现有 M7/M6 性能工作负载，不代表 M8 新负载验收、全部 M8 性能门禁或独立 M6 内存问题已解决。

## 精确接手状态

- 仓库：`catfish-xn/cat`。
- 创建分支前通过 GitHub main API 与新 clone 的 HEAD 双重核对：`5aff440c702e7c8c665f05f0b419a9edbf9ea00f`。
- 基线 tree：`866f9620fecd40ad11ae8e63e4d249015a58daaa`。
- 实施分支：`feat/m8-b0-baseline`，直接从上述最新 main 创建。
- 新 checkout 的 `git status --short` 为空，无用户未提交改动；只有根目录 AGENTS.md，无更深层指令文件。
- 跟踪树共 370 项；src 86、tests 110、scripts 46、docs 62、public 40、.github 4。数量只是文件树快照，不是验收标准。
- M7 已合并；M8_PLAN.md 已确认 D1–D6 均 A。规划基线 44541f0 到本次接手 SHA 增加的是 M8 文档合并，未因此宣称已实现 M8。
- 保持 50ms tick、显式 RNG、失败原子性和现有协议/内容 digest；不修改数值。

## 对应 SHA 的远端证据

UTC 2026-10-07 01:06 核对精确基线 SHA 的 check-runs：

- [CI 37551820640](https://github.com/catfish-xn/cat/actions/runs/37551820640)：11 个常规验收作业成功，2 个诊断作业按条件跳过；比较作业于 UTC 00:47:21 完成。
- [Pages 37551820412](https://github.com/catfish-xn/cat/actions/runs/37551820412)：build/deploy 成功；不是用部署成功替代 CI。
- 以上为 GitHub 状态核验，没有声称在当前机器重新执行全部浏览器路线，亦未把历史 M6/M7 其他 SHA 的报告冒充此次测试。
- 本次 B0 提交只添加此文档，产品源树不变；该分支不触发 main-only push CI，不创建 PR 来触发普通 CI。

## 首次本机实测（历史，浏览器缺项已由下节 CI 测量补充）

环境：Linux 6.18.44 x86_64，Node 24.19.0，npm 11.9.0，可见 CPU 9；不是 CI 的 Node 22 / Ubuntu 24.04，后续同机比较必须记录环境差异。

| 检查 | 结果 |
| --- | --- |
| npm ci | 成功，lockfile 未修改 |
| npm run build（含 typecheck） | 成功，84 modules，Vite 7.3.6；保留 >500kB chunk 警告，不作无关优化 |
| 生产 JS | index-CsWIfx1z.js，1,497,604 原始字节 |
| 生产 JS gzip | **424,763 字节**，Node zlib gzipSync level=9，对 dist/assets 中全部 .js 求和；不使用 Vite 默认 gzip 数字混作同口径 |
| 首次可操作（9 有效样本+预热） | 未取得：scripts/m7-budget.cjs 以当前 dist 同源双槽试采样，Chromium 启动即失败，无有效样本，不能解释为成对 M7/M8 比较 |
| Chromium 启动 | 普通及获准的提升执行均报 process_singleton_posix socket() failed: Operation not permitted；未修改安全/网络配置 |
| npm test | 已尝试；约 2 分钟仅显示 Vitest RUN、无结果，主动中止，不能记为通过或断言产品测试失败；此次文档任务不等待整套长测试 |
| 桌面帧间隔/存档/seek/生命周期等性能 | 未在当前环境重测；不能把远端 green CI 当作本机新性能数值 |

生成日志和 dist 仅存本地 artifacts，不提交。后续可在能启动正式 Chromium 的同一执行环境重新采集 M7 基线及 M8 对照；不得删除失败样本或抬高阈值。当前静态 gzip 数值不能替代其他性能项。

## 独立依赖与后续界限

M6-MEM-01 撤销记录累积由 `codex/m6-lifecycle-retention` 独立处理。本任务不修它、不把它混入 M8、不调整门禁；后续阻碍验收时单列证据。

CommunityDragon 本机 403 不再重试；按用户新授权由专用 `data/cdragon-14.24` 分支的 push 工作流获取原档。即使下载成功，也仅证明取得原始字节及 hash，不证明 14.24b 覆盖、44 装备、36 配方、野怪或掉率已经核准。B1 仍需另行执行来源、覆盖、未知项及单人政策审查。


## GitHub Actions 性能实测补充（2026-10-07 UTC）

### 执行与证据边界

- **测量环境是 GitHub 托管 CI，不是本地设备或 dot 云电脑。** 工作流 [.github/workflows/m8-b0-performance.yml](../.github/workflows/m8-b0-performance.yml) 仅由 feat/m8-b0-baseline 分支上该 YAML 的 push 触发；结果文档提交不会重复触发。main、原 ci.yml 与 Pages 没有修改。
- 测量 SHA：`5533c69ad418b6eacd068293fd895b8094bcc587`。相对接手 main，仅 B0 文档与专用 CI 编排不同，游戏源、锁文件、性能脚本不变。
- [运行 37556739835](https://github.com/catfish-xn/cat/actions/runs/37556739835)：test-and-build-sample1、input-dev-sample1、m7-presentation-sample1 **全部成功**。沿用现有 CI 对应作业定义和原超时/门槛；input 仅选择拥有 M6 性能步骤的 dev 矩阵。
- 复用了 test/headless/三次性能复测、原生输入及已有触摸/布局回归、M6 存储性能/失败恢复，以及 M7 表现/子路径/成对预算。没有新增手机优化或测试。没有运行六个独立 chromium-match 作业、input-preview 或 compare-evidence，故不是宣称完整 CI 全矩阵重新通过。
- 直接读取上述运行的三个 artifact，选取原报告保存到 [evidence/M8_B0_CI.json](evidence/M8_B0_CI.json)。不是用旧 run 或仅 green 状态编写数值。
- 这次后续提交只添加报告与文档，测量证据覆盖上述测量 SHA 的相同产品源；**不声称文档提交 SHA 又重新跑过性能**。

### 环境与方法

GitHub ubuntu-24.04，Node v22.23.3，Playwright 1.63.0 / Chromium 153.0.8010.12。headless 作业为 AMD EPYC 7763、4 vCPU、约16.77GB RAM；M6浏览器性能作业为 Intel Xeon Platinum 8573C、4 vCPU、约16.77GB RAM。不同 job 是不同 runner，不能把它们当作同一硬件串行比较。

M7 成对预算在一个 job/机器内对基准M6 `631c131f1f2fd387c873f0fd8b5a238bca79dbe0` 与当前M7进行交替测量，预热一对并保留9个有效样本；首次可操作等待公开“以固定种子开始”按钮可用。它证明现有 M7 相对 M6 门槛，不是尚未实施的 M8/M7 比较。将来验收 M8 必须在同一 runner 上重新配对构建/测量 M7 与 M8，不能直接把历史 415ms 当不同硬件的通用阈值。

### 当前 M7 产物/首次可操作

| 项目 | CI 实测 | 口径 |
| --- | --- | --- |
| 生产 JS gzip | **424,763 bytes** | gzip level9；M6对照410,859；比值1.03384 ≤1.10 |
| 首次可操作当前样本 ms | 410、409、415、393、418、416、414、420、424 | 9个有效样本，未剔除失败样本 |
| 首次可操作当前中位数 | **415ms** | M6对照382ms；比值1.08639 ≤1.20 |
| 纯领域 step | 各路线p95最高0.979728ms、p99最高1.421884ms | 4种既有路线×3次，seed42；是“各路线分位数的最大值”，不是合并样本分位数或新增M8 30seed/9v9满装压力验收 |

### 现有 M6 生产模块性能（CI浏览器实测）

| 指标 | 实测 ms | 原门槛 ms |
| --- | --- | --- |
| 增量捕获 p95 | 20.5 | 50 |
| 增量写入 p95 | 14.3 | 250 |
| 完整捕获 p95 | 74.5 | 500 |
| 激活写入 max | 202.6 | 1000 |
| 完整导入激活 max | 6305.5 | 30000 |
| 首次 seek max | 764.7 | 2000 |
| 缓存 seek max | 18.1 | 100 |
| 40tick统计批次 max | 0.2 | 5 |

上述8个门槛全部通过。报告保留原采样与统计口径；其中 activation 虽有历史常量命名，其实际判定为 max。最大完整文件13,971,120 bytes，增量文件1,163,861 bytes，最大单战记录1,027,084 bytes。

30次**模块**生命周期实测：GC后堆增长142,736 bytes ≤1,048,576，残留监听0、组件DOM0；浏览器错误列表为空。此脚本明确不证明整应用Phaser循环/tween清理，也不等于独立 M6-MEM-01 已修复；不得用这次通过覆盖旧问题或放宽其门禁。

### 尚不涵盖

M8新33战/38轮容量、全普通装备及临时装备压力、合法9v9满装30seed、普通/减少动效桌面帧间隔p95/p99等新增负载尚未实施或测量。M8仍待B1原始数据核验和后续阶段，不进行数值冻结、运行导入、合并或部署。
