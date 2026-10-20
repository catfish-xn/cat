# 3D 英雄技能特效第二批

已完成 10 人的独立离线近似预览包：10 个模型、42 个效果文档、47 条绑定，输出为真实目录 `assets3d-local/fx-batch2/`。没有覆盖其他输出根。模型来自 `all-anim`，沿用第一批方式按原 manifest 路径逐字节复制；已核对全部模型字节与真实 skin joints，没有重新转换模型或修改 all-anim。163 个效果资源引用均存在。

未联网、未执行 Git 命令、未写 .git、未修改 src/。素材只写入 assets3d-local/；仓库内交付内容只有脚本、绑定表、测试、绑定元数据 fixture 和本文，尺寸测试数据全部合成。未做浏览器画面验收。

## 复用入口

```powershell
node scripts/assets3d/fx-batch.mjs --units akali,amumu,camille,irelia,leona,morgana,nocturne,sett,tristana,zyra --out assets3d-local/fx-batch2
node scripts/assets3d/fx-batch-sizes.mjs --out assets3d-local/fx-batch2
```

重复生成显式加 `--force`。批处理自动发现 `fx-bindings/` 下每英雄的 `.mjs` 默认导出，未来只需新增绑定表，不需修改转换器或名单。`batch2.mjs` 仅为测试汇总。输出仅允许 assets3d-local 的直接子目录 fx-batch*，拒绝联接/符号链接根及外部路径。未知或重复英雄在写入前拒绝。

`fx-batch1.mjs` 保留第一批默认名单、默认输出根和绑定函数接口，调用通用实现。`fx-batch1-sizes.mjs` 保留旧命令入口并调用通用尺寸报告；尺寸口径按本次要求更新为固定 0.44，不再接受旧 `--scales` 身体缩放输入。旧 `fx-batch1-oversize.mjs` 作为历史三例诊断入口保留。

所有英雄系统均按本地 `TFT13_<英雄>_Base_<后缀>` 精确选择。普攻命中复用本地 fx-trial 共享命中，不拉取新资源。每条绑定均标记 `approximated`；start/travel/impact、source/projectile/target、delay、maxDuration 均显式记录。源骨骼按大小写核对真实 GLB，目标世界锚点不猜敌方骨骼。阶段只描述预览顺序，不改变玩法。

## 绑定与主要尺寸

世界尺寸 = 源单位 × 0.44，一格 = 62.4。使用真实 ParticleEffectV2、实际 mesh 几何、固定默认随机种子，每 50ms 采样到绑定 maxDuration。表格为 t>0 时单粒子几何长边峰值；t=0 在报告中单独记录。排除零面积退化粒子，包含贴图透明边；不是伤害半径、可见 alpha 包围盒、整体效果 AABB 或连续时间理论上界。不包含宿主飞行/位移轨迹。

| 英雄 | 普攻/技能绑定数 | 主要技能特效（格） | 缺项 |
| --- | ---: | --- | --- |
| akali | 1/6 | E_Enemy_Indicator 2.82；E_Tar/W_Tar 1.91；E_mis 1.19 | 普攻出手/飞行无专用系统；无独立范围系统；位移待宿主 |
| amumu | 1/3 | W_Buff 0.63；W_tar 0.52；W_Spark_Mis 0.14 | 普攻出手/飞行无专用系统 |
| camille | 1/4 | Q_2_cas 3.52；Q_2_cas_child 3.11；Q_tar 1.49；W_heal 1.16 | 普攻出手/飞行、技能飞行/范围缺失；Q_2_cas_shin 无可写发射器 |
| irelia | 1/2 | W_Swipe 3.11；W_DR 2.19 | 普攻出手/飞行、技能飞行缺失 |
| leona | 1/3 | W_cas_hit 5.90；W_tar 1.55；W_buf 1.27 | 普攻出手/飞行、技能飞行缺失 |
| morgana | 2/3 | Q_DoT 2.54；Q_Mis 2.12；Q_DoT_Card 0.63 | 普攻/技能出手、独立范围缺失；Q_Tar 无可写发射器 |
| nocturne | 1/3 | P_cleave 4.90；P_tar 1.76；P_buf 0.00 | 普攻出手/飞行、技能飞行缺失；P_buf 可见光环缺失，见下文 |
| sett | 1/3 | E_cas_child 3.53；E_tar_child_dust 2.71；E_tar_child_middle 2.12 | 普攻出手/飞行、技能飞行缺失；E_cas、E_tar_single_front/back 无可写发射器 |
| tristana | 2/4 | R_tar 3.42；R_cas 1.97；R_tar_dust 0.84；R_mis 0.74 | 普攻出手无专用系统 |
| zyra | 2/3 | E_plant_tar 1.94；E_Outer/E_Sequence_Impact 1.69 | 普攻出手缺失；E_Sequence_Root/Unroot 无可写发射器 |

普攻共享命中按本次 50ms 采样为 1.20 格；专用弹道 Morgana 0.28、Tristana 0.42、Zyra 0.74 格。与旧身体缩放或 0.1s 采样报告不可直接比较。缺项与原因均已进入 action-bindings.json 的 unavailable；独立子系统只作显式预览，不模拟父子生成链。

