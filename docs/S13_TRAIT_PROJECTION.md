# D4 / M09 统一动态羁绊投影

基线：`origin/integration/s13-augments`，fetch 后完整 SHA `461c8877254a865a300d60f304bc316c8df8ad11`。
工作分支：`codex/s13-mech-trait-projection`；目标：`integration/s13-augments`。
依据：盘点分支 `6029d948f6bd191cb8b0853b6d24ac1462150c48` 第 5 节和表二 M09。
`82d815b0acf210f1269903a5db4df187230e144c` 下七个 experiments 文件仅只读参考，没有接入原型。

## 最小接口

`src/simulation/traits/effective-membership.ts`：

```ts
projectEffectiveMembership(preparation: GameState, context?: TraitProjectionContext,
  definitions?: Readonly<Record<string, TraitDefinition>>): EffectiveMembership

deriveEffectiveTraits(projection: EffectiveMembership, team: Team,
  definitions?: Readonly<Record<string, TraitDefinition>>): TraitSnapshot[]

deriveEffectiveTrait(projection: EffectiveMembership, team: Team, traitId: string,
  definitions?: Readonly<Record<string, TraitDefinition>>): TraitSnapshot
```

`TraitProjectionContext = { round, sources }`。来源有不可空且不重复的 `sourceId`、`activeFromRound`、`expiresBeforeRound`，区间左闭右开；round 是真实回合 ordinal，不按战斗场次或墙钟计时。
来源操作：`add-unit(unit)`、`remove-unit(unitId)`、`add-trait/remove-trait(unitId, traitId)`、`emblem(unitId, traitId, itemInstanceId)`。
返回投影棋盘和逐单位、逐羁绊的 `sourceIds`，原输入、所有权、资源、装备、RNG、收据完全不写入；每次从输入重算，无可变状态缓存。

兼容入口及未来消费者：

```ts
deriveTraits(preparation, team, definitions?, context?)
buildStrategySnapshot(inputs, catalog?, context?)
createCombatWithEvents(preparation, strategy, combatId, rngState?, context?)
applyRoundSettlement(state, receipt, unitLootPolicy?, context?)
```

预览、编译、实际开战必须传入同一份原始准备棋盘及同一份已验证 context，不能把投影棋盘当原棋盘再次投影；实际开战从编译后的 traits 产生黑色玫瑰召唤。结算则以当前棋盘和该回合有效来源重新算征服者/化学男爵档位，拒绝不一致收据。编译/结算还要求 context.round 等于输入 round。
`memberUnitIds` 仅在某羁绊成员实例与原生定义不同的时候附加；普通内容的 snapshot 字段和结果保持原样。成员额外属性按实例判断；黑色玫瑰星级/召唤/施法计数、实验品实验室消费者均读相同成员投影。恢复校验读取可信 strategy 的成员身份，不读取待验证候选的自报成员身份。

投影层只校验声明的结构与互斥，不认证来源真实性。未来名片、进入未知、升级咯、双排的消费者必须先从可信选择/所有权/回合事实重建 sources，再同时供预览、开战、结算及恢复使用。不能从待验证存档自行取 sources 证明自身。本任务没有新增 Match 存档字段，也没有让 restoreMatch 接受未经授权的临时来源；测试包括现有真实存档恢复后的相同投影，以及外部声明 JSON 重建与逐 tick 事件/RNG 一致。

## Q 条目与边界

- **Q3（项目约定与来源核查边界）**：本包的暂离投影接口只移出投影，不销毁、不释放所有权；有效期参数使用统一回合 ordinal，可表达轮选、加时，但这不证明原版进入未知的回合计数或交互规则。依据 dot/TASKS.md 最新更新（2026-10-19 14:20 +08）的调度转述，必须先核查原版来源，查不到才使用托管至有空位、暂离禁卖/卸装/合星等项目兜底约定。原版来源核查、证据与结论记录及具体内容接线由 D3/后续内容方承接；D4 未完成该取证，不把上述约定声称为原版事实，也不实施托管内容或依赖 D3 未审代码。
- **Q5**：没有把旧特殊约定扩成新规则。待逐项确认后才接内容：双计成员如何与同名英雄去重组合；同目标多来源增删/多个纹章的优先级及叠加；完整纹章副效果与可发子集；关系强化授予/移除成员的资格；临时加入真实单位与战斗代理的人口/所有权差别。
- Q5 未定组合目前严格拒绝：同一来源重复、同目标同羁绊并发操作、重复纹章实例、已有原生成员再加同羁绊、唯一羁绊授予。没有自动双计、覆盖或默默叠加。唯一羁绊按当前定义中单独一个 1 门槛档识别，特使 1/4 档仍遵循现有特例；不新增档位。
- **Q1/Q2/Q4**：本包不实施战中金币、四星或永久销毁/团队永久属性，未借此扩范围。
- 人口资格仍由既有 `getDeploymentCap` / `deploymentCapFor` 处理；本包没有第二套人口上限，也不会把投影加入解释为资源领取。

