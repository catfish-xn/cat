# 开局奇遇 PR4：安蓓萨魔像训练师交付报告（2026-10-22）

## 结论与证据边界

**本 PR 完成关闭状态的接口、校验和测试；没有启用新奇遇。** `trainer-golems` 保持 `enabled=false`、`readiness=blocked-evidence`、400 Bps（4%），完整16项仍合计10000 Bps；不改成无奇遇、不重抽、不重归一化。其他奇遇沿用PR1状态，未改变其他规则数值。

工作目录 `/home/aiapps/workspcae/cat-enc4`；分支 `codex/encounters-pr4`；基线 `66b3a7143ad7a564665a2f25b0cf421529b9d6b8`，开工时工作区干净。按Codex规则侧职责，只修改simulation、tests、docs；没有commit、联网、下载或修改其他克隆、服务器、界面、CI门槛、历史fixtures/golden。`node_modules`沿用软链，没有安装依赖。

只读证据：`/home/aiapps/workspace/s13-ui-atlas/encounters/开局奇遇实现方案.md` §§3、4、6、9；同目录 `tft_s13_opening_encounters_14.24b.json` 的 `encounters[9]` 及Markdown第41、77、94–95、139行。目标补丁仍为14.24b。来源确认每席1个魔像和3个永久纹章；用户批准项目约定是各席独立、单魔像三个不同可执行纹章、首轮1-2授予。原始调研null保留，与批准约定分开存放。

| 核心缺口 | 现有机制不能提供的依据 | 本PR处理 |
| --- | --- | --- |
| 完整纹章池 | 现有22个可执行纹章不等于训练师专用池；纹章含approved-provisional项目数值 | `emblemPool=null`，仅做候选结构/可执行身份校验，不抽样 |
| 魔像定义、属性及成长 | 只有其他召唤物/野怪魔像，没有训练师的可信属性、技能及阶段成长 | `unitDefinitionId/statsAndGrowth=null`，不注册假单位、不借用其他召唤物数值 |
| 人口规则 | `UnitDefinition.summon.countsTowardPopulation`只是工程能力，不能证明训练师占/不占人口 | `countsTowardPopulation=null`，不开单位授予 |
| 出生及移动规则 | 现有虚空生物的投影、碰撞和位置策略属于该召唤物约定 | `placementAndMovement=null`，不推断初始格子/备战席/移动策略 |

## 已交付与验收边界

| 方案PR4验收点 | 已验证 | 未宣称完成 |
| --- | --- | --- |
| 三不同纹章 | 校验恰好3个可执行纹章，物品ID/羁绊ID各不重复；覆盖全部1540个三元组合以及13种无效输入 | 真实奇遇池及按席采样、授予 |
| 羁绊计数 | 复用普通持有者的纹章投影，上场三个额外羁绊各计1，备战席均计0；现有纹章48例回归通过 | 魔像独立成员身份、羁绊与召唤物交互 |
| 人口/移动 | 关闭状态只保留原开局英雄和部署容量；未授予魔像不能移动 | 训练师人口/出生/移动定义 |
| 禁售与拆卸/重铸/复制绕过 | 未授予单位的出售、移动和四种工具请求均原子拒绝，不扣工具/资源/RNG；伪造事实/成功收据拒绝 | 实际魔像的禁售、永久装备锁定、额外装备限制、镜像/复制交互；现有普通装备拆卸/重铸不自动保护永久纹章 |
| 恢复重编译 | 合法关闭状态单人文本/对象及八席共享快照可恢复；伪造准备单位/奇遇记录拒绝；真实战斗的编译阵容注入拒绝 | 带真实魔像及永久纹章的独立重编译认证 |
| 强化禁用 | 保留金色炊具及5个Portal历史引用，不扩大强化池；关闭状态不施加局部玩法效果 | 启用后的初抽、换牌与恢复过滤；已有有效映射含built-different，须在启用时一并处理 |
| 一次性效果 | 重复显式授予始终失败；通用空生命周期钩子与恢复均不发奖，无伪成功收据 | 启用时须实现独立效果收据及资源来源原子授予，不能只翻enabled |

