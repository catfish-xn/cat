# B 批性能收尾：局部顺推与真实战斗证据复用（仍有阻塞）

## 固定版本与结论

- 起点：`f0f060bf9923f4ea045f379d6db3d4d4997237c7`。
- 初版代码：`d018488ed65f064d6efa002d52305ca97995b78a`；最终代码：`27d47a480f5fad6c459b7e244f44566ab73f1fa3`，同一分支 `codex/restore-fix-batch-b` 追加提交。
- **部分目标达成，尚不可签收/合入。** collection 不再为每个 context 从 seed 重打全部历史，已通过 33 场完整公开路线及完整历史验证；B5 原归档 hook 和原未执行反例通过。
- **独立 API 多次调用仍超时。** 每次 `restoreMatch` / `serializeMatch` 各自完整重演一次，没有跨调用缓存；B5 若一例含三组 `restoreMatch(serializeMatch(state))`，仍需六次真实历史重演。

## 实现与可信边界

1. `createMatchRestoreSession` 仅由一次 collection 调用持有；显式闭包传入 record 校验，没有模块级“当前 scope”，异步 yield 不影响独立恢复。
2. 重用状态全部由该闭包从 seed 执行真实公开命令生成。比对 seed 和全部规范命令前缀，包含参数、重复 tick 次数；不信任存档 checkpoint、余额或中间阵容。短前缀仅取实际捕获的开战前状态，否则重新从更早可信点重演。
3. 每次恢复仍执行原结构、内容、运行态校验，并在独立 clone 上核对账本完整状态。缓存命中不省略金币、XP、商店、四 RNG、事件/序号、收据/资源等对照；旧档缺账本拒绝原因不变。
4. collection 顺推时采集真实开战 context、initial、完整 combat 事件及终点。record 必须以完整 canonical context 与 endTick 命中；保留 shape/version、tick0、完整事件、序号、result 和全部 hash 核对。proof 返回独立 clone；修改返回对象不污染内部。
5. 战斗期间合法装备命令若保持同一个 combat 对象，可继续同条 proof 链，记录真实命令发出的事件。单人锁店/买卖在 combat 阶段本来不合法，未改变操作规则。若其它路径不能证明连续性，仍走原完整验证；不为减少调用数放弃验证。
6. 没有改规则、数值、digest、版本、合同、超时、门禁或 skip。未改 server/rendering。前轮记录的统一版本升级事项仍适用。

## 无插桩比较（各一次，不具统计显著性）

4-5 相同真实公开路线，22 轮、7216 combat steps：

|版本|准备 ms|单次 restore ms|
|---|---:|---:|
|优化前 f0f060|3626.211|2840.064|
|局部 scope 实现后|3548.360|2629.058|

独立 restore 本来就一次顺序重演，以上差异不能称消除性能回退。该测量在增加 collection proof 前进行；独立 restore 不开启 proof 采集。源程序在 `4-5-measure-source.txt`，临时放入 tests 单独运行后移出，未加入默认 suite。

33 场 cannon / seed 42，原公开命令生成器，不改状态、不裁剪：

|阶段|准备 ms|单次 restore ms|完整 collection ms|
|---|---:|---:|---:|
|scope 已消除重复历史，但 record 仍各重演一次|10267.227|5405.994|11603.055|
|scope + 实际战斗 proof|11214.454|5419.452|6403.886|

两行是不同生成运行，全部成功并断言 33 场；不是性能门禁结果。诊断另启 V8 精确函数计数：collection 的 `stepMatchImpl` 实际 **8703 次**，恰等于该合法完整账本 **8703 steps**。取证运行 collection 12960.814 ms，受插桩影响，**不得替代无插桩 6403.886 ms**。

复现（仓库根目录；仅诊断，无阈值调整）：

```sh
node_modules/.bin/esbuild docs/evidence/restore-audit/batch-b/performance-followup/33-round-source.txt --loader:.txt=ts --bundle --packages=external --platform=node --format=cjs --outfile=./batch-b-33.tmp.cjs
node batch-b-33.tmp.cjs
```

