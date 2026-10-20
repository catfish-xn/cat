# PR #191 第一份拆分：集成合并交接

日期：2026-10-19。分支 `codex/s13-augments-p1`，HEAD `994296f4`；合并目标 `origin/integration/s13-augments`（`461c887`）。

## 当前结果

六个冲突文件已编辑完成，src/tests 扫描未发现冲突标记，`git diff --check` 通过。没有执行 Git 写操作，索引仍显示六个 UU，需调度方 add/提交。**指定测试尚未全部通过，不能宣称验收完成。**

|冲突文件|处理|
|---|---|
|src/presentation/g23-display.ts|采用集成分支等价的单次 import；没有其他显示逻辑改动。|
|src/simulation/content/anomalies.ts|保留 P4 注册展开，追加 P1 dual-wielding。|
|src/simulation/effects.ts|保留 s13Anomaly 及其字段，合入 incomePolicy/acquisitionBundle。|
|src/simulation/validate-content.ts|保留双方机制字段；强化 36、异常 42，注释逐条列新增 id。|
|tests/fixtures/m5/oracle.g2.cjs|合并双方候选池，保留 P1 收入、奖励、账本断言与 P4 异常 id；词典序排序。|
|tests/g2-3-anomalies.test.ts|结合 P4 的命名空间过滤与 P1 的 31 条历史异常范围；其余断言不变。|

另将 `s13-g23-manifest.ts` 的两个同名导出合为一个，保留 P4 十一条及双刀流显示名。`tests/m5-content.test.ts` 唯一更新的期望是池计数 `[25,44,36,42]`，附逐条 id 注释。

## 相对集成分支的 simulation 差异

执行并逐项检查 `git diff origin/integration/s13-augments -- src/simulation`，只涉及下列 P1 内容（路径均相对 src/simulation）：

|文件|性质|
|---|---|
|anomaly-acquisition.ts|双刀流发物品、确定性抽样、唯一收据及恢复验证。|
|augment-acquisition.ts|三个装备强化的授予、forge 及恢复验证。|
|augment-income.ts|三个收入强化的利息、经验、投资成长公共策略。|
|bound-unit-identity.ts|沿已验证消费/出售事实追踪目标身份；不代表其他异常已实现。|
|content/anomalies.ts|追加双刀流注册。|
|content/augment-policy.ts|追加六个强化的档位。|
|content/augments.ts|接入六个强化定义。|
|content/s13-p1-augments.ts|六个强化定义与原有数值。|
|content/s13-p1-dual-wielding.ts|角色映射与装备池。|
|effects.ts|增加 P1 机制与字段白名单。|
|validate-content.ts|增加 P1 字段及合并后计数。|
|economy.ts|结算读取 P1 利息策略。|
|economy-preview.ts|预览读取同一策略。|
|match.ts|P1 奖励/forge 接线、收入与轮初经验、失败返回原状态。|
|round-settlement.ts|联机结算应用 P1 收入与投资成长。|
|b8-restore.ts|调用双刀流授予校验。|
|g2-3-restore.ts|调用强化授予校验。|
|combat-input.ts|投资 I/II 的历史成长重建。|
|serialization-structure.ts|P1 奖励、轮初经验和投资成长恢复。|
|strategy-snapshot.ts|合并投资成长仅应用一次。|
|two-sided-snapshot.ts|承认投资 II 的成长来源。|

P4 战斗与 anomalies 实现文件相对集成分支无差异，螃蟹 Shred/Sunder 排除、逐格击退、alive && !isAttackProxy 占格、小我多多/洛里斯分担、星原之准 targetId 跟踪均未改写。`content/index.ts` 相对集成分支只多出 P1 双刀流池与角色两项 digest 输入（P1 原有）；未升版本、未手改 digest，实际内容增添后计算出的 digest 自然变化。

本次没有编辑 src/server/ 或 src/rendering/。分支相对集成分支已有 `src/rendering/strategy-panel.ts` 利息预览接线差异；该文件相对任务起始 HEAD 无差异，属继承内容，未擅自修改或撤销。

计数独立依据：TypeScript AST 数得 augments 原表 30 个直接条目，P1 表 6 个；异常既有 30 + P4 11 + 双刀流 1 = 42。运行的 m5-content 测试也验证实际注册结果。

