# 强化与异常三项修复（2026-10-18）

分支 `codex/fix-augment-anomaly-bugs`；起点 `cca6bce70ce48690ced7dc4c6a0d2d0d3698d99b`（实际 fetch/ls-remote 的 multiplayer，已超过盘点时 829128f）。Node v24.19.0 / npm 11.9.0；独立 worktree，未改原工作区。只运行相关文件，逐文件串行，没有全套。

## 根因、独立预期及覆盖

1. 慢炖：`g2-3-programs.ts` 的伤害基准错写为 `target`，修为 `holder`。HealthRatio 0.03、半径、Period 6 及调度都没改。500 最大生命携带者面对 3600 最大生命目标，tick 20、40 每包应为 floor(500×3/100)=15；旧代码产生 108、108，回归先红后绿。原始归档英文 `their max Health` 指代不够清晰；仓库 EXTERNAL_SOURCES 的自身生命说明及 [Riot S13 机制介绍法语](https://teamfighttactics.leagueoflegends.com/fr-fr/news/game-updates/mechanics-into-the-arcane/) 的 `ses PV max` 支持携带者基准。该预告数值为旧版，未用于本次取值；14.24 数值仍采用归档。
2. 终身黄铜 I/II：铜级表停留在早期内容集，漏掉 ambusher 2、visionary 2、chem-baron 3、dominator 2、pit-fighter 2、experiment 3、bruiser 2、black-rose 3、quickstriker 2。补入 raw S13 `effects.style=1` 对应阈值；没有改 300/350 增伤与 150 坚韧数值。逐项验证双方归属、未激活、高阶不计、唯一/Family 不计。5→8→5 单位当前棋盘组合验证双方真实战斗编译和结算事实：征服者 2→4→2、化学男爵 3→4→3；8 单位另有哨兵/先知/统领三项铜级，因此总铜级数为 2→3→2，不是把两条升档羁绊继续算铜级。
3. 超高速：旧断言在没施法时也满足。现在确认真实 cast 事件与 castCount 增加，Lux 基础攻速 0.70，初始 +10%，完成第一/二次施法再分别 +15%，独立手算间隔 ceil(20/0.77)=26、ceil(20/0.875)=23、ceil(20/0.98)=21；验证两个叠层的机制状态。移除施法触发器的改动实验导致新测试失败，恢复实现后通过。这里是机制验证和深拷贝一致性，不宣称整个 Match 公开存读档已在该小测试覆盖。

原始来源摘录、压缩文件 SHA256：`source-excerpts.json`。先失败/修后通过/改动实验（含两次新组合测试构造错误和纠正）完整结果摘要：`red-green-results.json`。测试构造使用原有 snapshot/Combat 机制入口，未绕过生产恢复来宣称合法 Match 存档。5→8→5 是三次独立棋盘快照，不是部署命令链；g23BattleFacts 验证档位投影，不宣称资源账本支付覆盖。

## 指纹与身份

补齐铜级内容表自然改变 CONTENT_DIGEST：`fnv1a32-utf16:67cd0953` → `fnv1a32-utf16:0e727042`；版本常量、policy revision 未修改，按用户要求合并时再升。

按仓库 `docs/evidence/g2-4b/MIGRATION.md` 的实际生成方式，先运行默认 Herald 校验，确认旧当前夹具与新身份不同后，用 `record-g2-4b-herald.cjs --write` 生成当前 g2-4b 目录，再默认验证。默认命令只校验、不更新，`--write` 仅用于当前目录；没有对 g2-3 历史目录执行写入，也没有使用 verify-m8-herald-fixtures 的写入模式。

生成仍通过原有公开命令轨迹、独立经济/商店 oracle、5 个原始输入的生产恢复及开战后 15 tick 存读续算校验。没有手填源码哈希或手改夹具来通过检查。随后运行 inputs，比较基线固定为上述完整起点 SHA。

## 验证结果

| 文件 | 通过 / 失败 | 命令总耗时（shell time） |
| --- | --- | --- |
| tests/g2-3-anomalies.test.ts | 40 / 0 | 0m2.149s |
| tests/g2-augments-static.test.ts | 70 / 0 | 0m2.007s |
| tests/g2-augments-multiplayer.test.ts | 6 / 0 | 0m3.316s |
| tests/g2-augments-combat.test.ts | 16 / 0 | 0m3.969s |
| tests/g2-augments-choice.test.ts | 35 / 0 | 0m4.056s |
| tests/g2-3-traits.test.ts | 19 / 0 | 0m1.764s |

以上均逐文件串行执行，typecheck 通过。Herald 生成 41.304 秒、默认严格核验 41.740 秒；inputs 生成及 --check 均通过（9 个证据项）。历史 g2-3 和 g2-augments Herald 目录相对基线 git diff 为空。

最初尝试 /usr/bin/time -v 时本机无该二进制，六条命令均在测试启动前退出127；保留此环境说明，改用 shell 内建 time 取得实际总耗时，未重复已运行的测试。未测峰值 RSS，本次用户未要求。

## 自行决定与边界

- 当前 g2-4b 重录使用脚本明确的 `--write` 参数；以 MIGRATION.md/#180 流程和用户“参数照仓库脚本”的要求执行。
- 初次 npm ci 的默认缓存目录不可写，改用 /tmp 下专用 npm cache 后成功；不是产品测试失败。
- 不新建 PR；合并前仍需统一身份与相关版本化 release/live-reveal 等最终验收。未改 src/server、src/rendering、src/presentation、玩法数值或测试时限。

## 只读复核

另一只读复核确认两处生产修复与 raw 一致、未发现具体阻塞；五个 Herald 原始 JSON 结构对比仅 contentDigest 改变，trajectory 仅状态哈希变化。该复核没有额外跑测试，也不代替后续正式 PR 审查。
