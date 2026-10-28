2D 入口体积盘点与瘦身（2026-10-28）

基线为 `claude/v25-js-slim-2` / `686f3086fa565d2c1af81a5414d1259fc0ab86fb`，开工时工作区干净。Node `v22.23.4`；使用仓库锁定的 Phaser 3.90.0、Vite、esbuild，production 模式，未开启 `VITE_LOCAL_ROOM=1`。本次不提交 Git，由执行端提交。

实际交付：**635,487 → 633,402 B gzip-9，节省 2,085 B（0.328%）**。距 **637,144 B** 上限的余量从 **1,657 → 3,742 B**。没有移动首屏代码、改预算、改玩法或数值；`src/server/`、`src/simulation/`（含动态值相关）均未修改。

**口径结论及证据**

| 检查 | 文件:行（本次修改后） | 实际口径 |
| --- | --- | --- |
| m7 `jsGzip` | `scripts/m7-budget.cjs:31–34` | `readdirSync(dist/assets)` 不递归，筛选名称以 `.js` 结尾的直接子项，逐文件 `gzipSync(...,{level:9})` 后相加。不是仅统计 HTML entry，也不是 Vite 日志的 gzip。正常构建文件布局下，只算顶层 `assets/*.js`。 |
| m7 子目录 | `scripts/m7-budget.cjs:36–41,70–72` | `assets/3d/`、`assets/solo/` 单列，均不计入 `jsGzipBytes`；`assets/ui/` 也排除，且 m7 **没有单列 UI 字节数或检查 UI preload**。其子目录统计自身也不递归。 |
| m7 门限 | `scripts/m7-budget.cjs:54,70,80` | current / 指定 JS baseline ≤ 1.50；脚本没有写死 637,144。CI 的 JS baseline 是 `.github/workflows/ci.yml:398` 指定的 M7 提交。不能拿本次优化前包替代该签字基线来声称完整 m7 通过。 |
| isolation `gzip2d` | `tests/rendering3d-isolation.test.ts:121–123` | 对真实生产构建的 emitted chunks 使用 `/^assets\/[^/]+\.js$/`，逐 chunk gzip-9 相加；严格 **< 637_144**。`3d/solo/ui` 均排除。 |
| 静态/动态边界 | `tests/rendering3d-isolation.test.ts:51–73,93–116,125–132` | 沿 Rollup 的静态 imports 检查，solo/UI 必须只经动态边到达；3D 也有相应检查。本次增加“所有静态可达 JS 必须在计费顶层”和“HTML 不得预加载任何不计费 JS”的通用断言，封住未知子目录及 UI preload 漏洞。 |
| 输出路径配置 | `vite.config.ts:68–73` | `manualChunks` 与 `chunkFileNames` 决定哪些文件落入顶层、UI、solo、3D；本次没有改它们。 |

执行端“两个检查都只算顶层”的初步结论正确。m7 的实现只是文件枚举，不自行证明“按需”；isolation 才补充依赖图证明。二者均不等于完整用户会话的下载量，也不包括 CSS、图片、WASM。

“按需分包能省多少”的条件：被移出的模块及依赖必须不再被入口的任何静态依赖链引用，不被 HTML 预加载，并且当前模式首屏不立即调用它。共享依赖通常仍要留在入口；`manualChunks` 还可能把共享代码吸入一个被入口静态引用的子目录包。真实门禁收益是 **优化前顶层 gzip 总和 − 优化后顶层 gzip 总和**，不能拿模块 gzip 估算或新子包 gzip 直接相减，跨模块字典、绑定名、文件哈希都会影响结果。

特别区分已有 solo 边界：`src/rendering/online/mode.ts:10` 只有 `?mode=online` 才进入联机；`src/main.ts:22` 在默认单人模式启动 Phaser 前就 `await loadSoloApplication()`，后者在 `src/m6/application-loader.ts:9` 动态导入 application。因此 solo 虽被现有门禁排除，**默认单人首屏仍会下载它**；这不是所有 2D 模式都能省下的首屏流量。本次没有新增这种排除。

**整包实测（字节，gzip level 9）**

| 文件类别 | 优化前 | 优化后 | 变化 |
| --- | ---: | ---: | ---: |
| 顶层 index | 509,509 | 509,503 | −6 |
| 顶层 phaser | 125,978 | 123,899 | −2,079 |
| **门禁计费总和** | **635,487** | **633,402** | **−2,085** |
| UI augment-text（排除） | 14,997 | 14,997 | 0 |
| UI tooltip-text（排除） | 15,458 | 15,458 | 0 |
| UI unit-panel（排除） | 4,110 | 4,113 | +3 |
| solo application（排除） | 86,247 | 86,249 | +2 |
| 3D render3d（排除） | 318,818 | 318,818 | 0 |
| 所有 JS 合计 | 1,075,117 | 1,073,037 | −2,080 |

