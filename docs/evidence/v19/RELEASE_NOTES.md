# v19：实际耗蓝、开场生命、双形与关系羁绊

规则/内容为 `s13-g2-3-v19` / `s13-14.24b-g2-3-v19`；schema/save/replay/command 保持8/4/3/4，50ms tick、lcg32-v1不变。旧身份/摘要明确拒绝，无迁移。

CONTENT=`fnv1a32-utf16:9ba56127`；LOOT_REPLAY=`fnv1a32-utf16:8d45a042`。后者因共同规则 manifest 变更，箱子、法球数值及抽样算法未修改。

本版实现统领实际耗蓝叠AP、盖伦实际完整最大生命冻结共享、双形2/4前排减伤/后排增伤、对应强化与伙伴门槛的姐妹2、蓝发10开场及12秒循环、赛恩伤害目标上的黑玫×1.08、完美行刑官链锯刃的处决/治疗/刷新增益/战后唯一金币收据，以及赛薇卡最终招式/引导时长/强化标记显示数据。姐妹新增一项金级强化及各一名伙伴的唯一赠品，当前61强化/27羁绊。

为家人5只预留 `familyHeist` 契约/类型位置，未初始化或实现规则。纹章属性、六费、其余关系羁绊、黑玫7复活及其他延期机制不在本轮。

来源、数值、导出字段、失败与恢复边界、3D消费说明见 [V19_MECHANICS](../../V19_MECHANICS.md)。黑玫4档绑定为**推断**；黑玫重复标记不叠加、蓝发永久属性一次/攻速与眩晕刷新、盖伦共享顺序、姐妹刷新均为缺执行证据下的明确项目约定。链锯刃仅PvP真实敌方英雄掉金是用户要求的**魔改**；不得称为完整原版行为。

## 独立 epoch

本地基线 `9fb94704c5f0c59ec975c6f0de4dd188207129fa`。仅离线只读 Git 对象，不做 Git 写操作。入口为 `scripts/verify-v19-epoch.cjs`、`record-v19-{release,inputs,live-reveal}.cjs`、`v19-fixture-audit.cjs`、`compare-v19-digests.cjs`；CURRENT Herald 指向 `tests/fixtures/record-v19-herald.cjs`。

只生成 `tests/v19-content-baseline.json`、`tests/fixtures/v19-*`、`tests/fixtures/m5/full-match-golden.v19.json` 与本目录审计；v18及更早录制文件/入口原字节保留。`g2-4b-herald-raw/manifest.json` SHA-256 应保持 `b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22`。

```powershell
node scripts/update-content-identities.cjs --write
node scripts/update-content-identities.cjs --check
node scripts/verify-v19-epoch.cjs
node node_modules/vitest/vitest.mjs run --configLoader runner --project fast <相关测试文件>
node node_modules/typescript/bin/tsc --noEmit
```

## 最终录制与验证

`epoch-verification.json` 为 **complete:true，9/9步exitCode=0**。四条公共路线均胜利完成33场；cannon/sniper各67个检查点，共134个完整text/object恢复及序列化字节核验。五组Herald在导入生产恢复器前导出原始输入，完整恢复、开场及后续15tick验证通过；inputs/live-reveal复录与`--check`一致。live-reveal局部路线因新增姐妹金级候选改变公共强化前缀，洛里斯/婕拉死亡时刻为437/176tick，均只揭示一份；同tick双死亡44及未挂奖载体106的断言保持。

125个v15–v18历史录制/基线/脚本文件、历史身份断言前缀及受保护manifest原字节一致。完整根从Git基线源码与当前源码分别重算：v18为CONTENT `213ae9e4` / LOOT_REPLAY `ffebff3f`，v19为`9ba56127` / `8d45a042`（均带`fnv1a32-utf16:`前缀）。旧录制入口没有执行，没有改写v18证据。

最终定向Vitest按文件去重：**33文件、485项通过、0失败**。其中新规则20项使用合成场景，覆盖数值、成本变动、行位置、强化/伙伴门槛、助攻、0/240/480信号、生命不复利、黑玫目标倍率、处决严格阈值/自然致死/召唤与分身排除/重复装备/刷新到期/唯一战后3金、复制来源冻结、变体投影、认证重演与伪造拒绝。当前夹具消费者、回放、收益、旧机制回归及源锁定同时通过；身份文件另外270项未选择，未将其记为通过。完整134检查点另由epoch真实执行，不靠跳过测试替代。

最终日志：`artifacts/v19-related-final.json`（28文件463项）、`v19-identity-final.json`（2文件13项）、`v19-source-final.json`（3文件9项）。`tsc --noEmit`、`update-content-identities --check`、LF检查及只读`git diff --check`通过。只运行相关测试和授权录制，未运行全套、浏览器或联网验收；没有Git写操作。3D渲染接线由显示侧按新增合同消费，本轮不修改渲染器。
