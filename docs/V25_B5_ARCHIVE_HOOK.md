# v25 B5 archived-save hook 修正

基线为 `claude/v25-archive-hook @ 6c9f2a98`。本轮只修改本测试、专用 fixture 和本文档，不修改 `src/`、golden、超时或 Git 元数据。

## 缓存证据的来源

实时建档、未装备路线、战斗档案重演的公共命令始终执行原实现，既不能写入，也不能读取测试缓存。独立的 `beforeAll(..., 20_000)` 首次执行真实 `restoreMatch(archivedState)`，其内部 `validateAugmentHistory` 帧中的公共命令结果才可进入缓存。测试断言：实时建档后记录数为零；首次 restore 零命中且确实记录重放结果；restore 与实时状态完整相等。通过后才 seal，新分支只执行真实命令，不继续记录。

缓存以来源完整 canonical 内容和命令名、参数、有序前缀的 SHA-256 为键，`-0` 保持冷路径；证明含未包装的命令时整条证明也保持冷路径，避免跨过未知旁表变化。缓存只复用独立重建的前缀，不缓存候选存档的校验结论。每次原校验器仍执行证明形状、事实和最终状态比较，与生产的 restore-only `replays` 前缀缓存保持同一证据边界。

## 对象身份与隔离

缓存保留**真实重放结果的原状态对象**，因此 `traces`、`preparationTimes` 和可能关联的其他 WeakMap 数据都随同一身份保留；不再制造仅复制 trace 的替代状态。此 fixture 是 solo 路线，服务器的 `acquisitionContexts` 不参与；身份保留也避免将来增加旁表时静默丢失信息。

每个私有重放状态的 `augmentHistory.facts` 用 getter 保存完整追加前缀，下一条命令运行后释放旧数组，避免二次数量级的数组保留。原校验器读取时仍获得完整、稠密且逐项相同的数组。生产冻结某个前缀后不再释放其数组，保证 getter 始终返回同一个已冻结对象。seal 不冻结任何实时事实。

缓存图来自独立 restore：生产先分离 origin，命令参数也分离后再执行。它不引用实时候选状态的嵌套图；信封的 `match` 另以 `structuredClone` 分离。新增图遍历断言，在首次 restore 和完整信封校验前收集候选中所有可变对象，校验后逐个确认没有被意外冻结，防止候选命中 `isFrozenContent` 快路径而掩盖实际工作量。

## 篡改判据与完整档案

删除前次新增的 `withoutCache` 比较。它无法清空生产模块级 `replays`，不构成独立基线。三个篡改用例各调用一次 restore，保留失败及输入不变断言，并增加具体执行证据：

- origin：金钱加一导致来源键改变；零缓存命中、确实 miss，全部证明命令真实执行，重放得到被篡改的来源和不同的最终金币。
- command：最后一个 `buyXp` 改为 `rerollShop`；此前前缀命中，仅真实执行这一条新命令，最终金币比合法状态多 2、商店 generation 多 1，重放证明确为篡改后的命令链。
- facts：删除最后一条事实；全部真实重建前缀可以复用，无额外命令执行，但完整重放状态必须仍等于合法实时状态、事实数比候选多一，原校验器因最终比较不等而拒绝。

这些断言同时检验分支选择与实际输出，不再仅比较两个通用错误字符串。合法信封继续完整校验 18 场战斗、8,048 次 tick；计数断言保留，原来的存档成功与装备伪造拒绝断言均保留。已删除 `console.info`。

## 验证记录

所有 Vitest 运行只选择 `tests/m8-b5-equipment-history.test.ts`，使用 `--maxWorkers=4`，每次新建进程和运行期 fixture 目录，不跨运行复用结果。由于此工作区的 `node_modules` 为只读链接，默认配置加载器写临时 bundle 时返回 EROFS；添加 `--configLoader runner` 继续使用原配置，无权限升级。

