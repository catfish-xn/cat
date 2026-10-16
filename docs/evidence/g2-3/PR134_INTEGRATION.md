# #134 通用接口接入

基线multiplayer merge `19aa9f1`，从`31a74c4` rebase；保留form/g23战斗字段、mechanic来源与receipt定义查找。MatchState根g23和g23ItemGranted已移除。

| 合同责任 | 实现 | 回归 |
| --- | --- | --- |
| 目录超集 | choices/grants/items、resource-provenance、validate-content及content/index统一g2-3-item-registry | source apiName发奖/forge/恢复 |
| 光明身份 | radiant + radiantOf，36件唯一对应 | 查询/无配方/非法base |
| 唯一容器 | seat六键、hidden私有RNG/重演、通用收据；冻结g23仅编译DTO | 视图可读且hidden不泄漏、篡改恢复拒绝 |
| 英雄奖励policy | settleRound闭包透传到结算/grantMechanicUnit | 真实共享开局至2-1、有池/空池折金、防重 |
| 金币恢复 | 冻结mechanicReceiptPrefixLength，前缀后gold+unit.gold-choice.price | 准备/结算后、付费、篡改、text/object |
| 召唤物 | 不可售/不占人口/不占池；Forge/barrel不撑胜负，Sion撑胜负 | 出生/绑定/复活、废弃ID不重用、合星receipt定义查找 |
| 军械库 | 普通/全购/三星菜单合法免费timeoutOption；购买合星刷新菜单/generation | 三种菜单超时选择 |

以上新增覆盖集中在tests/g2-3-integration.test.ts；原G23、B8和netcode-hooks回归同步适配。完整验证结果写入development-validation.json，本地全套仅运行一次，随后发现的回归只复测对应失败文件；最终head的timing仅一次，完整结果与自动CI记录在PR。

## 配套余项

`src/server/room/room.ts`的`buildReceipt`尚未转发`proposal.g23Facts`。Claude需加可选字段原样转发；缺少时在线结算不能推进这些机制。已写入两份合同和UI_REQUESTS的G23-SERVER-FACTS，本PR遵守不改server/rendering/server-entry边界。

黑市无物品包使用grantItem:false；保留工具用consumable收据；有限复制器目标选择、召唤物和装备脚本省略见RECONCILIATION，不将通用接口当数值证据。
