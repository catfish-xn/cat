# 3D 渲染试验（S13 / 14.24）

独立试验页，只用于查看原版模型、动作、竞技场和特效。不会进入正式游戏构建或部署。
拳头的原始素材、glTF、贴图、截图和下载工具全部留在本地，不提交。

## Windows 重建

需要 Node 22+、Python 3.12 和联网。先安装试验页依赖：

```powershell
cd experiments/3d-trial
npm ci
./tools/prepare-windows.ps1 -Python '你的 python.exe 路径'
npm run dev
```

默认使用社区 [CDTB 1.3.0](https://github.com/CommunityDragon/CDTB) 解析
[Morilli 保存的 14.24.6442327 清单](https://github.com/Morilli/riot-manifests/blob/master/LoL/EUW1/windows/lol-game-client/14.24.6442327.txt)，
从 Riot CDN 通过 HTTP Range 只读取以下三个 WAD 中被使用的条目：

- `DATA/FINAL/TFTSet13.wad.client`：S13 专用金克丝、蔚的 SKN、SKL、ANM 和粒子 SCB。
- `DATA/FINAL/TFTCommon.wad.client`：共用材质依赖。
- `DATA/FINAL/Maps/Shipping/Map22.wad.client`：默认竞技场 `base` 的 MAPGEO、材质和贴图，以及粒子共用网格。

**不会下载完整客户端，也不会下载完整的 2.34 GB Map22 WAD。**
`.local/extraction.json` 记录来源、版本、各条目 SHA256、大小和缺失贴图。
`.local/chunks/` 可续用，重跑不重复下载已缓存分块。
默认竞技场被使用的几何和材质依赖已齐全；其他竞技场皮肤不在本次提取范围。

可选择只读本机已有客户端（版本由 `Game/content-metadata.json` 记录）：

```powershell
./tools/prepare-windows.ps1 -Python '你的 python.exe 路径' -GameDir 'C:\WeGameApps\英雄联盟（含经典模式）\Game'
```

本机客户端为 16.20.8248524，确有 S13 文件；本次实际成果采用远端精确 14.24，未混用本机版本。
本地模式须有上述三个 WAD；缺文件会报错。英雄贴图和 VFX JSON 仍固定来自 CDragon 14.24，
因此使用其他本地版本时需检查兼容性，不能把混合版本称为精确 14.24。

## 转换

| 脚本 | 用途 |
| --- | --- |
| `tools/prepare-windows.ps1` | 安装 CDTB、下载哈希表、校验并调用固定版 lol2gltf，串起全流程 |
| `tools/fetch-assets.mjs` | 原有 14.24 静态模型、英雄 PNG、VFX JSON 和 PNG 下载；保留程序动画基线 |
| `tools/extract-wad.py` | CDTB 解析 RMAN/WAD，限定三个包，提取英雄、竞技场和特效依赖；也支持本机 WAD |
| `tools/convert-assets.mjs` | SKN+SKL+五个 ANM → glTF；MAPGEO → glTF；SCB → glTF；写页面清单 |
| `tools/verify-trial.mjs` | Khronos glTF 校验、十段骨骼动作、独立蒙皮克隆、大招生命周期及浏览器错误检查 |
| `tools/screenshot.mjs` / `tools/compare-shots.mjs` | 截图和同镜头左右对比 |

英雄与地图使用 [lol2gltf 2025-02-28-d36a532](https://github.com/Crauzer/lol2gltf/releases/tag/2025-02-28-d36a532)。
EXE SHA256：`CD5DFE49E869FE7C6A1E44D3EE31534CBFC3FD5808FBA630019AA2128FEC45FF`。
SCB 读取器依据 [LeagueToolkit StaticMesh/StaticMeshFace](https://github.com/LeagueToolkit/LeagueToolkit/tree/main/src/LeagueToolkit/Core/Mesh) 格式编写，
保留顶点、面 UV、顶点/面颜色，转换坐标手性和三角形绕序。
lol2gltf 该发布版未导出这套地图材质的贴图，脚本从 CDTB 的 BIN 解析结果恢复漫反射映射，
PNG 使用 CDragon 同版本转换图。glTF 引用同目录下的 18 张 PNG，无需在线加载。

金克丝选择 `tft13_jinx_idle1`、`tft13_jinx_minigun_run`、`tft13_jinx_minigun_attack1`、
`tft13_jinx_spell_deathrocket`、`jinx_minigun_death`。
蔚选择 `vi_idle1`、`vi_run1`、`vi_attack1`、`vi_spell4_hit`、`vi_death`。
这些是五类动作的各一段原版 clip，未实现完整客户端动画图和所有技能变体。

## 页面和截图

默认播放原版骨骼动作；面板可切待机、移动、普攻、施法和死亡。
死亡停在原版末帧，点“待机”可恢复。动画实例使用独立骨骼克隆。
镜头使用云顶方向的 54° 俯角；Map22 按原坐标中心 `(2000,0,2000)` 对齐。
移动保留原版跑步动作，路径位移与技能发射时机仍由试验页驱动。

- `?animation=procedural`：同一竞技场和镜头，对比原有程序动画。
- `?board=procedural`：保留原来的自建棋盘。
- `?shot=idle|move|attack|cast|impact|death|board`：固定帧；`board` 为整体竞技场图。
- `&zoom`：近景；`&vfxScale=1`：原版特效尺寸（默认 0.6）；`&only=正则`：筛选发射器。

截图需 Playwright 和 Chromium/Chrome；脚本沿用原有等待与截图时限：

```powershell
$env:PLAYWRIGHT_PATH = 'playwright 包的绝对路径'
$env:CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node tools/screenshot.mjs shots/original idle,attack,cast,impact,death,board,move,ui
$env:EXTRA = '&animation=procedural'
node tools/screenshot.mjs shots/compare-procedural idle,attack,cast,death,move
Remove-Item Env:EXTRA
node tools/compare-shots.mjs
```

`shots/original/` 保存四类动作、移动、命中特效、整体棋盘和控件图。
`shots/compare-procedural/` 与之同镜头，`shots/comparison*.png` 为左右对比。
`shots/procedural/` 是本次接入前的旧页面截图。截图包含拳头素材，也不提交。

本地检查：

```powershell
npm run build
npm install --prefix .local/validator --no-save gltf-validator@2.0.0-dev.3.10
node tools/verify-trial.mjs
```

报告保存在 `.local/verification.json`；体积和交付边界见 `REPORT.md`。
尚未还原原版环境着色器、树木摆动、环境粒子、完整动画状态图和屏幕扭曲；
金克丝命中特效当前显示 45/47 发射器，其中 20 个为原版网格，跳过 2 个扭曲发射器。
