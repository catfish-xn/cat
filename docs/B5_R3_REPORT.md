【完成】B5-74／B5-78 均已实际实现并开放；约定已登记为 2026-10-27 的 P 条目，缺口分类已更新。未提交 Git、未重录 epoch。

| B5-74 克隆设施 | 实现数值 | 约定 | 测试 | 改动调用点（除特别注明外均在 src/simulation/） |
|---|---|---|---|---|
| 已开放（黄金，三个节点） | 生命 floor(开战完整HP×70%)、最低1；法耗 ceil(开战法耗×1.2) | 后数第2排第4列；保星含四星、无装备、计羁绊；最近空格、空源格或满格不复制 | 17项通过：报价、真实命令、八席房间、三入口存档往返／篡改、数值、四星、形态、空／满格、开战广播、双方战中装备 | 新增 augment-pool-batch5-r3.ts、content/augment-pool-batch5-r3.ts；strategy-snapshot → combat/combat-effects → two-sided-battle；g2-4b-summons、g2-4b-gold-restore、battle-equipment；augments/policy/offer-rules/rules-manifest/validate-content 与独立 M5 oracle；src/server：无改动 |

| B5-78 镜廊 | 实现数值 | 约定 | 测试 | 改动调用点（除特别注明外均在 src/simulation/） |
|---|---|---|---|---|
| 已开放（棱彩，三个节点） | 各原位置完整开战HP×100%；全部伤害独立×60%，整数向下取整一次 | 前排第4列优先、最近且并列取左；同时变形含中心；无装备／异常／永久成长、计羁绊；空前排不触发 | 15项通过：报价、真实选取／购买／部署、八席结算、三入口恢复／篡改、各位置HP、六类伤害／真实伤害、冷重演、双方战中装备 | 新增 augment-pool-batch5-r3-mirrors.ts；同上编译／开战／双边／恢复入口，另接 strategy-types/combat-types、combat-s13、match.combatGrowth、b8-restore；原始 stage-bans 保留，offer-rules 显式覆盖；src/server：无改动 |

【完成】15文件／172项相关测试分批通过（Vitest --maxWorkers=3；其中专项32项）；typecheck、Vite生产构建、build:game、身份 --check、git diff --check 通过。content=fnv1a32-utf16:881e65ce；loot=fnv1a32-utf16:c06a5651，production-size 已同步。
【未完成】build:server 的既有目录边界错误仍在：src/simulation/combat-replay-view.ts:18 导入 ../presentation/combat-status，触发 scripts/build-server.cjs:18；在未修改 HEAD 4495602d 的 /tmp 副本同样复现。保留边界断言，不在本单复制／改写表现层状态读取器。
【需要我决定】无。
【风险】镜廊原档案三个阶段均禁用，本单依“实际开放”要求显式覆盖；运行细节仍按已确认约定，不冒称14.24原服实证。未运行全套、未扩大种子扫描至0..100之外。
【下一步】交 Claude 对两张卡和新增战斗投影字段交叉验货；纯规则打包的既有状态读取器归属问题另行处理。
