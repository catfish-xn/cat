# 第五批英雄技能特效

复看补充：`e_floor` 的指示片与裂纹片保持贴地；屏幕朝下的长条不能据此判为世界竖直。地面片高度跨度约为零，最长指示片约 10.15 格，最大斩击网格约 15.52 格；原始斩击网格自身的高度跨度约 1.44 格，保留原形。未按英雄压平或缩小，转换与源数据的长边比例保持 1:1。

努努爆炸的 11.89 格是漏斗网格采样几何长边，该采样不透明度约 2.93%；截图对应时刻该网格约 10.70 格、不透明度约 43.43%，绿色环形覆盖确实可见。中心软边闪光几何另约 5.44–6.13 格，亮度与透明留白使可见覆盖小于整张几何。原始范围较大，长边换算比例为 1:1，保留；这不等于逐像素复原原版可见范围。

同步重生前四批后，效果文档保留比例依次为 70/71、41/41、74/75、43/43；第五批为 47/47，全部效果载荷与重生前相同。前四批同时应用既有静止旋转 Ray 保护；新增地面静止 Ray 无方向保护，不能据地面标记臆造朝向。

九张独立绑定表及 `batch5.mjs` 已完成，生成根为真实目录 `assets3d-local/fx-batch5/`。未执行 Git 操作、未联网、未修改 `src/`，未覆盖其他素材根。模型、贴图、网格、原始字段、审计报告和截图仅写入该本地根；仓库 fixture 仅保留合成单位、合成路径，以及绑定校验允许的系统/effectId 和真实骨骼名单。

## 绑定与尺寸

全部绑定标为 `approximated`；出手、飞行、命中和范围的时序是人工估计，范围放在 `impact`。只预览系统片段，不重建原版轨迹、连锁、重复攻击、子系统生成或持续时间。不同变体独立展示；共享命中只是通用预览，不声称英雄有独立命中系统。

下表为实际可写绑定数，普攻包含共享命中。尺寸取各动作内有面积粒子的最大几何长边，包含真实网格及其缩放、系统仿射变换；统一 `FX_SCALE=0.44`，一格约 62.4。该数值不是逐纹素可见覆盖范围，也不是技能判定距离。按绑定预览窗口每步采样，初始时刻另存；透明留白与低亮度会缩小实际观感。

| 英雄 | 普攻/技能绑定 | 普攻/技能最大格数 | 缺项与限制 |
| --- | --- | --- | --- |
| vex | 2 / 6 | 1.20 / 4.58 | 无独立普攻出手；技能范围由 InitialAOE/爆炸片段表示，无额外独立范围系统。 |
| violet | 1 / 2 | 1.20 / 6.85 | 普攻只有共享命中；无独立技能出手、飞行、范围。 |
| vladimir | 1 / 2 | 1.20 / 0.54 | BA_mis、Q_tar 无可写发射器；无独立普攻/技能出手、范围；保留回流和自身治疗片段。 |
| zeri | 2 / 2 | 1.20 / 0.85 | 无独立普攻/技能出手、技能范围；技能采用强化普攻 Beam/Tar。 |
| leblanc | 2 / 10 | 1.77 / 3.24 | 无独立普攻出手；R_RQ_mis、E_chain_alt、E_chain_sharedamage_large/small、E_chain_break 无可写发射器；无独立伤害范围；链条拓扑不重建。 |
| loris | 1 / 2 | 1.20 / 3.13 | 普攻只有共享命中；Q_Shield_Activate_1、Q_Shield、Q_AOE 无可写发射器；无独立技能飞行。 |
| mordekaiser | 1 / 8 | 1.20 / 15.52 | BA_R2L_A、BA_L2R_A、Q_Mace、R_Aura 无可写发射器；无独立普攻弹道，技能保留手部移动片段，无独立投射物。 |
| nami | 2 / 4 | 1.20 / 2.04 | 无独立普攻出手、技能范围；不重建弹跳目标选择。 |
| nunu | 1 / 3 | 1.20 / 11.89 | 普攻只有共享命中；无独立技能飞行，蓄力/命中/爆炸分别预览。 |

