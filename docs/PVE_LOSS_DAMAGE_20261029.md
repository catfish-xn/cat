# PvE 失败扣血：2026-10-29 用户决定

2026-10-29 10:55 用户批准取代 M8B_OPENING 的“PvE 输固定 3HP、不加存活怪数量”。新规则为 **`max(1, 阶段基础伤害 + 存活野怪数)`**；失败和平局均适用，胜利扣 0。阶段 1–7 基础为 `0/2/5/8/10/12/17`。每只存活敌方单位 +1，不看星级，复用 PvP 的 `countsG23SurvivorDamage`，排除死者、召唤物和非战斗单位。2-7 石甲虫剩 1/2/3 只扣 3/4/5；阶段 1 剩 0/1/2/3/4 只扣 1/1/2/3/4。

## 实现与调用边界

- `match-rules.ts` 补齐阶段 1/7 伤害表项，PvE 与 PvP 共用阶段基础；删除固定 3 参数。`planRoundEconomy` 单独校验合法阶段 2–6，不因伤害表扩展而接受阶段 1/7；开局与加时仍走原有专用上下文。政策升级为 `s13-player-damage-pve-v3` / `m8b-opening-project-v3`，参与原有 manifest/digest。
- `economy.ts:planPlayerDamage` 统一伤害；`planRoundEconomy` 和 `opening-economy.ts:planOpeningEconomy` 共用它。开局输入新增必填 `enemySurvivors`，opening 输出新增真实 `baseDamage`。
- 单机与联机 PvE：`Match` → `resolveRoundEconomy` → 目录/开局 planner；服务器及 LocalRoomClient 沿用该结算。`willDieFromCombat` 的淘汰预测也使用同一 planner。bot 读取权威 HP，没有独立扣血公式。`src/server/` 未修改、未增加计时 API。
- `RoundResult.baseDamage` 表示真实阶段基础，`playerDamage` 表示请求扣血，`hpLost` 表示 HP 钳制后的实扣。序列化恢复重算同一公式，旧固定 3 收据不兼容。
- 金币预览继续调用共享 planner，仍只投影金币/连胜败，不读取敌人推测伤害。遭遇预览补充基础、存活数、最少 1 与排除项；结算文案读取权威收据，同时显示平局/败局的存活数与请求扣血。没有新增网络字段、命令或失败 reason。

## 被取代断言逐条替换

所有原有测试保留，未删除、跳过或放宽检查，未提高任何超时；只替换下列已不成立的答案/前提，并新增独立数值向量。