最终恢复后的两次独立冷进程：`archived save` 筛选 **1/1 通过**，CLI 总时长 **37.38 s**；整文件 **12/12 通过**，CLI 总时长 **59.97 s**。这些总时长包含转换、导入和全部准备工作，不等同于单个 hook。

hook 时间使用临时包装逐个测量回调执行时间，用例时间取自 Vitest JSON reporter；临时计时包装已还原，测试文件不保留日志或计时代码。下表单位为秒：

| hook | archived-save 冷筛选 | 整文件冷跑 |
| --- | ---: | ---: |
| 安装 offer 策略与 replay spy | 0.002 | 0.002 |
| 实时生成 archivedState / 18 场档案 | 9.614 | 9.274 |
| 生成未装备分支 | 4.178 | 4.212 |
| 首次真实 restore / 记录并封存前缀 | 7.892 | 7.746 |
| 完整合法信封校验 / 档案真实重演 | 9.570 | 9.714 |
| afterAll 恢复 spy、offer 策略 | <0.001 | <0.001 |

| 用例（整文件冷跑） | 秒 |
| --- | ---: |
| 伪造历史 level5 为 level7，RNG 仍一致 | 0.724 |
| settled supply round 的历史等级下界 | 0.640 |
| unsettled current round 的历史等级下界 | 0.577 |
| T12 post-settlement levelAfter 上界 | 0.584 |
| 合法 pre-F roll 的当前、结算、历史恢复 | 4.144 |
| 同轮 F 后首次装备的上界 | 7.801 |
| 先验证历史经济再使用装备等级边界 | 0.499 |
| 完整信封拒绝伪造历史等级 | 0.564 |
| 伪造 augment proof origin | 7.316 |
| 伪造 augment proof command | 0.235 |
| 伪造 augment proof facts | 0.272 |
| CompletedBattleHistory 字节保留与 live-prefix 拒绝 | 0.105 |

archived-save 冷筛选中的信封伪造用例为 **0.554 s**。各 hook 均低于本机 10 s 目标；整文件所有用例均低于 8 s。最长 hook 距目标仅约 0.286 s，最长用例距目标约 0.199 s，不能据此保证任意系统负载下的时间。实际 CI 尚未运行，hook 显式上限和 testTimeout 均保持 **20,000 ms**。

另起冷进程，仅筛选 `forged augment proof`：**3/3 通过**，origin **6.952 s**、command **0.265 s**、facts **0.244 s**，CLI 总时长 **34.40 s**。未执行前序装备或信封用例，三个篡改用例仍各低于 8 s。该次直接运行未加临时计时包装的最终测试文件。

### 故意制造实时 / 重放差异

临时在实时建档 hook 完成后，把原状态第一条 `acquire` 事实的 `preparationElapsedMs` 原地改为 **1234**，不改 origin 或命令链。这模拟只有实时侧知道的准备时间观测；旧版实时缓存会与该事实对象共享引用。新建进程筛选 `archived save`，第一次真实 restore 在 `src/simulation/augment-history-restore.ts:245` 的最终比较失败，报 **`RangeError: Invalid augment history: replayed facts/state mismatch`**，退出码 **1**，未进入信封用例。确认校验器没有通过实时缓存自证。

注入在 `finally` 中还原；随后上述冷筛选与整文件复跑均通过，工作区无 1234 注入、计时包装或 `console.info` 残留。

### 范围核对与复现

TypeScript AST 多重集比对确认基线中的 **47 条 expect 表达式语句全部原样保留**（包括 await expect），没有删减或改弱 matcher；只移除前次新增的缓存开关比较断言，并加入更具体的执行及状态判据。`git diff --check` 通过，`src/` 差异为空，无 Git 写操作、提交或素材新增。

```bash
npx vitest run tests/m8-b5-equipment-history.test.ts -t "archived save" --maxWorkers=4 --configLoader runner
npx vitest run tests/m8-b5-equipment-history.test.ts --maxWorkers=4 --configLoader runner
npx vitest run tests/m8-b5-equipment-history.test.ts -t "forged augment proof" --maxWorkers=4 --configLoader runner
git diff --check
```
