# D7 素材管线

当前包括**第 2 步：Jinx/Vi 原始资源离线转换**和**第 3 步（a）：定向下载器与 60 单位批量构建代码**，后者用法和前置条件见文末。
第一阶段的整理、核验和盘点工具保留可用，历史说明见下方。

本目录只放代码。输入、输出、manifest、截图与真实素材全部放在被 Git 忽略的
`assets3d-local/` 下，不提交素材或生成产物。禁止把真实样本加进测试夹具。

## 当前：粒子 v2 第 2 段

`build.mjs` / `build-all.mjs` 现以校验过长度与 SHA-256 的 **PROP BIN** 为粒子主源，
不再要求每单位有 CDragon JSON。入口为皮肤 skin0/root、无扩展名的 `characters/<sourceName>`，
再递归跟随 linked 和字段内的 `.bin` 引用。只读 extraction 索引中的本地文件，
最多尝试 256 份文档、累计 64 MiB；缺文件、解析失败或超预算逐项记入 `particles.input.unresolved`。
本次 60 单位无需补解包，已有提取记录包含所有访问的链接。
`particle-bin.mjs` 复用 `bin.mjs`，`particle-names.json` 只含字段/类型名字，
按小写 FNV-1a 查找；未知字段与类型保留 `{xxxxxxxx}`，不猜名字、不丢字段。
源 JSON 只用于可选的逐字段对照，结果在 `particles.input.referenceComparison`；
比较覆盖全部系统/发射器字段，仅归一化 float32、矩阵分行、hash/link 名称和布尔/flag 表示。

`particles.mjs` 输出 `{schemaVersion:2,limits,emitters}`，manifest 仍为 v1。
每个候选及整份文档都调用经现有 ts-loader 加载的真实 `parseParticleDocument`。
候选不合法只记旁路；整份校验失败会撤回全部候选的 mapped 计数，不写文档、不登记 effects。
`--force` 会移除当前系统的旧粒子 payload，保留 `.report.json`。
旁路包含 `mapped:false/status/reason/originalFields`，同时保存系统字段及 `systemGaps`。

- 默认预算为 10000 个存活粒子、30 秒；有限效果按 delay + 发射持续时间 + 粒子寿命 + 尾寿命
  自动扩展时限，最多 3600 秒；超出合同或调用方明确收紧的时限则拒绝，不能静默截短有限效果。
  循环/无限效果必须有独立语义依据，且始终受总预算约束；本次真实数据未启用这类依据。
- 常量 rate 与正 emitter lifetime 映射 continuous；粒子寿命单独取 particleLifetime。
  单粒子默认 count=1；源 rate 不是 1 时，没有数量语义证据就拒绝。
- 支持 constantValue 位置、尺寸向量（含零轴）、度数出生旋转、显式均匀 min/max、
  常量速度/重力、等轴 drag、线性 color/alpha 和等轴 scale0 曲线、birthColor 相乘。
  位置/速度反射 X；XYZ Euler 的 Y/Z 角反号。动态出生值、概率表、非等轴随龄缩放仍拒绝。
- CameraQuad → quad。ArbitraryQuad、Ray、Camera/ArbitraryTrail 提供有 provenance 的
  `primitiveConventions` 接口，可表达已确认的 XY 平面、显式方向及完整 trail 参数；
  合成测试提供独立定义，**生产构建没有给真实 primitive 填任何臆测的轴/朝向/模式配置**。
  单凭源类型标签仍拒绝。AttachedMesh 的附着/骨骼语义、屏幕扭曲分别计数跳过。
- 数字 blendMode 不凭枚举编号猜混合方式；未知字段、bindWeight、particleLinger、源 erosion、
  子系统、系统 transform/flags/时序等均保留报告。多帧图集须有显式帧率。

静态网格由零依赖 `particle-mesh.mjs` 转换：支持 SCB 2.2/3.2 的无顶点色、三角形子集，
以及文本 SCO 的 Name/CentralPoint/Verts/Faces 子集；非零 pivot、顶点色、未知 flag/版本、
坏索引/UV/非有限数和无法完整消费的输入均明确拒绝。GLB 反射 X、反转绕序，保留逐角 UV，
不继承源材质。默认输入 16 MiB、100000 顶点/面、输出 32 MiB，分配前检查预算。
构建器预转换引用并记 `particles.meshes`；只有通过粒子合同且确实被引用的网格才写到 `meshes/`。
网格缺失/转换失败时整个发射器不写，原因进入旁路，模型/动作管线不作变更。

