# V26 placeholder 历史修复验证报告

基线：`9e3530c0`；分支 `v26fix-a1`。修改留在工作区，未提交。

## 第二轮审核返修（当前交付）

- `tests/augment-pool-batch5-h9-pvp-attribution.test.ts:45`：新增 4 项直接调用 `goldenFindGoldPlan` 的单测。同一多人 PvP 历史构造 3 个 `ownerSeatId=null` 的敌方死亡；有 `combat-roster` 时只认原始 ID，无 `combat-roster` 时只认 T2 ID；发金均精确断言为 2G。
- 反证验证：仅临时恢复旧 T2 归属逻辑，直接单测中 2 项自战断言失败、2 项双边断言通过。验证后恢复生产修复；未改测试或预期值。
- `tests/server/placeholder-augment-history.test.ts:156`：新增 4 项公开命令驱动的真实对局用例（含两轮阵容准备）。seed 42、s3 超时取得 Golden Find；从第 19 回合起使用生产占位解析器，通过领取法球、购买/刷新/升星/装备培养阵容，4-6 绑定 Darius。第 23 回合 1 次真实 PvP 击杀与第 24 回合 2 次 PvE 击杀合计触发唯一 2G 收据；校验计划、收据、不重复发放及权威快照恢复。
- `src/simulation/shared-pool.ts:135`：诊断回调使用 try/catch；`tests/server/placeholder-augment-history.test.ts:69` 新增 logger 自身抛错仍原子返回 invalid-pool 的测试，核对 pool/state 引用、内容及完整失败结果。
- `src/server/room/logged-shared-pool.ts:7`：从 `shared-pool.ts` 改名；四个生产调用文件及测试、合同引用全部更新。room/live-bank/battle-resolver 的新导入放回正常 import 块；删除合同多余空行。
- `tests/server/battle-result-cache.ts`：最终内容完全恢复为 HEAD。验证期间临时加入审核指定的 `cloneBattleResult`，用 forEach 逐个 `carryAugmentDeathSample`，替换 take/keep/startBattle 的克隆；验证结束后撤回。该文件最终不在 diff 中。

### 新发现并修复的真实恢复问题

端到端的发金、唯一收据均已正确，但完整恢复最初报 `Invalid B8 Match: equipment transaction`。定位到第 2-1 回合自动给 tower-dummy 绑定的 `item-1`：赠品生产路径合法直接绑定，而历史恢复调用普通 `planEquip`，被假人禁止手动穿装的检查拒绝。

`src/simulation/b8-restore.ts:105` 现在只在历史装备折叠时识别该自动事务：同时核对确定性 `emblemGifts/ownDummyId`、DUMMY_SOURCE 收据、紧邻出生事实、原物品、目标、槽位和回合。普通装备与战斗装备恢复继续使用原 planner。没有放开假人手动装备，也未改玩法、内容 digest 或纪元。

`tests/server/placeholder-augment-history.test.ts:191` 新增 4 项拒绝测试：伪造目标、槽位、赠品来源、重复装备均必须抛错；真实状态必须恢复。未删除或弱化恢复断言。

### 本轮验证

```bash
npx vitest run --configLoader=runner --maxWorkers=2 tests/server/shared-pool-room.test.ts tests/server/placeholder-augment-history.test.ts tests/server/two-sided-resolver.test.ts tests/server/batch5-h9-golden-room.test.ts tests/augment-pool-batch5-h9-pvp-attribution.test.ts
npm run typecheck
git diff --check
```

要求的 5 个文件共 68 项通过（60.10 秒，使用审核指定的临时克隆缓存，随后已撤回）；typecheck 和 diff 检查通过。新增共 13 项测试：4 项归属单测、1 项 logger 抛错、4 项真实对局、4 项装备历史防伪。

另因上述恢复问题，额外运行 `tests/forming-history-equipment.test.ts`：3 通过、9 失败，失败点在第 4 回合旧 oracle 的 `independent seen-once ledger` 报价向量（尚未进入假人恢复）。在 `/tmp/cat-v26-a1-baseline` 的 HEAD 原样副本单独复跑，仍为 3 通过、同样 9 失败；核对该副本的 b8-restore、Golden Find 实现、测试文件及 oracle 均与 HEAD 字节一致。该基线漂移留给统一更新，未改 oracle、候选、断言或版本。

