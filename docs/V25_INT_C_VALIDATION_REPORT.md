【完成】v25 integration C 定向验证报告（2026-10-27）

工作区分支 `claude/v25-int-c`，HEAD `53c69f3d`；比较基线 `origin/multiplayer` 为 `100589ca`。六次合并由用户完成。本轮只修改测试和本报告，保留用户已重算的内容身份；未修改玩法、服务器或界面，未执行 Git 写操作。

验证目标为联机。按要求完整执行各分支新增/修改的测试文件，并覆盖生产体积、独立 oracle、强化提供规则及私有投影；未跑全套、浏览器或单机专项验收。

内容身份：`CONTENT_DIGEST=fnv1a32-utf16:e0330731`；`LOOT_REPLAY_DIGEST=fnv1a32-utf16:6202a227`。独立计数依据：v24 的 235 项 + S6C 的 2 项 + S8A/S8B/S8C 各 1 项 + S11A 的 2 项 = 242。

**各分支冲突文件与处理方式**

当前索引已没有原始冲突记录。以下清单根据每次合并的共同祖先、两个父提交，用 `git show` 读取文件并用 `git merge-file -p` 做只读文本重建，再对照最终合并内容；它描述可重建的文本冲突及当前处理结果，不声称复原当时的人工操作顺序。临时输入放 `/tmp`，没有重新执行分支合并。

**`codex/v25-s6c` — 合并 `ffa0c7a6`**

分支差异中的 5 个测试文件全部通过，共 233 项（跨分支共用文件重复计入本行，不能逐行相加）。

| 冲突文件 | 处理方式 |
| --- | --- |
| `docs/S13_RULES_GAP.md` | 保留两侧规则决定与分支记录，按内容追加；本轮未改规则。 |
| `scripts/tests/production-size.test.ts` | 合并提交保留集成基线摘要；本轮同步到用户重算后的 e0330731 / 6202a227，并通过 6 项生产体积测试。 |
| `src/simulation/content/identity-constants.ts` | 合并提交保留集成基线身份；用户已全量重算，本轮保留用户工作区变更。 |
| `tests/m5-content.test.ts` | 合并内容计数覆盖；本轮补齐五批新增源表并保留独立固定总数 242 的断言。 |

分支测试文件：`tests/augment-pool-batch5-s6c-room.test.ts`（4 项）、`tests/augment-pool-batch5-s6c.test.ts`（8 项）、`tests/g2-augments-choice.test.ts`（169 项）、`tests/m5-content.test.ts`（9 项）、`tests/m5-oracle-augment-ledger.test.ts`（43 项）。

差异中的辅助文件由上述测试加载验证：`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/oracle.g2.cjs`。

**`codex/v25-s8a` — 合并 `fc9ff1a6`**

分支差异中的 4 个测试文件全部通过，共 63 项（跨分支共用文件重复计入本行，不能逐行相加）。

| 冲突文件 | 处理方式 |
| --- | --- |
| `docs/S13_RULES_GAP.md` | 保留两侧规则决定与分支记录，按内容追加；本轮未改规则。 |
| `scripts/tests/production-size.test.ts` | 合并提交保留集成基线摘要；本轮同步到用户重算后的 e0330731 / 6202a227，并通过 6 项生产体积测试。 |
| `src/simulation/augment-pool-grants.ts` | 并存 S6C 金币校验与 Pilfer、Glorious Evolution、Hard Commit 奖励计划，沿用唯一收据。 |
| `src/simulation/content/augment-offer-rules.ts` | 合并各批次 API 名映射，保留已有提供过滤规则。 |
| `src/simulation/content/augment-policy.ts` | 并入各批次位阶表，保留已有策略。 |
| `src/simulation/content/augments.ts` | 并入各批次定义；最终唯一强化总数为 242。 |
| `src/simulation/content/identity-constants.ts` | 合并提交保留集成基线身份；用户已全量重算，本轮保留用户工作区变更。 |
| `src/simulation/content/rules-manifest.ts` | 保留各批次规则清单入口，未覆盖其他分支入口。 |
| `src/simulation/shared-pool.ts` | 合并各批次强化/收据识别入口，保留 S6C 结算生命校验与共享奖励恢复校验。 |
| `src/simulation/validate-content.ts` | 并入各批次原始表与数量校验；最终内容测试通过。 |
| `tests/fixtures/m5/oracle.g2.cjs` | 保留各分支独立转录的身份、位阶、奖励/阶段规则；本轮未改 oracle 实现。 |
| `tests/m5-oracle-augment-ledger.test.ts` | 保留所有独立账本断言；本轮将最终唯一身份数量同步为 242，43 项通过。 |

