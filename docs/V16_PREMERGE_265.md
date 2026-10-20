# #265 v16 剩余八个 CI 规则文件（2026-10-20，起点 729e6fab）

本轮起点：`codex/epic-loot-reforger@729e6fabf696d01f428996f67438ab2ba2271416`，工作区干净。只读 Git、全程离线、不安装依赖、不写 `.git`，不修改 `src/server/`、`src/rendering/`、`tests/server/`。本轮仅修复测试及公共测试夹具；以下是当前结果，后文均为历史记录。

## 八个文件的复现、分类与修复

首次按原时限运行八个完整文件：**84 项，72 通过、12 失败**；均为功能断言/夹具命令失败，未出现纯计时失败。修复后同样八个文件 **84/84 通过**，未增加时限、删除测试或降低断言。

| 文件 | 首次失败数 | 结论、根因与改动 |
| --- | ---: | --- |
| `m8-b4-integration` | 1 | 测试夹具实现错误。`m8-b4-match` 被换成共享追加流时代的 seed721851，`unit-3` 不再是开局掉落的 Lux，HoJ 充能得到 0。恢复指定 v15 基线的 seed3151248 和原强化优先级；保留 360×130%=468、低血量采样、真实充能保存及逐 tick 恢复断言。 |
| `r3r4-consumables` | 1 | 测试夹具实现错误。seed72 的原奖励没有窃贼手套；恢复基线 seed162，其真实 2-7 掉落手套及重铸器。两份独立 oracle 与公开命令确认来源；保留拆卸/重戴不重抽、重铸清子件、冻结战斗和逐 tick 恢复。 |
| `t12-offline-transfer` | 1 | 测试引用过期。共享 `transferPreparation` 已使用 seed18619，仍把旧 `unit-13` 当供体，拆卸返回 `no-removable-items`。按同路线已有 `m8-b8-live-transfer` 的精确来源断言，固定供体 `unit-20`、存活者 `unit-24`；继续验证真实奖励升星、冻结供体护甲溢出返还及伪造保存拒绝。 |
| `m8-b8-equipment-fixture` | 3 | 测试夹具及期望曾迎合共享流偏移而改错。完整恢复指定 v15 文件字节（含原时限），并恢复其依赖的 seed3151248、双饮血剑 seed76672。原 cloak/rod/gloves、bow/sword、Maddie 二星、HoJ 2-5、双饮血剑 3-5、原物品 ID/来源/合成事件全部精确通过；没有把新原奖励写成预期。 |
| `m8-b3-audit` | 1 | 同一公共夹具错误导致开局单位 ID 缺失，部署被拒；通过修复 `m8-b4-match` 恢复。测试文件无需修改，保留 763 最大生命、tick39→40 实际治疗19、完整事件与归档恢复检查。 |
| `m8-b5-grant-upgrade` | 2 | 公共采购夹具实现错误。此前用 seed16/3 替换基线 seed38/9，丢失原有资金与供给时点，九张付费卡采购前已进入异常窗口或终局。恢复基线选种与组件顺序，保留显式种子；测试文件无需修改，仍验证九次付费采购、递归三星、TG 子件不重抽、唯一/独占/满槽冲突返还及伪造来源拒绝。 |
| `bracer-multikill-stacks` | 1 | 公共夹具被改种；断言要求 seed3151248，实际为721851。恢复夹具后无需修改本文件，原 Renata tick60 双杀、每目标两层、+40 护甲/魔抗/AP、全状态/事件重放均通过。 |
| `m8-b10-temporary-replay` | 2 | 测试引用过期。实际 seed18619 的手套父件为 `item-10`、供体 `unit-20`、存活者 `unit-24`；旧常量把真实供体误写成“移动后”目标，负例变成恒等修改而未抛错。修正精确 ID 与路线注释，保留两个子件、1×/2×/4×、seek、伪造/丢失/移动四类拒绝断言。 |

本批没有需要接受的新原掉落或商店期望，也没有发现生产实现漏用独立流。奖励按唯一收据发放的实现不变；现有重复命令、恢复和拒绝断言继续执行。

## 原流、身份与体积证据

重新只读归档指定基线 `1642beaabee7df800c15250bb07ec6cf2e6bbed0`，SHA256 为 `d5972cb0e44781efd438a4938cb700417024e9d049f550656d7cb26ec28df4ea`；实际校验探针所用的全部311份基线源码逐字节等于该归档。4,106组比较覆盖4,105个不同种子（0–4095及6160/6240/7216/18619/3151248/76672/721851/3374947733/0xffffffff；162重复检查一次）至4-7：仅去除追加复制器、归一已批准的旧重铸器名称后，原 payload、身份、顺序与 loot RNG 均等于基线；等级1/4/7/9共16,424次商店比较均等于基线及独立 BigInt oracle。生产完整八轮奖励同时符合两份互不调用的独立 oracle。

