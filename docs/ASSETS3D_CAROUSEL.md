# 选秀转盘：本地素材与接线需求

## 交付与复现

14.24 本地 Map22 / TFTCommon 离线扫描得到 156 个条目，全部可读；`inventory.json` 逐项列出来源、缓存状态和分块，`scene-objects.json` 保存场景依赖。此次 `carousel-plan-5.json` 缺块为零。原有计划保留，输入缓存只读，没有下载。

素材、提取中间文件、manifest、precache 和截图均位于被现有忽略规则覆盖的真实目录 `assets3d-local/carousel/`。仓库只保留转换器、合成测试和本文；不改界面或领域规则。

构建：`node scripts/assets3d/carousel-build.mjs`。默认重扫闭包，发现缺块则先写 `carousel-plan-4.json` 并停止；闭包完整后再转换。复看：设置本机 `CHROMIUM_PATH`，运行 `node scripts/assets3d/carousel-browser-review.mjs`。两者均不联网，浏览器只允许本机 HTTP 请求。

默认缓存入口不存在时，调用导出的 `planCarousel({ source, planName: 'carousel-plan-5.json' })`，再调用 `buildCarousel({ source, planName: 'carousel-plan-5.json', discover: false })`；`source` 指向现有只读缓存，不创建或改写联接。先确认计划缺块和发现失败均为零再构建。

合并后的 `manifest.json` 含 9 个静态模型和 21 个近似粒子系统，所有键均以 `carousel-` 开头；`merge-manifests` 生成的 `precache.json` 含 94 个运行时文件。GLB 内嵌漫反射贴图，粒子依赖使用本包相对路径。不要把 `extracted/`、`build-report.json` 或原始 BIN 放入预缓存。未被可播放发射器引用的已转换网格仅留在构建目录，单独复看不要求它们进入运行时预缓存。

`ready`、`runtimeReady` 和 `sourceClosureReady` 为 true，表示模型/网格转换、输出包与已发现依赖闭包可用；不表示所有系统和发射器语义完整。原字段、逐发射器结果、`particleMeshes` 格式报告与未输出系统均留在本地报告中。

## 模型与棋盘格比例

统一复用现有模型/粒子缩放。以下是包围盒的宽 × 高 × 深，单位均为棋盘格，不是占用格或碰撞体；景物在平台下方的高度也计入包围盒。坐标重心、反射与源变换见本地 `coordinatePolicy`；GLB 已烘焙源变换及 X 反射，加载后不要重复反射、逐件居中或逐件贴地。

| manifest.models 键 | 内容与缓存 | 宽 × 高 × 深（格） |
| --- | --- | --- |
| `carousel-center` | 中央圆形地台/环形地面，已缓存 | 15.15 × 1.30 × 15.12 |
| `carousel-center-b` | 中央下部结构，已缓存 | 7.15 × 8.43 × 7.13 |
| `carousel-llplatforms` | 外圈八个小小英雄托架的整体，已缓存 | 17.20 × 0.99 × 17.18 |
| `carousel-glassdome-a` | 中央玻璃盖，已缓存 | 6.75 × 0.49 × 6.75 |
| `carousel-reflectionplane` | 中央反射面，已缓存 | 7.97 × 0 × 7.97 |
| `carousel-kitpieces-a` | 外部/下部装饰，已缓存 | 16.01 × 21.08 × 16.54 |
| `carousel-kitpieces-b` | 周边装饰，已缓存 | 21.05 × 10.50 × 11.88 |
| `carousel-kitpieces-c` | 中央下部装饰，已缓存 | 5.35 × 8.01 × 5.37 |
| `carousel-skybox` | 远景弧面，已缓存 | 69.71 × 32.98 × 18.20 |

选择标准 S13 几何；memorybudget 空版本与 TMO 几何变体仅列在盘点中。标准材质自身引用的 TMO 后缀贴图仍按真实绑定读取，不能仅凭文件后缀替换。

九个模型来自同一静态场景，没有独立、可直接播放的旋转环动作，也没有逐个英雄站位的独立托架模型。外圈八托架属于小小英雄；不要把它们误当成待选英雄的八个槽位。`center` 含环形地面，但不能据此把整个地台和八托架一起旋转。

材质使用无光照漫反射近似；玻璃与反射面降低不透明度。烘焙光照、法线、雾、真实反射、视差和材质滚动未还原；skybox 是保留空间位置的弧面，不能作为天空球使用，也不应用它的整体包围盒决定选秀镜头。

## 粒子与限制

Map BIN 中筛出 23 个 carousel/shared draft 系统，所有纹理和网格输入均已缓存。21 个可输出系统共保留 148 个近似发射器；48 个发射器跳过，22 个拒绝，没有用空文档冒充成功。相比前次新增 6 个系统、85 个近似发射器。

