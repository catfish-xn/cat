# M8 Claude 接手交接（2026-10-10）

> 本文是接手入口，不是新的签收。冻结交接代码：`386293e8cf232a409719c0a622d86bc2403376bb`。最后核对至 09:12 UTC；CI214 仍运行，TG P2 未关闭，浏览器运输修复待真实结果。只整理已有证据，没有为本交接新增实现或重跑测试。

## 1. 最新授权、工作区和接手方式

授权日期 **2026-10-10**，用户消息ID **`Sentinel_2ae6356b3a54819194a31dcc00828ef1`**。用户本次明确调整：**Claude 接手 M8 剩余领域实现和 UI，GPT 独立审查；dot 交接后仅答疑、收集已经运行的 CI，除 Claude 明确请求外不再修改实现。** 新审查节点是 **B8＋U6 完整、B9＋U7 完整、M8 总验收及 main 合并条件**。①②③④保留为实现与证据组织，不再逐点等待批准或签收；旧“②签收前不③”不能继续作为当前阻塞。

这是本次用户新授权，覆盖 `AGENTS.md:5–15` 的旧角色限制（尤其第15行 Claude 不改 simulation/tests/scripts）；本文没有修改 AGENTS 或伪称旧文档已授予权限。第16行 UI 只调用权威公共命令、不能另算规则仍适用。其他冻结规则、性能门槛、预算及合并权限没有扩大。PR #28 仍 Draft、未合并；不要因 CI 绿推导合并许可。

- 工作区：`/workspace/scratch/2d61d723fa5a/cat-b8-phase2`，detached HEAD。
- local HEAD：`6ad3af761bd9898bd6ba71d6bfdc128d1531b7d6`；remote exact-tree：`386293e8cf232a409719c0a622d86bc2403376bb`。
- 完整 tree：`120cd3a8f43a1b510446fbfdac5615ca0f847ce0`；src tree：`16568c527580d74caca79e988bb5e8a1d43a290b`；tests tree：`b39ec475cc82c11ead08bc56fc6ac57d6818e29f`。
- 起草本文之前无 tracked dirty；只有未跟踪 `node_modules -> ../cat-u5-preview/node_modules`。本文是交接新增文档，不是候选代码变化。依赖链接暂留，不跟踪、不删除用户实验。
- 远端 baseline：`f18985131c08c729f5bcf8cc8de8bbd3eec59a3d`；main：`68ddbb6acc7a0a8659fe3bda59c3612a4a996a37`。baseline…B8 ahead50/behind1，merge-base `2acb9acfe90ad7936083fa2c7018dd482b6b222f`。唯一 behind 是 f189 的 `docs/UI_REQUESTS.md` 两行 U5 原审查链接，无生产变化；**尚未同步该提交**，不为交接 merge。
- 历史采用本地提交→GitHub API exact-tree 备份，父提交身份不同属正常；继续追加，不 reset/rebase/force，不伪造本地 commit 对象。最终测试、CI、审查均绑定可从 GitHub 取得的实际 SHA。

### 新容器第一步（说明命令，本次未执行）

```sh
git clone https://github.com/catfish-xn/cat.git cat
cd cat
git fetch origin feat/m8-b8
git switch --track origin/feat/m8-b8 # 新clone中无本地同名分支时
# 已有clone/分支先检查status和本地历史，再按批准流程接手；不要reset覆盖。
git rev-parse HEAD HEAD^{tree}
git status --short
git show 386293e8cf232a409719c0a622d86bc2403376bb:src/simulation/b8-restore.ts >/dev/null
```

接手时 `feat/m8-b8` HEAD将包含本文的后续文档提交，因此不要求HEAD仍等于386293；记录实际交接新HEAD，并检查 `git diff --name-status 386293e8cf232a409719c0a622d86bc2403376bb HEAD` 仅是已说明的交接文档。若出现额外源码变化，先核明归属，不能沿用386293结果。新clone不依赖作者不可达local6ad/4d9。

## 2. B8 实际完成程度与固定版本

长设计以 [B8 handoff](M8_B8_HANDOFF.md)、[M8B loot](M8B_LOOT.md)、[规则](M8_RULES.md)及其现有补充文档为准，不在这里复制。

