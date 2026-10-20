# 强化按卡刷新交付与 v15 收口清单

基线：`codex/augment-card-reroll`，HEAD `a0d42c592cbd48fb075175e5f61818dabfe1b320`。本轮改动仅留工作区；没有安装依赖、联网、提交、升版本、修改 digest 或重录指纹。

## 行为改动

| 项目 | 改动前（实际 v14 规则） | 本轮规则 |
| --- | --- | --- |
| 刷新对象 | 整组三张 | optionIndex 指定的一张，其余两张原位保留 |
| 次数 | 每节点整组共 1 次 | 每槽每节点各 1 次；换出的新卡不能再刷 |
| 排除 | 当前一代三张与已拥有 | 当前三张、已拥有、本玩家本局全部已刷掉 ID |
| 后续节点 | 被刷掉的 ID 可再出现 | 永久排除，即使后续节点同级 |
| 随机消耗 | 成功刷新三字 | 成功刷新一字；初次发三张仍三字 |
| 候选不足 | 少于三项拒绝 | 一项也能成功，零项原子拒绝 |
| 读档依据 | 节点 rerollCount | 有序 rerolledIndices 重演，核对槽位状态及永久移出集合 |

用户提到 3-1/4-1 是永久排除的例子；实际日程仍为 **2-1、3-2、4-2**。每卡一次为本轮任务采用的解释，旧代码和合同只有整组共一次，没有另一个既有按卡计次依据。永久指本局该玩家，跨新局重置；其他玩家仍可抽到该 ID。

## 命令、投影与随机顺序

```ts
rerollAugment(state: MatchState, choiceId: string, generation: number, optionIndex?: number): MatchCommandResult
// 有效调用必须提供 optionIndex=0|1|2；省略仅为旧禁改接线可编译，会明确失败。
runSharedMatchCommand(pool, state, {
  type: 'rerollAugment', choiceId: 'round:2-1:augment', generation: 0, optionIndex: 1
})
```

服务器命令消息为 `{type:'rerollAugment',choiceId:string,generation:number,optionIndex:number}`，外层身份/round/seatRevision/commandId 沿用现协议。Claude 需补类型、解码白名单与下标校验，并改为共享事务原子提交 pool+state。本轮没有修改 `src/server/` 或界面目录。

校验失败优先级：`wrong-phase` → `stale-choice` → `invalid-slot` → `augment-rerolls-exhausted` → `augment-pool-too-small`。最后一项现表示零个合法同级候选。失败保持原 state 引用且无 events、资源或任意 RNG 变化；共享包装还保持原 pool 引用，并继承 pool/seat 校验失败。

新权威字段：`MatchState.removedAugmentIds`（有序唯一 ID 集合）、`augmentOffers[].rerolledIndices`（按成功提交顺序）、`PendingChoice.rerolledSlots`（三个布尔值）。累计 `rerollCount/generation` 每次成功 +1；`rerollsRemaining=3-rerollCount` 只表示未用槽位数。现有 `augmentRerollLimit` 保留签名但表示每槽上限 1，未注册 ExtraRolls 不生效。

私有投影新增 `pendingChoice.augmentOptions[] = {optionIndex,definitionId,rerollAvailable}`，并复制 rerolledSlots。按钮读取每卡 rerollAvailable；候选耗尽也为 false。初始全部未用，每次只禁用目标槽，但所有按钮下一次请求都必须使用最新 generation。移出账本/种子/历史不下发。共享成功仅推进既有 pool/seat revision，英雄库存、预留和 holdings 不变。basic bot 和超时代选仍选首项，不主动刷新；preflight 已转交下标。

随机顺序固定：等级沿用独立种子派生，不推进席位 RNG；初始候选按 ID 排序、部分 Fisher–Yates，依次消费 choice 流三字；刷新先完成全部校验与过滤，再将候选排序、消费一字，以 `word % candidates.length` 取一张，之后记录旧卡移出及槽位历史。不同槽位按实际命令顺序消费，历史不能排序。失败零字；其他随机流不变。完整字段和失败含义见 [Match 合同](MATCH_CONTRACT.md)、[联机合同](MULTIPLAYER_CONTRACT.md) 与 [接线需求](UI_REQUESTS.md)。

单机严格 serialize/restore 已覆盖：从种子重演，不能篡改下标顺序、计次、候选、移出集合或 RNG。联机本来不支持用户导入完整 Match，本轮不新增服务器磁盘恢复；共享 JSON pool/state 往返及后续命令已测。服务器持久化/重连必须保留新增权威字段，不能从私有投影重建。

## 统一 v15 时需更新的版本点（本轮未做）

