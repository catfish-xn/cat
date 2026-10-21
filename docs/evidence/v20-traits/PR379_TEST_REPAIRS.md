# PR #379：v20 卡池测试修复

基线：`codex/v20`，`f156c02082fac68d75fd92a08a1681db51815152`。本轮保留开工前的 must-fix 修复与 v20 重录结果；新增修改仅涉及测试及本报告，未联网、未执行 Git 写操作。

## 断言与路线

- 当前计数为 35 羁绊、66 强化；D11 与五个 LCG 种子用例核对独立 oracle 的完整名单。独立名单包含 mentorship、reunion、geniuses、menaces、unlikely-duo；每个种子的报价和最终 RNG 状态仍以恰好三个 LCG word 独立计算。
- 六个关系羁绊（五个搭档及 Sisters）都由强化解锁，不属于英雄原生 traits；原生身份测试排除这六项。v19 历史断言与历史 epoch 冻结夹具未修改。
- 双饮血剑：保留种子 76672、组件出生序列与所有装备断言；3-2 公开重掷一次，选择 glass-cannon-ii，避免选择有英雄赠礼的 mentorship。正面持有者仍为 700 HP。
- P1 获取：固定公开种子 blinding-speed=3、portable-forge=236、radiant-relics=10，并验证实际报价。Portable Forge 已超出原 200 种子搜索范围。
- G2 全卡获取：先用独立报价 oracle 搜索种子，再仅重放所选公共路线，避免为每个候选重放开局战斗而触发 5 秒超时；实际报价、失败原子性、资源、保存恢复与继续战斗断言均保留。
- 经济场景：种子 11111。保持开局三组件/两英雄、2-7 三物品加 1G 且不生成英雄的结构；原金币、利息、HP、投资成长、唯一发奖及恢复断言全部保留。
- 外套金币：种子 307，公开选择前排无效的 manaflow-i；原 Darius 与三复制体均攻击。原持有者赌徒收益 2 次、复制体赌徒收益 1 次、复制体收集者成功收益 2 次，共 5 次唯一发奖；逐次独立 LCG、来源及恢复断言保留。
- 离线转移使用既有 v20 公开路线锚点的 donor/survivor，不再沿用旧 epoch 的 unit 序号。
- 整局选秀核对本局实际到达的全部计划节点，并继续核对参与者存活、关闭后无预留、淘汰返池；不要求对局必须活到 6-4。
- 额外修复 D14 当前内容测试遗留的旧摘要常量，改为核对既有 v20 内容基线；源表数值断言保留。

静态检查遍历了 tests/ 下 126 处 selectChoice 调用；剩余直接选择有效强化的调用有种子搜索或实际报价验证。其余公共路线按报价内优先级或实际报价选择。没有重录历史 epoch。

## 验证

Windows 使用 `npm.cmd test` 避开本机 PowerShell 禁止执行 npm.ps1 的限制，使用 `--configLoader runner`。四分片依次启动；分片 1、2 使用 `--maxWorkers=4`，分片 3、4 使用 `--maxWorkers=2`。

用户指定的 13 个文件共 248 条测试均有修复后通过证据，另加 D14 的 4 条。一次合并复测得到 251/252，唯一失败为旧版 G2 搜索超时；优化后 G2 78/78 通过，连同 G5 汇总 9/9 共 87 条通过（`--maxWorkers=1`，仍使用原超时）。

四分片均完整结束，原始结果如下（含随后修复/复测消除的两条）：

| 分片 | 文件 | 通过 | 失败 | 跳过 | 用例总数 | 耗时 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1/4 | 119 | 1399 | 9 | 0 | 1408 | 234.19 s |
| 2/4 | 118 | 1533 | 13 | 1 | 1547 | 495.96 s |
| 3/4 | 118 | 1766 | 2 | 0 | 1768 | 865.83 s |
| 4/4 | 118 | 1512 | 4 | 0 | 1516 | 416.20 s |
| 合计 | 473 | 6210 | 28 | 1 | 6239 | — |

剩余 26 条都是环境阻断，未绕过或跳过其断言：

| 文件 | 失败数 | 已观察到的阻断 |
| --- | ---: | --- |
| tests/assets3d-compress.test.ts | 7 | realpath `<home>` 返回 EPERM；部分预期业务错误被该权限错误抢先阻断 |
| tests/assets3d-fx-pilot.test.ts | 1 | 同上 |
| tests/assets3d-build-root.test.ts | 12 | 同上 |
| tests/assets3d-pack-root.test.ts | 4 | realpath 用户目录短路径 `<home>` 返回 EPERM |
| tests/explorer-bracer-restore-pressure.test.ts | 2 | esbuild 报 Cannot read directory `../../..`: Access is denied，无法解析压力测试入口；尚未进入测量子进程 |

其余两条原始分片失败已处理：D14 旧摘要断言修复后 4/4 通过；G5 的 `source tampering, altered shares, missing or duplicated heal still fail replay-divergence` 在并行运行中超出 5000 ms，使用原超时、单 worker 复测后 9/9 通过。没有剩余的 v20 卡池相关真实失败，不能据此宣称四分片全绿。

本轮额外的 G2 旧版搜索超时已通过独立报价 oracle 预选种子消除；优化后的整个 G2 文件 78/78 通过，分片 3 也仅剩上述两条环境失败。

最终 `git diff --check` 通过。所有已跟踪 src 文件加开工时既有的未跟踪 combat-movement.ts 的聚合 SHA-256，开工与收尾均为 `690867a01bd0f020fab0c5300aab3765630d5e393ca9ebb453fba1d50652a4c6`。历史 epoch 夹具没有 Git 差异；本轮没有改动既有 v20 重录文件。

下一次在能读取祖先目录的 CI/本地环境复跑四分片，验证这 26 条环境阻断；不需要玩法或接口决策。
