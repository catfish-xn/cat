# M4 ACCEPTANCE — 测试矩阵与完整 Match 证据

状态：实施验收清单；实际执行记录见 [M4_VALIDATION](docs/M4_VALIDATION.md)，未执行项不能记为通过。基线 `133a41b4ef4257bee1b4bd458103393177fdf93e`；范围与冻结点见 [PLAN](M4_PLAN.md)，以下测试的唯一规则oracle来源是 [RULES](M4_RULES.md)。不得将“计划覆盖”写成“已经通过”。

## A1. 总门禁

M4完成必须同时具备：纯simulation单测、完整headless Match、逐命令/逐tick JSON与replay、真实Chromium完整单局dev、同一路径production preview、真实touch、native高频输入、CI及可审计证据。任何一个缺失都是未完成，不用截图或多个fixture替代。

沿用Node22/npm/TypeScript/Vitest/Vite/Phaser/Playwright。未来新增 `scripts/verify-m4-browser.cjs`、`scripts/generate-m4-route.cjs` 与 `tests/fixtures/m4/`；旧M3数值/Combat行为保留针对性回归。`test:browser`/`test:preview`由主agent切到M4 runner，仍执行M1–M3关键边界；不会让旧runner把新增choice误判为失败后直接删掉旧断言。

测试分三种证据：手算microcase验证规则本身；headless逐步轨迹验证确定性与同一状态机；真实浏览器验证输入/UI与纯轨迹一致。后两者复用生产simulation不能冒充独立oracle；金额、配方、stat/packet舍入等必须有独立手算断言。

## A2. Simulation 测试矩阵

| ID | 范围 | 最低必须覆盖的成功/边界/拒绝 |
| --- | --- | --- |
| T01 | Trait | board distinct definition计数；bench/敌人不混入；同名/星级不加数；2→4tier及跌档；最高档不叠低档；队友selector；相同definition多实例都获buff；死亡不掉tier；下一战重算 |
| T02 | Snapshot | 所有四来源进入snapshot；未上阵装备/绑定不进入；无可变alias；Match deep-freeze；原输入/内容数组置换等价；当前战斗不读后来修改的Match/catalog；零modifier旧数值等价 |
| T03 | 合成 | 15配方各正反材料顺序；同ID两次、未知/过期/装备中材料、成装当组件、重复提交；2旧ID销毁/1新ID生成；失败ID/金币/RNG均不动 |
| T04 | 装备 | board/bench己方；三个槽均合法；第四件、敌方、占用slot、非inventory源、同item两次、非法slot；sell全部返还；inventory分页不影响容量 |
| T05 | 升星资源 | survivor装备原槽；consumed ID/slot迁移顺序；>3溢出返还；1→2→3链；full-bench成功与失败；合并保留/迁移绑定；全局装备守恒；失败撤销全部中间迁移 |
| T06 | Augment | 两次schedule；3项互异；已持有排除；选择持久且影响未来新购单位；旧token/旧generation/非候选/双确认/错阶段；不draw确认 |
| T07 | Anomaly | 选board/bench；选敌人/失踪单位拒绝；目标锁定；成功选人事务内生成首轮offers并消费3词、reroll3词/2G；上一页全部排除；早期旧页可再现；0/1G拒绝、2G成功；多次reroll无池耗尽 |
| T08 | 绑定生命周期 | 持续两场以上且counter每场重置；升星迁移不丢choice来源；出售销毁且不退款/不开新choice；全owned为空保底一次；只有bench也可选；JSON不重复发保底 |
| T09 | Schedule | R1固定/R3随机等全表；same-round多个事件顺序；完成后drain；重复Continue不再奖励；terminal收入与下回合奖励区分；GameOver不发下回合；空阵tick0结算一次 |
| T10 | Phase guards | 每个phase × 所有新旧命令；choice所有子阶段拒D/F/E/buy/deploy/equip/combine/Start/Continue；step outside combat同引用无事件；GameOver全部普通命令不变 |
| T11 | Modifier算术 | star→flat→percent→floor→clamp；速度ceil；maxMana clamp；所有source叠加；重复装备独立计数；盾技能也受abilityAmount；proc固定量不被二次缩放；极值安全 |
| T12 | Hook屏障 | combatStart一次；everyN独立计数；attack/cast互斥；castAOE只额外命中primary；derived不递归；onHpLoss只有HP实际损失；被盾全吸收/死亡不加该Mana |
| T13 | 同tick兼容 | 双方互杀；将死cast仍命中；盾先于所有伤害；两来源盾max/expiry max；同值effect两个实例都记；Mana overflow/本tick获得下tick施法；死亡字段清理；1200tick边界 |
| T14 | RNG | seed0/42/uint32max；三流固定初始化；D不改reward/choice结果；固定reward不draw；三选一词数；拒绝插入三个流完全相同；enum顺序不改抽样 |
| T15 | JSON | preparation、choice target、offers、reroll后、确认后、每战tick0/中间/终止、settlement/GameOver逐步restore；current offers/counters/seq保留；schema3/未知version拒绝 |
| T16 | Restore负例 | 重复item/双归属/>3槽/失踪owner；重复augment/绑定；receipt与pending冲突；非法RNG/NaN/小数tick/serial倒退；未知effect/不合法hook-action/版本digest；target子状态非空offers或offer子状态无target拒绝；拒绝无部分恢复 |
| T17 | Content | 数量/引用/cost桶/能力/配方15对/trait可达/schedule唯一/候选最小池；每条装备、augment、anomaly至少一次到snapshot并触发其适用效果；合法新record无tick修改即可生效；超叠加bound的新record启动即失败 |
| T18 | 长局 | 多seed从createMatch正常reward/choice到终局或固定正常轮次上限；无装备丢失/重复结算；所有phase可达；counter有界；stage映射及enemy growth上限 |
| T19 | M3回归 | 商店十词、F不刷新shop、人口上限、购买满bench三合一、三级星值、售价值、50ms/移动BFS/寻敌tie、M3能力盾/Mana/伤害、GameOver与New Match |

