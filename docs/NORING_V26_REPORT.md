# noring v26：移除 3D 棋子常驻脚下光圈

【光圈来源与功能】

已核对分支 `claude/v26-no-foot-ring`、基线 `4baaaf5a`。下表注明“基线”的行号对应修改前；其他行号对应当前文件。

| 来源（文件:行） | 原有功能 | 处理 |
| --- | --- | --- |
| 基线 `src/rendering/three-mode/placeholder-renderer.ts:352`、`:357`、`:784`、`:1063` | 每个棋盘/备战席棋子的常驻 `RingGeometry(18,23)`；蓝/红阵营材质，随棋子移动。并不随选中、悬停、星级或异变改变 | 删除几何体、材质、实例及阵营换色接线；正常模型、缺失模型替身、召唤物和野怪使用同一个创建入口，均不再加脚环 |
| 基线 `src/rendering/three-mode/carousel-stage.ts:197`、`:506`、`:538` | 选秀交互脚环：可选、悬停、待服务器确认三种颜色 | 删除；品质/可选性移到头顶小标记，悬停抬起 5、待确认抬起 10；拒绝或取消悬停后复位 |
| 基线 `src/rendering/three-mode/carousel-stage.ts:508`、`:525`、`:67` | 选秀常驻费用色环，以及反复播放的 `carousel-shareddraft-unittier1..6` 品质特效；两层可能同时存在 | 两层都删除，不再启动该循环特效；费用色由头顶小标记保留，完整棋子信息仍由原有悬停详情提供 |
| `src/rendering/three-mode/placeholder-renderer.ts:1206`、`:1266` | 六边形落点格边框；可落点青色、拒绝落点红色；棋盘和高备战席都使用它 | 保留，只在拖放目标存在时显示，取消/结束拖动后隐藏 |
| `src/rendering/three-mode/skill-feel.ts:112`、`:181`、`:194`；`src/rendering/three-mode/placeholder-renderer.ts:913` | 技能蓄力收束环、命中扩散环；短时战斗反馈，结束后回收到隐藏池 | 保留，不是常驻阵营/选中脚环 |
| `src/rendering/three-mode/unit-control.ts:100`；`src/rendering3d/star-mark.ts:19` | 控制时绕头顶转的眩晕星星；独立的 1–4 星星级行 | 保留，均在头顶，与脚环无关 |
| `src/rendering/three-mode/placeholder-renderer.ts:573`；`src/rendering/three-mode/scout-stage.ts:137`、`:191` | 异变献祭格的紫色格子，以及侦察棋子头顶的异变宝石 | 保留；棋盘脚环本身没有承担异变标记 |
| `src/rendering/three-mode/carousel-stage.ts:191`、`:228`、`:552`、`:557`、`:611` | 选秀整座舞台的底盘/玻璃和小小英雄座台；小小英雄未解锁时的束缚环/倒计时，以及本人指示特效 | 保留；属于舞台和小小英雄的解锁/身份提示，不是战斗棋子的脚环；本人特效缺失时的替身是头顶球 |
| `src/rendering/three-mode/carousel-stage.ts:452`、`:468` | 选秀确认拿取、移走棋子或解除束缚时的短暂爆发；素材缺失时使用扩散环替身 | 保留，替身 0.5 秒后消失，非持续脚环 |
| `src/rendering/three-mode/trait-props.ts:153` | 场边征服者旗帜/微光瓶的圆盘辉光，显示征服进度和微光填充 | 保留；位于场边道具下，不属于棋子 |
| `src/rendering3d/assets.ts:39`、`src/rendering3d/particles.ts:151`、`src/rendering3d/particles-v2.ts:52`；`src/rendering3d/contracts.ts:26` | 通用 GLB/粒子加载解释器可能绘制素材中的圆形效果；`selection` 指动作播放选择 | 没有独立添加棋子阵营/选中脚环；不改通用解释器或技能素材。`scout-stage` 原本也不创建棋子脚环 |

【完成】

