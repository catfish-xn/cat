# T13 联合发布候选

基线 origin/multiplayer@297143e；D1–D8 采用推荐 A。2026-10-14 用户更新：T13-A 拆出先行验货；R3/R4 在 codex/t13-loot 持续推送里程碑草稿，单独完成外层身份和 digest 切换。本文件是验收台账，尚非上线通知。

规则变化：组件忽略请求槽并优先最低散件槽合成；PvE 四色宝珠、同局共享数量品质、随机英雄/装备；三个一次性工具；已揭示后放弃展示。概率、包和载体以 M8B_LOOT §11 为准。

版本：schema 7、save/replay 3、领域命令 3、rules s13-rules-gap-v1、content s13-14.24b-rules-gap-v1；网络协议 2 待 Claude。两项 digest 包含同一 rules-manifest。旧格式 2 不迁移、不续玩、不用新引擎重播，仅只读保全导出。新存储命名空间 hex-autobattler-s13-rules-gap-v1，旧 hex-autobattler-m8/m6 不写入。

T1 差异：自动合成输入的装备轨迹改变；R3 的英雄、掉落及后续战斗确实改变，不可抹掉 digest 后声称整局无行为差异。同一冻结战斗输入的 T12 操作必须保持当前战斗事件/RNG/结算相同，Node 与浏览器入口使用同一新规则逐字节对照。

验证台账：T13-A c99b054 全套 195 文件、2545 用例通过（756.43s）。R3/R4 联合回归进行中，未发布、未合并。src/server 初始化/网络命令与 C18-B 正式界面接线仍由 Claude 负责。

授权例外：src/m6/contracts.ts 三处 save/replay 类型引用 M8_VERSION；BoardScene.ts 一处 Record 改 Partial<Record> 并使用既有 fallback；presentation/loot-view.ts 新状态与工具名占位，loot-preview/fixtures.ts 补字段/收窄旧样例状态。未改布局、既有文案或 M6 行为。

B8 验证额外发现并修复：灼烧刷新比较改用规范结构比较，保存时键排序不再清掉已积累的小数伤害余数。伤害公式不变；该恢复语义纳入本次统一 manifest，红霸符公共装备路线续战覆盖。

里程碑 1：领域回归诊断 2150 通过 / 150 失败 / 53 跳过（排除 tests/server，旧路线迁移中，不能当作全套通过）。后续两组迁移回归分别 124/127、127/128 通过。四条公共完整路线均胜利到 6-7，经独立账本审计，成型战斗 14/12/15/12；五个 Herald 原始存档均在导入恢复器前生成，并通过恢复及后续 15 ticks 对照。T1 早期候选已通过，加入灼烧余数修复后需要重新固定轨迹；本里程碑不可发布。

SR-C18-01～04 已收到（multiplayer@9774682）：01 选择 A 权威投影；02 导出内容表；03 补 wire 回执、显示事件白名单和失败文案；04 确认回放结束/重连后的展示约定。里程碑 2 已实施（合同 §18.8）：typecheck 与 4 文件 / 42 用例通过，含四阶段投影/三工具/共享/白名单。内容表新增说明和 targetKind 纳入 digest 后，当前候选的 golden、Herald 与 T1 指纹须重生成并重新校验；现有旧候选报告不作为本提交全绿证据。


里程碑 3：已整合先行 A（#80，1d62b52）与 multiplayer@8968c8a。A 最终全套 196 文件 / 2551 用例、typecheck、T1 均通过并已转正。

B 当前 CONTENT_DIGEST=fnv1a32-utf16:bd9c3a8e、LOOT_REPLAY_DIGEST=fnv1a32-utf16:5cd0487c；四条完整公共路线经独立账本重新审核，五份 Herald 原始存档及后续 15 ticks 恢复通过，T1 Node/browser-target/CLI 165 状态对照及 tick40 恢复通过，报告已更新。本次还补 ClientCommand 的 useConsumable、bot legal 恒 false、测试 execute 真实调用，以及用户授权的 applySeatCommand 单行共享事务转发；C18-B 将用 useSeatConsumable 替换该行。未改 gate/onlyKeys/consumables.ts。

本里程碑空闲机单跑 12 文件 / 162 用例通过（35.67s），typecheck 通过；B 仍是施工草稿，未宣称全套通过。历史旧 fixture 迁移及 Claude 的 shared-deferred 初始化/正式网络与 UI 接线仍待完成；前述早期全套/领域失败数保留为诊断记录，不代表本提交最终结果。

里程碑 4：按用户要求先合入 multiplayer@524e9ea（合并提交 1bd10b7，已推送），随后继续测试迁移。合并无冲突，上游 BoardScene 三处空值保护仅随基线带入；相对新基线的界面/服务器差异仍严格限于已授权例外。

本里程碑不改运行规则或 digest。拳套测试通过真实 2-4/3-4 自选获取父装备；保留原 level3/6/7/9 独立 LCG 机制向量，level3 的合法存档对照改为相同低级池的 level5，所有 35 条公共路线实际绑定全部 43 种临时装备。历史等级伪造、完整战斗档案、递归九卡购买、冲突返还和 Tristana 成长仍经真实公共命令/严格恢复验证。完整路线按签署的 15–16 组件价值校验（成装计2），同时对照所有物品掉落和领取回执，不删除随机额外奖励。

空闲机单 worker 顺序验证：6 文件 / 77 用例通过（57.80s），依赖回归 4 文件 / 107 用例通过（149.15s），合计 10 文件 / 184 用例；typecheck 全绿。依赖组包含四条完整路线、T12 战中装备和全部 44 种装备的保存/回放。B 全套仍未完成：旧 B8 固定掉落/身份路线、三个长 M6 回放超时及 Claude shared-deferred/正式网络接线仍待处理；本草稿不可发布。
