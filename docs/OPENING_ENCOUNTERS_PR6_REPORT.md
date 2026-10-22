# 开局奇遇 PR6 交付报告（2026-10-22）

基线：`codex/encounters-pr6@66b3a7143ad7a564665a2f25b0cf421529b9d6b8`（PR1）。工作区开工时干净。仅修改 `src/simulation/`、`tests/`、`docs/`，全部留在工作区，未commit。按要求只读本地批准方案第3/4/6/9节及调研JSON/Markdown，未联网、下载；未改server/server-entry、rendering、presentation、CI、fixtures/golden，未录制epoch。

梅尔：实现存活时首次 `oldHp>40 && 0<newHp<=40` 的个人门槛观察、独立一次性收据、单人/多人结算接入、恢复校验及本人进度字段。六费梅尔救命判定/提交先完成，再记录救命后HP；正常致死不触发、不复活。观察收据不代表奖励或领取权益，不产生奖励事件。

梅尔奖励池/权重缺证，**enabled仍为false**；仅门槛观察启用。14.24b对应冠冕分支3→2保留在配置中，不能把它当完整奖池、不能固定给所有人两冠冕。沃里克概率/奖池/保底/上限缺证，**enabled仍为false**，只预留击杀事实类型与始终拒绝发奖的入口。两项权重各800 Bps、总表10000 Bps不变，所有null继续表示未知。没有启用完整奖励效果，因此不将权重表的enabled改为true。

## 文件与行号

| 新增/改动文件 | 要点 |
| --- | --- |
| `src/simulation/content/opening-encounters.ts:800` | 配置身份PR6；记录门槛、救命次序、观察不发奖与沃里克关闭策略，自动进入既有rules manifest |
| `src/simulation/content/identity-constants.ts:3` | 既有离线脚本重算双digest |
| `src/simulation/opening-encounter.ts:26` | OpeningMelThresholdReceipt类型 |
| `src/simulation/opening-encounter.ts:90` | 恢复/应用校验按首个合格HP历史严格重建收据 |
| `src/simulation/opening-encounter.ts:137` | 门槛纯函数、确定性收据、领域结算钩子 |
| `src/simulation/opening-encounter.ts:176` | 本人进度白名单；`:188`沃里克预留事实和关闭入口 |
| `src/simulation/match.ts:1`、`:382` | 新领域公共导出、单人救命后门槛接点 |
| `src/simulation/round-settlement.ts:165` | 多人救命后门槛接点，沿用原子事务与重发/镜像拒绝 |
| `src/simulation/private-seat-view.ts:101` | 本人openingEncounterProgress字段 |
| `tests/opening-encounters-pr6.test.ts:1`（新增） | 35例门槛/救命/重入/恢复/八席/隐私/关闭验证 |
| `tests/t5r-private-seat-view.test.ts:122` | 新本人字段的严格投影白名单，未改旧epoch断言 |
| `docs/MATCH_CONTRACT.md:1` | 完整新增导出、字段、失败枚举、时序、收据/恢复/身份合同 |
| `docs/MULTIPLAYER_CONTRACT.md:1` | 每席独立进度、全局不变、领域接线及网络交接 |
| `docs/UI_REQUESTS.md:1135` | 本人字段、数据来源、关闭提示、验收条件 |
| `docs/OPENING_ENCOUNTERS_PR6_REPORT.md:1`（新增） | 本报告与后续接口/预期失败清单 |

## 随机流、状态与公共合同

新随机子流 **0**，新增抽词 **0**。沿用 `opening-encounter-v1/select` 根seed的一次抽选；阈值与收据无随机数，沃里克关闭入口不消费任何输入事实或随机流。没有预抽未来奖励，也不使用商店、战斗、配对、强化、战利品RNG。未来开启奖励须从 `opening-encounter-v1/seat/<seatId>/<effectKey>` 派生并另行冻结具体流名，当前不凭空定义掉落算法。

`openingEncounter.receipts` 接受至多一条 `kind:'mel-threshold'` 的观察收据。键为 `JSON([instanceId,'mel-threshold',seatId,settlementId])`，内部instanceId绑定单人seed或共享poolId，联机seatId逐席隔离；保存round/hpBefore/hpAfter/rewardStatus='blocked-evidence'。全局context/facts/RNG不变。正常重入返回原引用；恢复仅校验，不补记、不补抽、不追奖。删改/重复/跨席复制收据被拒绝。非梅尔仍要求空收据。

