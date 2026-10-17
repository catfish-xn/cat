# G2-4b 神器（21 件：除 8 件新机制外全部）

- 源：`raw/en_us.json.gz`（14.24，sha256 c1237ba2…）的 `ORNNARTIFACTS_SET6` 共 29 件；中文名取 `zh_cn.tft.stringtable.json.gz`。
  抽取脚本 `extract-artifacts.py` → `src/simulation/content/g2-4-artifact-source.ts`（29 件全量入库，进内容摘要）。
- 执行：`src/simulation/content/g2-4-artifacts.ts` 登记 21 件；另 8 件要新机制，不登记（`G24_ARTIFACT_PENDING`），约定编号 `G24-ARTIFACT-SUBSET-01`。
- 版本：`G23_POLICY.revision` 由 `g2-3-followup-v2` 升为 `g2-4b-artifacts-v1`，内容摘要随之变化；用原生成器重录 release / Herald / inputs / live-reveal，事件哈希不变。
- 本批物品只是定义，正常对局还拿不到：神器锻造器与征服者第 10/14 档恢复在后续 PR。
- 14.24b B 补丁没有神器条目，数值一律取 14.24 原档。未命名键用 32 位 FNV-1a（小写）对候选名解码，见 `/mnt/project-files/planning/g2-4b-values-2026-10-17.md` 第 2 节。

## 已实现（21 件）

| apiName | 中文名 | 执行 | 约定 / 未执行 |
|---|---|---|---|
| TFT4_Item_OrnnAnimaVisage | 生命盔甲 | 每 20 tick 治疗 3.5% 最大生命 | — |
| TFT4_Item_OrnnInfinityForce | 三相之力 | 只有属性 | — |
| TFT4_Item_OrnnZhonyasParadox | 中娅悖论 | 生命 ≤40% 时一次：无法被选取 + 免疫伤害各 60 tick | — |
| TFT9_Item_OrnnDeathfireGrasp | 冥火之拥 | 伤害增幅 25%（`{1543aa48}`=StatDamageAmp）；开战对最近敌人 40% 最大生命魔法伤害，此后每 260 tick 对当前目标重复 | 开战瞬间无普攻目标，取最近敌人 |
| TFT_Item_Artifact_TalismanOfAscension | 飞升护符 | 第 440 tick：最大生命 +100%、伤害增幅 +120% | — |
| TFT_Item_Artifact_Mittens | 连指手套 | 受到的物理/魔法伤害 -25%（`{cd951938}`=StatDurability 0.25，同一数值只算一次） | 移速不执行（移动间隔全局固定）；冰冷免疫无对象（项目没有冰冷）；减伤按引擎既有规则多来源取最大、不相乘，与其它减伤不叠加 |
| TFT_Item_Artifact_RapidFirecannon | 疾射火炮 | 射程 +1，亲手击杀再 +1 | — |
| TFT_Item_Artifact_SeekersArmguard | 探索者的护臂 | 参与击杀 +15、亲手击杀 +20 护甲/魔抗/法强 | — |
| TFT_Item_Artifact_SilvermereDawn | 密银黎明 | 攻速锁定每秒 0.5 次；普攻眩晕 16 tick；免疫控制 | — |
| TFT9_Item_OrnnHorizonFocus | 狙击手的专注 | 射程 +2；每格距离伤害增幅 +9% | 格数按两格中心距离（相邻=1），与项目狙神羁绊相同 |
| TFT9_Item_OrnnHullbreaker | 碎舰者 | 无相邻友军时 +600 生命、+20% 攻击力、+20 法强 | 按布阵站位在策略快照判断（与大块头伙伴相同），开场位移不重算 |
| TFT_Item_Artifact_HorizonFocus | 视界专注 | 携带者每次眩晕（施加或刷新）敌人，对其造成 30% 最大生命魔法伤害 | 战斗后段（击杀结算后）才施加的眩晕不触发 |
| TFT_Item_Artifact_UnendingDespair | 无终恨意 | 携带者护盾层被打破时，对最近敌人造成该层初始值 150% 魔法伤害 | 到期、死亡清理不算"打破" |
| TFT_Item_Artifact_InnervatingLocket | 激发之匣 | 被普攻命中回复 2% 最大法力；施法后 3 秒回复 20% 最大生命 | 法力四舍五入到整数；持续治疗每秒一跳，余数给前几跳 |
| TFT4_Item_OrnnMuramana | 魔蕴 | 本场首次施法后 5 秒回复 120 法力 | 每秒一跳 24 |
| TFT_Item_Artifact_LudensTempest | 卢登的激荡 | 携带者击杀时，100% 超杀 + 100 魔法伤害分别打向离目标最近的 3 名敌人 | 只有持有者的普攻、技能及其附加伤害打出的击杀才触发；装备伤害不递归，所以卢登自身、冥火之拥、智慧末刃附加伤害、视界专注闪电、无终恨意打出的击杀都不触发 |
| TFT_Item_Artifact_BlightingJewel | 枯萎珠宝 | 每个魔法伤害包使目标魔抗 -4（可叠加至战斗结束）；目标魔抗已为 0 时改为自己回 5 法力 | — |
| TFT_Item_Artifact_LightshieldCrest | 光盾徽章 | 每 60 tick 给生命比例最低的友军（含自己）护甲+魔抗之和 70% 的护盾，持续 100 tick；阵亡时给所有存活友军同样护盾 | 恢复存档只校验护盾为非负整数（存档不保留授予时的双抗） |
| TFT_Item_Artifact_ProwlersClaw | 暗行者之爪 | 亲手击杀后净化并立即跳到 4 格内最远敌人身边；之后 2 次暴击普攻暴击伤害 +60%；暴击率 50% | 冲刺按 G2-3 跳跃规则瞬移到目标旁最近空格，无动画 |
| TFT_Item_Artifact_WitsEnd | 智慧末刃 | 普攻额外魔法伤害（阶段 1–8：42/42/60/75/90/100/100/100）；造成的魔法伤害 35% 吸血 | 只排除以 equipment-proc 投递的装备伤害（冥火、卢登、闪电、无终恨意）；自己的普攻附加魔法伤害（attack-extra）照常吸血 |
| TFT_Item_Artifact_LichBane | 巫妖之祸 | 每次施法后第一次普攻额外魔法伤害（阶段 1–8：200/200/270/340/410/480/480/480） | — |

阶段在策略快照里按目录轮次的阶段取值；联机加时轮（6-7 之后，目录里没有）按第 7 阶段算，与 G2-4b 辅助装同一写法，取表里第 7 档（智慧末刃 100、巫妖之祸 480，与第 6 档同值）。表里第 8 档目前用不到。

## 引擎扩展（只在持有对应神器时生效）

详见 `docs/M8_RULES.md` 非伤害事件表下的 G2-4b 段落。新事件 stun-applied、shield-broken、death 都先判断有没有订阅者，没有就不消耗动作序号，所以其余对局的事件哈希不变。

## 未实现（8 件，新机制，归 Codex 最后一个 PR）

死亡之蔑（伤害延迟流血）、金币收集者 / 投机者之刃 / 大亨之铠（战斗中掉金币）、诡术师之镜（分身）、迷离风衣（复制体）、鱼骨头（随机目标）、幽魂弯刀（传送）。
