# B8 检查点②：实施中，未签收

接手精确远端签收基线：`4554f5afee219416be410ff7edbd16ffbeb7daf5`。
检查点①外部 Codex 签收原记录保留：<https://github.com/catfish-xn/cat/pull/28#issuecomment-6093790209>。
本页是②局部备份证据，不是自审签收，不解除延期项；②完成仍交用户转外部 Codex 正式审计。

## 局部备份 1：模式无关纯 combat-input 前提

- 新增有限 `CombatStrategyInputs`、独立深拷贝冻结 basis，以及对独立资源前缀／日程收据／历史／G12 前缀的纯校验器。
- `buildStrategySnapshot` 只收窄入参类型，函数体不变；现有 U5 mock helper 类型同步收窄，测试断言原样保留。
- Match 入口、正式状态、live digest 均未接线。本次不得称 Combat 历史恢复已经改用 basis。
- ②真实启用与③未完成自选会使现有全程路线在 1-3 的未解选择停住；临时开发期隔离方案正在请求用户批准。未加模式、未改默认规则、未提前接③、未扩大 skip。

验证环境：Node 22，路径 `/tmp/b7-npm-cache/_npx/d18f28baf1132559/node_modules/node/bin`。

- `npm run typecheck`：通过。
- `npm test -- tests/m8-b8-combat-input.test.ts tests/m8-u5-preview-mocked-snapshot.test.ts`：2 文件、18 测试通过。
- 全量 `npm test`、build、生产/reachable 累计预算尚未运行；此纯模块尚未在生产入口可达，不能以 tree-shaken 成本代表②成本。

待办：新局起 provenance 写入与严格折叠、basis 运行及 restore 接线、死亡揭示与直接授予、容量及唯一成长经济事务、当批全部合法态恢复、独立向量与篡改拒绝、全量原样验证和预算。真实自选路由、LootView、完整终局 fallback 仍为③。

## 局部备份 2：纯资源来源折叠与扩展 basis 向量

- 新增 `resource-provenance.ts`：连续出生／消费 serial、收据↔出生双射、合法同星升级链、出售价格与时序、组件精确配方、唯一 combat growth commit；从原前缀按升级链分别迁移 stock／delta。
- 全流校验完成后可返回指定前缀投影；不能通过只截取 entries 忽略未来部分的缺失出生或非法消费。每个应有 combat settlement 的提交完整性是必填的独立权威。
- 纯成长代数覆盖 370；合法 Tristana 125 Bps 步长覆盖 1000、级联及原死亡单位的 delta。缺出生／删链／重复消费／错配方／错 serial／错时序及重复、缺失成长提交均有拒绝向量。
- basis 补充真实公开命令到 3-5：两次 `.4` 组件、合成 TG、装备并上场，验证原临时装备来源及父 ID；公开 2-5 第七战种子独立值 890455596。此为纯 helper 的合法输入向量，尚不是②掉落运行接线证据。
- 收据仍需外围对真实冻结计划／资格核验；当前 Combat 的源 delta、survivor 选择和原装备迁移须由后续 basis 后缀精确重演交叉核对，不把纯折叠称为已完成 Match restore。

验证：原样 `npm run typecheck` 通过；四文件专项 `m8-b8-combat-input`、`m8-b8-resource-provenance`、`m8-b8-loot-freeze`、`m8-u5-preview-mocked-snapshot` 共 **162 测试通过**（原始输出见 `targeted.log.gz` 与 `typecheck.log.gz`）。最初原样全量在早期源码上启动；之后有进一步修正与接线，不能当最终本批固定源码全量证据。后续测量状态见下。

## 纯模块复核修正（尚未启用运行态）

独立只读复核发现原增长 start-prefix 可以越过本轮 loot 出生，将新掉落英雄伪造成原战斗单位。已限制 start-prefix 不晚于本轮首次 loot 出生，并新增 unit／item 拒绝、合法战前 shop 成长及结算后 capacity 出生的 4 项向量。provenance 专测现为 64 项通过，typecheck 通过；之前的全量和预算不冒称覆盖本次修正。

