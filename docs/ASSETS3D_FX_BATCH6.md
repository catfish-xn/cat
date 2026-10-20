# 第六批英雄技能特效

九张独立绑定表及 `fx-bindings/batch6.mjs` 已完成。离线生成根为真实目录 `assets3d-local/fx-batch6/`：9 个模型、66 个效果文档、71 条有效绑定、367 条资源引用。未联网、未执行 Git 操作、未修改 `src/`、未覆盖其他素材根。素材、原始字段、审计报告和截图只在本地批次根；测试 fixture 的单位与资源路径均为 synthetic，仅保留绑定校验需要的系统/effectId 和真实骨骼名单。

## 绑定与主要特效格数

所有阶段、挂点与延迟均标记 `approximated`；时序是人工估计，范围归入 `impact`。变体与子系统独立预览，不重建技能分支、宿主轨迹、连击、持续时间或子系统生成。没有独立普攻命中的英雄使用共享命中预览，不宣称它是英雄专属系统。

尺寸统一 `FX_SCALE=0.44`，一格约 62.4；按绑定窗口逐步采样有面积粒子的最大几何长边，包含实际网格 POSITION 边界、网格缩放与系统仿射变换。透明留白仍计入，因此不等于实际可见覆盖或技能判定距离。下表普攻/技能格数均为该动作的最大值。

| 英雄 | 普攻/技能绑定数 | 普攻/技能格数 | 缺项与限制 |
| --- | --- | --- | --- |
| renni | 1 / 5 | 1.20 / 3.53 | 普攻只有共享命中，无独立出手/弹道；技能无独立投射物；4 个选中系统不可写。 |
| rumble | 1 / 5 | 1.20 / 2.05 | 普攻只有共享命中；技能范围并入命中，4 个选中系统不可写；火箭子片段独立展示。 |
| scar | 1 / 6 | 1.20 / 2.59 | 普攻只有共享命中；无独立技能出手/范围；2 个晶体子系统不可写。 |
| sevika | 1 / 20 | 1.20 / 6.70 | 普攻只有共享命中；5 个选中系统不可写；机械臂、火焰和大奖分支分别预览。 |
| silco | 2 / 3 | 1.20 / 3.32 | 无独立普攻出手、技能发射出手及单独范围；不重建召唤物生命周期。 |
| smeech | 1 / 4 | 1.20 / 2.78 | 普攻只有共享命中；无独立技能范围；跳跃和四种挥砍系统不可写，宿主跳跃/连击未重建。 |
| swain | 2 / 7 | 1.41 / 3.38 | 无独立普攻出手；技能范围指示和伤害弹体不可写；变身、被动、治疗分别预览。 |
| twitch | 2 / 5 | 1.20 / 2.51 | 无独立普通攻击出手或独立技能范围；使用强化弹体和命中片段。 |
| zoe | 2 / 3 | 1.20 / 1.41 | 无独立普攻出手/技能范围；第二次出手、同目标弹体、星子系统不可写，不重建重新选目标。 |

有效普攻 13 条、技能 58 条。骨骼从对应模型 skin joints 验证；没有为了绑定而添加骨骼。少数可写拖尾或子片段在静止预览中没有面积或十分微弱，绑定数不等于每条都有明显画面。

## 不可用系统与原因

下列 25 个系统均进入生成的 `action-bindings.json.unavailable`，总原因是 `no-writable-emitters`；具体发射器原因在各系统本地侧写，归纳如下。其他阶段的缺失与原因也由各英雄表的 `unavailable` 写入输出。

