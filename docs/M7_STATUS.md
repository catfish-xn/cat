# M7 状态核对与 M8 开工基线

核对日期：2026-10-07（北京时间）。本文件记录 Git 与 GitHub API 的实际状态；不是 M7 功能验收报告，也不修改历史证据。

## 1. 合并状态

| 项目 | 实际结果 | 证据 |
| --- | --- | --- |
| main | `a8be9fc151b9ebb895eb4097828bb74c590e2559`，合入 M6 的 PR #7 | [提交](https://github.com/catfish-xn/cat/commit/a8be9fc151b9ebb895eb4097828bb74c590e2559) |
| M7 候选 | `6120e86b74934bd70d484ca93b83ab5c93b10d41` | [提交](https://github.com/catfish-xn/cat/commit/6120e86b74934bd70d484ca93b83ab5c93b10d41) |
| M7 PR #8 | 核对时 `open`、`merged=false`，目标 main | [PR](https://github.com/catfish-xn/cat/pull/8) |
| 6120e86 的含义 | main 合入 M7，保留 AGENTS、维护指南、Pages 和构建模式；不是 M7 合入 main | [差异](https://github.com/catfish-xn/cat/commit/6120e86b74934bd70d484ca93b83ab5c93b10d41) |

用户本轮说明为“M7 已合并”，但两路核对尚未得到这一结果。main 文件树也尚无 `src/presentation/`、`public/assets/s13/` 及 M7 专项门禁，排除了仅因 squash 导致提交号不同的情况。本轮只同步事实并编写规划，不执行功能合并。M8 实施前必须重新核实真正包含 M7 的 main、其 CI 与差异，再把规划分支同步到该基线；用户批准计划不自动证明这个前提已经满足。

## 2. M7 候选的实际能力

- 19 英雄身份与种族/职业信息；40 张本地 S13 图标（19 英雄、5 职业、16 装备），具有来源/hash 清单和缺图回退。
- 棋盘、商店、装备与羁绊信息、回放读取同一身份映射；实战与回放共享战斗事件到表现的映射。
- 帮助面板、焦点与输入保护；减少动效开关；中文标签；生命/法力/护盾及来源反馈。
- 外部审计 F01–F07 已有修复及回归：连续“继续”误开战、帮助与奖励焦点冲突、子路径资源、回放反馈、血条裁切、治疗数字重复、头像 404 回退。后续 `b252c34` 修复标签/数字重叠。
- `src/simulation/` 与 M6 main 相同，领域仍为 7 组件/9 成装、19 英雄/5 职业、2-1 至 6-7 共 35 轮；野怪仍是 `neutral-stage-*` 自定义切片，不是全量历史 PvE。
- `src/persistence/` 与 `src/replay/` 的协议未因 M7 改版而升级：Match schema5、save/replay format1。M7 只改变部分应用与反馈适配，不能将“规则未改”写成“所有非界面文件都无变化”。

源码和候选文档：

- [M7 验证与 F01–F07](https://github.com/catfish-xn/cat/blob/6120e86b74934bd70d484ca93b83ab5c93b10d41/docs/M7_VALIDATION.md)
- [M7 Codex 审计及后续 CI](https://github.com/catfish-xn/cat/blob/6120e86b74934bd70d484ca93b83ab5c93b10d41/docs/M7_CODEX_AUDIT.md)
- [M7 暖机对照与限制](https://github.com/catfish-xn/cat/blob/6120e86b74934bd70d484ca93b83ab5c93b10d41/docs/M7_WARMUP_VALIDATION.md)

## 3. 验证边界

[CI 37540777240](https://github.com/catfish-xn/cat/actions/runs/37540777240) 在 `77600c82bb709837ca1142abc16238765074f116` 成功：11 个验收作业通过，2 个显式诊断作业按条件跳过；入库记录为 50 个测试文件、722 项测试。包含三条桌面路线 × dev/preview、输入/原有触摸路线、M6 存档/回放/生命周期、M7 表现/资源/预算及最终比较。

这不是 `6120e86` 的完整 CI 证明；后者修改了 `vite.config.ts`，合并 main 后还需核实当前提交的构建和相关门禁。本次文档任务只读源码及历史 CI，未重复运行完整游戏验收。`docs/M7_VALIDATION.md` 中较早 run 的失败及待办按时间阅读，最新核对不删除原始失败；用户试玩签收也不由 CI 结果代替。

## 4. 平台、试玩与独立问题

- 当前需求以桌面 Chromium 为主；M8 不新增手机适配或手机测试。历史五视口与触摸结果保留，不把它们当作新阶段的手机承诺。
- 正式地址 [游戏](https://catfish-xn.github.io/cat/) 跟随 main；[M7 临时预览](https://catfish-xn.github.io/cat/m7/) 在现有 workflow 固定到 `d46ed54269548840ccc4644e1d67cad96199afac`，没有自动包含后续修复。实际部署成功与源码合并分别核对。
- 两个地址同源，不因路径不同自动隔离 IndexedDB/localStorage。M6 已在 main，双路径同时使用时必须按同源存储理解。
- `M6-MEM-01`（撤销记录累积）由 `codex/m6-lifecycle-retention` 独立处理。M8 不修该问题、不混入其提交，也不放宽生命周期门禁；如果复现旧失败，关联独立问题并报告受阻。
- 后续路线以本轮需求为准：M8 装备/PvE → M9 起按费用补英雄/羁绊 → 特殊装备 → 海克斯强化。旧计划的“M8 全英雄、M9 立体化”仅是历史候选。