没有提交、没有 git 写操作、没有运行 Vite build/全套测试、没有重录；最终缓存文件与 HEAD 一致。所有原有断言和超时保持原样。

## 第一轮修改

- `src/server/room/augment-history.ts:77`：PvP placeholder 携带完整双方战斗时，复用 R2 portable、执行死亡样本、玩家伤害、H7/H8/H9 结算；全部事实使用房间 battleId。镜像判定使用 `!= null`。生产单席模拟的生成对手没有玩家 HP 账户，伤害事实保持显式未知。
- `src/server/room/types.ts:114`：SeatCombat 可携带双方战斗的 mapping/a/b，保留已有单席 replay 输入。
- `src/simulation/augment-history.ts:216`：生产 placeholder 的 combat-roster/deaths 及死亡边界去重使用本轮房间 PvP battleId；死亡样本内部真实 combatId 不变。
- `src/simulation/augment-pool-batch5-h9.ts:43`：Golden Find 从实际 combat-roster 识别单席战斗，使用原始 killer 单位 ID；双方战斗继续使用 T2 ID。
- `src/simulation/shared-pool.ts:135`：runSharedMatchCommand 支持可选原始异常诊断回调，仍原子返回 invalid-pool；PoolError 的稳定失败枚举不变。
- `src/server/room/logged-shared-pool.ts:7`：通过现有 Logger/textLogger 写原始错误和堆栈；`room.ts`、`battle-resolver.ts`、`live-bank.ts`、`consumables.ts` 接入此包装。
- 第一轮曾修改 `tests/server/battle-result-cache.ts` 传递 WeakMap 死亡观察；第二轮按审核要求全部撤回，最终使用 HEAD，由另一分支提供克隆修复。
- `tests/server/placeholder-resolver-helper.ts:10`：原有完整双方 placeholder 测试解析器移为公共测试 helper，结算算法不变。
- `docs/MULTIPLAYER_CONTRACT.md:1`：补充历史身份、生成对手伤害未知语义和诊断回调合同。

## 新增测试

- `tests/server/shared-pool-room.test.ts:245`：seed 42、test-room、s3 第 19 回合超时取得 Golden Find，跨过 19/20 PvP 并完成后续结算；验证 roster/binding/deaths 同一 battleId 和完整终局边界。
- 同文件：mirrorOfSeatId 省略时仍取真实对手伤害；丢失执行死亡样本时仍抛错。
- `tests/server/placeholder-augment-history.test.ts:11`：从 4-2 起使用生产 PlaceholderBattleResolver，验证超时代选、20/21 回合推进、完整归属和独立权威快照恢复。
- 同文件：非 PoolError 原始异常日志与原子失败；普通命令拒绝不记异常日志。

生产路径测试前 18 回合复用真实双方 placeholder helper，以保留 seed 42 的取得前提；从第 19 回合起为生产单席模拟。原始 shared-pool 整局测试继续覆盖完整双方 placeholder 从开局至终局。

## 第一轮验证命令与历史结果

共享 node_modules 是只读链接，默认配置打包器会写入 node_modules/.vite-temp 并报 EROFS；使用 runner 加载同一份原始配置，未更改配置、断言或超时。

```bash
mapfile -t related_tests < <(git grep -l -E 'augment-history|placeholder' -- 'tests/server/*.test.ts')
npx vitest run --configLoader runner --maxWorkers=2 "${related_tests[@]}" tests/server/placeholder-augment-history.test.ts
npm run typecheck
git diff --check
```

结果：相关测试 33 文件，16 文件通过、17 文件失败；2877 项通过、196 项失败，另 6 项因原有 beforeAll 失败被 Vitest 阻断。总耗时 483.96 秒。`shared-pool-room.test.ts`（12 项）与 `placeholder-augment-history.test.ts`（5 项）全部通过，包含新增 8 项回归。`npm run typecheck` 与 `git diff --check` 均通过。未新增 `.skip`、未删改原断言、未提高超时/阈值、未运行 build 或全套、未重录纪元/golden。

基线核对：通过只读 `git archive HEAD` 将 `9e3530c0` 的 src/tests/scripts/配置提取到 `/tmp/cat-v26-a1-baseline`，按相同 `--configLoader runner --maxWorkers=2` 复跑下表所有 17 个失败文件，未改基线源文件或断言。

