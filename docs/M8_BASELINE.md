# M8 B0 接手基线（2026-10-07）

## 范围与结论

本次仅执行 B0 可在当前环境完成的核对，并在独立数据分支准备 CommunityDragon 获取工具。没有开始 B1 历史内容冻结或 B2–B10；没有改动游戏、界面、规则、存档、普通 CI 或 Pages。

B0 **部分完成**：Git/决策/当前 CI/本地构建体积已记录；同机桌面 Chromium 性能基线受执行环境限制，尚未采集。不得将本文件称为 B0 全验收通过或 M8 性能通过。

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

## 当前环境实测

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
