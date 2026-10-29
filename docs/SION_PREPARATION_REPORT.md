# 【现状】

本次基线为 `claude/v26-sion-prep` / `4baaaf5a9a74335d46fa0e037a93e4e595f05384`，开工工作区干净；未写 `.git`，未提交。以下“原实现”指该 HEAD，行号为基线行号；“完成”引用当前文件。

本轮为 Opus 审查修订：接续已有未提交实现，保留其界面/服务器接线；本轮仅修改规则、回归测试和合同/报告，分支及HEAD未变。下文测试数据已更新为修订后的结果。

| 核查项 | 原实现及定位 | 与用户指定的14.24行为对照 |
| --- | --- | --- |
| 生成时机 | `src/simulation/strategy-snapshot.ts:122` 编译投影，`src/simulation/combat.ts:49` 开战构造投影，`:120` 交给 `spawnCombatUnit`；准备状态没有赛恩资产 | 未满足“备战出现”。现已补备战棋盘投影，不把赛恩铸造成永久英雄 |
| 默认位置 | `src/simulation/g2-3-summons.ts:27` 己方 `(3,4)`；上方席位镜像为 `(3,3)`；占用则按部署区行、列找空格 | 位置为项目约定，研究报告未证明原版固定格 |
| 玩家移动 | `src/simulation/g2-4b-voidspawn.ts:63` 只返回虚空生物和熔炉；`:75` 的移动命令无法找到赛恩 | 未满足“可移动” |
| 联机可见 | `src/server/room/projection.ts:62` / `:195` 只复制 `readItemSummons`，所以公开与私有准备棋盘都不包含赛恩 | 现已补公开侦察及本席可移动投影 |
| 战斗快照 | `src/simulation/two-sided-snapshot.ts:74` 禁止在 `snapshot.units` 塞召唤物；`src/simulation/two-sided-battle.ts:96` 投影，`src/simulation/combat.ts:127` 发初始束缚事件 | 保留隔离战斗实体与一次生成事件，新增保存站位的冻结传递 |
| 战后移除 | `src/simulation/match.ts:640` 的换轮在`:669`清空 combat，保留永久玩家阵容；赛恩从未进入该阵容 | 战斗实体只留在本战/回放；下一准备期重建棋盘投影，不继承残血、解缚或复活状态 |
| 人口、备战席 | `src/simulation/content/g2-3-summons.ts:7` 为 `countsTowardPopulation:false`；`src/simulation/game.ts:63` 人口计数不计它；准备资产中也无它 | 不占人口、不占备战席 |
| 出售、装备 | 同一召唤物定义为 `sellable:false`；普通出售入口 `src/simulation/match.ts:385`、装备入口`:758`均要求本席永久资产，投影id为 `unknown-unit` | 保持不可出售、不可装备；普通部署到备战席同样拒绝 |

研究证据边界：已完整读取 `/home/aiapps/workspace/control-sion-research-2026-10-24/report-zh.md`。其 C6（`:340`，表`:356`起）把“何时生成、是否固定格、玩家能否挪动”标为**未确认**；全文未覆盖是否占人口/备战席、能否出售/装装备。因此不能把本次准备期交互称为该报告已证实的14.24行为。本次依据是用户2026-10-29明确决定，其他战斗数值沿用10-24已批准实现。

# 【完成】

