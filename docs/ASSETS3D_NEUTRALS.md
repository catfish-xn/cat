# 3D PvE 野怪素材与接线合同

日期：2026-10-21。仅离线读取本机 14.24.6442327 缓存；不使用当前安装客户端、不下载。9 种外观全部转换成功，覆盖项目全部 12 个野怪 definitionId。此次只增加转换、验收脚本与合成测试；界面接线由 Claude 负责。

## 入口与输出

```powershell
node scripts/assets3d/neutrals.mjs
# 已有输出重建：
node scripts/assets3d/neutrals.mjs --force
$env:CHROMIUM_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/assets3d/neutral-browser-review.mjs
```

可选参数：`--source <只读缓存根>`、`--out <neutrals 内的真实子目录>`、`--force`。默认缓存根 `assets3d-local/trial/local`；脚本的所有素材和报告写入均被限制在真实目录 `assets3d-local/neutrals/` 内，拒绝通过联接写出边界。浏览器验收脚本固定检查默认输出根。

- `scripts/assets3d/neutral-config.mjs`：非英雄配置表、definitionId 别名、动作规则及建议高度；不要求英雄 definitions/unit-map。
- `scripts/assets3d/neutrals.mjs`：复用 RMAN/WAD 的只读缓存适配器、BIN 绑定、模型/动作/纹理解码器；校验 manifest 缓存哈希、分块校验和、WAD 索引。缺依赖直接失败，不联网补块。
- 从 skin0/root 的动画 BIN 链接递归到闭包，循环去重并限制总量；只选 skin 实际指定的动画图。材质从皮肤/静态材质绑定取 diffuse，保留隐藏子网格语义。贴图直接嵌入 GLB，不依赖外置 PNG。
- 五个标准状态通过图别名、文件名优先级或显式覆盖选取；图内全部 atomic clips 也保留，包括 spawn、第二攻击、先锋的 dash/taunt/dance。大龙解析到另一角色目录的四段共享动作；小狼也正确取到共用跑步动作。
- `assets3d-local/neutrals/manifest.json`：与英雄相同的 `schemaVersion: 1 / models / effects`；`effects` 为空。每个 definitionId 都有 `models/<definitionId>/model.glb` 和五个状态的原始 clip 名。
- `precache.json`：由现有 `merge-manifests.mjs` 生成，包含 12 个模型文件的路径、字节数、SHA-256；不包含提取原文件、截图和报告。
- `build-report.json`：模型结构检查、绑定来源、动作映射与选择证据、尺寸、逐动作轨道情况、源文件哈希。`ready` 在开始重建时先置为 false，全部完成后才置为 true。
- `build/units/`、`runtime/<内容摘要>/` 是 merge 的相互隔离中间目录。校验 merge 成功后才发布根目录 manifest/precache 和 payload；重建保留中间证据。部署只取根 manifest/precache 及 precache 列出的文件。
- `review/<definitionId>.png`：每种外观一张，共 9 张，固定 idle 0.5 秒；旁边线框柱高 92。`review-report.json` 记录贴图尺寸、实际待机包围盒、落地偏移及浏览器错误；`contact-sheet.png` 是本次验收拼图。

9 种唯一 GLB 共 **15,359,136 B（14.65 MiB）**；manifest 的 12 个 ID 为兼容现有 merge 路径约定，复制了小兵别名文件，运行时 payload 共 **17,753,144 B（16.93 MiB）**，另加小量 manifest/precache 元数据。以上含全部动作与嵌入贴图，未经 meshopt/KTX2 压缩；不是包含缓存、截图和中间产物的本地目录总大小。

## 回合、ID 与动作

以 `src/simulation/content/neutrals.ts`、`neutral-encounters.ts` 为项目 ID/回合依据。A/B/C 保留为外观／部署别名；2026-10-29 用户批准三轮小兵统一数值，见 [恢复记录](NEUTRALS_14_24_RESTORATION.md)。

