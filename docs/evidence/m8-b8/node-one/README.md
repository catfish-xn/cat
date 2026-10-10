# 节点1（B8＋U6）候选证据 · Claude 接手后第一轮

接手起点 `c0109ace4f389908e7749170936faf24d75d530d`（仅比冻结代码 `386293e` 多交接文档）。本轮候选 `bbb336833b98517334bd9f50b008df4501ef9542`，提交：

| 提交 | 内容 |
| --- | --- |
| `1100c3a` | perf：战斗 tick 的等价纯数据脱钩（`plain-clone.ts`）与无临时数组的 `canonicalContent` |
| `b077b86` | B8：`readLootView` 权威投影及隐藏信息负控测试 |
| `6bc6950` | 合入 U6 静态分支 `6a2b0c7`（同时带入基线 `f189851` 的一行文档，B8 不再落后基线） |
| `bbb3368` | U6：策略面板接入真实 `LootView` |

工具链：本容器 Node 22.22.0 / npm 10.9.4 / Vitest 5.0.3，4 逻辑核、15 GB。与交接约定的 Node 22.23.3 / npm 11.9.0 不同；包体用相同锁文件构建，基线复现为 488,964 B，与原值一致（见下）。本机性能数字只用于同机 A/B，不代表 CI。

## 1. TG（P2-1）：有限等价优化，未关闭

**测量**（`tg.ts` 复刻原用例的 35 条真实路线，`node --cpu-prof`）：原实现中 tick 内 `structuredClone` 每个单位约占 33%，同一处展开约 38%（合计即交接所称“unit copy map＋structuredClone”）；恢复往返约 20%，其中 `canonicalContent` 约一半。

**改动**（全部为产品代码，不改测试、夹具、超时、workers、路线或断言）：

1. `copyPlainRecord`：一次遍历完成原来“展开→structuredClone→再展开”的脱钩。保持键顺序、三个共享机制字段的引用、同一调用内的别名/环（memo）、`undefined` 成员和 `-0`。遇到非纯数据（Map、Date、类实例、稀疏或带额外属性的数组、`__proto__` 键、函数、symbol）返回 `undefined`，由调用方走原 structuredClone 路径，保持平台语义。已知差异仅限上述非纯数据输入：顶层 getter 会被读取两次。合法 Match 状态都是纯 JSON 数据，因此不受影响。
2. `canonicalContent`：检查项、顺序、错误文本与输出字节均不变，只把 map/join 换成字符串拼接。

**等价证据**：

- `tick-diff.ts`：30 个种子、240 场真实战斗、73,426 tick。同一输入分别交给 `c0109ac` 与候选的 `stepMatch`，JSON 文本（含键顺序）和 canonical 文本逐 tick 相同；候选输出单位除共享字段外不引用任何输入对象。结果见 `tick-diff.out.json`。
- `route-diff.ts`：cannon/mage/sniper/sniper-caitlyn × 种子 42/230/7，共 138,543 次 `stepMatch` 逐次相同，`CONTENT_DIGEST` 仍为 `fnv1a32-utf16:314b4c1f`。结果见 `route-diff.out.json`。
- `tests/m8-plain-clone.test.ts`：13 例，逐项对照原 structuredClone 路径，覆盖别名、环、falsy 共享字段和十类非纯数据。
- 全量 `npm test`（候选 `1100c3a`+loot view，未合 U6）：133 文件，1865 通过、10 既有 skip；3 个失败均为 `m5-replay` 180 s 超时。该次运行与差分脚本、构建同时占用 CPU。单独复跑时，**基线 `c0109ac` 的同一 sniper 用例在本机也超时（196.7 s）**，候选为 182–188 s。因此这是本机已有的速度问题，不由本改动引入；CI 上这些用例一直通过。

