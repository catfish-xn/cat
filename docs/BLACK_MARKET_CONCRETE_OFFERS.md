# 黑市开市确定装备（2026-10-23）

- 用户 10-23 批准原话：“改”。基线 `c2179b9e`，与本地 `origin/codex/v22-candidate` 一致；分支 `codex/black-market-concrete-offers`。
- 仅调整黑市装备确定时点及相应测试/合同，不联网、不改界面/服务器/CI、不提交。epoch、版本/digest 常量及历史 golden **待 v22 统一录制**。

## 行为与随机

`advanceG23Economy` 保持 `rollG23BlackMarket(tier,rngState)` 原表、原顺序、原一次加权抽包；随后沿用 `g23RewardAtoms` 的既有奖励派生流确定直接发放的所有装备，记录 `offer.concreteItems`。`decideG23Market` 将其原样写入领取包；装备 atom 读取该字段，不调用采样器。没有新增子流；既有 `sampleG24Reward` 仍以 `seed:offerId:atom:index` 哈希初始化 lcg32-v1，装备结果与旧领取时抽取相同。市场及后续王冠各自消耗词数、顺序完全不变。

源奖励 descriptor 保留，金币、弈子、工具、复制器目标及锻造器选择不改；固定装备也列入具体装备。无装备包使用 `[]`，保留/超时仍不发整包、保留微光并累计跳过成长。领取按原 atom/copy 唯一收据发奖，重复命令不发奖。

`replayG23Economy` 按种子和经济收据重建开市结果；既有 `validateG23Progress/validateG23RewardSources/validateG23Restoration` 严格比较完整 offer 和奖励包，因此保存、JSON 恢复、战斗输入与领域回放均认证具体装备。删除、重复、换 definitionId（包括同池合法替代）、改 atomId、改序或替换已领包均拒绝。直接源奖励预览仍可不带 `concreteItems`；持久化的真实黑市包缺字段不能通过经济重建校验。无旧存档迁移。

## 界面交接

本人私有投影路径：`privateSeatView.seatMechanics.seat.alchemist.offer.concreteItems`；`offer === null` 表示无待领报价。元素类型：`{atomId:string, definitionId:string}`。仅形状示例：

```json
[{"atomId":"g23:market:round-12:1:atom:0","definitionId":"TFT13_Crime_Bronze_MageGuard"}]
```

按 definitionId 查现有装备名字和图标；atomId 标识包内位置，保留重复装备的不同条目。领取包同样携带 `seatMechanics.seat.conqueror.rewards[*].concreteItems`。投影沿用既有 owner-only 容器，不含 seed 或 RNG。`pendingChoice.offers`、`offer.optionId/optionIds` 仍为包 ID；拿走/保留调用原 `choose`/`@skip`，不得提交装备 definitionId 代替包 ID。服务器和界面无需新增规则；本单未改界面展示实现。

内部类型 `G23ConcreteItem`、`G23MarketOffer`、`G23RewardBundle` 位于 `g2-3-economy.ts`，无新增公共命令、签名或失败枚举。新增内部 atom 结构错误为 `RangeError('Invalid G23 concrete equipment')`；恢复继续沿用 G23 authority/progression 拒绝边界。

## 验收

- `npm run typecheck`：通过（末次改动后复验）。`git diff --check`：通过。
- Vitest 均经 `npm test -- --configLoader runner --no-file-parallelism <files>` 离线运行；runner 避免共享 node_modules 的只读配置缓存，不改配置或超时。
- 黑市相关 8 文件 / 110 项通过：`black-market-concrete-offers`、`black-market-single-offer`、`chem-baron-fix`、`g2-3-lesser-shimmer-duplicator`、`g2-3-hook-failures`、`g2-3-integration`、`g2-4a-crown-gold`、`mp-overtime-choices`。主批次通过后，对新增的多装备改序拒绝及联机投影断言复跑前两份黑市测试和 overtime 文件，3 文件 / 7 项全过。
- 新增 80,000 次真实 `advanceG23Economy` 开市（8 档各 10,000 个分层种子）：每个结果对照独立旧抽包 oracle，频数逐包严格等于源 weightBps（包括 1% 包），无容差；市场后两次王冠游标逐次核对。每个源包的具体装备另由保留的原始 map22 奖池、原始 descriptor 顺序及独立 BigInt 哈希/LCG oracle 核对。旧深比较补上新字段，未删断言或放宽比较。
- 覆盖自然公开命令开市、拿走同批且一次到账、保留/超时、对象/JSON存档恢复、经济回放、同池换装/缺字段/重复/改 atomId/多件改序篡改拒绝，以及冷缓存领取装备不调用 RNG。相关旧有下一战恢复与帧回放用例继续运行。
- 额外 9 文件 / 353 项：82 通过、271 失败；全过的 6 文件为 `g2-3-content`、`g2-3-traits`、`g2-4b-reward-order`、`g2-4b-replay`、`match-contract`、`m8-contracts`。另跑 `restore-audit/g23-reward-allocation`：4 通过、7 失败。下列失败保留原断言与夹具。

| 未通过检查 | 数量与原因 |
| --- | --- |
| `content-identity-constants.test.ts` | 2：完整 CONTENT / LOOT_REPLAY 摘要常量未统一更新 |
| `m8-content-equivalence.test.ts` | 134：cannon/sniper 各 67 个历史状态恢复报 `unsupported-version` |
| `opening-random-identity.test.ts` | 135：cannon/sniper 各 67 个旧 checkpoint 恢复失败；另 1 项首战 terminal/event hash golden 不符（342→164 tick，旧记录待重录） |
| `node scripts/update-content-identities.cjs --check` | 失败：常量仍为 `35273c97/ef359464`，本分支离线重算为 `93eb56b8/07977a50`（均前缀 `fnv1a32-utf16:`）；本单不写回 |
| `restore-audit/g23-reward-allocation.test.ts` | 7：3 项伪造英雄数量和 tier/source 两项先报 `opening-context-mismatch`；id/round 两项在奖励 authority 拒绝前已经调用 atom 预览，违反该测试的前置认证断言 |

为区分回归，在 `/tmp` 用 `git archive c2179b9e` 建立只读基线副本（未改工作区/其他分支），原样跑上述 3 份身份测试及奖励分配审计：同样 **271 + 7** 项失败，失败案例集合一致。7 项恢复审计是现有 Batch A 候选的独立问题，本单未越界修改开局奇遇认证。摘要变化及历史 golden 的新录制、这 7 项既有审计问题仍需 v22 集成处理；不应将候选直接作为发布身份。
