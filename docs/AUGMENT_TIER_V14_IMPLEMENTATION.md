# 强化同级与默认刷新：v14 实现交接

基线：`043773eff1a1315c7ba24919f27ca1044c898354`，分支 `codex/augment-tier-consistency`。改动只在工作区；未执行 add/commit/checkout、未安装依赖、未改界面文件。**规则实现已完成；发布收口未完成。**

第二轮（2026-10-19）：本 LF clone 核对为 `codex/augment-tier-consistency`、HEAD `16977dd8b9540b5db1f81a292db4c3850ce6a154`。按调度方授权同步独立 oracle，只修测试路线并更新本文；未安装依赖、未写 `.git`、未操作历史 Herald raw。施工中出现的界面目录改动属于并行工作，本轮没有修改这些文件。

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

## 验证结果（第二轮）

只执行用户指定的 23 个单文件，逐个运行 `npx.cmd vitest run tests/<文件> --configLoader runner`，以及 `npx.cmd tsc --noEmit`；未跑完整测试集、未改测试时限、未 skip、未放宽原断言。类型检查及 `git diff --check` 通过。上一轮的 18 文件/267 项不计入本轮总数。

| 测试文件（相对于 tests/） | 结果 | 本轮修法 |
| --- | --- | --- |
| `m5-audit-boundaries.test.ts` | 20 通过 | 自动使用更新后的独立 oracle；测试本身不改 |
| `m5-growth.test.ts` | 2 通过 | 不改 |
| `m5-content.test.ts` | 9 通过 | 不改 |
| `s13-p3-acquisition.test.ts` | 12 通过 | 只同步 oracle，suite 初始化恢复；没有改种子或断言 |
| `s13-p1-acquisition.test.ts` | 3 通过 | 不改 |
| `s13-augments-p2-choice.test.ts` | 23 通过 | 不改；保留上一轮已落入基线的路线 |
| `g2-augments-choice.test.ts` | 69 通过 | 原 62 项保留；新增 7 项独立 oracle 校验，覆盖刷新成功、五类失败输入、篡改结果、UTF-16、已持有排除和下一节点重置 |
| `m8-b8-equipment-fixture.test.ts` | 4 通过 | `m8-b4-match.ts` 优先选无装备赠品的候选；双饮血种子 `401952→76672`，保留全部编号、掉落、强化及数值断言 |
| `m8-b8-live-capacity.test.ts` | 6 通过 | 种子仍为 36；通过公开部署把 Urgot 移至 `(4,7)`，保留 reveal=117、final=137 |
| `m8-b8-live-reveal.test.ts` | 3 通过 | 同时死亡路线 `42→242874`，保留原三强化与 Protective Shielding；真实补给/合成四件原装备、付费招募八名二星、使用已获拆卸器并部署，Leona 在 `(0,5)`；保留 tick-44/eventSeq-382/383。Zyra `166883→8606`、Loris `31731→59439`，真实出售/招募/卸装并部署，保留单来源 tick-152/381 及全部发放/恢复断言 |
| `m8-b8-live-transfer.test.ts` | 19 通过 | `t13-loot-public.ts` 将 Corki 购买上限设为 1，避免 4-7 多一次出生；保留 23 次出生、unit-24 奖励等原断言 |
| `m8-b8-live-growth.test.ts` | 26 通过 | `48→312`；真实出售巨人杀手持有者，将已获得装备交给幸存者；保留两来源既有成长、两次当前成长、奖励合并及全部防篡改断言 |
| `m8-b5-temporary.test.ts` | 30 通过 | `t13-public-gloves.ts` 避开 P1/P3 提前赠品、优先 Backup 而非额外 HP 的 Item Collector；必要时使用公开免费刷新；原 35 条路线、43 定义和所有数值断言保留 |
| `chest-bracer-integration-trial.test.ts` | 11 通过 | `64145→580279`，优先 Manaflow I；保留 2-4 法棒选择、2-5 战斗、授予/脉冲/叠层/死亡的所有原 tick |
| `bracer-multikill-stacks.test.ts` | 25 通过 | contribution=false 路线 `120→77`，保留 Manaflow I 及 tick-190 击杀 |
| `task-mechanism-restore.test.ts` | 20 通过 | 同上；Bulky Buddies I 路线 `22→112`；断言不改 |
| `t12-combat-equip.test.ts` | 48 通过 | 不改 |
| `server/carousel-room.test.ts` | 20 通过 | 种子仍为 24；保留开局单位至 3-1、2-1 买当轮商店，额外购买下一准备阶段真实卖出；保留 5-6 淘汰、两战间隔和卡池归还断言 |
| `server/projection-wire.test.ts` | 9 通过 | 加时路线 `4→5`；断言不改 |
| `server/g5-economy-preview.test.ts` | 2 通过 | 同上，真实进入加时，逐项比较经济预览不变 |
| `restore-audit/cd-replay-facts.test.ts` | 34 通过 | 不改 |
| `g2-4b-trench-gold.test.ts` | 1 通过 | `1→52`；保留原体/复制体各一次 Gambler、中一次 Collector、总三次支付、完整独立随机流及一次性结算断言 |
| `g2-4a-crown-history.test.ts` | 56 通过 | 不改 |

共 23 个完整文件、452 项通过，其中新增 7 项。所有原严格断言均保留，路线修复使用真实公开命令，没有改规则数值、伪造资源或替换 golden。临时诊断/搜索代码及旧基线导入已从测试删除；搜索日志和只读对照材料仅在忽略提交的 `artifacts/augment-tier-v14-round2/`。

