# M5 合并强化池独立账本审计（2026-10-25）

基线：`codex/v23-oracle3`，`87a013f1a35b9849433cacab8a70ed6e0ad440dc`。不提交，不改生产代码、内容身份、历史证据或保存格式。

## 独立来源与漏项

来源：`/home/aiapps/workspace/augments-research-2026-10-23/data/augments-14.24.json` 的 `description_en_us` / `effects`；合并内容文件只作内部 id 与发放时机的文档。Oracle 不导入生产模块。

| 项目 | 独立抄录与记账 |
| --- | --- |
| 替罪羊 `scapegoat`（seed 3044 原始漏项） | `InitialGold=4`，假人首死的每次收益 `Gold=1` |
| 流浪训练师 I / II | 获得时 `Gold=1/6`，单位走既有来源收据与单位谱系账 |
| 交易区 | 获得时 1 金，每回合（含获得回合）1 次免费刷新 |
| 购物狂 | 获得时 4 金，后续每次升级按新等级获得免费刷新 |
| 弑君者 | 获得时 1 金，玩家战斗胜利每次 1 金；有可信对手生命且更高时改为 4 金 |
| 冒险举动 | 无即时金币；从获得回合计第七场玩家战斗后唯一 30 金收据 |
| 银汤匙 | 获得时 10 XP |
| 纪元 / 纪元+ | 获得时 6/8 XP 与 2/3 次刷新，之后每阶段开始同额发放 |
| 耐心学习 | 前一场玩家战斗胜利 2 XP、失败/平局 3 XP，下一回合进入时发放 |
| 升级咯 | 获得时 12 XP，每次购买 XP 额外 2 XP |
| 向上流动 | 每次购买 XP 花费少 1 金；每次升级 3 次免费刷新 |
| 刷新相关 | 连刷 11 次，超级巨星 I / II 2/4 次，混沌召唤刷新分支 40 次 |
| 其余 batch3 金币 | 假人每次产金 1；康复 I / II 达标 8/15；不屈每次 2；混沌召唤金币/三星分支 58/20；妙手空空低三连 6、蛋孵化 5 |
| 单位移除与状态 | 假人化/魔像化扣除被移除英雄的完整卡份与谱系；采矿只退休自身假人；形成总属性及骰子结果独立推导并跨结算保留 |

原有 `augment-pool*` 来源收据已覆盖获得及后续赠送单位的序号、星级卡份、合并谱系、容量延迟与折金记账。本次保留这些检查；未把新的单位直接从实际前后差额加到账本。

## 验证

扫描脚本、构建副本及逐进程 JSONL 只在 `/tmp`，不作为仓库夹具或证据。

- `tests/m5-oracle-augment-ledger.test.ts`：3/3 通过（默认超时）；语法检查及 `git diff --check` 通过。
- seed 3044：cannon、sniper 均已完整通过账本；日志 `/tmp/m5-scan-final-3044.jsonl`。
- `tests/m5-route.test.ts`：2 通过、6 失败。其中两项 golden `contentDigest` 不一致，三项原有 120s/70s 超时，一项超时后的未初始化路线连带失败。没有提高超时或改断言。
- `tests/m8-b8-*.test.ts`：最后单 worker 完整重跑为 **17 文件通过、2 文件失败；315 测试通过、3 失败、8 跳过**。失败为 loot-view 默认 10s hook 超时，以及 live-transfer 三个夹具断言（含单位序号 `unit-33` 与当前 `unit-32` 不一致）；不冒充允许忽略的纯摘要差异。首轮并行运行另记录 15 文件通过、4 失败（284/3/39）；两轮日志保留在 `/tmp/m5-b8-verification.log`。
- `tests/m5-replay-intermediates.test.ts`：4/4 通过；cannon / mage 完整回放分别触发原有 180s / 600s 超时。发现下述生产缺陷后停止；resource-reuse、sniper-caitlyn、sniper 文件尚未运行，不宣称通过。
- `npm run typecheck` 首轮指出新导出缺少声明，已补 `.d.cts`；最后单独运行 `node node_modules/typescript/bin/tsc --noEmit` 退出 0。
- 停止时记录 563 个不同 `(seed, build)` 组合（含修复前失败和复查）；未完成全部 8002 个组合。分段扫描 137 个组合全部通过；seed 4 sniper 的魔像化漏项修正后完整复查通过。原始扫描记录已归档到 `/tmp/m5-scan-original-archive-*.jsonl`，后续扫描已停止。


## 生产缺陷：沃里克开场仍可出现战争财宝（按任务要求停止，未修改 src）

既有约定明确互斥：`docs/S13_RULES_GAP.md:187`、`docs/OPENING_ENCOUNTERS_BATCH_B_REPORT.md:19`，禁止列表为 `src/simulation/content/opening-batch-b.ts:17` 的三个 API 名。

错误入口：`src/simulation/augment-offers.ts:76` 用 API 名与内部 id 比较，再读取 `AUGMENT_DEFINITIONS[id].apiName`。batch3 的定义在 `src/simulation/content/augment-pool-batch3.ts:1382` 只生成 id/name/description/effects，不携带 apiName，因此三个排除项都不命中。现有 `augmentApiName(id)`（`src/simulation/augment-offers.ts:82`）已经提供正确映射，但这里没有调用。

实测：给 `augmentCandidates` 传入 `warwicks-hunger` 与 2-1 节点，silver / gold / prismatic 候选分别仍含 `spoils-of-war-i` / `spoils-of-war-ii` / `spoils-of-war-iii`。普通公开命令路线 **seed 80、cannon，到 2-1** 的实际开场为 `warwicks-hunger`，实际 offers 是 `investment-strategy-i, raining-gold, spoils-of-war-ii`；中档战争财宝确实出现在玩家选择中。复现快照：`/tmp/m5-warwick-repro.json`，脚本 `/tmp/m5-warwick-repro.cjs`；此复现只推进到首个强化节点，不记作完整路线通过。

建议后续最小修复：过滤处复用已有 `augmentApiName(id)`，并补三档候选池及 seed 80 公开命令回归；不增加新的玩法决定、不改任何数值或保存格式。之后给独立 Oracle 增补同一既有禁令，避免它与生产代码共同漏检。**本轮按“发现生产 bug 就停止”的要求没有做这项 src 修复。**

## 停止时另一个未修 Oracle 差异

seed 154、sniper、4-2 的已见一次账本不一致已经独立复现。用相同拥有强化、已见列表、节点及记录的羁绊快照比较候选集，唯一差别是 Oracle 多了 `blood-brothers`；拥有 `menaces` 时生产候选已将其排除。来源互斥表需要继续独立核对并补录，不能修改随机词或接受另一组强化让断言变绿。因为上述生产缺陷触发停止条件，本轮保留此差异，日志 `/tmp/m5-pool-diagnose.log`、现场 `/tmp/m5-pool-snapshot.json`。
