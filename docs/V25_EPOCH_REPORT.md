【状态】未完成：v25 纪元证据尚未完整录制；此文件仅记录当前工作区的诊断，不是发布验收报告。
【基线】历史保全采用 100589ca41d78a4671c8675ec30057a9ea5ea684；首次运行的 check-history 通过，v24 及更早证据与基线逐字节一致，受保护 manifest 未变。
【身份】内容身份检查通过；独立摘要对比已生成：v24/v25 content digest 分别为 fnv1a32-utf16:1b86447c / fnv1a32-utf16:229d9f7e，loot digest 分别为 fnv1a32-utf16:18c876b2 / fnv1a32-utf16:55f72339。
【局部证据】宝箱仍使用种子 585；房间开场仍使用 20261013，三个检查点的同步和分片 tick 0/1 字节一致；服务器开场测试 12/12 通过。同步掉落种子 3711→2634（tick 110，事件 870/871；原九条掉落和后续无掉落死亡条件保持）；Loris/Zyra 部分掉落 2004→29（tick 460/211，奖励数分别 2/1）。
【诊断】首次并行 --write 中止：掉落路线的独立海克斯互斥表缺少第五批条目；转移路线的种子 4 不再满足两名崔丝塔娜均由商店购入的条件。重新运行 --write 为 incomplete：11 步中 9 步 exitCode 0、Herald 在公开路线继续时报 unsettled-round（tests/fixtures/v25-online-rules-herald-support/generate.ts），release 因运行期间该夹具变更触发源码哈希检查而退出 1；其他 4 步未启动。公开腾位及阵容轮换已让五个场景抵达 6-7，正式录制仍待验证。已从保留的 14.24b 原始记录核对并增补独立互斥表，2,736 个单持有者候选池比较无差异；转移路线种子 4 经公开重抽后保留两个商店收据及 3-7 平底锅。部分掉落种子已选定，相关消费者仍待验收。
【局部验证】m8-b5-temporary 的种子 42 使用同样未装备的法师纹章；其余公开路线避开需要缺失历史的选择，必要时保留赠装于背包；30/30 通过，35 条路线和 43 件装备断言未删。
【验证】TypeScript、production-size、v25 报告行为测试 18/18 通过；六个版本消费者文件中五文件通过，m8-content-equivalence.test.ts:41 五个状态在并发下触发原有 20 秒超时；:55 非有限数错误分类已修正，单项回归通过，历史认证 77 项通过；完整文件待低并发复测。M6 四文件中两文件通过；单 worker、与 Herald 并行时，mage 和 cannon 的完整路线（tests/m6-integration-helper.ts:24）均触发原 360 秒超时，cannon 全量存档（同文件:126）触发 120 秒超时，mage 后续存档（同文件:128）因前置结果缺失失败；需录制结束后独占复测。t12-offline-transfer 在并发录制期间触发原有 60 秒超时，原资源投影断言已保留并增加 v25 历史验证断言。
【进行中】修复预检后重新执行 `--write --jobs=6`；完整对局、开场、转移、掉落、宝箱、历史和摘要步骤已通过，Herald 已导出五场景并完成第一个恢复校验，整套尚未结束。
【未完成】完整 --write、无 --write 的 check、录制后的 consumer-byte-audit 刷新、全部指定测试及最终完整报告；当前局部产物不可作为完成的录制证据提交。

## 当前文件清单

- `scripts/verify-m8-herald-fixtures.cjs`
- `src/simulation/augment-history-restore.ts`
- `tests/b8-resumable-battle-helper.ts`
- `tests/c19-missed-pulse.test.ts`
- `tests/chest-bracer-integration-trial.test.ts`
- `tests/d11-wiring-bank.test.ts`
- `tests/d14-anomalies-source.test.ts`
- `tests/epic-loot-reforger.test.ts`
- `tests/fixtures/b8-live-reveal-routes.ts`
- `tests/fixtures/m5/assert-golden.cjs`
- `tests/fixtures/m5/oracle.g2.cjs`
- `tests/fixtures/m8-golden-states.cjs`
- `tests/fixtures/m8-neutral-public-route.ts`
- `tests/fixtures/t13-loot-public.ts`
- `tests/fixtures/t13-public-gloves.ts`
- `tests/live-combat-inputs.test.ts`
- `tests/m6-persistence.test.ts`
- `tests/m8-b10-temporary-replay.test.ts`
- `tests/m8-b5-temporary.test.ts`
- `tests/m8-b8-live-reveal.test.ts`
- `tests/m8-b8-live-transfer.test.ts`
- `tests/m8-content-equivalence.test.ts`
- `tests/match-contract.test.ts`
- `tests/opening-random-identity.test.ts`
- `tests/server/battle-start-slices.test.ts`
- `tests/server/fixtures/battle-start.json`
- `tests/t12-offline-transfer.test.ts`
- `tests/ur-i3-combat-statuses.test.ts`
- `tests/v19-part2.test.ts`
- `docs/V25_EPOCH_REPORT.md`
- `docs/evidence/v25-online-rules/battle-start-audit.json`
- `docs/evidence/v25-online-rules/chest-trial-audit.json`
- `docs/evidence/v25-online-rules/chest-trial-search.json`
- `docs/evidence/v25-online-rules/consumer-byte-audit.json`
- `docs/evidence/v25-online-rules/digest-comparison.json`
- `docs/evidence/v25-online-rules/history-preservation.json`
- `docs/evidence/v25-online-rules/live-reveal-audit.json`
- `docs/evidence/v25-online-rules/release-audit.json`
- `scripts/audit-v25-online-rules-adaptations.cjs`
- `scripts/compare-v25-online-rules-digests.cjs`
- `scripts/record-chest-trial-v25.cjs`
- `scripts/record-v25-online-rules-battle-start.cjs`
- `scripts/record-v25-online-rules-inputs.cjs`
- `scripts/record-v25-online-rules-live-reveal.cjs`
- `scripts/record-v25-online-rules-release.cjs`
- `scripts/record-v25-online-rules-transfer.cjs`
- `scripts/tests/v25-epoch-report.test.ts`
- `scripts/v25-epoch-report.cjs`
- `scripts/v25-online-rules-fixture-audit.cjs`
- `scripts/verify-v25-epoch-parallel.cjs`
- `scripts/verify-v25-online-rules-epoch.cjs`
- `tests/augment-pool-batch5-offer-oracle-data.cjs`
- `tests/fixtures/m5/full-match-golden.v25-online-rules.json`
- `tests/fixtures/record-v25-online-rules-herald.cjs`
- `tests/fixtures/v25-online-rules-b8-fingerprints.json`
- `tests/fixtures/v25-online-rules-c19-seed-9-minimal.json`
- `tests/fixtures/v25-online-rules-chest-trial.json`
- `tests/fixtures/v25-online-rules-chest-trial.ts`
- `tests/fixtures/v25-online-rules-herald-support/generate.ts`
- `tests/fixtures/v25-online-rules-recorded-states/cannon.json.gz`
- `tests/fixtures/v25-online-rules-recorded-states/sniper.json.gz`
- `tests/fixtures/v25-online-rules-transfer-route.json`
- `tests/v25-online-rules-content-baseline.json`
