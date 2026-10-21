# v18：S13 开放 10 级

用户试玩反馈及核对线已确认的 14.24 一手数值，用户批准采用：上限 10；9→10 需要 84XP；10 级 1–5 费商店概率 5/10/20/40/25。1–9 级概率、既有升级阈值不变，不开放 11 级。完整概率表只维护 M5_RULES 原表，不在此重复。

规则/内容身份：`s13-g2-3-v17` / `s13-14.24b-g2-3-v17` → `s13-g2-3-v18` / `s13-14.24b-g2-3-v18`。progression policy 为 `s13-14.24b-ten-levels-v1`，G23 revision 为 `g2-4b-ten-levels-v18`。schema8/save4/replay3/command4、网络协议4、50ms tick、lcg32-v1 不变；旧身份/摘要存档拒绝，无迁移。

完整根离线重算：content `fnv1a32-utf16:05439fc4` → `fnv1a32-utf16:a76be833`；loot replay `fnv1a32-utf16:132ae758` → `fnv1a32-utf16:854f5ac0`。两根均覆盖 progression manifest，因此 loot replay 摘要也变化。使用既有 `scripts/update-content-identities.cjs --write` 更新两个常量，`--check` 校验。

## 改动文件

- `src/simulation/match-rules.ts`：上限、XP、10 级商店行；`content/rules-manifest.ts`：progression policy。
- `src/simulation/input-assets.ts`、`serialization-structure.ts`、`validate-content.ts`：等级/满级 XP/表覆盖校验统一读取 `MATCH_RULES.maxLevel`。
- `src/simulation/round-settlement.ts`：`opposingSurvivors` 是结算收据的敌方存活英雄数，传入原经济规划器计算掉血；上界改读 maxLevel（当前10），损伤公式不变。
- `src/simulation/m8/version.ts`、`m8/contracts.ts`、`content/g2-3-policy.ts`、`content/identity-constants.ts`：版本、revision 和生成摘要。
- `tests/progression.test.ts`、`shop.test.ts`、`match-economy.test.ts`、`m5-economy.test.ts`、`t3-round-settlement.test.ts`、`t7-bot-policy.test.ts`、`m5-serialization.test.ts`：独立数值表、9→10、10级费用桶全部边界、自然 XP 溢出、满级拒买/机器人不再买、10级读档及11级/满级非零XP拒绝。
- `tests/match-contract.test.ts`、`m8-contracts.test.ts`、`match-lifecycle.test.ts`、`match-session.test.ts`、`t10-combat-ops.test.ts`、`m8-b6-opening-economy.test.ts`、`m5-acceptance.test.ts`、`d14-anomalies-source.test.ts`、`epic-loot-reforger.test.ts`、`opening-random-identity.test.ts`：同步有效上限或当前身份；保留历史身份断言。
- `tests/fixtures/m5/{oracle,oracle.g2,command-oracle,command-oracle.g2}.cjs`：独立 oracle 同步确认数值，不从生产规则导入预期值；M3/M4/T13 历史 oracle 不改。
- `scripts/record-v17-release.cjs`、`verify-m8-herald-fixtures.cjs`：按用户指定沿用 v17 epoch 入口/目录重录当前 v18 身份，CURRENT 继续指向 `record-v17-herald.cjs`，以记录内版本和摘要区分。
- `docs/MATCH_CONTRACT.md`、`M5_RULES.md` 与本文：同步规则、失败语义、版本及交付边界。

机器人 `src/simulation/bot/index.ts` 已使用 maxLevel；`src/server/` 只转发公共买经验命令，未发现需修改的9级硬编码。九格备战席、共享池5费9份、三星9份、明确指定9级的战斗夹具/路线均不是满级判断，保留。

## 验证及录制

最终定向17文件403项全部通过；另当前 epoch 身份/轨迹5项通过（只选择当前相关用例，138项历史/其他用例未运行）、Herald集成30项全部通过，共19文件438项。完整 digest 根校验、`tsc --noEmit`、`git diff --check` 通过；改动文本均为LF。本次未运行全套测试。

`node scripts/verify-v17-epoch.cjs` 的9步全部成功，`docs/evidence/v17/epoch-verification.json` 为 `complete:true`；无需在沙箱外执行录制命令。已实际重跑独立经济账本、4条公共命令路线、5组Herald原始输入、真实restore与逐tick校验；没有用替换旧轨迹版本字段代替重录。以下仅为日后复核命令，均不写Git、不联网：

```powershell
node scripts/update-content-identities.cjs --check
node scripts/verify-v17-epoch.cjs
node node_modules/vitest/vitest.mjs run --configLoader runner --project fast --maxWorkers=2 tests/epic-loot-reforger.test.ts tests/m8-b7-match-wiring.test.ts
node node_modules/vitest/vitest.mjs run --configLoader runner --project fast --maxWorkers=1 tests/opening-random-identity.test.ts -t "binds v17 recording entry|rejects each old|recomputes the first battle|raw checkpoints"
```

第二条依次执行 release（含 m5 golden/当前 cannon、sniper 状态）、Herald `--write`、inputs 指纹、live-reveal，然后校验 inputs、CURRENT Herald、历史字节、live-reveal、完整摘要根。固定 baseline 为 `d677a291405ac263b617844d8ae43a604139b7fb`，详细步骤见 `scripts/verify-v17-epoch.cjs`；不需要另跑会覆盖历史 g2-4b 的生成器。

重录输出位于 `tests/fixtures/m5/full-match-golden.v17.json`、`tests/fixtures/v17-recorded-states/{cannon,sniper}.json.gz`、`tests/fixtures/v17-herald-raw/`（五组原始JSON、manifest、trajectory）、`tests/fixtures/v17-c19-seed-9-minimal.json`、`tests/v17-content-baseline.json` 与 `docs/evidence/v17/{release-audit,input-fixture-audit,live-reveal-audit,epoch-verification}.json`。`v17-b8-fingerprints.json` 重算/核验后字节未变化。V15/V16历史58文件及历史身份断言通过Git只读字节比对。

`tests/fixtures/g2-4b-herald-raw/manifest.json` SHA256 固定为 `b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22`，本次修改后复核字节一致。全程无 Git 写操作、未写 `.git`、未联网；服务器和界面源文件均未修改。

## 界面侧

未发现需要修改的9级硬编码。`src/rendering/BoardScene.ts:901–912` 与 `src/rendering/strategy-panel.ts:482–504,1187` 已调用 `getXpToNextLevel` / `getShopOdds`，会随规则显示9级84XP、10级满级和新概率。界面侧只需实际试玩确认这些位置；本次未执行浏览器验收。
