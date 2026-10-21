# 3D 施法动画改动清单（2026-10-21）

依据：用户整理的《S13 技能动画对照册 V2》（逐棋子的技能表现描述、星级和英雄强化分轴，原视频不进仓库），对照 `scripts/assets3d/ANIMATION-SOURCE-APPENDIX.md` 里每个单位源图中的施法片段、`unit-map.json` 规则和 `docs/ASSETS3D_CAST_PICKS.md` 的近似选择。

对照册本身**没有逐帧核验**，也不给片段名；下表的“该用哪段”是按对照册描述的动作阶段，匹配源图里现有的片段名。改完要在本机真实素材上目视确认，不靠云端判断。片段名以下都省略 `.TFT_Set13.anm` 后缀，不区分大小写。

## 一、结论

- 60 个已有模型里，约 **19 个明显不对**：选错了片段（如阿木木拿普攻冒充技能），或者只播了起手、真正打出去的那一段没播，或者有两种形态/轮换/随机招式，却总播同一段。
- 另有约 **13 个基本对**，但只播了一段，少了起手或收尾，看起来会断。
- **全部 60 个**的施法时长都固定为 0.7 秒，和片段实际长度无关：长片段被截断，短片段停在最后一帧。
- 星级和英雄强化：源图里只有两段专用片段——莫德凯撒的 `Spell3Star`、艾瑞莉娅的 `SpellHero`。其余棋子三星和英雄强化的变化，按对照册看主要在特效和范围上，不是身体动作。
- 3 个 6 费（维克托、沃里克、梅尔）没有模型，如果要上场，得先提取模型。

## 二、逐棋子（只列要改的）

符号说明：**错** = 现在选的片段不对；**缺主段** = 打出段没播；**序列** = 要按 起手→(持续)→打出/收尾 播；**分支** = 按形态、轮换或随机招式选片段；**变体** = 星级或英雄强化专用。

| 单位 | 现在 | 对照册描述 | 改成 | 类别 |
| --- | --- | --- | --- | --- |
| amumu | 普攻2（近似） | 被动周期脉冲，不是通常施法 | 不播施法动作（`cast` 设为无），只放特效 | 错 |
| tristana | Spell_Start | 炮弹 | Spell_Start → Spell_Attack | 错 / 序列 |
| irelia | Spell | 防御姿态 → 结束斩击 | Spell（持续）→ SpellAction_Attack → SpellAction_toIdle；英雄强化「刀锋之舞」用 SpellHero | 缺主段 / 变体 |
| leona | Spell_In | 防御持续 → 周围爆发 | Spell_In → Spell_Idle（持续）→ Spell_Damage | 缺主段 |
| loris | spellup | 持盾 → 扇形爆发 | spellup → SpellOut | 缺主段 |
| illaoi | Spell_Intro | 引导吸取 → 范围砸击 | Spell_Intro → Spell_Loop（持续）→ Spell_Finish_In → Spell_Finish_Out | 缺主段 |
| corki | Spell_Start | 侧移与连续导弹 | Spell_Start → Spell_Loop（持续）→ Spell_End | 缺主段 |
| ekko | Spell_Start | 残影与多点打击 | Spell_Start → Spell_Attack / _2 / _3 轮流 → Spell_Teleport_Out | 缺主段 |
| caitlyn | Spell_First | 空袭落点与狙击衔接 | Spell_First → Spell_Shoot（目标在侧面时用 Shoot_90 / Shoot_-90）→ Shoot_toIdle | 缺主段 |
| renni | Spell1_Stun_Activate | 举起目标 → 砸落 | Spell1_Stun_Activate → Spell1_Stun_Loop → Spell1_Throw | 缺主段 |
| smeech | Spell | 跃进、连击、再次追击 | SpellAntic → SpellAtkLeft / SpellAtkRight 交替（Spell 作回退） | 缺主段 |
| sett | Spell3 | 两侧抓取 → 合拢撞击 | Spell3_Both_Start → Spell3_Both_End（只抓到一侧时用 Front / Back） | 缺主段 |
| jinx | DeathRocket | 三段素材轮换 | 每次施法按 DeathRocket → FlameChompers → Zap 轮换（DeathRocket2 待目视确认） | 分支 |
| sevika | Spell1_Activate | 机械臂随机招式，不是固定轮换 | 按本次招式选 Spell1 / Spell2_* / Spell3 / Spell4；需要战斗事件带上招式 | 分支 |
| gangplank | Spell_Melee（近似） | 近战斩击 / 远程桶爆 | 前排用 Spell_Melee（+Melee_Ignite），后排用 Spell_Ranged_Summon → Spell_Ranged_Blast | 分支 |
| jayce | Spell2_KnockHexCrystals（近似） | 近战传送门 / 远程晶体 | 前排用 Spell1_Right（+GainShield），后排用 Spell2_Ranged_Jump → Spell2_KnockHexCrystals | 分支 |
| swain | Spell_2 | 近战变身 / 远程施法 | Spell_2 → Spell2_Out；形态片段待目视确认 | 分支 / 序列 |
| elise | Spell | 近战蛛网 / 远程施法 | 源图只有一段 Spell，先保持；形态差异放进特效 | 分支（无源） |
| ambessa | SpellFist_Dash（近似） | 两种姿态与位移节奏 | 按姿态在 SpellChain_Strike 和 SpellFist_Dash → SpellFist_Throw 之间选 | 分支 |
| mordekaiser | Spell | 巨锤轨迹与强化阶段 | 1–2 星用 Spell，3 星用 Spell3Star | 变体 |
| drmundo | Spell4_Idle（近似） | 强化自愈 → 周围爆发 | 源图没有起手和爆发段：保留 Spell4_Idle 做持续段，结束时接 Spell4_Out_Idle | 近似 |
| vi | Spell4_hit | 目标重击与横排波纹 | 源图只有这一段，保持 | 近似 |