## 用户批准的②／③顺序调整

用户已明确批准把最小真实自选与必要终局处理前移②，不采用临时开发模式，不增加模式状态或 digest 分支。②须实现 loot PendingChoice、protocol 2 selectChoice 的实际授予／唯一 receipt／resolution、earned terminal fallback、满席终局保留，以及这些当批状态的严格恢复。③保留 readLootView 接线、隐藏信息完整样例和剩余组合验证。默认真实入口将直接接线；冻结玩法与公开合同不变。本节是实施授权范围，尚不是已完成证据。

## 预算触线封存：默认接线 WIP，立即暂停

已按用户批准开始默认 Match 接线，没有阶段模式或模式 digest 分支。当前源码包含死亡揭示、直接授予、自选路由、必要终局 fallback、容量等待／出售重试、basis 生命周期、资源来源写入和 strict restore 初稿；**这不是完整检查点②验收**。

测量环境 Node v22.23.3 / Vite 7.3.6，基线为干净 `git archive 2acb9acfe90ad7936083fa2c7018dd482b6b222f`、同一依赖目录、相同 Vite 配置和入口。每个 emitted `.js` 独立 gzip level 9 再求和。`measure.mjs` 的 audit 入口只在内存中加入① freeze/choice/identity 和② combat-input/provenance 所有 exports 的可达引用，不修改 UI 文件。真实 runtime 与 restore 已由默认入口可达。

| 早测产物 | gzip9 | 相对既定 488964 B 基线的 B8 累计增量 |
| --- | ---: | ---: |
| 基线 | 488964 B | 0 B |
| 真实生产 | **503035 B** | **14071 B** |
| 全 exports reachable | **503471 B** | **14507 B** |

生产与 reachable 都超过严格 `>13000 B` 暂停线，分别超过 1071 B／1507 B；不是从②重新计数，已包含①成本。总包仍低于 552191 B，但不能用全局余量覆盖 B8 超线。检测后立即停止实现、优化和测试扩展，只封存现有源码／证据，等待用户的下一步预算决定。

**源绑定限制必须保留：**上述预算 assets 写于 2026-10-10 06:56:38／43／47 +0200；封存时 `loot-runtime.ts` 的最后修改时间为 06:57:01 +0200，晚于测量。故这组数值是触发暂停的早测，**不声称预算受测 tree 与本次封存 commit 完全一致**；当前源 SHA-256 清单另存。此处不得用早测冒充最终 fixed-SHA 预算。

验证分开记录：

- 纯前提阶段原样 `npm run build` 通过，生产 488964 B、reachable 496949 B（累计7985 B）；日志留存 `prerequisites-build.log.gz`、`prerequisites-budget.log.gz`。这不是 live 初稿的完整 build/typecheck 证据。
- 纯前提原样全量命令输出：118文件、1663 passed／10既有 skipped，共1673，日志留存。命令运行期间工作区继续修正／接线，故标为 diagnostic，**不能代替当前封存源码的固定 SHA 全量验证**。
- 停线前，runtime worker 的18项专项与 typecheck 通过；restore worker 的6项真实默认路径专项，加 basis/provenance 共83项通过。两者是局部结果，不替代全量或外部审计。
- 当前 live 初稿只完成上述早测 Vite 生产／reachable 构建；全量 `npm test`、完整真实奖励合并／容量出售／早终局与6-7／装备异常G12迁移向量、全部独立经济向量、CI及外部 Codex 签收仍未完成。原有 fixture 也尚未完成对新 provenance 入口的全量核对，不允许通过删除验证或扩大 skip 绕过。

所有①原签收及其原始证据完整保留；②仍必须在获准继续且通过固定 SHA 验证／CI后交用户转外部 Codex，不以本页或内部检查自签收。

