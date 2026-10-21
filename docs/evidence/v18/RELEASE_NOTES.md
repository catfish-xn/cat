# v18：10 级、PvE 拆卸器、纹章与高档羁绊

当前 rules/content 为 `s13-g2-3-v18` / `s13-14.24b-g2-3-v18`；schema/save/replay/command 保持 8/4/3/4，网络协议、50ms tick 与 lcg32-v1 不变。旧身份/摘要存档拒绝，无迁移。

## 本版改动

- 等级上限 10；9→10 需要 84XP；10 级商店概率 5/10/20/40/25。1–9 级概率与既有升级阈值不变，不开放 11 级。progression policy 为 `s13-14.24b-ten-levels-v1`。
- 每个结算后仍存活的玩家，在每个 PvE 固定获得 1 个装备拆卸器，无持有数量门槛；来源为用户确认的原版 14.23 起规则。独立唯一收据，不改变箱子/法球行、权重或 RNG，重复 step、Continue、恢复不重发。
- 22 种纹章、16 个铲子/平底锅配方、独立纹章重铸池；恢复两条原始彩色法球的制作组件原子。原生英雄禁穿同羁绊纹章，失败保持原 state。普通组件与成装重铸池保持。
- 放开来源高档羁绊，18 个新可达档位有合成阵容用例。迅击按目标缺失生命获得攻速、目标死亡触发护盾；搏击手分 40 tick 治疗；法师 8 弱化所有技能命中目标；先知 8 按技能实际 HP 伤害治疗友军。PvP 锁阵容结算读取可信冻结羁绊，保持唯一结算。
- 收入预览的 `ifWin` / `ifLoss` 增加 `base:number`，直接读取结算规划器；接口见 `MULTIPLAYER_CONTRACT.md` §14.4。

完整来源、接口、档位与延期范围见 [V18_TRAIT_EXPANSION](../../V18_TRAIT_EXPANSION.md)、[MATCH_CONTRACT](../../MATCH_CONTRACT.md) 与 [M5_RULES](../../../M5_RULES.md)。未验证的黑色玫瑰 7/野火帮 4 哈希字段、试验品纹章分身及家人抢劫继续按该文档列为延期。

## PR #355 评审修正：炮手 6

炮手（Cannoneer，内部 `artillerist`，归档 `TFT13_Martialist`）6 档攻击力加成 **60% → 70%（7000 Bps）**，依据 [M9_DATA_LEDGER](../../M9_DATA_LEDGER.md) 的 B-12/17 `effects.variables.AD` 修正。与法师 8、狙神 4/6、征服者每箱 5% 同批。

只修运行时数值表，原始归档保留。战斗和说明都读取该值；2/4 档 10%/45%、6 档每 4 次普攻触发 250% AD 爆炸均不变。契约、独立数值断言和说明测试同步，不新增界面或服务器修改。

| 摘要 | 本次评审前 | 最终 |
| --- | --- | --- |
| CONTENT | `fnv1a32-utf16:697f888d` | `fnv1a32-utf16:213ae9e4` |
| LOOT_REPLAY | `fnv1a32-utf16:ffebff3f` | `fnv1a32-utf16:ffebff3f` |

## 独立 v18 epoch 与历史恢复

之前沿用 v17 入口/目录录制 v18 是错误的；用户未授权覆盖 v17 历史。本轮改为独立 `scripts/verify-v18-epoch.cjs`、`scripts/record-v18-{release,inputs,live-reveal}.cjs`、`tests/fixtures/record-v18-herald.cjs`、`scripts/v18-fixture-audit.cjs` 与 `scripts/compare-v18-digests.cjs`。`scripts/verify-m8-herald-fixtures.cjs` 的 CURRENT 已指向 v18。