| manifest.effects 键（均有 `carousel-` 前缀） | 当前输出 |
| --- | --- |
| `shareddraftplayerrestraint`、`shareddraftplayerrestraint-enemy` | 基础约束圈 |
| `shareddraftplayerrestraint-reckoning`、`shareddraftplayerrestraint-reckoning-enemy` | Reckoning 变体 |
| `shareddraftplayerrestraint-galaxy`、`shareddraftplayerrestraint-galaxy-enemy` | Galaxy 变体 |
| `shareddraft-firstdraftwall-reckoning`、`shareddraft-firstdraftwall-galaxy`、`shareddraft-firstdraftwall-dragon`、`shareddraft-firstdraftwall-journeys` | 四种边界变体 |
| `shareddraft-firstdraftwall-death-galaxy` | 边界消退 |
| `shareddraft-teleport`、`shareddraft-unitselected` | 传送、选择反馈 |
| `shareddraft-playerindicator`、`shareddraft-releasetimerring-6s` | 玩家标记、计时环近似 |
| `shareddraft-unittier1` 至 `shareddraft-unittier6` | 新增品质圈近似；保留有界生命周期，非完整原版待机 |

原先八个未输出系统逐项结论：

| 系统名称（均有 `carousel-` 前缀） | 处理与剩余原因 |
| --- | --- |
| `shareddraft-unittier1` | 可输出；`overrideScaleCap` 采用固定宿主缩放约定。未知发射器字段仍以 `unmapped-source-field:{33f36f05}` 拒绝。 |
| `shareddraft-unittier2` | 同上，独立输出。 |
| `shareddraft-unittier3` | 同上，独立输出。 |
| `shareddraft-unittier4` | 同上，独立输出。 |
| `shareddraft-unittier5` | 可输出；另保留 `unexpressible-emitter:rotated-directional-emission`，避免方向分布被压成片。 |
| `shareddraft-unittier6` | 可输出；另保留 `unexpressible-emitter:opaque-base-requires-secondary-mask` 和 `invalid-source-linger:particleLinger`。 |
| `shareddraft-beam` | 不输出；`beam-endpoints-unavailable`，以及 `unexpressible-emitter:opaque-base-requires-secondary-mask`。源系统没有可恢复的端点，不能凭名称补光束。 |
| `shareddraft-crystal` | 不输出；`mesh-resource-unavailable` 和 `unmapped-system-field:{332b2c86}`。网格图元未指定网格资源，系统还带未知结构；原生异常已改为稳定缺资源码，不能用空白占位冒充水晶。 |

`overrideScaleCap` 不是粒子尺寸乘数。近似模式校验该字段后，明确记录固定宿主缩放下省略绑定对象缩放上限；严格模式仍拒绝它。没有丢弃未知系统字段，也没有新增单资源名称特例。二级遮罩、旋转方向发射、动态子粒子和场景扭曲仍按已有错误码跳过；计时环中不能满足尺寸契约的发射器仍报告 `contract-rejected:invalid-particle-v2:$.emitters[0].size0`。

原先受限的 13 个粒子网格全部转换，当前全部 20 个粒子网格均成功：

- SCB 顶点色：11 个粒子网格带顶点色，通用解析后保留（逐项名称在本地 carousel 报告中）。
- SCO 中心/枢轴元数据：2 个网格带中心/枢轴元数据。这些不是需要再施加的顶点平移；保留源顶点，不逐网格居中。SCO 可选枢轴和顶点色段也采用通用解析（逐项名称在本地报告中）。

SCB 的 BGRA 顶点数据转换成 GLB `COLOR_0`，反射绕序和 UV 接缝同步保留；粒子运行时乘入插值后的 RGB 和透明度，避免丢失边缘淡出。不支持的版本/标志、非法长度和颜色仍失败关闭，原错误码经 `meshReasons` 传给发射器报告。不同年代的变体仍只供显式选择，不代表标准 S13 应同时播放。

英雄批次影响只读盘点见 `fx-batch-impact.json`：`fx-batch1` 至 `fx-batch6` 分别有 23、12、30、15、16、23 个系统涉及原顶点色、枢轴、系统缩放上限限制；这是按批次的受影响条目数，不是新增转换成功数。现有运行时网格均未带顶点色，因此着色器改动不会给这些旧文件凭空加色。六个目录均为只读联接，本次没有重生；后续在其可写工作区重生并复看。

## 浏览器证据与验证

`review/` 的 53 项逐项截图覆盖整体地台、含远景的完整场景、建议站位示意、九个单模型、二十一个可输出效果和二十个粒子网格；加上 `contact-effects-*`、`contact-meshes-*` 总览，共 61 张 PNG。每张逐项图含俯视、斜视和三个采样时刻。网格单图只显示几何和顶点色，不冒充带纹理的完整效果。每条网格间隔为一格，地台图中的矩形仅是 7 × 8 格尺寸参照，不替代六角棋盘布局。

`scene-stage.png` 可见八个外托架、中央玻璃与下部结构；`scene-full.png` 展示远景原本位于平台下方/后方的关系。`scene-layout.png` 中的线框单位为建议站位参照，不是提取的英雄或源动画。建议英雄高度约 1.5 格、小小英雄约 0.75 格，最终以现有单位模型基准比例为准。

