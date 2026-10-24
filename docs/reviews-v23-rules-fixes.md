【完成】V23-R3：仅允许赛恩冲锋 stun 使用 ability effectIndex=1，并由独立重放认证真实贡献；三入口接受合法冲锋，恢复后12 tick（覆盖击飞到期）逐步结果一致。
【完成】V23-R1：复活字段校验精确结构、整数/布尔、赛恩身份、黑玫档位和20 tick时钟边界；字段存在性和完整内容纳入重放事实，不能伪造死亡或复活历史。
【完成】V23-R2：全部 stun 分组和贡献与独立重放比较，普通眩晕也参与；添加或删除 knockup 均拒绝。
【完成】18项 it.fails 全部转为普通 it，原断言保留；影响证明用例增加恢复拒绝断言，保留未校验伪造对象的可用性影响验证；另增19项边界/继续回归。
【完成】V23-D1/D2：MATCH_CONTRACT 同步 fmix32 的运算、selectionRng 和 batch-a-v2；COMBAT_CONTRACT 补三种位移原因、knockup 和赛恩复活恢复语义；工程约定记为 S13_RULES_GAP 的 P（2026-10-25）。
【完成】生产改动仅在存档校验与恢复重放事实抽取；未改战斗推进、规则数值、存档字段/版本或合法回放输出，合法状态只读认证、不修补候选数据；未触碰受禁文件，未提交。
【完成】定向验证共47个文件、559项唯一用例：555通过，4项基线既有失败，无新增失败；含全部 v23-review、m6-persistence、restore-audit 及相关 restore/forge/sion/knock/revive 文件；最终恢复40项及审计77项全部通过，未运行全量套件、未加超时。
【完成】npx tsc --noEmit -p . 与 git diff --check 通过；机器结果在 /tmp/v23-fix-tests.json、/tmp/v23-fix-audit-tests.json；选中文件清单在 /tmp/v23-fix-test-files.txt（另加 restore-audit/*.test.ts）。
【未完成】4项基线既有失败未改（避免改数值或受禁 fixture）：在 /tmp/v23-fix-base 从未修改 HEAD=846363d7 导出后重跑两文件，38项中34通过、相同4项失败；结果 /tmp/v23-base-failures.json。
【未完成】epic-loot-reforger 的真实5-7恢复与6-7终局恢复两项均报 content-digest；相关旧存档 fixture 保持原样。
【未完成】v23-review-controls 的蔚同排期望到期7、实际12；安蓓萨短晕期望 [2,7,undefined]、实际 [2,22,undefined]；按本任务“不改规则数值”保留，未弱化断言。
【需要我决定】无；已按授权采纳建议。未提供 -o 路径，默认报告落本文件。
【风险】基线 src/server/net/test-client.ts 与 src/server/room/real-clock.ts 已含 setTimeout / performance.now（含注释），HEAD 只读检索已确认；本次未改服务器，不能宣称其满足零计时 API 的绝对条件。
【下一步】由 Claude 交叉验货；将旧 fixture 身份与控制时长的4项基线失败另立任务，本次修复可直接按 diff 审核。