共 52 条有效绑定、14 个选择到但无可写发射器的系统；这些系统和清单中不存在的阶段均在本地 `action-bindings.json.unavailable` 附原因。骨骼从模型 skin joints 验证。Vex 子片段、LeBlanc 拖尾及中心标记等虽有可写文档，静止孤立预览中可无面积或很淡，绑定数量不等于每项都有明显画面。

## 超三格原始字段核查

最终有 9 个绑定系统、46 个发射器超过三格。下表索引为修复后效果文档中的零起始索引，可直接对应截图标签。发射器原名、原始数值和网格边界只保留在本地 `size-report.json`、`audit-report.json` 和效果侧写；文档仅列派生格数和比例。

| 系统 | 发射器索引：格数 | 来源与处理 |
| --- | --- | --- |
| TFT13_Vex_Base_Q_InitialAOE | 2：4.58；0：4.42 | 网格 POSITION 边界 × birthScale0 × scale0；isUniformScale 使用主轴，系统 transform 缩小到约三分之一。原始环形网格范围大，截图平铺，保留。 |
| TFT13_Red_Base_Q_Vertical_Tar | 9：6.85；10：4.87 | 网格 POSITION、birthScale0、scale0 的长轴形成高挑旋风/光束。非均匀曲线沿用网格边界加权长边包络；这是原始竖向几何，不强制压平。 |
| TFT13_LeBlanc_Base_R_CenterOrb | 8：3.24 | birthScale0、scale0、isUniformScale；原始短闪光，截图为软边星芒，保留。 |
| TFT13_Beardy_Base_W_Shockwave_tar | 2：3.13；0：3.12 | birthScale0、scale0、系统 transform；原始地面波长轴，固定面片叠加系统旋转后平铺。 |
| TFT13_Mordekaiser_Base_R_Morde_Enter | 1、2：各 3.25 | 网格 POSITION × birthScale0 × scale0；原始环形网格，保留。 |
| TFT13_Mordekaiser_Base_E_floor | 3：15.52；0、1、2：各 10.15；8、9：各 8.46；4、5：各 6.77 | 3 为网格 POSITION × birthScale0，另乘系统 transform 约 2.4 倍纵向拉伸；其余为 birthScale0 × 同一 transform。原始就长，未发现单位倍率错误或重复缩放；宽视野截图确认是沿地面延伸的斩击与裂纹。 |
| TFT13_Mordekaiser_Base_P_AoE | 0：7.40；14：7.09；1：5.03；12：4.36；13：4.23；10：3.65；4、5：各 3.53；7：3.18 | 14 为网格 POSITION × birthScale0 × scale0；其余为 birthScale0、scale0/isUniformScale。原始大环、地面片及闪光；柔边和透明留白明显，保留。 |
| TFT13_NunuWillump_Base_R_Cas | 2：9.62；1：9.24；0：7.05；6：6.35；3、4：各 3.81；7：3.38 | 1、2 为真实网格 POSITION × birthScale0 × scale0，其余为 birthScale0、scale0/isUniformScale。原始蓄力范围大，网格环平铺，保留。 |
| TFT13_NunuWillump_Base_R_full_explo | 10：11.89；17：10.58；12：8.46；8：7.76；7：6.35；6：6.13；1：5.64；2：5.44；9：5.29；14：4.94；3：4.57；18：3.53；11：3.08 | 10 为真实网格 POSITION × birthScale0 × scale0；其他为 birthScale0、scale0/isUniformScale。原始爆炸范围大，截图为软边环、烟雾和碎片，无整块饱和白色辉光。 |

没有新增尺寸换算修复，也没有按英雄压缩尺寸。非均匀形状动画仍是现有标量长边包络近似，不能据此宣称完整形状还原。

## 朝向修复与混合复看

