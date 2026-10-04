# HEX 自动战棋

TypeScript + Vite + Phaser 3 的本地自动战棋。M3在M2连续回合与商店之上加入等级/XP、人口、分级商店、自动升星、Mana技能、护甲/魔抗/护盾与玩家HP/Game Over。使用11个占位单位，支持同一局持续运营，无外部素材或服务依赖。

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
- **Start Combat**开始原速自动战斗，经济与部署锁定。空阵容出战会立即战败、扣HP并结算收入，避免卖光棋子后卡局。
- **Continue**保留玩家阵容/星级/站位，推进回合与敌军、刷新商店。HP归零进入**Game Over**，只能用**New Match**重开整局。

默认seed42。初始10G、HP100、level3/XP0、5个一星棋子、7格备战席。战斗首次结算收入5G和2XP；Continue不重复奖励。升级不改变当前商店，下次D/Continue使用新等级概率。1–5费买价等于费用，1/2/3星卖价为费用×1/3/9。

单位HP/AD随星级按1/1.8/3.24成长；技能独立三档数值。普通攻击physical，技能含physical/magic单体、magic范围与自身护盾。攻击和实际受伤积累Mana，满蓝下一tick施法。HP/Mana/盾及技能反馈均可见，战损不带入下一轮。

败局扣血=2+2×floor((回合−1)/3)+2×存活敌数；平局仅扣基础值，胜利不扣血。没有强制胜利终点，存活即可继续运营。规则是M3原型数据，非完整TFT/S13复刻。

## 分层与确定性

- `simulation/match.ts`：唯一经济/成长/回合/HP权威；纯命令原子提交，失败返回原state；只在终局转换结算一次。
- `progression.ts`、`upgrades.ts`、`unit-stats.ts`、`shop.ts`：等级、合成计划、星级属性、等级概率抽店。
- `rng.ts`：保留lcg32-v1。商店每格固定两词、每店十词；升级/合成/战斗不消耗商店RNG。
- `combat.ts`/`combat-tick.ts`：隔离快照、固定50ms tick、原有BFS和占位预留、全部意图提交后同时结算伤害。最多1200tick；互杀/timeout为draw。
- `combat-abilities.ts`/`combat-damage.ts`：解析技能快照、双抗减伤、盾/HP管线；无动画或wall-clock规则。
- `rendering/match-session.ts`：只转发命令、累积帧时间；`BoardScene.ts`按真实state/events绘制和接受输入。

状态与技能快照可JSON序列化，重放按schema3/rules m3-v1/content m3-content-v1、seed、命令顺序及逻辑tick复现。M2旧数值与五词商店轨迹不跨版本兼容。

详细合同见[Match](docs/MATCH_CONTRACT.md)、[Combat](docs/COMBAT_CONTRACT.md)、[数值规则](docs/M3_RULES.md)。[M3计划](M3_PLAN.md)保留规划时原文；完成证据见[验证记录](docs/M3_VALIDATION.md)。M1/M2文档仍是历史记录。

## 浏览器验收

```sh
npx playwright install --with-deps chromium
npm run test:browser
npm run test:preview
```

两入口分别驱动dev和production preview，使用真实Chromium鼠标/键盘/touch、只读debug观察，无live状态注入或tick加速。包含连续成长、胜败扣血、GameOver、D/F/E高频、JSON/独立账本证据；输出到gitignored `artifacts/`。可用`CHROMIUM_PATH=/usr/bin/chromium`选择系统浏览器。CI使用Node22，自动测试/build与两个浏览器模式分别执行，失败仍上传截图/trace/日志。

本阶段不含traits、items、augments、anomalies、shared pool、8人PvP、复杂控制/暴击/吸血或正式美术。
