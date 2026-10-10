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