与 D3 的潜在共享入口：`round-settlement.ts` 新增尾部可选 context；`combat.ts` 新增尾部可选 context；`strategy-snapshot.ts` 新增第三个可选 context。既有调用全部兼容。D3 只需提供已验证的真实实例与有效回合来源，不需改资源事务来缓存派生计数。本包没有改所有权、serial、fold、shared-pool、server 目录。

## 验收与限制

新增 `tests/s13-trait-projection.test.ts`：12 项，包含所有当前英雄的独立原生计数 oracle、临时单位进出、临时纹章到期、不同实例属性、bench/enemy/暂离排除、成员移除、黑色玫瑰、实验品、冲突拒绝、不缓存，以及当前棋盘征服者 4↔2 / 化学男爵 3↔4 的真实结算与唯一收据幂等。
新增测试首次运行暴露的是测试向量误用 legacy 单位和误写现有数值（哨兵成员额外护甲 24、未达连败的微光 15/20）；仅修正本次新增测试的手算输入/预期，未改任何已有断言、时限或规则数据。

只运行 typecheck 与相关测试文件，逐文件执行；不跑全套、不改任何历史录制/种子路线、raw 历史目录不使用 --write。确切逐文件条数/耗时见 PR。
D4 初次交付时没有更新历史录制及源码指纹；D6 的专门授权仅允许下述 G2-4b 重录流程，替代该范围内原先统一由集成方更新的说明。不改 content digest、版本号、数值档位、内容注册；没有接新强化或异常。独立评审由调度方另一个会话进行，本包不自称独立签收。

## D4 初次验证结果

`npm run typecheck` 通过。32 个相关文件逐文件执行，全部通过，共 461 项、进程墙钟合计 124.862 秒（含 npm/Vitest 启动）。最终补充来源排序/object 恢复检查后，新文件再次 12/12 通过，Vitest 2.42 秒；无新增失败或跳过。

| 文件 | 通过条数 | 进程秒数 |
| --- | ---: | ---: |
| `tests/g2-2-traits.test.ts` | 10 | 2.168 |
| `tests/g2-3-hook-failures.test.ts` | 8 | 2.141 |
| `tests/g2-3-followup.test.ts` | 11 | 2.297 |
| `tests/g2-3-netcode-hooks.test.ts` | 14 | 7.288 |
| `tests/g2-4a-conqueror-items.test.ts` | 6 | 1.811 |
| `tests/g2-4b-artifact-forge.test.ts` | 7 | 3.230 |
| `tests/g2-3-lesser-shimmer-duplicator.test.ts` | 37 | 10.099 |
| `tests/g2-1-content.test.ts` | 33 | 2.273 |
| `tests/g2-3-traits.test.ts` | 19 | 1.816 |
| `tests/g2-4a-crown.test.ts` | 6 | 2.338 |
| `tests/g2-3-integration.test.ts` | 18 | 3.026 |
| `tests/g2-4b-pr161-restore.test.ts` | 11 | 12.619 |
| `tests/g2-4b-reward-order.test.ts` | 1 | 1.133 |
| `tests/g2-4a-crown-gold.test.ts` | 9 | 4.529 |
| `tests/g2-4b-support-forge.test.ts` | 8 | 3.899 |
| `tests/g2-4b-gold-settlement.test.ts` | 2 | 1.814 |
| `tests/m5-content.test.ts` | 9 | 1.065 |
| `tests/g2-augments-static.test.ts` | 70 | 1.980 |
| `tests/g2-augments-multiplayer.test.ts` | 6 | 3.584 |
| `tests/m4-strategy-snapshot.test.ts` | 10 | 2.286 |
| `tests/m8-b7-match-wiring.test.ts` | 30 | 22.975 |
| `tests/s13-trait-projection.test.ts` | 12 | 2.120 |
| `tests/mp-overtime-choices.test.ts` | 1 | 2.147 |
| `tests/s13-anomalies-c.test.ts` | 8 | 1.854 |
| `tests/s13-anomalies-settlement.test.ts` | 4 | 1.996 |
| `tests/t5r-private-seat-view.test.ts` | 15 | 2.837 |
| `tests/t3-round-settlement.test.ts` | 10 | 5.054 |
| `tests/g2-3-skills.test.ts` | 18 | 2.139 |
| `tests/m4-effect-combat.test.ts` | 7 | 2.636 |
| `tests/m5-serialization.test.ts` | 33 | 3.560 |
| `tests/m8-b8-restore.test.ts` | 7 | 3.133 |
| `tests/t2-two-sided-battle.test.ts` | 21 | 3.003 |