## 文件与行号

| 文件 | 改动 |
| --- | --- |
| `src/simulation/content/trainer-golems.ts:8`（新增） | 冻结关闭策略、已知数量、批准约定、四项缺口、null参数及预留流名 |
| `src/simulation/trainer-golems.ts:13`（新增） | 三纹章候选校验，返回脱离输入的冻结三元组 |
| `src/simulation/trainer-golems.ts:33` | 显式授予准入接口，先认证上下文/席位，再因缺证拒绝；无副作用 |
| `src/simulation/content/opening-encounters.ts:474`、`:797` | 引用完整缺口列表，配置身份升pr4-v1，策略进入既有manifest |
| `src/simulation/content/identity-constants.ts:3` | 既有离线脚本重算双digest，无手填摘要 |
| `src/simulation/match.ts:2` | 重导出策略、两项函数及三元组类型 |
| `tests/opening-encounters-trainer-golems.test.ts:1`（新增） | 34例：候选/配置、防伪、原子失败、恢复、八席、普通纹章计数与关闭状态工具目标 |
| `docs/MATCH_CONTRACT.md:1` | PR4签名/字段/失败枚举、关闭准入、恢复、随机与版本边界 |
| `docs/MULTIPLAYER_CONTRACT.md:1` | 同步上述合同与八席绑定、服务器边界交付限制 |
| `docs/UI_REQUESTS.md:1135` | Claude沿用现有公开字段，必须显示关闭状态，不生成魔像/装备 |
| `docs/OPENING_ENCOUNTERS_PR4_REPORT.md:1`（新增） | 本报告 |

## 导出、随机数、收据与身份

- 从 `simulation/trainer-golems.ts` 与 `simulation/match.ts` 导出：`TRAINER_GOLEMS_POLICY`、`TrainerGolemEmblems`、`validateTrainerGolemEmblems(input:unknown):TrainerGolemEmblems`、`applyTrainerGolemsOpening(state:MatchState,shared?:OpeningEncounterContext):MatchCommandResult`。未改server-entry，PR8可按合同增加边界重导出。
- 沿用失败枚举：`opening-context-mismatch`（认证/绑定/收据错误）、`invalid-opening-effect`（非训练师上下文或无效三元组）、`opening-config-incomplete`（已选训练师但缺证；配置被补造/启用）。没有新增网络命令/失败协议项。
- **新增实际随机子流0个。** 只预留 `opening-encounter-v1/seat/<seatId>/trainer-golems/emblems`；尚未确定采样池/算法，不初始化、不推进该流。单人及八席已有RNG不变。
- 未授予魔像/纹章，不生成fact或receipt；通用空钩子幂等成功，显式授予幂等失败，失败返回原state且无events。后续真实授予必须用含奇遇实例/效果/席位/节点的独立收据，并认证来源；候选校验成功不能代替这些凭证。
- 配置身份 `opening-encounters-14.24b-pr4-v1`；策略版本 `trainer-golems-blocked-v1`。沿用PR1未发布的v21 rules/content与schema/save/replay/command=12/8/5/5；未新增持久化结构/命令，不另开epoch。
- CONTENT=`fnv1a32-utf16:a23fc23d`，LOOT_REPLAY=`fnv1a32-utf16:c14cf163`。通过既有 `node scripts/update-content-identities.cjs --write` 生成，PR1摘要的旧开发档亦会严格拒绝。**不录制epoch，交PR9统一处理。**

## 测试结果

最终定向Vitest：**7文件、217例、215通过、2个已知版本预期失败、0跳过**。本PR新增文件 **34/34通过**；PR1两文件 **59/59通过**；现有纹章 **48/48通过**；共享池 **14/14通过**；Match合同11/12、M6存档49/50。`npm run typecheck`通过，0诊断。`git diff --check`通过。

