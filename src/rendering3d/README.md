# 独立 3D 核心（D8）

本目录只提供可选的 3D 基础模块，不接入 2D 入口、不修改战斗规则。宿主使用
`await import('./rendering3d')` 建立异步 chunk；纯动作逻辑也可单独从
`animation-state.ts` 导入，它没有 three、Phaser、DOM 或模拟层运行时依赖。

## D7 素材契约 v1

权威类型位于 `contracts.ts`。manifest 必须是 `schemaVersion: 1`，包括：

- `models: Record<id, { path, animations? }>`：`path` 是相对素材根的 `.glb` 路径；
  `animations` 把 `idle/move/attack/cast/hit/death` 映射到 GLB 动作名称。
- `effects?: Record<id, { path }>`：相对素材根的粒子 `.json` 路径。
- 默认根地址是 `assets3d-local/`，可传相对路径、部署前缀或 CDN URL。
  子路径不接受绝对地址、协议、反斜线、查询参数、片段、百分号或 `..`。
  根地址由宿主配置；子路径一律相对根解析，粒子贴图也不相对 JSON 所在目录。

不生成或提交 manifest 实例文件。素材应由宿主单独托管，不能依赖 Vite 把仓库根的
本地素材自动打入生产包。目录 `assets3d-local/` 已忽略；本次没有创建该目录。
本版本使用自包含 GLB；不配置 Draco/KTX/Meshopt 解码器，不保证此类压缩素材可用，
加载失败会给出占位。GLB 内嵌骨骼和 animation clips 保留原样。

粒子 JSON 为 `{ schemaVersion: 1, emitters: ParticleEmitter[] }`。v1 是一次性 burst，
无循环发射器。时间为秒，曲线时间为粒子寿命的 `[0,1]`，键必须递增。
RGB 为线性空间 `[0,1]`；世界坐标采用 three 轴向（Y 向上）。

| 字段 | v1 解释 |
| --- | --- |
| `kind` | `sprite` 实现为朝向相机的双面平面；`mesh/trail/screenDistortion` 跳过并按发射器计数 |
| `texture` | 可选贴图相对路径；直接构造时由 `texture(path)` 提供，缺省为白色无贴图平面 |
| `color` | `{time,value:[r,g,b]}[]`，线性插值，端点钳制；默认白色 |
| `opacity/size` | `{time,value}[]`；透明度 `[0,1]`，大小为非负局部单位；默认 1 |
| `lifetime/delay/count` | 正寿命、非负延迟、整数数量；所有粒子在延迟后同时出生 |
| `velocity/gravity` | `[x,y,z]`，局部单位/秒及单位/秒²；默认零 |
| `drag` | 非负线性阻力系数/秒，解析求解 `dv/dt = gravity - drag*v`；默认零 |
| `shape` | `point`、均匀球体 `{kind:'sphere',radius}`、盒体 `{kind:'box',halfExtents:[x,y,z]}`；默认点 |
| `frames` | `{columns,rows,fps,loop?}`；图集从左到右、从顶行往下，默认停留末帧 |
| `dissolve` | `[0,1]` 阈值曲线，对稳定程序噪声遮罩丢弃片元；1 完全消失，不解释专有噪声贴图 |
| `blend` | `normal/additive/multiply`；透明、关闭深度写入，默认 normal |

空间缩放统一通过 effect Group 实现，默认 `0.6`，可设置 `scale`；尺寸、形状、初速度和
重力位移一起缩放。默认粒子预算 10,000，可配置 `maxParticles`，超限抛错。
默认局部固定种子 RNG，可注入 `[0,1)` 随机函数；不依赖全局随机或真实时钟。
不支持未知 schema/kind；已知未实现的三类发射器直接跳过，不加载其贴图。

## 素材及资源生命周期

`ModelCache.fromUrl(manifestUrl, root?, readModel?)` 校验 manifest；manifest HTTP/格式错误
直接抛出。`new ModelCache(manifest, root?, readModel?)` 可用于已加载 manifest。
`load(id)` 返回独立 skeleton/transform 的 `ModelLease`，同时复用 template 几何、材质、
贴图和 clips；同 ID 并发请求只读一次。未知 ID、GLB HTTP 或解析失败返回紫色盒子占位，
`lease.placeholder` 为 true。失败也缓存，调用 `evict(id)` 后可重试。

宿主不得直接释放/修改共享材质、几何和 clips；每个 lease 使用自己的 mixer。
先 `UnitAnimationMixer.dispose()`，再 `lease.release()`（幂等），最后按需 `cache.evict(id)`
或 `cache.dispose()`。release 自动脱离 parent 并释放该实例 skeleton，模板保留在缓存中；
淘汰/关闭缓存只在最后一个 lease 释放后清理共享 GPU 资源。已关闭缓存拒绝新 load；
关闭前已开始的 load 仍会完成，返回的 lease 也必须 release。

