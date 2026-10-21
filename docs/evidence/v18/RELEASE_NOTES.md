# v18：S13 开放 10 级与每 PvE 固定拆卸器

用户试玩反馈及核对线已确认的 14.24 一手数值，用户批准采用：上限 10；9→10 需要 84XP；10 级 1–5 费商店概率 5/10/20/40/25。1–9 级概率、既有升级阈值不变，不开放 11 级。完整概率表只维护 M5_RULES 原表，不在此重复。

规则/内容身份：`s13-g2-3-v17` / `s13-14.24b-g2-3-v17` → `s13-g2-3-v18` / `s13-14.24b-g2-3-v18`。progression policy 为 `s13-14.24b-ten-levels-v1`，G23 revision 为 `g2-4b-ten-levels-v18`。schema8/save4/replay3/command4、网络协议4、50ms tick、lcg32-v1 不变；旧身份/摘要存档拒绝，无迁移。

完整根离线重算：content `fnv1a32-utf16:05439fc4` → `fnv1a32-utf16:1af51f0b`；loot replay `fnv1a32-utf16:132ae758` → `fnv1a32-utf16:9c8f1388`。两根均覆盖 progression 和 consumables manifest；10 级单项中间摘要 a76be833/854f5ac0 由本轮最终摘要覆盖，不另升版本。使用既有 `scripts/update-content-identities.cjs --write` 更新两个常量，`--check` 校验。

## 改动文件（10 级已提交部分）

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

## 10 级单项已完成的验证及录制（本轮最终结果见末尾）

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

## PvE 拆卸器追加改动与最终联合录制

原版 14.23 起每个 PvE 给每个存活玩家额外 1 个装备拆卸器，不检查已有数量；来源由本任务用户确认，箱子/法球原拆卸器行不变。原版值与项目结算时点、存活定义、唯一收据等约定分别单列于 MATCH_CONTRACT/M5_RULES 的 v18 PvE 节。

新增 `src/simulation/pve-remover.ts`；`match.ts` 原 PvE 结算调用该纯授予器，`consumables.ts` 恢复验证固定收据，`content/consumables.ts` 将独立固定奖励政策纳入两个摘要根。10 级数值和相关代码保持 HEAD 71bbcdcf 不变；箱子/法球表不改，不新增服务器规则。消耗品无格位/容量规则限制，界面按类型聚合、按一个真实 ID 消费即可。

定向测试补每个 PvE（单人/联机）无击杀、失败存活、HP0、箱子额外拆卸器、积累/恢复/重复 step、伪造收据、共享满席和服务器各存活席发放；服务器动态找持有者，不绑定某个座位。独立 oracle 增加固定奖励收据核验，不从生产实现读取预期。

本项实际文件：

- 规则：`src/simulation/pve-remover.ts`（新增）、`match.ts`、`consumables.ts`、`content/consumables.ts`、`content/identity-constants.ts`。
- 测试：`tests/pve-remover.test.ts`（新增）、`r3r4-loot.test.ts`、`r3r4-shared.test.ts`、`match-lifecycle.test.ts`、`match-session.test.ts`、`m8-b8-live-cross-round.test.ts`、`d14-anomalies-source.test.ts`、`server/c18b-use-consumable.test.ts`；独立 oracle 为 `tests/fixtures/m5/oracle.g2.cjs`。
- 录制入口说明：`scripts/record-v17-release.cjs`；生成物沿用上节 v17 epoch 清单，只重录当前身份，不改历史 v15/v16 字节。
- 文档：`docs/MATCH_CONTRACT.md`、`M5_RULES.md`、本文。

最终相关回归 13 个文件 175 项全部通过；另当前 epoch 身份/轨迹 5 项通过（该文件其余历史/其他 138 项未选择），合计 14 个相关文件 180 项。`tsc --noEmit`、完整摘要根 `--check`、`git diff --check` 通过；未运行全套或浏览器测试。重录前普通状态/Herald 的 8 项 content-digest 不匹配已在最终夹具生成后复测消除。

联合 `verify-v17-epoch.cjs` 九步全部 exitCode=0，`docs/evidence/v17/epoch-verification.json` 为 `complete:true`。四条公共命令路线均胜利完成 33 场，cannon/sniper 各 67 个状态通过完整恢复；五组 Herald 原始输入在导入恢复器前独立导出，并通过完整恢复、开场及后续 15 tick 校验。58 个 v15/v16 历史文件及历史身份断言字节比对通过。相对 10 级单项，首战战斗状态/事件摘要与 RNG 轨迹摘要保持，领域状态/事件因固定奖励收据变化。

本轮已在沙箱完成联合重录，无需沙箱外执行命令。以下为已执行的单份顺序（10 级与本项合并，供复核）：

```powershell
node scripts/update-content-identities.cjs --write
node scripts/update-content-identities.cjs --check
node scripts/verify-v17-epoch.cjs
```

九步包含 golden、Herald --write、inputs/live-reveal 及相应校验，不另跑历史生成器。全程离线、Git 只读，不写 .git。

## 同版追加：纹章、高档位与 B 类修正（2026-10-21）

完整来源、规则/函数签名、说明模板接线与延期范围见 [V18_TRAIT_EXPANSION](../../V18_TRAIT_EXPANSION.md)。本次基于 `codex/ten-levels` 的 `566dbe34`，不改等级与固定拆卸器实现，不升版本，不做 Git 写操作、不联网。

