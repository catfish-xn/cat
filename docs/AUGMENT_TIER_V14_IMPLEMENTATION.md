# 强化同级与默认刷新：v14 实现交接

基线：`043773eff1a1315c7ba24919f27ca1044c898354`，分支 `codex/augment-tier-consistency`。改动只在工作区；未执行 add/commit/checkout、未安装依赖、未改界面文件。**规则实现已完成；发布收口未完成。**

## 规则与实现位置

来源为用户 2026-10-19 08:15 约定，不声称复原 14.24b 的全员同级或刷新锁级规则。等级表只有等级身份，没有概率/权重；按指定默认等权处理，并标注“项目约定、待用户确认”。

| 功能 | 位置 | 具体行为 |
| --- | --- | --- |
| 等级派生 | `src/simulation/augment-offers.ts:18` | 对节点 ID 做 UTF-16 FNV-1a32；以 `seed xor 0x61756774 xor hash` 为独立 LCG 输入，首词 `%3` 对应 silver/gold/prismatic |
| 房间共享种子 | `src/simulation/shared-pool.ts:89` | 席位初始化时绑定 `augmentTierSeed=pool.seed`，即房间种子；各席的选择流独立保留 |
| 同级发放 | `src/simulation/match.ts:137` | 按节点等级过滤，排除已持有 ID，再按原排序抽三个，仍只消耗三个选择流词 |
| 额度扩展 | `src/simulation/augment-offers.ts:27` | 默认 1，加此前已持有定义效果 `mechanic:'augmentRerolls',values:{extraRolls:n}`，仅影响其余节点 |
| 整组刷新 | `src/simulation/match.ts:516` | `rerollAugment(state,choiceId,generation)` 免费整组三项重抽、锁级，排除当前与已持有；不足三项原子拒绝 |
| 读档重推 | `src/simulation/augment-offers.ts:40`、`serialization-structure.ts:217` | 从种子重放节点历史、每次刷新及选择；核对等级、候选、额度、代次、记录；异常抽取前核对 choice RNG |
| 私有视图 | `src/simulation/private-seat-view.ts:98` | 增加 `augmentTier`、`rerollsRemaining`，不暴露种子或未来等级 |
| 协议与门控 | `src/server/protocol.ts:201`、`net/messages.ts:203`、`room/room.ts:112,150` | 新增 `rerollAugment`；只校验字段、门控和转发，服务器不计算规则 |
| 内容来源标记 | `src/simulation/content/augment-policy.ts:4` | 用户约定、等权待确认、免费次数、派生常量和整组刷新语义进入 manifest |

`augmentOffers` 保留 `{choiceId,tier,rerollCount}`，选择后不删除。`rerollCount` 仍为已用次数，`generation` 从 0 开始，每次刷新加一；`rerollsRemaining=额度-已用`。下一节点额度重置，不积存。仅排除当前代候选，未来额外刷新可隔代重现。失败顺序：`wrong-phase` → `stale-choice` → `augment-rerolls-exhausted` → `augment-pool-too-small`；原 state 引用、无 events、无 RNG/资源变化。

当前所有强化节点先于异常。异常目标售出后 binding 会消失，重推仍依据保留的异常收据识别已经消耗的选择流。完整联机 Match 存档仍不支持。

## 原始刷新证据

- `src/simulation/content/source/s13-14.24b/raw/map22.bin.json.gz` 的 `Maps/Shipping/Map22/Sets/TFTSet13.ScriptData.NumAugmentRerollsPerPlayer.mValue` 为 1。
- `en_us.json.gz` 的 `TFT_Augment_BeggarsCanBeChoosers` 为其余强化提供增加刷新，`ExtraRolls=3`、`Gold=7`。该强化未注册，本次只提供额度扩展接口，不新增内容或金币效果。
- **未找到 S13 per-slot 刷新的原版证明。** raw 中其他赛季存在 `NumRerollsPerAugmentSlot`，不能用作 S13 证据。本次明确采用整组刷新。

## 改动文件清单

