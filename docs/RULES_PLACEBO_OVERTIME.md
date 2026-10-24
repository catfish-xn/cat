# 10-23 安慰剂分阶段金币与战斗加时实现报告

基线：`codex/rules-placebo-overtime@1e5eb0ea`，工作区起始干净。此提交包含PR9的v21录制及后续Crown修正；本地没有`codex/encounters-pr9-epoch`引用，按用户要求不联网核对PR #410。未commit，未改表现层、服务器、CI及历史夹具。

## 规则及整数顺序

- `choiceAcquisitionGold(definition: ChoiceDefinition, round: number): number`：按round目录的stage读取`acquisitionGold.amount/stage3Amount/stage4Amount`；2阶段（以及不可正常获得的1阶段）取amount，3取stage3Amount，4及以后取stage4Amount。可选分段字段不存在时保持其他强化的原固定金币。Match选择事务一次加金币并写唯一schedule receipt；恢复用receipt.round，不用当前state.round。失败/重复选择的state引用、资源、RNG不变。自然节点仍只有2-1/3-2/4-2；5-x向量只验证通用计算，不新增强化获取入口。
- `overtimeStacks(tick: number): number`：tick<600为0；否则`1+floor((tick-600)/20)`。tick来自Combat时钟，不存层数，不引入RNG调用。`overtimeBonusBps(tick)`为层数×1000，`overtimeReceivedBps(tick)`为`10000-min(7000,层数×1000)`。
- 伤害：加时进入现有加法damageAmp项，按原管线先抗性，再增伤/减伤整数取整；真实伤害也读增伤。已经减伤的弹射/分担与死亡之蔑延期支付不二次放大。无新攻击/施法触发或RNG词。
- 攻速：加时Bps与已有静态/动态攻速相加，再由原基础攻速算最终间隔；1.0基础攻速的公式为`max(1,ceil(20*10000/(10000+bonusBps)))`。旧剩余冷却不重写。维克托固定0.55攻速及Silvermere Dawn的攻速锁遵循既有覆盖语义；维克托的额外攻速仍按既有转换进入AP。旧式野怪的精确整数间隔也按加时加速，避免基础攻速反算误差。无普遍攻速上限新增。
- 治疗：所有直接治疗/周期治疗/吸血都经过`commitMechanismHeal→resolveHeal`。先`floor(requested*(10000-woundBps)/10000)`，再乘加时接收率并floor，最后缺血封顶。保留原事件形状：`afterWound`为两种接收削减之后的额度，`preventedByWound`及shares同名字段包含重伤和加时的合计阻止量；并非只表示重伤状态。各来源最大余数分配仍守恒，死者不复活。
- 护盾：两种授予入口都进入`grantShieldState`，先沿原有reave削减，再乘加时接收率并floor；刷新取`max(旧剩余,本次削减后的新量)`，旧盾不回减。衰减基数绑定实际授予量。
- 控制：全部现有控制（包括击飞等统一建模为stun的效果）在`applyStatusContribution`计算新到期时间时缩短；`overtimeControlTicks(duration,tick)=max(1,floor((duration*receivedBps+5000)/10000))`，正数四舍五入半入。原始声明不改，新状态仍下一tick生效；同源刷新沿用原始起点并取更晚到期，已存在控制不回改。非控制的削甲、重伤、引导、放逐等语义不变。
- tick900先完整行动与结算，然后消灭优先；双方仍活才timeout→draw。固定50ms与回放事件账本不变。恢复、战中装备effectiveTick、结算收据、回放上界均读900常量；技能自身60秒持续量不属于战斗上限，保留。
- 加时后的存档使用既有输入绑定的独立完整重执行校验（缓存只存可信计算），精确认证旧盾保留、控制刷新及所有运行态，不从候选层数或刷新时间猜历史。无新持久化字段/命令/失败reason；非法数据仍走已有恢复错误，低层新selector假定传入合法的非负整数tick/正整数duration。

