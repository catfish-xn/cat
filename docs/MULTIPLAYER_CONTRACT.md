# Set13 八人联机合同草案

日期：2026-10-12  
版本：draft 0.2（T1/T2 入口定稿）
适用目标：八人联机、共享有限卡池、机器人补位、6-7 后 PvP 加时  
状态：明确用户决定与实现边界，具体数值及未决玩法按对应任务定稿  
关联：[任务划分](MULTIPLAYER_N0_BASELINE.md)与[整改方案](MULTIPLAYER_RENOVATION_V2.md)

## 1 决定的效力

用户已经确定：开局八席；真人不足以机器人补满；首版使用共享有限卡池；6-7 后继续 PvP 加时直到决出最终名次。实现者不得改回独立无限商店或固定末轮按血量直接结束。

以下职责与一致性规则属于实现该目标的技术边界。具体卡池份数、奖励缺货补偿、平局及同轮名次规则标明为建议或待核定，不冒称用户已经逐项批准，也不改写旧 M8 离线合同。

### 1.1 单一匹配队列与隐藏座位凭证（已确认）

网页准入由用户在本仓库外控制；本仓库不实现账号或登录。进入后只有一个“匹配”入口，不提供建房、邀请码、房主或准备键。服务器同一时间只跑一局：点匹配进入唯一队列，任一队列玩家点开始或等待超时即开局，不足八席由机器人补满。队列已有八人时，第九人得到容量错误，不进入候补队列、不新开第二局；对局进行期间也不另开并行队列/对局。

座位凭证由服务器生成，客户端在连接和重连时自动携带，用于防止冒充和恢复原席位；玩家不可见、不需复制或输入。凭证不进入战斗快照、公共 PlayerView 或战斗事件。首版的网络投递与保管由 T5/T6 实现，T2 不实现身份系统。

## 2 对象和权威

- 单局状态拥有八席、共享库存、全局阶段、轮次、截止、配对与排名。B1 的 `RoomState`、`roomId`、`RoomCommandTransaction` 是内部沿用名，分别表示当前唯一对局、对局标识和单局事务，不代表可创建或选择的房间产品。
- SeatState 拥有本席资产、商店预留、HP、经验、待选项与事件位置。
- SharedPoolState 按英雄定义记录初始份数、可用份数及合法占用；不把英雄种类数量误当成每种英雄份数。
- RoomCommandTransaction 是修改卡池和席位资产的唯一提交边界，客户端和机器人都不能直接改字段。
- BattleInput 冻结两方合法阵容、装备和效果；BattleResult 是单次配对的唯一权威结果。
- RoundSettlement 汇总结果后提交资源、排名与淘汰；重复提交不重复生效。
- PlayerView 仅包含可见数据，不下发内部随机流、他人私有商店或全池精确计数。

金币、HP、轮次和卡池占用各有一个权威来源。兼容旧 MatchState 时，其他表现只能派生，不能让对局调度器和单人 Match 分别推进并互相覆盖。

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

全局自然刷新先统一释放应刷新的旧商店，再用可复现的轮次抽签顺序生成新商店，锁定商店不释放。每轮变化顺序，避免永远让固定座位优先取得稀缺卡；手动操作按服务器收件与队列顺序处理。

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

单局区分队列等待、准备、选择、冻结、战斗、结算和终局。旧目录中的 PvE、补给及选择节点保留，PvP 节点改为席位之间对战。

用户已选择 6-7 后继续 PvP 加时。加时不继续调用“6-7 自动胜利或失败”的单人终局路径。建议每轮只做 PvP，保留正常经济与共享商店，沿用最后阶段基础伤害，不额外产生新野怪、强化或奖励。

平局扣血、同时归零和名次破同分规则须在 T3/T4 有固定合同。可采用 v2 的扣血后未截断 HP、轮前 HP、固定席位顺序破同分，但不能把它冒称为已核对的官方规则。

奇数存活者使用其他存活者的冻结镜像；不和自己的镜像打，镜像原主不反向受伤，不被重复发收入、成长或返还卡池。

加时必须能结束。测试覆盖连续平局、双方空阵容与多席同轮归零；执行故障产生明确中断状态，不伪造正常名次。

## 6 命令与同步

客户端只提交意图；actor 取自服务器座位凭证。消息有协议版本、roomId、commandId、轮次阶段和动作相关的 generation 或 revision。响应包含明确成功或失败、原因、回执与更新后的可见版本。

同一对局单写者提交事务，所有对共享卡池的更新与席位资产一起生效。其他玩家刷新导致 poolRevision 改变，不应自动使本玩家对自己已预留商店卡的购买失效；校验依据是实际资源依赖。

重复 commandId 同内容返回原回执；同编号不同内容拒绝。窗口外旧请求拒绝并要求同步，不能遗忘后再执行。

重连恢复原席位，旧连接代次失效。商店和资产不因断网消失；临时机器人接管也不重新 createMatch。服务器进程重启的无缝续局是后续增强，首版必须明确中断原局并让旧凭证得到清楚错误。

PlayerView 以白名单生成。具体哪些公开数据可观战另列表；全池精确可用量、未来奖励和 RNG 不默认公开。客户端不能通过本地导入旧存档替换在线状态。

## 7 机器人合同

机器人通过同一对局命令入口使用共享有限卡池。不能读本应隐藏的其他商店来作弊，也不能直接给自己造卡或越过费用。

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

T1 已集成，T2 的规则入口见第 10 节；T3 的提交语义与 TP 的正式规则修改仍须先把对应待定边界写清楚。

## 9 服务器规则入口（T1）

本节定稿的是**现有单人规则的 Node 运行边界**。双方战斗见第 10 节，产品流程以第 1.1 节为准；T1 不实现匹配服务或账号。

### 9.1 构建、运行和交付

- TypeScript 公共入口：`src/server-entry/index.ts`。后续 `src/server/` 从此入口导入，不复制 simulation，不导入浏览器适配器。
- 构建：`npm ci` 后运行 `npm run build:server`，产物是 `dist-server/index.mjs`、`dist-server/run-battle.mjs` 及它们共用的 `dist-server/chunks/*.mjs`；部署时复制整个 `dist-server/`，不能只复制入口文件。
- 运行环境：Node **22.x，最低 22.12**，使用原生 `structuredClone`、`BigInt` 和 ESM；不为旧 Node 添加替代算法。esbuild 以 `platform=node`、`target=node22.12` 打包省略扩展名的 TS 导入；其默认 JSON loader 会内联 JSON 导入（当前闭包没有 JSON 输入），运行时无需 JSON import assertion、TS loader、Vite、Phaser 或 `node_modules`。
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

