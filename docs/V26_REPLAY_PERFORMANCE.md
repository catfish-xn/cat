# V26 replay 性能调查（2026-10-30）

结论：没有发现 V26 对局卡死或步数增长。慢点是基线已有的强化历史认证成本，以及晚期独立证据超过 8 MiB 后不再缓存的性能悬崖。`steps 11593-11600` 的失败是默认 5000 ms 超时，不是断言失败。已做等价缓存优化，并将筛选晚期用例所需的冷历史准备拆成有界钩子；没有改变原路线、断言、超时、认证要求或公开历史格式。

## 对照范围与方法

- 工作区初始 HEAD 为 `ad301c66`，工作区干净。它比指定的 `218fa472` 多一个提交，仅修改漂移报告和两个测试；`src/simulation/` 完全相同。
- 基线为用户提供的只读 `base9e` 源码副本，抽查源码和 oracle 与 Git 中 `9e3530c0` 的字节一致，没有修改副本。
- 两版使用同一个当前 `generate-m5-route.cjs` 驱动、独立 oracle、seed 42 和 `routeOptions`。原基线自带 oracle 在 2-1 的 `independent seen-once ledger` 已失败：生产给出 `snipers-nest/no-scout-no-pivot/visionary-crest`，旧 oracle 预期 `sorcerer-crest/not-today/voidcaller`。因此原基线测试不能直接产出整局统计；这里明确使用相同的已修正 oracle 作源码对照，全部独立账本/shop/RNG 断言照常执行。
- `scripts/profile-m5-replay.cjs` 只执行指定的 8 步片段，保留 helper 中的恢复、拒绝插入、资源/RNG 不变、完整字段与末边界比较。收集整局是准备数据，不执行完整 replay 测试文件。
- 脚本使用分段计时和 Node Inspector CPU profiler，生成标准 `.cpuprofile`。计时包含采样和同机路线收集的影响，不能把小幅差异解释为稳定的版本回归。

## 对局是否异常

| 源码 | 总步数 | 命令 | combat tick | 8 步用例数 | 结束 | 最长战斗 |
| --- | ---: | ---: | ---: | ---: | --- | ---: |
| 9e3530c0 | 14,677 | 217 | 14,460 | 1,835 | 6-7，victory，17 HP | 704 tick，4-1 |
| V26 未优化 | 14,436 | 217 | 14,219 | 1,805 | 6-7，victory，40 HP | 714 tick，4-1 |

V26 少 241 步（约 1.64%）。两版均为 33 场战斗，没有一场触及 1200 tick 的上限。oracle 的 `observe` 要求每个已记入步骤的命令成功；未出现某一步失败后反复重试。指定片段在 V26 是 6-1、tick 388 开始，在基线是同一回合、tick 102 开始；都不是卡住的回合。完整逐回合 tick、结算和 HP 记录在诊断脚本 JSON 中。

真正触发长历史的节点是 **2-1 的 snipers-nest**。`routeOptions('mage',42)` 只重掷 3-2/4-2，没覆盖 2-1；helper 中“避开历史型强化”的旧注释因此不准确。第 11593 步边界已包含 10,971 条历史事实、11,592 步 proof，以及约 2.38 MB 原生 JSON。

## 耗时曲线与热点

下表按相同采样顺序运行，各片段独立恢复自己的起点。由于采样点间相隔约 2900 步，表中的旧耗时包含补做这段历史的成本，并不等于全文件连续执行时的热缓存耗时。

| 片段起点 | 基线 / ms | V26 未优化 / ms | 优化后用例 / ms | 优化后独立准备 / ms |
| ---: | ---: | ---: | ---: | ---: |
| 1 | 135 | 226 | 243 | 2 |
| 2897 | 3608 | 4103 | 764 | 3112 |
| 5801 | 6416 | 6600 | 1675 | 4449 |
| 8697 | 8724 | 9271 | 2303 | 6578 |
| 11593 | 10775 | 11154 | 3154 | 7436 |

V26 的同一个终局片段 **14433-14436**：未优化 38,682 ms；优化后用例 2,330 ms，独立准备 7,570 ms，含准备合计 9,900 ms。这里用例约快 16.6 倍，含准备约快 3.9 倍。基线在 14433 后还有 8 步，不能把它的 58,682 ms 与 V26 的 4 步直接当作等量比较。

