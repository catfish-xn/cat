# Set13 八人联机合同草案

日期：2026-10-12  
版本：draft 0.1  
适用目标：八人联机、共享有限卡池、机器人补位、6-7 后 PvP 加时  
状态：明确用户决定与实现边界，具体数值及未决玩法按对应任务定稿  
关联：[任务划分](MULTIPLAYER_N0_BASELINE.md)与[整改方案](MULTIPLAYER_RENOVATION_V2.md)

## 1 决定的效力

用户已经确定：开局八席；真人不足以机器人补满；首版使用共享有限卡池；6-7 后继续 PvP 加时直到决出最终名次。实现者不得改回独立无限商店或固定末轮按血量直接结束。

以下职责与一致性规则属于实现该目标的技术边界。具体卡池份数、奖励缺货补偿、平局及同轮名次规则标明为建议或待核定，不冒称用户已经逐项批准，也不改写旧 M8 离线合同。

## 2 对象和权威

- RoomState 拥有八席、共享库存、全房阶段、轮次、截止、配对与排名。
- SeatState 拥有本席资产、商店预留、HP、经验、待选项与事件位置。
- SharedPoolState 按英雄定义记录初始份数、可用份数及合法占用；不把英雄种类数量误当成每种英雄份数。
- RoomCommandTransaction 是修改卡池和席位资产的唯一提交边界，客户端和机器人都不能直接改字段。
- BattleInput 冻结两方合法阵容、装备和效果；BattleResult 是单次配对的唯一权威结果。
- RoundSettlement 汇总结果后提交资源、排名与淘汰；重复提交不重复生效。
- PlayerView 仅包含可见数据，不下发内部随机流、他人私有商店或全池精确计数。

金币、HP、轮次和卡池占用各有一个权威来源。兼容旧 MatchState 时，其他表现只能派生，不能让房间和单人 Match 分别推进并互相覆盖。

## 3 共享卡池账本

### 3.1 基础单位与守恒

按英雄定义 d，要求初始份数等于可用份数、全部商店预留份数、全部真实持有份数和合法待领取预留份数之和。每项均为非负整数，不能超卖。

普通一星、二星、三星分别承载 1、3、9 份基础棋子；以来源账本保留合成前的份数，不能根据显示单位数量回池。任何特殊直接升星、奖励或额外复制均须有单独的来源规则，不能套显示星级凭空增加库存。

暂不支持的复制类机制不得偷偷绕过库存。战斗召唤物、对手镜像、回放副本和 UI 投影不属于可出售实体，不占用也不归还卡池。

### 3.2 操作行为

| 操作 | 卡池变化 | 同事务的其他变化 |
| --- | --- | --- |
| 生成商店 | 从可用池取出并预留到具体席位、generation、slot | 商店、随机状态、generation |
| 购买 | 商店预留转为真实持有，不再扣一次可用库存 | 金币、单位获取与合成、装备转移 |
| 刷新 | 归还未购买格子的预留，再按规则重新抽取 | 刷新费用、商店、新随机状态 |
| 锁店 | 保持当前预留，不能自然刷新偷偷释放 | 锁店标记 |
| 升星 | 合并持有来源，基础份数不变 | 单位、装备、成长和绑定迁移 |
| 出售 | 按真实持有来源释放份数 | 售价、单位移除、装备归还 |
| 淘汰 | 释放商店与实体单位、按合同处置待领取占用 | 席位状态与名次；只执行一次 |
| 开场或奖励获取 | 必须经过明确的池内取得或特殊来源合同 | 奖励收据、资产、待领取状态 |
| 暂时断线 | 不释放商店或单位 | 只改变连接或控制者状态 |
| 镜像战斗结束 | 不改变镜像原主的卡池占用 | 只结算实际参战席位 |

购买失败、刷新失败和过期请求必须保留原状态，包括金币、卡池、商店占用、随机流、ID 与事件序列。实现时先生成合法事务提案，确认全部可提交后再替换权威状态。