T18种子集至少0、1、42、uint32max加固定20个种子；给定合法策略与固定步数，结果可重放，不要求所有seed同样胜负或都在同轮结束。有限自动策略的失败不能用无限随机探索掩盖。M3旧seed商店golden因新catalog需明确更新，而零modifier低层Combat golden必须保持。

至少三个手算例：二星ranger AD的172叠加例；20tick+2500bps=16tick的速度例；两个raw physical包分别减伤再合计，不允许先合raw再floor。另加trait+item+augment+anomaly全部叠于一单位的完整golden battle，期望来源与结果独立写出。

## A3. Replay 与 rejected-command insertion

记录格式：header（schema/rules/content/digest/RNG算法/seed）+有序command或tick操作+result/reason+events+canonical state hash。各new Match分session边界；战斗由round/combatId定位。每个合法操作前后检查完整状态，不能只比较最终HP。

每条完整headless路线至少执行：

1. 同seed同transcript重放两次，逐操作比较状态、所有领域事件、所有RNG及序号。
2. 每一个command和tick后执行JSON stringify/parse/validate restore，继续路线，和未restore版完全一致；特别覆盖刚发奖、刚开choice、reroll后、startEffects后和触发计数接近everyN时。
3. 在原轨迹每个phase/子阶段插入已知会拒绝的命令，包含过期generation/choice、重复Item ID、错误owner、余额不足、choice期间Start/Continue及D/F/E。拒绝必须返回原state引用/无events；过滤输入日志中的拒绝记录后，领域轨迹与基线逐步相同。
4. 在独立副本置换unit/item/定义表枚举顺序，恢复规范化输出；不要打乱有语义顺序的shop slots、装备slots或命令ledger。
5. 相同Match交错运行两个实例，证明没有全局RNG、Item ID、effect计数或“已发奖”单例。New Match再运行与同seed初态相同。

