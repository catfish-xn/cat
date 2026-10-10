# CI 174：默认 B8 接线 WIP 的失败分类

## 证据边界

- CI run：<https://github.com/catfish-xn/cat/actions/runs/38026222406>；受测远端提交 `09bdc6329960cdaa9f7807ba16b31b4eb4dffbd1`，父任务核对其源码 tree 与本地 `747f5fa` 相同。此报告诊断这些日志，**不表示 CI 已通过**。
- 单测原日志：`job-114137517478.log`；结果为 24 files failed / 96 passed，198 tests failed / 1486 passed / 17 skipped。198 是 case 数；另有一个 beforeAll 失败，因此错误块计数出现 199。
- 分类 A：已批准的 B8 行为或附加可验证字段，使旧独立参考或阶段前提过时。F：正控 fixture 缺少永久资源真实出生/消费链，或重复手工注入已经实际授予的资源。R：真实运行异常。U：仍缺少足够证据定位。
- A/F 是**当前日志第一个失败位置**的分类，不保证修正这个入口后没有更深的实现缺陷。不能据此删断言、跳过校验或直接刷新 golden。
- 本次只读代码/日志，未跑全量、未改源码/测试。后获准新增本报告与开场诊断脚本。

## 先处理的共享入口

1. `tests/fixtures/m5/oracle.cjs:41–43`：只有 buy 增加 unit serial/cards，只有 ScheduleReceipt 增加物品和奖励。1-2 已实际产生 `lootGranted(maddie, unit-2)`，故合法 `nextUnitSerial=3` 被旧参考预期成 2。这个入口阻断 5 个单测文件（其中一份是 beforeAll）、6 个 browser route job 和 m6-retention。`scripts/generate-m5-route.cjs:24,37` 是传播点，并非应删除的独立校验。
2. `tests/fixtures/m5/command-oracle.cjs:54–71`：独立 purchase/sale 模型没有追加对应 provenance，导致 `match-economy` 的 30 个 complete-state equality 失败。保留独立 purchase/upgrade/price/priority 模型，补独立事实期望，不能从 actual state 复制答案。
3. `tests/fixtures/m8-b4-match.ts:8–9`：可把开场 unit-1 重命名为 Lux unit-3，并直接塞任意组件/成装、递增 serial，却没有新单位出生、旧单位消费、组件授予或合成来源。共享入口覆盖 `m8-b4-catalog` 44、`m8-b4-integration` 10、`m8-b4-r3b-lifecycle` 4、`m8-b4-audit-regressions` 其中 3，共 **61** 个失败。另一个 audit-regressions case 有自己的强阵容注入，见下表。
4. B5 尚未共用同一构造器：`m8-b5-instances:12–14`、`m8-b5-queries:13–18`、`m8-b5-temporary:10–15` 分别直接造 items/serial。建议合并成来源明确的公共命令 fixture 入口，覆盖 8+1+23 个失败；仅补临时装备 roll 不会补出永久父装备出生。
5. B7/U5 强阵容入口也没有共用：`m8-b7-match-wiring:35–40`、`m8-b7-audit-vectors:130–131`、`m8-u5-preview:79–87` 改写英雄定义/星级，旧 opening provenance 仍描述一星 Irelia。先重建合法强阵容正控，再保留原开场/死亡/控制/恢复差分断言。
6. **独立于上述测试适配的真实浏览器集成阻塞**：`BoardScene.update:556–557 → syncCombat:584–586` 在终帧新增掉落英雄后读取不存在的 token，详见浏览器部分。Node restore 通过不能覆盖这一层。

## 24 个失败文件的逐项账单

以下路径均相对仓库根；行号按被检查的测试版本。case 名用能唯一识别的短标题。

