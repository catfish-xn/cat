# T11 规则与 golden 审计

用户签字依据见 [S13_RULES_GAP](../../S13_RULES_GAP.md) 顶部。实现基线为 `origin/multiplayer@67b22b9848beb18b84a2cf716113ea833a44de43`。唯一数值变化是 1-4 naturalXp 0→2；XP 阈值、金币、掉落表、随机算法、日程和服务器调度不变。

## 独立依据与版本

先写 `t11-opening-xp.test.ts`：`0+2+2+2-(2+2)=2`，所以进入 2-1 为三级 2/6 XP、`0+2+3+5=10G`。旧实现下单人/八席两条均因 XP=0 失败，改参数后通过。独立 `tests/fixtures/m5/oracle.cjs` 不导入生产规则，仍逐事务核对收入、阈值、消耗、商店与 RNG；仅把手写的 1-4 例外取消。已有胜/败/平、主动买 XP、上限、唯一收据和恢复断言继续生效。

| 身份 | 旧 | 新 |
| --- | --- | --- |
| 开局细分规则 | m8b-opening-project-v1 | m8b-opening-project-v2 |
| CONTENT_DIGEST | fnv1a32-utf16:a0b38123 | fnv1a32-utf16:b4a5c2e2 |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:d03edab3 | fnv1a32-utf16:7b14bfba |

外层 M8 格式与协议不变；旧档拒绝，不补账。第二个 digest 因其 openingPolicy 引用改变，不表示掉落内容/权重变更。

## 每个 golden 的原因

原 B9 `full-match-golden.json`、`m8-herald-raw/*` 和 T1/T10 探针均原样保留，历史审计继续验证它们。运行回归改用 T11 新文件，避免重写已签收证据。旧 B9 文件的 contentDigest 仍是 c7ac9b0c，已落后于 T10；本次因果比较专门运行最新父提交 67b22b9 与当前实现两套路线，未把历史基线积累的身份变化都归因于 T11。

| 新 golden / 条目 | 变化原因及证据 |
| --- | --- |
| `tests/t11-content-baseline.json` | 首场未经过 1-4，数值无变化；仅 contentDigest 与 frozen.replayDigest 改变，状态 SHA 变为 `5eef930e…`。归一化这两个字段后全部 165 个首场状态与 T10 逐字节相等；继续归一化历史内容身份可重现 T1。事件/RNG 原 SHA 不变。 |
| `tests/fixtures/m5/full-match-golden.t11.json` / cannon | 2-2 结算提早升四；策略买 XP 21→20 次、刷新 31→32 次，后续金币/商店/阵容/战斗改变，指令总数仍为 194。首个战斗事件变化为 3-1。 |
| 同文件 / sniper | 2-2 提早升四，2-3 即可多部署；刷新 20→21 次，指令 182→183，首个战斗事件变化为 2-3。 |
| 同文件 / mage | 2-3 准备少花一次买 XP 的 4G，2-4 利息由 1→2，随后策略路径改变；全局刷新 12→14 次，指令 176→178，首个战斗事件变化为 3-1。 |
| 同文件 / sniper-caitlyn | 前缀同 sniper；后期搜女警的随机路线随额外经验/经济改变，刷新 20→23 次，指令 185→188；仍有 12 场实际女警战斗。 |
| `tests/fixtures/t11-herald-raw/ionic-spark.json` | 继承新的 sniper 4-4 公开获取前缀，再执行原离子火花分支；升级/经济/RNG 历史与两个 digest 改变，装备与准备阵容本身保持原样。 |
| `…/evenshroud.json` | 同一前缀变化传入原薄暮法袍分支；装备/准备阵容未改，不能只给旧存档贴新 digest。 |
| `…/ionic-spark--evenshroud.json` | 同一前缀变化传入原双装备分支；仍验证双装备合法恢复及削减效果，不改装备配置。 |
| `…/quicksilver.json` | 同一前缀变化传入原水银分支；仍保留免控恢复边界，装备/准备阵容未改。 |
| `…/edge-of-night.json` | 同一前缀变化传入原夜之锋刃分支；仍保留清理/免控恢复边界，装备/准备阵容未改。 |
| `…/trajectory.json` | 记录上述公开指令及真实战斗新哈希；每分支仍 14 战，5844→5833 ticks，最终 HP 61→64、金币 229→231，投资强化累计 HP 1024→1056，均来自原策略在新经济下的结果，不是新规则常量。 |
| `…/manifest.json` | 重建源文件 SHA、当前版本身份、原始导出 SHA 与 trajectory SHA，绑定五份新样本。 |

