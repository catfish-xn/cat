# HEX 自动战棋

TypeScript + Vite + Phaser 3 的本地自动战棋。M4 将羁绊、装备、Augment 与 Anomaly 接入原有商店、成长和 Mana/Ability 战斗。18 个原创占位单位、6 个羁绊、5 个组件与 15 件成装、各 8 个 Augment/Anomaly，支持正常获得资源并在同一局持续运营到 Game Over。无外部素材或服务依赖。

## 运行与操作

Node.js 22.12+（或20.19+）：

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

- **D**：2G刷新五格商店。**F**：4G购买4XP。键盘连续按/按住即时提交，与点击购买、拖拽交错生效。
- **E**：卖出鼠标悬停的我方棋子；拖拽时卖拖拽对象，空白处回落到显式选中对象。敌方不可出售。按钮支持无键盘操作。
- 拖拽部署到我方row4–7或空备战格。人口上限等于等级；满人口可移动现有棋子，或F升级再增加部署。非法位置红色预览并原样拒绝。
- 三张同名同星玩家棋子自动合成，最多三星；支持满备战席买第三张与连锁合成。棋盘棋子优先保留ID/站位；纯备战席合成不自动上场。
- 构筑面板查看羁绊与单位；点选两件库存组件合成，再点选物品和单位空装备槽。每单位最多三件；升星保留装备，溢出和出售返还库存。
- R2/R5 选择 Augment；R7 选择单位，再从三个 Anomaly 中确认，可付 2G 刷新。选择期间正常运营/Start/Continue 锁定；确认免费。绑定随升星迁移，出售绑定单位会销毁 Anomaly。
- **Start Combat**开始原速自动战斗，经济与部署锁定。空阵容出战会立即战败、扣HP并结算收入，避免卖光棋子后卡局。
- **Continue**保留玩家阵容/星级/站位，推进回合与敌军、刷新商店。HP归零进入**Game Over**，只能用**New Match**重开整局。

默认seed42。初始10G、HP100、level3/XP0、5个一星棋子、7格备战席。战斗首次结算收入5G和2XP；Continue不重复奖励。升级不改变当前商店，下次D/Continue使用新等级概率。1–5费买价等于费用，1/2/3星卖价为费用×1/3/9。

单位HP/AD随星级按1/1.8/3.24成长；技能独立三档数值。普通攻击physical，技能含physical/magic单体、magic范围与自身护盾。攻击和实际受伤积累Mana，满蓝下一tick施法。HP/Mana/盾及技能反馈均可见，战损不带入下一轮。

败局扣血=2+2×floor((回合−1)/3)+2×存活敌数；平局仅扣基础值，胜利不扣血。没有强制胜利终点，存活即可继续运营。规则是原创 S13 风格试验切片，非正式 TFT/S13 数据复刻。

## 分层与确定性

- `simulation/match.ts`：唯一经济/成长/回合/HP权威；纯命令原子提交，失败返回原state；只在终局转换结算一次。
- `progression.ts`、`upgrades.ts`、`unit-stats.ts`、`shop.ts`：等级、合成计划、星级属性、等级概率抽店。
- `rng.ts`：保留 lcg32-v1。独立商店、选择与奖励三流；商店每店十词，三选一固定三词，随机组件一词，拒绝不消耗。
- `content/`、`effects.ts`、`strategy-snapshot.ts`：内容只声明有限 primitive；战斗开始冻结所有来源、最终属性和触发计数器。
- `inventory.ts`、`choices.ts`、`round-schedule.ts`：原子资源计划、确定性候选与幂等奖励/选择时序。
- `combat.ts`/`combat-tick.ts`：隔离快照、固定50ms tick、原有BFS和占位预留、全部意图提交后同时结算伤害。最多1200tick；互杀/timeout为draw。
- `combat-abilities.ts`/`combat-damage.ts`：解析技能快照、双抗减伤、盾/HP管线；无动画或wall-clock规则。
- `rendering/match-session.ts`：只转发命令、累积帧时间；`BoardScene.ts`按真实state/events绘制和接受输入。

状态通过 serializeMatch/restoreMatch 验证并序列化；重放使用 schema4 / m4-v1 / m4-slice-v1、完整内容 digest、seed、命令和逻辑 tick。旧版本存档明确拒绝，不猜测迁移。

详细合同见 [Match](docs/MATCH_CONTRACT.md)、[Combat](docs/COMBAT_CONTRACT.md)、[M4 规则](M4_RULES.md)。范围见 [M4 计划](M4_PLAN.md)，门禁见 [M4 验收](M4_ACCEPTANCE.md)，实际结果见 [验证记录](docs/M4_VALIDATION.md)。M1–M3 文档保留历史记录。

## 浏览器验收

```sh
npx playwright install --with-deps chromium
npm run test:browser
npm run test:preview
```

两入口分别驱动dev和production preview，使用真实Chromium鼠标/键盘/touch、只读debug观察，无live状态注入或tick加速。桌面从同一正常 seed42 初态完整打到 R12 Game Over/New Match，touch 从初态走到 R8，覆盖两场 Anomaly 与四来源战斗、D/F/E、JSON/独立账本证据；输出到gitignored `artifacts/`。可用`CHROMIUM_PATH=/usr/bin/chromium`选择系统浏览器。CI使用Node22，自动测试/build与两个浏览器模式分别执行，失败仍上传截图/trace/日志。

本阶段不含 shared pool、carousel、8 人 PvP/networking、对手经济 AI、全量 S13 数据、复杂 replay/save UI、3D 或 Riot assets。
