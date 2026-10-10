# ②失败闭环（逐根因追加，非最终验收）

起点为固定75c8/CI183的15文件92失败。既有①签收、CI174首失败、CI183原结果保留；后续代码须新SHA CI，不能引用旧结果替代。

## 批次A：旧phase与重复开场发奖（7项）

- B6弃权：旧m8整对象不变改为严格其余字段不变、所有当前未赚direct/choice按独立预期forfeited；仍保原2/3/5G、2/2/0XP、3HP、固定plan/RNG及round-trip。
- B6/B7开场：真实1-3自选先验证Continue wrong-phase且state同引用，通过公开选择后仍保原settlement/finished与完整restore检查。
- B7四seed：删除额外手发unit2/3，改验证实际Maddie/Lux一星和唯一receipt，再公开部署；10G/3级0XP/100HP保持，组件按已批准两次真实sword选择与零ScheduleReceipt精确核对。
- 原日志`phase-opening-seven.log.gz`：使用测试名称过滤，选中的7项全部通过；另外39项只是此次filter未执行，**不是新增skip、不是整个B6/B7文件通过**。原文件未增.skip/timeout/worker修改。余下强阵容来源恢复尚待下一批。

## 稳定编号与批次B：B5 caller、TG、来源分层（45项）

原92项按CI183失败标题出现次序固定编号，完整原文件/标题/分类/当前针对证据见`ci183-failure-cases.json`，以后不重编号。A为058/059/068/085–088。B为013–057：

- 013–015（equipment-history）：真实开场两gloves、合成TG、每次start/step历史，保原历史level上下界、完整envelope及伪造拒绝；没有把裸IF-GRANT当合法存档。
- 016–025（grant-upgrade）：四个IF-GRANT完整计划/无隐式receipt断言保留；每个非法中间态仍实际调用restore并精确拒绝，再以同definition真实选择/合成caller逐项round-trip。原假库存combine→equip→sale及伪二星buy链照走并精确拒绝，真实九张付费Irelia链保两级升级/返还/serial/RNG/失败原态。
- 026–033（instances）、034（queries）：原unique/exclusive/三槽/四件及七物品纯机制矩阵保留，同例非法完整Match恢复明确拒绝；逐一配真实选择/合成来源的同语义placement/parent-slot/消费正控与精确篡改拒绝。原四Deathblade超普通资源矩阵仍机制层，同槽容量以合法四Sword复证，不把其称作合法Deathblade路线。
- 035–057（temporary）：一般实际TG生命周期用真实2-1等级3低池；原2-1等级3/6/7/9机制数值保留，同例增加真实公开buyXp的2-1/2-5/2-7/4-2等级正控及精确负控。6→7为真实2-7 XP32/gold4后F，不注入经济。909HP/105护甲、首词3254118809/3773810212、所有43 child定义及其旧key拒绝保持。43覆盖只用纯roll预选还未覆盖的seed，再执行每个真实路线，不减覆盖。
- 正式专项：采购三文件37/37，TG/history两文件33/33，均全局typecheck通过。原5s超时保留，最终diff没有timeout/worker/skip变动；一次临时30s诊断已撤销，其日志不能当正式通过，正式日志为`b5-tg-original-timeout-tests.log.gz`。
- cfeec5e采购提交先于共享helper封存，是分批树，不把缺helper的单提交称作可验收；本批追加helper与TG/history后依赖闭合。最终仍须新代码全量/CI，不能将70项专项当全量通过。

## 批次C：中立与预览的真实公共阵容（058–092，共35项含A先修7项）

- 新helper实际执行seed42 sniper完整38轮33战，独立ledger逐事务验证，只缓存真实准备prefix，每个消费者先完整restore再用独立副本。未改英雄定义、星级、资源或出生事实。
- B6末三轮保原9次恢复、36–38轮身份、仅6-7终局及33战，不再手造三星Caitlyn/9成装。
- B7所有PvE开场/同tick控制/死亡/krug/bird/Herald原正负恢复向量保持；原仅作耐久靶的假Garen替换为实际原Irelia二星，用公共部署孤立，不变任何中立属性/控制时序断言。Herald aura/QSS/EoN所需组件由真实4-4选择分叉、后续正常战斗及选择/合成到6-7；不是把未赚奖励加进state。
- U5原opening-vs-live mana/HP/AS、只读查询、终局当前敌人预览原断言保持，输入改同一真实前缀。
- 每个负控先证明未篡改版本可恢复，再检查原指定错误；未用不相关resource fold提前拒绝冒充原机制拒绝。
- 原四文件完整120/120通过、0skip，39.83s，最终全局typecheck通过；日志`neutral-fixtures-four-files-final.log.gz`与类型日志。未变timeout/worker或生产实现。

