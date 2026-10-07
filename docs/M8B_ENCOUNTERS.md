# M8B 野怪遭遇与项目参数

状态：**已批准（首版，待实战验收）**。用户已确认 M8B 设计通过复审，49项配置按现表批准，包含本文件全部项目参数、详细边界及新野怪25%基础暴击/1.4倍倍率。批准与审计依据见 [POLICY §9](M8B_POLICY.md)，试玩重点见同文 §10；新遭遇仍未实现或完成平衡验证。以下八轮是项目编号与编排，不是 14.24b 历史精确表。

本轮只编写文档，不修改功能代码、不新增素材。开场资源、初始格位与阶段1账本以 [M8B_OPENING.md](M8B_OPENING.md) 为准；总体轮次范围、单人适配和组合版本以 [M8B_POLICY.md](M8B_POLICY.md) 为准；掉落计划、资格和收据以 [M8B_LOOT.md](M8B_LOOT.md) 为准；冻结 B2 的最小补充接口与共同执行时序以 [M8B_CONTRACT_ADDENDUM.md](M8B_CONTRACT_ADDENDUM.md) 为权威。本文定义遭遇内容和能力参数，不另造一份冲突类型合同。

## 1. 依据与边界

依据：[board.ts](../src/simulation/board.ts)、[现行守卫数值](../src/simulation/units.ts)、[现行敌方编排](../src/simulation/round-enemies.ts)、[S13 战斗常量](../src/simulation/s13-rules.ts)、[M8_RULES.md](M8_RULES.md) 和 [B2 类型合同](../src/simulation/m8/contracts.ts)。棋盘为 7 列 × 8 行 odd-row 坐标；敌方部署 row 0–3，玩家 row 4–7；坐标均写 `(col,row)`。50 ms/tick，1200 tick 上限不变。

归档 [selected-neutrals.json](../src/simulation/content/source/s13-14.24b/raw/selected-neutrals.json) 支持以下招牌描述。**记录全部标注 candidate-only-not-encounter-confirmation，只证明候选文本，不证明本稿的轮次、数量、站位、机制边界及参数。**原始大龙 10000 HP/900 AD、先锋 10000 HP/600 AD 不直接搬入项目。

| 项目单位／题材 | 源 apiName | 上游 JSON pointer | selected-neutrals.json 中的记录指针 | 可支持的招牌 |
| --- | --- | --- | --- | --- |
| 石甲虫 | TFT_Krug | /setData/1/champions/4 | /3/record | 同类友军死亡回满生命 |
| 大狼 | TFT_Murkwolf | /setData/1/champions/5 | /4/record | 开场跃向敌方后排 |
| 小狼 | TFT_MurkwolfMini | /setData/1/champions/6 | /5/record | 开场跃向敌方后排 |
| 大鸟 | TFT_Razorbeak | /setData/1/champions/7 | /6/record | 同类友军死亡增加攻速 |
| 小鸟 | TFT_RazorbeakMini | /setData/1/champions/8 | /7/record | 同类友军死亡增加攻速 |
| 远古龙 | TFT_ElderDragon | /setData/1/champions/10 | /2/record | 普攻向主目标背后锥形溅射 |
| 峡谷先锋 | TFT_RiftHerald | /setData/1/champions/9 | /8/record | 开场冲锋、最大生命比例魔伤、眩晕 |

上述源记录统一来自 `setData[mutator === "TFTSet13"].champions`；归档的上游 SHA-256 为 `c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3`，逐条记录另有 recordCanonicalSha256。不要把索引相邻理解成同一轮遭遇。

S13 外观题材按表中 apiName 对齐；后续 Claude 可从同条记录的 icon、squareIcon、ability.icon 寻找展示资源及核对可用性。本文只规定展示身份、名称与能力事实，不规定配色、布局或动画；本轮不下载、不新增、不替换 `public/assets/`。两种小兵的准确素材 apiName 尚未由这份归档确认，不使用虚构 API 名占位。

第一阶段小兵题材另有官方 14.15 标准 PvE 名单支持，但本地九条候选不含小兵完整记录；本稿两种小兵的参数全部自定，不捏造已归档小兵记录。蟹 HP=null、蓝色魔像可能属于别的遭遇，不为了凑八轮硬加入。

