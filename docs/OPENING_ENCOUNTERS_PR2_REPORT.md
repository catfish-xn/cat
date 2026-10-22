# 开局奇遇 PR2 交付报告（2026-10-22）

基线：`codex/encounters-pr2@66b3a7143ad7a564665a2f25b0cf421529b9d6b8`。工作区 `/home/aiapps/workspcae/cat-enc2`；未commit。离线读取批准方案与同目录调研JSON，未联网、下载或添加素材。只改 `src/simulation/`、`tests/`、`docs/`；未改服务器、界面、server-entry、CI或其他任务目录。

## 实现与关闭项

- 范德尔「金金金之旅」：2-1／3-2／4-2全黄金；艾克「彩彩彩之旅」：三次全棱彩。
- 黑默丁格「棱彩前奏」：2-1棱彩；「棱彩终章」：4-2棱彩。其他节点仍为已有等权项目约定，允许棱彩，不冒充官方历史条件分布。
- 蔚「基础装备锻造器」：1-2每席2个，依次选择；杰斯「神器锻造器」：1-2每席1个。均沿现有四选一、无放回候选池和第一候选超时策略。
- 六项均 enabled=true、effectStatus=active；none仍启用但无额外效果。完整16项顺序、权重10000 Bps、none1000 Bps和研究null原样保留，不重归一化。
- 继续关闭：迅捷蟹水潭/蟹之狂欢缺属性与掉落表；金币订阅缺金额；战利品订阅缺费用上限/靴子等；魔像训练师缺属性/成长/人口/纹章池；维克托缺14.24b基础概率；梅尔缺完整奖池/权重；沃里克缺掉率/奖池/保底/上限。发条猴子属于PR5，尚未实现，未因已有分支数值而提前启用。

初抽、换牌、本人刷新按钮和恢复共用有效档位解析。已持有、永久移除、换牌当前候选互斥过滤保持；六项研究中的额外禁用引用均为空，没有编造禁用组。初抽少于3个或换牌空池返回 `augment-pool-too-small`，不跨档、不降档，原state、无events、资源/RNG不变。

## 改动文件与行号

| 文件:行 | 内容 |
| --- | --- |
| `src/simulation/content/opening-encounters.ts:115`、`:799` | 六项启用；PR2配置版本、收据、4候选采样与恢复约定纳入既有双digest根 |
| `src/simulation/content/identity-constants.ts:3` | 既有离线脚本重算CONTENT与LOOT_REPLAY |
| `src/simulation/augment-offers.ts:30`、`:71` | 统一有效档位；候选过滤沿用；单人/共享历史重演，加时不查不存在的日程 |
| `src/simulation/opening-encounter.ts:91`、`:131`、`:167`、`:195`、`:239` | 独立效果收据、1-2应用、子流采样、顺序锻造器、来源认证、本人进度 |
| `src/simulation/match-types.ts:7` | openingEffectApplied领域事件 |
| `src/simulation/match.ts:184`、`:485`、`:586` | 单人开局应用、初抽不足原子失败、初抽/换牌调用统一档位；新helper重导出 |
| `src/simulation/g2-3-runtime.ts:55` | 奇遇锻造器排在其他机制选择之前，不覆盖活动选择 |
| `src/simulation/shared-pool.ts:37`、`:87` | 共享原始开局准入后应用并返回盖章事件；共享恢复重演强化候选历史 |
| `src/simulation/private-seat-view.ts:101` | 本人可选openingEncounterProgress投影 |
| `tests/opening-encounters-pr2.test.ts:1`（新增） | 31例PR2规则、随机oracle、篡改、超时、恢复、共享与边界测试 |
| `tests/opening-encounters.test.ts:24` | 启用清单适配批准的六项；抽选/权重/oracle断言保留 |
| `tests/opening-encounters-integration.test.ts:45`、`:73` | PR1无效果用例仅对关闭项/none继续适用；全16项RNG与共享测试保留，锻造器先选完再测试商店 |
| `docs/MATCH_CONTRACT.md:1`、`docs/MULTIPLAYER_CONTRACT.md:1` | PR2覆盖段、完整签名、状态、随机、生命周期、失败与恢复边界 |
| `docs/UI_REQUESTS.md:1134` | Claude本人进度、候选、来源和超时接线交付 |
| `docs/OPENING_ENCOUNTERS_PR2_REPORT.md:1`（新增） | 本报告 |

没有修改任何epoch、golden、fixtures或旧身份失败断言；PR1“所有效果关闭”的当前行为测试变更是六项正式启用的功能适配。

## 随机流、收据与恢复

新增唯一流模板：`opening-encounter-v1/seat/<seatId>/anvil/<index>`，solo用`solo`，组件index=0/1，神器index=0；共享用pool根seed和真实席位ID。UTF-16 FNV-1a32后与根seed异或，lcg32-v1每个锻造器恰4词，排序池前4步Fisher–Yates，取`word % remaining`。跨锻造器独立但不禁止重复装备，未改现有强化候选或其他随机流。强化强制档位本身不需要新随机；非强制节点沿原基础档位算法。

`planOpeningRound`的1-2事实由身份确定，无新增全局随机事实，context保持原引用。独立`openingEncounter.receipts`分别记录策略激活（augment-policy）或每份锻造器（anvil/0、anvil/1）。实例标记用根seed派生的hash，公开选择ID不含明文seed/RNG。重复完整apply为成功空操作；恢复严格验证激活收据，不补发。每份锻造器完成另写既有mechanic选择收据和永久物品资源来源；第二份必须在第一份完成后开启，来源为opening-encounter，不伪装PvE击杀或征服者奖励。