“争最后一张”主要发生在商店生成或其他从可用池获取的时刻，因为已经显示在商店的卡应已有该席位的预留。测试不能只在购买时扣池，导致多人的商店同时承诺同一份卡。

### 3.3 抽取与公平性

费用概率优先复用现有等级表；同一费用层内按可用份数加权，而非对英雄名等概率抽样。层内和跨层缺货行为必须显式定义，不进行无上限重抽。

建议的项目规则为：在原概率大于零且仍有可用卡的费用层之间归一化；若没有任何合法层，留下明确空格。付费刷新在确认完全无法生成有效新商店时，应有清晰失败或收费语义，TP 必须定稿后实现。上述建议尚未当作 Riot 规则事实。

全房自然刷新先统一释放应刷新的旧商店，再用可复现的轮次抽签顺序生成新商店，锁定商店不释放。每轮变化顺序，避免永远让固定座位优先取得稀缺卡；手动操作按服务器收件与队列顺序处理。

抽卡随机流属于服务器。每类操作的消费次数写入新联机合同，不能为兼容旧无限商店的固定两次抽样而掩盖缺货分支。

### 3.4 初始份数与内容切片

Riot 的 [14.15 官方更新说明](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-15-notes/)明确列出各费用英雄池份数为 30、25、18、10、9。这是可追溯的历史参考，尚不能仅凭该页面断言整个 14.24b 版本全部细节相同。

TP 应核定目标规则版本后把数值放入版本化配置，并记录来源或明确标注项目选择。测试可先使用显式的微型库存，不必等正式容量确定才检查原子性。

当前 SHOP_CATALOG_BY_COST 是 19 位英雄，费用种类数量为 5、5、5、3、1。共享池仅覆盖实际支持的英雄；不自动增加目录外单位，不因高费英雄种类少而私自增加份数。

### 3.5 开场与奖励的待定边界

当前开场每席获得一张 Irelia，八席开场是否统一占池需要在初始化事务中明确；建议占池并在生成商店之前完成。不能先生成八份默认 Match，再事后扣池而产生已显示商店超额。

野怪奖励可能在计划、揭示、待领取和真正入库间跨越多个阶段。需选择并统一“何时预留”，以及死亡未获得、放弃、满备战区、终局和淘汰时何时释放。不能把未来奖励已冻结的事实等同于已获得，或允许八席预冻同一份最后卡。

建议优先采用池内预留及来源收据；无货时使用版本化的同费替代或金币补偿方案。具体补偿有玩法影响，TP 应先根据现有奖励合同形成明确规则，必要时请用户决定。此项不阻塞 T1 或不涉及奖励的有限池原子性测试。

## 4 多人战斗与结算

1. 双方快照只包含合法上场单位及其完整效果，建立局部 ID 与真实席位资产的映射。
2. 同一次配对冻结一份输入，运行一个 Combat；视角镜像不等于再运行一场单人 Match。
3. A 和 B 的装备、强化、异常与成长均生效，不从固定敌军模板取得 B 的属性。
4. 结果回传带 battleId、roundId 与执行代次，拒绝旧轮次或已作废的工作任务。
5. 结算阶段只提交一次，先获得全轮有效提案，再批量计算资源与淘汰；部分失败不能导致半轮扣血。
6. 确定性重试可以重新运行同一冻结输入，但只能采纳一份结果，不能双发奖励。
7. 真实玩家淘汰归还卡池的事务发生在本轮排名计算后、下一轮商店生成前。
8. 固定 50 ms 逻辑步长、整数规则、完整事件与来源账本保持适用；改变规则须有版本与独立预期。

## 5 阶段与加时

房间区分等待、准备、选择、冻结、战斗、结算和终局。旧目录中的 PvE、补给及选择节点保留，PvP 节点改为席位之间对战。

