# 3D 素材离线压缩

实测日期：2026-10-20。使用本机已安装依赖，未联网、未安装依赖、未执行 Git 操作。输入联接仅用于读取，三个输出根均为新建真实目录。

## 用法

```powershell
node scripts/assets3d/compress.mjs --from assets3d-local/fx-all --out assets3d-local/fx-all-compressed
node scripts/assets3d/compress.mjs --from assets3d-local/fx-batch1 --out assets3d-local/fx-batch1-compressed
node scripts/assets3d/compress.mjs --from assets3d-local/fx-batch2 --out assets3d-local/fx-batch2-compressed
```

输出根必须不存在；已有空目录或联接也会拒绝，不能输出到输入树内。允许输入内部只读联接，检测目录循环。失败可能留下部分输出；不会覆写或自动删除，重试应选另一个新目录。

模型（GLB/glTF，含特效网格）使用 glTF Transform `resample()`、`meshopt({ level: 'medium' })`，输出 GLB，要求 `EXT_meshopt_compression`。模型内图片转 KTX2 ETC1S；按材质 `normalTexture` 引用识别法线并使用 UASTC。颜色槽按 sRGB 编码，法线和数据槽按线性编码。生成 mipmap，ETC1S qualityLevel=128、compressionLevel=2。

ktx2-encoder 的 Node 入口自动加载包内本地 Basis WASM，sharp 提供 RGBA 解码回调，无需下载或自定义 WASM 路径。

被特效文档引用的 PNG/JPEG 转 WebP（quality=90、alphaQuality=100），包含 distortion.normalMap，改写特效 JSON 和 manifest 相对路径。其他文件原样复制。遍历全部文件，含 units 副本；嵌套 manifest 也会处理。图片编码异常保留原图片和引用，compression-report.json 的 fallbacks 记录原因；模型变换或输出验证失败则终止。

precache.json 使用从 merge-manifests.mjs 导出的同一个 `createPrecache()` 函数生成。选择 manifest 模型、特效文档及文档内 texture、mesh、distortion.normalMap，去重、按路径排序，记录输出 bytes 和 SHA-256。manifest、报告、未引用的其他文件不进入运行时索引。

## 整个目录体积（精确字节）

目录总量包含 units、诊断文件、索引和其他副本，不是实际预下载量。后/前为保留比例。模型列为全部 GLB，含特效网格和副本；模型贴图内嵌于 GLB，是模型列子集，不能相加。特效贴图按不同路径去重统计被特效引用的外部图片。

| 输入根 | 总字节 前 → 后 | 全部 GLB 前 → 后 | 模型贴图 前 → 后 | 特效贴图 前 → 后 | 后/前 |
| --- | ---: | ---: | ---: | ---: | ---: |
| fx-all | 118,130,013 → 42,091,268 | 110,985,640 → 35,660,216 | 11,357,310 → 3,031,732 | 1,374,827 → 602,580 | 35.63% |
| fx-batch1 | 34,788,460 → 20,689,512 | 16,758,348 → 5,337,420 | 2,131,454 → 548,383 | 4,552,803 → 1,782,472 | 59.47% |
| fx-batch2 | 25,484,752 → 12,706,482 | 17,819,576 → 6,033,484 | 1,417,144 → 391,918 | 1,699,323 → 658,360 | 49.86% |

## 根 manifest 的角色模型

排除特效网格及 units 副本；平均数四舍五入到字节。最大、最小分别计算压缩前和压缩后的极值，不一定属于同一模型。

| 根 | 数量 | 模型合计 前 → 后 | 单模型平均 前 → 后 | 最小 前 → 后 | 最大 前 → 后 |
| --- | ---: | ---: | ---: | ---: | ---: |
| fx-all | 60 | 107,984,972 → 34,595,820 | 1,799,750 → 576,597 | 608,516 → 229,048 | 3,602,236 → 1,009,048 |
| fx-batch1 | 10 | 16,135,060 → 5,036,276 | 1,613,506 → 503,628 | 1,081,816 → 428,236 | 2,914,032 → 753,948 |
| fx-batch2 | 10 | 17,378,456 → 5,811,552 | 1,737,846 → 581,155 | 608,516 → 229,048 | 2,915,932 → 909,740 |

