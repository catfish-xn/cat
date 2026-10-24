【完成】已修复，未提交；中文交付报告为本文件（请求未提供具体 -o 路径，采用 docs/BLISTERING_RESTORE_REPORT.md）。
【完成】根因：src/simulation/combat-g2.ts:35 的 ignite 用 :32 的同一 ability source 顺序执行 burn/wound；历史执行器写出了与通用跨组 key 唯一性不一致的贡献，src/simulation/m8/status.ts:102 因重复 key 拒绝 wound；Blistering Strikes 自身两个 effectIndex 不冲突。
【完成】xp 206dbbda 真实命令复现：seed 790，tick 176；被拒 wound 为 3300 Bps、appliedAtTick=176、expiresAtTick=276，key=["round-4","unit-2","ability","powder-ability","unit-2",0,null,"enemy-r4-1","source"]，与 Powder 的 100 Bps burn 共用 key。
【完成】修复 src/simulation/g2-4b-gold-restore.ts:60：仅由可信开战 strategy 中 Powder/Rumble 启用现有完整战斗重放；:82 要求候选整个 CombatState 与独立重建结果 canonical 完全一致，复用输入绑定缓存。
【完成】校验不放宽：通用 validateStatusGroups 原样保留，仍拒绝重复 key；候选伪造技能不能开启认证路径；状态、来源、时点、系数、投影、任务、账本必须全部与真实轨迹相等。不改规则、数值、存档格式、合法状态或回放输出，也未改版本与 digest。
【完成】新增 tests/blistering-restore.test.ts：当前池 seed 234 公开选强化并购买 Powder；16/648 保留原 seed，按实际 offer 选择并购买 Powder（648 付费买三张合星、前排布阵），注释解释池变化；三例均断言实际出现共享 key，恢复后至结算逐 tick 比较状态/RNG/事件/收据；另覆盖 Rumble。
【完成】22 类协调/单字段篡改在对象及 JSON 两种 restore 入口均拒绝，包含贡献、重复/缺失、时钟、显示锚点、周期任务、候选技能；Rumble 篡改与可信 strategy 门控另有验证。
【完成】当前分支：要求的 G2、新回归、m8 状态及所有直接导入 m8/status 的测试、restore-audit 全目录、m6-persistence 等共 31 文件/447 项通过；补充 knockup-status 与最终新回归 2 文件/12 项通过（其中新回归重复验证）；npx tsc --noEmit -p . 及 git diff --check 通过。
【完成】xp 临时树应用同一源码补丁：新回归（强化种子换为该池 790，保留 16/648）与未修改的原 G2 测试共 2 文件/21 项通过；撤去补丁时 16/648 两例均因相同重复 key 失败，已重新应用补丁。未改远端引用或 .git。
【完成】约定 P-IGNITE-RESTORE（P，2026-10-25）已记录到 docs/S13_RULES_GAP.md；最终仅改恢复模块、该文档、新测试和本报告，未碰禁止文件。
【未完成】无；按要求未跑全量测试、未提交。定位期间临时的“每 tick 都序列化”诊断用例曾触发原 5 秒超时，已去掉临时诊断；正式验收未新增或放宽 timeout。
【需要我决定】无，已按授权选择保持历史输出、用精确重放认证的方案。
【风险】包含 Powder/Rumble 的存档首次恢复增加重放到检查点的成本；战斗 tick 上限及现有有界缓存限制该成本。历史共享 key 仍保留，不能改为无条件接受重复贡献。
【下一步】交给 Claude 交叉审查测试、目录权限和玩法不变性，再按项目流程由维护者提交。