`src/simulation` 没有修改，所有变更文件均不在录制器 sourceDigests 集合；既有 release/input/live-reveal 指纹仍匹配当前源码。本轮不触发九步重录，不改现有 v16 fixture/golden/raw 字节。`node scripts/compare-v16-digests.cjs` 重新加载基线与当前源码复算如下（均带 `fnv1a32-utf16:` 前缀）：

| digest | v15 基线 | 本轮前 v16 | 本轮后 v16 |
| --- | --- | --- | --- |
| CONTENT_DIGEST | 70dbb056 | de829c8a | de829c8a |
| LOOT_REPLAY_DIGEST | 61568ec0 | 62c76cb9 | 62c76cb9 |
| RULES_GAP_MANIFEST | 97c14bf3 | 31950a0f | 31950a0f |

`npm.cmd run build -- --configLoader runner`（含 tsc）退出0。全部 `dist/assets/*.js` 分别 gzip level9 求和，含 Phaser：**619,825 B / 424,763 B = 1.4592254975 ≤ 1.49**；分母沿用此前记录的本地15313a7构建，未重建历史产物。分子与本轮起点已有记录字节相同，未修改预算或阈值。

## 全量验证

已完整执行 `node node_modules/vitest/vitest.mjs run --project fast --maxWorkers 4 --configLoader runner --reporter=json --outputFile=artifacts/v16-ci-265-full-fast.json`，与 `npm test` 选择同一个 fast 全量项目：**371文件、4,850项，4,840通过、10失败、0待执行，退出1，耗时897.365秒**。指定八个文件在全量运行中仍为 **84/84通过**。没有选择 timing 项目，不把此结果称为所有项目或远端 CI 全绿。

全部失败如下；本轮未修改这些测试、压力脚本或服务器文件，也未调高任何时限：

| 文件 | 失败数 | 实际结果与分类 |
| --- | ---: | --- |
| `tests/explorer-bracer-restore-pressure.test.ts` | 2 | `huge-count`（5,000,000触发/100,000,000 AP）与 `dedup-titan`（26^12历史）均在调用 esbuild 打包压力子进程时失败：`Cannot read directory "../../..": Access is denied`，无法解析工作区内 stress 入口。尚未执行压力断言，不是 AP/规则断言失败。独立执行 `node scripts/profile-explorer-bracer-restore.cjs huge-count` 原样复现；显式工作目录/相对入口及显式 tsconfigRaw 仍受同一目录权限限制，结束该尝试。保留原内存/时间及规则验收口径；需能读取该目录的本机环境复验。 |
| `tests/m5-match-integration.test.ts` | 1 | `restores each real tick, then supply without creating combat or consuming battle RNG` 在4 worker全量中超过原30秒，记录30,104.85ms。完整文件单 worker复测 **3/3通过**，该用例12,737.83ms；原30秒已约为单独实测2.35倍，因此未无依据增加时限。纯并发计时残留，未减去任何 tick/恢复检查。 |
| `tests/server/e2e-replay-errors.test.ts` | 4 | after-readiness、split-divergence、before-readiness、unrelated-output 四个子进程用例失败。输出显示嵌套进程 `spawn C:\Program Files\nodejs\node.exe ENOENT`；前三项因未得到 `Server replay error:` 而失败。按用户要求仅报告，不改测试或 harness，不将其归因为规则回放分歧。 |
| `tests/server/replay-first-pass.test.ts` | 2 | `logs a mismatch ... checks every later battle`（5,292.50ms）及 `checks every Nth round ... nothing in between`（7,069.57ms）均超过原5秒。仅报告计时失败，未更改服务器测试。 |
| `tests/server/room.test.ts` | 1 | `opens a choice window ... every seat chose` 记录6,594.25ms，超过原5秒。仅报告计时失败，未更改服务器测试。 |

因此本轮已修复原八个规则文件，**完整 fast 尚未全绿**：剩余2项压力打包环境阻塞、1项领域并发计时、4项服务器子进程环境失败及3项服务器计时。没有新的规则断言失败；压力子进程尚未执行其规则断言，不能据此声称压力验收通过。没有修改纯计时预算，故无新增“临时 + 用户批准”注释；后续若改预算仍须依据实测并按该约定标注。

生成原始日志/JSON保存在 `artifacts/v16-ci-265-*`，不提交生成目录；本轮可提交的机器摘要及全部失败名称/消息见 [ci-remaining-265-verification.json](evidence/v16/ci-remaining-265-verification.json)。

建议提交信息：`test(v16): restore legacy acquisition fixtures and transfer replay identities`。本轮未暂存、提交、推送或执行其他 Git 写操作；没有需要用户拍板的玩法变更。

---

# #265 v16 CI 红项修复（2026-10-20，起点 c0ef8ddd，历史）