## 变更文件清单

- `docs/S13_TRAIT_PROJECTION.md`
- `src/simulation/combat-g2-3-summons.ts`
- `src/simulation/combat-runtime-facts.ts`
- `src/simulation/combat.ts`
- `src/simulation/g2-3-experiment.ts`
- `src/simulation/g2-3-summons.ts`
- `src/simulation/g2-4b-voidspawn.ts`
- `src/simulation/round-settlement.ts`
- `src/simulation/strategy-g2-2.ts`
- `src/simulation/strategy-snapshot.ts`
- `src/simulation/strategy-types.ts`
- `src/simulation/trait-snapshot.ts`
- `src/simulation/traits/effective-membership.ts`
- `tests/s13-trait-projection.test.ts`

## D6：独立评审第 1 项修复

起点为远端核实的 `5936426d6b4efa690b202aedbe2557e0ddb5aeed`，保留上文 Q3 文档澄清；原实现为 `479b17fe0b3f13e0e8cb48e5cbb3ab857399c611`（调度方已报告固定 CI626 success）。

卓尔不群现在优先读冻结快照的 `memberUnitIds`，原生快照无该字段时仍按 `memberDefinitionIds` 兼容。两只 Lux 仅一只获征服者纹章时，只有获纹章且羁绊激活的实例取消卓尔不群；另一只仍获得第 2 阶段的 240 生命和 4500 基点攻速（2026-10-28 批准对齐 14.24；见 [来源报告](AUGMENT_14_24_ALIGNMENT.md)）。移出原生成员也按实例生效。

攀登天梯死亡结算接收开战冻结 `strategy.traits`，按实例判断共享成员，包含未激活羁绊；不从单位原生 traits 猜动态成员。无 strategy 的独立调用保留原生兼容行为。恢复的共享资格和完整四项奖励检查读可信重编译 `expectedStrategy.traits`，不读候选自报的 strategy。缺失奖励、移出成员后伪造奖励仍拒绝，没有删除、跳过或放宽校验。

新增 `tests/s13-trait-augment-membership.test.ts`（11 项）：同名副本单纹章、临时加入/移出成员与到期、未激活共享羁绊、实际致死 tick、奖励只发一次、JSON 续战、缺失及伪造奖励拒绝，以及无 context/空 context 的原生数值与独立调用一致。仅新增测试，未改任何旧断言或时限。

**单机待办（评审第 2 项，本轮明确不做）**：`g2-3-settlement.ts` / `match.ts` 的单人结算仍沿现有冻结开战档位；改为当前棋盘重算可能新增命令拒绝。依据调度方转述的用户 2026-10-19 06:29 选择，暂不补这一项；本轮没有修改这两处，也不声称单人当前棋盘重算已完成。

**指纹授权与边界**：只按本轮明确授权，在 LF（`core.autocrlf=false`）下执行：

1. `node tests/fixtures/record-g2-4b-herald.cjs --write`
2. `node scripts/record-g2-4b-inputs.cjs --baseline-commit=a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53`
3. `node scripts/record-g2-4b-inputs.cjs --baseline-commit=a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53 --check`
4. `node tests/fixtures/record-g2-4b-herald.cjs`

其中 baseCommit 来自 `docs/evidence/g2-4b/release-audit.json`，不是 PR 基线 `461c8877254a865a300d60f304bc316c8df8ad11`。不写 g2-3/g2-augments 历史目录，不运行 `verify-m8-herald --write`，不重录其他路线；不改规则数值、digest、版本。Q3 来源核查边界保持不变，本轮不新增内容，不扩展 Q6–Q8。

### D6 变更文件与定位

| 文件 | 行 | 用途 |
| --- | ---: | --- |
| `src/simulation/augment-effects.ts` | 38 | 卓尔不群按冻结实例成员判断激活资格 |
| `src/simulation/combat-augment-effects.ts` | 59 | 攀登天梯共享成员与死亡奖励 |
| `src/simulation/combat-s13.ts` | 628 | 实际死亡边界传入冻结 traits |
| `src/simulation/traits/effective-membership.ts` | 132 | 实例成员统一读取与原生兼容 |
| `src/simulation/m8/restore.ts` | 18、64、132 | 恢复共享资格及完整奖励严格校验 |
| `src/simulation/serialization-structure.ts` | 354 | 提供可信重编译快照 |
| `tests/s13-trait-augment-membership.test.ts` | 1 | 11 项新增数值及恢复反例 |
| `tests/fixtures/g2-4b-herald-raw/manifest.json` | 1 | 授权生成的源码指纹更新 |
| `docs/evidence/g2-4b/input-fixture-audit.json` | 1 | 授权生成的输入审计与源码映射 |
| `docs/S13_TRAIT_PROJECTION.md` | 115 | D6 修复、单机待办及验证说明 |