新导出 `isMelBlessingCrossing`、`readOpeningEncounterProgress`、`applyWarwickHunger` 及类型通过simulation与match提供；内部 `commitOpeningEncounterHealth` 仅从opening-encounter模块导出。新的直接server-entry重导出留PR8接口负责人；已有 `toPrivateSeatView` 公共接口已包含本人进度。服务器无需自行计算HP门槛。

失败沿用 `opening-config-incomplete`（沃里克正确选择但缺配置）、`opening-context-mismatch`（绑定/收据不符）、`invalid-opening-effect`（错误奇遇/伪共享事实）；非法HP纯函数抛RangeError。多人事务内部异常映射invalid-receipt，重发/镜像仍duplicate-settlement/mirror-settlement，共享恢复异常仍invalid-seat-state。没有新增失败枚举字面量。命令失败保持原state、无events、不耗资源/RNG。

给界面的字段是 `openingEncounterProgress: null | {encounterId,thresholdHp,thresholdReached,rewardStatus,triggeredRound,hpBefore,hpAfter}`，只给本人；未触发后三项null。公开openingEncounter不变且仍显示“效果尚未启用”。thresholdReached只表示观察到跨越，不能显示已获奖或待领取；不输出内部键、seed、RNG、未来奖励。

配置身份 `opening-encounters-14.24b-pr6-v1`；rules/content仍为未发布 `s13-g2-3-v21-opening-encounters` / `s13-14.24b-g2-3-v21-opening-encounters`，schema/save/replay/command保持 **12/8/5/5**。CONTENT=`fnv1a32-utf16:a1a52f8f`，LOOT_REPLAY=`fnv1a32-utf16:a4dbb1dd`。旧PR1配置/digest拒绝恢复；epoch统一留PR9，历史字节不改。

## 实测结果

- 新增PR6规则测试 **35/35通过**，0跳过；41→40、41→39、边界不触发、致死/救命、每人一次、重复/恢复、八席独立、关闭无发奖/无RNG及隐私均覆盖。
- 最终按各文件最后一次有效执行统计：**9文件，237例，234通过、3个版本预期失败、0跳过**。没有未处理的功能失败；不重复计入中间修正前的测试运行。
- `npm run typecheck`：最终通过，0诊断。
- `git diff --check`：通过；目录检查无越界，素材/生成物未进入仓库。
- 只跑新增与直接相关测试文件和typecheck；未跑全套、build、浏览器或完整epoch验收。

| 测试文件 | 通过 / 总数 | 备注 |
| --- | ---: | --- |
| opening-encounters-pr6.test.ts | 35/35 | 新增；公共命令单人失利路线可在门槛前后严格保存/恢复及Continue |
| opening-encounters.test.ts | 6/6 | 权重、独立抽选、身份/双digest |
| opening-encounters-integration.test.ts | 53/53 | PR1生命周期、共享/隐私/无奖励 |
| t3-round-settlement.test.ts | 11/11 | 原子结算、镜像、重发 |
| tp-shared-pool.test.ts | 14/14 | 共享账本 |
| t5r-private-seat-view.test.ts | 16/16 | 私有投影 |
| m6-persistence.test.ts | 49/50 | save8旧断言预期失败 |
| match-contract.test.ts | 11/12 | schema11/v20旧断言预期失败 |
| v19-part2.test.ts | 39/40 | 六费梅尔/沃里克相关机制通过；旧版本断言失败 |

执行环境：`export PATH=$HOME/.local/bin:$PATH`，Node22，node_modules为只读软链。Vitest沿PR1使用 `--configLoader runner`，未改Vite/CI配置或依赖。

```sh
node scripts/update-content-identities.cjs --write
npm run typecheck
npm test -- --configLoader runner tests/opening-encounters-pr6.test.ts tests/opening-encounters.test.ts tests/opening-encounters-integration.test.ts tests/t3-round-settlement.test.ts tests/tp-shared-pool.test.ts tests/t5r-private-seat-view.test.ts tests/m6-persistence.test.ts tests/match-contract.test.ts tests/v19-part2.test.ts --reporter=json --outputFile=/tmp/encounters-pr6-final.json
npm test -- --configLoader runner tests/opening-encounters-pr6.test.ts --reporter=json --outputFile=/tmp/encounters-pr6-rules.json
```

