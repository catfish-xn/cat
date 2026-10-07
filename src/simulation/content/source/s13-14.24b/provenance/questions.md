# B1 未关闭问题（部分归档，禁止签收为完整冻结）

使用用户提供的固定英文原档及计划列明的官方补丁交叉核对。44 条完整装备记录和 36 配方已取得；这不等于完整机制已经核准。数值裁决遵循用户已批准的 source-policy.json。

- Q01 中文名（待人工确认、不阻塞英文研究）：按用户要求，44 项暂取 M8_PLAN.md §1.1 与附件 A，标记“临时译名，未核对”，仅用于显示。逐项清单见 docs/M8_ITEM_NAMES_REVIEW.md。用户稍后提供 zh_cn.json 后，按 apiName 逐字核对替换；不能据译名改身份、配方或数值。
- Q02 字段单位与有效性：effects 混用分数、百分数、秒及未解码 hash 键；部分键可能是旧参数。所有 sourceEffects 原值保留，只按该条原始 desc 的明确格式标注分数百分比、百分数、秒、法力及组件明确属性单位；其他标为 source-unit-unknown，不自动乘 10000。Adaptive Helm 的 {d357c9f2} 原值为 null，保留 null。下一证据：逐字段工具提示、客户端脚本及已核准补丁核对。
- Q03 14.24b 覆盖：Bramble Vest PercentMaxHP 原值为 0.07000000029802322；Hand Of Justice StatOmnivamp_NotStatBar 原值为 0.11999999731779099。它们与计划中 7%/12% 校验锚点数值相符，本轮独立核对 Riot 14.24 公告已确认两项变更包含在原档，不重复覆盖；但不代表全装备覆盖审查完成。
- Q03b 巨人杀手已按获准规则处理（非阻塞）：DamageAmp=2000 Bps（20%条件额外增伤）、HealthThreshold=1750；desc 的 more than 明确比较符为 >，恰好1750不触发。隐藏键5%映射、与20%相加、未引用LargeBonusPct不采用、逐伤害包按目标当前最大生命值判定，已列GS-01至GS-04，统一标记“项目约定，非官方证据”，待人工审阅但先继续。详见 project-conventions.json / docs/M8_PROJECT_CONVENTIONS_REVIEW.md。
- Q04 机制：生命恰好 50% 时正义之手如何处理；灼烧/重伤/减抗的叠加和生效顺序；暴击、吸血与装备触发的资格；夜之锋刃清除/重选；窃贼手套池、权重和刷新。文本不是完整脚本。Thief's Gloves 的 unique=false 不能解释为允许多件，它的 desc 明确占三槽。按新的desc语义政策逐项研究；仍无法确定的边界/叠加细节转为明确项目约定并列确认，不再以这些小细节阻塞整个B1。对应实现与测试仍由B2–B5完成。
- Q05 阶段 1 与开场：没有 1-x 映射、初始资源、商店/自然 XP 时序、逐步开场账本。原档根节点只有 items/setData/sets，不能从英雄 cost 或旧游戏开局推导这些规则。下一来源：固定版本 map/模式脚本及可定位历史录像。阻塞 B6。
- Q06 PvE：标准集存在 TFT_BlueGolem、TFT9_SLIME_Crab、TFT_Krug、TFT_Murkwolf、TFT_MurkwolfMini、TFT_Razorbeak、TFT_RazorbeakMini、TFT_RiftHerald、TFT_ElderDragon 九条候选记录；完整原档可离线读取。集合成员不证明它们出现在某轮、某个 Boss 池或正常开场；不得把 TrainingDummy/Voidspawn 混为确定野怪。Crab HP 为 null，Razorbeak 被动无攻速增幅变量，Herald 描述缺眩晕时长。缺少数量/星级/站位/阶段倍率/行为细节。下一来源：固定版本 neutral/map 脚本。阻塞 B7。
- Q07 掉落：无逐轮/逐怪权重、保底计数、击杀触发与领取资格；不能从装备列表、少量录像或现行攻略估算。未知历史权重保留 unknown。D3-A 的具体受限单人表未提出也未批准，不能虚构成官方表。阻塞 B8。

覆盖矩阵对每件装备明确保留独立数值测试和实现为未开始；此轮 Python 测试只证明离线源提取、模式/配方边界、hash 与再生成一致性。