- 首批 `t10-combat-ops.test.ts`、`d5-placeholder-room.test.ts`：403 通过、2 失败，141.11 秒。
- 其余 15 文件：358 通过、194 失败、6 项因原有 beforeAll 失败被阻断，177.33 秒。
- 两批基线合计 196 失败及 6 项阻断，与修改后的每个失败名称、出现次数和每文件测试状态完全一致；未发现新增失败。

这些基线问题留待另单处理。具体可观察问题包括 T10 自动部署的单位/格子断言不同、D5 what-you-really-are 的 pendingChoice 为 null、Tomb Raider 等旧报价前提不成立后引发连续失败、投影测试未到预定加时轮次、终局法球 forfeit 数量 3 小于预期 4。没有通过更改候选、阈值、断言或版本摘要消除这些失败。

运行的相关测试文件：

- `tests/server/augment-pool-batch5-g4-swarm-room.test.ts`
- `tests/server/augment-pool-batch5-g7-review.test.ts`
- `tests/server/augment-pool-batch5-g7-room.test.ts`
- `tests/server/augment-pool-batch5-r1-room.test.ts`
- `tests/server/augment-pool-batch5-r4-room.test.ts`
- `tests/server/batch5-g2-ghost-room.test.ts`
- `tests/server/batch5-g2-rebel-room.test.ts`
- `tests/server/batch5-g3-mutation-room.test.ts`
- `tests/server/batch5-g5-pipeline-room.test.ts`
- `tests/server/batch5-g6-anger-issues.test.ts`
- `tests/server/batch5-h3-cooking-room.test.ts`
- `tests/server/batch5-h3-room.test.ts`
- `tests/server/batch5-h9-cabal-room.test.ts`
- `tests/server/batch5-h9-golden-room.test.ts`
- `tests/server/batch5-r6-pandora-room.test.ts`
- `tests/server/batch5-survivor-room.test.ts`
- `tests/server/combat-stream.test.ts`
- `tests/server/d01-damage-dealt-room.test.ts`
- `tests/server/d5-placeholder-room.test.ts`
- `tests/server/g23-server-facts.test.ts`
- `tests/server/h12-subscription.test.ts`
- `tests/server/live-bank.test.ts`
- `tests/server/mel-save-settlement.test.ts`
- `tests/server/projection-wire.test.ts`
- `tests/server/replay-client.test.ts`
- `tests/server/replay-first-pass.test.ts`
- `tests/server/room.test.ts`
- `tests/server/shared-pool-room.test.ts`
- `tests/server/t10-combat-ops.test.ts`
- `tests/server/two-sided-resolver.test.ts`
- `tests/server/v15-terminal-orbs.test.ts`
- `tests/server/v17-avarice-earnings.test.ts`
- `tests/server/placeholder-augment-history.test.ts`

## 本轮失败文件与原样结果

| 文件 | 结果 |
| --- | --- |
| `tests/server/t10-combat-ops.test.ts` | 10 tests | 1 failed |
| `tests/server/d5-placeholder-room.test.ts` | 395 tests | 1 failed |
| `tests/server/batch5-survivor-room.test.ts` | 114 tests | 2 failed |
| `tests/server/augment-pool-batch5-r1-room.test.ts` | 146 tests | 67 failed |
| `tests/server/batch5-h9-cabal-room.test.ts` | 88 tests | 66 failed |
| `tests/server/augment-pool-batch5-g7-review.test.ts` | 69 tests | 14 failed |
| `tests/server/batch5-g5-pipeline-room.test.ts` | 30 tests | 3 failed |
| `tests/server/projection-wire.test.ts` | 12 tests | 3 failed |
| `tests/server/augment-pool-batch5-g4-swarm-room.test.ts` | 24 tests | 19 failed |
| `tests/server/v15-terminal-orbs.test.ts` | 3 tests | 1 failed |
| `tests/server/batch5-g2-rebel-room.test.ts` | 20 tests | 10 failed |
| `tests/server/batch5-g3-mutation-room.test.ts` | 15 tests | 4 failed |
| `tests/server/augment-pool-batch5-r4-room.test.ts` | 0 test |
| `tests/server/augment-pool-batch5-g7-room.test.ts` | 23 tests | 1 failed |
| `tests/server/batch5-h3-cooking-room.test.ts` | 2 tests | 2 skipped |
| `tests/server/batch5-h3-room.test.ts` | 4 tests | 4 skipped |
| `tests/server/batch5-g2-ghost-room.test.ts` | 8 tests | 4 failed |
