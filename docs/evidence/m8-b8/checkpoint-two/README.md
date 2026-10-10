# B8 检查点②：实施中，未签收

接手精确远端签收基线：`4554f5afee219416be410ff7edbd16ffbeb7daf5`。
检查点①外部 Codex 签收原记录保留：<https://github.com/catfish-xn/cat/pull/28#issuecomment-6093790209>。
本页是②局部备份证据，不是自审签收，不解除延期项；②完成仍交用户转外部 Codex 正式审计。

## 局部备份 1：模式无关纯 combat-input 前提

- 新增有限 `CombatStrategyInputs`、独立深拷贝冻结 basis，以及对独立资源前缀／日程收据／历史／G12 前缀的纯校验器。
- `buildStrategySnapshot` 只收窄入参类型，函数体不变；现有 U5 mock helper 类型同步收窄，测试断言原样保留。
- Match 入口、正式状态、live digest 均未接线。本次不得称 Combat 历史恢复已经改用 basis。
- ②真实启用与③未完成自选会使现有全程路线在 1-3 的未解选择停住；临时开发期隔离方案正在请求用户批准。未加模式、未改默认规则、未提前接③、未扩大 skip。

验证环境：Node 22，路径 `/tmp/b7-npm-cache/_npx/d18f28baf1132559/node_modules/node/bin`。

- `npm run typecheck`：通过。
- `npm test -- tests/m8-b8-combat-input.test.ts tests/m8-u5-preview-mocked-snapshot.test.ts`：2 文件、18 测试通过。
- 全量 `npm test`、build、生产/reachable 累计预算尚未运行；此纯模块尚未在生产入口可达，不能以 tree-shaken 成本代表②成本。

待办：新局起 provenance 写入与严格折叠、basis 运行及 restore 接线、死亡揭示与直接授予、容量及唯一成长经济事务、当批全部合法态恢复、独立向量与篡改拒绝、全量原样验证和预算。真实自选路由、LootView、完整终局 fallback 仍为③。