单位详细报告增加 `particles.systemCount/emitters/counts/byReason/reasonsByStatus/input/meshes`；
批量汇总使用 `particles.systems/emitters/mapped/skipped/rejected` 和 `particleTotals`。
`complete` 仅表示已知 BIN 链接全部读取，不代表源引擎语义或所有可见特效已覆盖。
actionEffects 仍只是基于原有 effectPatterns 的名称建议，只包含实际写出且校验通过的 effect。
实际执行数字、拒绝分组和模型回归证据见 [粒子 v2 验收记录](D7-PARTICLES-V2-REPORT.md)。

下文的 v1 粒子、依赖 source-json 或缺少其余 58 单位源的叙述为之前阶段记录；
当前粒子入口和覆盖边界以上述 v2 说明为准。

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
mesh、trail 和明确的 distortion 定义计数跳过，仅保留旁路报告，不输出 opaque kind 占位；不会把 ArbitraryQuad/Ray 伪装成 sprite。每个发射器的源字段、原因和状态完整保存在旁路报告。无可写发射器的系统不生成粒子 JSON，也不进入 manifest.effects，build-report 记录 `no-writable-emitters`；`--force` 重建会安全移除这些系统的旧载荷。
本次真实样本没有可映射 sprite，因此粒子文档通过合同并不表示已还原可见技能特效。

下载计划流式读取完整本地哈希字典，避免把无 `.tft_set13` 后缀的简表哈希误作 WAD 实际路径。计划保守包含 TFTSet13/TFTCommon 两个 WAD 的全部条目，按单位自有路径与共享候选分组，并给出 bundle ID、压缩块偏移/大小、文件范围、去重总下载量及缺少缓存量。
逐英雄数字不含共享候选且彼此可能重叠，不能直接相加；最终下载预算使用全局去重块数。其余 58 名英雄缺少源 JSON，跨 WAD 传递依赖闭包尚未证明完整，计划明确记录该限制。

校验方式：

- GLB 本地结构校验，以及可用时的 Khronos JS validator（0 错误、0 警告才通过）。
- 对照旧 GLB 的顶点数、骨骼数/层级、源动作到旧别名的映射、时长；每段取首/中/末帧，比较所有皮肤骨骼世界平移与旋转。参考模型只应用声明的反射/原点平移，不拟合；容差固定为 0.5 游戏单位、0.5°。
- 对照全部唯一 POSITION 顶点在声明坐标变换下的误差，额外阈值 0.0001 游戏单位。
- 直接调用 TS 合同校验可写粒子文档与 manifest；当前 45 个源系统均只生成旁路报告，粒子文档与 manifest.effects 数量为 0；合成测试覆盖可写文档并用同一批样例交叉核对。
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

## 第 2 步交付时保留的后续工作

上方第 2 步已实现 jinx/vi 的原始模型、动作、贴图转换、严格粒子文档/旁路报告、统一入口与离线下载计划；其余工作另行安排：

- 其余 58 英雄的实际获取、转换及独立对照。
- 在可证明语义等价的前提下扩展粒子合同与真实可见特效；v1 不支持的源发射器仍拒绝或跳过。
- 跨 WAD 传递依赖的精确下载预算及全量生产验收；RMAN 下载器和离线 WAD subchunk 解包器见下述第 3 步（a）/（c），实际下载与全量运行交由调度方执行。
- D8 浏览器接线、截图及视觉验收。

