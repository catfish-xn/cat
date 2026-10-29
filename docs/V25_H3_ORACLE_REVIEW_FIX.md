# V25 H3 审查 must-fix 修复报告

分支：`codex/v25-h3`。起始 HEAD：`f0bd71c1b8e90e81406ed2f4d872373cb60566e4`，起始工作区干净。
审查输入：`/home/aiapps/workspcae/codex-briefs/b5h/review-h3-result.md`。

【完成】P2：`Ledger.apply` 现在校验 H3 的完整成长收据集合，不再只比较 `augmentProgress`。

新增 `tests/fixtures/m5/h3-growth-oracle.cjs`，只依赖 Node assert；英雄名单沿用独立 oracle 的手录目录。规则依据为 `docs/MATCH_CONTRACT.md` 的 Batch 5 H3 段及 P-B5-31/P-B5-57：

- B5-31：在开战边界核对本人冻结阵容，并保存脱离生产对象的副本；真实 PvP 结算按参战普通英雄分别计算 20 HP、150 Bps AD、150 centi AP。不会用结算时的现役棋盘代替开战名单。
- B5-57：从入轮前观察到的棋盘与装备计算受益人，独立实现奇数行六角距离及 ID 并列排序；原始锅/铲每携带者一次，每次 50 HP，多源累加，排除备战席、召唤物及衍生装备；没有目标时仍要求唯一空收据。
- 合星：检查实际候选的身份、星级、保留顺序、位置及最终阵容，区分结算前合星与结算后延迟合星；历史成长沿已核对的血缘继承，不重发旧收据。
- 每一步对照独立保存的前态、历史和资源前缀。缺失、额外、重复、错目标、错数值、错归属/时机均拒绝；来源事实与成长收据一起改写，或同时改写传入的前后态，也不能替换已观察的依据。

`createH3Ledger` / `checkH3Growth` / `h3GrowthForUnit` 由 `oracle.g2.cjs` 导出并补充 `.d.cts` 声明。它们分别建立观察起点、校验转换并返回新账本、按独立应发记录及合星血缘计算累计成长。必须从首次成长/PvP 冻结之前开始观察；不会把已成长的候选存档当作期望值来源。既有录制源码摘要的递归扫描会自动包含新 oracle 文件，相关摘要测试通过。

新增 `tests/augment-pool-batch5-h3-oracle.test.ts`，共 46 项：

- 复现并拒绝无命令、无事件凭空增加 `+999999 HP` 收据的原审查反例，直接调用 `Ledger.apply`。
- 使用真实八席 `Room` 和 `TwoSidedBattleResolver`，以 seed 1 / s3、seed 3 / s2 的真实报价、选择、购买、布阵、装备、冻结、结算、入轮过程核对 oracle。
- 两项强化分别覆盖收据攻击矩阵、来源事实/收据联合篡改、前后态联合篡改、结算事实与成长同时删除、重复结算，以及持有后的房间连接状态断开/恢复和 authority 存档恢复。连接测试不等同于 WebSocket 网络重连测试。
- 独立手写向量覆盖距离并列、奇数行坐标、多件不倍增、多持有者叠加、空受益集合、普通商店合星、延迟合星及联合篡改。手写向量不是声称可加载的生产存档。

【验证】最终命令：

```sh
npm test -- --configLoader runner tests/augment-pool-batch5-h3-oracle.test.ts tests/m5-oracle-augment-ledger.test.ts tests/server/batch5-h3-room.test.ts tests/server/batch5-h3-cooking-room.test.ts
npm run typecheck
git diff --check
```

最终定向回归 4 文件、95 项通过；TypeScript 检查通过。此前同轮相关检查中的 `tests/augment-history.test.ts` 77 项通过，合计覆盖 5 个不同文件、172 项。未运行完整单机路线、浏览器验收或构建。

普通 Vitest 启动曾因共享 `node_modules/.vite-temp` 只读而失败；使用 Vite 的 `--configLoader runner` 避免向该目录写入，未改变配置文件、断言或超时。

【未完成】must-fix 无剩余项。可选的真实房间合星继承路线未新增；本次合星覆盖为独立边界向量，真实房间新增覆盖集中在成长结算、重复结算和连接状态恢复。

【需要我决定】无。

【风险】oracle 需要连续观察可信的原始规则输入；不是任意晚期存档的独立认证器，也没有另写战斗胜负模拟器。生产成长读取器、规划器、恢复器或 authority 对比均未用于构造 oracle 的期望成长。

【下一步】请按原 P2 反例和联合篡改矩阵定向复审。仅修改 `tests/` 与本报告，没有生产规则、内容身份、历史 golden 或服务器目录修改，没有执行 Git 写操作。
