# c854 首次最终候选的固定全量（失败证据）

- 实际代码/测试/工具remote SHA：`c8543e192589cdc52b2a2119a45d5bfd613d8bf7`；本地等价`d2011ae3fff2744cb56a63a8c5c7176eb4a7f7d0`，whole tree `4badc332e835a3d5e5511a89e4c4a489a108aaea`，src tree `5f9b62228b236074efd78b50a571cc26d23858e5`。前后SHA/tree/src完全不变，唯一未跟踪项为测试依赖symlink。
- Node22.23.3/npm11.9.0。同源串行原样`npm test`、`npm run typecheck`、`npm run build`、`node docs/evidence/m8-b8/checkpoint-two/measure.mjs`；无timeout/worker/gate覆盖。
- npm test：131文件129passed/2failed；1857测试1841passed/6failed/10既有skip，527.84s，exit1。六项全部明确`Test timed out in 5000ms`，不是机制断言失败：B5 temporary的43 child同case覆盖；B7 Herald ionic-spark、evenshroud、两者组合、quicksilver、edge-of-night五case。原样完整栈保留，不能用随后专项或重跑覆盖。
- typecheck exit0；build exit0；包体脚本exit0。每个产物JS以gzip9分别压缩求和，基线488964 B、生产502900 B（B8累计+13936）、全导出可达探针503457 B（+14493），差557 B。两者分别低于新512364暂停线，global552191未触发。探针只是审计可达压力口径，不当作实际生产成本。
- 固定U5基线2acb9acfe90ad7936083fa2c7018dd482b6b222f/f189的原生产488964不重新起算；旧13k超线/优化/重评证据保留。B8当前批准中18000、严格>23400暂停。
- 原CI183的92项均已有逐根因专项闭环，但本次最终候选出现六个时间门禁失败，因此**尚未最终全量通过、不能送签完成**。CI200对应c854另由远端记录，本目录不冒称CI终态。
- 后续仅允许保持原测试/每tick恢复/负控/图隔离的合法fixture准备成本修复：不加timeout、不改worker、不拆case延长预算、不把准备挪出计时、不得缩减43定义/Herald目标回合或性能脚本负载。新旧准备路径如有HP/经济/事件差异须明确记录，目标机制输入逐字段比对，后续新SHA再完整全量/CI。
