# W4 强化符文 6→30：夹具迁移

## 真实基线与约束

真实施工基线为 `80b893ac66c01b79ec6606b493e141eca3bf00cb`。
迁移按 `docs/evidence/p3p4p5/FIXTURE_MIGRATION.md` 的双引擎原则执行：
旧引擎运行旧状态，新引擎从公共命令重新生成新状态；禁止放宽 restore、修改旧
代码、把旧 raw 的 digest 替换后当成新录制输入。旧 P7-1 和所有历史夹具保留。
本次更新 CONTENT_DIGEST、rulesVersion、contentVersion，LOOT_REPLAY_DIGEST 不变。

## 现有生成器盘点

- `scripts/generate-m5-route.cjs`：seed 42 的 cannon、sniper、mage、sniper-caitlyn
  完整公共命令路线；内置 `oracle.g2.cjs` 独立账本、商店和随机数检查。
- `scripts/record-p7-1-release.cjs`：当前 P7-1 golden、content baseline、cannon/sniper
  各 67 状态。它断言命令/事件完全不变，不能直接用来录制扩大后的 augment pool。
- `scripts/verify-m8-herald-fixtures.cjs`：从 seed 42 sniper 路线的 4-4 choice
  前缀生成五份 Herald raw、trajectory、manifest；全部 raw 输出后才加载 restore，
  验证完整 preparation、start 与前 15 次 step。当前原脚本目标是 P7-1，
  W4 需要将目标切换到 `tests/fixtures/g2-augments-herald-raw`，不得覆盖历史目录。
- `scripts/record-p7-1-battle-evidence.cjs`：C19 公共 compileBattle 重编译以及
  B8 0/1/9 单位 battle/replay 指纹。B8 旧指纹明确去掉 heal.shares；W4 保留
  这一兼容投影，同时在新证据中比较完整未投影 battle 和 replay。
- `scripts/record-g2-augments-fixtures.cjs`：本次新录制及复核器。默认只校验，
  `--write` 才写新目录。输出前完成全部计算与检查；不修改任何旧夹具。

## 可复现顺序

以下步骤应在 30 个定义、版本号以及 Herald 目标目录最终确定后执行：

```sh
BASE=80b893ac66c01b79ec6606b493e141eca3bf00cb
BASE_ROOT=$(mktemp -d /tmp/g2-augments-baseline.XXXXXX)
git archive "$BASE" | tar -x -C "$BASE_ROOT"
ln -s "$PWD/node_modules" "$BASE_ROOT/node_modules"
node scripts/verify-m8-herald-fixtures.cjs --write
node scripts/record-g2-augments-fixtures.cjs --baseline-root="$BASE_ROOT" --write
# 复核使用同一未修改基线；两个命令均省略 --write。
node scripts/verify-m8-herald-fixtures.cjs
node scripts/record-g2-augments-fixtures.cjs --baseline-root="$BASE_ROOT"
```

新复核器逐文件验证旧 simulation、server-entry、route driver、oracle/fixtures
与 Git 原始字节一致；两个独立 Vite SSR 引擎分别执行。重新执行的旧四条路线
必须精确匹配 P7-1 golden，旧 cannon/sniper 的完整状态必须匹配旧压缩归档。
新状态通过文本和对象两种 production restore，旧身份必须被新恢复器拒绝。
新路线仍需通过独立账本、33 场战斗、victory 和 67 状态等原验收要求。
如果这些原要求失败，先查原因，不能仅改期望使测试变绿。

## 字节与玩法差异证据

`fixture-migration.json` 记录真实基线文件 SHA-256 清单、前后字节长度与 SHA-256、
第一字节差异及第一字段差异。路线分别比较 commands、command events、完整 battle
 events、完整 states、结算结果与 tick 数；不得只比较最终胜负。

另提供 `firstGameplayDifference`，仅按字段名剔除 rulesVersion、contentVersion、
contentDigest 三个发布身份。不会剔除 lootReplayDigest、事件 hash、RNG 或玩法字段。
完整原始比较始终保留；该投影只用于诊断，不参与录制或恢复。
C19 从旧双方原始描述、battleSeed、battleId 公共重编译；终局和全事件必须字节相等。
Herald raw 文件直接比较原始字节，旧/新各自恢复后比较完整 start 与前 15 次 step。
扩池引起的真实 choice/offers/选择/RNG/后续战斗变化必须在报告中显式呈现。

## 输出及接线

新输出包括 `tests/g2-augments-content-baseline.json`、
`tests/fixtures/m5/full-match-golden.g2-augments.json`、
`tests/fixtures/g2-augments-recorded-states/{cannon,sniper}.json.gz`、
`tests/fixtures/g2-augments-c19-seed-9-minimal.json`、
`tests/fixtures/g2-augments-b8-fingerprints.json` 及新证据 JSON。
Herald 七个文件由原始生成器单独生成。

录制完成后，维护者应将运行中消费方切换到新夹具：`assert-golden.cjs`、
`m8-golden-states.cjs`、Herald raw 引用、C19 与 B8 helper，以及当前身份断言。
历史 baseline 和旧身份拒绝断言保留，不能全仓替换旧字符串。
本说明是可复现方案，不声称已经执行录制或测试通过。
