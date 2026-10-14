# T13-B 里程碑 5：随机宝珠夹具与来源校验

派单：`multiplayer@f09fce0` 的 `docs/DISPATCH_2026-10-14.md` §6。
从 `codex/t13-loot@ad72928` 继续，先合入 `origin/multiplayer@f09fce0`。
本轮不修改玩法、来源账本校验、内容 digest 或 `src/server/`；补齐已有日程的恢复检查：自选补给返回 settlement，其余选择按事件 timing 返回对应阶段，伪造 `returnPhase` 拒绝。
`CONTENT_DIGEST=fnv1a32-utf16:bd9c3a8e`，`LOOT_REPLAY_DIGEST=fnv1a32-utf16:5cd0487c` 保持不变；格式 3 的前驱是已发布 T13-A（96c9126d），不是 T12（44fe9c0e）。旧档仍只保全导出，不迁移续玩。

## 来源身份与校验边界

来源 fold 的 receipt 夹具从旧 `[roundId, encounterId, sourceUnitId, slot]` 改成 §18 的 `[orbId, entryOrdinal]`，其中 `orbId=["orb", roundId, encounterId, sourceUnitId, slot]`，receipt 仍为 `[dropId,"grant"]`。没有修改来源 fold 的生产校验顺序或放宽 schema。原有 64 条来源 fold 用例保留，包括收据绑定、重复/缺失出生、战斗前缀、消耗候选、递归升星与成长归属。

迁移选择测试到真实 2-4 时暴露 `returnPhase` 未核对日程的缺口，现拒绝补给返回 preparation、强化选择返回 settlement 的伪造；正常选择恢复仍逐字段相同。原战后金币篡改测试继续使用真实 PvE settlement，因为补给 preparation 的金币可经合法购买/刷新改变，不能以旧战斗预算约束它。

随机宝珠的多个条目可能共用一个载体死亡。篡改其中一条死亡身份会先命中 `source death conflict`；篡改完整中立死亡回执的事件序号会先命中 `neutral receipt event`。移到本场结算前的容量恢复出售会命中 `sale before settlement`。这些是新夹具所命中的既有严格边界，不修改实现让错误名称适配测试。

## 公共路线重录与数值依据

`tests/fixtures/t13-loot-public.ts` 只通过真实构造、商店、购买、部署、装备、选择、战斗 tick 和继续命令生成状态。新增的 route-driver 参数只控制测试购买策略、部署副本和装备/选择优先级；默认四条 golden 路线行为保持相同。每次正常 driver 转移仍经过独立 `tests/fixtures/m5/oracle.cjs` 账本。