浏览器命令与headless的对齐使用逻辑command index及combat tick，wallclock/frame delta不进入replay规则。输入日志seq不是领域eventSeq，拒绝插入允许前者变化，后者必须完全不变。

## A4. 必须是一条真实完整 Match

主门禁名称 `full-match`。从产品正常默认 `createMatch(42)` 初态出发，浏览器仅用键盘/鼠标/触屏控件推进；seed42若无法满足资源/战斗路线，W4应审查并调整公开内容/普通对手曲线，再冻结路线，不允许在测试中换初态/赠资源。不要预先声称下面步骤已在实际引擎验证。

开发早期用headless探索合法购买/站位/选择路径，最终固定明确的slot/generation/ID/行动transcript与期望结果。路线生成器只是推导预期，不得接管浏览器、写状态或在失败后换seed。正常游戏可以预先研究商店序列，但每笔花费必须在UI通过。

| 顺序 | 正常游玩动作 | 必须留存的证据 |
| --- | --- | --- |
| 1 | 新Match，准备阵容，领取产品正常R1组件 | 初态hash、5 owned/10G/100HP、blade/rod两实例与reward receipt；无debug setter |
| 2 | 正常买牌、D搜牌、三合一；部署激活一个trait低档 | 购买/升级完整账本、survivor、trait distinct成员/count/tier2；至少一次真正升星 |
| 3 | 在inventory合成spell-edge并装给将长期使用的单位 | 两组件→成装新ID→owner/slot；战斗snapshot显示AD/技能数值变化，真实damage/cast体现 |
| 4 | R2正常进入Augment，三选一并继续 | UI三卡、候选/choice流前后、选择receipt；下战静态分解或proc证明效果 |
| 5 | 持续D/F/E及买牌、升population、换阵到同trait更高tier | tier2→tier4真实变化；F使额外部署合法；每次G/XP/shop变化；不是改fixture人数 |
| 6 | 正常打到R5选第二augment，R6获取组件 | 两次Augment排除规则及自然收入/奖励账本；可追加事件型装备（不替代初次合成） |
| 7 | R7进入Anomaly，锁单位，专用按钮至少reroll一次，再绑定 | 正常+2G receipt、target、三卡前后全排除、扣2G、3词draw、generation递增、绑定确认 |
| 8 | 同一个绑定谱系单位上阵参加R7和R8完整非空双方战斗 | 两个不同combatId/完整tick、同绑定definition与owner/迁移链、两战实际效果，不只是准备UI图标 |
| 9 | 至少一场（优先R7/R8）四来源与Mana/Ability共同作用 | trait tier+item+augment+anomaly的resolved contribution；真实Mana变化/cast/damage/shield；事件型source必须有proc |
| 10 | 继续每轮正常运营、作战直到HP0 | 不跳round，不写HP，不卸空阵tick0认输充当主终局；每轮完整结算、最终非空战斗GameOver |
| 11 | 终局验证旧/新命令全阻塞，然后正常New Match | 终局重复D/F/E/Start/Continue/装备/选择不改变state；reset清全部绑定/选择/旧装备/receipt/序号，并按R1规则重新获得两组件 |

主路线中不得reload/reset/切fixture/网络拦截bootstrap/注入金币单位装备/直接调用Match mutation/debug命令/跳tick/缩短50ms/增大时间加速。New Match仅在末尾使用。GameOver前必须有持续运营动作，但可采用正常较弱阵容；不把所有装备/绑定卖掉来避开持续性证明。至少R7/R8的主构筑单位和四来源保留到两战完成。

静态效果不要求假proc：记录base→各来源→resolved数值，再记录实际攻击/技能；必要的“无此来源”对照只能在独立headless副本做反事实，不修改浏览器主局。使用触发型Anomaly时两战均需触发；使用静态Anomaly时两战均需有相应属性实际参与伤害/存活/Mana周期的证据，不能选bench挂饰。W4优先选择易观察的echo-core/cycling-core或清晰静态倍率路线。

