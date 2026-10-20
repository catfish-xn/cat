# 粒子 v2 第 2 段验收记录

日期：2026-10-19。分支：`codex/assets3d-particles-v2`；本次 PR #224 must-fix 起点 HEAD：`8cc6befa`。

转换链路与 60 单位离线构建已完成；真实发射器仍为 **0 映射**。
v2 增加表达能力不等于这些素材已能无损转换。没有输出不完整的替代特效，没有修改 src 或合同。

## 实际执行与模型回归

```powershell
node scripts/assets3d/build-all.mjs --units all --cost 1,2 --out assets3d-local/out/batch-cost12 --force
node scripts/assets3d/build-all.mjs --units all --cost 3,4,5 --out assets3d-local/out/batch-cost345 --force
```

| 批次 | 成功 | 失败/缺项 | 输出字节（含报告） |
| --- | ---: | ---: | ---: |
| batch-cost12 | 27 | 0/0 | 72249995 |
| batch-cost345 | 33 | 0/0 | 127537708 |

全程读取本地素材/缓存，无下载或外部转换程序。60 个单位的已知 BIN 链接均已读取，
unresolved 为 0，本次不需要补解包。

构建前保存旧批次的模型 GLB SHA-256、顶点/骨骼、动作 clips/mapped/missing、材质绑定；
构建后逐单位与实际 GLB 字节哈希及新报告比较，**60/60 一致、0 回退**。
本次本地复核证据为 `assets3d-local/out/particle-v2-review-evidence/{baseline,verification}.json`；
真实数据和生成物均在 gitignore 目录，未加入测试夹具。

## 粒子汇总

| 范围 | 系统 | 发射器 | 映射 | 跳过 | 拒绝 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 金克丝 | 34 | 252 | 0 | 34 | 218 |
| 蔚 | 11 | 47 | 0 | 8 | 39 |
| batch-cost12（27 单位） | 131 | 878 | 0 | 108 | 770 |
| batch-cost345（33 单位） | 335 | 2603 | 0 | 385 | 2218 |
| 全部 60 单位 | 466 | 3481 | 0 | 493 | 2988 |

本次 must-fix 后两批重跑的粒子总数、mapped/skipped/rejected 与全部决定性原因分组均与修复前一致，
变化量为 0，并非新增真实映射。完整原字段中 color 并存曲线有 840 次、scale0 有 411 次；
它们仍先被其他未支持字段/primitive 拒绝，故本次 `ambiguous-curve:constantValue+dynamics`
作为首个决定性原因的数量为 0。不能由首因未变化推断该组合在源中不存在或语义已证明。

Jinx/Vi 相比 v1 的 0 映射，真实映射数没有增加。
mapped + skipped + rejected = 发射器总数。每个发射器只按首个决定性原因计数，
**不是所有语义缺口的出现次数**。完整字段仍在各系统旁路的 originalFields，系统字段另存 systemGaps。

共复核 466 份旁路，实际粒子 payload 与 manifest.effects 数量均为 0；
actionEffects 建议只登记已写出的效果，故当前为空。

静态网格按单位引用去重：412 次资源引用中 205 次转换成功；所属发射器仍因其他字段不能无损映射，
最终 mesh GLB 写出 0 份。资源引用数与发射器数不同，也不是跨单位全局去重数量。

## Jinx / Vi 源对照

两者的系统位于无扩展名的 `characters/tft13_jinx` / `characters/tft13_vi` PROP 中，
由皮肤链接指向；不依赖单独的粒子 JSON 作为主源。

逐字段比较 BIN 解析结果与 `assets3d-local/source-json/{jinx,vi}.json`：
Jinx 34/34 系统、252/252 发射器一致；Vi 11/11 系统、47/47 发射器一致；differences 均为空。
比较包含未映射字段，并非只比较被转换器接收的子集。
只统一字段/类型的 FNV 名称、hash/link 的名字表示、float32、布尔/flag 和矩阵平铺/分行表示。

## Jinx / Vi 决定性原因

| 状态 | reason | Jinx | Vi |
| --- | --- | ---: | ---: |
| skipped | unsupported-scb-vertex-colors | 19 | 1 |
| skipped | attached-mesh-requires-skinning | 7 | 1 |
| skipped | unsupported-mesh-pivot | 5 | 0 |
| skipped | screen-distortion-requires-scene-color | 3 | 1 |
| skipped | mesh-resource-unavailable | 0 | 4 |
| skipped | unsupported-scb-flags | 0 | 1 |
| rejected | unmapped-source-field:particleLinger | 69 | 11 |
| rejected | unverified-primitive-semantics:VfxPrimitiveArbitraryQuad | 43 | 6 |
| rejected | unverified-primitive-semantics:VfxPrimitiveRay | 28 | 11 |
| rejected | unmapped-source-field:bindWeight | 28 | 5 |
| rejected | unverified-primitive-semantics:VfxPrimitiveCameraTrail | 17 | 2 |
| rejected | unmapped-source-field:pass | 8 | 1 |
| rejected | unmapped-source-field:SpawnShape | 8 | 0 |
| rejected | unmapped-primitive:AlignYawToCamera | 6 | 0 |
| rejected | unmapped-source-field:childParticleSetDefinition | 6 | 0 |
| rejected | unmapped-source-field:emitterLinger | 2 | 0 |
| rejected | unmapped-source-field:FlexShapeDefinition | 2 | 0 |
| rejected | unverified-primitive-semantics:VfxPrimitiveArbitraryTrail | 0 | 2 |
| rejected | unmapped-source-field:birthOrbitalVelocity | 1 | 0 |
| rejected | unmapped-source-field:rotationOverride | 0 | 1 |