本地 `origin/multiplayer` 固定提交 `5f33119a68e2ba9e6de45d2eba89b0a0d228c044` 作为历史基线，离线读取 Git blob，将此前被覆盖的 **17 个 v17 文件**恢复为该基线原始 LF/二进制字节。包括 4 份审计、golden、cannon/sniper gzip、C19 输入、7 份 Herald 文件、版本 baseline 及 `record-v17-release.cjs`。具体清单见 [history-restoration.json](history-restoration.json)。v17 的目录、入口及历史断言保留，不再承担当前规则的录制；现用消费者转向 v18。

`tests/fixtures/g2-4b-herald-raw/manifest.json` 未改写，SHA256 始终为 `b39c443bedb12f205230ce0ffbf6a93c2184d73d73cb92ee46eaadf08e086a22`。

新输出：

- `tests/fixtures/m5/full-match-golden.v18.json`、`tests/v18-content-baseline.json`。
- `tests/fixtures/v18-recorded-states/{cannon,sniper}.json.gz`。
- `tests/fixtures/v18-herald-raw/` 的五组原始 JSON、manifest 与 trajectory；命令构造器独立放在 `v18-herald-support/`。
- `tests/fixtures/v18-c19-seed-9-minimal.json`、`v18-b8-fingerprints.json`。
- 本目录的 `release-audit.json`、`input-fixture-audit.json`、`live-reveal-audit.json`、`epoch-verification.json`。

## 录制与核验命令

在本 LF 克隆执行，所有命令离线，只读 Git 对象，不执行 Git 写操作、不写 `.git`。未运行历史生成器。

```powershell
node scripts/update-content-identities.cjs --write
node scripts/update-content-identities.cjs --check
node scripts/verify-v18-epoch.cjs
```

九步依次为 release、Herald `--write`、inputs、live-reveal、inputs `--check`、CURRENT Herald 核验、历史字节核验、live-reveal `--check`、两个完整 digest 根比较。本克隆实际执行完毕：[epoch-verification.json](epoch-verification.json) 为 **`complete:true`，9/9 步 exitCode=0**。

四条公共命令路线均胜利完成 33 场，cannon/sniper 各 67 个状态通过完整 text/object 恢复与序列化字节核验。五组 Herald 在导入生产恢复器前全部导出原始字节，完整恢复、开场和后续 15 tick 验证通过；inputs 与 live-reveal 重生成及 `--check` 一致。

95 个 v15/v16/v17 历史文件、全部历史身份断言及受保护 manifest 字节复核通过。两个完整根从历史源与当前源离线重算并与各自常量一致：v17 为 `05439fc4` / `132ae758`，v18 为 `9aff2c15` / `ffebff3f`（均带 `fnv1a32-utf16:` 前缀）。

## 相关测试结果

```powershell
node node_modules/vitest/vitest.mjs run --configLoader runner --project fast --maxWorkers=1 tests/v18-emblem-traits.test.ts tests/trait-text.test.ts
node node_modules/vitest/vitest.mjs run --configLoader runner --project fast --maxWorkers=1 tests/epic-loot-reforger.test.ts tests/c19-missed-pulse.test.ts tests/d11-wiring-bank.test.ts tests/ur-i3-combat-statuses.test.ts tests/b8-resumable-battle.test.ts tests/m8-b7-match-wiring.test.ts --reporter=json --outputFile=artifacts/v18-consumers-related.json
node node_modules/vitest/vitest.mjs run --configLoader runner --project fast --maxWorkers=1 tests/opening-random-identity.test.ts tests/m8-content-equivalence.test.ts -t "binds|preserves the historical|rejects each old|recomputes the first battle|raw checkpoints|fixture matches the current content baseline" --reporter=json --outputFile=artifacts/v18-identity-related.json
node node_modules/typescript/bin/tsc --noEmit
```

分别通过 107、91、12 项，合计 **10 个文件、210 项通过，0 失败**。最后一条定向 Vitest 命令未选择其余 270 项；当前全部 134 个记录状态的完整恢复已在 epoch release 步核验。`tsc --noEmit`、完整根 `--check`、LF 检查及只读 `git diff --check` 通过。

