> 2026-10-27：已实现按英雄延迟目录和显式地面绘制通道，当前协议、运行命令及覆盖见 [VFX_SET13_COVERAGE.md](VFX_SET13_COVERAGE.md)；下文为首版方案。

# LeagueToolkit VFX 移植方案与交付边界

本文件保留首版交付边界。2026-10-26 的真实 Jinx／Vi 数据接入、补齐的绘制功能、当前测试与手工验收入口以 [VFX_PORT_REPORT.md](VFX_PORT_REPORT.md) 为准；对应 P 约定见 `S13_RULES_GAP.md:1269`。

日期：2026-10-26。源检出：`/home/aiapps/workspcae/ltk-manager-src`，提交 `a3e5ef85ca4cf50486f2dcd9024831432ec9921b`，上游 package `ltk-manager-ui@1.30.5`，声明 `GPL-3.0-or-later`。本仓库起点 `385b62b8`（v23），只改可选 3D 模式及测试／文档；不改规则、事件投影、2D 表现。约定编号见 `S13_RULES_GAP.md` 的 P-VFX-LTK 系列。

## 源码模块图

上游路径以下均相对于 `src/modules/workshop/bin/vfx/`。

| 模块 | 职责／依赖 | 本次处理 |
| --- | --- | --- |
| `index.ts` | 导出模型、解析器、React 查询、播放控件、预览和时间线面板 | 不复制桌面编辑器入口；浏览器入口是 `loader.ts`、`runtime.ts` |
| `engine/model/` | System／Emitter／ValueCurve、枚举、质量档、rig、missile、autoRig | 全部保留；只依赖类型和独立数字空间定义 |
| `engine/parsing/` | 读哈希字段、曲线、发射、表面、运动、flex、子系统、材质引用 | 全部移植；不重造简化 JSON 粒子格式 |
| `engine/drivers/` | 驱动节点解析、注册、编译、上下文、随机／时间／数学运算、easing、诊断 | 全部保留；区别于外层 `drivers/` 编辑器图 |
| `engine/simulation/` | 类型数组 pool、emit、spawnShape、integrate、力场、柔性参数、速率、逐帧步进、checkpoint、子粒子及池回收 | 全部保留；在 DriverOptions 增加可选子池预算，默认仍为上游值 |
| `engine/utils/` | 曲线插值／积分、解析阻力、基变换、显式种子 RNG | 原实现保留，与游戏规则 RNG 完全分开 |
| `engine/shimmer/` | 新式组件／轨道读取与执行模型 | 源码保留；浏览器入口目前只接受 classic VfxSystem；未声称完成 Shimmer 绘制 |
| `forces/` | 力场的检查器、编辑、预览；实际计算在 `engine/simulation/forceFields.ts` | 不引入国际化／UI；实际计算保留 |
| `children/` | child set 编辑器模型、链接／effectKey、boneToSpawnAt、出生／死亡触发编辑 | 不引入 UI；解析、概率、继承、骨骼与递归执行均在已移植 engine 内 |
| `drivers/` | 图节点、布局、画布、字段编辑、组件驱动检查器 | 不引入编辑器；实际 classic driver 求值在 `engine/drivers/` |
| 发射器 | 此检出无独立 `emitters/` 目录；定义与读入位于 model／parsing，发射在 simulation/emit、rateReading、spawnShape | 移植上述真实入口 |
| `hooks/useVfxSystem.ts` | React Query 调 Tauri `api.bin.readVfxSystem`，质量／adjust，然后调用 readVfxSystem | HTTP／现有 AssetReader 替换查询与本地桌面 IPC |
| `rendering/hooks/useParticleSystem.ts` | driver、纹理、mesh 生命周期与 rig 更新 | 换成 `createLtkParticles` 显式所有权 |
| `rendering/components/` | Quads、Trails、Beams、Projections、Meshes、AttachedMeshes；useFrame 写 GPU 缓冲 | 前五种的原缓冲写入代码改为显式 update/dispose；附着宿主网格回退 |
| `rendering/utils/` 与 `shaders/` | draw ranks、blend、UV／flipbook、palette／erosion、ribbon、stencil、材质与 GLSL | 复用相关代码；屏幕／深度 pass 不冒充支持 |