- fx-all：前后最小均为 amumu，最大均为 rell。
- fx-batch1：压缩前最小 ziggs、最大 caitlyn；压缩后最小 darius、最大 caitlyn。
- fx-batch2：压缩前最小 amumu、最大 irelia；压缩后最小 amumu、最大 morgana。

## 运行时资源与转换结果

| 根 | 根索引输出字节 | ETC1S 图片 | UASTC 图片 | WebP 图片 | 图片退回 |
| --- | ---: | ---: | ---: | ---: | ---: |
| fx-all | 35,757,462 | 86 | 0 | 109 | 0 |
| fx-batch1 | 7,932,540 | 11 | 0 | 276 | 0 |
| fx-batch2 | 7,016,053 | 14 | 0 | 126 | 0 |

真实输入模型没有 normalTexture 引用，因此 UASTC 为 0；合成测试独立验证 normalTexture 走 UASTC、颜色贴图走 ETC1S。三个根没有图片编码失败或保留原图的退回项。

## 验证

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run --configLoader runner --project fast tests/assets3d-compress.test.ts tests/assets3d-merge.test.ts tests/rendering3d-preload.test.ts tests/rendering3d-particle-readers.test.ts tests/rendering3d-particles.test.ts
```

- tsc 通过；上述 5 个测试文件共 74 项通过。
- 合成数据仅含程序生成三角形、等间距动画、16×16 PNG 和假名。验证模型可读回、meshopt required 扩展、动画重采样、KTX2 DFD 的 ETC1S/UASTC 类型、WebP 引用、坏图退回、精确 SHA-256、目录总量、输入联接和输出防覆盖。
- 独立重读真实输出全部 136 个 GLB（73/35/28），均成功且均带 EXT_meshopt_compression。
- 三个 precache 共 798 条（220/382/196），逐条大小和 SHA-256 均匹配磁盘输出；输入/输出整个目录总字节独立遍历核对。

## 已知限制

- 有损压缩：meshopt medium 包含量化，resample 删除冗余关键帧，ETC1S/WebP 改变像素。已验证结构、解码和引用，未做真人视觉验收或浏览器 GPU 画面对比。
- 部分网格 TEXCOORD_0 超出 [0,1]，转换器跳过该 UV 量化；部分网格提示 reorder 无可重排 primitive。继续压缩其他数据，这些是转换器提示，不是图片退回。
- 同一图同时用于法线和颜色槽时优先使用法线 UASTC/线性设置，不自动拆分材质贴图；真实模型未遇到这种情况。
- 保留原尺寸并生成 mipmap，小图的 KTX2 可能比原图大；不以单文件一定变小作为成功条件。
- 未被 manifest 特效引用的图片、原始提取数据和旧诊断报告作为其他文件原样保留。旧报告中的统计或文本路径不代表压缩结果，以新 manifest、precache 和 compression-report 为准。
- 两批次与 fx-all 存在素材重叠，三个根总量不能相加视为唯一发布包大小。输出尚未接到正式站点，未改界面或规则。
- 本机 PowerShell 禁止运行 npx.ps1，默认 Vitest bundle 配置加载受父目录读取权限限制；已使用直接 Node 入口和 --configLoader runner 完成测试。
- 压缩进度写 stderr，PowerShell 的重定向会包装为 NativeCommandError；报告 ready=true 且已独立全文件验证，进度日志不是失败列表。

输出目录：`assets3d-local/fx-all-compressed/`、`assets3d-local/fx-batch1-compressed/`、`assets3d-local/fx-batch2-compressed/`。各根的 compression-report.json 保存精确字节、逐个 GLB 大小、转换数量及退回原因。素材和运行日志仅留本机，不提交。