| 文件 / CI case 失败数 | 代表 case / 第一个失败 | 分类与具体根因 | 修复时保留的原检查 |
| --- | --- | --- | --- |
| `tests/m4-ledger-bound.test.ts` / 1 | retains complete event sequences；`:17,31` | A；maximumLoadout 调 route，卡 oracle unit serial，尚未进入完整 ledger 检查 | 完整事件序列、深复制隔离、Continue/New Match 清理 |
| `tests/m5-audit-boundaries.test.ts` / beforeAll 失败、7 未执行 | normal empty-roster recovery；`:14–18` | A；beforeAll 的 cannon route 在 1-2 首次真实英雄掉落处失败 | 4-5 出售、4-6 招募/异常、D/F 保留可买单位、独立 LCG 全范围采样 |
| `tests/m5-replay.test.ts` / 4 | cannon restores every command and tick；`:11` | A；同一 route/oracle 入口，回放主体尚未获得路线 | 每条命令/每 tick 完整状态与事件相等、拒绝插入零变化 |
| `tests/m5-route.test.ts` / 4 | normally buys five-cost Caitlyn；`:12,19` | A；同一 route/oracle。另 4 个 B8 explicit skips 是既有项 | 普通付费五费购买、真实上场与技能事件、三条路线的独立经济 |
| `tests/m6-integration.test.ts` / 4 | every completed battle has exact original state/events；`:24` | A；同一 route/oracle。另 5 个 explicit skips 是既有项 | 原始 battle state/events、隔离播放和真实 envelope 验证 |
| `tests/m5-growth.test.ts` / 1 | commits actual battle growth once；`:30,42` | F；直接把实际出生为 Irelia 的 unit-1 改成三星 Tristana；provenance 中不存在这个 Tristana 出生/升级链，故 `combat growth source/step` 正确拒绝 | 每击杀 125、存量与本战 delta、恢复/重复 step/Continue 不重发；应真实购买并合并 Tristana |
| `tests/m8-b3-audit.test.ts` / 1 | real dragon claw tick39→40；`:29–33,45` | F；两次裸 `planPermanentItemGrant` 用 claw-fixture-* 假 caller ID，未提交实际 Schedule/LootReceipt 或 item-acquired；随后真实 combine 只留下消费事实，找不到两 cloak 的出生 | floor(763×250/10000)=19、完整 tick40 事件/状态、BattleHistory 续接 |
| `tests/m8-b4-audit-regressions.test.ts` / 4 | 5-1 Titan/Warmog/Gunblade；`:63–70`；另 3 个 itemMatch case | F；自有 case 把 unit-1 改三星 Garen，直接塞三成装，无 Garen 出生/升级及六组件消费；另 3 个来自共享 itemMatch | 同 action 双包、Titan 次 tick 更新、Giant Slayer 投影/BT 收据完整性及指定错误原因 |
| `tests/m8-b4-catalog.test.ts` / 44 | each item actual Match start/restore；`:42–44` | F；共享 itemMatch 的 44 个组件/成装都缺相应授予/合成来源；不是 44 个 item program 同时坏了 | 全 44 项 source、RNG、多个 tick 的恢复与续步相等 |
| `tests/m8-b4-integration.test.ts` / 10 | Sterak/BT sampled HP；`:36–39`；forged program/bonus/shield 等 | F；共享 itemMatch；HoJ case 还把 unit-1 替换成 Lux unit-3 | 原独立数值、对象/JSON 隔离、逐类篡改拒绝；不能把正控提前失败当负控成功 |
| `tests/m8-b4-r3b-lifecycle.test.ts` / 4 | untriggered/active/expired/two-instance BT；`:42,57,63,76` | F；共享 itemMatch，缺永久 BT 两组件出生/合成链；到不了原 survival 检查 | first use、完整 consumed/unconsumed 分区、过期后仍不可删收据、两实例独立 |
| `tests/m8-b5-equipment-history.test.ts` / 3 | legal pre-F/current/historical restore；`:24–33,94,109,122` | F；两裸 IF-GRANT gloves 无收据/出生，随后 item-1+2→3 真实合成的 provenance 无可消费输入 | 合法 pre-F 正控、历史 level 上下界、只读恢复、完整 envelope 的合法与伪造对照 |
| `tests/m8-b5-grant-upgrade.test.ts` / 10 | four plans exactly one permanent item；`:27–36`；inventory `:82–91`；chain `:15–23,96–127` | F；4 个把“明确不负责 receipt”的 planner 中间态当完整可恢复 Match；1 个直接塞 item-20/21/22 后 combine；5 个 chain 把 unit-1/2 设二星、造 unit-3/4、nextUnitSerial=5，却只有 opening 出生，下一次 unit-5 首先触发 unit serial | IF-GRANT 纯计划、无隐式 receipt；合成消费/ID；递归升级两次、装备返还/冲突、失败原 state。完整 restore 正控必须在真实 caller 提交出生/消费后检查 |
| `tests/m8-b5-instances.test.ts` / 8 | unique/exclusive copies；`:12–14,29,35,45`；combine `:62–68` | F；直接塞 item-20 等并把 nextItemSerial 跳到100；7 个 fold 不相等，1 个 combine 无 glove 输入出生 | unique/三槽占用、四件拒绝、两输入唯一消费、stale 原子拒绝 |
| `tests/m8-b5-queries.test.ts` / 1 | known units have three slots；`:13–18,85` | F；直接塞 item-20…26 和 serial40；TG roll 有记录不代表 item-25 父件有出生 | reserved slot 没有假永久ID、read-only/detached 查询、恢复后视图一致 |
| `tests/m8-b5-temporary.test.ts` / 23 | level3/6/7/9 independent stream；`:10–15,37` | F；inventory 直接插入 item-20 TG，nextItemSerial=30；没有两 gloves 出生及其合成；其他23用例沿此入口 | 独立两词、43 child definitions、父链/过期/重装/售出/恢复与全部伪造拒绝 |
| `tests/m8-b6-match-wiring.test.ts` / 3 | concede `:50`；opening restore `:73`；late `:119–139` | A×2：整个 m8 不再永远等于旧 frozen 副本（progress 应 forfeited），真实赢1-3会进入 loot choice；F×1：late fixture 开场就造三星 Caitlyn×3及 deathblade×9/跳 serial，后续实际 unit-4 出生与只有 unit-1 的账本断裂 | 2/3/5G、2/2/0XP、3HP、不改 frozen plans；choice解决后继续；末三轮9次恢复/不重新生成与仅6-7终局 |
| `tests/m8-b7-audit-vectors.test.ts` / 7 | every opening/mechanism tick continuation；`:130–138` | F；withGaren 把真实 opening Irelia 原 ID 改三星 Garen，缺出生/升级来源 | 开场及每个机制/次 tick 的完整事件差分、retimed stun/death/expiry/krug reaction 负控 |
| `tests/m8-b7-match-wiring.test.ts` / 22 | 1-3 phase `:64`；battleFixture `:37–39`；stage-one `:191–207` | A×1：1-3 的合法 choice；F×17：三星强阵容或 Herald case 的改 Garen/塞成装（`:140–151,180`）；F×4：stage-one `:201` 再手塞真实已经掉落的 unit-2/3，造成 duplicate unit | 中立开场/source/death/control 全部检查；移除手工发奖，使用已实际授予 ID 部署并解决选择；原全清10G/3级0XP/100HP保持，组件应按批准合同验证实际两次授予 |
| `tests/m8-u5-preview.test.ts` / 3 | PvP mana、birds、gameOver；`:79–87,306,323,333` | F；sturdyArmy 与 B7 一样重写 unit-1 并造三星 unit-2/3，缺来源；预览本身断言在 restore 前已走过 | opening stats 不被 live mana/HP/攻速覆盖、终局 current encounter、读取不变更任何 RNG/state |
| `tests/match-contract.test.ts` / 1 | empty deployment event list；`:18–24` | A；真实事件为 combatFinished→lootForfeited→roundSettled，旧列表漏作废事件 | 精确顺序、一次结算、tick0/3HP/2G/2级0XP、重复step空事件 |
| `tests/match-economy.test.ts` / 30 | exact buy/sell independent full state；`:37–40` | A；command-oracle 漏 unit-acquired/unit-upgraded/unit-sold 事实；首个 diff 仅新增 shop provenance。`:14–19` 自身是已标注的 command-unit fixture，不可把其通过称作真实资源路线 | 完整 result deep-equal、原 state 不变、独立价格/升级/优先级，不可删 provenance 后比较 |
| `tests/match-lifecycle.test.ts` / 7 | settlement `:17,45,55`；stale `:35`；snapshot `:67` | A；5 个记录期望缺 combatEventCount；1 个1-3还在 choice却期待 stale-round；1 个终帧仍期待 preparation 完全不变，合法 Maddie grant已改变阵容 | 新字段独立核对；先解决choice再测 stale/unsettled；running preparation、冻结 combat basis、输入原对象不变仍须严格保持，终帧验证收据解释的资源变化 |
| `tests/match-session.test.ts` / 3 | locks commands `:44`；Continue roster `:54`；five rounds `:137` | A；记录期望缺 combatEventCount；真实掉落扩充阵容；战后选择未解决就 Continue | 老单位星级/位置、战斗资源重置、50ms及partial clock、重复Continue；将完整终帧阵容按收据纳入独立期望 |