| 位置 | 旧断言或前提 | 新断言或前提 |
| --- | --- | --- |
| `tests/m5-economy.test.ts` PvE 败/平、阶段2、8只、HP2 | `[baseDamage,playerDamage,hpLost,hpAfter]=[3,3,2,0]` | `[2,10,2,0]`，保留败平、连败和致死钳制检查 |
| 同文件非法阶段 | 1、7 应拒绝 | 恢复并保留原 1、7 拒绝断言；伤害函数另验阶段 1–7，常规经济阶段 2–6 逐项检查 HP 钳制，开局继续由专用 planner 验证 |
| `tests/m8-b6-opening-economy.test.ts` 开局败/平 | 一律3 | 显式输入2只存活野怪，期望2；胜利仍0；补负数/小数/NaN/Infinity存活数拒绝 |
| `tests/match-contract.test.ts` 空场首战 | HP97、playerDamage3 | HP98、baseDamage0、survivingEnemyCount2、playerDamage2；事件列表、原输入、唯一结算、收入全部保留 |
| `tests/match-economy.test.ts` 出售最后单位后的空场首战 | HP97 | HP98（基础0+存活2）；保留 tick0 弃权、原 gold/XP、恢复收入断言 |
| `tests/match-session.test.ts` 空场首战 | HP97 | HP98（基础0+存活2）；保留固定步长、错误阶段拒绝、重复 advance 与 continue 检查 |
| `tests/match-lifecycle.test.ts` 空场首战/致死 | HP97；HP1时请求3、实扣1 | HP98；HP1时base0、存活2、请求2、实扣1；拒绝命令与幂等检查保留 |
| `tests/m8-b6-match-wiring.test.ts` 三次空场开局 | HP97/94/91，每次请求3 | HP98/95/91，请求2/3/4，逐轮base0、存活数2/3/4；恢复、XP、收入、重复继续与终点检查保留 |
| `tests/economy-flow-1023.test.ts` 开局 planner | 败平3 | 显式2只，败平2；原自然XP、收入、零RNG检查保留 |
| 同文件阶段6 PvE 平局 | 存活2只仍3 | 基础12+2=14；连败、补给、加时断言保留。三场开局累计HP91仍正确（2+3+4=9），未修改该断言 |
| `tests/m8-b10-encounter-outcomes.test.ts` 八个PvE节点、零存活、HP3 | 败平始终请求3、实扣3、余0 | 请求依次1/1/1/2/5/8/10/12；逐项核对真实基础、`min(3,damage)`与剩余HP；胜利请求/实扣0、余3不变 |
| `tests/m8-b7-match-wiring.test.ts` 预览精确字符串 | 只有普通野怪规则 | 保留完整原文并追加“基础0+每只存活野怪1，最少扣1生命；召唤物及非战斗单位不计” |
| `tests/fixtures/m5/oracle.g2.cjs` 当前独立结算 oracle | PvE基础3、请求3 | 手工转写阶段表、`max(1,base+survivors)`，不调用生产计算。历史 `oracle.cjs` / `oracle.t13.cjs` 保留原字节 |
| `tests/fixtures/t13-loot-public.ts` 的致死路线前提 | 在3-7也空场认输，按旧固定3扣血抵达4-7时剩3HP | 新规则1-4多1、2-7多2、3-7多7，合计多10；取消3-7空场，让真实阵容获胜，省回该场新伤害10。保留同seed2253、3HP/累计97、三种击杀载体数量及全部严格恢复断言；7项容量/致死测试已通过 |
| `tests/m8-b8-loot-view.test.ts` seed2146装备前提 | 旧空场路线自然留下狂徒、法棒和电刀 | 新3-7胜利会多获得掉落，默认合成顺序先消耗腰带/法棒；通过路线参数保留真实腰带、法棒并优先公开合成狂徒，保留原两次法棒合成、Maddie三件装备、两载体击杀及全部视图/严格恢复断言；8项测试通过 |
| `tests/augment-batch3-verify-public.test.ts` G8 金蛋两项的 4-2 前缀 | seed28 开局后空场认输，原路线可达4-2 | 保留 seed28，只在3-7部署现有备战席打野怪，有备战席空位时再公开买卡，4-1再次清空棋盘，保持原空场4-2自然提供金蛋、无立即奖励、严格恢复及无 PvP 胜利的后续计时检查 |
| `tests/server/batch5-survivor-room.test.ts` seed8 同时淘汰边界 | 持有者存活时24轮/4-7发60金；同批死亡时25轮不发 | 存活持有者路线将 s2 首次出售延到第2轮，让它赢下1-2并与另外两席同批淘汰；23轮/4-6统一验边界，仍精确断言淘汰三席/四席、60金、事件序号、断线重连、对象/JSON认证、幂等与伪造拒绝。后续逐轮检查继续到原25/26轮，总计114项不减 |
| `tests/server/g5-economy-preview.test.ts`、`tests/server/projection-wire.test.ts` 加时前提 | seed0 无运营必达加时 | 改用公开 seed4；仍运行到唯一排名终局，保留逐项预览比较、金币档位、胜败分支、加时序号/名字/结算发布及全部原界限 |

新增 `tests/pve-loss-damage.test.ts`：阶段1–7、存活0/1/2/3/8、胜败平、HP1/100、开局三个节点、石甲虫3/4/5、星级与召唤物/非战斗单位排除、非法阶段及野怪加时拒绝。新增 `tests/server/pve-loss-damage.test.ts`：网络房间与 LocalRoomClient 经公开出售命令制造真实空场，核对基础0、存活2、扣2、HP98；准备截止会自动部署备战席，因此用出售制造空场。

## 统一纪元与重录清单（Claude）

本次不运行任何 `--write`，不修改外层 `M8_VERSION`、`content/identity-constants.ts` 或生成 golden/raw/epoch。工作区仍暂用 v25 外层身份，**不可直接发布**。Claude 合并所有 v26 规则后统一升级身份、重算摘要并重录；以下重算值只是本工作区的检查结果，不能作为合并后的固定目标。

`node scripts/update-content-identities.cjs --check` 已确认失败：

| 根 | 保存的生成常量 | 当前完整根重算值 |
| --- | --- | --- |
| CONTENT | `fnv1a32-utf16:f671ab88` | `fnv1a32-utf16:3d4aa3a3` |
| LOOT_REPLAY | `fnv1a32-utf16:36ebfac2` | `fnv1a32-utf16:f8d94bb5` |

