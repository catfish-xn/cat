# 开局奇遇 PR1 交付报告（2026-10-22）

基线：`codex/encounters-framework@42d8a4048409dc60e9b1f9647b398cb20e4529af`，工作目录 `/home/aiapps/workspcae/cat-enc`。全部改动留在工作区，未 commit。只读本地批准方案及调研 JSON/Markdown，未联网、下载或新增素材；未改服务器实现、界面、CI、fixtures/golden，也未录制 epoch。

16 项均保留抽选资格；总权重10000 Bps，“没有奇遇”1000 Bps。其余15项效果关闭，明确显示选中的真实身份和“效果尚未启用”。缺证参数仍为 null，不补造数值、不删项重归一化。PR1 不改变金币、商店、强化、奖励、战斗等既有规则效果。

## 文件与行号

| 新增/改动文件 | 要点 |
| --- | --- |
| `src/simulation/content/opening-encounters.ts:1`（新增） | 16项稳定规则ID、原始Encounter/Portal ID、官方中英文名/角色、权重、enabled、后续PR、证据缺口、参数和批准约定；sourcePath逐行指向调研JSON |
| `src/simulation/opening-encounter.ts:1`（新增） | 独立抽选、配置身份校验、上下文/收据类型、席位绑定、恢复认证、空效果钩子、公共白名单 |
| `src/simulation/match-types.ts:41`、`:83` | 必填openingEncounter；加入3个领域失败枚举 |
| `src/simulation/match.ts:1`、`:186` | 公共导出；单人首轮准备前初始化，shared-deferred不按席位seed抽选 |
| `src/simulation/shared-pool-types.ts:32` | SharedPoolState.openingEncounter为唯一全局上下文 |
| `src/simulation/shared-pool.ts:51`、`:106` | 根seed建上下文；原始开局准入后绑定席位 |
| `src/simulation/shared-pool-ledger.ts:53`、`:127` | 校验全局上下文与席位绑定；适用于事务和共享快照恢复 |
| `src/simulation/serialization-structure.ts:139` | 缺字段/篡改/伪收据拒绝，恢复不迁移、不补抽 |
| `src/simulation/private-seat-view.ts:100` | 本人视图使用同一公共奇遇白名单，不泄露seed/RNG |
| `src/server-entry/index.ts:73` | 仅追加公共领域接口和类型重导出；未改src/server/ |
| `src/simulation/content/rules-manifest.ts:1`、`:24` | 完整配置、随机流、时序、来源/项目约定纳入两个digest根 |
| `src/simulation/content/identity-constants.ts:3` | 既有离线脚本重算双digest，无手填摘要 |
| `src/simulation/m8/version.ts:7`、`src/simulation/m8/contracts.ts:487` | 开发rules/content及schema/save切换；未录制epoch |
| `tests/opening-encounters.test.ts:1`（新增） | 6例：16项表、10000票区间/边界、65536seed独立BigInt oracle/分布、非法配置、伪上下文、双digest |
| `tests/opening-encounters-integration.test.ts:1`（新增） | 53例：16项各自保存/恢复/生命周期无效果、既有RNG隔离、16×八席共享、选秀开局、隐私、非法效果原子失败 |
| `tests/t5r-private-seat-view.test.ts:14`、`:122`、`:156` | 新增公开字段白名单；明确视图与权威状态的不同形状；构造显示测试数据时保留真实上下文 |
| `tests/m6-integration-helper.ts:74`、`tests/m6-replay.test.ts:23`、`:158` | 当前版本测试数据构造改读M8_VERSION，消除save字面量类型错误；旧golden断言不动 |
| `tests/m8-b5-equipment-history.test.ts:183`、`tests/m8-b9-compatibility.test.ts:28`、`:31`、`tests/m8-contracts.test.ts:77` | 同上，仅当前合法测试输入的save/currentRules身份类型适配；不改epoch失败断言 |
| `docs/MATCH_CONTRACT.md:1`、`docs/MULTIPLAYER_CONTRACT.md:1` | 完整签名、输入输出、失败枚举、状态/隐私/恢复/版本边界 |
| `docs/UI_REQUESTS.md:1115`（末节“开局奇遇 PR1 → PR8 数据交付”） | 中央角色与横幅的数据来源、关闭提示、联网接线验收，不规定视觉细节 |
| `docs/OPENING_ENCOUNTERS_PR1_REPORT.md:1`（新增） | 本报告及未录制epoch的失败清单/后续接口 |

## 随机流、状态与公共合同

`opening-encounter-v1/select`：对名称按UTF-16 code unit执行FNV-1a32，`initialState=(rootSeed XOR hash)>>>0`，lcg32-v1一次抽词，`floor(word×10000/2^32)`落入固定累计区间。包含enabled=false的全部16项。单人用match.seed，多人用pool.seed；不消费任何既有随机流。seed42选择迅捷蟹水潭，抽选word为737726433。

