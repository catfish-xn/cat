# v19 规则与数据合同（2026-10-21）

## v19 第二部分（当前合同，2026-10-21）

同一v19包含家人5随机任务法球、13.4六人彩蛋回移、六费 warwick / viktor / mel 与22种纹章总基础属性替换。schema/save/replay/command＝**9/5/4/4**；旧身份拒绝，无迁移，50ms和lcg32-v1不变。数值、魔改/未验证清单、导出签名、RNG、失败/恢复、说明底部显示字段及表现层交接以 [V19_PART2](V19_PART2.md) 为准；下文旧“家人预留/六费延期/纹章未改/8-4-3”描述已被本节覆盖。


本轮以 `codex/v19` 的本地集成基线 `9fb94704c5f0c59ec975c6f0de4dd188207129fa` 为起点。仅离线读取归档与 Git 对象，不执行 Git 写操作。规则/内容为 `s13-g2-3-v19` / `s13-14.24b-g2-3-v19`；schema/save/replay/command 为 9/5/4/4。整数、基点、50ms tick、显式 lcg32-v1 和既有命令失败原子性保持。

## 来源与证据边界

本地原件位于 `src/simulation/content/source/s13-14.24b/raw/`。`en_us.json.gz` 解压 SHA-256 为 `c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3`；`map22.bin.json.gz` 为 `09a9219647c08e70a8eb4d2ccbc35a9afe21934bc5279b4da2d05ca076339e0f`；中英文 stringtable 分别为 `aa9ca3629482cdde5356a38c1f83c804fdcc20e2b6315cc872e6a9800dbacda3`、`4951a0356e8d9ac7f59b3b54360c964d65baea8112bcbd8da23b8540df07a443`。这是 14.24 客户端数据，B 补丁沿用 M9 台账已明确的覆盖，不能声称拿到了完整 14.24b 服务端脚本。

输入取证见本地取证记录 v19-mechanics-list 与 v19-evidence（未入库）。下列直接数值均可在本地命名变量和双语文案对应；“推断”“项目约定”“魔改”不当作官方执行证据。

| 项 | 原件定位与直接数值 | v19 行为 |
| --- | --- | --- |
| 统领 2/4/6 | `TFT13_Infused`：APPercent=0.25/0.45/0.65；文案 Mana spent | 每次完成施法增加 `floor(actualManaSpent * APBps / 10000)` AP，逐次贡献相加；不再读取 maximum Mana。消耗取自施法收据，退款不回减这张收据的 actualManaSpent；成本增加/家人减费已经体现在实际消耗中。 |
| 外交官 1/4·盖伦 | `TFT13_Emissary`：GarenHealthPercent=0.12，Garen's max Health | 所有其他开场属性完成后冻结每名盖伦实际 maxHp 和开场同排左右一格/自身名单，然后统一广播 `floor(sample * 1200/10000)` 实际生命；四外交官自身 200HP、装备、羁绊、异常、P2 和蓝发开场加成都在取样内。 |
| 双形 2/4 | `TFT13_FormSwapper`：DR=.15/.30，DA=.20/.40 | 恢复四名原生英雄的双形成员身份，启用档位。按冻结 startingCell 判前/后两排；双方镜像口径一致，战中移动不换加成/形态。减伤沿现有最强减伤规则，增伤沿现有加法增伤规则。 |
| 姐妹 2 | `TFT13_Teamup_Sisters` 和 `TFT13_TeamupAugment_Sisters`：ADBuff=.4、ASBuff=.75、ViDuration=7、JinxDuration=5 | 只有持有对应强化且金克丝/蔚两种英雄均上场才编入姐妹。金克丝参与击杀给存活蔚 +40% AD 140tick；蔚参与击杀给存活金克丝 +75% AS 100tick。 |
| 蓝发 10 | `TFT13_Rebel`：ForceDuration=12、ADAP=.5、PercentMaxHealthBonus=.3、BurstAS=.6、BurstDuration=5、StunDuration=2 | tick0、240、480…触发，替代低档的全队失血门槛。永久 +50% AD/+50AP/+30%生命只授予一次；每次信号刷新 +60% AS 100tick 和敌方眩晕 40tick。 |
| 黑玫 4及以上 | Sion charge/roar/unleashed tooltip 的 Passive；`/setData/1/champions/60/ability/variables` 的 ChargeDamageAmp≈.08 | 被赛恩挣脱冲锋命中的敌人留下本队标记（2026-10-24 起；此前为赛恩造成正伤害即标记）；同队黑玫成员对此目标伤害 ×1.08，持续至本次战斗结束。赛恩普攻和主动技能不标记；非成员/未标记敌人不加成，赛恩阵亡不移除标记。 |
| 完美行刑官链锯刃 | `TFT13_Crime_Prismatic_ExecutionersVorpalblade`：ExecuteThreshold=.2、PrismaticGold=3、PrismaticHeal=400、OnKillDR/DA=.2、Duration=10 | 正普攻/技能包结算后目标仍存活且严格低于20%时处决；每次处决治疗持有者400。持有者击杀后获得20%减伤/增伤200tick，后续击杀刷新。 |

## 明示的推断、约定与缺证