用户已选择 6-7 后继续 PvP 加时。加时不继续调用“6-7 自动胜利或失败”的单人终局路径。建议每轮只做 PvP，保留正常经济与共享商店，沿用最后阶段基础伤害，不额外产生新野怪、强化或奖励。

平局扣血、同时归零和名次破同分规则须在 T3/T4 有固定合同。可采用 v2 的扣血后未截断 HP、轮前 HP、固定席位顺序破同分，但不能把它冒称为已核对的官方规则。

奇数存活者使用其他存活者的冻结镜像；不和自己的镜像打，镜像原主不反向受伤，不被重复发收入、成长或返还卡池。

加时必须能结束。测试覆盖连续平局、双方空阵容与多席同轮归零；执行故障产生明确中断状态，不伪造正常名次。

## 6 命令与同步

客户端只提交意图；actor 取自服务器座位凭证。消息有协议版本、roomId、commandId、轮次阶段和动作相关的 generation 或 revision。响应包含明确成功或失败、原因、回执与更新后的可见版本。

同一房间单写者提交事务，所有对共享卡池的更新与席位资产一起生效。其他玩家刷新导致 poolRevision 改变，不应自动使本玩家对自己已预留商店卡的购买失效；校验依据是实际资源依赖。

重复 commandId 同内容返回原回执；同编号不同内容拒绝。窗口外旧请求拒绝并要求同步，不能遗忘后再执行。

重连恢复原席位，旧连接代次失效。商店和资产不因断网消失；临时机器人接管也不重新 createMatch。服务器进程重启的无缝续局是后续增强，首版必须明确中断原局并让旧凭证得到清楚错误。

PlayerView 以白名单生成。具体哪些公开数据可观战另列表；全池精确可用量、未来奖励和 RNG 不默认公开。客户端不能通过本地导入旧存档替换在线状态。

## 7 机器人合同

机器人通过同一房间命令入口使用共享有限卡池。不能读本应隐藏的其他商店来作弊，也不能直接给自己造卡或越过费用。

每步读取最新状态、生成一个或一小组具有独立合法性的意图、执行并检查结果，再继续决策。刷新后重读 generation，升星后重读单位 ID，合成装备后重读实例。

限制每轮决策步数；库存耗尽、买不到想要英雄或无合法动作时可以停止，不能无限刷新。机器人弱是可接受的首版质量残余，无法选择、卡住轮次或打破卡池守恒是验收失败。

## 8 首批验收要点

| 用例 | 独立预期 |
| --- | --- |
| 两席同时争取一份可用卡 | 最多一份有效预留，不能向两人出售同一份 |
| 买下已预留卡 | 可用池不再减少第二次，商店预留减一且持有加一 |
| 三张一星升二星 | 持有基础张数仍为三 |
| 出售二星和重复提交出售 | 只回池三份一次，金币只发一次 |
| 刷新失败 | 原金币、卡池、商店、RNG 与 generation 不变 |
| 锁店跨轮 | 锁店原预留不丢失，未锁店统一按规则刷新 |
| 淘汰与断线分别处理 | 淘汰按规则唯一释放；断线不释放 |
| 镜像复制强阵容 | 虚拟阵容不占池、不返池，不改变原主 HP |
| 奖励缺货或待领取取消 | 按定稿合同兜底或释放，不负库存、不发不存在的卡 |
| 八席自然刷新 | 固定初始种子可复现，不永久固定 seat0 优先 |
| 6-7 后仍三席存活 | 进入加时，正确镜像配对，继续至合法终局 |
| 旧连接或重复命令 | 拒绝或原回执，不破坏资产及有限池 |

T0 技术准备可以完成，合同草案仍有数值与奖励边界待核定。T1 是独立可执行的下一项；TP 的正式规则修改要先把对应待定边界写清楚。

## 9 服务器规则入口（T1）

本节定稿的是**现有单人规则的 Node 运行边界**，不是八席服务器、双方战斗或共享卡池合同。上文房间、邀请码等旧表述以 `AGENTS.md` 的最新产品决定为准，按派工单在 T2 后、T4 前统一修订；T1 不据此实现房间或账号。

