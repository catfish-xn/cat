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

验证：原样 `npm run typecheck` 通过；四文件专项 `m8-b8-combat-input`、`m8-b8-resource-provenance`、`m8-b8-loot-freeze`、`m8-u5-preview-mocked-snapshot` 共 **162 测试通过**（原始输出见 `targeted.log.gz` 与 `typecheck.log.gz`）。最初原样全量在早期源码上启动；之后有进一步修正与接线，不能当最终本批固定源码全量证据。后续测量状态见下。

## 纯模块复核修正（尚未启用运行态）

独立只读复核发现原增长 start-prefix 可以越过本轮 loot 出生，将新掉落英雄伪造成原战斗单位。已限制 start-prefix 不晚于本轮首次 loot 出生，并新增 unit／item 拒绝、合法战前 shop 成长及结算后 capacity 出生的 4 项向量。provenance 专测现为 64 项通过，typecheck 通过；之前的全量和预算不冒称覆盖本次修正。

## 用户批准的②／③顺序调整

用户已明确批准把最小真实自选与必要终局处理前移②，不采用临时开发模式，不增加模式状态或 digest 分支。②须实现 loot PendingChoice、protocol 2 selectChoice 的实际授予／唯一 receipt／resolution、earned terminal fallback、满席终局保留，以及这些当批状态的严格恢复。③保留 readLootView 接线、隐藏信息完整样例和剩余组合验证。默认真实入口将直接接线；冻结玩法与公开合同不变。本节是实施授权范围，尚不是已完成证据。

## 预算触线封存：默认接线 WIP，立即暂停

已按用户批准开始默认 Match 接线，没有阶段模式或模式 digest 分支。当前源码包含死亡揭示、直接授予、自选路由、必要终局 fallback、容量等待／出售重试、basis 生命周期、资源来源写入和 strict restore 初稿；**这不是完整检查点②验收**。

测量环境 Node v22.23.3 / Vite 7.3.6，基线为干净 `git archive 2acb9acfe90ad7936083fa2c7018dd482b6b222f`、同一依赖目录、相同 Vite 配置和入口。每个 emitted `.js` 独立 gzip level 9 再求和。`measure.mjs` 的 audit 入口只在内存中加入① freeze/choice/identity 和② combat-input/provenance 所有 exports 的可达引用，不修改 UI 文件。真实 runtime 与 restore 已由默认入口可达。

| 早测产物 | gzip9 | 相对既定 488964 B 基线的 B8 累计增量 |
| --- | ---: | ---: |
| 基线 | 488964 B | 0 B |
| 真实生产 | **503035 B** | **14071 B** |
| 全 exports reachable | **503471 B** | **14507 B** |

生产与 reachable 都超过严格 `>13000 B` 暂停线，分别超过 1071 B／1507 B；不是从②重新计数，已包含①成本。总包仍低于 552191 B，但不能用全局余量覆盖 B8 超线。检测后立即停止实现、优化和测试扩展，只封存现有源码／证据，等待用户的下一步预算决定。

**源绑定限制必须保留：**上述预算 assets 写于 2026-10-10 06:56:38／43／47 +0200；封存时 `loot-runtime.ts` 的最后修改时间为 06:57:01 +0200，晚于测量。故这组数值是触发暂停的早测，**不声称预算受测 tree 与本次封存 commit 完全一致**；当前源 SHA-256 清单另存。此处不得用早测冒充最终 fixed-SHA 预算。

验证分开记录：

- 纯前提阶段原样 `npm run build` 通过，生产 488964 B、reachable 496949 B（累计7985 B）；日志留存 `prerequisites-build.log.gz`、`prerequisites-budget.log.gz`。这不是 live 初稿的完整 build/typecheck 证据。
- 纯前提原样全量命令输出：118文件、1663 passed／10既有 skipped，共1673，日志留存。命令运行期间工作区继续修正／接线，故标为 diagnostic，**不能代替当前封存源码的固定 SHA 全量验证**。
- 停线前，runtime worker 的18项专项与 typecheck 通过；restore worker 的6项真实默认路径专项，加 basis/provenance 共83项通过。两者是局部结果，不替代全量或外部审计。
- 当前 live 初稿只完成上述早测 Vite 生产／reachable 构建；全量 `npm test`、完整真实奖励合并／容量出售／早终局与6-7／装备异常G12迁移向量、全部独立经济向量、CI及外部 Codex 签收仍未完成。原有 fixture 也尚未完成对新 provenance 入口的全量核对，不允许通过删除验证或扩大 skip 绕过。

所有①原签收及其原始证据完整保留；②仍必须在获准继续且通过固定 SHA 验证／CI后交用户转外部 Codex，不以本页或内部检查自签收。