本轮起点：`codex/epic-loot-reforger@c0ef8ddd99be41623a5bf10266fc1cd28e93069c`，工作区干净。只读 Git、全程离线、不安装依赖、不写 `.git`；未修改任何 `src/` 文件（含禁止的服务器和渲染目录）。以下为本轮记录；原文保留为历史。

## 逐项结论与修复依据

| 项目 | 结论、根因与改动 |
| --- | --- |
| m8-b8-oracle | 本地复现2项失败，均为共享追加流时代遗留的字面向量，并非当前生产流偏移。恢复基线seed230的2-7/3-7/4-7组件sword/tear、cloak/rod、sword/tear，以及1/2/3金币、原开局Darius/Irelia。5-7/6-7使用已批准v16史诗表，两份独立字面表BigInt oracle得到Swain×3、Camille、Vi及loot游标22/27；修复早期流隔离后漏同步的测试向量。商店断言和规则未改。 |
| r3r4-consumable-targets | 本地4项因找不到窃贼手套失败；此前把基线配方seed162错换成共享流时代seed72。恢复162：真实公开命令得到两只手套并合成；重铸器与目标拒绝断言保留。72原奖励含光明装备而非手套，不改生产掉落迎合它。 |
| r3r4-loot | 本地1项失败；seed42的5-7为standard变体，独立表得到“成装锻造器+铜箱+银箱”3球，旧4球是遗留artifact向量。6-7仍3球，总数18；1–4阶段计数不变。此为既有v16史诗表的测试实现修复，不新增玩法。 |
| m8-b8-live-economy | 本地3项失败；组件期望曾从基线bow/sword错改为rod/gloves。恢复Git基线原字面值；9/49/50金币、1金币先入账、16/60/61结算、投资成长、restore/Continue只发一次均未改。 |
| readLootView | 单独运行m8-b8-loot-view 7项、t5r-loot-view 24项原本通过。投影实现无误；补充seed38精确5条payload、追加项entryOrdinal=2、唯一收据/工具/事件、restore后step不重发、重复收据拒绝，覆盖U6同一领域路线。 |
| m8-b8-live-cross-round | 扩展readLootView检查发现suite加载即失败：仍读取不存在的cloak并合成飓风。将整个原奖励/羊刀/战斗攻速/出售来源链恢复为指定v15提交字节，再仅增加方案A新增的1-4末尾次级复制器期望；独立oracle给seed14349、r02蓝球追加抽签98。其余原数值及篡改拒绝不变。 |
| m8-u6-loot 4-7 | 预期新增，非重复奖励：seed38，razorbeaks-v1的r00载体、灰球slotOrdinal=1，在Ezreal/remover原内容抽完后，以独立FNV/LCG抽得99，命中灰球1%次级复制器，追加到entryOrdinal=2。收据为JSON.stringify([JSON.stringify([orbId,2]),'grant'])；orbId=JSON.stringify(['orb','4-7','razorbeaks-v1',JSON.stringify(['pve','4-7','razorbeaks-v1','r00']),1])。脚本精确检查原4条+末尾复制器5条、唯一收据及grantedConsumableIds，不截断掉落或宽松匹配。 |
| headless | 已原样复现到第16条路线cannon/4096：选择进入未知时旧M5 oracle把暂离的Corki当作丢失。按已批准D14托管合同，独立核算活动+托管英雄/装备，校验原出生/离场资源事实和不得同时活动；保留卡份额/金币/物品/序号核算。新增真实离场→三次结算回归及丢失英雄、重复英雄、丢失装备、回归丢失的拒绝反例。生产D14无改动。 |

## 方案A与原流证据

从指定基线提交只读 `git archive` 导出真实源码，归档SHA256为 `d5972cb0e44781efd438a4938cb700417024e9d049f550656d7cb26ec28df4ea`。4,102种子（0–4095及6160/6240/7216/18619/3374947733/0xffffffff）逐项比较至4-7：只剔除追加复制器、只把两旧重铸器名称归一为已批准reforger后，原payload、orb/drop身份、顺序和loot RNG全部与v15相同；相同种子在等级1/4/7/9共16,408次商店比较与基线及独立BigInt算术一致。两份互不调用的v16 oracle与生产完整8轮奖励也全部一致。

没有发现当前生产实现漏用独立流，因此没有修改生产代码，也没有用新掉落结果覆盖原掉落期望。本轮恢复的是此前被共享流偏移改错的v15测试种子/字面值；晚期史诗向量按已批准v16表重新独立计算，不归因于方案A增加原奖励。

原始日志/完整向量在 `artifacts/v16-ci-fix/`（不提交生成目录）；最终机器摘要见 [ci-fix-265-verification.json](evidence/v16/ci-fix-265-verification.json)。

## 本轮验证与交付状态

