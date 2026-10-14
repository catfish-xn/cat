# UR-U5-01/02 实现与验证证据

日期：2026-10-10 UTC。状态：**本地领域实现与下列验证完成；Claude 对合同和实现的独立审计、远端 CI、用户合并批准均不由本记录代替。** 本分支基于尚待批准合并的 cleanup PR #24；不自行合并或假定它已进入 main。

## 固定提交与运行树

- 前基线：`8e8b375c2d0840a1034ecffbaf86dde813f48493`，tree `1498ecab3f5709b0030972e256a50815eeaef023`。
- 本地实现 checkpoint：`7ad7e276491fc8c388c8c1e757d1610ee89c2e08`；已发布对应提交：`52c98b67e1a43779277a3ba2ce0231d451cbf161`。
- 上述两个实现提交的 tree 均为 **`52a743565dcac3f7ef8c3fae0e6fd823e27cd01f`**。最终全量测试开始前所有源码、测试及正式复测脚本已冻结；测试期间无 build/probe 或文件改动。测试结束后仅对齐同树远端提交，再顺序运行其余检查。
- 本证据目录是后续文档追加；目录内的旧字段对比 runner 是独立诊断，不进入应用或 Vitest 测试源。后续证据提交不改变已测的 `src/`、`tests/`、`scripts/`。
- Node **22.23.3**，zlib **1.3.1-e00f703**，Vite **7.3.6**；前后复用同一已安装依赖，lockfile SHA-256 **`3f10c2dd761075fc3806aa2ef1459d036ac1068d9a15ab3356f3f1fffe42379f`**。无 lockfile/依赖变更。

## 实现边界

按 [有限合同增补](../../../M8_U5_PREVIEW_CONTRACT_ADDENDUM.md) 只增加 2 个分类字段与 7 个开战数值。`EncounterPreview` 原有字段、技能全文、rulesNote、身份、当前轮范围、补给 null、隐藏信息边界均保留。

- `encounter-selectors.ts` 每次仅建立一次 strategy snapshot；正式英雄目录身份规范化为 `champion/null`，中立以已有内容定义的 family 校验，不猜 ID 前缀、费用或名字。
- `combat-initialization.ts:compileCombatInitialInputs` 有限提取真实 Combat 原有初始 HP/AP/法力/中立输入及装备 crit 编译。实际 `snapshotCombat` 和预览共同消费，调用原 `compileUnitInputs / compileItemCrit`，crit 输出由原 `spellCrit` 读取。
- `projectCombatStartMana` 把真实 combatStart 的同一触发批次及法力封顶/溢出提为纯数值路径；`applyCombatStart` 的 S13 与旧路径共同使用，仍由原调用方生成原顺序的事件。查询丢弃内部批次元数据，不创建完整 Combat、不生成事件、不动 RNG、ID、资源或保存态。
- `compileItemCrit / spellCrit / champion` 仅缩窄所需输入类型；没有复制暴击公式、改变规则、内容、digest、schema、G12、装备合同或 UI。`pvp:<roundId>` 只作不透明显示身份，不能作为素材键或掉落键。

## 最终检查结果

| 检查 | 结果 | 原始证据 |
| --- | --- | --- |
| 原样 `npm test`，无筛选/worker/timeout 参数改写 | **114 files passed；1501 passed / 10 existing skipped；447.68 s；exit 0** | [full-unit.log.gz](full-unit.log.gz) |
| `npm run typecheck` | exit 0 | [typecheck.log.gz](typecheck.log.gz) |
| `npm run build`（含原 typecheck） | exit 0；保留既有大 chunk 提示 | [production-build.log.gz](production-build.log.gz) |
| 匹配生产/可达构建 | 两侧四次构建均成功，未触发 5850 B 停止线 | [matched-gzip-build.log.gz](matched-gzip-build.log.gz)、[JSON](matched-gzip.json) |
| 与原 8e 整体初始化差分 | 33 个真实战斗轮＋5 个补给边界，共 38 轮全部一致 | [initialization-compare.log.gz](initialization-compare.log.gz)、[逐轮摘要](initialization-regression.json) |
| 原预览字段逐值对比 | 109 个准备/Start/首步/补给边界投影完全一致 | [legacy-preview.log.gz](legacy-preview.log.gz)、[独立 runner](check-legacy-preview.mjs) |

