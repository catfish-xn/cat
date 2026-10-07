# HEX 自动战棋

TypeScript + Vite + Phaser 3 的网页单人自动战棋。以 S13 原赛季 **14.24b** 为固定参考，当前领域内容为 19 个英雄、5 个职业羁绊、7 个组件与 9 件成装、6 个强化和 3 个异常，从 2-1 运营到 6-7。单人简化包括固定对手、无限商店池、补给代替选秀及手动准备期；不是全量 TFT。M6 已加入公开种子、保存与恢复、战斗回放、统计和中文操作界面。

**分支状态（2026-10-07）**：本次远端核对的 `main` 为 `a8be9fc`，已合入 M6（PR #7）；M7 的 [PR #8](https://github.com/catfish-xn/cat/pull/8) 仍为打开状态。M7 候选 `6120e86` 已包含官方 S13 身份与图标、实战/回放反馈、帮助、减少动效及审计修复，但尚不能写成 main 的已发布能力。完整状态、受测 SHA、试玩地址和独立遗留问题见 [M7 状态核对](docs/M7_STATUS.md)。文档状态以核对时刻为准，下一轮开工前重新 fetch。

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
- **E**：卖出鼠标悬停的我方棋子，拖拽期间卖拖拽对象，空白处回落到显式选中对象。
- 拖拽或点选部署到我方 row4–7 或空备战格。人口上限等于等级，备战席九格。取消拖拽不提交，正常松手提交。
- 三张同名同星自动升星，最多三星。满备战席可购买能立即合成的第三张。升星优先保留棋盘单位；纯备战席合成不会自动部署。
- 装备面板选择两件库存组件合成，再装备到单位空槽。每单位三槽；出售返还装备，升星转移装备并返还溢出。未开放配方明确拒绝。
- 新局先选两件组件，再选2-1强化。强化还有3-2、4-2两次；4-6选择异常目标并查看单项报价，1G刷新，确认免费。选择期间普通运营暂停。
- 每阶段.4为组件补给，无战斗；.7为PvE，前四次存活后有随机组件和组件选择。完成奖励选择后才能点击“继续”。
- **开始战斗**开始50ms固定tick的自动战斗，期间经济和部署锁定。界面显示目标、实际伤害、盾吸收、治疗、状态及来源；战损不带入下一场。
- 右上角 **？帮助** 打开操作说明（Esc 或“关闭”退出，打开期间 D/F/E 不生效）；其中“减少动效”只影响画面，不改变战斗结果，偏好保存在本机浏览器。
- 棋子与商店使用 S13 官方头像；商店卡片列出种族与职业，本版本可用的 5 个职业高亮。星级为铜/银/金，左下角数字为费用。
- **继续**进入下一轮，保留玩家资源和站位。HP归零失败；6-7战胜最终PvE成功，失败或平局为失败。**新局**转到“对局与存档”，选择随机或固定种子开始。

“固定种子”初始显示 42。新局初始100HP、10G、等级3、艾瑞莉娅／麦迪／拉克丝各一星。收入分为基础5G、对战胜利1G、最多5G利息和最多3G连胜败金；PvE/补给不增长或支付连胜败金。每完成一轮2XP，最高九级。经济结算、历史数据出处及明确简化详见 [M5规则](M5_RULES.md)。

构筑面板提供四炮四哨、两狙四监察两哨、四法四哨的正常购买和转型路线。Caitlyn是可购买的狙神上限选择；基础成型不依赖抽到五费或指定异常。

## 开始、存档与回放

- 在“开始与继续”中点击“随机新局”，或在“固定种子”输入 0 至 4294967295 的整数后点击“以固定种子开始”。创建后显示本局种子；相同种子加相同操作可重现对局，每次新局仍有独立身份。
- 有当前自动存档时，“继续对局”从最新成功保存的状态恢复。新局或“导入对局文件”会替换当前槽；需要保留进度时先点“导出当前局”。导入读取 JSON 文件并验证完整历史，验证或保存失败不会替换当前局。
- 浏览器本地保存一个当前局和最近三个完成局。有效操作与阶段变化会排队保存；战斗每 40 个逻辑 tick（约 2 秒）排队一次。只有 IndexedDB 事务完成才显示“最近保存成功”；“保存中…”不表示已经落盘。后台暂停并尝试保存，返回不补算离线时间；直接关闭可能丢失尚未提交的进度。存储失败时仍可导出当前局。
- 在准备、结算或终局，从“已完成战斗回放”的“选择已完成战斗”选择本局或保留完成局中的战斗。支持“播放”“暂停”、1×／2×／4×及“按 tick 跳转”；“返回当前局”恢复活动界面。回放为只读副本，不改变当前局资源、随机状态或存档修订；进行中的战斗前缀用于续玩，不开放为完成战斗回放。
- “战斗统计”显示“实际伤害”“护盾吸收”“有效治疗”。伤害只计生命损失，吸收归受击单位，治疗归来源单位；单位详情单列过量治疗。“统计选中单位”“战斗事件类型”和“战斗事件明细”用于检查当前战斗或回放事件。

## 架构与确定性