## 验证

`npx.cmd tsc --noEmit`：退出 0。

最初默认 Vitest 配置打包因 esbuild 读取沙箱外祖先目录被拒而启动失败（0 个测试执行）。随后使用 CLI 支持的 `--configLoader runner --no-file-parallelism`，保留仓库配置及全部原测试时限、断言和用例；没有改配置文件。

实际命令：`npx.cmd vitest run --configLoader runner --no-file-parallelism`，后接下表全部 14 个文件；总耗时 **18.27s**，**13 文件通过、1 文件失败，220 条通过、1 条失败**。默认报告未逐文件输出通过条数/耗时，此处不推测。

|测试文件（相对 tests/）|结果|
|---|---|
|s13-p1-acquisition.test.ts|通过|
|s13-p1-bound-identity.test.ts|通过|
|s13-p1-dual-wielding.test.ts|1 通过、1 失败；文件 33ms，失败用例 26ms|
|s13-p1-income.test.ts|通过|
|s13-p1-multiplayer-income.test.ts|通过|
|s13-p1-avarice.test.ts|通过；只验证 avarice-incarnate 未注册生产异常池，不执行原型。|
|g2-augments-choice.test.ts|通过|
|g2-augments-multiplayer.test.ts|通过|
|g2-augments-static.test.ts|通过|
|g2-3-anomalies.test.ts|通过|
|m5-content.test.ts|通过|
|s13-anomalies-review.test.ts|通过|
|s13-anomalies-c.test.ts|通过|
|s13-anomalies-b.test.ts|通过|

唯一失败位置：`tests/s13-p1-dual-wielding.test.ts:26`，`expect(trace.contentDigest).toBe(CONTENT_DIGEST)`。旧 `s13-p1-dual-commands.json.gz` 是 `fnv1a32-utf16:697a358c`，当前是 `fnv1a32-utf16:68fa835d`。测试在回放命令前终止，尚不能据此判定双刀流公开轨迹在新池中的可用性。未修改断言、录制、digest 或时限；按任务约束停止该项，不运行指纹重录脚本或共享路线测试。

## 未完成八项的原型与研究文件

以下均位于 `docs/evidence/s13-p1/experiments/`，未接入生产代码，.txt 文件不参与 TypeScript 编译。扫描 src 未发现这些原型的导入/引用，也未发现未完成八项的内容 id 注册。

|文件|内容及接入状态|
|---|---|
|AVARICE-LIMITS.md|贪财化身实时余额/恢复边界，研究说明。|
|DUO-LIMITS.md|双排满席所有权与共享池事务缺口，研究说明。|
|duo-queue-acquisition.ts.txt|撤出的双排授予原型；不接入。|
|duo-queue.test.ts.txt|历史双排原型测试；不执行。|
|s13-p1-anomalies.ts.txt|撤出的贪财化身定义原型；不接入。|
|s13-p1-avarice.test.ts.txt|贪财化身历史实验测试；不执行。|
|verify-s13-p1-avarice.cjs.txt|贪财化身历史验证脚本；不执行。|

其余六项（英勇福袋、升级咯、猎头者、名片、进入未知、终极英雄）没有独立实现原型；设计/机制缺口见同目录上级 `RECONCILIATION.md`、`WIP.md`、`REPORT.md`。这些旧报告、TEST_RESULTS.json 和 logs 是历史证据，不代表本次验证结果。生产 `bound-unit-identity.ts` 当前服务双刀流，不是后三个绑定异常的完整实现。未删除或移动这些文件，建议暂保留明确标记的研究档案，交付保留与否由调度方决定。

## 交接建议

建议合并提交信息：`Merge integration/s13-augments into P1 split delivery, preserving P4 fixes`。

自行决定：采用 runner 配置加载与串行文件执行解决工具启动问题；content/index.ts 保留 P1 的双刀流 digest 输入（调度方复核后恢复）；不改失败指纹断言。

未完成：指定测试全绿仍被双刀旧录制指纹阻挡；八项继续等待机制包；索引冲突状态待调度方 add/提交。

风险：不能把 220/221 通过当作双刀公开轨迹完整验收；旧录制后续可能还有路线差异。建议集成讨论串统一处理 v13 录制后，再原样复跑该失败测试。此处不请求扩大本任务范围。
