# 合入最新 multiplayer v11（2026-10-18）

本轮从原修复 HEAD `6dea12a58861de83c0a879d72d8692802a30399b` 开始，工作区干净；`git fetch` 和 `git ls-remote` 确认 multiplayer 为 `075e9a494758b13620c8ae36e55364cc214fd364`（含 #184、#185）。采用 merge，保留原两个提交，不 rebase。

## 冲突处理

仅以下九个生成文件发生文本冲突：
- docs/evidence/g2-4b/input-fixture-audit.json
- tests/fixtures/g2-4b-c19-seed-9-minimal.json
- tests/fixtures/g2-4b-herald-raw/ 内 edge-of-night.json、evenshroud.json、ionic-spark--evenshroud.json、ionic-spark.json、manifest.json、quicksilver.json、trajectory.json。

先采用 multiplayer 的 v11 产物，再用当前合并代码顺序生成和核验，未手填 hash、未手工改录制状态。生产源码没有冲突；相对 multiplayer 仍仅两处原始修复：慢炖 hpBasis 改 holder、补九个原版铜级阈值。超高速仍仅加强测试。

上游规则/内容版本完整保留 v11，policy revision 为 g2-4b-support-forge-v11。相对新基线，src/server、src/rendering、src/presentation、版本常量、历史 g2-3/g2-augments Herald 目录均无差异。

## 实际执行

串行：
1. node tests/fixtures/record-g2-4b-herald.cjs --write
2. node tests/fixtures/record-g2-4b-herald.cjs
3. node scripts/record-g2-4b-inputs.cjs --baseline-commit=075e9a494758b13620c8ae36e55364cc214fd364
4. 同上加 --check
5. 六个相关测试文件分别执行 npm test -- tests/<file>.test.ts；最后 npm run typecheck。

当前 g2-4b 的 --write 仍按脚本实际生成方式，未写任何历史目录；版本最终提升由合并流程处理，本轮未升版本。未跑全套，未改测试时限或跳过项。

## 结果

Herald --write 和默认校验、inputs 生成与 --check 均通过。CONTENT_DIGEST 从新基线 `fnv1a32-utf16:601f574f` 自然变为 `fnv1a32-utf16:67084ca8`；规则与内容版本仍分别为 `s13-g2-3-v11`、`s13-14.24b-g2-3-v11`。Herald 生成64.217秒、默认验证77.932秒；日志随报告保留。

| 文件 | 通过 / 失败 | 命令总耗时 |
| --- | --- | --- |
| tests/g2-3-anomalies.test.ts | 40 / 0 | 0m4.232s |
| tests/g2-augments-static.test.ts | 70 / 0 | 0m4.492s |
| tests/g2-augments-multiplayer.test.ts | 6 / 0 | 0m5.943s |
| tests/g2-augments-combat.test.ts | 16 / 0 | 0m6.213s |
| tests/g2-augments-choice.test.ts | 35 / 0 | 0m7.420s |
| tests/g2-3-traits.test.ts | 19 / 0 | 0m3.035s |

合计 6 文件、186 项通过、0 项失败；typecheck 通过。未修改上轮三项修复或测试断言。

上轮报告及红绿/改动实验均原样保留在父目录，不能把上轮 v10 结果当成本轮 v11 结果。