### 固定封存源码的优化前复测

用户批准一轮不减校验／不改合同／不改行为的等价体积优化后，先对封存 commit **6119c27eda0039b34ad3d3b7702dc2f07ebb68c8**（tree **d28c0c70e5c959de3101ef2f01bb006708993e68**）重新测量；测量前后源码不变，`paused-source-sha256.txt` 全部核对通过。此轮尚未实施任何优化。

原命令为 `PATH=/tmp/b7-npm-cache/_npx/d18f28baf1132559/node_modules/node/bin:$PATH node docs/evidence/m8-b8/checkpoint-two/measure.mjs`，基线／同依赖／逐 JS gzip9 口径不变；原始输出在 `pre-optimization-fixed-budget.log.gz`，逐产物数据在同名前缀 JSON。

- 基线：**488964 B**。
- 固定源码真实生产：**503053 B**，B8 累计 **14089 B**，超暂停线 **1089 B**。
- 固定源码全 exports reachable：**503488 B**，B8 累计 **14524 B**，超暂停线 **1524 B**。
- 这组数值完整包含最后新增的 counter 安全整数检查，是后续本轮优化应比较的固定优化前基线。早测原值仍保留，不回写成同源。
- 将等待远端 WIP 备份确认后才实施等价优化；两口径都必须回到 **501964 B（488964＋13000）以内**才能继续批准的②余项。否则再次报告等待预算决定，不自行提高上限。

### 获批一轮等价精简：仍超暂停线

受测源码 commit **f203849146ad735504d0a1306c755b522807c5fc**，tree **27f164ad3af81e74ea3ae728bc9db9706f3229ef**。本轮统一 current/basis 资产结构检查、三处单位授予/升级计划、receipt 结构校验；保留 frozen-slot 授权、完整资源折叠、当战 suffix 重放和篡改拒绝。多个同时损坏字段的首报顺序可能变化；共享安全 serial 检查亦覆盖非法 buy 输入。生产源码受测期间没有更改；未提交的独立 oracle 改动只在 tests，不参与构建。

测量命令、Node v22.23.3 / Vite 7.3.6、固定 U5 baseline 和逐 emitted JS gzip9 口径与上节相同。原始输出为 `optimization-fixed-budget.log.gz`、逐产物为 `optimization-fixed-budget.json`。

| 口径 | 优化前 | 本轮后 | 节省 | B8 累计 | 超过 501964 B |
| --- | ---: | ---: | ---: | ---: | ---: |
| 生产 | 503053 | **502804** | 249 | **13840** | **840** |
| 全导出可达 | 503488 | **503386** | 102 | **14422** | **1422** |

基线复测仍为488964 B。两口径均未回线内，故不继续②新增功能，不自行扩大优化轮次或提高预算。当前可达审计比生产多582 B，反映未被生产树摇入的导出路径与审计保留对象；不能以去掉探针出口来制造预算通过。源码复用消除了约134行旧实现，但 gzip 本来就能压缩重复模式，所以实际收益小于源码行数。

主要保留成本是 frozen loot 的独立恢复/身份、资源出生与消费的全历史折叠、原始 combat basis 及当战原子 suffix 验证、默认运行授予/选择/终局处理。压缩包的跨模块字典使单模块数字不可直接相加，本次没有伪造逐模块归因。进一步削减至少1422 B需要更广的编码/序列化结构重构，涉及恢复边界与错误拒绝路径；可维护性和重新验证成本显著，不能保证下一轮回线。②剩余缺陷修复、完整组合验证与③视图/隐藏信息接线尚有成本，未实施的代码无法给出可靠字节承诺；至少还需1422 B加这些新增成本的空间。本轮结果等待预算决定。

验证：`optimization-targeted.log.gz`记录5文件139项通过；`optimization-typecheck.log.gz`记录原样typecheck通过。全量和CI尚未通过，CI174的真实UI异常及测试参考/fixture问题另见诊断报告；以上不代表②签收。

