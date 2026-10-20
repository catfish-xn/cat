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