只跑与本次规则数值、证据迁移及受影响消费者相关的测试，未跑全套或浏览器验收。生成日志与比较结果保存在不提交的 `artifacts/v18-recording/`。

## PR #355：tests-4 与 DBoE 追加修正

- PvE 拆卸器的 MechanicReceipt 不再整对象复制；所有五种收据均按 kind 白名单投影。测试覆盖真实 PvE 收据、全部类型、注入 futurePlan/rngState、输入不变和引用隔离；`seat` 仍按既有显式公开 JSON 合同复制，`hidden` 为空。同步 MATCH_CONTRACT 与 MULTIPLAYER_CONTRACT。
- 3-7 的组件当量 **实际 3 正确，旧 oracle 4 错误**。本地官方 en_us 归档的 Spatula/FryingPan composition 为空，纹章配方各消耗其一与普通组件，项目对应 `component/craftingOnly`。原 oracle 用八种随机候选名单作分类，把平底锅误计成装。仅扩充 oracle 的单组件分类；seed 4（甲、斗篷、平底锅）和 seed 730（棒、手套、铲子）均计 3，伪造 4 被拒绝。没有改掉落表、权重、运行时计数或摘要。
- 恢复平底锅原子也使 `m8-b8-live-transfer` 旧账本断言失效：独立表给出 10 件直接物品、2 个锻造器，另有 3 件补给，共 15 次物品出生；明确核对平底锅唯一收据和资源出生事实，总记录为 77。保持原来购买/升级/成长/出售/装备及迁移场景。
- `t11-opening-xp` 的独立经验表补齐 `9:84`，保持开局 XP/金币和八席断言。

上述修正与炮手 6 的 70% AD、v18 独立录制入口、v17 历史恢复及当前消费者迁移联合重录。最终结果见下方；初次失败日志保留在 artifacts，最终复测单独记录，不以早期失败或旧 epoch 结果宣称完成。

最终本轮 **25 个相关文件、381 项通过、0 失败**（同一文件重跑只计最终结果）；身份文件另有 270 项未选择。已完整运行 `t5r-private-seat-view`、`t5r-loot-view`、`t11-opening-xp`、`m8-b8-loot-runtime`、`m8-b8-live-transfer`、`m8-b8-oracle`，以及规则/说明、PvE 发奖、公共路线、账本消费者和受影响 epoch 消费者。汇总及各 JSON 日志路径在 `artifacts/pr355-final-summary.json`，迁移场景最终 19/19 见 `artifacts/pr355-transfer-final.json`。

最终 `verify-v18-epoch.cjs` 九步全为 exitCode=0，`epoch-verification.json` 为 complete:true；四条路线、134 个检查点的完整恢复、五组 Herald 原始输入及开场/15 tick、inputs/live-reveal 重生成与检查均通过。95 个 v15/v16/v17 历史文件、历史身份断言及受保护 manifest 字节一致；完整根重算为 CONTENT `9aff2c15`、LOOT_REPLAY `ffebff3f`（均带 `fnv1a32-utf16:`）。最终源码类型检查、LF 与 `git diff --check` 通过。仅定向测试，未跑整套 tests-4/全套或浏览器；全程离线、Git 只读，无 Git 写操作。

## PR #355：DBoE 追加项 5–8 最终复核

