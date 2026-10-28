# v26-B 小件特效：审核修正报告

2026-10-28；工作分支 `claude/v26-small-fx`，修正起点 `29b09578255d916ce768040d0889e34e30d5bddb`。工作区起点干净；未写 `.git`，未提交或合并。本报告替代初版体积结论。

**M1 尚未全部完成：2D 已下降 736 B，但相对指定 635,487 B 基线仍净增 109 B。** 不把低于原硬上限等同于满足本次零净增要求。S1、S2、S4、S5 和 S3/S7 的文档修正已完成。

## 逐项改动

| 审核项 | 文件:行 | 结果 |
| --- | --- | --- |
| M1 展示逻辑按需加载 | `src/presentation/confiscation-display.ts:1`、`:13`、`:75` | 只有 type imports；运行时选择器、单位目录、装备目录和装备展示读取器均由调用方参数对象注入。公开阵容的羁绊投影内联在本模块，不再值导入 opponent-board。 |
| M1 Phaser 章与战斗接线 | `src/presentation/confiscation-display.ts:84`、`:91`、`:102`；`src/rendering/BoardScene.ts:1343` | 装备过滤、更新及文字章创建均在懒模块。BoardScene 的新增入口为一行调用；单人及未加载时继续原权威装备展示路径。 |
| M1 懒模块启动 | `src/rendering/online/confiscation-display.ts:4`；`src/rendering/online/online-application.ts:115`、`:159`、`:164`、`:282` | OnlineApplication 构造时开始 import；公开视图与回放捕获按 Promise 回调注册顺序送达，加载前推送不会丢失。加载失败保留原装备、不盖章。 |
| M1 chunk 路径 | `vite.config.ts:71` | `confiscation-display` 命名进入 `assets/ui/`；没有修改 manualChunks 的 3D 边界。 |
| M1 单位字段与公共助手 | `src/presentation/unit-view.ts:38`、`:73`、`:132`；`src/rendering/BoardScene.ts:1482`；`src/rendering/online/opponent-board.ts:51` | UnitView 只留章的类型、更新时隐藏和显示容器；BoardFeed 读取章的可见性。移除原 publicTraitSnapshots 导出，原 publicTraits 恢复直接调用领域选择器。 |
| M1 装备读取接线整理 | `src/rendering/BoardScene.ts:955` | 同一轮 reconcile 内复用已查到的 combatUnit，避免三次相同查找；无装备或账本语义变化。 |
| S1 选择器异常 | `src/presentation/confiscation-display.ts:54`、`:65` | publicTraitSnapshots 调用包 try/catch；任一侧失败则缓存为空的 victims，按未知处理，不盖章，也不在之后每帧重试抛异常。 |
| S2 回合内冻结 | `src/presentation/confiscation-display.ts:26` | 收到首个 combat 视图后，同回合后续 combat、settlement、ended 视图都不覆盖它；跨回合清空战斗缓存。 |
| S4 空战斗 ID | `src/presentation/confiscation-display.ts:33`、`:37` | undefined 和空串都不捕获、不推断，原样返回装备与 extras。 |
| S5 可没收装备口径 | `src/presentation/confiscation-display.ts:39` | 与 strategy-snapshot.ts:116 附近的 keeps 口径一致：已知纹章保留；不在装备目录中的物品也没收。英雄/非英雄判断不变。 |
| S3/S7 风险说明 | `docs/S13_RULES_GAP.md:1163` | 明确仅按公开阵容推断；海克斯/法球等羁绊来源及镜像规则不计入，可能漏盖章；单人模式未做。补充首个 combat 视图未必是开战快照。 |
| 隔离与体积证据 | `tests/rendering3d-isolation.test.ts:100` | 新增懒模块存在性断言及 2D/3D/没收 chunk gzip-9 日志。原 637,144 硬上限、UI imports=[]、模块必须在 presentation、3D 不导入 2D/UI 等断言全部保留。 |

没有修改 `src/server/`、`src/simulation/`、任何 3D 模块、规则数值、内容版本或版权素材。

## 真实生产构建与 gzip-9

命令：`export PATH=$HOME/.local/bin:$PATH`，然后 `npx vite build --configLoader runner --outDir <新的临时输出目录>`。构建前后分别使用独立目录，避免外部 outDir 保留旧 hash 文件造成重复求和。每个 `.js` 单独 gzip level 9 后求和；2D 仅计顶层 assets，3D 包括 assets/3d 中的 JS chunk 和 Basis 转码器 JS 资源。