四步重录/检查均 exit 0：Herald write 的脚本耗时 44.662 秒，inputs 生成 3.754 秒，inputs `--check` 3.092 秒，Herald 默认确认进程耗时 43.847 秒。baseCommit 保持 `a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53`；最终 sourceSha256 为 `f4132de790609a19b2132ac0667e25f603306de0c43a4b7df62db06d2b7af2f1`。

独立比较旧/新 manifest：仅 `sources`、`sourceSha256` 两个键变化，五份 raw 状态与轨迹原字节一致；c19 和 b8 fingerprints 文件也没有变化。历史目录未写入，release-audit.json 未更改，规则版本与 content digest 保持不变。

### D6 验证结果

`npm run typecheck` 通过；37 个相关文件逐文件串行运行，全部通过，共 539 项，进程墙钟合计 152.883 秒（含 npm/Vitest 启动），不运行全套。新增 11 项包含在总数内。未修改已有断言或时限，没有删除、跳过测试。

| 文件 | 通过条数 | 进程秒数 |
| --- | ---: | ---: |
| `tests/g2-2-traits.test.ts` | 10 | 2.168 |
| `tests/g2-4a-crown-gold.test.ts` | 9 | 5.016 |
| `tests/g2-3-hook-failures.test.ts` | 8 | 1.870 |
| `tests/g2-3-netcode-hooks.test.ts` | 14 | 7.388 |
| `tests/g2-4b-gold-settlement.test.ts` | 2 | 1.802 |
| `tests/g2-4a-conqueror-items.test.ts` | 6 | 1.783 |
| `tests/g2-4b-artifact-forge.test.ts` | 7 | 3.263 |
| `tests/g2-3-followup.test.ts` | 11 | 2.042 |
| `tests/g2-augments-multiplayer.test.ts` | 6 | 3.486 |
| `tests/g2-3-lesser-shimmer-duplicator.test.ts` | 37 | 10.081 |
| `tests/g2-3-traits.test.ts` | 19 | 1.995 |
| `tests/g2-4a-crown.test.ts` | 6 | 2.464 |
| `tests/g2-4b-pr161-restore.test.ts` | 11 | 13.244 |
| `tests/g2-4b-reward-order.test.ts` | 1 | 1.161 |
| `tests/g2-1-content.test.ts` | 33 | 2.392 |
| `tests/g2-3-integration.test.ts` | 18 | 3.233 |
| `tests/g2-4b-support-forge.test.ts` | 8 | 3.913 |
| `tests/g2-augments-static.test.ts` | 70 | 1.982 |
| `tests/m5-content.test.ts` | 9 | 1.142 |
| `tests/m4-strategy-snapshot.test.ts` | 10 | 2.001 |
| `tests/m8-b7-match-wiring.test.ts` | 30 | 22.182 |
| `tests/s13-trait-projection.test.ts` | 12 | 2.296 |
| `tests/s13-trait-augment-membership.test.ts` | 11 | 1.988 |
| `tests/mp-overtime-choices.test.ts` | 1 | 2.226 |
| `tests/s13-anomalies-c.test.ts` | 8 | 1.969 |
| `tests/t5r-private-seat-view.test.ts` | 15 | 2.428 |
| `tests/s13-anomalies-settlement.test.ts` | 4 | 2.063 |
| `tests/t3-round-settlement.test.ts` | 10 | 4.017 |
| `tests/g2-3-skills.test.ts` | 18 | 1.644 |
| `tests/m4-effect-combat.test.ts` | 7 | 1.956 |
| `tests/m5-serialization.test.ts` | 33 | 2.543 |
| `tests/m8-b8-restore.test.ts` | 7 | 3.265 |
| `tests/t2-two-sided-battle.test.ts` | 21 | 3.512 |
| `tests/g2-augments-choice.test.ts` | 35 | 4.425 |
| `tests/g2-augments-combat.test.ts` | 16 | 4.264 |
| `tests/g2-augments-identity.test.ts` | 1 | 2.047 |
| `tests/b8-resumable-battle.test.ts` | 15 | 17.620 |
