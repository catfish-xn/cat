【太难】保留普通数组数据属性及固定快照断言时，尚未找到消除剩余完整前缀复制的兼容方案。

# bc818fd8 强化历史累计复核

本轮未完成新的生产性能优化。工作区 `histperf` 的 HEAD 是 `bc818fd854a24bb3ae75e9f9035672bcbc836160`，已经包含 `9cdc59b9` 的历史索引/命令尾部优化。没有再次修改 `src/simulation/`，没有修改任何已有测试、断言、超时、阈值或纪元证据，也没有写入 Git。开工时已有的未跟踪 `histperf-result.md` 未修改。

## 当前代码及限制

- `src/simulation/augment-history.ts` 的 `appendAugmentFact` 已调用 `appendHistoryFact`，不是最初的 `[...facts, row]`。`recordAugmentTransition` 也已使用 `augmentDeathBoundary` 和 `augmentRecordedDeathEvents`；没有原始的每 tick deaths 全历史 filter。
- `src/simulation/augment-history-log.ts` 已有以私有 arena 数组为键的 WeakMap 死亡索引，按历史固定前缀限制证据范围。准备时钟已经按 round 建索引，正常后继共享 Map，时钟/取得事实才复制 Map。所有恢复认证及前缀校验保留。
- 剩余复制在 `append-only-log.ts / logValues` 的 `entries.slice(0, length)`，每次发布新的 facts 数组都复制完整前缀。`traceHistoryCommand` 还会发布完整普通 commands 数组；命令私有前缀和无参数重复 step 的克隆已在基线优化。
- `tests/augment-history-log.test.ts` 明确要求 facts/commands 是普通数组、可写的数据属性，旧快照及分叉保持固定内容，structuredClone 和纯数据快照路径保持原行为。按当前公开形态，生成每份独立普通数组仍需复制其槽位；换成 getter/Proxy/继承稀疏数组或修改旧数组均不能满足现有断言。因此不能声称整条记录路径已经线性化。

本轮没有用微小常数改动冒充解决剩余 O(T·F + T·C) 成本；已有改善及其历史测量见 `HISTORY_PERF_V26.md`，那些数字不是本轮相对 bc818fd8 的新成果。

## 新增独立基准

`scripts/compare-augment-history.cjs` 不进入 CI 默认测试集：

```sh
node scripts/compare-augment-history.cjs --base=bc818fd8 --runs=3
```

通过只读 `git archive` 提取基线源码，在临时目录构建；工作区源码独立构建。两边用 seed 230/cannon 完整公共命令路线到 6-7/gameOver，保留原路线全部经济、成长、事件、商店及 RNG 神谕断言。初始状态、每个 roundResults 增长点（包括补给回合）、终态分别调用真实 `serializeMatch`，核对全部 SHA-256；同时核对完整 JSON 与全部公共命令记录。

随后各开新进程，交错执行三次相同公共命令记录及每个战斗 step。每回合完整 JSON 必须匹配已认证路线。报告生产调用累计耗时的中位数，证据哈希和存档认证在计时区间之外；生成物在忽略提交的 `artifacts/augment-history-rounds/`。本轮生产代码完全相同，计时是 A/A 对照，差值只能视为噪声，不能计为提速。

当前 seed 230/v26 的路线实测 10,390 ticks、278 条公共命令、4,164 facts，与旧 v25 基准写死的 10,661/288/9,863 不同。新增基准不套用旧内容版本的计数作为预期；仍要求完整路线实际到达 6-7/gameOver、有真实战斗及死亡边界，并将所有实际计数写入报告。

## 相关测试

命令中外部浏览器地址只用于让现有 globalSetup 不启动 Chromium；这些文件全部是 Node 测试，没有连接或启动浏览器。

```sh
PLAYWRIGHT_WS_ENDPOINT=ws://unused-for-node-tests npm test -- tests/augment-history*.test.ts --maxWorkers=2 --configLoader=runner
```

结果：4 文件，92 通过、3 失败，无生产改动时即出现：

