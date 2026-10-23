# PR #410 生产 JS 体积修复

工作区：`codex/encounters-pr9-epoch`，原 HEAD `f879b2b2fb29304f24c3b0a9e78a83fb91a524b7`。离线执行，无 commit。
环境：Node 22.23.4、Vite 7.3.6、esbuild 0.28.2、Phaser 3.90.0，系统 Chromium 156.0.8078.47。

## 结果与逐项贡献

按 `scripts/m7-budget.cjs` 原算法：仅 `dist/assets/` **顶层全部 `.js`**，逐文件 `gzipSync(bytes, { level: 9 }).length` 再求和。
固定基线 **424,763**，没有修改预算脚本、CI、门槛或 3D 分类。Vite 控制台的 gzip 默认级别与此不同，不混用。

| 顺序 | index gzip | Phaser gzip | 顶层合计 | 本项节省 | jsRatio |
| --- | ---: | ---: | ---: | ---: | ---: |
| 原 HEAD 构建 | 478,005 | 175,652 | 653,657 | — | 1.538875 |
| 共享字符串/属性键 | 457,236 | 175,652 | 632,888 | 20,769 | 1.489979 |
| 再裁剪 Math namespace | 457,236 | 168,806 | 626,042 | 6,846 | 1.473862 |
| 再裁剪未使用的 FX | 457,236 | 156,766 | **614,002** | 12,040 | **1.445517** |

逐项值来自相同源码、配置与工具链的对照构建，按表中顺序相减；不要把独立试验差值叠加。
总共节省 **39,655 字节（6.07%）**。距 1.45 目标上限余 **1,904 字节**，距原 1.50 CI 门槛余 **23,142 字节**。
后续 8 个奇遇和加时仍须逐批实测，不能将当前余量视为无限额度。

证据：`artifacts/pr9-size/report.json`。最终文件为 `index-ySBZ0yHd.js`、`phaser-jkS6OZ2f.js`。
`render3d-CuFCtdRO.js`、CSS 与原构建文件名/hash 一致；没有把任何 2D 模块挪进 3D。

## 改动、等价性与边界

- `vite.config.ts:3,55`：只接入生产构建插件；开发服务器、服务器的 Node 构建仍使用原模块。无新依赖，TypeScript/esbuild 均为原有开发依赖。
- `scripts/vite-production-size.ts:13`：在应用入口的 Rollup JS 上按 AST 合并重复字符串；`object.longProperty` 变成 `object[key]`，但 `key` 的值仍为完整原属性名。对象属性、JSON、反射、状态、错误码、内容 ID 都保留。共享字符串按字面顺序排列并用 NUL 分隔，包含 NUL 的原值不参与。esbuild 随后压缩新局部变量。
  - 保留 `__proto__` 的特殊对象字面量语义、directive prologue、import/export 字符串名字与路径、动态 import 路径、解构属性名；避免新绑定与源码冲突；保留可选链和方法调用的 `this`。
  - 只处理含 `src/main.ts` 的入口，不处理 Phaser 或 3D。发现直接 `eval` 或入口的静态循环导入则构建失败，避免作用域和初始化时序变化。
- `scripts/vite-production-size.ts:87`：Phaser 的 Math 总入口被 `core/Config.js` 和 `utils/object/GetAdvancedValue.js` 引入，但前者仅写 `RND`、构造 `RandomDataGenerator`，后者仅读同一个 `RND`。保留 `RandomDataGenerator` 和全部 Math 常量，其他消费者的直接叶子模块 import 不变。
  - `src/rendering/phaser-slim.js` 仅向应用暴露 `Math.Vector2`，且直接引用 Vector2 文件；未改该文件。构建会拒绝新增的 Math 总入口消费者。
- `scripts/vite-production-size.ts:93,103`：项目没有使用 Phaser `preFX` / `postFX` / 自定义 pipeline。将 PipelineManager 固定到 Phaser 自带的 `disablePreFX` / `disablePostFX` 路径，取消相应 shader/pipeline/controller 的 require；保留普通渲染 pipeline、Image/Text 的空 FX 组件和清理流程。
  - 只处理 Phaser 自己的源码，未改布局、动画、素材或 Three.js。构建扫描项目的 FX/pipeline 属性调用与解构；显式新增使用会失败，需先恢复完整引擎。相关上游模块 SHA-256 固定，Phaser 升级必须重新审计。
- `scripts/tests/production-size.test.ts:22,73,114,138`：验证 JS 语义边界；将真实规则与完整离线身份重算器打包后，再经过同一变换与 minify，对比 4 个种子的状态、事件、RNG、序列化与恢复；另检查 Phaser seeded RNG/取值一致性、空 FX 生命周期与拒绝未审计使用。
- `docs/UI_REQUESTS.md:3`：记录下述独立的 drag-enemy 界面回归及原断言验收条件。

