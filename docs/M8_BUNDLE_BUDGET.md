# M8 JS gzip 预算调整

## 决策（2026-10-08，用户已批准）

将 JS gzip 系数从 **1.10** 提高至 **1.15**；唯一可执行修改为 `scripts/m7-budget.cjs` 的 `jsBudget` 数值。同步脚本注释与 `M8_PLAN.md` §7.6 的文档描述。首次可操作预算仍为 1.20，其余门禁、测量方式、测试、运行规则、CI 配置均不变。

理由：B4 + U4 合并构建为 470,088 B，超过旧上限 2,849 B，同时为 B5 及后续 M8 预留余量。体积去重压缩优化（方案 C）推迟到后续独立任务，本次不实施。

已验收 M7 JS 基准 SHA：`15313a75c6e74beec739fe52a2875c104c55eae3`。本次同环境测得 424,763 B：

- 原上限：floor(424,763 × 1.10) = **467,239 B**。
- 新上限：floor(424,763 × 1.15) = **488,477 B**，增加 21,238 B。
- 取整仅用于表达最大可接受的整数字节数；实现仍按 `current / base <= jsBudget` 判断，没有新增取整逻辑或改成固定字节门禁。不同环境重建基准时仍由原有成对测量决定阈值。

## 固定来源与分支状态

- 任务起点 `feat/m8-b0-baseline`：`5dce5cd07f3f400be42981742dcb2dc3ceff2009`。
- B4 签收 SHA（用户指定）：`6758a9d696080b1c2b9470dfba46a15e4989a623`。
- U4 第一版 SHA：`5778cab29fd02a5aeb002b1e12b16f1ac4dc39bf`（[PR #12](https://github.com/catfish-xn/cat/pull/12)）。
- 检查时 B4 **尚未合入**基线：`git merge-base --is-ancestor <B4 SHA> <baseline SHA>` 返回 1；反向关系成立。
- 创建前远端无 `chore/m8-bundle-budget`；任务分支从上述基线新建，没有覆盖远端分支。
- 本次没有合并任何远端分支。组合在 detached worktree 中用未提交的临时 merge 构建；基线是 B4 祖先，因此“基线 + B4”与固定 B4 源码相同。

## 同环境测量

Node 24.19.0、npm 11.9.0、Vite 7.3.6；所有来源的 package.json / package-lock.json 与基线一致，共享同一锁定依赖安装。构建顺序为 M7、基线、B4、B4+U4，均执行 Vite production build。

| 组合 | JS gzip / B | 相对新上限余量 / B |
| --- | ---: | ---: |
| 基线 5dce5cd | 453,949 | 34,528 |
| 基线 + B4 6758a9d | 466,144 | 22,333 |
| 基线 + B4 + U4 5778cab | 470,088 | 18,389 |

逐文件名称、原始字节数、gzip 字节数、环境、源 SHA 和组合 tree SHA 见 [仓库证据](evidence/M8_BUNDLE_BUDGET.json)。

复现步骤：

1. 固定上述 SHA，新建隔离 detached worktree；M7 也单独检出。
2. 从基线锁文件执行 `npm ci`，各 worktree 使用同一 node_modules。
3. B4+U4 工作区在固定 B4 上 `git merge --no-commit --no-ff <U4 SHA>`，无冲突，不生成正式合并提交；不推送组合。
4. 各工作区执行 `node_modules/.bin/vite build`。
5. 读取 `dist/assets` 中全部 `.js`；逐文件执行 Node `zlib.gzipSync(bytes, { level: 9 }).length` 后求和，与现有 `jsGzip()` 方法一致。

组合构建不是组合功能 CI，更不代表 B4 或 U4 的新验收。GitHub CI 使用 Node 22；最终预算分支完整 CI 的成对测量才是该分支测试权威。

## 验证与恢复断点

- 本地四组生产构建和预算分支 typecheck 已通过。
- 默认 npm 缓存目录不可用；改用本机可写缓存后 `npm ci` 成功，未更改锁文件或 npm 来源。
- 本地完整单测未取得结果：默认 `npm test` 持续停在 Vitest RUN 后中止（退出 130）；`timeout 90s npm test -- --maxWorkers=2` 也仅停在 RUN 并超时（退出 124）。不推断代码失败或测试通过；完整 GitHub CI 是权威。
- 本地 Playwright 所需 Chromium 缺失，官方安装器下载浏览器后报 ZIP 中央目录签名不存在，安装失败，未声称桌面测试通过；既有 GitHub CI 将执行完整桌面作业，未删除或跳过任何门禁。
- 开发自检：去掉块注释后，与基线相比可执行文本仅 `jsBudget: 1.10` → `1.15`；直接调用原 `jsGzip()` 四组结果与证据一致；488,477 B 通过、488,478 B 不通过的边界成立。`node --check`、`git diff --check` 通过。这是编写方自检，不是独立审计。
- 下一步：开指向基线的 Draft PR，等待最终 SHA 完整 CI，通过后送全新独立 ChatGPT Pro 网页对话审计；CI 结果与审计链接写入 PR 进度评论，避免为记录 CI 链接再次改变被验收 SHA。
- 审计对话尚未创建，尚未签收。不合并。
- `.github/workflows/ci.yml` 的历史注释仍提及 1.10；遵守本次不改 CI 配置的约束保留，其实际调用读取预算脚本的新系数。