首层分类核算：A 57 case failures；F 141 case failures；合计198。beforeAll 的7个未执行另算，不混作7个显式取消测试。此统计不包括下述浏览器运行缺陷。

## 17 skipped 的组成

- 既有 explicit 10：`m5-route.test.ts:37` 四个 build；`m6-integration.test.ts:116,121` 一项 B8 + 四项 B9；`m6-replay.test.ts:142` 一项 B8。
- 新增报告的7：`m5-audit-boundaries.test.ts` 第一个 describe 的 beforeAll 失败；`:20` 两项、`:61` 一项、`:72` 四项，共7。它们没有执行，不是新增 `.skip`。
- `git diff cab8fe2 747f5fa -- tests/` 没有新增 `it.skip/test.skip/describe.skip/todo` 行，且这四个 skip 相关文件没有改动。修 route oracle 后必须重新执行这7项，不能将17写成批准豁免。

## Browser / application gates

| Job / 证据 | 分类、具体失败前状态与定位 | 保留门禁 / 下一步 |
| --- | --- | --- |
| browser dev/preview × cannon/sniper/mage；例如 `job-114137517641.log`，`verify-m5-browser.cjs:14` | A；浏览器路线先生成于 Node，oracle 在1-2 actual3 expected2处退出；不能把它写成浏览器完整路径已执行 | 先修独立 oracle，再原样重跑 browser gates；之后才能判断 UI 状态/事件 |
| m6-retention `job-114137517588.log`，`verify-m6-retention.cjs:37` | A；同一 route/oracle，尚未产生 retention artifacts | retention/heap assertions不变，缺产物不等于通过 |
| input-preview `job-114137517565.log`，`verify-m5-input.cjs:395` | **R：真实浏览器异常** `Cannot read properties of undefined (reading 'input')`。脚本完成31项后最后检查累计 errors；`:63`只保存error.message，日志没有浏览器堆栈或异常发生时刻 | errors=[]必须原样保留；不能因状态比对或Node恢复通过而忽略异常。下述源码链是高置信定位，须取真实stack/trace复验 |
| m7-presentation `job-114137517570.log`，`verify-m7-presentation.cjs:162` | **U：确实未完成一次触屏Continue**，actual round1 expected2。`:145`已明确等待首轮 phase===settlement；首轮1-2没有组件choice，不能归为选择没解决。脚本`:146–158`直接取boundingBox发原生CDP touch，没有locator滚动/hit-test。终帧异常若阻断面板刷新，会留下combat主按钮和位于下方的Continue secondary；这与未点击到可见Continue相容，但日志尚不能证明两者同因 | 不扩大触屏任务；保留双击只推进一次且不开始战斗的既有语义。检查6文件artifact中的已有报告，并用stack/原生输入坐标/elementFromPoint/按钮viewport证据区分渲染阻断与输入问题 |
| compare-evidence CI174 | 前置gate失败，compare跳过，不是成功 | `.github/workflows/ci.yml:239`依赖test-and-build/chromium-match/chromium-input/m6-retention。本地另有 `job-114137889537.log`，其产物明确是 **14051c1 / run38025013329**，不可挪作09bdc632的通过证据 |

