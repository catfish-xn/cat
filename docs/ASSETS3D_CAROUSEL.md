# 选秀转盘：本地素材与接线需求

## 交付与复现

14.24 本地 Map22 / TFTCommon 离线扫描得到 156 个条目，全部可读；`inventory.json` 逐项列出来源、缓存状态和分块，`scene-objects.json` 保存场景依赖。`carousel-plan-4.json` 缺块为零。原有计划保留，输入缓存只读，没有下载。

素材、提取中间文件、manifest、precache 和截图均位于被现有忽略规则覆盖的真实目录 `assets3d-local/carousel/`。仓库只保留转换器、合成测试和本文；不改界面或领域规则。

构建：`node scripts/assets3d/carousel-build.mjs`。默认重扫闭包，发现缺块则先写 `carousel-plan-4.json` 并停止；闭包完整后再转换。复看：设置本机 `CHROMIUM_PATH`，运行 `node scripts/assets3d/carousel-browser-review.mjs`。两者均不联网，浏览器只允许本机 HTTP 请求。

合并后的 `manifest.json` 含 9 个静态模型和 15 个近似粒子系统，所有键均以 `carousel-` 开头；`merge-manifests` 生成的 `precache.json` 含 58 个运行时文件。GLB 内嵌漫反射贴图，粒子依赖使用本包相对路径。不要把 `extracted/`、`build-report.json` 或原始 BIN 放入预缓存。

`runtimeReady` 和 `sourceClosureReady` 为 true，表示输出包与已发现依赖闭包可用。`build-report.json.ready` 仍为 false：13 个粒子网格受到已有转换器限制，不能宣称全部源网格转换成功。粒子遗漏不妨碍这次可提取资源的交付；原字段、逐发射器结果与未输出系统均留在本地报告中。

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

Map BIN 中筛出 23 个 carousel/shared draft 系统，所有纹理和网格输入均已缓存。15 个可输出系统共保留 63 个近似发射器；114 个发射器跳过，41 个拒绝，没有用空文档冒充成功。

| manifest.effects 键（均有 `carousel-` 前缀） | 当前输出 |
| --- | --- |
| `shareddraftplayerrestraint`、`shareddraftplayerrestraint-enemy` | 基础约束圈 |
| `shareddraftplayerrestraint-reckoning`、`shareddraftplayerrestraint-reckoning-enemy` | Reckoning 变体 |
| `shareddraftplayerrestraint-galaxy`、`shareddraftplayerrestraint-galaxy-enemy` | Galaxy 变体 |
| `shareddraft-firstdraftwall-reckoning`、`shareddraft-firstdraftwall-galaxy`、`shareddraft-firstdraftwall-dragon`、`shareddraft-firstdraftwall-journeys` | 四种边界变体 |
| `shareddraft-firstdraftwall-death-galaxy` | 边界消退 |
| `shareddraft-teleport`、`shareddraft-unitselected` | 传送、选择反馈 |
| `shareddraft-playerindicator`、`shareddraft-releasetimerring-6s` | 玩家标记、计时环近似 |

未进入 manifest 的八个系统：`carousel-shareddraft-beam`（缺少光束端点/二级遮罩）；`carousel-shareddraft-unittier1` 至 `carousel-shareddraft-unittier6`（`overrideScaleCap` 等系统字段未映射）；`carousel-shareddraft-crystal`（未知系统字段、未提供网格）。不能宣称品质圈、光束或水晶已还原。

13 个粒子网格不能转换，其中 11 个带顶点色、2 个非零枢轴；二级遮罩、旋转方向发射、动态子粒子和场景扭曲也有遗漏。上述是格式/语义限制，不是缓存缺块。保留的效果仍属于近似结果；不同年代的变体只供显式选择，不代表标准 S13 应同时播放这些变体。

## 浏览器证据与验证

`review/` 包含 27 张 PNG：整体地台、含远景的完整场景、建议站位示意、九个单模型和十五个可输出效果。每张含俯视、斜视和三个采样时刻；静态模型重复采样用于对齐同一复看版式。每条网格间隔为一格，地台图中的矩形仅是 7 × 8 格尺寸参照，不替代六角棋盘布局。