| 类别 | 文件 |
| --- | --- |
| 规则、状态、读档 | 新增 `src/simulation/augment-offers.ts`；修改 `src/simulation/match.ts`、`match-types.ts`、`strategy-types.ts`、`shared-pool.ts`、`serialization-structure.ts`、`private-seat-view.ts` |
| 内容与版本 | `src/simulation/content/augment-policy.ts`、`content/g2-3-policy.ts`、`m8/contracts.ts`、`m8/version.ts` |
| 公开导出、转发、穷尽分支 | `src/server-entry/index.ts`、`src/server/protocol.ts`、`src/server/net/messages.ts`、`src/server/room/room.ts`、`src/simulation/bot/preflight.ts`、`tests/t7-helpers.ts` |
| 新测试 | `tests/augment-tier-consistency.test.ts`、`tests/server/augment-tier-consistency.test.ts` |
| 种子路线 | `tests/s13-augments-p2-choice.test.ts`、`tests/m8-b8-live-economy.test.ts` |
| 升版断言、录制目标 | `tests/g2-4b-artifacts.test.ts`、`tests/m8-contracts.test.ts`、`tests/match-contract.test.ts`、`tests/opening-random-identity.test.ts`、`scripts/record-g2-4b-release.cjs`、`scripts/verify-m8-herald-fixtures.cjs` |
| 合同与交接 | `docs/MATCH_CONTRACT.md`、`docs/MULTIPLAYER_CONTRACT.md`、`M5_RULES.md`、`docs/evidence/g2-3/RELEASE_NOTES.md`、本文 |

运行时规则与内容分别为 `s13-g2-3-v14`、`s13-14.24b-g2-3-v14`。当前自动计算 `CONTENT_DIGEST=fnv1a32-utf16:ea6b11b6`、`LOOT_REPLAY_DIGEST=fnv1a32-utf16:9895bc42`。schema7/save3/replay3/command3/NET3 保持；NET3 的刷新命令需新服务端，旧客户端仍可选择，但无刷新入口。

## 验证结果

`npx.cmd tsc --noEmit` 通过；`git diff --check` 通过。只运行相关单文件测试，均使用 `npx.cmd vitest run <文件> --configLoader runner`；未跑全套，未改时限、skip 或放宽校验。

| 测试文件（相对于 tests/） | 最终结果 |
| --- | --- |
| `augment-tier-consistency.test.ts` | 7 通过：同级、锁级、三词、免费、额度重置、失败原子、读档防篡改、池不足拒绝 |
| `server/augment-tier-consistency.test.ts` | 2 通过：同一房间八席连续 2-1/3-2/4-2 同级、刷新与门控、私有视图、消息校验 |
| `g2-augments-choice.test.ts` | 62 通过 |
| `m5-serialization.test.ts` | 33 通过 |
| `s13-p1-acquisition.test.ts` | 3 通过 |
| `s13-augments-p2-choice.test.ts` | 23 通过 |
| `match-contract.test.ts` | 12 通过 |
| `m8-contracts.test.ts` | 6 通过 |
| `s13-p1-income.test.ts` | 8 通过 |
| `s13-p1-multiplayer-income.test.ts` | 2 通过 |
| `s13-augments-p2-multiplayer.test.ts` | 18 通过 |
| `g2-augments-multiplayer.test.ts` | 6 通过 |
| `server/net/messages.test.ts` | 7 通过 |
| `server/room.test.ts` | 13 通过 |
| `m8-b3-restore.test.ts` | 13 通过 |
| `m8-b8-combat-input.test.ts` | 38 通过 |
| `s13-anomalies-restore.test.ts` | 11 通过 |
| `m8-b8-live-economy.test.ts` | 3 通过 |

以上为 18 个完整单文件、267 项通过，其中新增 9 项。种子修法：P2 的 `seedFor` 原先自行抽混合池，改为搜索实际同级候选；Crown→Trifecta→Kog'Maw 路线 `182→1837`；live-economy `973→97653`，筛选保留原开局单位和掉落签名。原有数值、掉落、金币、HP、成长、护盾断言全部保留。临时搜索与诊断测试已删除。

### 仍失败的既有测试

| 文件 | 当前结果及原因 |
| --- | --- |
| `s13-p3-acquisition.test.ts` | suite 初始化失败，0 项执行；独立 oracle 的 `independent augment offers` 仍按混合池计算候选 |
| `s13-p1-dual-wielding.test.ts` | 1 通过、1 失败；v13 录制的 `contentDigest` 与 v14 不符，需重录 dual commands |
| `opening-random-identity.test.ts` | 4 通过、136 失败：1 个发布身份对账、134 个 cannon/sniper 的旧 v13 checkpoint 恢复、1 个首战状态 trace hash；均依赖尚未重录的当前发布夹具 |

没有运行并宣称通过其他长路线或整个测试集。其他依赖当前发布原件的恢复/指纹测试，在重录前也不具备验收条件。

## Oracle 决策阻塞