`vfx-ltk/bindings.ts` 只抽取上游生成文件中所需的类型及其依赖，保留原结构；`binHash.ts` 与 `space.ts` 来自上游独立工具。没有 Tauri、DOM、Phaser 或 2D 模块的运行时导入。

## R3F 尝试与选择

先安装上游同版本 `react@19.2.5`、`react-dom@19.2.5`、`@react-three/fiber@9.7.0`、`@react-three/drei@10.7.8`，在 `/tmp/cat-vfx-r3f-probe.mjs` 建立 `createRoot(canvas).configure({gl: existingRenderer, scene, camera, frameloop:'never'})` 加原 `VfxSystem` 的挂载探针，并以 esbuild 链接原组件（把 `@` 指回原源码）。

实际在挂载前的打包阶段失败：33 个依赖错误，包括 `@tauri-apps/api/core`、React Query、toast、国际化／viewport 导出带出的整个桌面 UI。日志 `/tmp/cat-vfx-r3f-probe.log`。此外原 frame pass 使用 Three 0.185 的 ExternalTexture，本项目固定 0.180；原 hook 资源读取依赖桌面 IPC，不能单靠四个获准包运行。没有在浏览器实际挂载成功，也没有为取得一个可编译组件伪造 Tauri。

因此选用户允许的裸 Three.js 渲染层：原粒子求值、缓冲布局、着色器及五种绘制算法继续用；React useMemo／useEffect／useFrame 换成每个 draw 自己的 `drawLifetime`（构造、帧回调、释放）。静态 GLB 缺省顶点颜色补齐为原 mesh shader 要求的全白 RGBA lane，已有颜色则保留；深度 push/pull 同步全局尺度。同一个 BoardScene renderer 和相机负责最终 draw，无第二个 WebGL context 或 React 渲染循环。试装依赖已卸载，package.json／lockfile 无最终改动。

## 数据真实格式与落盘协议

**上游消费的是已经解析引用的 `VfxSystem`，不是原始 .bin，也不是某个预设导出目录。** 原 app 的 Rust `crates/ltk-manager-game/src/vfx.rs` 定义值树，`vfx/resolve*` 追引用，`ObjectLookup` 追所在 bin／材质／资源。`hooks/useVfxSystem.ts` 通过 Tauri 直接收此对象。下面目录只是本项目的 HTTP 打包外壳，系统 JSON 本体保持该 Rust 序列化结构：

```text
<现有3D资源根>/
  manifest.json                       # 原模型资源协议不变
  vfx-ltk/
    index.json                        # 本次新增的轻量路径／时间线清单
    systems/<id>.json                  # 原样的 resolved VfxSystem
    textures/<unique>.png              # .tex/.dds 解码后的 RGBA；也可现有读入器支持的 KTX2
    meshes/<unique>.glb                # 可选：单个静态 mesh，原游戏单位，X 已镜像
```

本地放 `assets3d-local/` 的 gitignore 目录；使用现有 `assetBase`／3D 查询参数配置与服务方法。公开站不附带该目录。目录名不要误当成 LeagueToolkit 自带导出格式。

系统文件顶层：`entry`（0x+8 hex）、`name|null`、`classHash`、`class|null`、`root`、`materials`。root 必须是 `struct`。值的判别字段 `type`：`bool`、`number`、`vector`、`matrix`、`string`、`hash`、`asset`、`link`、`struct`、`container`、`map`、`null`、`none`、`undrawn`；字段名是 `fields[].hash/name/value`。struct 的 `object` 为对象 entry/name 或 null。class/field 哈希是 lowercase UTF-8 FNV-1a，不能拿属性显示名称替代哈希。

纹理引用仍是 `{type:'asset',path,asset:AssetRef|null}`；不把上游 AssetRef 的磁盘路径交给浏览器。运行时用 NamedAsset.path 到 `index.assets` 的不区分大小写映射。`materials` 当前只接受空数组；自定义 shader 服务未移植时整条技能回退。跨 bin 的 child/effectKey 必须在 root 中被 resolver 内联为 struct；不能只导出未解析的 raw link，否则缺少子系统。

`index.json` 的示意（这是路径清单，不是游戏素材／系统样本；路径均相对 vfx-ltk/）：