`new ParticleEffect(json, options)` 仅使用内存 three 对象；直接注入的贴图属于调用者。
`loadParticleEffect(manifest,id,{root?,readTexture?,...options})` 显式读取 JSON、按路径去重加载
贴图，effect.dispose 同时清理它加载的贴图；任何加载失败会清理已加载部分并抛错。
默认 TextureLoader 只在调用加载函数时需要浏览器，Node 测试注入合成 Texture。
不修改调用者纹理对象的图集偏移，图集 UV 在 shader 中计算。

## 动作与拾取

`UnitActionState(unitId, {blendSeconds?,durations?})` 只消费对应单位的动画事实：
`movement.unitId -> move`、`attack.attackerId -> attack`、`cast.sourceId -> cast`、
有效 `packetDamage.targetId -> hit`、`death.unitId -> death`、`unitRevived.unitId -> idle`。
字段对应 `combat-replay-view.ts`；宿主先筛选这六类事件，其余完整账本保留在宿主。
同动作重复事件增加 revision，支持普攻重新播放；非死亡状态按事件顺序切换。
死亡锁定直到复活。`update(seconds)` 结束短动作回待机，死亡不自动恢复。
默认视觉时长 move=.2、attack=.45、cast=.7、hit=.15，混合 .12 秒；均可配置，
这些只是表现时长，不改变规则 tick、数值或结算。

`UnitAnimationMixer(root,clips,animationNames)` 接受 `state.output`，按 revision 更新动作，
跨动作 crossfade；idle/move 循环，其余单次，death 停末帧。缺少动作时回退 idle，
连 idle 都没有时静态显示。每帧宿主调用 `apply(state.update(delta))` 和 `mixer.update(delta)`。
粒子每帧调用 `effect.update(delta,camera)` 以更新生命周期和朝向；`finished` 可用于回收。

`pick({x,y},viewport,camera,grid,units?)` 接受 CSS 像素和含 left/top 的 viewport；返回
`{kind:'unit',unitId}`、`{kind:'cell',cell:{col,row}}` 或 undefined。优先最近可见单位表面，
支持 Group 子网格；未命中单位则与 Y=elevation 平面相交，再精确判断六边形。
`hexCenter(cell,grid)` 的 `x/z` 与只读 `HexLayout.center()` 的 `x/y` 一致，默认 radius=36、
origin={x:242,y:146}，奇数行偏移半列，边界采用相同逐行优先次序。
相机投影参数变化后由宿主调用 updateProjectionMatrix；非平面棋盘不在本契约范围。

## 验证与限制

仅运行 `npm run typecheck` 和四个 `tests/rendering3d-*.test.ts` 单文件测试，串行执行。
覆盖程序在内存生成的极小蒙皮 GLB、动作混合、GPU 资源清理、失败占位、粒子参数、
图集/溶解 uniforms、不同时间步的轨迹、相机和格/单位拾取、HexLayout 坐标对照。
没有浏览器/WebGL 视觉或真实资产验收；shader 片元结果和真实 D7 资产兼容性待交叉验货。
未下载、合并或复制 #186 试验素材；不操作 D3–D6，不自行签收，不合并。

依赖固定 `three@0.186.1` 和同系列 `@types/three@0.186.0`：采用安装时 registry 的当前版本，
使用 ESM GLTFLoader/SkeletonUtils、AnimationMixer、ShaderMaterial 和 Raycaster；精确固定版本
减少解码/类型漂移。类型包的间接开发依赖不引入产品物理系统，也没有接入 2D 静态依赖图。

本次交付起点：`9c3c7a9319333d24e456a9c808e18d4afc47589e`（fetch 得到的 origin/3d）。
验证记录（每条测试命令均加 `--no-file-parallelism`，依次运行）：

| 命令/文件 | 结果 | 耗时 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | 12.026 s wall |
| `tests/rendering3d-assets.test.ts` | 8/8 | 271 ms |
| `tests/rendering3d-animation.test.ts` | 6/6 | 229 ms |
| `tests/rendering3d-particles.test.ts` | 13/13 | 240 ms |
| `tests/rendering3d-picking.test.ts` | 9/9 | 223 ms |

素材检查：没有生成 `assets3d-local/`，`git status --ignored --short assets3d-local` 无输出；
测试中的 GLB 只在内存生成，纹理只用内存 Texture。未生成 manifest 输出文件。
