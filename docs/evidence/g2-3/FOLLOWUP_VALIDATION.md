# #136 后收尾验证（G2-3 v2）

从 multiplayer `e1d9617ea5f4de67b6ea6eb953cf6f8e76578ad6` 开工，完成前同步 #139 至 `f7b55ceaac9a3b22652c3e64aff77e81a14d89da`。规则/内容身份升至 `s13-g2-3-v2` / `s13-14.24b-g2-3-v2`，content digest `fnv1a32-utf16:427b83b0`，loot replay digest `fnv1a32-utf16:244e8419`。schema/save/replay/protocol 不变；旧身份仍严格拒绝。

| 改动 | 对应回归 |
| --- | --- |
| 机器人读光明、炼金和未知物品 | `t7-bot-policy`：特殊目录物品可决策、未知 ID 不崩溃且不消耗 RNG |
| 经济重放有界内容缓存、前缀复用、奖励原子缓存 | `g2-3-followup`：可变输入篡改、轮次界限、全部聚合、前缀和 seed/descriptor 隔离 |
| 单次恢复内共享机制声明计算 | `g2-3-anomalies`：原有护盾伪造拒绝、合法声明仍可恢复 |
| 快照、历史和激活存档复用不可变子图 | `g4-replay-snapshot`、`m6-replay`、`m6-persistence`：别名/循环/稀疏数组、原型键、浅冻结、getter、观察后篡改输入和激活隔离；仅本地文件完成校验后的档案证明不可变，外部对象不冻结 |
| 整档导出复用私有冻结战斗档案 UTF-8 Blob | `m6-persistence`：逐字节等于原生 JSON、Unicode、可变字段、外部冻结伪装不缓存 |
| CI 慢夹具 | `m5-growth` 使用同一 seed 的预热；`m8-b5-equipment-history` 共享获取路线，仅记录开战/结束快照并保留全部事件，独立对比普通记录器全部字节；原有 18 场完整档案校验保留 |
| 补回选秀出生登记、removedUnitIds、损坏机制收据错误 | `g2-3-followup`：合法 fold、重复/伪造拒绝、字符串数组与现役 ID 分离、text/object 均报 Invalid Match save |
| Power Absorption 固定 AD | `g2-3-anomalies`：55% 装备 AD + 30% 异变 AD 后加吸收的4AD，结果59；重复 tick 不重发，恢复候选含59 |
| Titan 后菜单、免费 timeout、统一形态 | `g2-3-followup`：Titan 后只给免费 Finishing；双阵营所有行对照共享 resolver |
| 军械库刷新守卫、自动钩子失败 | `g2-3-hook-failures`：不被黑市或另一 choiceId 覆盖；rewards/academy/三种 choice 失败可观测、不写失败收据或扣资源；刷新失败事件不丢失 |
| U6 读取竞争 | `u6-panel-snapshot`：同一次浏览器任务读取领域与 DOM；结算后的 revealed 不算战中覆盖；真实浏览器 U6 11 检查、0 页面错误 |
| 版本与重录 | `m8-contracts`、`match-contract`、G2-3 内容/集成及 B7 恢复回归；原生成器重录 release / Herald / inputs / live-reveal，232 个规则源码摘要一致，历史夹具未改 |

开发中仅运行相关文件。最新核心批次10文件159项通过，内容/导出批次6文件119项通过，路线批次4文件43项通过，最终编码与成员列表回归44项通过（各批次有重叠，不相加）。构建通过。最终 PR head 的完整 `npm test` 和 `npm run test:timing` 各运行一次，结果记录在 PR，避免为写结果再次改 head。

