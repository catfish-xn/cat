# 炼金男爵黑市单包合同（2026-10-22 用户已批准）

当前 epoch：`v20-black-market`，父 `v20-live-combat`，基线 `42d8a4048409dc60e9b1f9647b398cb20e4529af`。本合同覆盖 CHEM_BARON_FIX 和旧合同中的 N=3 项目约定；其他数值和规则不变。

## 证据及单包确定方式

用户提供的本地调研 `/home/aiapps/workspace/s13-ui-atlas/encounters/tft_s13_opening_encounters_14.24b.md` §7.1，以及 `S13_ORIGINAL_RESEARCH_BUNDLE/tft_s13_14_24b/images/chem-baron-black-market-14.24b.png`：14.24b 中文实机显示一个完整奖励包和「全部拿走」「保留微光」；调研的 D04/D05 记录客户端 `AllowSingleItemSelection=false`、Take All / Save Shimmer 字串绑定。该字段禁止逐件选择；单包数量同时依据截图和用户批准，不把该布尔字段误称为候选数量常量。本次只读本地资料，未下载或连接外部服务器。

仓库 `src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz` 中 `TFT13_Crime_BlackMarket1…8.mConstants` 是具名奖励包权重；没有“从三候选挑最佳包”的依据。继续使用 `G23_BLACK_MARKETS` 的源顺序、既有整数 Bps、各档奖励描述和阈值。每个 offer 执行一次 lcg32-v1，用 `floor(word * totalWeight / 2^32)` 落入累积权重区间，生成完整奖励包。这正是旧实现对相同输入 RNG 的第一候选，非第二/第三候选，不挑最高价值，也不添加权重。

每次黑市固定消耗 **1 word**，包括只有一个奖池条目的 7/8 档；不为丢弃的第二/第三候选虚耗 RNG。黑市仍先于冠冕抽样，冠冕每顶一词不变；所以原来有三候选的 offer 之后，同一 G23 流的后续结果会变化。仅保证相同入参的首包分布/结果与原首候选相同，不承诺整局随机轨迹不变。该 RNG 实现是项目的确定性映射，不宣称复刻了 Riot 服务端 RNG。

## 导出、输入输出和失败

- `rollG23BlackMarket(tier:number,rngState:number)`：档位 1–8、uint32 seed；返回 `{rngState,draws:1,table,options:[唯一包],id,reward,weightBps}`，末三个字段是唯一包的兼容别名。非法档位/seed 抛 `RangeError`。
- `G23MarketOffer` 结构仍为 `{id,tier,optionId,optionIds,round}`；`optionIds` 现在严格由规则生成一个 ID，`optionId===optionIds[0]`。不增加 schema 字段。
- `decideG23Market(p,id,take,round,optionId?)` 签名不变。`take=true` 仅允许唯一包 ID，省略时默认它；追加完整源 reward 描述及带 optionId 的唯一经济收据。保留现有 `drainG23Rewards` 的原子、金币、物品、英雄法球/容量及后续锻造器领取语义，不引入逐件勾选或部分接受。已经接受的包中若包含需要后续操作的工具/锻造器，仍走既有流程。
- `take=false` / `@skip`：不追加奖励，微光和 offeredThrough 保留，skips +1，offer 清空；原 health-per-skip 成长、下档门槛、跨档及 PvE 不增微光均不变。领取清空 shimmer/offeredThrough，保留历史 skips。决策本身不耗 RNG。
- 低层决策对 stale offer、非布尔 take、非法/过早 round、未提供的领取包抛 `RangeError`，输入不变。通用 Match 命令继续返回既有 `wrong-phase` / `stale-choice` / `invalid-choice` 等，无新增 reason；失败原 state、无事件、无资源或 RNG 消耗。
- `selectChoice(state,choiceId,generation,definitionId,unitLootPolicy?)`、网络 `choose` 与 `chooseG23BlackMarket(state,offerId,take)` 形状均不变。`definitionId` 接受唯一包 ID 或 `@skip`。不接受其他奖池包 ID，即使它是合法内容。
- `forfeitPendingChoice` 是联机入口，沿用 `timeoutOption:'@skip'`，**超时保留微光，不自动接受唯一包**。普通强化“选第一项”的通用说明不覆盖此黑市特例。重复选择/超时拒绝且不重发；已发原子使用现有唯一收据。

## 投影与 Claude 接线

`pendingChoice.kind==='blackMarket'`、`choiceId/generation/offers/payload` 不变；`offers` 数组恰好一个完整包 ID。`payload` 仍为 `grantItem:false, source:'black-market', skippable:true, skipReward:{kind:'health-per-skip',amount:1}, timeoutOption:'@skip'`。`seatMechanics.seat.alchemist.offer` 给同一唯一包，hidden 的 RNG 和账本不公开。金额/物品名称由现有源奖励描述及展示适配器读取，不把包 ID 当装备 ID。

Claude 界面显示该包的全部奖励和「全部拿走」「保留微光」两个按钮；分别提交唯一包 ID / `@skip`，不提供三包选择或逐件选择。仅定义数据/文案/回调，不规定布局、颜色和动画。服务器无需新命令或字段；须验收唯一包透传、超时 `@skip`、旧代次拒绝、断线重连保持同一个包、重复请求不重发。服务器/界面目录本次未改。

## 版本、恢复和录制

rules=`s13-g2-3-v20-black-market`，content=`s13-14.24b-g2-3-v20-black-market`；CONTENT=`fnv1a32-utf16:9a83da50`，LOOT_REPLAY=`fnv1a32-utf16:e0eb43e2`。schema/save/replay/command 保持 **11/7/5/5**、NET6、规则侧多人契约5：字段结构未改，仅规则身份升级。所有旧 rules/content/digest 拒绝恢复、无迁移；不能替换旧存档版本字符串绕过重演。当前经济收据重放只重建一个包，并校验完整状态和收据，不重新发奖。

当前 golden / recorded states / B8 / C19 / transfer / Herald 消费者改指本 epoch。所有 `v20-live-combat` 及更早版本化脚本、证据、fixture、content baseline 和源归档字节不变，`tests/fixtures/g2-4b-herald-raw/manifest.json` 字节不变。详细录制和验证见 [发布说明](evidence/v20-black-market/RELEASE_NOTES.md)。