T1 的运行时导出是以上 21 个；T2 的新增导出见第 10 节。T1 类型导出（编译后擦除）为：

- 状态与命令：`MatchState`、`MatchBase`、`MatchCommandResult`、`MatchFailure`、`MatchStep`、`MatchEvent`、`RunningCombat`、`FinishedCombat`、`RoundResult`、`PersistentGrowth`。
- 单位与战斗：`Unit`、`UnitLocation`、`CombatState`、`CombatResult`、`LedgerCombatEvent`。
- 后续 T2 可引用的现有快照类型：`CombatInputBasis`、`CombatStrategyInputs`、`StrategySnapshot`、`StrategyUnitSnapshot`、`ItemInstance`、`OwnedAugment`、`AnomalyBinding`。它们不等同于 T2 的 `PlayerBattleSnapshot`；双方身份映射与验证见第 10 节，不能把旧类型强转成真人敌军。

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

## 10 双方战斗接口（T2）

### 10.1 公共入口与可信边界

以下均从 `src/server-entry/index.ts` 导入；生产 Node 使用整个 `dist-server/` 内的 `index.mjs`。验证环境为 nvm Node **v22.23.3** / npm **10.9.9**，不更改既有单人规则版本、数值或 golden。新增运行时版本常量为 `PLAYER_BATTLE_SNAPSHOT_VERSION = 'two-sided-snapshot-v1'`、`TWO_SIDED_BATTLE_VERSION = 'two-sided-battle-v1'`，以及错误类 `BattleValidationError`。

```ts
snapshotForBattle(state: MatchState, seatId: string): PlayerBattleSnapshot
restorePlayerBattleSnapshot(input: unknown): PlayerBattleSnapshot
compileBattle(a: PlayerBattleSnapshot, b: PlayerBattleSnapshot, battleSeed: number,
              identity?: BattleIdentity): BattleInput
restoreBattleInput(input: unknown): BattleInput
startTwoSidedCombat(input: BattleInput): CombatState
startTwoSidedCombatWithEvents(input: BattleInput): CombatStep
stepCombat(state: CombatState): CombatStep
resolveTwoSidedBattle(input: BattleInput, maxSteps: number): BattleResult
proposeSettlement(result: BattleResult): { readonly a: SideProposal; readonly b: SideProposal }
// BattleIdentity = { readonly battleId: string; readonly mirrorOfSeatId?: string }
// CombatStep = { readonly state: CombatState; readonly events: readonly CombatEvent[] }
```

`snapshotForBattle` 只接受服务器拥有的准备阶段 MatchState，校验现有六个规则/协议版本键、内容 digest、目录轮次及标准 7×8 棋盘/9 格备战区，只取本方合法上场单位和关联效果。它不重放整局资产历史、不校验客户端身份，也不重新掷临时装备；准备态必须已通过原有装备事务生成当前轮临时子装备。备战区单位、库存装备、金币、商店、随机流、座位凭证均不进入快照。异常或成长绑定在备战区单位时被省略。输出是独立深拷贝且递归冻结，输入不变。

两个 restore 接受普通 JSON 对象或 JSON 文本，返回独立、冻结的规则数据。快照采用白名单，拒绝额外字段和自报最终属性；检查部署、人口、星级、装备槽/排他约束、临时子装备父项与轮次、强化/异常定义和成长。`restoreBattleInput` 从两份描述重新编译，并逐字段规范比较派生阵容、效果、映射表，拒绝伪造属性。它们是服务器内部数据边界，**不是客户端资产真实性证明**。`proposeSettlement` 接受本引擎生成的可信结果，只检查必要身份、终态及事件序列一致性，不认证任意外部战报；跨信任边界应恢复冻结输入并重跑，不能接受客户端自报胜负。旧 `restoreMatch` 不接收该格式，其固定敌军校验不放宽。

### 10.2 输入和输出形状

以下字段均为只读；具体公开 TS 类型由入口导出。`Unit`、`ItemInstance`、`TemporaryEquipment`、`OwnedAugment`、`AnomalyBinding` 沿用规则描述类型，不含计算后的战斗属性。

```ts
interface PlayerBattleSnapshot {
  version: 'two-sided-snapshot-v1'; contentDigest: string;
  seatId: string; roundId: string; level: number;
  units: readonly Unit[];                  // team:'player'，仅己方部署区 board
  items: readonly ItemInstance[];          // 仅 location.kind:'unit' 且属于上场单位
  temporaryEquipment: readonly TemporaryEquipment[];
  augments: readonly OwnedAugment[];
  anomalyBinding: AnomalyBinding | null;
  persistentGrowth: readonly PersistentGrowth[];
  augmentProgress: { pumpingRounds: number; investmentHp: number };
}
interface BattleIdMapping {
  seatId: string; kind: 'unit' | 'item' | 'temporary-item' | 'augment' | 'anomaly';
  originalId: string; combatId: string;
}
interface BattleInput {                    // 规则输入，区别于 B1 的调度信封
  version: 'two-sided-battle-v1'; battleId: string; battleSeed: number;
  mirrorOfSeatId: string | null;             // null=真实双方；否则必须等于b.seatId
  a: PlayerBattleSnapshot; b: PlayerBattleSnapshot;
  mapping: readonly BattleIdMapping[];
  preparation: GameState; strategy: StrategySnapshot;
}
interface BattleSideResult {
  seatId: string;
  survivors: readonly { unitId: string; definitionId: string; starLevel: 1|2|3; hp: number }[];
  growth: readonly PersistentGrowth[];     // {unitId, attackDamageBps}，仅本战新增长量；镜像为空
}
interface BattleResult {
  version: 'two-sided-battle-v1'; battleId: string; roundId: string; battleSeed: number;
  mirrorOfSeatId: string | null;
  winnerSeatId: string | null;             // null = 平局
  a: BattleSideResult; b: BattleSideResult; mapping: readonly BattleIdMapping[];
  initial: CombatState; terminal: CombatState;
  events: readonly LedgerCombatEvent[];   // 含 tick 0 的开场/立即结束事件
}
interface SideProposal {
  battleId: string; roundId: string; seatId: string; result: 'win'|'loss'|'draw';
  settlementEligible: boolean;             // 镜像false，禁止发收入/经验/奖励或提交收据
  baseDamage: number; opposingSurvivors: number; damage: number;
  growth: readonly PersistentGrowth[];
  events: readonly LedgerCombatEvent[];
}
```

