# PR #439 长按测试偶发失败核查

基线：`claude/hover-descriptions`，`b8c15d1de89edacd9c5b1a85c5eec9f61b60de14`。只修改测试与浏览器测试连接；生产代码、断言阈值、超时和玩法不变，不提交。

## 根因与证据

`#modal-item-popover` 可见不等于长按发生。原测试复用同一 Page，上一用例的 `hover()` 把真实鼠标留在装备按钮上；CDP touch 输入不会搬走鼠标。失败时 Chromium 在 touchEnd 后又为旧鼠标位置派发 `pointerover`，由 `src/presentation/hover-card.ts:84` 的普通鼠标悬停路径重新打开浮层。

带临时观测的原测试组合复现了相同的 `expected 1 to be +0`（`artifacts/hover-flake/trace-full-5.log`）。未改生产实现；完整观测代码保留在 `artifacts/hover-flake/hover-dom.instrumented.ts`，原文件在 `artifacts/hover-flake/hover-dom.original.ts`，诊断观测不进入最终测试。对应事件在 `artifacts/hover-flake/full-traces.jsonl:5`，展开版为 `artifacts/hover-flake/root-cause-events.json`：

| 页面时钟 ms | 事件及实际副作用 |
| --- | --- |
| 4792 / 4795 | touch pointerdown，pointerId=5，x=800；只安排一个 450 ms 定时器 `1000000000006`。 |
| 4832 / 4833 | 生产 `move()` 先 clearTimeout；随后测试 observer 收到同一 pointerId=5、x=809、y 不变的 pointermove。 |
| 4847 | 测试准备执行 `clock.runFor(450)`；定时器已取消。 |
| 5317 | touch pointerup/out；普通浮层被 hide。 |
| 5324 | 原生 click 到达，整段没有 `hover-long-press`。 |
| 5332 | mouse pointerover，pointerId=1，旧坐标 x=518.66、y=613；调用栈是 `over → open → showAt`，重新显示 modal-item-popover。 |
| 5359 | 测试把鼠标移至 1500,1100，目标为 overlay；该轨迹中没有按钮 pointerout，浮层仍可见，断言失败。 |

因此这次失败不是 touchMove 尚未到达、pointer id 不匹配、合并移动丢失阈值、第二个监听作用域触发长按，也不是实际小拖动仍触发长按：移动取消的可观察副作用已经发生，长按事件为零。modal 的文本卡与装备卡监听确实并存（`src/rendering/strategy-panel.ts:275`、`:277`），但该目标只启动了装备卡的一个定时器。取消实现 `src/presentation/hover-card.ts:115` 保持原样。

另外查到独立的时间不确定性：`clock.install()` 本身不会停止走时，`runFor()` 完成后也恢复原先的走时状态。`artifacts/hover-flake/trace-baseline.log` 中 4380 ms 按下并安排定时器，4384 ms 才执行 runFor(449)，4830 ms 已触发长按，4845 ms 才抬起，导致 449 ms 短按断言失败。依据为当前安装的 Playwright `node_modules/playwright-core/types/types.d.ts:20493` 的 pauseAt 契约及 `lib/coreBundle.js` 的 ClockController 实现。

## 修复

- `tests/presentation/hover-dom.test.ts:68`：装入固定时间并 pauseAt，在挂载 presenter 前停止自动走时；`:121` 断言手势总耗时正好是指定值，包含 CDP 往返。
- `tests/presentation/hover-dom.test.ts:97`：每次 hold 前移开鼠标，隔离普通悬停与触摸手势，保留生产鼠标行为。
- `tests/presentation/hover-dom.test.ts:105`：只接受目标坐标的 touch pointermove；观察器在生产 document capture 监听器之后注册，确认取消路径已处理再推进时钟。
- `tests/presentation/hover-dom.test.ts:141`：新增 `hover-long-press` 计数，449 ms 短按与 9 px 移动后均须为零，且两次原生点击均生效；原可见性与点击断言全部保留。
- `tests/presentation/hover-card-long-press.test.ts:14`：同样暂停时间，保护既有 449/450 ms、8/9 px、pointercancel、移除、销毁和点击重定向断言。两个浏览器测试显式关闭自己创建的 context 并断开连接。
- `tests/fixtures/shared-browser.ts:19`：优先连接环境提供的 PLAYWRIGHT_WS_ENDPOINT；连接失败直接失败，不绕开沙盒启动 Chrome。未设置时仍依次使用 Vitest 注入端点、原私有启动回退。
- `tests/fixtures/g4-global-setup.ts:14`：存在外部端点时不调用 launchServer、不关闭外部浏览器；本地启动及缓存清理行为保留。

## 全部 attachItemPopover / attachTextCards 调用点

生产代码共有以下 8 个调用表达式，循环展开的作用域逐一列出。此次修复不改变任何生产调用点；“浏览器”表示本次组合内现有 Chromium 测试实际覆盖，“静态”表示核查接线与选项，不能当作新增交互验收。

