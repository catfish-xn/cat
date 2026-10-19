# D7 素材管线

当前入口为**第 2 步：原始 SKN/SKL/ANM、TEX/DDS 与粒子源 JSON 离线转换**，支持 `jinx,vi`。
第一阶段的整理、核验和盘点工具保留可用，历史说明见下方。

本目录只放代码。输入、输出、manifest、截图与真实素材全部放在被 Git 忽略的
`assets3d-local/` 下，不提交素材或生成产物。禁止把真实样本加进测试夹具。

## 第 2 步统一入口

```sh
node scripts/assets3d/build.mjs --units jinx,vi --source assets3d-local/trial/local --out assets3d-local/out
# 显式覆盖本工具已生成的文件；不会清空目录
node scripts/assets3d/build.mjs --units jinx,vi --source assets3d-local/trial/local --out assets3d-local/out --force
# 只生成离线下载计划
node scripts/assets3d/plan-fetch.mjs --source assets3d-local/trial/local --out assets3d-local/out --force
```

不联网、不启动子进程、不运行 lol2gltf 或任何外部转换二进制。使用 Node 内置 zstd（需要 Node 22.15+，本次实测 22.17.0）、zlib、TypeScript 的纯 JS 编译器及仓库已有的 three。
无需安装新依赖或执行 `npm ci`。`runtime.mjs` / `ts-loader.mjs` 直接加载本仓库 `assertManifest`、`parseParticleDocument` 与 `M5_UNIT_DEFINITIONS`，不复制合同校验规则。
转换的模型只接受 `jinx,vi`；下载计划总是枚举当前模拟层 60 个单位，费用分布为 14/13/13/12/8，不增加形态变体键。

输入布局（均只读）：

- `<source>/extracted/`：原始模型、骨骼、动作、贴图；`extraction.json` 提供版本、逐文件大小与 SHA256。实际使用的原始字节均核验哈希。
- `<source>/14.24.manifest`、`chunks/*.zst`、`set13-index.txt`、`tft-index.txt`、`hashes/hashes.game.txt`：RMAN、缓存的 WAD 索引压缩块、路径字典；不下载缺少的块。
- `<source>/../../source-json/{jinx,vi}.json`：完整粒子源 JSON；模型转换不读取旧 GLB 的内容。
- `<source>/../public-assets/{jinx,vi}/rigged.glb`：仅供独立对照。若 `<source>/validator/node_modules/gltf-validator/index.js` 存在则运行纯 JS 校验器。

输出全部经过 `safe-path.mjs`：`models/<id>/model.glb`、`textures/<原始相对路径>.png`、`effects/<id>/*.json` 和 `*.report.json`，以及根下 `manifest.json`、`build-report.json`、`fetch-plan.json`。旁路报告不进入 manifest。
manifest 只含 v1 合同字段，动画 clip 使用源名称，缺少受击动作时省略 `hit`。粒子贴图路径相对 `out/` 根。供接线方使用的 `actionEffects`、bbox、源哈希、字节数、误差和下载计划摘要均在 build-report。

坐标：反射 X、反转三角形绕序并同步变换骨骼/动作/逆绑定。原点使用 Body 绑定网格最低 Y 与 XZ 包围盒中心，保留道具子网格；金克丝火把可能伸到脚底以下，所以完整 bbox 的 minY 可以为负。
平移写入顶点、根骨骼和相应动画/逆绑定，GLB 根节点保持单位变换、尺寸保留 League 原生单位。贴图自包含 PNG，不使用 Draco、KTX2 或 Meshopt。

ANM v1 解码包含两种源标志对应的 Catmull-Rom 切线、16 位量化时间和源四元数端点符号规则；v5 解码向量/四元数池与逐帧索引。v1 按旧导出器的 Float32 时钟采样，最后一帧在源 duration 前一个帧间隔；报告同时保留源 duration 和 GLB 实际时长。
真实样本格式通过本地字节反推并数值验证，尚不宣称支持未遇到的 ANM 版本（明确报错）。

粒子只映射可证明等价的有限单粒子子集；连续发射、偏移、概率、向量尺寸、特殊生命周期或其它未映射语义导致整发射器拒绝。数值 blend 枚举未获本地独立证据，也拒绝而不猜值。
mesh、trail 和明确的 distortion 定义输出运行时已知的 opaque kind，计数跳过；不会把 ArbitraryQuad/Ray 伪装成 sprite。每个发射器的源字段、原因和状态完整保存在旁路报告。
本次真实样本没有可映射 sprite，因此粒子文档通过合同并不表示已还原可见技能特效。

