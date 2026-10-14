# T11/T12 夹具修复

基线：`origin/multiplayer@7ef65de6e36b101272d6cba42afa5c2f268c4bd0`。分支：`codex/t12-fixtures`。
仅修改 `tests/`（含夹具）和本文；不修改 `src/`、规则、版本常量、CONTENT_DIGEST 或 LOOT_REPLAY_DIGEST。

## 夹具及覆盖范围

| 测试文件 | 失效原因与修复 | 保留的断言 |
| --- | --- | --- |
| `match-session.test.ts` | T11 后购买经验升至 4 级时剩余 XP 为 2 | 同步提交、金币 -4、商店/RNG 不变、人口上限即时生效 |
| `match-lifecycle.test.ts` | 2-1 开始已有 3 级/2 XP；购买后 4 级/0 XP，结算后 4 级/2 XP | 精确结算记录、4 级刷新概率；另保留 2-2 自然 XP 从 3 级/4 XP 升到 4 级/0 XP 的原边界 |
| `m8-b8-live-growth.test.ts` | 旧 unit-6 已合并消耗；提前将 Corki 移至备战席，3-7 再移走 Irelia/Ezreal | 两份历史成长、本场被消耗来源的真实增量、掉落合并、逐状态/事件恢复及全部 20 个损坏边界 |
| `m8-b8-live-capacity.test.ts` | 2-7 金币为 26；终局商店为 generation 46；调整 Ezreal 部署 | 满备战席、结算后卖出不重算利息、两种单来源及双来源终局、严格恢复 |
| `m8-b8-live-transfer.test.ts` | 两次刷新后，在 generation 24 的槽位 2/3 买 Ezreal；新 ID 为 unit-23/24，奖励 unit-26 | TG 转移/冲突退回、异变转移、冻结战斗输入、账本顺序、RNG/收据不重复 |
| `m8-b8-loot-view.test.ts` | 同步 generation 46 和 Ezreal 的单来源部署 | 隐藏信息隔离、满容量提示、终局已赚/未赚奖励区分 |
| `m8-b8-live-reveal.test.ts` | 旧 unit-21 已不在当前阵容；改用当前 Nami unit-13 | r01 在 tick 218 被击杀；仍在 combat 时恢复，只结算实际击杀来源 |
| `m8-b10-temporary-replay.test.ts` | 同步转移夹具的购买点和单位 ID | 1×/2×/4×、seek、终局逐状态和完整事件相等、临时装备篡改拒绝 |
| `m8-content-equivalence.test.ts` | 使用当前 digest 的真实重录，替换过期的恢复测试输入 | 两条路线各 67 个状态、文本/对象恢复等价、20,000 个对抗 JSON 与非有限数拒绝 |

没有跳过、禁用或放宽状态、事件、数值断言或容差；M5 的执行期限调整单列如下。所有夹具数字仍使用精确相等：

- 成长：unit-13 在 3-5 获得 125、3-6 两次各 125，共 375 Bps；unit-17 在 3-5 获得 125 Bps。3-7 的 unit-17 在 tick 219/eventSeq 215 再获得 125 Bps，合并后 `375 + 125 + 125 = 625 Bps`。w00 的两个奖励槽同指 tick 198/eventSeq 202 的自然死亡；最终 tick 为 243。
- 容量/利息：基数 26，利息 `floor(26/10)=2`，结算金币 33；卖出价值 4 的单位后金币 37。若错误地重算利息，`floor((26+4)/10)=3`，仍能检测多发 1 金币。双来源终局 tick 为 922；单自选来源将 Ezreal 部署到 `(3,7)`，仍在 tick 309 结束。
- 转移：3-5 的商店从 generation 22 刷新两次；generation 24 槽位 2/3 都是 Ezreal。4-7 前金币 122、账本前缀 67、nextUnitSerial 26；奖励出生/升级序号为 68/69。TG 的 10 次 roll、20 次 draws、子装备、战斗 tick 和原事件锚点保持精确验证。

## 重录与复现

运行 `node tests/fixtures/record-m8-states.cjs`。脚本只调用既有公共命令路线，不改保存状态或 digest，并要求实际状态的 digest 为 `fnv1a32-utf16:44fe9c0e`。
新夹具在 `tests/fixtures/t12-recorded-states/`；历史 `docs/evidence/m8-b9/golden/` 保持不变。压缩文件包含完整命令记录及 33 场战斗的 before/after/final 状态，不包含不稳定的耗时统计。

