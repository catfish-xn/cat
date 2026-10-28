# v25 恢复证据与预览异常排查

基线：HEAD `97068956`，实际分支 `claude/sol-t2`，初始工作区干净。仅保留工作区修改，不执行 Git 写操作。

## 修改前确认

指定六文件复现 **20 失败 / 153 通过**（173 项）。以下结论先记录，再修改对应代码。

| 文件 / 原行号 | 分类 | 证据与拟修方案 |
| --- | --- | --- |
| `tests/m8-b5-instances.test.ts:99`（3 项） | 测试路线漂移（具体强化见下文实跑核对） | 合法装备控制在 `serializeMatch` 被 `serialization.ts:17` 拒绝，装备断言此前已通过；装备测试不应无意选入历史机制。 |
| `tests/m8-b5-grant-upgrade.test.ts:142`（1 项） | 测试路线漂移 | 同一双窃贼手套获取路线，在递归购买前已因缺 battles 被拒绝。 |
| `tests/opening-encounters-pr6.test.ts:257`（1 项） | 测试路线漂移 | 该测试验证 Mel 奇遇阈值收据，现有排除表未覆盖所有历史强化；不把奇遇阈值收据误当作梅尔英雄施法历史。 |
| `tests/opening-encounters-pr5.test.ts:171,189`（6 项） | 测试路线漂移 | `sharedBeforeMonkey` 是领域公共命令夹具，没有 Room，也没有独立服务器 checkpoint；直接取首个强化会引入 `augmentHistory`。不可从待恢复状态铸造 authority 自证；改无历史选择路线。 |
| `tests/m8-u5-preview.test.ts:353,405,420`（8 项）；`tests/m8-u5-preview-mocked-snapshot.test.ts:215`（1 项） | **src 真 bug** | 堆栈均指向 `src/simulation/augment-pool-batch5-h11.ts:47`。`combat-effects.ts:71` 的 `mechanismUnits` 只包含 S13 技能棋子，`readAugmentCombatEquipment(before)` 却包含合法的旧技能棋子；映射查找返回 undefined 后非空断言未在运行时保护 `mechanics`。测试的 ranger / 旧技能注入是已有合法边界，不是缺字段。最小修复 holder 查找与 recipient 查找的缺失运行时处理；保持 donors、排序、随机与数值逻辑。 |

### 实际路线核对（修复测试前）

- `publicInventory(['thiefs-gloves','thiefs-gloves'])` 默认旧搜索到 seed 253、3-1，选中 `spoils-of-war-ii`，`needsCrownHistory=true`。影响 instances 三项与 grant-upgrade 一项；`['thiefs-gloves','sword']` 是 seed 4 / `rocket-collection`，不需要 battles。原测试不是强化历史专项，改用 0..100 内的真实获取路线，所有装备和恢复断言保持。
- PR6 现有 Mel seed 21 在 3-3 触发阈值前选中 `pilfer`、`anger-issues`；前者要求 battles，后者另有强化历史证明。原排除表遗漏了这两种历史依赖；改用无历史强化选择，保留 Mel 开局、公共输局路线、阈值收据与恢复断言。
- PR5 seat seed 固定 900..907，组件奇遇路线的 seat-1 自然选中 `head-start`，`augmentHistory` 为 server proof。该测试验证八席共享奇遇与原子淘汰，未运行 Room；它不是漏传 `room.augmentHistoryAuthority`，而是直接取首个强化导致路线漂移。改用公开 offered 的无历史强化，不制造 authority。
- 本克隆没有任务提到的 `tests/fixtures/history-free-augments.ts`。采取更小改动：PR5 直接利用已有历史 owner 注册过滤实际 offered；PR6 在已有排除表补上 `pilfer`、`anger-issues`。不改公共 Match helper，不脚本化抽牌，不改恢复校验。
- 双 TG 的独立掉落 oracle 在 0..100 中找到多条自然路线；实跑 seed 2 选 `shop-glitch`（仍有 server/solo 强化历史），seed 11 选 `conqueror-crest`，故采用 seed 11，并保持实际种子严格为 11。未改原默认搜索，也不将 seed 253 作为新路线。
- 首轮修改后 PR5 只剩 gold 分支：堆栈进一步指向 `augment-pool-batch5-r4-restore.ts:25`。`mad-chemist` 不在 history owner 注册中，但其在线毒云/对手状态仍要求独立 authority。先记录此原因，再在该领域夹具的 offered 过滤补上这一项；不改服务器凭证校验。

## 最终改动位置

| 文件:行 | 修改 |
| --- | --- |
| `tests/m8-b5-instances.test.ts:23,95` | 双手套 warm-up 与合法控制统一使用 seed 11，普通剑分支保持原路线。 |
| `tests/m8-b5-grant-upgrade.test.ts:134` | 双手套递归升星控制使用相同 seed 11；购买、返还、恢复与失败原子性断言原样保留。 |
| `tests/opening-encounters-pr5.test.ts:146` | 只从真实 offered 中选非历史 owner、非 Mad Chemist 的强化，无可用项就明确报错，不回退历史卡。 |
| `tests/opening-encounters-pr6.test.ts:250` | 现有排除表补上 Pilfer / Anger Issues；原种子、输局路线及重复收据校验保持。 |
| `src/simulation/augment-pool-batch5-h11.ts:48,53` | holder/recipient 映射允许缺少 S13 runtime；旧技能棋子不触发空值解引用。所有真实 S13 棋子的原排序、donor 与数值计算保持。 |
| `tests/augment-pool-batch5-h11-sponging.test.ts:60` | 新增两项正/反输入顺序回归：真实 Combat 开场中混入合法 ranger-shot，验证五个 S13 接收者、五次 RNG、下一步不重发，兼顾 holder 与 recipient 两处边界。 |

唯一修改的 src 文件为 `src/simulation/augment-pool-batch5-h11.ts`。未改游戏规则/数值、恢复门槛、任何既有断言/超时/预算、服务器、录制夹具、`docs/evidence/` 或素材；未使用纪元写入或 Git 写操作。临时诊断测试已移除。

## 验证

所有 Vitest 调用均带 `--configLoader runner`，worker 上限不超过 3。

| 最终验证文件 | 结果 |
| --- | --- |
| `tests/m8-b5-instances.test.ts` | 18/18 通过 |
| `tests/m8-b5-grant-upgrade.test.ts` | 14/14 通过 |
| `tests/opening-encounters-pr6.test.ts` | 42/42 通过 |
| `tests/opening-encounters-pr5.test.ts` | 最终重跑 31/31 通过 |
| `tests/m8-u5-preview.test.ts` | 60/60 通过 |
| `tests/m8-u5-preview-mocked-snapshot.test.ts` | 8/8 通过 |
| `tests/augment-pool-batch5-h11.test.ts` | 23/23 通过 |
| `tests/augment-pool-batch5-h11-sponging.test.ts` | 最终重跑 12/12 通过（含新增两项） |
| `npm run typecheck`（`tsc --noEmit`） | 通过，exit 0 |

指定六文件最终合计 173 项通过；补充 H11 共 35 项通过。六文件首次修复联合运行 172 通过、仅 PR5 gold 剩一项；补齐 Mad Chemist 选择过滤后，重跑完整 PR5 文件 31 项全部通过。没有重复执行其余已通过文件。

【未完成】请求范围内无遗留；未跑全量测试，按任务范围验证。`git diff --check` 通过。
【需要用户决定】无。改动留工作区，由执行端审查提交。