- `src/rendering/three-mode/placeholder-renderer.ts:779`：棋子根节点只装载身体，移除常驻阵营环；`src/rendering/three-mode/cast-lunge.ts:4` 同步修正说明。
- `src/rendering/board-feed.ts:45`、`src/rendering/BoardScene.ts:1445`：新增只读 `BoardFrame.selectedId`，直接传递 BoardScene 的选择状态，不在 3D 层另建选择状态机。已有订阅机制保证 2D 模式不会构造这些帧。
- `src/rendering/BoardScene.ts:1427`、`:1438`：帧投影复用本次读取的 state/combat；可选星级、野怪、控制字段直接取原值，无值时为 `undefined`，省去空对象展开和重复 Map 查询；数值与原语义相同，由实际 BoardScene 帧输出测试覆盖。
- `src/rendering/three-mode/placeholder-renderer.ts:1496`、`:1505`：选中抬起 5、拖动抬起 10，根节点带着身体、头顶星级和血条一起移动；切换选中、结束拖动或死亡后恢复。不增加后处理描边或克隆模型材质。
- `src/rendering/three-mode/carousel-stage.ts:493`、`:523`、`:582`：选秀改为小型头顶品质方标（原费用色），可选/待确认时不透明，不可选时透明度 0.35；没有费用且不可选时隐藏；确认取走后隐藏，移除棋子/销毁场景时释放材质。
- `src/rendering/three-mode/unit-overhead.ts:12`、`:78` 和 `src/rendering/three-mode/three-loader.ts:101`：确认血条沿用主题注入，己方绿 `#5fd68a`、敌方红 `#f08080`；战斗血条无需依赖脚环。准备阶段沿用原有血条显示条件；模型缺失替身仍有阵营色。
- 仅修改前端、相关测试和本报告；未改规则、服务器、素材、测试超时或构建分包策略，未提交。原有未跟踪的 `assets3d-local` 软链接保持原样。
- 相关验收：14 个文件、136 个测试通过，统一使用 `--maxWorkers=4 --configLoader runner --cache=false`；另跑 TypeScript 检查和生产构建。`runner` 用来避免默认配置加载器写入只读的共享 `node_modules/.vite-temp`。
- 体积：2D JS gzip **630,536 字节 ≤ 用户给定的 637,144 字节门槛**。使用 `scripts/m7-budget.cjs` 相同口径，对 `dist/assets/*.js` 逐文件 gzip level 9 后求和，排除按需 `3d/`、`solo/`、`ui/`；`index.html` 没有预加载 3D 文件。

【替换的断言】

| 当前位置 | 原断言 | 新断言及保留的保障 |
| --- | --- | --- |
| `tests/rendering3d-carousel.test.ts:98`、`:64`、确认取走用例 | `debug().units[].ring` 的 `takable/hover/pending/none` | 改为 `cue` 的同组状态值；增加真实节点高度的 +5/+10、取消悬停与拒绝后复位、可见性与透明度断言；确认前棋子仍在展示组、确认后离开等断言保留 |
| `tests/rendering3d-carousel.test.ts:147` | 请求六种 `unittier` 特效，取走/销毁后释放特效 | 改为断言从不请求 `unittier`；品质标记位于头顶、属于对应棋子，棋子子树无 `RingGeometry`；移除一个棋子只释放其标记一次，最终销毁全部各释放一次 |
| `tests/rendering3d-carousel.test.ts:354` | 常驻脚环颜色等于费用色；拿取后隐藏脚环 | 改为头顶品质标记颜色相同、在头顶、可选前后透明度正确；旧脚环对象不存在；费用未知时不猜品质、确认拿取后隐藏标记 |
| `tests/rendering3d-death.test.ts:229` | 用根节点恰有两个子对象（身体+脚环）来定位替身 | 用 `render3d-pawn` 定位，断言根节点只有身体一个子对象且没有环几何体；原有死亡 1 秒仍可见、1.25 秒隐藏、复活重显和无资产请求断言全部保留 |
| `tests/rendering3d-carousel.test.ts:45`、`:209` | 按“第一个 Sprite”“第 3 个子对象”定位装备/星级 | 分别按装备名称、更新后的星级位置定位；原装备详情框命中和旋转棋子的脚部/星级点击断言全部保留 |

新增 `tests/rendering3d-bench.test.ts:151`、`:171` 覆盖无常驻环、权威选中/拖动、死亡复位、高备战席可落/拒绝颜色及取消隐藏；`tests/rendering3d-overhead.test.ts:15` 覆盖己方绿条与敌方红条互斥绘制；`tests/m8-b8-token-lifecycle.test.ts:302` 直接验证 BoardScene 的选中和可选元数据输出。未删除测试用例、弱化业务断言或提高超时。

【风险】

- **截图验证未实跑**：本任务的 `CODEX_BROWSER_CLIENT`、`PLAYWRIGHT_WS_ENDPOINT`、`PW_TEST_CONNECT_WS_ENDPOINT` 均未设置，按工作区浏览器规则没有自行启动 Chromium。以上是使用真实 Three 对象、合成模型/Canvas 和模拟 WebGLRenderer 的单元验证，不代表浏览器截图验收。需要 Claude 用 `codex-browser exec` 新启动浏览器测试任务，补拍空闲、敌我战斗、选中、拖动落点和选秀画面；真实素材下的新标记可读性仍待此验证。
- 保留的短时技能环、选秀拿取爆发、小小英雄束缚和场边道具辉光仍可能呈圆形；它们不承担常驻棋子底盘功能。外部模型/特效素材的内部视觉未做截图复核。
- 开发验收接口 `carousel.debug().units[].ring` 已更名为 `cue`；仓库内引用已适配，外部临时调试脚本如读取旧字段需同步。