分支测试文件：`tests/augment-pool-batch5-s8a-room.test.ts`（4 项）、`tests/augment-pool-batch5-s8a.test.ts`（6 项）、`tests/augment-stage-bans-audit.test.ts`（10 项）、`tests/m5-oracle-augment-ledger.test.ts`（43 项）。

差异中的辅助文件由上述测试加载验证：`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`。

**`codex/v25-s8b` — 合并 `e9ac9ded`**

分支差异中的 4 个测试文件全部通过，共 332 项（跨分支共用文件重复计入本行，不能逐行相加）。

| 冲突文件 | 处理方式 |
| --- | --- |
| `scripts/tests/production-size.test.ts` | 合并提交保留集成基线摘要；本轮同步到用户重算后的 e0330731 / 6202a227，并通过 6 项生产体积测试。 |
| `src/simulation/augment-pool-grants.ts` | 并存 S6C 金币校验与 Pilfer、Glorious Evolution、Hard Commit 奖励计划，沿用唯一收据。 |
| `src/simulation/content/augment-offer-rules.ts` | 合并各批次 API 名映射，保留已有提供过滤规则。 |
| `src/simulation/content/augment-policy.ts` | 并入各批次位阶表，保留已有策略。 |
| `src/simulation/content/augment-stage-bans.ts` | 保留各批次阶段限制；独立审计确认本次新增项，既有 5 项差异仍单独报告。 |
| `src/simulation/content/augments.ts` | 并入各批次定义；最终唯一强化总数为 242。 |
| `src/simulation/content/identity-constants.ts` | 合并提交保留集成基线身份；用户已全量重算，本轮保留用户工作区变更。 |
| `src/simulation/content/rules-manifest.ts` | 保留各批次规则清单入口，未覆盖其他分支入口。 |
| `src/simulation/match.ts` | 保留已有轮次入口，合并新增奖励触发条件；联机真实房间和快照测试通过。 |
| `src/simulation/shared-pool.ts` | 合并各批次强化/收据识别入口，保留 S6C 结算生命校验与共享奖励恢复校验。 |
| `src/simulation/validate-content.ts` | 并入各批次原始表与数量校验；最终内容测试通过。 |
| `tests/augment-stage-helpers.ts` | 保留各分支种子条目；本轮按合并后的 242 项池重新验证受影响的固定种子。 |
| `tests/fixtures/m5/oracle.g2.cjs` | 保留各分支独立转录的身份、位阶、奖励/阶段规则；本轮未改 oracle 实现。 |
| `tests/g2-augments-choice.test.ts` | 保留独立 RNG/抽签与恢复断言；总数同步为 242，Pilfer 取得测试保持真实未结束战斗，避免无历史夹具提前结算。 |
| `tests/m5-oracle-augment-ledger.test.ts` | 保留所有独立账本断言；本轮将最终唯一身份数量同步为 242，43 项通过。 |

分支测试文件：`tests/augment-pool-batch5-s8b.test.ts`（27 项）、`tests/g2-augments-choice.test.ts`（169 项）、`tests/g2-augments-static.test.ts`（93 项）、`tests/m5-oracle-augment-ledger.test.ts`（43 项）。

差异中的辅助文件由上述测试加载验证：`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/oracle.g2.cjs`。

**`codex/v25-s8c` — 合并 `3c7468af`**

分支差异中的 4 个测试文件全部通过，共 71 项（跨分支共用文件重复计入本行，不能逐行相加）。