`MatchState.openingEncounter` 是三分支：solo持有完整context和receipts；shared-deferred尚未绑定；shared只有poolId/seatId/selection/receipts。`SharedPoolState.openingEncounter`持有全局selection、seed、selectionRng(state/draws=1)、facts。PR1 facts/receipts均必须为空。沿用room.pool，未在Room另造一份权威。验证重推轨迹仅认证，不推进或重新选择。

公共导出为 `createOpeningEncounter`、`validateOpeningEncounterConfig/Context/State`、`planOpeningRound`、`applyOpeningEffects`、`readOpeningEncounterView` 及相应类型/表/错误类。由simulation模块、match.ts、server-entry提供。非法配置抛opening-config-incomplete；上下文不匹配为opening-context-mismatch；无效节点/伪效果为invalid-opening-effect；apply失败保持原state、无events。共享入口沿用invalid-pool/invalid-seat-state。输入uint32错误沿用RangeError。

公共投影提供配置/规则/源ID、角色、官方名称、研究说明、enabled/effectStatus/readiness/statusTextZh及revealedFacts=[]。本人视图复用。源说明不代表已生效，必须同时显示关闭状态。原始context绝不可透传；服务器公共PlayerView/协议/重连展示留PR8。

开发rules/content为`s13-g2-3-v21-opening-encounters` / `s13-14.24b-g2-3-v21-opening-encounters`，schema/save=12/8；本PR未增加回放命令或选择工具，replay/command仍5/5。CONTENT=`fnv1a32-utf16:23bea8ef`，LOOT_REPLAY=`fnv1a32-utf16:cd2f4c8d`。旧身份严格拒绝运行态恢复，既有原文件保留/导出路径不改。**此身份尚未发布/录制；先rebase到v20-black-market，再以它为父epoch录制，届时复核版本与digest。**

## 实测结果

- `npm run typecheck`：通过，0诊断。
- 最终定向Vitest：9个文件，**177例，175通过、2个版本预期失败、0跳过**；其中新增2文件**59/59通过**。
- 两个失败是旧版本断言，未修改使其变绿。共享池14/14、私有视图16/16、M6回放9/9、B9兼容11/11、M8合同6/6均通过。
- 普通Vitest配置打包尝试向只读node_modules软链写临时文件而启动失败，之后使用Vite支持的`--configLoader runner`运行；未改配置、CI门槛或依赖。
- 仅运行新增/直接相关测试和typecheck；未跑全套、完整对局验收、浏览器、build或epoch核验。双digest更新使用既有`node scripts/update-content-identities.cjs --write`，只写内容常量。

最终命令（Node22，`PATH=$HOME/.local/bin:$PATH`）：

```sh
npm run typecheck
npm test -- --configLoader runner tests/opening-encounters.test.ts tests/opening-encounters-integration.test.ts tests/tp-shared-pool.test.ts tests/t5r-private-seat-view.test.ts tests/m6-persistence.test.ts tests/match-contract.test.ts tests/m8-b9-compatibility.test.ts tests/m8-contracts.test.ts tests/m6-replay.test.ts --reporter=json --outputFile=/tmp/encounters-pr1-final-tests.json
```

临时测试记录：`/tmp/encounters-pr1-final-tests.json`、`/tmp/encounters-pr1-final-tests.log`；typecheck记录：`/tmp/encounters-pr1-typecheck.log`。这些不是仓库夹具。

## 未录制epoch的失败清单

以下分别标明实测与静态推断。**未修改任何fixtures/golden或下列旧身份断言，也不声称全套已经运行。** 静态清单列出已找到的直接依赖和关键传递依赖；最终完整清单须在rebase后的PR9全套验收确认。