### CI174 修复：独立命令参考补资源事实

`command-oracle.cjs` 的旧参考只构造买卖后资源和事件，未构造②新增的出生／升级／出售来源，导致原 `match-economy` 30失败/12通过。现按该参考自己的 purchase 和价格模型，独立追加事实和 acquisitionSequence；保留原命令失败零变化、选择优先级、价格和完整 result 深相等。没有从实际 result 复制来源，也没有生产 imports。旧42项原样全通过，新6项手算回归通过，typecheck通过。前后原始日志为 `command-oracle-before.log.gz` / `command-oracle-targeted.log.gz`。这些 command-unit 输入是明确的局部机制 fixture，不作为完整真实资源路线证明。本提交不改变生产行为，亦不代表全CI通过。

### CI174 修复：独立掉落／经济参考

旧 `oracle.cjs` 将单位 serial/cards 仅归于 buy、物品奖励仅归于 ScheduleReceipt；合法1-2掉落Maddie使actual serial3、旧expected2。按冻结LOOT §2–8与OPENING/ADDENDUM新增独立固定表、BigInt LCG拒绝抽样、来源/载荷/资格/唯一receipt/八候选/fallback核验；不import生产planner。真实新单位即使立即被合并也计一次候选出生，组件仍分LootReceipt和ScheduleReceipt，揭示/冻结/满席保留不计实际授予。完整原金币、卡数、物品、serial与收据守恒未删除。

独立结算补 combatEventCount，真实入账gold先于interest；公开settlement参考从独立计划+正式死亡求未授gold，不以actual roundResult反推。手算9/49/50+1→16/60/61、投资向量、英雄非金币对照及重复事件/错误payload/source/receipt反向拒绝通过。新增24例+原audit-boundaries20例共44/44通过，原beforeAll失败后未执行的7例已执行；typecheck通过。seed42金币路径和seed230四档英雄路径均由真实公开命令完成38轮/33战；未改路线脚本或门禁。原日志为 `loot-oracle-targeted.log.gz`、`loot-oracle-typecheck.log.gz`、`loot-oracle-seed230.log.gz`。

这是独立参考适配的单独提交，不把参考缺项归为领域缺陷，也不掩盖另行发现的真实BoardScene异常、未修完的fixture和生命周期旧前提。全CI及②验收仍未完成。

### CI174 修复：原生命周期断言对应已批真实奖励

仅测试适配，不改变生产路径。原3文件40项中35通过、5失败；以下逐项保持原约束并补实际新行为，而不是宽化断言：

- `match-contract` 弃权旧两事件，改完整 `combatFinished → lootForfeited → roundSettled`；独立校验1-2/m01/slot0身份、零授予、tick0与唯一结算。
- `match-lifecycle` stale/unsettled 用例：未解自选先证明 wrong-phase 且原state零变化，通过公开选择后仍精确检查 stale-round/unsettled-round。
- `match-lifecycle` 冻结快照：running preparation 仍严格相等；终帧独立预期唯一 Maddie/unit-2/一星/bench0 出生及完整receipt/provenance/事件顺序，原对象与combat basis保持不变。
- `match-session` Continue：原英雄所有字段/星级/位置不变，独立追加实际Maddie和Lux；先公开sword选择，完整receipt/resolution/事件相等，50ms与partial clock原检查保留。
- `match-session` 五轮：未解choice的Continue先拒绝，再公开选择；购买路线Lux固定unit-3/bench0，原英雄全字段、重复Continue、轮数/商店代次保留。

最终原3文件40/40通过、typecheck通过；补交叉验证combatEventCount与完整Combat ledger长度和连续eventSeq。原始前后与类型日志 `lifecycle-targeted-before.log.gz`、`lifecycle-targeted.log.gz`、`lifecycle-typecheck.log.gz`。并发测试工作区结果不替代最终固定SHA全量和CI。
