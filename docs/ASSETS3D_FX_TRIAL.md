# 金克丝 / 蔚粒子映射：部分交付，尚未达到可见目标

2026-10-20；起点 `3971d090`，分支 `codex/assets3d-particles-map`。

**本次没有解锁真实特效，没有完成两英雄各自普攻/技能可见的验收。**
已实现 linger 近似分类、严格动作绑定接口、离线重算与试产物构建入口；
不能把合成样本通过称为真实粒子已显示。

## 依据与边界

- 本地 `assets3d-local/source-json/{jinx,vi}.json`：CDragon 14.24 的字符 PROP JSON。
  解析后的完整粒子源与既有 BIN 旁路记录分别为 Jinx 34 系统、Vi 11 系统，逐字段对照 differences 均为空。
- `assets3d-local/out/batch-{cost12,cost345}/units/<id>/build-report.json` 及其引用的
  `effects/**/*.report.json`：读取完整 `originalFields`，重跑当前转换器；没有改写这些目录。
- 本地 `assets3d-local/trial/README.md`、`REPORT.md` 只说明旧试验页曾用自建解释器显示效果；
  不是 League 原生参数的行为规范，也不能用其“45/47 显示”证明源语义等价。
- 遵守本次不联网要求，**没有查询或验证新的 CDragon / 社区公开格式资料**。
  CDragon 字段名、类型名、原始数值不等于行为实现证据。以下未确认项继续拒绝。

## 动作引用链

| 英雄 / 动作 | 源中的直接证据 | 系统或缺口 |
| --- | --- | --- |
| Jinx 普攻 1–6 / 暴击 | SpellObject 的 `mMissileEffectKey=TFT13_Jinx_BA_Minigun_Mis`；ResourceResolver | `TFT13_Jinx_Base_BA_Minigun_Mis` |
| Jinx 普攻命中 | `mHitEffectKey=TFT_Global_BA_Hit`；暴击为 `TFT_Global_BA_Crit` | 不在本地这两份角色 JSON / 已加载角色粒子源中 |
| Jinx 枪口 | `BA_Minigun_Cas_{PointBlank,Short,Medium,Long,Long2}` 系统名 | 只确认名称候选，未在 SpellObject 中证明选择距离或触发时刻；不可五个同时播放 |
| Jinx Zap | `TFT13_JinxSpell_Zap` 的 missile / hit effect key | `W_Mis` / `W_Tar`；`W_Cas`、`W_Beam` 为名称候选 |
| Jinx FlameChompers | `TFT13_JinxSpell_FlameChompers.mMissileEffectKey` | `E_Mis`；`E_Mine_Explosion` 为名称候选 |
| Jinx DeathRocket | `TFT13_JinxSpell_DeathRocket.mMissileEffectKey` | `R_Mis`；`R_MuzzleFlash` / `R_Cast_Mouth` / `R_Tar` 等为名称或子系统候选 |
| Vi 普攻 1–2 | `TFT13_ViBasicAttack[2].mHitEffectKey=TFT_Global_BA_Hit` | **专属 Q 系统不能冒充普攻命中**；共享资源缺项 |
| Vi 暴击 | `TFT13_ViCritAttack.mHitEffectKey=TFT_Global_BA_Crit` | 共享资源缺项 |
| Vi 技能弹道 | `TFT13_ViSpell_Mis.mMissileEffectKey`；ResourceResolver | `TFT13_Vi_Base_Q_Landing_Mis` |
| Vi 技能其余阶段 | ResourceResolver 的 Q key 与系统名 | `Q_Tar`、`Q_Landing_AoE`、`Q_activate_hands_*` 等；未取得脚本触发时间 |

`scripts/assets3d/fx-trial.mjs` 的 `spellEvidence()` 保留每个 spell 路径、效果 key、
resolver 目标、资源是否存在、原始 missile 配置；不从关键词自动制造普攻绑定。

## 字段结论与真实取值

