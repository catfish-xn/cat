# 3D 英雄特效第一批

输出：`assets3d-local/fx-batch1/`。本批 10 个模型（all-anim 的 GLB 字节副本）、71 个效果文档、301 个纹理/mesh 资源、49 条动作绑定。没有修改 fx-trial、fx-all、public、界面或规则代码，没有联网或操作 Git。素材仅在被忽略的本地目录。

## 生成和接口

```powershell
node scripts/assets3d/fx-trial.mjs --units drmundo,blitzcrank,heimerdinger,ziggs,lux,caitlyn,darius,twistedfate,malzahar,ekko --out assets3d-local/fx-batch1
# 重建现有批次时加 --force；也可直接 node scripts/assets3d/fx-batch1.mjs。
node scripts/assets3d/fx-batch1-sizes.mjs
```

`fx-bindings/<unit>.mjs` 每英雄一张表。jinx/vi 保留原选择、顺序、变体、延迟、挂点和输出，包括左手缺失及共享 Hit/Crit 元数据；完整历史 plan fixture 回归通过。默认 fx-trial 命令行为保持不变，显式传本批 `--units` 才路由到新构建器。本批只接受 approximate 模式，拒绝写入 fx-trial、fx-all 或 assets3d-local 以外；输出根及 assets3d-local 根拒绝联接。

manifest 的 `actionEffects[unit].attack/cast` 是 effectId 数组；`action-bindings.json.playback[effectId]` 提供 phase、anchor、bone（可选）、delay、maxDuration、note。全部为 `approximated`，约定 `explicit-preview-stage-timing-and-placement`。phase 为 start/travel/impact，时间单位秒，表示预览估计而非游戏数值。身体骨骼只用 GLB skin joints 中精确匹配的名字；目标世界挂点不假设目标骨骼。Caitlyn 轰炸飞行缺飞艇骨骼，因此退回 source 世界挂点、不挂骨骼。

读取现有批次 sidecar 的原始系统，使用当前“有曲线用曲线”转换器重新转换所有英雄粒子；mesh 从经哈希校验的本地提取缓存重建。共享普攻 Hit 直接复制现有 fx-trial 本地文档和依赖，不重新提取或改写共享根。未输出系统只保留 report，不会绑定不存在的文档。`bones.json`、`systems.json`、每个效果的 `.report.json` 保留对应依据。

## 选择与缺口

| 英雄 | 普攻/技能绑定数 | 选择及缺口 |
| --- | ---: | --- |
| drmundo | 1/2 | 共享普攻命中；R_cas_01 → R_Buf。无专用普攻出手/飞行；R_cas_02 源系统为空。 |
| blitzcrank | 1/4 | 共享命中；Q_cas → Q_mis → Q_Tar2 → Q_mis_return。Q_Shield 因 overrideScaleCap 不支持而拒绝；无专用普攻出手/飞行。 |
| heimerdinger | 2/3 | BA_mis + 共享命中；W_Cas → W_Mis → W_Tar。本地 TFT13 只有火箭，没有炮台召唤系统；无专用普攻出手。 |
| ziggs | 2/1 | BA_mis + 共享命中；Q_explosion。Q_mis_01 因 unsupported-mesh-pivot 跳过，缺技能飞行及专用出手。 |
| lux | 2/2 | BA_mis + 共享命中；W_mis → W_Shield。没有 R 光束；P_Empowered_Weapon 因 scaleDynamicallyWithAttachedBone 不支持而拒绝，缺专用出手。 |
| caitlyn | 2/5 | BA_mis + 共享命中；R_Cas/Scope/Target → R_Bombardment_Mis → Impact。BA_Crit_Cas 不冒充普通攻击出手；无飞艇骨骼。 |
| darius | 1/4 | 共享命中；Q_Ring_Windup → Q_Ring/Q_tar → Q_Heal。Q_hemo_debuff 缺 mesh；无专用普攻出手/飞行。 |
| twistedfate | 2/3 | BA_Mis + 共享命中；W_Cas → W_Red_Mis → W_Red_Tar。只预览红牌，不同时播放三色，不推导随机选牌。 |
| malzahar | 2/5 | AA_mis + 共享命中；Q_CAS_HandTrail → Q_mis → Spell_Tar/E_buf/E_Damage。无专用普攻出手；Spread_Beam 无端点且动作合同没有第二目标，未绑定。 |
| ekko | 1/4 | 共享命中；R_Mark/R_Mark_Enemy → P_Proc/P_Tar_Impact。无专用普攻出手/飞行、位移/时间拖尾系统；不伪造位移。 |