历史资料链接：

- [官方 14.15 补丁](https://teamfighttactics.leagueoflegends.com/en-us/news/game-updates/teamfight-tactics-patch-14-15-notes/)（2024-07-30，标准怪物名单与部分数值调整）。
- [CommunityDragon 14.24 历史目录](https://raw.communitydragon.org/14.24/)。
- 项目已保存原始文件摘要和逐条 JSON pointer；实施时沿现有账本引用，不重写原始值来匹配下表。

## 2. 八轮目录与全部部署实例

遭遇目录版本为 `m8b-encounters-project-v1`；冻结的 `EncounterPlan.policyVersion` 使用组合政策 `m8b-pve-project-v1`，同时绑定开场、遭遇和掉落政策，映射见 [M8B_POLICY.md](M8B_POLICY.md)。每行一个固定遭遇，encounter RNG 消耗 0 词。单位实例 ID 定义为 canonical JSON 数组 `["pve",roundId,encounterId,slotId]`；下表列出全部 slotId，不依赖生成顺序或旧 round 整数。保存与掉落 sourceUnitId 使用该完整实例 ID。

| 项目轮次 | encounterId | slotId → definitionId @ 坐标 | 总只数 |
| --- | --- | --- | ---: |
| 1-2 | minions-a-v1 | m01→pve-minion-melee-a @(2,3)；m02→pve-minion-melee-a @(4,3) | 2 |
| 1-3 | minions-b-v1 | m01→pve-minion-melee-b @(2,3)；m02→pve-minion-melee-b @(4,3)；r01→pve-minion-ranged-b @(3,1) | 3 |
| 1-4 | minions-c-v1 | m01→pve-minion-melee-c @(2,3)；m02→pve-minion-melee-c @(4,3)；r01→pve-minion-ranged-c @(2,1)；r02→pve-minion-ranged-c @(4,1) | 4 |
| 2-7 | krugs-v1 | k01→pve-krug @(1,3)；k02→pve-krug @(3,3)；k03→pve-krug @(5,3) | 3 |
| 3-7 | wolves-v1 | w00→pve-wolf-large @(3,2)；w01→pve-wolf-small @(1,3)；w02→pve-wolf-small @(2,3)；w03→pve-wolf-small @(4,3)；w04→pve-wolf-small @(5,3) | 5 |
| 4-7 | razorbeaks-v1 | r00→pve-razorbeak-large @(3,2)；r01→pve-razorbeak-small @(0,3)；r02→pve-razorbeak-small @(1,3)；r03→pve-razorbeak-small @(2,3)；r04→pve-razorbeak-small @(4,3)；r05→pve-razorbeak-small @(5,3) | 6 |
| 5-7 | elder-dragon-v1 | d01→pve-elder-dragon @(3,2) | 1 |
| 6-7 | rift-herald-v1 | h01→pve-rift-herald @(3,1) | 1 |

全部坐标处于合法敌方部署区，同一遭遇无重复坐标；所有怪物固定 **1 星**，不使用英雄 2/3 星倍率，不通过升级星级掩盖阶段系数。definitionId 只选内容，行为执行禁止按 ID 或中文名称分支；对应能力定义声明下述有限机制。

## 3. 具体数值

HP、AD、双抗均为整数。ASBps 是基础每秒攻击次数 ×10000；同步列出冻结基础 attackIntervalTicks，避免从旧整数间隔反推浮点攻速。新鸟的后续加速明确进入 G01，正在等待的攻击冷却不重写。全部法力 `initialMana=0,maxMana=0`，招牌为被动／开场效果；七类归档候选有零蓝静态字段依据，五种小兵无对应归档、属于项目统一赋值，整组采用已获首版参数批准。不能用 maxMana=1 制造零伤害假施法。基础 AP=100，移速沿既有每5tick一步，普攻 physical/basic-attack。

**中立攻速存在明确集成改动**：当前 `combat-s13-state.ts` 的 `interval()` 对 `champion(unit)==='neutral'` 直接返回固定 `attackIntervalTicks`，仅添加AS属性会出现面板加速、实际攻击不加速。新遭遇使用明确baseASBps并接入现有G01 `attackInterval(baseSpeedBps,bonusBps)`：间隔为 `max(1,ceil(2000000000/(baseASBps×(10000+sumBonusBps))))`，等价于 `ceil(200000/effectiveASBps)`；effective值按精确有理数看待，不在最后ceil之前额外截断。只在下一次攻击设置冷却时读取当前间隔，不改已经在倒数的remainingCooldown。旧守卫若仍保留作基线场景，继续其旧整数间隔，不由本表反推后覆盖旧内容。新规则与这个明确的neutral分支替代策略都应进入规则修订及digest。

| definitionId | HP | AD | ASBps | 基础攻击间隔tick | 护甲 | 魔抗 | 射程 | 能力 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| pve-minion-melee-a | 110 | 8 | 5000 | 40 | 0 | 0 | 1 | 无 |
| pve-minion-melee-b | 160 | 10 | 6000 | 34 | 0 | 0 | 1 | 无 |
| pve-minion-ranged-b | 120 | 9 | 6000 | 34 | 0 | 0 | 3 | 无 |
| pve-minion-melee-c | 220 | 12 | 6000 | 34 | 0 | 0 | 1 | 无 |
| pve-minion-ranged-c | 160 | 10 | 6000 | 34 | 0 | 0 | 3 | 无 |
| pve-krug | 400 | 30 | 8000 | 25 | 20 | 20 | 1 | stone-salvage-project-v1 |
| pve-wolf-large | 900 | 50 | 8000 | 25 | 15 | 15 | 1 | pack-leap-project-v1 |
| pve-wolf-small | 450 | 22 | 8000 | 25 | 15 | 15 | 1 | pack-leap-project-v1 |
| pve-razorbeak-large | 1400 | 65 | 8000 | 25 | 25 | 25 | 1 | furious-flock-project-v1 |
| pve-razorbeak-small | 680 | 32 | 8000 | 25 | 25 | 25 | 1 | furious-flock-project-v1 |
| pve-elder-dragon | 6000 | 85 | 10000 | 20 | 50 | 50 | 2 | primordial-breath-project-v1 |
| pve-rift-herald | 9000 | 120 | 10000 | 20 | 60 | 60 | 2 | void-charge-project-v1 |

统一基础暴击已批准采用 **chanceBps=2500、multiplierBps=14000**。石甲虫、大小狼、大小鸟、远古龙、先锋这七类归档候选的 `record.stats.critChance=0.25`、`record.stats.critMultiplier=1.399999976158142` 提供静态字段依据；后者规范化为整数14000Bps。五种小兵没有对应归档，采用同值是项目选择；将七类候选值与五种小兵统一用于本目录已获用户本轮明确批准。参数签收不等于实战平衡已验证，也不能称其为14.24b实战完整还原。

这与**旧中立运行基线0%暴击**有明确差异：[combat-s13-state.ts](../src/simulation/combat-s13-state.ts) 的 `spellCrit()` 在没有编译投影时对neutral使用0；[serialization.ts](../src/simulation/serialization.ts) 的 `validateM5Runtime()` 同样要求该旧投影的chanceBps为0。新模板必须完成基础暴击的内容编译、初始战斗投影和恢复验证，不能只写目录字段或手动塞入2500；具体接点与门禁由 [合同补充](M8B_CONTRACT_ADDENDUM.md) 规定。本稿只更换经批准后的基础输入，**不改变G03暴击公式、随机词门槛或技能暴击授权模型**。每个已规划普攻仍消费1战斗词，即使旧中立概率为0也不省略该词。被动附加伤害不获得技能暴击授权，明示 critEligibility=never；治疗／增益／位移／控制均不消费暴击词。

**基础暴击独立验收向量（待实现后执行）**：采用本稿远古龙AD=85，主目标与合法锥形次目标均500HP、护甲0、无盾、无增伤／减伤、无完全防止或转移，攻击者无其他属性修饰。为该唯一已规划普攻指定combat随机词 `word=0`（这是词，不是seed）；G03门槛 `0×10000 < 2500×2^32` 成立，主包为 `floor(85×14000/10000)=119`，主目标余381HP。每个选中的次目标仍只受 `floor(85×3500/10000)=29`，余471HP；副包是physical/ability-direct/never，不继承主包暴击、不获得技能暴击授权，且不额外抽词。整次普攻包括至多两个副包总计只消费1个combat词；若错误保留旧中立0%基础值，同一AD及word主包只会是85，这是必须能检出的接入失败。

保存／恢复向量从该攻击前的同一冻结内容版本、战斗投影与RNG状态分成连续运行和恢复后运行两条路径：两者均接受合法的新中立投影，均得主包119、副包各29及同样的事件序列、RNG状态／词数增量1；恢复本身不消费词。不得以旧的 `uncompiled spell critical sources` 分支拒绝正确投影，也不能通过放行任意2500输入绕过同版本内容校验。已执行攻击后的存档恢复不能重发伤害或再消费该词。

所有怪物无羁绊、无装备、不可购买／合成／出售／部署到玩家队，unitKind=neutral 与 monsterFamily 是领域分类，不根据 definitionId 前缀推断。怪物 cost 字段如为旧类型兼容填写1，只是内部结构占位，不能进入商店或掉落英雄池；优先采用有 neutral 类别的目录结构。

以下是这12个模板的有限分类内容声明，全部 `unitKind=neutral`；`monsterFamily` 必须从冻结内容读取并参与内容 digest，恢复时按声明校验，不能从 definitionId 的前缀或名称临时推断。

| definitionId（完整枚举） | monsterFamily |
| --- | --- |
| pve-minion-melee-a、pve-minion-melee-b、pve-minion-ranged-b、pve-minion-melee-c、pve-minion-ranged-c | minion |
| pve-krug | krug |
| pve-wolf-large、pve-wolf-small | wolf |
| pve-razorbeak-large、pve-razorbeak-small | razorbeak |
| pve-elder-dragon | elder-dragon |
| pve-rift-herald | rift-herald |

领域中立分类的正式字段、校验与恢复格式由 [合同补充](M8B_CONTRACT_ADDENDUM.md) 定义。所有上述单位同时遵守 B2 的 B-02：**对中立单位的 item-burn 每个 pulse 在增伤后封顶100，再进入完全伤害防止及护盾**；使用既有 G02 伤害及 G07 护盾流程，不为野怪另写伤害算法，也不把100误用为所有真伤或每个仿真tick上限。例：9000最大生命的1%灼烧、50%增伤，90→135→100；再有70盾则盾吸收70、HP伤害30。周期频率仍为G05的20tick，强弱来源按G04规则取有效贡献。

## 4. 招牌机制的精确定义

### 4.1 石甲虫：同伴死亡后补满缺血

触发者是仍存活的石甲虫自己的能力来源；监听同 encounterId、同队、monsterFamily=krug、不同unitId的开战同伴的一次正式死亡，同伴成员在combatStart冻结。仅响应死亡提交，卖出、清场、任务取消和物体删除不是死亡。一次消费身份包含 combatId、holderId、完整能力source key及deadUnitId，使用canonical tuple；同一持有者与同一死者最多一次，每场最多2次。每个tick先完成全部伤害、生死判定及本批全部死亡清理，再冻结仍存活的同伴并登记反应，不能处理第一个死者时救活第二个已致死者。

在死亡tick t，按deadUnitId→holderId稳定登记一次消费身份及反应计划，两者原子提交。这里是**死亡触发消费记录，绝不是LootReceipt**，不授予任何Match资源，也不替代实际治疗事件。恢复不重放事件。**t+1维护阶段仅出队并登记待处理的HealRequest生成任务，不修改HP、不提前冻结requested金额；实际G06治疗仍在t+1正常伤害后的存活治疗阶段执行。**来源在执行前已死、在t+1伤害批中已被打至0，或战斗已结束时均取消；不复活、不留到下场，也不回到tick t补发治疗。

实际治疗沿原G06的source key→targetId→packetId排序，不用deadUnitId→holderId的**登记顺序**覆盖治疗排序。每笔在其G06执行位置，以目标当时自身缺血×10000Bps构造direct HealRequest，无额外cap；先请求缺血整数，再按当前有效wound处理，最后按maxHp封顶。没有重伤时回满；有重伤时可以回不满，这是明确项目约定，不能直接 `hp=maxHp` 绕开治疗。

两个同伴同tick死亡产生两笔有限治疗任务，分别即时取样缺血，不预先聚合金额。例：t+1正常治疗阶段首笔执行前，存活者缺200、带3300Bps重伤，两笔之间无其他治疗或伤害，则第一笔134、第二笔按剩余缺血66请求并治疗44，共178，最终还缺22。若无重伤，第一笔200、第二笔0；每个任务仍只消费一次，零治疗不产生假伤害或额外攻击。这个例子不表示它能抵御t+1先发生的致死伤害。

G06可表达缺血治疗；G09当前**没有正式死亡事件与同类过滤**，应由 [合同补充](M8B_CONTRACT_ADDENDUM.md) 提供正式入口，不用kill-or-assist伪装友军死亡。伤亡后剩余两只仍满血时不会凭空增加生命；这使集中火力更有效，体现原招牌。

### 4.2 狼：开场跳后排一次

在双方开战常驻属性、初始装备和初始状态冻结后、第一次普通移动／动作前，执行一次开场位移计划。按狼unitId升序处理，整批只用开场敌人快照和初始占用快照；目标为存活、可选中敌人，按距本狼开场格距离降序→unitId升序排列。

依次尝试目标的相邻合法空格；空格必须在7×8棋盘内、不被任何开场存活单位占用、不被此前狼预订。对这些格按“更深敌方后排”优先排序：敌方狼攻击玩家时row降序，若以后复用到玩家侧则row升序；再按距狼起点距离升序→col升序→row升序。第一目标没有合法格则尝试下一目标。全无合法落点则原地留下、能力记已消费，后续走普通移动，不重试、不重抽、不覆盖单位。

所有落点先预订再原子提交，不能因数组输入顺序不同产生交换／重叠；本批内不复用其他狼刚离开的起点。位移瞬时，无飞行无敌、无隐身、无免控、无额外伤害；没有在半途停留的状态。受已生效的禁位移控制则该狼跳跃取消且记消费；普通选择／攻击在位移后沿G10重新运行。开战来源身份和consumed标记保存，恢复绝不再跳。

这是“跳后排”题材的有限项目实现；原始描述未证明本稿的最远排序、落点排序与位移时间。G10有farthest-id，但既有Effect/AbilityOperation没有位移，必须补充。

### 4.3 鸟：同伴死亡增加基础攻速比例

监听同 encounterId、同队、monsterFamily=razorbeak、不同unitId的开战同伴正式死亡；大小鸟互相算同类。与石甲虫共用冻结同伴集合、完整死亡清理批次与去重语义；持有者必须在本批全部死亡清理后仍存活。同tick全灭无人得层，不能先加速救命。

每个不同同伴死亡加 **1500Bps攻速**，相对本鸟原始基础AS，与所有普通AS增益加法汇总；每鸟每场最多5层，累计7500Bps。在t的完整死亡清理后记录，startsAtTick=t+1，在t+1维护中生效、持续本场；来源此前已死或战斗已结束则取消。next-tick只以原死亡tick t计算一次，不能在t+1出队时再推迟到t+2。同一死者只贡献一层，超cap不再排增益；既有等待冷却不被缩短。采用每次死亡一个固定1500Bps贡献，applicationId绑定deadUnitId，避免把立即自增的counter直接读入ModifierValue.counter而偷跑next-tick。

普通AS计算沿G01：8000×(10000+1500×层数)/10000。0/1/2/5层理论AS分别0.8/0.92/1.04/1.4，对应攻击间隔25/22/20/15tick。最后一鸟死亡清理本体增益，下一局0层。不产生治疗、额外普攻完成或任何RNG。

### 4.4 远古龙：主目标背后的窄锥形物理溅射

每次完成普攻只生成一次attack-completed；普通主包照常物理、可基础暴击。以此次动作冻结的龙起点和主目标位置确定方向：在board.getNeighbors固定 E、SE、SW、W、NW、NE顺序中取第一个严格靠近主目标的方向d，并将方向转为axial固定向量；不能在不同row奇偶下直接复用offset差值。

本项目锥形是主目标背后两层有限扇区，四个候选格为：`primary+d`、`primary+2d`、`primary+d+dLeft`、`primary+d+dRight`，其中dLeft/dRight为六方向中d相邻的两个方向。超棋盘格丢弃。排除主目标，仅选这些格上的存活、可选中敌人，按距primary距离→unitId排序，最多 **2 个**额外目标。集合在动作完成时固定，主目标没有合法冻结位置则无溅射。

每个额外目标产生 floor(本次已取样AD×3500/10000) 的 physical/ability-direct/critEligibility=never 包；不继承主包暴击与过量，也不重新抽词。85AD时每个29原始物理伤。rootActionSeq与父普通攻击关联，每个目标只一次，不再产生attack-completed/incoming-basic-hit，不递归触发自己的锥形。按G02抵抗、防止、护盾等正常处理，统计与受伤回蓝沿既有包资格。

最多两个额外包，没有额外目标时只是85AD普攻；后排分散与围绕主目标的站位会改变承伤。四格形状、35%与上限2均是项目参数，**不是归档提供的历史数值**。既有AbilityTargeting.path不等于锥形，需新增有限形状选择器，不得用radius圆形冒充。

### 4.5 先锋：开场有限冲锋、魔伤和短眩晕

开场常驻属性完成后只生成一次冲锋计划，不花法力、不伪造cast-completed。取敌人开场快照，按距先锋起点距离降序→unitId升序选最远可选敌人。按既有E、SE、SW、W、NW、NE，每步取第一个严格靠近目标的邻格；抵达瞄准格后，沿最后一步的axial方向续行，总计最多 **4 格**或遇棋盘边界结束，不绕障碍。这样允许穿过较近的瞄准单位后落到空格，而非总是在其身前停住。这是攻击路径，允许经过敌人占用格，但最终必须落在初始空格。落点取路径中最远的合法空格；若没有空格则本次冲锋取消且记消费，没有伤害／控制。不能推动、吃掉或覆盖占格单位。

实际冲锋段截断到落点。段上每个敌人最多命中一次，按路径位置顺序固定targetIds；友军不受伤。位移原子提交，不授予不可选中或免控。伤害任务在开场只排一次，**executeAtTick固定为1**，进入tick1正常伤害批；如果来源在执行前死亡或已生效控制取消则取消，已经完成的位移不倒退；取消标记与任务消费状态持久化，均不是LootReceipt。阶段顺序和任务挂载使用 [合同补充](M8B_CONTRACT_ADDENDUM.md) 的权威定义，不另设独立野怪tick。

每个已冻结目标执行时仍存活则生成 magic/ability-direct/never 包，金额 **floor(该目标当前maxHp×1500/10000)，封顶300**，取样时点packet，不用先锋自身9000HP。其后给存活目标10tick眩晕，控制按现有G04/G11免控处理，从伤害发生后的下一tick生效；伤害完全防止不等于免控，已有效免控可以挡眩晕。原始描述只给50%字符串，未明确各细节；本稿15%、目标生命基数、300上限、0.5秒眩晕均是项目调低后的明确选择。

沿途无敌人但有合法空格时只冲锋、0伤害。无敌人时不位移不发包；之后普通行动。单场最多1次，0随机词，未来不加入重复冲锋、击退、墙体碰撞或阶段增伤。

以下是**项目几何手算例**，不是历史脚本还原：

- 单敌前排：先锋在(3,1)，唯一敌人在(3,4)，固定路径为(4,2)→(3,3)→(3,4)→(2,5)。第四步是到达目标后沿最后一步axial方向续行；(2,5)空则先锋落在那里，(3,4)敌人计一次冲锋命中。目标1000最大生命时tick1请求150原始魔伤；存活且不免控则眩晕从tick2持续到tick12前。
- 无落点：位移入口的合成边界向量中，友军占(4,2)、(3,3)，敌军占(3,4)、(2,5)。选更远的(2,5)，同一路径四格均被占用，能力记已消费，先锋留在(3,1)，伤害／控制均为0。此向量只测试通用入口，不向6-7实战目录新增单位。

## 5. 难度预算与初始阵容

旧守卫数量由round-enemies.ts证实：阶段2/3各3，阶段4为4，阶段5/6各1，固定1星。下表用HP×(1+护甲/100)比较纯物理静态耐久，指标按有理数相加，不对每只怪先取整；它不是实战胜率，未计逐包取整、破甲、真伤、暴击、技能、治疗及站位。

| 轮次 | 旧总HP／静态物理有效HP | 新总HP／静态物理有效HP | 旧基础白字DPS→新基础白字DPS | 平衡意图 |
| --- | ---: | ---: | ---: | --- |
| 1-2 | 无 | 220／220 | 无→8 | 以项目固定起手的一星刀妹、无装备为验证基线 |
| 1-3 | 无 | 440／440 | 无→约17.1 | 刀妹＋全清1-2固定掉落的麦迪，不买牌；人工部署按OPENING |
| 1-4 | 无 | 760／760 | 无→约25.9 | 刀妹＋麦迪＋全清1-3固定掉落的拉克丝，不买牌；按OPENING的人口与部署边界上阵 |
| 2-7 | 1500／1800 | 1200／1440 | 84→72 | 降低初始20%耐久和约14%白字输出，容纳同伴回血；含暴击期望的比较另见下文 |
| 3-7 | 2700／3510 | 2700／3105 | 约130.4→110.4 | 生命相同、双抗下降，补偿五狼与跳后排威胁 |
| 4-7 | 4800／6720 | 4800／6000 | 约236.4→180 | 生命相同，降低初始火力，为死亡叠速留余量 |
| 5-7 | 6000／9000 | 6000／9000 | 100→85，满溅射约143 | 耐久沿用旧值，输出在分散与扎堆之间变化 |
| 6-7 | 9000／14400 | 9000／14400 | 约144.4→120，另一次冲锋 | 耐久沿用，减少持续输出支付开场技能预算 |

上表保留**未计暴击的白字DPS**口径。按本稿已批准的2500Bps／14000Bps基础暴击，2-7三只石甲虫每击白字30、暴击42；无目标减伤等干预时，普攻期望为 `72×(0.75+0.25×1.4)=72×1.1=79.2 DPS`。旧守卫基础暴击为0，期望仍为84，因此含暴击的普攻期望降幅为 `(84−79.2)/84≈5.7%`，不是白字表中的约14%。该期望不含同伴回血、阵型与实际逐包减伤，不能据此声称实测等难；其他模板也须按其已批准基础暴击参与实际平衡验证。

2-7三石甲虫以每次单体治疗不超过400的宽松界计算，额外治疗不超过1200HP（两次友死分别影响两个／一个幸存者），实际需扣除的HP总量不超过2400；目标必须存活且缺血，不能把宽松上界当成每局可达到的回血。集中击杀时额外治疗可接近0。这是设计上的站位／集火压力，不能说只看总HP就与旧版等难。

阶段1安全性只是设计目标，尚未运行战斗验证。**起手固定一星刀妹**，实际起手金币、经验、初始格位、人口和可操作时点以 [M8B_OPENING.md](M8B_OPENING.md) 为准。主验收路线全清且不买牌、不卖牌、不买XP：1-2使用刀妹；1-3人工部署刀妹＋1-2赚得的固定麦迪；1-4人工部署刀妹＋麦迪＋1-3赚得的固定拉克丝，均遵守OPENING的人口边界。正常商店运营仅作扩展平衡参考，不是主路线通关的前置条件；不新增随机初始英雄池或五种单卡穷举门禁。主路线也不等于任何布阵或卖空后必胜。野怪不另发胜利金币，掉落数量与奖励代理槽由 [M8B_LOOT.md](M8B_LOOT.md) 统筹，禁止因为鸟从4只改6只自动加两份奖励。

## 6. 与最小合同补充的关系

冻结B2合同要求缺项先报告。以下只记录本遭遇目录需要的能力，**正式事件、字段、有限操作类型与共同阶段顺序以 [M8B_CONTRACT_ADDENDUM.md](M8B_CONTRACT_ADDENDUM.md) 为权威**；本文不单独冻结新的TypeScript联合类型，不能声称G01–G12已经能执行全部野怪能力。若后续修订使两个文档在具体行为上不一致，应先同步修订并记录评审，不得让实现自行选一种。

| 最小补充 | 现有缺口 | 已批准的有限范围 |
| --- | --- | --- |
| 正式死亡触发与已消耗死亡身份 | Trigger无正式死亡事件；kill-or-assist语义不同 | 保存死亡身份、所属队伍/遭遇/怪物族及死亡时点；同批所有死者先冻结，监听者必须存活，按死者身份去重。既有Source可用ability，无需新增neutral sourceKind |
| 同类／遭遇过滤与领域中立分类 | TriggerListener只有敌我与距离，Condition没有family；neutral缺正式分类字段 | 内容显式区分neutral与怪物族；death listener限定同遭遇同队同族及排除自身，不开放任意脚本谓词。该分类也给burn中立封顶使用，避免前缀识别 |
| 有限开场位移操作 | Effect与AbilityOperation均没有move/relocate；path只是命中几何 | 仅支持本稿开场跳跃与有界冲锋，保存起点/目标/路径/预订落点/消费状态，并定义combat-start计划的正式挂载入口，不能假装TriggerDefinition.effects已能装任意AbilityOperation |
| 有限锥形选区 | AbilityTargeting只有圆区、path、chain等，无cone | 表达本稿两层四格锥形、maxTargets=2及稳定排序，不扩任意多边形 |
| 死亡反应延期及开场一次性任务 | 恢复不能重新跑combatStart；死亡处理在tick末 | 保存死亡反应及开场位移/伤害计划、延期时点与已消费标记；沿合同有限任务实现，不用setTimeout、UI回调或隐式每tick判断补发 |
| 新中立单位的G01攻速消费者 | 现行interval()对neutral直接返回固定周期 | 本稿新neutral用明确baseASBps，按既有G01公式算新攻击冷却；仅保留旧守卫基线的旧周期，不靠面板字段假装完成鸟叠速 |
| 新中立单位的G03基础暴击输入 | 现行neutral默认chanceBps=0，恢复校验也锁定0 | B3明确基础输入接点，B7从冻结内容编译初始投影，B9按相同内容及规则版本验证恢复；本稿2500／14000属于已批准基础配置，不改变暴击公式或技能授权；运行实现以§3的119／29／1词及恢复一致向量签收 |

G01负责鸟攻速；G02负责所有普攻／溅射／冲锋伤害；G03消费编译后的基础暴击输入并保留既有授权边界；G04/G11负责眩晕和免控；G06负责石甲虫治疗与重伤；G09复用触发上限与消费标记；G10复用距离与并列排序；G08保证无蓝单位不回蓝。最小合同增补已通过本轮设计复审，实施时仍须先完成并验收相应通用入口，再启用能力；不是再造一套野怪伤害、治疗或随机系统。

## 7. 后续最小验收（本稿未执行）

1. 八组全部合法坐标/唯一实例ID/固定1星；重新进入准备期与恢复都生成0额外遭遇词、0新实例。
2. 两石甲虫同tick死亡、三只同tick全灭、同伴死亡后战斗结束、3300Bps重伤示例；t+1维护不改HP、t+1伤害致死后取消治疗、G06执行时分笔取样；读档不重疗、不混淆触发消费记录与LootReceipt。
3. 五狼目标并列、落点争抢、满邻格后换下一目标、全无落点原地、输入数组置换与读档一致。
4. 鸟0/1/2/5层攻击间隔，双死同tick在t+1而非t/t+2得到3000Bps，不重置已运行冷却，不因死亡事件重复加层。
5. 龙四格锥形在奇偶row和边角都一致；主包暴击不使29溅射翻倍；最多2副包；每攻击仅1次attack-completed与1暴击词。
6. 先锋冲锋起点/路径/落点不重叠；目标2000maxHp命中300（cap），1000命中150；免控/完全防止分别验证；位移后恢复不再冲锋。
7. 阶段1以OPENING的刀妹→刀妹＋麦迪→刀妹＋麦迪＋拉克丝、全清且无买卖/买XP路线为主验收，以及2-7/3-7/4-7对常见合理阵容的通关率和时长；只对超出预算的那一组调本表，不能偷偷改英雄、装备、G01/G02或全局tick。
8. 独立执行§3的基础暴击与恢复向量：AD85、word0、0抗／无盾／无增减伤，主包119、每个副包29、一次普攻恰好1词；连续运行与恢复后运行一致，不能退回旧neutral的85，也不能重发攻击。

以上表格是可审阅的首版参数，不是已实测平衡或历史精准复刻的结论。
