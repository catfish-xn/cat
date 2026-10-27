# PR #456：v24 集成 CI 修复

起点：`claude/v24-integration`，`8aa8c627f446f9c31c077fdaf2b488926f2df112`。
本次不修改 `src/`、玩法、游戏数值、版本号或内容摘要，不删除断言，不增加超时，不提交 Git。

## 逐文件原因与改动

| 文件 | 根因 | 修复与保留的验收条件 |
| --- | --- | --- |
| `tests/augment-dynamic-round-boundary.test.ts` | `typeof state` 将辅助函数参数限制成局部对象推断类型，公共命令返回的 `MatchState` 不满足该过窄类型。 | 参数声明为 `MatchState`，不使用类型强转；三种 Pumping Up 的回合成长断言不变。 |
| `tests/augment-pool-batch3-progress.test.ts` | pre-Spoils 基线属于 v23 内容身份。 | 改读独立旧结算实现生成的 v24 基线；完整字节相等、恢复及后续两轮逐步相等全部保留。 |
| `tests/blistering-restore.test.ts` | 491 不再提供 Blistering Strikes。 | 对照种子改为 273，要求真实 Blistering offer 和 Powder 商店；16/648 不变，点燃别名、逐 tick 恢复和全部伪造矩阵不变。 |
| `tests/bracer-multikill-stacks.test.ts` | 59/175 的强化及战斗轨迹漂移；28 改选 Caretaker's Chosen，清理其铁砧会打开 forge，后续出售落在错误阶段。 | 召唤物无/有贡献分别使用种子 5/1，公开选择 Watcher/Sentinel Crest，击杀定位 255/225 tick；保留归属、伤害参与者、0/15 助攻收益和逐 tick 恢复。清理铁砧后公开完成选择；Lux、Renata、死亡持有者的原有精确数值断言不变。 |
| `tests/forming-history-equipment.test.ts` | 2199 的 cannon 路线不再选到 Golemify。 | 使用种子 4，3-2 公开逐槽重选至 Golemify；保留装备归还库存及伪造绑定拒绝。 |
| `tests/g2-4a-crown-history.test.ts` | v24 同一历史证据错误信息新增“扭转命运”。 | 更新三处完整文本；原协调伪造、缺历史/空历史/真实历史、同步/异步入口和合法对照全部保留。详见下文。 |
| `tests/g2-4b-resists-restore.test.ts` | 种子 42 的安静控制卡由 Dominator Crest 变为 Watcher Crest。 | 更新精确卡名预期；赠送弈子留在备战席，133 护盾及所有动态抗性/伪造/恢复断言不变。 |
| `tests/g2-4b-trench-gold.test.ts` | 307 不再提供 Automata Crest。 | 公开选择 Superstars II，新增 Darius 一星前提断言，确保二星奖励不生效；2/1/2 独立中奖向量、5 次付款、RNG 和幂等断言不变。 |
| `tests/m5-audit-boundaries.test.ts` | 文案断言仍指向已修复前的“最后一排”。 | 按已有提交 `73ba5b4c` 改为必须包含“后两排”、不得包含“最后一排”；未改效果规则。 |
| `tests/m5-content.test.ts` | 仍计 v23 的 224 张，独立源表加和遗漏商店/第五批。 | 源表计数加入 `AUGMENT_SHOP`、`AUGMENT_BATCH5`；同时保留独立固定总数 235（224 + 6 + 5），其余内容数值不变。 |
| `tests/m5-match-integration.test.ts` | 42 不再提供 Built Different。 | 改选真实 offer Two Trick，仍要求不发道具、只获取一张强化、陈旧命令不变及完整恢复。 |
| `tests/m6-playback-checkpoints.test.ts` | 公共 fixture 已切换 v24 录像，断言仍绑定 v23 输入与哈希。 | 对齐既有 v24 录像，保留四组固定哈希及全部 seek/逐帧/事件/冻结/防伪断言；新增与本次修复前已提交终态的完整比较。详见下文。 |
| `tests/m8-b6-gate-preparation.test.js` | 307 的实际卡已变；42 不再提供 Guardbreaker Spirit。 | 307 预期改为不送装备的 Superstars II；指定卡路线用 18，仍精确要求 `item-1=gloves`、`item-2=sword` 及缺卡拒绝。 |
| `tests/match-session.test.ts` | 7226 不再提供 Slammin，默认 Crest 会增加弈子。 | 显式选 Starry Night：无弈子赠送，测试之后也不再购买；五轮阵容、唯一结果、单位序号及资源断言不变。 |
| `tests/server/g2-2-emissary-wins.test.ts` | 合成 Ambessa 对照清空强化，却保留新版种子产生的强化进度，正确触发 `invalid-snapshot`。 | 连同卡片清空 `augmentProgress`；真实已结算 PvP 历史不变，仍要求两边护甲/MR 差为胜场差的两倍且实际覆盖不等胜场。 |
| `tests/t7-integration.test.ts` | 42 虽完成 20 轮，但新版池中没有 forge 选择。 | 改为实测种子 3；保留 20 轮、命令预算、所有动作及 augment/component/forge 三类覆盖要求。 |
| `tests/task-mechanism-restore.test.ts` | 与 Bracer 相同的召唤物种子漂移；100 不再提供 Bulky Buddies I。 | 同步 5/1 召唤物向量；Forge 用种子 78，保留死亡/复活后持有者存活和触发旗标双向伪造检查；Sion 错误更新依据见下文。 |
| `tests/v15-anomaly-availability.test.ts` | 强化总数仍为 224。 | 更新为 235；56 个异变、两模式、全部目标及随机区间穷举不变。 |
| `tests/v23-tamper-mechanics.test.ts` | 4 的真实 Maddie/Ambessa 路线即便逐槽重选也不再提供 Betrayal。 | 改为种子 10，同样在 3-2 前部署两位搭档；全部合法恢复、运行时/跨轮事实/奖励收据伪造矩阵不变。 |
| `scripts/verify-m5-input.cjs` | `itemReset` 与 B6 单测共用的 42/Guardbreaker 前提已失效。 | `reset` 接受默认仍为 42 的种子参数，仅 `itemReset` 使用 18；公开 UI 操作及原来的道具断言不变，与 B6 领域适配器一致。 |
| `tests/fixtures/compat/pre-spoils-v24-seed42.json` | 需要 v24 身份、但独立于当前 Spoils 结算实现的基线。 | 新增旧结算实现导出的 JSON，保留原 v23 JSON。 |
| `tests/fixtures/compat/README.md` | 需要可审查的基线来源。 | 记录生成方式与严格限定的五处差异。 |
| `docs/CI_V24_INTEGRATION_FIX.md` | 需要逐文件原因、错误信息依据和验证记录。 | 本报告。 |