除明确写完整名称的例外，按 `TFT13_<英雄>_Base_<suffix>` 精确选择。Ziggs 的 `TFT13_Ziggs_Q_mis_01`，以及 Malzahar 的 AA_mis、Q_mis、Spell_Tar、E_buf、E_Damage 原名没有 `_Base_`，保留原名及 note，未重命名来假装符合前缀。

Blitzcrank 的 Q 命名不证明 TFT13 玩法存在拉人：这里只安排近似视觉阶段。返程弹道需宿主反向轨迹；Caitlyn 空中轰炸、Ekko 位移也需宿主运动/事件支持，本批没有改外壳或玩法。粒子子系统、附着 mesh、无端点 beam 等转换缺口保持原报告，没有放宽转换器来强行输出。

## 尺寸抽查口径与限制

当前仓库未提供 3D 外壳的身体 fit/worldScale 实现，尚未确认实际身体缩放和棋盘格距。以下为**假设 fit 下的世界尺寸**，不能称为实机尺寸验收：身体原始高度取现有 build-report 的 body bind-mesh bbox，高度统一 fit 到 1.8 场景单位，因此每英雄的身体 worldScale=1.8/原始高度；格距按半径 1 的六角格相邻中心距 √3≈1.732 场景单位。该假设会影响大小体型对比，不能用于最终美术定标。

调用真实 ParticleEffectV2，固定默认种子、相机 (4,6,8)，每 50ms 采样到绑定 maxDuration；乘对应英雄身体 worldScale，取主要命中/范围特效所有存活粒子 AABB 的各轴峰值和最大边，单位均为场景单位。读取真实粒子 mesh 几何；不以单位面片替代 mesh。包含偏移和局部运动，不包含宿主飞行轨迹；没有按 alpha 裁透明边缘，数值不等于可见伤害半径或所有随机样本的理论上界。

Ziggs 爆炸、Caitlyn 轰炸、Ekko P_Proc 在此假设下超过 3 格；没有主要命中/范围效果小于 0.2 格。建议先用真实外壳缩放重测；仍超阈值时，分别复核爆炸/轰炸覆盖和 Ekko 的扩散装饰，再由表现层决定独立预览缩放。**不建议在通用转换器截断或夹紧源尺寸。** 其他条目本轮不需要调整。

可用外壳实际数值重测：将 `{ "cellDistance": 实际格距, "units": { "drmundo": 实际bodyWorldScale, ...其余九人 } }` 写到本地 JSON，执行 `node scripts/assets3d/fx-batch1-sizes.mjs --scales assets3d-local/实际缩放.json`。该命令只写本批 `size-report.json`。

## 验证

`npx.cmd --no-install tsc --noEmit -p .` 通过。用户指定 6 个 Vitest 文件 352 项通过；新增 `assets3d-fx-batch1.test.ts` 3 项通过，检查所有绑定的 manifest 引用、实际模型 fixture 骨骼、合法 phase、缺失骨骼/悬空引用拒绝，以及 jinx/vi 完整输出一致性。原严格模式 fixture 保持不变。

生成后额外读取 10 个 GLB 对照骨骼 fixture，检查 71 个效果文档的 301 个资源路径及 49 条绑定，全部存在；assets3d-local 和输出根均为真实目录。未做浏览器画面验收，未修改效果尺寸或运行时连线。

## 尺寸数值

以下数值可由 `size-report.json` 重现；XYZ 为逐轴峰值，不保证同时出现。

