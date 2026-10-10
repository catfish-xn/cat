# B8 检查点②送审包：本机全绿，最终 SHA CI 待完成

## 固定入口与签收边界

- 已完整验证的代码/测试/工具候选：远端 **1258682c02020edc7b6b665e448678e0c889c2d4**；本地 bfaff72030d3a25ecc862d3cbb923f4057788eeb；整树495d02bb42de698b5c18d4988bd8e7df615a2322；src树16568c527580d74caca79e988bb5e8a1d43a290b。
- 本包是随后追加的纯文档证据；最终审查固定 SHA 由 PR #28 推送记录绑定，**最终含本包的实际 HEAD 仍必须取得自己的全绿 CI**。不能用源码等价把125868的CI替代最终HEAD。
- 125868对应CI207尚待终态；当前本机结果不是浏览器验收。原CI200 input-dev M6页面关闭未定根因，下一真实运行带最小观测记录；若仍失败，须保留原始异常并继续定位，不以重跑掩盖。
- ①外部正式签收原记录：[6093790209](https://github.com/catfish-xn/cat/pull/28#issuecomment-6093790209)，无P0–P3、CI170同SHA绿。①记录保持原样，不能推导②已签收。
- 所有本文引用的内部独立检查均为技术预检。②由用户转交外部Codex独立审查，尚未签收；PR28不合并，③不实施，B9核心不启动。

## 本次交付与直接索引

| ②范围 | 证据/重点 |
| --- | --- |
| 真实死亡揭示、直接奖励、唯一receipt、同tick多来源、部分击杀 | [真实组合](live-combination-controls.md)，live-reveal专项和当前全量 |
| 经济原子结算与成长迁移 | live-economy保持9/49/50＋1→16/60/61，独立H80→88/120/120；live-growth真实stock/delta/奖励立即升星；当前全量 |
| 出生、合成、升级、出售消费来源与严格恢复 | provenance、combatInputBasis以及历史对应开战依据；完整state/events/receipts一致及精确篡改拒绝 |
| 满席、真实自选最小公开路由与终局 | live-capacity、live-transfer；未解决Continue拒绝，schedule/loot区分，earned fallback与retained-terminal不伪授奖 |
| 旧92项失败闭环 | [逐根因闭环](failure-closure.md)、ci183-failure-cases.json逐项编号；当前全量覆盖 |
| golden独立规则依据 | [golden](golden/README.md)：旧132轮完整复现、新旧逐事务资源/来源/数值核验、原字节保留、19反例与24原样guard；不是盲重录 |

②由③前移的仅是已批准最小loot PendingChoice/protocol2选择、实际授予/receipt/必要消费谱系、必要终局fallback及满席终局、待选/选后/终局严格恢复。③仍是readLootView接线、hidden-info完整样例和剩余跨轮/终局组合。冻结公开合同、玩法和H1不变；当前开发content digest `fnv1a32-utf16:314b4c1f`，schema5/save1/replay1/protocol2，正式6/2/2仍属B9。

## 独立审查重点与授权例外

1. **BoardScene唯一UI文件边界例外**：用户明确允许真实奖励新英雄显示对象创建先于读取/同步；Combat回放中的已消费旧ID保留，恢复路径同样禁交互，Continue清Combat后销毁，重复update不重复建。独立修复提交和token生命周期专项保留。CI183真实native31双环境、M7，以及CI200真实native/touch已有结果，但最终SHA仍需自己的CI。
2. **Herald五例准备方式例外**：用户明确批准完整合法公开轨迹生成的原始序列化输入。原14场/5844tick无裁剪；每例在原5秒内JSON独立复制、执行完整生产restore和原机制/资源/篡改断言。可重复脚本 `node scripts/verify-m8-herald-fixtures.cjs` 单独完整生成→导出→restore验证，当前源绑定已实际重跑，原始五输入及轨迹字节不变。它和五个恢复专项职责/计时边界不同，不把总耗时差称为生产提速；TG不套用此例外。
3. **TG43准备去重**：仅确定性seed集合37→35去掉重复定义准备，43定义逐个真实授予/装备/restore和原负控仍在；未改原战斗站位/路径、5秒门限或worker。废弃站位探索证据未冒充最终修复。
4. **同次恢复完整prefix复用**：[restore-fold-reuse](restore-fold-reuse/README.md)。只对本次字符串JSON.parse来源且完整prefix复用已经完整验证的fold；所有对象入口/直接helper默认和历史短prefix保留第二fold，无跨调用cache。最初无入口限制的候选被getter反例证实回归，已保留反例并修正；最终负控覆盖persistentGrowth/preparation访问器突变，精确拒绝不放宽。相同输入原143.476s→保守版139.334s，12112次restore不变、fold24081→12151、完整最终hash相同；仅说明该重复计算成本，不宣称整个B8无性能回退或CI180秒必过。
5. **浏览器关闭仅观测改动**：scripts/verify-m6-performance.cjs记录page crash/disconnect/流程及cleanup位置、Node exit；无生产修改、无原timed callback/负载/样本/阈值/skip修改。Chrome公开API未提供退出码时不伪造。input-preview未运行该M6脚本，不能拿它通过证明dev偶发；观察可能有开销，不当性能优化。

## 当前实测与尚待完成

[固定原始证据](candidate-125868-full/README.md)：Node22.23.3/npm11.9.0，原样 `npm test` **132文件全过、1852pass/10原skip、505.67s**；typecheck/build通过。本机没有Chromium验收。源码运行前后完全固定，完整日志及hash已封存。

双口径每JS gzip9：固定基线488964，生产**502898（+13934）**；全导出可达**503479（+14515）**。均低于B8整批512364与总552191。581B探针差包含包装/导出保留/压缩布局；Rollup新增198未压缩字节不能换算精确gzip成本。生产pendingChoice权威校验完整。旧13k触线、优化、用户重评为中18k/暂停23.4k的历史保留于正式预算账本。

尚待：最终含本包HEAD的完整CI（含原关闭点的真实M6、全浏览器/输入/compare门禁）、如有新失败的精确闭环、用户外部Codex正式②签收。10unit/5native-input既有延期按检查点边界保留，未扩大，不把②全绿等同整批B8完成。
