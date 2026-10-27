【完成】V25 集成 B 验证报告（2026-10-27）

工作树 `claude/v25-int-b`，HEAD `e559f7c1`，比较基线 `origin/multiplayer=100589ca`。7 次合并均由用户事先完成。本次只做文件编辑与 Git 只读查询，没有 fetch、checkout、merge、add、commit 等 Git 写操作；未修改服务器或界面。

冲突文件取自各 merge commit 的 `# Conflicts` 记录；下表的“处理方式”是对最终合并树的核对及本次补修，并非声称重新执行了合并。所有内容身份沿用用户已重算的 `content=fnv1a32-utf16:9d13d95c`、`loot=fnv1a32-utf16:9494a256`；本次未重写 `identity-constants.ts`。

| 分支 / 合并提交 | 冲突文件（完整相对路径） | 处理方式 | 分支差异中的可执行测试 |
| --- | --- | --- | --- |
| `codex/v25-b5a` / `d03835b5` | `scripts/tests/production-size.test.ts`<br>`src/simulation/content/identity-constants.ts` | 两处均为内容身份冲突：已有合并保留基线值，用户合并后统一重算；本次保留用户身份常量，生产压缩测试同步到同一 content/loot digest。修正 + 版与 Roll the Dice 的公开选取种子。 | 9 个文件，365 项通过 |
| `codex/v25-s1a` / `95797827` | `docs/S13_RULES_GAP.md`<br>`scripts/tests/production-size.test.ts`<br>`src/simulation/content/augment-offer-rules.ts`<br>`src/simulation/content/augment-policy.ts`<br>`src/simulation/content/augment-stage-bans.ts`<br>`src/simulation/content/augments.ts`<br>`src/simulation/content/identity-constants.ts`<br>`src/simulation/content/rules-manifest.ts`<br>`src/simulation/validate-content.ts`<br>`tests/fixtures/m5/oracle.g2.cjs` | 最终树保留 B5A 与 S1A 的注册、位阶、阶段表、说明及独立 oracle；额外刷新与下一次位阶提升共用既有 Match 入口，注册计数累加而非覆盖。真实房间刷新与恢复测试通过；身份统一处理同上。 | 4 个文件，18 项通过 |
| `codex/v25-s1b` / `79b0fa89` | `scripts/tests/production-size.test.ts`<br>`src/simulation/augment-offers.ts`<br>`src/simulation/content/augment-offer-rules.ts`<br>`src/simulation/content/augment-policy.ts`<br>`src/simulation/content/augments.ts`<br>`src/simulation/content/identity-constants.ts`<br>`src/simulation/content/rules-manifest.ts`<br>`src/simulation/match.ts`<br>`src/simulation/validate-content.ts`<br>`tests/augment-stage-bans-audit.test.ts`<br>`tests/fixtures/m5/oracle.g2.cjs`<br>`tests/m5-oracle-augment-ledger.test.ts` | augment-offers/match 同时保留 S1A 的额外刷新、位阶提升和 S1B 的后续节点跳过、XP/刷新转换；注册表与 oracle 合并并集。本次固定新池的公开种子 101/123，修正总池数量断言为 250；阶段审计保留真实剩余差异。 | 4 个文件，92 项通过 |
| `codex/v25-s3a` / `cbdbc568` | `docs/S13_RULES_GAP.md`<br>`scripts/tests/production-size.test.ts`<br>`src/simulation/augment-pool-grants.ts`<br>`src/simulation/content/augment-offer-rules.ts`<br>`src/simulation/content/augment-policy.ts`<br>`src/simulation/content/augment-stage-bans.ts`<br>`src/simulation/content/augments.ts`<br>`src/simulation/content/identity-constants.ts`<br>`src/simulation/content/rules-manifest.ts`<br>`src/simulation/match.ts`<br>`src/simulation/shop-history.ts`<br>`src/simulation/validate-content.ts`<br>`tests/augment-stage-bans-audit.test.ts`<br>`tests/fixtures/m5/oracle.g2.cjs`<br>`tests/m5-oracle-augment-ledger.test.ts` | 奖励计划、Match 和商店历史保留前序刷新规则，同时接入自助餐、古董与潘朵拉 I 的库存转换及恢复；Fine Vintage 按后续用户决定仅 2-1 开放，未采用早期报告的全禁选结论。本次修正种子与满席前的真实开场战斗/归队顺序。 | 9 个文件，91 项通过 |
| `codex/v25-s3b` / `8c5d8cd4` | `docs/S13_RULES_GAP.md`<br>`scripts/tests/production-size.test.ts`<br>`src/simulation/anvils.ts`<br>`src/simulation/augment-pool-grants.ts`<br>`src/simulation/b8-restore.ts`<br>`src/simulation/content/augment-offer-rules.ts`<br>`src/simulation/content/augment-policy.ts`<br>`src/simulation/content/augment-stage-bans.ts`<br>`src/simulation/content/augments.ts`<br>`src/simulation/content/identity-constants.ts`<br>`src/simulation/content/rules-manifest.ts`<br>`src/simulation/resource-provenance.ts`<br>`src/simulation/shared-pool.ts`<br>`src/simulation/shop-history.ts`<br>`src/simulation/validate-content.ts`<br>`tests/augment-stage-helpers.ts`<br>`tests/fixtures/m5/augment-rewards-oracle.cjs`<br>`tests/fixtures/m5/oracle.g2.cjs` | anvils、grants、b8-restore、resource-provenance、shared-pool、shop-history 同时保留 S3A 与 S3B 的计划、转换、来源认证及回放检查；两个独立 oracle 的逻辑均保留。本次修正学术研究已启用的来源预期，潘朵拉 II 改用 seed 9 的公共刷新路线；审计接受合法空禁用表并仍拒绝应禁却空的表项。 | 3 个文件，52 项通过 |
| `codex/v25-s3c` / `1858a629` | 无（提交未记录冲突） | 合并提交无冲突记录，最终差异仅新增 P-B5-S3C 产品约定；没有规则代码或测试文件，不把约定文档算作三项功能已实现。 | 无新增/修改测试 |
| `codex/v25-s3d` / `e559f7c1` | `scripts/tests/production-size.test.ts`<br>`src/simulation/augment-acquisition.ts`<br>`src/simulation/augment-pool-grants.ts`<br>`src/simulation/content/augment-offer-rules.ts`<br>`src/simulation/content/augment-policy.ts`<br>`src/simulation/content/augment-stage-bans.ts`<br>`src/simulation/content/augments.ts`<br>`src/simulation/content/identity-constants.ts`<br>`src/simulation/content/rules-manifest.ts`<br>`src/simulation/shared-pool.ts`<br>`src/simulation/validate-content.ts`<br>`tests/augment-stage-bans-audit.test.ts`<br>`tests/fixtures/m5/augment-rewards-oracle.cjs`<br>`tests/fixtures/m5/oracle.g2.cjs`<br>`tests/m5-content.test.ts` | acquisition 同时保留 B5A 固定神器选择与反响的组件选择；grants/shared-pool 保留前序奖励、S3A/S3B 恢复认证及 S3D 的重复发放防护；内容/阶段/规则及 oracle 注册取并集。最终注册数 250，本次真实房间反响路径固定为 seed 9。 | 5 个文件，34 项通过 |