dev与production preview执行同一seed、同一主transcript、同一规则/内容版本和同一关键断言；比较每个逻辑checkpoint的state/event hash。两次浏览器运行各自一局，绝不能用dev有Anomaly、preview只有初始UI拼成通过。preview只服务 `npm run build` 产物，没有dev专属注入能力。

## A5. 高频 D/F/E 与手势冲突

把以下核心输入混合进A4同一主局的自然资源窗口，资源不足的边界测试可追加独立场景，但不能代替主局有真实成功的高频操作：

- 至少三段D→买→F→E混合链，在自然资金允许时快速连续提交；涵盖成功D、成功F、真实出售，成功与失败交错。每个trusted keydown dispatch结束前，observer已见对应状态，不等动画或下一frame。
- native repeat=true至少一次，连续keydown计数与command结果数一致；不以`dispatchEvent(new KeyboardEvent())`假装trusted输入。记录Playwright/CDP原生输入方法与isTrusted。
- 余额不足后各追加至少30个D/F，均即时失败、state/RNG/serial不变；不能仅断言最后余额，也比较每次接受/拒绝。
- 单位拖拽中成功D/F清drag，失败D/F保持；E出售dragged单位，然后迟到pointerup不能复活/移动旧单位。
- item drag中D/F仍提交，成功取消gesture，失败保持；E不穿透背景单位、不误卖选中单位。物品合成/装备重复release只消费一次，UI数量与账本一致。
- buy触发merge移除drag目标、choice打开取消gesture、选择reroll后旧卡点击、双击确认、按住D跨modal等边界；日志必须体现顺序且无积压命令。
- Scene restart/多次New Match后native listener不翻倍，单次按键只一次命令。该生命周期检查可做主局完成后的附加测试。

同一事件顺序的headless ledger是金额/选择结果的基线；UI若有无目标E，记录为input无有效目标而不是伪造Match sell成功。所有命令失败均保持领域状态，UI仅更新提示不消耗RNG。

## A6. Touch / 尺寸 / 可视性

真实Chromium mobile context，至少390×844与一个横屏尺寸；通过CDP Input.dispatchTouchEvent或真实touchscreen API，不能用mouse模拟后称touch通过。覆盖buy、D/F按钮、单位部署、组件选择/合成、物品装备、Augment确认、Anomaly选人/reroll/绑定、Start/Continue。

touch专门路线同样从正常初态推进到R7/R8，不需要再把每条终局测试跑第三遍；它不能填补桌面A4缺项。必须有真实Touch路径通过全部新增互动，禁止在touch测试前直接restore一个anomaly fixture当唯一证据。dev与preview都跑关键touch路径，确保生产布局/坐标相同可用。

断言面板可见可点、文本不截断关键信息、目标在实际屏幕CSS像素中至少44×44px（用getBoundingClientRect或observer屏幕bounds核验，不用Phaser逻辑坐标冒充）、canvas缩放下drag release取实际坐标、item栏滚动不变成equip、触摸取消不消耗物品；第二pointer不能夺取第一个drag、双指choice只能一次确认、overlay不穿透底下shop/Start。记录屏幕bounds与最终单位/item IDs；截图只是辅助，成功状态是主证据。

## A7. 观察器、事件完整性与视觉断言

延续 `window.__CAT_DEBUG__.read()` 的只读深复制性质；允许暴露state、屏幕bounds、选择目标/gesture epoch、HUD文本、resolved来源与事件账本，禁止setState/给资源/推进tick等生产mutation接口。测试监听器在导航前装好，捕获console/pageerror/server error，不过滤未知异常。

