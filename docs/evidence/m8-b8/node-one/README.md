# 节点1（B8＋U6）候选证据

**状态：主体实现完成；db808e5 审计的六项 P2 已按原编号追加修复（见第 10 节），待增量复审；不是全部完成。** 最终签收须绑定补完后的同一 SHA、完整 CI、包体和独立审查结论。

接手起点 `c0109ace4f389908e7749170936faf24d75d530d`（仅比冻结代码 `386293e` 多交接文档）。候选提交（最终送审 SHA 见 PR 送审评论）：

| 提交 | 内容 |
| --- | --- |
| `1100c3a` | perf：战斗 tick 的等价纯数据脱钩（`plain-clone.ts`）与无临时数组的 `canonicalContent` |
| `b077b86` | B8：`readLootView` 权威投影及隐藏信息负控测试 |
| `6bc6950` | 合入 U6 静态分支 `6a2b0c7`（同时带入基线 `f189851` 的一行文档，B8 不再落后基线） |
| `bbb3368` | U6：策略面板接入真实 `LootView` |
| `1aca3c9` | 恢复 6 个 unit `[B8]` 延期断言 |
| `70a3e66` | 3 个 input `[B8]` Rageblade 断言迁到真实 B8 开局的 2-1 |
| `8ad6b79` | TG：经批准的方案 A，35 条路线固定为 5 组 |
| `2dce06c` | 跨轮掉落链与 6-7 胜利终局视图 |
| `9548994` | back-to-back 归档；真实 1-3/1-4 掉落选择连点（mouse/touch） |
| `3596737` | U6 自动回归脚本及 CI 任务 `m8-u6-loot` |

工具链：本容器 Node 22.22.0 / npm 10.9.4 / Vitest 5.0.3，4 逻辑核、15 GB。与交接约定的 Node 22.23.3 / npm 11.9.0 不同；包体用相同锁文件构建，基线复现为 488,964 B，与原值一致（见下）。本机性能数字只用于同机 A/B，不代表 CI。

## 1. TG（P2-1）：等价优化（**已撤回**，见第 10 节 P2-1）＋经批准的测试结构调整（方案 A，保留）

> 本节的 `copyPlainRecord` 与拼接式 `canonicalContent` 已在 `f6cf000` 撤回，下述等价论证与差分只作历史记录，不再代表当前代码。

**测量**（`tg.ts` 复刻原用例的 35 条真实路线，`node --cpu-prof`）：原实现中 tick 内 `structuredClone` 每个单位约占 33%，同一处展开约 38%（合计即交接所称“unit copy map＋structuredClone”）；恢复往返约 20%，其中 `canonicalContent` 约一半。

**改动**（全部为产品代码，不改测试、夹具、超时、workers、路线或断言）：

1. `copyPlainRecord`：一次遍历完成原来“展开→structuredClone→再展开”的脱钩。保持键顺序、三个共享机制字段的引用、同一调用内的别名/环（memo）、`undefined` 成员和 `-0`。遇到非纯数据（Map、Date、类实例、稀疏或带额外属性的数组、`__proto__` 键、函数、symbol）返回 `undefined`，由调用方走原 structuredClone 路径，保持平台语义。**已知行为差异（送审问题 Q1，不称全部输入等价）**：只有当单位里含非纯数据而走回退路径时，顶层访问器（getter）会被读两次（先在纯数据遍历中读一次，回退的展开再读一次），嵌套 getter 也会被重读；原实现每个只读一次。若 getter 每次返回不同值，或第一次读到非纯值、第二次读到纯值，回退结果可能与原实现不同：原实现会抛 DataCloneError，候选可能成功。纯数据输入（含普通 getter 但返回值稳定、且都是纯数据）在遍历中只读一次，与原实现相同。合法 Match 状态由 restore 校验为纯 JSON 数据，正常运行不经过回退路径。`stepMatch` 本身不校验输入，因此这一差异只对“手工构造、带动态访问器的非法状态”可见。
2. `canonicalContent`：检查项、顺序、错误文本与输出字节均不变，只把 map/join 换成字符串拼接。

**等价证据**：