### 9.1 构建、运行和交付

- TypeScript 公共入口：`src/server-entry/index.ts`。后续 `src/server/` 从此入口导入，不复制 simulation，不导入浏览器适配器。
- 构建：`npm ci` 后运行 `npm run build:server`，产物是 `dist-server/index.mjs`、`dist-server/run-battle.mjs` 及它们共用的 `dist-server/chunks/*.mjs`；部署时复制整个 `dist-server/`，不能只复制入口文件。
- 运行环境：Node **22.12+**，使用原生 `structuredClone`、`BigInt` 和 ESM；不为旧 Node 添加替代算法。esbuild 以 `platform=node`、`target=node22.12` 打包省略扩展名的 TS 导入；其默认 JSON loader 会内联 JSON 导入（当前闭包没有 JSON 输入），运行时无需 JSON import assertion、TS loader、Vite、Phaser 或 `node_modules`。
- `esbuild@0.28.2` 从既有锁文件中的传递依赖提升为直接 devDependency，使生产构建不依赖 Vite 是否继续间接安装它；未升级其版本。
- `dist-server/metafile.json` 是构建输入/输出清单；构建及验证均拒绝 rendering、presentation、persistence、replay、`src/server/` 和 Phaser 进入规则闭包。运行时仅加载打包的纯规则，构建文件和产物不含网络服务。
- `node dist-server/run-battle.mjs --seed 42 --max-steps 1201` 在普通 Node 下运行首场战斗并输出 JSON 摘要；加 `--snapshot` 输出完整终态和事件。导入 `index.mjs` 本身不创建对局、不自动运行战斗、不输出日志。
- `npm run test:server-entry` 先重新构建，再运行 `scripts/verify-t1-node-entry.cjs`。无需启动 Vite 或浏览器；报告落在 `artifacts/t1-node-entry/report.json`，产物和临时证据均不提交。

### 9.2 导出函数、输入和输出

下表中 `s` 均为可信 `MatchState`。所有命令复用现有实现和 [Match 合同](MATCH_CONTRACT.md)，不另算规则。`CommandResult` 是表内缩写，对外类型名称为 `MatchCommandResult`。

```ts
type MatchCommandResult =
  | { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly state: MatchState; readonly reason: MatchFailure };
interface MatchStep { readonly state: MatchState; readonly events: readonly MatchEvent[] }
```

