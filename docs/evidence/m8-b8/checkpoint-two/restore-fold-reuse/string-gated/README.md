# 保守字符串入口版：独立后续证据，绑定4d9

实际受测本地代码 `4d9e5e00269c0ae6d916b58ac92373de2c00b513`，src tree `16568c527580d74caca79e988bb5e8a1d43a290b`。生产源仅b8-restore.ts和serialization.ts变化；profile前后169个src文件hash完全稳定。这里的结果独立于上一版unsafe profile，原包不覆盖。

Node22.23.3同原完整sniper负载：182 commands /11930 ticks、全部逐步state/events比较及四类非法命令插入断言保持，通过。

- 原baseline总143.476s；当前保守版139.334s，减少4.142s。
- restore12112次不变，88.655→84.729s。
- fold24081→12151次，9.491→5.086s；receipts36193→24263；其他插桩调用次数不变。
- 最终完整JSON SHA256同为d3a1a077f60bcd6201bcd166cb3447e546384deb39e09c1bdc0af672018617a8。
- 六个极小入口计数：running字符串1fold、对象2fold、同对象两次4fold、serialize内部2fold；finished短prefix的字符串及对象均2fold。未跨调用缓存、未缩短历史校验。

当前保守版正式相关验证：原命令8文件164/164通过、typecheck退出0。包括getter对象拒绝负控、真实资源谱系及经济/成长/合并/容量/G12组合，全部原精确非法拒绝保留。该profile仍不等于正式Vitest180秒或全量/CI通过，后续固定候选须实际全量。

## Herald源绑定维护，不重做已批准准备分层

生产源hash变化后，实际执行`node scripts/verify-m8-herald-fixtures.cjs --write`，随后独立默认verify（37.41s）均通过。五份原始JSON及trajectory字节完全不变；manifest仅两份变化的生产source SHA及聚合sourceSha256改变，其余元数据相等。

新的source binding为538a839ff99466982a31ff0645bfa428cb56e981272f2f5e68d00398e8e8e180。没有手改raw或source值以过测试；仍由完整公共driver/14场5844ticks各分支、raw先于restore模块的边界断言和生产恢复验证生成。

## 对象反例

相邻`../accessor-review/`保存内部只读三模式原始脚本、输出与源快照：baseline拒绝、unsafe接受并导致再次JSON restore拒绝、当前恢复原拒绝；普通字符串/对象正控相等。此只读检查使用Node24.19.0，不冒称Node22性能测试或外部Codex正式审计。

原WIP README描述的是当时冻结状态；本页追加完成的profile/针对/元数据绑定结果，不改写历史。当前全量、双口径预算及同SHA CI仍待执行。②未签收，不进入③/B9、不合PR。