`scene-stage.png` 可见八个外托架、中央玻璃与下部结构；`scene-full.png` 展示远景原本位于平台下方/后方的关系。`scene-layout.png` 中的线框单位为建议站位参照，不是提取的英雄或源动画。建议英雄高度约 1.5 格、小小英雄约 0.75 格，最终以现有单位模型基准比例为准。

`review-report.json` 记录资源请求、WebGL 检查、逐时刻包围盒和建议站位。58 个预缓存文件逐一校验大小与 SHA-256；浏览器错误列表为空。局部选择/传送反馈约一格量级，基础约束圈直径约 2.7 格，首轮边界变体约 8 至 13.3 格；相机按全部采样范围适配，不能把截图中的自适应取景误当成素材缩放。

复看还发现两项可见限制：基础约束圈早段保留亮环，后段出现明显灰色带状网格；计时环当前主要剩紫色亮点和尾迹，没有完整环形倒计时。这些文件可加载不等于可直接作为最终界面效果；建议约束圈只选已复看的早段，计时环先不启用。不要把灰带描述成原版护罩还原。

部分单次效果在后续采样已结束，属于原转换文档的有界生命周期。`6s` 只是源名称的一部分，当前近似输出在该时刻仍有粒子；不能用此名字或粒子结束来驱动服务器选秀倒计时，也不能承诺无限持续待机。

合成验证命令：`npm.cmd test -- --configLoader runner tests/assets3d-carousel.test.ts tests/assets3d-tft-extras.test.ts tests/assets3d-neutrals.test.ts`。三个文件、18 个测试通过；覆盖 MAPG 解析/异常输入、仿射定位与绕序、半精度 UV、嵌入贴图、稳定键、依赖分块、真实转换出的合成粒子与模型合并、预缓存哈希和重复合并。测试无需本地版权素材。

全仓 `npm.cmd run typecheck` 未通过：现有 `tests/assets3d-compress.test.ts` 缺少 `@gltf-transform/core`、`ktx-parse`、`sharp` 三个本地依赖；本次新增文件没有额外类型诊断。按离线约束未安装依赖，也未修改配置或添加空声明。

## 界面接线需求

- 仅在权威状态已进入选秀且启用 3D 时展示。读取可配置素材根的 manifest/precache；以共同根组加载地台各件，保持现有缩放和共同原点。离开选秀或切换显示模式时释放模型与粒子资源。
- 相机主要覆盖约 17.2 格的八托架外沿；中央地台约 15.1 格。skybox 与下部景物按原相对位置作为可选景物，不参与站位、拾取或镜头尺寸计算。
- 外圈八个小小英雄锚点建议等角分布、距中心约 7.1 格，使用公开座位顺序稳定映射；朝向中心。脚点应对实际托架表面射线贴合，不能把整体包围盒最低点当托架表面。站位示意脚点约高于共同原点四分之一格，仅供复看参考。
- 待选英雄建议放在中央玻璃范围内、距中心约 2.5 格的圆周上，数量来自公开选秀条目；示意图九个线框仅是样例，不固定槽位数。英雄脚点对玻璃表面贴合；英雄和公开物品标记绑定同一条目 ID，选择命令仍只调用现有公共接口。
- 为待选英雄/站位标记建立独立轨道组；同一角度同时决定其圆周位置和展示朝向。建议面向圆周切线；若已有权威位置/旋转投影则直接使用，否则以稳定条目顺序和阶段起点作展示插值，不以帧数累计槽位。仅旋转该展示组，保持外圈托架和地台不动；这是表现约定，不是恢复出的原版动画。速度由表现层调节，不能影响可选状态、领取顺序或选秀结束。
- 未提供权威轨道数据时，保持稳定排序的静态环形站位也可用；表现位置不成为领域坐标。拾取映射回公开条目 ID，成功回执/状态确认后才移除对应英雄、物品和站位反馈；失败保留，重连重建当前状态而不重播旧选择。
- 基础约束圈若启用，仅取已复看早段并挂在小小英雄锚点；选择反馈挂在被领取英雄锚点，首轮边界挂在转盘中心；不同皮肤变体显式择一。计时环暂不作为正式环形 UI 启用。未输出的品质圈/光束/水晶保持缺席，不按名称猜替代。计时、释放和领取以权威数据为准，粒子只作有界展示；宿主在阶段结束、条目消失或切场时 dispose。
