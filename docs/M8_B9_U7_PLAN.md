# M8 节点2（B9＋U7）一次性梳理与实施计划

## 0. 起点与边界

- 分支 `feat/m8-b9-u7`，起点 `c109d4ebc24bb5de60c1adfa4cad2e5ca5e816fd`（节点1复审通过的固定 SHA，2026-10-10 用户授权“现在开始节点2，不用等待节点1 CI”）。
- `feat/m8-b8` 与 PR #28 保持固定，节点2代码不混入。PR #28 按已授权方式合入 `feat/m8-b0-baseline` 后，本分支用 merge 同步实际合并后的基线（不 rebase、不改写历史）。
- 不授权节点2合并或合入 main。完成后以固定 SHA、完整 CI、包体与 GPT 独立审查送审。
- 预算（`M8_REMAINING_JS_BUDGET_PLAN.md:50-51,104-111`）：B9 中值 9,000 B、净增严格超过 11,700 B 暂停；U7 中值 3,500 B、严格超过 4,550 B 暂停；总包严格超过 552,191 B 暂停。基线为 `c109d4e` 生产包 504,905 B，同工具链逐 JS gzip9 求和；B9/U7 用探针分账，探针为估计。
- 不改冻结玩法；版本/事件格式按 `M8_RULES.md` §10 与 `contracts.ts` `M8Version`/`M8CombatEvent` 冻结目标执行；性能/容量门槛不放宽（§4.3）。

## 1. 版本切换（schema6/save2/replay2）

| 项 | 现状 | 目标与做法 |
| --- | --- | --- |
| Match 版本元组 | `match.ts:97-102`、`match-types.ts:38-39` 为 5/`m5-14.24b-v1`/`s13-14.24b-slice-v1`/2 | 6/`m8-14.24b-v1`/`s13-14.24b-m8-v1`/2，RNG/tick 不变。类型直接取 `M8Version`。 |
| restoreMatch 门 | `serialization.ts:58-59` 精确元组＋digest | 只接受 M8 元组；其余 `unsupported-version`，digest 不同 `content-digest`。 |
| contentDigest | `content/index.ts:45-59` 自动计算，未含版本串 | 规范输入加入 rules/content 版本与 replay 事件格式版本，仍自动计算，不手填；dev 期 `314b4c1f` 及 M7 `d40612fa` 均自然失效。 |
| SaveEnvelope | `m6/contracts.ts:16-25` 1/1 | 2/2；`format.ts:15`、`repository.ts:52`、`application.ts:107,196` 同步。 |
| BattleRecord | 无自身版本 | 增加 `version{schemaVersion,rulesVersion,contentVersion,contentDigest,replayFormatVersion}` 与 `roundId`，`history.ts` 先按版本路由再选同版本校验器；与 context 不一致即拒绝。 |
| golden/fixture | m5 full-match golden、m8-herald-raw、b7/b8 guard | 用归档脚本（仿 `update-m8-b8-golden.cjs` capture/audit/apply）重录；审计证明：命令不变、每轮结算/HP/金币/结果投影不变，差异只来自版本字段、digest、replay2 事件形状及其 eventSeq。不单改 golden 求绿。 |

## 2. replay2 事件账本

冻结依据：`M8_RULES.md:194`、`M8_UI_CONTRACT.md:36-46,123`、`M8_RULES.md:433`、`contracts.ts:446-458`。引擎内部已计算全部冻结载荷（DamageOutcome/CastReceipt/ManaOutcome/HealOutcome/ShieldState/StatusGroup/CombatActivity），切换主要是发布形状：

