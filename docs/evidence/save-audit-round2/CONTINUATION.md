# 暂停后的续接记录

用户于 2026-10-18 要求“整理好当前工作，然后暂停”。已经向最终全集的 Vitest 进程发送 SIGINT，退出码 130，完整进程 129.740 秒；没有把中断当成验收通过。

已完成：合入 multiplayer@7142dc6；共用真实历史记录器、逐文件隔离注册表；预录中立/五条 Herald/炮手/军械库原始战斗账本；测试和脚本接入；深不可变规范文本记忆；三处末轮超时修复。没有改变规则数值、版本或测试时限。

验证状态：

- 最近完整 87 文件：1940/1943，通过数逐文件见 README；3 条超时发生在最后三处修复前。
- 修复后 3 文件：77/77，50.647 秒。护腕续跑 1.671 秒；B6 晚轮 2.199 秒；双饮血剑 0.212 秒。双饮血剑真实获取另有可见用例 2.807 秒。
- 当前 typecheck：23.798 秒通过。
- B7 独立：127/127，91.878 秒；仍未达到 40 秒目标。
- M5 炮手独立：1/1，用例 163.017 秒，进程 165.996 秒，原时限 180 秒。
- 最终指纹已按 Herald --write → inputs → inputs --check 完成，来源 e173951aba842d6815447362b6f79125bb87478f38e2518e498de2456e607ecb。最后只改三份测试，不影响固定来源。历史 g2-augments-herald-raw 的 7 文件与 multiplayer 逐字节一致。
- 18 个 CJS 语法通过；摘要强制碰撞回归 1/1。

待续：

1. 最终源码的全部 87 文件重新一起跑完，保留 fast/isolate:false 和所有原时限。不要把上轮全集与后续 77 条结果拼接成通过。
2. B7 的完整冷重演性能目标仍未达到。
3. tests/m8-b5-temporary.test.ts 默认堆下五文件组合曾有两条超时；3 GiB 上轮全集五组 TG 都在原 5 秒内通过，默认堆波动仍待消除。
4. scripts/record-p3p4p5-fixture-migration.cjs 历史规则比较脚本尚未重构相应旧规则真实证据，不能冒用当前规则的历史。

恢复全集命令：

```sh
rg -l 'restoreMatch|serializeMatch|parseSave|readCompatibility|importFile' tests --glob '*.test.ts' | sort > /tmp/restore-files
# 应有 87 文件；另有 recorded-fixture-intern 等回放入口的独立结果。
NODE_OPTIONS=--max-old-space-size=3072 ./node_modules/.bin/vitest run --project fast $(cat /tmp/restore-files) --maxWorkers=1 --reporter=verbose --reporter=json --outputFile=/tmp/restore-results.json
```

总墙钟必须包含启动、导入、加载、所有冷校验和退出。不得运行 verify-m8-herald-fixtures.cjs --write，不得改旧 raw。若改固定来源，需要重新按上述三个命令的顺序重算指纹。