- `src/simulation/strategy-membership.ts:12`、`src/simulation/strategy-snapshot.ts:92`、`src/simulation/g2-4b-voidspawn.ts:64`：提取并共用战斗编译的成员投影，依序包含镜厅、R3复制体、装备纹章、临时成员来源及 `r3Traits`；准备期三档起投影一只 `kind:'sion'`，占格也使用同一有效阵容。无需开战，移动/出售成员及换装备后下一次状态投影立即重新判断。复制产生的杰斯熔炉不开放无永久持有者的位置键，避免写入无法恢复的站位。
- `src/simulation/g2-3-summons.ts:17`：新增席位位置键 `g23-sion`。它不绑定命名成员，成员更换/出售/合星不会清掉站位；降档隐藏，再激活沿用。保存格被英雄占用时找最近空格；未拖动的默认行列搜索保持原实现。无空格仍沿用不重叠生成的约定。
- `src/simulation/g2-4b-voidspawn.ts:84`：准备期及备战内强化选择窗口可拖动；锁阵容、淘汰、其他选择、战斗、结算仍拒绝。只接受本人部署区的整数空格；成功不改变金币、资源、RNG、人口、备战席或共享池，仅保存位置并发原有 `seatMechanicChanged`。
- `src/simulation/strategy-snapshot.ts:148`、`src/simulation/combat.ts:49`：冻结位置到 `summonCell`；开战按命名空间恢复位置。赛恩仍是羁绊战斗召唤物，不误标成物品召唤物；不重复生成或重复发束缚事件。
- `src/simulation/two-sided-snapshot.ts:59` / `:210`、`src/simulation/two-sided-battle.ts:63`：快照保存席位键，该键不误映射成装备id；上方席位坐标只镜像一次。`snapshot.units` 禁止塞赛恩的断言保持。`src/simulation/serialization-structure.ts:348`恢复时使用编译后的有效羁绊，包含纹章触发的赛恩。
- `src/simulation/two-sided-battle.ts:96`：PvP单侧投影始终传 `compiled.traits`，修正原先仅R3分支传羁绊而遗漏纹章的情况。`tests/sion-preparation.test.ts:120` 通过公开事务把赛恩拖到 `(5,6)` 后将杰斯移到 `(5,5)`；两侧含纹章的三档赛恩先占格、默认熔炉让到 `(0,4)`，敌方分别镜像到 `(5,1)` / `(0,3)`。同时验证PvE、PvP开战前投影、开战实体、镜像身份、恢复及各一次召唤/束缚事件。
- `src/server/room/projection.ts:195`、`src/server/protocol.ts:129`：私有视图增加赛恩种类，公开棋盘自动包含赛恩与 `summon:true`，不泄露成员id/位置键。服务器继续只转发规则结果，未新增时钟或调度逻辑。
- `src/rendering/match-session.ts:112`、`src/rendering/online/remote-session.ts:305`、`src/rendering/BoardScene.ts:633` / `:718`：单人、本地房间、远程会话共用显示和移动通道；补赛恩中文提示、禁售提示及强化窗口可拖动。2D token和3D BoardFrame/回调共用，不另算规则。
- `src/simulation/bot/formation.ts:16`：审查后保留现有机器人策略，只对永久英雄布阵；赛恩随后在剩余格中投影，不占选人名额。机器人不新增赛恩移动意图，不改既有自动布阵结果；保存格被英雄占用时由规则统一让位。新增测试验证布阵收敛、无重叠、无卖出/回备战席意图、位置键仍在。
- `src/simulation/content/g2-3-summons.ts:14`：新增 `sion-preparation-v1` 规则修订及放置/阶段语义，进入完整内容与loot摘要。同步 `docs/MATCH_CONTRACT.md` 的可移动召唤物合同、`docs/MULTIPLAYER_CONTRACT.md` §26.1。
- `docs/MATCH_CONTRACT.md:1333`、`docs/MULTIPLAYER_CONTRACT.md:2166`：明确默认 `(3,4)`、不占人口/备战席、不可出售/装备、公开显示同虚空生物/熔炉、`g23-sion` 位置键整局保留均为项目约定。本分支保持强化窗口可拖赛恩；普通英雄在强化窗口上下棋盘由 D2 `claude/v26-d2-brb` 解锁，合并后统一，不重复施工。

全部生产调用点：

| 通道 | 调用链及文件:行 |
| --- | --- |
| 本席/公开准备棋盘 | `src/simulation/g2-4b-voidspawn.ts:80 readItemSummons` → `:64 movableSummons` → `src/simulation/strategy-membership.ts:12 projectStrategyMembership` → `g2-4b-voidspawn.ts:41 projectVoidspawns` → `src/simulation/g2-3-summons.ts:22 projectG23Summons`；消费者为 `src/server/room/projection.ts:62 toPublicBoard`、`:195 toItemSummonViews`、`src/rendering/match-session.ts:112 itemSummons` |
| 单人移动 | `src/rendering/BoardScene.ts:633 dropAt` → `src/rendering/match-session.ts:106` → `src/simulation/g2-4b-voidspawn.ts:87 moveItemSummon` → `writeSeatMechanic` |
| 联机移动 | 同一 dropAt → `src/rendering/online/remote-session.ts:303` → 网络 `src/server/net/messages.ts:254` 校验或本地 `src/rendering/online/local-room-client.ts:119 send` → `src/server/room/room.ts:143`阶段门 / `:176`分派 → 同一规则移动函数；公开入口 `src/simulation/match.ts:1061`、`src/server-entry/index.ts:11` |
| 2D和3D | `src/rendering/BoardScene.ts:718 shownSummons` → `:926 reconcileTokens` → UnitView；`:1432 boardFrame` → `src/rendering/three-mode/placeholder-renderer.ts` / ModelCache；3D输入 `BoardScene.ts:653 boardControls`回到同一`:633 dropAt` |
| 单人/PvE冻结 | `src/simulation/combat-input.ts:87`读位置 → `src/simulation/strategy-snapshot.ts:92`共用成员投影 / `:111`投影召唤物 / `:148`冻结位置 → `src/simulation/combat.ts:49`重建 / `:120`一次性加入战斗；`startMatchCombat`及其分步路径共用这些函数 |
| 双边/PvP冻结 | `src/simulation/two-sided-snapshot.ts:210`保存 / `:59`校验 → `src/simulation/two-sided-battle.ts:63`重映射 / `:96`单侧投影、镜像 → 同一 Combat 构造；克隆/镜像阵容的原有 `projectR3Preparation`调用路径保留 |
| 保存恢复 | `src/simulation/combat-input.ts:131`、`src/simulation/serialization-structure.ts:327`验证保存键，`:348`重建召唤物来源；双边快照恢复、重编译沿用同一校验器 |
| 机器人 | `src/simulation/bot/index.ts:64`调用 `src/simulation/bot/formation.ts:16`；服务器 `src/server/room/bot-driver.ts`走原有命令执行通道，未新增第二套摆放算法 |

