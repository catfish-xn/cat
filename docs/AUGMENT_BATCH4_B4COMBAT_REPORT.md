【完成】仅实现天涯若比邻、五级飓风、过量治疗、满意的织法者；原始 14.24 values 含 null 完整保留（src/simulation/content/augment-pool-batch4-b4combat.ts:6）。
【完成】22% 开战双向属性快照、普通/光明飓风额外箭及 85% 系数、第三击额外 115% AD/50% 回复、施法后 20% 吸血与转盾（src/simulation/augment-pool-batch4-b4combat.ts:14、:34、:45、:56、:68）。
【完成】强化池、apiName、gold 等级、阶段禁令和统一初始飓风礼物接入；不新增存档字段，不修改其他机制组（src/simulation/content/augment-pool-batch4-b4combat.ts:82、src/simulation/augment-pool-grants.ts:20）。
【完成】沿 Batch3 精确重放认证；四条均测真实选择/战斗、往返恢复及对象、JSON、序列化入口的系数、计数、输入篡改拒绝（src/simulation/g2-4b-gold-restore.ts:12；tests/augment-pool-batch4-b4combat.test.ts:24、:38）。
【完成】新增最终 18 项通过：数值、距离并列/单人、双飓风实例、重伤、300 盾上限、60 tick、重复施法、零治疗/死亡；其余定向回归 151 项通过，共 169 个不同用例（artifacts/b4-verified.log、artifacts/b4-boundaries.log）。
【完成】验证包含 tests/augment-pool-batch3*.test.ts、tests/augment-offer-rules*.test.ts、m8-b4-bow、m8-b3-second-integration、m8-b3-third-audit、scripts/tests/production-size；没有 augment-stage-bans*.test.ts，节点覆盖在新测试；未跑全套。
【完成】npx tsc --noEmit -p . 退出 0；git diff --check 通过；仅依任务显式授权运行 update-content-identities --write，随后 --check 通过，并同步生产体积测试摘要（scripts/tests/production-size.test.ts:108）。
【完成】当前 contentDigest=a150194f、lootReplayDigest=b3cb32a8；P-B4COMBAT（2026-10-25）及内部接口合同已记录（src/simulation/content/identity-constants.ts:3；docs/S13_RULES_GAP.md:1015；docs/COMBAT_CONTRACT.md:306）。
【未完成】本任务服务端范围无；界面文字适配归 Claude，已登记展示字段与验收条件（docs/UI_REQUESTS.md:1255）。
【需要我决定】无；距离并列、来源范围、光明飓风、盾期限和并持行为均按最佳建议落实为 P。
【风险】盾期限、并持转盾、溢出范围等 P 不是已核实的原服语义；其他 Batch4 分组合入会再次改变摘要和固定种子候选，集成后须统一重算身份及检查种子。
【下一步】交叉审查后并入 v23 集成工作区；只更新本组及最小共享注册，未提交 Git，未修改服务器、界面、版本、证据或 epoch fixtures。
