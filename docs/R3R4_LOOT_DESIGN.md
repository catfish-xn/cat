# R3+R4 掉落系统：设计交付与实施计划（草案，未签字）

基线：origin/multiplayer@25dae94eb58108909a7b2cdc1d68ab0ee36d7561。分支：codex/r3r4-loot-design；PR 目标 multiplayer，标题 docs: R3+R4 loot system design draft。本任务仅改 docs/，不改 src/、tests/、运行版本常量或 digest，不实施、不部署。

R3/R4 的范围和排在 R2 之后的顺序已签；具体表值/接口/取舍尚未签字。T12 继续在 [PR #71](https://github.com/catfish-xn/cat/pull/71) 处理，不在本 PR 接管、修复或重定其恢复边界。**文档可并行审查；实现须等 T12 合入和本设计签字。**

## 1. 本次交付和合同关系

| 文件 | 本 PR 变更 |
| --- | --- |
| [M8B_LOOT.md](M8B_LOOT.md) | 顶部区分首版与草案，追加 §11：四色、同局模板、完整包/载体/权重、预算、随机、工具定义/阶段/来源/失败 |
| [MULTIPLAYER_CONTRACT.md](MULTIPLAYER_CONTRACT.md) | 追加 §17：拟议公共签名、初始化/模板入口、wire、revealedLoot/工具白名单、失败枚举、共享池与收据 |
| 本文件 | 影响清单、工期、版本/digest 联合发布、测试、待决选项及门禁 |

现行段落保留历史，不把新草案写成已交付；发布时再同步 POLICY、OPENING、M8B_CONTRACT_ADDENDUM 等冲突段落。来源台账唯一入口是 [S13_RULES_GAP §0.2](S13_RULES_GAP.md)，规则数字逐表标注 S1–S9/L1 或项目自定；没有补齐历史全掉率的声明。本文件的工期、版本目标、测试样例与选项数字均为**项目自定/P**，基线身份为仓库现状【L1/P】，不是 Riot 来源。

## 2. 待实施影响文件与职责

下列为影响清单，不是本次改动清单。列出的既有路径按基线目录核对；“拟新增”不表示已经导出。具体拆文件可在不改变合同的前提下调整。

| 模块 / 责任 | 既有文件与拟新增文件 | 必须处理的行为 |
| --- | --- | --- |
| Codex：目录、版本 | src/simulation/content/loot.ts、content/index.ts、content/neutral-encounters.ts、m8/contracts.ts、m8/equipment.ts；拟新增 content/consumables.ts | 完整权重/零项/顺序、组合政策、工具目录、细分版本与统一 canonical |
| Codex：冻结与宝珠账本 | src/simulation/loot-types.ts、loot-freeze.ts、loot-identity.ts、loot-runtime.ts、loot-choice.ts、item-grants.ts；拟新增 orb-layout.ts | 同局模板与每席内容分离，slot→orb/entry 身份，PvE 自选删除，部分发放/幂等 |
| Codex：装备/消耗 | src/simulation/match.ts、match-types.ts、inventory.ts、item-selectors.ts、equipment-policy.ts、temporary-equipment.ts、strategy-types.ts；拟新增 consumables.ts | 独立工具库存/序号、重铸 RNG、原子使用、窃贼/冻结边界；复用 T12 权限 |
| Codex：池、推进与恢复 | src/simulation/shared-pool.ts、shared-pool-types.ts、shared-pool-ledger.ts、multiplayer-round.ts、round-settlement.ts、resource-provenance.ts、b8-restore.ts、serialization.ts、combat-input.ts、deferred-upgrades.ts | layout 批事务、entry 英雄预留/补偿、旧前缀与新后缀分离；T12 新恢复文件待合入后补列 |
| Codex：公开视图/应用 | src/simulation/loot-view.ts、private-seat-view.ts、m8/ui-contracts.ts、src/server-entry/index.ts、src/m6/application.ts、src/persistence/compatibility.ts、format.ts、coordinator.ts、legacy-records.ts、src/replay/history.ts、playback-session.ts | 白名单/新 payload、Node 导出、存档路由、旧档保全、新回放版本；统计只计唯一授予 |
| Codex：规则测试/证据 | tests/m8-b8-loot-*.test.ts、m8-b8-resource-provenance.test.ts、m8-b5-equipment-history.test.ts、m8-b10-item-save-replay.test.ts、m8-b10-temporary-replay.test.ts、tp-shared-pool.test.ts、t3-timeout-loot.test.ts、t5r-loot-view.test.ts、t5r-private-seat-view.test.ts；拟新增 tests/r3r4-*.test.ts 与 docs/evidence/r3r4/ | 下文矩阵；不把旧 oracle 整批换成实现输出 |
| Codex：合同同步 | docs/M8B_LOOT.md、M8B_POLICY.md、M8B_OPENING.md、M8B_CONTRACT_ADDENDUM.md、M8_RULES.md、M8_UI_CONTRACT.md、MATCH_CONTRACT.md、MULTIPLAYER_CONTRACT.md、UI_REQUESTS.md | 新表覆盖旧自选/15 物理组件/开局金币描述；未来 UI_REQUESTS 提出数据与验收要求 |
| Claude：服务器/网络 | src/server/protocol.ts、net/messages.ts、room/room.ts、room/types.ts、room/projection.ts；对应 tests/server/ | 新命令严格验证、原子模板/最新席位、白名单、重连和协议切换；不在服务器重算规则 |
| Claude：界面 | src/presentation/loot-view.ts、equipment-feedback.ts、src/rendering/strategy-panel.ts 及现有联机会话适配器；存档/回放控件按 AGENTS 分工 | 显示珠/entry/工具、目标选择、运营装备下场生效；无布局/动画设计要求 |

不会新增正式英雄/特殊装备或修改中立怪能力；读取战斗/恢复文件是为了维持冻结边界，不另开 R5。若需要跨职责目录改动，按合同交接，不由 Codex 修改 src/server 或视觉文件。

## 3. 工作量与依赖

所有估算均为项目自定/P，人日而非日历天数；不含 T12 剩余工作、历史资料无限研究、多轮平衡调参或部署审批。

| 实施包 | Codex | Claude | 依赖 / 可验收结果 |
| --- | ---: | ---: | --- |
| 工具目录、使用事务与来源恢复（R4） | 2–3 | 1–2 | T12 合入；工具实例、四阶段目标、重铸流与旧冻结前缀 |
| 同局模板、宝珠/entry、奖励与共享池（R3） | 3–5 | 1–2 | R4 载荷；全清/部分领取、同色同数、wire/视图接线 |
| 统一版本、旧档、联合恢复与回归 | 2–3（两方合计） | 计入左项 | 两包完成；最终 canonical 与协议一致、四路径恢复/重连 |
| **合计** | **规则 5–8** | **接线 2–4** | **加联合 2–3，共 9–15 人日** |

施工顺序：T12 合入 → 复核其最终公共接口/恢复边界 → 本设计决策签字 → R4 工具与账本 → R3 宝珠整合 → 同一发布身份下联合验证 → Claude/Codex 交叉验货 → 用户决定最终合并/发布。可以分别提交实现 PR，但不能让未完整支持工具的旧引擎读取新宝珠表。

PR #71 在本次只读核对时仍为草稿，恢复范围待明确；这是实现前置风险，不阻止本设计 PR 交付。若 T12 最终未覆盖完整联机状态恢复，要重新明确联合验收范围，不能把 frozen BattleInput 恢复冒称 latest seat/共享池完整恢复。

## 4. 细分版本与统一 digest 发布

依 [S13_RULES_GAP §2.5、§7](S13_RULES_GAP.md)。以下均为目标草案；**本 PR 不改任何运行身份，不预填新 digest**。

| 项 | 基线 / 拟目标 | 进入身份的内容 |
| --- | --- | --- |
| T12 装备操作 | 拟 equipment-ops-next-battle-v1、multiplayer-combat-ops-v2，装备实例规则以 T12 实际签收为准 | 四阶段许可、身上合成、latest/frozen、窃贼与装备来源 |
| 宝珠政策 | m8b-loot-project-v1 → s13-orbs-project-v1 | 全部包/权重/明确零概率、载体、价值预算与授予时点 |
| 冻结账本/算法 | m8-b8-loot-freeze-v1 → s13-orb-freeze-v1 | orb/entry 编码、排序、已揭示/部分领取、移除 PvE fallback |
| 对局模板 | 新 s13-orb-layout-v1 | room seed salt、桶顺序、按轮唯一冻结、绑定/批事务 |
| 消耗品 | 新 s13-consumables-project-v1 | 三工具目录、目标/数量/来源、失败原子性、事件与价值继承 |
| 重铸 | 新 s13-reforge-v1 | 独立 seed salt、排除原定义、候选排序、拒绝采样及 draws |
| 组合 PvE 政策 | m8b-pve-project-v1 → m8b-pve-project-v2 | 引用 T11 opening-v2 与新 loot/consumable/layout，怪物内容不变 |
| 共享池格式 | shared-pool-v1 → shared-pool-v2 | 新私有 layout/绑定；容量、商店与英雄缺货补偿数值不变 |
| 装备/英雄池 | m8b-components-v1、m8b-heroes-1to4-v1 保留 | 目录未扩容，成装候选完整内容也纳入 digest |

| 外层身份 | 25dae94 基线【L1/P】 | 联合发布拟目标【项目自定/P】 |
| --- | --- | --- |
| rulesVersion / contentVersion | m8-14.24b-v1 / s13-14.24b-m8-v1 | s13-rules-gap-v1 / s13-14.24b-rules-gap-v1 |
| schema / save / replay | 6 / 2 / 2 | 7 / 3 / 3 |
| commandProtocolVersion | 2 | 3 |
| NET_PROTOCOL_VERSION | 1 | 2（网络协议，不是领域 commandProtocol） |
| RNG / tick | lcg32-v1 / 50ms | 保持 |
| CONTENT_DIGEST | fnv1a32-utf16:b4a5c2e2 | 最终 canonical 计算，未生成 |
| LOOT_REPLAY_DIGEST | fnv1a32-utf16:7b14bfba | 最终 canonical 计算，未生成 |

具体统一方案：

1. 本设计分支固定上述基线，不把 PR #71 中间实现复制过来。T12 可以依 §2.5 独立完成验收及细分 digest；记录它最终合入 SHA、装备实例版本及两项 digest，不能用本表的旧基线覆盖它。
2. T12 合入后，R3/R4 实现分支从新 multiplayer 开出。建立共享的规则 manifest：实际 T11 opening、T12 权限/装备版本、R3/R4 全表/池/算法/身份/冻结/消费/来源修订均列入。CONTENT_DIGEST 与 LOOT_REPLAY_DIGEST 从同一 manifest 引用相关定义，禁止后一处继续写死旧 openingPolicy 或漏掉工具规则。
3. R4、R3 可分包验收，玩家可见的新格式/命令/宝珠/工具在同一次候选发布中统一启用；两项 digest 各自按其 canonical 范围计算，不要求二者字符串相等。保留 before/after manifest、SHA、版本与差异理由；数值/语义变化先给独立 oracle，再更新受影响 golden。
4. 若 T12 单独已发布，其已有 digest 仍是旧身份，联合发布明确拒绝；不能为省一次失效把 T12 身份偷偷复用。若 T12 最终已经提升了外层 schema/save/protocol，重新分配联合目标编号，禁止版本倒退或同号不同结构。
5. T1 同一冻结输入的事件/RNG对照应明确归一化哪些纯身份字段；R3 的开局英雄/掉落与工具确实改内容，整局轨迹不得只抹 digest 后声称零行为差异。证据分为冻结战斗不变和新奖励/后续战斗变化两类。
6. 旧 M7/M8 档保全识别/导出，新引擎拒绝续玩或伪可信重播；不补 XP/工具、换珠、重抽或回写旧收据。新规则使用新命名空间和版本路由；IndexedDB 物理版本仅实际库结构变化时增加。未知/未来格式拒绝且不覆盖好档。
7. 活动局固定创建时身份，旧局结束后再切换；服务器/客户端新协议一起部署，旧网络协议明确 unsupported-protocol。没有新旧规则在一局中混跑，也不承诺永久维护旧引擎。

## 5. 后续实施测试清单（未运行）

以下是验收规格，不是本次通过记录。夹具优先经公开命令取得资产，不能直接注入工具/伪造收据后自证合法。

| 测试组 | 必须验证的独立结果 |
| --- | --- |
| 内容/算数 | 完整权重总和 100；零项确为 0；开局仅 2/3 价值且未杀可少；全清 15/16、期望 15.5；新增直接金币期望 3.26G；每种重铸器期望 0.44；各载体/slot/entry 无碰撞 |
| 跨席公平 | 同局八席每轮数量/品质/source-slot 一致，内容可不同；不同初始化顺序、seed=0、断线/机器人、淘汰后不生成未来轮；layout 首次冻结与重复边界不补抽 |
| 随机域 | 每个拒绝阈值 w=limit-1/limit/U-1；重铸 n=7/35 必排原定义；使用工具不改 loot/shop/battle/equipment 流，窃贼新父件只按许可改 equipment；读视图/预览/重连/恢复无额外 draws |
| 击杀/部分领取 | 部分击杀、最后同 tick 击杀、未杀作废；灰珠英雄满席仍给工具/金币；全部可领只发一次；未揭示不暴露；无 PvE 自选或旧 fallback 混发；五次 .4 正常/超时选择保留 |
| 池/收据 | 有货满席先预留、后入库不再扣；最后一份跨席稳定顺序；无货按一星购买价补金币；重复尝试不重复补偿；pending 超时/淘汰归还一次；工具不改英雄份数；全批后段失败全回滚 |
| 四阶段工具 | 单人/联机 × PvE/PvP × preparation/combat/choice/settlement；库存、棋盘、备战席、已阵亡但持有单位；单位全部装备原 ID 退库、重铸新 ID 入库；不关闭选择、不追溯经济 |
| 拒绝原子性 | 所有 §17.5 reason、空单位、错误工具类型、临时/过期/未知/已消费 ID、敌方/镜像/野怪、gameOver/淘汰；state/pool 原引用，资源/RNG/ID/revision/eventSeq 全相同；网络 commandId 同内容重复与冲突 |
| 冻结/成长 | 同一已冻结输入 A/B：战中拆卸/重铸前后逐 tick 事件、RNG、胜负、成长逐字节一致；旧装备仍可按前缀重建；下场才见新装备；延迟升星搬最新装备，双边 PvP/镜像均覆盖 |
| 窃贼 | 父件拆卸后同轮再穿复用 roll；重铸原父件注销 live 子项，冻结子项不变；新父件首次合法穿戴规划一次；不得生成永久临时子件 |
| 保存/恢复 | 四路径的合法装备后保存→恢复→续算，choice/settlement/部分珠/pending预留/工具消费均覆盖；改坏 layout、来源、旧新 ID、draws、收据、前缀应拒绝；重复恢复零附加授予；联机采用 T12 正式入口 |
| 私有投影/wire | 新 kind/字段、actual gold 补偿、forfeited原因、数组排序与聚合状态；未知嵌套键不泄漏/不冻结输入；PvP/supply/旧轮省略；重连视图一致；不含 seed/RNG/未来计划/精确池；旧协议拒绝 |
| 终局/回归 | 单人 6-7 发一次工具/金币后终局且不可使用；联机加时不再生成珠；T11 XP、T12 装备、T3 结算、TP 守恒、服务器自动接续保持；旧档保全导出、旧 digest 拒绝、新命名空间隔离 |

实现后按影响运行 typecheck、相关 Vitest、test:server-entry、完整规则及 server 套件、客户端构建与桌面 Chromium 联机验收；CI/运行失败单列根因。PR #71 只读报告中的既有 B5/B8/lifecycle 失败或超时不算本草案通过，也不授权修改旧断言使其变绿。

## 6. 需要用户拍板的数值与取舍

以下不是重新询问已签的“做 R3/R4、四色、PvE 随机、五次 .4、R2 四阶段”方向；是把具体实现候选固定下来。推荐项尚未获批，可按 D 编号签字或给出修改。所有候选数字均为项目自定/P，来源限制见 LOOT §11.1。

| ID | 选项 | 建议与代价 |
| --- | --- | --- |
| D1 开局随机及补偿 | A：按 §11.3，2/3 价值各 50%，不足组件分支给 3G，两次随机一费英雄；B：保留该 50/50 与随机英雄，但灰奖励减为 1G；其他值需重算 | 推荐 A，沿原提案；金币为 10/13G（无缺货补偿时）。B 为 10/11G，减少额外经济，不改变已签价值范围 |
| D2 后期装备珠与棱彩替代 | A：90/9/1，金 2组件+4G，棱彩 1成装+8G+两重铸器；B：95/4/1，载荷相同 | 推荐 A，沿原提案、稀有奖励清楚。B 降低额外金币；两者均非官方概率，必须接受棱彩为受限替代包 |
| D3 载体集中 | A：k01/w00/r00/d01 各承载装备珠+灰珠；B：装备珠仍在原主怪、灰珠移到 k02/w01/r01（龙仍 d01） | 推荐 A，与 §3 原候选一致、身份规则简单；B 分散击杀收益。必须连带签无掉落名单；不恢复 PvE 自选 |
| D4 工具掉率 | A：每场指定灰珠拆卸器 1，后期 none/组件/成装=80/10/10，棱彩各 1；B：后期灰珠改90/5/5，其余同 A | 推荐 A，便于实际体验三个工具；全清 8 拆卸器，单人最后一件无操作窗口，保留终局节奏 |
| D5 重铸目标/候选/产物 | A：单件、排原定义、组件7/成装35等权、产物库存、拆卸全部永久件；B：同目标但允许原定义，以8/36等权 | 推荐 A，避免一次性工具无效；两个 reforger 是项目拆分，非历史原物品。四阶段与下场生效沿已签 R2 |
| D6 模板接线 | A：§17.2 shared-deferred 初始化、pool 唯一 layout、批推进；B：另设对局 loot aggregate，与 pool/席位同事务提交 | 推荐 A，复用 TP 批事务，但需 shared-pool-v2；B 边界独立但服务器要同时保全额外权威对象，不可由各席各抽颜色替代 |
| D7 已揭示后放弃的展示 | A：保留 entry 并显示 timeout/eliminated-forfeited；B：沿旧合同隐藏放弃 entry，珠摘要仅反映剩余可见项 | 推荐 A，重连能解释部分打开后的去向；需修订 §14.1 与网络 schema。未揭示作废始终隐藏 |
| D8 发布/旧档 | A：T12先合入，R3/R4统一新外层身份/两项digest发布，旧档保全导出、新开局；B：T12若先单独发布，再为R3/R4切换一次 | 推荐 A，减少玩家可见失效次数；B 不阻塞 T12 上线但会有两次身份切换。T12 已发布则采用 B，绝不回退 digest |

获批项：________　修改项：________　签署人/日期：________

修改任一概率、载体、内容或工具语义后，更新完整表、派生预算、合同、测试 oracle 与版本候选，再进入实现；不能只在实现常量中改数。D1–D8 未选择不妨碍提交本草案 PR，但不会默认为已签。

## 7. 本次文档验证与完成门禁

本次只执行文档差异、基线/范围、相对链接及规则算数检查；未运行代码测试、服务器、浏览器或实战平衡。不修改任何 src/、tests/、digest 或 golden。创建 PR 不等于合并、玩法签字或运行交付。

文档核对重点：两份主文明确“草案，未签字”；新旧合同边界清楚；S13_RULES_GAP 已签范围未改；T12 不被标记完成；四色/同局/开局/五次自选、三工具、四阶段、失败、共享池、版本及待决项齐全。实际检查结果随 PR 描述记录。
