# 审查：海克斯栏位置与缺图标

审查对象是 `claude/v26-augment-icons-layout` 的 `6bbb4002`（父提交 `901d63d0`）。本文件先记录那次独立复核，再记录随后在 `cursor/augment-icons-layout` 上的定位修正。没有改规则、没有改既有断言、没有动 `src/simulation/` 或 `src/server/`。

## 后续：视口定位与只换图标

横排改挂到 `document.body`，`position: fixed` 的原点是视口，不再受 `#board-frame` 的 layout containment 影响。定位算法在懒加载的 `src/presentation/augment-hud.ts`（打进已有的 `augment-text` chunk，`vite.config.ts:40`）。`ResizeObserver` 监听棋盘、左栏、商店、物品槽和窗口，尺寸变化时重算。

2D：横排右缘贴在 `#board-root` 左缘外侧 4px，垂直中心在棋盘高度的 20%。左栏如果贴在棋盘旁边，行宽超过实测间隙时缩小图标，使整行落在左栏右缘和棋盘左缘之间。物品卡片挡住时上移。不改成竖排。

3D：行中心是视口的 26.7% × 23.8%，没有再加 8px。元素在 `body` 上，不再相对棋盘框偏移。

素材根晚到时 `BoardScene.ts:369` 只调用 `refreshAugmentIcons`（`strategy-panel.ts:449`）。`syncOwnedAugmentIcon`（`augment-display.ts:69`）只改芯片里的徽章或 `img` 的 `src`。刷新键不再包含图标 URL（`strategy-panel.ts:588`），因此晚到的地址不会整段替换横排。

`vite build --configLoader runner` 后，顶层 `dist/assets/*.js` 的 gzip-9 为 **634,621** 字节（index 510,722 + phaser 123,899），低于 637,144，余 2,523。相对修正前的 634,396 增加 225。入口里没有 `0.267`；布局函数在 `assets/ui/augment-text-*.js`。`tests/rendering3d-isolation.test.ts` 通过。

本地房间：`VITE_LOCAL_ROOM=1 npm run dev`，`?mode=online&prep=15&settle=2&choice=8&seed=7`。打到 4-2 准备阶段，3 个强化、人口 7/8、左侧羁绊、左侧物品、底部商店。3D 未配置原版素材，画面是占位棋子（页面写着「未配置 3D 素材，显示占位棋子」）。

| 截图 | 遮挡 |
| --- | --- |
| `docs/screenshots/augment-strip/2d-1280x720.png` | 3 枚约 28px，在棋盘左缘外、羁绊列右侧、物品列上方。与羁绊行、物品卡、商店、棋盘 canvas、倒计时的矩形相交数都是 0。 |
| `docs/screenshots/augment-strip/2d-1920x1080.png` | 应用最宽 1440，间隙仍约 56px，图标缩到 18px 才放得下。相交数都是 0，没有伸进左栏或盖住棋子。 |
| `docs/screenshots/augment-strip/2d-1440x1000.png` | 同样缩到 18px。相交数都是 0。 |
| `docs/screenshots/augment-strip/3d-1280x720.png` | 3D 层已挂上。行中心约在视口 (26.7%, 23.8%)。图标在占位棋子左侧空位，不压羁绊、物品、商店或棋子。相交数都是 0。 |
| `docs/screenshots/augment-strip/3d-1920x1080.png` | 图标约 42px，仍在棋子左侧。相交数都是 0。 |
| `docs/screenshots/augment-strip/3d-1440x1000.png` | 画面上图标在前排棋子左侧空位，不压棋子、羁绊、物品或商店。矩形检测与隐藏的 2D canvas 盒相交 1 次：3D 下这块 canvas 仍占着棋盘布局盒，图标按视口锚点落在它的左上范围内，不是压在圆柱棋子上。 |

测试：`npx vitest run tests/presentation/augment-strip-layout.test.ts tests/presentation/augment-strip-late-icons.test.ts tests/presentation/s13-root-ui-assets.test.ts tests/assets3d-augment-icons.test.ts tests/rendering3d-isolation.test.ts --maxWorkers=4`。布局 5 项、晚到图标 1 项，加上原有图标合同与隔离测试，均通过。`tsc --noEmit` 通过。

## 结论

体积预算和懒加载边界成立。306 条运行时定义的 API 名、客户端源路径、运行时路径、是否随包，与当前代码逐条一致。8 个缺源 ID 与 `docs/V26_AUGMENT_ICONS_LAYOUT.md` 一致。298 张已备图标的字节和 SHA-256 无法在本工作区复核：没有 `assets3d-local`，也没有执行组包。2D 横排按样式几何会比棋盘左侧 56px 物品槽更宽，宽视口时会伸进左栏；这是静态推断，不是实机截图。

## 改动（相对 `901d63d0`，行号为 `6bbb4002`）

