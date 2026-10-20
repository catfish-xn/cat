# PR #192：M3 占格语义收窄

基底：`a4871fa8a290fd9371ff9d2014e3c3d04bc1fc53`；修订起点：`efced3f189f0a84aa1b4fa4b757bb74c6ca8ef7c`。

## 逐处对照

以下仅列单个单位是否占格的条件；原有 ID 排除、距离、区域和坐标条件不变。
`P = alive && hp > 0 && !isAbsent(unit, tick)`，`X = !isAttackProxy(unit)`。
通过修改 `anomalies/availability.ts:13` 的公共 helper，所有普通调用恢复旧 `alive` 条件，再排除双狼/迷你代理；调用点无需重复改写。

| 文件:行号（修订后） | a4871fa 原条件 | efced3f 修订前 | 本次修订后 |
| --- | --- | --- | --- |
| `src/simulation/combat-s13.ts:265` | `alive` | `P && X` | `alive && X` |
| `src/simulation/combat-g2.ts:179` | `alive` | `P && X` | `alive && X` |
| `src/simulation/combat-g2-3.ts:27` | `alive` | `P && X` | `alive && X` |
| `src/simulation/g2-3-combat.ts:30` | `alive` | `P && X` | `alive && X` |
| `src/simulation/combat-g2-3-summons.ts:20` | `alive` | `P && X` | `alive && X` |
| `src/simulation/combat-g2-3-summons.ts:54` | `alive` | `P && X` | `alive && X` |
| `src/simulation/combat-g2-4b.ts:30` | `alive` | `P && X` | `alive && X` |
| `src/simulation/combat-g2-4b.ts:96` | `alive` | `P && X` | `alive && X` |
| `src/simulation/combat-g2-4b-trench.ts:70` | `alive` | `P && X` | `alive && X` |
| `src/simulation/seat-mechanics/combat-events.ts:30` | `alive` | `P && X` | `alive && X` |
| `src/simulation/m8/s13-mechanisms.ts:139` | `alive && hp > 0` | `P && X` | `alive && hp > 0 && X` |
| `src/simulation/anomalies/shared.ts:14`（P4 新增） | 无 | `P && X` | `alive && X` |

`src/simulation/m8/s13-targeting.ts:9` 经核查是 `TargetUnit.alive` 的目标投影，不是占格判定。
`m8/targeting.ts` 使用它做目标选择；该模块没有占格/落点查询。
遵守本次“不改 isPresent / isSelectable 的其他用途”，保留 `isPresent(unit,tick) && !isAttackProxy(unit)`，未修改目标选择、行动或范围处理。
本次也未改变已有暂离单位从行动列表挂起/返回的流程；公共占格判定对传入的暂离活单位仍保留原格。

## 测试与独立预期

所有新增用例位于 `tests/s13-anomalies-review.test.ts`。

- 第 56 行：斥力从 `(1,3)` 朝外走两格，第一格 `(1,2)` 可走，第二格 `(0,1)` 有阻挡；断言结束坐标与 movement 事件均为 `(1,2)`。
- 第 68 行：4 个参数用例覆盖零 HP 待复活、震撼登场暂离、Zephyr 放逐和已死亡；前三者占格、后者不占格，四者均不 present / selectable。
- 第 79 行：邻格友军首次被归零；同 tick 先风衣分裂、后最后机会复活。断言归零伤害、复活事件、三副本、友军格未被选作落点、事件先后，以及结束时所有存活单位无重叠。
- 第 150 行：强化现有迷你/洛里斯分担用例，增加精确数值断言。Lux 1 星 AD=30；每个迷你 `floor(30 × 0.30)=9` 原始物理伤害。每次直接命中后减 5 护甲，目标的逐包护甲为 60、55、50；抗性后伤害 `floor(900/160), floor(900/155), floor(900/150)=5,5,6`。洛里斯分担 `floor(伤害 × 50%)=2,2,3`，不重复计算其 50 护甲，均由其现有护盾吸收，HP 伤害均为 0；原目标保留 `5-2,5-2,6-3=3,3,3` HP 伤害。原目标护甲最终为 45，洛里斯仍为 50。算式先于执行写入测试，未通过实跑数值反填。
- 第 116、133、142 行：保留双狼/迷你代理不占 Zephyr 返回格、Cutlass 返回格、风衣落点的原有 6 项参数用例。

