# M8 总验收（B10）

依据：`M8_PLAN.md` §7（7.1–7.7）与 §9、B10 行（`M8_PLAN.md:228`）、`docs/M8_CLAUDE_HANDOFF.md` §7.3–7.4、`docs/M8_DEPENDENCY_MAP.md` B10 行。
集成分支 `feat/m8-b0-baseline`；B10 分支 `feat/m8-b10`（起点：节点2合并提交 `468817a93607ca195fc2d9c119a45c70b662bd9b`）。
运行时正式版本（`src/simulation/m8/version.ts`）：schema 6、rules `m8-14.24b-v1`、content `s13-14.24b-m8-v1`、save 2、replay 2、command 2、`lcg32-v1`、50 ms/tick；contentDigest `fnv1a32-utf16:c7ac9b0c`。

本文件只登记“要求 → 证据 → 状态”。命令、seed、平台和同 SHA 结果见 [M8_VALIDATION.md](M8_VALIDATION.md)；送审范围和审查结论见 [M8_REVIEW.md](M8_REVIEW.md)。

## 1. 已签收节点（复用，不重审）

| 节点 | 内容 | 签收 SHA | CI | 合并 |
| --- | --- | --- | --- | --- |
| 节点1 | B8＋U6（装备获取、掉落、背包、U6 界面） | `c109d4e` | PR #28 全绿 | PR #28 |
| 节点2 | B9＋U7（正式版本切换、33 战容量、M8 存储、M7 只读兼容、回放2） | `ded1b79c0f611baea78aea93b0303d3a9fce6442` | CI #229（run 38118497210）全绿：test-and-build 141 文件 1958 测试，input-dev 27m41s | `468817a`（merge commit） |

B3–B7、U1–U5 已在各自批次签收（`docs/M8_B4_STATUS.md`、`docs/evidence/m8-b6/`、`docs/evidence/m8-b7/`、`docs/evidence/m8-u5/` 等）。B10 只做整体集成必需检查和未关闭项。

## 2. 验收清单

状态：**通过**＝同 SHA 证据齐全；**引用**＝已签收证据覆盖、B10 未改相关代码，最终 SHA 由完整 CI 复验；**B10 新增**＝本节点补的测试或脚本；**未完成**／**延期**＝见 §4。