恢复认证覆盖绑定、精确收据、初抽/换牌、4候选、选择顺序、超时第一候选及资源来源；共享须提供权威pool。共享加时不新增强化节点。无新网络命令，无新增失败枚举；合同明确既有opening错误、augment-pool-too-small、stale-choice/invalid-choice/wrong-phase等含义。

开发身份仍为PR1预留v21，schema/save/replay/command=12/8/5/5；配置升`opening-encounters-14.24b-pr2-v1`。CONTENT=`fnv1a32-utf16:a2cd4036`，LOOT_REPLAY=`fnv1a32-utf16:6a333f8c`；离线`--write`后`--check`通过。最终发布身份和新epoch按批准计划留PR9。

## 测试结果

最终定向Vitest共**10文件、202例：200通过、2个已知版本失败、0跳过**；新增PR2文件**31/31通过**。最终 `npm run typecheck` **通过，0诊断**；双digest `--check` 与 `git diff --check` 均通过。未跑全套、build、浏览器、完整对局验收或epoch录制。

| 文件 | 通过/总数 |
| --- | ---: |
| opening-encounters-pr2.test.ts | 31/31 |
| opening-encounters.test.ts | 6/6 |
| opening-encounters-integration.test.ts | 47/47 |
| augment-card-reroll.test.ts | 12/12 |
| augment-tier-consistency.test.ts | 7/7 |
| g2-4b-artifact-forge.test.ts | 7/7 |
| tp-shared-pool.test.ts | 14/14 |
| t5r-private-seat-view.test.ts | 16/16 |
| match-contract.test.ts | 11/12 |
| m6-persistence.test.ts | 49/50 |

覆盖：四种强化三个节点与逐槽换牌；已持有/已移除/当前候选过滤；初抽与换牌不足；前奏/终章非强制节点可取三档；两锻造器独立BigInt oracle、顺序选择、无效命令原子失败；每一步单人恢复；八席根seed绑定与私有候选；普通/选秀开局两次超时、恢复和重试去重；篡改候选/来源/顺序/收据/超时结果拒绝；活动选择不被覆盖、加时历史边界。跨三个强化节点使用显式标注的合成生存预算，独立验证强化历史，不冒充完整线上存档验收；第一强化和开局锻造器另用真实公开命令状态验证完整restore。

```sh
export PATH=$HOME/.local/bin:$PATH
npm run typecheck
node scripts/update-content-identities.cjs --check
npm test -- --configLoader runner tests/opening-encounters-pr2.test.ts tests/opening-encounters.test.ts tests/opening-encounters-integration.test.ts tests/augment-card-reroll.test.ts tests/augment-tier-consistency.test.ts tests/tp-shared-pool.test.ts tests/t5r-private-seat-view.test.ts tests/match-contract.test.ts tests/m6-persistence.test.ts tests/g2-4b-artifact-forge.test.ts --reporter=json --outputFile=/tmp/encounters-pr2-final-tests.json
```

软链node_modules沿PR1使用Vite `--configLoader runner`，不改配置/CI。日志为`/tmp/encounters-pr2-final-tests.json`、`/tmp/encounters-pr2-final-tests.log`、`/tmp/encounters-pr2-typecheck.log`。

## 预期失败清单（不改断言）

**本次实测两例：**

1. `tests/match-contract.test.ts:9`，starts with versioned independent streams…：仍期望schema11及v20-live-combat；PR1已切schema12/v21。
2. `tests/m6-persistence.test.ts:28`，rejects outer corruption before history {saveFormatVersion:8}：旧用例把8当未知格式，PR1起8已合法。

**未运行但仍适用的旧epoch依赖：**完整逐例/行号沿[PR1报告的失败清单](OPENING_ENCOUNTERS_PR1_REPORT.md#未录制epoch的失败清单)，本PR未将其改绿。包括 `opening-random-identity.test.ts`（旧digest/检查点/轨迹hash）、`m8-content-equivalence.test.ts`（旧检查点）、`m5-route.test.ts` 与 `m6-integration*.test.ts`（旧全局golden）、`b8-resumable-battle.test.ts`（旧fingerprint）、`c19-missed-pulse.test.ts`（旧compiled输入）、`m8-b7-match-wiring.test.ts`（旧Herald输入）、`epic-loot-reforger.test.ts`（旧压缩state/硬编码身份）、`d14-anomalies-source.test.ts`、`d11-wiring-bank.test.ts`、`ur-i3-combat-statuses.test.ts`、`v19-part2.test.ts`（旧baseline/版本）。`verify-v20-live-combat-epoch.cjs`、`verify-m8-herald-fixtures.cjs`及旧transfer/live-reveal等manifest核验仍需PR9重录新对应物。不能据此宣称这些文件中每一例都会失败；完整清单以PR9全套实测为准。

## 给Claude与下一步

公共openingEncounter白名单不变，启用项显示active及启用文案。本人新增可选`openingEncounterProgress`：source、effectsApplied、forgesGranted、forgesResolved、forgesPending；当前候选仍读pendingChoice（forge、4项、choiceId/generation、payload.source/timeoutOption），已完成选择读seatMechanics.receipts。强化读现有augmentTier/augmentOptions，不从基础deriveAugmentTier自行推断。超时一次一个choiceId；initializeSharedSeat已授予，服务器无需另发。新helper仅在simulation/match边界导出；PR8按需接server-entry和协议/界面，本PR不越权改线。

建议Claude交叉审查：已测试（如上）；未越目录；按批准范围改变六项玩法，其余权重/数值不动。无需新增产品决定；待PR8完成客户端与服务器展示接线、PR9统一epoch及完整联机验收后再考虑发布。
