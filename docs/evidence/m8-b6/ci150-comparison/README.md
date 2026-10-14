# CI150真实比较失败与修复诊断

固定输入SHA：`ac76255df7876f2dfa47deaa4a4475a0beaf81b8`。12个主作业通过；[compare-evidence真实失败](https://github.com/catfish-xn/cat/actions/runs/37917616047/job/113784136193)退出1，不能称整条CI通过。原失败摘录只保留断言和堆栈，不携带认证或环境配置；原GitHub日志链接可核查全文。

## 根因：明确实现错误，不是flaky

B6新增`validateB6BrowserBoundary`错误地把所有checkpoint都对应`route.actions[i].afterHash`。原浏览器runner的Start行为一直是：发公开Start → 正常时间等待整场结束 → 比较完整round.after/事件 → 写command/checkpoint。因此：

- action0的即时状态为combat/tick0，hash=`b5c692afe05a86f0a8145367904805c472592b161f35f721fe7448ab77770693`。
- 实际浏览器command0.after为settlement，完整对象等于route.rounds[0].after，hash=`825df565d0d2b6bd89c47bf0846dfadfcdc71fa5d337bdd28ace8a84c2850cbd`；manifest.checkpoint0也是它。
- 两者哈希算法、索引、产物配对均正确；比较器用了错误观察时刻。

修复仅让Start对应唯一同轮的完整round.after，重新计算hash并核对round.stateHash；其他命令仍严格比较即时action.afterHash。全部前段checkpoint身份/数量、完整状态、边界准备hash、精确B9尾3战和未知skip拒绝都保留。没有改变浏览器行为、计时、CI、阈值或扩大skip。

## 实际验证

8份原始GitHub ZIP全部核对官方SHA256及CRC，来源和digest见artifact-sources.json。修正后的完整`compare-m5-evidence.cjs --final`在本机消费这些原产物退出0，含三路线dev/preview及touch对比；完整领域33战仍对比，只有原已批准12个尾段snapshot比较skip。

全部8路合计1226个checkpoint：240个Start结算与986个非Start即时结果。对每路分别篡改Start结算hash、冒充tick0、非Start hash或漏checkpoint，共32例全部拒绝。可复现代码为recheck-artifacts.cjs；需传入下载后合并的artifacts根目录。4文件37定向测试及typecheck通过；另含结算原对象篡改、重复轮次等单元负例。

这些结果属于“修复WIP比较器 + 固定ac76255原始浏览器产物”的诊断；日志中旧`final-clean-commit`标签只描述产物采集时的SHA，**不是新修复SHA的CI验收**。没有重跑浏览器；后续提交须重新CI及打包送独立审计。

## 性能历史保留

- [CI148 input-dev](https://github.com/catfish-xn/cat/actions/runs/37915580089/job/113770818833) firstSeek真实909.2/1176.7/2271ms，第三样本超2000，完整原manifest保留；不改写为通过、不称flaky。其独立30战完整导入7015.7/6873.8/6873.1ms且原生IDB读回通过。
- [CI150 input-dev](https://github.com/catfish-xn/cat/actions/runs/37917616047/job/113777530654) firstSeek真实740/729/969.3ms，独立30战完整导入5669.7/5521.4/5761.3ms，按同一阈值通过。两机分别Intel8370C与AMD9V74；性能脚本未改，不以一次后续通过推断前次根因。
- 对照CI146旧目录原manifest及分析见performance-history-comparison.json。旧/new最大record虽然都标round-34，却分别是6-6/6-3且字节不同；当前29完成+1prefix实际执行完整验证后才测firstSeek。无法从现有样本证明JIT/GC或冷启动因果，因此不扩大性能skip。
