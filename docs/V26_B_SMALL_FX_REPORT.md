# v26-B 小件特效：审核修正报告

2026-10-29 更新；工作分支 `claude/v26-small-fx`，验收 HEAD `3332e90e9bb1798da85e8bf2a56543707568bdad`，修正起点 `29b09578255d916ce768040d0889e34e30d5bddb`。本轮只更新本报告；工作区起点干净，未写 `.git`，未提交或合并。下列文件:行均按验收 HEAD 核对，本报告替代旧版体积结论。

**M1 达成：2D gzip-9 为 635,150 B，相对指定基线 `686f3086` 的 635,487 B 减少 337 B，满足零净增要求，可签收。** S1、S2、S4、S5 和 S3/S7 的文档修正已完成；Opus 审查结论为代码可合并。

## 逐项改动

| 审核项 | 文件:行 | 结果 |
| --- | --- | --- |
| M1 展示逻辑按需加载 | `src/presentation/confiscation-display.ts:1`、`:17`、`:69` | 只有 type imports；运行时选择器、单位目录、装备目录和装备展示读取器均由构造函数的位置参数注入。公开阵容的羁绊投影内联在本模块，不值导入 opponent-board。 |
| M1 Phaser 章与战斗接线 | `src/presentation/confiscation-display.ts:64`、`:85`、`:92`、`:96`；`src/rendering/BoardScene.ts:1343` | 装备过滤、更新及文字章创建均在懒模块。BoardScene 的新增入口为一行调用；单人及未加载时继续原权威装备展示路径。 |
| M1 懒模块启动 | `src/presentation/confiscation-display.ts:13`；`src/rendering/online/online-application.ts:114`、`:131`、`:161`、`:166`、`:284` | OnlineApplication 构造时开始动态 import；模块位于 presentation 懒 chunk，运行时静态 import 数为 0。加载前公开视图与回放捕获会跳过，加载后由后续推送驱动；加载失败保留原装备、不盖章。 |
| M1 chunk 路径 | `vite.config.ts:71` | `confiscation-display` 命名进入 `assets/ui/`；没有修改 manualChunks 的 3D 边界。 |
| M1 单位字段与 BoardFeed | `src/presentation/unit-view.ts:38`、`:73`、`:132`；`src/rendering/BoardScene.ts:1482`；`src/rendering/board-feed.ts:31` | UnitView 只留章的类型、更新时隐藏和显示容器；BoardFeed 读取章的可见性并提供 itemsConfiscated。opponent-board 不在相对 `686f3086` 的最终 diff 中，不列为交付改动。 |
| M1 装备读取接线整理 | `src/rendering/BoardScene.ts:955` | 同一轮 reconcile 内复用已查到的 combatUnit，避免三次相同查找；无装备或账本语义变化。 |
| S1 选择器异常 | `src/presentation/confiscation-display.ts:37`、`:49`、`:59` | 公开阵容查找及 publicTraitSnapshots 调用包 try/catch；任一侧失败则缓存为空的 victims，按未知处理，不盖章，也不在之后每帧重试抛异常。 |
| S2 回合内冻结 | `src/presentation/confiscation-display.ts:21`、`:24` | 收到首个 combat 视图后，同回合后续 combat、settlement、ended 视图都不覆盖它；跨回合清空战斗缓存。 |
| S4 空战斗 ID | `src/presentation/confiscation-display.ts:28`、`:31` | undefined 和空串都不捕获、不推断，原样返回装备与 extras。 |
| S5 可没收装备口径 | `src/presentation/confiscation-display.ts:34`、`:53`；`src/simulation/strategy-snapshot.ts:116` | 与 keeps 口径一致：已知纹章保留；不在装备目录中的物品也没收。英雄/非英雄判断不变。 |
| S3/S7 风险说明 | `docs/S13_RULES_GAP.md:1163` | 明确仅按公开阵容推断；海克斯/法球等羁绊来源及镜像规则不计入，可能漏盖章；单人模式未做。补充首个 combat 视图未必是开战快照。 |
| 隔离与体积证据 | `tests/rendering3d-isolation.test.ts:95`、`:98`、`:100`、`:110`、`:116` | 新增懒模块存在性断言及 2D/3D/没收 chunk gzip-9 日志。原 637,144 硬上限、没收 chunk imports=[]、UI 模块必须在 presentation、3D 不导入 2D/UI 等断言全部保留。 |

相对 `29b09578` 的审核修正轮没有修改 3D 模块；整个分支相对 `686f3086` 则改动了 `src/rendering/three-mode/carousel-stage.ts`、`unit-overhead.ts`、`placeholder-renderer.ts`，并新增倒计时环和没收章模块。整个分支没有修改 `src/server/`、`src/simulation/`、规则数值、内容版本或版权素材。

单字节分隔符 `|` 的可逆性：`scripts/vite-production-size.ts:8` 定义分隔符，`:22` 排除含 `|` 或 NUL 的值，使它们保持原样、不入字典；`:70` 对其余值按相同顺序 join、JSON.stringify 后再 split。入字典值均不含分隔符，因此分隔点唯一，JSON 编解码保持转义与 Unicode 文本，能够逐项还原原字符串，不改变属性键或线上的值。回归见 `tests/v26-entry-strings.test.ts:6`、`:22`。

