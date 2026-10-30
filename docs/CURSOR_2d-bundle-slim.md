# 2D 体积瘦身

起点固定为 `e5a81840`（`cursor/v26-integration` 当时的头）。分支 `cursor/2d-bundle-slim`。未开 PR，未强推，未用 `--write` 重录纪元或内容摘要。

口径与门禁不变：只加总顶层 `dist/assets/*.js`，逐文件 `zlib.gzipSync(..., { level: 9 })`。`assets/3d`、`assets/solo`、`assets/ui` 不计。顶层懒加载 chunk 会计入。上限仍是 637144。Node `v22.23.4`，生产构建，未开 `VITE_LOCAL_ROOM`。

## 改前改后

| | index | phaser | 合计 |
| --- | ---: | ---: | ---: |
| 改前 `e5a81840` | 519042 | 123899 | **642941** |
| 改后 | 515330 | 111598 | **626928** |
| 差额 | −3712 | −12301 | **−16013** |

626928 低于 630000，余量 3072。低于上限 637144，余量 10216。改前复测与记录的 642941 一致。顶层仍只有这两个 JS，没有新增顶层 chunk。

单模块表是排查用估算：Rollup 已裁剪的模块代码再经 esbuild minify，然后单独 gzip-9。它不含 chunk 级字符串字典，也不能相加当成省下的体积。验收数字只看上面的整包。

## 入口与 Phaser 最大的 20 个模块（改前）

### `assets/index`（gzip-9 519042）

| 排名 | gzip-9 估算 | 模块渲染字节 | 模块 |
| ---: | ---: | ---: | --- |
| 1 | 22385 | 108132 | `src/rendering/strategy-panel.ts` |
| 2 | 21714 | 105330 | `src/rendering/BoardScene.ts` |
| 3 | 14022 | 83274 | `src/simulation/match.ts` |
| 4 | 13884 | 68546 | `src/simulation/combat-s13.ts` |
| 5 | 7841 | 35619 | `src/rendering/online/online-application.ts` |
| 6 | 7509 | 36654 | `src/simulation/m8/s13-mechanisms.ts` |
| 7 | 6682 | 28904 | `src/presentation/s13-g23-manifest.ts` |
| 8 | 6022 | 29140 | `src/simulation/strategy-snapshot.ts` |
| 9 | 5196 | 23510 | `src/simulation/content/opening-encounters.ts` |
| 10 | 4947 | 18490 | `src/simulation/validate-content.ts` |
| 11 | 4939 | 36789 | `src/simulation/content/augment-pool-batch3.ts` |
| 12 | 4932 | 25116 | `src/rendering/online/ws-client.ts` |
| 13 | 4911 | 20030 | `src/simulation/combat-s13-state.ts` |
| 14 | 4866 | 18856 | `src/simulation/content/g2-3-anomaly-source.ts` |
| 15 | 4748 | 20223 | `src/stats/stats-panel.ts` |
| 16 | 4740 | 21421 | `src/simulation/augment-history.ts` |
| 17 | 4691 | 25513 | `src/simulation/content/g2-3-special-item-runtime.ts` |
| 18 | 4646 | 18338 | `src/simulation/effects.ts` |
| 19 | 4573 | 15873 | `src/simulation/content/g2-4-artifacts.ts` |
| 20 | 4559 | 22232 | `src/simulation/opening-encounter.ts` |

### `assets/phaser`（gzip-9 123899）

| 排名 | gzip-9 估算 | 模块渲染字节 | 模块 |
| ---: | ---: | ---: | --- |
| 1 | 5592 | 120352 | `node_modules/phaser/src/input/InputPlugin.js` |
| 2 | 3599 | 66010 | `node_modules/phaser/src/scale/ScaleManager.js` |
| 3 | 2901 | 50626 | `node_modules/phaser/src/gameobjects/text/Text.js` |
| 4 | 2846 | 49252 | `node_modules/phaser/src/scene/SceneManager.js` |
| 5 | 2806 | 65666 | `node_modules/phaser/src/textures/DynamicTexture.js` |
| 6 | 2757 | 22302 | `node_modules/phaser/src/geom/polygon/Earcut.js` |
| 7 | 2732 | 46544 | `node_modules/phaser/src/loader/LoaderPlugin.js` |
| 8 | 2610 | 57890 | `node_modules/phaser/src/textures/TextureManager.js` |
| 9 | 2447 | 32832 | `node_modules/phaser/src/core/Config.js` |
| 10 | 2357 | 63729 | `node_modules/phaser/src/cameras/2d/BaseCamera.js` |
| 11 | 2111 | 29728 | `node_modules/phaser/src/renderer/canvas/CanvasRenderer.js` |
| 12 | 2021 | 51453 | `node_modules/phaser/src/gameobjects/graphics/Graphics.js` |
| 13 | 1937 | 36457 | `node_modules/phaser/src/input/InputManager.js` |
| 14 | 1900 | 29895 | `node_modules/phaser/src/animations/Animation.js` |
| 15 | 1894 | 36785 | `node_modules/phaser/src/animations/AnimationManager.js` |
| 16 | 1814 | 31143 | `node_modules/phaser/src/gameobjects/components/TransformMatrix.js` |
| 17 | 1719 | 51704 | `node_modules/phaser/src/gameobjects/container/Container.js` |
| 18 | 1635 | 33040 | `node_modules/phaser/src/gameobjects/text/TextStyle.js` |
| 19 | 1598 | 29899 | `node_modules/phaser/src/tweens/tween/Tween.js` |
| 20 | 1530 | 30927 | `node_modules/phaser/src/plugins/PluginManager.js` |

