# T12：恢复边界待确认（未交付）

施工基线为 `origin/multiplayer@25dae94eb58108909a7b2cdc1d68ab0ee36d7561`，分支 `codex/t12-combat-equip`，目标分支 `multiplayer`。

本草稿仅提交基线诊断及范围选项，不是 R2 实现。R2 的四阶段权限、单位身上原子合成和冻结边界继续以 [S13_RULES_GAP §2.2–2.4](../../S13_RULES_GAP.md#22-拟替换-151-的装备子矩阵) 为规格；不重新设计，也不将 R2 标记已交付。用户任务明确要求：“遇到规格冲突……停下来在 PR 里写明选项，不要自行缩小范围。”本次按该条件暂停玩法实施。

## 已复现的合同边界

任务要求单人/联机 × PvE/PvP 四条路径在各阶段装备后保存、恢复、续算，且通过来源校验。基线尚没有联机最新席位与共享池的存档恢复入口：

- [MULTIPLAYER_CONTRACT §12.5](../../MULTIPLAYER_CONTRACT.md#125-失败原因恢复与投影) 明文规定：旧单人 `restoreMatch` 拒绝 `sharedPool`，不得剥离绑定绕过验证，不提供跨进程多人存档恢复器。§15.3 同样保留单人恢复拒绝 multiplayer 的边界。
- `src/simulation/serialization.ts::restoreMatch` 在任何阶段/资产校验前拒绝存在 `multiplayer` 或 `sharedPool` 的状态；`serializeMatch` 也先调用这一校验。无需执行装备命令即可复现 `Invalid Match save: multiplayer-state`。
- §10.1 的 `restorePlayerBattleSnapshot` / `restoreBattleInput` 仅恢复冻结战斗描述；不包含库存、最新 live seat、共享池及整局来源账本。恢复并重算该输入不能证明最新运营装备和唯一结算被保存并合法恢复。
- §12.1 明确共享池接口接收服务器可信状态；`assertSharedPoolConservation` 不是不可信存档认证器。直接 `JSON.parse` 后调用它不等于新增了完整恢复校验。
- §6 的进程重启续局是后续增强。即便本次只实现纯规则恢复函数、不接服务器磁盘保存，也需要明确一个新的联机状态输入/输出与校验合同，不能删除离线入口的拒绝条件冒充完成。

诊断文件为 `tests/t12-recovery-boundary.test.ts`，全部使用公共命令取得状态，不注入装备、资源或伪造收据。5 条诊断通过：两个单人 PvE/PvP 保存恢复及下一 tick 对照、两个联机准备/冻结后恢复拒绝、一个共享池守恒合法但恢复拒绝。**这些是基线现象断言，不是 T12 装备验收通过。**

单人恢复也不止修改 resource suffix：`b8-restore.ts::validateB8Resources` 当前把运行中资源前缀和装备 roll 前缀取为最新长度，并要求全部 strategy inputs 等于冻结输入；`replayCurrentSuffix` 则按旧奖励/出售序列比对完整物品位置。实施时必须针对装备合法变化改为历史身份与最终合法布局校验，仍保留非装备输入、配方、来源、奖励顺序及成长校验。此项属于 R2 已签范围，本稿没有据此缩小单人工作。

## 需明确的选项

| 选项 | 完成定义与影响 |
| --- | --- |
| A（推荐）：保留完整四路径恢复验收 | T12 增加独立的纯规则联机权威状态恢复入口及合同；输入要涵盖 latest seats、共享池绑定/来源、冻结 PvE/PvP 输入与当前进度、唯一结算身份。保留离线 restoreMatch 拒绝联机。验证合法战中运营、延迟升星、共享池奖励/补偿与 PvP 成长收据；完整验证后才允许续算。须明确覆盖目录内与既有加时，不能用不完整历史重贴身份。仍不改服务器目录，不自动增加进程重启续局产品功能。 |
| B：明确调整本次联机“恢复”的定义 | 联机只验冻结战斗输入恢复/确定性重算，并在未中断的可信 latest live seat 上继续、结算；单人继续做完整存档恢复。**此项不满足原任务四路径完整来源恢复要求，必须用户明确修改验收，不能由执行者默认采用。** |

推荐 A，因为它保留原任务要求。未选择前，不把仅恢复冻结输入写成联机保存恢复通过，不合并或上线本草稿。选项只涉及恢复合同和交付边界，不改变 R2 装备玩法设计。

## 身份与 golden

| 身份 | 基线 | 本草稿 |
| --- | --- | --- |
| 装备操作细分版本 | 未新增 | 未新增 |
| MULTIPLAYER_OPERATION_RULES.version | multiplayer-combat-ops-v1 | 不变 |
| EQUIPMENT_RULES_VERSION | m8-b5-instances-v2 | 不变 |
| CONTENT_DIGEST | fnv1a32-utf16:b4a5c2e2 | 不变 |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:7b14bfba | 不变 |

外层 schema6 / rules `m8-14.24b-v1` / content `s13-14.24b-m8-v1` / save2 / replay2 / commandProtocol2 / NET_PROTOCOL_VERSION=1 不变。没有 golden 改动，也没有新增规则数值；独立规则依据仍是已签 R2 项目方案，非 TFT 实时装备行为还原。

## 本草稿验证

- `npm run typecheck`：通过。诊断初稿的两个类型/参数错误已修正后重跑。
- `npm test -- tests/t12-recovery-boundary.test.ts`：1 文件、5 条通过。
- `npm run test:server-entry`：通过；沙箱内首次因 Node 子进程 `EPERM` 未完成，获准沙箱外重跑通过。保留 T11 身份，Node 与 browser-target bundle 的全部首战状态/事件/RNG 逐字节一致；这不是实际浏览器试玩。
- `npm test -- tests/m8-b5- tests/t10- tests/t11- tests/t12-recovery-boundary.test.ts --maxWorkers=2`：12 文件中 10 通过、2 失败；137 条中 128 通过、9 失败。8 条 B5 equipment-history 在旧 `level=4` 断言得到 5；1 条 B5 temporary 得到 `[6,34,4]` 而旧断言为 `[6,32,4]`。生产代码保持基线，未修改断言或 golden 使其变绿。
- `npm test -- --maxWorkers=2`（含 tests/server）：**未完成，不是通过**。沙箱内首次运行出现服务器网络/子进程限制后中止；沙箱外以 `timeout 300s` 重跑，限时内未取得全套汇总，已观察到 match-session、B5 temporary、B8 loot-view、match-lifecycle 的断言失败，以及 B8 live-growth/transfer/capacity 的 skipped/未收集状态。不把未完成套件或未汇总的 server 用例记为通过。

后续正式 T12 仍需新增 `tests/t12-combat-equip.test.ts` 及完整矩阵、失败原子性、冻结逐 tick/PvP 双方、战后迁移、四路径来源恢复、旧 digest 拒绝和 T1 身份归一化证据。当前诊断不能替代这些测试。

## Claude 接线状态

本草稿没有新签名、投影字段或客户端接线交付。待规则实施后，按任务要求在 UI_REQUESTS 登记：room 的 battle/awaiting-settlement/settlement 已放行 equip/combine，服务器不改闸门；UI 改读 previewEquip 的真实目标结果，并调整 strategy-panel.ts 两处装备锁定文案及拖放判断。不规定布局或视觉。
