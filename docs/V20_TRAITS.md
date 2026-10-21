# v20-traits：批准的羁绊魔改

本版承接 `14006984600a08f8dd96fa776bf9ba1d1048ff24`（#364/v19），独立于并行 PR #373 的 v20-chem-baron。规则/内容身份为 `s13-g2-3-v20-traits` / `s13-14.24b-g2-3-v20-traits`，schema/save/replay/command 为 **10/6/4/4**。50 ms、显式 lcg32-v1、整数/基点、失败原对象与唯一收据不变。旧版本拒绝恢复，无静默迁移。

## 证据与授权

2026-10-21 按用户 10-20 的全权授权（需要选择的一律按建议），协调者定为四项全部选 A。取证报告原件保存在本地，未入库；本文件保留实施所需定位与边界，不把执行推断写成历史事实。

归档目录 `src/simulation/content/source/s13-14.24b/raw/`：`en_us.json.gz` 解压 SHA256 `c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3`。标准集为 `/setData/1`，traits 索引：迅击30、野火24、军事7、重联9、天才31、危险1、意外25；对应强化 `/items/80,0,13,75,4`。原件及归一化历史源表不修改。按 M9 台账采用既有 B 补丁（包括希尔科畸变体伤害 **36/55/100**；14.24 raw 的38/57不覆盖B值）。

原档支持迅击攻速/盾、野火周期/回血比例及关系文案数值，**不支持精确位移、协同基底/时序、附效继承、伙伴选副本和幸运公式**。下述七项完整执行均标 **魔改**，归档数值版本仍为14.24b；野火35000Bps另标 **工程取值**。不联网补证，不把未命名3.5哈希解释为已证实公式。

## 冻结与执行

| 羁绊（全部魔改） | 执行规则 |
| --- | --- |
| 迅击战士 | 保留2/3/4档随当前目标缺血线性20–60/30–80/40–100%攻速；普通移速×1.5，每tick累计3/10格，首次可移动，余量保留，等待最多存13/10格。4档当前目标阵亡立即获得200盾60tick，不限击杀归属；下tick选最近敌人（ID打破平局），冲到距自己最近的合法相邻格（再按行/列）。无敌人/无空格不位移，不补发盾；已有控制/引导仍禁止移动。按actor ID依当前占格逐个预留。 |
| 野火帮 | 首次t120，以后每120tick；[120,140)、[240,260)…共20tick窗口，所有正常攻击无限射程，4档额外35000Bps攻速（工程取值，叠加而非固定3.5次/秒）。冲刺前累计的实际HP承伤×20/33/40%向下取整治疗，随后清桶；盾吸收/过量伤害不算。以冲刺前最近敌人为锚，在自身≤2格可用格中选离该敌人最远者、行/列打破平局；无落点仍开窗。死亡不回血，同tick致死不复活，下一周期不重复消费旧桶。 |
| 军事管制 | 对应强化＋安蓓萨/凯特琳。开场所有常规属性完成后冻结凯特琳实际AD，25%向下取整作为安蓓萨额外平面AD，置于百分比乘区外，只授一次。安蓓萨正常施法后下一tick凯特琳对该冻结目标发一个当tick实际AD×225%的物理派生包；目标消失取消。无攻击回蓝、普通攻击计数、技能附效或协同递归。 |
| 重新联合 | 对应强化＋蔚/艾克。蔚正常施法后下一tick艾克向冻结目标发3个残影，每个为艾克普通技能主包×50%（逐包取整，不把整数余数摊成1/3）；艾克施法后下一tick蔚向冻结目标所在行发地震波，每敌人一包，基底为蔚普通次级波×150%。只复制伤害，无减抗/击飞。 |
| 天才 | 对应强化＋黑默丁格/艾克。黑默施法后下一tick艾克3残影，各普通主包×33%（非1/3）；艾克施法后下一tick黑默3导弹，各普通单枚导弹×120%。导弹沿用普通技能的按距离/ID排序敌人及每枚一word的选敌。派生不增加施法数/导弹成长、不触发重联或其他协同。 |
| 危险人物 | 对应强化＋爆爆/希尔科。保留爆爆的家人计数身份，单独屏蔽爆爆家人的减蓝/减伤/攻速等自身收益；爆爆加入统领计数并正常受益。开场冻结希尔科星级/AP/畸变体伤害。猴子以独立任务下tick命中冻结中心（明确项目时序），即使爆爆死亡仍爆炸；每根爆炸序号只生成3个畸变体，不附带罐子伤害。沿用希尔科攻击代理口径：不可选中、不占格、不作为最后战斗员或英雄存活伤害；每体48tick一次、5次攻击、240tick上限，取最近现存敌人。伙伴后续死亡不撤销冻结关系或快照。 |
| 意外搭档 | 对应强化＋金克丝/塞薇卡，各+10%AD/+100基础平面HP（沿用普通属性乘区）。正常施法给另一个存活伙伴10法力，沿用锁蓝/上限/溢出规则。原钢臂抽样结果非三重时多抽一个word，`floor(word*10000/2**32)<1000`则将后两槽提升为首槽对应三重；原三重不再抽幸运。保留现有钢臂抽象桶与对应三重类型映射，不重做奖池、不提高jackpot类型权重，收据保存word/首槽桶/是否转换。 |

