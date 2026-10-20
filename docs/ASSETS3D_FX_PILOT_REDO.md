# 金克丝 / 蔚：最新转换器试点

新产物在真实目录 `assets3d-local/fx-pilot/`。输入联接只读；生成物、完整侧写和截图均留在该目录。未修改 `src/`，未执行 Git 命令。每英雄一张对象绑定表，默认金克丝 R、蔚 Q；W/E/R、Q 独立变体、挂点、阶段和预览时序与旧试点逐项相同，W/E 不混入默认 cast。蔚 Q 左手系统继续记为不可用，共享普攻命中继续沿用本地已转换文档。

## 离线生成与复查

本工作区没有默认的提取缓存入口，使用相邻工作区的既有只读缓存；没有新增联接。已有输出重跑时加 `--force`，不要将输出改到任何旧素材根。

```powershell
node scripts/assets3d/fx-batch.mjs --units jinx,vi --out assets3d-local/fx-pilot --source ../particles-map/assets3d-local/trial/local
node scripts/assets3d/fx-batch-sizes.mjs --out assets3d-local/fx-pilot
node scripts/assets3d/fx-batch-audit.mjs --out assets3d-local/fx-pilot
node scripts/assets3d/fx-batch-sizes.mjs --out assets3d-local/fx-trial --report-out assets3d-local/fx-pilot/old-size-report.json
node scripts/assets3d/fx-pilot-compare.mjs
$env:CHROMIUM_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/assets3d/fx-browser-review.mjs --out assets3d-local/fx-pilot --effect all
```

`--report-out` 将旧试点的重新测量写到新根；不会向 `fx-trial` 写报告。浏览器只允许回环请求。复看脚本现传入绑定的播放上限，与尺寸采样使用相同寿命口径；默认整系统截图也落在绑定窗口内。输入联接的浏览器截图用 `--screenshots` 指向新根，同时以 `--sizes` 选择新根内的旧尺寸报告。

## 与旧试点的格数、朝向和混合比较

两套文档均由当前 ParticleEffectV2、同一镜头和随机序列测量，统一宿主比例 `0.44`，包含实际网格边界、系统变换和寿命缩放。下表为绑定窗口内有面积粒子的几何长边峰值，排除初始瞬间；“新/旧”是比例。几何边界包含透明留白，不等于纹理可见覆盖，也不等于玩法距离。旧报告中的历史宿主比例或旧脚本口径未混入比较。

| 片段 | 旧（格） | 新（格） | 新/旧 |
| --- | ---: | ---: | ---: |
| 金克丝普攻枪口 | 1.27 | 0.71 | 0.56 |
| 金克丝普攻弹体 | 1.13 | 0.71 | 0.63 |
| 金克丝 W 出手 | 2.14 | 2.53 | 1.18 |
| 金克丝 W 弹体 | 2.33 | 2.97 | 1.28 |
| 金克丝 W 射线 | 10.37 | 8.16 | 0.79 |
| 金克丝 W 命中 | 1.10 | 1.10 | 1.00 |
| 金克丝 E 弹体 | 0.74 | 0.74 | 1.00 |
| 金克丝 E 爆炸 | 2.64 | 2.64 | 1.00 |
| 金克丝 R 枪口 | 18.80 | 18.80 | 1.00 |
| 金克丝 R 发射口 | 1.98 | 1.98 | 1.00 |
| 金克丝 R 火箭子片段 | 2.00 | 2.00 | 1.00 |
| 金克丝 R 命中 | 14.80 | 14.80 | 1.00 |
| 蔚共享普攻命中 | 1.20 | 1.20 | 1.00 |
| 蔚 Q 右手 | 0.63 | 0.63 | 1.00 |
| 蔚 Q 起跳尘 | 2.76 | 2.08 | 0.75 |
| 蔚 Q 落地弹体 | 2.29 | 1.56 | 0.68 |
| 蔚 Q 落地区域 | 22.85 | 4.23 | 0.19 |
| 蔚 Q 落地区域子片段 | 4.54 | 4.54 | 1.00 |
| 蔚 Q 命中 | 1.20 | 1.41 | 1.18 |

