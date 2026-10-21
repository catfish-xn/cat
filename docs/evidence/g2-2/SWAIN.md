# Swain 形态准入证据

> 本文为脱敏阅读副本；原始字段表在 `assets3d-local/path-migration-backup/docs/evidence/g2-2/SWAIN.md`。记录 canonical SHA256 指向原始记录，不用于对下表重算。

来源：`src/simulation/content/source/s13-14.24b/raw/en_us.json.gz`。

解压后 SHA256：`c1237ba2441f932a1b9761ce12887ad21089dffbd3a8004671cc9cb82dfd5bd3`。仅使用 `mutator=TFTSet13` 标准模式。

结论：暂不准入。源本体的 `magicResist` 为 null；恶魔形态的 `hp`、`damage`、`armor` 为 null。源中的 0 保留为 0，null 标为“缺”；不跨形态借值。恶魔形态技能为占位文案，不能据此实现远程/近战切换。

## TFT13_Swain

JSON pointer: `/setData/1/champions/73`；记录 canonical SHA256: `fd082e4bb8b26b847e2b0ee0f61042cbda34f68346ca31914b3453d7bf69479c`。

| 字段（相对 pointer） | 源值 |
|---|---|
| `/ability/desc` | "Heal <scaleHealth>@ModifiedHeal@&nbsp;(%i:scaleAP%)</scaleHealth> and ascend for @Duration@ seconds. While ascended, heal <scaleHealth>@ModifiedHealPerSecond@&nbsp;(%i:scaleAP%)</scaleHealth> and deal <magicDamage>@ModifiedDamage@&nbsp;(%i:scaleAP%)</magicDamage> magic damage to adjacent enemies every second. On takedown, the ascension's duration is extended by @BonusDuration@&nbsp;seconds." |
| `/ability/icon` | 素材引用已迁至本地备份 |
| `/ability/name` | "Demonic Ascension" |
| `/ability/variables/0/name` | "Heal" |
| `/ability/variables/0/value/0` | 0.0 |
| `/ability/variables/0/value/1` | 240.0 |
| `/ability/variables/0/value/2` | 300.0 |
| `/ability/variables/0/value/3` | 380.0 |
| `/ability/variables/0/value/4` | 460.0 |
| `/ability/variables/0/value/5` | 0.0 |
| `/ability/variables/0/value/6` | 0.0 |
| `/ability/variables/1/name` | "HealPerSecond" |
| `/ability/variables/1/value/0` | 0.0 |
| `/ability/variables/1/value/1` | 70.0 |
| `/ability/variables/1/value/2` | 90.0 |
| `/ability/variables/1/value/3` | 125.0 |
| `/ability/variables/1/value/4` | 130.0 |
| `/ability/variables/1/value/5` | 0.0 |
| `/ability/variables/1/value/6` | 0.0 |
| `/ability/variables/2/name` | "DamagePerSecond" |
| `/ability/variables/2/value/0` | 0.0 |
| `/ability/variables/2/value/1` | 40.0 |
| `/ability/variables/2/value/2` | 60.0 |
| `/ability/variables/2/value/3` | 95.0 |
| `/ability/variables/2/value/4` | 130.0 |
| `/ability/variables/2/value/5` | 0.0 |
| `/ability/variables/2/value/6` | 0.0 |
| `/ability/variables/3/name` | "Duration" |
| `/ability/variables/3/value/0` | 6.0 |
| `/ability/variables/3/value/1` | 6.0 |
| `/ability/variables/3/value/2` | 6.0 |
| `/ability/variables/3/value/3` | 6.0 |
| `/ability/variables/3/value/4` | 6.0 |
| `/ability/variables/3/value/5` | 6.0 |
| `/ability/variables/3/value/6` | 6.0 |
| `/ability/variables/4/name` | "BonusDuration" |
| `/ability/variables/4/value/0` | 2.0 |
| `/ability/variables/4/value/1` | 2.0 |
| `/ability/variables/4/value/2` | 2.0 |
| `/ability/variables/4/value/3` | 2.0 |
| `/ability/variables/4/value/4` | 2.0 |
| `/ability/variables/4/value/5` | 2.0 |
| `/ability/variables/4/value/6` | 2.0 |
| `/apiName` | "TFT13_Swain" |
| `/characterName` | "TFT13_Swain" |
| `/cost` | 3 |
| `/icon` | 素材引用已迁至本地备份 |
| `/name` | "Swain" |
| `/role` | "APTank" |
| `/squareIcon` | 素材引用已迁至本地备份 |
| `/stats/armor` | 0.0 |
| `/stats/attackSpeed` | 0.5 |
| `/stats/critChance` | 0.25 |
| `/stats/critMultiplier` | 1.399999976158142 |
| `/stats/damage` | 50.0 |
| `/stats/hp` | 650.0 |
| `/stats/initialMana` | 0 |
| `/stats/magicResist` | 缺 |
| `/stats/mana` | 10.0 |
| `/stats/range` | 1.0 |
| `/tileIcon` | 素材引用已迁至本地备份 |
| `/traits/0` | "Conqueror" |
| `/traits/1` | "Form Swapper" |
| `/traits/2` | "Sorcerer" |

## TFT13_SwainDemonForm

JSON pointer: `/setData/1/champions/74`；记录 canonical SHA256: `b24674963ba8d1ddc03241e1437774124f7bb338116ab68214417b379f37fb9e`。

| 字段（相对 pointer） | 源值 |
|---|---|
| `/ability/desc` | "Placeholder Tooltip" |
| `/ability/icon` | 缺 |
| `/ability/name` | "Placeholder Name" |
| `/ability/variables` | [] |
| `/apiName` | "TFT13_SwainDemonForm" |
| `/characterName` | "TFT13_SwainDemonForm" |
| `/cost` | 11 |
| `/icon` | 缺 |
| `/name` | "SwainDemonForm" |
| `/role` | 缺 |
| `/squareIcon` | 缺 |
| `/stats/armor` | 缺 |
| `/stats/attackSpeed` | 0.800000011920929 |
| `/stats/critChance` | 0.25 |
| `/stats/critMultiplier` | 1.399999976158142 |
| `/stats/damage` | 缺 |
| `/stats/hp` | 缺 |
| `/stats/initialMana` | 0 |
| `/stats/magicResist` | 20.0 |
| `/stats/mana` | 100 |
| `/stats/range` | 1.0 |
| `/tileIcon` | 素材引用已迁至本地备份 |
| `/traits` | [] |

## 源中未提供的形态合同

| 字段 | 证据 |
|---|---|
| 远程形态完整属性 | 缺 |
| 远程形态技能/系数 | 缺 |
| 站位与形态选择条件 | 缺 |
| 本体到恶魔形态属性覆盖规则 | 缺 |
| 切换时法力继承规则 | 缺 |