## 手算向量

| 获得轮次 | 安慰剂 | 安慰剂+ |
|---|---:|---:|
| 2-1 | 8 | 15 |
| 3-2 | 11 | 18 |
| 4-2 | 15 | 22 |
| 5-1、5-7 | 15 | 22 |

| tick | 层数 | 100原伤害，无抗性/暴击/其他增伤 | 1.0基础AS间隔tick | 101治疗/新盾 | 20tick新控制 |
|---|---:|---:|---:|---:|---:|
| 599 | 0 | 100 | 20 | 101 | 20 |
| 600、619 | 1 | 110 | 19 | 90 | 18 |
| 620 | 2 | 120 | 17 | 80 | 16 |
| 720 | 7 | 170 | 12 | 30 | 6 |
| 740 | 8 | 180 | 12 | 30 | 6 |
| 899 | 15 | 250 | 8 | 30 | 6 |
| 900 | 16 | 260 | 8 | 30 | 6 |

舍入独立例：5tick×90%=4.5→5；15tick×30%=4.5→5；1tick×30%=0.3→最少1。101治疗受33%重伤再加时1层：101→67→60，阻止41。旧盾101在7层刷新101基础盾，保留101，非再次削减为30。

## 移速与Claude交接

（10-23 Claude 补）用户批准加时移速+50%：`S13_COMBAT_RULES.overtimeMoveSpeedBonusBps=5000`，`movementIntervalTicks(frenzy,tick)`统一普通/沃里克移动冷却：加时前不变，加时中按固定tick网格精确+50%（4,3,3循环）；迅击`quickstrikerMoveTenths`加时中4/5交替。位移技能和模拟推进速率不变。

未发现表现层将战斗上限硬编码为60秒：`src/rendering/BoardScene.ts:1247`已读`combat.maxTicks*COMBAT_TICK_MS`，应自然显示45秒；`src/rendering/online/players-sidebar.ts:151`显示服务端deadline的剩余秒数。两处交Claude真机核对；本单未改视觉代码。`src/server/room/room.ts:133,1430`、`src/server/room/types.ts:78`仍有1200注释/步进预算（较大预算不会突破领域900上限），交Claude清理。`build-badge.ts:13`的60秒是版本轮询，与战斗无关。

## 来源及待发布限制

用户2026-10-23拍板为30/45秒与安慰剂分阶段规则的直接依据；安慰剂明确记P（项目决定），安慰剂+15/18/22按用户本单暂定授权实施。加时各项10%及70%封顶引用用户提供的[Riot TFT 13.22补丁说明](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-13-22-notes/)，本单未联网复核。固定移速加成数值未定。

按指令保留v21身份常量及所有epoch/golden原字节，未运行身份更新/录制脚本。当前新规则与旧digest/epoch身份暂不一致，不能发布或与旧版混跑；PR #410合并后由统一epoch任务升级并重新录制。新测试是独立数值向量，未修改任何已有测试断言。

## 改动文件与定位

以下行号对应本次最终工作树；纯import行省略时由后续实现行定位。