index / unit-panel / application 的几个字节变动来自绑定及导入文件哈希变化，未移动代码。3D 文件内容哈希未变。优化前不计费的子目录总计 439,630 B，不应把它当作本次收益，或等同于这些功能原先内联时的体积。

**模块表：优化前 Top 20**

方法：读取真实 Rollup 输出中 `chunk.modules[id].code`（已经过导出裁剪），逐模块用 esbuild `minify + format=esm + target=es2020`，再分别 gzip-9。这是排查用估算，**不是可相加的 gzip 归因**；它不包含 chunk 级 `compact-entry-strings` 的字典优化，且模块之间不能共享 gzip 字典。整包表才是验收数字。

| 排名 | 模块 | 单模块 gzip-9 估算 B |
| ---: | --- | ---: |
| 1 | `src/rendering/strategy-panel.ts` | 20,908 |
| 2 | `src/rendering/BoardScene.ts` | 20,280 |
| 3 | `src/simulation/combat-s13.ts` | 13,643 |
| 4 | `src/simulation/match.ts` | 13,400 |
| 5 | `src/simulation/m8/s13-mechanisms.ts` | 7,498 |
| 6 | `src/rendering/online/online-application.ts` | 7,364 |
| 7 | `src/presentation/s13-g23-manifest.ts` | 6,682 |
| 8 | `src/simulation/strategy-snapshot.ts` | 6,244 |
| 9 | `node_modules/phaser/src/input/InputPlugin.js` | 5,592 |
| 10 | `src/simulation/content/opening-encounters.ts` | 5,196 |
| 11 | `src/simulation/validate-content.ts` | 4,943 |
| 12 | `src/simulation/content/augment-pool-batch3.ts` | 4,939 |
| 13 | `src/simulation/combat-s13-state.ts` | 4,911 |
| 14 | `src/rendering/online/ws-client.ts` | 4,867 |
| 15 | `src/simulation/content/g2-3-anomaly-source.ts` | 4,866 |
| 16 | `src/stats/stats-panel.ts` | 4,748 |
| 17 | `src/simulation/content/g2-3-special-item-runtime.ts` | 4,691 |
| 18 | `src/simulation/effects.ts` | 4,646 |
| 19 | `src/simulation/augment-history.ts` | 4,608 |
| 20 | `src/simulation/content/g2-4-artifacts.ts` | 4,573 |

前后完整模块表、chunk imports / dynamicImports、静态可达列表、模块代码 SHA-256 位于本地忽略产物：

- [优化前全部 1,171 条模块记录](../artifacts/2d-size-before/modules.csv)，[JSON](../artifacts/2d-size-before/modules.json)。
- [优化后全部 1,159 条模块记录](../artifacts/2d-size-after/modules.csv)，[JSON](../artifacts/2d-size-after/modules.json)。
- 记录包含 CommonJS 互操作虚拟模块和零字节模块；同一源码的互操作小包装不等于重复打包整套库。产物不提交；用下方脚本可复现当前树。

最大两块整包是应用入口（80.2%）和 Phaser（19.8%）。应用内部集中在棋盘/商店界面与规则；不能因 online 不在本地结算就宣称规则已无引用：`src/rendering/online/remote-session.ts:17,19,43` 仍导入 `createMatch`、继承 `MatchSession`；`src/rendering/match-session.ts:5–10` 静态导入 Match 命令。大规模卸载需改清依赖关系，不能只改输出路径。动态值拆包属于另一单，本次未改动，也未将其潜在收益计入。

重复检查：所有 emitted chunks 中，同一个原始 moduleId 出现在多个 chunk 的记录为 **0**；顶层大于 100 minified bytes 的模块之间，相同 rendered code SHA-256 的记录为 **0**。这是模块/字节重复检查，不证明不存在相似业务逻辑。未发现两份 Phaser 或主入口重复携带 Three.js。

**Phaser 子系统核查**

