# 开局奇遇 PR5 交付报告（2026-10-22）

基线：`codex/encounters-pr5@f55aa165869aefeba4087c0632f40c6c60f222cb`（PR2，已含PR1）。工作目录 `/home/aiapps/workspcae/cat-enc5`，开工工作区干净；全部变更留工作区，**未commit**。仅修改 `src/simulation/`、`tests/`、`docs/`；未修改server/server-entry/rendering/presentation、CI或任何epoch/golden/fixtures。未联网、下载、读取外部在线资料或添加素材。

只读批准方案 `/home/aiapps/workspace/s13-ui-atlas/encounters/开局奇遇实现方案.md` 第3/4/6/9节及同目录14.24b调研JSON/Markdown。版本仍锁定14.24b；项目约定沿2026-10-22用户批准，不补造数值。

## 实现与关闭项

- **发条猴子 enabled=true、effectStatus=active**，3-5准备入口触发。独立全局四等分：全体存活席位10伤害／25金币／1杰作升级／4普通组件，各25%。固定16项权重顺序及猴子500 Bps不变，原始null保留。
- 共享只冻结一个分支事实；个人工具目标与选择独立，四组件身份各席独立、有放回，可重复。组件复用现有8件普通基础装备池，不加入金铲铲/金锅铲。单人及八席/机器人走同一规则。
- 伤害可致死：保存受伤前HP和未截断HP，全席先应用，再按现有§11.5规则确定同批名次、统一返还淘汰卡池、最后刷存活者商店。覆盖并列HP、全员死亡、唯一幸存者、此前已淘汰者和输入顺序交换。没有伪造战斗结算或触发六费梅尔战斗救命。
- 杰作工具先对弈子使用，打开个人武器库；选其一件永久可合成成装后，原子耗工具、生成对应光明版并卸到库存。组件、神器、辅助装、纹章、光明装备、临时子装备排除。非法操作不消耗；超时第一候选。弹窗期间交易、装备编辑及法球领取暂停，避免升级/出售改变目标；工具未打开时可保留到以后使用。
- **PR5无关闭分支**：本地 `G23_RADIANT_MAPPING` 覆盖全部36件普通可合成成装，其对应光明定义已在现有14.24b注册表中；复用映射及现有有限运行时，不改任何装备数值。源API名 `TFT_Consumable_MasterworkUpgrade` 已存在于本地奖励源表，无需猜造。
- 其他8项未实现/缺证奇遇维持原关闭状态；PR2六项和none保持启用。本PR没有宣称16项全部完成或可以直接上线。

## 改动文件与行号

| 文件:行 | 内容 |
| --- | --- |
| `src/simulation/opening-monkey.ts:1`（新增） | 四等分抽样、个人组件流、四分支授予、伤害事件及收据/来源/HP恢复认证 |
| `src/simulation/masterwork-choice.ts:1`（新增） | 单位→实例武器库、原子升级与消耗、待选恢复及UI映射 |
| `src/simulation/opening-encounter.ts:20`、`:96`、`:126`、`:145`、`:154`、`:263` | fact/receipt扩展、3-5冻结、应用去重、恢复认证、公共已揭示结果与观战共享参数 |
| `src/simulation/content/opening-encounters.ts:489`、`:799`、`:820` | 启用猴子、PR5配置版本、随机/时序/目标冻结约定纳入digest |
| `src/simulation/content/consumables.ts:8` | 杰作工具定义及本地源API名 |
| `src/simulation/content/identity-constants.ts:3` | 现有离线脚本重算双digest |
| `src/simulation/consumable-types.ts:6` | masterwork effect及记录用unit.itemId |
| `src/simulation/consumables.ts:29`、`:54`、`:70`、`:136` | 合法目标、选中件转换/卸下、重放和消费账本认证；既有工具不接受新增itemId旁路 |
| `src/simulation/seat-mechanics/types.ts:71` | armory可选masterwork工具/单位绑定 |
| `src/simulation/match-types.ts:8` | openingMonkeyResolved事件 |
| `src/simulation/match.ts:1`、`:487`、`:553`、`:745` | 单人3-5生命周期、工具使用/选择接入、readMasterworkOptions公共重导出 |
| `src/simulation/shared-pool-types.ts:60`、`src/simulation/shared-pool.ts:256` | openingResolution合同类型，全存活席位原子效果/名次/返池/自然刷新事务 |
| `src/simulation/operation-policy.ts:16`、`src/simulation/orb-claim.ts:43` | 杰作待选期间冻结可能使目标失效的操作 |
| `src/simulation/private-seat-view.ts:113` | 本人masterworkOptions映射，不泄露其他席位候选 |
| `src/simulation/resource-provenance.ts:555` | 仅杰作使用记录允许unit目标携带itemId，仍精确验证字段 |
| `src/simulation/serialization-structure.ts:251`、`:276`、`:286` | 3-5伤害HP链及未开战致死状态恢复边界 |
| `src/simulation/m8/version.ts:11`、`src/simulation/m8/contracts.ts:494` | replay/command=6/6；沿用schema12/save8及v21开发身份 |
| `tests/opening-encounters-pr5.test.ts:1`（新增） | 31例规则/原子性/随机oracle/工具/恢复/多人测试 |
| `tests/opening-encounters.test.ts:24`、`tests/opening-encounters-pr2.test.ts:224` | 当前启用清单增加猴子；固定权重/oracle断言保留 |
| `tests/r3r4-consumable-targets.test.ts:82`、`tests/epic-loot-reforger.test.ts:215` | 当前工具数量/官方名称清单增加杰作；旧epoch版本断言未改 |
| `tests/m6-integration-helper.ts:74`、`tests/m6-replay.test.ts:23`、`:158` | 当前合法存档输入读取M8_VERSION.replayFormatVersion；历史失败断言不动 |
| `tests/m8-b5-equipment-history.test.ts:183`、`tests/m8-b9-compatibility.test.ts:28`、`:31` | 同上，仅类型随当前合法格式调整 |
| `docs/MATCH_CONTRACT.md:1`、`docs/MULTIPLAYER_CONTRACT.md:1` | PR5覆盖段：输入输出、随机、收据、名次、生命周期、事件、失败和恢复 |
| `docs/UI_REQUESTS.md:1145` | Claude/PR8的本人字段、Room批处理及确切编译缺项 |
| `docs/OPENING_ENCOUNTERS_PR5_REPORT.md:1`（新增） | 本报告 |

