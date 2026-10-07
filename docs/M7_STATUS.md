# M7 状态核对与 M8 开工基线

核对日期：2026-10-07；GitHub Actions 状态核对至北京时间 08:19（UTC 00:19）。本文件记录 Git 与 GitHub API 的实际状态；不是新的 M7 功能验收报告，也不修改历史证据。进行中的工作流状态须在下一次使用时重新核对。

## 1. 合并状态

| 项目 | 实际结果 | 证据 |
| --- | --- | --- |
| main 文档同步基线 | `44541f0a882123a86797a485f679a51cda94b5ae`，在 M7 合并后更新 AGENTS 的桌面平台要求 | [提交](https://github.com/catfish-xn/cat/commit/44541f0a882123a86797a485f679a51cda94b5ae) |
| M7 合并提交 | `15313a75c6e74beec739fe52a2875c104c55eae3` | [提交](https://github.com/catfish-xn/cat/commit/15313a75c6e74beec739fe52a2875c104c55eae3) |
| M7 PR #8 | `closed`、`merged=true`；2026-10-07 北京时间 08:00:46 合入 main | [PR](https://github.com/catfish-xn/cat/pull/8) |
| M7 合并前 head | `6120e86b74934bd70d484ca93b83ab5c93b10d41`，已随 PR #8 进入 main；原开发分支已删除 | [固定提交](https://github.com/catfish-xn/cat/commit/6120e86b74934bd70d484ca93b83ab5c93b10d41) |

main 文件树已包含 `src/presentation/`、`public/assets/s13/`、M7 专项脚本和 CI 门禁。`15313a7` 与 `44541f0` 之间只修改 `AGENTS.md`；M7 合并事实已得到 Git 祖先关系、文件树和 PR 状态的共同确认。早前基于 `a8be9fc` 的“尚未合并”核对已过时。`docs/m8-plan` 已变基到 `44541f0`，用户已确认 M8 的 D1–D6 全部选择 A；本轮只合并文档并交接，完成后停止，不编写或启动 M8 功能代码。

## 2. main 中的 M7 实际能力

- 19 英雄身份与种族/职业信息；40 张本地 S13 图标（19 英雄、5 职业、16 装备），具有来源/hash 清单和缺图回退。
- 棋盘、商店、装备与羁绊信息、回放读取同一身份映射；实战与回放共享战斗事件到表现的映射。
- 帮助面板、焦点与输入保护；减少动效开关；中文标签；生命/法力/护盾及来源反馈。
- 外部审计 F01–F07 已有修复及回归：连续“继续”误开战、帮助与奖励焦点冲突、子路径资源、回放反馈、血条裁切、治疗数字重复、头像 404 回退。后续 `b252c34` 修复标签/数字重叠。
- `src/simulation/` 与 M6 main 相同，领域仍为 7 组件/9 成装、19 英雄/5 职业、2-1 至 6-7 共 35 轮；野怪仍是 `neutral-stage-*` 自定义切片，不是全量历史 PvE。
- `src/persistence/` 与 `src/replay/` 的协议未因 M7 改版而升级：Match schema5、save/replay format1。M7 只改变部分应用与反馈适配，不能将“规则未改”写成“所有非界面文件都无变化”。

main 已包含以下文档；具体历史结论按文内日期与受测 SHA 阅读：

- [M7 验证与 F01–F07](M7_VALIDATION.md)
- [M7 Codex 审计及后续 CI](M7_CODEX_AUDIT.md)
- [M7 暖机对照与限制](M7_WARMUP_VALIDATION.md)
- [完整 CI 历史证据](evidence/M7_LATEST_FULL_CI.json)

## 3. 验证边界

[CI 37540777240](https://github.com/catfish-xn/cat/actions/runs/37540777240) 在 `77600c82bb709837ca1142abc16238765074f116` 成功：11 个验收作业通过，2 个显式诊断作业按条件跳过；入库记录为 50 个测试文件、722 项测试。包含三条桌面路线 × dev/preview、输入/原有触摸路线、M6 存档/回放/生命周期、M7 表现/资源/预算及最终比较。

这项历史成功不等于 `6120e86`、`15313a7` 或 `44541f0` 的完整 CI 证明；`6120e86` 已调整 `vite.config.ts` 并带入 Pages 配置。合并后的精确提交状态如下：

| 提交 | CI | Pages | 本次核对能证明什么 |
| --- | --- | --- | --- |
| `15313a7` | [37549668004](https://github.com/catfish-xn/cat/actions/runs/37549668004)，08:19 核对时 `in_progress`，尚无结论 | [37549667618](https://github.com/catfish-xn/cat/actions/runs/37549667618)，`success`，08:01:35 完成 | M7 合并后的站点已部署；完整 CI 尚不能宣称通过 |
| `44541f0` | [37549797723](https://github.com/catfish-xn/cat/actions/runs/37549797723)，08:19 核对时 `in_progress`，尚无结论 | [37549797438](https://github.com/catfish-xn/cat/actions/runs/37549797438)，`success`，08:08:22 完成 | 当前文档基线已成功部署；完整 CI 尚不能宣称通过 |

表中时间均为 2026-10-07 北京时间。Pages 与 CI 独立运行，不能互相替代。本次文档同步只核对源码、链接、Git 和工作流状态，未重复运行完整游戏验收。`M7_VALIDATION.md` 中较早 run 的失败及待办按时间阅读，最新核对不删除原始失败；用户试玩签收也不由 CI 结果代替。

## 4. 平台、试玩与独立问题

- 当前需求以桌面 Chromium 为主；M8 不新增手机适配或手机测试。历史五视口与触摸结果保留，不把它们当作新阶段的手机承诺。
- 正式地址 [游戏](https://catfish-xn.github.io/cat/) 跟随 main，已由上表 Pages 成功运行部署 M7；[M7 旧快照](https://catfish-xn.github.io/cat/m7/) 在现有 workflow 仍固定到 `d46ed54269548840ccc4644e1d67cad96199afac`，没有自动包含后续修复。原开发分支删除不影响固定提交 checkout；本次文档任务不改变部署配置。
- 两个地址同源，不因路径不同自动隔离 IndexedDB/localStorage。M6 已在 main，双路径同时使用时必须按同源存储理解。
- `M6-MEM-01`（撤销记录累积）由 `codex/m6-lifecycle-retention` 独立处理。M8 不修该问题、不混入其提交，也不放宽生命周期门禁；如果复现旧失败，关联独立问题并报告受阻。
- 后续路线以已确认的 [M8_PLAN.md](../M8_PLAN.md) 为准：M8A 装备/通用机制、M8B 野怪/掉落 → M9 起按费用补英雄/羁绊 → 特殊装备 → 海克斯强化。D1–D6 已全部确认 A，但这不把本轮“文档合并后停止”改为实施任务；旧计划的“M8 全英雄、M9 立体化”仅是历史候选。