| 子系统 | 基线现状 / 单模块 gzip 估算合计 | 判断 |
| --- | --- | --- |
| Arcade/Matter、particles、sound、gamepad | 输出模块数均为 0 | 已被 slim 入口/flags 排除，新增收益 0；不是本次删掉的。 |
| keyboard | 2 模块，1,394 B | KeyboardPlugin 已不在包里，InputManager 仍无条件引用 KeyboardManager 和 KeyCodes。游戏快捷键走 `BoardScene.ts:405–426` 的原生 keydown。可另审，不删鼠标/触摸/拖拽输入。 |
| animations | 15 模块，5,090 B | Game 强制构造 AnimationManager；当前注册对象是 Image/Text/Graphics/Container/Arc，无 Sprite，也未发现应用调用 `.anims`。仍涉及引擎 boot/destroy 与插件注入，暂保留。 |
| textures | 25 模块，15,345 B | 含 DynamicTexture，但项目头像实际用 `src/presentation/s13-assets.ts:88` 的 **CanvasTexture**，不能连 texture 子系统一起删。 |
| renderer/webgl 残留 | 4 模块，2,592 B | 是 DynamicTexture、TextureSource 等的 RenderTarget、WebGLTextureWrapper、Utils、pipeline 常量；并非完整 WebGL renderer。Canvas 相关共用类仍有引用，不能仅按目录名删除。 |
| InputPlugin | 5,592 B | 鼠标、拖拽、拾取确实使用，保留。 |
| LoaderPlugin / ImageFile、TweenManager | 存在且被使用 | 棋子头像、移动与战斗反馈依赖，保留。Phaser particles 缺席不代表游戏没有用图形/tween 实现的战斗特效。 |
| Color 集合、PathFollower | 无应用运行时使用 | 本次移除这两个入口；保留引擎直接引用的 Color / ValueToColor 等。 |

**腾空间方案（按预计收益排列）**

表中“试构建”均是临时 Vite transform 的消融实验，只用于测量依赖，不是完成了浏览器验证的可交付实现。实验没有写回生产源码；除已实施两项外，正式包都保留原实现。各项不保证可线性相加。

| 顺序 | 方案 | 预计节省 gzip-9 B | 风险与取舍 | 本次 |
| ---: | --- | ---: | --- | --- |
| 1 | 停用无消费者的 AnimationManager | 3,759（在原基线上试构建：635,487 → 631,728） | 中：需审计引擎启动、场景注入、销毁，补生产浏览器回归和源码指纹/使用守卫。 | 未实施 |
| 2 | 移除未用 DynamicTexture 构造入口及其独占依赖 | 3,573（在交付树上试构建：633,402 → 629,829） | 中高：实验仅切断 require，不是可用 API 实现；必须保留 CanvasTexture、头像裁切与刷新，不能删除整个纹理系统。 | 未实施 |
| 3 | 清理隐藏/屏外的旧 Canvas HUD 与 DOM HUD 的重复维护 | 约 1,000–3,000，未试构建 | 中高：`BoardScene.ts:227,236–253` 存在隐藏/屏外对象；`debugSnapshot` 和输入回归仍读取其文本与 bounds，需先迁移观测契约。此项排序只按粗估中值。 | 未实施 |
| 4 | 禁用未用 Phaser KeyboardManager | 1,307（交付树试构建：633,402 → 632,095） | 中：不能影响原生 D/F/W/E 快捷键、输入框焦点、鼠标和现有触摸测试；需真实浏览器。 | 未实施 |
| 5 | 去掉 slim 暴露的 Color 工具集合 | 1,155（原基线单项试构建） | 低：应用无 `Phaser.Display` 消费；保留内部按叶模块导入的颜色功能。 | **已实施** |
| 6 | 去掉 CommonJS Components 的 PathFollower 导出 | 932（原基线单项试构建） | 低：已注册游戏对象不用该 mixin；上游文件 SHA-256 锁定，变动即构建失败。 | **已实施** |
| 7 | 再去掉物理/粒子/音频/gamepad | 0 | 已不存在。 | 无需改动 |

两个低风险项目合计实测 2,085 B，而不是单项的 1,155 + 932 = 2,087 B；这也展示了 gzip/文件哈希导致的非线性。未使用按路径搬家降低计数的方式。

**实施与验证**