同一 moduleId 出现在多个 chunk 的记录为 0。最大头是规则和棋盘界面，不是两份重复库。

## 每处省了多少

数字是「只撤回这一处、其余保持交付树」时整包回升的字节。gzip 字典会让各处相加和整包差额差几十字节。index 两处相加比实际多 11 字节；phaser 六处相加比实际少 25 字节。

### 生产包里的审计数据（index −3712）

| 改动 | 省下 |
| --- | ---: |
| 生产构建去掉源表里的 `pointer`、`sourceName`、`titleKey`、`descriptionKey`、`rawKey` | 2289 |
| 装备目录不再 import `source-manifest.ts`（URL、sha256、归档路径）。版本字符串仍是 `s13-14.24b-m8-b5-v1` | 1434 |

这些键只给内容审计用。运行时读的是名称、描述和数值。源文件本身没改，测试和内容摘要仍看到完整表。`source-manifest` 在客户端图里只被目录版本引用，整份对象因此离开入口。

把「出现两次且长度至少 32」的字符串也收进入口字典试过一次：整包从 626928 涨到 627378（+450）。已撤回，不在交付里。

### 未使用的 Phaser（phaser −12301）

只作用于生产构建，并按上游文件 SHA-256 钉住。开发服务器仍是原来的引擎。游戏快捷键继续走 `BoardScene` 的原生 keydown。用到的缓动是 `Sine.easeInOut`、`Sine.easeOut`、`Cubic.easeOut`、`Quad.easeIn`，默认仍是 Linear（Power0）。

| 改动 | 省下 |
| --- | ---: |
| 去掉 DynamicTexture。它只被 `addDynamicTexture` 引用；头像用的是 CanvasTexture。连带不再被引用的 RenderTarget、WebGL Utils 也离开包 | 3481 |
| 贴图解析器只留 `Parser.Image`。没有图集、精灵表、KTX、PVR 的调用 | 2964 |
| 镜头 fade/flash/shake/pan/zoom/rotateTo 换成空对象。`update` 仍每帧调用，`start` 会抛错 | 1858 |
| 缓动表只留 Linear、Quad、Cubic、Sine | 1491 |
| 不构造 KeyboardManager。`main.ts` 同时写 `input.keyboard: false` | 1336 |
| 数组工具桶去掉只有桶自己引用的 Matrix、EachInRange、NumberArrayStep、RemoveRandomElement、RotateLeft、RotateRight | 1146 |

`AnimationManager` 仍在包里。隔离测试要求它留下，这次没有改那条断言。

## 没有挪进子目录

没有把代码放进 `assets/ui`、`assets/solo` 或 `assets/3d`。商店、棋盘、右侧血条、战斗统计、帮助按钮、开局奇遇条都还在入口里，因为开局画面会用到它们。选秀、战斗结算条、终局排名不是开局就画出来的，但它们在联机应用构造时同步建好，3D 选秀和现有测试也按同步对象调用。把它们改成异步加载会改这些调用的时序，而上面的删除已经低于 630000，所以没有为了口径把它们挪走。

## 规则与测试

没有改战斗、经济、随机或数值。`item-catalog` 写出的 `contentVersion` 与 `SOURCE_MANIFEST.equipmentCatalogVersion` 相同，由 `tests/item-catalog-version.test.ts` 钉住。`src/server` 没有新增 `setTimeout`、`Date.now`、`performance.now`、`window`。

`NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit -p .` 通过。`npm test -- --configLoader runner --maxWorkers=4` 跑了隔离体积、目录版本、入口字符串和 `tests/v19-part2.test.ts`：隔离、目录版本、入口字符串通过；v19 共 40 项，39 项通过。失败的 1 项是 `retains v19 rules in v25-online-rules schema/save/replay 12/8/8`，期望 `rulesVersion` 为 `s13-g2-3-v25-online-rules`，本提交的 `src/simulation/m8/version.ts` 已是 `s13-g2-3-v26-neutrals-1424`。这次没有改版本文件，也没有重录。
