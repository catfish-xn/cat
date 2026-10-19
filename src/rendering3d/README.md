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

v1 严格校验文档字段、sprite 字段及其 shape/frames/曲线关键帧字段。未知字段使整份
文档拒绝，错误为 `unsupported-particle-field:<字段路径>`，例如
`unsupported-particle-field:$.emitters[0].origin`；格式或值错误也带字段路径。
先校验整份文档，再加载任何贴图或构造粒子网格，不会把部分合法的 sprite 先画出来。
显式 `null`、错误记录类型和不适用的 shape 字段也拒绝，不能借此默默触发默认值。

尚不支持发射器偏移（`origin`/`EmitterPosition`）、连续发射（`emission`）、single 特殊
生命周期、出生概率分布、birthScale0 与 scale0 向量曲线，以及非等比二维/三维大小。
这些字段不能混入 v1 sprite；`size` 的 value 只能是非负标量，向量值会报
`invalid-curve:<字段路径>`。`lifetime=-1` 报 `invalid-emitter-timing:<字段路径>`，不解释为
无限寿命，也不替换为任意正数；ArbitraryQuad/Ray kind 报 `invalid-emitter-kind:<字段路径>`。
D7 不能通过丢弃必需语义把此类源发射器标成普通 v1 sprite，应在转换侧拒绝并报告。

`mesh/trail/screenDistortion` 保持原合同：仅识别 kind，其内部载荷不作 sprite 校验或解释，
整个发射器跳过，`skipped` 每类按发射器数计数。其参数不构成受支持的绘制能力。
本次没有增加 v2 字段或改变 v1 的绘制语义。

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
字段对应 `combat-replay-view.ts`；按事件 type 明确归属：伤害/治疗属于 targetId，攻击属于
attackerId，施法属于 sourceId，移动/死亡/复活属于 unitId。heal 可接收但不产生动作或中断
当前动作；没有治疗动作状态。宿主筛选上述事件，其余完整账本保留在宿主。
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

D10 独立评审修复将依赖统一固定为 `three@0.180.0` 和 `@types/three@0.180.0`，与 #213
已有版本一致。所用 ESM GLTFLoader/SkeletonUtils、AnimationMixer、ShaderMaterial 和 Raycaster
无必须升级至 0.186 的 API 需求；原 0.186.1/类型 0.186.0 的验证记录仅属于历史提交。类型包的间接开发依赖不引入产品物理系统，也没有接入 2D 静态依赖图。

初次交付起点：`9c3c7a9319333d24e456a9c808e18d4afc47589e`（fetch 得到的 origin/3d）。
初次提交 `7764aea08cc8cb93ea2e8667799f414cff21b6fe` 的验证记录（每条测试命令均加 `--no-file-parallelism`，依次运行）：

| 命令/文件 | 结果 | 耗时 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | 12.026 s wall |
| `tests/rendering3d-assets.test.ts` | 8/8 | 271 ms |
| `tests/rendering3d-animation.test.ts` | 6/6 | 229 ms |
| `tests/rendering3d-particles.test.ts` | 13/13 | 240 ms |
| `tests/rendering3d-picking.test.ts` | 9/9 | 223 ms |

素材检查：没有生成 `assets3d-local/`，`git status --ignored --short assets3d-local` 无输出；
测试中的 GLB 只在内存生成，纹理只用内存 Texture。未生成 manifest 输出文件。

追加修复（基于上述初次提交，保留原始验证证据）：v1 未知字段由静默忽略改为严格拒绝，
支持的 sprite 及其嵌套记录均给出拒因和字段路径；三类已知 unsupported kind 仍跳过计数。
本次只运行 `npm test -- tests/rendering3d-particles.test.ts --no-file-parallelism`
（48/48，290 ms，含原有 13 项及新增 35 项）和 `npm run typecheck`（通过，13.239 s wall）。
其余原始测试未重跑；#213 的追加测试仍待父会话确认合入，不属于本次完成项。
CI 入口：`.github/workflows/ci.yml` 的 pull_request 事件（未修改配置或手动触发全套），
检查页为 https://github.com/catfish-xn/cat/pull/212/checks；此记录不表示 CI 已通过。

D10 独立评审问题响应（受审提交 `1ca6729d3349836c7fb9beb5507fd1d0380b06e2`）：

- P1：原 packetDamage 样本缺少 sourceId，补完整 replay 字段后旧实现出现 2 项真实失败
  （7 项中失败 2 项，262 ms）；修复后按事件 type 分派，伤害属于 targetId，不会触发来源的 hit。
  新回归同时断言两方状态，治疗事件保持当前动作，复活仍属于 unitId。
- P2：合成 FS 与 VM 中脚本拿到的 node:path 均使用 path.posix；固定斜线命名空间并断言
  脚本报告的规范路径，避免 Windows 原生分隔符混入。未运行原生 Windows runner。
- 依赖：没有必须使用 0.186 的需求，three 与 @types/three 一起对齐 #213 的 0.180.0，
  package 和 lock 已更新，npm ls 确认实际安装版本。
- 缺失 2D assets：生产 jsGzip 使用 readdirSync，未将缺失目录当 0；只有可选 assets/3d
  缺失返回 0。复用原缺失目录回归并增加交互基线场景，current/base/js-base 三处均报 ENOENT。
  未修改生产预算脚本、表现层、模拟规则或 mountRenderer3d 接线。

在 0.180.0 下逐文件串行运行（均带 --no-file-parallelism），共 94 项通过：

| 文件/检查 | 结果 | 耗时 |
| --- | --- | --- |
| rendering3d-assets.test.ts | 8/8 | 341 ms |
| rendering3d-animation.test.ts | 8/8 | 275 ms |
| rendering3d-particles.test.ts | 48/48 | 335 ms |
| rendering3d-picking.test.ts | 9/9 | 266 ms |
| rendering3d-mode.test.ts | 10/10 | 263 ms |
| rendering3d-budget.test.ts | 11/11 | 191 ms |
| npm run typecheck | 通过 | 12.717 s wall |

仅相关测试，未跑全套、未改时限、未 skip 或放宽既有断言；上述旧版本证据按原 SHA 保留。
