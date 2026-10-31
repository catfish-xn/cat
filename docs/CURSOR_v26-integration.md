# v26 集成记录

分支 `cursor/v26-integration`，起点 `claude/v26-integration` 的 `c9b30bc7`。当前头 `6b04c853`。未开 PR，未强推，未用 `--write` 重录纪元、内容摘要或 golden。

身份仍是 `s13-g2-3-v26-neutrals-1424` / `s13-14.24b-g2-3-v26-neutrals-1424`（`src/simulation/m8/version.ts`）。targeting-p0、anomaly-ui、d5-register 文档里的 `s13-g2-3-v26-online-rules` 只写在注释中。`bc0401e6`、`fd1cc69f` 的现场身份期望（中立 14.24 字符串，以及把 `v26-neutrals-1424` 换成 `v19` 后必须拒绝）保留。schema/save/replay/command 仍是 12/8/8/7。

## 冲突修正

`7ff86a46`：LTK 发射面采用方案 (a)。`src/rendering/three-mode/vfx-ltk/loader.ts` 里 surface 只走 batch3 的 `emission()`，mesh 仍由原出生网格循环用 `readEmissionMesh` 读取；该循环写回时保留已装上的 surface，不再写成 `null`。`runtime.ts` 的 cue 过滤改为无条件 `cue.variant === form`，选项对象不会把 empowered/self 选进默认形态。`tests/assets3d-paths.test.ts` 两处动态 import 改为 `.href`，类型检查才能通过；路径断言未改。

## 2D 体积

顶层 `dist/assets/*.js` 的 gzip-9。上限 637144。头 `6b04c853`：`index-DoAwJzHS.js` 519042 + `phaser-BGDWgGxt.js` 123899 = **642941**，超出 **5797**。超出后只记录，没有为压体积改代码。3D 分包不计入。

## 未合并

- `cursor/augment-icons-layout`：仍在返修，未合。
- 纪元、内容摘要、m5 golden、opening 身份：留给执行端统一重录。

## 已知漂移（未改断言、未重录）

- `tests/epic-loot-reforger.test.ts` 记录态 `unsupported-version`（两处）仍留给纪元重录。
- 合并 D5 后，公开路线的 seen-once 账本与记录不一致（例如 R5 前置、reforger 套件在导入时失败）。
- `tests/over-encumbered-settlement-restore.test.ts`：3-7 的 `pending-capacity` 不是 3，随后出售得到 `wrong-phase`。
- `tests/server/d5-local-room.test.ts` 与 `d5-placeholder-room.test.ts`：`what-you-really-are` 到 4-2 时 `pendingChoice` 为空。
- `tests/server/augment-pool-batch5-h6-room.test.ts`：`missing executed death samples`，后续回合到不了。
- `tests/server/shared-pool-room.test.ts`：placeholder 整局 `seat-stuck` / `forfeit:invalid-pool`。
- `tests/rendering3d-playtest-effects.test.ts`：原星星包一层 Group 后，星标查找仍按单个 `ShapeGeometry` Mesh，合并演出那条失败。该断言未改弱。

## 执行端

纪元与摘要重录、素材下载与上传、测试服部署、浏览器/GPU 验收仍由执行端做。本记录没有做浏览器目测。