| 事件 | 改动 |
| --- | --- |
| packetDamage | `{outcome: DamageOutcome}`，删除旧 raw/mitigated/absorbed/hpDamage/critical/redirected（`combat-s13.ts:283`）。 |
| damage（旧汇总） | M8 账本不再发（`combat-s13.ts:364`）。 |
| cast | `{receipt: CastReceipt}`；同 tick 返蓝结算后写入最终 receipt（`mana.ts` 已要求同 tick 返蓝），事件位置不变。 |
| manaChanged | 每笔回蓝请求一条 `{outcome: ManaOutcome}`（攻击/受伤/击杀等已在 `combat-s13.ts:405-408` 计算）；删除每 tick 聚合；施法扣蓝只在 cast.receipt。 |
| statusChanged | 一律 `{group: StatusGroup, reason}`，group 为变化后的权威状态组（UI 合同 §5 表：显示有效状态与来源/期限）；修复 `combat-s13-state.ts:183`、`s13-mechanisms.ts:216,247,310` 无 group 路径（含 UR-U4-05“眩晕 0 阵亡清除”）。 |
| activityChanged | 新增；引导/分担的应用、到期、控制取消、替换、死亡与战斗清理改发本事件（UR-U4-04）。 |
| heal / shieldLayerChanged | heal 只保留 outcome；护盾为 `{layer: ShieldState, reason}`，`endReason` 并入 reason。 |
| statChanged / maxHpChanged | `source: Source`（含 parentItemInstanceId）；`attackSpeedBps` 映射 `attackSpeed`（值仍 Bps，合同 §3）。 |
| 未变 8 类 | targetChanged/kill/growth/effectTriggered/movement/attack/death/combatFinished 不变。 |

- 状态影响：`neutral-receipts.ts:17-27` 改读 group；删 damage 事件使 eventSeq 位移，进入 `neutralReceipts`/击杀证据，属新版本状态，由 golden 审计核对语义投影不变。
- 非 S13 旧路径（`combat-tick.ts`，仅 M3/M4 遗留单位）保持旧事件类型，不进入 M8 Match。
- 实现解释（不改冻结合同，提请复审确认）：statusChanged 的 group 为变化后快照；combat-start 回蓝在已交付内容中不可达（仅测试注入），M8 账本不新增该 reason，S13 路径遇到即拒绝而非静默丢弃；castReceipts 只在 tick 内存在，不进入持久状态。
- 消费端（U4 收口，Claude 界面范围）：`combat-status.ts`、`combat-feedback-renderer.ts`、`stats-panel.ts`、`fx-plan.ts`（命中闪光改由 packetDamage 驱动）、`strategy-panel.ts`、`combat-feedback.ts`；`stats/aggregate.ts` 已优先读 outcome。冻结来源名称：回放用记录对应的冻结内容名称（UR-U4-06）。

## 3. 33 战容量

- `MAX_BATTLE_RECORDS` 由目录推导（38 推进轮中非补给 33），`application.ts:104` 字面量改用常量；`format.ts:18,21`、`history.ts:74` 随之。
- 移除 B6 适配：`b6-deferred-assertions.cjs:17,21,34`（容量30及尾3战）与 `m8-b6-gate-preparation.test.js:50-68` 的相等约束；`verify-m6-performance.cjs` 有界30战门禁（:46-49,:218-246）在完整33战导入恢复后按原文件保留为附加观察或移除，以原 issue #23 要求为准，不替代完整门禁。
- 256 MiB、每战 100000 事件、40 tick 保存/检查点、最近 3 局、全部性能阈值不变；若33战负载超阈值，提交实测与具体优化方案，不放宽。

## 4. M7 旧档隔离（D2-A）

- 新库 `hex-autobattler-m8`（物理 schema1），`SaveRepository` 只用于 M8；修正 `db()` 缓存失败 open 的问题不改变事务语义。
- 旧库 `hex-autobattler-m6` 用独立只读读取器：无版本 open，`onupgradeneeded`（旧版本0即不存在）立即 abort 并视为空库，不创建旧库；检查三表；只用 readonly 事务；每次调用后关闭。原 v1 materialize 逻辑原样移植为 format1 导出器，不调用新版 restore/validator。
- `listLegacyRecords()`/`exportLegacy({requestId, recordRef})` 按 `ui-contracts.ts:84-113` 与 `M8_UI_CONTRACT.md` §6/A13：fingerprint 为原信封＋历史的确定性摘要；active 有 revision、history 为 null；同一记录只列一次；导出时重读重算 fingerprint，不符即 stale-reference；空库成功空数组，读失败不冒充空库。
- `readCompatibility(parsed)`（`ui-contracts.ts:77`，同步、输入已解析对象）：先外层格式路由，再 Match 版本/digest，再容量；返回 current / legacy-preserved（M7 format1/schema5，new-match-required）/ rejected。导入只接受 current；旧档不能激活。
- M8 新局与最近3局淘汰不触碰旧库；导入失败/Quota/abort/迟到写入保持原好档（沿用现有事务与会话保护测试）。
- 旧库中可能存在 dev 期 schema5 记录（digest 非 M7 签收值）：同样只读保全/导出，不判定为可恢复。