尺寸变化来自既有长边包络、真实网格边界和通用跳过保护；没有新增英雄缩放特例或经验限幅。共同文档中可匹配粒子的固定出生朝向约 **20.19%** 发生四元数意义上的变化；新输出全部固定面片/网格通过既有 YXZ 转换等价检查。地面标记不强制所有面片水平，保留有证据的竖向与倾斜片段。

共同文档中可匹配粒子约 **3.76%** 改变混合方式；新输出全部英雄粒子通过既有 blendMode 映射和贴图透明度核验。共同文档内旧粒子约 **13.77%** 被通用保护省略，未新增替代粒子。白块、副遮罩和无法表达的静止射线保护继续生效。共享命中为原文档副本，不计入英雄映射审计。

## 浏览器结果与限制

本机 Chrome 已复看新根全部效果，贴图加载错误为零。重点查看金克丝普攻、W 射线、R 枪口与命中，以及蔚 Q 落地区域和子片段；新旧重点片段另用 **30 格**视野对照。默认截图、宽视野截图和旧试点截图分别在新根、`review-wide/`、`review-old/`；旧素材目录未写入。

金克丝 R 枪口的 **18.80 格**峰值来自细长闪光的几何边界，当前常见画面远小于该边界；R 命中的 **14.80 格**环面仍较大，宽视野复看保留。W 射线是沿弹道的长条，静止截图不能代表宿主运动。蔚 Q 子片段仍可能很淡或不可见，其 **4.54 格**几何峰值不构成可见性保证。通用标量包络仍近似非均匀形变；未还原宿主轨迹、子系统调度或原版混合管线，不据截图宣称像素一致。

## 外壳使用新试点与合并根

仅试点预览可把素材根设为 `assets3d-local/fx-pilot/`。包含全部英雄时，使用新加的 `merge-fx-roots.mjs`：输入从左到右覆盖，**新试点必须放最后**。它生成自包含的真实子目录，重写模型、效果和粒子资源路径，同时合并 actionEffects、playback 和 variants。不会改任何输入根，也不会回填旧试点。重跑合并可加 `--force`。

```powershell
node scripts/assets3d/merge-fx-roots.mjs --roots assets3d-local/all-anim,assets3d-local/fx-batch1,assets3d-local/fx-batch2,assets3d-local/fx-batch3,assets3d-local/fx-batch4,assets3d-local/fx-batch5,assets3d-local/fx-batch6,assets3d-local/fx-pilot --out assets3d-local/fx-pilot/merged
```

外壳应同时从 `assets3d-local/fx-pilot/merged/` 读取 `manifest.json` 和 `action-bindings.json`，粒子纹理与网格也以此为根；默认 cast 使用 manifest，替代技能由 `variants` 显式选择。本地 Vite 入口示例：`?render=3d&assets3d=/assets3d-local/fx-pilot/merged/`。部署时素材 URL 需匹配站点实际基础路径。合并结果已核验全部资源引用可达、金克丝/蔚选中新试点，未修改 `src/rendering` 或进行外壳接线验收。

## 回归证据

原金克丝/蔚严格路径 fixture 和断言未改；新 pilot 测试只构造假单位、假骨骼、`synthetic/` 资源和整齐数值。通过 `tsc --noEmit`，以及下列指定回归文件（共 359 项）：

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run --configLoader runner --project fast tests/assets3d-fx-batch1.test.ts tests/assets3d-fx-batch2.test.ts tests/assets3d-fx-batch3.test.ts tests/assets3d-fx-batch4.test.ts tests/assets3d-fx-batch5.test.ts tests/assets3d-fx-batch6.test.ts tests/assets3d-fx-pilot.test.ts tests/assets3d-visual-approximate.test.ts tests/assets3d-particle-approximations.test.ts tests/rendering3d-action-effects.test.ts tests/rendering3d-particles.test.ts tests/rendering3d-particles-v2.test.ts
```

使用 `runner` 避开当前受限环境中 esbuild 的配置打包路径问题，不修改项目配置或放宽权限。完整审计和比较证据仅在 `fx-pilot` 本地 JSON，本文仅报告比例、格数及使用方法，不转载原版数值、贴图名或逐发射器字段。
