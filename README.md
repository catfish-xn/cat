# HEX 自动战棋

TypeScript + Vite + Phaser 3 的网页单人自动战棋。M5 以 S13 原赛季 **14.24b** 为固定参考，提供 19 个英雄、5 个职业羁绊、7 个组件与9件成装、6 个强化和3个异常，从2-1运营到6-7。单人简化包括固定对手、无限商店池、补给代替选秀及手动准备期；不是全量 TFT。完整验收尚在进行，实际进度见 [M5 验证记录](docs/M5_VALIDATION.md)。

## 运行与操作

Node.js 22.12+（或20.19+）：

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

- **D**：2G刷新五格商店；**F**：4G购买4XP。快速输入和按住重复即时提交。锁店保留自然换轮的商品，主动D仍刷新并保持锁定。
- **E**：卖出鼠标悬停的我方棋子，拖拽期间卖拖拽对象，空白处回落到显式选中对象。触屏提供购买、出售、部署等按钮。
- 拖拽部署到我方row4–7或空备战格；手机可点选单位和目标格。人口上限等于等级，备战席九格。取消拖拽不提交，正常松手提交。
- 三张同名同星自动升星，最多三星。满备战席可购买能立即合成的第三张。升星优先保留棋盘单位；纯备战席合成不会自动部署。
- 装备面板选择两件库存组件合成，再装备到单位空槽。每单位三槽；出售返还装备，升星转移装备并返还溢出。未开放配方明确拒绝。
- 新局先选两件组件，再选2-1强化。强化还有3-2、4-2两次；4-6选择异常目标并查看单项报价，1G刷新，确认免费。选择期间普通运营暂停。
- 每阶段.4为组件补给，无战斗；.7为PvE，前四次存活后有随机组件和组件选择。完成奖励选择后才能Continue。
- **Start Combat**开始50ms固定tick的自动战斗，期间经济和部署锁定。界面显示目标、实际伤害、盾吸收、治疗、状态及来源；战损不带入下一场。
- **Continue**进入下一轮，保留玩家资源和站位。HP归零失败；6-7战胜最终PvE成功，失败或平局为失败。**New Match**重开。

默认seed42，初始100HP、10G、等级3、Irelia/Maddie/Lux各一星。收入分为基础5G、对战胜利1G、最多5G利息和最多3G连胜败金；PvE/补给不增长或支付连胜败金。每完成一轮2XP，最高九级。经济结算、历史数据出处及明确简化详见 [M5规则](M5_RULES.md)。

构筑面板提供四炮四哨、两狙四监察两哨、四法四哨的正常购买和转型路线。Caitlyn是可购买的狙神上限选择；基础成型不依赖抽到五费或指定异常。

## 架构与确定性

- `simulation/match.ts`是唯一对局权威。命令原子提交，拒绝返回原状态；金币、XP、HP、成长和奖励只结算一次。
- `economy.ts`、`match-rules.ts`定义结算及升级/商店表；`round-schedule.ts`定义35轮日程。
- `content/`归档固定客户端数据及14.24b覆盖，运行和CI不在线获取资料。`strategy-snapshot.ts`在开战时冻结单位、羁绊、装备、强化和异常。
- 商店、选择、奖励、战斗种子使用显式独立RNG；每场Combat持有自己的RNG。拒绝命令不消耗随机数或序号。
- `combat-s13*.ts`处理有限技能、来源独立盾层、状态、持续动作、治疗和伤害分担。旧底层测试仍覆盖未改变的移动、寻路与原子规则。
- `rendering/match-session.ts`只提交命令并累计时间；界面读取领域状态与事件，不另算规则。

存档使用schema5、`m5-14.24b-v1`、`s13-14.24b-slice-v1`、命令协议2和内容digest。旧schema4及未知版本明确拒绝，不猜测迁移。恢复不重发奖励、不重抽随机数、不重新开战。完整契约见 [Match](docs/MATCH_CONTRACT.md) 和 [Combat](docs/COMBAT_CONTRACT.md)。

## 验收

```sh
npx playwright install --with-deps chromium
npm run test:headless
npm run test:browser -- --build=cannon
npm run test:preview -- --build=cannon
npm run test:input
npm run test:input:preview
npm run test:performance
```

`--build=sniper`和`--build=mage`运行另外两条路线；`--touch`用正常触摸操作运行完整路线。三个桌面路线及触摸路线分别在dev/preview执行后，`npm run test:compare`比较完整状态/事件；最终证据使用`npm run test:compare -- --final`，要求同一干净提交。产物保存在gitignored `artifacts/`。可用`CHROMIUM_PATH`指定浏览器路径。

浏览器脚本只读观察状态，用原生输入和正常逻辑时间游玩；headless轨迹证明浏览器一致性，独立手算账本和数值用例才验证规则答案。CI分别执行单测/构建、三路线×两模式、两模式输入与触摸路线，再比较证据。临时watchdog与尚缺的实测预算必须在最终验收前解决。

正式目标为Chromium桌面、触屏电脑及手机竖横屏；Chromium手机模拟不代表Safari支持。WebKit为候选，iPhone/iPad Safari尚未承诺正式支持。

范围及依赖见 [M5计划](M5_PLAN.md)，门禁见 [M5验收](M5_ACCEPTANCE.md)。M1–M4文件保留历史证据；[测试迁移说明](docs/M5_HISTORICAL_TESTS.md)区分旧内容golden与继续执行的底层/缺陷回归。本阶段暂缓全量S13、八人联网、完整对手经济AI、有限共享池、选秀、复杂存档界面、3D和Riot美术资产。
