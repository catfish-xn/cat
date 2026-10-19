# 独立 3D 核心（D8）

本目录只提供可选的 3D 基础模块，不接入 2D 入口、不修改战斗规则。宿主使用
`await import('./rendering3d')` 建立异步 chunk；纯动作逻辑也可单独从
`animation-state.ts` 导入，它没有 three、Phaser、DOM 或模拟层运行时依赖。

## 粒子格式 v2（2026-10-19，第 1 段）

`ParticleDocument = ParticleDocumentV1 | ParticleDocumentV2`，manifest 仍为 v1。
`index.ts` 导出两版类型、`BirthValue/ParticleEmission/ParticleLimits/ParticleEmitterV2`、
`parseParticleDocument(unknown): ParticleDocument`、`ParticleEffect` 和 `loadParticleEffect`。
校验先于资源加载及 GPU 分配。v2 从文档到每层嵌套记录均严格拒绝多余字段，
包括暂不渲染的 screenDistortion；不接收原始 CDragon 字段包。
v1 sprite 的严格拒绝规则保持不变，另外三类仍按原有规则 opaque 跳过；
`{schemaVersion:2,emitters:[]}` 缺少预算仍拒绝。v1 不受 v2 时长限制影响。

| v2 字段 | 类型、范围及语义 |
| --- | --- |
| `schemaVersion / emitters` | `2` / `ParticleEmitterV2[]`，最多 1024 个发射器 |
| `limits`（必填） | `{maxParticles,maxDuration}`；存活整数上限 1–10000；总时长 `(0,3600]` 秒，含 delay 与拖尾；到时立即清空，禁止继续发射 |
| `kind` | `quad / mesh / trail / ray / arbitraryQuad / screenDistortion`；v2 不用 v1 名称 sprite |
| `emission` | `{mode:'burst',count}`（整数 0–10000），或 `{mode:'continuous',rate,duration,burst?,loop?:false}`，或 `{mode:'continuous',rate,loop:true,burst?}`；duration 与 loop:true 互斥 |
| `rate / duration / burst` | `(0,10000]` 个/秒，支持小数；duration `(0,3600]` 秒；初始 burst 整数 0–10000，默认 0，delay 结束时仅发一次 |
| `lifetime` | 粒子寿命 `(0,3600]` 秒，或字面量 `'infinite'`；后者仅 continuous + loop:true，必须受文档 limits 约束；不接收数字 -1 |
| `position` | 相对挂点的 `[x,y,z]`，默认零；League 原生单位，+Y 向上、右手系 |
| `size0` | 非负标量、三轴向量或 `{min,max}` 同型范围，默认 1；随机标量各轴同值，随机向量各轴独立均匀抽样；允许零轴，拒绝反向范围、负数、非有限值 |
| `rotation0` | 标量、三轴向量或同型 `{min,max}`，单位为度，默认零；标量只绕局部 Z，向量为 XYZ Euler；范围语义同 size0，允许负角度 |
| `texture / color / opacity / size / frames / dissolve / blend` | 完全沿用下节 v1 的路径、线性 RGB、曲线、图集、程序噪声溶解、混合约定；最终尺寸为 size0 × size 曲线 |
| `delay / velocity / gravity / drag / shape` | 沿用 v1；position + shape 出生点 + 解析运动位移；整体仍由 Group scale（默认 0.6）缩放 |
| `mesh`（mesh 必填） | 相对根 `.glb` 路径，遵守 assetUrl；调用方提供静态、带 UV 的 BufferGeometry；材质取公共 texture/color/blend 等，不继承 GLB 原生材质 |
| `trail`（trail 必填） | `{width:Curve,lifetime,segments,uvMode,tileLength?}`；width 按采样点年龄 / trail.lifetime 取值并乘 size0.x 与 size 曲线；尾寿命 `(0,3600]`，分段整数 2–256 |
| `trail.uvMode` | `stretch` 把整条尾带映射到 U=0..1；`repeat` 按局部累计长度 / 必填正 tileLength 计算 U，shader 周期采样；stretch 不接收 tileLength |
| `direction`（ray 必填） | 非零有限三轴向量；单位平面从局部 Y=0 延伸到 Y=1，旋转使 +Y 对齐 direction，随后应用 rotation0；size0.x 是宽、size0.y 是长 |
| `arbitraryQuad` | 平面位于局部 XY，中心为出生点，应用 rotation0，保持朝向；不追随相机。quad 则先面向相机，再应用 rotation0 |
| `distortion`（screenDistortion 必填） | `{normalMap:string,strength:number}`，路径同 assetUrl，强度 `[0,1]`；类型保留并严格校验，运行时计数跳过，不加载贴图 |

