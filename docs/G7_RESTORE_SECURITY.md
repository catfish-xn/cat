# G7 初始赠礼恢复审计（2026-10-28）

基线：HEAD `97068956a7ff0b9c96aad92323f98bce82b006fb`；工作区起始干净，实际分支名为 `claude/sol-cat-cx-v25int3`。仅改工作区，不操作 Git 元数据。

## 复现与根因

原 `tests/server/augment-pool-batch5-g7-review.test.ts` 在基线为 **46 通过、23 失败**。首个失败是种子 19、s0 的 2-1 三选一不再含 Loot Explosion；选择未执行，后续的“孤儿赠礼”用例没有任何 Loot Explosion 赠礼可供伪造。此时只加 123 金币并不能证明这个特定的赠礼归属校验缺口。修复前，恢复真实赠礼前置条件后，原文件全部 **69/69** 通过；不能把原先“不抛错”直接归因于 `restoreSharedOrbSnapshot`。

G7（B5-69）的 Camille、Powder 初始赠礼沿用共享收据 ID：

```text
["augment-pool-batch1","round:2-1:augment","loot-explosion",specIndex,copyIndex]
```

初始赠礼的 `source` 是 `augment-pool-batch1`，而战斗击杀奖励使用 `augment-pool-batch5-g7`。所谓 orphan initial gift namespace，是保留前一种收据、却删除/替换了对应强化所有者（并删除 augmentHistory）。即使把收据 `source` 改成 `academy`，其 receiptId 命名空间仍必须验证归属。战斗奖励校验看不到这些初始赠礼，不能替代该验证。

独立补测发现 **`restoreCarouselSeat` 确实接受上述伪造状态**：真实房间在 2-1 选择 G7，保留两颗未领取赠礼法球，通过公共命令卖空军队，再进入 2-4 选秀；替换强化、删除历史、增加金币后，原实现恢复成功。该入口没有共享池恢复入口已有的 batch1 赠礼校验，也未复用按可信卡池赠礼收据要求独立服务端凭据的逻辑。

修复把原有 batch1 收据验证抽成内部函数，把已有的可信池赠礼命名空间识别迁入 `src/simulation/restore-checks/batch1-gifts-check.ts`，由 `validateOnlineBatch1GiftAuthority(pool,state,authority): void` 组合校验，两个联机席位恢复入口均调用。单人仍调用原 `validateBatch1Gifts`，验证语义不变。未改发奖、金币、随机数、战斗规则、版本或 digest。

## 恢复入口与调用点清单

| 入口或调用点 | 输入与处理 | G7 边界 |
| --- | --- | --- |
| `src/simulation/shared-pool.ts`：`restoreSharedOrbSnapshot(pool: SharedPoolState, input: unknown, authority?: AugmentHistoryAuthority): MatchState` | object 用 structuredClone；JSON 字符串和 canonicalContent 字符串用 JSON.parse；先检查版本、卡池守恒，再调用共用赠礼校验并继续现有恢复检查 | 三种形式均执行同一校验；可信池必须独立于候选存档 |
| `src/simulation/carousel.ts`：`restoreCarouselSeat(carousel: CarouselState, input: unknown, authority?: AugmentHistoryAuthority): MatchState` | object/JSON/canonical 字符串统一解析；验证 carousel、卡池和历史后调用共用赠礼校验，再验证选秀出生 | 同样拒绝孤儿命名空间；已领取/出售后，池中凭据仍要求独立 authority，即使候选删除了赠礼收据 |
| `src/simulation/carousel.ts`：`restoreCarousel(input: unknown): CarouselState` | 只恢复选秀及其池，调用 validateCarousel；不含 Match/强化/金币状态 | 恢复席位时仍须调用 restoreCarouselSeat；只恢复 carousel 不构成席位恢复，也不能认证不可信池 |
| `src/server-entry/index.ts`：第 47、71 行重导出 | 重导出上述函数，无另一套恢复实现 | 无旁路；本次共用校验是内部模块导出，不增加网络命令 |
| 客户端文件恢复：`src/persistence/format.ts` 的 validateFile → validateEnvelope → `src/persistence/compatibility.ts` 的 routeSaveFile → validateMatchStructure | 文件 JSON 与 envelope object 都进入相同结构校验；`src/m6/application.ts` 也经 routeSaveFile 准入 | `src/simulation/serialization-structure.ts` 在解析后直接拒绝 multiplayer/sharedPool/carousel 元数据，不接收联机席位 |
| `src/simulation/serialization.ts`：restoreMatch / serializeMatch；`src/replay/history.ts`：validateBattleCollectionSync；`src/simulation/battle-record-validation.ts`：context 恢复 | 全部调用 validateMatchStructure；单人 augment-history 的 proof.origin 恢复也走这里 | 同样拒绝联机元数据；在线测试中的 serialized 指 canonicalContent，而不是 serializeMatch |
| 联机断线恢复：`src/rendering/online/ws-client.ts` 的 reconnect/resume → `src/server/net/messages.ts` 的 ResumeMessage/parseClientMessage → `src/server/net/server.ts` 的 handleResume | 客户端仅存座位 token，上传 token、观战席位及播放游标；服务器使用 sessions.resume 和当前内存 room，重新发出投影 | 不上传或导入 Match；resume 白名单不允许存档字段，不经过也无需候选存档校验 |
| 浏览器 LocalRoomClient：`src/rendering/online/local-room-client.ts` | 创建/驱动内存 Lobby、Room，读取公共投影 | 没有房间存档导入入口 |
| 房间持久化/进程重启恢复 | 搜索 src 中所有上述恢复函数及 Room 构造、会话恢复；当前运行时代码只有新建房间和内存重连，没有整房间磁盘存档导入函数，两个席位恢复函数在 src 中只有定义与重导出 | 现有公开 API 供服务端持久化验证使用；未来接线须保留独立池与 authority，并逐席调用对应入口，不能把客户端候选本身作为权威 |

