# LTK 绘制缓冲池化（cursor/ltk-buffer-pool）

## 背景

LTK 特效每次 `createLtkParticles` 会为 Quads / Projections / Trails / Beams / Meshes 新建 GPU 缓冲，并在 `dispose` 时销毁；多 pass 的 frame copy 与 depth target 在尺寸变化或 `releaseFrame` 时也会反复分配。Late-game 连播时分配压力明显。

参照远程 `cursor/late-game-perf`（`6bf48ee6`）中 `combat-fx-pool` 的思路：按尺寸（或 mesh 键）借出，特效结束归还，运行时关闭再统一 flush。

## 实现

| 模块 | 行为 |
| --- | --- |
| `rendering/utils/drawBufferPool.ts` | 按 `capacity` / ribbon 顶点数 / mesh definition key 池化；`flushDrawBufferPool()` 在 runtime dispose |
| `rendering/utils/frame.ts` | frame copy 与 depth render target 按 `WxH` 池化；`releaseFrame` 归还而非 dispose；`flushFrameTargetPool()` |
| 各 `rendering/components/*` | `borrow*` / `release*` 替代直接 `*Buffers()` + `geometry.dispose()` |
| `particles.ts` | mesh 用 `borrowMeshBuffers(definition.key, …)` |
| `runtime.ts` | dispose 时 flush 粒子缓冲池与帧目标 spare |

## 测试

- `tests/vfx-ltk-draw-buffer-pool.test.ts`：连续两次播放同一 synthetic 系统，第二次 `quadAlloc` 不增、`quadReuse` 增，且复用同一 geometry；flush 后再次播放会重新 alloc。
- 帧目标：同一尺寸下 `releaseFrame` → 再次 `grabFrame`/`grabDepth` 触发 `frameReuse` / `depthReuse` 且无新增 alloc。

相关回归：`tests/vfx-ltk-particles.test.ts` 等 LTK 套件。

## 约束

- 仅 `src/rendering/three-mode/vfx-ltk/**` 与测试；未改 simulation / server。
- 池代码留在既有 LTK 懒加载 chunk 内，不进入主包。
- 2D 顶层 `dist/assets/*.js` gzip-9 预算不变（637,144 字节上限）。

## 基线

- 开工点：远程 `claude/v26-integration` @ `c9b30bc7`（仓库暂无 `cursor/v26-integration`）。
- 工作分支：`cursor/ltk-buffer-pool`；后续合入 v26 集成线。
- 池化参照：`cursor/late-game-perf` @ `6bf48ee6`（`combat-fx-pool` 模式）。