### input 异常的具体源码链

1. `BoardScene.ts:46` 的 `state` 直接返回当前 `session.preparation`。
2. `BoardScene.update:555–557` 在进入该frame时仍为combat；调用 `session.advance(delta)`。B8合法终帧经 `match.ts::withCombat → grantDirectLoot` 将Maddie `unit-2`加入新的preparation，但原Combat仍是开战输入，不增加该单位。
3. update随即调用 `syncCombat()`，没有调用 `reconcileTokens()`；`syncCombat:584–586`遍历**新**preparation，`this.tokens.get('unit-2')!`实值为undefined，`token.input`正好形成日志消息。
4. 新token只能在 `reconcileTokens:416–427` 创建；它由 `sync:447–449`调用。update的终帧分支`:560–561`只刷HUD/面板，而且位于异常之后。
5. 因而这不只是测试期望过时。还需审阅奖励合并会消费旧单位ID的情况：不能简单对当前阵容缺token加可选链就宣称完成；原Combat的视图和奖励后的永久阵容具有不同时间边界。UI变更归其授权负责人，本次未修改。

直接建议复现：seed42新局→原始Irelia开始1-2→自然战斗结束，保留pageerror完整stack，验证unit-2已在preparation、原Combat没有unit-2、渲染tokens尚无unit-2及终帧界面刷新。之后才检查原有触屏Continue门禁；不新增手机优化范围。

