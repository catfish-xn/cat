# PR168：测试分层迁移与单次恢复历史复用

## 固定版本、范围
- 分支 `codex/restore-fix-batch-b`；起点/本轮已读远端 `4cd482226b992e04db7c2d6d0336b8d3b0e64b78`。
- 首步类型 guard 提交 `badecaab1457c824e7fb44f67af15bd5f5faddf0`；最终受测代码提交 `1b72395e5b61e16e0889c3e97da0c072b6048111`。
- 远端 multiplayer 核实为 `4ad4e83df584dee8ff7d4113c935ec03c8cca291`；本轮没有合入该新基线。保留上轮合并父与证据记录，不改历史。
- 本轮按用户 10-17 授权修改人工 fixture 的入档期望，并单独保留真实生产下游校验。没有新增测试时限、规则数值、版本、跳过或 CI 门槛变更；没有全套或 GitHub CI 结果。
- Node v24.19.0 / npm11.9.0 / Vitest5.0.3。原共享 node_modules 缺 @types/node，初次 typecheck 报环境错误；在本工作树按现有锁文件 npm ci（临时 npm cache）重新安装后通过，没有修改 package/lock。

## 恢复路径修复及信任边界
`serialization.ts` 在提供 battles 时先完成原结构与机制校验，再在同一同步调用内执行 `validateRestorationHistory`。每条记录的开战 context 必须先由 B seed 命令账本验证，之后才允许使用内部 recorder-owned、已验证的真实战斗结果；真实结算结果的独立副本推进同一私有账本验证器。原完整 history carry、装备命令、资源、事件、hash 与当前候选金币/经验/商店/随机流/事件序号比较均保留。缺账本仍明确拒绝。

`validateBattleFacts` 是把原生产重放校验体提取为模块导出，原 Match 入档仍先完成结构和 B 校验。函数本身仍核形状、版本、身份、完整战斗、装备命令、事件、结果和 hash；它不声明开战获取途径合法，不创建 owned/cache 品牌。`checkHistoryCarry` 仅增加模块导出，原逻辑不变。没有新增 server-entry 对外接口。

新增反例：已 warm 的 owned 首场之后，下一准备期 gold+1 对象/JSON/serialize 均具体 B 拒绝；外部第二场 context gold+1 拒绝；缺账本+battles 拒绝；getter 提供的伪造 context 只读一次且拒绝。原 count=1 断言未改变。

### 仍未完成的重复重演角落
原请求 equip slot2 被档案规范化为有效 slot0 时，两份完整命令输入不同。保留严格 fallback，因此该类轨迹仍可能重打战斗。不能把档案结果相同当作账本相同，也没有回填/改写存档账本。指定原 crown-cache 一次重演用例通过，不承诺所有装备归一化轨迹都只重放一次。

## 测试分层及未完成的公开获取
实际入档层：人工 grant 的旧正控在对象、JSON 和 serialize 入口断言具体 `preparation-ledger-command-rejected`（其他篡改若在更早严格校验被拒，保留该真实拒因）。
下游层：只调用真实生产 validator 或真实战斗重放，helper 返回 void；续战明确由测试自行复制原输入，不把复制对象称为已恢复状态，不经 no-op restore/伪 VerifiedReplay 绕账本。

真正公开迁移：普通 warmog 改为 seed162 公开组件奖励与合成；上轮 seed26 两种重铸器继续通过实际公开取得库存、对象/JSON完整恢复及逐 tick 续战。类型 guard 正确收窄 combine 成功结果。

【自行决定及未完成】普通物品不等于固定首战人工构造可达。原双剑/deathblade、固定 item 编号、首战 endTick164/240 等场景无法同时保持原断言并从空背包公开取得；这部分保留下游机制覆盖及真实入档拒绝，未声称全部普通 fixture 已公开化。首战三冠、早期神器/宝箱同样不证明自然获取或完整恢复。此前公开单冠探索只达到396层；三冠单人上界与来源限制沿用此前报告，不新增伪造合法来源。

M9三组移 tick：新增 B 账本与旧领域状态不是同一语义。仅把新增 preparationLedger 从旧领域整状态比较中独立出来，其余所有字段仍完整比较；另逐项核原命令前缀、移动后的 start/step/equip 命令、具体 Match 事件排序（tick69因揭示事件先发生而改变），并在下一场每 tick 核各自历史前缀不变及新增命令/事件尾段完全相同。这是明确的测试分层，不是忽略账本，也不改冻结玩法。