热恢复本身也变快：11593 片段的后 7 次 restore，未优化约 294–387 ms/次，优化后约 181–198 ms/次。越晚的候选历史越大，全部字段检查和断言仍会增长；没有通过取消检查把曲线变成常数。

V26 未优化的六个采样片段，CPU profile 合计约 70.17 秒；按调用栈去重后的 inclusive 时间如下（父子重叠，不能相加）：

| 热点 | CPU 采样时间 | 源码位置 |
| --- | ---: | --- |
| restoreMatch | 61.21 s | `src/simulation/serialization.ts:12` |
| 强化历史认证 | 56.76 s | 原 `augment-history-restore.ts:206`；现 `:249` 起 |
| advanceS13Tick | 40.62 s | `src/simulation/combat-s13.ts:186` |
| copyCombatUnitForTick | 5.47 s | `src/simulation/combat-static.ts:97` |
| canonicalSync | 3.95 s | `src/simulation/content/index.ts:103` |
| 强化历史 preflight | 1.57 s | 原 `augment-history-restore.ts:144`；现 `:166` |
| validateB8Resources | 0.268 s | `src/simulation/b8-restore.ts:488` |
| replayCurrentSuffix | 0.002 s | `src/simulation/b8-restore.ts:572` |
| planMeleeApproach | 0.087 s | `src/simulation/combat-movement.ts:69` |

第 11593 片段未优化的 11.15 秒中，restore 为 10.32 秒，原生 stringify 为 0.265 秒，断言为 0.478 秒；诊断用例没有调用 `serializeMatch`。主要不是 serialize，也不是 a4 的 B8 suffix 检查或新增 meleeApproach 认证。`advanceS13Tick` 在这里主要是认证时重新运行的战斗。

`augment-history-restore.ts` 在 `9e3530c0..218fa472` 没有源码变化；a1 对 solo 历史的相关分支不新增另一套全局重演。这是已有成本在修正 oracle 后暴露，不能据此归因为 V26 新增的恢复回归。

缓存悬崖的直接证据：旧 `rememberReplay` 将完整历史图、origin、命令、trace roster 和短节点文本计入 8 MiB 上限。11593 的“图 + 短文本”下限已约 7.83 MiB；14433 达 **9.19 MiB**，尚未算其余部分，必然走“不记入缓存”。于是 14433-14436 的五次恢复分别约 8.22、7.85、7.24、7.15、7.64 秒，每次都重建整个 proof。基线也有同样的上限和现象。

## 失败复现

原代码运行 mage 的 `1-8|5801-5808|11593-11600`：1 个通过，2 个超时。5801 用例 8207 ms，11593 用例 18098 ms，报错均为 `Error: Test timed out in 5000ms.`，定位到 `tests/m5-replay-helper.ts:71` 的 `it` 注册点。CPU/计时脚本执行相同片段的全部断言没有报错。用户观察的约 23 秒与这里同属冷重演的墙钟超时，并非另一个数值断言问题。

## 修改与等价性

- `src/simulation/augment-replay-facts.ts:5`：只在私有独立证据中对连续、同战斗、同资源前缀的空死亡边界作无损 run-length 压缩；逐项恢复 sequence/tick。非空死亡、字段扩展、回合/战斗/资源前缀变化均保留原行。公开存档和事件账本不压缩、不截断。
- `src/simulation/augment-history-restore.ts:52`、`:141`：缓存保留压缩 body/facts，恢复后才交给公共命令；保持原 8 项/8 MiB 限制、origin/参数/顺序和事实前缀绑定、负零冷路径、每次完整终态比较。候选对象不进入证据缓存。
- `src/simulation/augment-history-restore.ts:38`、`:166`，`serialization-structure.ts:151`：同一次私有 JSON.parse 图的早期 preflight 成功后复用该结果；作用域在 finally 中恢复，对象入口及嵌套 origin 保留原读取与校验行为。不同调用/不同候选没有 admission 缓存。
- `src/simulation/augment-history-restore.ts:291`：已解析候选和纯重建结果保留完整 finite-JSON 检查与逐字段相等比较，避免构造两个大 canonical 字符串；对象入口保留原 canonical 路径。
- `src/simulation/augment-history-restore.ts:238` 的 `prepareAugmentHistoryReplay(input): Generator<void,void,void>`：先 detached clone，执行原认证流程，每 256 条新命令暂停。完成全态比较后才记证据；抛出原认证错误，取消/失败不安装未验证终态。它不返回已准入存档，之后普通 restore 仍做所有候选校验。
- `tests/m5-replay-helper.ts:72`：每个原片段在 beforeAll 中分片准备独立历史，准备完成另加断言；原用例正文及所有断言不变。每片最多补齐该边界之前的 proof，`-t` 独立执行仍成立。没有调整 testTimeout/hookTimeout。
- `scripts/profile-m5-replay.cjs:13`：可复现诊断工具，分离 route 收集、历史准备和用例成本，并导出 CPU profile。