`review-report.json` 记录资源请求、WebGL 检查、逐时刻包围盒和建议站位。94 个预缓存文件逐一校验大小与 SHA-256，浏览器错误和运行时跳过均为空。新增程序生成的小平面 GPU 探针，检查红色顶点的半透明混合确实与背景合成，避免只靠着色器字符串测试宣称支持透明度。相机按全部采样范围适配，不能把截图中的自适应取景误当成素材缩放。

新增六个品质圈在抽查时刻直径约 1.18 格，贴地显示，未见白色矩形、黑色底片、意外竖片或铺屏。它们没有完整恢复调色板、二级遮罩等语义，颜色和品质区分只能作为近似展示。单网格复看会按其实际包围盒取景；很小的源网格也能放大检查，素材缩放没有改变。无纹理网格单图中的白色面是明确标注的几何检查，不是完整效果的贴图缺失。

复看还发现两项可见限制：基础约束圈早段保留亮环，后段出现明显灰色带状网格；计时环当前主要剩紫色亮点和尾迹，没有完整环形倒计时。这些文件可加载不等于可直接作为最终界面效果；建议约束圈只选已复看的早段，计时环先不启用。不要把灰带描述成原版护罩还原。

部分单次效果在后续采样已结束，属于原转换文档的有界生命周期。`6s` 只是源名称的一部分，当前近似输出在该时刻仍有粒子；不能用此名字或粒子结束来驱动服务器选秀倒计时，也不能承诺无限持续待机。

本轮合成验证：`npm.cmd test -- --configLoader runner tests/assets3d-carousel tests/assets3d-particles-v2.test.ts tests/rendering3d-particles tests/rendering3d-particle-readers.test.ts tests/assets3d-visual-approximate.test.ts`。七个文件、363 个测试通过；新增覆盖彩色小网格的 RGBA/绕序、中心与枢轴、非法格式与预算、系统字段近似和严格模式隔离、缺网格错误码与运行时资源所有权。测试只用假名、程序生成网格和整齐数值，无需本地版权素材。

全仓 `npm.cmd run typecheck` 未通过：现有 `tests/assets3d-compress.test.ts` 缺少 `@gltf-transform/core`、`ktx-parse`、`sharp` 三个本地依赖；本次新增文件没有额外类型诊断。按离线约束未安装依赖，也未修改配置或添加空声明。

## 界面接线需求

- 仅在权威状态已进入选秀且启用 3D 时展示。读取可配置素材根的 manifest/precache；以共同根组加载地台各件，保持现有缩放和共同原点。离开选秀或切换显示模式时释放模型与粒子资源。
- 相机主要覆盖约 17.2 格的八托架外沿；中央地台约 15.1 格。skybox 与下部景物按原相对位置作为可选景物，不参与站位、拾取或镜头尺寸计算。
- 外圈八个小小英雄锚点建议等角分布、距中心约 7.1 格，使用公开座位顺序稳定映射；朝向中心。脚点应对实际托架表面射线贴合，不能把整体包围盒最低点当托架表面。站位示意脚点约高于共同原点四分之一格，仅供复看参考。
- 待选英雄建议放在中央玻璃范围内、距中心约 2.5 格的圆周上，数量来自公开选秀条目；示意图九个线框仅是样例，不固定槽位数。英雄脚点对玻璃表面贴合；英雄和公开物品标记绑定同一条目 ID，选择命令仍只调用现有公共接口。
- 为待选英雄/站位标记建立独立轨道组；同一角度同时决定其圆周位置和展示朝向。建议面向圆周切线；若已有权威位置/旋转投影则直接使用，否则以稳定条目顺序和阶段起点作展示插值，不以帧数累计槽位。仅旋转该展示组，保持外圈托架和地台不动；这是表现约定，不是恢复出的原版动画。速度由表现层调节，不能影响可选状态、领取顺序或选秀结束。
- 未提供权威轨道数据时，保持稳定排序的静态环形站位也可用；表现位置不成为领域坐标。拾取映射回公开条目 ID，成功回执/状态确认后才移除对应英雄、物品和站位反馈；失败保留，重连重建当前状态而不重播旧选择。
- 基础约束圈若启用，仅取已复看早段并挂在小小英雄锚点；选择反馈挂在被领取英雄锚点，首轮边界挂在转盘中心；不同皮肤变体显式择一。计时环暂不作为正式环形 UI 启用。光束/水晶保持缺席，不按名称猜替代。计时、释放和领取以权威数据为准，粒子只作有界展示；宿主在阶段结束、条目消失或切场时 dispose。
- 本轮新增接线清单（由 Claude 实施）：使用更新后的 manifest/precache；按公开品质映射 `carousel-shareddraft-unittier1` 至 `carousel-shareddraft-unittier6`，挂在对应待选英雄的展示锚点，保留共同缩放。它们是有界反馈，不承诺无限待机；条目移除或阶段结束时释放，不靠效果结束驱动领域流程。网格加载需保留 GLB 几何的 `color` 属性，交给 `ParticleEffectV2` 着色，不克隆成丢色的简化几何。本次未改 `src/rendering/` 接线。