| 英雄 | 系统后缀 | 原因 |
| --- | --- | --- |
| renni | Q_FinalSlam_Cas | 源系统无发射器。 |
| renni | Q_WeaponSmoke | 不支持 stencilMode。 |
| renni | Q_FinalSlam_Impact / Q_FinalSlam_Tar | 不支持 overrideScaleCap；前者还包含无法表达的静止旋转 Ray。 |
| rumble | R_cas_light | 不支持颜色查找字段。 |
| rumble | R_cas_rocket / R_mis_01 | 依赖子系统生成，分别绑定可写子片段。 |
| rumble | R_shield_01 | 源系统无发射器。 |
| scar | W_tar_crystal_travel_child_01_sm | 依赖子系统生成。 |
| scar | W_tar_crystal_travel_child_01_burst | 不透明底图依赖副遮罩，沿用白块保护而省略。 |
| sevika | ExtendoArm_Spring / Q_Spell3_Grapple_PullRope | 缺少 beam 两端宿主。 |
| sevika | ExtendoArm_Woosh | SCB 顶点颜色不受支持。 |
| sevika | Q_Flamethrower_NonUpgraded_012 | 特殊或动态寿命不可表达。 |
| sevika | Q_Jackpot_Coin_Mis_Glow | 不支持 falloffTexture。 |
| smeech | Z_Jump | 依赖子系统生成。 |
| smeech | Z_Swipe_Diagonal / Z_Swipe_Horizontal / Z_Swipe_Dual / Z_Swipe_vertical | SCB 顶点颜色不受支持。 |
| swain | R_AOE_Indicator | 副遮罩保护、uvMode 或网格 pivot 不可表达。 |
| swain | P_dmg_mis | 副遮罩保护或依赖子系统生成。 |
| zoe | Q_Q2_cas | 网格资源不可用或依赖子系统生成。 |
| zoe | Q_mis_SameTarget | 源系统无发射器。 |
| zoe | Q_Child_Star | 不支持 hasPostRotateOrientation。 |

## 超三格源数据追查

本批共 5 个绑定系统、18 个发射器超过三格。索引为转换后效果文档的零起始索引，源发射器名称和数值仅留本地报告。逐项核对 birthScale0、scale0、isUniformScale，以及网格 POSITION 边界；未发现单位换算错误或重复宿主缩放，没有新增换算代码或英雄特例。

| 系统 | 发射器索引与格数 | 字段、原因和处理 |
| --- | --- | --- |
| TFT13_Chainsaw_Base_R_Hero_Dash | 2：3.53 | 网格 POSITION × birthScale0 × scale0；原始风洞长轴较长，保留透明曲面。 |
| TFT13_Lieutenant_Base_Q_Thrash_GroundAoE | 2：3.15 | 网格 POSITION × birthScale0，isUniformScale 沿主轴；原始地面环稍大于三格，保留。 |
| TFT13_Lieutenant_Base_Q_ExtendoPunch_SlamAoE | 0：6.70；4：6.58；1：6.29；12：5.94；11：5.63；23：5.43；14、15：各 4.94；19：4.25；20：4.22；21：4.20；2：4.16；18：3.91；3：3.51 | 0、2、3、23 是 birthScale0/scale0/isUniformScale 的固定面片；其余为真实网格边界乘出生及寿命缩放。源地面闪光、大环和波面本来较大，保留。20、21 是源形状与复合旋转形成的倾斜曲面，不强行压平。 |
| TFT13_Silco_Base_R_Tar | 7：3.32 | 网格 POSITION × birthScale0 × scale0，isUniformScale 主轴；原始薄环较大，截图贴地，保留。 |
| TFT13_Swain_Base_R_Explode | 0：3.38 | birthScale0 × scale0、isUniformScale；原始中心光球增长，透明度和纹理使可见范围更小，保留。 |

非均匀网格动画沿用已有几何边界加权标量包络，仍是近似形状；不能据此声称逐轴形变已还原。几何峰值与发射器截图时刻可能不同，截图不是所有粒子同时达峰。

## 朝向、混合和浏览器复看

116 个固定面片/网格通过既有 YXZ 到 XYZ 四元数等价检查；331 个英雄发射器通过既有 blendMode 映射检查。保留既有静止 Ray、副遮罩、缺贴图与不可表达网格的通用保护。本批没有发现需要新增通用修复的问题。

已用 `fx-browser-review.mjs` 和本机 Chrome（CHROMIUM_PATH）对本批全部 66 个效果文档、334 个发射器（含共享命中）生成截图，仅访问回环地址，贴图加载错误为零。截图和完整记录分别在批次根 `browser-review-*.png`、`browser-review-report.json`。重点目视检查了全部超三格系统以及下列混合/朝向候选：

