# 探索者护臂：同动作多目标参与击杀（2026-10-17）

分支 `codex/bracer-multikill-stacks`；起点 `02adf7c8ed2c23497f9d63d4483c389e2059158c`（PR #158）。本轮只做用户批准的护臂规则修复和相关测试；不跑全套、不升版本/revision、不重录夹具。

## 原始来源与独立预期

原始 `src/simulation/content/source/s13-14.24b/raw/en_us.json.gz`，对象 `TFT_Item_Artifact_SeekersArmguard`：

> Takedowns increase the holder's Armor, Magic Resist, and Ability Power by @StatsPerTakedown@, increased to @StatsPerKill@ if they score the kill.

`StatsPerTakedown = 15`；`StatsPerKill = 20`；基础 AP/Armor/MagicResist 各30。原文按参与击杀计数，没有“同一次技能最多一次”的限制。两个目标被本人击杀应为 20 + 20 = 40；两个助攻应为 15 + 15 = 30；击杀与助攻条件互斥，不能同一事实同时获得两种加成。
原始压缩文件 SHA256 `7e0e2d41a806833f6f18e5752c0d5eea4fa3a74e75b61c1c54853de74c2ac5d2`。来源镜像 `content/g2-4-artifact-source.ts` 数值相同，未改源数据。

## 实现

- `content/g2-4-artifacts.ts`：只有护臂 kill/assist 两个声明设置 `actionLimitScope: 'target'`；数值、条件和效果保持原值。
- `m8/triggers.ts`：内部 `TargetLimitedTrigger` 可选扩展；启用时 actionCounts 键由 `[effectIdentity, triggerId, actorId, rootActionSeq]` 加上第5项 targetId。同动作不同目标独立记数，同目标重发事件仍只有一次。未启用者保留原4元键和 maxPerAction 行为。
- `m8/item-program.ts`：声明校验只允许 kill-or-assist 使用该范围。未修改冻结 `contracts.ts`。
- `m8/item-restore.ts`：候选统计根据可信编译声明核对4/5元键，5元目标必须是非空字符串；完整保存恢复仍由 #158 `validateSampledStatTriggerFacts` 从已验证开战输入重建真实战斗，逐项比较整个 ledger，故凭空目标、目标替换、旧键、虚构计数均不能以总AP相等绕过。
- #158 的次数上界、逐轮候选去重保持不动。测试中的纯算术候选构造和恶意伪造键同步为新的目标键，未削弱反例。

## 真实双杀与恢复

`tests/bracer-multikill-stacks.test.ts` 使用公开准备路径（默认种子3151248），通过合法 `grantMechanicUnit/Item`（来源 `test`，明确不是自然掉落）、equip/deploy/start命令取得3星Lux、护臂、卢登、光明帽；不改战斗状态、属性、敌人或RNG。
S13 Lux本身是护盾＋强化下一次普攻，并非AOE大招。本例由其强化普攻造成击杀，再由真实卢登溅射联动：tick143、rootActionSeq20，同刻击杀 `enemy-r4-1` 与 `enemy-r4-2`。两条致死包分别为 ability-direct 和 equipment-proc，二者同根动作。
断言两目标、一个rootAction、实际计数0→2、护甲/魔抗/法强各+40。分别保存双杀前后，用原始对象与JSON生产恢复，然后完整续战对比状态与事件（包含RNG）。
另测同目标新eventSeq重发、完全同eventSeq重发均不增加；kill/assist互斥；全装备目录只有护臂启用新范围；旧动作范围仍只允许一次。补三种结构伪造：不存在目标、重复目标、旧4元键，均在总AP和triggerCount未改情况下拒绝。

## 验证

Node24.19.0 / npm11.9.0；相关文件逐个执行 `npm test -- tests/<file>.test.ts --reporter=default --reporter=json --outputFile=<path>`，使用 GNU time1.9 `-v` 记录RSS（可执行文件位于临时提取目录，未修改系统安装）。
最终相关测试16文件：13文件全过；3文件为未迁移旧夹具失败。总计195项通过、139项失败（全部旧夹具身份/源码审计指纹差异），无跳过；没有全套运行。
新回归9/9；#158恢复24/24保留四类反例：计数/AP/采样联动伪造，重建processed/actionCounts仍伪造，tick0虚构击杀，转移Lux击杀给Irelia；压力2/2保留500万层/1亿AP快速拒绝与12件泰坦精确候选约束。

|文件|通过|失败|峰值RSS KiB|
|---|---:|---:|---:|
|`tests/bracer-multikill-stacks.test.ts`|9|0|398484|
|`tests/explorer-bracer-restore.test.ts`|24|0|578952|
|`tests/explorer-bracer-restore-pressure.test.ts`|2|0|181600|
|`tests/g2-4b-artifacts.test.ts`|48|0|429580|
|`tests/m8-b4-trigger-ledger.test.ts`|2|0|145604|
|`tests/m8-b4-audit-regressions.test.ts`|14|0|516636|
|`tests/m8-b4-bow.test.ts`|7|0|250940|
|`tests/m8-b4-tear.test.ts`|9|0|259516|
|`tests/m8-b4-sword.test.ts`|8|0|244596|
|`tests/m8-b3-restore.test.ts`|13|0|353068|
|`tests/m5-serialization.test.ts`|33|0|295116|
|`tests/m8-b8-restore.test.ts`|7|0|338344|
|`tests/m8-b8-restore-fold-reuse.test.ts`|5|0|280232|
|`tests/m8-content-equivalence.test.ts`|2|2|358196|
|`tests/opening-random-identity.test.ts`|3|136|486028|
|`tests/c19-missed-pulse.test.ts`|9|1|299148|

旧夹具失败明细：
- m8-content-equivalence：2个旧cannon/sniper恢复 `content-digest`。
- opening-random-identity：134个旧存档 `content-digest`，1个内容摘要断言，1个源码审计hash断言。
- c19-missed-pulse：1个旧战斗归档 `content-digest`。
没有据此放宽校验或更新夹具。最终 `npm run typecheck` 通过。

## 交接限制

当前编译内容自然算出 `fnv1a32-utf16:408a0aa6`（旧夹具 `fnv1a32-utf16:b58e35ae`）。本轮没有修改 digest 代码、版本或revision，声明改动的自然摘要差异不能说成“内容摘要未变”。旧护臂4元 actionCounts 与新声明不兼容；等用户通知合并顺序后必须统一升版本、迁移夹具，不能直接发布本分支为已完整验收版本。
本次不涉及server/rendering，不改CI阈值、超时，不扩大跳过。bundle只供交接，不自动合入。
