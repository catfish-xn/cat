# G2-4b 神器（第一批：现有装备程序可表达的部分）

- 源：`raw/en_us.json.gz`（14.24，sha256 c1237ba2…）的 `ORNNARTIFACTS_SET6` 共 29 件；中文名取 `zh_cn.tft.stringtable.json.gz`。
  抽取脚本 `extract-artifacts.py` → `src/simulation/content/g2-4-artifact-source.ts`（29 件全量入库，进内容摘要）。
- 执行：`src/simulation/content/g2-4-artifacts.ts`，只登记能用现有装备程序词汇（属性、周期、触发、生存阈值、状态、伤害）表达的 6 件，
  其余 23 件不登记（`G24_ARTIFACT_PENDING`），约定编号 `G24-ARTIFACT-SUBSET-01`。
- 版本：`G23_POLICY.revision` 由 `g2-3-followup-v2` 升为 `g2-4b-artifacts-v1`，内容摘要随之变化；用原生成器重录 release / Herald / inputs / live-reveal，事件哈希不变。
- 本批物品只是定义，正常对局还拿不到：神器锻造器与征服者第 10/14 档恢复在后续 PR。

## 已实现（6 件）

| apiName | 中文名 | 执行 | 未执行 / 约定 |
|---|---|---|---|
| TFT4_Item_OrnnAnimaVisage | 生命盔甲 | 属性；每 20 tick 治疗 3.5% 最大生命 | — |
| TFT4_Item_OrnnInfinityForce | 三相之力 | 只有属性（AD 25%、AP 25、AS 25%、双抗 25、生命 250、法力 25） | — |
| TFT4_Item_OrnnZhonyasParadox | 中娅悖论 | 生存阈值 40%，每场一次：无法被选取 + 免疫伤害各 60 tick | — |
| TFT9_Item_OrnnDeathfireGrasp | 冥火之拥 | 伤害增幅 25%（`{1543aa48}` 解码为 StatDamageAmp）；开战对最近敌人造成其 40% 最大生命魔法伤害；此后每 260 tick 对当前普攻目标重复 | 开战瞬间还没有普攻目标，取最近敌人（约定）；StatDamageAmp 按属性栏常驻增幅理解（描述未提） |
| TFT_Item_Artifact_TalismanOfAscension | 飞升护符 | 第 440 tick 一次：最大生命 +100%（当前生命同增），伤害增幅 +120% 至战斗结束 | — |
| TFT_Item_Artifact_Mittens | 连指手套 | 攻速 60%；受到的物理/魔法伤害降低 25%（`PercentDR`；`{cd951938}` 解码为 StatDurability 0.25，是同一数值的属性栏形式，只算一次；与坚定之心同一过滤） | 移动速度提升不执行（项目移动间隔全局固定）；冰冷免疫无对象（项目没有冰冷） |

未命名键用 32 位 FNV-1a（小写）哈希对候选名解码，见 `/mnt/project-files/planning/g2-4b-values-2026-10-17.md` 第 2 节（"G2-4b 数值考证"线）。14.24b B 补丁没有神器条目，数值一律取 14.24 原档。

## 未实现（23 件）及所需扩展

小扩展（现有引擎加一个条件、数值来源或状态即可）：

| 物品 | 缺什么 |
|---|---|
| 魔蕴 Manazane | 首次施法后 5 秒内持续回蓝（触发器不能挂周期任务） |
| 碎舰者 Hullcrusher | "开战时无相邻友军"条件 |
| 狙击手的专注 Sniper's Focus | 按与目标的格数增伤（射程 +2 可拼） |
| 视界专注 Horizon Focus | "眩晕敌人时"触发事件 |
| 无终恨意 Unending Despair | 护盾破裂触发拿不到被破护盾的初始值，且需区分破裂与到期 |
| 疾射火炮 Rapid Firecannon、探索者的护臂 Seeker's Armguard | 只有"参与击杀"事件，没有"亲手击杀"条件 |
| 激发之匣 Innervating Locket | 按最大法力百分比回蓝、施法后持续治疗 |
| 卢登的激荡 Luden's Tempest | 装备触发器读不到超杀量 |
| 密银黎明 Silvermere Dawn | 攻速锁定 |
| 枯萎珠宝 Blighting Jewel | 固定值叠加削魔抗、目标魔抗为 0 的条件 |
| 光盾徽章 Lightshield Crest | 按持有者双抗算护盾值 |
| 智慧末刃 Wit's End | 阶段数值已解码（42/42/60/75/90/100/100/100），但程序在快照时是固定的，要按对局阶段取值；另需"只按魔法伤害吸血" |
| 巫妖之祸 Lich Bane | 阶段数值已解码（200/200/270/340/410/480/480/480），同样要按阶段取值；另需"施法后第一次攻击"的武装攻击 |

新机制（原定最后一个 PR）：死亡之蔑（伤害延迟流血）、金币收集者 / 投机者之刃 / 大亨之铠（战斗中掉金币）、诡术师之镜（分身）、迷离风衣（复制体）、鱼骨头（随机目标）、暗行者之爪（冲刺）、幽魂弯刀（传送）。
