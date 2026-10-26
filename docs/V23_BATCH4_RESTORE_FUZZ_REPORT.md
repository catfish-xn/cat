【完成】2026-10-25 Codex 在 codex/v23-funitid、HEAD 3bffa561 修复日程强化收据 unitId 准入；实际选取命令写 null（src/simulation/match.ts:900），恢复结构及来源收据边界现均要求严格为 null：src/simulation/serialization-structure.ts:226、src/simulation/resource-provenance.ts:234。
【完成】实际奖励单位继续由独立机制／法球收据认证；有序出生要求连续 unit-N，并按来源收据键绑定 ID、种类和回合，不以当前阵容替代历史证明：src/simulation/resource-provenance.ts:397、:450、:469。
【完成】原 48 条 batch-4 矩阵和 3 条最小 fuzz 预期失败全部改普通 it，恢复逐叶 unitId 修改覆盖，保持全部拒绝断言：tests/v23-tamper-batch4.test.ts:192、:209；tests/v23-restore-fuzz.test.ts:225。
【完成】新增 21 条回归：真实公开 Caretaker Ally 奖励、JSON／object／serialized 的已有奖励 ID／下一序号／其他单位 ID／出生 ID／来源替换拒绝、独立来源边界拒绝及售出后合法恢复：tests/v23-restore-fuzz.test.ts:235、:249、:256、:263。
【完成】按用户授权登记 P-V23-AUGMENT-RECEIPT-UNIT（P，2026-10-25），明确日程单位字段与真实奖励出生的不同职责；同步公开恢复契约、签名和失败原因：docs/S13_RULES_GAP.md:3；docs/MATCH_CONTRACT.md:1404。
【完成】最终指定测试命令：export PATH=$HOME/.local/bin:$PATH; npm test -- --configLoader runner --maxWorkers=4 tests/v23-tamper-batch4.test.ts tests/v23-restore-fuzz.test.ts tests/augment-pool-batch4*.test.ts tests/restore-audit/*.test.ts tests/m6-persistence.test.ts；12 文件通过、1 文件失败；5158 通过、2 条下述基线失败，耗时 159.43 s，退出码 1；日志 /tmp/v23-funitid-final-vitest.log。
【完成】恢复 fuzz 单文件复验 53/53 通过（13.00 s）；首次新增夹具误用奖励 source 标签已修为实际奖励 receiptId 定位，未放宽任何断言；最终整组结果以上述命令为准。
【完成】HEAD 原实现单独复核命令：npm test -- --configLoader runner --maxWorkers=4 tests/restore-audit/cd-replay-facts.test.ts -t 'G-C08 binds real'；2 失败、32 跳过，35.22 s，与修复版本相同，确认为基线问题；两份生产源文件已恢复为修复版。
【完成】npx tsc --noEmit -p . 与 git diff --check 均通过；未运行全量测试或 fuzz driver，既有同名 JSON 的 3764 检查点／11292 恢复尝试／338790 续跑比较属于前次结果，本次不冒充重跑。
【未完成】指定验收尚有两条基线错误文本失败：tests/restore-audit/cd-replay-facts.test.ts:231、:242 期待 Invalid Match save: G23 state/maximum health binding facts，实际更早抛 Invalid authoritative Mirror forge replay；篡改仍被拒绝，未修改该断言或扩大为无关错误优先级修复。
【需要我决定】无；按授权采用上述 P，未提交 Git，未改玩法、数值、保存格式、身份版本、受保护文件、界面、服务器或独立经济 oracle，没有新增测试／文件／钩子超时，所有 Vitest 命令均 --maxWorkers=4 且顺序执行。
【风险】整体指定验收仍为非零退出；本次未发现或忽略 content-digest／golden contentDigest 错配，不将两条错误文本基线失败归为纪元差异；完整日志在 /tmp/v23-funitid-final-vitest.log 与 /tmp/v23-funitid-cd-baseline.log。
【下一步】交叉评审此恢复修复，再单独处理 cd-replay-facts 基线的错误优先级契约；不需要重录保存格式或奖励数值。
