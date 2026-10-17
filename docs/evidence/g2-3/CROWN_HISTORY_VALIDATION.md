# 冠冕历史恢复 M1（方案 A）验证记录

基线提交：12d71a11b26b4e972778ca53732cb322a14af8ba。分支：codex/g2-4a-crown-win-gold，PR #157。

## 改动和调用方迁移

- 从原 serialization 提取结构校验，逻辑逐字比较（忽略函数名、注释和换行）未变。新增 simulation/battle-record-validation.ts，复用原逐 tick 回放，按顺序绑定开战来源账本、胜负、经济收据、机制收据和资源来源前缀；不信自报 crowns 与 RNG 的相互自洽。
- restoreMatch(input, battles?)、serializeMatch(state, battles?)：冠冕历史声明必须提供完整已完成 battles。孤立冠冕 Match 报“missing historical evidence / 缺少冠冕历史证据”。无冠冕声明的孤立 Match 保留原结构恢复接受条件；有历史参数则完整验证。
- validateBattleRecord(record, priorBattles?)、PlaybackSession(record, priorBattles?)：传该战之前的完整历史。BattleHistory 的当前战斗恢复和 MatchApplication 打开回放已接入。
- validateBattleCollection / Sync、归档 admitArchives 核对整段历史；validateEnvelope / validateFile 强制执行集合验证，空附加回调也不能绕过。routeSaveFile 仅分流，不能作为续玩权限。
- MATCH_CONTRACT.md 更新旧恢复描述，并新增“G2-4a 冠冕历史恢复 API（M1，方案 A）”：参数、缺证错误、逐轮验证、迁移方法与缓存边界。S1 已注明联机数量上限只证明拥有量；S2 两份文档注明冠冕推进共享 RNG、改变后续黑市结果。
- 不改规则／数值、存档字段、digest、版本、夹具、服务器／渲染代码、S3 白名单、超时或门槛。未合并 #148；等待用户后续指令再合并并升级 v6。

## 回归结果

无冠冕 seed 42 对局跨轮后，伪造 crowns:84，同步重算 RNG、经济收据、金币和机制收据，多拿 5 金：自洽进度校验仍通过，但文本／对象恢复（无历史及附真实历史）、同步／异步集合、文件／对象导入、兼容查询均拒绝。后一战使用伪造历史上下文也被拒绝；单条回放入口不能自我授权。

控制组使用公开 grantMechanicItem、equipItem、startMatchCombat、stepMatch、selectChoice、nextRound 生成来源账本和回放（冠冕测试赠予 source:test，不伪造战斗事实）。无冠冕及 seed 1、42 的三冠冕组均通过：文本／对象／文件恢复完全一致，续战全状态一致，缺历史和破坏来源账本均拒绝。新回归共 6 项全部通过。

## 测试范围

原审查 26 文件 477 项已覆盖；新增回归及入口／缓存／兼容／存读档相关用例后，去重为 **35 文件、600/600 通过、0 跳过**。另 npm run typecheck、npm run build:server、git diff --check 通过。全套未跑，交 CI；S3 白名单未改。

主测试命令：node node_modules/vitest/vitest.mjs run --project fast <下表相关文件> --maxWorkers=1。分批执行，JSON reporter 原始结果保存在工作目录；修前／修后计时使用相同的五文件命令。TEMP/TMP 指向工作目录 test-temp 以避开 Windows 缓存重命名权限问题。未改测试超时、阈值或 skip。

| 测试文件 | 通过数 |
| --- | ---: |
| tests/g2-3-content.test.ts | 10/10 |
| tests/g2-3-followup.test.ts | 11/11 |
| tests/g2-3-identity.test.ts | 14/14 |
| tests/g2-3-integration.test.ts | 18/18 |
| tests/g2-3-netcode-hooks.test.ts | 14/14 |
| tests/g2-3-source-pins.test.ts | 2/2 |
| tests/g2-4a-conqueror-items.test.ts | 6/6 |
| tests/g2-4a-crown-gold.test.ts | 9/9 |
| tests/g2-4a-crown-history.test.ts | 6/6 |
| tests/g2-4a-crown.test.ts | 6/6 |
| tests/m5-replay-sniper-caitlyn.test.ts | 1/1 |
| tests/m5-replay.test.ts | 1/1 |
| tests/m6-replay.test.ts | 9/9 |
| tests/m7-m6-save-compat.test.ts | 8/8 |
| tests/m8-b8-resource-provenance.test.ts | 64/64 |
| tests/m8-content-equivalence.test.ts | 4/4 |
| tests/m8-contracts.test.ts | 6/6 |
| tests/match-contract.test.ts | 12/12 |
| tests/opening-random-identity.test.ts | 139/139 |
| tests/t12-combat-equip.test.ts | 48/48 |
| tests/t12-offline-transfer.test.ts | 1/1 |
| tests/t12-recovery-boundary.test.ts | 5/5 |
| tests/t2-two-sided-battle.test.ts | 21/21 |
| tests/t3-round-settlement.test.ts | 10/10 |
| tests/presentation/g2-4a-crown-display.test.ts | 1/1 |
| tests/server/g2-3-replay-mirror.test.ts | 1/1 |
| tests/server/two-sided-resolver.test.ts | 13/13 |
| tests/g4-replay-snapshot.test.ts | 4/4 |
| tests/m8-b3-audit.test.ts | 6/6 |
| tests/m8-b9-compatibility.test.ts | 11/11 |
| tests/b8-resumable-battle.test.ts | 15/15 |
| tests/m6-persistence.test.ts | 44/44 |
| tests/m8-b10-item-save-replay.test.ts | 45/45 |
| tests/m8-b7-cleanup.test.ts | 5/5 |
| tests/m8-b7-match-wiring.test.ts | 30/30 |

## 耗时对比与风险

环境：Windows / Node v22.17.0，同机单 worker，修前与修后各测一次，计时批次没有其他本任务测试并跑。以下是用例 duration 合计，不含模块加载／夹具准备，不是 CI 满负载模拟。

| 文件 | 修前用例合计 | 修后用例合计 | 变化 |
| --- | ---: | ---: | ---: |
| b8-resumable-battle.test.ts | 18.392 s | 21.401 s | 16.4% |
| m6-persistence.test.ts | 1.453 s | 1.554 s | 6.9% |
| m8-b10-item-save-replay.test.ts | 18.459 s | 18.955 s | 2.7% |
| m8-b7-cleanup.test.ts | 0.073 s | 0.074 s | 1.3% |
| m8-b7-match-wiring.test.ts | 9.941 s | 10.029 s | 0.9% |

B7 单项：quicksilver 0.788 → 0.893 s（+13.4%）；edge-of-night 0.788 → 0.908 s（+15.2%）；6-7 全战存读档 1.067 → 1.100 s（+3.1%）。B7 文件总体 +0.9% 不能掩盖这些单项增长；B8 合计 +16.4%。单次前后测不能确定增长全由代码造成，CI 满负载本已接近 20 秒，仍可能超时。没有放宽门槛。冠冕历史恢复必须重演历史，冷导入开销随历史长度增加；仅 recorder 拥有的不可变、已验证记录可复用单场结果，跨轮前缀每次仍检查。

逐项原始耗时和回归名称见 crown-history-validation.json。全套／CI 满负载性能、#148 合并、v6 升版与夹具重录均尚未执行。