| 文件 | 行号 |
|---|---|
| [M5_RULES.md](../M5_RULES.md) | 306, 393 |
| [docs/COMBAT_CONTRACT.md](../docs/COMBAT_CONTRACT.md) | 1, 55, 64 |
| [docs/M8_RULES.md](../docs/M8_RULES.md) | 1 |
| [docs/MATCH_CONTRACT.md](../docs/MATCH_CONTRACT.md) | 1 |
| [docs/MULTIPLAYER_CONTRACT.md](../docs/MULTIPLAYER_CONTRACT.md) | 1, 721, 928, 989, 1340 |
| [docs/S13_RULES_GAP.md](../docs/S13_RULES_GAP.md) | 1 |
| [src/simulation/battle-equipment.ts](../src/simulation/battle-equipment.ts) | 1, 36 |
| [src/simulation/combat-replay-view.ts](../src/simulation/combat-replay-view.ts) | 1, 162, 183, 202 |
| [src/simulation/combat-s13-state.ts](../src/simulation/combat-s13-state.ts) | 1, 124, 131 |
| [src/simulation/combat-s13.ts](../src/simulation/combat-s13.ts) | 1, 120 |
| [src/simulation/combat-types.ts](../src/simulation/combat-types.ts) | 8 |
| [src/simulation/content/augments.ts](../src/simulation/content/augments.ts) | 18, 28, 216, 226 |
| [src/simulation/effects.ts](../src/simulation/effects.ts) | 56, 108 |
| [src/simulation/g2-4b-gold-restore.ts](../src/simulation/g2-4b-gold-restore.ts) | 1, 50, 64, 66, 68, 73, 86 |
| [src/simulation/m8/contracts.ts](../src/simulation/m8/contracts.ts) | 228, 232, 245, 249 |
| [src/simulation/m8/heal.ts](../src/simulation/m8/heal.ts) | 1, 32, 37 |
| [src/simulation/m8/resists-shield-restore.ts](../src/simulation/m8/resists-shield-restore.ts) | 1, 34 |
| [src/simulation/m8/restore.ts](../src/simulation/m8/restore.ts) | 1, 164, 168, 186 |
| [src/simulation/m8/s13-mechanisms.ts](../src/simulation/m8/s13-mechanisms.ts) | 351 |
| [src/simulation/m8/shield.ts](../src/simulation/m8/shield.ts) | 1, 9 |
| [src/simulation/m8/status.ts](../src/simulation/m8/status.ts) | 1, 41 |
| [src/simulation/match.ts](../src/simulation/match.ts) | 1, 812 |
| [src/simulation/round-settlement.ts](../src/simulation/round-settlement.ts) | 1, 84 |
| [src/simulation/s13-rules.ts](../src/simulation/s13-rules.ts) | 5 |
| [src/simulation/serialization-structure.ts](../src/simulation/serialization-structure.ts) | 1, 200, 267, 292 |
| [src/simulation/two-sided-battle.ts](../src/simulation/two-sided-battle.ts) | 1, 174 |
| [src/simulation/validate-content.ts](../src/simulation/validate-content.ts) | 83, 91 |
| [src/simulation/choice-acquisition.ts](../src/simulation/choice-acquisition.ts) | 5 |
| [src/simulation/combat-overtime.ts](../src/simulation/combat-overtime.ts) | 4, 8, 11, 15, 21 |
| [tests/rules-placebo-stage.test.ts](../tests/rules-placebo-stage.test.ts) | 9, 36 |
| [tests/rules-combat-overtime.test.ts](../tests/rules-combat-overtime.test.ts) | 30 |
| [tests/rules-overtime-paths.test.ts](../tests/rules-overtime-paths.test.ts) | 27 |
| 本报告 | 1 |

## 最终验收数字与失败清单

环境：Node **v22.23.4**，沿用`node_modules -> ../cat/node_modules`；全部命令先`export PATH=$HOME/.local/bin:$PATH`。普通Vitest启动因只读软链目录下`.vite-temp`写入被拒；改用命令行`--configLoader=runner`，未改仓库配置。正式最终定向执行采用`--maxWorkers=2 --configLoader=runner --reporter=default --reporter=json --outputFile=/tmp/rules-verification.json`。