| 回合 | manifest key | 角色 | GLB 字节 | clip 数 |
| --- | --- | --- | ---: | ---: |
| 1-2、1-3、1-4 | pve-minion-melee-a / b / c（后三项均带完整 pve-minion-melee- 前缀） | tft_chaosminionmelee | 728,908 | 5 |
| 1-3、1-4 | pve-minion-ranged-b / c（同上为完整前缀） | tft_chaosminionranged | 936,192 | 5 |
| 2-7 | pve-krug | tft_krug | 1,048,588 | 6 |
| 3-7 | pve-wolf-large | tft_murkwolf | 1,582,836 | 6 |
| 3-7 | pve-wolf-small | tft_murkwolfmini | 1,542,280 | 7 |
| 4-7 | pve-razorbeak-large | tft_razorbeak | 1,195,472 | 6 |
| 4-7 | pve-razorbeak-small | tft_razorbeakmini | 946,528 | 6 |
| 5-7、6-7 | pve-elder-dragon | tft_elderdragon | 3,511,836 | 5 |
| 旧6-7（2026-10-29已取代，现不部署） | pve-rift-herald | tft_riftherald | 3,866,496 | 9 |

共 55 段模型内 clip（共享动作在各自 GLB 内保留），9/9 外观均覆盖 idle/move/attack/cast/death。

| 外观 | idle | move | attack | cast | death |
| --- | --- | --- | --- | --- | --- |
| 近战兵、远程兵、石甲虫、大鸟、小鸟、先锋 | 本角色 idle | 本角色 run | 本角色 attack1 | 本角色 attack2 | 本角色 death |
| 大狼 | tft_murkwolf_idle_aggro3 | tft_murkwolf_run | tft_murkwolf_attack1 | tft_murkwolf_spawn | tft_murkwolf_death |
| 小狼 | tft_murkwolfmini_idle | tft_murkwolf_run | tft_murkwolfmini_attack1 | tft_murkwolfmini_leap | tft_murkwolfmini_death |
| 远古龙 | tft_dragon_idle_aggro1 | tft_dragon_run | tft_dragon_spell | tft_elderdragon_takeoff | tft_dragon_death |

`cast` 是可供表现层调用的动作映射，不表示野怪领域规则新增施法。龙以共享 spell 表现普攻，takeoff 仅在已有事件/表现意图需要时使用；不能为播放素材而制造领域命令或扣费。`hit` 没有专门映射，沿用当前 mixer 的 idle 回退。小狼的共享跑步/攻击/跳跃源动作有 4 个骨骼哈希在该小型骨架不存在，转换器按现有策略省略这些未绑定轨道（每段 12 条位置/旋转/缩放轨道），其余骨骼正常转换；逐段证据保留在报告中。

## 尺寸与浏览器验收

建议值是初始表现参数，不是规则。GLB 保持 League 原始单位、+Y 向上、+Z 朝前，与英雄转换相同。表中只列相对英雄高度（92）的比例和按一格约 62.4 计的占地格数；精确缩放值和包围盒只保留在本地报告 assets3d-local/neutrals/ 中，接线时由 GLB 包围盒按目标比例现算。待机高度因姿态变化而不同。所有纹理均已成功载入并实际查看截图，无白模、缺图或显著破面。截图中的模型为便于地面比较额外加了固定落地偏移。

| 外观 | 目标高度（相对英雄） | 待机可见高度（相对英雄） | 待机占地（格，X×Z） | 落地偏移（相对英雄高度） |
| --- | ---: | ---: | --- | ---: |
| 近战兵 | 0.57 | 0.58 | 1.2×0.9 | -0.03 |
| 远程兵 | 0.57 | 0.77 | 1.1×1.1 | +0.02 |
| 石甲虫 | 0.78 | 0.75 | 1.0×1.1 | +0.03 |
| 大狼 | 0.87 | 0.75 | 1.6×3.1 | +0.01 |
| 小狼 | 0.52 | 0.56 | 0.6×1.4 | +0.04 |
| 大鸟 | 0.87 | 0.84 | 1.1×2.0 | +0.10 |
| 小鸟 | 0.48 | 0.46 | 0.5×1.1 | +0.05 |
| 远古龙 | 1.52 | 1.20 | 4.4×3.6 | -0.57 |
| 先锋 | 1.36 | 1.36 | 1.9×2.5 | +0.01 |

大狼（含长尾）、龙（含翼）会跨多个格子；现有英雄 `fit` 的 `MODEL_WIDTH=110` 会进一步压小它们。如果采用本表，应按目标高度比例单独缩放（读本地报告或运行时按包围盒计算），不再叠加英雄 fit。远程兵绑定姿态较低，待机时约为英雄高度的 0.77；若希望与近战兵实际等高，可把其目标高度比例下调约 27%。同一外观只初始化一次 scale/固定偏移，不要每帧重算包围盒，以免动作时缩放或脚底抖动。