M3“最近200条+JSON.stringify去重”不适用密集effect。实施时提供每战只读完整领域event ledger（最大1200tick，已有限primitive）；renderer动画仍可用短buffer，但验收读取完整ledger。observer必须同时采集Start命令结果的tick0 Combat事件和session.advance的后续事件；只扩大advance buffer不合格。每条有combatId/eventSeq，runner按序号收集并断言0起连续、唯一、无缺口，不按内容去重。每战结束读取最终ledger并落盘，再Continue清理上一战buffer；New Match必须清空旧ledger。ledger是observer副本，不成为simulation外的隐藏游戏权威。先测最大阵容/effects事件数和内存，若改为分段读取需显式游标/范围与缺口失败，不能靠轮询频率赌不丢事件。

视觉+状态联合断言：trait panel当前tier/下一阈值和成员；item inventory与三槽及配方；choice三卡、target锁定、reroll费用/余额；绑定徽标；Combat Mana条/护盾/施法/来源提示；GameOver/New Match。每场snapshot、事件与HUD一致。stale token、动画ghost、旧item icon、过期choice点击区域均要断言不存在。

## A8. CI 与执行预算

保持现有两个job结构：test-and-build，以及Chromium matrix mode=browser/preview。未来命令顺序为 `npm ci` → `npm test` → `npm run build`（包含typecheck），浏览器job安装真实Chromium后分别 `npm run test:browser` / `npm run test:preview`。测试runner启动严格端口，检查server ready并在finally关闭；preview必须加载真实dist。

单战timeout可用M3的75秒上限（1200ticks=60秒真实战斗，加环境余量）；全局job时间应按完整主局+touch到R8+边界实测预算，不能未经测量照搬20分钟，也不能通过加速simulation压时间。dev/preview并行可缩墙钟时间。失败上传trace/日志/最后state；不自动重试到偶然过关、不吞失败。

必须在同一最终代码/content revision运行全部门禁。只改文案可合理缩小局部检查，但F3后任何规则/序列化/输入/渲染交互改动均须重新跑受影响单测以及两模式完整关键路径。最终CI成功不能引用早于最终提交的run。保留旧M3关键断言和类型检查；新content validation纳入默认test/build可运行入口。

## A9. 最终证据包与签收

未来实施输出建议 `artifacts/m4-{dev,preview}/` 与 `docs/M4_VALIDATION.md`，至少包含：

| 文件 / 信息 | 要求 |
| --- | --- |
| manifest.json | commit/tree、工作区差异说明、三版本/digest、seed、Node/Chromium/OS、模式、各测试实际结果、CI链接 |
| full-match-transcript.json | 每次正常UI输入与命令参数、generation、accepted/reason、逻辑index/tick、RNG前后、事件与state hash |
| round-ledger.json | 所有round开始/结束HP/G/XP/level/shop、reward receipts、choice/绑定、敌人模板/成长、完整结算 |
| states/events | 每个checkpoint完整JSON；每战tick轨迹或可完整重建的操作log；eventSeq无缺口验证报告 |
| build-chain.json | trait低→高、两组件→合成ID→装备owner、Augment来源、Anomaly reroll及绑定→两战的连续引用链 |
| inputs.json | trusted/repeat D/F/E数量与结果，drag/pointer/touch事件，Scene listener检查 |
| screenshots + trace.zip | 对应A4每个里程碑、手机互动、四来源与Mana/Ability可见、终局/reset；带checkpoint ID |
| console/page/server logs | 成功也留存；无未解释pageerror/console error/加载失败 |
| oracle-report | 手算case、headless/replay/JSON/reject插入结果、dev/preview同transcript逐checkpoint hash比较 |

最终交付说明逐项链接T01–T19与A4节点证据；明确任何实际未跑项目。主agent签收ownership集成、F1/F2/F3/F4、全部门禁后才可称“完整M4”。不以“以后M5补测试/普通获取/两战持续性”关闭本阶段。

原计划阶段已经结束；后续 `/goal` 授权实施及 CI。实际签收结果以 [M4_VALIDATION](docs/M4_VALIDATION.md) 和最终提交的 CI artifacts 为准。