- Rumble Upgrade 的不透明贴图普通混合网格是细小零件，Scar Q_mis_01 的同类网格是晶体，不是黑底方块。
- Swain R_Full/R_Explode 的未知模式沿用有效 alpha 的普通混合回退；截图是暗色柔边曲面与光点，没有实心矩形。未知模式仍不等于已还原源 GPU 方程。
- Twitch BA_mis/R_mis 的网格和固定片虽带 ground 标记，源几何是细长弹体及小标记；截图没有大竖片。不能凭标记把所有弹体压平。
- Sevika 大面积闪光和网格环贴地；倾斜波面保留源朝向。Renni 风洞、Silco 薄环和 Swain 光球没有不透明白块、黑底方块或饱和的整块大辉光。

## 验证与复用

`tsc --noEmit` 通过。指定的 batch1/2/3/4/5/6、assets3d-particle-approximations、assets3d-visual-approximate、assets3d-particles-v2、rendering3d-action-effects、rendering3d-particles、rendering3d-particles-v2 共 12 个文件、411 项测试通过。新增测试覆盖 effectId、实际骨骼名单、合法阶段与挂点、缺项、非法输入拒绝和 synthetic fixture 约束。离线审计还核对了模型字节副本、资源存在性及真实输出目录。

生成：`node scripts/assets3d/fx-batch.mjs --units renni,rumble,scar,sevika,silco,smeech,swain,twitch,zoe --out assets3d-local/fx-batch6`；重生成显式加 `--force`。尺寸和审计分别运行 `fx-batch-sizes.mjs`、`fx-batch-audit.mjs`，传相同 `--out`。复看使用 `fx-browser-review.mjs --out assets3d-local/fx-batch6 --effect all`，先设置 CHROMIUM_PATH。

检查直接使用本机已安装工具：`node node_modules/typescript/bin/tsc --noEmit`；Vitest 使用 `node --experimental-strip-types node_modules/vitest/vitest.mjs run --configLoader native --project fast <测试文件>`，无在线安装。

## 60 个英雄覆盖汇总

前六批共 58 名，加早期 Jinx、Vi 两名试点，正好 60 名且无重复。以下按现有本地 manifest/action-bindings 统计成功绑定，包含共享普攻命中；Jinx 默认 R、Vi 默认 Q，额外 Jinx W/E 不重复算入默认技能总数。

| 批次 | 英雄数 | 普攻绑定 | 技能绑定 |
| --- | --- | --- | --- |
| 早期试点 Jinx / Vi | 2 | 3 | 10（含 W/E 变体共 16） |
| 第一批 | 10 | 16 | 33 |
| 第二批 | 10 | 13 | 33 |
| 第三批 | 10 | 18 | 65 |
| 第四批 | 10 | 19 | 32 |
| 第五批 | 9 | 13 | 39 |
| 第六批 | 9 | 13 | 58 |
| 总计 | 60 | 95 | 270（含额外变体共 276） |

没有完全缺少技能绑定的英雄。可写绑定仍可能是很淡的片段；缺阶段、宿主运动和特定变体不能由总数推断为已完成还原。

以下是全部已绑定系统（含试点额外技能变体）中超过三格的清单，每行列该系统最大几何长边。第一至五批采用当前本地 size-report，而非旧文档的历史数字；此前通用保护使部分旧超大项已消失。试点没有同口径报告，本次只读重测既有输出并把结果写入本批 `trial-size-report.json`；未重生或修改试点素材。试点仍保留早期 Ray、固定片朝向、混合和副遮罩近似，下面明确标为旧输出，不能当作后续转换器已修复的成品。汇总证据为本批 `coverage-summary.json`。