| 状态 | 文件/用例 | 原因 |
| --- | --- | --- |
| 实测失败 | `tests/match-contract.test.ts:9`，starts with versioned independent streams, public single-hero roster and immediate preparation | 仍期望schema11及v20-live-combat；当前schema12及v21开发身份 |
| 实测失败 | `tests/m6-persistence.test.ts:28`，rejects outer corruption before history {"saveFormatVersion":8} | 旧测试把8当未知版本；现在save8是合法当前格式 |
| 预期失败，未运行 | `tests/opening-random-identity.test.ts:488`，binds v20-live-combat to fresh public rules… | 旧baseline的版本/双digest不等于新运行态 |
| 同上 | `tests/opening-random-identity.test.ts:568`，cannon/sniper: checkpoint %i survives strict text/object restore（67×2） | 旧压缩检查点schema11且无openingEncounter，严格拒绝 |
| 同上 | `tests/opening-random-identity.test.ts:577`，recomputes the first battle terminal and every event hash from public commands | 全Match轨迹多出奇遇与新身份，trace state hash变化；不据此推断战斗数值改变 |
| 同上 | `tests/m8-content-equivalence.test.ts:43`，recorded $build state $index: restore from text equals restore from the parsed object | 恢复v20-live-combat旧检查点在版本准入失败；纯JSON等价测试不受此推断影响 |
| 同上 | `tests/m5-route.test.ts`，sniper-caitlyn普通购买路线及cannon/sniper/mage ordinary purchases/rewards… | assert-golden.cjs仍绑定旧epoch，initial versions和全状态hash不同 |
| 同上 | `tests/m6-integration*.test.ts` → `tests/m6-integration-helper.ts:24`，各build every completed battle has exact original state/events…及依赖该路线的后续case | 沿用旧全局golden，前置assertGolden失败；未运行耗时完整路线 |
| 同上 | `tests/b8-resumable-battle.test.ts` → helper:58，pre-change byte fingerprint: 0/1/9 units per side | B8解析结果含新内容身份，旧fingerprints不匹配 |
| 同上 | `tests/c19-missed-pulse.test.ts:54`，reduced seed-9 compiled input finishes… | 录制的两侧compiled input仍旧contentDigest，不能直接运行恢复 |
| 同上 | `tests/m8-b7-match-wiring.test.ts:125`非空三组Herald aura case；`:154` quicksilver/edge-of-night两组 | 五个Herald raw save仍是旧epoch，restoreMatch拒绝 |
| 同上 | `tests/epic-loot-reforger.test.ts:176/184/195`的真实5-7、光明光环、6-7 case；`:214` uses exact approved zh_cn names… | 前三者恢复旧压缩state，最后一例硬编码v20-live-combat |
| 同上 | `tests/d14-anomalies-source.test.ts:56`，retains the two D14 anomalies in the current epoch… | 当前内容与旧currentBaseline digest/rules不等 |
| 同上 | `tests/d11-wiring-bank.test.ts:17`，a resumable online task consumes live bank samples… | 尾部身份门槛仍读旧currentIdentity.contentDigest |
| 同上 | `tests/ur-i3-combat-statuses.test.ts:76`，preserves the pre-view-change battle, ledger and RNG and binds the current epoch identity | 双digest旧baseline；纯战斗oracle并未据此重写 |
| 同上 | `tests/v19-part2.test.ts:291`，retains v19 rules in v20-live-combat schema/save/replay 11/7/5 | 旧rules/schema/save身份断言 |
| 预期旧epoch核验失败，未执行 | `scripts/verify-v20-live-combat-epoch.cjs`及其release/herald/input/live-reveal/transfer检查、`scripts/verify-m8-herald-fixtures.cjs` | 内容/源码摘要、录制状态与旧manifest不一致；不得继续向旧epoch录制 |

transfer、live-reveal的部分单测只校验装备/事件/数值路线，关闭效果下可能仍通过；不能因为文件名含旧epoch就宣称每例失败。但它们的独立录制输入/manifest仍须在新epoch重新生成并核验。历史字节保持不变。

## PR2–9接口点与限制

- PR2：四种强化约束、两类开局锻造器。复用selection绑定与plan/apply入口，新增真实授予policy、来源收据/候选队列及恢复重演；初抽/换牌/恢复共用有效档位解析。非强制档位等权与锻造器四选一属于批准项目约定。
- PR3：订阅使用shared/seat分流；全局类别/金额事实先冻结，再各席领取。金币数量、费用上限、靴子及加时边界缺口继续阻塞，不能改权重。
- PR4：魔像永久纹章及禁用引用已有内容接点；完整属性/成长/人口/池证据补齐前不启用。
- PR5：猴子全局四分支与个人工具选择；扩展fact/receipt，原子伤害淘汰与杰作目标校验仍未实现。
- PR6：梅尔个人门槛、沃里克击杀；保留B补丁冠冕覆盖，奖池/权重/掉率/保底/上限须补证；不能复用六费英雄被动冒充奇遇。
- PR7：蟹野怪与维克托六费概率；数值证据未齐，不改现有野怪/商店表。
- PR8：Claude使用server-entry公共接口和只读投影接服务器/网络/2D/3D；本PR未接Room展示阶段、PlayerView传输或个人奖励选择UI，不新增第二份全局权威。
- PR9：先合黑市，rebase到v20-black-market；复核最终身份/协议，录制新epoch并做历史字节审计和完整验收。本PR没有录制目录或新golden。

无需用户新增玩法决定；“缺证关闭、不重归一化”沿用批准方案。交叉验货：测试范围/结果如上；服务器实现和界面目录未越界，server-entry仅公共重导出；不改变现有规则效果，只有新增选择记录、状态/投影和版本身份。