| 版本 | 2D gzip-9 B | 3D gzip-9 B | 没收懒 chunk B |
| --- | ---: | ---: | ---: |
| 原功能基线 `686f3086`（指定/初版实测） | 635,487 | 333,961 | 0 |
| 本次修正前 `29b09578`（重新实测） | 636,332 | 334,635 | 0 |
| 本次修正后（真实构建、隔离测试一致） | **635,596** | **334,635** | **1,448** |
| 相对本次修正前 | **-736** | **0** | +1,448 |
| 相对原功能基线 | **+109，M1 未达成** | **+674** | +1,448 |

没收 chunk：`assets/ui/confiscation-display-Bh0XBhzk.js`；全部 UI chunk 合计 36,014 B。隔离测试确认该 chunk 的模块全部属于 `src/presentation/`，`imports` 为 `[]`，只经动态路径从入口可达；HTML 不预加载它。3D 仍只依赖 assets/3d/，本次没有增加 3D 字节。

剩余 109 B 是生产产物相对基线的实际差额：懒加载引导、参数注入、异步公开视图/回放投递，以及 UnitView/BoardFeed 的少量接线仍须留在入口。没有用逐块边际估算冒充最终差额，也没有把领域依赖塞进 UI chunk 或放宽隔离例外来隐藏字节。曾尝试把共用装备同步接到应用接口并随单人包拆分，但实测更大，未保留该改动。**本次不能签收 M1；还需至少减少 109 B。** 原 637,144 上限及现有隔离检查仍通过。

构建日志、测试日志和体积 JSON 位于忽略目录 `artifacts/v26-audit/`，生成物不提交。

## 验证结果

指定六个文件合计 **48 项通过**：

| 文件 | 通过项数 |
| --- | ---: |
| tests/v26-carousel-timer.test.ts | 3 |
| tests/v26-confiscation-display.test.ts | 12 |
| tests/m7-fx-plan.test.ts | 3 |
| tests/rendering3d-carousel.test.ts | 26 |
| tests/rendering3d-overhead.test.ts | 3 |
| tests/rendering3d-isolation.test.ts | 1 |

另跑 `tests/unit-view-item-stacks.test.ts` 1 项、`tests/rendering3d-scout-shop.test.ts` 15 项；总计 **8 文件、64 项通过**。全量 `npm run typecheck`（`tsc --noEmit`）、真实 Vite 生产构建和 `git diff --check` 通过。

新增回归位于 `tests/v26-confiscation-display.test.ts:80`、`:93`、`:111`、`:121`、`:129`、`:151`、`:162`：结算先于回放/首次 gear 读取、两侧选择器分别抛错且不逐帧重试、空战斗 ID、不在目录中的装备、懒加载期间推送顺序、章附着移动 body/死亡隐藏、正常/旧版装备同步、chunk 失败回退。原有断言未删除，未调整任何超时或阈值。

Vitest 使用 `--configLoader runner --maxWorkers=2 --project fast`。本轮最终验证分组执行：隔离测试单跑（真实生产构建）；其余 7 文件一组。曾在扩展回归与构建同跑时，一条既有选秀取景用例触发原 5 秒超时；原限时下单独复跑 26/26 通过，最终分组全绿，未改测试。

本机没有浏览器桥接变量，指定用例也无需浏览器。最终复跑使用忽略目录中的 `vitest-no-browser.config.ts`，仅移除未使用的 Chrome 全局启动；原项目 setupFiles、测试配置和所有断言保留，隔离用例仍加载真实 vite.config.ts。未做浏览器实机视觉验收。

## 明确风险与未完成

- **首个 combat 视图未必是开战快照，可能误/漏盖章。** 同回合冻结只防止之后的结算视图覆盖，不证明首次收到的数据等于真实开局。
- 推断只看公开阵容及持有的纹章，海克斯/法球等羁绊来源、镜像规则不计入，可能漏盖章。观战配对不唯一时仍不猜测；单人模式未做没收展示。
- M1 仍差 109 B；建议继续做局部展示入口瘦身，达成零净增后再由执行端提交，不建议放宽预算或隔离条件。