旧断言逐条核对：

1. **测试断言删除0条、弱化0条、替换0条**。旧的战斗数值、默认位置、战斗事件、快照禁止召唤物资产等断言全部保留；两个已有显示测试文件只补测试/必要显示替身元数据。
2. 位置键规则原仅允许 `item-N / unit-N`（`validateItemSummonPositions`），现在额外允许**精确**的 `g23-sion`；未来序号、坐标整数、部署区、字段白名单校验仍在。新增断言拒绝 `g23-sion-x`、小数、敌方格。
3. 双边快照原要求每个位置键对应所带装备或杰斯（`two-sided-snapshot.ts:70`），现在额外允许席位赛恩键；它可在暂时降档时保留，但不据此创建赛恩。普通名单仍禁止塞入赛恩，新增篡改测试确认拒绝。
4. 移动相位旧为严格 `preparation`，现在补 `augment + returnPhase:'preparation'`；其他选择、锁阵容、淘汰及masterwork仍拒绝。新增实际走到2-1强化窗口的测试，未用放宽失败断言掩盖问题。

# 【测试】

- `npm run typecheck`：通过，日志 `artifacts/sionprep/review-typecheck-final.log`。
- 审查修订相关 Vitest：**25文件、298测试通过**，全部使用 `--maxWorkers=4`；日志 `artifacts/sionprep/review-tests.log`、`review-regressions.log`。包含新增赛恩领域/真实Room/LocalRoomClient/RemoteSession测试，R3复制体/镜厅/装备/星级回归、有效羁绊与纹章来源，以及既有赛恩数值与控制、黑玫战斗、杰斯熔炉、传送门、投影、战斗操作、机器人、2D token生命周期和3D隔离/模型拾取测试。末次位置键保护补充验证见 `review-summons-final.log`。
- `tests/sion-preparation.test.ts:162`：独立向量验证R3复制体/镜厅把2名原生黑玫提升到3档，准备期即可拖赛恩、开战身份/位置相同；取消效果隐藏但保留位置，镜厅换为非黑玫中心后计数归零，复制占格仍原子拒绝，读取投影不修改输入。
- 没有提高任何超时。当前无浏览器桥环境变量；采用忽略目录内的临时配置 `artifacts/sionprep/vitest.config.ts`，仅关闭与这些测试无关的共享浏览器启动 globalSetup，保留原项目、worker setup和所有断言；没有自行启动Chrome。
- 可复跑：下列命令使用本次保留在忽略目录内的临时配置。核心新增文件 `tests/sion-preparation.test.ts`、`tests/server/sion-preparation.test.ts`；共享交易输入 `tests/fixtures/sion-preparation.ts`。

