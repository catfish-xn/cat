# D3：M02 / M03 / M07 资源所有权事务接口

## 范围与依据

- 仓库 `catfish-xn/cat`，分支 `codex/s13-mech-ownership`。
- fetch 后基线 `origin/integration/s13-augments`：`461c8877254a865a300d60f304bc316c8df8ad11`。
- 依据 `6029d948f6bd191cb8b0853b6d24ac1462150c48:docs/S13_MECHANISM_INVENTORY.md` 表二 M02/M03/M07、第 5/6 节。
- 只读检查 `82d815b0acf210f1269903a5db4df187230e144c:docs/evidence/s13-p1/experiments/` 七个文件；没有移植双排/贪财原型，没有注册英勇福袋、双排或进入未知。
- 新增独立模拟模块与独立单测。现有 Match、内容、数值、digest、版本、录制及种子路线均未修改；不接 D4 的代码。

## 对接边界

这是独立的资源事务领域包，导入路径 `src/simulation/owned-resources`，不是新强化/异常接线，也不是现有 Match 保存格式扩展。

`OwnershipBoundary` 由调用方提供已验证的共享池、全部席位的 MatchState、最后已结算的真实 roundId（未结算为 null）。`createOwnershipState` 检查现有共享池守恒及全部席位绑定，复制资源投影；只接纳未锁战斗的 active preparation，拒绝尚有轮选专用 pendingUnits 的边界。**调用方仍负责认证边界与内容奖励来源**，共享池结构校验本身不证明整局历史。

事务包独占该边界之后的资源投影。调用方不可将输出 pool 与旧 MatchState 混用，也不可直接把 OwnershipSeat 伪装成 MatchState。后续内容适配必须把现有命令/实际结算、来源与保存入口统一接入这一事务边界；本 PR 不宣称这些内容已可玩或服务器/界面已支持托管。当前 deploymentCap 从经过验证的 Match 的 `deploymentCapFor(level, readG23Progress(state))` 冻结；本包不实现购买经验、人口改变、战斗收益或战斗编译。D4 应读取 `seat.preparation`（只含在场/板凳单位），不能把 `held` 加回羁绊或人口。

## 公共函数

```ts
createOwnershipState(boundary: OwnershipBoundary): OwnershipState
assertOwnershipConservation(state: OwnershipState): void
transactOwnership(state: OwnershipState, transaction: OwnershipTransaction,
  authority: OwnershipAuthority): OwnershipResult
previewDuplicator(state: OwnershipState, seatId: string, duplicatorId: string,
  unitId: string, full: 'hold' | 'reject'):
  {ok: true; definitionId: string; destination: 'preparation' | 'holding'} |
  {ok: false; reason: OwnershipFailure}
restoreOwnership(input: unknown, boundary: OwnershipBoundary,
  authority: OwnershipAuthority,
  verifiedTransactions: readonly OwnershipTransaction[]): OwnershipState
serializeOwnership(state: OwnershipState, boundary: OwnershipBoundary,
  authority: OwnershipAuthority,
  verifiedTransactions: readonly OwnershipTransaction[]): string
```

完整类型见 `types.ts`。没有隐含随机源、真实时钟、网络、DOM 或全局注册表写入。

- `OwnershipAuthority.grants` 是独立认证的来源清单：每个 grant 有固定 id、seatId、有序资源列表。资源为英雄定义、装备定义，或带明确 `maxCost: 1|2|3|4|5` 的复制器；这里没有新增可报价内容定义。每个 grant 的全部资源同批提交，一个 grant 只能取得一次。
- `OwnershipTransaction` 是唯一 id + 非空 operations。相同 id 与完全相同操作重试返回原 state、空事件；相同 id 换操作返回 `receipt-conflict`。同来源换事务 id 返回 `already-acquired`。
- `OwnershipResult` 成功为 `{ok:true,state,events}`，失败为 `{ok:false,state:原引用,reason}`；失败没有事件，池、单位/装备/工具、序号、金币、成长、来源、历史均回滚。空托管领取及重复结算没有变更时成功返回原引用、空事件。
- 成功改变状态才发一次 `ownershipCommitted`；实例/消费/合星谱系从已接纳操作重演，池 holdings 的每个基础份额保留不可重复的来源键。

操作：