```json
{
  "version": 1,
  "systems": { "jinx-cast": "systems/jinx-cast.json", "jinx-flight": "systems/jinx-flight.json", "jinx-hit": "systems/jinx-hit.json", "vi-cast": "systems/vi-cast.json", "vi-hit": "systems/vi-hit.json" },
  "assets": { "assets/characters/jinx/skins/base/particles/example.tex": "textures/example.png" },
  "skills": {
    "jinx": [
      { "system": "jinx-cast", "event": "cast-start", "delay": 0, "duration": 0.3, "bone": "R_Hand", "stopAfter": 0.2 },
      { "system": "jinx-flight", "event": "projectile", "delay": 0.3, "duration": 0.6, "travelSeconds": 0.6 },
      { "system": "jinx-hit", "event": "hit", "delay": 0.9, "duration": 0.5 }
    ],
    "vi": [
      { "system": "vi-cast", "event": "cast-start", "delay": 0, "duration": 0.5 },
      { "system": "vi-hit", "event": "hit", "delay": 0.5, "duration": 0.6 }
    ]
  }
}
```

这些时间／骨骼仅为接口示意，不是经过真素材验收的官方参数。实际应从本地 `action-bindings.json` 与动画事件取现有已审定 delay/maxDuration/bone（anchor source→cast-start、projectile→projectile、target→hit）；不能把示意值当 14.24b 的玩法证据。第一批对应已有手写方案使用的 `jinx_tft13_jinx_base_r_muzzleflash`、`...r_rocket_child`、`...r_tar`，以及 `vi_tft13_vi_base_q_activate_hands_r`、`...q_landing_aoe`、`...q_tar`。允许多条 cast-start/hit cue。

加载器拒绝路径穿越／URL scheme／编码路径、重复字段哈希、超过 64 层或 20,000 个值节点、非法数字；最多 128 个系统、2,048 个资源映射、一技能 12 条 cue、单系统含子树最多 64 个 emitter。cue 最大 delay/duration 10 秒。根 buildUpTime 最大 2 秒。读失败不让首屏启动等待，也不压掉旧效果。

## 外部转换器接口（本机不安装／运行 Rust）

本机没有 league-toolkit／Rust，本任务没有安装它们，也没有假装用脚本完成 .bin 解码。外部有合适工具链的机器需要实现以下**接口规范**，这里没有提供名为 cat-vfx-export 的现成二进制：

```text
cat-vfx-export --league-root <14.24b解包根> --bin <character/skin.bin>
               --entry <object path或0x哈希> --output <vfx-ltk目录>
               --system-id <清单键> --texture-format png --patch 14.24b
```

输入为本地拥有的原素材；输出是上面的完整 resolved VfxSystem、所有依赖资源、index 的 systems/assets 条目，失败退出非 0；不得静默遗漏未解析的 child。另产生本地转换日志，记录 bin、entry、工具提交、源 patch、文件校验和与未支持项，日志也留在素材目录。技能 skills 由本项目审定的 action binding 填入，转换器不算战斗命中／伤害。

可复用的上游实现：

1. `crates/ltk-manager-game/src/lookup*` 的 ObjectLookup 与 `vfx/resolve*`：bin 引用、子效果、材质／资源定位。导出 serde_json::to_string(system)，不要自行重写字段。
2. 已有只读调试导出命令（**只在外部机器运行**）：`cargo run -p ltk-manager-game --example dump_vfx -- <skin.bin> unused <object> --json`；源码 `crates/ltk-manager-game/examples/dump_vfx.rs`。它用 single document lookup，缺少名称表／外部资产定位，适合核对格式，不能替代完整依赖导出器。
3. `crates/ltk-manager-assets/src/preview/texture.rs` 的 `render(bytes,None)`：ltk_texture 读取 TEX／DDS，解码 RGBA 并编码 PNG。保留 alpha 和原行序，**不预翻转、不预乘 alpha、不转 sRGB**；浏览器与原 loader 一样 `NoColorSpace`、`flipY=false`、LinearFilter。
4. 静态 mesh 导成单 mesh GLB：原游戏单位、不 bake FX_SCALE，X 镜像到 viewport 坐标；submesh 筛选、skinned/animation 暂不接受。原材质由 VFX 控制，GLB 材质不作粒子材质来源。
5. 在隔离的资源目录验证所有 NamedAsset.path 均在 assets 中，所有地址可由现有根读入，再手工写／核对 Jinx／Vi skills。只复制输出到 gitignore 资源根；提交前检查 git status。

## 技能事件、骨骼、缩放与生命周期

