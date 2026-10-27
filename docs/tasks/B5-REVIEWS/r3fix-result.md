【完成】联机恢复从认证的开战输入重新编译和重演 R3 战斗，并拒绝无来源的复制体及镜廊标记：[shared-pool.ts](src/simulation/shared-pool.ts:61)、[认证实现](src/simulation/augment-pool-batch5-r3-restore.ts:15)、[资源与种子认证](src/simulation/b8-restore.ts:374)。
【完成】统一四星技能编译，辛吉德源英雄、克隆设施和镜廊复制体均使用 60% 减伤：[fourth-star-ability.ts](src/simulation/fourth-star-ability.ts:6)、[family-reunion.ts](src/simulation/family-reunion.ts:20)、[projection.ts](src/simulation/d14-anomalies/projection.ts:40)。
【完成】补充真实八席战斗档三入口篡改和推进后恢复测试，以及双方四星辛吉德回归：[联机测试](tests/server/augment-pool-batch5-r3-cloning-room.test.ts:55)、[四星测试](tests/augment-pool-batch5-r3-fourth-star.test.ts:10)；更新[镜廊开放状态报告](docs/B5_R3_REPORT.md:1)。
【完成】相关测试 10 文件、125 项通过；补充推进后检查的联机文件重跑 13 项通过；typecheck、`git diff --check` 通过。未运行 Git 写操作。
【未完成】无。
【需要我决定】无。
【风险】按要求未运行全量测试。
【下一步】交叉复审工作区差异。