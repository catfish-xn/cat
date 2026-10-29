# v25 G7 审查修复（2026-10-27）

分支 `codex/v25-g7`，基线 `84d6e980654bac7b5cf9da2d773dd0679e71bed8`。对应审查文件 `review-g7-result.md` 的三项 must-fix。

## 修复与回归

- **P1：终局死亡边界。** 发奖前即使已经持有同一个 finished CombatState、tick 仍为 0，也显式记录完整 `deaths:[]`；已有边界和死亡 eventSeq 不重复记录。真实 seed=19、s0 在 2-1 取得战利品爆炸后，通过房间命令领取英雄、在 2-7 前卖空阵容，原版会以 `resolver-error/invalid-pool` 结束。回归覆盖普通与流式 PvE、空阵容 tick 0、单个爆爆实际全灭，验证完整边界、无错误、零非法掉落、三种形式恢复，以及继续 3-1 不补发。
- **P2：初始赠礼孤儿与服务器认证。** `restoreSharedOrbSnapshot` 在 gift source 或 receiptId 命名空间命中 batch1 时校验完整礼物计划，防止删除拥有者后把既有赠礼当通用收据接受。可信 pool 的 pending／rewards 记录若指向依赖历史的强化赠礼，即要求独立服务器 authority，不能依靠候选档自报的拥有者／历史／收据决定。真实同组候选 `crownguard-spirit` 替换、删除 augmentHistory、加 123 金，在对象、JSON、规范序列化文本三形式中均拒绝；另覆盖伪装 source、删除初始 gift 收据、卖出赠送英雄后仍须认证、合法 authority 恢复和失败不修改房间／卡池。
- **P2：通用 Oracle 按奖励 kind 分类。** 同一 g7 source 的金币进入金币计划，装备进入 gift 计划；原有只发金币／礼物的来源仍拒绝伪造 kind。独立字面向量通过 `validateRewards` 与完整 `Ledger`，覆盖 2 金、单／双散件、普通成装、同次金币与装备，以及缺失、重复、改值、改 kind、改轮次／ID、额外余额和缺少实际装备的反例。独立期望不从生产奖励收据派生。

阶段口径已同步 P-B5-69、MATCH_CONTRACT、Batch5 缺口条目与本报告：**2-1／3-2 开放、4-2 禁出**，3-2 保留伏击专家阵容过滤。

## 验证

相关 Vitest 共 9 个文件、271 项通过：审查新增房间和 Oracle、既有 G7 房间及规则、强化历史、共享卡池及其房间测试；新增卖出英雄场景后单独重跑房间回归 69 项通过。`npm run typecheck` 和 `git diff --check` 通过。

共享 `node_modules` 为只读，默认 Vitest 配置打包会触发 `.vite-temp` 的 EROFS。相关测试采用 `--configLoader runner --cache=false --maxWorkers=1`，临时配置位于 `/tmp/codex-g7-vitest.config.mts`，继承仓库 fast 项目与 worker setup，仅跳过这些纯规则／内存房间测试不使用的全局浏览器启动；缓存位于 `/tmp`，未改仓库测试配置、断言或超时。没有浏览器／WebSocket 监听验收需求。

本次未改 `src/server/`、界面、玩法参数、内容身份、旧 epoch 或 golden；未执行 Git 写操作。缺死亡边界或缺独立认证的相关旧候选档继续拒绝，不推测迁移或在恢复时补发。