| ?? | ???? | ???? | XYZ ???????? | ???/?? | ?? |
| --- | ---: | --- | --- | ---: | --- |
| drmundo | 0.006057 | r_buf | 1.725 ? 3.003 ? 1.458 | 1.73 ? | ????? |
| blitzcrank | 0.010622 | q_tar2 | 2.672 ? 1.941 ? 2.209 | 1.54 ? | ????? |
| heimerdinger | 0.006912 | w_tar | 3.049 ? 2.214 ? 2.521 | 1.76 ? | ????? |
| ziggs | 0.016190 | q_explosion | 7.406 ? 7.937 ? 6.123 | 4.58 ? | ?????? fit |
| lux | 0.013160 | w_shield | 4.515 ? 3.808 ? 3.733 | 2.61 ? | ????? |
| caitlyn | 0.008629 | r_bombardment_impact | 13.025 ? 17.672 ? 10.769 | 10.20 ? | ?????? fit |
| darius | 0.005518 | q_ring | 3.060 ? 2.340 ? 2.530 | 1.77 ? | ????? |
| darius | 0.005518 | q_tar | 1.065 ? 0.773 ? 0.880 | 0.61 ? | ????? |
| darius | 0.005518 | q_heal | 1.647 ? 1.633 ? 1.362 | 0.95 ? | ????? |
| twistedfate | 0.008535 | w_red_tar | 3.311 ? 2.748 ? 2.421 | 1.91 ? | ????? |
| malzahar | 0.009825 | spell_tar | 1.974 ? 4.477 ? 1.632 | 2.59 ? | ????? |
| malzahar | 0.009825 | e_buf | 3.596 ? 4.191 ? 3.196 | 2.42 ? | ????? |
| malzahar | 0.009825 | e_damage | 2.921 ? 2.186 ? 2.415 | 1.69 ? | ????? |
| ekko | 0.009361 | p_proc | 4.282 ? 10.817 ? 4.439 | 6.25 ? | ?????? fit |
| ekko | 0.009361 | p_tar_impact | 2.226 ? 1.616 ? 1.840 | 1.28 ? | ????? |

## 浏览器实测尺寸（2026-10-20，Claude）

按外壳真实缩放实测：身体缩放 = 92 / 模型包围盒高度；一格 = √3×36 ≈ 62.4 场景单位；数值为单个粒子最大边折合格数（12 帧 × 0.1 s 取最大）。

| 英雄 | 身体缩放 | 主要特效（格） |
| --- | ---: | --- |
| drmundo | 0.310 | r_cas_01 2.48、r_buf 1.05 |
| blitzcrank | 0.543 | **q_cas 10.44**、q_mis 3.48、q_tar2 1.91 |
| heimerdinger | 0.353 | w_tar 1.46、w_mis 0.75（w_cas 无可见粒子） |
| ziggs | 0.828 | q_explosion 3.98、ba_mis 0.03 |
| lux | 0.673 | **w_mis 7.55**、w_shield 3.24 |
| caitlyn | 0.441 | **r_bombardment_impact 8.20**、r_scope_hologram 2.12 |
| darius | 0.282 | q_ring 2.19、q_ring_windup 2.04 |
| twistedfate | 0.436 | w_red_tar 2.10、w_red_mis 2.04 |
| malzahar | 0.502 | e_buf 2.55、q_mis 2.20 |
| ekko | 0.478 | p_proc 2.60、r_mark 0.16 |

共享普攻命中 global_ba_hit 随身体缩放从 0.34 格（darius）到 1.00 格（ziggs），说明按身体缩放换算会让小模型的特效偏大、大模型偏小。超过 3 格的 blitzcrank q_cas、lux w_mis、caitlyn r_bombardment_impact 待逐个查是哪个字段造成的。

## 三个超大特效查因与修正（2026-10-20，Codex）

以下使用用户提供的身体缩放及一格 62.4 场景单位，测量单粒子几何长边，不裁贴图透明边缘，不等于伤害范围或整个系统的 AABB。依据来自本地原始 sidecar。用途判断基于字段、贴图名称和局部旋转，未经过原引擎对照。

| 系统 / 发射器 | 原始字段与原因 | 处理与预计尺寸 |
| --- | --- | --- |
| blitzcrank Q_cas / praxis | birthScale0=[1200,450,0]，isUniformScale=1；scale0.X 从 0.6 经 0.95 到 1，尺寸概率表为空。primitive=ArbitraryQuad，贴图 Q_Shockwave，birthRotation0.X=90。1200 是直接写入源文件的冲击波长边，并非重复乘常量。 | 保留大范围冲击波，修复平面朝向；长边仍约 1200×0.543÷62.4=10.44 格。 |
| caitlyn R_Bombardment_Impact / Add_Glow1 | birthScale0 的 dynamics 首键约 [1200,330,330] 替代 fallback；isUniformScale=1；scale0.X 从 1.1 到 0.7，寿命 0.3s；没有尺寸概率倍率。ArbitraryQuad，birthRotation0.X=-90，贴图 SS_BOSS_Herald_BackDrop，判断为短暂轰炸地面背光。 | 保留背光并恢复源地面朝向；0.1s 长边约 1200×(1.1+(0.7-1.1)/3)=1160，1160×0.441÷62.4=8.20 格。出生瞬间约 1320×0.441÷62.4=9.33 格，8.20 不是连续时间上界。 |
| lux W_mis / Temp_GroundGlow | birthScale0=[700,650,160]，没有 scale0 或尺寸概率表；ArbitraryQuad，birthRotation0=[0,0,90]，偏移 [0,-350,-120]，贴图 Lux_W_Shape。源文件本来就是宽的局部形状光，不是 beam 端点撑长。 | 保留源形状及 Z 旋转，不凭 GroundGlow 名字强行压到地面；不再随镜头旋转。长边仍为 700×0.673÷62.4=7.55 格。 |