continuous 的周期出生时刻为 `delay + n/rate`（n 从 1 起）；duration 的末时刻包含在内，
但所有出生时刻必须严格早于 effect 的 maxDuration。跨帧保留时间，不按帧四舍五入；
浮点比较容忍 8 ULP。全局按出生时刻推进，同刻按文档顺序，先回收再尝试出生。
超过存活上限立即丢弃，不补发，`droppedParticles` 累计数量；存活数量包括尾巴仍在的 trail。
一次 effect 最多处理 100000 次出生尝试（包括超额丢弃），用尽后停止后续发射并报告原因，
已出生粒子继续到寿命或总时限。宿主 `maxParticles/maxDuration` 只能收紧文档限制。
无限寿命粒子不归一化到有限寿命：所有公共年龄曲线固定采样 t=0，图集仍按真实年龄推进。

trail 是有界、按 update 采样的世界位置带状网格，可跟随挂点平移/旋转；
最多保留 segments+1 个点，超龄点移除。宽带朝相机（无相机用局部 -Z 视线），
rotation0 额外旋转宽带方向；size0.y/z 不改变路径，路径只由运动和挂点决定。
头部停止后保留 tail.lifetime，公共材质曲线固定到头部寿命末点；
不做源引擎的平滑插值、速度驱动发射和子帧挂点轨迹重建。update 步长会影响拖尾采样密度。
ray 与 arbitraryQuad 是上述明确的平面子集；仅凭源 primitive 类型标记无法证明 League
引擎中的射线镜头对齐、轴约定、bindWeight 或朝向模式等价，转换器应逐项确认，不能强转。

`new ParticleEffect(document,{texture?,mesh?,random?,scale?,maxParticles?,maxDuration?})`
不做 I/O；`mesh(path): BufferGeometry|undefined` 与 `texture(path)` 均为借用资源。
`loadParticleEffect(manifest,id,{root?,readTexture?,readMesh?,...options})` 先校验整份文档，
再按路径去重、依次 await 加载网格及贴图；`readMesh(url):Promise<BufferGeometry>`
由转换器/宿主提供（本段不解析 .sco、附着模型子网格或任意 GLB 场景）。没有 readMesh 时
按缺失网格跳过，且不读取其贴图；screenDistortion 同样不读 normalMap。
加载器拥有它加载的纹理和几何，任何阶段失败均释放已成功返回的资源；
直接构造只释放自有平面/拖尾几何及所有自有材质。dispose 幂等、脱离 parent、清空对象，
过期粒子及时释放材质及专有尾带几何；借用资源始终由调用方释放。
公共 API 保留 `object/update(dt,camera?)/finished/dispose/skipped`，无须改外壳；
新增 `particleCount`（v1 为分配数，v2 为含尾巴的存活数）、`droppedParticles` 和
`skippedReasons: readonly {emitterIndex,kind,reason}[]`。skipped 仍按未渲染发射器计数：

| reason | 行为 |
| --- | --- |
| `mesh-resource-unavailable` | v2 mesh 缺少提供的几何，skipped.mesh 加一 |
| `screen-distortion-requires-scene-color` | 缺少宿主场景颜色/深度采样输入，无法做真实折射；skipped.screenDistortion 加一 |
| `total-birth-attempt-budget-exceeded` | 剩余发射器各记录一次，停止后续出生；不增加未渲染发射器的 skipped 计数 |
| `v1-runtime-skips-mesh/trail/screenDistortion` | v1 原行为，新加可读原因；skipped 计数与原来相同 |

严格校验的失败原因保留 `unsupported-particle-field:<字段路径>` 和 v1 公共字段的
`invalid-curve/invalid-color/invalid-texture/invalid-vector/...:<字段路径>`；
v2 专有字段失败为 `invalid-particle-v2:<字段路径>`。非法输入整份拒绝，不作静默降级。

### 第 2 段转换建议与覆盖边界

只读参考为 `assets3d-local/reference/{jinx,vi}-particle-inventory.json`、
`source-json/{jinx,vi}.json` 以及 reports 的 originalFields；测试全部为独立合成样本。
以下是合同表达能力，不能视为 299 个实际发射器已经转换成功：

