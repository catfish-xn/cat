# B5-17 / B5-18 / B5-19（2026-10-27）

数值依据：本地 `augments-research-2026-10-23/data/augments-14.24.json` 的 Academy（NumItems=1、NumOptions=2）、PandorasItems2（NumComponents=2、NumCompletedItems=null）、SalvageBin（NumRounds=7）。物品和英雄初始礼物来自对应说明。执行范围与抽样属于用户批准的 P-B5-S3B-EXEC，不宣称新增原服证据。

| 强化 | 输入与效果 | 生产接入 |
|---|---|---|
| academic-research | 取得1组件、Lux、Ezreal。选择边界后的普通合成消耗两组件，转为原成装和不同赞助装二选锻造器。穿戴合成同样计入；特殊配方保留；满席／战中待发。 | `combineItems`、`equipItem`、共同礼物drain、`batch1AnvilSpecification`、`planOpenAnvil`；战中装备输入与恢复重放 |
| pandoras-items-ii | 取得2组件。以后每轮入口按物品ID顺序重掷库存普通组件及普通成装，各自类别等权，允许原样。 | `nextRound`、`advanceMultiplayerRound`，早于该轮其他奖励；共享入口复用同一规则 |
| salvage-bin | 取得1成装。选择当轮起第7场完成PvP给1组件；出售把普通永久成装按配方拆为2组件。 | `sellUnit`、共同礼物drain、真实RoundResult与battles认证 |

公共签名及失败枚举未变：`combineItems(state,aId,bId)`、`equipItem(state,itemId,unitId,slot,options?)`、`sellUnit(state,unitId,unitLootPolicy?)`、`openAnvil(state,unitId)`、`selectChoice(state,choiceId,generation,definitionId)`；返回既有 MatchCommandResult。预检失败保持原状态与空事件，不消费RNG。工具、购买或直接领取成装不计为合成。锻造器超时仍选第一项（原合成物）。

内部纯派生签名：`academicGiftPlan(state):AugmentGift[]`、`academicAnvilOffers(state,receiptId):readonly string[]|undefined`、`pandoraConversions(state,items,round):S3bConversion[]`、`salvagePlan(state,items,sale)`、`salvageRewardPlan(state):AugmentGift[]`。这些由领域入口调用，客户端不传结果或奖励参数。

存档封套与事实联合类型均不增加字段。Academy选择边界来自必发初始组件收据；合成事实派生物品消耗及待发锻造器，锻造器出生／打开／选择使用原协议。Pandora与Salvage复用 `g23-item-converted{itemId,from,to,receiptId}`；第二组件使用正常物品收据。转换命名空间只在明确强化及相应来源存在时可认证，旧征服者光明转换校验保持。

资源fold检查配方、身份、序号与物品消费；完整历史装备重放检查每轮库存、每次出售绑定、全部转换及发放顺序。对象、JSON、序列化三个离线入口共同执行；共享快照入口也执行强化礼物、锻造器及装备历史认证。窃贼手套转换后仍保留旧临时装备RNG收据，并从已认证转换重建原父装备身份；Pandora新轮入口的转换不得证明同一新轮的旧父装备掷骰。打捞桶跨轮PvP计数要求原有完整battles历史。恢复拒绝缺失、重复、改变物品／候选／来源、伪造转换时机或计数，不补写或补发。

`src/server` 无修改：Room的既有 `combine` / `equip` / `sell` / `openAnvil` / `choose` 路由已覆盖；以真实TwoSidedBattleResolver房间逐项验收。没有新增客户端命令、控件或布局。

专项文件：`tests/augment-pool-batch5-s3b.test.ts`、`tests/augment-pool-batch5-s3b-history.test.ts`、`tests/server/batch5-s3b-room.test.ts`；独立配方及BigInt抽样转录在 `tests/fixtures/m5/augment-batch5-s3b-oracle.cjs`。外部数值档案断言使用 `it.skipIf(!existsSync(RESEARCH_FILE))`；核心命令和恢复测试不依赖该文件。
