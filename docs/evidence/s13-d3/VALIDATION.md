# D3 验证记录

基线：`461c8877254a865a300d60f304bc316c8df8ad11`。分支：`codex/s13-mech-ownership`。工作目录：`/workspace/cat`。最终完整 SHA 与 PR URL 由提交后的 PR 正文/任务回报给出，避免文档自引用提交。

- Node `v24.19.0`；LF 检出，`core.autocrlf=false`。
- `npm ci` 首次因默认 `/home/agent/.npm/_cacache` 不可写失败；改用 `npm ci --cache /tmp/cat-npm-cache` 安装成功。未改 lockfile。
- 最终 `npm run typecheck`：通过，13.336s。
- 相关测试 **38 文件 / 530 条全部通过**；逐文件单独启动 `npm test -- <file> --reporter=json --outputFile=/tmp/...`，累计进程墙钟 197.735s；未跑全套。
- 最后代码/新测试补充后，仅重跑专项：**19/19**，Vitest JSON 报告起止 2.457s；既有 511 条不受新模块修改影响，无额外重复全套。
- 新专项首次编写时有一条对 deriveTraits API 形状的错误假设（空阵容仍返回 count=0 的全部羁绊）；仅修正新增测试，原有断言/时限未改。最终无失败、无跳过。

## 逐文件结果

|测试文件|通过/总数|进程墙钟 s|
|---|---:|---:|
|`tests/s13-mech-ownership.test.ts`|19/19|2.663|
|`tests/tp-shared-pool.test.ts`|14/14|2.714|
|`tests/shared-pool-cache.test.ts`|4/4|2.396|
|`tests/r3r4-shared.test.ts`|8/8|2.786|
|`tests/shop.test.ts`|22/22|0.804|
|`tests/upgrades.test.ts`|16/16|1.030|
|`tests/t10-deferred-upgrades.test.ts`|10/10|2.595|
|`tests/inventory.test.ts`|45/45|0.952|
|`tests/m8-b5-grant-upgrade.test.ts`|14/14|11.167|
|`tests/m8-b5-equipment-history.test.ts`|9/9|11.645|
|`tests/m8-b8-equipment-fixture.test.ts`|4/4|4.113|
|`tests/r3r4-consumables.test.ts`|15/15|11.452|
|`tests/r3r4-consumable-targets.test.ts`|5/5|3.933|
|`tests/g2-3-lesser-shimmer-duplicator.test.ts`|37/37|10.924|
|`tests/g2-3-traits.test.ts`|19/19|2.054|
|`tests/g2-2-traits.test.ts`|10/10|2.097|
|`tests/g2-3-followup.test.ts`|11/11|2.314|
|`tests/g2-3-hook-failures.test.ts`|8/8|2.021|
|`tests/g2-3-netcode-hooks.test.ts`|14/14|7.922|
|`tests/g2-4a-conqueror-items.test.ts`|6/6|2.214|
|`tests/g2-4a-crown.test.ts`|6/6|3.044|
|`tests/g2-4a-crown-gold.test.ts`|9/9|5.130|
|`tests/g2-4a-crown-history.test.ts`|56/56|22.769|
|`tests/g2-4b-reward-order.test.ts`|1/1|1.421|
|`tests/g2-4b-gold-settlement.test.ts`|2/2|1.999|
|`tests/g2-4b-pr161-restore.test.ts`|11/11|12.436|
|`tests/g2-4b-artifact-forge.test.ts`|7/7|3.128|
|`tests/g2-4b-support-forge.test.ts`|8/8|3.994|
|`tests/s13-anomalies-settlement.test.ts`|4/4|3.064|
|`tests/t3-round-settlement.test.ts`|10/10|3.881|
|`tests/s13-anomalies-c.test.ts`|8/8|2.049|
|`tests/g2-3-integration.test.ts`|18/18|3.078|
|`tests/g2-augments-static.test.ts`|70/70|2.164|
|`tests/g2-augments-multiplayer.test.ts`|6/6|3.704|
|`tests/mp-overtime-choices.test.ts`|1/1|2.748|
|`tests/server/shared-pool-room.test.ts`|9/9|28.045|
|`tests/server/c18b-use-consumable.test.ts`|8/8|4.026|
|`tests/server/c18b-consumable-preview.test.ts`|6/6|3.259|