五组关系只认**强化已选＋同队棋盘两种指定英雄**，备战席或同名双副本不能凑2。每个英雄按永久装备实例数降序→星级降序→ID升序唯一绑定；不同关系独立绑定。战中装备生成的镜像/分身不成为新伙伴，也不触发协同/幸运。死亡不撤回开场静态属性/冻结羁绊；协同发出者必须存活，法力接收者必须在结算时存活。协同任务不要求原触发者在下一tick仍存活，已有控制不抹除已承诺的非引导协同包。两边同tick施法均可承诺；同tick新控制服从既有伤害批次屏障。野火窗口只延长普通攻击的射程，技能仍用自身原射程/自施法资格。

## 数据、导出与失败

Match客户端命令和失败reason全集不增加。强化赠卡复用 `p2GiftPlan` / `drainP2Gifts` / `validateP2Gifts` 的 `s13-augments-p2` 来源与 `[source,choiceId,'unit',index]` 唯一收据，缺池/满席沿原有事务策略；重复调用不重发。五项强化中文名/英文API身份与伙伴表在 `content/v20-traits.ts`，当前66强化、35羁绊。

以下均为规则内部接线，服务器继续使用Match公共导出；不增加网络消息或客户端授权面：

| 导出 | 输入、输出及失败 |
| --- | --- |
| `bindV20Teamups(state:CombatStrategyInputs):Map<TeamupId,readonly string[]>` | 返回开场合格伙伴ID对；门槛不满足则无该项，无副作用/随机。 |
| `v20MembershipSources(state,bindings):TraitProjectionSource[]` | 输出当前轮临时关系及统领身份声明，传入既有有效成员编译；非法投影沿原RangeError。 |
| `teamup(unit,id):CombatMechanic\|undefined` | 只读冻结绑定。 |
| `startV20Traits(ctx:AbilityContext):void` | 开场AD与召唤快照一次采样；由combatStart一次入口调用，不读真实时钟/不抽RNG。 |
| `castV20Teamups(ctx,unit,target,rootActionSeq):void` | 只在真实正常施法收据后承诺；写入序列化任务或既有法力请求；不合格伙伴跳过。 |
| `executeV20Teamup(ctx,emitter,task):void` | 下一tick发派生包，失效发出者/目标按上表跳过。三导弹每枚消费现有显式流一word；其他协同不抽随机。 |
| `quickDashV20(ctx,unit):void` | 消费待冲刺时刻，更新目标/合法位置；无落点不移动。 |
| `detonateMenaces(ctx,powder,rootActionSeq,cell):void` / `advanceV20Minions(ctx):void` | 唯一爆炸序号生成3个攻击代理；代理状态自持有次数/下次攻击/到期时刻，既有unitSpawned/death事件完整保留。 |
| `rollG23HighRoller(draw:()=>number,lucky?:boolean)` | 保留`{mod,enhanced}`，新增可选`luck:{word,converted,firstSlot}`收据。不传lucky保留原抽样；幸运失败仍记录word。 |

协同 `CombatTask.kind='v20Teamup'` 含 `teamupKind`、根actionSeq、源关系与触发者、冻结targetId/cell、基点与子包ordinal。包保留rootActionSeq，delivery=`attack-extra`，crit=`never`，triggeringCastActionSeq=null；军事/重联/天才分别使用独立ordinal段，防止同根双关系packetId冲突。复用既有packetDamage/heal/manaChanged/movement/targetChanged/statChanged/unitSpawned/death，无新事件枚举，replay/net版本4不变。

`CombatUnit.v20Traits` 保存移动余量、冲刺时钟、AD采样与实际授予、希尔科快照、已爆炸根ID及攻击代理任务。实际HP承伤桶仍为 `expansion.damageTaken`。所有字段进入JSON，逐tick从认证冻结输入重建并比较完整候选状态；伪造余量、伙伴、任务、快照或RNG均拒绝。无新隐藏闭包或候选自证。旧身份保留原字节供导出。

## 录制、核验与交接

`node scripts/update-content-identities.cjs --write` 先生成两个完整根digest；`node scripts/verify-v20-traits-epoch.cjs` 顺序录制/核验release、Herald、输入夹具、转移锚点与live reveal，再核验历史LF字节和独立digest根。生成目录仅 `tests/fixtures/v20-traits-*`、`full-match-golden.v20-traits.json`、`tests/v20-traits-content-baseline.json`、`docs/evidence/v20-traits/`。`verify-m8-herald-fixtures.cjs` CURRENT指向新录制器。v19及更早epoch不改写，g2-4b manifest字节不动；并行v20-chem-baron谁后合谁重录。

表现层由Claude改：`src/presentation/trait-text.ts` annotate中去除**迅击战士的移速/冲刺、野火帮、军事管制、重新联合、天才、危险人物、意外搭档**这些已实现子项的“暂未实装”，并标注魔改/350%工程取值。本包不修改presentation。其他缺项（如本可发生之事、背叛）继续保留，原归档数值文本不冒充上述执行是历史还原。

召唤交接：畸变体攻击代理的 `definitionId='v20-silco-minion'`，`unitSpawned`及紧凑回放`unitEntered`携带唯一ID、队伍、星级、位置与不可选中标记。显示名为“畸变体”；当前未修改界面名称表，沿用未知单位的通用回退，名称映射由Claude补上。它不属于商店/备战席资产，不应生成出售、装备或人口操作。