下表次数是字段出现次数，不是首个拒绝原因计数。为便于阅读，小数描述使用十进制近似；
`fieldEvidence()` 为每个系统逐字段保留原始 JSON 值、列表、发射器序号与名称，不做取平均。

| 字段 / 类型 | 本地数据形态和取值 | 能确认的结论 / 尚缺证据 | 本次处理 |
| --- | --- | --- | --- |
| `particleLinger` | Jinx 155 次，有限标量约 0.03–20；Vi 31 次，其中 30 个有限标量约 0.1–11，`Q_Landing_Mis_Child/StrokeDissolve_Right` 为 `null` | 按用户明确允许的尾段近似策略处理；未证明原引擎死亡、停止发射、曲线终点与 lingerType 的细节 | 仅显式 opt-in 后省略有限非负标量尾段，分类 `approximated`；null、负数、对象、非有限数、超过 3600 均拒绝 |
| `emitterLinger` | Jinx 19 次，0.1 / 0.2 / 0.5；Vi 5 次，0.5 / 1 | 同上；不将其加到粒子寿命，也不假装精确等价 | 同上；单发射器含两种 linger 仍只计一次近似 |
| `bindWeight` | Jinx 110、Vi 18 次；ValueFloat 常量 1，或相同常量与单点 dynamics / 空概率表并存，或 times `[0,1]`、values `[1,0]` | 数据能证明有随时间变化的权重；不能证明附着空间、目标骨骼、位置/旋转继承或插值方程 | 拒绝，未把 1 当作可无条件删除的默认值 |
| `VfxPrimitiveArbitraryQuad` | 两英雄均有仅 `__type` 的对象 | 未证明源平面、局部轴、绕序、旋转次序与相机约束 | 拒绝，未改成 CameraQuad |
| `VfxPrimitiveRay` | 两英雄均有仅 `__type` 的对象 | 未提供方向/长度字段；不能证明源方向轴、相机约束和 UV | 拒绝，未假设 +Y |
| `SpawnShape` | Jinx 51、Vi 19 次；Legacy、Box、Cylinder、Sphere、未知 `{ee39916f}`；有 emitOffset、emitRotationAxes/Angles、概率表；例 Box Size `[2.5,2.5,2.5]`、Vi Cylinder radius 50 / height 150 | 形状名不能证明表面/体积分布、flags、默认尺寸、旋转/偏移所在空间；未知 hash 仍未知 | 拒绝，未压成点发射或均匀球 |
| `pass` | Jinx 235 次 / 77 个不同整数，范围 -9999–9999；Vi 39 次 / 27 个整数，范围 -9999–600 | 不能由正负值断定原版排序、阶段、深度或混合规则 | 拒绝，未直接赋给 Three renderOrder |
| `VfxPrimitiveBeam` | 两英雄粒子源中不存在此 primitive；60 单位首因统计有 76 个 | **Jinx 名为 `W_Beam` 的系统使用 ArbitraryQuad，不能与 Beam primitive 混淆**；端点/跟随/宽度语义未知 | 不增加猜测映射 |
| CameraTrail / ArbitraryTrail | 两英雄均有 mTrail；mMode=1，mBirthTilingSize、可选 mSmoothingMode / mMaxAddedPerFrame / mCutoff；例 Jinx `[505,0,0]` + smoothing=1 + maxAdded=16；Vi `[400,0,0]` | 未证明 mode 枚举、采样、宽度与 UV、平滑及局部/世界空间 | 拒绝，未套用合成测试的 trail profile |
| 系统 `flags` | Jinx 普攻/大部分技能=2244，部分命中=2246、火箭=2261、子系统=2247；Vi 所有非空系统含 2244 或 2246 | 位含义与组合尚未取得行为证据，不能仅当元数据省略 | 保持系统级拒绝 |
| 系统 `transform` | Jinx 枪口为 4×4、含近 90° 旋转和 `[0,0,20,1]` 平移行；W_Mis 约 1.5 倍对角；R_Mis 约 1.1 倍 | 数据形态已知；行列约定、单位、父子乘法与速度/尺寸作用尚未证明 | 拒绝，未当单位矩阵或省略 |
| `blendMode` | Jinx 237、Vi 40 次，均有数字 1 / 3 / 4 | 未取得各枚举 RGB/alpha 方程和 straight/premultiplied 约定 | 数字仍拒绝；不从 `Add_` 名称猜 4=additive |
| `isUniformScale` | Jinx 87、Vi 17 次，均为 1；常与 birthScale0 `[350,0,0]` / `[90,1,1]` 并存 | 可能关联分量选取，但仅数据不足以证明；不能直接按 XYZ 变成零面积或强行取 X | 拒绝 |
| `miscRenderFlags`、alphaRef、depthBiasFactors | miscRenderFlags 均出现 1；常见 alphaRef=0、枪口 depthBiasFactors=`[0,-25]` | 位含义、阈值方程与深度偏移单位未证明 | 拒绝 |
| 子系统 / fieldCollection / Filtering / birthAcceleration 等 | 完整对象仍在原旁路；当前重算在 linger 后暴露这些更深的首因 | 未建立可验证的映射与默认值；拒绝顺序变化不等于净解锁 | 保留整发射器拒绝 |
| `color` / `scale0` 的 constantValue+dynamics、出生概率表 | Vi Glow 等同时含基值与变化曲线；概率表有空表及区间 | 组合是乘法、覆盖还是其他运算仍无独立依据 | 继续拒绝；未修改 #224 的并存曲线防线 |

