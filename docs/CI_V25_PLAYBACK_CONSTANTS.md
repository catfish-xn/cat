# v25 B9 Playback 固定常量来源

起点：`codex/v25-integration-2`（集成 v25-online-rules epoch 后的 B9 公共路由证据）。  
本文只记录 `tests/m6-playback-checkpoints.test.ts` 第 50–59 行所钉死的 tick/事件计数与四组 SHA-256 的来源与计算方法；不修改 `src/`、玩法、数值或 fixture 文件。v24 同类说明见 `docs/CI_V24_INTEGRATION_FIX.md` 的「字节基线依据 / Playback」小节。

## 夹具与战斗输入

| 项 | 值 |
| --- | --- |
| B9 容量路由 build | `sniper`（与 M6 集成、`m6-application-failures.cjs` 等共用） |
| 录像文件 | `tests/fixtures/v25-online-rules-recorded-states/sniper.json.gz` |
| 生成脚本 | `scripts/record-v25-online-rules-release.cjs`（seed 42，公开命令路由；gzip SHA-256 `a8e7b3648869abac51724c42b314e20907f08b4bd3ca4164f4677fdfa954f73f`，见 `docs/evidence/v25-online-rules/release-audit.json`） |
| 开战前状态 | 同文件内 `round === 32` 且 `phase === 'preparation'` 的 `MatchState` |
| 规则身份 | `rulesVersion`: `s13-g2-3-v25-online-rules`；`contentVersion`: `s13-14.24b-g2-3-v25-online-rules` |
| 该回合已选强化（相对 v24 路由的首个分叉） | `sorcerer-crest` / `overheal` / `reunion`（v24 同 build 为 `two-trick` / `sated-spellweaver` / `conqueror-crest`，见 release-audit 的 `firstCommandDifference`） |

测试内 `fixture()` 从上述 preparation 调用 `startMatchCombat`，再用 `stepMatch` 逐 tick 推进直至离开 combat，经 `BattleHistory` 得到 `BattleRecord`。该 record 与 v25 录像中第 32 轮归档 settlement 的 combat 终态一致（测试用 `goldenStates('sniper')` 的 settlement 做深比较）。

## 终态规模（相对 v24）

| epoch | endTick | 事件账本长度 | 原生帧数（tick 0…endTick） |
| --- | ---: | ---: | ---: |
| v24（`8aa8c627` 录像，见 v24 文档） | 717 | 6771 | 718 |
| **v25（当前 B9 夹具）** | **684** | **6760** | **685** |

差异来自 v25 公开路由与规则 epoch 重录后的整局轨迹，不是 playback 优化路径单独改出来的数字；`docs/evidence/v25-online-rules/release-audit.json` 中 sniper 第 32 轮摘要同样为 `combatTicks: 684`、`combatEventCount: 6760`。

## 四组 SHA-256 如何计算

哈希函数与测试一致：

```ts
const bytesHash = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
```

**参考轨迹 `reference(record)`**（测试内注释：刻意不走 `PlaybackSession` 检查点捷径）：

1. `structuredClone(record.initial)` 得到初始 `CombatState`。
2. 在 `state.tick < record.endTick` 循环中每次调用原生 **`stepCombat(state)`**（不是 match 层的 `stepMatch`）。
3. 每一步用 `record.events` 的切片与 `next.events` 做 **`toEqual` 全量相等**（按 `nextEventSeq` 对齐）。
4. 每推进一 tick，对新的 combat 状态做 `bytesHash(state)`，存入 `Map<tick, hash>`（含 tick 0）。
5. 循环结束后 `digestContent(state)` 必须等于 `record.stateHash`；`expected.terminal` 即最终 combat 状态。

四组固定值均来自上述参考路径（或其对 record 结构的 JSON 投影），与 `PlaybackSession` 校验/seek 实现无关：

| 断言对象 | 计算方式 | SHA-256（`m6-playback-checkpoints.test.ts:56–59`） |
| --- | --- | --- |
| 全部原生帧字节哈希序列 | `bytesHash([...expected.hashes])`：`Map` 按 tick 升序展开为数组后 JSON 序列化再哈希 | `cf8c0c9136360c088e39d1259b8fd4bdf44d0940bb482be12c335b9b651a2a6d` |
| 完整 `BattleRecord` | `bytesHash(record)` | `4371559d3bd53b99b3dfd91d6b48b6180a2fd7af90b63cfd86215a21979cec46` |
| 完整事件账本 | `bytesHash(record.events)` | `c619dab88165e2ee1e3ca6a5e01c2eb0387fdabf69d1d8d79e35588b2345a519` |
| 原生终态 combat | `bytesHash(expected.terminal)` | `c4c0d27c2df046bd5f9986873249715bfa97950a3238544555efd3e532091d8d` |

常量写入集成分支的提交 `81e5c46c`（Step 2 刷新 B9 playback 钉值）；此前 v24 钉值为 `7a5d5c10…` / `bb5b714c…` / `95cf2610…` / `f451ffdf…`（见 v24 文档表格）。

## 与归档 settlement 的交叉校验

除四组哈希外，同一用例要求：

- `expected.terminal` **深等于** `goldenStates('sniper')` 中 `round === 32`、`phase === 'settlement'` 的 `combat`（v25 重录终态，非 v24 `8aa8c627` 归档）。
- `record.endTick === 684` 且 `record.events.length === 6760`。
- 后续 seek/逐帧/事件切片/冻结/防伪断言仍覆盖每一 tick 的 `expected.hashes.get(tick)`，逻辑与 v24 修复后相同，仅输入与钉值换为 v25。

## 本地复现（可选）

在 `codex/v25-integration-2`（或已合入相同钉值的分支）上：

```bash
npm test -- tests/m6-playback-checkpoints.test.ts
```

若需独立打印四组哈希而不改测试，可在 Node 中复用测试文件的 `fixture()`、`reference()` 与 `bytesHash` 定义；必须保持 **`stepCombat` 逐步参考** 与 `JSON.stringify` 哈希规则不变，否则与 CI 钉值不一致。

## 关联证据

- v25 epoch 录制与 byte 证据：`docs/evidence/v25-online-rules/release-audit.json`（build `sniper`，第 32 轮 combat 计数）。
- 消费者测试字节审计：`docs/evidence/v25-online-rules/consumer-byte-audit.json` 中 `tests/m6-playback-checkpoints.test.ts` 条目。
- v24 方法与旧钉值：`docs/CI_V24_INTEGRATION_FIX.md`。