下载计划流式读取完整本地哈希字典，避免把无 `.tft_set13` 后缀的简表哈希误作 WAD 实际路径。计划保守包含 TFTSet13/TFTCommon 两个 WAD 的全部条目，按单位自有路径与共享候选分组，并给出 bundle ID、压缩块偏移/大小、文件范围、去重总下载量及缺少缓存量。
逐英雄数字不含共享候选且彼此可能重叠，不能直接相加；最终下载预算使用全局去重块数。其余 58 名英雄缺少源 JSON，跨 WAD 传递依赖闭包尚未证明完整，计划明确记录该限制。

校验方式：

- GLB 本地结构校验，以及可用时的 Khronos JS validator（0 错误、0 警告才通过）。
- 对照旧 GLB 的顶点数、骨骼数/层级、源动作到旧别名的映射、时长；每段取首/中/末帧，比较所有皮肤骨骼世界平移与旋转。参考模型只应用声明的反射/原点平移，不拟合；容差固定为 0.5 游戏单位、0.5°。
- 对照全部唯一 POSITION 顶点在声明坐标变换下的误差，额外阈值 0.0001 游戏单位。
- 直接调用 TS 合同校验所有 45 份粒子文档与 manifest；合成测试用同一批样例交叉核对。
- `ready` 同时要求本地结构、对照及可用外部校验器通过。失败仍保留真实报告，并以非零状态结束。

本次结果与 60 名英雄下载明细见 [D7-STEP2-REPORT.md](D7-STEP2-REPORT.md)。浏览器本地入口示例：`?render=3d&assets3d=/assets3d-local/out/`，`prepared/` 仅作历史对照。

仅运行本步验收（Windows）：

```powershell
npx.cmd tsc --noEmit
Get-ChildItem tests/assets3d-*.test.ts | ForEach-Object { npx.cmd vitest run $_.FullName --configLoader runner; if ($LASTEXITCODE -ne 0) { throw "asset test failed" } }
```

## 第一阶段保留入口：整理已有试验成果

`prepare-existing.mjs` **只搬运/整理旧试验（lol2gltf）已生成的 GLB，不做原始 SKN/SKL/ANM 转换**。

```sh
node scripts/assets3d/prepare-existing.mjs --source assets3d-local/3d-trial --output assets3d-local/prepared
```

`--source` 必填，指向旧试验目录；`--output` 可选，默认 `assets3d-local/prepared`。
两个入口的相对输出路径均相对于仓库根目录解析，绝对输出路径也必须位于该仓库的
`assets3d-local/` 内。共享 `safeOutputPath` 在创建目录或写文件前逐层 realpath 检查，
拒绝任何 `..` 路径分量、绝对路径逃逸，以及指向边界外的符号链接或 Windows 目录联接
（包括 `assets3d-local/` 自身）。缺失的输出父目录会自动创建。
默认拒绝覆盖任何已有文件，包括本工具的旧产物；确认需要重跑覆盖时显式加 `--force`。
`--force` 不放宽路径边界，也不允许覆盖文件符号链接。
输入根目录 `assets3d-local/3d-trial/` 内采用 2026-10-18 试验的目录结构：

- `.local/extraction.json`：14.24.6442327 提取记录。
- `.local/extracted/assets/characters/tft13_jinx/`、`tft13_vi/`：对应记录中的原始文件。
- `public/assets/{jinx,vi}/rigged.glb`、`diffuse.png`：旧试验已生成的 GLB 和 PNG。

先逐个核对指定英雄原始文件的大小和 SHA256，再检查现代 SKL、SKN v4 和动画格式。
提取记录是本地来源记录，并非 Riot 签名，不能当作独立的发行方认证。
将 PNG 嵌入已有 GLB，所有原几何、骨骼、动画 buffer 字节、accessor、node、skin 与
animation 描述不变。新增的只是贴图数据及材质引用，避免 D8 读取时丢失外部漫反射图。
输出 `manifest.json` 与 PR #212 的 v1 模型契约兼容，额外 `files` 保存大小与哈希。
输出目录内包含 `models/{jinx,vi}/model.glb`、`manifest.json` 和 `preparation-report.json`。

这是**已有 GLB 整理入口**，不是已经实现原始 ANM 解码。当前不下载、不运行第三方
转换程序、不修改原试验目录。输出路径不能位于输入目录内部。
输入根目录的 realpath 是读取边界：`.local/extracted`、`.local/extraction.json` 与清单中
**每个条目**（含未选英雄）解析后的实际路径都必须位于输入根内；条目还须位于实际提取根内。
所选英雄的文件另核验大小和哈希；已有 GLB/PNG 的实际路径也必须位于输入根内。