## 系统结果

各表系统名省略 `Characters/TFT13_<英雄>/Skins/Skin0/Particles/TFT13_<英雄>_Base_`。
列值为**发射器数**；所有系统的精确映射和可写近似均为 0，均无粒子 payload。
略去重复首因不代表略去字段检查；系统级 flags 等仍是另外的阻碍。

| Jinx 系统 | 映射 | 近似 | 跳过 | 拒绝 |
| --- | ---: | ---: | ---: | ---: |
| BA_Minigun_Cas_PointBlank | 0 | 0 | 2 | 11 |
| BA_Minigun_Cas_Short | 0 | 0 | 2 | 11 |
| BA_Minigun_Cas_Medium | 0 | 0 | 2 | 11 |
| BA_Minigun_Cas_Long | 0 | 0 | 2 | 11 |
| BA_Minigun_Cas_Long2 | 0 | 0 | 2 | 11 |
| BA_Minigun_Mis | 0 | 0 | 0 | 5 |
| W_Cas | 0 | 0 | 0 | 1 |
| W_Mis | 0 | 0 | 1 | 10 |
| W_Beam | 0 | 0 | 0 | 11 |
| W_Tar | 0 | 0 | 1 | 4 |
| E_Mis | 0 | 0 | 0 | 6 |
| E_Mine_Explosion | 0 | 0 | 6 | 12 |
| R_MuzzleFlash | 0 | 0 | 4 | 11 |
| R_Cast_Mouth | 0 | 0 | 2 | 10 |
| R_Cast_Mouth_Rays_Child | 0 | 0 | 0 | 2 |
| R_Mis | 0 | 0 | 0 | 1 |
| R_Rocket_Child | 0 | 0 | 1 | 6 |
| R_Tar | 0 | 0 | 8 | 39 |
| R_Tar_Child | 0 | 0 | 0 | 2 |
| R_Enemy_Tar | 0 | 0 | 1 | 2 |
| R_Target_Buff | 0 | 0 | 0 | 1 |
| R_Target_Buff_Child_1 | 0 | 0 | 0 | 2 |
| R_Target_Buff_Child_2 | 0 | 0 | 0 | 2 |
| R_Target_Buff_Child_3 | 0 | 0 | 0 | 2 |
| R_Self_Buff | 0 | 0 | 0 | 4 |
| R_Self_Buff_Child_1 | 0 | 0 | 0 | 2 |
| R_Self_Buff_Child_2 | 0 | 0 | 0 | 2 |
| R_Self_Buff_Child_3 | 0 | 0 | 0 | 2 |
| R_Self_Buff_Child_4 | 0 | 0 | 0 | 2 |
| Z_Recall_Launch_Start（非攻击/技能） | 0 | 0 | 0 | 2 |
| Z_Recall_Launch（非攻击/技能） | 0 | 0 | 0 | 4 |
| Z_Torch（非攻击/技能） | 0 | 0 | 0 | 12 |
| Z_Torch_Child（非攻击/技能） | 0 | 0 | 0 | 3 |
| Z_Recall_Bounce_Dust（非攻击/技能） | 0 | 0 | 0 | 1 |
| **合计：34 系统 / 252 发射器** | **0** | **0** | **34** | **218** |

