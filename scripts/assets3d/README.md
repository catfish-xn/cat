# D7 素材管线第一阶段

当前范围是**素材管线第一阶段：已有产物整理 + 源文件核验 + 粒子无损盘点**，不是完整转换。

本目录只放代码。输入、输出、manifest、截图与真实素材全部放在被 Git 忽略的
`assets3d-local/` 下，不提交素材或生成产物。禁止把真实样本加进测试夹具。

## 当前可运行入口：整理已有试验成果

`prepare-existing.mjs` **只搬运/整理旧试验（lol2gltf）已生成的 GLB，不做原始 SKN/SKL/ANM 转换**。

```sh
node scripts/assets3d/prepare-existing.mjs --source assets3d-local/3d-trial --output assets3d-local/prepared
```

`--source` 必填，指向旧试验目录；`--output` 可选，默认 `assets3d-local/prepared`。
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
转换程序、不修改原试验目录。输出路径不能位于输入目录内部。符号链接不能逃逸根目录。

## 当前可运行入口：粒子无损盘点

```sh
node scripts/assets3d/particle-inventory.mjs assets3d-local/particle-source/jinx.cdtb.bin.json assets3d-local/particle-inventory/jinx.json
```

两个位置参数依次为 CDTB 粒子源 JSON 和盘点输出 JSON；输出父目录须事先存在。
产物格式为 `d7-lossless-particle-inventory-v1`，明确标记 `renderable: false`，
保留源发射器参数并列出表达缺口，**不是 D8 可直接加载的特效定义**。

## 可复用基础模块

以下模块通过导出函数调用，没有独立命令行参数；调用方的文件输入输出也应放在 `assets3d-local/` 下。

- `glb.mjs`：GLB 块/范围检查、确定性写出、嵌入 PNG、统计。
- `inspect-source.mjs`：有界 SKN v4 / 现代 SKL 读取、ANM 格式识别；先核对文件长度再枚举。
- `verify-source.mjs`：提取清单与实际输入逐文件核验。
- `wad.mjs`：WAD 3.x 索引，以及未压缩/gzip/zstd 单条目解包；路径哈希由调用者显式传入。
  解压前限制输出大小，默认单条目 64 MiB，调用者可以明确设置其它预算。
  Node 24 内置 zstd；不提供内置 zstd 的 Node 22 可注入可信解码器，未注入则明确报错。
  重定向及 subchunk 压缩暂明确拒绝，不将未支持的数据当原始文件输出。

## 已有整理与盘点结果的验证记录（2026-10-19）

以下为此前验证记录，不代表本管线已实现原始文件转换，也不代表本次文档修改重新运行了这些检查。

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

## 转换（未实现）

以下全部未实现，由后续步骤补齐：

- **未实现**：原始 SKN+SKL+ANM（含 compressed v1 样条）→ GLB。
- **未实现**：TEX/DDS → PNG；当前整理入口复用旧试验已有 PNG。
- **未实现**：可渲染粒子 JSON（v1 合同）及 D8 真实兼容验证；无损盘点不能替代此转换，原版复杂粒子不能默默近似成简单粒子。
- **未实现**：其余 58 英雄定向获取、转换与统计。
- **未实现**：`build.mjs` 统一入口；当前仅有上述独立入口与基础模块。

## 其他待补工作

- 生产 WAD subchunk、RMAN 定向获取与下载预算清单。
- 浏览器截图及视觉验收。

格式参考：[LTK SKN](https://wiki.leaguetoolkit.dev/reference/file-formats/skn/)、
[LTK SKL](https://wiki.leaguetoolkit.dev/reference/file-formats/skl/)、
[LTK ANM](https://wiki.leaguetoolkit.dev/reference/file-formats/anm/)、
[CommunityDragon WAD](https://www.communitydragon.org/docs/wad)。
旧试验脚本只作来源与接口参考，未执行它的 Windows EXE 安装流程。