| # | 要求（来源） | 状态 | 证据 |
| --- | --- | --- | --- |
| A1 | 44 装备独立数值依据（§7.1、C01–C03） | 引用 | `tests/m8-b4-{sword,bow,belt,rod,cloak,vest,gloves,tear}` 逐件手算与实战触发（`docs/M8_B4_STATUS.md` 逐件表）；`tests/m8-b4-catalog`（44 件基础系数）；B1 来源账本 |
| A2 | 覆盖矩阵 contentId→来源→机制→独立测试→战斗→存档/回放（§7.1） | B10 新增 | [item-coverage.md](evidence/m8-b10/item-coverage.md)，由 `scripts/m8-b10-item-coverage.cjs` 从测试源码生成，三列缺格 0；存档/回放列由 `tests/m8-b10-item-save-replay.test.ts` 补齐（44 件逐件真实战斗：回放重建、tick 0/39/40/41/末段保存恢复续算、换定义拒绝） |
| A3 | 7.2 重点交叉、C04–C06、窃贼手套临时子件 | 引用＋B10 新增 | m8-b3-*、m8-g01..g12、m8-b4-integration、m8-b5-temporary、m8-b8-live-transfer；临时子件回放重建与伪造拒绝：`tests/m8-b10-temporary-replay.test.ts` |
| A4 | 8 场遭遇 × 7.3 结果 | B10 实施中（未签收） | [encounter-outcomes.md](evidence/m8-b10/encounter-outcomes.md)，`tests/m8-b10-encounter-outcomes.test.ts` |
| A5 | 38 轮 / 33 战完整路线、三构筑 | 引用 | golden 与 Herald manifest（33 战、11930 tick、victory）；`test:headless` 24 seed；chromium-match dev/preview × cannon/sniper/mage；`compare-m5-evidence --final` 不允许尾 3 战 skip |
| A6 | 开场经济账本 | 引用 | `tests/m8-b6-opening-economy.test.ts`（0G/1级→2G/2级→5G/3级→10G/3级）；m8-b8-live-economy |
| A7 | 唯一收据、重复 step／Continue／恢复不重发 | 引用 | m8-b8-{oracle,command-oracle,token-lifecycle,restore,loot-runtime,resource-provenance}；`verify-m8-u6-loot` 浏览器双击 |
| A8 | 失败／终局，含“6-7 最后击杀且满席” | 引用（替代口径） | 4-7 致死终局满席 retained-terminal（m8-b8-live-capacity、`verify-m8-u6-loot` seed230）；6-7 只发确定的 5G（M8B_LOOT），结构上不存在“英雄掉落且满席”，以 4-7 场景替代，见 §3 |
| A9 | 最大合法保存／回放／统计 | 引用 | `verify-m6-performance`（33 战完整导入、12/12/12/3 样本、15 装备满负载）＋ compare-m6；仅 input-dev（dev 模式） |
| A10 | 7.4 存档／回放清单 | 引用＋B10 新增 | tick 0/39/40/41：m6-replay、m8-b10-item-save-replay；周期／阈值盾／掉落前后：m8-b3-restore、m8-b8-restore；M7 旧档：`verify-m8-b9-legacy`、`verify-m8-u7-compat`；坏 digest／版本／容量：m8-b9-*、`verify-m8-b9-archives`（61 项）；IDB Quota/abort/双连接：`verify-m6-storage`、m6-persistence-retry；1×/2×/4× 与 seek：m6-replay、m6-integration、m8-b10-temporary-replay；临时装备回放重建：m8-b10-temporary-replay；统计增量一次性：m6-stats-oracle、m6-stats-browser |
| A11 | BR1–BR7 桌面路线 1440×1000 / 1440×600 / 1920×1080，dev＋preview | B10 实施中（未签收） | `scripts/verify-m8-desktop.cjs`；既有 BR1–BR3 三构筑 dev＋preview（1440×1000）、BR6 `verify-m5-input` |
| A12 | 根路径与 /cat/ 资源、受控 404 回退、子路径刷新 | 引用＋B10 实施中（未签收） | `verify-m7-subpath`（40 图标）；装备／野怪占位与 404：`verify-m8-desktop`、`verify-m8-u3-static` |
| A13 | UR-U3-07 图鉴静态部分 | B10 实施中（未签收） | `scripts/verify-m8-u3-static.cjs` |
| A14 | UR-U4-07 状态／护盾／治疗显示 | B10 实施中（未签收） | `scripts/verify-m8-u4-status.cjs`；既有 m6-stats-browser 18 项 |
| A15 | 原有输入覆盖 | 引用 | input-dev／input-preview（`verify-m5-input`、布局）、compare --final |
| A16 | 7.6 表（增量/完整捕获、激活、导入、seek、40 tick、256MiB/100000 事件/3 局、30 次生命周期） | 引用 | `verify-m6-performance` ＋ compare-m6；生命周期在 cannon journey |
| A17 | 生产 JS gzip ≤ 签收 M7 × 1.30（停止线 552,191 B） | 引用，最终 SHA 复测 | CI m7-budget `--js-base=15313a7`；节点2 实测 508,813 B（9074811）；B10 含显示文案修复，必须重新构建测量 |
| A18 | 首次可操作中位数 ≤ M7 × 1.20（≥9 样本） | B10 新增（本地配对） | CI 现以 M6 `631c131` 为交互基线；B10 用 `scripts/m7-budget.cjs --base=<M7 15313a7 dist>` 同机 9 样本＋预热补测，见 VALIDATION |
| A19 | 新压力负载 tick p95≤5 / p99≤10 ms；帧间隔 p95≤33.3 / p99≤50 ms | B10 新增（报告模式） | `scripts/verify-m8-performance.cjs`（30 seed ＋ 9v9 满装夹具 `tests/fixtures/m8/`；普通／减少动效） |
| A20 | 正式版本统一切换、skip 清零、首失败可追溯 | 引用 | 节点2 签收；`docs/evidence/m8-b6/deferred-assertions.md` 处置表；比较器断言 skip 为空 |
| A21 | 生命周期 H1 | 告警模式（不变） | `docs/H1_WARN_ONLY.md`；报告实测值，不写“已解决” |
| A22 | 验收／验证／审查文档 | B10 新增 | 本文件、M8_VALIDATION.md、M8_REVIEW.md |
| A23 | 用户试玩确认（7.7） | 未完成 | 需最终 SHA 预览后由用户操作 |