## 超过 3 格的原始数据追查

逐项核对本地 sidecar 的原始字段；原始数值、mesh 源边长和逐发射器测量只保存在本地 `assets3d-local/fx-batch2/` 的 size-report.json 与 *.report.json，仓库文档只写比例和格数。没有英雄特例或 3 格硬上限。

| 系统 | 原因（比例描述） | 处理与结果（FX_SCALE=0.44） |
| --- | --- | --- |
| Camille Q_2_cas / Q_2_cas_child | 挥砍弧和地面电路 mesh 本身约 3 格长，出生缩放略大于 1，淡入淡出 | 源几何本身大，保留 3.52 / 3.11 格 |
| Irelia W_Swipe | 地面烟尾 mesh，沿长轴出生缩放略大于 1，中等透明度 | 保留 3.11 格 |
| Leona W_cas_hit | 旋涡 mesh 出生缩放数倍并随寿命继续放大；另有三层等比地面光晕/光环，尺寸依次递减，光环透明度较低 | 源几何与缩放本身大，保留 5.90 格（光晕各约 4.7 / 4.1 / 3.5 格），保持平面朝向 |
| Nocturne P_cleave | 地面抓痕 mesh 很长但出生缩放约一半，透明度低；两层挥砍 mesh 出生缩放数倍；cracks 为大面片 | 保留 4.90 格（各层约 4.8 / 4.8 / 4.6 格）；镜像符号沿用绝对值近似，不影响长边 |
| Sett E_cas_child | Nebula2 为约 3:1 的非等比面片，旧标量缩放把短边跨轴放大一倍（换算错误）；其余为长面片配烟雾 | Nebula2 通用 XY 长边包络修复，4.23→2.12 格；整个系统 4.23→3.53 格 |
| Tristana R_tar | 命中冲击 mesh 不大，但寿命内缩放成长到原来的两倍多 | 源成长本身大，保留 3.42 格 |

除 Nebula2 的跨轴放大外，上述长边都由源几何和源缩放解释。这只是尺寸结论，不代表朝向或混合正确，见下节。

## 第二轮复看：固定面片复合旋转（2026-10-20）

浏览器复看发现 Nocturne P_cleave 中一块大面片竖立成约 6 格高的深色刀片。逐发射器的 primitive、出生角、地面层标记、blendMode 与贴图引用只保存在本地 `assets3d-local/fx-batch2/effects/nocturne/*.report.json`，未进仓库。

根因是复合旋转顺序，而非尺寸、度/弧度或坐标轴搞反。两个空间均为 Y-up、地面为 XZ；ArbitraryQuad 为局部 XY、法线 +Z。旧转换把同时有 X、Y 两个分量的出生角直接按 XYZ Euler 交给运行时，面片法线落到水平方向，于是长面片竖立；只绕 X 的面片原本就水平。

通用近似修法：固定 ArbitraryQuad 和 Mesh 的出生角按 YXZ（Ry·Rx·Rz）解释，再序列化成等价的 XYZ 度数：先俯仰放平，再绕地面法线偏航，最后保留局部卷转。这是本地字段组合、地面标记和复看现象支持的预览约定，没有原引擎执行证据，不宣称严格还原。测试用合成基向量验证 X 反射与顺序。只改 `particle-approximate.mjs`，不改 V2 协议、运行时、strict 路径或 jinx/vi strict fixture；不按英雄名、贴图名或地面层标记强制放平。

| 复核系统 | 朝向结果 | 混合与尺寸结果 |
| --- | --- | --- |
| Nocturne P_cleave | 竖立大面片改为水平；单轴旋转的其余层不变 | 该层 blendMode 2，见下节混合修复；4.90 格不缩小 |
| Leona W_cas_hit | 两层尖刺面片复合角改为水平；单轴地面光晕不变 | 4.74 格以内各层不变，旋涡 5.90 格保留 |
| Sett E_cas_child | 四层地面面片复合角改为水平；两层只有偏航的命中框仍竖立，不强制落地 | XY 长边包络保持，3.53 格 |
| Camille Q_2_cas（含 child） | 挥砍 mesh 只有偏航或零角，等价不变 | 3.52 / 3.11 格 |
| Tristana R_tar | 冲击 mesh 无出生旋转；一层地面灼烧修正复合角 | 3.42 格 |
| Irelia W_Swipe | 两层地面辉光修正；烟尾 mesh 只有偏航，不变 | 3.11 格 |

### 第一批朝向变化的发射器

同一出生采样下旧 XYZ 与新 YXZ 的四元数姿态对比，第一批共 49 个发射器姿态改变（逐项在本地 `assets3d-local/fx-batch1/orientation-report.json`），按系统分布：

drmundo r_buf（4）、r_cas_01（2）、e_knockback_wave（4）、r_zap_aoe（2）、e_knockback_tar（1）；blitzcrank q_mis（3）、q_cas（2）；ziggs q_explosion（2）；caitlyn r_scope_hologram（1）、r_bombardment_impact（6）；darius q_heal（1）；twistedfate w_yellow_tar（1）、w_cas（1）、w_bluecard（12）、w_red_tar（1）；malzahar spell_portal_1（5）；ekko p_proc（1）。