| Vi 系统 | 映射 | 近似 | 跳过 | 拒绝 |
| --- | ---: | ---: | ---: | ---: |
| Q_Jumping_Dust | 0 | 0 | 0 | 3 |
| Q_Landing_AoE_Child | 0 | 0 | 0 | 3 |
| Q_AoE_Crater（空系统） | 0 | 0 | 0 | 0 |
| Q_Landing_Mis_Child02 | 0 | 0 | 2 | 0 |
| Q_Tar | 0 | 0 | 0 | 7 |
| Q_Landing_Mis | 0 | 0 | 0 | 6 |
| Q_Shield | 0 | 0 | 1 | 0 |
| Q_activate_hands_L（空系统） | 0 | 0 | 0 | 0 |
| Q_activate_hands_R | 0 | 0 | 0 | 6 |
| Q_Landing_AoE | 0 | 0 | 3 | 10 |
| Q_Landing_Mis_Child | 0 | 0 | 2 | 4 |
| **合计：11 系统 / 47 发射器** | **0** | **0** | **8** | **39** |
| TFT_Global_BA_Hit / TFT_Global_BA_Crit | 未取得源 | — | — | — |

## 60 单位重算

真实执行：`node scripts/assets3d/fx-trial.mjs --mode recount`。只读批次旁路，资源转换成败沿用原报告；
发射器逐一重新转换及执行当前实际合同校验，不重写批次、不重新转全部模型。
检查了 60 个不重复单位、466 个系统、3481 个发射器，且每单位分类和等于总发射器数。

| 范围 | 系统 | 发射器 | 精确映射 | 可写近似 | 跳过 | 拒绝 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 全部 60 单位 | 466 | 3481 | 0 | 0 | 493 | 2988 |

省略 linger 后首因发生变化，例如 bindWeight 变为 767、SpawnShape 298、pass 232；
ArbitraryQuad 706、Ray 202、CameraTrail 177、Beam 76 不变。
14 个 particleLinger 与 6 个 emitterLinger 因不属于有限非负标量子集而拒绝。
**这些是首因分组，不是所有阻碍的次数；没有净解锁。**

## 输出目录阻碍

尝试执行：`node scripts/assets3d/fx-trial.mjs --out assets3d-local/fx-trial --force`。
`safeOutputPath` 返回 `unsafe-output-path`，在写出任何试产物之前停止。
原因：当前 `assets3d-local` 本身是指向 `../assets3d/assets3d-local` 的 junction；
既有路径合同明确拒绝外部目录链接，`tests/assets3d-paths.test.ts` 对此还有专门反例。
当前环境可写根也仅包含本工作树。未放宽该边界、替换 junction 或写入外部目标。

新增构建入口在合规环境下会把重新转换输出放在 `fx-trial/converted/`，
根 `manifest.json` 引用该子目录中的两个模型，粒子资源路径按根重写并复验。
逐单位复算详情写入 `fx-trial/recount/`，其中两英雄含逐字段原值与 spell 引用证据。
由于本次输出前提未满足，这些产物**尚未生成**，也没有可供查看的独立素材根。

## 外壳接线（交 Claude，未修改外壳）

已读 `src/rendering/three-mode/placeholder-renderer.ts`：
`openModels()` 只建 ModelCache，`onEvents()` 只驱动 UnitActionState / UnitAnimationMixer，
`tick()` 只更新模型动画；没有 effects 读取、ParticleEffect 加入场景或更新/释放调用。