```sh
npx vitest run --config artifacts/sionprep/vitest.config.ts --configLoader runner --project fast \
  tests/sion-preparation.test.ts tests/server/sion-preparation.test.ts \
  tests/m8-b8-token-lifecycle.test.ts tests/rendering3d-jayce-forge.test.ts tests/rendering3d-isolation.test.ts \
  tests/sion-rework.test.ts tests/v23-review-sion.test.ts tests/v23-rules-verify-sion-cc.test.ts \
  tests/trait-runtime-g23.test.ts tests/jayce-forge-placement.test.ts tests/jayce-forge-owner-keys.test.ts \
  tests/g2-4b-voidspawn.test.ts tests/server/g24-voidspawn-move.test.ts \
  tests/server/t10-combat-ops.test.ts tests/server/projection.test.ts tests/t7-bot-policy.test.ts --maxWorkers=4

npx vitest run --config artifacts/sionprep/vitest.config.ts --configLoader runner --project fast \
  tests/augment-pool-batch5-r3-cloning.test.ts tests/augment-pool-batch5-r3-mirrors.test.ts \
  tests/augment-pool-batch5-r3-equipment.test.ts tests/augment-pool-batch5-r3-fourth-star.test.ts \
  tests/t2-two-sided-battle.test.ts tests/s13-trait-augment-membership.test.ts tests/s13-trait-projection.test.ts \
  tests/v20-traits.test.ts tests/trait-column-emblems.test.ts --maxWorkers=4
```

- `npx vite build --configLoader runner --outDir artifacts/sionprep/dist`：通过。顶层 `assets/*.js` 逐文件 `gzip -n -9c`相加为 **626,852 B ≤ 637,144 B**，余量 **10,292 B**；日志 `review-build-final.log`，计量 `artifacts/sionprep/review-size.json`。原2D/3D隔离测试的全部静态导入、动态加载和gzip预算断言通过。构建/数据均在忽略目录，未提交生成物。
- 只读HEAD对照（本轮重新执行）：对3/4/5/7档、无黑玫、与熔炉混编、双边与单侧构造共**18场**，分别比较初始状态、终局状态、完整事件数组的SHA-256，差异**0**。代码从 `git show HEAD:...`读取并独立bundle，没有写Git。证据 `artifacts/sionprep/review-combat-bytes.log`、`combat-byte-report.json`、`combat-bytes-baseline.json`、`combat-bytes-current.json`。
- `git diff --check`通过；新增服务器源码行不含 `setTimeout / Date.now / performance.now / window`，未删/弱化既有测试断言或提高超时；素材/生成物未进入Git改动清单。末次审计见 `artifacts/sionprep/review-final-audit.json`。

# 【需要重录】

- **按用户要求未执行任何 `--write`，未改现有fixture文件。** 新增的是测试输入构造器，不是历史对局重录。
- `node scripts/update-content-identities.cjs --check`预期失败：现存content=`fnv1a32-utf16:f671ab88`、loot=`fnv1a32-utf16:36ebfac2`；当前完整源码重算应为content=`fnv1a32-utf16:454f55db`、loot=`fnv1a32-utf16:73d95fed`。修订已纳入规则清单，身份常量和全局v25纪元留Claude一起更新。
- 需统一处理 `src/simulation/content/identity-constants.ts`、v25源码摘要/纪元证据、`tests/v25-online-rules-content-baseline.json`、`tests/fixtures/m5/full-match-golden.v25-online-rules.json`、`tests/fixtures/v25-online-rules-recorded-states/*.json.gz`及相应录制器衍生物；不用本次局部检查宣称整个纪元已验收。
- **现有对局fixture的战斗结果字节：未发现需要因本改动改写的结果。** 本轮重新执行的18场默认站位对照完全相同，重扫431个既有测试JSON/GZip文件，未含本次新增赛恩保存位置（`artifacts/sionprep/review-final-audit.json`）。手动调整赛恩站位是新输入，当然可能改变战果。统一更换content/loot身份后，既有序列化fixture的身份字段及其哈希会变化，须由Claude重录；本次未跑全部v25整局录制，不能给出其逐文件重录结果清单。

# 【需要我决定】

无。备战可见、可拖动按10-29指令完成；人口/备战席/出售/装备与格子冲突处理沿用现有召唤物约束，赛恩其他战斗数值未改。

# 【风险】

- 当前内容身份常量有意保留旧值，**不能在Claude统一重录并验收v25纪元前当成发布候选**。
- 2D/3D覆盖包含真实BoardScene回调、模型加载与射线拾取，但GPU/DOM使用替身。当前未设置 `CODEX_BROWSER_CLIENT / PLAYWRIGHT_WS_ENDPOINT`；真实桌面Chromium、WebSocket重连及3D观感验收需要Claude使用 `codex-browser exec`新启动浏览器测试任务；未冒充已完成实机拖动。
- 棋盘整个半场占满时沿用省略召唤物的既有约定；本次不挤走英雄或新增备战席人口。历史14.24交互证据缺口仍以研究报告的“未确认”为准。
