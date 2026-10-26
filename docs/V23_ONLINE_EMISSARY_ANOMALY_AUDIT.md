# v23 多人魔像异常／四外交官核查

核查基线：`claude/v23-rules-fix`，HEAD `0797f3fe`。本次仅检查多人权威命令、双方战斗快照，以及在线 3D 使用的共享 DOM 面板；不修改单机路径。未连接 v22 测试服，不能将本地结果解释为已确认线上根因或已修复线上故障。

## A：魔像异常目标

- `src/rendering/strategy-panel.ts` 的 `renderChoice` 仅按 `team === 'player'` 列出目标，未排除 `trainer-golem`。在线 `remote-session.ts` 的 `anomalyTarget` 将选择交给服务器；3D 没有另一套异常目标过滤。
- `src/simulation/match.ts` 的 `selectAnomalyTarget` 排除不存在的目标、敌方、锻造器、已有绑定；多人非空 offers 还检查 `eligibleD14Target`。正常进入 4-6 时 offers 为空，选定目标后才生成合法候选。
- `src/simulation/d14-runtime.ts` 的 `eligibleD14Target` 仅对 `ultimate-hero`／`into-the-unknown` 加入棋盘、非召唤物等限制；`trainer-golem` 的 `summon` 标记使它不符合这两项资格。其余异常未在此排除魔像。这不是“所有异常都禁止魔像”的判断。
- 新增在线面板回归：己方二星 `trainer-golem` 出现在私有投影和实际目标按钮里，点击回调携带正确 ID；真实 `selectAnomalyTarget` 成功，生成一项候选，真实 `selectChoice` 成功绑定。该例为隔离投影夹具，不模拟从开局推进至 4-6，不构成原版资格证据。

限定版本证据核查：

- 仓库 `docs/OPENING_ENCOUNTERS_BATCH_B_REPORT.md` §1–2、`docs/S13_RULES_GAP.md` 开局 Batch B 节，只确认三永久纹章、模板和已批准交互口径，没有魔像异常化资格的证据。
- 上述报告引用的本地只读 `s13-14.24b-supplement-2026-10-23/TFT_S13_14.24b_Research_ZH.md` §3 明确区分模板与运行时交互；确认魔像和纹章，但没有异常目标资格。未复制原始资料或数值文件。
- `/home/aiapps/workspace/set13-worktrees` 可读的 Markdown、HTML、research JSON 中未检出 `TrainerGolem`／`Anomaly` 研究记录；本仓库无 `planning/` 目录。

结论：v23 的普通异常选择未复现全面拒绝魔像；不能凭“缺证”推断原版能选或不能选。按任务约束，保持所有规则和前端资格判断不变，包括两项特殊异常的限制。

## B：四外交官

14.24b 依据：`docs/evidence/g2-2/RECONCILIATION.md` 的 emissary 行及 `src/presentation/trait-official-text.ts` 的同版中文描述。恰好 1／4 个不同外交官激活；四档获得全部团队加成，外交官成员另获 200 生命、20% 增伤。团队加成是娜美每次普攻 +2 法力、崔丝塔娜每星 6% 攻速、安蓓萨双抗、盖伦开战左右共享其 12% 最大生命。

安蓓萨按仓库已批准口径读取此前 PvP 胜场，封顶 7；这与原文“已击败对手”证据等级不同，已有 `G22_CONVENTIONS` 和多人历史测试。本次不改为不同对手计数，不更改既有口径。

新增 `tests/v23-online-emissary.test.ts`：

- 四名不同的盖伦／娜美／崔丝塔娜／安蓓萨，加非成员拉克丝。`deriveTraits` 返回 count=4、tier=4。
- 经 `snapshotForBattle → compileBattle → startTwoSidedCombat`，双方均为四档；逐个断言成员 +200 HP／20% 增伤、所有友军 +600 Bps 攻速／+2 普攻法力。A 三场历史 PvP 胜利得到 +6 双抗，B 无历史得到 +0；不是只验证左方或内容表。
- 盖伦冻结生命 1200，自己和左右友军各加 144；非外交官友军得到团队奖励、不获成员专属奖励。
- 两／三名外交官时双方 tier=0，无外交官效果来源。
- 经 `toSeatPrivateView → toDisplayMatch → boardTraitRows → renderTraitRows`，实际 DOM 输出 active、count=4、tier=4、gold，断点 4 高亮、无障碍文本为“已激活 4 档”。这是在线 3D 共用羁绊栏的函数路径，没有添加 3D 对 2D 的值导入。

结论：v23 未复现 B，当前人数判定、战斗编译和羁绊栏链路均通过；没有已证实的生产根因，因此不做推测性生产修复。真实 v22 反馈仍需相应对局棋盘、版本和战斗输入才能定位；本次不声称完成线上浏览器／3D 实机验收。

## 改动与验证

只改两份测试及本报告。`src/simulation/` 改动：无；数值、规则口径、内容 digest、epoch、证据文件、素材和按钮尺寸均未改，git 未执行写操作或提交。

运行（只跑相关文件）：

```sh
npx vitest run --configLoader runner tests/g2-2-traits.test.ts tests/g2-2-online-emissary.test.ts
npx vitest run --configLoader runner tests/v23-online-emissary.test.ts
npx vitest run --configLoader runner tests/presentation/v23-anomaly-panel.test.ts
```

分别 17/17、4/4、13/13 通过，总计 4 文件 34 测试。最初默认 config loader 因共享 `node_modules/.vite-temp` 只读报 EROFS；改用 Vitest 支持的 runner 后通过，未修改配置或依赖。`git diff --check` 通过。未运行全套、未重录任何 epoch／历史证据。