| 旁路拒绝原因（数量）/源字段 | v2 覆盖与转换建议 |
| --- | --- |
| continuous-emission（76） | 支持常量 rate → continuous.rate；源 emitter lifetime → duration，已确认循环语义的 -1 → loop:true；isSingleParticle → burst（数量另据源语义）；动态 rate/概率表不等价时仍拒绝 |
| v1-runtime-skips-mesh（59） | 部分：VfxPrimitiveMesh.mMesh.mSimpleMeshName 另转静态 GLB + mesh 路径，贴图/颜色/混合用公共字段；AttachedMesh 的骨骼绑定、mSubmeshesToDraw、mLockMeshToAttachment 未实现；缺资源计数跳过 |
| unsupported-primitive:VfxPrimitiveArbitraryQuad（49） | 部分：固定朝向 XY quad + XYZ 出生旋转可表达；源中 primitive 本身只有 __type，须核对局部轴与朝向标志，其余模式不推断 |
| unsupported-primitive:VfxPrimitiveRay（39） | 部分：显式 direction + 长条平面可表达；源中 primitive 只有 __type，射线相机约束/方向推导须转换器确认 |
| unrepresentable-semantics:birthScale0（27） | 支持常量标量/向量及独立均匀 min/max → size0；观测到零轴，因此允许 0；非均匀概率表、随发射时间变化的出生尺寸仍不能无损转成范围 |
| v1-runtime-skips-trail（21） | 部分：CameraTrail/ArbitraryTrail → trail 宽度曲线、尾寿命、分段、UV；mTrail.mBirthTilingSize 可经单位/轴确认后映射 tileLength；mMode、平滑模式、速度发射、UV 滚动不自动丢弃 |
| unrepresentable-semantics:EmitterPosition（20） | 支持 constantValue 向量 → position；动态偏移或概率偏移未定义，仍拒绝 |
| v1-runtime-skips-screen-distortion（4） | 仍不支持渲染；保留严格类型与原因。没有场景颜色采样的半透明 quad 不是折射，不能用它冒充 |
| unrepresentable-semantics:birthRotation0（3） | 支持标量/三轴常量或独立均匀范围 → rotation0；源 probabilityTables 只有确认为均匀独立范围时才可转换，角速度等不覆盖 |
| unrepresentable-semantics:lifetime（1） | 部分：须先区别 emitter lifetime 与 particleLifetime；前者 -1 代表循环时映射 loop:true，后者仅在确认为无限粒子且 loop 时映射 'infinite'；两者始终要求 limits，不直接传入 -1 |

源 birthColor/color 的 RGB/alpha 应分别折合 color 与 opacity，保持 v1 线性颜色、曲线及
混合规则；源 particleLifetime 常量才映射粒子 lifetime，不能误把 emitter lifetime 当粒子寿命。
birthScale0 的 min/max 仅表示均匀分布，非均匀 probabilityTables 仍报告拒绝；
scale0 的非等比随龄曲线、向量 drag、旋转速度、bindWeight、源 erosion 贴图、
子发射器、材质 pass/depthBias/navmesh 等尚无 v2 等价字段，禁止静默丢失。

### 本段验证

`npx.cmd tsc --noEmit` 通过；以下每个文件均独立串行执行
`npx.cmd vitest run tests/<文件名> --project fast --configLoader runner --no-file-parallelism`：

| 文件 | 通过条数 |
| --- | --- |
| rendering3d-animation.test.ts | 8 |
| rendering3d-assets.test.ts | 8 |
| rendering3d-budget.test.ts | 11 |
| rendering3d-isolation.test.ts | 1 |
| rendering3d-mode.test.ts | 10 |
| rendering3d-particles.test.ts（既有断言原样保留） | 48 |
| rendering3d-particles-v2.test.ts（合成样本） | 112 |
| rendering3d-picking.test.ts | 9 |
| 合计 | 207 |

这里只验证合同、three 对象/几何/uniforms、资源生命周期及生产构建的 2D 隔离，
没有浏览器 WebGL 画面验收，也没有转换或提交真实参考素材；第 2 段仍须做真实素材视觉核对。
本段未修改外壳、依赖、既有测试断言或时限。

## D7 素材契约 v1（保留）

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