| 位置 | 后续收口内容 |
| --- | --- |
| `src/simulation/m8/version.ts` 的 M8_VERSION | rulesVersion `s13-g2-3-v14` → `s13-g2-3-v15`，contentVersion `s13-14.24b-g2-3-v14` → `s13-14.24b-g2-3-v15` |
| `src/simulation/m8/contracts.ts` 的 M8Version | 同步上述字面量，以及最终采用的命令协议身份 |
| `src/simulation/content/augment-policy.ts` 的 AUGMENT_OFFER_POLICY | version 改为明确的按卡策略版本（建议 `augment-card-reroll-v15`）；更新旧 whole-offer 的 reroll 文案、words 元数据（分别初次三字/刷新一字）、每槽一次及永久排除声明；不改 tiers/权重/强化数值 |
| `src/simulation/content/index.ts` | 继续由 manifest 自然计算 CONTENT_DIGEST，不手填；它已包含 offer policy 和 M8 版本，最终统一身份后再重算相关 LOOT_REPLAY_DIGEST |
| 破坏式命令协议点（Claude 接线） | 本轮仍 NET3 / command3；必填 optionIndex 与旧消息不兼容，建议统一发布时将 `src/server/net/messages.ts` 的 NET_PROTOCOL_VERSION 和 M8 的 commandProtocolVersion 升到 4，并同步字面量、客户端与验证；ROOM1 没有本轮结构变化，不需单独升 |
| 序列化外壳 | schema7/save3/replay3 可沿用；本轮新增字段由新 rules/content 身份严格分流，无旧档迁移。若法球/#231 另改外壳，由统一收口处理 |
| 录制脚本与版本断言 | `scripts/record-g2-4b-release.cjs` 的 v14 guard/reason、身份测试及当前发布文档同步 v15；保留历史版本与历史证据原文 |

当前仍使用 v14 版本和 digest，但新规则要求新增存档字段，旧 v14 录制不能当本轮规则的恢复证据；这是按任务要求保留的发布前状态，不能直接当兼容发布。

## 需要重录/复核的指纹（本轮未做）

以下为当前发布线文件，后续可继续沿用 g2-4b 路径或在统一收口时建立 v15 路径；历史 g2-3/opening-random 等文件保持原字节。

| 指纹/证据 | 原因与对应生成器 |
| --- | --- |
| `tests/g2-4b-content-baseline.json` | 新 rules/content/digest、traceHashes.state/events/rng、firstBattle 哈希；新增状态字段即使不刷新也改变整局 state trace。使用最终统一身份重跑 `scripts/record-g2-4b-release.cjs`，不能直接替换字符串 |
| `tests/fixtures/m5/full-match-golden.g2-4b.json` | cannon/sniper/mage/sniper-caitlyn 的整局状态/事件哈希与命令轨迹；同上生成器真实运行 |
| `tests/fixtures/g2-4b-recorded-states/{cannon,sniper}.json.gz` | 各 67 个 checkpoint 包含新字段；同上生成器，逐个严格文本/对象恢复验证 |
| `docs/evidence/g2-4b/release-audit.json` | sourceDigests、oracleSha256、driverSha256、golden 与录制字节哈希都需重算；同上生成器 |
| `tests/fixtures/g2-4b-herald-raw/{ionic-spark,evenshroud,ionic-spark--evenshroud,quicksilver,edge-of-night}.json`、`trajectory.json`、`manifest.json` | 当前身份与相关轨迹/输入哈希；`tests/fixtures/record-g2-4b-herald.cjs`；本次也修改了其 sourceDigests 覆盖的规则/oracle 源 |
| `tests/fixtures/g2-4b-b8-fingerprints.json` | 0/1/9 单位的完整 battle/replay 字节哈希包含最终内容身份，需重跑而不是手改；`scripts/record-g2-4b-inputs.cjs` |
| `tests/fixtures/g2-4b-c19-seed-9-minimal.json`、`docs/evidence/g2-4b/input-fixture-audit.json` | 最终 digest 的独立输入重编译、battle/event/pulse 哈希与输入字节证据；同上 inputs 生成器；仅刷新规则不应改变其战斗数值依据 |
| `docs/evidence/g2-4b/live-reveal-audit.json` | prefix/terminal/event 哈希和 sourceDigests；`scripts/record-g2-4b-live-reveal.cjs` |

不预设所有数值指纹都必然改变：例如 choice RNG 在未刷新轨迹可能保持、战斗数值可能保持。最终发布仍应以同一独立输入真实复算并记录未变证据。新增按卡行为本轮由合成样本与独立 BigInt oracle 验证，没有新增需立即录制的 golden。

## 本轮验证

`npx.cmd tsc --noEmit` 通过。测试按文件逐个运行，均使用 `npx.cmd --no-install vitest run --project fast <file> --configLoader runner`，没有运行全套或录制器，新测试未设单条时限。

| 测试文件 | 结果 |
| --- | --- |
| `tests/augment-card-reroll.test.ts` | 12/12 |
| `tests/augment-tier-consistency.test.ts` | 7/7 |
| `tests/g2-augments-choice.test.ts` | 69/69 |
| `tests/t5r-private-seat-view.test.ts` | 15/15 |
| `tests/t7-bot-policy.test.ts` | 24/24 |
| `tests/m5-serialization.test.ts` | 33/33 |
| `tests/tp-rewards-and-rounds.test.ts` | 9/9 |
| `tests/t7-integration.test.ts` | 4/4 |

共 8 文件、173 项。按卡样本覆盖单张/锁级、不同刷新顺序、每槽一次、三个连续银色节点的九次永久移出、严格读档和恢复后继续刷新、候选仅一项/零项、失败原引用与无随机消费、共享事务隔离及 JSON 恢复、私有字段不泄露。跨三个节点的长期池样本为隔离候选规则而每战前将 HP 设为 100，不用该合成轨迹声称存档历史有效；严格读档用未修改的公开状态验证。

建议提交信息：`feat(simulation): reroll augment cards individually and permanently exclude discarded augments`