## 全部单位仍拒绝原因 Top10

仅统计 rejected；网格缺失/不支持、AttachedMesh 和屏幕扭曲在 skipped 另计。

| reason | 发射器数 |
| --- | ---: |
| unmapped-source-field:particleLinger | 991 |
| unverified-primitive-semantics:VfxPrimitiveArbitraryQuad | 706 |
| unmapped-source-field:bindWeight | 411 |
| unverified-primitive-semantics:VfxPrimitiveRay | 202 |
| unverified-primitive-semantics:VfxPrimitiveCameraTrail | 177 |
| unverified-primitive-semantics:VfxPrimitiveBeam | 76 |
| unmapped-source-field:SpawnShape | 69 |
| unverified-primitive-semantics:VfxPrimitiveArbitraryTrail | 67 |
| unmapped-source-field:pass | 66 |
| unmapped-source-field:emitterLinger | 37 |

全部跳过分组：

| reason | 发射器数 |
| --- | ---: |
| unsupported-scb-vertex-colors | 255 |
| attached-mesh-requires-skinning | 74 |
| unsupported-mesh-pivot | 57 |
| screen-distortion-requires-scene-color | 40 |
| mesh-resource-unavailable | 34 |
| unsupported-scb-flags | 32 |
| invalid-sco-vertices | 1 |

## 实现与覆盖边界

- 共享 bin.mjs 的预算与校验，支持 complex/simple 发射器列表，字典仅保存名称，未知字段按 hash 保留。
- 输出 schemaVersion 2：有限 continuous、position、标量/向量/显式均匀范围 size0、出生旋转、
  常量运动、线性 RGB/alpha、等比大小曲线和 mesh 引用。平坦曲线可折叠，变化的出生值/非均匀概率不取平均。
- ArbitraryQuad/Ray/Trail 的映射接收有语义证据的 primitiveConventions；测试依据是独立合成定义，
  生产未启用任何未经确认的朝向/相机约束/拖尾模式。
- SCB 2.2/3.2 与 SCO 的静态无顶点色子集转自包含 GLB，反射 X、反绕序、保留逐角 UV；
  按字节、顶点、面和输出预算拒绝。非零 pivot、顶点色、未知 flag/附着语义均不丢弃后强转。
- 真实 parseParticleDocument 经现有 ts-loader 执行：逐候选及整份校验，失败不写；
  整份失败撤回 mapped 计数。只把通过且写出的文件登记 manifest。
- 默认总预算 10000 粒子/30 秒；有限效果扩展到包含 delay、发射、粒子与拖尾的完整持续时间，
  超过 3600 秒或显式收紧的时限拒绝。循环/无限寿命须分别有独立证据。
- 源 particleLinger、bindWeight、pass/depthBias、非等比动态尺寸、源 erosion/子发射器、
  系统 transform/flags 等缺少等价字段；数字 blendMode 的数值语义不能由 hash 字典或 JSON 证明，保持拒绝。

这些是合同/证据边界，不是本次授权内可静默放宽的实现细节。
后续先取得系统 flags、transform 与数字 blend 的证据，再按文末交接顺序推进发射器语义；本次未修改 src。

## PR #224 must-fix

- `curve()` 遇到 dynamics 与 constantValue 并存，整发射器拒绝，原因固定为
  `ambiguous-curve:constantValue+dynamics`；即使常量与曲线首值相同也不猜测组合语义。
  含未知嵌套字段的常量不能被另一分支掩盖；单独的 constantValue 也校验维数与每个分量的有限性。
  color、scale0 均覆盖合法并存、未知嵌套对象、嵌套分量与显式 undefined 反例。
- SCO/SCB 的位置和 UV 在写入前检查原 Number 有限性，再检查 `Math.fround` 结果有限性，
  超限拒绝整个网格。新增 SCO `±1e39` 位置/UV 与 SCB 非有限值反例。
  该静态网格子集没有法线流，不生成替代法线；现有模型 Float32 accessor 入口同样检查原值和
  `Math.fround` 结果，覆盖位置、UV、法线及其他实际 Float32 输出；新增三类源属性拒绝与变换后溢出测试。
- 网格来源在 readFile 前按 stat 大小预检 16 MiB 上限，读取后保留字节数与哈希检查；
  合成 batch 将网格扩展到上限加一，验证先得到 `mesh-byte-budget`，而非后续哈希/解析失败。

## 验证