龙的 idle 本身有正向离地位置，表中负偏移是截图对齐地面用的表现建议；界面可保留其飞行高度。不要再同时对 GLB 做第二次镜像/单位换算。此次浏览器验收只覆盖待机姿态；全部动作通过解析、结构与映射校验，未逐动作做视觉验收。

## 自动验证

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run --configLoader runner --project fast assets3d-neutrals assets3d-merge rendering3d assets3d-bin assets3d-model-convert assets3d-texture
```

`tsc` 通过；上述 18 个测试文件、330 项测试通过。新测试使用假角色/假路径/整齐参数，覆盖非英雄配置校验、五态选择、显式共用动作、歧义拒绝、递归动作图/循环/缺依赖/预算/补丁拒绝、英雄同 schema manifest、全部项目 definitionId 与回合部署 ID 对齐。既有模型、纹理、BIN、merge 与 rendering3d 回归同时通过。Vitest 使用 runner 避开当前沙箱下 bundled config 的父目录读取限制；未更改工程配置。

## 界面接线需求

1. 仅在 3D 模式替换 PvE 占位方块。沿用 session/replay 提供的每只棋子 `definitionId`，调用 `ModelCache.load(definitionId)`；以 manifest 是否存在该 key 判断可加载，未知 ID 或失败仍走现有占位回退。不要按回合名猜英雄或按显示中文名查找。1-2/1-3/1-4 使用上述小兵各档完整 ID，其余回合直接用部署记录的野怪 ID；多只相同野怪复用模板，每只保留独立 lease/骨架/mixer。
2. 表中高度比例供界面侧采用和调节。当前 `src/rendering/three-mode/placeholder-renderer.ts` 把所有真实模型送入 `fit(..., MODEL_HEIGHT, MODEL_WIDTH)`；接线时需为这些 definitionId 选择野怪参数。固定落地偏移加在 mixer 不驱动的外层容器，避免覆盖动画骨骼；死亡、移动、拾取仍以现有单位 ID/棋格为准，视觉翼尾大小不能改规则碰撞。
3. 把 `lease.animationNames` 原样交给 `UnitAnimationMixer`；现有 movement/attack/cast/death 驱动对应状态，idle/move 循环、其他单次，缺 hit 回退 idle。spawn、dash 等额外 clip 可后续表现使用，但不要新增模拟规则或凭素材自行计算跳跃/冲锋。小狼 cast 已明确映射 leap，大狼 cast 为 spawn。
4. 合并英雄与野怪到一个**新的真实目录**，避免写入 all-anim/trial 等联接：

   ```powershell
   node scripts/assets3d/merge-manifests.mjs --from assets3d-local/all-anim assets3d-local/neutrals/build --out assets3d-local/neutrals/with-heroes
   ```

   merge 读取英雄根 manifest 和野怪 build/units 中的分批 manifest，复制到新根并生成统一 manifest/precache；key 冲突、不同内容覆盖、缺依赖都会失败。这里使用 build 作为输入以保证与输出目录相互隔离；不可把 neutrals 根作为输入再输出到它的子目录。若采用已压缩英雄包，将第一个 `--from` 换为其实际根；保留既有 meshopt/KTX2 读取能力。将 3D 可配置素材根指向该新根，根 manifest 同时包含英雄和 12 个野怪 ID。预缓存按该根 precache 清单处理，不扫描 build/runtime/extracted/review。
5. 界面验收条件：八个 PvE 回合均按 definitionId 显示正确外观；大小狼/鸟比例可区分，小兵 A/B/C 外观一致；多只模型动作独立；失败有占位回退；2D 模式和规则无改动。本次未修改界面文件，接线尚待 Claude 实现。

## 2026-10-29 6-7 模型复核

用户决定以远古龙替换6-7先锋，直接复用5-7的 `pve-elder-dragon`，不新增模型或回合特判。`neutral-config.mjs` 已绑定 `tft_elderdragon`，2D头像、3D模型缓存及高度表已有该ID。当前工作树无 `assets3d-local/`；在本机 `cat-v23-anvil-assets/assets3d-local/anvil-delta/root-H1IaDF/roots/0/roots/4/roots/8/models/pve-elder-dragon/model.glb` 只读复核到882804字节的GLB v2，头部长度一致，包含上表五段龙动作。此为已有处理包，大小不同于2026-10-21未压缩源输出。素材未复制或提交；运行3D仍须将可配置素材根指向含该key的已有完整包。本轮未做浏览器视觉验收。