## 独立 oracle 应增加什么，不应放松什么

- 保持无生产 imports。按已批准 `M8B_LOOT §2,§6.1–6.3,§8` 和合同增补独立转录槽/source/数量、receipt/resolution身份以及A3经济向量。揭示/planned/fallback冻结都不计实际收入。
- 每个唯一 `lootGranted.receipt`：unit birth使serial/cards各增加实际数量（被立即升级消费仍算出生一次）；item birth计入永久物品授予；gold只计实际payload.quantity一次。pending-capacity/retained-terminal/forfeited没有birth，不折现；重复receipt必须失败。
- `.4`组件仍只由ScheduleReceipt计入；PvE自选及terminal-fallback只由LootReceipt计入，不双计。成装合成减少两个组件、分配一个新的永久ID；返还/临时TG child不算新永久组件。
- 准备期冻结推进独立loot RNG；reveal/grant/select/restore不额外抽词。现有shop/choice/reward/battle/equipment RNG守恒不能取消。
- 经济期望把**当命令/终帧中新入账的实际gold loot**先加到结算前余额，再算interest、goldBefore/goldAfter、投资成长；不能拿current余额逆推或直接接受生产roundResult。A3 9+1→16、49+1→60、50+1→61原向量保持；容量出售发生结算后，不重算历史interest。
- settlement增加独立 `combatEventCount` 期望（真实完整combat ledger/末游标边界交叉核对），保留全部旧收入、XP、伤害、streak等精确字段检查。
- 精确事件序列纳入合法 `lootRevealed`、`lootGranted`、`lootForfeited`、`lootChoiceResolved`、choiceOpened/Selected及可能的unitUpgraded/itemsReturned；eventSeq连续性、一次结算、一次grant和所有失败零变化检查全部保留。
- command-oracle独立追加 unit-acquired（opening/shop/loot）、unit-upgraded（本次独立升级事件及acquisitionSequence）、unit-sold；需要时独立验证item-acquired/item-combined/combat-growth-committed事实。不能删actual新增字段后继续deep-equal。

