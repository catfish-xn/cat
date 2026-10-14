# Herald 五个恢复用例：用户明确批准的准备分层调整

本批只处理 Ionic Spark、Evenshroud、二者同装、Quicksilver、Edge of Night 五个 Herald 恢复用例。此项须作为②外部审查重点；不是自审签收。TG 不使用此例外，继续真实授予/装备及全部 43 定义。

## 源码及来源边界

- 生产 `src` tree 仍为 `5f9b62228b236074efd78b50a571cc26d23858e5`，没有修改战斗 clone 或恢复器。
- 生成器绑定 134 份源文件，aggregate SHA256：`d9dc028fc389459bd7d2f020988faeac9c14ebe623e907dddd790f677fc319e5`。完整源清单、seed 42、生成版本、content digest/schema/rules/content 版本、每分支命令与轮次计数见 `tests/fixtures/m8-herald-raw/manifest.json` 和 `trajectory.json`。
- 单一公共命令构造器从未恢复的真实 driver 4-4 前缀独立复制，执行原 choices/XP/部署/战斗/合成/装备；先产生全部五份 canonical raw 字符串，断言 SSR module graph 尚未加载 `serialization.ts`，然后才调用完整生产恢复做独立验证。保存的始终是原始字符串，不是恢复返回对象。
- 五用例共享的只有不可变字符串，每例在原 5 秒内独立 `JSON.parse`、完整 `restoreMatch`，再执行原开战、tick、state/events 完整比较与全部篡改拒绝。空装备及其他路径保留原现场构造，未增加 skip、timeout 或 worker 选项。

## 实际执行结果（Node 22.23.3 / npm 11.9.0）

1. `node scripts/verify-m8-herald-fixtures.cjs --write --baseline-dir=/tmp/b8-timeout-fix/herald`：通过，37.73s。旧诊断只作为对照，绝不作为生成输入；每分支完整 prepared、start 返回值及前 15 ticks 完整 state/events 全等。
2. 独立执行 `node scripts/verify-m8-herald-fixtures.cjs`：通过，37.52s。重新执行当前公共路径、导出、生产恢复并逐字复现七份 raw/trace/manifest，无 `/tmp` 或旧存档依赖。命令本身为可重复的独立来源验证前置步骤，不以一次性说明代替。
3. 五装备专项及原空装备对照：6/6 通过，五装备各 99/97/104/402/363ms，空装备 126ms；定向日志中的 24 skipped 是 `-t` 过滤未运行项，不是新增延期。
4. 完整 `tests/m8-b7-match-wiring.test.ts`：30/30 通过，16.24s；无过滤跳过。`npm run typecheck` 退出 0。

原准备各 4.62–4.77s，加原恢复/断言诊断约 0.10–0.34s。调整后计时职责分离：独立生成验证承担完整公共准备，五例承担原恢复机制与篡改拒绝。**不得把上述新旧用例总耗时当作生产或恢复性能提升**。现有性能基准、负载、阈值没有修改。

## 原始失败及计数更正

此前口述/诊断摘要中的“15场准备”有误；原始逐轮计数始终为 14 场（4阶段3场＋5阶段6场＋6阶段5场）、5844 ticks。新生成器首次按15断言失败后核对原清单，更正为14；没有裁掉或增补任何战斗。保留 `generate-write-initial-count-failure.log.gz`，旧诊断归档字节不覆盖。

初始 Node fs 类型导入的 typecheck 失败也原样保留，最终使用本测试夹具范围内 Vite raw 字符串声明，未改变 tsconfig 或生产配置。

## 内部技术预检及后续

内部只读预检核对134个当前source hash、五份raw的hash/字节数、trace hash、独立JSON图、旧完整prepared深比较及14场清单，未发现阻断项；原case全部正负断言及15tick循环逐字保留。该只读SHA/JSON检查使用 Node24.19.0，不计入正式Node22执行或性能证据；正式执行全部来自上述Node22原始日志。

本批专项通过不代表最终全量/CI通过。最终还须实际新 SHA 的完整 npm test、typecheck/build、生产及全导出可达双口径预算与同 SHA CI；②外部 Codex 签收仍由用户转交。

`manifest.json` 逐份记录本目录压缩证据的原始/压缩长度与SHA256，全部gzip9，无原字节覆盖。
