【完成】基线 `codex/v24-flake@385b62b8`；检查最近 40 次 CI（19 份失败日志）和 5 份 v23-fast JSON；逐条候选根因与修复见 [28 条候选](V24_FLAKE_CASES.md)，原始完整清单 `V24_FLAKE_INVENTORY.json` 不随仓库提供，仓库内不含该证据文件。共 3,004 条同名先红后绿记录，其中 28 条超时／异步候选，283 条身份漂移另列，不能把跨开发提交的变化全部称为 flake。
【完成】13 个测试文件调整，覆盖 17 条历史候选；独立 oracle 每种子约 18 次计算减为 1 次，512 种子全部保留并拆成 16 组：`tests/r3r4-oracle.test.ts:12`；双入口打包分别检查：`tests/augment-text-identity.test.ts:26`。
【完成】长路线按真实回合／tick 暂停；M5 的冷启动／换序缺口已按 review K 改为消费 describe 的分段初始化，验收用例只读完成路线，详见 [K 修复报告](V24_FLAKE_K_REPORT.md)；另见 `tests/g2-3-identity.test.ts:54`。原专用超时未恢复。
【完成】黑市前缀按场分段；满备战席四个状态 × 三种恢复入口分别完整续战，删掉 11／20 秒专用超时：`tests/g2-3-lesser-shimmer-duplicator.test.ts:137`、`:304`、`:335`；原断言均保留。
【完成】宝箱／6-7 按恢复入口拆分，回放篡改按种类拆分，完整状态／事件／RNG 与严格拒绝条件保留：`tests/chest-bracer-integration-trial.test.ts:92`、`tests/restore-audit/bounds-preflight.test.ts:155`、`tests/g5-combat-summary.test.ts:110`、`tests/b8-resumable-battle-helper.ts:125`。
【完成】网络等待实际消息及 inbox 游标，替代固定 50 ms 后解引用：`tests/server/net/combat-stream-wire.test.ts:15`；3D 模块文件级加载、每例资源清理：`tests/rendering3d-preload-mount.test.ts:5`；合成小文件同步准备、真实合并与哈希断言不变：`tests/assets3d-merge.test.ts:31`、`tests/assets3d-fx-pilot.test.ts:131`。
【完成】当前 HEAD 已有的修复沿用：8-step replay 分段 `tests/m5-replay-helper.ts:11`；装备路线逐轮 `tests/m8-b8-equipment-fixture.test.ts:12`；D11 候选筛选 `tests/d11-wiring-match.test.ts:19`；Placebo 只在合法节点真实获取 `tests/rules-placebo-stage.test.ts:54`；另两项旧 hook 超时已有分段见 `tests/m8-b8-live-capacity.test.ts:72`、`tests/restore-audit/g23-grant-evidence.test.ts:12`。
【完成】21 个指定文件以 `--maxWorkers=4` 连续三轮全过，每轮 1,865 条、0 失败／跳过，177.78／217.93／193.88 秒；`npx tsc --noEmit`、`git diff --check` 通过；m5-route 最终类型兼容调整后另三轮各 1,148 条全过；约定已记为 P（2026-10-25）：`docs/S13_RULES_GAP.md:5`；无 src、禁改文件、规则／数值／存档变更，无新增超时，无提交。
【未完成】BotDriver 两条、watch 两条、projection 一条旧负载超时未作代码修复：本次四 worker 连续三轮均过，未证明生产竞态，故保留原断言；不宣称能消除任意机器负载下的超时。CI 前端 PR 独有的 unit-panel／hover-card-pin／hover-dom 测试不在当前基线，已列清单，未凭空创建。
【需要我决定】无，沿用户授权采用现有真实命令分段与输入缓存；未改玩法或替换旧断言。
【风险】输入横跨开发快照；2,693 条普通断言红／绿差异缺少同提交偶发证据，不能据此改规则或 golden。保留的旧负载候选仍需目标 CI 复跑确认；三次本机通过仅证明本次限定的 4-worker 范围。
【下一步】由 Claude 按“测试过了吗／越界了吗／改玩法了吗”交叉审查后纳入 v24；目标 CI 复跑，`.git` 只读，本任务不提交。