复看发现静止 Ray 的通用问题：有 birthRotation0 俯仰/偏航，却无非零 birthVelocity 时，旧转换会丢弃旋转并使用朝上的 local-Y。Mordekaiser P_AoE 因此出现约六至八格的竖片。现有 V2 Ray 会围绕方向朝向摄像机，不能表达该固定源平面；现在通用跳过此类片段，原因是 `unexpressible-emitter:rotated-stationary-ray-plane`。不按英雄名、发射器名或尺寸分支；保留运动 Ray 的速度方向约定，以及无俯仰/偏航的静止 Ray。纯整周旋转不触发跳过，strict 模式不变。

本批共有 21 条源发射器记录触发新保护，其中 14 条先前能写出，另外 7 条此前也因其他不支持字段无法写出。52 条绑定及系统缺项数不变；Vladimir 技能最大值从约 2.47 格降为 0.54 格，Loris 从约 4.96 格降为 3.13 格，Nami 从约 3.21 格降为 2.04 格。Mordekaiser P_AoE 中错误竖片消失，保留平铺大环；前后对照在本地 `before-ray-fix.png` 和对应最终截图。此处理有意损失不可表达片段，未声称已复原它们。

90 个保留的固定面片/网格通过既有 YXZ 到 XYZ 的朝向等价核查；ground 标记的保留固定片没有非水平法线。242 个发射器通过既有 blendMode 映射核查。LeBlanc Idle_Staff_Flame 的一个网格和 R_mis_V2 的一个网格是“不透明贴图 + 普通混合”候选，截图确认是细小实际网格，不是黑底方块；保留既有映射。未知/缺失模式仍按已有透明度约定回退，不声称已验证原始 GPU 方程。既有副遮罩缺失保护继续生效，没有为增加绑定数量而放开白块来源。

浏览器使用本机 Chrome，经 `CHROMIUM_PATH` 指定，仅访问回环地址。最终复看 17 个效果文档、129 个发射器，覆盖全部超三格、混合候选和新朝向保护影响到的效果文档，贴图加载错误为零；记录合并在本地 `browser-review-report.json`。截图为独立发射器的非零透明度几何峰值采样，不代表同时发生；零面积或无宿主运动的拖尾可能不可见。未见不透明白块、整张实心矩形、黑底方块或错误竖立地面片；原始旋风、纵向光束与沿地面延伸的长斩击保留。大辉光呈软边透明渐变，仍保留原始范围。

`fx-browser-review.mjs` 新增通用 `--view-cells`，只调整摄像机与格网视野，格子仍约 62.4；默认视野不变。最长斩击补拍更宽视野，避免边缘裁切影响判断。所有截图及复看记录保留在批次根。

## 验证与复用

最终批次包含 9 个模型、47 个效果文档、274 条资源引用、52 条绑定；输出根为真实目录。离线审计验证模型原字节副本、effectId、骨骼、阶段、资源存在性、混合和朝向。fixture 没有原始发射器、贴图路径或数值；新保护测试使用 synthetic 名称、路径和整齐合成数值。

`tsc --noEmit` 通过。指定 batch1/2/3/4/5、particle-approximations、visual-approximate、particles-v2、rendering3d-action-effects、rendering3d-particles、rendering3d-particles-v2 共 11 个文件、404 项测试通过。新测试验证绑定有效性、真实骨骼与合法阶段、缺项处理、fixture 合成约束，以及静止旋转 Ray 的保护、运动 Ray/整周旋转保留、strict 行为和输入不可变性。

生成命令：`node scripts/assets3d/fx-batch.mjs --units vex,violet,vladimir,zeri,leblanc,loris,mordekaiser,nami,nunu --out assets3d-local/fx-batch5`；重生成显式加 `--force`。尺寸与审计分别用 `fx-batch-sizes.mjs`、`fx-batch-audit.mjs` 的同一 `--out`。复看使用 `fx-browser-review.mjs --out assets3d-local/fx-batch5 --effect <逗号分隔effectId>`；扩大视野附加 `--view-cells 24`。

本机使用已安装的 Node 工具运行检查：`node node_modules/typescript/bin/tsc --noEmit`；Vitest 使用 `node --experimental-strip-types node_modules/vitest/vitest.mjs run --configLoader native --project fast <上述测试文件>`，无下载或联网安装。