| 路线 | seed | 命令数 | 状态数 | 未压缩 JSON SHA-256 |
| --- | --- | --- | --- | --- |
| cannon | 42 | 194 | 67 | `243477e64ac03e37ecd3ebe0b8471ad8c82178f8456a327793a7406fe662c235` |
| sniper | 42 | 183 | 67 | `d8e0e60302ba8f1898754dea37ea2965346cb4076f4e0cab02416d4150fc2c62` |

## #75 文档分支

已直接在 `codex/r3r4-loot-design` 合入 `multiplayer@7ef65de`，章节修正合并提交 `45936d0`；随后以 `9a27857` 同步测试期间新增的纯文档 `multiplayer@4973424`。
T12 §17 原文保留，R3/R4 草案移至 §18，`R3R4_LOOT_DESIGN.md` 和 `M8B_LOOT.md` 的章节/锚点同步。
相对 multiplayer 仍只有这三个 docs 文件，466 行新增；GitHub 已报告可合并。未在本夹具分支夹带 #75 的设计稿。

## 验收

最终全套结果如下；验收期间不并跑其他测试、重录或路线搜索。
初次诊断受沙箱本机端口限制及调试负载影响，已中止，不作为完整验收：除上表九个夹具文件，还报告过 `tests/server/net/server.test.ts`、`tests/server/ws-client.test.ts`、`tests/server/projection-wire.test.ts`、`tests/server/lifecycle.test.ts`、`tests/server/net/takeover.test.ts` 的端口权限失败，以及 `tests/m6-integration.test.ts` 的 sniper 用例超过 120 秒（133.073 秒）。这些文件未改动。

正式默认并行全套（Node 24.21.0 / Vitest 5.0.3）：194 文件中 193 通过，2531 项中 2528 通过；唯一失败文件是 `tests/m5-replay.test.ts`。sniper/mage/sniper-caitlyn 的断言均实际完成，但分别耗时 190.553/188.089/183.883 秒，超过各项原有 180 秒预算。23 个 server 文件及 `m6-integration.test.ts` 均通过。该轮没有其他测试、重录或路线搜索并跑。

### 额外文件及唯一执行预算调整

`tests/m5-replay.test.ts` 是九个已知夹具之外发现的额外文件。仅将 sniper、mage、sniper-caitlyn 三项执行期限由 180,000 ms 调整为 240,000 ms；cannon 保持 180,000 ms。所有 seed、公共命令路线、逐 tick 恢复、完整状态/事件比较、非法命令纯度断言保持不变。

数值依据：默认全套三条路线分别为 11,861 / 12,211 / 11,507 ticks，实际断言全部完成，最慢为 190.553 秒。原预算单跑 sniper 仍需 189.321 秒，不能报告为“并行失败/单跑通过”。原预算单跑 mage 实际完成断言用时 193.292 秒，单跑共 1 项通过、3 项超时。采用 `ceil(193.292 × 1.20 / 30) × 30 = 240 秒`，为调整前已测最大时长保留至少 20% 执行余量；不改玩法或回放结果断言，唯一放宽的是上述执行时间预算。保留完整路线，未通过减少命令/tick 检查规避超时。

### 最终验收（全部通过）

- `npm run typecheck`：退出码 0。
- `npm test -- --reporter=default --reporter=json --outputFile=../acceptance.json`：仅增加报告输出，保留默认工作进程并行度、全部测试与各自预算，退出码 0；总耗时 756.36 秒。
- 194/194 文件、2531/2531 用例通过，失败 0、跳过 0。
- `tests/server/`：23/23 文件、154/154 用例通过；其余：171/171 文件、2377/2377 用例通过。
- 最终 M5 四条路线实际耗时：cannon 138.070 秒、sniper 204.662 秒、mage 204.282 秒、sniper-caitlyn 206.940 秒，均在各自预算内。
- 最终失败文件清单：空。未改动任何服务器测试；无需以服务器单跑结果替代全套结果。
- `git diff --check` 通过。目标分支测试期间更新至 `4973424`，相对指定基线只新增/更新 `SESSION_HANDOVER.md` 和 `docs/DISPATCH_2026-10-14.md`，代码、测试、依赖均与此次验收基线相同。