最终按文件去重为 **31文件、506项通过、0失败、0待执行**。包括原失败文件、全部直接调用readLootView的测试、match-session、opening-random-*、m5-growth、epic-loot-reforger、d14-*、content-identity-constants及tests/presentation；未改测试时限、未缩小原数值/来源链/拒绝断言。`node node_modules/typescript/bin/tsc --noEmit`、`npm.cmd run build -- --configLoader runner`均退出0；`VITE_CONFIG_LOADER=runner node scripts/verify-m5-headless.cjs --multi-seed`全部24条路线通过（含原失败4096，三种build，原种子列表不变）。没有重跑完整四分片CI或性能重复采样，不把本机结果说成远端CI全绿。

虽然未改simulation，oracle是录制器受校验源码，仍按EPIC_LOOT_V16规定顺序重跑9步以刷新源码指纹，基线参数始终为 `1642beaabee7df800c15250bb07ec6cf2e6bbed0`：

| 步骤 | 命令（参数同EPIC_LOOT_V16的9步流水线） | 退出码 |
| --- | --- | ---: |
| release | node scripts/record-v16-release.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0 | 0 |
| herald-write | node tests/fixtures/record-v16-herald.cjs --write | 0 |
| inputs | node scripts/record-v16-inputs.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0 | 0 |
| live-reveal | node scripts/record-v16-live-reveal.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0 | 0 |
| inputs-check | node scripts/record-v16-inputs.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0 --check | 0 |
| herald-verify | node scripts/verify-m8-herald-fixtures.cjs | 0 |
| history | node scripts/v16-fixture-audit.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0 | 0 |
| live-reveal-check | node scripts/record-v16-live-reveal.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0 --check | 0 |
| digests | node scripts/compare-v16-digests.cjs | 0 |

所有v16状态、完整golden、输入、Herald raw载荷与起点HEAD逐字节相同；仅四份录制审计/manifest中的oracle源码指纹及其关联摘要变化。历史G2-3/G2-4b的86文件、v15的23文件和历史身份断言经Git真实字节核验不变。

| digest（均有fnv1a32-utf16前缀） | 本轮前 | 本轮后 | v15基线复算 |
| --- | --- | --- | --- |
| CONTENT_DIGEST | de829c8a | de829c8a | 70dbb056 |
| LOOT_REPLAY_DIGEST | 62c76cb9 | 62c76cb9 | 61568ec0 |
| RULES_GAP_MANIFEST | 31950a0f | 31950a0f | 97c14bf3 |

体积仍使用m7-budget的全部 `dist/assets/*.js` 分文件gzip level9求和，含Phaser：**619,825 B / 424,763 B = 1.4592254975 ≤ 1.49**。分母沿用已记录的本地15313a7构建，本轮未重建历史产物；分子每个文件的SHA256与gzip字节数在机器摘要中。未修改预算配置或阈值。

**未完成：U6浏览器端复验。** 原脚本在本机默认Vite配置加载器下先遇esbuild目录权限拒绝；为headless/U6接入可选 `VITE_CONFIG_LOADER=runner`，U6另支持工作区缓存目录 `U6_CACHE_DIR`，默认CI行为不变。随后U6仍在启动服务时被沙箱拒绝 `listen EACCES: permission denied 127.0.0.1:5173`，浏览器断言尚未执行。没有绕过权限、联网或把领域测试冒充DOM验证。可在具备本地监听权限的环境运行 `VITE_CONFIG_LOADER=runner U6_CACHE_DIR=artifacts/v16-ci-fix/u6-cache node scripts/verify-m8-u6-loot.cjs`（本机Chrome可设置CHROMIUM_PATH），或由现有m8-ui-dynamic CI复验；领域路线已验证5条精确掉落、唯一收据/工具/事件和恢复不重发。

建议提交信息：`fix(v16): restore scheme A loot vectors and account for D14 held ownership`。无待拍板玩法问题；未暂存、提交或执行其他Git写操作。最终边界检查确认 `src/` 无改动，`git diff --check`通过。

---

# #265 v16 体积方案替换（2026-10-20，历史）

本次起点：`codex/epic-loot-reforger@4406686b7bc95541fd0ca66d751b7008d74d36c6`，工作区干净。历史基线仍为 `1642beaabee7df800c15250bb07ec6cf2e6bbed0`。遵循协调者 `amend-265-bundle.md`：只读 Git、不联网、不写 `.git`，不改 `src/server/`、`src/rendering/`，不重录任何 v16 fixture 或既有证据。下文旧轮次结果仅作历史记录。

## 本次实现与身份

删除原生产身份构建插件及等价验证脚本、Vite 引用，保留 Phaser 独立 chunk。四表共137行，运行列放入同名 `*-runtime.ts`，原 `*-source.ts` 保存其余说明来源列并通过 `archive-source.ts` 重组完整行，仅供离线 digest 和来源测试。运行入口只依赖运行列；无开发/生产/服务器分支或转换。

