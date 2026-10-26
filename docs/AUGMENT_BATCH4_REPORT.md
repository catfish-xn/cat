【完成】盘点基线104条未注册记录，分19个机制组并标明数据完整性、禁用原因和HR排除；证据：docs/AUGMENT_BATCH4_PLAN.md:7、docs/AUGMENT_BATCH4_PLAN.md:13。
【完成】实现完整且最大的等级奖励组5条：游神的盟友、后期专家、游神的眷顾、生日礼物、游神的神选；全部开放，注册池208→213；证据：src/simulation/content/augment-pool-batch4.ts:13、src/simulation/content/augment-pool-batch4.ts:85。
【完成】沿Batch3接入确定性奖励、唯一收据、满席待发、联机法球、战斗锁定、光明严格五选一及恢复/篡改校验；证据：src/simulation/augment-pool-batch4-progress.ts:18、src/simulation/augment-pool-batch4-progress.ts:51、src/simulation/shared-pool.ts:41、src/simulation/anvils.ts:55。
【完成】约定均记为P（2026-10-25），公共签名及失败边界已补合同；证据：docs/S13_RULES_GAP.md:1015、docs/MATCH_CONTRACT.md:1267。
【完成】新18项测试覆盖每条的offer/effect/save/restore/tamper及联机边界；旧Call to Chaos公开种子改74，并加强为明确命中XP分支；证据：tests/augment-pool-batch4.test.ts:71、tests/augment-pool-batch4.test.ts:141、tests/augment-stage-helpers.ts:44、tests/augment-pool-batch3.test.ts:876。
【完成】仅跑11个指定/直接相关文件，共191项：合跑186通过、5项默认超时；类型检查结束后，两受影响文件串行复测92/92通过（含原5项）。日志：/tmp/b4-final-tests.log:1、/tmp/b4-recheck-tests.log:10；未新增timeout或放宽断言，未跑全套。
【完成】npx tsc --noEmit -p .退出0，git diff --check通过；未改界面、src/server、存档字段/版本、受保护身份、历史证据或oracle；未提交，HEAD仍为87a013f1。
【未完成】本轮范围无遗留；其余97条常规待办留后批，2条HR不纳入常规池；证据：docs/AUGMENT_BATCH4_PLAN.md:252。
【需要我决定】无；随机分布、取得时阈值追补、10级生日礼物按公式发6费、容量/锁定时序已按推荐记P。
【风险】源未给抽样权重与精确支付顺序，P不代表原服已认证；候选digest改变，v23纪元录制仍由独立任务处理；本轮未验收界面显示。
【下一步】Claude交叉验货并接入五条中文显示文案；后续优先推进数据完整的4条备战席条件XP组（docs/AUGMENT_BATCH4_PLAN.md:25）。