| 文件:行 | 作用 |
| --- | --- |
| `src/presentation/augment-hud.css:3-23` | 在线横排：2D 绝对定位在 `#board-root` 左缘外；3D 用 `26.7vw` / `23.8dvh`；侦察时隐藏。 |
| `src/presentation/augment-text-data.ts:2` | 样式只随强化文本动态导入，不进入口样式表。 |
| `src/rendering/strategy-panel.ts:275` | 横排挂到 `#board-root`，不再插在羁绊列前面。 |
| `src/rendering/strategy-panel.ts:279` | 在线说明卡把横排算进挂载范围。 |
| `src/rendering/strategy-panel.ts:401-402` | 横排上的鼠标/触摸事件停止冒泡，避免点到背后棋盘。 |
| `src/rendering/strategy-panel.ts:575-578` | 刷新键加入 `augmentIconUrl`，索引晚到后会换掉文字徽章。 |
| `src/rendering/BoardScene.ts:369` | `loadRootUiAssets` 完成后、场景仍活动时调用 `strategyPanel.render()`。 |
| `scripts/assets3d/augment-icons.mjs:17-167` | 按定义 ID 的客户端 API 名取 14.24 图标路径；合并索引时保留其他批次；输出目录必须是 `assets3d-local` 下的新名字。 |
| `tests/assets3d-augment-icons.test.ts:7-48` | 新增 4 条：全定义映射、API 冲突、索引合并、下载命令与输出路径。 |
| `docs/V26_AUGMENT_ICON_AUDIT.tsv` | 306 条审计。 |
| `docs/V26_AUGMENT_ICON_MISSING.tsv` | 249 条不在随包清单中的定义。 |
| `docs/V26_AUGMENT_ICONS_LAYOUT.md` | 位置依据、缺源表和未执行的上传命令。 |
| `vite.config.ts:40,71-72` | 本提交未改。`augment-text` 仍在 `assets/ui` 名单里，该名单的模块边界由隔离测试把关。 |

## 2D 体积

口径与 `scripts/m7-budget.cjs:31-33` 相同：只计 `dist/assets/*.js`（不含子目录），gzip level 9。两次构建都用 `vite build --configLoader runner`。

| 构建 | index gzip-9 | phaser gzip-9 | 合计 | 相对上限 637,144 |
| --- | ---: | ---: | ---: | ---: |
| 父提交 `901d63d0` | 510,443 | 123,899 | 634,342 | 余 2,802 |
| `6bbb4002` | 510,497 | 123,899 | 634,396 | 余 2,748 |

入口增加 54 字节。Phaser 字节不变。3D JS gzip-9 仍是 343,607，差值为 0。`assets/ui`、`assets/solo` 里若干文件在剥掉内容哈希后与父提交相同，gzip-9 差 1–3 字节，只是引用的文件名哈希变了。

入口里新增的是动态依赖表中的 `./ui/augment-text-*.js` 和 `./augment-text-*.css`，加上横排挂载和刷新那几行。`index.html` 只加载入口 JS、预加载 Phaser、链接入口 CSS，没有预加载 `assets/ui/`、`assets/3d/`、`assets/solo/` 或海克斯样式。

新样式实际文件是 `assets/augment-text-*.css`（990 字节，gzip-9 为 495），不在 `assets/ui/`。它不计入 JS 预算。构建产物里这条样式不在入口 CSS 中；入口 JS 的依赖表只在动态导入强化文本时带上它。`tests/rendering3d-isolation.test.ts` 通过，因此 `assets/ui` 各 chunk 的模块仍都在 `src/presentation/` 下，且入口 gzip-9 断言仍小于 637,144。

## 代码

位置样式与既有 `src/style.css:1197-1201` 并存。懒加载样式选择器更具体，加载完成后覆盖定位、尺寸和横排不换行。加载完成前，已有强化的横排仍按入口样式出现在 `#board-root` 的普通流里。选强化时通常会先请求文本 chunk；重连时状态里已经有强化，可能先闪一下再跳到绝对定位。

2D 规则是 `position: absolute; top: 20%; left: -4px; transform: translate(-100%, -50%)`，包含块是 `#board-root`（`src/style.css:119`）。在线棋盘两侧留 `--item-gutter: 56px`（`src/style.css:444-447`）。图标为 `clamp(24px, 2.2vw, 44px)` 且 `nowrap`。应用最大宽度 1440px，但 `2.2vw` 按视口算。1440 宽、三枚图标时横排大约 100px，再加左侧网格间隙后，仍会越过 56px 槽，伸进默认展开的 360px 左栏（`src/style.css:339-341`，2D 默认不收起，见 `src/rendering/online/left-panel-toggle.ts:42`）。1920 宽时单枚图标约 42px，三枚加上异常徽章更宽。1100px 以下左栏改到棋盘下方，横排改为可能伸出视口左缘。异常徽章跟在强化后面，会再加一格宽度。

