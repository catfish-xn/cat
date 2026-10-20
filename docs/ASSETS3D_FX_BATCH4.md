# 第四批英雄技能特效

本批离线生成至真实目录 `assets3d-local/fx-batch4/`。未执行 Git 操作，未修改 `src/`，未覆盖其他素材根。原始侧写、模型、贴图、网格和截图只保留在本地批次；仓库新增的 fixture 只含合成单位名、合成路径，以及绑定验证允许保留的系统/effectId、真实骨骼名单。

## 绑定与尺寸

十张独立绑定表及 `batch4.mjs` 已完成。全部标记 `approximated`，时序为人工估计的出手、飞行、命中次序；范围归入目标 `impact`。变体和子系统独立预览，不声称复原分支、连发、投射物轨迹或子系统生成。

以下绑定数是实际可生成数量，包含共享普攻命中；尺寸是普攻/技能各自最大的有面积粒子几何长边。统一 FX_SCALE=0.44，一格约 62.4；包含真实网格几何，不把透明留白等同于可见覆盖。

| 英雄 | 普攻/技能绑定数 | 普攻/技能最大格数 | 缺项与限制 |
| --- | --- | --- | --- |
| draven | 2 / 6 | 1.89 / 1.62 | 无独立普攻出手；范围只有落点标记，无独立伤害范围系统。 |
| maddie | 2 / 2 | 1.21 / 2.09 | 无独立普攻/技能出手和技能范围。 |
| powder | 2 / 2 | 1.20 / 6.82 | 无独立普攻出手、技能出手/飞行；猴子道具运动不重建。 |
| rell | 1 / 5 | 1.20 / 4.66 | 无普攻出手/弹道、技能飞行；Q_Stab、Q_Tar 无可写发射器，使用其可转换子系统。 |
| renata | 4 / 6 | 1.40 / 5.82 | E_Cas_Center、E_Shield 无可写发射器；其余阶段和范围存在。 |
| singed | 1 / 3 | 1.20 / 3.33 | 无普攻出手/弹道和独立技能范围；W_Self_Buff、W_Buff_Avatar2 无可写发射器。 |
| steb | 3 / 3 | 1.22 / 4.23 | 无独立技能出手/范围；强化普攻与治疗片段分别预览。 |
| trundle | 1 / 1 | 1.20 / 1.27 | 无普攻出手/弹道；技能只有命中，无独立出手/飞行/范围。 |
| urgot | 2 / 3 | 1.20 / 2.87 | 无独立普攻/技能出手。 |
| vander | 1 / 1 | 1.20 / 1.54 | 无普攻出手/弹道、技能飞行/范围；Q_Tar 无可写发射器，技能保留 Q_DR。 |

共 51 条有效绑定，7 个选择到的系统因无可写发射器进入 `unavailable`，其他阶段缺失也逐项注明原因。骨骼均从本地 GLB 的 skin joints 验证，模型是已有动画模型的原字节副本。

## 超三格追查

下表索引为生成文档中的零起始发射器索引，可直接对应截图标签。具体发射器原名、原始字段值和网格边界仅保留在本地 `size-report.json`、`audit-report.json` 及效果侧写，不复制进本文。

| 系统与发射器索引 | 几何长边（格） | 原始字段核查及处理 |
| --- | --- | --- |
| TFT13_Blue_Base_Q_Explosion：5 | 6.82 | 网格 POSITION 边界 × birthScale0 × scale0；原始网格与缩放共同形成大冲击波，保留。 |
| 同系统：8、9、7、6 | 4.81、3.60、3.53、3.16 | birthScale0、scale0、isUniformScale；原始辉光、闪光和地面片范围较大。非零透明度长边分别约 4.78、3.60、3.53、3.16 格；保留柔边效果。 |
| TFT13_Rell_Base_Q_Stab_Child：1 | 3.44 | birthScale0 长轴原本较长；无二次放大，保留。 |
| TFT13_Rell_Base_Q_Stab_Child_Ground：3 | 4.66 | 网格 POSITION 边界、birthScale0、scale0；使用三轴几何加权长边包络，保留。 |
| 同系统：1、2 | 3.53、3.53 | birthScale0 中的长轴；地面片与短闪光均保留。 |
| TFT13_RenataGlasc_Base_E_AoE：2、3 | 5.82、4.77 | birthScale0、scale0、isUniformScale；原始大闪光曲线。排除近零透明度后约 4.97、3.49 格，截图呈柔边辉光，保留。 |
| TFT13_Singed_Base_W_Ally_Activate：3 | 3.33 | birthScale0、scale0、isUniformScale；原始长边及增长曲线，保留。 |
| TFT13_Fish_Base_R_Heal：5 | 4.23 | birthScale0 的概率表、scale0 和 ray 长轴；按现有均值近似且宿主只缩放一次，非零透明度约 4.03 格，保留。 |

