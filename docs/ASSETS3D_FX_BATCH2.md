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

逐项核对 sidecar 的 originalFields。完整原始字段、转换后 size0/size、mesh 源边长及逐发射器测量在本地 size-report.json；没有英雄特例或 3 格硬上限。

| 系统 / 发射器 | 源字段、几何与原因 | 处理与结果 |
| --- | --- | --- |
| Camille Q_2_cas / swipe_blend、swipe_blend1 | Q_2_swipe_arch mesh 最大源边 383.749 × birthScale0 1.3 = 498.874；alpha 曲线淡入淡出，Tech_Trail/WeaponGlow 贴图 | 源挥砍弧 mesh 本身大，保留 3.52 格 |
| Camille Q_2_cas_child / swipe_circuits_mesh | Q_2_swipe_bits mesh 最大边 338.915 × birthScale0 1.3 = 440.589；isGroundLayer=1，alpha≈.745 后淡出 | 源地面电路挥砍，保留 3.11 格 |
| Irelia W_Swipe / Mesh_Smoke | W_WakeMesh 源 XYZ=[437.091,41.236,327.204]；birthScale0=[.7,10,1.35]，最长 327.204×1.35=441.725；scale0 恒1，birth alpha≈.502、isGroundLayer=1 | 源地面烟尾，保留 3.11 格 |
| Leona W_cas_hit / Anime_Swirl | Particles_1_9 mesh X/Z=184.226；birthScale0=[4,3,4]；scale0.X=.9→1.1→1.2，本绑定 .55s 时约 184.226×4×1.1357=836.913；isGroundLayer=1 | 源旋涡 mesh 与缩放本身大，保留 5.90 格；不只凭名字断言低透明度 |
| Leona W_cas_hit / flash_Dark4、flash_Dark3、ring | birthScale0.X=700/600/500，isUniformScale=1；前两者 scale0.X=.6→1；ring birth alpha≈.37。Dark4 为 ArbitraryQuad、X=90°；ring X=-90° | 源光晕/地面环，保留 4.74/4.06/3.53 格，保持平面朝向 |
| Nocturne P_cleave / mesh_ground1 | P_Claws mesh 最大边 1012.362；uniform birthScale0.X=.525；scale0.X 绝对值约1.30→1.31；alpha≈.21、isGroundLayer=1 | 源低透明度地面抓痕，保留 4.90 格；镜像符号沿用绝对值近似，不影响长边 |
| Nocturne P_cleave / Slayer_Slashes、Slayer_Slashes1、cracks | Slashes mesh 最大边98.113 × uniform birthScale0.X=7，得686.794；cracks uniform birthScale0.X=650、X=-90° | 源挥砍/地面光形，保留 4.84/4.84/4.58 格 |
| Sett E_cas_child / Nebula2（已修复） | birthScale0=[100,300,0]，非uniform；scale0=[[2,1,1],[2,1,1],[1,1,1]]。旧 scalar-X 把 Y=300 也乘2，错成600 | 通用 XY 长边包络恢复长边300，4.23→2.12 格，不改源字段 |
| Sett E_cas_child / Under3、Floor1、Hit1、hitbox_LB1 | birthScale0=[150,500,0]/[300,450,0]/[275,450,0]；hitbox uniform X450 × 概率均值.8 =360，再乘 scale0.X 末端1.2=432；球光/烟雾贴图，多项 birth alpha .3–.6 | 剩余源长面片/烟雾本身大，保留 3.53/3.17/3.17/3.05 格；整个系统 4.23→3.53 格 |
| Tristana R_tar / Impact_Mesh | tristana_base_r_tar_impact_mesh 源最大边140.536；birthScale0=1.5；scale0=.5→2→2.3，末端约484.850 | 源命中冲击 mesh 与成长本身大，保留 3.42 格 |

除 Nebula2 的跨轴放大外，上述长边均可由源几何和源缩放解释。不额外压缩，不把它们全部归类为低透明度辉光，也不据数值宣称画面无遮挡。Leona、Nocturne 等高覆盖效果需后续画面复看。

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
