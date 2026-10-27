【完成】仅实现 B5-63、B5-70；规则／内容集中在新增 augment-pool-batch5-g2*.ts，P 条目日期均为 2026-10-27；已更新缺口分类、Match／Combat／历史契约；分支 codex/v25-g2，HEAD 4495602d，未提交。

| 强化 | 实现数值 | 用户约定与研究分级 | 验证 | 改动调用点（src/simulation/ 内，含服务器结论） |
| --- | --- | --- | --- | --- |
| B5-63 老友幽魂 | 每次 5 HP／80 Bps AD（0.8%）／1 AP；棱彩，仅 2-1，保留 3-2／4-2 禁令 | 数值已证实；角色映射属社区推测＋P约定：坦克及其他角色给HP、AD类给AD、AP类给AP；覆盖63英雄；非英雄召唤物不计、英雄复制体及复活后二次死亡计入；首次最后机会致死也采样一次 | ghost 单测21＋真实房间8；节点、即时收益、未来英雄／复制体、独立M5期望、保存三入口及篡改拒绝均通过 | augment-history-owners/types、augment-death-samples → combat-input／two-sided-snapshot/battle → strategy-snapshot → combat-s13-state／combat-s13；combat-g2-4b-trench 出生继承；b8-restore／g2-4b-gold-restore／shared-pool 认证；共享 augments/policy/offer/stage-bans/manifest/effects/validate-content；src/server：未改 |

| 强化 | 实现数值 | 用户约定与研究分级 | 验证 | 改动调用点（src/simulation/ 内，含服务器结论） |
| --- | --- | --- | --- | --- |
| B5-70 爆蓝之城 | 每队每战前5次；低一星（最低1星）属性后 −400 HP，保底100；赠阿卡丽／艾瑞莉娅各1；黄金，原节点无禁令，3-2／4-2沿用蓝发筛选 | 5／400及赠送已证实；1星召唤、羁绊／死亡交互／原格等为社区与视频观察（GPT与Gemini分级不同）；下界100与无装备／异常为P约定；原格被占取最近空格；复制体不占额度、不递归；继承已触发羁绊且不重复全队发奖 | rebel 单测12＋真实房间20；独立降星数值／五次额度、死亡联动、卡池守恒、PvP冷重演、PvE Match恢复与篡改拒绝均通过 | augment-pool-grants 奖励法球 → combat-s13 → augment-pool-batch5-g2-rebel 出生；combat-g2-2 脉冲、combat-augment-effects 羁绊、g2-4b-summons HP；shared-pool／two-sided-battle／g2-4b-gold-restore认证；旧batch2只移除阻塞说明，G2单独注册；src/server：未改 |

【完成】125项主体＋4项定向兼容＝129项测试通过（Vitest --maxWorkers=3）；typecheck、生产最小化等价、identity --check、git diff --check通过；content=fnv1a32-utf16:2e770794，loot=fnv1a32-utf16:e3bd95e7；已同步production-size，未重录epoch、未删除断言或提高超时。
【未完成】任务范围内无；按要求未跑全套，未做浏览器或部署；种子搜索仅0..100，M5旧目标卡用例重新定位到23。
【需要我决定】无，全部按2026-10-27已批准约定执行；没有绕过任何阶段禁令。
【风险】研究未证实的细节明确标为P；新内容身份拒绝旧内容档，两条持有者的联机恢复均要求房间独立authority；并行批次合并后需统一同步身份与受池顺序影响的固定种子。
【下一步】交Claude按现有分工检查测试、目录边界及玩法约定；完整断言与新增文件保留在当前未提交工作区。
