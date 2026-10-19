# G2-4B 辅助装锻造器预演

2026-10-17。分支 `codex/g2-4b-support-forge-trial`；仅预演，不直接合入 multiplayer。

## 起点与合并

从 #149 `claude/g2-4b-support-items-oybovc` 的固定 head `65db5d203764d479026ee5209d42e78b627ccb27` 出发，合并神器锻造器 `b2de81a4d57f2f6b44ed31627505b848c72cad42`。独立合并提交 `900626d`，两父提交分别为上述固定 head。

25个冲突文件按以下方式解决：

| 范围 | 处理 |
| --- | --- |
| 装备注册表与内容摘要输入 | 同时保留21件神器、13件辅助装及双方source/declarations，不覆盖另一方 |
| `m8/item-program.ts` | 同时保留神器over-time/leap等有限效果和辅助装`apply-status.anyDamage`校验；黑曜石切割者的全伤害削抗保留 |
| `m8/contracts.ts`、`combat-s13.ts`、`strategy-snapshot.ts` | 保留神器stun-applied/shield-broken和辅助装能力；holder-death类型/实际发送各一份；自动合并产生的两个同文supportStage函数去重为一份，供双方阶段取值使用 |
| `g2-3-policy.ts`、版本声明及两个版本合同测试 | 选择神器分支已存在的v5、forge policy与deferredPolicy v2；不另外升级 |
| `docs/M8_RULES.md`、历史发布说明 | 保留双方机制说明，死亡事件同一行列三类订阅者；注明发布记录仍为历史证据 |
| 历史夹具、baseline、g2-3 JSON审计 | 保留#149原始字节，包括自动合并项；未手改或重录 |

相对#149可见的 `src/server/room/projection.ts` 与两个presentation文件差异，是指定神器head已经包含的依赖历史，合并时原样保留；本次没有编辑这些目录，也未编辑rendering或CI配置。本次功能提交仅修改simulation/tests/docs。

## 规则与来源

严格沿用用户确认的 G24-FORGE-01…08，没有新增需拍板约定值：四选一；按ID排序等权无放回；同窗口不重复；已拥有/上次出现允许再出现；超时第一项；不足4件拒绝；普通成装重铸器拒绝辅助装；界面名称“辅助装锻造器”，界面接入由Claude处理。