- `npm run typecheck`：**通过，exit 0**。
- 新增3个文件：`rules-placebo-stage` **11/11**、`rules-combat-overtime` **26/26**、`rules-overtime-paths` **1/1**，共 **38/38**。真实两侧重装蕾欧娜tick900平局，包含治疗、同步/1tick/7tick切片、首遍回放/重执行回放、加时运行态JSON恢复继续及篡改HP拒绝。
- 最终一次定向测试 **18文件、572项：451通过、121失败**；12文件全通过，6文件有预期规则/身份漂移失败。耗时32.74秒；未跑全套、浏览器、压测、epoch录制或发布。
- 选中的18文件：新增3文件；`m8-b3-damage-control-order`、`m8-b9-status-events`、`m5-combat`、`m5-serialization`、`m5-strategy-numbers`、`g2-augments-choice`、`g2-augments-static`、`g2-augments-combat`、`content-identity-constants`、`m8-b9-golden-guard`、`m8-b9-golden-tamper`、`combat-first-pass-frames`、`live-combat-inputs`、`opening-random-identity`、`t2-two-sided-battle`（均为tests下原文件名，两个golden guard/tamper为.mjs，其余.ts）。
- `git diff --check`通过；没有改已有tests文件、历史fixtures、epoch/version/digest常量、rendering/presentation/server、CI或素材；没有commit。

### epoch / digest / golden失败（116项）

| 测试文件及用例 | 数量 | 原因 |
|---|---:|---|
| `content-identity-constants.test.ts` → `matches the original full content root, including explanation/source columns` | 1 | 固定CONTENT_DIGEST仍是`fnv1a32-utf16:35273c97`，新内容重算为`fnv1a32-utf16:f1bc6b47`；按要求不回写常量 |
| `opening-random-identity.test.ts` → cannon/sniper各自的`checkpoint N survives strict text/object restore` | 114 | 各57项：N为1、3、5、7、9、11、13、15、17及19至66；其中20项报`combat ticks`（旧maxTicks=1200），94项报`choice receipt values`（旧晚阶段固定金币） |
| `opening-random-identity.test.ts` → `recomputes the first battle terminal and every event hash from public commands` | 1 | 首场tick仍164，但新maxTicks和强化参数使状态/事件hash与旧录制不符 |

`m8-b9-golden-guard.test.mjs`的3项和`m8-b9-golden-tamper.test.mjs`的8项全部通过，历史原字节校验保留；未运行的其他epoch/整局golden不声称通过。

### 旧数值/参数断言失败（5项；同样不改断言）

| 测试文件及用例 | 数量 | 具体差异 |
|---|---:|---|
| `g2-augments-static.test.ts` → `placebo keeps exact normalized source values`、`placebo-plus keeps exact normalized source values` | 2 | 项目运行表新增stage3Amount/stage4Amount；原版来源固定金币断言未改 |
| `m5-strategy-numbers.test.ts` → `Placebo compiles one percent attack speed and a separate eight-gold acquisition` | 1 | 编译mechanic参数新增11/15分段字段，原1%AS及2阶段8金不变 |
| `g2-augments-combat.test.ts` → `Epitaph chooses nearest surviving ally with stable ID tie, stacks independent death shields, lasts this combat` | 1 | 持续至战斗结束的盾到期由1201变901，旧断言仍为[1201,1201] |
| `t2-two-sided-battle.test.ts` → `real equipped tanks reach the unchanged 1200-tick limit; budget exhaustion is not a draw` | 1 | 真实对局现为900tick结束，旧断言仍为1200 |

原始本地日志：`/tmp/rules-verification.log`、`/tmp/rules-verification.json`、`/tmp/rules-typecheck-done.log`；本节记录完整复核结论，不依赖临时日志保存。

## 剩余与风险

1. 按用户要求等待#410合并后统一升级身份与录制epoch；旧证据失败不能通过本次改断言解决。暂不适合合并发布为现有v21身份。
2. 移速已定+50%（见上）；Claude需核对真实界面45秒显示及服务器旧注释/预算。治疗字段的legacy命名已有合同注释，UI若将`preventedByWound`直接标成“重伤阻止”，需同时体现加时。
3. 加时恢复新增完整确定性重执行（有可信输入缓存），冷恢复成本最多900tick；本单验收了正确性，未扩展为性能压测。
4. 当前分支代码实现的边界是tick600即时第1层；“30秒起”的离散化及半入最少1tick已明确写进合同。安慰剂+沿用户授权的暂定15/18/22，无需本单再次决策。