共 6 个系统、13 个发射器超过三格。未发现额外单位倍率、跨轴放大或宿主比例重复应用。几何长边不是逐纹素包围盒；网格、柔光透明留白和低亮度阶段会使可见范围小于该值。沿用非均匀缩放的长边包络近似，其他轴形状仍可能与原版不同。

## 朝向、混合与浏览器复看

固定面片/网格共 103 项通过现有 YXZ 到运行时 XYZ 的等价旋转检查；混合共 255 项通过既有映射检查。3 个 ground 标记但法线非水平的面片位于 TFT13_Shooter_Base_R_mis 与 TFT13_RenataGlasc_Base_E_Mis，逐图确认是小型弹道碎片，没有错误竖立的大范围地面片；不根据 ground 标记强制转平。

7 个“不透明底图 + 普通混合”组合分布在 Shooter R_mis、RenataGlasc BA_mis/E_Cas_R_Canister/E_Cas_L_Canister、Urgot BA_mis/Q_mis。截图显示为实际网格道具或弹体，没有黑底矩形；不把所有不透明网格强制改为加法混合。Trundle Q_bite_tar 的未知 blendMode 仍采用既有普通混合回退，截图未见黑块；这只是预览约定，不证明其原始 GPU 混合方程。

使用 `fx-browser-review.mjs` 和本机 Chrome，仅访问回环地址，为全部 43 个效果文档、258 个发射器生成隔离截图，涵盖所有超三格和朝向/混合可疑项。重点复看上述项目，未见不透明白块、实心矩形、黑底方块或异常超大饱和辉光。既有副遮罩缺失和旋转发射保护继续生效，本批无需新增换算修复或英雄特判。

复看工具通用改进：缓存写入所选批次根；保留依赖链接路径并关闭自动依赖扫描；复用同一页面及 WebGL 上下文；网格一格使用约定距离；逐发射器选取非零透明度几何峰值并按尺寸审计相同的步进积分。短闪光不再因统一截帧而被漏掉。各格是独立时刻，不表示同时发生或整套组合效果。

截图为本地 `browser-review-*.png`，加载与采样记录为 `browser-review-report.json`；43 项均无贴图加载错误。孤立预览不重建宿主运动，部分拖尾、低亮度或透明留白片段可能很淡，不据此声称完整像素还原。

## 验证与复用

`batch-status.json` 就绪；10 个模型、43 个效果文档、279 个资源引用、51 条绑定通过离线审计，输出根不是符号链接。TypeScript 检查通过；指定的 batch1/2/3/4、particle-approximations、visual-approximate、particles-v2、rendering3d-action-effects、rendering3d-particles、rendering3d-particles-v2 共 10 个测试文件、398 项测试通过。新测试验证 effectId 存在、骨骼存在、phase/anchor 合法、近似标记、缺项以及错误输入拒绝。

生成命令：`node scripts/assets3d/fx-batch.mjs --units draven,maddie,powder,rell,renata,singed,steb,trundle,urgot,vander --out assets3d-local/fx-batch4`；重生时显式加 `--force`。尺寸和审计使用 `fx-batch-sizes.mjs`、`fx-batch-audit.mjs` 的相同 `--out`；截图使用 `fx-browser-review.mjs --out assets3d-local/fx-batch4 --effect <逗号分隔effectId>`，通过 `CHROMIUM_PATH` 指向已安装浏览器，不下载。

本机 PowerShell 禁止 npm 的 ps1 包装，使用 Node 直接运行已安装工具；Vitest 通过 `node --experimental-strip-types node_modules/vitest/vitest.mjs run --configLoader native --project fast ...` 绕过配置打包时的父目录扫描。未改变执行策略或测试断言以适应环境。