## 3. 替代口径与声明

- **6-7 满席场景**：6-7 掉落固定 5G，不会掉落英雄，“最后击杀且满席”的英雄退回分支在 6-7 不可达；以 4-7 致死终局满席（retained-terminal）替代，并在 encounter-outcomes 中按结构不可达登记。
- **浏览器性能**：`verify-m6-performance` 只在 dev 模式运行；新压力帧间隔为 B10 本地报告，不是 CI 门禁。
- **中文名**：44 件装备中文名仍为临时译名（`temporary-unverified`），以“暂译”标记发版；正式译名接入按 `docs/M8_LOCALIZATION_FOLLOWUP.md` 另行处理。
- **图标**：28 件装备、7 种野怪无已授权图标（UR-U3-03、UR-U5-03），使用类型色块＋名称占位，B10 验证占位与 404 回退。

## 4. 剩余问题

| 项 | 性质 | 状态 | 处理 |
| --- | --- | --- | --- |
| issue #23 | B9 延期项恢复 | 节点2 已恢复并签收 | 关闭需用户确认（同 SHA CI #229＋独立审查已具备） |
| issue #27 | U5 界面自动回归（P3，非阻塞） | OPEN | 建议延期到 M8 后，列入 main 条件说明 |
| issue #11 | 备战区与棋盘棋子直接交换 | OPEN，M8 前已有 | 不属于 M8 范围 |
| H1 | 完整应用生命周期堆增长 | 告警模式，根因未关闭 | 保持现状 |
| H3 | 工程事项身份未知 | 未定位 | 保持待定位，不当作已签收 |
| 中文临时译名 | 显示文案 | 未核验 | 见 §3 |
| 首次可操作 CI 基线 | CI 以 M6 为交互基线 | 本地 M7 配对待正式采样 | 是否改 CI 参数需用户决定（依赖图 B10 行禁止自行改配置） |
| 新压力门禁 | tick／帧 | 报告模式 | 是否升级为阻断门禁需用户决定 |
| input-dev 32 分钟预算 | CI 时长 | 节点2 实测 27m41s，余量小 | 拆分方案独立处理（任务 #26），不并入 |
| 恢复性能优化 `2837b87` | 原独立性能分支 | CI #230 的旧 sniper 恢复测试触及 180s 后，纳入 B10 为 `510dc93` | 仅 JSON.parse 输出的等价校验优化；原始失败保留，不放宽门槛，最终 CI 待复验 |

## 5. 合并 main 的条件

1. main 文档同步已在 B10 合并提交 `e2c98f5` 完成（M9 台账、中文校对，11 文件，无冲突）；随 B10 审查进入集成分支。
2. 同一干净最终 SHA 上完整 CI 全绿（含 compare-evidence），并附本地 B10 证据（桌面、U3-07、U4-07、性能、首次可操作配对）。
3. 独立审查无未处理阻塞问题。
4. 用户在最终 SHA 的预览上试玩确认。
5. 用户明确批准合并与部署；合并后 Pages `/cat/` 切到 M8，`/cat/m7/` 旧快照保留。