`tests/fixtures/m5/oracle.g2.cjs:211` 的独立候选计算只排除已持有，仍从混合池抽三个；新规则必然需要同步该预期算法，换种子无法解决。这同时影响 release/Herald/dual 的路线生成，以及引用生成器的测试。

按用户“必须改断言的停下列出原因”的约束，本次**未改 oracle**，已发送异步选择，尚未获得答复。建议允许：独立重写节点派生、按等级过滤及刷新重推，保留候选逐项相等与 RNG 守恒断言，不从 production 导入等级派生实现。替代选项为保持 oracle 不动，由调度方处理该阻塞。

## 发布录制与指纹步骤

历史基准全 SHA 从当前 release-audit.json 读取为 `bc49cac5deb74d6388f6d8c0eebb85ba15a9027e`，不是本工作区的施工基线。当前发布夹具及审计 JSON 均保留 v13 原件，没有手改身份、hash 或 golden。

| 步骤 | 沙箱内结果 |
| --- | --- |
| `node scripts/record-g2-4b-release.cjs --baseline-commit=bc49cac5deb74d6388f6d8c0eebb85ba15a9027e` | `EPERM unlink node_modules/.vite/deps/_metadata.json`，无输出后中止；无发布原件写入 |
| `node tests/fixtures/record-g2-4b-herald.cjs --write` | 立即失败：`Cannot read directory "../../..": Access is denied`、`Could not resolve .../vite.config.ts`；未写入 |
| `node scripts/record-g2-4b-inputs.cjs --baseline-commit=bc49cac5deb74d6388f6d8c0eebb85ba15a9027e` | `EPERM unlink node_modules/.vite/deps/package.json`，无输出后中止；未写入 |
| `node scripts/record-s13-p1-dual-choice.cjs --write` | `EPERM unlink node_modules/.vite/deps/phaser.js`，无输出后中止；未写入 |
| 各 `--check`、Herald verify | 未运行：依赖成功生成的新原件；现有原件仍为 v13，且相同沙箱前提未改变 |

未改 Vite 配置或录制脚本绕过限制，未运行历史 `g2-3-herald-raw`、`g2-augments-herald-raw` 的 `--write`。升版流程中的发布 JSON、两份 gzip 录制、Herald raw、dual gzip、输入最小向量、指纹和 sourceDigests 均待调度方重录。

先解决 oracle 决策与实现，再在沙箱外依次执行：

```powershell
node scripts/record-g2-4b-release.cjs --baseline-commit=bc49cac5deb74d6388f6d8c0eebb85ba15a9027e
node tests/fixtures/record-g2-4b-herald.cjs --write
node scripts/record-g2-4b-inputs.cjs --baseline-commit=bc49cac5deb74d6388f6d8c0eebb85ba15a9027e
node scripts/record-s13-p1-dual-choice.cjs --write
node scripts/record-g2-4b-release.cjs --baseline-commit=bc49cac5deb74d6388f6d8c0eebb85ba15a9027e --check
node scripts/record-g2-4b-inputs.cjs --baseline-commit=bc49cac5deb74d6388f6d8c0eebb85ba15a9027e --check
node scripts/verify-m8-herald-fixtures.cjs
node scripts/record-s13-p1-dual-choice.cjs
```

此清单是续跑方法，未宣称这些步骤已经成功。新发放可能影响长路线的目标阵容或胜负；如需修法，仍只能换种子、路线或优先级，改断言须再次报告原因。

## 建议英文提交拆分

1. `feat(simulation): share augment tiers and add one free locked-tier reroll`：领域状态、规则、读档、额度接口、内容 policy。
2. `feat(server): forward augment rerolls and expose private offer metadata`：协议、转发、门控、公开导出及 bot/test 穷尽分支。
3. `test(augments): cover tier consistency and reseed public acquisition routes`：新增 9 项及两处原断言不变的种子修复。
4. `docs(augments): document the user-defined tier and whole-offer reroll rules`：合同、规则和交接。
5. `release(s13): bump to v14 and re-record release evidence`：现有升版字符串改动，以及后续成功生成的夹具/审计；证据未完成前不要把这一提交视作可发布。

自行决定：FNV 节点派生、固定 namespace、等权默认、次数/剩余额度字段、只排除当前代、池不足原子拒绝、以 choiceOpened 发布刷新结果、沿用 NET3 的可选命令兼容方式。未改变现有强化效果、数值或额外新增内容。剩余风险是 oracle 未同步、发布证据仍为 v13，以及尚未逐个运行的其他种子长路线；本分支当前不满足发布验收。