| 冲突文件 | 处理方式 |
| --- | --- |
| `scripts/tests/production-size.test.ts` | 合并提交保留集成基线摘要；本轮同步到用户重算后的 e0330731 / 6202a227，并通过 6 项生产体积测试。 |
| `src/simulation/augment-pool-grants.ts` | 并存 S6C 金币校验与 Pilfer、Glorious Evolution、Hard Commit 奖励计划，沿用唯一收据。 |
| `src/simulation/content/augment-offer-rules.ts` | 合并各批次 API 名映射，保留已有提供过滤规则。 |
| `src/simulation/content/augment-policy.ts` | 并入各批次位阶表，保留已有策略。 |
| `src/simulation/content/augment-stage-bans.ts` | 保留各批次阶段限制；独立审计确认本次新增项，既有 5 项差异仍单独报告。 |
| `src/simulation/content/augments.ts` | 并入各批次定义；最终唯一强化总数为 242。 |
| `src/simulation/content/identity-constants.ts` | 合并提交保留集成基线身份；用户已全量重算，本轮保留用户工作区变更。 |
| `src/simulation/content/rules-manifest.ts` | 保留各批次规则清单入口，未覆盖其他分支入口。 |
| `src/simulation/match.ts` | 保留已有轮次入口，合并新增奖励触发条件；联机真实房间和快照测试通过。 |
| `src/simulation/shared-pool.ts` | 合并各批次强化/收据识别入口，保留 S6C 结算生命校验与共享奖励恢复校验。 |
| `src/simulation/validate-content.ts` | 并入各批次原始表与数量校验；最终内容测试通过。 |
| `tests/augment-stage-bans-audit.test.ts` | 保留合并后的来源审计预期；更新至 214 个池 API / 166 个已配置阶段条目 / 171 个来源条目。CLI 使用文件捕获 stdout/stderr，避免受限工作线程管道异常。 |
| `tests/fixtures/m5/augment-rewards-oracle.cjs` | 保留光荣进化、挖角及硬性承诺等独立奖励计划；本轮未改 oracle 实现。 |
| `tests/fixtures/m5/oracle.g2.cjs` | 保留各分支独立转录的身份、位阶、奖励/阶段规则；本轮未改 oracle 实现。 |
| `tests/m5-oracle-augment-ledger.test.ts` | 保留所有独立账本断言；本轮将最终唯一身份数量同步为 242，43 项通过。 |

分支测试文件：`tests/augment-pool-batch5-s8c-room.test.ts`（12 项）、`tests/augment-pool-batch5-s8c.test.ts`（6 项）、`tests/augment-stage-bans-audit.test.ts`（10 项）、`tests/m5-oracle-augment-ledger.test.ts`（43 项）。

差异中的辅助文件由上述测试加载验证：`tests/fixtures/m5/augment-rewards-oracle.cjs`、`tests/fixtures/m5/hard-commit-roster.cjs`、`tests/fixtures/m5/oracle.g2.cjs`。

**`codex/v25-s11a` — 合并 `baa5784c`**

分支差异中的 2 个测试文件全部通过，共 16 项（跨分支共用文件重复计入本行，不能逐行相加）。

| 冲突文件 | 处理方式 |
| --- | --- |
| `docs/S13_RULES_GAP.md` | 保留两侧规则决定与分支记录，按内容追加；本轮未改规则。 |
| `scripts/tests/production-size.test.ts` | 合并提交保留集成基线摘要；本轮同步到用户重算后的 e0330731 / 6202a227，并通过 6 项生产体积测试。 |
| `src/simulation/content/augment-offer-rules.ts` | 合并各批次 API 名映射，保留已有提供过滤规则。 |
| `src/simulation/content/augment-policy.ts` | 并入各批次位阶表，保留已有策略。 |
| `src/simulation/content/augment-stage-bans.ts` | 保留各批次阶段限制；独立审计确认本次新增项，既有 5 项差异仍单独报告。 |
| `src/simulation/content/augments.ts` | 并入各批次定义；最终唯一强化总数为 242。 |
| `src/simulation/content/identity-constants.ts` | 合并提交保留集成基线身份；用户已全量重算，本轮保留用户工作区变更。 |
| `src/simulation/content/rules-manifest.ts` | 保留各批次规则清单入口，未覆盖其他分支入口。 |
| `src/simulation/validate-content.ts` | 并入各批次原始表与数量校验；最终内容测试通过。 |
| `tests/augment-stage-helpers.ts` | 保留各分支种子条目；本轮按合并后的 242 项池重新验证受影响的固定种子。 |
| `tests/fixtures/m5/oracle.g2.cjs` | 保留各分支独立转录的身份、位阶、奖励/阶段规则；本轮未改 oracle 实现。 |

分支测试文件：`tests/augment-pool-batch5-s11a-greater-moonlight.test.ts`（9 项）、`tests/augment-pool-batch5-s11a-moonlight.test.ts`（7 项）。

差异中的辅助文件由上述测试加载验证：`tests/augment-stage-helpers.ts`、`tests/fixtures/m5/oracle.g2.cjs`。

**`codex/v25-dynamic-values` — 合并 `53c69f3d`**

