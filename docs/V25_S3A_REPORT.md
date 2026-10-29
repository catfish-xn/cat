【完成】B5-13、B5-15、B5-16 的内容、效果、恢复认证均已实现；没有需要新增保存事实而跳过的项目。数值逐项核对本地14.24档案，P-B5-S3A记于2026-10-27；未改存档格式、未新增在线命令、未提交。

| 强化 | 已实现数值 | 执行约定 | 测试结果 | 调用点（含 src/server） |
| --- | --- | --- | --- | --- |
| B5-13 基础装备自助餐 | 银色；初始随机普通组件1；后续每个新组件换1个四选一基础装备锻造器；仅2-1选取 | 初始组件、旧物品移动、锻造器选出组件不转换；新重铸实例转换；满席及选秀/战斗锁定由历史推导待发权益 | 11项通过：来源、节点、真实领取/开启/选择、满席后出售补发、重复命令、JSON/对象/序列化恢复与篡改、真实房间 | 新增s3a内容/规则文件；augment-pool-grants、match.accept、anvils、carousel、round-settlement；src/server未改，复用choose/claimOrb/openAnvil |
| B5-15 精致古董 | 银色；成装连续留库存经过4次后续自然轮入口，转换1个辅助装锻造器 | PvE/选秀计轮；离开库存、实例/定义改变清零；同轮装备再卖出也清零；年龄由已有历史重放 | 13项通过：来源及生产禁选、真实合成/跨轮/开启、同轮取出放回、三入口恢复与篡改、真实房间四轮计龄；选取路径局部放开测试阶段表 | 新增s3a-history；match.accept、anvils；src/server未改，复用choose/combine/openAnvil和轮转路径 |
| B5-16 潘朵拉的装备 | 银色；初始组件1；取得后每次自然轮入口按普通组件/可合成成装池各自等权重掷；三个节点均可选 | 仅库存；允许原样、保留实例ID；特殊装备/工具不变；按席位/选择/轮/物品派生lcg32-v1，不推进live RNG | 11项通过：来源、节点/互斥、真实重掷后合成/装备/战斗、特殊装备边界、BigInt独立随机oracle、三入口恢复与篡改、真实房间 | 新增s3a-history；match.accept；src/server未改，复用choose/combine和轮转路径 |

【完成】共享接入：augments、policy、offer-rules、stage-bans、rules-manifest、validate-content、m5独立oracle与augment-stage-helpers；恢复接入resource-provenance、b8-restore、shared-pool、shop-history，历史战斗沿既有validateHistoricalEquipment调用。
【完成】35项新增功能测试、43项强化账本、140项相关回归、12项内容身份/生产大小、1项固定路线测试均通过（合计231项）；npm run typecheck、身份脚本--check、git diff --check通过。Vitest --maxWorkers=3；新增种子搜索仅0..100；未提高超时或删除断言。
【完成】已执行update-content-identities.cjs --write并同步production-size：content=fnv1a32-utf16:b1117b4b，loot=fnv1a32-utf16:b78cadfd；未重录epoch。
【未完成】精致古董生产选取仍遵循原始数据的2-1/3-2/4-2全禁选；效果实现与命令/恢复测试已完成。按要求未跑全套。
【需要我决定】精致古董维持源数据禁选，或仅开放2-1（建议）；需要决定的原因是原始item_tags_raw同时含三个阶段禁选标签，授权的计龄提案未覆盖阶段例外。
【风险】精致古董测试中的阶段放开不等于生产已开放；内容身份变化，旧epoch未更新；并行分支合并后需重算身份并核对注册数量238。
【下一步】交叉审查此工作区差异，按三项定向测试验收；若确认开放精致古董2-1，再同步生产阶段表、独立oracle、约定及身份。
