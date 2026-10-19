# S13 14.24 异常 P4

基底：multiplayer b9c17f9a804ffb77162847ace28c9470b02e0e2e（含 #190）。
名称使用官方 zh_cn；系数取 `s13-14.24b/raw/map22.bin.json.gz`，保留 B 补丁覆盖。
原始 IEEE 浮点归一到六位小数，再换算整数基点。不改版本，交由合并者统一升版。

## 冻结的最小公共接口

- `isPresent(unit,tick):boolean`：在场、存活；缺席单位不进入动作、范围与被动处理，但仍阻止队伍提前判负。
- `isSelectable(unit,tick):boolean`：在场且可被选中；隐形仍可受范围伤害。到期 tick 恢复。
- `freeCells/nearestLanding/relocate`：同一落点计算；当前在场单位占格，缺席不占格，距离并列按行、列；单位与事件顺序按 ID。位移必须有 movement 事件。
- `AnomalySummon`：ownerId、kind、ordinal、bornAtTick、source；战斗身份不进入人口、卡池、装备或羁绊计数。攻击代理另有可追溯身份。
- `AnomalyModule`：start/tick/cast/attack/takedown/death。各异常独立文件，共享注册表只登记。
- `anomalyState`：JSON 收据。存档以已验证开战输入完整重演核对全部状态；沿用动态战斗严格验证，不接受候选状态自证。

## 项目约定

- 深入敌阵：首次施法先跳，选半径2内可选敌人数最多的空格，再按原地距离、行列决胜；新眩晕从下一 tick 生效。
- 势不可挡：实际伤害参与者计助攻；同敌人仅一次，持有者必须存活。没有下一个目标仍结算治疗；新目标按距离、ID。
- 斥力发生器：施法目标距离不超过2格时，沿远离持有者的六角射线最多击退2格；边界/占格截短，控制免疫与根深蒂固阻止击退。
- 震撼登场：缺席到 tick120，落回起始格或最近空格，增加最大生命差额；全敌眩晕40tick。满棋盘延迟到有空位。未补发缺席期间周期动作。
