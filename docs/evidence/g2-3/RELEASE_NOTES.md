# G2-3 发布说明（#134 接入）

rules `s13-g2-3-v1`、content `s13-14.24b-g2-3-v1`统一发布；旧存档及旧回放输入失效，不能继续旧局。schema7/save3/replay3保持，不提供内容迁移。

本批增加12位英雄、4套按开战站位冻结的远程形态、其余羁绊规则和27个异变。征服者启用15箱，16–20无源阈值不启用；仅含延后物品的档位按Gold=max(原金币,map22整档估值)折金，并保留已实现奖励。已有拆卸器、重铸器保留。第14档60金+光明装备+拆卸器，第15档200金+本局永久光明转化。Rumble三星自爆采用官方20000%。

学院29组项目赞助池、未恢复的脚本/碰撞/召唤物属性均明确标约定值或有限近似，详见[实现对账](RECONCILIATION.md)。神器、辅助装、战术家之冠、窃贼手套新奖励、锻造器、复制器延后下一批。

已接入#134（19aa9f1）的机制容器、弹出选择、免费超时项、召唤事件和radiant kind。目录选择g2-3-item-registry超集，统一用于发奖/选择/恢复/摘要。CONTENT digest为fnv1a32-utf16:5789146c；版本只切换一次。G2-4a（征服者第4/8/9档恢复原奖励、锻造器4选1）后digest为fnv1a32-utf16:a9749673、loot replay为fnv1a32-utf16:0e85d9f2，规则/内容版本号不变，旧存档按digest拒绝。

服务器buildReceipt仍需Claude转发proposal.g23Facts；本PR不改server/rendering/server-entry，因此不是联机机制上线声明。夹具字节证据见release-audit.json、input-fixture-audit.json、live-reveal-audit.json，开发验证见development-validation.json；最终head全套与timing结果在PR记录。
