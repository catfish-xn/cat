# 粒子 v2 第 2 段验收记录

日期：2026-10-19。分支：`codex/assets3d-particles-v2`；起点 HEAD：`653aef6141aea93924ef1add7fd732c5411d10ff`。

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
本地复核证据为 `assets3d-local/out/particle-v2-evidence/{baseline,verification}.json`；
真实数据和生成物均在 gitignore 目录，未加入测试夹具。

## 粒子汇总

| 范围 | 系统 | 发射器 | 映射 | 跳过 | 拒绝 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 金克丝 | 34 | 252 | 0 | 34 | 218 |
| 蔚 | 11 | 47 | 0 | 8 | 39 |
| 全部 60 单位 | 466 | 3481 | 0 | 493 | 2988 |

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
后续优先解决 particleLinger、ArbitraryQuad、bindWeight，再审查 Ray/Trail/数字 blend 和系统字段；本次未修改 src。

## 验证

`npx.cmd tsc --noEmit` 通过。所有 `tests/assets3d-*.test.ts` 和 `tests/rendering3d-particles*.test.ts`
逐文件执行 `npx.cmd vitest run <file> --configLoader runner --project fast --no-file-parallelism`：
18 文件、381 项通过、1 项跳过。
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
| assets3d-model-convert | 30 |
| assets3d-particle-inventory | 4 |
| assets3d-particles-v2 | 50 |
| assets3d-paths | 9 |
| assets3d-rman | 6 |
| assets3d-source | 6 |
| assets3d-texture | 12 |
| assets3d-wad | 9 |
| rendering3d-particles-v2 | 116 |
| rendering3d-particles | 48 |

新合成用例覆盖 BIN 粒子字段与未知 hash、矩阵/链接对照、链接预算、continuous/位置/尺寸与旋转、
RGBA 曲线、primitive 证据边界、整发射器拒绝、整份合同失败不写、SCB/SCO 数值与预算。
batch 用例从合成 WAD 缓存解包，通过真实构建器写出 quad + mesh v2 文档、静态 GLB 与 manifest，
并读取文件用实际合同复核。没有提交真实素材夹具。

`git diff --check` 通过；改动仅位于 scripts/assets3d 和 tests/assets3d-*.test.ts，
未改 src，改动保留工作区，未提交。

## 建议提交信息

`feat(assets3d): convert local BIN particles to strict v2`