- `tick-diff.ts`：30 个种子、240 场真实战斗、73,426 tick。同一输入分别交给 `c0109ac` 与候选的 `stepMatch`，JSON 文本（含键顺序）和 canonical 文本逐 tick 相同；候选输出单位除共享字段外不引用任何输入对象。结果见 `tick-diff.out.json`。
- `route-diff.ts`：cannon/mage/sniper/sniper-caitlyn × 种子 42/230/7，共 138,543 次 `stepMatch` 逐次相同，`CONTENT_DIGEST` 仍为 `fnv1a32-utf16:314b4c1f`。结果见 `route-diff.out.json`。
- `tests/m8-plain-clone.test.ts`：13 例，逐项对照原 structuredClone 路径，覆盖别名、环、falsy 共享字段和十类非纯数据。
- 全量 `npm test`（候选 `1100c3a`+loot view，未合 U6）：133 文件，1865 通过、10 既有 skip；3 个失败均为 `m5-replay` 180 s 超时。该次运行与差分脚本、构建同时占用 CPU。单独复跑时，**基线 `c0109ac` 的同一 sniper 用例在本机也超时（196.7 s）**，候选为 182–188 s。这只说明本机环境慢，**不能单凭它断言候选无回归**。候选是否回归，以候选自身的 CI 用时和上面的逐 tick/逐步差分为准：CI #216 的 replay 为 cannon 108.5 s / sniper 149.8 s / mage 145.5 s / sniper-caitlyn 139.7 s（预算 180 s）。