新增 `tests/m8-u5-preview.test.ts` 的 **60 项**已包含在最终全量中：8 场 PvE 的 25 个独立枚举实例、六类 family 与人工数值锚，全部 25 场 PvP 的三类阵容、实际 1/2 星变化及装备/羁绊；3 星通过独立 Zyra Combat seam 覆盖，不篡改生产敌军模板。各敌军按 unitId 与公开 `startMatchCombat` 返回的 tick 0 CombatUnit、`spellCrit` 逐项核对，绝非仅以同一个 snapshot 作为 expected。

覆盖还包括精确 keys/安全整数/递归冻结、零蓝及英雄最小上限边界、重复查询与全态/序列化不变、查询前后下一真实命令及事件一致、恢复、真实受伤/耗蓝、鸟死亡叠速、结算/nextRound/终局以及五个补给轮。共享路径有多 mana 钩子、盾、溢出、一次性初始化事件、everyN 过滤、6 组真实装备 crit/AP/授权来源数量与概率上限、旧守卫 0 crit 独立锚。

跨提交的完整差分并非只比新字段：对同一合法准备态的整个 `startMatchCombat` 返回结果（包含 Match/Combat、RNG state/draws、全部初始事件及序号）与首步结果作全值相等断言，再比规范存档字节及两侧恢复结果。旧字段 runner 逐一保留原 top/unit/stats 形状，比较完整名字/说明/rulesNote、四属性、cell 和所有原身份。

后期准备态使用已注明的合成前轮胜利推进历史；受测轮的 Start/首步及恢复走真实公共入口，不把该夹具当无作弊整局、平衡、B8 掉落或 B9 新交付验收。早期中途取消的并发诊断运行不作为最终通过证据。本地 Chromium、首交互和最终 UI 桌面接线验证未在本次执行，不宣称远端 CI 或视觉验收已通过。

## 实测 gzip9：两组口径分开

测量对每个 `dist/assets/*.js` **分别 gzip level 9 后求和**，与 `m7-budget` 口径一致；不是 Vite 日志中默认压缩级别的展示值。两侧工具链、lockfile、入口处理完全相同。

| 构建 | 固定 8e 前基线 | U5 领域实现 | 本组净差 |
| --- | ---: | ---: | ---: |
| 正常生产入口 | 485816 B | **485873 B** | **+57 B** |
| 同时令 `readEncounterPreview + readRoundInfo` 可达的匹配探针 | 487463 B | **487769 B** | **+306 B** |

普通入口仍未消费这两个查询，因此不能拿 +57 B 当完整预览消费成本；它体现共享初始化在已可达路径的影响。匹配可达探针以 Vite transform 在内存中追加完全相同的诊断绑定，不改 `src/main.ts` 或最终生产入口。+306 B 是本次字段/共享路径在相同可达条件下的实测净差；新可达树相对旧普通基线为 **+1953 B**。这些是整包压缩后的净比较，不把独立试验简单相加，也不把历史 +1610/+1657 B 直接套用本次。

仍只有既有依赖，正常构建模块数 136→137（纯共享模块增加 1 个）。U5 中央规划仍为 4500 B，领域交付未触发 **净增超过 5850 B 则停止报告** 的批次线；此结果不是 Claude 完整 U5 接线后的包量，也不是另开 300–1500 B 配额。最终 U5 整合树须重新测量，M7×1.30 只覆盖已批准 M8 范围，其余门禁与 M9 不变。

## 复现

准备原 8e 源码树和当前实现树，使用相同依赖与上述 Node 版本。先运行正常 `npm test`、`npm run typecheck`、`npm run build`，待全量测试终止后再依次运行：

```sh
node scripts/measure-m8-u5-preview.mjs --baseline="$BASELINE_TREE" --baseline-sha=8e8b375c2d0840a1034ecffbaf86dde813f48493 --current="$PWD"
node scripts/compare-m8-u5-initialization.mjs --baseline="$BASELINE_TREE" --baseline-sha=8e8b375c2d0840a1034ecffbaf86dde813f48493 --current="$PWD"
node docs/evidence/m8-u5/preview-contract/check-legacy-preview.mjs artifacts/u5-preview/initialization/baseline/api.mjs artifacts/u5-preview/initialization/current/api.mjs
```

raw `.log.gz` 可用 `gzip -dc` 读取。前基线可由 `git archive 8e8b375…` 导出；生产/可达报告保存实际 Node/zlib、lockfile hash、提交 SHA、诊断绑定、每个 JS 的原字节和 gzip9 字节。交由 Claude 独立审计合同、实现与这些证据，问题处理复核后再请用户批准合并；本记录不代签。