## 真实生产构建与 gzip-9

历史磁盘构建命令：`export PATH=$HOME/.local/bin:$PATH`，然后 `npx vite build --configLoader runner --outDir <新的临时输出目录>`，构建前后使用独立目录避免旧 hash 文件重复求和。本轮用 Vite API 的 `build({ configLoader: 'runner', build: { write: false } })` 按真实配置在内存构建、核对最终分包，不写构建文件。每个 `.js` 单独 gzip level 9 后求和；2D 仅计顶层 assets，3D 包括 assets/3d 中的 JS chunk 和 Basis 转码器 JS 资源。

| 版本 | 2D gzip-9 B | 3D gzip-9 B | 没收懒 chunk B |
| --- | ---: | ---: | ---: |
| 原功能基线 `686f3086`（指定/初版实测） | 635,487 | 333,961 | 0 |
| 本次修正前 `29b09578`（重新实测） | 636,332 | 334,635 | 0 |
| 本次修正后 `3332e90e`（真实构建、隔离测试一致） | **635,150** | **334,635** | **1,447** |
| 相对本次修正前 | **-1,182** | **0** | +1,447 |
| 相对原功能基线 | **-337，M1 达成** | **+674（不计入 2D）** | +1,447 |

没收 chunk 为 `assets/ui/confiscation-display-sOwmjSlS.js`；全部 UI chunk 合计 **36,012 B**，solo 合计 **86,247 B**。隔离测试确认没收 chunk 的模块全部属于 `src/presentation/`，`imports` 为 `[]`，只经动态路径从入口可达；HTML 不预加载它。3D chunk 的静态依赖仍只在 assets/3d/ 内，相对原功能基线增加的 674 B 单独列账，不计入 2D 入口预算。

以上为最终生产产物的 gzip-9 差额；展示懒加载与入口字符串字典优化后，2D 相对指定基线净减 337 B。**M1 可签收**，原 637,144 B 硬上限及现有隔离检查仍通过，没有放宽预算、改变 3D 边界或把领域依赖塞进 UI chunk。

忽略目录 `artifacts/v26-audit/` 留有修正过程日志和旧体积 JSON，其中 635,596 B 等旧数据不代表 `3332e90e`；本轮没有改写这些生成物，最终数值以上表为准。

## 验证结果

`3332e90e` 相关 **8 个文件、60 项全通过**（本轮复跑确认）：

| 文件 | 通过项数 |
| --- | ---: |
| tests/v26-carousel-timer.test.ts | 3 |
| tests/v26-confiscation-display.test.ts | 16 |
| tests/m7-fx-plan.test.ts | 3 |
| tests/rendering3d-carousel.test.ts | 26 |
| tests/rendering3d-overhead.test.ts | 3 |
| tests/rendering3d-isolation.test.ts | 1 |
| tests/v26-entry-strings.test.ts | 2 |
| scripts/tests/production-size.test.ts | 6 |

全量 `npm run typecheck`（`tsc --noEmit`）、隔离测试中的真实 Vite 生产构建和 `git diff --check` 通过。

回归见 `tests/v26-confiscation-display.test.ts:126`、`:139`、`:157`、`:167`、`:187`、`:195`、`:221`、`:232`：结算先于回放/首次 gear 读取、两侧选择器和公开阵容查找异常不逐帧重试、空战斗 ID、不在目录中的装备、加载前推送跳过及加载后捕获、章附着移动 body/死亡隐藏、正常/旧版装备同步、chunk 失败回退。入口字符串回归覆盖分隔符、NUL、Unicode 和转义；生产体积插件回归覆盖属性/JSON 语义、内容 digest、RNG、恢复及 Phaser 裁剪。

Vitest 使用 `--config artifacts/v26-audit/vitest-no-browser.config.ts --configLoader runner --maxWorkers=2 --project fast`，上述 8 文件一起复跑全绿，未调整测试、超时或阈值。

这些用例无需浏览器。复跑使用忽略目录中的 `vitest-no-browser.config.ts`，仅移除未使用的 Chrome 全局启动；原项目 setupFiles、测试配置和所有断言保留，隔离用例仍加载真实 vite.config.ts。未做浏览器实机视觉验收。

## 明确风险与未完成

- **首个 combat 视图未必是开战快照，可能误/漏盖章。** 同回合冻结只防止之后的结算视图覆盖，不证明首次收到的数据等于真实开局。
- 推断只看公开阵容及持有的纹章，海克斯/法球等羁绊来源、镜像规则不计入，可能漏盖章。观战配对不唯一时仍不猜测；单人模式未做没收展示。
- 非阻塞行为差异：`src/presentation/confiscation-display.ts:92`、`:93` 在已没收且帧无 equipment 时也调用 update，随后在 `:94`、`:95` 处理章显示；基线 `686f3086` 对无 equipment 帧会跳过更新。联机回放均带 equipment，实际影响很小，保留为兼容旧版/缺字段帧的备注。
- 懒模块加载前的推送不缓存，可能漏掉首次战斗公开阵容或回放捕获；后续推送才会驱动没收展示。此展示限制不阻塞本次 M1 体积验收。
