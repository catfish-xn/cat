# 默认棋盘行列对齐

构建端默认棋盘（`board-default`）按原版 **BoardLocator / BoardCenterLocator** 摆放，
与测试服手工恢复的定位点摆法一致；素材脚本不再做地面/墙截线拟合。

## 定位点含义

- **BoardLocator**：首格（第 0 行第 0 列）在源场景中的位置。
- **BoardCenterLocator**：56 个战斗格的几何平均中心；相对首格为 **3.25 列、3.5 行**
  （奇数行右移半格的六角网格上，这是 7×8 战斗区的标准中心偏移）。

由这两点分别推出 x、z 方向的**源步长**（不要求相等）：

- `sourceStepX = (center.x − first.x) / 3.25`
- `sourceStepZ = (center.z − first.z) / 3.5`

`boards-build.mjs` 对所有棋盘调用 `boardAlignment`（locator 锚点不变）。若 `boards-plan.mjs` 的 `BOARD_PICKS` 条目含 **`alignmentScale`**（`f = 目标可走格数 ÷ 前排 implied 格宽`；locator 基准下可走区宽 = `implied × f`），构建时将该系数**均匀乘到** `scale[0]`、`scale[1]`、`scale[2]`，并写入 manifest 的 `alignment.alignmentScale` 与 `alignmentEvidence`；缺省棋盘为字面量 `'default'`。

**board-default** 的 implied 取 **截图石栏内沿**（`report.md` / r2 量法，locator 基准 **8.48 格**），目标 **7.2 格** → **f = 7.2/8.48 ≈ 0.849**（`alignmentEvidence.kind: screenshot`）。mapgeo **内墙射线**约 **9.07 格**（`rayInnerWallCells`，仅参考；缩放后在同一截图格尺下约 **7.7 格**，与石栏边不是同一条线）。

- `scale[0] = √3 · target.radius / sourceStepX · alignmentScale`
- `scale[2] = −1.5 · target.radius / sourceStepZ`（负号与 GLB 内 x 反射一致）
- y 缩放沿用 x 缩放；offset 把源中心映射到 `target` 网格（默认 `radius: 34`，`origin: {35, 50}`）。
- 产出 `status: 'locator-aligned'`；`sourceFirstCell`、`sourceCenter`、`sourceSteps` 记录输入与步长。

运行时 `arenaTransform`（`board-arena`）按当前 `BoardFrame` 的半径与原点重定向，无需改规则层。

## 已撤销的贴墙拟合

此前曾对 `board-default` 额外做地面/墙材质截线的「包络贴墙零余量」拟合
（`ground-span-aligned`，`sourceGround` / `sourceGroundX` 等字段）。实机与原版客户端观感不符，
用户已批准换回定位点摆法；测试服 manifest 已手工改回，本仓库脚本与之对齐。

该拟合模块已从构建管线删除；summary 中的 `deformation` 字段仍可读，新构建下一般为 `null`。

## 缺失与错误

找不到 **BoardLocator** 或 **BoardCenterLocator** 时构建失败（`missing-board-grid-locators`），
**不会**退回包围盒或几何拟合。步长非正（中心不在首格右下方等）时抛 `invalid-board-locators`。

## 测试

`tests/assets3d-boards-alignment.test.ts` 仅用合成定位点与独立指定的格心，验证缩放公式、
56 格经 `arenaTransform` 与 `hexCenter` 的映射，以及构建脚本不再引用贴墙拟合。
真实原版坐标与测试服数值不写入仓库。
