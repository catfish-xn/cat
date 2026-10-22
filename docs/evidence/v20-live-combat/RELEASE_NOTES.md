# v20-live-combat

父 epoch：`v20-xp68`。集成基线：`db04d196e4a12933624add7d61be9081a639607f`（#384、#385、#386、#388），施工 HEAD：`c5c735cad69b1c7d5f413cc7d62b89a27ccf7f71`。

生产战斗现在按绝对时间的50ms边界首遍推进，完整领域账本与双方回放直接来自同一任务；全体终局后才按固定席序规划并原子结算。本人/观战双游标独立恢复，客户端四拍/200ms缓冲，服务器整拍合并推送；终局至少保留800ms尾段。战中买卖和刷新使用结算时权威金币计算利息。逐 tick `beforeTick` 输入入口已接通，阶段1只允许空输入；非空输入/伪造日志报 `battle-input-unsupported`，不执行安装、不记虚假成功。字段、导出及失败枚举见 [MULTIPLAYER_CONTRACT](../../MULTIPLAYER_CONTRACT.md) 和 [LIVE_COMBAT_PHASE1](../../LIVE_COMBAT_PHASE1.md)。

完整继承经验68策略、梅尔救命精确HP核对及 Chem-Baron B 补丁16具名字段、标准 PvE 不增微光、黑市至多三包 N 选一与保留，及迅击、野火、五组搭档和 #381 模型预热。没有为新的调度修改数值、RNG抽取顺序或50ms规则。

| 标识 | 父 epoch | 当前 |
| --- | --- | --- |
| rules | s13-g2-3-v20-xp68 | s13-g2-3-v20-live-combat |
| content | s13-14.24b-g2-3-v20-xp68 | s13-14.24b-g2-3-v20-live-combat |
| CONTENT | fnv1a32-utf16:3512a559 | fnv1a32-utf16:93fad04c |
| LOOT_REPLAY | fnv1a32-utf16:d18f985e | fnv1a32-utf16:49eb9cf0 |
| schema / save | 11 / 7 | 11 / 7 |
| replay / command | 4 / 4 | 5 / 5 |
| 网络 NET / 规则侧多人契约 | 5 / 4 | 6 / 5 |

schema/save继承父版黑市候选及决策字段，本 PR 没有新增 Match/SaveEnvelope 字段，因此不再升版；replay/command升版用于实时流与逐 tick 输入语义。离线装备命令仍由原 BattleHistory 重演并认证。所有旧 rules/content/digest/replay/command 身份严格拒绝运行态恢复，无迁移。上线须排空旧对局并使客户端与服务器一起切换 NET6。

独立生成 `full-match-golden.v20-live-combat.json`、cannon/sniper各67个压缩检查点、B8指纹、C19 seed9、五份Herald原始输入及完整公开命令轨迹、transfer和live-reveal证据。历史epoch文件（包括录制脚本、原始输入、旧golden和证据）与受保护的 `g2-4b-herald-raw/manifest.json` 均只读；后者SHA256为 `b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22`。

所有入口离线运行，不写 Git 元数据：

```sh
# 明确重录新目录；不修改父epoch或历史目录
node scripts/verify-v20-live-combat-epoch.cjs --write
# 正式核验：重新计算并比较现有夹具，不覆写输入/golden
node scripts/verify-v20-live-combat-epoch.cjs
node scripts/compare-v20-live-combat-digests.cjs
node scripts/v20-live-combat-fixture-audit.cjs --baseline-commit=db04d196e4a12933624add7d61be9081a639607f
node scripts/update-content-identities.cjs --check
```

`record-v20-live-combat-{release,inputs,live-reveal}.cjs` 必须携带上述 `--baseline-commit`，可加 `--check`；transfer同样支持 `--check`。Herald入口为 `tests/fixtures/record-v20-live-combat-herald.cjs`（缺省核验，显式 `--write` 重录）；`verify-m8-herald-fixtures.cjs` 的 CURRENT 指向它。新 epoch 记录真实公开命令输出，未替换旧状态的版本/digest标签来绕过恢复拒绝。

验收的命令、计数、环境失败分类与限制见 [VALIDATION](VALIDATION.md) 和 [epoch-verification.json](epoch-verification.json)。

阶段2战中安装尚未实现；20ms预算只在tick之间让出，单tick、初始化及终局规划不能抢占。没有新增服务器进程重启恢复或数据库。
