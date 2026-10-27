【完成】结论：**不通过**。7 个相关测试文件通过；另用探针复现以下三项缺陷。未修改受跟踪文件、未提交。

must-fix：

- **P1｜[src/simulation/match.ts:472](src/simulation/match.ts:472)**：seed=19、s0 取得强化后，在 2-7 前卖空阵容，tick 0 结算缺少 deaths 边界，抛出 `missing deaths for round 10`，房间以 `resolver-error/invalid-pool` 整局结束。建议发奖前明确记录终局边界，包括空死亡列表，并补真实房间回归。
- **P2｜[src/simulation/shared-pool.ts:63](src/simulation/shared-pool.ts:63)**：同一真实存档中，将强化改成同组候选 `crownguard-spirit`、删除 augmentHistory、增加 123 金，省略 authority 后三种恢复入口均接受，原赠送英雄仍保留。初始 gift 收据未进入孤儿检测。建议补齐其命名空间校验，并依据可信服务器证据决定认证要求。
- **P2｜[tests/fixtures/m5/augment-rewards-oracle.cjs:395](tests/fixtures/m5/augment-rewards-oracle.cjs:395)**：通用 oracle 仅按 source 分类，将合法金币再次当作 gift 校验；第 383 行也将装备归入金币。独立生成的合法 2 金向量即失败。建议按 kind 区分，并通过 `validateRewards/Ledger` 覆盖金币及装备发放。

可选建议：同步 P 条目末段、合同和实现报告中的“三节点开放”旧表述；当前 4-2 禁出符合批准决定。
【未完成】WebSocket 投影测试因沙盒禁止本地监听（EPERM）未完成；未跑全套。
【需要我决定】无。
【风险】恢复篡改漏洞在省略 authority 时成立；传入真实 authority 时能拒绝。
【下一步】修复三项并补回归后复审。