| 调用点 | 作用域与长按设置 | 确认 |
| --- | --- | --- |
| `src/rendering/strategy-panel.ts:260` | itemDock 的 attachItemPopover；在线 pin + hoverAction，离线默认关闭长按。 | 静态确认；hover-dom fixture 未传可选 itemDock。 |
| `src/rendering/strategy-panel.ts:265` | strategy root 的 attachItemPopover；在线 pin + hoverAction，离线默认。 | 静态确认，浏览器实际创建该 root；本次移动断言目标在 modal。 |
| `src/rendering/strategy-panel.ts:275` | 在线 attachTextCards 循环：root、modal、augmentStrip、shopDock、itemDock；动作控件长按，其余点击固定。 | root 消耗品、modal 奖池、augmentStrip 强化、shopDock HUD 均有浏览器断言；itemDock 静态确认。 |
| `src/rendering/strategy-panel.ts:277` | 在线 attachItemPopover 循环：modal-item-popover、shop-item-popover，均 pin + hoverAction。 | 浏览器覆盖 modal 长按/9 px 取消/短按及 shop armory 悬停；这是失败与修复直接覆盖处。 |
| `src/rendering/online/carousel-panel.ts:78` | attachCarouselCards 内装备卡 pin + hoverAction；调用于 CarouselPanel (`:132`) 与 CarouselHoldingSlot (`:311`)。 | 浏览器覆盖选秀装备长按不选择、英雄与装备卡互斥、临时位说明及出售。旁边 `:71` 的英雄卡直接调用 attachHoverCards，使用相同长按策略，也已覆盖。 |
| `src/rendering/online/opponent-board.ts:85` | scout root 的 attachItemPopover，默认选项，无长按。 | 静态确认不走长按计时器，无生产变更。 |
| `src/rendering/online/players-sidebar.ts:66` | 玩家列表 attachTextCards；可操作行命中 hoverAction，长按说明不执行侦察。 | 浏览器覆盖文本及 calls.scout=0。 |
| `src/rendering/online/stage-track.ts:68` | 阶段轨道 attachTextCards；`:78` 生成 li，未命中 hoverAction，采用点击固定。 | 浏览器覆盖阶段文本，静态确认没有动作长按。 |

测试自身另有 `tests/presentation/hover-dom.test.ts:54` 的 consumableShelf 和 `:56` 的 orbLootSection 两个 attachTextCards 调用，分别覆盖消耗品长按/短按及掉落说明；同样使用此次修复的 hold 驱动。测试模板中 attachItemPopover 的 import 不是调用点。

## 在线与 3D 路径

在线 StrategyPanel 由 `src/rendering/BoardScene.ts:261` 创建；3D 模式保留该 DOM 面板，使用上述相同作用域和选项，没有单独的 attachItemPopover / attachTextCards 调用。长按释放操作所有权的 `hover-long-press` 监听仍在 `src/rendering/strategy-panel.ts:278`；`tests/presentation/hover-dom.test.ts:192` 验证消耗品长按释放 router 与选择、短按仍可选择。

3D canvas 自己的路径已逐一静态确认，和本次 DOM 测试修复无实现耦合：

- `src/rendering/three-mode/placeholder-renderer.ts:1262`：describeAt 分流到选秀、侦察、自家装备/法球或访问棋子。
- `src/rendering/three-mode/carousel-stage.ts:840` 与 `src/rendering/three-mode/scout-stage.ts:265`：返回投影命中身份与位置。
- `src/rendering/three-mode/placeholder-renderer.ts:1286`、`:1332`、`:1364`、`:1380`、`:1529`：独立的 touchLook 按下、移动阈值取消、抬起、取消/丢失捕获、450 ms 帧更新；不调用 attachHoverCards 的 DOM 长按计时器。
- `src/rendering/BoardScene.ts:654` → `src/presentation/unit-panel.ts:173`：describe → showSceneDescription → unitHoverCard().showAt；装备 body 复用 itemCardBody (`:185`)，不调用 attachItemPopover。

3D 核查包括接线阅读及组合内 `tests/rendering3d-isolation.test.ts:21` 的真实 Vite 构建/动态导入断言；没有把该构建测试描述成 3D 实际触摸交互测试，也未加载本地版权素材。

## 最终验证结果

所有命令均先 `export PATH=$HOME/.local/bin:$PATH`，浏览器连接到已有沙盒 Chrome，浏览器测试工作负载串行运行，Vitest 固定 4 workers：

```bash
npx vitest run --maxWorkers=4 tests/presentation/ tests/rendering3d-isolation.test.ts tests/m8-b8-token-lifecycle.test.ts
npx vitest run --maxWorkers=4 tests/presentation/hover-dom.test.ts
npm run typecheck
```

- 组合连续 **10/10** 通过，每次 **20 文件、234 测试**，0 失败；每次约 14.61–15.34 秒。
- 单文件连续 **3/3** 通过，每次 **1 文件、8 测试**，0 失败；每次约 10.53–10.61 秒。
- `npm run typecheck`、`git diff --check` 通过。
- 对原始 HEAD 与最终文件做 TypeScript AST 断言比对：hover-dom 的 39 条与 hover-card-long-press 的 13 条原断言全部原样保留，新增 4 条；没有提高任何超时。
- 浏览器 helper 的 5 个 mock 分支通过：外部端点优先、外部连接失败禁止启动、注入端点成功、注入失败原回退、无端点原回退。mock 没有实际启动浏览器。
- 汇总证据：`artifacts/hover-flake/validation-summary.txt:3`；逐次原始日志为 `combination-1.log` 至 `combination-10.log`、`alone-1.log` 至 `alone-3.log`；另有 `typecheck.log`、`fixture-check.log`、`assertion-check.log`。诊断阶段的失败日志独立命名，未计入最终连续通过次数。
- 本 clone 的 node_modules 原指向只读共享目录，Vite 配置缓存写入曾报 EROFS；只在本工作区把该链接展开为逐包链接，让 `.vite` / `.vite-temp` 留在可写工作区，未更改共享依赖或包版本。生成物均位于 gitignore 目录。

没有改动生产文件，没有提交，也没有触碰只读 `.git`。尚未运行远端 CI；本地要求的全部验证已完成。