`npx.cmd tsc --noEmit` 通过。所有 `tests/assets3d-*.test.ts`
逐文件执行 `npx.cmd vitest run <file> --configLoader runner --project fast --no-file-parallelism`：
16 文件、231 项通过、1 项跳过。本次未重跑 rendering3d 测试或视觉验收。
跳过项是既有 paths 测试的 Windows 文件符号链接 EPERM 分支；目录 junction 等其余边界测试通过。

| 测试 | 通过 |
| --- | ---: |
| assets3d-animation | 18 |
| assets3d-anm-v4 | 2 |
| assets3d-batch | 5 |
| assets3d-bin | 8 |
| assets3d-convert | 26 |
| assets3d-extract | 12 |
| assets3d-fetch | 15 |
| assets3d-glb | 5 |
| assets3d-model-convert | 34 |
| assets3d-particle-inventory | 4 |
| assets3d-particles-v2 | 60 |
| assets3d-paths | 9 |
| assets3d-rman | 6 |
| assets3d-source | 6 |
| assets3d-texture | 12 |
| assets3d-wad | 9 |

新合成用例覆盖 BIN 粒子字段与未知 hash、矩阵/链接对照、链接预算、continuous/位置/尺寸与旋转、
RGBA 曲线、primitive 证据边界、整发射器拒绝、整份合同失败不写、SCB/SCO 数值与预算。
batch 用例从合成 WAD 缓存解包，通过真实构建器写出 quad + mesh v2 文档、静态 GLB 与 manifest，
并读取文件用实际合同复核。没有提交真实素材夹具。

`git diff --check` 通过；改动仅位于 scripts/assets3d 和 tests/assets3d-*.test.ts，
未改 src，改动保留工作区，未提交。

## 建议提交信息

`fix(assets3d): reject ambiguous curves and Float32 mesh overflow`

## 交接：让粒子画出来的最少前置

先处理跨发射器的基础语义。下列数目是完整原字段的出现/影响次数，**不是首个拒绝原因统计，也不是净解锁数**。
来源值和 hash 名称只能证明字段存在，不能证明行为；需要对应版本的源实现/格式说明，或可独立控制输入、
区分候选解释的参考观测，再建立正反例和合同映射。不得仅凭类型名、常见引擎惯例或截图相似度放行。

| 优先基础项 | 影响发射器数 | 最少证据需求 |
| --- | ---: | --- |
| 系统 flags | 3314 | 每个实际位的含义、缺省值/组合方式，以及对发射、空间、时序和绘制的作用；确认哪些位可等价支持，哪些必须拒绝，不能将整个 bitmask 当无害元数据。 |
| 系统 transform | 587 | 矩阵行列约定、坐标系/单位、父子层级与乘法次序，局部/世界空间，以及对发射位置、速度、朝向、尺寸和运行中附着的作用；单位矩阵与非平凡变换须分别验证。 |
| 数字 blendMode | 3153 | 各实际枚举值的 RGB/alpha 混合方程、源/目标因子与运算，straight/premultiplied alpha 约定及相关 pass/depth/cull 条件；逐值证明目标 normal/additive/multiply 是否等价。 |

基础项取证后，发射器侧按以下顺序推进；每项都须和所在系统、其他字段一起验收：

1. **particleLinger**：明确发射停止、发射器结束与粒子寿命结束时各自的存活/绘制/更新行为，
   与 emitterLinger、particleLingerType 的关系，以及曲线是否继续推进；据此定义尾段持续时间和预算。
2. **ArbitraryQuad**：证明源平面、法线/绕序、本地轴、旋转次序与父变换，以及是否受相机朝向约束；
   对 AlignYawToCamera/AlignPitchToCamera 等组合单独确认，不能直接等同 CameraQuad。
3. **bindWeight**：证明附着目标/骨骼、权重插值所在空间、出生时与持续更新的差别，
   以及位置/速度/旋转如何继承；需要 0、1、中间权重和移动父节点的可区分样例。
4. **Ray**：证明方向轴、起点/终点或长度来源、尺寸与曲线的作用方式、相机约束及 UV 方向/长度；
   不能仅由类型名推断为固定 +Y 射线。
5. **CameraTrail**：证明轨迹采样的时间/距离规则、移动/附着空间、相机朝向、mMode 拓扑、
   宽度与寿命曲线、分段/插值，以及 UV 拉伸或平铺和 tileLength；不能把不同拖尾模式合成一种。

当前上述基础项与五个发射器项的**单项净解锁均为 0**。本地
`particle-v2-review-evidence/handoff-diagnostics.json` 保存单项乐观消除后的复算：
删除该字段，或将该 primitive 的全部问题临时视作已解决，其他阻碍仍保留，结果仍为 0；
这只是诊断上界，不是源语义证据或生产映射配置。
必须按**完整系统 + 完整发射器的组合**重新转换、合同校验并计算净解锁数；
不能将缺口次数相加，也不能把首个拒绝原因消失当作发射器已可绘制。
并存曲线的 constantValue/dynamics 组合语义仍需单独取证，未证明前继续整发射器拒绝。