计数时将输入换为 `33-round-count-source.txt`。输出写 `/tmp/b-ledger-33*.json`。真实命令路线来源 `scripts/generate-m5-route.cjs`，历史记录来源原 `CompletedBattleHistory`；全部战斗、状态、事件不删减。

## 验证及全部失败记录

- 阶段修订相关集：5 文件 **44/44**，包括原 MA1/MA2/MA2b、seed 1/42、对象/JSON/collection/envelope、合法逐 tick、dynamic getter、m6 replay 事件/结果/拓扑等；全量未跑。
- 新 scope 文件 4 项：seed/分叉/短前缀隔离，正常与战斗中装备轨迹每一步只重演一次，proof clone 修改隔离，collection yield 期间独立失败调用隔离，伪造 record hash 拒绝。
- typecheck 最终通过。过程中新增测试用 readonly 字段直接赋值产生 TS2540，改成篡改测试惯用 Object.assign；保留失败日志。44 项运行后仅此测试写法等价修正，固定 SHA 后新 scope 4 项另验。
- B5 整文件第一版 scope 结果：**3 通过 / 6 失败 / 0 未执行**。全部失败为原 5000 ms 限制：历史 level5→7 5925 ms；两条历史轮上下界 5668/5415 ms；当前/结算/历史连续恢复 16172 ms；同轮首次装备 11065 ms；经济先于等级验证 5001 ms。
- 这些不是噪声豁免，未通过仍保留。原 beforeAll 超 10000 ms 的归档组已通过，并执行此前未执行的伪造历史反例。
- 增加 proof 后，定向执行原归档反例通过，原 hook 10000 ms 不变；`-t` 未选中的 8 项显示 skipped 是本次筛选，源码没有新增 skip，不能记作全文件通过。
- 新装备路径测试首次误用 createMatch 立即就有装备，实际初始 items 为空，失败已保留。改用合法公开奖励准备 helper 取得 vest，再真实开战装备；未改生产模板或授予规则，4/4 通过。

所有记录见本目录 `logs/`；旧失败与 profile 仍保留在上级，不被覆盖。33 场计数在最终装备连续性小修前运行，该路线无该插入路径；小修由新增真实装备路线验证，不宣称重跑过 33 场。

## 剩余阻塞与建议

本轮关闭 collection 的重复历史前缀开销和原归档 hook 超时，但不能用这些通过关闭独立恢复多次调用超时。禁止跨调用缓存条件下，每个公开 API 仍需证明自己的输入。后续需单独评估更低成本的、绑定实际已结算事实的经济重演设计或完整战斗本身等价性能优化；不能用未验证存档快照替代重打，不能仅调整测试组织让六次验证跑到计时外。当前保留 WIP，不宣布可合入。

## 最后只读检查后的语义收窄与复验

- `3661ef19c541526f0e303a5e7f0ef89a26fa5179` 将非 step proof 续接限制为 `before.phase === 'combat'`，避免把战后选择/装备并入即时结算 proof。
- 此检查暴露新装备正控实际使用了空棋盘：开战立即结算，因此原测试虽通过却未测真实战斗中装备。已保留失败，最终 `27d47a480f5fad6c459b7e244f44566ab73f1fa3` 用合法 deploy 上场后开战，显式断言 phase 为 combat，再装备并续战。所有 step 次数、proof 隔离和篡改拒绝断言保留。
- 同一提交明确 TypeScript 命令联合类型及失败结果分支，原拒绝字符串不变；未增加宽松路径。
- 最终受影响 scope + m6-replay **13/13**，typecheck 通过；其余31项复用前述同生产核对逻辑证据。未声称最终版本重新运行全部44或B5整文件。
- 4-5 前后各一次测量属于中间版本；最终独立 restore 路径未启用 proof，数据仅说明单调用历史重打仍是瓶颈，不能充当最终版本性能签收。
- 33 场无插桩/计数证据同样来自上述 phase 收窄前；真实战斗中装备最终用新增精确测试验证。33 场正常路线历史逐项校验的已通过证据保留，不伪称该最终 SHA 重新跑过。
- 最后 `git ls-remote` 只读核实远端分支为 `f0f060bf9923f4ea045f379d6db3d4d4997237c7`；本次未重试此前额度阻断的推送，交付 bundle。
