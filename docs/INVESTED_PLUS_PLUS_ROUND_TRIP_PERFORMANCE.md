# invested-plus-plus 往返超时剖析与验证

2026-10-28。实际工作区为 `claude/sol-t13 @ 01f31414`，是用户指定的
`97068956` 后代，包含 drift-4（PR #476，合入提交 `f0789410`）。工作区起始干净，
没有 Git 写操作。Node v22.23.4，Vitest v5.0.3，默认 5 秒超时保持不变。

## 根因与修改

按任务约定归为 drift-4 引入的回归：原基线 `3c6cf5ad` 的报价前置失败掩盖了
往返耗时，不能据此前置失败认定没有回归。drift-4 将本文件的路线换为 seed 20，
该路线在 2-1 自动选中 `no-scout-no-pivot`，启动从开局起的强化历史证明。
目标 JSON 往返第一次恢复要实际重放 6,576 次 `stepMatch`。

`tests/v23-tamper-batch4.test.ts:57` 改为 seed 29，在 4-2 依次调用公开的
`rerollAugment` 槽位 0/1/2，真实报价得到 `invested-plus-plus`。
离线筛选范围限定为 **0..100**，出处为本次任务的通用约束；测试运行时不扫描种子。
前两张为 `visionary-crest` / `academy-crown`，不会提前启动历史证明。

路线复用 `tests/augment-stage-helpers.ts:137` 的 `fieldedRoute` 分段缓存，
每个 `FIELDED_LEGS` 段都通过已有 generator yield 放入独立的默认超时 beforeAll。
该 helper 在 4-1、无强化历史且无冠冕历史依赖时，已有
`restoreMatch(serializeMatch(state))` 验证检查点（第 148 行）。本次没有修改 helper。
新路线因此从已验证的 4-1 状态开始后续证明，而非从开局重放。
4-2 棱彩报价仍保留 offer-level 历史，最终往返仍冷重放 695 step，未绕过恢复校验。

保留全部 JSON/object/serialized 三入口、相同后续战斗、每个叶子与容器的篡改拒绝断言。
没有删除或放宽断言，没有改超时、门槛、预算、规则、数值或录制夹具。
本路线不使用 B1 脚本报价，`offers.toContain(id)` 仍检查真实 RNG 报价；
原 `overheal` 的脚本包装和夹具自检注释保持原样。

## 分段剖析

使用临时测试副本，`performance.now()` 测量测试边界，并以调用原函数的 spy 测量
`validateAugmentHistory`、报价历史校验及回放命令。没有替换返回值或修改 src。
副本在采样后删除。前后各用一个全新 Vitest 进程，先跑 JSON，再跑 object、serialized。
下列为一次带探针采样，单位 ms；嵌套项不能相加。

| 阶段 | seed 20 原路线 | seed 29 新路线 |
| --- | ---: | ---: |
| beforeAll 路线构造总计，含新路线已有检查点 | 9,292.21 | 5,353.09 |
| beforeAll 保存 JSON | 7.36 | 1.19 |
| JSON 用例：JSON.stringify | 6.54 | 1.10 |
| JSON 用例：serializeMatch | 未调用 | 未调用 |
| JSON 用例：restoreMatch，含解析及所有校验 | 6,577.38 | 778.74 |
| ↳ 强化历史校验（含内部原点校验） | 6,481.08 | 753.09 |
| ↳ 其中重放 stepMatch | 6,115.22 / 6,576 次 | 677.54 / 695 次 |
| ↳ 其中 startMatchCombat | 103.93 / 17 次 | 15.58 / 2 次 |
| JSON 用例：报价历史校验（含嵌套原点） | 2.97 | 3.33 |
| JSON 用例：deepStrictEqual | 14.66 | 3.54 |
| object 用例：restoreMatch | 285.88 | 45.24 |
| serialized 用例：serializeMatch | 264.80 | 50.11 |
| serialized 用例：restoreMatch | 161.28 | 25.58 |

路线构造一直在 beforeAll，**不计入**目标 it。object 和 serialized 的上述采样发生在
JSON 冷恢复之后，可能命中生产代码已有的恢复证明缓存，不能当作独立冷恢复数据。
本次没有将完整目标状态的恢复移到 beforeAll 来预热它。

| 最终合法状态 | 原路线 | 新路线 |
| --- | ---: | ---: |
| JSON 文本长度（UTF-16 代码单元） | 1,146,984 | 246,147 |
| 强化历史 facts | 6,201 | 352 |
| 证明命令行数（含压缩 step） | 63 | 11 |
| 证明 stepMatch 总次数 | 6,576 | 695 |

src 热点证据：`src/simulation/augment-history-restore.ts:225` 查找已认证前缀，
第 229 行在冷恢复时校验原点，第 230 行遍历命令，第 236 行按 count 调用真实领域命令，
第 244 行再比对完整回放状态。原路线约 98.5% 的 restore 时间在强化历史校验内，
其中绝大部分是实际战斗重放。证据支持“长证明冷回放”这一原因；
本次没有建立结构超线性的证据，也没有据此提出或实施 src 修改。

## 验证

全部 Vitest 命令均使用 `--configLoader runner`；计时来自 JSON reporter 的目标 it
duration，不含构造、转译、导入和其他测试。下列重复计时不带剖析探针。
每次都启动全新 Vitest 进程，避免跨轮命中恢复缓存。

| 场景 | 第 1 次 | 第 2 次 | 第 3 次 | 第 4 次 | 第 5 次 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 单跑，maxWorkers=1 | 817.35 | 832.55 | 868.48 | 835.05 | 760.78 |
| 单跑，maxWorkers=3，另加两个 CPU 忙循环进程 | 805.51 | 772.63 | 769.53 | — | — |

负载为两个独立 Node 进程，持续执行整数乘加循环，在每轮 Vitest 启动前启动，
直到该轮退出后才终止并 wait 回收。不是仅设置 maxWorkers=3 后让另外两个 worker 空闲。
以上 8 次均通过，最大 868.48 ms；加负载最大 805.51 ms，全部低于要求的 3 秒。
这是本机指定负载下的实测结果，不代表任意资源饱和环境的时间保证。

```bash
export PATH=$HOME/.local/bin:$PATH
# 完整文件：4,624/4,624 通过；目标用例 751.50 ms，文件测试耗时约 130.12 秒。
npm test -- --configLoader runner --maxWorkers=3 tests/v23-tamper-batch4.test.ts
# 目标重复计时；maxWorkers 分别取 1（5 次）和 3（带上述负载，3 次）。
npm test -- --configLoader runner --maxWorkers=1 tests/v23-tamper-batch4.test.ts \
  -t '^invested-plus-plus > legitimate JSON round-trip$' --reporter=json
# 通过，退出码 0。
npm run typecheck
```

另外，目标强化的完整 289 项测试独立运行通过，覆盖三个往返入口和篡改矩阵。
修改范围仅为该测试文件与本报告；**src 修改文件：无**。
无未完成项，无需用户决定。改动留工作区，交执行端提交。