**本机同机 A/B（Vitest，仅 TG 文件）**：基线 4730 / 4649 / 5397 ms，候选 3904 / 3858 / 3731 ms，下降约 20%。过往比值为 CI/本机 ≈ 1.4，按此估计 CI 仍约 5.2–5.5 s，**预计仍超 5 s**。[CI #216](https://github.com/catfish-xn/cat/actions/runs/38044699859)（`bbb3368`）证实了这一点：TG 仍 5000 ms 超时，单元步骤其余 1887 通过、10 skip。整套用时 667.40 s，#215 为 782.20 s；sniper replay 用时 149.78 s，预算 180 s。

**结论**：在“不改测试、不改时限、不挑运行”的约束下，等价优化不足以关闭 TG。另试过跨 tick 共享静态字段，只再快约 5%，已撤回未提交；按用户决定停止继续扩大引擎优化。

**用户批准的方案 A（2026-10-10，`8ad6b79`）**：原聚合用例拆为一个纯计划用例和 5 个路线组。纯计划用例沿用原贪心规则（512 候选），断言 35 条路线、43 种定义、种子互不相同、不与本文件其他用例的种子 42 重合、只有一条 crownguard 路线。5 个路线组各 7 条路线，每组使用默认 5 s 时限，各自从 `createMatch` 跑完整真实准备。每条路线保留原断言：开战时恢复、旧式护盾键拒绝、走 3 步后恢复续算。每组断言**实际绑定**的子件等于本组计划，护盾子件与本组是否含 crownguard 相符。

- 这是经批准的测试结构及整体时间预算调整：总预算变为 5×5 s。**不声称原聚合用例仍能在 5 s 内完成。**
- 本机：计划 25 ms；各组 656–887 ms（整文件内）；单独运行每组 1.13–1.17 s，说明各组互不依赖。
- 原 5 s 聚合用例的首失败记录保留：CI #200、#207、#209、#214、#215、#216 均超时或超 5 s。

## 2. input-dev（P2-2）：运输修复的真实结果，交 GPT 复审

| CI | SHA | input-dev | 说明 |
| --- | --- | --- | --- |
| [#214](https://github.com/catfish-xn/cat/actions/runs/38039476976) | `386293e` | 通过（约 23.5 分钟），含原 M6 measurements/lifecycle/bounded 门禁及后置完整图校验 | 修复首次真实通过 |
| [#215](https://github.com/catfish-xn/cat/actions/runs/38040931139) | `c0109ac` | 通过 | 相对 #214 只多交接文档，**同一修复代码**，不算独立复现 |
| [#216](https://github.com/catfish-xn/cat/actions/runs/38044699859) | `bbb3368` | 通过 | 生产代码已变（tick 优化、loot view、U6），运输代码未改 |

作者不自行关闭 P2-2，由 GPT 复审判断。根因证据（CI209 原始 stderr 显示 100 MiB DevTools 管道上限）见交接文档 §3.2。

## 3. readLootView 与隐藏信息边界

`src/simulation/loot-view.ts`，经 `match.ts` 导出，返回冻结的 `LootView` 形状（未改合同）：

- 只包含当前回合：`revealed`／`pending-capacity`／`granted`／`retained-terminal` 的直接掉落（按冻结顺序），以及**已有收据**的组件选择（payload 取自收据）。
- planned、forfeited、未解决选择的备用组件、未来回合计划和掉落 RNG 一律不进入视图。
- `canContinue/reason` 按 `nextRound` 守卫顺序计算：gameOver→`game-over`；非 settlement（含选择期）→`unsettled-round`；满席待入库→`pending-capacity`；其余未结算→`unsettled-round`。

`tests/m8-b8-loot-view.test.ts`（7 例，全部使用 seed-230 公开命令路线）：开战前、战中首个揭示、战后待选（满席英雄等待中）、真实 `selectChoice` 后、真实出售释放空位后、下一回合，以及 4-7 致死的三种终局。每例都核对：读取不改状态、严格恢复后视图相同、结果已冻结、字段只限合同、`canContinue` 与 `nextRound` 实际结果一致。负控为在保存档中改写未揭示 payload 和备用组件，视图不变；另断言来源 ID 与 `readEncounterPreview` 的单位一一对应。变异检查：故意暴露 planned 掉落或未解决的备用组件，各有用例失败。

## 4. U6 接线

PvE 回合开战后，面板显示 `lootPanelSection`（战斗、选择、结算），终局显示 `lootTerminalSummary`；战斗中只在投影变化时刷新。野怪组件选择的标题按 `m8.round.kind==='pve'` 判断，不解析 `choiceId`。UR-U6-01..05 的处理记录在 `docs/UI_REQUESTS.md`。自动回归见第 8 节；早先的人工截图仅作参考，不作为验收证据。

## 5. 包体（逐 JS gzip9 求和，`measure.mjs`）

| 构建 | 总量 | 相对基线 488,964 |
| --- | --- | --- |
| 基线 `2acb9ac`（复现） | 488,964 | 0 |
| 交接 `c0109ac` | 502,898 | +13,934 |
| ＋TG 优化（loot view 未可达） | 503,332 | +14,368 |
| B8 探针：`readLootView` 可达，无 U6 | 503,701 | **B8 +14,737**（含探针导出开销） |
| 集成候选 `bbb3368`（B8＋U6），至 `db808e5` 不变 | 505,000 | +16,036 |
| B8 探针＋LootView 增补 | 503,883 | **B8 +14,919**（增补 +182） |
| 集成候选＋LootView 增补（B8＋U6） | **505,225** | **+16,261** |

U6 约为 505,225 − 503,883 = 1,342 B（下限；增补前 1,299）。B8 距 23,400 暂停线余 8,481 B，总包距 552,191 余 46,966 B。明细见 `budget.json`。

## 6. 跨轮与终局组合（新增）

- `tests/m8-b8-live-cross-round.test.ts`（5 例，seed 42 真实开局，Irelia 上场，不做其他操作）：
  - 抵达 2-1 时为 10G、3 级、0 XP，英雄为 Irelia/Maddie/Lux，并持有 1-3/1-4 选择的 bow/rod。独立依据是 B8 门禁“真实新局经 1-2～1-4 到 2-1：无运营全清 10G／3级0XP／三指定英雄／两组件”。
  - 跨两轮的掉落组件合成为 Rageblade，装备在掉落所得的 Lux 上，打 2-1，出现 rageblade statChanged 事件；然后 Continue，在 2-2 出售该携带者，Rageblade 回到背包。
  - 每个边界严格恢复且 `readLootView` 相同；战中第一 tick 恢复后的续算与不中断运行完全一致。
  - 4 个精确拒绝：删合成记录（先触发开战前缀校验）、改 bow 收据指向、重复收据、已消耗组件复活。
- `tests/m5-route.test.ts` 的 `[B8]` 块：4 个构筑真实打到 6-7 胜利，终局 `readLootView` 中 6-7 掉落已在同一 gameOver 状态内授予，只读、`reason='game-over'`，恢复后不变。
- 早终局（4-7 致死，三种情形）与满席等待已由 `m8-b8-live-capacity`、`m8-b8-loot-view` 覆盖，此处不重复。
- 未覆盖：6-7 终局满席英雄保留。冻结的 6-7 计划只掉金币（种子 42：`gold:5`），合法路线无法产生该状态；UI 合同 §5 的原子示例因此没有真实向量，只能由 4-7 的同类终局保留代表。

## 7. 延期断言状态

| 断言 | 状态 | 位置／依据 |
| --- | --- | --- |
| unit `[B8]` ×6（m5-route ×4、m6-integration ×1、m6-replay ×1） | **已恢复** | `1aca3c9`。m6 两项原样执行；m5-route 组件总数仍为 15，按 M8B_LOOT“6-7结算”行拆为补给 5＋掉落 10 |
| input `[B8]` Rageblade ×3（配方/装备、statChanged、动态攻速） | **已恢复**（迁到真实 2-1） | `70a3e66`，断言本体不变 |
| input `[B8]` back-to-back 开局组件 ×2（mouse/touch） | **已归档：不再适用**（用户批准） | 冻结日程每回合至多一个选择（`round-schedule.ts`），M8B_LOOT 每个 PvE 回合至多一个掉落选择。报告中记为 `archived-not-applicable`、`verifiedConsecutiveDialogs=false`，**连续两个弹窗未验证** |
| 新增：真实 1-3/1-4 掉落选择连点（mouse/touch） | **新增并通过** | 一次连击只授予一次（收据、物品各 +1，整状态等于公开命令结果），第二次按下落在关闭遮罩上，1-4 选择仍正常 |
| unit `[B9]` ×4（33 战封包） | **仍延期**至节点2 | 原计划 |

本机 dev input 门禁：42 例通过、无 skip（Chromium 1194，与 CI 浏览器版本不同，只作本机证据）。

## 8. U6 自动回归

`scripts/verify-m8-u6-loot.cjs`，CI 任务 `m8-u6-loot`。

- seed 42 由原生点击开局；seed-230 的满席（2-7）与致死（4-7）路线由公开命令在无界面环境跑出，用 `BattleHistory` 录成普通存档，经 `validateEnvelope` 校验后，通过真实导入控件载入。
- 载入后全部为原生点击：选择、Continue 被拒、出售释放空位、Continue、致死战斗到终局。
- 13 个检查点中，DOM 的行、状态、收据 ID、`data-can-continue` 与阻塞原因都必须等于 Node 侧根据页面状态独立计算的 `readLootView`。planned/forfeited 不渲染，面板内没有领取按钮。终局时保留英雄无收据，备用组件只经其收据出现。本机通过（13/13，无控制台错误）。

## 9. 送审问题与未关闭项

- **Q1 getter 行为差异**：审计已用公开 stepMatch 实测反例确认，按第 10 节 P2-1 撤回优化，不再是待判断项。
- **Q2 合同缺口**：未解决野怪自选缺“明确的阻塞原因”和来源，验收依据为 ADDENDUM §5.1。用户 2026-10-10 批准最小增补，已在 `db808e5` 之后的追加提交中实施（`pending-choice` 原因＋`pendingChoice` 身份），见 [M8_U6_LOOT_CONTRACT_PROPOSAL](../../../M8_U6_LOOT_CONTRACT_PROPOSAL.md) 第 4 节，待 GPT 补审。玩家自选与终局自动处理的区分不在验收要求内，未提议，属已知限制。
- **Q3 P2-2**：input-dev 三次通过，交 GPT 判断是否关闭。
- **Q4 本机环境**：`m5-replay` 180 s 用例基线与候选在本机都超时，以 CI 为准；本机工具链与约定版本不同。
- B9 项（33 战封包、正式版本、M7 保全等）留节点2。

## 10. db808e5 独立审计六项 P2 的处理（原编号）

审计报告：PR #28 第一轮审查结论（Codex，固定 `db808e5`）。本节记录 `bc21af0` 之后的追加修复；最终送审 SHA 见 PR 补审评论。

| 编号 | 处理 | 提交 | 实际验证 |
| --- | --- | --- | --- |
| P2-1 Q1 复制回退 | **撤回**单位复制快路径与拼接式 `canonicalContent`，两个文件逐字节恢复为 `c0109ac`，删除 `plain-clone.ts` 及其测试；不再扩大引擎优化，保留已批准的 TG 分组 | `f6cf000` | `tests/m8-b8-copy-semantics.test.ts` 共 6 例，用审计的精确反例经公开 `stepMatch` 调用：先返回函数后返回数字的访问器只读一次并抛 DataCloneError；Date 访问器只读一次；稀疏数组带额外键时保留空洞和键；canonicalContent 每个访问器只读一次；元素访问器删除后续元素时按 map 跳过；原错误文本不变。对已撤回代码运行，6 例中 4 例失败。TG 各组本机 0.79–1.20 s |
| P2-2 Rageblade 证据门禁 | `scripts/b8-input-evidence.cjs`：摘要必须绑定实际 interaction、原生可信输入、未改动的状态哈希、按路线顺序串接的状态、物品/Lux/Rageblade 身份，以及与战斗状态一致的事件账本（含 Rageblade statChanged）。两个攻速值按真实字段核对：冻结值为 CombatUnit `attackIntervalTicks`，当前值为对记录状态重算的 `readCombatStats().attackIntervalTicks`。比较器为此执行 `npm ci` | `67b772c` | `tests/m8-b8-input-evidence.test.mjs`：真实证据接受；14 种篡改全部拒绝（删产物文件、删交互、删事件、伪造事件、改状态、不可信输入、改 Lux/Rageblade 身份、伪造摘要/冻结值/当前值/tick、缺摘要、乱序）；本机真实 dev 产物通过 |
| P2-3 残留 B8 延期 | 全仓检索后恢复：headless formed-battles、G02 三阶段、full-load 9/8/15、M7 帮助覆盖奖励选择（改为真实 1-3 掉落选择，理由见处置表）、M6 比较器；B9 范围不变 | `b0992ab` | 本机 headless 24 路线通过、无 skip；G02 13 个非 B9 阶段全部通过；full-load 路线在 6-5/6-6 达到 9/8/15；M7 门禁通过。处置表：`docs/evidence/m8-b6/deferred-assertions.md` |
| P2-4 Continue 接线 | 面板按钮在 `canContinue=false` 时禁用并带阻塞原因；画布按钮按同一判定变暗且不可交互；领域拒绝测试保留 | `7c24754` | U6 回归 13 个检查点均断言按钮禁用与否、阻塞原因与投影一致；满席时原生点击无效，出售后按钮恢复可用，点击后进入 3-1 |
| P2-5 合同增补 | `5581a96` 已实现：来源身份、pending-choice 优先于容量、补给/强化不误判、不泄露隐藏信息；与 P2-4 配合：选择期 Continue 原因为 pending-choice。**已实现、待复审** | `5581a96` | `m8-b8-loot-view`、`m8-b8-live-cross-round`、U6 回归 |
| P2-6 差分脚本 | 非预期异常一律失败退出；每条路线必须到达 gameOver 且 33 战，记录终态、战数和比较步数；加入普通异常与提前结束两个负控 | 本节所在提交 | 两个负控均 exit 1（`route-diff-negative.log`）。重跑 12 条路线全部到达 6-7 胜利、33 战，共 138,543 步（`route-diff-v2.jsonl`）。**注意**：Q1 撤回后候选的 step 代码与基线完全相同，本次重跑只证明脚本与路线完整性，不再作为任何优化的等价证明。旧 `route-diff.out.json` 保留，但撤回“单凭它证明十二条路线完整完成”的表述 |
| U6 进入最终汇总 | `compare-evidence` 依赖 `m8-u6-loot` 并下载其报告；比较器要求报告通过、同一 SHA、无错误、13 个检查点名称及 Continue 可用性 | `67b772c` | CI 待验证 |

包体（逐 JS gzip9，相对基线 488,964）：撤回 Q1 并加入 P2-4 后，生产包 **504,905 B（+15,941）**。B8 探针（U6 界面文件还原为 `c0109ac`，只导出 readLootView）为 503,508 B（+14,544）；U6 约 1,397 B。探针口径受注入方式影响，只是估计（与审计意见一致）。

本机 G02 运行在 13 个阶段全部通过后，因 1 条未解释的 404 控制台错误整体判失败。CI #219 的 input-dev 运行同一门禁并通过，因此判断为本机环境问题；以候选 CI 为准，不据此声称已通过。

中间 CI 记录：#219（`db808e5`）除 compare-evidence 外全部通过。compare-evidence 失败是因为 G02 已实际采到三个 B8 阶段，而 M6 比较器仍按“不存在”检查，已在 `b0992ab` 修正。#220（`bc21af0`）结果待收集。