没有剔除任何内容字段或校验逻辑，没有修改规则/数值/RNG、版本、golden、历史证据或断言。
新增构建测试位于 `scripts/tests/`，仍由默认 Vitest fast glob 收集；不改已封存的 PR9 `tests/` 消费者字节清单或其审计断言。
完整重算与压缩后重算均保持 `CONTENT_DIGEST = fnv1a32-utf16:35273c97`、`LOOT_REPLAY_DIGEST = fnv1a32-utf16:ef359464`。
排查中确认技能说明会被运行时解析，loot/anomaly 源表仍供规则与显示读取；最终没有裁去这些字段。UTF-8/minify 开关与额外拆块的实测收益不足，未引入这些配置变化。

## 验证

- `npm run build`、`npm run typecheck` 通过；额外使用继承原 tsconfig 的临时配置，对新增构建插件及 `scripts/tests/` 的测试也执行严格类型检查，通过。
- 选定 Vitest **14 文件 / 458 测试通过**：新增等价性、`rendering3d-isolation`、`m7-hero-identity`、`presentation/s13-root-ui-assets`、`presentation/g2-3-display`、`content-identity-constants`、`opening-random-identity`、opening encounters 的基础/PR2/PR5/PR6/trainer-golems/integration、`battle-equipment-client`。
- `node scripts/verify-v21-opening-encounters-epoch.cjs`（无 `--write`）**15/15 步通过**，包括内容/loot 身份、录制字节、历史证据、消费者审计和摘要比较。该脚本自带的耗时记录写回已恢复为原文件，未提交机器耗时差异。此次结果复制在 `artifacts/pr9-size/epoch-verification.json`。
- 浏览器对照：同一系统 Chromium、同一 U3 脚本，`83fd7fa5` **10/10**；PR9 优化前、优化后均 **9/10**，没有 pageerror，唯一失败都是 `drag-enemy` 的提示文字。
- 补充构建保护并调整新测试位置后，等价性与 3D 隔离再次 **2 文件 / 7 测试通过**；PR9 消费者字节审计再次通过（60 文件，原摘要未变）。
- `CHROMIUM_PATH=/opt/google/chrome/chrome node scripts/verify-m5-browser.cjs --preview`：**完整整局通过**，218 条真实输入命令、33 场战斗、0 个浏览器错误、无跳过，耗时 629.915 秒。每条命令状态、每场结算状态和完整战斗事件都与未变换的 Node 规则路线逐项一致，结束后新局也匹配。结果见 `artifacts/pr9-preview/manifest.json`。
- 追加使用原 `m7-budget.cjs --base=/tmp/pr9-dist-before --current=dist --samples=5` 做启动对照：首交互中位数 **795 → 832 ms**，比值 **1.04654 ≤ 1.20**，断言启用并通过，HTML 未预加载 3D。这里的比较基准是优化前 PR9，并非历史签收构建；目标 JS 比值始终使用上面的固定 424,763 基线。结果见 `artifacts/pr9-size/before-after-startup/report.json`。

## drag-enemy 结论

确认为 PR9 分支已有回归，来自 `e54f2a78` 的战斗装备界面接线，与本次构建优化无关：

1. multiplayer 的 `BoardScene.boardUnitAt` 将敌方 ID 继续交给预检，显示 `unknown-unit` 的中文提示。
2. PR9 的 `src/rendering/BoardScene.ts:520,535` 改用 `session.equipmentTargetId`。
3. `src/presentation/battle-equipment.ts:11,12` 仅找永久我方单位，敌方返回 `undefined`；输入路由于是显示空白落点提示「物品未装备 · 请放到我方单位或空装备槽」。
4. 失败用例中状态仍未改变、命令数仍为 0；仅错误类别/提示回归。按分工未改界面，也未改原测试断言，已向 Claude 留下具体待办。

证据目录：`artifacts/pr9-before-u3/`、`artifacts/pr9-multiplayer-u3/`、`artifacts/pr9-after-u3/`；multiplayer 对照使用 `/tmp` 内离线本地 clone 的准确提交，没有切换当前工作区分支。

## 风险与维护

- Phaser 版本或 FX 使用范围变化时，构建会要求重新审计；反射式/动态拼接 FX API 使用仍需代码审查，不能仅依赖静态扫描。
- 字符串字典在入口初始化时执行一次 split；固定属性键改为共享常量访问。本机 5 样本启动中位数增加 37 ms，未超原脚本比较门槛；不能据此保证所有机器的耗时。未来改变分块/初始化关系时需保持静态循环保护，并继续跑生产浏览器验收。
- 未修改 `scripts/m7-budget.cjs`、`.github/`、`THREE_D_MODULE`、任何界面源码或素材；没有安装依赖、联网或创建 commit。