四条整局均保持 38 轮、33 战、6-7 胜利、完整成装链；精确逐轮差异见 [golden-audit.json](golden-audit.json)。全局状态哈希都变是身份变化；事件只在真实后续轨迹改变时变化。各 Herald 文件先从公开命令生成原始字节，再导入生产恢复器；五份均通过准备、开战及前 15 tick 恢复/接续一致性验证。

## 可复现流程

```sh
node scripts/update-t11-golden.cjs --capture /tmp/t11-review
node scripts/update-t11-golden.cjs --audit /tmp/t11-review
# 审核 audit 后，把实际打印的 SHA 作为第三个参数：
node scripts/update-t11-golden.cjs --apply /tmp/t11-review <audit-sha256>
node scripts/verify-m8-herald-fixtures.cjs --write
node scripts/verify-m8-herald-fixtures.cjs
npm run typecheck
npm run test:server-entry
npm test -- tests/t11- tests/m8-b6-opening-economy.test.ts tests/m8-b6-match-wiring.test.ts tests/m8-b6-round-catalog.test.ts tests/m8-b7-match-wiring.test.ts tests/m8-b8-loot-runtime.test.ts tests/m8-b8-oracle.test.ts tests/m8-b8-command-oracle.test.ts tests/m8-b8-live-economy.test.ts tests/m8-b8-live-cross-round.test.ts tests/match-economy.test.ts tests/m5-economy.test.ts tests/progression.test.ts tests/t3-round-settlement.test.ts tests/tp-rewards-and-rounds.test.ts tests/server/round-commit.test.ts tests/m5-route.test.ts tests/m8-b9-golden-guard.test.mjs
```

采集目录必须新建（本次 audit SHA 为 `2bbbfc3a475a2a5f74060970587df42b31cc892c3b3ccc4e891f6494ccf4ec4d`）。golden 是轨迹证据，不替代独立经济断言；测试未放宽阈值或跳过失败。整局性能用例首次并行运行 30.535 秒超过既有 30 秒门槛，降低运行并发后单独复核，不改测试门槛。验收不包含真机/UI 浏览器试玩。

## T11 装备夹具补记（2026-10-13）

T12 基线检查发现两份 B5 装备测试仍写死 T11 前的经验路线；用户要求以独立小 PR 修正，不改生产代码、版本或 golden。

- `m8-b5-equipment-history.test.ts` 的 8 条用例共用路线：开局 6XP，加 2-1…2-7 七次各 2XP，共 20XP，恰等于升级累计 `2+2+6+10`，因此进入 3-1 为五级 0XP（旧四级）。自然升四的边界从 2-3 提前到 2-2：检查结算前/后装备 roll 上限的伪造目标同步改为 2-2，仍拒绝把本场三级 roll 伪造为战后四级。2-4 roll 仍四级，3-1 roll 改五级；低于上一轮等级的伪造仍拒绝，合法保存恢复和历史回放仍完整验证。
- `m8-b5-temporary.test.ts` 的跨级购买路线保留同样购买次数和 4G 余额；T11 增加的 2XP 使装备时经验从六级 32XP 变为六级 34XP。随后买 4XP 仍升七级，既有父实例 roll 不刷新、出售重穿不重抽的断言不变。

验证：`npm run typecheck` 通过；`npm test -- tests/m8-b5-equipment-history.test.ts tests/m8-b5-temporary.test.ts --maxWorkers=2` 两文件 38 条全部通过。修复的是旧路线预期，不是修改升级阈值、装备 RNG 或恢复合法性规则。
