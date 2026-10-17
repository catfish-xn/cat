# 探索者护臂恢复：P1 验证记录

验证日期：2026-10-17。修前源码为 `a01fb0b6b6589708dec972472a3a9b5fa027fea5`，修后为本记录所在提交源码。分支保持 `codex/explorer-bracer-restore-fix`，基于 #147；未合入 #153。去重辅助函数直接参照 #153 的 `617b1da98af28e18cfec216fe8123facc96da5be`。

## 修复与边界

- P1-1：当前法强与计数之间的等式不是事实证明。恢复先验证开战输入及装备来源，再在隔离 Combat 中重建到目标 tick，精确比较相关持有者的完整 trigger ledger：owner、装备 instance、效果块、触发种类、processed 和 actionCounts 都必须一致。候选分配发生在这一步之后。重建不使用候选 HP、法强、计数或 RNG，也不把验证状态、效果或事件写回原局。
- P1-2：在任何护臂层数数组分配之前拒绝超界计数。完整恢复的击杀/助攻上界为可信初始单位数加 `tick × 初始 Forge 数`：当前内容只有 Forge 能复活，且每次 Jayce 施法至多复活一次、每单位每 tick 至多一次施法。独立候选调用也先检查战斗时钟、棋盘容量上界和对应来源的 actionCounts 总数。超过上界直接拒绝，不截断合法层数，不使用 MAX_SAFE_INTEGER 作为枚举上限。
- 每次合并候选都用 `(fixed, flat, bps)` 去重，保留最终乘法、向下取整和 fixed 加法的顺序。泰坦的真实 25 层声明保持原样。
- 未修改规则、数值、digest、存档格式、MATCH_CONTRACT、服务器、渲染、CI 配置或既有夹具。只运行下列相关测试，未运行全套。

## 负例与合法控制

每类端到端反例都先恢复公开命令生成的合法控制组，并比较续战终态、完整事件和 RNG。

| 输入 | 修前 | 修后 |
| --- | --- | --- |
| tick 0 凭空构造护臂击杀收据及 AP20 | 接受 | 拒绝 |
| tick 410：count 2→3，AP40→60 | 接受 | 拒绝 |
| 上述修改再加 nextAttackMagic 1530→1710 | 接受 | 拒绝 |
| Lux 击杀转给 Irelia，并重建 owner、装备实例、key、processed、actionCounts | 接受 | 拒绝 |
| 同时重写 count、AP、采样伤害、processed、actionCounts | 等式校验不能证明真实性 | 拒绝 |

此外保留原有非法当前法强、额外整层、缺层、非法采样伤害、未获得助攻、缺失收据、独立装备实例、混合 15/20 法强及声明上限测试。

## 内存与耗时

复现命令：

```sh
node scripts/profile-explorer-bracer-restore.cjs huge-count
node scripts/profile-explorer-bracer-restore.cjs dedup-titan
```

两个版本都用独立 Node 子进程及 `--max-old-space-size=256`，避免旧版 OOM 杀死测试进程。Linux `getrusage(RUSAGE_CHILDREN).ru_maxrss` 测量整个子进程的峰值 RSS，包含公开控制组生成、原生内存和堆；计时只覆盖恢复或枚举。修前内存是受控 OOM 时的已观测峰值，不是无堆限制时的最终峰值。

| 场景 | 修前峰值 RSS | 修后峰值 RSS | 修后耗时与结果 |
| --- | --- | --- | --- |
| count=5,000,000，abilityPowerFlat=100,000,000 | 492708 KiB / 481.2 MiB，OOM | 93844 KiB / 91.6 MiB | 10.7 ms，`sampled stat trigger count bound` 拒绝 |
| 12 份真实泰坦声明，原始组合数 26^12 | 413252 KiB / 403.6 MiB，OOM | 189788 KiB / 185.3 MiB | 15.2 ms；301 个 AP 值、271 个取整后 AD 值 |

第二个场景是候选算术压力测试，不把十二件装备伪装成合法 Match 存档。使用真实泰坦声明，上限为每件 25 层；AP 范围为 100..700，Irelia 的 45 基础 AD 经原顺序取整后为 45..315。

## 相关测试

以下 15 个文件共 277 项通过，没有 skip；另运行 `npm run typecheck` 和 `git diff --check`。最后在完成源码整理后，再跑两份护臂文件，26 项通过。

```sh
npm test -- tests/explorer-bracer-restore.test.ts tests/explorer-bracer-restore-pressure.test.ts tests/g2-4b-artifacts.test.ts tests/m8-b10-item-save-replay.test.ts tests/m8-b8-restore.test.ts tests/m8-b3-restore.test.ts tests/m8-b3-audit.test.ts tests/m8-b4-audit-regressions.test.ts tests/m8-b3-third-audit.test.ts tests/p7-restore-compilation.test.ts tests/g2-3-anomalies.test.ts tests/g2-3-traits.test.ts tests/m8-g09.test.ts
npm test -- tests/m5-serialization.test.ts tests/m8-b8-restore-fold-reuse.test.ts
npm run typecheck
git diff --check
```

重建成本受 1200 tick 限制，且只对拥有相关固定属性叠层触发声明的战斗执行；本次没有引入跨恢复调用的候选状态缓存。合法存档的继续战斗结果不变。