**本机同机 A/B（Vitest，仅 TG 文件）**：基线 4730 / 4649 / 5397 ms，候选 3904 / 3858 / 3731 ms，下降约 20%。过往比值为 CI/本机 ≈ 1.4，按此估计 CI 仍约 5.2–5.5 s，**预计仍超 5 s**。[CI #216](https://github.com/catfish-xn/cat/actions/runs/38044699859)（`bbb3368`）证实了这一点：TG 仍 5000 ms 超时，单元步骤其余 1887 通过、10 skip。整套用时 667.40 s，#215 为 782.20 s；sniper replay 用时 149.78 s，预算 180 s。

**结论**：在“不改测试、不改时限、不挑运行”的约束下，等价优化不足以稳定关闭 TG。进一步的引擎级改法（例如跨 tick 共享静态字段，实测只再快约 5%）收益小、风险高，已撤回未提交。需用户决定的方案见第 5 节。

## 2. input-dev（P2-2）：运输修复已有两次真实通过，仍待独立判定

CI #214（`386293e`）与 #215（`c0109ac`，相对 386293 只多交接文档）的 input-dev 均完成原 M6 measurements/lifecycle/bounded 门禁及后置完整图校验并成功（#214 约 23.5 分钟）。两次都是同一修复代码，不是不同条件下的独立复现。本轮没有改动运输代码或浏览器脚本。是否关闭由 GPT 判断；我的意见：根因（100 MiB DevTools 管道上限）已有原始 stderr 直接证据，修复后连续两次原条件通过，可以关闭，但应以 #216 及最终候选 SHA 的结果为准。

## 3. readLootView 与隐藏信息边界

`src/simulation/loot-view.ts`，经 `match.ts` 导出，返回冻结的 `LootView` 形状（未改合同）：

- 只包含当前回合：`revealed`／`pending-capacity`／`granted`／`retained-terminal` 的直接掉落（按冻结顺序），以及**已有收据**的组件选择（payload 取自收据）。
- planned、forfeited、未解决选择的备用组件、未来回合计划和掉落 RNG 一律不进入视图。
- `canContinue/reason` 按 `nextRound` 守卫顺序计算：gameOver→`game-over`；非 settlement（含选择期）→`unsettled-round`；满席待入库→`pending-capacity`；其余未结算→`unsettled-round`。

`tests/m8-b8-loot-view.test.ts`（7 例，全部使用 seed-230 公开命令路线）：开战前、战中首个揭示、战后待选（满席英雄等待中）、真实 `selectChoice` 后、真实出售释放空位后、下一回合，以及 4-7 致死的三种终局。每例都核对：读取不改状态、严格恢复后视图相同、结果已冻结、字段只限合同、`canContinue` 与 `nextRound` 实际结果一致。负控为在保存档中改写未揭示 payload 和备用组件，视图不变；另断言来源 ID 与 `readEncounterPreview` 的单位一一对应。变异检查：故意暴露 planned 掉落或未解决的备用组件，各有用例失败。

## 4. U6 接线

PvE 回合开战后，面板显示 `lootPanelSection`（战斗、选择、结算），终局显示 `lootTerminalSummary`；战斗中只在投影变化时刷新。野怪组件选择的标题按 `m8.round.kind==='pve'` 判断，不解析 `choiceId`。UR-U6-01..05 的处理记录在 `docs/UI_REQUESTS.md`。浏览器实测（dev，seed 42，1920×1080）已截图：1-2/1-3/1-4 的战中“已揭示”、战后“已入库”、野怪组件选择框和选择后的已入库行；控制台无错误。U6 自动化界面回归尚未补（与 issue #27 同类）。

## 5. 包体（逐 JS gzip9 求和，`measure.mjs`）

| 构建 | 总量 | 相对基线 488,964 |
| --- | --- | --- |
| 基线 `2acb9ac`（复现） | 488,964 | 0 |
| 交接 `c0109ac` | 502,898 | +13,934 |
| ＋TG 优化（loot view 未可达） | 503,332 | +14,368 |
| B8 探针：`readLootView` 可达，无 U6 | 503,701 | **B8 +14,737**（含探针导出开销） |
| 集成候选 `bbb3368`（B8＋U6） | **505,000** | +16,036 |

U6 约为 505,000 − 503,701 = 1,299 B（下限）。B8 距 23,400 暂停线余 8,663 B，总包距 552,191 余 47,191 B。明细见 `budget.json`。

## 6. 未覆盖与待办

- TG 未关闭，需用户决定（见回复中的选项）。
- 延期断言：6 个 unit `[B8]` skip 已恢复（`1aca3c9`）。m6-integration、m6-replay 原样执行；m5-route 的组件总数 15 仍保留，按 M8B_LOOT“6-7结算”行拆为补给 5＋掉落 10 核对。剩余 4 个 `[B9]` 33 战封包 skip 按计划属节点2。
- input `[B8]` skip：3 个 Rageblade 断言已迁到真实 B8 开局的 2-1 战斗（`70a3e66`），断言本体不变；本机 dev 门禁 38 例通过（Chromium 1194，与 CI 的 Playwright 浏览器版本不同，只作本机证据）。剩余 2 个（mouse/touch）`back-to-back-opening-components`：冻结的 M8 日程中没有任何回合连续出现两个选择，需用户决定（见回复）。
- B8 剩余组合：跨轮/终局组合的其余样例未在本轮追加。
- 本机无法稳定复跑 `m5-replay` 的 180 s 用例（基线同样超时），只能以 CI 为准。
- U6 界面自动回归尚未补；浏览器截图为人工检查。