## 当前可运行入口：粒子无损盘点

```sh
node scripts/assets3d/particle-inventory.mjs assets3d-local/particle-source/jinx.cdtb.bin.json assets3d-local/particle-inventory/jinx.json
```

两个位置参数依次为 CDTB 粒子源 JSON 和盘点输出 JSON；可加 `--force` 显式覆盖已有输出。
产物格式为 `d7-lossless-particle-inventory-v1`，明确标记 `renderable: false`，
保留源发射器参数并列出表达缺口，**不是 D8 可直接加载的特效定义**。

## 可复用基础模块

以下模块通过导出函数调用，没有独立命令行参数；调用方的文件输入输出也应放在 `assets3d-local/` 下。

- `glb.mjs`：GLB 块/范围检查、确定性写出、嵌入 PNG、统计。
- `inspect-source.mjs`：有界 SKN v4 / 现代 SKL 读取、ANM 格式识别；先核对文件长度再枚举。
- `verify-source.mjs`：提取清单与实际输入逐文件核验。
- `safe-path.mjs`：共享的输入 realpath 边界、`safeOutputPath` 及受限文件写入。
- `wad.mjs`：WAD 3.x 索引，以及未压缩/gzip/zstd 单条目解包；路径哈希由调用者显式传入。
  解压前限制输出大小，默认单条目 64 MiB，调用者可以明确设置其它预算。
  未压缩条目也在分配/复制输出前检查实际 payload 长度、声明大小与预算，不信任声明值。
  Node 22.15+ 与 Node 24 内置 zstd；更早的 Node 22 可为该底层工具注入可信解码器，未注入则明确报错。
  重定向及 subchunk 压缩暂明确拒绝，不将未支持的数据当原始文件输出。

## 已有整理与盘点结果的验证记录（2026-10-19）

以下为第一阶段历史验证记录，不能用它代替上方第 2 步的原始文件转换验收。

起点 `9c3c7a9319333d24e456a9c808e18d4afc47589e`，分支 `codex/assets3d-pipeline`。
用户明确允许把必要试验素材传到 dot 工作目录处理后返回本机；这不允许公开发布素材。

| 英雄 | 原始文件 | 原始字节 | 顶点 | 骨骼 | 原始动作 | 整理后动作 | GLB 字节 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 金克丝 | 80 | 2,510,639 | 5,163 | 89 | 19 | 5 | 2,223,468 |
| 蔚 | 26 | 2,298,922 | 4,247 | 72 | 9 | 5 | 2,100,520 |

两者动作名称均为 attack/cast/death/idle/move。整理产物通过
Khronos `gltf-validator@2.0.0-dev.3.10`：分别 0 error / 0 warning。
这验证了文件结构，不代替实际动画与画面验收。

合成单文件测试串行：`assets3d-glb` 5/5（246 ms），`assets3d-source` 6/6（221 ms），
`assets3d-wad` 7/7（198 ms）、`assets3d-particle-inventory` 4/4（191 ms），累计 22 项。
只运行新增文件及 typecheck，不跑全套。

同版本 CommunityDragon 源 JSON 的无损盘点：金克丝 34 系统/252 发射器，蔚 11 系统/47 发射器。
发射器数量不是最终渲染粒子数量。真实数据含位置、非等比尺寸、概率表、持续发射及特殊寿命等，
D8 v1 未完整支持，不能丢弃字段后宣称还原。这些源 JSON 与盘点输出仍只在忽略目录。

## 当前范围外的工作

上方第 2 步已实现 jinx/vi 的原始模型、动作、贴图转换、严格粒子文档/旁路报告、统一入口与离线下载计划；其余工作另行安排：

- 其余 58 英雄的实际获取、转换及独立对照。
- 在可证明语义等价的前提下扩展粒子合同与真实可见特效；v1 不支持的源发射器仍拒绝或跳过。
- 生产 WAD subchunk 解包、RMAN 网络定向获取，以及跨 WAD 传递依赖的精确下载预算（本步只做本地保守计划）。
- D8 浏览器接线、截图及视觉验收。

格式参考：[LTK SKN](https://wiki.leaguetoolkit.dev/reference/file-formats/skn/)、
[LTK SKL](https://wiki.leaguetoolkit.dev/reference/file-formats/skl/)、
[LTK ANM](https://wiki.leaguetoolkit.dev/reference/file-formats/anm/)、
[CommunityDragon WAD](https://www.communitydragon.org/docs/wad)。
旧试验脚本只作来源与接口参考，未执行它的 Windows EXE 安装流程。