冷历史从开局重建仍然需要数秒到数十秒；准备分片没有让这部分计算消失。上表单独列出准备成本，不能只用用例的 3.15 秒声称一次冷恢复也只要 3.15 秒。应用现有同步恢复 API 的冷成本仍是已知限制。

## 新增与执行的验证

新增 `tests/m5-replay-evidence.test.ts:13` 的 3 个测试：15,000 行压缩的逐字段/原生字节无损性及不合并的边界；真实公共路线的压缩前缀复用、增量一步重演、候选/命令/origin/运行时篡改拒绝、恢复图隔离及对象 accessor 二次校验；有界准备、完整认证失败和候选隔离。

已完成的定向验证：

- mage 选定 5 个原用例（1-8、5801-5808、11593-11600、11601-11608、14433-14436）：5/5 通过。
- 四个相关文件筛选认证/恢复用例：31/31 通过，包括新增 3 个、原强化历史三入口 round-trip/事实家族篡改、实际死亡、动态运行时逐字段篡改与全部 melee approach restore 入口检查。
- 最终代码再次筛选 mage/sniper 晚期用例：3/3 通过；mage 11593-11600 为 3347 ms、mage 14433-14436 为 2179 ms、sniper 11593-11600 为 3325 ms，均低于原 5000 ms 上限。这里的墙钟不含各自准备钩子，准备成本仍按上表单列。
- 最后加强“准备暂停后外部修改候选”的断言后，新增文件单独筛选 3/3 通过。
- `npm run typecheck`、`git diff --check` 通过。

命令均使用 `--configLoader=runner --maxWorkers=2`；未运行完整 replay 文件、全套、vite build、纪元/golden 重录，未修改 src/server、界面、版本号或内容 digest，也未执行 Git 写操作。

## 复现命令与本地证据

```sh
node scripts/profile-m5-replay.cjs /path/to/base9e /tmp/base9e-profile mage
node scripts/profile-m5-replay.cjs . /tmp/v26-fixed mage 1,2897,5801,8697,11593,14433 prepare
npx vitest run --project fast tests/m5-replay-mage.test.ts tests/m5-replay.test.ts -t 'steps (11593-11600|14433-14436):' --configLoader=runner --maxWorkers=2 --reporter=json --outputFile=/tmp/v26-final-replay.json
```

诊断会复用同名 `.route.json`，需要新路线时删除它；本次优化等价性对照故意复用优化前同一批存档。它们含完整本地存档，不提交仓库。

本地输出：`/tmp/base9e-profile.log`、`/tmp/base9e-profile.cpuprofile`、`/tmp/v26-original.log`、`/tmp/v26-original.cpuprofile`、`/tmp/v26-fixed-final.log`、`/tmp/v26-fixed.cpuprofile`、`/tmp/v26-mage-before.log`、`/tmp/v26-mage-after.log`、`/tmp/v26-final-focused.log`、`/tmp/v26-final-replay.json`。

最终相关认证用例的筛选表达式为 `losslessly|reuses independent|prepares only|round trips acquisition|rejects add/remove/alter for each recorded fact family|solo live combat evidence|every nested runtime|canonical key ordering|dynamic replay rejection|immutable equal declarations|melee approach restore authentication`；文件为 `tests/m5-replay-evidence.test.ts tests/augment-history.test.ts tests/restore-validation-speed.test.ts tests/targeting-pathing-restore.test.ts`，命令其余参数同上。日志中的 skipped 是 `-t` 未选中部分，没有增加任何 skip 标记。

没有按要求禁止的方式测量完整文件耗时，因此不声称整片 CI 已达到某个分钟数。建议 Claude 审查私有压缩/作用域边界后提交，再由正常 CI 验证整片实际收益；旧纪元 unsupported-version/摘要漂移仍留给统一重录。
