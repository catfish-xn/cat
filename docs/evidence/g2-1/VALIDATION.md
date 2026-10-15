# G2-1 第八批验收

分支 `codex/g2-1-content`；合入 `multiplayer@bdf50bb`（含指挥基线 a159fbb）。范围按 DISPATCH 第八批窗口3：33英雄/8羁绊，斯维因留G2-2；8普通组件/36成装不变，金铲铲和转职排除。旧版存档身份不兼容，原始录制保留。

## 最新合并验收

2026-10-15 已将 `multiplayer@9a9adb2` 及随后合入 #105 的 `multiplayer@4d4cc73` 合入本分支。最新结果和未解决门禁见 [MERGE_VALIDATION.md](MERGE_VALIDATION.md) 与 [BACKLOG.md](BACKLOG.md)。下文保留内容扩展的来源、重录和目录授权说明；旧的“等待另一台机器执行”交接不再代表当前执行状态。

## 回归归因与重录

[逐文件分类](FAILURE_CLASSIFICATION.md)覆盖指挥的全部30文件/71失败。没有增预算、skip、注入资源或替换旧录制身份来制造等价。

- [release-audit.json](release-audit.json)：四条公开命令整局路线均到round38胜利；cannon/sniper共134状态重新录制，文本/对象restore字节相等；旧新命令首次差异和完整录制SHA256。
- [route-prefix-migration.json](route-prefix-migration.json)：用旧新树各自的公开驱动执行首次发生变化的round2，记录四路线command/event/terminal字节数、SHA256、首字节与结构差异。cannon事件28210→66201字节，首次单位m02→m01；mage69408→46174字节，首次单位3→4；sniper及sniper-caitlyn均28210字节，但首次奖励unit5→unit4，等长不等字节。
- [fixture-migration.json](fixture-migration.json)：C19重新编译后，166434字节事件与14192字节/15个灼烧包逐字节相同，tick244 enemyWin；终态首差异sentinel→automata。Herald七份文件、B8的0/1/9单位战斗及回放也保留旧新字节证据。
- [public-fixture-migration.json](public-fixture-migration.json)：七条transfer/growth/capacity/terminal/partial reveal路线，分别比较完整准备态、事件和终态；同时给出剔除版本身份后的首个真实差异。历史端153个simulation文件逐个核对a159fbb源码。

复核命令（基线目录由 `git archive a159fbb` 导出，不含G2修改，依赖链接到当前node_modules）：

```sh
node scripts/record-g2-1-release.cjs --check
node scripts/record-g2-1-route-prefix.cjs --baseline-root=<a159fbb-export>
node scripts/record-g2-1-fixture-migration.cjs --baseline-root=<a159fbb-export>
node scripts/record-g2-1-public-fixtures.cjs --baseline-root=<a159fbb-export>
```

首次重录添加`--write`（release脚本默认为写入）。旧P3/P4/P5 oracle、golden、录制与T13 Herald原档不改；原driver归档到generate-m5-route.p3p4p5.cjs以继续校验历史审计SHA。

## 图标与目录授权

81/81图标已提交到public/assets/s13，[assets-manifest.json](assets-manifest.json)逐项记录来源、字节数和SHA256；落盘内容全部核对通过。运行时manifest保留旧5张羁绊图，共86项，所有文件的字节数/SHA256也核对通过。含斯维因图标不代表英雄准入。抓取脚本G2与默认模式均合并既有索引，避免覆盖旧映射。

用户明确授权机械提交图标，并额外授权补齐hero-identity.ts和图标manifest；没有修改src/server或rendering实现。展示测试覆盖33英雄、简称唯一、颜色间距、WCAG对比度和源羁绊标签。

## 来源与限制

冻结源extract检查、runtime生成检查、全字段对账生成检查通过。14个新英雄固定种子技能oracle与额外机制回归、真实效果编译、有限卡池和机器人smoke继续保留。完整数值和近似见[RECONCILIATION.md](RECONCILIATION.md)，不宣称完整14.24b行为等价。