3D 规则写的是视口锚点，但 `#board-frame` 有 `container-type: inline-size`（`src/style.css:407`），layout containment 会成为内部 `position: fixed` 的包含块；3D 还有 `overflow-y: clip`（`src/style.css:1216`）。同一限制已写在 `src/style.css:1126-1128`。因此 `left` / `top` 的原点是棋盘框，不是视口，大约差一圈 8px 内边距。横排中心在框内约 23.8dvh，按框的高度推断不会被裁掉。3D 下 `#board-root` 是 `visibility: hidden`（`src/style.css:1136`），横排自己写了 `visibility: visible`，后代可以重新可见。棋盘框是 `pointer-events: none`（`src/style.css:1134`），横排写了 `pointer-events: auto`。侦察隐藏规则的选择器比显示规则更具体。这些都还没有在浏览器里点过。

图标刷新的数据路径是对的。`augmentIconUrl`（`src/presentation/augment-display.ts:49-51`）先用随包清单，否则用素材根。刷新键带上 URL 后，说明文字不变也会重绘横排。文本 chunk 到达时本来就会 `render()`（`strategy-panel.ts:269`）。`BoardScene.ts:369` 在素材根返回后再 `render()` 一次。这一次会清空并重建策略面板和商店（`strategy-panel.ts:570`），空闲回调最迟约 1.5 秒（`BoardScene.ts:370-371`）。若当时正在点商店，这次整页重绘会打断操作。

脚本侧：`collectApiNames` 只接受定义表里的 ID，冲突会抛错；`augmentSpecs` 要求图标路径落在 Hexcore 目录。`mergeAugmentManifest` 不改入参，缺文件时保留基线里同 ID 的旧资源条目，并记入 `unavailable`。运行时只读 `assets`，所以缺源 ID 若基线里已有旧路径，仍会显示旧图。新目录用 `mkdir` 默认失败于已存在的目录，文件用 `wx`。测试覆盖了路径逃逸在读输入之前被拒绝。没有把图片写入仓库；`.gitignore` 已忽略 `assets3d-local/`。

`src/server/` 无改动，因此没有新增 `setTimeout`、`Date.now`、`performance.now` 或 `window`。`BoardScene.ts:371` 的 `setTimeout` 是原有分支，本提交只改了回调内容。没有放宽超时或关掉校验。既有测试文件没有改断言；新测试只增加断言。

## 清单

用当前 `augmentSpecs()` 对过两张表：306 条 ID、API、源路径、运行时路径、随包标记全部一致；249 条缺随包表与审计表的对应列一致。审计表内部计数：随包 57、素材根原有 9、staged 为 yes 的 298、缺源 8。来源标记：随包 PNG 57、归档原生 52、归档 JPEG 转 PNG 189、缺源 8。这些来源标记没有对照图片字节重算。

缺源 8 个：`all-out`、`contested`、`hall-of-mirrors`、`pit-fighter-prizefighter`、`quickstriker-crest`、`quickstriker-crown`、`table-scraps`、`watcher-growth`。

## 测试

均带 `--maxWorkers=4`。没有 `--write`，没有跑 `playtest-1022b-bench`。

| 命令 | 结果 |
| --- | --- |
| `npx vitest run tests/assets3d-augment-icons.test.ts tests/presentation/s13-root-ui-assets.test.ts tests/presentation/augment-text-loader.test.ts --maxWorkers=4` | 3 个文件，73 项通过 |
| `npx vitest run tests/rendering3d-isolation.test.ts --maxWorkers=4` | 1 项通过（入口隔离、UI chunk 仅 `src/presentation`、gzip-9 < 637,144、HTML 不预加载 UI/3D/solo） |
| `npx tsc --noEmit --pretty false --incremental false` | 通过 |

## 未完成

- 没有打开页面。2D 与左栏/物品槽重叠、3D 锚点的约 8px 包含块偏移、侦察隐藏、晚到索引换徽章、点击不穿透，都还要实机看。
- 没有重跑 `scripts/assets3d/augment-icons.mjs`，没有核对 298 张 PNG 的魔数、尺寸和 SHA-256。
- 横排挂载点和“URL 进入刷新键”没有单独的界面测试；图标 URL 优先级仍由 `tests/presentation/s13-root-ui-assets.test.ts` 覆盖。
- 素材根晚到时调用的是整面板 `render()`，可能打断开局后 1.5 秒内的商店操作。本次没有改这个调用。

## 执行端待办

- 纪元、内容摘要、recorded fixtures、opening-random-identity 如有漂移，统一重录。本审查没有发现需要重录的摘要改动，也没有使用 `--write`。
- 按 `docs/V26_AUGMENT_ICONS_LAYOUT.md` 下载缺源与 JPEG 原图、用在线 `ui-assets.json` 重建、先载荷后索引上传测试服。不要带 `--delete`。
- 测试服部署。
- 浏览器/GPU 实机：在线 2D 与 3D，1280×720、1920×1080、1440×1000。看横排是否压住羁绊列、物品栏或棋子；悬停说明；点击不操作背后棋子；素材索引延迟到达后徽章换成图标；3D 侦察不显示自己的强化。
