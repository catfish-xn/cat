# PR #164 v10 规则身份及当前夹具迁移

## 固定输入与身份

- 起点/已审查 HEAD：`f2b7c39b9d1a9febb77eff9b8355094e78503cff`。
- multiplayer：`563a7f9245b2ed297d241efc766875af5270d3f2`；本轮 fetch / ls-remote 未发现新增基线，故未另造 merge。
- 分支：`codex/bracer-multikill-stacks`。本报告与代码/夹具同提交，最终40位 SHA 见交接包 DELIVERY.md。
- rules `s13-g2-3-v10`，content `s13-14.24b-g2-3-v10`，policy revision `g2-4b-bracer-multikill-v10`。
- 当前实算 CONTENT_DIGEST `fnv1a32-utf16:4bf7fe15`，LOOT_REPLAY_DIGEST `fnv1a32-utf16:c11d2d0c`。本轮前代码实算CONTENT为8e5d6983（旧checked-in完整路线golden仍是multiplayer的d6c9bf1b）；两者不可混称同一基线。
- schema/save/replay/command 保持7/3/3/3，NET_PROTOCOL保持3。只变版本标识/声明/对应断言；护臂已审查规则、数值、恢复校验均未改动。
- Node v24.19.0 / npm11.9.0，沿用相同 package-lock/dependencies。

## 重录与独立对账

严格顺序：

```sh
node scripts/record-g2-3-release.cjs
node tests/fixtures/record-g2-3-herald.cjs --write
node scripts/record-g2-3-inputs.cjs
node scripts/record-g2-3-live-reveal.cjs
node scripts/record-g2-3-inputs.cjs --check
```

五条命令均exit0。未调用 `verify-m8-herald-fixtures.cjs --write`；仅更新该脚本 CURRENT 行的当前规则注释，生成器路径仍指向当前 g2-3 Herald。

release真实跑四条公开命令路线，各33战/38轮/victory；cannon、sniper各67个开战前/结算后/终局状态逐一验证serialize、object/text restore及字节往返。与起点checked-in golden对比：四路线命令完全相同、132个完整事件hash全部相同；132个状态hash因规则身份变化而变化。两份录制态逐字段差异仅 rulesVersion、contentVersion、contentDigest、replayDigest，不是重置期望来遮住新战斗结果。证据见 `golden-before-after.json`、`recorded-states-before-after.json`。

Herald五条真实公开命令路线均由原始状态导出后生产恢复，续战15tick一致；生成38.405秒。live-reveal仍核对同tick51的两个死亡eventSeq447/448，以及loris/zyra部分击杀receipt4/0，原断言未改。inputs9项重算及--check通过。

浏览器golden是共享同一份 `tests/fixtures/m5/full-match-golden.g2-3.json`：`scripts/verify-m5-browser.cjs:13` 调用 `tests/fixtures/m5/assert-golden.cjs`，该文件第2行加载它。共享oracle已真实重录；本任务没有另跑浏览器自动化。旧 `full-match-golden.json` 是历史oracle，不覆盖；m6-saves也未迁移。

历史 `tests/fixtures/g2-augments-herald-raw/` 与所合multiplayer逐字节一致。

## 所有重录生成物

- `docs/evidence/g2-3/input-fixture-audit.json`
- `docs/evidence/g2-3/live-reveal-audit.json`
- `docs/evidence/g2-3/release-audit.json`
- `tests/fixtures/g2-3-c19-seed-9-minimal.json`
- `tests/fixtures/g2-3-herald-raw/edge-of-night.json`
- `tests/fixtures/g2-3-herald-raw/evenshroud.json`
- `tests/fixtures/g2-3-herald-raw/ionic-spark--evenshroud.json`
- `tests/fixtures/g2-3-herald-raw/ionic-spark.json`
- `tests/fixtures/g2-3-herald-raw/manifest.json`
- `tests/fixtures/g2-3-herald-raw/quicksilver.json`
- `tests/fixtures/g2-3-herald-raw/trajectory.json`
- `tests/fixtures/g2-3-recorded-states/cannon.json.gz`
- `tests/fixtures/g2-3-recorded-states/sniper.json.gz`
- `tests/fixtures/m5/full-match-golden.g2-3.json`
- `tests/g2-3-content-baseline.json`

以上15个生成物的旧新字节数、SHA256、首差异位置见 `fixture-byte-evidence.json`。录制脚本原有release-audit保持其历史基线说明，本轮比较起点另行在本报告和旁证明确，不伪称旧脚本baseCommit就是本轮基线。

## 验证结果

每个文件单独运行 `npm test -- <文件> --reporter=default --reporter=json --outputFile=<日志JSON>`；原时限保留，未删/skip/重试，未跑全套。逐文件墙钟时间（含进程启动/收尾）如下：

| 文件 | 通过/总数 | 失败 | 墙钟秒 |
|---|---:|---:|---:|
| `tests/opening-random-identity.test.ts` | 139/139 | 0 | 18.891 |
| `tests/m8-content-equivalence.test.ts` | 138/138 | 0 | 15.794 |
| `tests/m8-contracts.test.ts` | 6/6 | 0 | 0.650 |
| `tests/match-contract.test.ts` | 12/12 | 0 | 1.650 |
| `tests/m5-serialization.test.ts` | 33/33 | 0 | 2.120 |
| `tests/bracer-multikill-stacks.test.ts` | 25/25 | 0 | 10.577 |
| `tests/explorer-bracer-restore.test.ts` | 24/24 | 0 | 3.381 |
| `tests/explorer-bracer-restore-pressure.test.ts` | 2/2 | 0 | 1.962 |
| `tests/m8-b7-audit-vectors.test.ts` | 14/14 | 0 | 23.894 |
| `tests/m8-b7-catalog.test.ts` | 5/5 | 0 | 0.823 |
| `tests/m8-b7-cleanup.test.ts` | 5/5 | 0 | 1.799 |
| `tests/m8-b7-known-limitations.test.ts` | 2/2 | 0 | 1.378 |
| `tests/m8-b7-match-wiring.test.ts` | 30/30 | 0 | 19.520 |
| `tests/m8-b7-mechanisms.test.ts` | 21/21 | 0 | 1.473 |
| `tests/m8-b7-serialization-reuse.test.ts` | 6/6 | 0 | 2.205 |

合计15文件462/462通过，0失败、0跳过；typecheck通过10.320秒。全部结果对应本轮未提交工作树的最终代码/生成物，提交未再修改受测内容；每例耗时在交接包JSON中。

## 自行决定、边界与交付

- policy revision使用描述已批准规则的 `g2-4b-bracer-multikill-v10`；没有增加玩法或再动触发机制。
- 浏览器与headless共用oracle，仅重录实际共享文件；不扩大到浏览器环境部署/e2e。当前公开录制路径验证和要求的相关测试均完成。
- 不运行全套，不修改测试超时或门槛，不迁移任何受保护历史夹具。
- 已知远端写入限制仍存在，本轮未重试push或绕过；普通git bundle交付，导入后再由有权限者更新PR/运行CI。无本轮远端CI结果，不能把本地通过描述成CI全绿。
