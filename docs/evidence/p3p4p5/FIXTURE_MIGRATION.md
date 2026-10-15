# PR #90 非目标集夹具身份更新

旧基线为真实发布前提交 `66395eb`，包含 C19 首跳修复。比对程序先逐文件验证
基线 `src/simulation/` 与 Git 原件字节一致，再分别用两个独立 Vite SSR 引擎执行；
没有放宽 restore、修改旧引擎或使用旧存档驱动新 Herald 录制。

## 可复现命令

在仓库根目录执行（下面路径只用于隔离源码，可替换）：

```sh
mkdir -p /tmp/p3p4p5-fixture-baseline
git archive 66395eb | tar -x -C /tmp/p3p4p5-fixture-baseline
ln -s "$PWD/node_modules" /tmp/p3p4p5-fixture-baseline/node_modules
node scripts/verify-m8-herald-fixtures.cjs --write
node scripts/record-p3p4p5-fixture-migration.cjs --baseline-root=/tmp/p3p4p5-fixture-baseline --write
```

复核时去掉两个 `--write`。Herald 原脚本重新执行 seed 42 sniper 公共命令路线、
独立账本 oracle、五个分支的完整获取路线，全部 raw 字节导出后才加载生产恢复器。
`manifest.json` 和 `trajectory.json` 同步重录，源码清单与实际来源绑定。

## 字节证据

`fixture-migration.json` 保存每项比较的前后 SHA-256、字节长度、计数。

- C19 保持 `6-1`、battleId、种子和双方原始描述，调用当前公共 `compileBattle`
  重新生成完整 preparation、mapping、strategy，而非直接修改编译夹具的 digest。
  完整编译结果只在双方快照 digest 上与旧件不同。两个真实引擎执行后，
  完整 terminal、全部事件和全部灼烧包直接 `Buffer.equals`，不做身份归一化。
  终局仍是 tick 244 / enemyWin；Ezreal 5 跳、Garen 10 跳，共 15 跳。
- Herald 比较完整普通阶段命令、事件 hash、战斗 tick 和结算结果；仅移除包含身份的
  state hash 和 raw hash，全部事件 hash 原样比较。五份完整 raw preparation、
  combat start 与前 15 次完整 step（包含事件）在四项明确发布身份替换后字节一致。
  使用旧代码实际恢复运行旧 raw，使用新代码实际恢复运行重录 raw。
- 历史 T13 golden、历史 content baseline 和旧身份拒绝断言保留；当前运行夹具更新到
  `s13-rules-gap-v2` / `s13-14.24b-rules-gap-v2` 与 canonical 新 digest。