共用校验失败沿用现有异常，不新增协议枚举：

- 孤儿、来源被改写或数值不符的 batch1 赠礼：`RangeError('Invalid augment batch1 gift authority')`。
- 可信池有历史依赖赠礼证据但没有有效服务端 handle：`Invalid augment history: missing independent server authority`。
- 有独立 handle、候选状态被修改：`Invalid augment history: server facts/state mismatch`。

## 验证范围

原 review 文件仅修正测试前置条件：在 0..100 范围内选种子 65、s3（无不可出售的开局魔像，原抽卡保留 Crownguard Spirit），使用既有 installB1Offers 只脚本化 Loot Explosion 三选一抽取。保留所有原断言；注释说明 toContain(ID) 是夹具自检。候选资格、RNG 推进、公共命令、恢复时三选一历史验证均保留。

新增 `tests/server/augment-pool-batch5-g7-carousel-restore.test.ts`：分回合测试真实房间，沿用默认超时；覆盖选秀及席位 object/JSON/canonical 三种输入、合法恢复、赠礼未领取、领取后出售、source 改写、历史/强化/收据联合擦除、无凭据与合法独立凭据两种失败方式，并确认失败不修改房间、席位或池引用。修复前在轮盘入口明确复现“不抛错”；未改超时、预算、断言门槛或录制夹具。

最终验证（Vitest 均使用 `npm test -- --configLoader runner --maxWorkers=3`）：

| 批次 | 测试文件 | 结果 |
| --- | --- | --- |
| 目标文件 | `tests/server/augment-pool-batch5-g7-review.test.ts` | 69/69，通过；最后一次包含新增的真实赠礼前置断言 |
| G7 及 grep 关联测试 | `augment-pool-batch5-g7`、`server/augment-pool-batch5-g7-room`、`m5-oracle-loot-explosion`、`augment-pool-batch2`、`augment-pool-source`、`g2-augments-static`、`m5-content`、`m5-oracle-augment-ledger`（均为 tests 下的 .test.ts） | 8 文件，376/376，通过 |
| 新增选秀安全回归及通用恢复回归 | `server/augment-pool-batch5-g7-carousel-restore`、`loot-orb-claim`、`augment-history`、`p7-1-carousel-rules`、`p7-carousel`、`tp-shared-pool`、`m5-serialization` | 7 文件，198/198，通过；新增选秀文件为 22 个用例 |
| 类型检查 | `npm run typecheck`（tsc --noEmit） | 通过 |
| 差异检查 | `git diff --check` | 通过 |

共 16 个测试文件、643 个用例通过；没有保留的种子漂移失败。未跑全仓库或浏览器验收。本次修改的 src 文件仅 `src/simulation/shared-pool.ts`、`src/simulation/carousel.ts`、`src/simulation/restore-checks/batch1-gifts-check.ts`。无规则/数值、src/server、超时/预算、版本/digest、docs/evidence 或录制夹具修改；改动留工作区交执行端提交。