`src/simulation/content/g2-4-forges.ts` 在 `G24_FORGE_POOLS` 中新增 `TFT_ArmoryKeySupport`，取原始 `SUPPORTITEMS` 17件与 `G24_SUPPORT_ITEMS` 已实现项交集13件；保留17件源全集与4件排除表，并纳入现有摘要输入。13件具体ID见[计划§3.2](G2-4B-FORGES-PLAN.md#32-辅助装supportitems17-件)及专项测试独立期望表。未知选择器、内容池不足4件或池中有重复ID均拒绝，不回退成装池或折金。

本次重新解压 `raw/map22.bin.json.gz` 核对如下原始 `mConstants`，测试直接对照gzip源文件：

| 档位 | 阈值 | 源pointer | 实际发放 |
| --- | --- | --- | --- |
| 11 | 750 | `{687c9527}` | `MeepTypeUnit: ['TFT_ArmoryKeySupport']`；无金币 |
| 13 | 1000 | `{b7b519b5}` | `Item: ['TFT_Item_ZekesHerald','TFT_Item_LocketOfTheIronSolari','TFT_Item_Chalice','TFT_Consumable_ItemRemover']`，`Gold:20` |

第13档三件辅助装是固定奖励，顺序与源字段一致，不随机。`G23_DEFERRED_CONQUEROR_ITEMS` 移除Support选择器与三件辅助装，只留下冠冕；第11档移除15过渡金，第13档移除额外30过渡金。其余规则数值不变，15档总金币由337变292，B补丁每箱成长仍500Bps。

## 接口与恢复

复用 `g23RewardAtoms` / `openG23Choice` / `selectChoice` / `forfeitPendingChoice` / `validateG23Restoration`，没有新增命令、存档结构、服务器计时或独立选择账本。具体参数、返回值和失败语义见 [MATCH_CONTRACT](../../MATCH_CONTRACT.md#g2-4b-辅助装锻造器预演合同2026-10-17)。

| 奖励 | 唯一收据 |
| --- | --- |
| 11档选择 | `g23:conqueror:11:atom:0:copy:0`，choice/forge，必须有实际itemId，source=conqueror，price=0，skipped=false |
| 13档基克/鸟盾/圣杯 | `g23:conqueror:13:atom:0/1/2:copy:0`，分别item收据，绑定具体definitionId/itemId |
| 13档拆卸器 | `g23:conqueror:13:atom:3:copy:0`，consumable/magnetic-remover |
| 13档金币 | `g23:conqueror:13:gold`，gold/20 |

恢复由原奖励描述重新导出选项/收据；错池、错来源、空itemId、篡改选项/超时首项、旧11档15金/13档50金收据拒绝。重复命令、重复结算、恢复后drain不会重发。重铸拒绝保持原state/工具/RNG/事件。

测试区分两条恢复边界：真实联机席位进度/可信结算收据上的11/13档，验证机制状态与G23恢复链；独立的单人公共获取场景，验证完整 `serializeMatch/restoreMatch`、装备基克后战斗中恢复及后续逐tick状态/事件一致。单人恢复仍拒绝联机状态；超时公共命令仍要求multiplayer，未为测试放宽规则。

`tests/helpers/g24-forge-states.ts` 仅提取原神器测试的运行时场景构造，并增加11档捕获；六征服者由带来源的通用发奖命令构造，每轮PvP提供30个可信击杀ID。该场景验证领域结算收据边界，不宣称自然战斗能达到这一轨迹，不是重录历史黄金夹具。

## 预演版本边界

按用户要求不另升版本/revision，不改摘要算法，不重录夹具；合并沿用神器分支已有：

- rules `s13-g2-3-v5`；content `s13-14.24b-g2-3-v5`。
- policy `g2-4b-artifact-forge-v5`；forge policy `g24-forge-v1`。
- schema/save/replay/command = 7/3/3/3。
- 实际计算 content digest `fnv1a32-utf16:78ec35e8`；loot replay digest `fnv1a32-utf16:aeba5326`。

摘要是内容的计算结果，合并辅助装与新增获取规则会自然变化；没有用旧摘要冒充新内容。#149旧baseline为content digest `fnv1a32-utf16:c4bda1b2`、rules/content v3。此预演不能按已完成发布验证处理；正式合并顺序决定后应统一升级标识、按原脚本重录夹具并验收。

## 验证

仅相关测试，无全套、无跳过、无CI超时或门槛调整。最终结果见下表；原始日志/JSON与交付摘要一同保存。

| 范围 | 结果 |
| --- | --- |
| 相关功能/源数据/恢复/合同：16文件 | 228通过，0失败，0跳过 |
| 历史夹具一致性：3文件 | 14通过、139失败；下表逐项归因 |
| TypeScript | `npm run typecheck` 通过 |

合计19文件、381项：242通过、139旧夹具相关失败、0跳过。

相关文件：g2-4b-support-forge、g2-4b-support-items、g2-4b-artifact-forge、g2-4b-artifacts、g2-4a-conqueror-items、g2-3-traits、g2-3-content、g2-3-source-pins、g2-3-integration、g2-3-hook-failures、r3r4-consumables、r3r4-consumable-targets、m8-b4-trigger-ledger、m8-b10-item-save-replay、m8-contracts、match-contract（均为 `tests/*.test.ts`）。新辅助锻造器专项8项；同场合并回归另2项覆盖阶段取值和三种死亡订阅各触发一次。

| 旧夹具测试 | 通过/失败 | 失败原因 |
| --- | --- | --- |
| `opening-random-identity.test.ts` | 3 / 136 | baseline摘要不同1项；134个v3存档checkpoint被v5恢复入口以unsupported-version拒绝；首战状态轨迹SHA不同1项（其此前的战斗ticks/result/stateHash/eventHash断言已通过） |
| `m8-content-equivalence.test.ts` | 2 / 2 | cannon/sniper历史v3存档被unsupported-version拒绝 |
| `c19-missed-pulse.test.ts` | 9 / 1 | 历史冻结输入含旧content digest，被BattleValidationError: content-digest拒绝；其余燃烧脉冲用例通过 |

这139项失败已执行并保留失败结果，没有跳过、改断言或替换夹具；不能据此声称旧夹具按新规则可恢复。尚未运行的其他黄金/全套测试不作通过声明。

## 后续

无新增产品约定值待用户决定。待确定#147/#149/锻造器正式合并顺序后，统一版本/revision与夹具；Claude完成辅助装标题与联机弹窗接入，再按正式集成范围验收。该预演分支本身不直接合入。