- `simulation/match.ts`是唯一对局权威。命令原子提交，拒绝返回原状态；金币、XP、HP、成长和奖励只结算一次。
- `economy.ts`、`match-rules.ts`定义结算及升级/商店表；`round-schedule.ts`定义35轮日程。
- `content/`归档固定客户端数据及14.24b覆盖，运行和CI不在线获取资料。`strategy-snapshot.ts`在开战时冻结单位、羁绊、装备、强化和异常。
- 商店、选择、奖励、战斗种子使用显式独立RNG；每场Combat持有自己的RNG。拒绝命令不消耗随机数或序号。
- `combat-s13*.ts`处理有限技能、来源独立盾层、状态、持续动作、治疗和伤害分担。旧底层测试仍覆盖未改变的移动、寻路与原子规则。
- `rendering/match-session.ts`只提交命令并累计时间；界面读取领域状态与事件，不另算规则。

M6 文件使用 `hex-autobattler-save` 包装，saveFormatVersion/replayFormatVersion 均为 1；内层对局继续使用schema5、`m5-14.24b-v1`、`s13-14.24b-slice-v1`、命令协议2和内容digest。裸 M5 文件、旧schema4及未知版本明确拒绝，不猜测迁移。恢复不重发奖励、不重抽随机数、不重新开战。完整契约见 [保存](docs/SAVE_CONTRACT.md)、[回放](docs/REPLAY_CONTRACT.md)、[Match](docs/MATCH_CONTRACT.md) 和 [Combat](docs/COMBAT_CONTRACT.md)。

## 验收

M7 表现层门禁：`node scripts/verify-m7-presentation.cjs --url=<preview 地址>`；五视口走查：`node scripts/m7-screens.cjs --url=<地址>`。


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

浏览器脚本只读观察状态，用原生输入和正常逻辑时间游玩；headless轨迹证明浏览器一致性，独立手算账本和数值用例才验证规则答案。CI分别执行单测/构建、三路线×两模式、两模式输入与触摸路线，再比较证据。M6 的数值预算已经冻结，当前修复仍须按原预算完成最终回归，不能以调试运行或旧 SHA 结果代替。

M6 专项入口如下；应先安装依赖及 Chromium，preview 前先构建。`--m6-journey` 在炮手完整正常路线中追加保存／恢复／回放与应用生命周期检查：

```sh
npm run test:browser -- --build=cannon --m6-journey
npm run test:preview -- --build=cannon --m6-journey
node scripts/m6-layout-product-smoke.cjs
node scripts/m6-layout-product-smoke.cjs --preview
node scripts/verify-m6-storage.cjs
node tests/m6-persistence-retry.cjs
node tests/m6-application-failures.cjs
node tests/m6-stats-browser.cjs
node scripts/verify-m6-performance.cjs
```

存储／组件脚本不代替真实产品浏览器路线，模块生命周期不代替完整 Phaser 生命周期。`npm run test:performance` 保留既有领域性能测试；M6 浏览器性能使用上列 `verify-m6-performance.cjs`。完整 CI 汇集同一干净 SHA 的全部必需产物后，依次运行 `npm run test:compare -- --final` 与 `node scripts/compare-m6-evidence.cjs`；比较脚本不能仅凭上述单条路线的部分产物通过。具体编排见 [CI 工作流](.github/workflows/ci.yml)。

当前及 M8 的目标平台为 **桌面 Chromium**。上文触摸脚本是已有回归入口；M8 不新增手机适配、手机路线或手机相关测试。浏览器支持不延伸为 Safari/WebKit 认证。

M6 范围与验收依据为已冻结的 [M6 Goal](M6_GOAL.md)；最终技术复验记录在 [M6 最终复验](docs/M6_FINAL_REVIEW.md)。领域规则和历史基线保留 [M5计划](M5_PLAN.md)、[M5验收](M5_ACCEPTANCE.md) 及 [M5验证记录](docs/M5_VALIDATION.md)。M1–M6 文件中的阶段性失败和“尚未合并”按原日期阅读；[测试迁移说明](docs/M5_HISTORICAL_TESTS.md)区分旧内容 golden 与继续执行的底层/缺陷回归。M7 候选已归档 40 张 S13 图标；其来源和回退说明见 [M7 状态核对](docs/M7_STATUS.md)，不再把“暂缓 Riot 美术资产”作为该候选的现状。

## 后续路线

- M8：规划全部常规基础组件及成装、第一阶段野怪、各阶段 `.7` 野怪和掉落；先确认计划，再开始功能实施。
- M9 起：按费用分批补齐英雄与羁绊；全英雄完成后再做纹章等特殊装备，最后扩充海克斯强化。现有 6 个强化和 3 个异常保留，不把“最后做海克斯”理解为本轮删除旧功能。
- 通用战斗机制须服务装备及后续技能/强化；M6 撤销记录累积问题在 `codex/m6-lifecycle-retention` 独立处理，不纳入 M8。
- 八人联网、完整对手经济 AI、有限共享池、选秀、复杂存档管理、3D 均不在 M8 范围；旧 M7 计划中的后续方向由本轮用户路线取代。

## Riot 素材与免责声明

本项目是免费、非商业的 S13（双城之战 II，14.24b）粉丝复刻，按 Riot Games 面向同人项目的素材政策使用官方英雄头像与图标。素材由 `node scripts/fetch-s13-assets.cjs` 从 14.24 游戏文件镜像下载到 `public/assets/s13/`，并生成带 sha256 的清单；运行时只读本地文件，缺失的素材自动回退为代码绘制的英雄徽记。

HEX is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
