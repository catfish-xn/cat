# M6 F1 合法负载与回放原型实测

阶段：F1，非最终生产验收。基线 `d8a54bba0da2c398a2944634ef38fa781f26894b`；每个 JSON 保存实际 dirty 列表，原始四路线保存开始/结束 sourceFingerprint 且断言相同。后续公共合同文件加入会改变全 src fingerprint；没有更改规则。环境：Linux、Node v24.21.0、Intel Xeon Processor (Skylake, IBRS)，Vite SSR，未录制渲染 trace。沙箱阻止 Node 子进程，以下命令在允许子进程的执行环境运行。

复现顺序（不要并行运行性能样本）：

```sh
node scripts/m6-f1-load.cjs
node scripts/m6-f1-supplement.cjs
node scripts/m6-f1-full-load.cjs
```

所有负载来自 seed42 正式命令，不注入金币、人口、装备、胜利或战斗 tick。`m6-f1-load` 使用已有四条验收路线，保留每战独立战前 Match，使用 restoreMatch 验证，从 startMatchCombat 重新推演至末尾，完整事件和最终 Match 严格与原路线相等。四条各 30 战、35 轮、胜利。单战必须包括 tick0 至 combatFinished 连续事件。

| 路线 | 完整包装 bytes | 全局事件数 | 单战最大事件数 | 单战最大 bytes | 全历史重演 ms |
|---|---:|---:|---:|---:|---:|
| cannon | 9,882,682 | 27,051 | 1,505 | 535,436 | 4,844.4 |
| sniper | 13,973,361 | 42,174 | 3,266 | 1,024,265 | 6,891.8 |
| mage | 11,919,636 | 34,618 | 2,497 | 818,372 | 6,799.6 |
| sniper-caitlyn | 13,646,586 | 40,713 | 3,211 | 1,027,159 | 6,400.1 |

三个完整完成局（cannon/sniper/mage，各自独立 runId）的总包装 35,775,679 bytes，含当前 Match 与每战冻结完整战前上下文、tick0 Combat、全事件、终点/结果/哈希。不是仅事件流估算。四路线单战捕获 max13.23ms、restore max20.35ms、JSON stringify max86.03ms、parse max68.56ms。完整历史重演时间包含 stepMatch，但不包含生产外层解析、事务与异步yield，生产导入还需完整计时验收。

`m6-f1-full-load` 是已有路线的策略原型：增加第九个英雄盖伦、28轮起购买到9级、保留全部收到的组件不合成并逐件装备；仍只用原有正式命令，独立经济账本保留，每战前后 restore 验证。完成 30 战/35轮、85HP胜利；最大9上场玩家、8敌方、15装备全部装备（33/34轮），完整包装11,172,389 bytes，单战最大2096事件。初始压力支线只有9玩家/8替补/9物品，不冒称满载；以上完整路线才覆盖最大人口和本轮15组件收入的最大装备载体数量。它不声称覆盖所有星级、装备组合和随机路线的数学最坏值。

最大“整个活动包装”是末战：13,969,713 bytes、29历史战、tick257、656当前事件。最大“增量写入内容”是34轮：match + currentBattle + 历史keys 为1,164,068 bytes，3254当前事件；整份包装13,754,070 bytes。二者分别保存 `work/m6-f1-current-prefix.json` 与 `work/m6-f1-incremental-prefix.json` 供 A 实测；不能拿末战的较小 currentBattle 为增量预算依据。上述末尾tick属于合法快照边界，作为40tick调度的保守前缀样本。

检查点候选取真实最大事件战 sniper/34轮、576ticks、3266events，每间隔重复3次。首次为无检查点缓存的重演并建立缓存（领域代码已经预热），再次 seek 从最近已验证 Match 检查点恢复，不保存每 tick 状态。

| 间隔 ticks | 检查点 bytes（Match原型） | 首次最大 ms | 再次最大 ms |
|---|---:|---:|---:|
| 20 | 4,011,355 | 654.71 | 47.10 |
| 40 | 2,075,469 | 595.46 | 53.94 |
| 80 | 1,106,116 | 555.73 | 97.30 |

建议冻结40ticks；首次≤1000ms、再次≤100ms。生产若只缓存 Combat 可以减少内存，但必须保持 context、tick、eventSeq和前缀关联校验。统计原型只按 packetDamage.hpDamage / absorbed 与 heal.actual 累加，3次最大40tick批次0.165ms（冻结≤5ms）。这是纯聚合成本，不代表 DOM/Phaser 渲染耗时。数字正确性仍由独立手写预期验证。

容量冻结依据：`MAX_BATTLE_RECORDS=30` 源自35轮中30场实战。建议工程解析边界 `MAX_SAVE_BYTES=268435456`（256MiB）、`MAX_EVENTS_PER_BATTLE=100000`，分别为所测最大包装19.21倍和单战事件30.62倍余量；覆盖已测最大人口/装备载体与四路线全部历史。它们不是穷举所有合法轨迹的理论上界，也不是已测256MiB存档性能的声明。正式合法负载若突破边界属于G08缺陷，必须扩大边界/优化并重新测量，不能通过静默丢事件或拒绝合法完整局规避。30秒完整导入预算针对冻结合法负载验收集，不承诺任意接近文件边界的恶意输入都能重演成功。

尚需生产 F4 验证：外层完整档案校验+yield+IDB事务的整体导入耗时；真实产品监听器、tween、计时器与推进器回收；DOM统计与帧渲染；未知合法路线边界。独立 IDB/生命周期原型结果见 A 的 STORAGE 证据。Node峰值RSS674,922,496 bytes含保留完整route.before/after、完整事件、SSR和原型检查点，不能作为产品驻留内存结论。全程未改变生产规则、逻辑tick或事件保留语义。