## 随机子流、收据与合同

1. `opening-encounter-v1/shared/wind-up-monkey/outcome`：根seed XOR完整流名的UTF-16 FNV-1a32，lcg32-v1一词，`floor(word*4/2^32)`依次damage/gold/masterwork/components。四区间严格各2^30个词；全局唯一fact在3-5冻结。
2. `opening-encounter-v1/seat/<seatId>/wind-up-monkey/components`：相同派生，连续4词，各自`floor(word*8/2^32)`索引排序后的普通八组件池，有放回；solo席位名`solo`。不存在工具选择随机流；超时取第一合法实例。

不推进任何既有RNG。重放只认证已冻结事实/结果，不改变流或再发奖励。伤害与奖励都有独立opening receipt；金/工具另有同ID机制收据，组件加`/component/0..3`并写永久物品provenance。用途来源为`opening-encounter-monkey`／`masterwork-upgrade`，不借用PvE、征服者或黑市账本。

`nextSharedRound`保持原函数签名，成功结果新增 `openingResolution={nodeId,outcome,eliminated,ended,survivorRanks}`。此前淘汰者不需重新参与；结果states保留当批新淘汰席位，之后推进只传存活席位。Room合并以前已固定名次，一次发布；**不得再扣血、返池或重新排序**。零存活者仍按现有规则排出1–N名，但没有存活冠军。任何后席失败回滚整个批次。

工具复用已有useConsumable(unit)→choose(instance ID)／timeoutChoice；没有新增网络命令。`readMasterworkOptions`由match重导出；`readOpeningEncounterView`增加可选pool上下文供观战读取全局结果；`OpeningEffectFact.outcome`、伤害receipt.hpBefore、armory.payload.masterwork和`openingMonkeyResolved`事件详见两份合同首节。所有失败沿既有枚举，严格恢复不得补造缺失收据。

开发身份仍为v21，schema/save/replay/command=**12/8/6/6**；配置`opening-encounters-14.24b-pr5-v1`。CONTENT=`fnv1a32-utf16:b22ac15a`，LOOT_REPLAY=`fnv1a32-utf16:2fcf7585`。现有脚本离线`--write`后`--check`一致；没有新epoch录制。

## 实测结果

最终定向Vitest：**14文件、283例：276通过、7个预期身份/旧epoch失败、0跳过**；新增PR5文件 **31/31通过**。没有残余规则测试失败。`git diff --check`及双digest `--check`通过。只运行新增/直接相关文件及typecheck；未跑全套、build、浏览器、完整对局或epoch核验。

**typecheck未通过：1项诊断。** `src/presentation/orb-loot.ts:48` TS2741，现有穷举`TOOL_MARK`缺`masterwork-upgrade`。这是本次新增工具需要Claude接线的跨目录缺项，**不是epoch失败**；规则/测试文件0诊断。按用户“不改src/presentation”的明确限制未修改它，也没有放宽工具联合类型、降低CI门槛或隐藏报错。UI_REQUESTS已给准确字段与源API名；本分支尚不能声称编译全绿。

| 文件 | 通过/总数 |
| --- | ---: |
| opening-encounters-pr5.test.ts | 31/31 |
| opening-encounters.test.ts | 6/6 |
| opening-encounters-pr2.test.ts | 31/31 |
| opening-encounters-integration.test.ts | 46/46 |
| r3r4-consumables.test.ts | 15/15 |
| r3r4-consumable-targets.test.ts | 5/5 |
| epic-loot-reforger.test.ts | 24/28 |
| tp-rewards-and-rounds.test.ts | 9/9 |
| tp-shared-pool.test.ts | 14/14 |
| t3-round-settlement.test.ts | 11/11 |
| t5r-private-seat-view.test.ts | 16/16 |
| match-contract.test.ts | 11/12 |
| m6-persistence.test.ts | 48/50 |
| m6-replay.test.ts | 9/9 |