只缺起手或收尾（**序列**，主体片段不改）：darius（Spell1_IN → Spell1）、twistedfate（Spell_In → Spell1）、draven（Spin_Left_Right → Arm_Catches）、morgana / rell / singed（→ Spell_Out）、camille（→ Spell1_Out）、zeri（→ Spell1_Out）、ezreal（→ Spell2_Out）、renata（→ Spell_toIdle）、nunu（→ Spell_ToIdle）、akali（Spell3_In / Spell3_Out 待目视确认是否属于本技能）、vander（英雄强化「卯足全力」用 Spell_Strike_Start_2 → Spell_Strike_End_2，普通技能保持 Spell_Brace）。

英雄强化只改特效、不换身体动作的（渲染侧以后处理）：powder「敌我不分」、steb「战地医生」、trundle「震惊巨魔」（普通技能的治疗反馈不再播；源图另有 SpellHeal，可作普通技能的治疗段）、vladimir「血色契约」、renni「残暴复仇」。singed「炼金术师」：不普攻、一直跑动，战斗中应循环播移动动作。

不用改：lux、maddie、powder、steb、vex、violet、zyra、ziggs、nocturne、urgot、vladimir、blitzcrank、cassiopeia、kogmaw、nami、scar、garen、heimerdinger、silco、twitch、zoe、leblanc、malzahar、rumble（Spell2 用途待确认）。

## 三、给 Codex 的改动

### 1. 素材管线（scripts/assets3d，在本机素材上做）
- GLB 现在只导出了选中的 6 个动作。上表“改成”一列里所有片段，都要从源图**重新导出进同一个 GLB**（`appendCastClip` 已经能追加同骨架的片段）。
- manifest 加可选字段（向后兼容，旧素材根不受影响）：
  - `castSequence: { in?: clip, main: clip | clip[], hold?: clip, out?: clip }`：`main` 是数组时按施法次数轮流。
  - `castVariants: { star3?: …, hero?: …, front?: …, back?: … }`：结构和 `castSequence` 相同；`rotate: clip[]` 用于金克丝这种轮换；`branch: Record<招式键, …>` 用于赛薇卡。
  - `cast: null`：明确表示“没有施法动作”（阿木木），和“没找到”区分开。
- `unit-map.json` 按上表写单位级显式覆盖，并写 `animationNotes` 依据；`cast-picks.mjs` 的 5 个近似里，阿木木改成 `cast: null`，其余 4 个改成序列或分支。
- 不写原版数值和原图，只写片段名。

### 2. 播放时长（src/rendering3d/animation-state.ts + animation-mixer.ts）
- `cast` 的时长改成**片段实际时长**（序列就是各段时长相加，持续段算 1 次），限制在 0.3–2.5 秒；不再固定 0.7 秒。持续段（hold）按片段时长循环 1 次；等战斗事件能给出引导时长后，再改成按引导时长循环。
- `attack` 同理按片段时长，最长不超过两次普攻的间隔（间隔由渲染层传入；没有时用片段时长）。
- 序列在 mixer 里依次播：每段 LoopOnce，上一段结束时交叉淡入 0.08 秒；被死亡打断时立刻停。
- `cast: null` 或找不到片段：**保持当前动作，不重启待机**（现在会退回 idle 并重播，看起来抖一下）。
- 测试用合成片段（长度按比例，比如 0.5 倍、2 倍于默认值），不用真实素材。

### 3. 需要战斗数据的（src/simulation 和协议，要协调者另派）
- 赛薇卡的随机招式：`cast` 显示事件里需要带上本次招式键（`castOutcome.abilityKey`/`subOutcomes` 现在只是部分信息）。
- 引导时长（伊莉丝、俄洛伊、库奇、努努、蒙多）：要一个“引导开始/结束”的显示事件；现在 `activityChanged` 不下发。
- 英雄强化：BoardPiece 现在没有“已装英雄强化”标记，`castVariants.hero` 需要它。

### 4. 渲染侧（Claude，src/rendering/three-mode）
- 施法时朝向目标：已在 #356。
- 形态（前排/后排）、施法次数轮换、星级 3 的变体选择：等第 1、2 步的 manifest 字段合入后，由渲染层按 BoardPiece 的位置、`starLevel` 和施法计数来选。