都是同时带俯仰和偏航的地面面片或 mesh。第一批复查过的三处超大地面辉光（Blitzcrank q_cas、Caitlyn 轰炸命中、Lux w_mis 中只绕 X 的那一层）姿态不变，仍平铺、尺寸不变；同系统里其他带复合角的层随本修复放平。

影响范围按全部已生成效果文档（包含未绑定系统）对比**同一出生采样**的旧XYZ与新YXZ姿态：第二批21个发射器姿态改变，第一批49个。第二批还覆盖 Akali W_tar、Leona W_tar、Morgana Q_DoT、Zyra E_Outer/E_Sequence_Impact/E_plant_tar 中的同类复合角。完整逐项结果保存在两批本地 `orientation-report.json`；比较的是四元数姿态，不把Euler数值重写误报成姿态变化。

混合复核的旧结论已由黑底截图及PNG alpha证据否定：本轮2统一改为加亮，未知模式且PNG全255也回退加亮。四根统计、约定、依据及验证见 [ASSETS3D_BLEND_MODES.md](ASSETS3D_BLEND_MODES.md)。所有数字映射仍为 approximated，不宣称原引擎混合方程已精确还原。

两批均已用上面的生成命令加 `--force` 重生，并重算 size-report.json。第一批 Blitzcrank/Caitlyn/Lux 那类固定地面面片仍不朝向相机，原尺寸不缩小；单X角的地面辉光法线仍为±Y。直接加载实际生成的Nocturne两个面片，在FX_SCALE=.44、斜俯视相机、t=.05s下，Glow/cracks的世界高度包围盒分别约1.73e-14/4.76e-14，法线Y分别为-1/+1；两者仍为NormalBlending(1)。产物校验第一批71个文档/516次资源引用、第二批42个文档/215次资源引用全部存在（含重复引用），两批ready=true。

新增数据全为假名、`synthetic/*.png`、整齐角度与尺寸，没有新增或改写 fixture。指定8个测试文件最终381项全部通过，`tsc --noEmit -p .`通过；strict完整fixture逐项对照通过。尚未进行修复后的浏览器画面复看，机器法线检查不等同于画面验收。

## 通用修正与限制

particle-approximate.mjs 对非uniform CameraQuad/ArbitraryQuad 用 `max(abs(sizeX×curveX),abs(sizeY×curveY))/max(sizeX,sizeY)` 构造 V2 标量曲线，并插入轴主导权交点，使源关键帧之间线性插值仍保留长边。修复所有同类面片，不检查英雄名；uniform、mesh、ray、trail 和 strict 转换保持原逻辑。

运行时只有标量曲线，因此长宽比例动画仍为静态比例近似；sidecar 明记 `scalar-v2-XY-long-edge-envelope-static-aspect-ratio`，不声称完整恢复各轴动画。回归使用手写合成面片：源尺寸 [80,400,0]，X 缩放 3→1、Y 恒1，验证 Y 长边保持400且输入不变；另以 X/Y 长边交叉曲线验证交点插入。800/1600 源长边案例验证超过3格仍保留源尺寸及世界缩放。

Nocturne P_buf 的可写文档只剩零尺寸 ArcsBIG：概率正负抵消；四个 attached mesh 需要蒙皮，Lightning_AOE_Ring pivot 不支持。保留该系统绑定，同时在 unavailable 明记可见光环缺项，不将3条技能绑定声称为3个可见效果。其他被跳过/拒绝的发射器均保留完整 sidecar 原因，没有放宽未知字段规则。

## 测试数据边界

已删除 `tests/fixtures/assets3d-fx-batch2-oversize.json`，尺寸回归改为测试内联的最小合成字段，发射器名和贴图路径均为 synthetic。`assets3d-fx-batch2.json` 只保留绑定校验元数据（单位、系统/effectId、骨骼、绑定关系和不可用原因）及合成路径占位；移除源目录、动画映射、reportPath 和实测转换计数。原版曲线、贴图和发射器字段不进入测试；实测结论记录在本文，本地报告仍留在 assets3d-local。

## 验证

- 本次合成化后运行本地 `tsc.cmd --noEmit -p .`：通过。
- 本次指定8个 Vitest 文件全部通过，共367项；使用 `--configLoader runner`，沿用第一批沙箱运行方式。
- 文件：assets3d-fx-batch1、assets3d-fx-batch2、assets3d-particle-approximations、assets3d-visual-approximate、assets3d-particles-v2、rendering3d-action-effects、rendering3d-particles、rendering3d-particles-v2。
- 直接产物检查：10个模型字节/真实骨骼与 all-anim 一致；42个效果通过粒子文档校验；47条绑定与表重算一致；163个资源引用存在；输出根不是联接。

本次要求的离线绑定、生成、尺寸查因与指定机器测试已完成。残余为上表所列真实素材/转换能力缺项及后续浏览器画面验收。
