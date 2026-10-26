【完成】已修复 codex/v24-shopport2（HEAD 6a690e03）的强化池/公开路线种子漂移；未提交，未修改生产规则、服务器或界面；未删除断言、未提高超时。
【完成】原 7 项：Corrosion 改用 seed 79，并断言 3-2 真实 offer/贡献检查点；两项异常历史改用 seed 3 的 Wealthy Rehab II 重演路线，保留原伪造及精确 Mirror 错误；恢复审计整批 339/339 通过。
【完成】按原公开命令路线重搜 STAGE_SEEDS/PUBLIC_SEEDS；补齐轮次、offer 与特殊条件断言。特殊种子：Call to Chaos XP 512、黑玫瑰之冕 53、Crown→Trifecta→Kog'Maw 130、Trifecta Nami 726、投资策略 7985、完整中立怪路线 7301、同 tick 双载体 3711。
【完成】修复 TG、双饮血、跨回合装备、满备战席和部分击杀夹具；保留固定 LCG、装备/资源数值、精确拒绝与继续执行断言。TG 35 条真实路线仍覆盖全部 43 种子装备；同 tick 场景仍为 118/138 检查点。
【完成】指定范围分批全部执行（含 production-size 共 127 文件，未跑全套）；按每文件最新完整结果合并：2681 项通过、31 项失败，另 1 文件收集失败；详情 /tmp/shopport2-validation-summary.json，批次日志 /tmp/shopport2-*.log。
【完成】执行 node scripts/update-content-identities.cjs --write：content=fnv1a32-utf16:404c0c0f，loot=fnv1a32-utf16:c0f1f080；HEAD 的常量及 scripts/tests/production-size.test.ts 已是这些值，无需额外改写；production-size 6/6、TypeScript 检查及 git diff --check 通过。
【未完成】旧 v23 epoch 阻塞 20 项：tests/augment-pool-batch3-progress.test.ts（2）、tests/m8-b7-match-wiring.test.ts 的 raw Herald（5）、tests/m5-route.test.ts（4）、tests/m6-integration*.test.ts（9，含前置失败造成的连带失败）；保留原录制文件供 Claude 重录。
【未完成】另有旧 v23 transfer-route 锚点：tests/m8-b10-temporary-replay.test.ts（1）和 tests/m8-b8-live-transfer.test.ts（收集失败）；已明确校验 epoch。它们的单位 ID 也随路线改变，不能称为仅 digest 差异，需一并重录锚点。
【未完成】tests/augment-stage-bans-audit.test.ts 的 10 项因沙盒 spawnSync: EPERM 无法执行子进程；未跳过或弱化。直接执行独立 CLI 已核对仍为预期的 5 项既有阶段表差异，证据 /tmp/shopport2-stage-audit.json。
【需要我决定】无新增玩法或版本决定；未提供具体 -o 路径，本报告沿用 docs/review-q-fix-report.md。
【风险】指定范围尚未全绿，旧 epoch 前置检查之后的断言仍须重录后验证；pre-Spoils 已独立确认仅 3 处 digest 不同，证据 /tmp/shopport2-prespoils-diff.json。
【风险】一次 Ctrl-C 未结束扫描子进程，曾与重启扫描重叠；发现后等旧进程结束，后续扫描串行完成，现无遗留扫描；Vitest 均使用 --maxWorkers=4。
【下一步】请 Claude 重录上述 v23 golden、raw Herald、pre-Spoils 与 transfer-route 锚点，在允许正常子进程的测试环境复跑剩余清单，再交叉验货。