U6 原始失败证据为 [run 38938055193](https://github.com/catfish-xn/cat/actions/runs/38938055193)、job 117098416536：状态读取与 DOM 读取间发生结算，原 revealed 断言失败，无页面错误。修复没有放宽观测要求或超时；仍强制观测到真正的战中 revealed，并验证结算后的发放收据。

性能门槛、单测超时、CI 实际作业时限均未调整。M5_CI_BUDGET 只同步 ci.yml 已有的45分钟 input 时限。开发中两次性能复测曾失败（先有生成器并行负载，后无并行负载）：activation 分别779/862ms通过，fullCapture 548/713ms超出500ms；第一次 statsBatch 6.2ms超出5ms，第二次0.3ms通过。这些失败促成后续整档导出优化，不算作通过证据。

逐场 Blob 缓存的第三次开发门槛复测：activation最大756ms通过，fullCapture首次623ms超限，之后11次10–29ms；其余门槛通过。由此进一步改为整份冻结档案缓存和追加前缀复用，单次UTF-8写入；大文件回退原生编码，临时缓冲不留在缓存。最终测量结果在下方和PR记录。

第四次门槛复测全部通过：fullCapture首次370ms；activation最大982ms仅剩18ms余量，因此继续消除文件解析完成后激活阶段的重复档案复制。文件边界只在全部校验后冻结/证明本地拥有的档案，对象输入的隔离语义保持。后续最终测量另记。


最终候选源码复测（2026-10-17，原 `scripts/verify-m6-performance.cjs`，无并行计时负载）全部通过。源码指纹 `c9e7dc2ea988b96985ad5b1d6fab46cd14021f6998a3de0203a5b978d970fefb`；构建与类型检查通过。下表单位 ms，统计口径保持原脚本。

| 门槛 | 实测 | 上限 |
| --- | ---: | ---: |
| capture p95 | 24.3 | 50 |
| write p95 | 41.4 | 250 |
| fullCapture p95 | 367.2 | 500 |
| activation max | 519.3 | 1000 |
| completeImport max | 14529.7 | 30000 |
| firstSeek max | 1549.4 | 2000 |
| cachedSeek max | 65.7 | 100 |
| statsBatch max | 0.3 | 5 |

12次 activation：303.8、432.2、519.3、308.2、207.0、214.4、183.4、188.8、194.4、198.8、241.9、186.0ms，最大值距上限480.7ms。33场满载导入/激活/读盘往返11834.1ms，内容一致；独立图结构校验通过；生命周期堆增长435152B低于1048576B。完整验收耗时369.1秒。该结果证明本机余量，CI实测以PR作业为准。

最后文件所有权变更的相关回归 `m6-persistence` / `m6-replay` 共2文件53项通过。最终提交后不再为补测试结果改head；全套与CI结果维护在PR描述。


CI首轮候选 `3579db2` 的快测253文件3419项、timing7文件34项、构建、24种子headless和12条重复性能路线均成功；作业在22分钟边界上传完证据后被标为cancelled（[job117277436482](https://github.com/catfish-xn/cat/actions/runs/38992401690/job/117277436482)）。实测步骤为691秒快测、216秒timing、19秒build、246秒headless、122秒重复路线，上传约12秒。不是用例仍超时，但整作业没有余量。

因此仅调整CI编排：serial timing和build完成后，同时启动两个独立的路线生成进程。原命令、24种子与3次×4构筑路线、各项断言、输出目录、逐步骤计时及22分钟上限保持；任一子进程非零退出、信号退出或启动失败均使批次失败，并等待另一组证据完成。`ci-route-evidence` 4项验证启动并行、等待全部结果、命令/目录和失败传播。原F4有墙钟门槛的浏览器测量仍在独立input-dev作业中，不与此批次竞争。规则源码和性能源码指纹未再变更，最终head的全套由CI各执行一次，不为仅CI编排的变动再在本地重复全套。

本地首轮候选快测252文件3418项通过，唯一失败是room选择窗口在并行负载下5743ms超过原5000ms；随后只跑该room文件13项通过。GitHub同候选全套无此失败。本地timing7文件34项通过。原始失败仍保留，不宣称本地全套全绿。
