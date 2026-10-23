# v20-black-market 验证与断言变更清单

只跑与黑市/微光、当前和父 epoch 引用相关的测试，不跑全套，不改 CI、既有超时、门槛或断言强度。文件选择由 `git grep -l -i -E '黑市|black.?market|chem.baron|shimmer|v20-live-combat|v20-black-market' -- tests` 得到 `.test.ts` 文件，再加入新增专项；最终53文件见 [selected-test-files.json](selected-test-files.json)。不修改服务器和界面测试，相关文件仅运行。

## 因规则变化替换的既有断言（逐项）

| 文件 | 旧断言/测试输入 | 新规则等价断言 |
| --- | --- | --- |
| `tests/chem-baron-fix.test.ts` 抽样 | 最多三包，BigInt oracle 三次抽样 | 八档×四 seed 都是一个包，独立 BigInt oracle 一词，完整包 ID/RNG 精确相等；新增源权重边界测试 |
| 同文件领取/公共 choose/重复领取 | `optionIds.length===3`；领取第二候选 | 长度严格1，领取唯一包；整包 reward、清空、保留、失败原引用、无事件、RNG不变、重发拒绝保留，增加重复超时拒绝 |
| 同文件 Family/Mel 混合重放 | 非首项黑市包 | 唯一整包，Family/Mel/黑市完整账本重放逐字段相等，伪造收据仍拒绝 |
| 同文件路线 oracle | 三包/第二候选 | 单包/唯一候选，PvE、领取和保留每次仍按独立 oracle 验证 |
| `tests/fixtures/m5/oracle.g2.cjs` | 每 offer 最多三词 | 每 offer 一词，独立手录权重、BigInt LCG、冠冕先后及收据校验保持；未导入生产抽样实现 |
| `tests/live-combat-inputs.test.ts` | 流式/整轮结算的包数及去重数=3 | 两者均严格=1；完整结算、决策、重放和RNG比较保持 |
| `tests/g2-4a-crown-gold.test.ts` | 黑市3词 + 三冠冕3词 =6 | 黑市1词 + 三冠冕3词 =4；顺序、结果、收据精确校验保持 |
| `tests/g2-3-lesser-shimmer-duplicator.test.ts` | 自然黑市三候选分别恢复；连续市场 oracle 三词 | 唯一包恢复，重复发放拒绝；18轮/16次 offer 精确比较单词抽样游标，发放和决策不耗词，未修改轮数或恢复要求 |
| `tests/opening-random-identity.test.ts` | v20-live-combat 是运行时 current | 父 epoch 改为原始历史输入/身份/hash 核验并拒绝恢复；同等完整 current 身份、CURRENT Herald、134检查点、digest、公开路线审计移到新增 v20-black-market 测试；额外逐字段拒绝父 rules/content/digest（对象及文本） |
| `tests/g2-4b-artifacts.test.ts` | policy revision=`g2-4b-v20-chem-baron` | 严格等于新 revision=`g2-4b-v20-black-market`，29件神器及其所有数值断言不变 |
| 其他当前消费者 | 当前版本字面量或 current fixture 路径为 v20-live-combat | 指向新 epoch 等价断言；所有历史版本化文件不改，测试内容和门槛不变 |

没有用放宽比较、删用例、跳过测试或修改旧 golden 通过验收。`g2-3-netcode-hooks` 的三个合成“alchemist”选项测试属于通用机制选择接口，不是 `advanceG23Economy` 生成的 Chem-Baron 黑市，仍保留原通用能力测试。

## 新增测试

`tests/black-market-single-offer.test.ts`：从 gzip 归档读取八档源权重，验证每一个加权区间的首/末 RNG word；LCG 模逆构造输入，不调用生产 RNG oracle。验证所有档位严格一词、一整包。另用公开资源收据建立测试阵容，真实战斗获得微光及黑市，检查唯一包私有投影、未提供但合法的池内 ID 原子拒绝、伪造候选拒绝恢复；领取全部多项原子、保留、对象/文本完整读档、恢复不发奖及重复命令拒绝。联机超时保留及重复超时由 `chem-baron-fix` 验证（单人不使用仅联机的 `forfeitPendingChoice`）。

## 执行记录

初次 typecheck 在新夹具尚未全部生成时只报新 JSON 导入缺失；生成完成后重跑通过。新增专项开发时误向单人状态调用联机超时入口，得到预期的 `multiplayer-required`；已将单人读档与联机超时测试分开，未修改生产入口。

首批4文件65项通过；新增/补强专项2文件32项通过。53文件批次初次1105通过/3失败：微光复制器测试残留的三候选/三词 oracle 两处断言，以及神器测试中的旧 policy revision 一处断言，按上表改为单包的精确等价断言，单文件重跑完整保留所有原测试。完整结果文件保留首轮与修正后证据，不隐藏失败。按每个文件最后一次完整运行合并，最终 **53文件 / 1108项通过，0失败、0跳过**，详见 [final-test-results.json](final-test-results.json)；各命令出口以 [validation.json](validation.json) 为准。

`verify-v20-black-market-epoch.cjs --write` 独立录制，再执行不带 `--write` 的完整11步核验；后者重新计算并逐字节比较夹具，不覆写旧输入。历史字节审计覆盖353个文件及指定 manifest。四条通用整局路线没有触发黑市，命令/事件差异断言仍为零；黑市的行为变化由专用真实路线、独立 oracle 和连续市场测试覆盖。

受影响/新增文件完整清单见 [changed-files.json](changed-files.json)。

## 2026-10-23 初始化调度重构的指纹维护

单场初始化改用可让出生成器，未改变规则、数值、RNG 顺序或内容身份。仅更新 `release-audit.json`、`input-fixture-audit.json`、`live-reveal-audit.json` 的 `sourceDigests`：8个已有规则源文件和新增 `setup-work.ts`。其余审计字段逐项与 HEAD `83fd7fa58fc7c935229c8f8866b14ec9d716accd` 比较保持不变；全部408个已跟踪 `tests/fixtures/` 文件字节不变。未运行 epoch 录制器，未改 golden、录像、content/loot digest 常量或测试断言。性能与一致性证据另存本地 `/home/aiapps/workspcae/perf-1022/battle-start/yield/REDO_REPORT.md`，指纹差异和夹具审计为同目录 `redo-source-fingerprint-update.json`、`redo-source-audit-check.json`、`redo-fixture-byte-audit.json`。

该重构最终相关验证为16文件159项通过（15文件156项完整复跑，身份专项3项；另147项未选中），typecheck与diff检查通过。原脚本剔除每回合首个预热样本的72次口径，连续调度/事件循环最大片分别16.36/23.79ms；最后无插桩事件循环复核包含预热84次全部≤50ms，最长48.44ms，uptime负载3.16/5.72/9.58→4.17/5.76/9.51。此前高负载及预热样本仍曾超50ms，全部保留在本地报告，不声称硬实时保证；未通过删样本、修改旧哈希或放宽50ms阈值取得上述结果。