`BattleIdentity`、`BattleSurvivor`、`BattleSideResult`、`BattleIdMapping`、`BattleFailure`、`CombatStep`、`CombatEvent`、`GameState`、`TemporaryEquipment` 也作为类型导出。双方 survivor/growth 中的 unitId 已映射回各自真实原始 ID；事件与 CombatState 内仍是战斗 ID，查 `mapping` 归属，不按字符串切割推断。双方提案的 events 引用同一完整账本，持久化应以 battleId 保存一份。此账本是服务器私有数据，PlayerView 另做白名单投影。

### 10.3 编译、确定性与推进

- A 与 B 必须不同 seatId、同一 roundId；T2 只接受既有目录中的 PvP。PvE、补给和目录外的 6-7 后加时尚不由此入口处理，不把未知轮次伪装成 6-1。
- 各自以本方 player 阵容独立调用现有策略编译器，完整应用装备、羁绊、强化、异常、持久成长和临时装备程序；随后 A 为 player，B 为 enemy。A 坐标不动，B 用 `row = 7 - row`、col 不变。后排、相邻搭档等开场选择先在各自原坐标计算。
- 战斗 ID 编码为 `JSON.stringify(['t2', seatId, kind, originalId])`；同原始 unit/item/choice ID、含标点的席位 ID 均不碰撞。强化和异常是不同 kind；羁绊来源实例另以 kind=`trait` 加席位前缀，来源键重新生成；所有者、搭档、临时装备父项引用随之映射。成长能力来源使用已命名空间化的 unit ID。
- 阵容、装备、强化等输入列表规范排序，复用原 combat 排序/破同顺序。相同内容、版本、输入、显式 uint32 `battleSeed` 与足够预算产出逐字段相等的结果；不读取任何一方 Match RNG，不调用真实时钟或系统随机。交换 a/b 会改变坐标和 player/enemy 视角，**不承诺镜像后的完全对称胜负**。
- 正式调度必须传第四参 `{battleId}`，使用该局/轮次/配对/执行代次的唯一标识。只传三参时生成的 `diagnostic:<digest>` 供离线测试，32 位内容摘要不保证生产唯一性，不能用作收据键。
- `startTwoSidedCombat` 只返回初态；需要完整账本时必须用 `startTwoSidedCombatWithEvents` 并从 start.events 开始收集。每次 `stepCombat` 固定 50 ms；结果事件包含连续 `eventSeq` 和同一 `combatId`，不按动画帧删减。推荐直接用有界的 `resolveTwoSidedBattle`，默认不偷偷提供预算。
- `maxSteps` 为正安全整数，当前引擎最多 1200 ticks，传 1200 足够；耗尽预算而仍 running 是失败，不返回伪造平局。双方空阵容合法，在 tick 0 平局；一方空则另一方 tick 0 胜利。真实战斗达到原 1200 tick 上限仍未分胜负才是 timeout 平局。

### 10.4 未提交的伤害和成长提案