覆盖包含独立BigInt oracle的65536根seed、全部四等分边界、八席个人组件独立、3-5前不揭示、四分支真实单人命令及存档恢复、共享真实PvE/补给推进与T3权威零伤害胜利收据、后续HP链恢复、工具开窗/选择/超时、无效目标不耗工具、临时手套子装备撤销、篡改来源/收据/结果拒绝、交易/法球绕过冻结，以及原子失败/同时淘汰/全员死亡/旧淘汰观战。低HP/同时淘汰边界用明确标注的合成HP和历史尾项；不冒充自然游玩的濒死存档路线。有效工具测试用品经现有带来源授予器创建，正常装备命令及完整单人恢复认证通过。

```sh
export PATH=$HOME/.local/bin:$PATH
npm run typecheck
node scripts/update-content-identities.cjs --check
git diff --check
npm test -- --configLoader runner tests/opening-encounters-pr5.test.ts tests/opening-encounters.test.ts tests/opening-encounters-pr2.test.ts tests/opening-encounters-integration.test.ts tests/r3r4-consumables.test.ts tests/r3r4-consumable-targets.test.ts tests/epic-loot-reforger.test.ts tests/tp-rewards-and-rounds.test.ts tests/tp-shared-pool.test.ts tests/t3-round-settlement.test.ts tests/t5r-private-seat-view.test.ts tests/match-contract.test.ts tests/m6-persistence.test.ts tests/m6-replay.test.ts --reporter=json --outputFile=/tmp/encounters-pr5-final-tests.json
```

软链node_modules沿PR1/PR2采用`--configLoader runner`；未修改依赖或测试配置。日志：`/tmp/encounters-pr5-final-tests.json`、`/tmp/encounters-pr5-final-tests.log`、`/tmp/encounters-pr5-typecheck.log`。

## 预期失败清单（不改断言）

本次实测7例，均保留原版本/epoch断言及历史夹具字节：

| 文件/用例 | 原因 |
| --- | --- |
| `tests/match-contract.test.ts:9` starts with versioned independent streams… | 旧schema11/v20/command5，而当前12/v21/6 |
| `tests/m6-persistence.test.ts:28` rejects outer corruption… `{saveFormatVersion:8}` | PR1起save8已合法，旧测试把8作为未知格式 |
| 同上 `{replayFormatVersion:6}` | PR5 replay6已合法，旧测试把6作为未知格式；本PR新增预期失败 |
| `tests/epic-loot-reforger.test.ts:176` a real 5-7 command path… | 压缩旧epoch存档unsupported-version |
| 同文件`:184` authenticates neutral opening HP… | 旧epoch光明光环存档unsupported-version |
| 同文件`:195` the real 6-7 terminal… | 旧epoch终局存档unsupported-version |
| 同文件`:214` uses exact approved zh_cn names… | 工具名称清单功能适配后，仍在`:217`硬编码v20-live-combat失败 |

未运行的旧epoch依赖沿[PR1报告完整清单](OPENING_ENCOUNTERS_PR1_REPORT.md#未录制epoch的失败清单)：opening-random-identity、m8-content-equivalence、m5-route、m6-integration*、b8-resumable-battle、c19-missed-pulse、m8-b7-match-wiring、d14-anomalies-source、d11-wiring-bank、ur-i3-combat-statuses、v19-part2，以及verify-v20-live-combat-epoch/verify-m8-herald-fixtures和旧transfer/live-reveal等manifest核验。replay/command6及新digest会继续使旧录制身份不匹配；本PR没有运行这些耗时/非直接相关集合，不声称其中每个case都失败。PR9以新epoch完整实测为准，旧文件保持原字节。

## 给界面的字段与待办

- 公共奇遇：enabled/effectStatus及revealedFacts[{nodeId,outcome}]，3-5前为空；淘汰观战用pool上下文读取已揭示结果。无seed、selectionRng或未来随机结果。
- 本人：consumables、现有consumableTargets.allowed/reason、pendingChoice.armory/source/masterwork/实例offers、可选masterworkOptions[{itemId,definitionId,radiantDefinitionId}]；当前工具可用数直接读consumables。只给本人。
- 结果：openingMonkeyResolved、openingEffectApplied、mechanicGranted、consumableUsed等完整事件和来源账本；金币/HP/物品读取领域状态，UI不再计算。
- **待Claude：**补`TOOL_MARK`杰作键解除唯一编译阻塞；PR8接server-entry/消息/界面回调和Room openingResolution，特别是3-5立即淘汰、返池已完成及终局判断。详细验收见UI_REQUESTS末节。
- **待PR9：**rebase/合流后统一版本与epoch录制、完整联机/回放/重连验收、历史字节审计。当前不能直接部署；未请求或执行上线/合并。

交叉验货：测试过（31新例全过，相关结果及编译缺项如上）；没有越界；按批准范围新增猴子玩法，未改无关数值。无需新的玩法拍板；建议Claude按合同审查并完成所属目录接线。