分支差异中的 2 个测试文件全部通过，共 13 项（跨分支共用文件重复计入本行，不能逐行相加）。

| 冲突文件 | 处理方式 |
| --- | --- |
| `docs/S13_RULES_GAP.md` | 保留两侧规则决定与分支记录，按内容追加；本轮未改规则。 |

`tests/augment-dynamic-round-boundary.test.ts` 不是重建出的文本冲突，但自动合并留下重复 `MatchState` 导入，导致 tsc 报 TS2300；本轮保留一个类型导入后通过。动态值私有投影的旧白名单测试已加入该公开给自席的字段及明确值断言。

分支测试文件：`tests/augment-dynamic-round-boundary.test.ts`（3 项）、`tests/augment-dynamic-values.test.ts`（10 项）。

**测试结果**

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit -p .` | 通过，退出码 0 |
| 最终定向 Vitest 组合 | 21 个文件，482 项全部通过，0 失败、0 跳过；31.70 秒 |
| `scripts/tests/production-size.test.ts` | 6/6；包括压缩前后内容摘要、状态、事件、RNG、恢复语义与 Phaser 裁剪边界 |
| 独立 oracle | `m5-oracle-augment-ledger` 43/43、`g2-augments-choice` 169/169；各批次测试的独立奖励/位阶校验通过 |
| 阶段禁用审计测试 | 10/10；真实资料审计仍按预期退出 1 并精确报告原有 5 项差异，不代表来源审计零问题 |
| `tests/augment-history*.test.ts` | 当前工作区与 Git 跟踪清单均无匹配文件，无法执行，不计为通过 |
| `git diff --check` | 通过 |

最终命令及完整输出位于本地忽略目录：`artifacts/v25-int-c/command.txt`、`results.json`、`vitest.log`、`branch-test-manifest.json`、`merge-conflicts.json`、`verified-seeds.json`。分支测试清单来自逐分支执行 `git diff --name-only origin/multiplayer...origin/<分支> -- tests`，16 个不同测试文件均已覆盖；另外 5 个文件是生产体积、强化提供/位阶表/位阶一致性、私有投影测试。

共享 `node_modules` 为只读，故使用 `--configLoader runner`。最终运行配置 `artifacts/v25-int-c/vitest.config.ts` 继承仓库项目、worker setup 和调度配置，仅清空无关的共享浏览器 `globalSetup`；本轮无浏览器测试，也没有可用浏览器桥接环境。并发上限为 3，未增加测试超时、删除断言或重录 golden。

**修复后的固定路线**

| 目标 | 已验证路线 |
| --- | --- |
| 最小巨人+ | 3-2，seed 7；两个相关用例统一使用 `offerFor` |
| 最小巨人联机 | 房间 seed 6，自席 s2；保留真实结算和篡改拒绝 |
| 光荣进化 | 4-2，fielded seed 27，直接公开报价；27 项完整通过 |
| 高级月光 | 4-2，fielded seed 8，直接公开报价 |
| 天才 | 4-2，fielded seed 38，直接公开报价 |
| 硬性承诺联机 | 房间 seed 7，自席 s1；验证至 3-1 的阶段赠品和共享恢复 |

【未完成】`tests/augment-history*.test.ts` 在此集成分支不存在，无法完成该指定项；需要对应提交或实际路径。其余本轮已选择的检查均已通过。

【风险】独立来源审计仍有五项已有阶段禁用差异：`TFT13_Augment_Academy`（4-2）、`TFT13_Augment_Cabal`（2-1/4-2）、`TFT13_Augment_Experiment`（2-1）、`TFT13_Augment_Formswapper`（2-1）、`TFT13_TeamupAugment_BloodBrothers`（2-1/4-2）；前三项内容当前禁用，后两项启用。测试精确报告这些差异，本轮未修改既定规则或摘要。其他未执行套件的旧固定种子不在本次通过范围。

【风险】S8A 原分支报告中 B5-56 金色收获、B5-58 禁忌魔法仍未实现，原因是缺少可认证的逐战击杀/参与击杀事实；本轮验证不改变该既有功能范围。

【需要我决定】本轮修复无待拍板项。若补齐指定的 history 验证，请提供其所在提交或实际路径；阶段规则差异另行按既有玩法决策流程处理。

【下一步】交叉复核本报告及测试改动；补齐 history 测试后仅追加相关验证。当前工作区保留修改，未暂存、提交、合并或推送。