- **黑玫档位绑定为推断**：4档文案与 charge 变体相接，5/7档继承相同被动。没有取得变体执行绑定脚本。按本轮授权从4档启用同一 +8%，不猜 `{2c6be05c}` 等哈希数值。
- 黑玫重复命中叠加缺证，采用**不叠加**；冲锋路径上的敌人一律算命中（与伤害多少无关）、尸体保留标记到战斗结束均为项目约定，见 S13_RULES_GAP 的 P-S 条目。独立 ×1.08 在现有增伤/减伤结算后、护盾/分担前向下取整；继承的已结算包不再乘一次。与其他增伤的精确原脚本顺序仍缺证。
- 蓝发重复信号是否再次叠永久AD/AP/HP、是否叠攻速均缺执行证据。本版采用**永久属性一次，攻速/眩晕刷新，不复利加生命**。开场眩晕立即生效，后续眩晕遵循既有 next-tick 控制边界；无额外阈值信号。同一队时刻只触发一次；不对尸体/缺席单位施加状态。
- 盖伦一次冻结再广播、多个盖伦不互相反馈放大、共享数额作为独立实际生命而不被受赠方生命百分比再次放大，是项目开场顺序约定。后续最大生命变更保留共享实值。既有护盾在这次广播前已取样，不追溯重算护盾。
- 姐妹重复参与击杀刷新而不叠层，同一伙伴的多个来源使用同一效果身份。伙伴死亡/缺席不接收；没有强化或缺一种伙伴均不启用。强化内部 ID=`sisters`，归档 API=`TFT13_TeamupAugment_Sisters`；金级准入沿 `_II` 归档身份作项目启用，不宣称已认证历史实际发牌池。赠送各一名蔚/金克丝复用既有唯一 P2 赠品收据，单人容量托管、联机机制法球及共享池事务语义不变。
- **链锯刃魔改**：3金只允许 PvP 敌方真实英雄；野怪、召唤物、镜像/分身均不掉金。治疗与击杀增益仍可对非金币合格目标触发。这项限制来自本轮用户要求，不冒充归档原版。多件只使用实例ID最小的一件执行效果；基础装备属性仍沿原装备叠加规则。
- 链锯刃沿已有收集者时序约定：自然致死包不再处决/发处决奖励，处决绕过剩余护盾及伤害延迟；同一次死亡只允许第一个致死事实。处决不是额外普攻/施法，不消费 RNG。精确原脚本执行顺序缺证。

## 公共边界、收益与恢复

Match/服务器公开命令签名和失败原因枚举不变，失败继续返回原 state、无资源/事件/RNG变化。`buildStrategySnapshot(state, catalog?, context?):StrategySnapshot` 冻结姐妹准入与链锯刃 PvP 资格，不要求服务器另算规则。姐妹新增1项金级强化，当前61强化/30羁绊；第二部分另加入三名六费，见V19_PART2；其余关系羁绊仍延期。

新增可选战斗事实 `CombatUnit.v19?: V19CombatFacts`：`garenSample?:number`、`sharedHealth?:number`、`smokePermanent?:boolean`、`smokeOrdinal?:number`、`roseTeams?:readonly Team[]`。它们属于战斗权威 JSON，不由显示层提交，不写回永久英雄。相关战斗恢复从已验证 CombatInputBasis 独立逐tick重建，比较完整战斗，拒绝伪造采样/标记/时钟/收益；无新机制时拒绝多余 v19 字段。恢复只验证，不发奖或推进活跃 RNG。

链锯刃复用 `CombatState.itemGoldReceipts`，新增 `kind='perfected-chainblade'`、`word=null`、`gold=3`；收据ID继续为 JSON `['g24-item-gold',battleId,ownerId,itemInstanceId,kind,ordinal]`。`ItemGoldPayout.amount` 从字面量1扩为 `1|3`，校验强制该 kind 为3、其他kind为1。既有 `g23Facts.itemGoldPayouts` 原样传递，服务器无需拆成三条；经济层按 amount 求和，战后通过相同唯一 mechanic 收据到账。战斗内仅为待结算收益，重复 settlement/step/恢复不重发。

## 赛薇卡给3D的数据

不修改3D或界面渲染器。`castOutcome` 领域事件和 `toCombatViewEvents(events)` 白名单投影新增可选：

```ts
castVariant?: {
  actionSeq:number;
  move:'flamethrower'|'punch'|'chomp';
  channelTicks:number;
  enhanced:boolean;
  heroAugmentIds:readonly string[];
}
```

每次赛薇卡真实选招后写同一份结果：move 为最终招式（包括高摇结果强制选招），channelTicks 为本次规则实际引导tick数，非引导为0；秒数=`channelTicks * 50 / 1000`。`enhanced` 是百变铁手本次强化结果，不等于强化所有权。`heroAugmentIds` 专供已实装且适用于该英雄的英雄强化标记；当前没有赛薇卡专用英雄强化，因此显式 `[]`，不伪造未实现强化。

3D消费已有 replay/首遍帧中的 `castOutcome.castVariant`，按 `unitId + actionSeq` 关联本次 cast，按 move 选择动画、channelTicks 设引导时长、enhanced/heroAugmentIds 选变体。继续消费权威生命、控制、活动状态更新处理打断，不能自行抽招、掷骰或从 outcome 文案推演规则。投影数组/对象脱离领域引用，首遍与重放使用同一投影，不增加随机抽取。

## 家人5：第二部分已实现

当前任务、独立RNG、16项载荷、进度、法球/原子领取收据、显示字段、彩蛋回移及存档验证以 [V19_PART2](V19_PART2.md) 为准。旧预留接口不再代表当前实现。