共新增 6 项执行用例，强化 1 项原有用例；没有删例、跳过、修改时限或放宽断言。

## 验证

`npx.cmd tsc --noEmit` 通过。

`npx.cmd vitest run --configLoader runner --project fast <以下 12 文件> --maxWorkers 2`：12 文件通过，95 项通过、0 项失败，总耗时 23.05 秒。

| 测试文件（均在 tests/） | 文件内测试耗时（秒） | 结果 |
| --- | ---: | --- |
| `s13-anomalies-b.test.ts` | 0.098 | 通过 |
| `s13-anomalies-c.test.ts` | 0.388 | 通过 |
| `s13-anomalies-d.test.ts` | 0.088 | 通过 |
| `s13-anomalies-review.test.ts` | 0.526 | 通过（17 项） |
| `s13-anomalies-replay.test.ts` | 1.741 | 通过 |
| `s13-anomalies-restore-review.test.ts` | 18.158 | 通过 |
| `s13-anomalies-restore.test.ts` | 2.394 | 通过 |
| `s13-anomalies-settlement.test.ts` | 0.637 | 通过 |
| `g2-4b-trench.test.ts` | 2.544 | 通过 |
| `g2-4b-cutlass.test.ts` | 0.100 | 通过 |
| `g2-4b-clone-forges.test.ts` | 0.004 | 通过 |
| `g2-3-skills.test.ts` | 0.258 | 通过 |

先单独运行评审文件也通过：17 项通过、0 项失败，3.41 秒。
初次 `tsc` 发现新增放逐测试数据缺少两个凭证字段，补齐测试数据后通过；没有更改已有断言。
默认 bundle 配置加载因当前沙箱禁止 esbuild 读取祖先目录而启动失败，未执行测试；改用 Vite 官方 runner 配置加载后正常执行。Herald 录制同样通过忽略目录 `artifacts/` 中的临时 Node import hook 仅设置 `configLoader: 'runner'`；录制脚本、规则、输入和断言未改。

当前检出配置 `core.autocrlf=true`。历史字节检查首次因 CRLF 失败；确认差异只有换行后，恢复相关历史夹具为基底原始字节。录制范围的文本源码也还原为 LF，避免换行导致所有源码哈希变化。处理中误包含 10 个 `.gz` 文件，已中止该轮录制并从 HEAD 恢复全部压缩源文件，逐个验证字节一致后重新录制。最终 295 个源文件相对原审计仅本次两个源码文件的哈希变化；无二进制或历史夹具内容改动。

最终依次执行以下命令，全部退出码 0（录制源字节稳定后从第一步重新完整运行）：

| 命令 | 结果 | 耗时 |
| --- | --- | ---: |
| `node tests/fixtures/record-g2-4b-herald.cjs --write` | 5 案例、7 文件生成及生产恢复校验通过 | 66.50 秒 |
| `node scripts/record-g2-4b-inputs.cjs --baseline-commit=a4871fa` | 9 项输入证据生成通过 | 9.02 秒 |
| `node scripts/record-g2-4b-inputs.cjs --baseline-commit=a4871fa --check` | 9 项输入证据严格比对通过 | 8.87 秒 |
| `node tests/fixtures/record-g2-4b-herald.cjs` | 5 案例、7 文件严格比对及生产恢复校验通过 | 65.18 秒 |

Herald 写入与校验的 `sourceSha256` 均为 `20b3c3f5238593c0a1f67974ee114415c7beae15f8a6687b4b324417c9c0d23b`。
内容 digest 仍为 `fnv1a32-utf16:5a4c6937`，原始案例/轨迹和 B8/C19 指纹内容不变；最终指纹差异只有当前 Herald manifest 的源码哈希及审计中的两个源码哈希和 manifest 哈希。

## 边界与剩余风险

自主决定：保留公共 helper 的 tick 形参兼容现有调用，命名为 `_tick`；使用 runner 解决配置加载限制；目标投影不属于占格，保留其选择语义。
未改服务端、表现层、现有规则数值、版本、内容 digest 或内容基线；历史 Herald 原始夹具未重生成，提交内容不变。
按授权仅做相关测试，未运行全套；不据此声称全套通过。尚不需要用户作玩法或合并决定。