- **5 / T7 空池**：本机单独复现为 `Empty pooled shop should finish`，并非实际死循环。旧向量设为 9 级、100 金，v18 允许继续买 84 XP，十步预算不能自然收敛。改用实际满级 10 级隔离空池购物；不修改超时、预算或机器人规则。T7 policy 24 项、完整 integration 4 项通过。
- **6 / D14 digest**：先由 `compare-v18-digests.cjs` 从当前完整根重算，确认 CONTENT 为 `fnv1a32-utf16:9aff2c15`，再替换旧断言 `1af51f0b`。D14 source 4 项通过，`update-content-identities.cjs --check` 通过。
- **7 / 收益文案（已被用户新决定替代）**：此前恢复的「全队收益／职业成员额外收益／职业成员最终合计」羁绊文案已改为 14.24 官方原文，仍按当前规则值填充；对应浏览器脚本断言也已改为官方关键句。25 羁绊／83 档的来源、翻译、13 条数值差异及最新验证见 [TRAIT_OFFICIAL_TEXT.md](TRAIT_OFFICIAL_TEXT.md)。
- **8 / G23 授予证据**：3-7 crafting-only 组件计数仍为真实的 3，组件 oracle、loot runtime 与 live transfer 均通过。实际复测另外暴露学院部署伪造未被拒绝：已有战斗的普通存档会跳过历史装备资格检查。现对含学院授予证据的存档执行该检查，覆盖对象/JSON/serialize 入口，保留纹章与历史装备绑定资格；不改授予规则、数值或 digest。`g23-grant-evidence` 全部 15 项通过，合同已补充此恢复入口要求。

前轮收据白名单、3-7 组件 oracle 和 T11 修复均保留并复测；炮手 6 的 70% AD 保留，v18 规则/纹章 48 项通过。最终定向结果按文件去重为 **13 个文件、280 项通过、0 失败、0 跳过**，汇总在 `artifacts/pr355-followup-summary.json`。其中首次 `g23-grant-evidence` 的失败保留在 `pr355-followup-tests.json`，最终 15/15 以 `pr355-followup-regression.json` 为准。`tsc --noEmit` 通过，未跑全套。

浏览器脚本先因 Playwright 自带 Chromium 未安装而失败，未联网下载；随后使用本机 Chrome 完整执行原脚本：

```powershell
$env:M5_NO_GIT='1'
$env:VITE_CONFIG_LOADER='runner'
$env:CHROMIUM_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
$env:M5_EVIDENCE_DIR='artifacts/pr355-input-chrome'
node scripts/verify-m5-input.cjs
```

最终 **39 项、0 跳过、0 页面错误、exitCode=0**，`passed:true`，源文件指纹前后一致；第 341 行对应的 `trait-team-member-and-combined-benefits-visible` 已执行，文字截图为 `trait-audit-benefits.png`，完整 manifest/trace 保存在上述 artifacts 目录。

所有源码修复后重新执行完整 `node scripts/verify-v18-epoch.cjs`，九步全部 exitCode=0，`epoch-verification.json` 为 **complete:true**。当前两个完整根仍为 CONTENT `9aff2c15` / LOOT_REPLAY `ffebff3f`；95 个 v15/v16/v17 历史文件、历史身份断言与受保护 manifest 字节一致。全程仅本机测试与离线 Git 读取，没有 Git 写操作。

## PR #355?DBoE / tests-2 ????? policy ???2026-10-21?

?? 6 ? `G23_TRAIT_SOURCE` ??????? 0.6?? `g2-3-traits.ts` ??? effects ??? 7000 Bps??????????????????????? policy revision ??? `g2-4b-ten-levels-v18`?D14 ????????? CONTENT ? `fnv1a32-utf16:213ae9e4`?????? `9aff2c15`??LOOT_REPLAY ?? `fnv1a32-utf16:ffebff3f`?

????????? v18 epoch ? golden????? exitCode=0?complete:true????????134 ????????? Herald?inputs/live-reveal ??????????95 ? v15/v16/v17 ????????????? manifest ??????`update-content-identities --check`?`tsc --noEmit` ??? `git diff --check` ???

????? 190 ????1 ?????? 270 ??????????????v18 ???D14 ??????????????? `trait-text.test.ts` ??? 6 ????? 60%??????/???????? effects ????????? Codex ???????? `src/presentation/`????????????????????????? JSON ??????????????????????????? `artifacts/pr355-tests2-summary.json`??? inputs ???????????? `pr355-tests2-identity.json`?????? `pr355-tests2-identity-final.json` ???????????????????????? Git ????
