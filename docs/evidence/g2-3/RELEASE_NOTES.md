# G2-3 发布说明（#134 接入）

rules `s13-g2-3-v2`、content `s13-14.24b-g2-3-v2`统一发布；旧存档及旧回放输入失效，不能继续旧局。schema7/save3/replay3保持，不提供内容迁移。

本批增加12位英雄、4套按开战站位冻结的远程形态、其余羁绊规则和30个异变。征服者启用15箱，16–20无源阈值不启用；仅含延后物品的档位按Gold=max(原金币,map22整档估值)折金，并保留已实现奖励。已有拆卸器、重铸器保留。第14档60金+光明装备+拆卸器，第15档200金+本局永久光明转化。Rumble三星自爆采用官方20000%。

学院29组项目赞助池、未恢复的脚本/碰撞/召唤物属性均明确标约定值或有限近似，详见[实现对账](RECONCILIATION.md)。神器、辅助装、战术家之冠、窃贼手套新奖励、锻造器、复制器延后下一批。

已接入#134（19aa9f1）的机制容器、弹出选择、免费超时项、召唤事件和radiant kind。目录选择g2-3-item-registry超集，统一用于发奖/选择/恢复/摘要。CONTENT digest为fnv1a32-utf16:427b83b0；本次收尾因规则修正升至v2。

服务器buildReceipt仍需Claude转发proposal.g23Facts；本PR不改server/rendering/server-entry，因此不是联机机制上线声明。夹具字节证据见release-audit.json、input-fixture-audit.json、live-reveal-audit.json，开发验证见development-validation.json；最终head全套与timing结果在PR记录。

## #136 后收尾

机器人统一读取普通、光明和炼金物品超集，未知物品安全跳过；恢复补回选秀出生登记、机制收据结构校验和removedUnitIds校验。Power Absorption按官方14.24修复说明在百分比AD后加固定AD；Titan后不再重复出售付费升级。征服者5%成长保持线性，Rumble一/二星自爆明确为项目约定值。

经济恢复使用有界、完整内容键的重放缓存及前缀复用；奖励原子缓存不保留外部可变对象；单次恢复内共享机制声明计算，跨次恢复仍重新校验。回放快照保留经过证明的不可变子图，激活存档复用该快照边界，外部可变数据仍脱离。整档导出按原属性顺序拼接，复用私有冻结战斗档案的UTF-8 Blob；逐字节回归保证与JSON.stringify一致，外部档案不缓存。自动钩子返回失败时发mechanicFailed事件，失败原子不写收据或消耗资源。

U6首跑失败（[run38938055193](https://github.com/catfish-xn/cat/actions/runs/38938055193)，job117098416536）出在先读领域状态、再异步读DOM：两次读取之间战斗可结算，revealed断言失效。验证改为同一浏览器任务读取两者，仍强制观测到有效的战中揭示；未发现随机流不确定性。

v1的存档和回放输入按身份拒绝；v2夹具通过原公共指令生成器重录，历史夹具保留。性能门槛、单测超时和CI实际作业时限均未放宽；预算文档同步已有45分钟input作业时限。收尾逐项测试映射和开发测量见[FOLLOWUP_VALIDATION.md](FOLLOWUP_VALIDATION.md)，最终head的测试和性能结果见PR。