| 表 | 行数 | 运行列 | 说明来源列 |
| --- | ---: | --- | --- |
| g2-3-special-item | 65 | name / values / unique（池与光明映射同在运行文件） | apiName / description |
| g2-3-trait | 26 | name / enabled / tiers | apiName / description |
| g2-4-artifact | 29 | zhName / unique / values | name / apiName / description |
| g2-4-support-item | 17 | name / unique / values | apiName / description |

完整表逐行与拆分前数据深比较相同，运行投影逐行相同。`scripts/content-digest.ts`、`scripts/loot-replay-digest.ts` 保留原两项根表达式，已与 HEAD 原表达式比较完全相同；说明列仍覆盖在内容根内。`node scripts/update-content-identities.cjs --write` 从完整表生成 `src/simulation/content/identity-constants.ts`，`--check` 验证；浏览器/开发/服务器共读常量。普通 `digestContent()`、状态与账本 hash 算法仍在运行时使用，未改算法、覆盖范围、规则或版本。

| digest（均带 fnv1a32-utf16: 前缀） | 替换前 | 替换后 |
| --- | --- | --- |
| CONTENT_DIGEST | de829c8a | de829c8a |
| LOOT_REPLAY_DIGEST | 62c76cb9 | 62c76cb9 |
| RULES_GAP_MANIFEST | 31950a0f | 31950a0f |

新增 `tests/content-identity-constants.test.ts` 被现有 CI 的 `npm test` / fast 项目选中：重算完整两项根，常量失配时明确提示 `node scripts/update-content-identities.cjs --write`；并拒绝归档缺行/列冲突，检查浏览器入口、实际服务器入口及领域服务器入口的传递依赖均不含四表说明文件或离线重算模块。

## 本次体积与验证

同机 Node v22.17.0、zlib 1.3.0.1-motley-780819f；全部 `dist/assets/*.js` 各自 gzip level9 后求和，包含 Phaser，沿用 `scripts/m7-budget.cjs` 口径。分母为既有本地 M7 `15313a7` 产物 424,763 B，本次未重建或重新核验该产物来源。

| 项 | 替换前（HEAD 实测） | 替换后（本工作区实测） |
| --- | ---: | ---: |
| JS gzip 总量 | 619,933 B | 619,825 B |
| / M7 比值 | 1.4594797569 | **1.4592254975 ≤ 1.49** |
| Phaser gzip | 175,652 B | 175,652 B（SHA256相同） |

净减108 B；未修改预算或依赖。`node node_modules/typescript/bin/tsc --noEmit`、`npm.cmd run build -- --configLoader runner` 退出0。runner适配本地共享依赖路径下默认配置加载器的权限问题，不改变构建目标。指定回归去重后 **29文件 / 658项通过，0失败/待执行**，覆盖所有 content/identity 命名测试、epic-loot-reforger、全部d14-*、全部tests/presentation、match-session、所有直接引用四表的测试和新增常量测试；Vitest同样使用 `--configLoader runner --project fast --maxWorkers=1 --no-file-parallelism`。没有计时失败，没有放宽超时。

| 检查（baseline 参数均为上述1642beaa完整SHA） | 退出码 | 结果 |
| --- | ---: | --- |
| update-content-identities.cjs --check | 0 | 完整根与常量一致 |
| compare-v16-digests.cjs | 0 | v15/v16三项digest均与既有记录一致 |
| record-v16-inputs.cjs --baseline-commit=… --check | 1 | 所有fixture字节通过，最后audit的sourceDigests失配 |
| verify-m8-herald-fixtures.cjs | 1 | 五份raw与trajectory字节通过，最后manifest的sources/sourceSha256失配 |
| v16-fixture-audit.cjs --baseline-commit=… | 0 | 历史字节与历史身份断言通过 |
| record-v16-live-reveal.cjs --baseline-commit=… --check | 1 | audit的sourceDigests失配 |

三项失败均保留失败退出码；另捕获其比较对象作诊断，剔除 `sourceDigests` 或 `sources/sourceSha256` 后其余字段均严格深相等。未跳过断言、未更新旧指纹、未重录；因此本次不能宣称录制校验全绿。仍需协调者决定源码指纹元数据如何收口；建议另行授权仅刷新已验证等价的元数据，保持状态、golden、raw和trajectory字节不变。

本次机器结果见 [bundle-replacement-verification.json](evidence/v16/bundle-replacement-verification.json)，原始日志与前后逐JS SHA256在本地 `artifacts/v16-bundle-replacement/`。建议提交信息：`refactor(v16): split archive metadata and freeze verified content identities`。未执行Git写操作。

---

# 以下为新base重录历史（2026-10-20）

本轮起点：`codex/epic-loot-reforger`，HEAD `622b19c5be396e14904e02f6ff1a45f0740c22d0`，工作区干净，最新v15已由用户合入。本轮只读Git，不写`.git`，不联网、不安装依赖，不修改`src/server/`、`src/rendering/`或其他表现层源码。