| 批次 | effectId | 最大格数 | 原因一句 |
| --- | --- | --- | --- |
| 试点旧输出 | jinx_tft13_jinx_base_r_muzzleflash | 18.80 | 原始长条闪光叠加寿命缩放，旧输出仍有非均匀缩放近似。 |
| 试点旧输出 | jinx_tft13_jinx_base_r_tar | 14.80 | 冲击波网格长边及出生/寿命缩放较大，保留早期朝向近似。 |
| 试点旧输出 | vi_tft13_vi_base_q_landing_aoe | 22.85 | 旧 Ray 长边包络很大，不能据此判断实际可见范围。 |
| 试点旧输出 | vi_tft13_vi_base_q_landing_aoe_child | 4.54 | 高速 Ray 的出生长轴和动画包络形成长条。 |
| 试点旧输出 | jinx_tft13_jinx_base_w_beam | 10.37 | 长指示片叠加系统拉伸，仍是早期固定片/副遮罩近似。 |
| 1 | blitzcrank_tft13_blitzcrank_base_q_cas | 8.46 | 原始低透明度出手辉光较大。 |
| 1 | lux_tft13_lux_base_w_mis | 4.94 | 原始长形局部辉光较大。 |
| 1 | caitlyn_tft13_caitlyn_base_r_bombardment_impact | 8.74 | 原始轰炸地面背光较大。 |
| 1 | darius_tft13_darius_base_q_ring_windup | 3.17 | 原始蓄力环面片及缩放较大。 |
| 1 | darius_tft13_darius_base_q_ring | 3.42 | 原始旋转范围环及缩放较大。 |
| 2 | camille_tft13_camille_base_q_2_cas | 3.52 | 挥砍与地面电路网格原始长边较长。 |
| 2 | camille_tft13_camille_base_q_2_cas_child | 3.11 | 子片段网格与出生缩放略超三格。 |
| 2 | irelia_tft13_irelia_base_w_swipe | 3.11 | 原始地面烟尾网格长轴较长。 |
| 2 | leona_tft13_leona_base_w_cas_hit | 5.90 | 原始旋涡网格和寿命成长较大。 |
| 2 | nocturne_tft13_nocturne_base_p_cleave | 4.90 | 原始地面抓痕、挥砍网格长边较长。 |
| 2 | sett_tft13_sett_base_e_tar_child_dust | 3.11 | 原始尘雾网格边界及缩放较大。 |
| 2 | sett_tft13_sett_base_e_cas_child | 3.53 | 长面片与烟雾包络较大，已含通用非均匀缩放修正。 |
| 2 | tristana_tft13_tristana_base_r_tar | 3.42 | 命中网格在寿命内增长。 |
| 3 | ambessa_tft13_ambessa_base_p_specialattack_swipe | 3.20 | 原始强化挥砍网格长边较长。 |
| 3 | ambessa_tft13_ambessa_base_p_specialattack_swipe_r | 3.20 | 另一侧原始强化挥砍网格长边较长。 |
| 3 | ambessa_tft13_ambessa_base_r_energy_windup | 3.49 | 原始蓄力能量片及缩放较大。 |
| 3 | ambessa_tft13_ambessa_base_r_cas_dust | 4.01 | 原始出手尘雾片及缩放较大。 |
| 3 | ambessa_tft13_ambessa_base_r_hurl_swipe | 4.68 | 原始挥砍网格较长。 |
| 3 | ambessa_tft13_ambessa_base_r_hurl_impact | 4.66 | 原始命中射线长轴较长。 |
| 3 | ambessa_tft13_ambessa_base_q_chainswipe | 6.39 | 原始链式挥砍网格形状与缩放较大。 |
| 3 | cassiopeia_tft13_cassiopeia_base_q_proc | 5.26 | 原始触发网格形状与缩放较大。 |
| 3 | ezreal_tft13_ezreal_base_q_mis | 3.21 | 原始弹体面片长轴较长。 |
| 3 | ezreal_tft13_ezreal_base_w_aoe | 4.00 | 原始范围片与缩放较大。 |
| 3 | gangplank_tft13_gangplank_base_w_groundfire_mis | 4.44 | 原始地面火焰片的长边较长。 |
| 3 | garen_tft13_garen_base_r_aoe_impact | 15.99 | 原始冲击波网格成长很大，几何峰值时已经透明。 |
| 3 | illaoi_tft13_illaoi_base_r_cas_dust | 3.94 | 原始出手尘雾片及缩放较大。 |
| 3 | illaoi_tft13_illaoi_base_r_impact | 7.21 | 原始命中片缩放较大且包含透明留白。 |
| 3 | jayce_tft13_jayce_base_r_cast_dust | 4.45 | 原始施法尘雾片及缩放较大。 |
| 3 | jayce_tft13_jayce_base_r_ranged_recall_buildup | 4.23 | 原始蓄力片与寿命缩放较大。 |
| 3 | jayce_tft13_jayce_base_r_ranged_recall_blast_cast | 3.52 | 原始爆破出手片长边较长。 |
| 3 | jayce_tft13_jayce_base_r_ranged_crystaldestroymissile | 3.53 | 原始碎晶弹体长轴较长。 |
| 3 | jayce_tft13_jayce_base_r_ranged_jump | 3.13 | 原始跳跃片段长边稍超三格。 |
| 3 | jayce_tft13_jayce_base_r_ranged_explosion | 4.99 | 原始爆炸网格长边较长。 |
| 3 | jayce_tft13_jayce_base_r_melee_portal_child | 3.05 | 原始传送子片段几何稍超三格。 |
| 3 | jayce_tft13_jayce_base_r_melee_lightningcall | 10.08 | 有面积的原始雷电射线长轴较长，零宽射线不计覆盖。 |
| 3 | jayce_tft13_jayce_base_e_thunderingblow_hit | 3.47 | 原始命中片与缩放较大。 |
| 4 | powder_tft13_blue_base_q_explosion | 6.82 | 原始冲击波网格与寿命缩放共同放大。 |
| 4 | rell_tft13_rell_base_q_stab_child | 3.44 | 原始出生长轴较长。 |
| 4 | rell_tft13_rell_base_q_stab_child_ground | 4.66 | 地面网格边界与逐轴缩放包络较大。 |
| 4 | renata_tft13_renataglasc_base_e_aoe | 5.82 | 原始闪光增长曲线较大，贴图柔边使可见范围更小。 |
| 4 | singed_tft13_singed_base_w_ally_activate | 3.33 | 原始长边及成长曲线稍大。 |
| 5 | vex_tft13_vex_base_q_initialaoe | 4.58 | 原始环形网格与缩放较大。 |
| 5 | violet_tft13_red_base_q_vertical_tar | 6.85 | 原始旋风/光束网格纵向较高。 |
| 5 | leblanc_tft13_leblanc_base_r_centerorb | 3.24 | 原始短闪光较大，实际呈柔边星芒。 |
| 5 | loris_tft13_beardy_base_w_shockwave_tar | 3.13 | 原始地面波长轴及系统变换稍大。 |
| 5 | mordekaiser_tft13_mordekaiser_base_r_morde_enter | 3.25 | 原始环形网格与成长稍大。 |
| 5 | mordekaiser_tft13_mordekaiser_base_e_floor | 15.52 | 原始斩击网格叠加系统长轴拉伸，沿地面延伸。 |
| 5 | mordekaiser_tft13_mordekaiser_base_p_aoe | 7.40 | 原始大环、地面片和闪光较大。 |
| 5 | nunu_tft13_nunuwillump_base_r_cas | 9.62 | 原始蓄力网格环与地面片范围较大。 |
| 5 | nunu_tft13_nunuwillump_base_r_full_explo | 11.89 | 原始漏斗网格和爆炸片较大，透明度使可见覆盖缩小。 |
| 6 | renni_tft13_chainsaw_base_r_hero_dash | 3.53 | 原始风洞网格长轴较长。 |
| 6 | sevika_tft13_lieutenant_base_q_thrash_groundaoe | 3.15 | 原始地面环网格稍大。 |
| 6 | sevika_tft13_lieutenant_base_q_extendopunch_slamaoe | 6.70 | 原始地面闪光、波面和多层网格环范围较大。 |
| 6 | silco_tft13_silco_base_r_tar | 3.32 | 原始薄环网格及成长较大。 |
| 6 | swain_tft13_swain_base_r_explode | 3.38 | 原始中心光球寿命成长稍大。 |

### 已知缺项与后续项

- 第五批加入的"无方向静止地面射线"保护（跳过并计数）连带去掉了前批两个次要子效果：蒙多（drmundo）技能里的气泡子效果、克格莫（kogmaw）W 的增益效果，现均记为 unavailable。
- 后续项：**固定平面射线**——源数据里静止、有固定平面但无可恢复地面方向的射线，目前一律跳过；待确定朝向约定后可恢复上述两项及同类子效果。
- 试点（金克丝、蔚）仍是早期近似输出，未用后续转换器重生；重生是另一后续项。
