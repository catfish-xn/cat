# ②真实组合恢复控制（逐批追加）

这些控制补齐②已经实际启用的领域路径，不等于③查询/隐藏信息完整样例，更不是B9应用导入或容量验收。所有前缀来自公开Match命令；不得用修改gold/HP/roster/成长/出生事实制造可保存状态。纯机制算例保留自己的分层与非法恢复拒绝。

## 同tick多来源与真实部分击杀

`tests/m8-b8-live-reveal.test.ts`以seed42的既有mage公开策略运行到4-7，然后停止，未读golden或留存JSON来造输入。

- 自然tick52，r00/r01两条真实死亡eventSeq158/159：同tick三slot揭示的death序列158/158/159。此时不发资源、收据，不消费ID/RNG；重复领域reveal同state且零事件。
- 揭示前、揭示后、待选、选后均完整restore；恢复分支与不中断分支的完整最终state/events相等，Continue不越过待选。直接两收据、选择第三收据均恰一次。
- 同一个公开准备前缀，只通过deploy撤下其余英雄：单Rell unit10在tick344仅杀r00后败，两个direct授予、choice forfeit；单Nami unit21在tick218仅杀r01后败，两个direct forfeit、只留下earned choice。不是人工死亡/战果。
- 两种败局在揭示后分别恢复并续算，完整state/events一致；实际出生数量和ID精确核对，forfeit不授予。伪造死亡身份或给未死source改revealed明确拒绝，保未篡改正控。
- 原样专项3/3通过。最终全局typecheck与受测SHA另随批次记录；不能拿旧75c8的CI183覆盖新测试。

## 经济真实绑定

`tests/m8-b8-live-economy.test.ts`保留独立oracle的H80→88/120/120手算向量不动，另以实际可达H112检查生产路径。

- seed42自然开场，实际2-1选投资，2-1/2-2/2-3/2-5/2-6公开撤兵败局；2-7前真实60G/HP73/H112，历史利息总14独立列明。
- 实际三Sword来源合Deathblade并装备Maddie，公开购买及reroll形成9/49/50G三个战前余额。2-7真实+1G先入账，收入5+1/5/5，结果16/60/61G；真实H112加8/40/40成为120/152/152。
- 每分支恢复前后逐tick完整state/events一致，历史Combat输入中的H112不被奖励后H覆盖。实际belt item5、+1G、选择tear item6的canonical收据、出生/提交顺序、counter全部用独立字面预期核对。
- 揭示不发资源；待选Continue/出售/重开拒绝。选后不重算收入/投资，不变Combat/basis/RNG；重复step/choice/stale Continue不重发。下一轮清Combat仍保所有收据/来源。
- 同例精确拒绝gold、interestBasis、投资进度、固定payload、删除commit、错误sequence/birth/counter、伪terminal方法等，避免无关来源错误冒充经济拒绝。
- 新3支及既有B8 restore七项共10/10通过，最终全局typecheck与受测SHA随批次记录。

经济＋reveal最终原样两文件6/6通过（6.53s），原始日志`live-economy-reveal-final.log.gz`；统一全局typecheck通过，日志`live-combinations-typecheck.log.gz`。针对检查通过不代表最终全量/CI。

## 真实stock＋本战delta与掉落立即合并

`tests/m8-b8-live-growth.test.ts`固定seed49，仅重放公开采购/部署/战斗命令，不从存档注入状态。两Tristana实际前战stock为unit13=250、unit17=125，3-7公开将Corki暂置备战，unit17当战tick74再获125；tick166实际掉落candidate unit25使unit13升二星，最终为250+125+125=500。旧Combat仍保存原两英雄与各自delta，奖励后roster不反向改写开战依据。

- 真准备、开战、活跃揭示、最后tick前、待选、选后六边界完整strictrestore；从tick74恢复分支剩余每tick完整state/events等价，Start完整事件也相同。
- 候选unit25记唯一真实receipt/birth并被消费，没有留在准备阵容或重建为Combat单位；本战sourceDeltas只保存原unit17的125，既有375不可重复算。
- 重复step、失败Start、旧choice、重复Continue均保原引用、调用前后序列化不变；选择及Continue不再次提交成长。
- 20项精确篡改拒绝覆盖stock/delta、source身份/步长、唯一commit、receipt候选、消费与basis等。复活已消费成长ID先命中既有persistent growth schema边界，明确保留该实际拒绝层，不假称总会进入后续fold。
- 最终26/26（六正向＋20负控）、全局typecheck通过，原日志同批封存。该真实奖励案例是一层；两层stock/delta级联仍由既有纯runtime/fold向量覆盖，真实九卡采购的同命令两层升级及restore另在B5正控，不混称真实两层奖励路线。