## 新增验收覆盖

- 独立 oracle 逐英雄累加：共享可用池 + 商店/奖励/轮选预留 + 全席位可见份额 + 事务托管份额 == 初始份额。
- 满席先取得两个不同真实 unitId 的所有权；hold 与 reject 两路径；腾位只移动原实例，不再扣池/分配 ID。
- 物品、英雄、工具的中途失败以及第二份池空均逐字段等于事务前，返回同一 state 引用、无事件。
- 复制器预览无写入、合法手动使用、费用上限、错误/暂离目标、满席拒绝不消耗、托管成功仅消耗一次。
- 暂离装备随实例托管；不能卖、卸装、装备或合星；不计在场羁绊/人口；到期满席继续持有，轮选与加时计真实结算数。
- 3/9 份真实升星来源折叠、2/3 星暂离归还、出售全额真实份额退池和装备返背包；部署/出售腾位领取。
- object/JSON 重演快照与后续事件一致，重复命令/结算不重发。删收据、删 held、删全部命令、退回较早合法快照、同来源换事务、改变授权计划均有拒绝反例。

## 范围与风险

- Q3 实施；Q5 逐条边界与待内容评审的旧约定见接口文档。Q1/Q2/Q4 未扩范围。
- 只新增独立底层包，不接强化/异常/服务器/界面/现有 Match 保存入口；调用方需提供可信边界、奖励来源及独立认证命令序列，不能用候选存档自证。
- pool 与 OwnershipSeat 是同一独占投影，禁止与旧 MatchState 混用；人口与普通资源命令的生产适配留待内容集成。没有性能验收声明。
- 没有修改 src/server、src/rendering、src/presentation、历史 raw、已有测试或规则数值/content digest/版本号。
- 没有重录共享录制/种子路线或更新源码指纹；集成接入调用图后如需更新，由集成方统一处理。
- 未合并 D4 未审代码；D4 最小对接数据为只读 OwnershipSeat.preparation 与 deploymentCap。独立评审由调度方另行安排。

## 2026-10-19 Q3 来源补记（仅文档）

- [Q3 来源核对](Q3_SOURCE_REVIEW.md)：原版 raw 仅能确认暂离/归来语义，满席处理、交互禁用和轮选/加时计数不能确认；按新版 Q3 标为兜底项目约定。Q6 不扩目录，Q7/Q8 不做。
- 原本地测试和 [CI #627](https://github.com/catfish-xn/cat/actions/runs/39198450528) completed/success 固定绑定 `2989cc38353232d2f169ece6ee939b7839254c0c`，不代表文档追加提交已取得新 CI 成功。
- 本次只补三份 Markdown/PR 说明；不改实现、数值、测试、指纹或版本，不重跑代码测试。以 diff/check 和文件范围核验。

## D5 空操作 ID 修复（2026-10-19）

- 从远端 `f2aabd64ecfcbef3844aa821f5c9e7365409e453` 继续，首次成功空操作也记录唯一事务 ID，无事件；同 ID 换操作拒绝，可信日志含空操作的恢复一致。
- [完整修复与指纹验证记录](D5_NOOP_FIX.md)：13 个单文件、239 条通过，33.844s；typecheck 通过，15.774s；4 条授权指纹生成/校验命令全部通过，118.881s。历史 raw 与其他路线字节不变。
- Q3 沿用已完成取证，明确为用户10-19批准的项目约定（Q3）；旧 CI #627 只归属旧实现，本次 SHA 与 CI 另见 PR/回报。
