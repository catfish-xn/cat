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

## 局部备份 2：纯资源来源折叠与扩展 basis 向量

- 新增 `resource-provenance.ts`：连续出生／消费 serial、收据↔出生双射、合法同星升级链、出售价格与时序、组件精确配方、唯一 combat growth commit；从原前缀按升级链分别迁移 stock／delta。
- 全流校验完成后可返回指定前缀投影；不能通过只截取 entries 忽略未来部分的缺失出生或非法消费。每个应有 combat settlement 的提交完整性是必填的独立权威。
- 纯成长代数覆盖 370；合法 Tristana 125 Bps 步长覆盖 1000、级联及原死亡单位的 delta。缺出生／删链／重复消费／错配方／错 serial／错时序及重复、缺失成长提交均有拒绝向量。
- basis 补充真实公开命令到 3-5：两次 `.4` 组件、合成 TG、装备并上场，验证原临时装备来源及父 ID；公开 2-5 第七战种子独立值 890455596。此为纯 helper 的合法输入向量，尚不是②掉落运行接线证据。
- 收据仍需外围对真实冻结计划／资格核验；当前 Combat 的源 delta、survivor 选择和原装备迁移须由后续 basis 后缀精确重演交叉核对，不把纯折叠称为已完成 Match restore。

验证：原样 `npm run typecheck` 通过；四文件专项 `m8-b8-combat-input`、`m8-b8-resource-provenance`、`m8-b8-loot-freeze`、`m8-u5-preview-mocked-snapshot` 共 **162 测试通过**（原始输出见 `targeted.log.gz` 与 `typecheck.log.gz`）。第一次原样全量 npm test 在早期源码上仍运行，不能当最终本批全量证据。build／生产与完全 reachable 累计预算待完成。
