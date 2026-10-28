# v26-A：3D PvP 传送门与灯光描边

基准：`claude/v26-portal-lighting`，HEAD `d8e146ee`（v26 素材准备），父提交 `686f3086` 与本地 `origin/codex/v25-integration-2` 一致。未写 `.git`，未提交、合并；本任务不进入 integration-2。未改规则、数值、simulation、server 或 2D 入口。

## 文件与行为

| 文件:行 | 改动 |
| --- | --- |
| `src/rendering/three-mode/pvp-portal.ts:13`（新增） | 程序化环形传送门；正常备战→PvP 开战时，敌方由远端落向实时目标位置。每棋子 0.62 秒，错峰最多 0.18 秒；不阻塞战斗播放、事件或结算。 |
| `src/rendering/three-mode/presentation-lighting.ts:21`（新增） | 半球光；共享径向 alpha 贴图的接触阴影；仅悬停对象增加队伍色背面轮廓，沿用模型骨骼、形变和几何。 |
| `src/rendering/three-mode/placeholder-renderer.ts:349`（已有） | 两个模块的初始化与质量设置；后续只挂接画面帧、悬停、模型替换、尺寸、更新及释放。 |
| `tests/rendering3d-pvp-portal.test.ts:25`（新增） | 动态落点、输入不变、错峰上界、PvE/重连/禁用跳过、死亡/移除/阶段取消、释放。 |
| `tests/rendering3d-presentation-lighting.test.ts:14`（新增） | 质量档位、阴影共享/高度/显隐、队伍色、晚到模型、骨骼/形变借用、资源所有权。 |
| `tests/rendering3d-portal-lighting-mount.test.ts:17`（新增） | 实际 renderer 与 feed 接线、头顶信息跟随、鼠标悬停、侦察/减少动态效果取消、无资源请求、无领域命令。仅替代 GPU/DOM。 |
| `tests/rendering3d-death.test.ts:231`（已有） | 旧测试用“两个子节点的 Group”定位棋子，会误取新传送门；改为定位既有 pawn 的父节点，死亡断言不变。 |

**改动的已有文件只有 `placeholder-renderer.ts` 与 `rendering3d-death.test.ts`。** 其余是上表新增文件与本文。未碰同期商店卡、HUD、字体文件。

画面 feed 已把敌方放到远端半场，传送门沿用该视角；没有新增实际主客场判定或切换棋盘规则。首次挂载已经在战斗、重连、切换观战不补播。PvE、隐藏或死亡棋子不入场；阶段退出、侦察、选秀、减少动态效果开启时取消并恢复最新目标位置。

本地未找到传送门素材，采用程序化兜底，无下载。原有 `assets3d-local` 是任务开始前就存在的未跟踪软链接，未修改、复制或加入素材文件。

## 开关与成本

在现有 3D 地址追加 `&quality3d=...`，刷新后生效；不指定时为 `balanced`。

| 档位 | 行为 |
| --- | --- |
| `off` | 关闭本次新增的灯光、阴影、轮廓和传送门；保留原有灯光。 |
| `low` | 半球光、传送门；无接触阴影或悬停轮廓。 |
| `balanced`（默认） | 半球光、32×32 共享阴影贴图、2 CSS px 悬停轮廓、传送门。 |
| `high` | 同 balanced，阴影贴图 64×64，轮廓 3 CSS px。 |

接触阴影是脚底软阴影近似，每棋子一张平面；没有全场 shadow map、额外渲染目标或全屏后处理。传送门仅两个网格，结束即隐藏；轮廓只复制当前悬停身体的网格，借用几何和骨骼，释放模型前先拆下。实际 GPU 帧率尚未测量，不能据此宣称已经验证“无掉帧”。

## 验证与 gzip-9

同一依赖与工具链，修改前先构建 `d8e146ee`，修改后重新构建；逐个 JS 以 gzip level 9 压缩后求和，沿用未修改的 `scripts/m7-budget.cjs` 计量函数。

| 分包 | 修改前 B | 修改后 B | 增量 B |
| --- | ---: | ---: | ---: |
| 2D：顶层 `assets/*.js` | 635,487 | 635,485 | -2 |
| 3D：`assets/3d/*.js` | 333,961 | 335,832 | +1,871 |

2D 上限仍为 **637,144 B**，余量 **1,659 B**；相对文档签收 M7 锚点 424,763 B 为 **1.496093 倍 < 1.50**。2D 的数 B 波动来自生成的分包文件引用/hash；入口源代码未改。HTML 不预加载 3D 或 solo。真实 Rollup 图验证 3D 没有静态引入 2D/UI 分包，2D 静态图没有 three.js。预算和隔离测试均未放宽。

- 3D 与 VFX 回归：**61 文件、759 测试通过**（`rendering3d-*.test.ts`、`vfx-ltk-*.test.ts`），包含真实构建的 `rendering3d-isolation` 与 `rendering3d-budget`。
- 最后小改后复验新增三组测试和 isolation：**4 文件、21 测试通过**。
- 最终 `npm run typecheck`、production build、`git diff --check` 通过。
- `node_modules` 为指向只读共享目录的软链接，默认 Vite 配置打包临时文件会报 EROFS；构建使用 `node node_modules/vite/bin/vite.js build --configLoader runner`，未改依赖或配置。
- 测试使用 `artifacts/v26-a/vitest-no-browser.config.mjs`，继承原测试配置，仅清空 globalSetup，避免其启动 Chromium；运行 `node node_modules/vitest/vitest.mjs run --project fast --config artifacts/v26-a/vitest-no-browser.config.mjs --configLoader runner --cache=false --maxWorkers=4 tests/rendering3d-*.test.ts tests/vfx-ltk-*.test.ts`。
- 本地证据（忽略、不提交）：`artifacts/v26-a/{budget.json,3d-tests.log,final-checks.log,typecheck.log,build.log}`。M7 **JS 体积门禁通过**；M7 首次可交互时间的浏览器配对实测未运行。

## 浏览器补验

当前没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，依据 AGENTS.md 的浏览器桥接要求，本轮无截图和实际 WebGL/FPS 结果。需要 Claude 通过 `codex-browser exec -C /home/aiapps/workspcae/cat-cx-sol-t6 ...` 新启动浏览器验证任务，再连接入口提供的浏览器；不在内层启动 Chrome。

1. 使用桌面 Chromium 与开发联机入口：`npm run dev:online`，地址 `?mode=online&server=ws&render=3d&debug3d&quality3d=balanced`。已有本地模型服务时沿用原 `assets3d` 地址；否则占位棋子也能验证。
2. 正常进入 PvP 开战，连续采样头 0.8 秒：远端出现传送门，敌方落到对面，血条/星级随棋子；PvE 不播放。检查控制台无 shader 编译错误。
3. 备战时悬停我方，战斗落地后悬停敌方：分别为蓝色、红色轮廓；移出清除。使用实际蒙皮模型检查走路、转向和动画中的轮廓贴合，特别关注透明材质。
4. 入场途中切换侦察/选秀、启用减少动态效果，确认无残留悬空；战斗中刷新/重连不补播。
5. 同阵容、同镜头、同分辨率，分别刷新 `quality3d=off/low/balanced/high` 比较 FPS 和 draw calls（`window.__render3d.renderer.info.render.calls`）。截图至少留入场中、落地、双方悬停；确认默认档无明显帧率下降，低端机器可用 low/off。