| 用例 | 真实新路线与保留的检查 |
| --- | --- |
| live-growth | seed 74，最多购入两张 Tristana 并同时部署；3-7 掉落第三张。既有成长 500+250、本场 unit-6 新增 125，合并后 875 Bps。保留所有 20 项篡改拒绝、原始参战星级、出生→升星→成长顺序、逐 tick 完整恢复对照和重复命令无副作用。 |
| live-transfer | seed 4，两个一星 Ezreal 为 unit-22/unit-25，拳套 item-9 和 mage-armor 绑定 donor；4-7 实际奖励 unit-29。迁移/槽冲突返还两分支都保留 Combat basis、临时装备父子来源、异常绑定、一次性 roll 和 12 项篡改检查。 |
| live-capacity / loot-view | seed 36 的 3-7，九格备战席，23G 开战；bow、sword、Tristana、remover 四个条目。tick 76 已揭示、tick 83 结算；英雄等待容量，工具仍发放。出售实际 Lux 后才领取英雄。投影按计划顺序，收据按实际发放顺序，因此比较收据集合，同时单独钉住计划/投影顺序。 |
| lethal PvE | seed 38，公开空阵容败局累计损失 97HP。4-7 保留 unit-12、unit-11 或空阵容，分别产生两次死亡、仅宝珠载体死亡、零死亡；满席英雄只读保留或未赚得奖励不发放。无 HP/死亡/资源注入。 |
| live-economy | seed 42，实际购买/刷新得到开战 9/49/50G；实际宝珠 +1G 后利息基数 10/50/51，利息 1/5/5，结算 16/60/61G。真实历史 investmentHp=128，增加 8×利息后为 136/168/168；独立 H=80 代数向量继续保留。 |
| live-reveal | seed 42 mage 在 tick 52 同时击杀 r00/r01；四个宝珠条目均绑定 r00/eventSeq449。单独 Rell/unit-12 与 Nami/unit-16 路线分别只击杀 r00、r01，证明奖励严格跟随自己的载体。 |
| equipment fixture | seed 6240 保留实际 Maddie/Lux；血饮需要随机 cloak + 2-4 sword，开始轮改为 2-5。双血饮在 3-5 保留额外随机物品。investment-strategy 的真实累计利息贡献使 Irelia HP 为 700+56=756，不改装备数值。 |
| restore / MatchSession / oracle | PvE 现在直接 settlement、pendingChoice=null，不再伪造旧 PvE 组件选择；选择恢复/重复请求检查转到真实 2-4 自选。独立 oracle 继续审核全部八组件、随机计划、两条完整 cannon 路线及不合法收据/来源。 |
| token lifecycle | Maddie 开局使用 seed 6240；掉落立即合并使用 seed 13 的真实两个 Lux 商店（槽 2/3）与 1-3 Lux 奖励。保留真实 BoardScene token 同步、销毁、选择、恢复检查；只模拟显示对象，不声明浏览器验收。 |
| T12 offline transfer | 同 seed 4 的公开路线；拆卸器取回拳套，先给 donor 穿 vest，战中把拳套给 survivor。奖励合并后 vest 返回库存，逐 tick 恢复对照，伪造无 blocker 的返还仍拒绝。 |

重录命令：

```sh
node scripts/record-t13-fixture-evidence.cjs --write
node scripts/record-t13-fixture-evidence.cjs
```

`milestone5-fixtures.json` 记录七个公共路线的完整 prepared/started/revealed/pre-final/ended 状态 SHA-256、完整事件 SHA-256，以及成长路线的公共命令轨迹 SHA-256。脚本先严格恢复每个状态，再记录/核对 hash；不会用生产输出自动改写测试预期。

## 根目录服务器集成夹具的边界

`tests/t11-opening-xp`、`t11-round-flow`、`t5r-b7-integration` 原来在根目录，却构造真实 Room。它们的规则侧夹具显式给真实 `createMatch` 补上 §18.2 的 `shared-deferred` 构造参数（局部 Vitest 模块替身仅适配构造参数，仍调用真实函数），保留原有房间时钟、共享池、整局结算、回放和断言。单人开局显式传 `solo`。这不代表生产 Room 已修复；未修改的 `tests/server` 继续直接验证生产初始化，单列为“待 Claude §5.1”。T5R 的 v2 掉落投影同时校验 `revealedOrbs`。T11 采用 seed 0 的八机器人实际对局（40 轮，结束于 overtime-2），保留 38 个目录节点、加时、补给无战斗、每个战斗仅进入一次和完整排名断言；旧混合空闲人类席位路线会提前结束。

## 耗时预算

没有删除恢复采样、战斗、断言或跳过用例。单 worker 清单回归实测 B7 逐机制恢复：3-7 5.51s、4-7 7.91s、5-7 9.17s，原默认 5s 不足，局部预算改为 20s。T12 完整公共获取和逐 tick 回放实测 5.45s，局部预算改为 15s。

T5R 完整八席回放实测 64.27s（之前为 62.88s），原 60s 不足，局部预算 120s。

M6 同机单 worker 完整实测：cannon 82.99s、sniper 134.39s、mage 123.06s、sniper-caitlyn 130.34s，后三条仅超过原 120s 预算。四条逐 tick 回放局部预算改为 180s；四条完整 envelope 验收 13.07/21.63/17.81/19.94s，保留原 120s。没有改 M6 的路线、断言、采样或共享数据。T11 seed 0 真实 40 轮通过，42.70s。

最终全套验收数据在完成固定树单跑后补齐。
