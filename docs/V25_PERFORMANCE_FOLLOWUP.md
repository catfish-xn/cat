# v25 八机器人性能复核（2026-10-27）

状态：**未达到 60 秒门槛**。未修改门槛、超时或功能断言。下列结果是本机单次测量，不代表跨机器的性能保证。

## 定位

同种子 42 的整局探针，含采样和账本写入、压缩：`origin/multiplayer` 63.69 秒，v25 优化前 77.84 秒。两版本分别有 111,588 和 176,176 条战斗事件，因此战斗轨迹本身不同，不能把全部差额归因于单一函数。CPU 含子调用采样：`stepCombat` 分别 34.42 / 38.40 秒，`appendEvents` 4.36 / 6.28 秒，`canonicalContent` 5.30 / 7.19 秒；数值重叠，不能相加。v25 的 `traceHistoryCommand` 为 8.13 秒，但其中包含原本就要执行的命令，其 `recordAugmentTransition` 子调用为 0.73 秒；死亡样本传递 0.25 秒，`advanceAugmentCombat` 0.63 秒，H11 死亡结算 0.20 秒。探针未开启回放采集，不能据此衡量带观察者的权威回放开销。

优化为：无新死亡时复用私有不可变历史数组；同步规范编码不再分配递归 generator；双边战斗对已证明深度冻结的 JSON 图避免生成未使用的编码字符串。复杂对象仍走原编码路径。内容摘要同步为用户重新计算的值。

## 验证结果

- 独占、强制门槛的原测试：优化前 74,724 ms，当前 68,512 ms，仍失败；目标为严格小于 60,000 ms，尚无余量。原始前值和本次均为单次结果，不是稳定的基准分布。
- 完整种子 42 前后比较：33 轮、154 次战斗、176,176 条战斗事件、38,260 tick；终局、操作序列和逐场战斗账本逐字节一致；收据一致，127 份公开回放经两版各自认证生成后逐字节一致。探针没有单独捕获战斗以外每条 MatchEvent；比较也不包含仅由调度产生的房间 revision 和计时器。这不是对所有种子和所有合法输入的证明。
- 终局 SHA-256：`e4d714088e99fe1e6ecbc63064ca97b1f2d26c2ccb5cb0cb897bac32edaaabde`；账本：`7d4f4f4fc7287248cee42b7b033acccbf38215f4cbdc56631ca5b8daec97db32`；收据：`d48f2ffa9a89c4c154f07613639ed4553dca65dc5ac3bea94a6581d9df513022`；回放：`b3c35eebdb99696bd31bbee5cdd9b36a815191fcf8ad003ea55fe5db996667fc`。
- 本地忽略的完整证据：`artifacts/v25-perf/` 下的两个 CPU profile、`before-run`、`current-run`、`equivalence.json`、`current-timing/vitest.jsonl`。

复现比较时，先用 `git archive HEAD` 解出优化前源码到独立目录，并把已同步的 `src/simulation/content/identity-constants.ts` 放入该目录；分别调用 `node scripts/mp-sim-perf-probe.cjs SOURCE RUN_DIR 42`，再运行 `node scripts/compare-bot-perf-evidence.cjs BEFORE_SOURCE BEFORE_RUN AFTER_SOURCE AFTER_RUN REPORT 42`。计时门槛用 `npx vitest run --configLoader runner --project timing --maxWorkers=2 tests/server/bot-driver-timing.test.ts -t 'plays eight bots from the first round'` 独占运行。`runner` 是只读依赖目录下加载 Vite 配置的方式，不改变测试。