| 导出签名 | 输入含义及输出行为 |
| --- | --- |
| `createMatch(seed?: number): MatchState` | uint32 初始种子，含 0；兼容旧入口省略时的固定默认种子 42。服务器必须显式传入 seed。创建现有首轮，非八席初始化。 |
| `deployMatchUnit(s, unitId: string, target: UnitLocation): CommandResult` | `target` 为 `{kind:'board',cell:{col:number,row:number}}` 或 `{kind:'bench',slot:number}`；执行合法部署/移位。 |
| `buyUnit(s, slotIndex: number, expectedGeneration: number): CommandResult` | 当前商店零基格号和 generation，原子购买/合成。 |
| `sellUnit(s, unitId: string): CommandResult` | 出售本方真实单位，复用资源和装备归还规则。 |
| `setShopLock(s, locked: boolean, expectedGeneration: number): CommandResult` | 设置当前商店锁定；同值成功返回原状态和空事件。 |
| `rerollShop(s): CommandResult` | 原规则付费刷新，不接收客户端商店或 RNG。 |
| `buyXp(s): CommandResult` | 原规则付费经验，不接收客户端等级或金币。 |
| `startMatchCombat(s): CommandResult` | 校验当前阶段，冻结既有战斗输入并产生完整开战事件。仍使用现有敌军来源。 |
| `stepMatch(s): MatchStep` | 战斗中推进一个 50 ms 逻辑 tick；非战斗阶段返回原 state 和空事件，不暗自进入下一轮。 |
| `nextRound(s, expectedRound: number): CommandResult` | 当前已结算轮号，校验后进入下一节点，不重复结算。 |
| `combineItems(s, aId: string, bId: string): CommandResult` | 两件库存装备实例按既有配方合成。 |
| `equipItem(s, itemId: string, unitId: string, slot: number): CommandResult` | 将库存装备放到指定单位/装备槽。 |
| `selectAnomalyTarget(s, choiceId: string, generation: number, unitId: string): CommandResult` | 当前异常选择及目标单位。 |
| `rerollAnomaly(s, choiceId: string, generation: number): CommandResult` | 当前异常选择付费刷新。 |
| `selectChoice(s, choiceId: string, generation: number, definitionId: string): CommandResult` | 当前选择中合法定义 ID，包括现有奖励选择。 |
| `getDeploymentCap(s): number` | 当前人口上限。 |
| `validateMatchDeployment(s, unitId: string, target: UnitLocation): MatchFailure \| undefined` | 无写入的部署预检；仍必须检查实际命令结果。 |
| `matchStartFailure(s): MatchFailure \| undefined` | 开战预检；`undefined` 代表可调用 Start。 |
| `needsAnomalyRecruitment(s): boolean` | 当前是否为空阵容且尚未完成异常节点。 |
| `serializeMatch(s): string` | 先执行现有恢复校验，再输出对象键规范排序的完整 JSON；不是可公开的 PlayerView。 |
| `restoreMatch(input: unknown): MatchState` | 接受 JSON 文本或普通 JSON 对象，完整验证版本、digest、输入、资产和账本后返回独立状态；不抽 RNG、不发奖励、不重跑 Start。 |

此入口恰有以上 21 个运行时导出。类型导出（编译后擦除）为：

- 状态与命令：`MatchState`、`MatchBase`、`MatchCommandResult`、`MatchFailure`、`MatchStep`、`MatchEvent`、`RunningCombat`、`FinishedCombat`、`RoundResult`、`PersistentGrowth`。
- 单位与战斗：`Unit`、`UnitLocation`、`CombatState`、`CombatResult`、`LedgerCombatEvent`。
- 后续 T2 可引用的现有快照类型：`CombatInputBasis`、`CombatStrategyInputs`、`StrategySnapshot`、`StrategyUnitSnapshot`、`ItemInstance`、`OwnedAugment`、`AnomalyBinding`。它们不是尚未实现的 `PlayerBattleSnapshot`；T2 必须另行定义双方身份映射与验证，不能把旧类型强转成真人敌军。

仓库内 TS 调用使用源入口取得类型；T1 的 `.mjs` 产物是运行文件，不发布 npm 包或独立声明包。

### 9.3 注入边界与调用示例

种子参数为 `seed: number`（uint32）。之后 RNG 状态全部保存在 `MatchState`，以该状态传入下一次命令/step；不从系统熵源再抽种子。

时间由调用方决定何时执行 `stepMatch(state)`，每次调用恰好一个固定 50 ms tick。引擎没有真实时钟、定时器或 `nowMs` 参数，不接受可变 deltaMs；T4 的准备截止、超时和收件时间由 Claude 的调度层注入和管理。这样重放时只需按同一顺序执行同样步数，不等待真实时间。

计算预算由调用方的 `maxSteps: number`（正安全整数）控制；命令行要求显式 `--max-steps`。单步函数本身不循环。以下调用方循环在耗尽预算时保留未完成状态，报告执行预算不足，绝不伪造成平局/胜负，也不改变引擎已有的战斗超时规则：

