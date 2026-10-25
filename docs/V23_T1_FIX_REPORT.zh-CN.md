【完成】修复 V23-T1：两项历史计数强制使用现有完整 battles 独立重演；同时删除事实也不能绕过准入（src/simulation/crown-history.ts:5；src/simulation/serialization.ts:15；复用 src/simulation/battle-record-validation.ts:190）。
【完成】六条 it.fails 全部改为普通 it；三入口携带真实历史验证 count +1 必须拒绝，合法续战继续逐 tick 比较完整状态、事件与 RNG（tests/v23-tamper-mechanics.test.ts:129、395）。
【完成】新增缺历史、缺战、JSON 重建历史、同时删除两事实的覆盖；真实命令录制开战上下文与完整事件，不依赖候选计数自证（tests/v23-tamper-mechanics.test.ts:109；tests/fixtures/recorded-empty-route.ts:8）。
【完成】npm test -- --configLoader runner tests/v23-tamper-mechanics.test.ts：1207/1207 通过，退出 0（/tmp/v23-fwcb-tamper-final.log）；原伙伴与历史缓存回归 tests/augment-pool-blood-brothers.test.ts、tests/crown-restore-cache.test.ts：10/10 通过，退出 0（/tmp/v23-fwcb-history.log）。
【完成】npm test -- --configLoader runner tests/restore-audit/*.test.ts tests/m6-persistence.test.ts：126 通过、231 失败、15 跳过，3 文件通过、3 文件失败，退出 1；m6-persistence、combat-accumulators、g23-reward-allocation 通过（/tmp/v23-fwcb-audit.log）。
【完成】以隔离副本恢复 HEAD 的两个生产文件后复核同组测试：结果与全部失败用例列表完全一致；失败源为独立 oracle 的强化候选列表与当前池不一致、Kog’Maw 拒绝错误文本不一致，不能仅按 digest 不匹配忽略（/tmp/v23-fwcb-baseline-audit-actual.log）。
【完成】npx tsc --noEmit -p .：退出 0，无诊断（/tmp/v23-fwcb-tsc-delivery.log）；git diff --check 通过；未运行全套、未新增超时或放宽断言、未提交，HEAD 仍为 808d16ae06c0a028e1962cd4466150c9b2b9ad8a。
【完成】登记 P-V23-T1-HISTORY（P，2026-10-25），同步 API 输入、返回与失败约定；规则、数值、存档格式、版本和内容身份不变（docs/S13_RULES_GAP.md:3；docs/MATCH_CONTRACT.md:1）。
【未完成】restore-audit 的既有失败未修，属于本次缺陷之外的 oracle／测试期望问题；冻结证据、独立 oracle、前端、服务端均未修改。
【需要我决定】无；采用既有 battles 历史通道，无需存档格式变更。
【风险】包含伙伴历史事实的裸 Match 现须附完整 battles，否则严格拒绝；现有 SaveEnvelope 已保留该字段，无需迁移（src/m6/contracts.ts:38；src/simulation/serialization.ts:12）。
【下一步】交叉验货本修复；另单处理上述已由基线复现的审计失败，再完成 v23 发布验收。