现有 `placeholder-renderer.ts` 的 `onEvents → playAction('cast', sourceId, targetIds)` 是接线位置。在线 cast 投影没有可直接对应每个粒子系统的 projectile/hit 通知，本次沿用已有显示时间线：cast-start 在 caster，projectile 从 caster 到首个目标，hit 对去重后的每个目标。delay 都是从 cast 事件起的渲染秒；不订阅任意 packetDamage 来猜哪个技能命中，不生成／延后规则事件。

准备阶段 warmCast 预读已出现的 Jinx／Vi；全部 cue 的模型、纹理和可用绘制路径已准备才返回 `play=true`，然后跳过本次手写 cast。manifest 缺失、读取失败、未预热、未知英雄、缩减动态模式均继续原 fallback。攻击效果保持原样。必要时未来可扩 skills 类型，不从未审定 champion 名称猜资源。

bone 存在时，anchor 每帧从现有骨骼 world matrix 读取；否则回到 unit root。子系统的 boneToSpawnAt 同样有此 fallback。世界坐标除以 FX_SCALE 并镜像 X 进入原 engine；根 group 统一乘 `0.44`。不按每个 GLB 的 fit scale 再放大。原 quad billboard 的偏移、ray 眼点与 projection 的 model matrix 已适配这个尺度；camera 用换算后的副本只做排序／ribbon 朝向，最终仍由原相机绘制。

stopAfter 或死亡 soft-stop 停止发射，存量粒子按原 linger 计算；duration 到时、阶段切换、dispose 硬清理。死亡同时取消尚未启动的关联 cue；不让已经释放的 unit 被异步回调重新挂载。投射体首末位置在 launch 捕获，与原手写路径一致，不额外计算追踪规则。最多六套系统，各 150 根粒子＋100 子池槽，共最多 1,500 活跃粒子槽，并向既有 effects.budget 预留容量，与手写回退共用这 1,500 上限；子系统最多八个，递归深度沿用上游四层。超过预算丢显示，不动账本。长帧最多推进 0.1 秒，过期 0.3 秒的待发 cue 丢弃。

## 支持与明确回退

已接入：classic simple/complex emitter、原曲线／随机／forces／flex 求值、UV flipbook／双纹理／palette／erosion、camera/arbitrary/ray quad、trail、beam、平面投影、单静态 mesh、child set、stencil。flex 外部通道当前不接游戏数值，沿用 engine 未设置为零的行为。

整个技能回退：自定义材质程序（materials 非空）、屏幕 distortion、soft depth、反射 cube、HUD 系统、宿主附着网格、skinned 粒子网格、submesh 筛选与 mesh/skeleton emission surface。原 engine 有些模型支持而本浏览器资源协议没有提供的输入，明确拒绝，避免只画一半就压掉旧效果。原译制 shader 服务、阴影与 bloom 多 pass、Shimmer 组件绘制未包含。五条已有可见绘制路径并非上游全部视觉特性的等价复刻。

## 验收方法

- `tests/vfx-ltk-loader.test.ts`：/tmp JSON、格式／路径、共享读取、错误与 late-dispose。
- `tests/vfx-ltk-timeline.test.ts`：Jinx／Vi 完整性回退、事件扇出、生命周期与显示预算。
- `tests/vfx-ltk-particles.test.ts`：骨骼 fallback、种子结果、软停止、GPU 缓冲写入、投射体时间与 child feeds。
- 单独运行 `tests/rendering3d-isolation.test.ts`（真实生产 build）和 `tests/rendering3d-budget.test.ts`，`--maxWorkers=4 --no-file-parallelism`；不跑全套。
- 无监听端口的 `node scripts/assets3d/verify-vfx-ltk-webgl.mjs`：真实 Chromium/SwiftShader 检查七种 primitive 的 GLSL、像素输出和释放；合成 JSON、1×1 纹理、截图和报告仅输出到 /tmp。可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定 Chromium。
- `npx tsc --noEmit -p .`；构建前后用相同 Vite 命令、gzip level 9 比较 assets/3d 的 JS，记录于 `VFX_PORT_REPORT.md`。
- 开发样本只在 `/tmp` 生成与测试，不提交转换 JSON、纹理、模型。真实 Jinx／Vi 外部转换与桌面观感验收因本机无转换工具／源素材，不能用合成测试冒称通过。