```ts
import { createMatch, startMatchCombat, stepMatch } from '../server-entry';
const seed: number = 42;
const maxSteps: number = 1201;
const start = startMatchCombat(createMatch(seed));
if (!start.ok) throw new Error(start.reason);
let state = start.state;
const events = [...start.events];
for (let steps = 0; state.phase === 'combat' && steps < maxSteps; steps++) {
  const next = stepMatch(state);
  state = next.state;
  events.push(...next.events);
}
if (state.phase === 'combat') throw new Error('step-limit-exceeded');
// state 和 events 是服务器私有权威数据；公开投影由 T5 实现。
```

### 9.4 失败原因与异常

所有失败命令均返回 `{ok:false,state,reason}`，其中 `state === 输入 state`，**没有 `events` 属性**，且不改变资源、ID、收据、事件序号或任何 RNG。返回类型要求调用方先判别 `ok`，不能直接读取失败结果的 events。

当前 `MatchFailure` 完整枚举（合并重复项后）：

```ts
type MatchFailure =
  | 'unknown-unit' | 'enemy-unit' | 'invalid-location' | 'outside-deployment-zone' | 'occupied'
  | 'missing-player' | 'missing-enemy' | 'missing-both'
  | 'wrong-phase' | 'invalid-slot' | 'stale-shop' | 'purchased-slot' | 'insufficient-gold'
  | 'bench-full' | 'stale-round' | 'unsettled-round' | 'max-level' | 'population-cap'
  | 'unknown-item' | 'item-not-inventory' | 'invalid-recipe' | 'item-slot-occupied'
  | 'stale-choice' | 'invalid-choice' | 'invalid-target' | 'same-item'
  | 'unique-conflict' | 'exclusive-slots' | 'temporary-item';
```

`createMatch` 的非法 seed 抛 `RangeError`（`Seed must be a uint32 integer`）；`serializeMatch`/`restoreMatch` 保留原始校验异常：非法 JSON 文本可抛 `SyntaxError`，非普通/非有限 JSON 数据可抛 `TypeError`，无效字段可抛 `RangeError` 或校验 `Error`（含 `Invalid Match save: unsupported-version`、`Invalid Match save: content-digest` 等）。这些是可信状态/存档边界的异常，不是命令 `reason` 枚举，错误 message 也不是稳定网络协议。T5 负责验证不可信消息和映射协议错误；不得捕获异常后绕过校验强制恢复。

运行器参数缺失/非法时 stderr 输出 `Usage:` 并以 1 退出；预算不足输出 `step-limit-exceeded: maxSteps=...` 并以 1 退出，无成功 JSON。它们是执行器错误，不新增领域 `MatchFailure`。

### 9.5 T1 一致性证据与范围

先按原锁文件 `npm ci`，在 Node `v24.21.0` / npm `11.19.0` 原样执行既有探针。seed 42 首战基线：164 tick、106 条战斗事件、`playerWin`；终态 Combat digest 为 `fnv1a32-utf16:acf238a8`，战斗事件 digest 为 `fnv1a32-utf16:966105d6`，记录于 `tests/t1-probe-baseline.json`。集成文档同步未改变 `4d51ec95` 的 simulation 源码。

验证重新运行未修改的原探针，并独立以 `platform=browser` 打包浏览器现有的 simulation 导入。将该参考和生产 Node 入口的开战及逐 tick 完整 state、events、全部随机流分别编码为 UTF-8，使用 `Buffer.equals` 逐字节比较；另把同一未改动源码产生的三条完整轨迹 SHA-256 固定在基线文件中，防止参考和生产同时漂移。摘要不能替代完整比较。参考包在普通 Node 中运行，这不是实测浏览器或八席局的宣称。

另断言：旧 generation、金币不足的买卡/刷新/买经验、错误阶段命令保持原对象且无 events/RNG 变化；tick 40 文本/对象两种恢复后每次 step 的整个结果 deepEqual，终态存档字节相同；损坏 digest/版本拒绝；禁用浏览器全局、`Math.random` 和 `Date.now` 后仍可导入并运行；复制完整产物到独立临时目录后能运行，164 步成功、163 步明确失败。验收不增加共享池、机器人、网络或新玩法。

