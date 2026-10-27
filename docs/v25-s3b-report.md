【完成】B5-17、B5-18、B5-19 全部实现并逐项通过测试；无跳过项。分支 `codex/v25-s3b`，基线 HEAD `22ccbc460eedb7b5570946386217fc67e1d767e0`；未提交。

| B5-17 学术研究 | 交付内容 |
|---|---|
| 数值与约定 | `NumItems=1`、`NumOptions=2`；初始1组件＋Lux＋Ezreal。普通合成转换为“原成装＋不同赞助装”等权二选，特殊配方不转换。初始组件收据划定选择边界；满席及战中待发锻造器，战中装备按原下一tick输入生效。 |
| 测试 | 2-1/3-2可选、4-2禁选；真实库存／穿戴／战中合成，选择前同轮合成、特殊配方、满席出售腾位；二选打开与领取，三入口保存恢复及候选／配方／物品／出生早于合成的联合篡改拒绝；真实房间combine/openAnvil/choose。 |
| 调用点（含服务器） | 新`augment-pool-batch5-s3b.ts`与content文件；`match.ts` combineItems/equipItem、`augment-pool-grants.ts`、`anvils.ts`、资源fold与B8装备重放、共享恢复。`src/server`无修改，复用`src/server/room/room.ts`既有combine/equip/openAnvil/choose路由。 |

| B5-18 潘朵拉的装备 II | 交付内容 |
|---|---|
| 数值与约定 | `NumComponents=2`、`NumCompletedItems=null`原样保留。以后每轮入口，按物品ID排序，将库存普通组件／普通成装分别等权重掷，可原样；穿戴、铲锅、纹章、冠冕、神器、辅助、光明、工具不变。独立种子／选择／轮次／物品子流不消费主RNG。 |
| 测试 | 三节点可选及Slammin互斥；真实选择、下一轮命令、库存与穿戴区别、类别和原样抽样；独立BigInt预期，主RNG不变；对象/JSON/序列化恢复，删全部转换并回改库存仍拒绝；真实房间回合入口；窃贼手套重掷后的旧临时装备记录可恢复。 |
| 调用点（含服务器） | 新`augment-pool-batch5-s3b-conversions.ts`、`-restore.ts`；`match.ts` nextRound/advanceMultiplayerRound、资源fold、B8重放、`temporary-equipment.ts`历史父装备认证、共享恢复。`src/server`无修改，房间自然推进调用原共享入口。 |

| B5-19 打捞桶 | 交付内容 |
|---|---|
| 数值与约定 | 初始1普通随机成装，`NumRounds=7`。选择当轮起第7次完成PvP给1组件，PvE/供给不计。出售只拆普通永久成装；配方第一组件复用原ID，第二组件用既有授予收据；特殊装备原样返回，临时装备不产组件。 |
| 测试 | 仅2-1可选；真实equip/sell、两组件及重复出售拒绝；窃贼手套临时子装备不产出；完整真实战斗历史跨7次PvP，奖励只发一次；三入口恢复、缺失历史／奖励／配方／来源／结果篡改拒绝；真实房间equip/sell及共享快照恢复。 |
| 调用点（含服务器） | 新`augment-pool-batch5-s3b-salvage.ts`、`-restore.ts`；`match.ts` sellUnit、共同礼物drain、`crown-history.ts`、资源fold、B8重放、临时装备与共享恢复。`src/server`无修改，复用room.ts equip及sellSharedUnit路由。 |

共同登记仅做新增导入／展开／计数／阶段禁用及独立oracle补充；移除Batch2中已失效的学术研究禁用理由。P约定已登记于`docs/S13_RULES_GAP.md`（2026-10-27），接口及恢复合同见`docs/AUGMENT_BATCH5_S3B_CONTRACT.md`，并从MATCH_CONTRACT链接。

保存格式仍为schema/save/replay/command **12/8/8/7**。没有新保存字段或事实类型；复用合成事实、`g23-item-converted`、物品／锻造器收据及battles重放；恢复不修复候选档、不补奖。新增命名空间严格绑定拥有者、来源、时序、库存与完整输出集合。

最终验证：`npm run typecheck`通过；以下6个文件 **128/128通过**；`git diff --check`通过。全部Vitest使用`--maxWorkers=3 --no-file-parallelism --configLoader runner`，没有提高超时或删除断言，新增种子搜索限定0..100。

```sh
npm test -- tests/augment-pool-batch5-s3b.test.ts tests/augment-pool-batch5-s3b-history.test.ts tests/server/batch5-s3b-room.test.ts tests/m8-b8-resource-provenance.test.ts tests/content-identity-constants.test.ts scripts/tests/production-size.test.ts --maxWorkers=3 --no-file-parallelism --configLoader runner
node scripts/update-content-identities.cjs --write
```

最终身份：content `fnv1a32-utf16:7e63b0a9`；loot `fnv1a32-utf16:7c64a65d`，已同步`scripts/tests/production-size.test.ts`。未重录epoch，未运行全套或浏览器测试，未修改UI、src/server或素材。

【未完成】无功能阻塞项；本轮授权的三项均已完成。用户消息未给出具体`-o`路径，沿用克隆内报告文件`docs/v25-s3b-report.md`。
【需要我决定】无。
【风险】新增内容改变摘要，旧摘要存档仍按现有规则拒绝；旧epoch证据保持原样，集成后的纪元录制需另行执行。并行任务合并共享注册表后需再次重算身份。
【下一步】交叉审查此工作区改动与合同，再按集成流程合并；本轮不提交。