## 正控重建与有界重跑建议

1. 优先修两个独立oracle入口，运行原代表case，例如 `npm test -- tests/match-economy.test.ts -t 'uses the frozen two-word'`、`tests/m5-route.test.ts -t 'normally buys five-cost'`；随后重跑beforeAll受影响的7项与原browser路线。
2. 重建共享itemMatch和B5永久装备fixture时，用真实公共select/combine/buy/upgrade/sell命令获得出生和消费证据。不能手填lineage冒充真实奖励。纯mechanism隔离fixture可继续保留，但必须标为非路线，并有合法公共流程的Match正控；不能把原完整Match restore断言整体移走而不补等价覆盖。
3. 每类负控先证明未篡改版本能serialize/restore，再执行原篡改与指定原因断言。`toThrow()`提前撞到无关resource fold不能视作原negative coverage通过。
4. 小文件代表case顺序：catalog sword → integration HoJ → R3b active/expired → TG pre/post-F → B7 krug/Herald → U5 bird/gameOver。保留原固定数值，不从当前输出回写golden。
5. 下述开场诊断只覆盖三次公共战斗/选择/部署和restore。固定优化commit后再复跑并绑定SHA/tree/source hashes；不能替代全CI、UI或B8所有容量/成长组合验收。

## 开场诊断的真实观测与重现状态

- 一次未写文件的Node/Vite小探针，在当时**并发修改中的工作树**运行，公开API且每个tick/命令调用restore；观测493次调用未抛错，seed42开场1-2→1-3→1-4→2-1，10G，两次选择sword。
- 首轮观测：lootRevealed的死亡tick69/eventSeq33；唯一lootGranted为Maddie/unit-2，serial2→3。第二轮serial3→4且phase=choice；第三轮serial4不变且phase=choice。这个观测解释旧oracle3≠2，并不证明浏览器无错误。
- **当次stdout仅保留于工具会话输出，没有重定向raw log，没有当次开始/结束source fingerprint；不可将下面新保存的脚本或此摘要称为固定SHA原始证据。**未重造日志。
- 原探针保存为同目录 `diagnose-opening-restore.mjs`；只有格式化和注释，保留同一API命令与检查逻辑。它不调用旧oracle，也不读取测试fixture。下面是另一次新执行的独立记录，不能冒充前一次原始输出。

### 固定精简源码的新执行：f203849

- 2026-10-10 05:12:53–05:12:55 UTC，从仓库根执行 `node docs/evidence/m8-b8/checkpoint-two/diagnose-opening-restore.mjs`；Node `v24.19.0`；退出码0。
- 开始/结束HEAD均为 `f203849146ad735504d0a1306c755b522807c5fc`，tree均为 `27f164ad3af81e74ea3ae728bc9db9706f3229ef`；开始/结束 `git diff HEAD -- src/` 均为空，全部src文件前后SHA-256完全相同。
- 工作区另有oracle worker的 `tests/fixtures/m5/oracle.cjs` 修改和本次报告/探针未跟踪文件；该探针不导入oracle/测试文件。依赖清单及脚本SHA-256也保存在metadata。这是固定**源码**执行，不声称整个工作目录无未提交变更。
- 原始输出：`opening-restore-f203849.raw.log`；绑定：`opening-restore-f203849.metadata.txt`；源码清单：`opening-restore-f203849.source-before.sha256`、`opening-restore-f203849.source-after.sha256`。
- 真实末行：`{"checks":493,"round":"2-1","phase":"choice","gold":10,"items":["sword","sword"]}`。493是restore调用成功数；脚本未对每次返回值再做deep-equal。2-1的choice是正常强化选择尚待选择，开场两次PvE组件选择已完成。
- 该结果仍不包含浏览器token/DOM更新、后续全路线或完整B8容量/成长恢复组合，不解除input-preview/M7/其余CI阻塞。