历史基线改为v15收口提交 **`1642beaabee7df800c15250bb07ec6cf2e6bbed0`**，包含#258实时金币导出和v15 Herald/证据重录。`scripts/v16-fixture-audit.cjs`与`scripts/compare-v16-digests.cjs`均使用该完整SHA；测试中没有旧SHA字面量需要替换。本轮不使用`V16_HISTORY_SNAPSHOT`，以只读Git归档核验提交中的真实字节。

9步重录命令及退出码见[EPIC_LOOT_V16录制结果](EPIC_LOOT_V16.md#录制结果)和自动生成的[verification.json](evidence/v16/verification.json)，按以下顺序执行，退出码全部为0：

```text
node scripts/record-v16-release.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0
node tests/fixtures/record-v16-herald.cjs --write
node scripts/record-v16-inputs.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0
node scripts/record-v16-live-reveal.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0
node scripts/record-v16-inputs.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0 --check
node scripts/verify-m8-herald-fixtures.cjs
node scripts/v16-fixture-audit.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0
node scripts/record-v16-live-reveal.cjs --baseline-commit=1642beaabee7df800c15250bb07ec6cf2e6bbed0 --check
node scripts/compare-v16-digests.cjs
```

v15的23个文件与新基线逐字节相同；G2-3/G2-4b的86个历史文件及历史身份断言字节不变。四条release路线各33战，cannon/sniper各67状态；Herald五份raw在导入恢复器前导出，随后验证严格恢复及15tick。实际重跑后，状态、golden和Herald raw字节没有变化；差异是基线元数据和源码指纹。

| digest | 新v15基线 | 本轮v16（与本轮起点相同） |
| --- | --- | --- |
| CONTENT_DIGEST | `70dbb056` | `de829c8a` |
| LOOT_REPLAY_DIGEST | `61568ec0` | `62c76cb9` |
| RULES_GAP_MANIFEST | `97c14bf3` | `31950a0f` |

上表均带`fnv1a32-utf16:`前缀，由两边实际源码重算；本轮没有规则修改或版本变化。

`node node_modules/typescript/bin/tsc --noEmit`和`npm.cmd run build -- --configLoader runner`退出码均为0。体积口径仍为全部`dist/assets/*.js`分别gzip level9后求和，含Phaser：基线424,763 B，当前619,933 B，**比值1.4594797569 ≤ 1.49**。分母为已有本地15313a7构建，本轮未重建该历史产物；文件SHA-256收录于机器记录。

本轮最终测试为**50文件、1,079项通过、0失败、0待执行**。覆盖指定的match-session、opening-random-*、m5-growth、crown-history、两份augment-tier-consistency、g2-2-emissary-wins、d14-*、epic-loot-reforger、live-gold-exports，以及全部直接引用v16的测试和Herald相关行为/恢复/历史golden用例。逐文件、单worker运行，未覆盖全仓库、浏览器或完整网络对局；每份最终结果及首次失败记录均保存在verification.json。

首轮发现4个旧向量问题，仅修改测试，完整复跑4份后全部通过，未修改生产规则、未放宽时限或断言：

| 文件 | 修正与独立依据 |
| --- | --- |
| `m8-b10-encounter-outcomes` | 两份独立BigInt oracle及真实路线一致：seed42的6-7完整顺序为锻造器、Leona、1金、Ekko、4金，替换独立追加流拆分前的旧向量。 |
| `m8-b8-live-growth` | seed48在现行真实路线下两来源前序成长均为0；改为seed74，两张原始Tristana各实际赚取250 Bps，保留双来源、当前战斗2条成长事实、奖励合星、严格恢复及全部篡改拒绝要求，26项通过。 |
| `m8-b8-loot-runtime` | 两份独立字面表oracle确认seed48在3-7掉落Tristana；将原seed0改为48，保留两级合星、1,750 Bps存量、装备/异常转移和出生来源链全部断言。 |
| `m8-b8-token-lifecycle` | 原seed427在1-3掉Maddie；独立商店/掉落表确认seed12的1/4槽可真实购买两张Lux、1-3再获Lux，保留自动合星与所有Combat视图销毁/恢复断言。 |

四个测试文件均不在录制器的sourceDigests/Herald sources集合内；修正后继续核对所有录制源码指纹，验证本轮录制仍对应当前工作区。全部`src/`源码与开工快照一致。建议提交信息：`fix(v16): re-record v15 closeout evidence and refresh reward vectors`。本轮未暂存、提交或执行其他Git写操作，无待决定的玩法问题。

下文是上一轮历史记录，不代表本轮验收。

## 上一轮合并与规则修复记录（归档）

上一轮现场：`codex/epic-loot-reforger` 正在合并 `origin/codex/loot-orb-claim`。该轮未执行任何Git命令、未写`.git`、未联网或安装依赖；未修改`src/server/`、`src/rendering/`。以下合并现场、快照验证和体积数据仅保留为该轮记录；当前以本文开头的新base重录结果为准。

## 1. 合并冲突：14个文件

| 文件/组 | 保留内容与依据 |
| --- | --- |
| `src/presentation/ability-text.ts` | v16 四星数值查询与 v15 中文名称/模板组合，普通星级查询不变。 |
| `loot-view.ts`、`orb-loot.ts` | v16统一重铸器、两种复制器、史诗forge payload，结合v15客户端图标与fallback。 |
| `s13-g23-manifest.ts` | 同时保留D11、D14身份映射。 |
| `vite.config.ts` | 当时保留身份构建方案并结合v15原stripAssetChecks；本次已改为源码拆表与公共身份常量，Phaser chunk保留。 |
| `combat-first-pass-frames`、`g2-4b-artifacts` | 最新实时银行导出形状及v16 revision。 |
| `g2-4a-crown-history`、`helpers/g24-forge-states.ts` | v16工具身份与v15法球领取、共享不可变输入准备组合；不跳过领取/恢复。 |
| `m8-b8-live-capacity/live-transfer/loot-view` | 保留v15既有20秒时限与授权注释，重新核实真实路线、奖励、身份和账本。 |
| `t12-combat-equip` | 保留v15 beforeAll/copyInput；真实路线到4-4验证选择与恢复。 |
| `task-mechanism-restore` | 保留真实触发的v15位置/强化；弗拉基米尔按定义与阵营定位，仍验证castCount及篡改拒绝。 |

测试侧9个冲突文件中，8个测试文件逐文件通过，1个helper由冠冕等真实路线覆盖。法球领取、按卡刷新、终局作废、D11显示、侦察显示和20秒既有时限随最新base保留，未另改这些规则。

## 2. 方案A：复制器独立流

生产实现 `orb-bonuses.ts::orbDuplicatorIndex`，在该珠**全部原内容抽完后**调用，结果只追加末尾entry。

1. `text = JSON.stringify(['orb-duplicator-v16', seatMatchSeed, orbId])`。
2. FNV-1a UTF-16：`h=2166136261`，逐个code unit执行 `h=imul(h XOR codeUnit,16777619)>>>0`，无额外XOR salt。
3. h作为全新lcg32-v1初态、draws=0，每词 `(1664525*state+1013904223) mod 2^32`；拒绝 `word >= floor(2^32/100)*100`，首个合法词 `%100`。
4. 每珠独立重建，仅1–4阶段非棱彩执行。原loot/layout/shop/choice等流均不推进，恢复重建相同追加结果。

派生元数据进入ORB_RULES/digest；合同已更新：[M8B_LOOT §11](M8B_LOOT.md)、[MATCH_CONTRACT v16](MATCH_CONTRACT.md)。

史诗oracle以独立BigInt FNV/LCG核对4,096种子的全部payload、身份、顺序、游标。M5 `oracle.g2.cjs::lootPlan`按冻结表独立重写，不再调用史诗测试oracle，两份oracle在4,096种子上一致，均不导入生产实现。

另实际加载本地保留的v15源码冻结器，比对4,102种子至4-7：去除追加复制器、仅把两个旧重铸器名称映射为已批准的reforger后，**原payload/身份/顺序和主RNG全部相同**。见[原流证据](evidence/v16/premerge-265-legacy-loot.json)。未重新核验该本地归档的提交来源。

MatchSession恢复Lux、Irelia、cloak断言，18项通过。独立算术证明seed7216/6240原1-3均为Lux；第二条为保留用户指定Irelia断言，改用真实seed6160，不伪造6240结果。浏览器seed14349原Lux、弓、棒及羊刀战斗/攻速链均保持原值并通过。

## 3. 四星售价

删除 `D14_POLICY.ultimateSellGold`，文档改为“与该英雄三星同价”。两处私有sellGold投影直接调用 `getUnitSellPrice({definitionId,starLevel:3})`；原出售命令本来就按物理三星调用此函数，继续使用唯一公式。

新增 `d14-sale-price.test.ts`：一费Lux有效四星9金、二费Rell有效四星17金，同时核对单位行、d14Display、真实三星出售差额与9份投影。二费是售价投影边界向量，不扩大终极英雄仅一费的目标准入。退池9份不变。

## 4. 五个红项及真实路线

| 项 | 合并/方案A后的结果与依据 |
| --- | --- |
| crown-history | 56项通过，整文件约30秒；保留v15共享准备优化，未新增时限放宽。 |
| m5-growth | 2项通过；seed8真实资源路线恢复，不再撞异常选择，未削减成长断言。 |
| opening-random-1cost | 4项通过；seed42仍是Irelia，原奖励流/游标恢复。 |
| augment-tier-consistency | 领域7项、服务器2项通过。三张各一次，所以节点初始剩余3、刷一张后2；augmentRerollLimit=1指单卡。base已包含正确实现/期望。 |
| g2-2-emissary-wins | 服务器2项通过。base后排Ambessa已隔离lineup前排防御修正；仅报告，未改服务器及其测试。 |

其他严格向量：capacity seed36为18金、reveal117/final137；transfer seed18619真实触发两张付费Ezreal、slime-time、窃贼手套与奖励合星，19项通过；终局seed38末尾新增次级复制器，精确校验5条状态、4张领取收据，不截掉奖励。进入未知在恢复原流后首空位为bench0，改为严格断言0。

live-reveal恢复v15原种子242874/139464/3464与原补给；tick44的eventSeq382/383、Loris381、Zyra152和4/0收据原断言通过，没有放宽为区间。

额外M5路线：独立表证明seed42两次均为standard史诗变体，严格期望为2锻造器，8原组件+5补给+4锻造等价=17。四份seed42完整golden仍逐项比较；Caitlyn至少两战施法/伤害另由真实付费seed44路线验证（4场、6次施法），保留原次数下界。

本轮未新增超时放宽；既有用户批准的20秒/长重放时限保持。

## 5. 最终v16 epoch

最终源码按release → Herald → inputs → live-reveal完成录制。四条release路线各33战；cannon/sniper各67状态均验证文本/对象恢复、再次序列化字节。Herald五份输入在导入恢复器前先导出raw，再验证原状态及开战后15tick恢复。inputs/live-reveal的`--check`均通过。

| 身份 | 上轮v16录制值 | 本轮最终值 |
| --- | --- | --- |
| CONTENT_DIGEST | `fnv1a32-utf16:f8a31ce9` | `fnv1a32-utf16:de829c8a` |
| LOOT_REPLAY_DIGEST | `fnv1a32-utf16:cee1d7d7` | `fnv1a32-utf16:62c76cb9` |
| RULES_GAP_MANIFEST | `fnv1a32-utf16:81596be6` | `fnv1a32-utf16:31950a0f` |

保留v15 baseline为CONTENT `70dbb056`、LOOT `61568ec0`。规则/内容仍v16；无迁移、兼容别名或历史目录重写。209份历史文件与本轮开始时SHA-256快照相同。

因用户禁止Git，录制器新增显式 `V16_HISTORY_SNAPSHOT` 模式，从本轮固定哈希的本地历史文件读取；只证明本轮历史未变，**不冒充重新核验提交出处**。普通Git归档模式保留。详见[机器记录](evidence/v16/premerge-265-verification.json)。

## 6. 构建与体积

当时 `npm.cmd run build -- --configLoader runner`通过（含tsc）。runner绕过共享node_modules联接下默认esbuild配置加载权限错误，不改变构建目标。该轮构建验证属于历史，本次替换方案与结果见本文开头。

m7-budget口径：全部 `dist/assets/*.js`逐文件gzip level9求和，Phaser chunk计入。基线为此前本地保留15313a7产物，本轮不通过Git重建或核验出处。

| 项 | 测量 |
| --- | ---: |
| 基线gzip | 424,763 B |
| 本轮gzip | 618,719 B |
| 比值 | **1.4566216926 ≤ 1.49** |
| 首次交互中位数（各3样本） | 基线566 ms / 当前619 ms，1.09364倍 |

原1.50预算配置未改；该轮满足用户1.49要求；本次替换后的实测见本文开头。

## 7. 验证、复现与交接

该轮要求范围逐文件27份/635项通过，含两个服务器文件及全部8个冲突测试文件，另覆盖冲突helper；额外M5路线8项及sniper/mage/sniper-caitlyn逐命令、逐tick完整恢复重放3项通过，合计**31文件/646项**。当时tsc/build、原流4,102种子、两份独立oracle、epoch录制/输入校验、历史哈希、浏览器38场景均通过。机器记录列明每份结果与哈希；不代表本次录制检查全部通过。

浏览器约430行Lux/弓/棒原断言保留。`b6-public-preparation.cjs`在结算Continue前补与Start相同的450ms等待：空棋盘立即结束，截图提示“阶段刚切换”，过快点击会持续触发现有保护。只用真实原生输入，不注入资源、不加速战斗、不改界面。38场景、0跳过通过；增加 `M5_NO_GIT=1` 与可选runner，保留源码指纹。

PowerShell复现（先build，使用本机Chrome，无下载）：

```powershell
$env:M5_NO_GIT='1'
$env:VITE_CONFIG_LOADER='runner'
$env:CHROMIUM_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
node scripts/verify-m5-input.cjs --preview
```

建议提交：`fix(v16): merge v15 closeout, isolate orb bonus RNG and use three-star sale prices`。

未暂存、提交或结束合并，这是用户要求保留的现场。协调者继续既有裁表评审并处理索引/提交；无需新的玩法决定。
