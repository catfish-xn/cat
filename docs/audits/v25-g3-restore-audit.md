# G3 联机恢复审计（97068956）

## 两项原始失败

- `batch5-g3-mutation-room.test.ts` 原失败在 `proposeSettlement(forged)`，不是存档礼物恢复。seed 42 / s2 的 donor 是 Urgot，确有牺牲与实验室捐赠；终态 `g23Experiment.values.zyra` 确从 0 改成 1，已排除种子漂移造成未篡改。问题是 `structuredClone(battle)` 保留内部别名：初始态、策略及终态共享 mechanic/values，原构造也改了可信重演基准。改为 JSON 往返后只篡改终态，断言初始态未变化，对象、普通 JSON 往返及规范文本往返都拒绝，原因 `invalid-result`。`proposeSettlement` 的合同仍是可信规则输出及可信 tick-zero 基准，不新增从任意初始态认证整场作者身份的能力。
- `batch5-g3-aerial-room.test.ts` 的自然扫描仍限定 0..100，目前命中 seed 21 / s0。选择强化前已有 `unit-2` Scar；礼物另给 `unit-4` Scar、`unit-5` Zeri。原测试按 definitionId 找到旧 Scar，礼物 Scar 又已自动上场，因此合法上场两只 Scar。现在核对旧 Scar 的 PvE loot receipt，按新增 unitId 选礼物，把旧单位正常部署回备战席；保留上场列表恰为 `['scar','zeri']`、两次领取不增礼物收据及恢复后不重发断言。

## 实际漏检与最小修复

`restoreSharedOrbSnapshot` 已执行 `validateBatch1Gifts`。但 `restoreCarouselSeat` 只检查选秀账本、相关历史和个别强化，漏查通用强化礼物身份。

新增真实房间回归走到 2-4 选秀，将 G3 礼物的 spec index 改为 99，并同步改名礼物、法球、掉落、领取收据身份。伪造态仍通过 `validateMultiplayerOrbLedger` 和共享池守恒，共享恢复拒绝，修复前选秀恢复接受。这是礼物身份校验缺失，非 RNG 漂移。

将已有校验的礼物收据部分提取成 `validateBatch1GiftReceipts(state: MatchState): void`，位于 `src/simulation/restore-checks/batch1-gifts-check.ts`，继续由 `validateBatch1Gifts` 调用，并在选秀恢复调用。输入是候选 Match，成功无返回值；非法礼物身份、来源、内容、星级、轮号或折金抛出 `RangeError('Invalid augment batch1 gift authority')`。收据按 source 或 namespace 识别，删除强化所有者不能跳过校验；英雄可因容量待发，仍保留既有语义。没有改变礼物计划、数值、RNG、发放顺序或实时命令。

新增回归使用 seed 21、`withB1Offers` 只脚本化三选一；包装内 `toContain('aerial-warfare')` 是夹具自检，不是自然随机命中证明。候选资格、命令、战斗、法球与选秀仍走真实流程。逐回合测试沿用默认超时，未提高超时或推进预算。

## 恢复入口清单

| 入口 | 输入与边界 |
| --- | --- |
| 在线客户端重连：`parseClientMessage` → `handleResume` | `src/server/net/messages.ts` / `server.ts`；只接收 token、观战席位和战斗游标，按白名单拒绝额外字段。复用服务器内存中的房间，再投影给客户端，不接受客户端 Match/房间存档。 |
| 客户端文件导入/继续：`MatchApplication.import` / `continueSaved` | `src/m6/application.ts` → `validateFile` / `validateEnvelope` → `routeSaveFile` / `validateMatchStructure` → 完整战斗历史认证。文件先 JSON.parse，封套对象直接校验；属于单机入口。 |
| `restoreMatch` / `serializeMatch`、底层 `validateMatchStructure` | 对象及 JSON Match 恢复，序列化前也校验；携带 multiplayer、sharedPool 或 carousel 的联机候选统一以 `multiplayer-state` 拒绝，不能用作在线恢复旁路。 |
| `restoreSharedOrbSnapshot(pool, input, authority?)` | `src/simulation/shared-pool.ts`；对象先 structuredClone，普通 JSON / `canonicalContent` 文本先 JSON.parse，汇合到相同校验。检查独立池、orb ledger、礼物和历史；历史型强化需要独立服务器 authority。 |
| `restoreCarouselSeat(carousel, input, authority?)` | `src/simulation/carousel.ts`；对象经 JSON 往返、字符串经 JSON.parse，普通 JSON / 规范文本同链；检查选秀、共享池、历史及新增礼物收据校验。三种格式均有本次有效/伪造往返回归。 |
| `restoreCarousel(input)` | 同文件；对象/普通 JSON/规范文本经 JSON 往返，`validateCarousel` 认证选秀局部状态（含其池）；不包含 Match，不能替代席位恢复。 |
| `restorePlayerBattleSnapshot` / `restorePlayerBattleSnapshotSteps` | `src/simulation/two-sided-snapshot.ts`；对象或 JSON 结构与内容校验，生成战斗输入用。是服务器描述符格式，不是客户端身份或资产历史认证。 |
| `restoreBattleInput` / `restoreBattleInputSteps` | `src/simulation/two-sided-battle.ts`；对象或 JSON 重新编译两侧快照并比对派生字段。`proposeSettlement` 对外部结果对象从可信 initial 重演；其参数不是 JSON 字符串，文本必须先解码。 |
| 完整 Room 存档 | `Room` 没有整桌存档反序列化、静态 restore 或重启导入接口；`Room.state` 是内存快照，`Room.augmentHistoryAuthority` 是私有事实的独立品牌句柄。两个在线席位恢复函数通过 `src/server-entry/index.ts` 导出；没有新增房间重启协议。 |

本次没有修改 `src/server/`、单机规则、内容版本或录制夹具。

## 验证

- 原始两文件复现：23 项中 2 项失败，分别为原 Mutation 终态伪造构造及 Aerial 上场多 Scar。
- 独立选秀回归先红：共享恢复拒绝完整改名的伪造礼物，但选秀恢复未抛错；补入礼物收据校验后通过。
- 最终 `npx vitest run --project fast --configLoader runner --maxWorkers=3 tests/server/batch5-g3 tests/m5-serialization.test.ts`：4 文件、66 项通过（含全部 3 个 `tests/server/*batch5-g3*` 文件，32 项；单机序列化冒烟 34 项）。
- `tests/server/carousel-room.test.ts` 的 20 项在扩展运行中通过。
- `npm run typecheck`（`tsc --noEmit`）通过；`git diff --check` 通过。
- 额外检查的 `tests/server/augment-pool-batch5-r4-room.test.ts:58` 首项固定 `{seed:46,seatId:'s2'}`，实际自然扫描为 seed 8，导致后续级联失败；将本次两个 src 文件临时恢复为 HEAD 原文后，单独运行同一首项仍失败。源文件已恢复本次修复，R4 测试未改，作为范围外已有种子漂移报告。