## 脚本、旧 Herald 与版本
依次执行：
1. `node tests/fixtures/record-g2-3-herald.cjs`：5个真实公开轨迹生成、生产恢复与15续算tick验证成功；最终与旧 raw 字节比较失败，整体退出1。未使用 --write，manifest也未重写，不能称 Herald 指纹整体通过。
2. `node scripts/record-g2-3-inputs.cjs`：退出0，9cases，digest `fnv1a32-utf16:cf9dcfe5`，未产生差异。
3. `node scripts/record-g2-3-inputs.cjs --check`：退出0。
`tests/fixtures/g2-augments-herald-raw` 与 origin/multiplayer 字节相同，本轮未迁移任何旧 raw。B7的5个旧fixture缺账本仍保留原测试失败，待统一版本与夹具迁移，不作为永久可忽略失败。合并前需统一处理 save/schema、规则/内容版本身份及依赖指纹（具体版本值由合并顺序决定）；本轮未升级。

## 证据口径
最终逐项结果及固定SHA见下文自动汇总。中间每轮失败/类型错误/脚本失败均在 logs 中保留。新增6文件基线来自独立 detached worktree 固定4cd4822；不使用有并发编辑风险的初次诊断作基线。其它原19文件计数引用此前固定32849209及cd9b83b报告，明确不是本轮全套。

## 最终相关验证
固定代码1b72395，15文件237项：232通过、5失败、0跳过，命令原日志总用时135.90秒。失败均为原B7旧Herald `preparation-ledger-missing`，其余14文件通过。每条耗时与错误全文见logs/b-final-related.json；未跑全套。

|文件|修前通过/失败及版本|1b72395通过/失败|文件断言区间ms|
|---|---|---|---|
|chest-bracer-integration-trial.test.ts|1/10 @4cd4822|21/0|19329|
|crown-restore-cache.test.ts|3/1 @32849209|6/0|563|
|explorer-bracer-restore-pressure.test.ts|2/0 @4cd4822|2/0|551|
|explorer-bracer-restore.test.ts|9/15 @4cd4822|26/0|6403|
|g2-4a-crown-gold.test.ts|8/1 @32849209|12/0|1635|
|g2-4a-crown-history.test.ts|8/48 @cd9b83b|56/0|36841|
|g2-4b-artifact-forge.test.ts|5/2 @4cd4822|7/0|3482|
|g2-4b-pr161-restore.test.ts|2/9 @4cd4822|11/0|9844|
|g2-4b-resists-restore.test.ts|15/6 @32849209|25/0|4927|
|m8-b7-match-wiring.test.ts|25/5 @32849209|25/5|25085|
|bounds-preflight.test.ts|14/2 @4cd4822|16/0|11699|
|preparation-history-cache.test.ts|原安全回归保留，见此前报告|1/0|663|
|preparation-ledger-scope.test.ts|原安全回归保留，见此前报告|4/0|938|
|preparation-ledger.test.ts|原安全回归保留，见此前报告|16/0|960|
|verified-restore-cache.test.ts|原安全回归保留，见此前报告|4/0|195|

文件时长为JSON该文件start/end范围；CLI最终总时长含加载等开销，二者不能混用。

### 小范围末次补充
15文件跑完后补双holder人工获取的独立object/JSON/serialize B拒因；另外把forge原有restoreDomain改为void validator，显式测试自己的JSON复制，不再误称恢复。补充提交ad1e26b第一次遗漏两处void返回值使用，记录为1项失败/typecheck失败；随后59885eb纠正这两处，原数值/断言不减。全部失败日志保留，只重跑受影响文件，未重复其它无变化文件。最终结果见末次附记。

B7指定冷恢复与bird实际耗时（原获准20s不变）：
- B7 installed encounters and trusted Match restore 4-7 freezes, starts, runs to settlement and resumes canonical saves: 4257.587851999997ms，passed
- B7 installed encounters and trusted Match restore 5-7 freezes, starts, runs to settlement and resumes canonical saves: 6127.278065999999ms，passed
- B7 installed encounters and trusted Match restore 6-7 freezes, starts, runs to settlement and resumes canonical saves: 1932.8270060000068ms，passed
- B7 installed encounters and trusted Match restore 6-7 separates captured initial events from tick-zero opening moves committed by the first step: 284.301489999998ms，passed
- B7 installed encounters and trusted Match restore rejects replayed, removed, cancelled and geometry-mutated opening consumption for 6-7: 594.6468710000045ms，passed
- B7 installed encounters and trusted Match restore restores real bird next-tick reactions and rejects changed effects, death identity and missing consumption: 3574.6591719999997ms，passed

### 最后实际代码与验证版本
最终代码 SHA `59885eb430d6b3b2f7909f72b34979e6d8bd4ebc`（生产源码与1b72395完全相同，仅后续两文件测试语义澄清）。
- ad1e26b：bracer26/26，6982.387ms；forge6/7，漏改void调用1失败，typecheck退出2；保留日志。
- 59885eb：forge7/7，3744.095ms；最终typecheck退出0。
- 其余13文件复用同一生产源码1b72395的最终单轮结果；综合仍232过/5旧fixture失败，不冒称59885eb重新执行全部15文件。
- 远端只读核实见logs/b-final-remote.log。本轮沿用此前平台配额拒绝，不重试push或替换凭证；本轮没有新的push失败记录。交付增量bundle，以4cd4822为前置；没有合并授权。