## 错误信息为何可以更新

冠冕测试的校验顺序没有改变。`crown-history.ts` 的 `missingCrownHistory()` 在 v24 将同一个错误中的历史依赖名单加入 A Change of Fate（“扭转命运”）。测试仍比较完整错误文本；带真实回放的协调造假仍必须被“历史经济收据”检查拒绝，不能靠新增提示跳过历史认证。

Sion 控制场景从 Long Distance Pals 改为不激活羁绊的 Crest 后，不再经过关系强化的整场 replay 分支。原来的 `buddyTriggered` 反转伪造原样保留，改由 `combat-runtime-facts.ts` 的 Sion 专属事实检查拒绝。该检查使用可信开战输入重演至保存 tick，并精确比较 Sion 的历史触发标记，不是仅验证字段类型或范围。序列化、对象恢复和 JSON 恢复三入口，初始/击杀后两方向，均继续断言拒绝。

## 字节基线依据

Spoils 新基线使用 `8aa8c627` 内容和其余模块，仅在临时 esbuild bundle 中将 `g2-3-settlement.ts` 替换为 `808d16ae` 的 pre-Spoils 实现。导出前执行完整序列化/恢复相等断言，没有手工替换摘要。与原基线递归比较只有：`rulesVersion`、`contentVersion`、`contentDigest`、`combatInputBasis.contentDigest`、`m8.loot.frozen.replayDigest`。战斗、经济、事件收据和 RNG 数据一致。

Playback 输入来自起点提交已经存在的 `tests/fixtures/v24-online-rules-recorded-states/sniper.json.gz` 第 32 轮。旧 v23 输入强化是 Built Different / Long Distance Pals / Mentorship II，归档终态为 741 tick、7240 事件；v24 输入是 Two Trick / Sated Spellweaver / Conqueror Crest，归档终态已经是 717 tick、6771 事件。本次没有修改录像文件或规则。

新的 SHA-256 固定值由原生 `stepCombat` 从该输入逐步计算，未使用 PlaybackSession 的检查点捷径，并且测试额外将终态与上述先前已提交的归档终态深比较：

| 对象 | SHA-256 |
| --- | --- |
| 718 帧原生字节哈希序列 | `7a5d5c10b63d3041b917ba76cb852411ff230eaa55b7782b5c081b40fe0daa27` |
| 完整 BattleRecord | `bb5b714ce49b9c30bac9c7bf9fbf6d3d10ab36295b99b4df9ca52f1df9dc4e52` |
| 完整事件账本 | `95cf261089c946c5fd015404a59f13746937a912bdd339959796ea7db6957f37` |
| 原生终态 | `f451ffdfe0243368629c934e866e2f8304a8c417e62633fe33fa6f9328f616de` |

## 验证

只运行任务列出的 18 个 fast 文件及类型修复文件，共 19 个文件，`--maxWorkers=4`；种子搜索串行执行，未运行全量 suite。

本机 `node_modules` 指向只读共享目录，因此使用 `--configLoader runner --no-cache` 和 `/tmp/cat-v24-vitest.config.ts`。临时配置继承仓库的项目、setupFiles、隔离方式与默认超时；仅将 Vite 缓存放到 `/tmp`，将全局 setup 改为同样的临时 fixture cache 创建/清理，省去无关的浏览器启动。没有持久修改 Vitest 配置。

最终验证（2026-10-27）：

- 上述 19 个测试文件：**19 passed，1437 passed，0 skipped**，耗时 81.56 秒；测试日志 `/tmp/cat-v24-ci-verify.log`。
- 在全部定向测试通过后运行 `npm run typecheck`（`tsc --noEmit`）：**退出码 0**；日志 `/tmp/cat-v24-ci-typecheck.log`。
- `node --check scripts/verify-m5-input.cjs`、`git diff --check`：**通过**。
- 对 19 个文件比较修改前后 `expect` 调用数：均未减少，Trench 增加两个前提断言，Playback 增加一个归档终态断言；超时配置未改。
- 全部 23 个改动文件已列于上表，`src/` 无差异；临时搜索测试已删除，原 v23 基线未修改，HEAD 仍为 `8aa8c627`。

浏览器回归不在本次范围；当前没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，如需运行 native input 回归，应由 Claude 通过 `codex-browser exec` 启动专用任务。
