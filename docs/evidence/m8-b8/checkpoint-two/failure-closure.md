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