伤害直接取冻结基线 [match-rules.ts 第 24 行](../src/simulation/match-rules.ts#L24) 的 `STAGE_PLAYER_DAMAGE`：阶段 2/3/4/5/6 分别为 **2/5/8/10/12**。计算沿用 [economy.ts 第 71–74 行](../src/simulation/economy.ts#L71)：真实参战席位胜方 damage=0，败方或平局方 damage=本阶段基础值+对方存活单位数（不是星级之和）。真实双方空阵容各提案基础伤害；超时双方各按对方存活数计算。镜像方一律 damage=0、growth=[]、settlementEligible=false，详见10.8。damage 是未截断非负安全整数请求值，T2 不读取或修改席位 HP，不计算实际损失/淘汰/名次。

growth 只包含本场新获得的永久 AD 增量，包含已阵亡单位的合法增长，按 seatId 和原始 unitId 归属；开战前累计成长只参与属性，不再次发放。重复调用提案得到相同值且不改资产；**这不等于收据幂等提交已实现**。不发金币、经验、奖励，不推进轮次，T3 才将合法提案原子提交。

### 10.5 失败枚举

T2 验证/运行失败抛 `BattleValidationError extends RangeError`，读取稳定的 `.reason: BattleFailure`，不解析 message。失败不修改任一输入或消耗外部 RNG，预算失败不产生可提交结果。`stepCombat` 沿用其可信 CombatState 前提，不是任意 JSON 恢复器。

| reason | 含义 |
| --- | --- |
| `snapshot-version` | 快照格式版本或源 Match 规则/协议版本不匹配 |
| `content-digest` | 源状态或快照内容摘要不匹配 |
| `invalid-snapshot` | 非法 JSON/描述/额外字段、非法资产、部署、装备、效果或编译失败 |
| `wrong-phase` | 从非 preparation 的 MatchState 提取快照 |
| `seat-collision` | a/b 席位相同 |
| `round-mismatch` | 两方目录轮次不同，或源 Match 轮号与轮次 ID 不符 |
| `round-kind` | 已知目录节点不是 PvP |
| `invalid-seed` | battleSeed 不是 0…4294967295 的整数 |
| `invalid-battle-id` | 显式 battleId 为空或非字符串 |
| `invalid-mirror` | 指定的镜像来源不是 b.seatId（只允许 B 为镜像） |
| `battle-input` | 编译输入格式/版本错误或派生内容与重编译不一致 |
| `invalid-budget` | maxSteps 不是正安全整数 |
| `step-limit-exceeded` | 预算用尽仍 running，不可提交 |
| `invalid-result` | 提案输入版本/轮次、终态、归属、赢家或事件序列不一致 |

恢复编译输入时，内层快照/轮次/种子验证也可产生对应 reason。未知目录 ID 在快照恢复时报 `invalid-snapshot`。`empty-both` **不是**失败：按 10.3/10.4 返回合法平局和伤害提案。

### 10.6 Claude 的 B1 resolver 替换合同

已核对已合入 multiplayer 的 PR #35 的 `src/server/room/battle-resolver.ts` 和 `types.ts`。其调度信封有 `battleId/roomId/round/roundId/roundKind/roomRevision/seats/mirrorOf`；保持为服务器私有编排类型，导入规则类型时可用 `RulesBattleInput`/`RulesBattleResult` 别名避免重名。

**接口调整要求（由 Claude 改 `src/server/`）：**

1. 调度输入增加显式 `battleSeed: number` 和 `maxSteps: number`，在冻结配对时固定，重试不得换种子；保留并回传原 `battleId/round/roomRevision`。调用前核对信封 roundId 与两方准备态轮次一致，调用后仍须拒绝过期执行代次。
2. 普通 PvP 的两席只编译、运行一次。B1 旧返回中的 `outcomes[].state: MatchState` 是已结算状态，要求 T2 填充它会提前做 T3；不得把真实 enemy 的 Combat 强塞入旧单人存档。PvP 输出改为 `{battleId, round, roomRevision, battle: RulesBattleResult, proposals: {a: SideProposal,b: SideProposal}}`，调度层暂存提案，等 T3 的提交入口；不能继续走当前占位的扣血和已结算 MatchState 覆盖路径。
3. 旧 `frames: {state: MatchState,events: MatchEvent[]}[]` 改为战斗视图数据：整场提供 `battle.initial/terminal/events/mapping`，如确需逐 tick 帧，使用开场含事件入口并逐步保存 `{state: CombatState,events: CombatEvent[]}`。生成帧也只运行这一场，B 视角由映射/投影得到。不要再各跑一次 `startMatchCombat`。
4. 奇数镜像使用实际参战席位作为 a，`mirrorOf` 的冻结快照作为 b（必须不同 seatId）；第四参明确传 `mirrorOfSeatId: b.seatId`，完整计算双方效果；规则输出镜像 b 的 growth=[]，其提案 settlementEligible=false、damage=0、growth=[]。该提案不得提交，不给镜像原主重复成长/扣血/收入。席位真身在其他配对上的结果仍独立有效。调度信封应保留真实参与席位列表供 T3 识别。
5. PvE/补给保留原分支，不能调用此 PvP 入口。未来加时轮标识与 T3 的下一轮推进需单独扩展合同，T2 不猜测。

普通 PvP 的替换核心（伪代码中的调度字段由 B1 定义）：

```ts
import { snapshotForBattle, compileBattle, resolveTwoSidedBattle, proposeSettlement } from '../../server-entry';
const a = snapshotForBattle(envelope.seats[0].state, envelope.seats[0].seatId);
const opponent = envelope.mirrorOf ?? envelope.seats[1];
const b = snapshotForBattle(opponent.state, opponent.seatId);
const frozen = compileBattle(a, b, envelope.battleSeed, { battleId: envelope.battleId,
  mirrorOfSeatId: envelope.mirrorOf?.seatId });
const battle = resolveTwoSidedBattle(frozen, envelope.maxSteps);
const proposals = proposeSettlement(battle);
return { battleId: envelope.battleId, round: envelope.round,
  roomRevision: envelope.roomRevision, battle, proposals };
```

服务器捕获规则异常后中断该轮的结果采纳，不提交部分提案；不得回退到固定敌军占位结果。本 PR 只提供规则实现与本合同，B1 适配和 T3 资产提交尚需对应流水线完成。

### 10.7 验收映射与 T3 最小范围

`tests/t2-two-sided-battle.test.ts` 的用例按以下表覆盖派工单；`node scripts/verify-t2-node-entry.cjs` 在普通 Node 的生产包上验证同一手算答案、重复运行、恢复和预算失败。

| 测试标题关键词 | 验收项与独立预期 |
| --- | --- |
| `hand oracle` | #1：三星 Maddie 对一星，四次普攻至 tick 88，A 剩 1380 HP、B 无存活者；8 次 RNG |
| `fixed two-star A` | #1：固定二星 A 对一星 B 胜、对三星 B 负 |
| `all five effect classes` | #2/#3：两方同 ID，同时覆盖装备/羁绊/强化/异常/成长；AP110、护甲87、AD52、攻速加成700Bps |
| `back-row`、`temporary equipment` | #2/#3：镜像前后排/搭档选择与双方临时装备父项、程序所有权 |
| `growth deltas` | #3：交换 a/b 后成长仍归原席位，不重复带入旧成长 |
| `SR-B1-01: mirrors never settle`、`growth deltas`、`real equipped tanks` | SR-B1-01：镜像胜/负/空阵容/超时均无扣血和成长回写，真实方伤害不按HP截断，恢复保留结算资格 |
| `empty sides`、`real equipped tanks` | #1：空方即时负、双空平局、真实装备 Leona 到1200 tick超时；预算不足拒绝 |
| `same frozen input`、`descriptor permutations`、`snapshots omit` | #4：完整结果 deepEqual、手动逐步账本一致、排序规范、显式种子、Match 私有随机流隔离 |
| `round %s uses frozen stage base`（五阶段） | #5：基础伤害2/5/8/10/12，败方加对方存活数、胜方0 |
| `rejects malformed` | #3/#4：版本、摘要、坐标、同席、伪造派生属性、阶段/预算/结果拒绝；旧恢复边界不放宽 |
| typecheck/build/test:server-entry、既有回归 | #6/#8：Node22、原 T1 轨迹哈希不变、旧测试与 golden 零修改 |
| 第10.1–10.6节 | #7：B1接入签名、数据、失败和职责边界 |

T3 最小范围建议：先提供接收全轮冻结 battleId/轮次/执行代次与真实参战席位的结算事务入口，验证一轮提案齐全且未过期，使用唯一收据将未截断伤害和成长增量各提交一次，再由同一提交结果产生 HP/淘汰与可恢复状态；覆盖重复结果、迟到结果、部分失败、镜像只提交真身及同轮归零。经济与轮次推进必须明确复用边界，不能让调度层继续自行扣血或拼装旧 MatchState；卡池仍留给 TP。



### 10.8 SR-B1-01：双方伤害整数与镜像结算资格（T2 已实现）

交付是 `compileBattle` → `resolveTwoSidedBattle` → `proposeSettlement` 的公开组合：BattleResult 保存一场战斗及回映射结果，`{a,b}` 两份 SideProposal 各含自己的 `damage`。damage 保证非负安全整数，不按当前 HP 截断、不把伤害分摊给另一席；具体五阶段数值见10.4。B1 的 `BattleSeatOutcome.damage` 必须直接取相应提案，服务器不能用存活者重算，也不能从 `hpBefore-hpAfter` 反推。旧 `state: MatchState` 字段与 `frames` 的变更仍按10.6执行，最终资产状态由 T3 产出。

普通配对不传 `mirrorOfSeatId`，规则冻结为 null，a/b 的 `settlementEligible` 均为 true。奇数镜像配对固定真实参战席位为 a、镜像来源快照为 b，并传 `{battleId, mirrorOfSeatId: b.seatId}`。只能 B 是镜像；指定 A 或第三席报 `invalid-mirror`。标记进入冻结 BattleInput 和 BattleResult，JSON 恢复/重试保留此标记，不在战斗结束后临时猜测。

镜像仍以原主全部装备、强化、异常和成长参与真实计算；a 的战斗与伤害不变，镜像源状态不变。规则对 b 一律返回 `BattleSideResult.growth=[]` 及 `SideProposal {settlementEligible:false, damage:0, growth:[]}`，包括镜像败北、超时和双方空阵容。为保留完整战斗事实，内部 CombatState/事件可含虚拟单位在本战中的成长，但它们不是持久成长回写来源。原主在其真实配对中的合法提案仍可正常提交。

**禁止把 damage=0 理解为“可发一次获胜收入”。** B1 应只把 `settlementEligible=true` 且在信封真实 seats 列表中的提案交给 T3；镜像提案不能创建收据、发收入/经验/奖励或更新成长。T2 本身对任何席位均不发收入、不写 HP；T3 的事务入口还须按冻结参与席位及镜像标记拒绝误提交，不能仅依赖调度器筛选。这是 SR-B1-02 的提交验收，不冒称 T2 已完成资产结算。

验证：`SR-B1-01: mirrors never settle` 覆盖镜像胜/负/双空平局、真实方伤害大于其1点剩余HP、双方源状态不变、普通与镜像战斗终态/账本一致；`growth deltas` 覆盖有实际成长事件的镜像却无持久回写、镜像输入恢复重跑完全相同；五阶段伤害测试逐方检查非负安全整数和真实席位可结算标志。

### 10.9 SR-B1-06：本席私有视图下发白名单（T2 清单，T5 实现）

以下是当前 MatchState 到**仅本席连接**的字段投影合同，不是完整 MatchState 的删字段版。T5 必须新建 DTO、逐字段拷贝，嵌套对象也不能展开或整体序列化；未列字段默认不下发。字段增量、重连快照、命令回执及错误响应使用同一白名单，不能让 `RoomCommandResult.state` 或调试错误绕过投影。客户端不得将 DTO 强转为 MatchState 调用本地规则，旧 UI_REQUESTS 的“完整 MatchState（本席）”要求由本节替代。

| 来源 | 本席可以下发的具体字段 | 过滤/权威约束 |
| --- | --- | --- |
| 版本元数据 | `schemaVersion, rulesVersion, contentVersion, contentDigest, commandProtocolVersion, tickMs` | 仅静态版本；不是种子或随机状态 |
| 当前席位进度 | `round, roundDefinitionId, phase, gold, level, xp`，`streak.{kind,count}` | 仅本席已提交状态；phase 只代表本席操作阶段，全局阶段/终局由 Room PlayerView 决定 |
| 玩家血量 | 对外 `playerHp` | 从权威 `SeatState.hp` 投影；T3 保证它与 Match 镜像一致前，不能以占位 MatchState 的 HP 覆盖权威值 |
| 当前商店 | `shop.{generation,locked,slots}`；每格仅 `{status:'available',definitionId}` 或 `{status:'purchased'}` | 仅本人当前已生成商店；不含下轮店、其他席位商店或全池精确计数 |
| 准备棋盘 | `preparation.board.{columns,rows,deploymentZones.{player,enemy}.{firstRow,lastRow}}`、`benchSize`；`units[].{id,definitionId,team,starLevel,location}`，location 仅 `{kind:'board',cell:{col,row}}` 或 `{kind:'bench',slot}` | units 只取本席 player，含备战区；不能把旧固定 enemy 模板混作本轮真人对手。敌人展示用已公布配对的单独战斗/观战投影 |
| 装备 | `items[].{id,definitionId,location}`；location 仅 `{kind:'inventory'}` 或 `{kind:'unit',unitId,slot}` | 仅本席实际已拥有的库存或单位装备；不含预定奖励 |
| 临时装备 | `temporaryEquipment[].{temporaryId,parentItemInstanceId,roundId,holderId,definitionId,slot,expiresAfterRoundId}` | 仅当前轮已生成且父装备/持有者属于本席的子件；不是整个 equipmentState 或历轮 rolls |
| 已拥有强化 | `augments[].{definitionId,choiceId,acquiredRound}` | 不含未来候选或掷骰输入 |
| 当前异常 | `anomalyBinding` 为 null 或 `{definitionId,unitId,choiceId,boundRound}` | 仅当前已绑定结果 |
| 已提交成长 | `persistentGrowth[].{unitId,attackDamageBps}`、`augmentProgress.{pumpingRounds,investmentHp}` | 仅本席持有单位及实际已提交进度；镜像战斗事件不写入 |
| 当前待选项 | `pendingChoice` 为 null 或 `{kind,step,choiceId,generation,offers,targetId,rerollCount}` | 仅 phase=choice 且当前已展示的选择；offers 是已揭示定义 ID 列表，不含下一次刷新、未来选择或兜底答案；不下发 eventId/returnPhase |
| 已提交本席轮结果 | `roundResults[].{round,roundId,result,combatTicks,combatEventCount,baseDamage,survivingEnemyCount,playerDamage,hpLost,hpBefore,hpAfter,goldBefore,goldAfter,income,xpAwarded,levelBefore,levelAfter,xpBefore,xpAfter}`、`incomeBreakdown.{base,win,interest,streak}` | 仅已经实际提交的历史记录；不下发执行中提案或内部 settlementId，不能用单人 outcome 决定全局排名 |
| 当前公开轮次说明（若 UI 需要） | `m8.round.{roundId,ordinal,stage,subround,kind,encounterId,displayName}` | 拷贝到独立 roundInfo DTO，仅当前已公布轮；不带 isFinal（单人末轮不等于多人终局），不下发整个 m8 |

奖励只允许**另外构造已揭示摘要**，沿用 `loot-view.ts` 的现有可见性规则：本轮直接掉落状态为 revealed/pending-capacity/retained-terminal/granted 时，可投影 `dropId, encounterId, sourceUnitId, roundId, status` 与 `payload.{kind,quantity,definitionId?}`；组件选择只有实际领取收据存在后才能投影所获 payload。当前已触发但未选择的奖励仅公开当前 `pendingChoice` 的身份与已展示 offers，绝不公开 `terminalFallbackDefinitionId`。planned/forfeited 条目、未来轮掉落与未揭示候选完全省略，不保留占位数量或数组索引。不得为投影重新抽卡、推进 RNG 或发奖。

**明确不下发的根字段/子树：** `seed, rngState, battleSeedRngState, choiceRngState, rewardRngState`；整个 `equipmentState`（包括初始化随机流、历史 rolls 的 rngDrawStart/rngDrawEnd）；`combatInputBasis`、`resourceProvenance`、`scheduleReceipts`、`nextUnitSerial/nextItemSerial/nextMatchEventSeq`；`m8.encounterPlan`、`m8.preparation`、`m8.loot.frozen`（含 seed/rng/rounds/choices）、`m8.loot.guaranteeCounters` 及其余未经上述摘要过滤的 m8 子树；旧单人 `outcome`。服务器座位凭证不得进入视图（仅连接认证层自动持有，不展示）。

`combat` **不能作为本席字段整体下发**。T2 的 BattleInput/BattleResult、initial/terminal 也是服务器私有对象，内含 battleSeed、rngState、策略和内部执行计划。T5 的战斗帧只能新建显示 DTO：场景基础字段 `combatId,tick,maxTicks,status,result,board`（board 按上表），每单位 `id,definitionId,team,starLevel,cell.{col,row},hp,maxHp,mana,maxMana,shield,alive,targetId,attackDamage,attackRange,attackIntervalTicks,armor,magicResist,abilityPower,baseAttackSpeedBps,attackSpeedBonusBps`（可选字段仅在存在时投影）。状态/护盾详情与可见战斗事件另外使用经字段审查的展示投影，不能透传整个 unit/runtime、abilityPlan、tasks、strategy 或带随机输入的 CombatState。完整权威账本继续留在服务器，不因客户端显示抽样而丢弃；本节不把帧 DTO 伪装成能本地 step/restore 的 CombatState。

T5 验收：两个席位分别投影时不能看到对方 shop/pendingChoice/库存；向任意层塞入随机状态或未来计划哨兵值，初始快照、增量、重连和失败回执均不能出现；改变私有 RNG、未来掉落/兜底而保持已揭示字段相同，输出必须 deepEqual；已揭示商店、选择、临时装备可见，未揭示奖励不可见；投影前后服务器状态、RNG、事件序号均不变。**T2 本次交付清单，没有实现或宣称通过 T5 网络投影测试。**

### 10.10 其余 SR-B1 请求的后续最小范围

- **SR-B1-02 → T3**：公开 `applyRoundSettlement(state, receipt)` 或等价事务命令，唯一 settlementId 去重；真实 PvP 不走旧单人自动扣血/gameOver 路径，提交 HP、收入、经验、成长与一条 roundResults；拒绝镜像提案、过期代次和不完整整轮，重复无资源/事件变化。
- **SR-B1-03 → T3 合同 + T4 实现**：定稿目录外加时入口、末阶段基础伤害、经济/商店推进、平局扣血与同轮归零破同分；Claude 在调度层按合同接入，覆盖连续平局/双方空阵容/多席归零的有限终局。
- **SR-B1-04 → T3**：提供不花资源的空阵容异常节点放弃/应战，以及 unsettled-round 时已赚奖励自动领取或放弃的权威命令，保证不重复发奖和可推进；不让服务器自己改 pendingChoice/奖励账本。
- **SR-B1-05 → TP**：在排名后、下一轮商店前唯一归还淘汰席位占用；买/刷/卖/升星/奖励的池与席位同事务提交，失败金币/卡池/商店/随机流不变，覆盖八席守恒。

## 11 T3：单席原子结算、整轮发布与超时规则

本节取代 §10.7/10.10 的 T3 建议接口。2026-10-12 用户确认覆盖派工单旧文字：**超时默认选第一项是项目规则**；已赚且容量足够的金币、组件、棋子自动领取一次，容量不足的部分放弃。“不花资源”指不购买、不付费刷新，不是“不发任何奖励”。

### 11.1 公开类型与模式切换（本次已交付）

所有下列符号从 `src/server-entry/index.ts` 导出，Node 22.x：

```ts
const ROUND_SETTLEMENT_VERSION = 'multiplayer-settlement-v1';
type MultiplayerFailure = MatchFailure
  | 'multiplayer-required' | 'invalid-seat' | 'invalid-receipt'
  | 'duplicate-settlement' | 'mirror-settlement' | 'already-settled'
  | 'seat-eliminated' | 'no-pending-choice' | 'invalid-loot';
type MultiplayerCommandResult =
  | { readonly ok: true; readonly state: MatchState; readonly events: readonly MatchEvent[] }
  | { readonly ok: false; readonly state: MatchState; readonly reason: MultiplayerFailure };
interface MultiplayerProgress {
  readonly version: typeof ROUND_SETTLEMENT_VERSION;
  readonly seatId: string;
  readonly status: 'active' | 'eliminated';
  readonly receipts: readonly RoundSettlementReceipt[];
  readonly forfeitedChoices: readonly string[];
}
function enableMultiplayerSettlement(state: MatchState, seatId: string): MultiplayerCommandResult;
function applyRoundSettlement(state: MatchState, receipt: unknown): MultiplayerCommandResult;
function forfeitPendingChoice(state: MatchState, expectedRound: number,
  expectedChoiceId: string | null, expectedGeneration: number | null): MultiplayerCommandResult;
function claimOrDiscardLoot(state: MatchState, expectedRound: number): MultiplayerCommandResult;
```

`MatchState.multiplayer?: MultiplayerProgress` 是服务器私有扩展。B4 应在 `createMatch` 后立即调用 enable 并保存返回 state；也允许在无战斗的准备/选择/结算态接入，不能在 combat/gameOver/HP0 时首次开启。同 seatId 重复 enable 成功无事件；不同或空 seatId 拒绝 invalid-seat。这个独立结果类型不扩展单人 `MatchFailure`，保留原 UI 的穷举契约。

开启后 PvP 的 `startMatchCombat` 返回旧 API 的 wrong-phase，`stepMatch` 不推进 PvP；只能走 T2 runner → 本节提交。PvE/补给继续既有公共命令，已有 `roundResults` 的唯一收据仍有效；B4 必须暂存整个 PvE 结果，在全轮发布时一起采纳，不再给 PvE 第二次调用 apply。在线 HP0 的等价淘汰状态是 **`multiplayer.status='eliminated', phase='settlement', outcome=null`**；PvE 同样遵守。存活席在 6-7 结算后仍 active；不能读单人 isFinal/outcome 判定多人终局。淘汰席 `nextRound` 返回 wrong-phase，调度层不得再给它派操作/配对。

这些状态不是单人存档格式，旧 `restoreMatch` 明确拒绝带 multiplayer 的输入（multiplayer-state），不得删除该字段绕过验证。服务器可在自身可信存储中原样保存/复制该扩展，收据与超时标记必须一同保留；本 PR **没有提供不可信多人存档的恢复验证器**。战斗仍用 T2 独立快照恢复，不将真人 enemy Combat 塞回旧单人 Match。§10.9 白名单未授权下发 multiplayer、收据及其 ID；继续只投影已提交资源/历史与公开淘汰状态。

### 11.2 收据、经济与失败

```ts
interface RoundSettlementReceipt {
  readonly version: typeof ROUND_SETTLEMENT_VERSION;
  readonly settlementId: string; // 对局/轮次/席位唯一；重试必须相同
  readonly battleId: string;     // 冻结配对的 T2 battleId
  readonly seatId: string;
  readonly round: number;        // 当前目录 ordinal
  readonly roundId: string;      // 当前目录 ID，例如 2-1
  readonly settlementEligible: boolean;
  readonly result: 'win' | 'loss' | 'draw';
  readonly damage: number;       // T2 未截断伤害，不能改成 hpLost
  readonly baseDamage: number;
  readonly opposingSurvivors: number;
  readonly growth: readonly PersistentGrowth[]; // 本席原始 unitId 的增量
  readonly combatTicks: number;
  readonly combatEventCount: number;
}
```

字段必须齐全且无额外字段，ID 非空；非负安全整数，survivors ≤9、ticks ≤1200、eventCount ≥1。提交准备态不能还有 pendingChoice 或未处理的空阵容异常节点；历史须连续到上一轮。仅接收目录 PvP。收据是**可信服务器从 T2 结果构建的交接对象，不是客户端命令或战斗真实性证明**。规则验证 seat、轮次、资格、数值和重复，但无法从裸 battleId 证明执行代次；B4 负责将其绑定冻结快照、battleId、roomRevision、实际参战席位与本次执行。客户端不能指定 eligibility/growth/结果。

沿用 `planCatalogRoundEconomy` → `planRoundEconomy` → `grantXp`，不接收外部 goldAfter/HP 或第二套收入。PvP 基础收入5、胜利1、利息采样 gold+胜利金币（每10得1，上限5）、连胜败2/4/6得1/2/3、经验2；平局按连败。例：轮前19金币、已有1连胜，本轮胜 → 利息2、连胜1、总收入9、轮后28。9级经验截停。复核 damage 必须等于现有阶段伤害规则（胜0，否则基础+对方存活数）；不允许截断输入。HP1承受9 → HP0、hpLost1，但 roundResults.playerDamage 和收据仍保存9。

同一不可变事务提交金币、经验、等级、连胜败、HP、Tristana 增量成长、pumpingRounds（有强化时+1）、investmentHp（有强化时+8×利息）、一条 roundResults、一份深复制收据和一条有序 roundSettled 事件。不消费任何 RNG。成长只接受本席上场 Tristana，单 unitId 一次，正125倍数，累加不得溢出。T2 的成长保存在 multiplayer 收据中；不伪造单人 combatInputBasis 的成长证据。

| 失败 reason | 条件 |
| --- | --- |
| multiplayer-required | 未开启本模式 |
| duplicate-settlement | 本席已存同 settlementId；即使已推进/淘汰、重试载荷变化仍拒绝 |
| stale-round | round/roundId 与当前不符（缺失则 invalid-receipt） |
| mirror-settlement | settlementEligible=false，零伤害也不能发收入 |
| invalid-receipt | 缺/多字段、非法整数/结果/资格/seat、伤害与规则不符、非法成长、非 PvP 或计算异常 |
| already-settled | 同轮已有结果，或本席已用过 battleId（即便换 settlementId） |
| seat-eliminated | 首次新收据提交给已淘汰席 |
| wrong-phase | 非干净准备态，或空阵容异常还未超时处理 |
| unsettled-round | 历史不连续/漏轮 |

所有失败返回**原 state 引用，无 events 字段、无资源/RNG/序号改变**。去重在阶段/轮次检查前；输入首先经过有限 JSON 数据检查，非 JSON 载荷不享受去重。一个合法获胜收据亦必须写入收入和成长一次，不能把 damage=0 当成无操作。

### 11.3 B4 全轮编排（由 Claude 在 src/server 实现）

1. 冻结本轮 active 席位、配对、battleSeed、battleId、roomRevision；准备截止时先处理 §11.4，随后冻结快照。运行中拒绝修改冻结席位。
2. 收齐本轮所有真实席结果，每个真实席恰一份，普通配对两份、镜像配对仅 a；镜像 b 不进入队列，镜像原主由它的真实配对提交。校验 battleId/round/执行代次与冻结信封完全一致，漏席/重复席/旧代次整轮拒绝。
3. 用原席位 map 建一个临时 map，逐席 apply。任何失败（包括 unexpected duplicate）丢弃整张临时 map 及其事件，不发布已经成功的一席。整轮已提交重试由调度层 round commit ID 去重，不能凭单席 duplicate 推断整轮完成。
4. 全部成功后，一次替换 map、更新 SeatState.hp **取返回 state.playerHp**，再发布事件和版本；不在房间重算伤害/收入/成长。PvE/补给已结算的暂存状态也随本次原子发布采纳。房间自身提交失败，仍用同信封和原始 map 重试，不换随机种子。
5. 使用 §11.5 排名，TP 卡池归还在排名后、下一轮自然商店刷新前。存活席通过公开 nextRound 推进目录轮次；全局仅剩0/1席时结局由调度层生成。

构建单席收据示意（p、battle 必须来自校验通过的同一冻结信封）：

```ts
const r: RoundSettlementReceipt = {
  version: ROUND_SETTLEMENT_VERSION,
  settlementId: JSON.stringify([matchId, envelope.round, p.seatId]),
  battleId: envelope.battleId, seatId: p.seatId,
  round: envelope.round, roundId: envelope.roundId,
  settlementEligible: p.settlementEligible, result: p.result,
  damage: p.damage, baseDamage: p.baseDamage, opposingSurvivors: p.opposingSurvivors,
  growth: p.growth, combatTicks: battle.terminal.tick, combatEventCount: battle.events.length,
};
const result = applyRoundSettlement(originalSeat.match, r);
// 只写 staged；其余真实席也成功后才发布 staged。
```

### 11.4 超时命令与不重复奖励

`forfeitPendingChoice` 名称沿用派工单，但语义是**自动选择第一项**。传入当前 round、choiceId、generation；没有 pendingChoice 的空阵容异常传 null/null。普通强化/组件调用已有 selectChoice；异常 target 步先选按 unitId 字典序最小的己方单位（含备战区），生成正常候选，再选第一项，不 reroll、不买单位。Placebo 等首选自带金币照常只领一次。正常的候选生成/临时装备可能推进其专属 RNG；不承诺成功时所有随机流不变。

唯一例外：异常节点没有任何己方单位时没有合法第一目标，记录该 eventId 的 forfeitedChoices 标记，跳过异常节点，以空阵容参加本轮 PvP，不创造免费单位。后续不能再领取该异常，重复超时不发奖。普通成功会记原有 schedule/loot 收据并追加 choiceTimedOut（resolution='first-offer'）；空异常为 'empty-anomaly'。若返回新 pendingChoice，使用其新身份再次调用，不能复用旧身份把第二个选项误处理。

`claimOrDiscardLoot` 只在 settlement 或 returnPhase=settlement 的 choice 接收：已赚的组件选择按第一项领取，直接奖励调用既有 grantDirectLoot，棋子可升星释放容量时按正常获取规则领取，仍因满备战区无法领的部分标记 forfeited，不分配奖励 ID/收据。金币和组件没有人为新增容量限制。未揭示/未赚奖励绝不发放。若正在显示已领组件选择，清除该选择并正常进入后续节点；无待奖时成功原 state、events=[]。此前已领取奖励不会重发，整笔中后段失败时前段授予也不采纳。

额外失败：两命令未启用/已淘汰为 multiplayer-required/seat-eliminated；轮次不符 stale-round；choice 身份/代次不符 stale-choice；没有选择且非待处理空异常 no-pending-choice；非法阶段 wrong-phase；选择无合法首项或原选择命令失败为 invalid-choice/invalid-target 等既有 MatchFailure；奖励处理异常 invalid-loot。失败均原样返回。顺序为：处理当前选择 → 本轮战斗与结算 → 领取或放弃已赚奖励 → 处理后续选择 → nextRound。已淘汰席不再推进。不能用无限重试或清 pendingChoice 字段代替规则命令。

### 11.5 SR-B1-03 加时、平局与排名（规则定稿，目录外实现留 T4）

- 6-7 后若≥2席存活，进入 `overtime-1`，ordinal=`FINAL_ROUND+1`；之后 `overtime-N` 对应 `FINAL_ROUND+N`，严格递增，不重用6-1/6-7 ID。均为 PvP、沿用第6阶段基础伤害12。不开新野怪、补给、强化、异常或掉落计划；既有强化/异常/装备/成长继续生效。
- 每轮仍按既有 PvP 收入、利息、连胜败、经验、强化成长提交；进入下一轮沿用自然刷新/锁店及临时装备生命周期，商店必须通过规则入口生成，TP 后仍受共享池约束。每个加时有独立 settlementId/battleId/roundResults，不能再执行末轮奖励。
- **推进入口约定**：T4 接入前规则线补 `advanceMultiplayerRound(state, expectedRound): MultiplayerCommandResult`，目录内委托 nextRound，目录末轮及加时生成上述加时准备态；失败不变，淘汰拒绝。T2 snapshot/compile 和 apply 也须支持相同加时标识/基础伤害/经济。此 PR 未导出这个未来接口，当前 nextRound 在目录末尾返回 wrong-phase。Claude 的 T4 只负责调度接入，由 Codex 补规则入口；不能自行改 MatchState.round/m8 或将虚构加时强转目录轮次。依赖就绪前必须明确中断加时，不能宣称全局加时已实现。
- 平局（含双方空阵容、1200 tick 超时）：**每个真实席**扣12+对方存活数；普通配对双方各算自己的提案。胜方0、败方12+对方存活数；镜像 b 不扣、不提交，镜像来源真身在其实际配对独立结算。目录内平局用相应阶段基础伤害，规则相同。
- 同轮归零排序沿用 B1 项目规则：比较 **未截断 HP=`hpBefore-damage` 降序 → hpBefore 降序 → 固定 seatIndex 升序**，先者名次更好。不能用截到0的 playerHp 破同分。seatIndex 从开局固定0–7，与断线/重连、数组重排无关。同轮淘汰者排在剩余存活者后，较晚淘汰优于早轮淘汰；如果最后所有席同轮归零，也按此键产生唯一冠军，不能继续等待无人存活的下一轮。
- 有限终局：≥2席每完整加时至少有一场普通配对，该配对至少一个真实席被扣正伤害；总存活 HP 严格下降。无任何恢复玩家 HP 的规则，初始最多8×100 HP，因此加时最多800个已提交轮次即可结束（保守上界，空阵容连续平局通常远少于此）。T4 必测连续平局、双方空阵容、镜像及同轮多人归零的唯一排名；不能以单人 isFinal 或客户端倒计时直接定胜负。

### 11.6 验收边界

`tests/t3-round-settlement.test.ts` 覆盖真实公共开局→T2→T3→下一轮、独立19→28金币算例、XP封顶、成长、HP1承受9、JSON复制后的去重、迟到/镜像/非法字段原样拒绝，以及整轮暂存失败后重试。`tests/t3-timeout-loot.test.ts` 覆盖金币/组件/棋子只领一次、满容量放弃、后段溢出回滚、首项选择/空异常推进（前一个测试文件）、在线 PvE 淘汰和末轮存活。

SR-B1-02 的规则提交与 SR-B1-04 的超时入口已交付；全轮冻结/执行代次/发布、SR-B1-03 目录外实现、多人不可信恢复验证、网络投影、TP 卡池不在本 PR 内。没有修改 src/server、UI、单人数值或 golden，也没有修改既有 m5-replay 超时测试。

交付验证（基于 multiplayer `3cdb7f7`，实际 Node **v22.23.3** / npm **10.9.9**）：typecheck、build、test:server-entry、verify-t2-node-entry、verify-t3-node-entry 均通过；T3 的16例、T2、服务器（含B2网络）、经济/经验/轮目录/奖励/跨轮/Match 集成共 **23文件300例通过**。既有 T1 状态/事件/RNG 轨迹哈希不变。未跑完整测试套件，未改 `m5-replay` 或任何 golden。纯 Node 的子进程校验及 WebSocket 测试在允许这些能力的执行环境验证，不调整断言或超时阈值。