```sh
export PATH=$HOME/.local/bin:$PATH
npm run typecheck
npm test -- --configLoader runner tests/opening-encounters-trainer-golems.test.ts tests/opening-encounters.test.ts tests/opening-encounters-integration.test.ts tests/v18-emblem-traits.test.ts tests/tp-shared-pool.test.ts tests/match-contract.test.ts tests/m6-persistence.test.ts --reporter=json --outputFile=/tmp/encounters-pr4-final-tests.json
```

日志：`/tmp/encounters-pr4-final-tests.json`、`/tmp/encounters-pr4-final-tests.log`、`/tmp/encounters-pr4-typecheck.log`。沿用PR1的`--configLoader runner`避免向只读node_modules软链写配置临时文件；未改配置/依赖/CI。仅跑新增和直接相关测试、typecheck；未跑全套、build、浏览器、完整对局验收或epoch核验。

## 预期失败清单（不改断言或golden）

| 状态 | 文件/用例 | 原因 |
| --- | --- | --- |
| 本PR实测失败 | `tests/match-contract.test.ts:9`，starts with versioned independent streams…（断言行13） | 仍断言schema11/v20-live-combat；PR1已切schema12/v21 |
| 本PR实测失败 | `tests/m6-persistence.test.ts:28`，rejects outer corruption before history {saveFormatVersion:8} | 旧测试把当前合法save8当作未知版本 |
| PR1已记录，未在本PR运行 | `tests/opening-random-identity.test.ts`、`tests/m8-content-equivalence.test.ts` | 旧版本/digest及无openingEncounter的旧检查点不满足新身份 |
| 同上 | `tests/m5-route.test.ts`、`tests/m6-integration*.test.ts`及helper | 旧全局golden身份与全状态hash |
| 同上 | `tests/b8-resumable-battle.test.ts`、`tests/c19-missed-pulse.test.ts`、`tests/m8-b7-match-wiring.test.ts` | 旧B8指纹、compiled input与Herald raw save |
| 同上 | `tests/epic-loot-reforger.test.ts`、`tests/d14-anomalies-source.test.ts`、`tests/d11-wiring-bank.test.ts`、`tests/ur-i3-combat-statuses.test.ts`、`tests/v19-part2.test.ts` | 指定case依赖旧epoch/checkpoint/身份；不是宣称整文件全部失败 |
| 同上 | `scripts/verify-v20-live-combat-epoch.cjs`及其release/herald/input/live-reveal/transfer检查、`scripts/verify-m8-herald-fixtures.cjs` | manifest、源码摘要、录制身份待PR9统一更新，旧epoch不得覆写 |

上述静态预期的逐case清单沿用 [PR1报告“未录制epoch的失败清单”](OPENING_ENCOUNTERS_PR1_REPORT.md#未录制epoch的失败清单)。本PR只实测表内前两项失败，不冒充其余已运行；无新增非预期失败。全部完整清单由PR9重录和全套验收确认。

## 给界面（Claude）与下一步

继续读取 `readOpeningEncounterView` / `toPrivateSeatView(...).openingEncounter` 的 `encounterId, champion, nameZh, descriptionZh, enabled, readiness, statusTextZh, revealedFacts`。没有新增界面字段；选中trainer-golems仍展示真实身份及“效果尚未启用”，`revealedFacts=[]`。缺少实际单位ID、属性、人口、位置和纹章结果是刻意的关闭状态，不能在界面补算、虚构或模拟发奖。

无需用户新增决定；按已批准的“缺证关闭”交付。下一步请Claude交叉验货：已测试（以上数字）、未越界（仅simulation/tests/docs）、未改已启用玩法（纯关闭接口/内容身份更新）。补齐14.24b证据后再实现魔像执行器与永久装备认证，随后与其他PR集成，由PR9统一epoch/发布验收。仅翻enabled无法启用本项。