新增公共 API：

```ts
type ActionEffects = Record<string, Partial<Record<ActionState, readonly string[]>>>;
// manifest.actionEffects 为可选字段；validate 拒绝未知动作、未知单位、重复或悬空效果引用。
parseActionEffects(value: unknown, manifest: AssetManifest): ActionEffects;
createActionEffectResolver(manifest: AssetManifest, bindings?: unknown):
  (unit: string, action: ActionState) => readonly { id: string; path: string }[];
```

`bindings` 缺省为 manifest.actionEffects；没有配置返回空数组。
它返回独立快照，不猜系统名。`build-report.actionEffects` 仍然是名称建议；
**不要原样导入整张建议表**：Jinx 多距离枪口、W/E/R、child、目标命中不能全部在每次 cast 播放。
需要明确选定阶段、挂点和变体后，再写入 manifest.actionEffects；本次未伪造绑定。

Claude 的最小调用点（选择好绑定、拿到合法 payload 后）：

```ts
import { createActionEffectResolver, loadParticleEffect } from '../../rendering3d';
const resolveEffects = createActionEffectResolver(models.cache.manifest);
// onEvents：attack 用 event.attackerId；cast 用 event.sourceId，只找对应 PieceView。
// 用 consume 前后 revision 确认事件被接受；死亡状态不能因广播再次播放。
for (const { id } of resolveEffects(view.definitionId, event.type)) {
  const fx = await loadParticleEffect(models.cache.manifest, id, { root: options.assetBase!, scale: 1 });
  // await 后检查 renderer/view 的销毁标志与阶段 generation；迟到结果立即 dispose。
  view.body!.add(fx.object); // 静态随身预览：继承 fit 后模型缩放；不是骨骼挂接或弹道。
  activeEffects.add(fx);
}
// tick：
for (const fx of activeEffects) {
  fx.update(seconds, camera);
  if (fx.finished) { fx.dispose(); activeEffects.delete(fx); }
}
// removePiece、换体、战斗切换与 renderer.dispose：释放归属实例并取消迟到加载。
```

这是调用位置示例，event.type 须先收窄为 attack/cast。资源预加载、失败处理、并发实例上限和生命周期登记应在外壳实现。
挂在 body 下只适合随身近似预览；枪口需要对应骨骼，目标命中需要 targetId，
导弹需要独立场景对象及显示事件提供的目标轨迹。不能用模型自身位移代替这些阶段。
`loadParticleEffect()` 已管理其加载的纹理；mesh payload 还需提供现有 readMesh 回调。

环境与素材齐备且外壳接线后查看：
`?render=3d&assets3d=/assets3d-local/fx-trial/`。
**当前这个地址不能用来验收本任务完成。**

## 验证

- `npx.cmd tsc --noEmit` 通过。
- 逐文件 `npx.cmd vitest run <file> --configLoader runner`：现有 24 文件及新增 3 文件，
  总计 488 项通过、1 项既有 Windows 文件符号链接权限分支跳过。
- 新增测试没有单条超时；覆盖 linger 合法/非法、opt-in、近似计数、整份验证失败撤回、
  旁路原值、动作引用及隔离快照、未知动作/引用、真实引用链的合成证据。
- batch / convert / extract / fetch / glb / paths 六文件在本工作树 `artifacts/particles-map-tests/`
  的相同源码副本运行，以普通目录隔离其合成写入；没有在共享素材根执行这些写入测试。
  其余文件在原工作树运行；3D 隔离测试在内存中执行真实 Vite build，不写 dist。
- 未运行 npm ci、全套测试、外部 EXE、网络、浏览器视觉验收；未写 `.git`、all 或 batch 目录。

建议本次部分改动的英文提交信息：
`feat(assets3d): add explicit linger approximations and action effect bindings`

继续所需输入：可用的离线源语义实现/格式资料（尤其系统 flags、数字 blend、附着与曲线组合）、
共享普攻命中资源，以及允许实际试产物写出的目录环境。以上补齐后才应继续宣称可见目标。