## 真实满席出售补发与必要终局

`tests/m8-b8-live-capacity.test.ts`使用seed230/cannon真实前缀。2-7前37条命令、8战/2889tick；4-7前driver188条命令及58条公开bench部署，共246命令、20战/2020tick。后者14次合法空板失败自然累计损失97HP，不注入HP、roster、出生或战果。

- 2-7前公开9购+4reroll填九满bench，剩19G。真实k01 tick69揭示gloves/Maddie，k02 tick138揭示choice，tick172胜利：Maddie pending-capacity无receipt/ID/RNG额外消耗，经济19→25仅1利息。待选不能出售或Continue；真实选择后公开卖Zoe得4G、自动Maddie入库恰一次，25→29不回算interest/投资/XP/成长；清完容量不继续开放结算卖出。
- 4-7前真实HP3，公开仅保Tristana/Rell并购Nami/Urgot填九满：r01 tick206、r00 tick342死，tick849战败HP0，Ezreal retained-terminal无receipt/折金，gloves与冻结tear fallback各发一次。
- 同一合法低HP前缀单Loris仅杀r00败：direct照赚、choice forfeit；单Ezreal仅杀r01败：direct全forfeit、tear fallback恰一次。终局不留可操作choice，重复step/恢复/错误命令不再发资源。
- 所有关键命令与恢复分支完整结果state/events相等；pending、release、terminal均完整strictrestore；重复step持原引用、零事件、调用前后序列化相等。容量状态、销售顺序/价格/经济、伪fallback及guarantee counter负控全部精确锚定错误，不以任意throw替代目标边界。
- 最终原样6/6（5.79s）、统一typecheck通过，`live-capacity-final.log.gz`与类型日志同批保留。无生产修复、无timeout/worker/skip变动。

## 真实奖励合并同时迁移装备／异常／G12

`tests/m8-b8-live-transfer.test.ts`以seed230/cannon真命令到3-4选择，再公开分叉。3-5卖旧二星Ezreal及两Maddie返装；真实generation20/24各购一星Ezreal unit21/22，2-7实际gloves与3-4实际gloves合TG item9给unit22，4-6真实mage-armor绑定unit22。4-7实际奖励unit24被消费，unit21升星、unit22消失于当前准备阵容。

- 同一个真实准备输入的迁移分支：TG及archangel/deathcap两临时子件、异常迁至unit21；冲突分支只公开equip已拥有belt到unit21，TG按既有独占规则返库存、临时子件移除，异常仍迁移。不是重新分配或重掷TG。
- 旧Combat/basis保原unit22一星、TG/source/anomaly/10条roll前缀，finished当前投影则按真实升级事件迁移或返还；所有准备/开战/揭示/最后tick前/待选/选后完整strictrestore与完整state/events续算全等。
- 开战LootReceipt10/ScheduleReceipt7/provenance64/roll10-draw20；完成待选分别12/7/68、unit serial25/item serial14；选择后13/7/69、item serial15。Continue至5-1迁移分支按既有规则新增唯一roll11/draw22，返库存分支仍10/draw20。重复命令不新增资源、ID或RNG，原引用及调用前后序列化保持。
- 12项精确篡改拒绝，最终19例与相关growth/basis/B5五文件共122/122、typecheck/diff检查通过；只认`live-transfer-target-reviewed.log.gz`、`live-transfer-typecheck-reviewed.log.gz`。内部预检不是外部签收。
- 初稿两项预期修正有独立依据：二星三费售价为既有表3×3−1=8G，不是9G；basis异常目标损坏实际先命中既有resolved strategy边界。另两处TypeScript测试字段误写按现有itemCombined/itemId及FrozenDirectDrop类型修正。初失败日志原样保留，不算生产缺陷或规则变更。

这些②已启用路径的直接组合至此均有真实公开来源/恢复控制。③readLootView、隐藏信息完整样例、其余跨轮组合及既有后续延期仍按检查点边界保留；两层奖励级联没有新增live案例，分层证据见上节。最终固定源码全量/CI尚待执行，不据专项宣称②签收。