原始临时日志：`/tmp/encounters-pr6-final.json/.log`（相关8文件结果；该次PR6测试夹具语法问题随后修正），`/tmp/encounters-pr6-rules.json/.log`（修正后PR6 35/35最终结果），`/tmp/encounters-pr6-typecheck.log`（最终类型检查）。这些均不是仓库夹具。

测试范围边界：41→40使用独立HP历史向量；真实单人结算另测43→40，真实多人结算测41→39。当前单次标准/加时PvP伤害最多27，41→致死/救命后1的分支用策略向量验证，真实低HP致死另测第12次施法救命接线。八席测试只把初始HP设为边界值，使用真实PvE结算产生收据并共享快照恢复；它不是八局完整历史录制。关闭状态下沃里克各类输入全部拒绝，不宣称已经完成合格击杀发奖、镜像掉落去重或保底恢复算法。

## 未录制epoch的失败清单

以下3个已实测，**旧断言保持原样**：

| 文件 / 用例 | 原因 |
| --- | --- |
| `tests/m6-persistence.test.ts:28`，rejects outer corruption before history {saveFormatVersion:8} | 旧测试把8当未知格式；PR1起当前save=8 |
| `tests/match-contract.test.ts:9`，starts with versioned independent streams… | 仍期望schema11/v20-live-combat，当前schema12/v21 |
| `tests/v19-part2.test.ts:291`，retains v19 rules in v20-live-combat schema/save/replay 11/7/5 | 同属旧rules/schema/save断言 |

其余为 **PR1已记录的静态预期、本PR未运行**：

- `tests/opening-random-identity.test.ts:488/:568/:577`：旧身份、压缩检查点及轨迹hash。
- `tests/m8-content-equivalence.test.ts:43`：旧检查点恢复。
- `tests/m5-route.test.ts`、`tests/m6-integration*.test.ts`及helper：旧epoch/golden路线。
- `tests/b8-resumable-battle.test.ts`：旧B8字节指纹。
- `tests/c19-missed-pulse.test.ts:54`：旧compiled input digest。
- `tests/m8-b7-match-wiring.test.ts:125/:154`：旧Herald原始存档。
- `tests/epic-loot-reforger.test.ts:176/:184/:195/:214`：旧保存状态和硬编码v20身份。
- `tests/d14-anomalies-source.test.ts:56`、`tests/d11-wiring-bank.test.ts:17`、`tests/ur-i3-combat-statuses.test.ts:76`：旧baseline身份/digest。
- `scripts/verify-v20-live-combat-epoch.cjs`及其release/herald/input/live-reveal/transfer检查、`scripts/verify-m8-herald-fixtures.cjs`：旧录制/manifest/源码摘要不一致。

完整旧清单及具体用例解释见 [PR1报告](OPENING_ENCOUNTERS_PR1_REPORT.md#未录制epoch的失败清单)。不把未运行项声称为本次实测失败；PR9再统一录制并做全套确认。

## 后续接口点与限制

- 梅尔：补齐完整14.24b奖池与权重后再实现奖励，强制对应分支冠冕=2；不能对本PR关闭期间的观察记录热补奖。发奖需独立授予来源与确定性随机子流，不复用G23或六费救命收据。
- 沃里克：概率、奖池、保底和上限缺一不可。当前只提供预留输入/关闭失败；合格击杀、死亡事件去重、镜像与保底恢复留参数齐备后实现。
- PR5或其他回合外HP来源：必须扩展同一可认证HP历史和首触发收据，不直接改playerHp后绕过门槛校验。本分支只基于PR1，不包含其他PR的未来接点。
- PR8：Claude接本人字段/网络白名单、新server-entry重导出；PR9：整合后更新最终digest并统一录制epoch。当前不部署。

无需用户新增玩法决定，继续采用已批准的缺证关闭策略。交叉验货三问：测试过（数字与边界如上）；未越界（仅simulation/tests/docs）；未变更现有玩法数值（仅门槛观察状态、恢复与投影，奖励关闭）。
