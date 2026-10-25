【完成】仅实现耐心是一种美德、投资+、投资++；14.24 原值（含 null）、等级和 2-1／3-2／4-2 节点注册：src/simulation/content/augment-pool-batch4-b4reroll.ts:5。
【完成】从成功商店购买和结算银行重推每轮额度，投资立即发 26／45 金、50–80 金每满 10 金一次；无新增存档字段：src/simulation/augment-pool-batch4-b4reroll-progress.ts:7、src/simulation/free-rerolls.ts:15。
【完成】复用免费刷新扣费与恢复认证，拒绝提前借用未来轮额度：src/simulation/free-rerolls.ts:34；JSON／对象／序列化入口篡改测试：tests/augment-pool-batch4-b4reroll.test.ts:32。
【完成】真实命令覆盖购买后出售、失败购买、联机 PvP 锁定名单后购买、免费额度耗尽后付费及投资取得金币只发一次：tests/augment-pool-batch4-b4reroll.test.ts:37、tests/augment-pool-batch4-b4reroll.test.ts:86。
【完成】P-B4R（2026-10-25）明确选择后下一轮开始、入轮金币取样顺序、全轮型计数和额度保留；导出签名／失败边界已写合同：docs/S13_RULES_GAP.md:1015、docs/MATCH_CONTRACT.md:1267。
【完成】按指定生成器更新身份并同步生产压缩语义断言；content=57a1923e、loot=c5278c33：src/simulation/content/identity-constants.ts:3、scripts/tests/production-size.test.ts:108。
【完成】扩池只重找金蛋和天降混沌的固定种子，保留原断言：tests/augment-pool-batch3.test.ts:657、tests/augment-stage-helpers.ts:43。
【完成】定向测试 7 文件、164 项全部通过（新增 41 项），覆盖 batch3*、offer-rules*、身份及生产压缩语义；命令与结果见 artifacts/b4reroll-final-tests.log:3、artifacts/b4reroll-final-tests.log:9；未运行全套，无 stage-bans*.test.ts 文件。
【完成】最终 `npx tsc --noEmit -p .`、`node scripts/update-content-identities.cjs --check`、`git diff --check` 均退出 0；身份核对结果见 artifacts/b4reroll-final-identity.log:1。
【未完成】本组范围无未完成项；未提交 Git，未改界面、服务器、证据、epoch fixtures、版本号或其他机制组。
【需要我决定】无；开放行为已按委托采用 P-B4R 推荐约定。
【风险】其他并行组合并后候选池、固定种子和内容身份可能再次变化；epoch 重录仍由独立工作处理。
【下一步】集成者合并本组后统一重算内容身份，并复跑同一组定向测试。