各分支测试范围严格由 `git diff --name-only origin/multiplayer...origin/<分支> -- tests` 提取。测试范围按文件去重，修复后定向复跑；`.cjs` oracle、辅助 `.ts` 与 `.d.cts` 由其调用测试及 tsc 覆盖，未将它们误当成可独立运行的测试。分支间共享测试导致上表数量不可相加。

【完成】验证结果

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit -p .` | 通过；最终日志 `artifacts/v25-int-b-validation/tsc.log` |
| 7 个分支的变更测试（去重） | 29 文件，530 项通过 |
| `scripts/tests/production-size.test.ts` | 6/6 通过；原包与压缩包的内容/loot、状态、事件、RNG、恢复一致 |
| `tests/content-identity-constants.test.ts` 与 `node scripts/update-content-identities.cjs --check` | 6/6 通过；完整内容身份检查通过 |
| 全部联机相关及要求覆盖的定向检查 | 合并两次最终结果：43 文件、952 项通过，0 失败、0 跳过；未跑全套 |
| `git diff --check` | 通过 |
| `tests/augment-history*.test.ts` | 当前 HEAD、工作树及这些分支差异中均无匹配文件；无法执行，见遗留项 |
| 独立阶段审计 CLI | 正常完成；退出码 1，明确报告 4 项既有表差异。对应 12 项测试通过，未隐藏 CLI 失败 |

独立 oracle 覆盖包括 `m5-oracle-augment-ledger`、B8 oracle/command-oracle、强化抽取/刷新/位阶、B5A 独立数值、S3A 库存推导、S3B BigInt 随机与配方，以及各分支的真实房间和共享恢复测试。补充运行商店历史、资源来源和 Batch 5 既有结算/奖励测试，用于核对共享调用点的合并影响。

测试调用统一使用 `npx vitest run --project fast --configLoader runner --maxWorkers=4 <明确文件列表>`；商店历史补修后单独以 `--maxWorkers=1` 复跑 43 项。默认 Vite 配置加载器会写入当前工作树之外的共享 `node_modules/.vite-temp` 并触发 EROFS，故使用 runner。阶段审计仍运行真实 Node CLI，改为临时文件承接标准输出/错误以避免沙盒管道读取 EPERM；未跳过断言、mock CLI 或提高超时。

本次测试修复包括：按 250 卡合并池更新固定种子/公开刷新路线；避免将不可移动魔像、不可出售工具当作普通弈子夹具；通过真实开场战斗取得满席所需资源；从真实基础装备锻造器领取第二组件后测试合成刷新历史。未改变生产规则、数值、golden 或存档版本。

完整通过清单及各文件用例数：

| 测试文件 | 通过项数 |
| --- | --- |
| `scripts/tests/production-size.test.ts` | 6 |
| `tests/augment-card-reroll.test.ts` | 12 |
| `tests/augment-pool-batch1.test.ts` | 131 |
| `tests/augment-pool-batch4-b4combat.test.ts` | 18 |
| `tests/augment-pool-batch4-b4reroll.test.ts` | 43 |
| `tests/augment-pool-batch4-b4xp.test.ts` | 13 |
| `tests/augment-pool-batch5-b5a-room.test.ts` | 3 |
| `tests/augment-pool-batch5-b5a.test.ts` | 9 |
| `tests/augment-pool-batch5-fate.test.ts` | 31 |
| `tests/augment-pool-batch5-s1a-beggars.test.ts` | 2 |
| `tests/augment-pool-batch5-s1a-power.test.ts` | 3 |
| `tests/augment-pool-batch5-s1b-at-what-cost.test.ts` | 21 |
| `tests/augment-pool-batch5-s1b.test.ts` | 16 |
| `tests/augment-pool-batch5-s3a-pandora.test.ts` | 5 |
| `tests/augment-pool-batch5-s3a-source.test.ts` | 6 |
| `tests/augment-pool-batch5-s3a-vintage.test.ts` | 3 |
| `tests/augment-pool-batch5-s3a.test.ts` | 4 |
| `tests/augment-pool-batch5-s3b-history.test.ts` | 17 |
| `tests/augment-pool-batch5-s3b.test.ts` | 20 |
| `tests/augment-pool-batch5-s3d-replication.test.ts` | 3 |
| `tests/augment-pool-batch5-s3d.test.ts` | 3 |
| `tests/augment-pool-batch5-settlement.test.ts` | 6 |
| `tests/augment-pool-batch5-shared.test.ts` | 1 |
| `tests/augment-pool-batch5.test.ts` | 12 |
| `tests/augment-pool-shop.test.ts` | 24 |
| `tests/augment-pool-source.test.ts` | 102 |
| `tests/augment-stage-bans-audit.test.ts` | 12 |
| `tests/augment-tier-consistency.test.ts` | 7 |
| `tests/content-identity-constants.test.ts` | 6 |
| `tests/g2-augments-choice.test.ts` | 179 |
| `tests/m5-content.test.ts` | 9 |
| `tests/m5-oracle-augment-ledger.test.ts` | 43 |
| `tests/m8-b8-command-oracle.test.ts` | 6 |
| `tests/m8-b8-oracle.test.ts` | 25 |
| `tests/m8-b8-resource-provenance.test.ts` | 64 |
| `tests/s13-p1-acquisition.test.ts` | 3 |
| `tests/server/augment-pool-batch5-s3a-pandora.test.ts` | 5 |
| `tests/server/augment-pool-batch5-s3a-vintage.test.ts` | 9 |
| `tests/server/augment-pool-batch5-s3a.test.ts` | 4 |
| `tests/server/batch5-s1a-room.test.ts` | 1 |
| `tests/server/batch5-s3b-room.test.ts` | 15 |
| `tests/server/batch5-s3d-room.test.ts` | 7 |
| `tests/shop-history.test.ts` | 43 |

【未完成】与阻塞

1. 请求中的 `tests/augment-history*.test.ts` 文件族不存在。本轮执行了现有 S3B history、shop-history、resource-provenance 及分支自带恢复认证；它们不冒充缺失文件族。需要取得该文件族所属分支或修正文件名后再补跑。
2. 额外尝试的 `tests/m8-b5-equipment-history.test.ts` 是 seed 42 的单机长路线；初始化将锻造器当弈子部署，返回 `invalid-location`。该文件 1 项通过、8 项因 beforeAll 失败未执行。按“单机不是目标”保留原文件，未继续改变这条单机历史路线；它不计入上述 43 文件 / 952 项通过结果。
3. `s3c` 仅登记 P-B5-20/22/23：打捞桶+、神器工厂、潘朵拉的装备 III 的约定，未交付实现或测试。本次只核验已合入内容，不补做该分支尚未实现的功能。
4. 独立阶段审计剩余 4 项来源与生产表差异。S3B 已补齐学术研究的 4-2 禁用，因此原 5 项变为 4 项；本次只修审计兼容性，未擅自修改旧玩法。

| apiName | 来源要求禁用节点 | 当前表记录 |
| --- | --- | --- |
| `TFT13_Augment_Cabal` | 2-1, 4-2 | 无（等价于 `[]`） |
| `TFT13_Augment_Experiment` | 2-1 | 无（等价于 `[]`） |
| `TFT13_Augment_Formswapper` | 2-1 | 无（等价于 `[]`） |
| `TFT13_TeamupAugment_BloodBrothers` | 2-1, 4-2 | 无（等价于 `[]`） |

【需要我决定】本轮验证与测试修复无需补充决定。若后续要消除阶段审计差异，建议另开规则任务核对约定后修表；也可保留当前玩法并记录经确认的覆盖，不能只改测试为绿。

【风险】本轮未重录旧 epoch，未跑全套、浏览器验收或单机全面回归；通过结果不能外推为这些检查已通过。部分未被本轮测试使用的阶段种子仍沿用旧池。旧分支报告可能描述合并前状态，以当前代码和本报告为准。

【下一步】评审本次测试/脚本补修；补充缺失历史测试的来源，单独处理 4 项阶段规则差异及 S3C 未实现内容。

验证证据保存在 gitignore 的 `artifacts/v25-int-b-validation/`：`results.json` 为去重合并结果，`selected-run.json/log` 保留首次统一运行（含两个初始化失败），`shop-history-final.json/log` 为修复后的补跑，`stage-audit.json` 保留原始差异，`test-files.txt` 为最终通过清单。临时种子探测测试已删除。