|kind|输入要点|效果|
|---|---|---|
|acquire|grantId、full|整组占池/生成装备和复制器；满席可整批拒绝或取得同一真实实例的托管所有权|
|hold-unit|seatId、unitId、rounds|移出准备阵容；真实星级、原位置、所装备实例一起托管；绑定与成长仍按原 unitId 保留|
|claim|seatId、holdingId、full|到期后移动原实例；不重新占池、不分配 ID；装备/工具回库存|
|hold-item / hold-duplicator|seatId、对应 instanceId|只有库存实例可取出；不能通过此接口卸下暂离单位的装备|
|duplicate|seatId、duplicatorId、unitId、full|现有可见英雄为目标，校验 maxCost；占一基础份额生成新 1 星实例，同时消费一个工具；不复制装备/异常/成长|
|deploy|seatId、unitId、location|复用既有合法部署/交换校验、统一人口上限；之后尝试移出已到期托管|
|sell|seatId、unitId|仅可见普通英雄；按既有售价、装备返背包、移除绑定/成长、按真实份额退池；之后领取可放置托管|
|merge-live|seatId|显式调用既有三合一 planner、装备/绑定/成长迁移；pool 来源按真实消费事件折叠；托管实例不参与|
|equip|seatId、itemId、unitId、slot|调用既有装备 planner；暂离单位及其装备不在输入中|
|settle|roundId|只接受真实目录/加时的下一个 ordinal；相同当前 ordinal 无副作用；到期尝试归还|

`full` 必须明确是 `hold` 或 `reject`。放置顺序是空板凳，再在冻结的统一人口上限内找合法空棋盘格；没有位置时保持同一托管实例或拒绝整个事务。位置记忆仅供来源取证，归还不挤占其他单位。新的未放置英雄没有虚构板凳位置。

## Q 条目与适用范围

- **Q3（实施）**：暂离期间不出售、不卸装、不合星；不计在场羁绊/人口，仍计所有权/卡池。倒计时是从 `boundRound`（已结算 ordinal）到 `returnRound` 的真实结算数；轮选与加时同样计一轮，不能跳号。到期满席继续托管，同一实例直到腾位。没有实现进入未知的选择、数值或成长发放。
- **Q5（边界）**：逐条列出需内容接线评审的旧约定如下；本包不以“沿用”名义默认触发它们。既有普通卖出/装备/三合一算法只由显式 `sell/equip/merge-live` 操作调用，不改原入口行为。

|旧约定|本包处理 / 后续评审项|
|---|---|
|购买/赠品自动合星与战中延迟合星|只提供显式 merge-live，不给新强化/异常安排自动合星时点；未来消费者需评审|
|轮选特殊领取、冻结阵容与专用 receipts|不冒用；有轮选 pending 的边界拒绝，未来适配需评审|
|G23 自动复制器|不继承；手动工具有独立实例及消费历史|
|池空奖励转金币或无池生成|不继承；本包 pool-empty 整批拒绝，消费工具也回滚；未来内容政策需评审|
|召唤物出售/份额/特殊交互|新奖励和复制目标仅允许 SHOP_CATALOG 英雄；不扩展召唤政策|
|装备、绑定、成长的普通升星迁移/普通售价|复用既有函数；托管不触发这些动作，显式动作的对接时点需消费者评审|

- **Q1/Q2/Q4（本包不实施）**：没有战中经济输入、四星、永久销毁/转装备/团队增益。普通可见单位卖出遵守原有退池/返装备行为，不据此实现 Q4 新内容。

## 保存、恢复、可信输入

`OwnershipState` 完整保存当前 pool、所有席位资源、held、已取得 grantIds 与接纳事务。持有单位存真实身份/星级/附着装备以及原位置和绑定/归还 ordinal，复制器和独立装备也有唯一托管身份。

恢复输入四者分离：候选快照、可信边界、认证来源清单、**该保存点独立验证过的完整接纳命令序列**。先要求候选序列与可信序列相等，再从边界逐条重演，最后逐字段比较整个快照。不能把候选的 transactions 直接当作 verifiedTransactions。后续持久化适配必须保留独立命令证据；本包不凭收据存在/缺失自证领取资格。

删 receipt、删 held、改份额/目标/工具、删除整组资源和事实、截断到更早合法快照，在可信命令序列不变时均拒绝。没有外部可信保存点/日志，任何模块都不能区分“早先合法存档”和“完整回滚篡改”；因此 API 不提供省略可信序列的恢复捷径。恢复本身不发送事件；同命令继续、重复 step/领取返回不重发。

失败枚举：`invalid-state`, `invalid-transaction`, `receipt-conflict`, `unauthorized-grant`, `already-acquired`, `unknown-seat`, `unknown-unit`, `unknown-item`, `unknown-duplicator`, `unknown-holding`, `not-inventory`, `not-returnable`, `invalid-round`, `full-seat`, `pool-empty`, `invalid-target`, `invalid-location`。

## 验证与交付限制

只 typecheck 和相关测试文件逐文件运行；结果见 `docs/evidence/s13-d3/VALIDATION.md`。没有全套测试、录制重生成、服务器或界面修改。新增模块未挂入现有生产调用图；没有修改 content digest、源码指纹或版本号，后续集成若把它接入源码指纹覆盖范围，须由集成方统一更新。D4 最小接口是只读 `OwnershipSeat.preparation` 和同源 `deploymentCap`；无 D4 文件冲突。