## 5. U7 界面（D6-A 范围：save-controls.ts、replay-panel.ts、两个 stats 叶子及 Claude 原界面文件）

- 保存控件：显示当前文件/槽兼容性（可续玩、仅保全导出、拒绝及原因）；新局/替换前显示实际影响；旧记录列表＋指定导出（onExportLegacy），当前局导出改为 onExportCurrent；迟到响应按 requestId 归属，失败不回退导出其他记录。
- 保留全部现有 `m6-*` data-debug、`.m6-save-controls [role="alert"]`、回放标签/按钮、`data-m6-mode` 与 `__CAT_DEBUG__.read().m6` 形状；新回调为可选追加，不在种子输入前加文本输入；控件 ≥44 px。
- 回放面板：只列 M8 已验证记录；显示轮次名、结果与内容版本；只读 seek/倍速/跨战切换；旧档永不可播。

## 6. B9 延期断言恢复清单（`docs/evidence/m8-b6/deferred-assertions.md`）

| 位置 | skip ID | 恢复做法 |
| --- | --- | --- |
| `tests/m6-integration.test.ts:121` | 4 条完整33战 envelope 接受 | 解除 skip，原断言。 |
| `tests/m6-application-failures.cjs:66` | G02-game_over | 恢复真实33战终态导入/重启/下一命令。 |
| `:72` | ROOT_03 | 恢复，显示期望按目录由30/90升为33/99。 |
| `:86` | P2-stale-archive-success / -reject | 恢复完整33战归档竞争两分支。 |
| `:101` | R4_inflight_combat_then_pending_terminal_commit | 恢复，期望按目录升级。 |
| `scripts/verify-m5-browser.cjs:117,134` | browser-round-6-5/6-6/6-7、browser-complete-application-route | 恢复浏览器尾3战与完整终态/归档，`fullApplicationRoutePassed` 由真实结果决定。 |
| `scripts/compare-m5-evidence.cjs:43,73` | 三构筑与触摸尾3战快照 | 恢复真实比较，删除尾段省略校验。 |
| `scripts/verify-m6-performance.cjs` | capture/write/activation/completeImport、current-prefix-validation、full-load-import-roundtrip | 恢复原完整33战导入、12/12/12/3 样本、冷库首样本、顺序与阈值；关联 issue #23。 |
| `scripts/compare-m6-evidence.cjs` | 应用与性能 B9 镜像、90/30 文案 | 改为要求无 B9 skip，按目录 99/33。 |
| `tests/m8-b6-performance-fixtures.test.js`、`m8-b6-gate-preparation.test.js` | B9 合成向量 | 随适配移除更新为“无延期”。 |
| issue #23、`deferred-assertions.md` | — | 写处置表；关闭 issue 需同 SHA 完整 CI＋独立审查。 |

翻转的旧断言（随版本切换而变，属预期变更，逐条列在提交说明）：`m6-persistence.test.ts:26`、`verify-m6-storage.cjs:12`（save2/replay2 由拒绝变为接受，改为拒绝 1/1 与未知版本）、`m7-m6-save-compat.test.ts`（content-digest 拒绝改为 legacy-preserved 识别＋原样导出）、`update-m8-b8-golden.cjs:66` 文本守卫、各 save1 信封构造脚本。

## 7. 实施顺序

1. 33 战容量与 B6 适配移除（独立于版本，可先测性能）。
2. replay2 事件形状＋消费端适配＋版本元组＋digest＋BattleRecord 版本，一次重录 golden 并附审计。
3. 存储命名空间、旧库只读读取器、兼容性路由、format2。
4. U7 界面。
5. 全部 B9 延期恢复、浏览器/性能/比较器，证据、预算、完整 CI、送审。

每步提交前跑受影响 vitest、typecheck、对应浏览器脚本；不扩大 skip，不改阈值。