- **①已正式签收**：`4554f5afee219416be410ff7edbd16ffbeb7daf5`，[外部审查6093790209](https://github.com/catfish-xn/cat/pull/28#issuecomment-6093790209)，无 P0–P3，CI170 同 SHA 绿。原记录必须保留。
- **②已落真实默认链，尚未完成最终独立签收**：死亡揭示、部分击杀/同 tick 多源、直接奖励、唯一收据、满席待授予与出售重试、经济/成长原子结算、combatInputBasis、出生/合成/升级/出售/战斗成长来源谱系，最小真实 loot pendingChoice＋protocol2 selectChoice、必要终局 fallback/满席终局保留及严格恢复。没有临时开发模式或过渡模式 digest 分支。
- **③实际余项**：`readLootView` 尚不存在；LootView 权威只读投影、hidden-info 完整样例、U6 接线及剩余跨轮/终局组合不能当作已实现。最小选择与必要终局逻辑已前移②，不应重写另一套逻辑。
- **④实际余项**：完整 B8 组合收口、所有 B8 延期断言恢复、同最终 SHA 全量/真实 CI/预算/独立审查。两个 P2 见第3节。新负责人按 B8＋U6 完整节点推进，不再等待旧②单独签收。
- 当前开发格式仍 Match schema5/save1/replay1/protocol2，content digest `fnv1a32-utf16:314b4c1f`。正式 schema6/save2/replay2 属 B9，未提前启动。
- 冻结边界：`src/simulation/m8/contracts.ts`、`src/simulation/m8/ui-contracts.ts`、`equipment.ts`、`docs/M8_RULES.md`、G12、LootPayload、DropState、EncounterPreview。接手权限不等于更改冻结玩法/公开合同；遇依赖需明确报告。

### 版本与结果索引

|实际远端 SHA|证据/结果与限制|
|---|---|
|`75c8be53e8ccc7ac669fb8527175b7f46b573662`|CI183：15文件失败、110通过；92失败/1674通过/10既有skip，563.50s。native input两端31例及M7通过；六browser被golden前置阻塞。|
|`d4f6a4a2cda25351ef762fca552bd572be5c1fbe`|相对75c8仅3提交、21 docs路径（含诊断脚本日志），无src/tests/scripts变化；是当时证据HEAD，不是另一个已测代码。|
|`c8543e192589cdc52b2a2119a45d5bfd613d8bf7`|CI200：1840通过/7超时失败/10skip，836.93s；TG＋五Herald＋sniper。input-dev另在M6关闭；六真实browser路线通过。|
|`eecca768f8ee3e88a433e992ef8458e3ce70459e`|保守 string-only 单次恢复 fold 复用；外部定向只读诊断入口，非整体签收。local4d9映射见第4节。|
|`1258682c02020edc7b6b665e448678e0c889c2d4`|local bfaff 同树：本机原全量132文件/1852通过/10skip，505.67s，typecheck/build绿；CI207却TG超5s、input-dev后取消，必须保留两者。|
|`3dc3dd2d634cc64e716630c9a1ff53d65953ff60`|送审文档HEAD，生产仍同eecca。CI208 test132文件/1852通过/10skip，460.04s及后续build/headless/performance通过；整run因input-dev关闭后取消，不能称全绿。|
|`e77dd38da5c525b1915698a0663472724ff1fdcb`|仅增强browser观测；CI209 TG失败，Chrome stderr直接确认100MiB DevTools管道耗尽。|
|`386293e8cf232a409719c0a622d86bc2403376bb`|当前运输修复候选。16专项/6项AST/typecheck通过，src仍16568。CI214截至09:12：132文件通过/1失败，1867通过/1 TG超时失败/10skip，768.88s；input-dev未终态。|

原92项的逐项编号、共同根因及对应修复见 [failure-closure](evidence/m8-b8/checkpoint-two/failure-closure.md) 和 `ci183-failure-cases.json`：81旧来源/重复注入、3旧阶段、8golden；其专项闭环不代表后来性能问题关闭。固定 CI：[183](https://github.com/catfish-xn/cat/actions/runs/38027546769)、[200](https://github.com/catfish-xn/cat/actions/runs/38031091668)、[207](https://github.com/catfish-xn/cat/actions/runs/38034845590)、[208](https://github.com/catfish-xn/cat/actions/runs/38035837492)、[209](https://github.com/catfish-xn/cat/actions/runs/38036259147)、[214](https://github.com/catfish-xn/cat/actions/runs/38039476976)。同源一次通过不能抹掉其他原条件失败；原10 unit skip、5 input B8 skip仍需整批收口，过滤未运行不是新增skip。

## 3. 两个 P2：已知根因、原命令、下一检查

### 3.1 TG 43定义：仍未安全解决

原用例 `tests/m8-b5-temporary.test.ts:187`，43定义、35必要真实路线、原5秒、705断言（含合法命令、每例恢复、续算比较及非法拒绝）均须保留。当前 level6 两槽中每条只产生一个成装，35成装对应35路线；这是当前机制下的准备下界，不是所有可能设计的数学结论。

```sh
npm test -- tests/m8-b5-temporary.test.ts -t 'all 43 eligible child definitions bind through real Match snapshots and restore'
```

外部环境 Node22.23.3/Vitest5.0.3/default workers/隔离/原timeout，4逻辑 Intel Skylake、约8.32GB；整文件＋fold控制29通过/1失败5503ms，随后单例5775ms。CI200该例7596ms，CI2077910ms，CI209/214仍5000ms超时；不要与早期本机5413ms混淆。CI208通过并不能消除可重复失败。

[分段证据](evidence/m8-b8/checkpoint-two/tg43-p2-segmented/)：512候选筛出35 seeds，105战/15969tick。一次本机3022ms中准备2327.34ms约77%（opening2246.75），serialize297.96、实际restore214.52、选seed18.61；重复一次crownguard序列化仅3.75ms，不能解释/填平CI约2910ms差距。诊断机器较快，不作为稳定性关闭。

[有限热点排查](evidence/m8-b8/checkpoint-two/tg-bounded-opening-investigation/)：准备2450采样中unit copy map47.2%、native structuredClone36.1%；未测得恢复主体回退。只在/tmp试过“已有私有clone壳省第二次spread”的保守分支，7个对象/getter/alias/环/异常反例通过，但进程4.01→3.93s不是显著用例收益，也没有完整35路线state/RNG/events/receipts前后证明，**没有落生产**。浅拷贝/整批clone/跨调用cache、改变Lux站位或弃权缩战、TG套用Herald存档例外均未采用；lazy校验也不能删拒绝集。dot本轮有限排查以无安全足够收益收尾。Claude下一步先读既有profile和候选边界，再制定有界方案，不能重复跑直到绿。

### 3.2 input-dev：100MiB运输根因已确认，当前修复待真实CI

正式顺序中原命令：

```sh
node scripts/ci-m5-step.cjs m6-performance node scripts/verify-m6-performance.cjs
```

它在 input-dev 既有 native/touch/layout/storage/components 后运行；input-preview不执行这一M6脚本，不能当同负载对照。CI200/207/208关闭均保留；CI209原stderr在page-close前4ms明确 `Too large read data is pending: capacity=104857600, max_buffer_size=104857600, read=104857600`，随后 `Connection closed, not enough capacity`。page先关且browserConnected=true，之后才catch/finally清理。无OOM/SIGKILL证据；后续32分钟取消不应归因新push。见 [三轮原始日志](evidence/m8-b8/checkpoint-two/ci207-209-first-results/) 与 [关闭观测](evidence/m8-b8/checkpoint-two/browser-close-process-diagnostic/)。

当前 [运输修复和原证据](evidence/m8-b8/checkpoint-two/devtools-fixture-transport/)：相同五真实公开路线普通JSON68699305B，经锁定Playwright1.63.0编码107470221B，完整CDP保守下界107480700B，超过100MiB2623100B。JSON传输会丢19685 alias（3619跨顶层），所以不能简单JSON stringify替代。原生两组 `{complete,fullLoad}` 75143636B、`{current,record}` 32212896B，保完整值图及原字段顺序；518938对象/19685 alias，值SHA256 `091351986d70ca5f08a9aec5881e35d3ddace5946fcff9eb5d2b08681ab20ec4`。

`scripts/m6-fixture-transport.cjs`只用原生handles分组，容量/跨组alias/不支持图均fail-closed，未删payload；handles先dispose，小wrapper取staging立即delete再return原async callback。三个原callback逐字、样本、计时边界、负载和门槛未变。未计时分配路径确有改变，不能据此声称游戏性能提升。完整图浏览器校验在所有原计时之后的独立verificationPage，不在正式页前置重signature，也不是读回正式测量实例。第一版signature预热＋root handle保活候选已撤回并归档。

16专项/6AST/离线真实值图只证明有限层级；本机Chromium socket权限失败后未绕过、未伪造实机通过。**CI214须实际完成原M6 measurements/lifecycle/bounded门禁及后置graph校验才可判定修复**。当前input-dev尚无终态；新诊断保page/context close、disconnect及launch前追加DEBUG=pw:browser（不覆盖已有DEBUG）；不能猜未给出的Chrome exitcode/signal。下一步由既有监控收终态，Claude按实际结果处理。统一外部审查入口 [6095748994](https://github.com/catfish-xn/cat/pull/28#issuecomment-6095748994) 当前v4绑定386293；内部技术预检不构成独立签收。

## 4. 已有修复与证据可直接复用

- **Herald五例明确准备例外**：[证据](evidence/m8-b8/checkpoint-two/herald-raw-fixture-adjustment/)，`tests/fixtures/m8-herald-raw/generate.ts`、`scripts/verify-m8-herald-fixtures.cjs`。完整真实seed42路线，每分支14战5844tick（口述15已更正，不裁剪）；raw在任何restore前导出。五例各自JSON.parse后在原5秒内走完整生产restore和全部原机制/篡改断言，独立副本、不缓存恢复结果。独立可重复“公开生成→导出→restore”约37s，职责不同，不把新旧总耗时当性能提升；例外不适用于TG。复现命令 `node scripts/verify-m8-herald-fixtures.cjs`；不要无故加 `--write` 重生成。
- **sniper重复fold**：[保守版证据](evidence/m8-b8/checkpoint-two/restore-fold-reuse/string-gated/)；同输入143.476→139.334s，12112 restore调用，fold24081→12151，182命令11930tick，最终hash `d3a1a077f60bcd6201bcd166cb3447e546384deb39e09c1bdc0af672018617a8` 相同。该profile不是180s CI解决证明；后续CI207/208/209/214本项未失败。原CI200183.481s已完成但超180s仍保失败。命令 `npm test -- tests/m5-replay.test.ts`；诊断脚本/输入hash在链接目录，不用改变负载。
- **对象getter拒绝回归**：旧未提交unsafe版在首fold后getter改谱系仍接受，二次JSON恢复反而拒绝；当前保守版恢复原拒绝。[三模式反例](evidence/m8-b8/checkpoint-two/restore-fold-reuse/accessor-review/)，`tests/m8-b8-restore-fold-reuse.test.ts`。旧Node24内部PoC与正式Node22专项分开。
- **BoardScene文件例外**：用户曾单独批准真实1-2奖励新增麦迪后create-before-sync，保旧Combat已消费ID展示至Continue销毁，恢复路径旧ID禁拖/售，重复update不重复create。独立生产提交 `07f269c6d9423bf1908a32df327c296a66160081`，证据后接75c8；`lifecycle-targeted*.log.gz`、`token-lifecycle*`及CI183真实31case/M7可复用。当前分工扩大给Claude，不抹去该历史例外；旧undefined.input不能再当纯oracle差异。
- **完整树证据**：local `4d9e5e00269c0ae6d916b58ac92373de2c00b513` 对remote eecca，tree `a0d09f8705588aa96e9fb9741504fbb33075c41e`；[完整files/blob/commit清单](evidence/m8-b8/checkpoint-two/local-4d9-tree-binding/)。初版是作者核对，之后独立审查已完成树核验，不再补证或伪造可达对象。
- **golden独立迁移**：[golden](evidence/m8-b8/checkpoint-two/golden/)及[静态核对](evidence/m8-b8/checkpoint-two/golden-static-review.md)。旧132轮原state/events逐字重现；新规则用独立资源/HP/XP/政策账核对，完整10loot＋5supply保留，19反例与portable原样验证均有原结果。不可单纯重生golden凑绿。领域38轮/33战fixture不等于B9完整应用导入/归档。历史脚本源固定50786a196cdff0762867e2918813a090df4fcac6，不应把当前源码冒充当时受测源。

## 5. 严格恢复与玩法不变量

- 历史战斗用对应开战 `combatInputBasis`，不能用奖励后阵容重建，也不能放宽roster。stock与本战delta分离，真实升级链迁移成长，战斗成长只commit一次。
- 有序resource provenance记录实际出生/合成/升级/出售/战斗成长，完整流先验再取prefix；不能因只恢复早期prefix忽略非法suffix。receipt、birth和death/source身份一一对应，选择待决、选择完成、实际授予不能混同。
- 合法未选loot必须阻止Continue；满席待授予保留，出售后真实重试；重复处理不多资源/ID/RNG/events。经济保9/49/50G＋1→16/60/61、投资80→88/120/120独立向量。
- 当前fold复用仅本次 `restoreMatch(string)` 内、JSON.parse来源且完整prefix完全相同时启用。object入口/直接helper默认false，历史短prefix仍双fold；没有跨调用cache、没有只按ID相等复用。对象getter顺序/非法来源拒绝不能牺牲；未知扩展字段不默认浅拷贝。
- 机制隔离fixture不伪称可保存合法状态；每类正控须真实公共caller，并保相应非法状态精确拒绝。`live-combination-controls.md`及live economy/reveal/growth/capacity/transfer测试给出合法例子，包括部分击杀、同tick、满席终局、立即升星、G12装备转移和篡改。
- 弃用方案：临时checkpoint模式、改默认语义躲选择、奖励后阵容重建、放宽来源/roster、跨调用restore缓存、unsafe对象fold复用、浅克隆/批量克隆、TG原始档夹具、删验收/扩大skip/改timeout或workers，均不是当前解决方案。

## 6. U6 可用接口、缺口与调用示例入口

实际已有权威接口：`encounter-selectors.ts::readEncounterPreview`（match.ts re-export，敌方公开信息、补给null、不暴露隐藏掉落），`item-selectors.ts` 的 `readItemInventory`/`previewCombine`/`previewEquip`/`readUnitEquipment`；冻结形状见 `src/simulation/m8/ui-contracts.ts`。

真实选择命令 `selectChoice(state, choiceId, generation, definitionId)`，薄适配 `src/rendering/match-session.ts::choose(...)`；Continue调用真实nextRound，出售调用sellUnit。失败命令应无资源/ID/RNG/events副作用。loot choice ID为 `JSON.stringify(['m8b-loot-choice', dropId])`，不要与schedule choice混淆。`makeLootPendingChoice`生成generation0、step offer、returnPhase settlement、8component候选、target null、reroll0；它和 `orderedUnresolvedLootChoices` 是内部规则helper，不能充当完整UI投影。

**`readLootView`尚未实现**，现有generic pendingChoice展示不能视为完整U6。禁止直接把 `state.m8.loot.plans`/隐藏冻结计划投影到界面。依 [M8_B8_HANDOFF](M8_B8_HANDOFF.md)、M8B_LOOT/ADDENDUM/OPENING、[UI_REQUESTS](UI_REQUESTS.md)和批准合同补权威view及hidden-info负控，再接UI，不能在scene另算奖励。

可复用真实例子：`tests/m8-b8-live-economy.test.ts`、`m8-b8-live-reveal.test.ts`、`m8-b8-live-growth.test.ts`、`m8-b8-live-capacity.test.ts`、`m8-b8-live-transfer.test.ts`、`tests/fixtures/b8-public-equipment.ts`、`tests/fixtures/m5/oracle.cjs`。具体导出/参数以当前源为准，不把拟议query写成已可用API。

下表描述现有真实Match状态，不伪造尚不存在的LootView返回值：

|合法公开路线入口|已实测字段与预期|
|---|---|
|live-economy 的2-7结算未选择|`pendingChoice.kind='component'`、`step='offer'`，direct已授予receipt存在，choice尚无receipt/resolution；Continue拒绝，strict restore保留待选。|
|同例真实selectChoice选后|新增一次choice receipt和`choiceResolutions.method='player-choice'`，对应item-acquired来源绑定；待选清除，重复选择拒绝且资源/ID/RNG不变。|
|live-capacity seed230的2-7满9席|英雄direct为`status='pending-capacity', receiptId=null`，没有该hero receipt；完成选择仍不能把待授予丢弃，合法出售后变`granted`且唯一出生/receipt，才可继续。|
|live-capacity 4-7致死终局，both sources/only direct source|已赚取的英雄满席为`retained-terminal`且无授予receipt，`pendingChoice=null`；只有实际赚到choice的场景产生`terminalFallbackDefinitionId='tear'`及其唯一inventory receipt，未赚到不补发。|

每个例子的完整state/events/provenance与篡改反控均在对应测试；UI展示文案/布局由Claude设计，消费这些状态必须经权威view而不是暴露隐藏计划。

## 7. 后续完整 M8 交付与正式验收

### 7.1 新分工与旧记录的冲突

第1节新授权优先。除 AGENTS:5–15 外，旧分工还见 `M8_PLAN.md:230`、`M8_CLAUDE_TASKS.md:22,45,186,190`、`M8_DEPENDENCY_MAP.md:125–140`、`UI_REQUESTS.md:136` 及 issue27旧owner；旧②等待条款还见预算计划:158。保留历史记录，但不据此阻止Claude按新完整节点实施。权限调整不扩大玩法、版本、预算或合并权限。

### 7.2 B9＋U7：尚待实施与完整验收

- **正式版本/恢复**：Match schema6/save2/replay2，新规则/内容版本及计算所得digest，B3–B8运行态、正式事件载荷、来源身份、统计/回放索引。当前serialization仍schema5、`src/m6/limits.ts`仍30战；领域33战往返不等于B9完成。依据 `M8_PLAN.md:174–210,227–228`。
- **完整应用**：38推进轮/33战/5补给，不能删首尾三战；文件验证、存储、终态归档、回放、current-prefix/full-load往返。256MiB、每战100000事件、40tick自动保存/检查点、最近3个完成局等边界继续有效，扩容量不放宽性能。依据计划:56,206–210,308,316–319。
- **M7旧档隔离**：D2-A确认M8独立存储命名空间；只读识别、保全、原样导出M7，不自动迁移/重贴包装/补发开场奖励，不用M8引擎播放旧回放。新建/导入失败/Quota/abort/迟到写入不能破坏旧档及好档。依据计划:188–202。
- **U7及U4回放收口**：权威兼容性投影区分可续玩/可回放/仅保全导出/拒绝；新局提示、失败不替换、只读seek/跨战切换；消费正式packetDamage.outcome、cast.receipt、逐笔manaChanged.outcome、activityChanged和冻结来源名称，旧适配不能冒充replay2。依据 `M8_CLAUDE_TASKS.md:180–186`、`UI_REQUESTS.md:104–134`、依赖图:98–101。
- **6-7先锋**：U5已签收合入没有覆盖“实机导入＋完整应用”；两项仍B9，和末战/最后击杀/满席终局保留/归档/回放一起补验。依据UI_REQUESTS:7及计划:306–319。

### 7.3 延期、已签收边界和待核实项

[issue23](https://github.com/catfish-xn/cat/issues/23)仍OPEN。B9逐项恢复完整33战envelope/current-prefix/full-load导入、应用尾3战/归档/browser比较；恢复相应精准skip，保留历史。原载荷选择、12次捕获/写入、12次激活、3次完整导入、冷库首样本、顺序/计时/阈值不能改成≤30战、替代repository前置或0ms。B8真实最大装备链也要恢复并与B9满负载联合验证，最终同SHA完整CI＋独立审查＋关联证据后才可关闭。见 `evidence/m8-b6/deferred-assertions.md:54–83`。

B8硬门槛[6084061298](https://github.com/catfish-xn/cat/issues/23#issuecomment-6084061298)和N2[6091227862](https://github.com/catfish-xn/cat/issues/23#issuecomment-6091227862)继续有效：全部B8 skip解除，战中第1/20/中/末段恢复，新增合法装备状态保存/恢复/续算，非法来源/消费/时序仍拒绝。

[issue27](https://github.com/catfish-xn/cat/issues/27)仍OPEN、非阻塞P3：补U5分类与7属性/合并卡片、折叠保持/跨轮重置、鼠标键盘高亮、棋盘/回放野怪费用角标专属自动回归；不含B9的6-7实机补验。U5已审SHA `855430157b6947d4b9710db3b08f6842f1c9347d`，CI168 [38019557635](https://github.com/catfish-xn/cat/actions/runs/38019557635)，[原审查回填](https://github.com/catfish-xn/cat/pull/26#issuecomment-6093541375)，合并 `d64c381260c4c862d813da7e8c7c983813ce89e0`。不要把新owner当issue自动完成。

44装备中文名仍临时译名，等待同版本中文原档，以字节数/SHA256/来源、Set13/apiName核对；只改显示名和核对状态。89项广范围名称是预算探针，不是官方译名全核验或描述翻译授权。见 `M8_LOCALIZATION_FOLLOWUP.md:3–7`。

**H1** 告警政策有效、根因未关闭：`H1_WARN_ONLY.md:3–9` 保dev1.5MiB/preview1MiB、2预热30循环真实数据；只有完整应用总堆超限warn-only，资源/身份/坏证据/独立模块内存/耗时仍阻断。长度缩放已完成并独立审计，[固定61f0bde结果](https://github.com/catfish-xn/cat/blob/61f0bde7c8cd39fd4d0410ed3a145c27631d3b9b/docs/H1_LENGTH_SCALING_RESULTS.md)未证明增长全为一次性，也未排除慢保留。[固定943ea5e影子校准](https://github.com/catfish-xn/cat/blob/943ea5e74131ecdbcd9381b05c48eff71b700168/docs/H1_SHADOW_CALIBRATION.md)当时2条生效前参考/0前瞻样本，后续样本数未知，不能从新CI绿推断H1解决。

**H3工程事项身份/状态未知**：现有仓库及GitHub检索没取得对应工程记录；M8B_POLICY:95,111的H3仅CommunityDragon来源编号，不可当关闭证据。保留待定位，不猜已签收。

### 7.4 M8总验收及main条件

B8＋U6、B9＋U7经GPT独立审查后，B10以同最终SHA收齐：44装备独立依据/组合矩阵、8遭遇、38轮33战、开场经济/唯一收据、失败/终局、最大合法保存/回放/统计、原延期项、桌面三构筑dev＋preview、根路径与/cat/资源、原输入覆盖和真实新压力负载，形成验收/验证/独立审查文档。正式版本统一切换，首失败、skip解除、预算可追溯，来源未知不能冒充还原。依据 `M8_PLAN.md:227–228,286–368,424–427`。

总验收和独立审查通过也不自动授权main合并/部署；仍按用户明确合并许可执行。本次只交接，不实现、不重测、不合并。

## 8. 预算、工具链、命令与证据保存

现行整批B8累计中档18000B，**严格超过23400B暂停**；基线488964B，因此B8暂停值512364B。总生产包**严格超过552191B暂停**，不在检查点重算。旧13000线触发、等价优化、预算重评历史见[账本](M8_REMAINING_JS_BUDGET_PLAN.md)及[重评](evidence/m8-b8/checkpoint-two/budget-reassessment.md)，不能删。

当前386293同固定源实测：生产 **502898B（＋13934）**，五模块全导出reachable **503479B（＋14515）**，相差581B；B8余量9466/8885B。探针开销包含namespace/导出保留/布局，不能当实际生产成本；原Rollup归因仅 `validateLootPendingChoice` 辅助导出未达生产（198未压缩字节不是精确gzip成本）。生产权威 `validateB8Loot` 重建pendingChoice严格比较，helper shakeout不表示漏校验。原始本轮证据 `/tmp/b8-386293-budget`，原始文本已完整保存于GitHub [PR6095889495](https://github.com/catfish-xn/cat/pull/28#issuecomment-6095889495)，尚未归档到仓库目录；其首次复制路径错误在binding记录，测量没有重跑。此前同值固定证据见[candidate-125868-full](evidence/m8-b8/checkpoint-two/candidate-125868-full/)。

B9中档9000B/严格超过11700B暂停；按B8+B9两暂停线预测总524064B、余28127B，仍须覆盖U6/U7等待估成本，不是B8可继续占用额度。U6/U7旧各3500B只是历史敏感性占位，真实最新成本待估。

```sh
cd /workspace/scratch/2d61d723fa5a/cat-b8-phase2
export PATH=/tmp/b7-npm-cache/_npx/d18f28baf1132559/node_modules/node/bin:$PATH
node --version # v22.23.3
npm test
npm run typecheck
npm run build
node docs/evidence/m8-b8/checkpoint-two/measure.mjs
# 对所有emit JS逐文件gzip9求和；不要改变worker/timeout/门槛。
```

`measure.mjs`当前硬编码基线目录 `/tmp/b8-checkpoint-two-baseline`；新环境必须先准备，不能仅运行候选构建：

```sh
# 先通过环境提供的正式Node工具链确保以下精确版本；不要用默认Node24替代。
node --version # v22.23.3
npm --version  # 11.9.0
npm ci         # 候选使用所检出package-lock.json，不更新锁文件
# 若下列目录已经存在，先核对来源SHA/归档manifest，停止并人工核清；不覆盖/清空。
test ! -e /tmp/b8-checkpoint-two-baseline &&   git worktree add --detach /tmp/b8-checkpoint-two-baseline 2acb9acfe90ad7936083fa2c7018dd482b6b222f
git -C /tmp/b8-checkpoint-two-baseline rev-parse HEAD
# 必须为2acb9acfe90ad7936083fa2c7018dd482b6b222f；已有非git归档用已存manifest校验，不能假称worktree。
(cd /tmp/b8-checkpoint-two-baseline && npm ci)
node docs/evidence/m8-b8/checkpoint-two/measure.mjs
```

新容器可用独立detached worktree或校验过的git archive，基线与候选均用各自锁文件及相同Node22.23.3/npm11.9.0。已有作者基线是归档目录，不应直接把上述git命令失败解释为坏基线。若无法核实现存目录，换干净环境准备，不为方便删覆盖。保存完整版本/命令/逐JS gzip9/baseline数值，基线应488964B；不一致先解释，不用相近值凑账。

命令是接手复现说明，**本次交接没有新运行**。原正式工具链Node22.23.3/npm11.9.0、Vitest5.0.3、Playwright1.63.0；本机缺可用Chromium权限不替代真实CI。baseline归档2acb源码与163个build输入有校验；当前默认Node24仅曾用于明确标注的内部getter反例，不能混作正式包体/性能工具链。

### 保留的临时与归档材料

已归档索引都在 `docs/evidence/m8-b8/checkpoint-two/`：Herald原始夹具、三版fold/getter、golden/portable、TG分段与CPU/弃用候选、CI207–209原日志、browser诊断与运输。运输原20,098,699B压缩档按原字节分为10片，SHA256 `ac266e72cbe24a56a1d01b3700a7c3a459ee23066fba23f8a2d9234b6b20a0ce`；重组命令/每片hash在其README与payload-parts.json，未重新压缩或裁剪。

尚未提交的正式新材料：`/tmp/b8-386293-budget`；监控正在收集 `/workspace/shared/b8-ci214/`，终态未封存。不要把未结束结果写成通过。

历史/tmp也全部保留：`b8-tg43-current-segmented`、`b8-tg35-opening-cpu`、`b8-tg-private-copy`、`b8-fold-accessor-review`、`b8-sniper-replay-diagnosis*`、`b8-string-gated-validation`、`b8-herald-raw-implementation`、`b8-payload-diagnosis`、`b8-native-handle-transport`、`b8-browser-close-diagnostic` 已有相应归档；`b8-capacity-search`、`b8-find-seed.mjs`、`b8-growth-*`、`b8-live-growth-*`、`b8-partial-probe.mjs`、`b8-transfer-*`、`b8-timeout-fix` 是搜索/撤回方案草稿，不能当验收来源，正式路线见已提交live组合证据。`b8-checkpoint-two-baseline`/构建目录是缓存，`b8-tree-binding.py`是作者工具；不删除、不把这些路径假称GitHub可访问。

接手完成前仅可整理本文/既有CI结果。后续实现由Claude负责；GPT依据最终真实SHA独立审查。保留所有首失败和未完成项，不以本机绿、源码等价或内部技术预检代替最终节点签收。