三者长边均可由源数值解释，按冲击波、轰炸背光和 W 形状光保留是本轮判断。没有证据将其认定为应移除的镜头发射器，因此绑定表未删改，未加英雄特例或尺寸上限。**修的是平面朝向错误，不承诺长边降到 3 格。**

通用修改：近似转换器把 VfxPrimitiveArbitraryQuad 输出为运行时已有的 arbitraryQuad，保留反射换算后的完整 birth Euler。此前输出 camera-facing quad，并清零 X/Y 旋转，会把源地面冲击波/背光竖起。CameraQuad 仍沿用 billboard 约定，strict 模式未改。isUniformScale 和非等比 scale0 取绝对 X 的现有近似仍有信息损失；三个指定长边并非由该信息损失凭空放大，本轮未扩展为全套非等比曲线实现。

额外排查：Caitlyn Alpha_Ray 原始尺寸 [100,500,0]，X 概率键 [-1.5,-1,1,1.5] 在现有确定性均值预览中抵消为 0，输出 [0,500,0]；虽有很长的退化包围线但没有面，不是实测 8.20 格的来源。Blitzcrank Ring_Ground_ 是真实 mesh，几何长边约 61.11×birthScale0 20≈1222.11，即 10.63 格；Circle mesh 约 808.11 源单位，即 7.03 格。它们也来自源几何/缩放，只测单位面片会漏掉；报告包含透明时刻，不应把几何上界直接称为可见尺寸。

复现：`node scripts/assets3d/fx-batch1.mjs --force` 已重新生成整个本地批次；`node scripts/assets3d/fx-batch1-oversize.mjs` 以真实 ParticleEffectV2 和 mesh 几何逐发射器测量，写入 `assets3d-local/fx-batch1/oversize-report.json`。报告分开记录 t=0 与 0.1–2.2s 采样、几何长边及 AABB，nonzeroSurface 标识是否存在非退化面。新增原始字段 fixture 及尺寸/朝向回归。本轮未做浏览器截图验收。

验证：`npx.cmd --no-install tsc --noEmit -p .` 通过；指定的 assets3d-fx-batch1、assets3d-particle-approximations、assets3d-visual-approximate、rendering3d-action-effects 四个测试文件共 **136 项通过**。默认配置打包器在沙箱内读取父目录失败，使用同一仓库配置的 `--configLoader runner` 执行通过，未改配置或依赖。素材只写 assets3d-local，未修改 src、未联网、未执行 Git 操作。

## 统一换算系数（协调者定 A，2026-10-20）

外壳不再按各英雄身体缩放换算特效，统一用 `FX_SCALE = 0.44`（`src/rendering/three-mode/placeholder-renderer.ts`，60 个模型 92/高度 的中位数 0.438）。上表格数按 ×0.44/身体缩放 换算：共享普攻命中统一约 0.5 格；blitzcrank q_cas ≈ 8.5、caitlyn 轰炸命中 ≈ 8.2、lux w_mis ≈ 4.9 格。三者都是原始数据本身就大的低透明度地面/背光辉光（见上节），ArbitraryQuad 朝向修复后平铺在地面；浏览器按 0.44 摆放复看，表现为淡的大范围光晕，不遮挡棋子，保留。

#276 fixture ???`assets3d-fx-batch1.json` ?????????/manifest ???????`assets3d-fx-legacy-bindings.json` ???????????????????????????????

## 新转换器尺寸复测与混合修正（2026-10-20）

本节替代上文旧fit/身体缩放、0.1s采样及“统一换算”估算。调用实际ParticleEffectV2，固定FX_SCALE=0.44、一格62.4、50ms采样至各绑定maxDuration；表中为t>0单粒子非退化几何长边峰值，包含mesh与透明边，不是可见包围盒或伤害范围。t=0单列在本地size-report.json。