1. `augment-history-long-restore.test.ts:49`：seed 2 到 3-3 实际只有 1 条 acquire，断言要求至少 2 条；这不是来源摘要错误。后面的双持有者断言因此未执行。
2. `augment-history.test.ts:91`：四份 no-owner 存档与 ee2b019c 的旧 SHA-256 预期不同，保留原预期。
3. `augment-history.test.ts:458`：seed 42 首战实际结束于 tick 274，旧断言预期 164；这不是仅有摘要不同。后续事件数/摘要断言因此未执行。

以上失败与本轮变更无关，但不能因此宣称套件全绿，也不能把两项路线/战斗数值差异一概归为纪元摘要漂移。应另单排查是旧 fixture 假设失效还是已有玩法回归；本轮不改规则、不改 golden、不重录纪元。

本轮新增的是上述独立基准及其断言，没有新增或修改 Vitest 单元测试。已完成的完整路线对照有 40 个检查点（初始、38 个完成回合、终态），全部 serializeMatch SHA-256 一致；终态存档 SHA-256 为 `60824e3baee1257f7965301f5be5366a506935bcf431d0700cd84b7c00525b00`，完整终态 JSON SHA-256 为 `5e023ae48b3fe395891ca11b0c392a8da4e72097c7477a13a38db88fed021ee3`。

A/A 三次生产命令累计耗时（毫秒）分别为 baseline `[12271.331, 12276.244, 11776.389]`、working `[12150.453, 12047.302, 12001.596]`，中位数为 12.271 s / 12.047 s。表面差值 1.83% **不是优化成果**：生产源码 diff 为空（SHA-256 `e3b0c442…b855`），且这一组计时与 mage 用例列表的动态路线收集有并行，应仅作对照记录，不能用来宣称干净环境的提速。全部原始样本和 SHA 位于 `artifacts/augment-history-rounds/`。

mage 晚期用例通过动态收集确认最后三段，未写死旧版本的步数：

```sh
PLAYWRIGHT_WS_ENDPOINT=ws://unused-for-node-tests node node_modules/vitest/vitest.mjs list --project fast tests/m5-replay-mage.test.ts --maxWorkers=2 --configLoader=runner --no-staticParse --json=/tmp/histperf-mage-list.json
PLAYWRIGHT_WS_ENDPOINT=ws://unused-for-node-tests npm test -- tests/m5-replay-mage.test.ts -t 'M5 mage steps (14417-14424|14425-14432|14433-14436):' --maxWorkers=2 --configLoader=runner
```

mage 结果：选中的 3 项**全部失败，均为原有 5,000 ms 超时**，没有修改超时或重跑为宽松配置。三段实际用例耗时分别为 169.327 s、164.961 s、103.105 s；整个进程 Duration 602.37 s，其中参考路线收集 159.145 s。日志中的 `passed:true` 是用例内部输出，不能替代 Vitest 的最终失败结论。其余 1,802 项是 `-t` 未选中的用例，没有添加 `.skip` 或禁用检查。

完整日志保存在 `artifacts/augment-history-rounds/verification/{augment-history-tests,mage-late-tests}.log`，动态用例清单为同目录 `mage-case-list.json`。历史套件及 mage 过滤测试合计实际选中 98 项：92 通过、6 失败。此次失败发生在生产源码与 bc818fd8 完全相同的情况下；不应将这批结果称为通过验收。

`node --check scripts/compare-augment-history.cjs` 和 `git diff --check` 通过。未跑全套、未跑 Vite build、未执行任何 `--write` 或纪元重录。最终只新增基准脚本及本文，全部留在工作区供 Claude 评审提交。

全部测试结束后，已另在无并行测试的条件下完成三次交错 A/A 计时，作为最终计时：baseline [12083.854,11985.763,12437.712] ms，working [12002.842,11936.188,12021.609] ms；生产调用中位数 12.084 s / 12.003 s，路线总计时中位数 12.109 s / 12.027 s。差值 0.67% 仍是**相同代码的噪声，不是本轮提速**。最终结果为 `comparison.json` 及 `*-timing-*.json`；此前有并行收集干扰的样本保留在 `verification/overlap-timing/`，没有混入最终中位数。
