# S13 P1 部分交付报告（不可按整包完成合入）

- 分支：codex/s13-augments-p1；起点 075e9a494758b13620c8ae36e55364cc214fd364。
- 实际代码固定 SHA：2d13b31cc4e45c48f87759a460f5ec074bd430ef；之后报告提交仅归档证据，最终交付HEAD在回报给出。
- 规则版本仍v11；CONTENT digest=fnv1a32-utf16:697a358c。未开PR、未合并。
- 15项逐项来源/状态/依赖见 [RECONCILIATION.md](RECONCILIATION.md)。

## 完成边界

已实现并通过相关主效果与恢复专项：遥遥领先、对冲基金、投资策略II、炫目之速、便携锻炉、光明圣物（6强化）。目前目录强化36、异常31。
双刀流已实现原始15角色池、60实际英雄角色对应、两件真实库存成装、唯一收据、源轮次/目标身份恢复，但**公开路线测试最终5,661ms超过原5,000ms，验收未通过**。此前补身份核对后6,313ms失败和更早一次通过均保留，不以早期通过关闭失败。
剩余8项未完成且不入池：英勇福袋、升级咯、双排、贪财化身、猎头者、名片、进入未知、终极英雄。完整基建/服务器依赖及复用接口已逐项记录。双排与贪财化身原型仅在experiments保留，不是生产功能。

## 验证（逐文件串行，没有全套）

Node v24.19.0 / npm11.9.0 / Vitest5.0.3。14文件全通过、1文件含失败；合计344通过、1失败。typecheck通过。
下表为本轮每文件最后一次结果；最后固定代码SHA补跑绑定身份、旧联机、历史身份、双刀与typecheck，其余未受后续修改影响的通过证据复用，不伪称新跑完整套件。

|文件|条数结果|文件耗时|
|---|---|---|
|tests/g2-3-anomalies.test.ts|40 passed (40)|2.84s|
|tests/g2-augments-choice.test.ts|41 passed (41)|8.45s|
|tests/g2-augments-combat.test.ts|16 passed (16)|5.04s|
|tests/g2-augments-identity.test.ts|1 passed (1)|2.74s|
|tests/g2-augments-multiplayer.test.ts|4 passed (4)|2.08s|
|tests/g2-augments-static.test.ts|66 passed (66)|2.55s|
|tests/g5-economy-preview.test.ts|66 passed (66)|4.48s|
|tests/match-economy.test.ts|83 passed (83)|2.57s|
|tests/s13-p1-acquisition.test.ts|3 passed (3)|3.74s|
|tests/s13-p1-avarice.test.ts|1 passed (1)|304ms|
|tests/s13-p1-bound-identity.test.ts|2 passed (2)|243ms|
|tests/s13-p1-dual-wielding.test.ts|1 failed / 1 passed (2)|7.91s|
|tests/s13-p1-income.test.ts|8 passed (8)|2.66s|
|tests/s13-p1-multiplayer-income.test.ts|2 passed (2)|6.81s|
|tests/t3-round-settlement.test.ts|10 passed (10)|4.90s|

原始日志与结构化清单：[TEST_RESULTS.json](TEST_RESULTS.json)、logs/。双刀失败原文：`Error: Test timed out in 5000ms.` 没有改时限、跳过或删除该用例。没有把独立来源脚本当作5秒验收替代。

两项联机断点覆盖已实现的人口/成长收入项：公开买卡上阵征服者2档→真实双边结算→下一轮撤下一名到0档→真实第二场结算；遥遥领先轮初经验和投资策略II实际利息均核对、重复结算拒绝。未实现的5个指定人口/棋盘项没有声称已完成联机验收。

## 指纹与历史目录

执行 `node tests/fixtures/record-g2-4b-herald.cjs --write`（该脚本默认校验，实际重录当前g2-4b目录需--write）；5个原始状态都在导入恢复模块前生成，随后生产恢复、开战、15tick往返全部通过。最终完整生成96,247ms。
之后执行 `node scripts/record-g2-4b-inputs.cjs --baseline-commit=075e9a494758b13620c8ae36e55364cc214fd364`，同参数加 `--check` 通过，9个证据文件。
未使用verify-m8-herald --write。g2-3与g2-augments历史目录相对基底逐字节无变化。版本常量、src/server、src/rendering、src/presentation无改动。

## 自行决定与风险

- 当前Herald脚本按实际CLI使用--write，仅当前g2-4b目录；没有覆写历史目录。
- 双刀的角色池来源真实，但把该池用于双刀、无放回独立seed、发库存、21个legacy/召唤物角色映射均明确是项目约定，见对账表。现有装备不覆盖。
- 贪财实时金币和双排共享池完整领取缺接线，不能用快照/可删收据假装实现，因此撤出默认池。
- 新共用 `traceBoundUnitIdentity` 只追踪已验证资源事实中的升星和出售，不代表猎头者或其他跨轮异常已完成。
- UI旧直接利息查询尚需Claude改用已有previewRoundEconomy，已写UI_REQUESTS。forge与G23优先队列逻辑已接线，但本轮没有额外声称覆盖每个G23复合弹窗排列。
- 本分支不可按整包签收：双刀5秒测试未通过、8项未实现；没有运行全套或远端CI，没有自行升版本。

## 最终轨迹来源复核

在证据提交 d070d5b6917c5bbae69c683f401a43d3776b1870（代码仍为2d13b31cc4e45c48f87759a460f5ec074bd430ef）执行 `node scripts/record-s13-p1-dual-choice.cjs` 默认check，退出0；seed23、4-6、原始序列化84,055字节，公开命令→导出→生产恢复验证16,227.648ms。该来源验证运行的是最终代码，不替代仍失败的5秒专项。日志见 logs/dual-source-final-check.txt。