## 批次D：容量层、真实成长、龙爪来源（001/002/011）

- 001：原九三星/27成装/完整events、deep-copy、20MiB界限和Continue/NewMatch清空压力断言全部保留。原命令路线前缀先完整restore；同例膨胀容量中间态以对象/JSON明确拒绝current resource fold，然后只用于observer机制压力。没有伪造来源使超合法资源上限的状态可保存。
- 002：真实收入到3-5、九次付费Tristana购买递归升三星，真实四组件合成Gunblade/Deathblade；原每击杀125、只结算一次、完整restore、重复step无事件、Continue/stale不重授全保留，新增伪造growth+125精确拒绝。原假Irelia改定义路径不再作为合法存档。纯250+375=625合并/出售机制例保持。
- 011：真实开场两次cloak选择、公开合成/装备，原tick39恢复→tick40完整事件/763HP/floor19治疗及历史验证保持；同例伪造receipt birth binding精确拒绝。
- 专项分别2/2、2/2、B3与真实装备helper组10/10；全局typecheck通过。日志与本批树一同保留，仍非最终全量/CI。

## 批次E：5-1三装备同action双包正控（012）

- 真正4-4选bow、4-5/4-6/4-7战斗、4-7选vest、5-1合成Titan；Warmog/Gunblade来自真实早期组件/合成，公开出售原持有人返还后装备原Irelia二星。原假Garen三星仅为耐久受击对象，没有Garen数值/技能预期被改写。
- 原120tick每tick完整restore与nextstep state/events全等、同action同source双正伤害至少+2层及25封顶断言全保持。同例真实三装准备可恢复后，伪造Titan消费输入为未拥有item-999999（格式和排序合法），对象/JSON两入口均精确拒绝`Invalid resource provenance: combination recipe/ownership`；原state不变。
- 完整B4文件14/14通过；一次并发未完成golden guard的Node类型错误阻断全局typecheck，guard迁至既有支持的mjs后本批最终全局typecheck通过。没有更改全局配置、类型依赖或timeout/skip。
- 至此原92的84项已各有专项闭环，剩003–010八项golden；仍待最终同树全量及②真实组合恢复验证。

## 批次F：有独立规则依据的完整golden迁移（003–010）

- 原ff60a79/4554f5a字节SHA007b6b41…完整保留；旧四构筑132轮state/events全部精确复现。新候选来自相同锁定Node22/依赖、固定已批准B8生产输入，内容digest314b4c1f；schema5/save1/replay1/protocol2边界不变。
- 四条新路线逐事务由独立ledger及独立birth/消费/growth审计；公开策略每条完整command复核，XP/HP/streak另有手算式提交检查，10loot+5supply组件、15G及两opening hero总量保留。相同完整战斗输入的1-2事件一致。逐轮完整叶子diff以已审核具体hash锁定，不能按顶层字段泛放行。
- 19项反例实际通过：错原字节/版本/源输入、未知嵌套/熟悉命令类型乱入、候选漂移等拒绝。完整候选SHA8d129f70…再顺序确定性复跑四构筑后一次原子写入；原完整state/events hash断言、skip、threshold未改。内部只读技术复核不代表Codex外部签收。
- 原样`npm test -- tests/m5-route.test.ts tests/m6-integration.test.ts`：2文件通过，8pass/9原skip，239.84s。至此CI183原92均有逐根因专项闭环；仍须同最终代码全量及CI，不能将专项相加当全绿。
- 原工具记录本地2814，远端等价50786a；src树和183文件hash已固定，正常远端clone缺本地对象的限制明确记于golden README。原审计/工具字节不事后覆盖，便携改动如需另提交。

### F后续：工具可移植性与原样guard收口

原受审工具/guard和f574审计字节另保留，当前工具只在固定远端50786a与本地2814中优先选择实际存在且whole/src树均精确相等的对象；183源指纹不变。新增5项ref拒绝控制，原19正文不变；**原样24/24通过**及typecheck通过，新portable审计67ad只读重新核八条capture/独立资源与旧新候选，candidate仍8d129，没有重新apply。旧19的单worker执行仅诊断证据，不当成原样门禁；原日志未覆盖。具体限制与两代hash见`golden/portable/README.md`，这仍是内部技术预检。
