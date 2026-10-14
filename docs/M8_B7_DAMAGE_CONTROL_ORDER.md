# Current status: fixed upstream, B7 regression migrated

2026-10-09: accepted B3 fix from PR22 is included by baseline `947ac7151e180a70446aeece09d8c9e500f2a4b9`, merged into B7 at remote checkpoint `da801827d8fd267fef23c1648f091af4baf4c55c`. B7 does not reimplement the generic damage/control pipeline. Its old characterization now retains the same HP100/maxHP1000/raw150 vector but requires zero applied stun and zero fake cleanup; the added HP1000→850 vector requires packetDamage before the [2,12) stun. See `tests/m8-b7-known-limitations.test.ts` and `docs/evidence/m8-b7/baseline-merge/`.

The original evidence below records the historical defect, not the current implementation. Formal B7 integration/audit remains in progress.

---

# HISTORICAL RECORD ONLY — M8 B7 伤害与控制提交顺序问题记录

状态：**先锋偏差已复现、未修复；先锋机制不在本步签收范围内。** 用户同意先交付独立目录、编译器和问题证据，通用层修复另行安排。本记录不授权修改 B3、被冻结合同或其他效果。

## 1. 固定基线与相关文件

- 接手及问题根源基线：`5bd7968ee31e107e12701145aa4fdac0bec7ea8d`。
- B7 三个独立模块的首个 checkpoint：`4d84c5012362cfd22db03383947f47b2387672de`。
- 批准语义：[M8B_ENCOUNTERS §4.5](M8B_ENCOUNTERS.md#45-先锋开场有限冲锋魔伤和短眩晕)、[POLICY P-M05](M8B_POLICY.md#74-五类招牌机制的精确边界)。
- 当前新增编译入口：[neutral-encounter-compiler.ts](../src/simulation/neutral-encounter-compiler.ts)，`compileNeutralEncounter('6-7')` 将已批准先锋声明映射成既有 opening task 的 damage + apply-status。
- 可运行的最小复现：[m8-b7-known-limitations.test.ts](../tests/m8-b7-known-limitations.test.ts)。这是一项明确命名的现状证明测试，其绿色不表示批准语义通过。

以下源码行号固定指向接手基线，不依赖后续分支移动：

| 接点 | 基线代码 | 作用 |
| --- | --- | --- |
| 开场任务 | `src/simulation/combat-s13.ts:193–199` | 依次对同一目标调用 task.effects；此时目标按伤害提交前 HP 判存活 |
| damage effect | `src/simulation/m8/s13-mechanisms.ts:90–91` | 只向 `ctx.packets` 加包，尚不更新 HP |
| apply-status effect | `src/simulation/m8/s13-mechanisms.ts:96` | 立即调用 applyFrozenStatus，登记状态及 applied 事件 |
| 状态登记 | `src/simulation/m8/s13-mechanisms.ts:47–60` | 写状态贡献并发出 statusChanged；next-tick 控制的生效期虽在将来，登记已发生 |
| 伤害提交 | `src/simulation/combat-s13.ts:260–313` | 更新 virtualHp、发 packetDamage/kill 等事件；晚于开场 apply-status |
| 死亡清理 | `src/simulation/m8/s13-mechanisms.ts:286–304` | 移除已死单位状态，无法撤销账本中已经发出的 applied 事件 |

## 2. 最小复现

环境：Node22.23.3、仓库锁定依赖。运行：

```sh
npm test -- tests/m8-b7-known-limitations.test.ts
```

该测试不是替身能力夹具：施害方来自真实 `compileNeutralEncounter('6-7')` 的 `pve-rift-herald`，实例 ID 为 `["pve","6-7","rift-herald-v1","h01"]`，能力来源为 `void-charge-project-v1`。

边界输入：

- 先锋沿批准目录位于 `(3,1)`；把普通攻击/移动冷却设高，仅隔离开场冲锋，不修改其机制参数。
- 唯一玩家目标 `p` 位于 `(3,4)`，`maxHp=1000`、`hp=100`、魔抗0、护盾0，无免控/完全防伤；其普通行动同样禁用。
- 先锋实际路径为 `(4,2)→(3,3)→(3,4)→(2,5)`，tick0 到达空格 `(2,5)`，目标 `p` 冻结为唯一冲锋受击者。
- 请求伤害按独立手算 `min(floor(1000×1500/10000),300)=150`，大于目标当前100HP。冲锋与控制均不抽 RNG、不施法、不产生普攻。

## 3. 预期与实际

### 预期（批准语义）

1. tick0 位移完成，排定一次 tick1 冲锋任务。
2. tick1 对目标提交150原始魔伤，实际扣除100HP，目标死亡。
3. 该目标不满足“其后给存活目标”条件，因此不应出现针对它的眩晕施加事件/贡献。
4. 对未被击杀且不免控的目标，才施加10tick眩晕，从tick2生效，到tick12前结束。完全防伤不能自动等同免控。

### 实际（当前基线，可重复）

相关事件的先后关系如下，其他 targetChanged 等无关事件从展示中省略：

| 顺序 | tick | 事件 |
| --- | ---: | --- |
| 1 | 0 | movement：先锋到 `(2,5)` |
| 2 | 1 | statusChanged：`p`，reason=applied，kind=stun，startsAtTick=2，expiresAtTick=12 |
| 3 | 1 | packetDamage：`p`，magic，raw=150，hpDamage=100，critical=false |
| 4 | 1 | statusChanged：`p`，reason=death-cleanup，移除已登记控制 |
| 5 | 1 | death：`p`；终态 hp=0、alive=false、statuses=[] |

复现测试直接断言“applied stun 的事件下标 < packetDamage 的事件下标”、150/100伤害值、死亡清理和最终空状态。结果稳定，RNG消费为0。

## 4. 后果与签收边界

- 这不表示目标在tick1提前被眩晕：控制有效期仍是 `[2,12)`，死亡后也不会留下活跃眩晕。
- 偏差在于控制已对随后被同一冲锋杀死的目标登记，并在伤害事件之前出现在不可删除的领域账本中；它违反该新机制明确批准的“先伤害、随后对存活目标控制”。
- 只检查最终HP、最终statuses或常规存活目标，会漏掉此偏差；UI动画节流或恢复后忽略事件均不是修复。
- 本步没有把新增内容 import 到现有 Match，未改变当前正式游戏行为。问题会阻塞真实先锋机制的正式接线/验收，不阻塞独立目录数据的保存。
- 当前27项定向测试中的1项是这个已知偏差的 characterization。独立子集的签收不得将这项绿色解读为先锋完成。

## 5. 修复方向（只建议，未实施）

优先在通用战斗执行路径表达有限的“伤害提交后控制”关系，使控制消费与它对应的已规划伤害动作/目标绑定，并在正确的结算时点重新检查目标存活及免控。不要按 `pve-rift-herald` 名称/ID 添加旁路，也不要在目录编译器内复制伤害算法。

后续修复必须同时保持：

- 冲锋开场位移与tick1任务各只消费一次，恢复不重发，不撤销已经完成的位移。
- 来源在任务执行前死亡或已有效控制时，原取消语义不变。
- 无论伤害被护盾吸收或被完全防止，只要目标存活且不免控，控制资格仍按批准规则判断；不能只监听“正伤害”事件。
- 控制下一tick才生效，持续10tick，不额外抽词或伪造 cast/attack 事件。
- 完整账本顺序、同tick其他包、多目标与免控交互有独立测试。

**不能直接把 apply-status 改成现有 damage-dealt 触发器**：当前 damage-dealt 只在 `absorbed + hpDamage > 0` 时触发，完全防伤将使合法控制丢失。最终修复方案与控制检查是在对应包提交后还是整个伤害批后，须在修复任务中对齐批准语义并独立审查，不能由本次数据交付隐式改规则。

建议后续最小回归集：100/1000致死无控制、1000/1000存活150伤害后控制、4000maxHP封顶300、免控、完全防伤、护盾、同tick后续伤害、source取消、局部续算/恢复、唯一任务与0RNG；同步检查相关通用机制回归。

## 6. 其他“伤害+控制”效果的只读排查

排查快照为 `4d84c5012362cfd22db03383947f47b2387672de`（相关既有代码与接手基线一致）。仅搜索/读取本分支 `src`，并使用 Node22 临时脚本调用真实 `stepCombat`；没有修改其他效果或新增其正式测试。未运行全量测试，以下不代替完整回归。

### 6.1 相同账本形态，但尚未构成同一确证缺陷

| 效果 | 实现与复现场景 | 实际相关事件 | 合同依据与结论 |
| --- | --- | --- | --- |
| 婕拉 | `combat-s13-abilities.ts:80–83`；一星、AP100，目标maxHP10000/currentHP50，魔抗0，真实tick1技能 | stun applied（index5，starts2/expires22）→packetDamage（index7，raw260/hpDamage50）→death-cleanup（index14）→death（index15） | `M8_RULES.md:341`写魔伤和20tick控制，`:450`要求新控制下一tick；未找到“伤害后且存活才登记”。同样的账本形态，**不列为已确认bug** |
| 斯卡 | `combat-s13-abilities.ts:124–128`；同样的一星、AP100及目标条件 | stun applied（index5，starts2/expires32）→packetDamage（index8，raw80/hpDamage50）→death-cleanup（index16）→death（index17） | `M8_RULES.md:348,450`；结论同婕拉，**不列为已确认bug** |

两者的最终目标均为 hp0/alive=false/statuses=[]。另做目标currentHP10000的存活对照：目标tick1仍可攻击，tick2被控制阻止，区间分别为 `[2,22)` 和 `[2,32)`。因此“applied事件在伤害前”不能被改写为“同tick提前眩晕”。是否需要变更这些既有能力的账本顺序，应先有它们自身的明确合同/设计决定。

相关共性：`combat-s13-abilities.ts:26–29,45–47` 的 hit/packet 仅排队；`combat-s13-state.ts:140–141,173–183` 在 applyStatus 时立即登记并发出 applied 事件。

### 6.2 通用结构风险，不代表现有装备新增缺陷

- `m8/s13-mechanisms.ts:90–96` 对 damage 入队、对 apply-status 当场登记；开场循环 `combat-s13.ts:193–199`、触发循环 `m8/s13-triggers.ts:32–45`、周期循环 `m8/s13-mechanisms.ts:184–188` 都不会因为 `Effect[]` 的书写顺序是 `[damage, stun]` 就等待伤害HP提交。
- 临时合成 `attack-completed` 触发 `[damage100, next-tick stun10]`，面对HP50的目标，真实stepCombat也呈现 applied→0伤普攻→100致死包→death-cleanup。这是通用机制结构的边界证明，**不是现有线上装备含有该控制的证据**。
- 如果未来内容明确要求“伤害后对存活者控制”，必须有相应执行语义，不能只依赖数组先后。先锋是当前有这项明确批准要求的已复现实例。

### 6.3 不能误改的合法反例与其他减益

- 电刀明确要求**先shred，再35魔伤**：`content/items-bow.ts:142,159`、`M8_RULES.md:139,447`。`m8/s13-triggers.ts:35–45` 专门把 immediate 状态前缀绑定到后续伤害包的 beforeDamage，`combat-s13.ts:320` 在该包前应用。不能为修先锋而全局把所有状态推到伤害后。
- 厄加特、芮尔、库奇、凯特琳是“伤害+减益”而非对敌硬控，相关 `combat-s13-abilities.ts:88–100,203–214` 与 `M8_RULES.md:451,455–456` 明确下一tick生效；未发现相同的伤害后存活登记要求，本次没有把它们列为同一缺陷。
- 本次全src检索对敌 stun/apply-status，既有生产能力中的硬控入口为婕拉/斯卡，新增隔离内容中另有先锋；引导/自身免控不作为对敌“伤害+控制”归类。不据此宣称所有将来的声明组合均已穷举验证。

结论：**确证违反其自身批准语义的仍只有先锋。** 婕拉/斯卡记录为相似现象且下一tick生效合规，通用Effect顺序为未来内容风险，电刀是必须保护的先状态后伤害反例。本次只读排查不授权扩大修复范围。

## 7. 关联交接

完整文件/测试/未执行事项见 [M8_B7_HANDOFF.md](M8_B7_HANDOFF.md)。本问题记录不宣称独立审计完成，不替代完整CI或用户签收。
