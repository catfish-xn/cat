# #134 审查期接入清单

已读取 #134 head `4a025f8c12405c2e8c2e0ef159bc4ae1392317d9` 的 [MATCH_CONTRACT「G2-3 机制通用接口」](https://github.com/catfish-xn/cat/blob/4a025f8c12405c2e8c2e0ef159bc4ae1392317d9/docs/MATCH_CONTRACT.md#L333) 和 [MULTIPLAYER_CONTRACT §25](https://github.com/catfish-xn/cat/blob/4a025f8c12405c2e8c2e0ef159bc4ae1392317d9/docs/MULTIPLAYER_CONTRACT.md#L1653)。此版本仍在审查，不视为最终接口；未合并或rebase。先推送 `codex/g2-3-impl` 供试合并，不开PR。

## 合同点名的三项 Codex 责任

| 项 | 当前独立工作 | #134合入并rebase后必须完成 |
| --- | --- | --- |
| settleRound传卡池policy | 已核实`runSharedMatchCommand`目前对`applyRoundSettlement`遗漏policy；现阶段征服者英雄保留托管，不伪造通用grant调用。另修复现有结算白名单拒绝`g23Facts`的缺口，真实双边提案验证一次提交与重复拒绝 | 将同一事务闭包的policy从`shared-pool.ts`传到`applyRoundSettlement`及机制发英雄路径，调用`grantMechanicUnit`；共享卡池成功入席、池空折金、满席失败/托管均用同一事务验证，不能先扣池再遗失成功结果 |
| 单人结算存档金币校验 | 当前G23经济战斗收据的金币由`g23RoundGold`计入校验；准备期军械库费用已包含在`goldBefore/goldAfter`，恢复不能再扣一次，已删除重复扣减。尚非#134通用收据 | 改为按通用收据认证增量：gold奖励、unit池空折金、armory价款。必须区分结算前已包含在`goldBefore`里的机制收据与结算后新增收据，例如保存结算入口收据前缀。不能按本轮所有通用收据再全加，也不能与旧g23总额双计。补结算前/后、重复、篡改、text/object恢复用例 |
| 火药桶等不能维持阵营 | `eliminationResult`统一排除Forge及预留`g23-barrel`，Sion仍维持阵营；召唤物不增加玩家伤害。单人结算/终局校验与双边幸存名单复用同一谓词。当前Gangplank桶仍是有限伤害包，不存在可承伤实体 | 接`spawnCombatUnit/removeCombatUnit`时保持以上不变量；若桶最终换源apiName，必须同步非战斗体名单，不能仅凭`summon`一概排除Sion。补中途出现/移除的完整回放与恢复验证 |

以上运行规则的数值/省略分类以RECONCILIATION为准，不能把通用接口合同当内容数值依据。

## 其他已确认连接点

- 机制容器使用`conqueror/academy/alchemist/junkerKing/experimentCells/radiantConversion`键，`hidden`不发客户端。现有`g23`是领域权威；接入时明确投影关系并在恢复时核对，不能产生两套独立可修改进度。
- 新选择kind是`forge/blackMarket/armory`，复用`choose`与`@skip`。Rumble超时必须是0金选项；全购后Finishing、三星Titan菜单也要有合法免费timeoutOption。不开常驻商店。
- 光明物品使用`kind:'radiant'`与`radiantOf`；黑市化工装接trait restriction。现有普通recipe/轮盘/TG/重铸池保持独立，不能因物品目录扩容混进奖励装。
- 准备召唤物来源事实、不可售/不占人口/不占共享池、临时`unitRevived`事件替换或对接均留到rebase后；本轮只修复坐标、判负和伤害口径。
- HighRoller按combatId/施法序号保留唯一金币来源，接`castOutcome`；Sion接`bindingChanged`。领域事件完整盖号，不能只在私有视图显示累计结果。
- 服务器exports、提案g23Facts转发等签名需求写合同交Claude；不改`src/server/`、`src/rendering/`或`src/server-entry/`。

## 独立验证与范围

B8用公共命令交换Lux/Nami站位，保留同tick来源死亡测试；单留Loris和Zyra分别覆盖有/无掉落来源的失败结算。`live-reveal-audit.json`记录公共前缀/事件/终态及旧新源码字节证据。本轮将`tests/m8-b8-live-reveal.test.ts`作为用户追加工作的目标验证，未运行全套测试或timing。

独立验证结果：typecheck通过；12个目标文件224项通过（含本轮追加B8）；server-entry的165个状态逐字节一致。另以seed4的公共cannon路线在5-1购买Rumble、三场后支付5金升级，在5-5结算验证text/object恢复、金币篡改拒绝和重复step惰性，确认准备期款项不能在结算恢复时重复扣减。详见`development-validation.json`。

尚待最终接口接入、重录最终夹具、最终head上各一次全套`npm test`和`test:timing`，之后才开目标`multiplayer`的PR。