- `src/rendering/phaser-slim.js:45–50`：不再导入/暴露整个 Color 集合。
- `scripts/vite-production-size.ts:81,96–100`：精确校验上游 Components 文件后，仅移除 PathFollower 导出；仍只应用于 production 构建，延续现有插件行为。
- `tests/rendering3d-isolation.test.ts:70–88,128–129`：检查所有静态包都计费、HTML 不预加载排除包，并检查删除目标缺席且必要 Phaser 模块保留。
- `scripts/audit-2d-size.mjs`：新增可重复执行的生产构建盘点脚本，保存每一个顶层模块的估算，不改变正常构建配置。
- `npm run typecheck`：通过。
- production 构建：通过；按原样提取并执行 `scripts/m7-budget.cjs` 的 `jsGzip` 函数，结果与构建内 gzip2d 一致：635,487 / 633,402；见 `artifacts/2d-size-checks/m7-js-only.json`。**没有声称 m7 首次交互时延或签字基线比值已验证。**
- isolation 单独复核：1/1 通过，实际构建与断言 15.407 s；Vite 7.3.6；日志 `artifacts/2d-size-checks/isolation.log`。
- 无浏览器测试：首次 10 文件中 9 文件 / 37 项通过，包含 isolation、layout、hero-identity、preferences、input-router、rendering3d-mode、solo-application-loader、augment-text-loader、black-market-hover。`m7-fx-plan` 的 beforeAll 整局生成超出原有 120 s；无其他构建任务时单独复跑仍超时（120.848 s），3 个断言未执行，不算通过。它测试纯 `fx-plan` 与整局事件，不加载本次精简的 Phaser；本次不修改规则、测试时限或 golden。日志见 `artifacts/2d-size-checks/vitest.log`、`fx-isolated.log`。使用临时配置去掉 globalSetup，以免无浏览器入口时默认尝试 launchServer；断言及 120 s 限制均未更改。
- 浏览器测试：**未执行**。当前没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，依工作区浏览器桥接指令，不自行启动 Chrome。须由执行端经 `codex-browser exec` 新启动浏览器测试任务。

当前树的体积/类型检查复跑：

```bash
export PATH=$HOME/.local/bin:$PATH
npm run typecheck
node scripts/audit-2d-size.mjs --out=artifacts/2d-size-after --dist=dist
```

执行端在本次工作树使用 `codex-browser exec -C /home/aiapps/workspcae/cat-cx-sol-t7` 启动新的测试任务，在已提供连接的任务内运行（如移交至其他工作树，相应替换 `-C`）：

```bash
export PATH=$HOME/.local/bin:$PATH
npm test -- --configLoader runner --maxWorkers=3 \
  tests/rendering3d-isolation.test.ts \
  tests/rumble-shop-layout.test.ts \
  tests/presentation/hover-dom.test.ts \
  tests/presentation/hover-card-pin.test.ts \
  tests/presentation/hover-card-long-press.test.ts \
  tests/presentation/unit-panel.test.ts
```

这些 tests 使用 `tests/fixtures/shared-browser.ts`，已支持桥接。`rumble-shop-layout` 的既有 2D/3D、桌面/触摸矩阵保持原样；本次没有新增手机测试。但这些 UI fixture 不足以验收生产 Phaser 精简，还应运行生产 preview 的真实棋盘/菜单/商店/拖拽回归。旧 `verify-m5-browser.cjs` 直接调用 launch，可用以下**仅测试进程**适配接入已有 Chrome；不会启动第二个 Chrome，也不用改仓库脚本：

```bash
cat > /tmp/v25-browser-connect.cjs <<'JS'
const { createRequire } = require('node:module');
const requireProject = createRequire(process.cwd() + '/package.json');
if (!process.env.CODEX_BROWSER_CLIENT) throw Error('Run through codex-browser exec');
requireProject('playwright').chromium.launch = async () =>
  require(process.env.CODEX_BROWSER_CLIENT).connect();
JS
node --require /tmp/v25-browser-connect.cjs scripts/verify-m5-browser.cjs --preview --m6-f2
```

上述 preview 使用已生成的 `dist/`，覆盖固定种子/新局菜单、商店、棋盘输入、首轮战斗、存档恢复与回放。完整 m7 若需要，用同一适配运行：

```bash
node --require /tmp/v25-browser-connect.cjs scripts/m7-budget.cjs \
  --base=../m6-base/dist --js-base=../m7-js-base/dist \
  --current=dist --out=artifacts/m7-budget
```

两个 baseline 必须由执行端按 `.github/workflows/ci.yml` 的既定提交准备；本克隆 `.git` 只读，本次没有创建 worktree 或改签字基线。

风险：余量仍只有 3,742 B，应在动态值另一单整合后重新构建计量，不能叠加分支估算。Phaser 类型声明仍来自完整包，未来新增 Color 集合或 PathFollower 用法时需同步 slim 实现与回归。PathFollower 与已有精简一样仅作用于生产，因此必须跑 preview 而不只看 dev。浏览器验证及 `m7-fx-plan` 的超时问题尚待执行端复核。