重生成命令：

```powershell
node scripts/assets3d/fx-batch1.mjs --force
node scripts/assets3d/fx-batch-sizes.mjs --out assets3d-local/fx-batch1
```

相对上文旧身体缩放浏览器表，主要项更新如下；差异混有统一缩放、50ms更密采样、mesh几何测量与当前通用曲线转换，不能归因为本轮混合修复，也不能只按身体缩放比例换算：

| 英雄 | 旧文档格数 → 新口径格数 |
| --- | --- |
| drmundo | r_cas_01 2.48→2.12；r_buf 1.05→1.76 |
| blitzcrank | q_cas 10.44→8.46；q_mis 3.48→2.82；q_tar2 1.91→1.55 |
| heimerdinger | w_cas 无可见粒子→0.32几何上界；w_mis 0.75→1.42；w_tar 1.46→2.72 |
| ziggs | q_explosion 3.98→2.56；ba_mis 0.03→0.14 |
| lux | w_mis 7.55→4.94；w_shield 3.24→2.12 |
| caitlyn | r_scope_hologram 2.12→2.82；r_bombardment_impact 8.20→8.74 |
| darius | q_ring_windup 2.04→3.17；q_ring 2.19→3.42 |
| twistedfate | w_red_mis 2.04→2.05；w_red_tar 2.10→2.12 |
| malzahar | q_mis 2.20→2.12；e_buf 2.55→2.29 |
| ekko | r_mark 0.16→0.15；p_proc 2.60→8.15 |

共享普攻命中从旧报告随身体缩放的0.34–1.00格改为统一1.20格，修正上文统一换算约0.5格的估算。几何存在不保证某时刻alpha可见；没有重新做浏览器画面验收。尤其Ekko P_Proc新峰值来自Alpha_BackgroundThin_Green的ray几何长边；它不是mesh，当前测量包含整条面片及透明边，保留源尺寸，不为达到阈值改缩放。

完整当前技能尺寸：

| 英雄 | 系统 | 格数 |
| --- | --- | ---: |
| drmundo | r_cas_01 | 2.12 |
| drmundo | r_buf | 1.76 |
| blitzcrank | q_cas | 8.46 |
| blitzcrank | q_mis | 2.82 |
| blitzcrank | q_tar2 | 1.55 |
| blitzcrank | q_mis_return | 1.32 |
| heimerdinger | w_cas | 0.32 |
| heimerdinger | w_mis | 1.42 |
| heimerdinger | w_tar | 2.72 |
| ziggs | q_explosion | 2.56 |
| lux | w_mis | 4.94 |
| lux | w_shield | 2.12 |
| caitlyn | r_cas | 0.81 |
| caitlyn | r_scope_hologram | 2.82 |
| caitlyn | r_target | 0.72 |
| caitlyn | r_bombardment_mis | 2.12 |
| caitlyn | r_bombardment_impact | 8.74 |
| darius | q_ring_windup | 3.17 |
| darius | q_ring | 3.42 |
| darius | q_tar | 1.19 |
| darius | q_heal | 1.84 |
| twistedfate | w_cas | 1.12 |
| twistedfate | w_red_mis | 2.05 |
| twistedfate | w_red_tar | 2.12 |
| malzahar | q_cas_handtrail | 0.42 |
| malzahar | malzahar_tft13_malzahar_q_mis | 2.12 |
| malzahar | malzahar_tft13_malzahar_spell_tar | 2.51 |
| malzahar | malzahar_tft13_malzahar_e_buf | 2.29 |
| malzahar | malzahar_tft13_malzahar_e_damage | 1.83 |
| ekko | r_mark | 0.15 |
| ekko | r_mark_enemy | 0.21 |
| ekko | p_proc | 8.15 |
| ekko | p_tar_impact | 1.47 |

本轮混合修复前后去除blend字段的效果文档逐项相同，尺寸变化不由blend引起。第一批23文档31发射器改用additive；praxis、Add_Glow1、Temp_GroundGlow完整emitter（含原additive）不变，地面朝向与尺寸回归通过。jinx/vi strict及旧绑定fixture不变。两批合成测试与指定8文件382项通过，tsc通过。统计、映射与约定见 [ASSETS3D_BLEND_MODES.md](ASSETS3D_BLEND_MODES.md)。
