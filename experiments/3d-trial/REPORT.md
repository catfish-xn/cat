# Windows 原版动作与竞技场试验回报

日期：2026-10-18。PR #186，分支 `claude/3d-render-trial-uanx6d`。
施工起点 `976ef9652094e07cdfddb1a6f0ae66a4f159df1c`。仅修改 `experiments/3d-trial/`。

## 素材是否取得

| 类别 | 结果 | 来源与版本 |
| --- | --- | --- |
| 金克丝 | 已取得 S13 专用 SKN、1 个 SKL、19 个 ANM；转入页面的五段动画均已验证 | Riot CDN，`TFTSet13.wad.client`，14.24.6442327 |
| 蔚 | 已取得 S13 专用 SKN、1 个 SKL、9 个 ANM；转入页面的五段动画均已验证 | 同上 |
| 云顶竞技场 | 已取得 Map22 默认 `base.mapgeo`、材质 BIN 和其引用的全部贴图依赖；无缺失贴图 | Riot CDN，`Map22.wad.client` / `TFTCommon.wad.client`，14.24.6442327 |
| 金克丝大招网格 | 已取得并转换定义所引用的 12 个不同 SCB，包括冲击波、圆顶、边界环、眼睛、HAHA 和火箭 | 同版本 TFTSet13 / Map22 WAD；命中特效启用 20 个网格发射器 |
| 英雄贴图、VFX JSON、PNG | 已取得，保留旧脚本获取路径；竞技场漫反射 PNG 也是同版本 | CommunityDragon 14.24 |