统一重录与固定检查清单（本次全部保留失败检查，不改历史字节或抄写新 hash）：

| 检查入口 | 项数 / 失效原因 | Claude 统一交付要求 |
| --- | --- | --- |
| `tests/epic-loot-reforger.test.ts:191` / `:275` | 2项 `Invalid Match save: history damage`；读取 `tests/fixtures/v25-online-rules-recorded-states/cannon.json.gz` 的5-7/6-7准备态 | 从公开路线生成下一纪元 cannon 输入及配套 manifest/trajectory，重验真实5-7奖励与6-7满席 retained-terminal / forge fallback；不能只换摘要或放宽恢复 |
| `tests/augment-pool-batch5-g4-swarm.test.ts:47` B5-73 | 1项完整序列化 SHA-256 固定值漂移，旧值 `8dedd86620e10240b954970b1f2c544e9dc8275ab65c5c5a2bb59c889bd8178d` | 同一公开命令路线独立导出新纪元字节并更新 hash 与证明；保留 `combat-roster/pvp-roster/deaths` 顺序及严格恢复断言 |
| `tests/t11-golden.test.ts:22` | 1项当前 `OPENING_ECONOMY_RULES.version` 为 `m8b-opening-project-v3`，历史 T11 baseline 为v2 | 同步当前规则版本与历史基线的关系断言；保留 T11 历史 baseline/audit/golden 字节与旧档拒绝，不覆盖历史版本来凑相等 |
| `tests/m8-b7-match-wiring.test.ts` Herald 原始存档 | 5项 `Invalid Match save: history damage`；`tests/fixtures/v25-online-rules-herald-raw/` 的 `ionic-spark.json`、`evenshroud.json`、`ionic-spark--evenshroud.json`、`quicksilver.json`、`edge-of-night.json` | 从公开路线生成下一纪元五份输入及目录内 manifest/trajectory，重新验装备/控制互动、恢复与继续；不可删字段、放宽校验或只换hash |

PvE 即使全胜也会在历史中保存 `baseDamage`，旧输入的固定3不再合法。上述9项属于已知的统一纪元/固定检查工作；路线提前淘汰属于测试输入问题，已在本轮单独修正，不归入重录清单。

统一纪元还需核对：`tests/fixtures/m5/full-match-golden.v25-online-rules.json`、`tests/fixtures/v25-online-rules-recorded-states/`、`v25-online-rules-b8-fingerprints.json`、`v25-online-rules-c19-seed-9-minimal.json`、`v25-online-rules-transfer-route.json`、`v25-online-rules-chest-trial.json` 及对应 `docs/evidence/v25-online-rules/`。这些是受身份/完整历史影响的候选清单，本任务未逐份运行纪元录制检查。相关检查入口为 `verify-v25-online-rules-epoch.cjs` 的 identities、battle-start、release、Herald、inputs、live-reveal、transfer、history、chest-trial、consumer-byte-audit、compare-digests；应由下一纪元入口统一交付，不覆盖历史纪元证据。

## 验证与限制

所有 Vitest 命令使用 `--maxWorkers=4`，按伤害、开局、结算、恢复、房间/本地房间、预览及法球影响面选文件。环境没有浏览器连接变量，任务不做浏览器验收；临时 `artifacts/pvedmg/vitest.config.ts` 仅移除全局浏览器启动、将缓存放入可写目录，不更改测试、超时或生产配置。使用 `--configLoader runner` 避免向只读共享 node_modules 写 Vite 临时配置。

本轮 Opus 审查修订按每个文件最后一次完整执行结果去重：20个相关文件共610项，601通过、9失败、0未执行；9项失败全部对应上方统一清单。逐文件统计和来源见 `artifacts/pvedmg/review-final-summary.json`（本地忽略证据）。`npm run typecheck` 与 `git diff --check` 通过；`update-content-identities.cjs --check` 仍按预期报上表两处漂移。中途 seed 搜索、失败路线与 `-t` 定位运行不计入最终汇总，不用筛选运行的跳过项充当通过。

金蛋整份77项、Survivor四种向量共114项、两份服务器加时/投影共11项全部通过；空场旧断言所在的经济/Session文件共108项通过。所有原超时保持不变。

`playtest-1022b-bench.test.ts` 已通过；其生成的 `docs/evidence/playtest-1022b/bench-timing.json` 已按运行前备份逐字节还原。未写 `.git`、未提交、未新增素材。