同时死亡路线的对照来自提交 `404a0c4` 的只读源码副本，在指定的同一个测试文件内核实旧场景仍为 tick-44/eventSeq-382/383；没有改该基准。新路线以真实掉落加三次补给选择获得日炎、离子火花、科技枪、朔极之矛，保留原装备持有者和八人二星阵容，并调整 Leona 一格；测试不导入旧实现或保存的参考状态。构建目标仍由当前公开 Match 命令及严格恢复验证。

本轮需决定的测试断言变更：**无**。指定的包内失败均已修复，剩余仅为下面明确排除在本轮之外的发布重录工作。

### 需重录的发布证据（本轮按指令未运行、未修复）

`opening-random-identity`、`m8-content-equivalence`、`s13-p1-dual-wielding` 的 dual commands，以及 Herald/recorded-states 仍依赖 v13 发布原件或旧指纹，由调度方在沙箱外重录后再评估。上一轮记录的 opening 4 通过/136 失败、dual 1 通过/1 失败仅为历史结果，不冒充本轮执行结果。

## 独立 Oracle 已同步（原决策阻塞解除）

规则依据为用户 2026-10-19 08:15 约定及本轮调度授权，见 `docs/MATCH_CONTRACT.md`。`tests/fixtures/m5/oracle.g2.cjs` 顶部已标明来源和独立性：唯一运行时 `require` 是 `node:assert/strict`，不 import/require 任何 `src/simulation` 实现或内容表；`.d.cts` 中只有类型引用。

- 57 项等级身份采用独立字面量表，并核对与原有独立 ID 并集逐项一致；UTF-16 code unit FNV-1a32、异或 `0x61756774` 和 LCG 用 BigInt 独立算术实现，首词 `%3` 映射 silver/gold/prismatic，不消耗选择流。
- 按等级过滤、排除已持有及当前代、按字典序抽取三个 LCG 词；原候选逐项相等、选择/奖励/战斗 RNG 守恒和全部经济/成长/收据断言保留。
- `validateAugmentReroll(before,result,command)` 独立核对失败优先级、原 state 引用及无事件；成功时比较整个预期 state、完整事件、三个词、零费用、锁级、计数、代次、剩余额度和历史记录。`Ledger.apply` 对刷新成功接入同一检查，并在所有强化节点核对重置及已持有排除，非抽取步骤核对历史保留。
- 额外刷新额度的独立字面量表当前为空，符合本次没有注册 ExtraRolls 强化的内容边界；将来新增内容时须独立补录，而非读取被测定义。

本轮路线调整均在测试或测试夹具；发布/dual 脚本已经通过 `generate-m5-route.cjs` 自动引用更新后的 oracle，没有需要同步到录制脚本的同一条改种子路线。未改 Vite 或脚本绕过沙箱；发布整局胜利和录制仍须由调度方执行原严格验收。

建议第二轮提交：`test(augments): sync independent v14 oracle and reseed acquisition routes`。只包含本轮 oracle、类型声明、测试/夹具和本文；并行界面文件不属于本轮提交范围。

## 发布录制与指纹步骤

历史基准全 SHA 从当前 release-audit.json 读取为 `bc49cac5deb74d6388f6d8c0eebb85ba15a9027e`，不是本工作区的施工基线。当前发布夹具及审计 JSON 均保留 v13 原件，没有手改身份、hash 或 golden。

| 步骤 | 上一轮沙箱记录（本轮未重跑） |
| --- | --- |
| `node scripts/record-g2-4b-release.cjs --baseline-commit=bc49cac5deb74d6388f6d8c0eebb85ba15a9027e` | `EPERM unlink node_modules/.vite/deps/_metadata.json`，无输出后中止；无发布原件写入 |
| `node tests/fixtures/record-g2-4b-herald.cjs --write` | 立即失败：`Cannot read directory "../../..": Access is denied`、`Could not resolve .../vite.config.ts`；未写入 |
| `node scripts/record-g2-4b-inputs.cjs --baseline-commit=bc49cac5deb74d6388f6d8c0eebb85ba15a9027e` | `EPERM unlink node_modules/.vite/deps/package.json`，无输出后中止；未写入 |
| `node scripts/record-s13-p1-dual-choice.cjs --write` | `EPERM unlink node_modules/.vite/deps/phaser.js`，无输出后中止；未写入 |
| 各 `--check`、Herald verify | 未运行：依赖成功生成的新原件；现有原件仍为 v13，且相同沙箱前提未改变 |

未改 Vite 配置或录制脚本绕过限制，未运行历史 `g2-3-herald-raw`、`g2-augments-herald-raw` 的 `--write`。升版流程中的发布 JSON、两份 gzip 录制、Herald raw、dual gzip、输入最小向量、指纹和 sourceDigests 均待调度方重录。

本轮 oracle 已同步；发布录制仍由调度方在沙箱外依次执行：

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

上一轮实现选择：FNV 节点派生、固定 namespace、等权默认、次数/剩余额度字段、只排除当前代、池不足原子拒绝、以 choiceOpened 发布刷新结果、沿用 NET3 的可选命令兼容方式。第二轮未改变规则或内容。Oracle 原阻塞已解除；发布证据仍为 v13，且完整发布路线未在本轮验收，本分支当前不满足发布验收。