本机客户端目录：`C:\WeGameApps\英雄联盟（含经典模式）\Game`，
`content-metadata.json` 为 `16.20.8248524+branch.releases-16-20.content.release`。
本机也有 S13 文件，但本次实际产物没有使用该版本。
Windows 可访问 Riot CDN，因此改用精确 14.24 清单：
`7FD7567DC15565C6.manifest`，由 [Morilli 的版本档案](https://github.com/Morilli/riot-manifests/blob/master/LoL/EUW1/windows/lol-game-client/14.24.6442327.txt) 定位。

**提取的是所需 WAD 条目，没有取得完整 Map22 WAD 归档。**
通过 CDTB 的 RMAN 解析和 HTTP Range，只下载所需压缩块。
173 个原始条目：TFTSet13 103 个、Map22 68 个、TFTCommon 2 个。
`.local/extraction.json` 保留每个条目的路径、字节数和 SHA256；没有素材获取失败项。

## 转换和页面

- [Windows 总入口](tools/prepare-windows.ps1)：CDTB 1.3.0 + 固定版本 lol2gltf，并校验 EXE SHA256。
- [定向提取](tools/extract-wad.py)：支持精确 14.24 RMAN 或只读本机 WAD。
- [转换脚本](tools/convert-assets.mjs)：lol2gltf `2025-02-28-d36a532` 转英雄与地图；按 LeagueToolkit 格式读取 SCB 并写 glTF。
- 金克丝 89 根骨骼、蔚 72 根骨骼；各有 idle / move / attack / cast / death，蒙皮克隆相互独立。
- Map22 默认竞技场替换自建棋盘；54° 俯视镜头，整体图使用更远镜头。
- 金克丝命中特效启用 45/47 个发射器，其中 20 个是原版网格；火箭本体也改为原版网格。
- 页面保留 `?animation=procedural` 和 `?board=procedural`，可分别对比程序动作和旧棋盘。
- `README.md` 给出安装、转换、运行、截图、校验的完整命令；重新获取素材须运行 Windows 总入口。

## 截图（本地，不提交）

相对于本试验目录：

- `shots/original/idle.png`、`attack.png`、`cast.png`、`death.png`：四类动作。
- `shots/original/board.png`：整体竞技场；另有 `move.png`、`impact.png`、`ui.png`。
- `shots/compare-procedural/`：同一原版竞技场、镜头、取样时刻的程序动作。
- `shots/comparison.png` / `comparison.html`：五种动作的左右对比总览。
- `shots/comparison-idle.png`、`comparison-move.png`、`comparison-attack.png`、`comparison-cast.png`、`comparison-death.png`：单项对比。
- `shots/procedural/`：改动前的旧页面基线。
- `.local/3d-trial-14.24-screenshots.zip`：全部 25 张 PNG 和对比 HTML，24,658,870 字节，可让本机用户上传此包。

## 验证与体积

[验证脚本](tools/verify-trial.mjs) 已通过：15 个 glTF（2 个英雄、1 个地图、12 个特效）
经 Khronos `gltf-validator 2.0.0-dev.3.10` 校验，0 错误、0 警告；
浏览器逐段检查十段动作的骨骼姿态变化、独立骨骼克隆、死亡后恢复和双向火箭目标。
大招飞行与命中生命周期无浏览器异常或失败资源请求。
本地证据：`.local/verification.json`、`.local/verify.log`。
Windows 总入口已端到端重跑；87 个页面素材文件重建前后 SHA256 全部一致，
证据为 `.local/repeat-check.json` 和 `.local/rebuild.log`。

最终 `npm run build` 通过；原有截图脚本及正式测试的时限均未修改。
正式 `src/simulation/`、`src/server/`、`src/rendering/` 和 `tests/` 与施工起点一致。

| 内容 | 字节数 | 十进制体积 |
| --- | ---: | ---: |
| 页面 JS（含 Three / GLTFLoader） | 644,345 | 644.35 KB |
| JS gzip | 169,289 | 169.29 KB |
| HTML | 3,337 | 3.34 KB |
| `public/assets/`，87 个文件 | 15,601,725 | 15.60 MB |
| 其中竞技场 GLB + 18 张 PNG | 9,797,545 | 9.80 MB |
| 其中金克丝 / 蔚 rigged GLB | 1,993,864 / 1,470,572 | 1.99 / 1.47 MB |
| 完整试验 dist（含素材） | 16,249,407 | 16.25 MB |
| WAD 原始提取条目（173 个） | 23,919,606 | 23.92 MB |
| RMAN 压缩块缓存 | 11,511,777 | 11.51 MB |

素材体积不含工具、Python 依赖、哈希字典、RMAN 清单、截图和压缩包。
完整 Map22 WAD 在该清单中为 2,340,409,624 字节，本次没有整包下载。

## 自行决定

- 采用精确 14.24.6442327，放弃本机 16.20 的混合版本方案。
- 按条目读取三个 WAD，选择默认 `base` 竞技场，不拉取所有竞技场皮肤或整个客户端。
- 每类动作选择一段 S13 原版 clip；试验页继续控制路径、目标与发射时机，未引入正式游戏规则。
- 地图漫反射映射用 CDTB BIN 解析结果 + CDragon 同版本 PNG 补齐；原版环境着色器暂用静态材质替代。
- 截图含版权素材，留本机并打包，不上传进 Git。

## 未完成与风险

- 尚未实现完整原版动画状态图、全部普攻/技能变体、动画事件和环境动态效果。
- 两个扭曲发射器仍跳过；原版复杂着色器、树木摆动、环境粒子、后处理与完整客户端渲染不同。
- 移动路径、弹道、发射时机和默认 VFX 0.6 缩放仍为试验参数；不能称为逐帧复刻。
- 没有完整 Map22 WAD 备份；保留的是默认竞技场所需条目及可重复获取脚本。
- 当前锁定的 Vite 7.1.12 在 `npm audit` 中有开发服务器高危项；本次未改依赖，仅用于本机 localhost，未部署。运行依赖审计为 0。
- Riot CDN、社区哈希表和 CDragon 的未来可用性不由本仓库保证；本机缓存可用于复核本次产物。