格式参考：[LTK SKN](https://wiki.leaguetoolkit.dev/reference/file-formats/skn/)、
[LTK SKL](https://wiki.leaguetoolkit.dev/reference/file-formats/skl/)、
[LTK ANM](https://wiki.leaguetoolkit.dev/reference/file-formats/anm/)、
[CommunityDragon WAD](https://www.communitydragon.org/docs/wad)。
旧试验脚本只作来源与接口参考，未执行它的 Windows EXE 安装流程。
## D7 第 3 步（a）：定向下载与批量构建

下载器只读取本地 plan 和 RMAN，不下载 manifest，不执行旧 Python 工具或任何外部转换程序。需要带内置 `zstdDecompressSync` 的 Node（本次离线验证为 22.17.0），沿用现有依赖，不执行 `npm ci`。

```powershell
# 离线预检；不请求网络、不写报告、不改缓存，逐块验证已有缓存
node scripts/assets3d/fetch-chunks.mjs --dry-run

# 交给调度方在沙箱外执行的实际下载命令
node scripts/assets3d/fetch-chunks.mjs --max-bytes 125829120 --concurrency 4

# 有效缓存自动跳过；重复运行同一命令即可续传
```

默认输入是 `assets3d-local/out/fetch-plan.json` 和 `assets3d-local/trial/local/14.24.manifest`，缓存写到 `assets3d-local/trial/local/chunks/<大写16位ID>.zst`。可以用 `--plan`、`--manifest`、`--cache`、`--out` 指定本地路径，但全部写入仍必须通过 `safe-path.mjs`，限于仓库的 `assets3d-local/`；符号链接、目录联接和 `..` 不能绕过边界。实际运行覆盖 `out/fetch-report.json`，dry-run 仅向 stdout 打印汇总。

下载边界：

- plan 的 manifest SHA-256 必须与本地文件一致；块必须存在于 manifest，ID、bundle、偏移及两种长度必须匹配。只下载 `plan.chunks`，不遍历下载其他 bundle 内容。
- URL 仅由 manifest 的 bundle ID 构造，固定 HTTPS 主机 `lol.secure.dyn.riotcdn.net`、固定 bundle 路径；禁止重定向、其他主机、凭证、端口和查询参数。注入的 fetch 同样受到地址检查。
- 同 bundle 内相邻的缺失块合并为一个 Range，最大 16 MiB；不夹带间隙。响应必须是 206，Content-Range 和实际长度必须精确匹配。
- 默认并发 4（可设 1–16）；单次请求含流式读 body 超时 45 秒；默认额外重试 2 次，上限 5。`--timeout-ms`、`--retries`、`--backoff-ms` 可调整。网络异常、429、5xx、短响应采用指数退避；块校验、重定向及协议错误不盲目重试。
- `--max-bytes` 默认 125,829,120（120 MiB），预检按去重且缓存验证失败/缺失的压缩块长度计算，超限时请求数为零。运行中计入失败响应和重试的实际已读取 body 字节；超过硬上限即 abort 所有请求，停止派发。报告可能包含触发停止的最后一个网络片段造成的超出量；它记录收到的实际值，不把计数截成上限。该上限不计 TLS/HTTP 头等传输开销。
- 每块检查压缩长度、解压长度及 manifest 的块 ID，校验后才写临时文件并 rename。14.24 的 Riot 派生哈希实现参考 [rman 的块校验实现](https://github.com/moonshadow565/rman/blob/master/lib/rlib/rchunk.cpp)，用 Node crypto 实现，也支持 SHA-256/SHA-512 的前 8 字节小端 ID；未知方案严格失败，不降为仅校验长度。现有缓存也做同样校验，损坏缓存实跑时丢弃并重新获取，dry-run 只报告。
- 报告包含 requests、downloadBytes、skipped、invalidCache、downloaded、failed（逐块原因）、elapsedMs 及 WAD/英雄汇总。正常完成退出 0，预检拒绝或部分失败退出 1。配置/输入文件非法会直接退出 1 并输出原因；此时不会覆盖上次下载报告。进程被强制终止时，已经 rename 的有效块仍可续传，临时文件不会当作有效缓存。

网络层 API 为 `fetchChunks({ plan, manifest, fetchFn, ...options })`，其中 `manifest` 是 `readRman()` 的结果，`fetchFn(url, RequestInit)` 返回 WHATWG Response（必须提供可流式读取的 body）。文件入口 `fetchFromFiles()` 额外执行 manifest SHA-256 固定检查。测试只注入假 fetch 和合成压缩块。

本次真实 plan 的离线结果：全局待下载 **6,107 块 / 75,636,001 字节**；TFTSet13 **5,460 块 / 67,051,523 字节**；TFTCommon **720 块 / 9,024,106 字节**。每个 WAD/英雄内部去重，跨 WAD/英雄可共享块，不能把分项相加当成总下载量。

批量构建使用独立入口，每个单位写自己的目录，失败不阻断下一单位：

```powershell
node scripts/assets3d/build-all.mjs --units all --cost 1,2 --out assets3d-local/out/batch-cost12
node scripts/assets3d/build-all.mjs --units all --cost 3,4,5 --out assets3d-local/out/batch-cost345
# 重建已有输出时追加 --force；也支持 --units jinx,vi 和 --source <本地目录>
```

`all` 严格取 `src/simulation/units.ts` 的 `M5_UNIT_DEFINITIONS` 60 个键；按费用再按 ID 排序，1–2 费 27 个、3–5 费 33 个。各批次顶层 `build-report.json` 逐单位记录 status/reason、顶点、骨骼、转换的动作原名、已确认动作绑定及缺失动作、成功贴图数、材质贴图绑定数、粒子 mapped/skipped/rejected、产物总字节（含单位报告及 sidecar）。失败而未取得的指标为 null；缺少源 JSON 时粒子计数为 null 并附原因，不声称已完成粒子转换。报告随单位完成更新；顶层 phase 完成不等于全部成功，ready 仅表示所选单位的转换和结构检查均通过。单个单位失败或 missing 时最终退出 1，其他单位仍继续构建。

每个单位的产物位于 `units/<id>/`，包含自己的 manifest 和详细报告；读取该 manifest 时，以该单位目录为 asset root。批次汇总不是合并运行时 manifest。本步不改表现层或自动发布资源。

**构建前置条件和目前覆盖范围：**

- 缓存下载不会自动生成 `source/extracted/` 和 `source/extraction.json`；下载后须执行下述第 3 步（c）解包器。批量构建直接使用它生成/合并的原始资源及 SHA-256 提取记录，无须改接口。缺少这些输入会逐单位报告失败，不能据此声称已完成真实 60 英雄构建。
- `unit-map.json` 仅有名字、路径及绑定规则，无素材。资源名、模型/骨架路径和动作文件目录均从已有 fetch-plan 的实际 `entries.path` 推导；特殊代号沿用已有对应关系。60/60 单位资源映射成功，missing 列表为空。Corki 的 mesh/skeleton 分别是 `tft13_corkifixedskin` / `tft13_corkifixedskeleton`，Illaoi 的 mesh 使用 `_13` 后缀；不套用臆测的文件名。找不到配置或显式 missing 的单位进入报告的 mapping.missing，不调用构建器。
- 其余 58 单位的材质与运行时动作绑定尚无确认依据，配置保持空，不凭文件名猜测材质或把任意 spell 绑定成 cast。原始动作目录已列出，batch 模式尝试按原名转换全部列出的 ANM；未确认的动作按 idle/move/attack/cast/hit/death 六项报告缺失。严格模型转换仍拒绝 `missing-material-texture:<材质>`，需要后续源材料信息补齐绑定；仅下载缓存不会消除这类失败。
- Jinx/Vi 保留第 2 步确认的贴图和动作绑定。普通 `build.mjs` 的双单位入口保留独立参考对照和离线 fetch-plan 行为；batch 模式不为每个单位重复生成 fetch-plan，没有独立参考 GLB 时明确报告 unavailable，结构检查仍执行。有参考时照常比较。缺少源 JSON 的单位明确报告粒子不可用，不伪造效果或动作语义。

验证命令（不用完整游戏回归）：

```powershell
npx.cmd tsc --noEmit
# 逐个执行各 tests/assets3d-*.test.ts；runner 避免调用 esbuild 配置加载程序
npx.cmd vitest run tests/assets3d-fetch.test.ts --configLoader runner --project fast
npx.cmd vitest run tests/assets3d-batch.test.ts --configLoader runner --project fast
node scripts/assets3d/fetch-chunks.mjs --dry-run
```

## D7 第 3 步（c）：从本地缓存解包 WAD 条目

`extract-from-chunks.mjs` 只读本地 manifest、fetch-plan 和压缩块；不联网、不调用 Python、exe 或外部转换器。默认 source 为 `assets3d-local/trial/local`，plan 为 `assets3d-local/out/fetch-plan.json`，报告为 `assets3d-local/out/extract-report.json`。所有写入经过 `safe-path.mjs`，限于仓库内的 `assets3d-local/`，条目路径另行拒绝越界、Windows 特殊路径与链接逃逸。

调度方下载完成后运行（同一 source 的批次须顺序执行，避免 extraction.json 并发合并覆盖）：

```powershell
# 小范围回归：即使已有文件哈希正确，也从缓存重新解码并比对既有记录，不重写一致文件
node scripts/assets3d/extract-from-chunks.mjs --units jinx,vi --verify-existing

# 与 build-all 相同的两批费用过滤；每批报告使用不同 out，保留独立证据
node scripts/assets3d/extract-from-chunks.mjs --units all --cost 1,2 --out assets3d-local/out/extract-cost12
node scripts/assets3d/build-all.mjs --units all --cost 1,2 --out assets3d-local/out/batch-cost12
node scripts/assets3d/extract-from-chunks.mjs --units all --cost 3,4,5 --out assets3d-local/out/extract-cost345
node scripts/assets3d/build-all.mjs --units all --cost 3,4,5 --out assets3d-local/out/batch-cost345

# 不过滤时另含 plan.wads 中保守的共享候选条目（未解析路径会明确失败）
# node scripts/assets3d/extract-from-chunks.mjs
```

`--units`、`--cost` 直接复用 build-all 的选择与排序函数，可叠加取交集；费用为 1–5 的逗号列表，单位为 plan 中的 ID 或 `all`。还支持 `--source <目录>`、`--plan <文件>`、`--out <报告目录>`。重复运行自动跳过已存在且与提取记录 SHA-256/长度一致的条目，无须 `--force`；`--verify-existing` 强制重解码后再比对，适合生产回归。已有文件与记录或新解包结果冲突时严格失败，不覆盖。缺失的文件可从缓存恢复，但必须符合已有记录哈希。进程中断后可重跑；原始文件和记录分别原子写入，中断期间可能留下未登记但完整的原始文件，重跑时比对后补登记。

校验顺序与格式：

- 入口验证 plan 的 manifest SHA-256；WAD 元数据从 RMAN 缓存重读索引，plan 的 hash、偏移、压缩/原始长度、类型和 subchunk 索引须完全匹配。块 ID 由 manifest 提供；每次读块验证压缩长度、解压长度和 `verifyChunk()` 的内容哈希，不因曾下载过而信任损坏缓存。
- 继续使用 `readCachedRange()`，保留单块解压 16 MiB、每个范围全部涉及块解压累计 64 MiB 的预检上限。WAD 单条输出最多 64 MiB，解码器另按声明长度限额。不会拼出整个 WAD 或缓存所有解压后的块。
- 支持 type 0 原始、type 1 gzip、type 3 zstd、type 4 subchunk 链。type 4 从同 WAD 的 `.subchunktoc` 读取 `<压缩长度 u32, 原始长度 u32, 压缩字节 XXH3-64 u64>`；先核对整链范围和两种总长度，再逐段检查 XXH3、按等长原始段/不等长 zstd 段解包、检查逐段和最终长度。XXH3 用纯 JS/BigInt，无原生扩展。3.0–3.3 的 duplicate 字节不作为索引高位，3.4 才组合高 8 位；type 2 重定向明确失败，不暗中跟随或复制。
- 格式依据为仓库原有 [CommunityDragon WAD 规范](https://www.communitydragon.org/docs/wad)，离线对照 `trial/tools/extract-wad.py` 和其本地 CDTB `wad.py` 源码；未请求这些链接或执行 Python。TOC 缺失或损坏时不尝试降级猜测解压。
- 写入 `<source>/extracted/<path>` 和 `<source>/extraction.json`。与已有 Jinx/Vi 完全同格式：`version: "14.24.6442327"`，`files: [{wad, path, bytes, sha256}]`；长度字段是 **bytes**，并非另造 `size` 字段。保留现有顶层元数据、文件记录及其全部字段，只追加成功的新路径。既有记录是不可替换的哈希基准；校验失败的条目不新增记录。未影响的已有记录保留，不代表本次重新验证了它们。

报告的 `units.<id>`、`shared` 含 entries/success/written/skipped/failed、成功原始字节 bytes、新写入字节 writtenBytes，以及每条的 wad/hash/path/status/reason/bytes/sha256。单位可能共享依赖，`totals` 对条目去重，不等于分项相加。无过滤的全量模式才处理剩余共享候选；分批仍自动读取各条目的同 WAD TOC，单位 entries 中已规划的跨 WAD 直接依赖照常处理。它不会发现尚未进入 plan 的传递依赖。

`missingChunks` 为本次尝试范围的全局去重缺块列表，含 manifest 的 bundleId/offset/size/targetSize 及 requiredBy 的 WAD/条目路径或 index/subchunk-toc。它包含索引和 TOC 隐式依赖，也包含不在 plan.chunks 中的实际 manifest 块；不会仅因下载计划说齐全就忽略缺块。缺块、校验或解包失败逐条记录并继续其他条目；成功退出 0，部分失败退出 1。非法参数、manifest 不符或既有记录格式非法属于入口失败，直接退出 1，不覆盖旧报告。缺块证据仅覆盖本次选中并实际尝试的范围；不能据此声称未选中的 WAD 或未知传递依赖完整。

合成测试新增 `tests/assets3d-extract.test.ts`，覆盖四种编码、多段 subchunk、跨块索引/条目拼接、哈希、合并保留、重复跳过、缺块/TOC 报告、逐条失败和路径拒绝；batch 测试先从合成缓存解包，再直接调用真实 build-all 管线。原有材质绑定、动作语义、源 JSON 与独立参考限制仍如上，不由本步骤补齐。

本次交付检查时尚无 `out/fetch-report.json`，未执行完整 Jinx/Vi 写入回归或 60 单位全量运行。现有缓存只读抽查中，Jinx/Vi 的 121 个 type 4 条目通过 TOC 段哈希与解包长度检查，其中 39 个可与既有提取记录对照的 SHA-256 全部一致；另 32 个条目因缺块未验证。这项抽查不等于完整单位回归，下载完成后仍应执行上面的 `--units jinx,vi --verify-existing`。

## D7 第 3 步（d）：PROP 材质与动作绑定

实现和验收结果见 [D7-STEP3D-REPORT.md](D7-STEP3D-REPORT.md)。两批为 27/27、33/33 成功。成功表示转换和结构检查通过；动作缺项及材质近似仍单独报告。

### 输入和离线准备

除 SKN/SKL/.anm/.tex/.dds 外，还须读取以下 PROP 条目，均按 extraction.json 的长度和 SHA-256 验证：

- data/characters/<sourceName>/skins/skin0.bin，存在时还读取 skins/root.bin。
- **characters/<sourceName>**：没有扩展名，但也是 PROP；StaticMaterialDef 通常在此，不能只按 .bin 后缀收集。
- 皮肤链接的 animations/skin*.bin，按 AnimationGraphData link 找图，不固定 skin0（Amumu 使用 skin1）。
- bin 引用的共享贴图及动画，可跨单位和目录。

已有缓存时，下列操作只读本地。先按新计划提取角色主 PROP，再做第二轮计划，从已提取 bin 补充直接共享依赖：

~~~powershell
node scripts/assets3d/plan-fetch.mjs --out assets3d-local/out/bin-plan --force
node scripts/assets3d/extract-from-chunks.mjs --plan assets3d-local/out/bin-plan/fetch-plan.json --units all --cost 1,2,3,4,5 --out assets3d-local/out/bin-extract
node scripts/assets3d/plan-fetch.mjs --out assets3d-local/out/bin-plan --force
node scripts/assets3d/extract-from-chunks.mjs --plan assets3d-local/out/bin-plan/fetch-plan.json --units all --cost 1,2,3,4,5 --out assets3d-local/out/bin-extract
node scripts/assets3d/build-all.mjs --units all --cost 1,2 --out assets3d-local/out/batch-cost12 --force
node scripts/assets3d/build-all.mjs --units all --cost 3,4,5 --out assets3d-local/out/batch-cost345 --force
~~~

未缓存依赖仍报告 missingChunks，不自动下载。第二轮只解析已存在的 bin，列出 unresolvedReferences，不宣称完整传递闭包。

### 解析 API 与预算

bin.mjs 是纯 Node、零依赖模块：

~~~js
parseBin(buffer, { maxBytes, maxDepth, maxValues, maxCount, maxStringBytes })
// => { version, patch, linked, entries: [{ hash, type, fields }], patches }
// fields: [{ hash, type, value }]
binField(object, 'skinMeshProperties')
binIs(object, 'StaticMaterialDef')
fnv1a('mAnimationFilePath')
~~~

默认预算：文件 32 MiB、深度 64、总 value 1,000,000、单个计数 100,000、累计字符串 4 MiB。所有 length 块限制子边界并检查精确消费，计数在分配前检查。支持 14.24 的 PROP v1–3 和 PTCH(1,0) 包装、patch records。支持类型 0–18 和 0x80–0x87：整数（64 位为 bigint）、布尔、float/vector/matrix、RGBA、严格 UTF-8 字符串、hash/link、64 位 WAD path hash、list/list2、pointer/embed、option/map、flag。

未知类型/版本、截断、尾随字节、非法 option/bool、非有限数及超预算均明确失败。字段与类查询用小写 FNV-1a；只需源码中的少量字段名，不要求外部字典。未知字段和类保留原 hash，不猜名字，也不跳过未知类型。hash/link 为 {kind, hash}，map 为 {keyType, valueType, entries}，NULL pointer 为 null。PTCH 保留 patch 数据，但绑定器拒绝尚未应用的 patch，避免静默忽略。类型编号针对 14.24，不做旧补丁时期 enum 重编号兼容。

### 材质和隐藏部件

skinBindings(documents, submeshNames) 返回 mesh/skeleton、textures、solidMaterials、hidden、animationGraphHash。按 skinMeshProperties 主 Material/texture 及 materialOverride 绑定。Material 从文档组解析 StaticMaterialDef，按 Diffuse_Texture/DiffuseTexture、basecolor/albedo sampler 优先级选贴图。未知材质不自动用白图兜底。

initialSubmeshToHide 对应 primitive 不输出，隐藏部件贴图不构成构建依赖，源顶点缓冲仍保留。没有漫反射 sampler、但有 Glass_Color1 的程序化玻璃使用源色近似，并明确标注 solidMaterials.reason；不声称还原 shader、透明度和动态驱动。

旧 jinx/vi textures 表只作 step2Mapping 对照。Jinx 两项路径一致；Vi 初始 TierUpgrade 用 base 贴图，旧表的 skin0 贴图属于 RebelStatus，报告保留 matches:false。当前构建候选以 bin 初始状态为准；若要强制旧外观，需要显式兼容政策。完整哈希和差异见验收记录。

### 动作和报告

unit-map.json 包含保留键 `$animationRules`，其余键是 60 个领域单位。animationClips(documents) 从 mClipDataMap 读取 clip key hash、类 hash、mFlags 和 mAnimationResourceData.mAnimationFilePath。selectAnimations(clips, rules, explicit) 返回 mapped/files/decisions；显式单位覆盖优先，随后按公共图别名、文件名 token 优先级匹配。同优先级若有多个不同文件则省略，不把序列或 selector 当作 AtomicClipData。原 jinx/vi 五段选择保留；新增 Draven 的显式 cast 覆盖及 animationNotes 依据，不在代码中分支判断英雄。

批量和单体导出相同的选定动作集，manifest 与 GLB 一致。汇总报告 animations.missing/actionDecisions 解释缺项；每单位还保留 graphClips、bindings、step2Mapping、normalRepair、omittedUnboundTracks、bindPoseLocatorHashes。cast/hit 缺项不冒充其他动作，也不构成结构转换失败。粒子沿用现有转换实现，本轮不改粒子语义。

真实数据兼容包括 uncompressed ANM v4、零权重 JOINTS 清零和零法线修复。源 ANM 额外骨轨道只在不属于当前 rig 时省略；hash 碰撞只允许无权重叶定位骨保留 bind pose，涉及变形骨或有子节点则失败。详细单位和限制见验收记录。

## 动作覆盖补齐与正式合并清单（2026-10-20）

源图完整附录见 [ANIMATION-SOURCE-APPENDIX.md](ANIMATION-SOURCE-APPENDIX.md)，本轮结果及运行限制见 [ANIMATION-COVERAGE-REPORT.md](ANIMATION-COVERAGE-REPORT.md)。只读重查命令：

```powershell
node scripts/assets3d/audit-animations.mjs --markdown
# 不加 --markdown 输出机器可读 JSON（before/after、每单位映射、决定、源哈希、全部 clips）。
```

`tokens` 和 `excludeTokens` 为不区分大小写的正则片段，外部自动加下划线/首尾边界；片段末尾 `$` 表示完整动作后缀。cast 优先完整 spell/spell1、施法进入/开始/intro/activate/first 段，再到有编号 spell、spell_3、spellup、brace、cast/ability/channel/ult 命名，最后保留旧通用匹配。编号进入/activate 按 1、无编号、2、3、4 排序。out/toidle/idle/run/loop/end/finish 被排除，防止拿技能退出或持续姿势当起手。通用规则只选择单段展示候选，不重建多段技能或切换形态。

hit 接受 hit/hurt/flinch/knockup；排除攻击/施法命中段和 death/die。排除规则对图别名、文件名、显式覆盖均生效。真实数据中 57 个 Knockup 图键引用 Death ANM，所以不能计入 hit 覆盖。无映射时保留原 reason，并增加 `sourceStatus: no-source-action | undetermined`（源图无对应动作 / 无法判定）；存在非 Atomic 动作图键或仅有持续姿势时不误报源数据不存在。此结论限于当前绑定皮肤图的可识别动作，不断言其他皮肤或整个游戏不存在对应动画。PROP 键是 hash，未知名字仍标未知。

新结果必须使用独立根目录，保护其他任务使用的原 batch 和 all：

```powershell
node scripts/assets3d/build-all.mjs --units all --cost 1,2 --out assets3d-local/out-anim/batch-cost12 --force
node scripts/assets3d/build-all.mjs --units all --cost 3,4,5 --out assets3d-local/out-anim/batch-cost345 --force
node scripts/assets3d/verify-animation-rebuild.mjs
node scripts/assets3d/merge-manifests.mjs --from assets3d-local/out-anim/batch-cost12 assets3d-local/out-anim/batch-cost345 --out assets3d-local/all-anim/
```

`verify-animation-rebuild.mjs` 只读比较两对默认 batch：全部非动画 JSON、非动画 bufferView 的 SHA-256（包括网格、骨骼、嵌入图片）以及旧动画完整 sampler/channel 数据；动作映射未变的单位还必须整份 GLB 字节相同。Jinx/Vi 属于整份相同检查范围。输出逐单位哈希与比较结果，失败退出 1，不写源目录。

`merge-manifests.mjs` 正式替代手工 `node -e` 合并。`--from` 可给多个 batch 根，也可重复该参数；`--out` 必填。它读取各根下 `units/<id>/manifest.json`，保留 `schemaVersion`、模型的动作映射和 `effects`，将 `models/<id>/model.glb`、特效 JSON，以及特效引用的 texture/mesh/distortion.normalMap 按原相对路径复制到新根；GLB 内嵌贴图无需额外复制。v1/v2 特效均经运行时 parser 校验。

所有写入通过 safe-path，限定在实际仓库的 `assets3d-local/`；输入和引用路径拒绝 `..`、绝对/URL/编码路径及链接逃逸，输出不能与输入 batch 重叠。模型/effect ID 冲突报错；不同内容占用同一相对路径也报错。相同内容的共享依赖合并一份。重跑 SHA-256 一致则跳过（不改 payload mtime）；已有输出内容不同则拒绝覆盖，应选另一个新根或人工处理冲突。复制前先检查整批输入和目标；缺文件时只写 `ready:false` 的合并报告，不发布部分 manifest。

新根包含 `manifest.json` 和 `merge-report.json`。报告 `models/effects` 是清单计数，`modelBytes` 是 GLB 总字节，`bytes/files` 是去重后的运行时文件总字节/数量（不含 manifest/report），`manifestBytes` 单列；`written/skipped/writtenBytes/missing` 说明本次复制、跳过和缺项。全部成功退出 0，缺项或冲突退出 1。

**当前 LF clone 的 assets3d-local 是指向兄弟工作区的联接，safe-path 会主动拒绝写入，单纯在沙箱外重试同一 clone 仍会拒绝。** 调度方须在实际持有非联接 assets3d-local 的 `../assets3d` 仓库运行本轮更新后的脚本（先同步脚本与 unit-map）；不要放宽 safe-path、改链接或覆盖原 batch/all。本轮在隔离副本完成的构建/合并不代表共享目标已发布。

调度方生成共享 `all-anim` 后，已有开发服务器查看地址参数为：

```text
?render=3d&assets3d=/assets3d-local/all-anim/
```

现有 `src/rendering3d/animation-state.ts` 已消费 packetDamage → hit，无需修改。若要改多形态技能选择或外壳切换流程，由 Claude 接 `src/rendering/`；本轮没有外壳改动。