- 22种纹章、16个铲子/平底锅配方、22候选的独立纹章重铸池；恢复两条原始彩色法球的铲子/平底锅原子。原生英雄禁穿同羁绊纹章，失败不修改状态；普通8组件/36成装重铸池保持。
- 放开原生人数与9档截断，18个新可达档位有合成阵容用例（含家人5的数值，不含抢劫）。执行已取证的顶档数值；迅击按目标缺失生命、目标死亡护盾；搏击手40 tick治疗；法师8所有技能命中目标弱化；先知8技能伤害治疗友军。
- PvP锁阵容结算使用可信冻结战斗收据的羁绊档位，最新运营装备保留；新增纹章不能追溯加收益、拆下纹章不丢本场收益。未锁阵容和显式投影仍精确校验档位，所有路径保留唯一结算与非法范围拒绝。
- 黑色玫瑰7 `{2e45fc86}:100`、野火帮4 `{0a9a9714}:3.5` 缺少安全字段绑定，未猜语义。用户指定特殊机制和试验品纹章分身实验加成列入 `S13_RULES_GAP.md`。本地未见#344，按授权仅改规则侧，待同步说明位置列在扩展文档。

| 摘要 | 本轮开始（同版前两项已完成） | 最终 |
| --- | --- | --- |
| CONTENT | `fnv1a32-utf16:1af51f0b` | `fnv1a32-utf16:697f888d` |
| LOOT_REPLAY | `fnv1a32-utf16:9c8f1388` | `fnv1a32-utf16:ffebff3f` |

最终相关测试：19个文件354项全过，另当前epoch身份/首战/旧身份拒绝3项全过，合计20个文件357项（其余140项历史/其他身份用例未选择）。新增 `v18-emblem-traits.test.ts` 48项，包含每个放开档位的合成阵容、全部配方、来源/重铸、冻结战斗恢复、B类数值、运行时恢复校验、PvP纹章变更的双向结算与幂等。`tsc --noEmit`、完整摘要根 `--check`、`git diff --check` 均通过。未运行全套或浏览器测试。

最终联合重录 `node scripts/verify-v17-epoch.cjs` 九步全部 exitCode=0；`../v17/epoch-verification.json` 为 `complete:true`。四条公共命令路线均胜利完成33场，cannon/sniper各67个状态完整恢复；5组Herald在加载恢复器前独立导出原始字节，通过开场及后续15tick恢复。inputs/live-reveal 重新生成并核对；摘要比较通过；58个v15/v16历史文件及对应身份断言字节不变。最终证据使用当前v17录制目录承载v18，不改历史目录。

本轮日志在不提交的 `artifacts/v18-traits-epoch-final.log`、`v18-traits-related-final.log`、`v18-traits-identity-final.log`、`v18-traits-tsc-final.log`、`v18-traits-digest-final.log`。第一次录制在补充冻结装备结算修正前主动中断，最终九步已从头重跑，交付不依赖中断结果。

## 合入 multiplayer 后的收尾（2026-10-21，HEAD a0a63ae5）

按本次用户授权同步 `src/presentation/effect-text.ts` 与 #344 的 `trait-text.ts`，全档位遍历保持，覆盖纹章可达档位、数值顶档、迅击/搏击/法师8/先知8修正。法师125 AP、狙神18%/36%读取实际效果，征服者每箱5%读取执行policy；延期机制逐档标“暂未实装”，不改原始归档或规则。未修改 rendering 或服务器实现。

收入预览的 `ifWin` / `ifLoss` 新增 `base:number`，直接读取结算规划器的基础金币。1-2/1-3/1-4 为2/3/5，之后普通战斗与加时为5，排除利息、胜利、连胜败及掉落；合同同步到 MULTIPLAYER_CONTRACT §14.4。规则测试覆盖两阶段/两分支、开局/PvE/PvP/加时及输入不变；私有席位投影测试逐项比对真实结算。另补齐原 `match-contract` 空场投降断言漏掉的 v18 固定拆卸器收据与事件序号，未修改结算行为。

最终 CONTENT_DIGEST 仍为 `fnv1a32-utf16:697f888d`，LOOT_REPLAY_DIGEST 仍为 `fnv1a32-utf16:ffebff3f`；完整根重算一致，无需更新摘要常量或升版本。接口源码字节改变了 Herald/审计的源码指纹，因此实际执行 `node scripts/verify-v17-epoch.cjs` 全部九步重录与核验，`../v17/epoch-verification.json` 为 `complete:true`、九项 exitCode=0。四条完整路线、五组 Herald、inputs、live-reveal 均重新生成；最终 golden、cannon/sniper 检查点、Herald原始状态及轨迹字节未变，元数据更新到最终源码。58个v15/v16历史文件与历史身份断言字节检查通过。

最终相关回归29文件642项通过，当前身份/首战/恢复5项与Herald集成30项通过，合计31文件677项；身份文件其余138项历史/其他用例未选择。`tsc --noEmit`、两根离线重算、LF及 `git diff --check` 均通过。只跑相关测试，未跑全套或浏览器验收。要求保留的 `tests/fixtures/g2-4b-herald-raw/manifest.json` SHA256 仍为 `b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22`，字节不变；全程离线、Git只读、不写 `.git`。

本次日志：不提交的 `artifacts/v18-closeout-{related,final-tests,contract-final,identity,herald,tsc-final,epoch}.log`。`final-tests` 记录原契约断言的一次失败，修正后的对应文件12项全过见 `contract-final`；其他文件最终通过，不以删除测试或放宽断言消除失败。
