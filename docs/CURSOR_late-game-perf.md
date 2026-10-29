# 后期卡顿第 2 轮（客户端特效）

基于 `claude/v26-late-game-perf` @ `8efbc17f`。分支 `cursor/late-game-perf`。没有改 `src/simulation/`、`src/server/`、规则、内容身份或存档。没有开 PR，没有强推。

## 文档修正

- `docs/V26_LATE_GAME_PERF_REPORT.md:44`：`freezeOwned` 把递归栈每一帧的包含时间加总是 14.12%，同一采样被重复计入；只计最外层调用约为 **3.84%**。
- `docs/V26_LATE_GAME_PERF_REPORT.md:56`：那次 loop.lag=122 ms 的回合是 **1-2**，不是 1-1。

## 测量

`node --expose-gc scripts/profile-late-game-fx.cjs`。纯 Node CPU，无浏览器、无 WebGL、无 FPS。合成 8 个四边形特效 + 4 条拖尾，预热后各 180 帧；普攻 24 发/帧、120 帧；16 个带 40 节骨骼的单位加地面通道，40 次。

| 路径 | 修复前 p50 / p95 | 修复后 p50 / p95 |
| --- | --- | --- |
| 8 个四边形特效更新 | 0.135 / 0.293 ms | 0.103 / 0.284 ms |
| 4 条拖尾更新 | 0.242 / 0.875 ms | 0.092 / 0.544 ms |
| 24 发普攻 + 一帧更新 | 0.027 / 0.041 ms | 0.019 / 0.033 ms |
| 地面通道场景扫描 | 0.095 / 0.226 ms，每趟 `traverse` 1383 次 | 0.009 / 0.099 ms，每趟 1 次 |

活粒子数前后都是 224。修复后每个四边形特效 `builtMeshes` 停在 23，后 180 帧不再增加。4 个同时带 early/late/soft 的系统走降级：额外通道关闭。这不是设备帧时间，也不能代替 GPU 验收。

## 改动

| 文件:行 | 做什么 |
| --- | --- |
| `src/rendering3d/particles-v2.ts:67,157,231,240,250` | 四边形/射线网格复用；出生用的向量、四元数、拖尾采样回收；过期就地压缩；拖尾和朝向不再每帧 `clone` / `new Matrix4` / `new Quaternion`。拖尾几何仍在粒子结束时 `dispose` 一次 |
| `src/rendering3d/particles.ts:46,99,147` | v1 朝向四元数复用；公开 `builtMeshes` |
| `src/rendering/three-mode/skill-feel.ts:107,147` | 普攻脉冲和向量随精灵池一起复用，满池仍少画而不加对象 |
| `src/rendering/three-mode/placeholder-renderer.ts:866,908` | 缩放和普攻使用调用方草稿向量，`attack` 立即拷贝 |
| `src/rendering/three-mode/vfx-ltk/rendering/passes.ts:10` | 地面/灯光扫描跳过骨骼树，两张 Map 跨帧复用 |
| `src/rendering/three-mode/vfx-ltk/runtime.ts:14,108,123` | 模板声明缓冲复用。同时活着的系统 ≥ 4 时关掉景深和扭曲通道，颜色粒子仍画 |
| `src/rendering/three-mode/vfx-ltk/engine/simulation/stepper.ts:36` | 步进对象按步进器复用 |
| `src/rendering/three-mode/vfx-ltk/engine/simulation/particleRead.ts:85` | `frameInto` 供绘制路径覆写，不再每源每帧分配 |
| `src/rendering/three-mode/vfx-ltk/rendering/utils/palette.ts`、`components/Quads.ts`、`Beams.ts`、`Meshes.ts`、`Projections.ts`、`Trails.ts` | 使用 `frameInto` |
| `src/rendering/three-mode/vfx-ltk/rendering/components/AttachedMeshes.ts:44` | 附着网格每帧改已有 uniform 数组，不再 `Array.from` / 新数组 |
| `src/rendering/three-mode/vfx-ltk/engine/simulation/children.ts:246` | 子效果的发射集合和帧槽跨步复用 |
| `src/presentation/combat-fx.ts:23` | 2D 斩击/弹道/施法圈/治疗圈最多同时 48 个，对象池复用；超出只丢形状，突进和受击仍做。战斗清理时 `releaseAll` |
| `src/rendering/BoardScene.ts:1313` | 清战斗特效时归还 2D 池 |
| `src/rendering/hex-layout.ts:7`、`src/rendering/replay-view.ts:89,142` | 回放格子和特效坐标写入草稿；过期特效就地压缩 |
| `scripts/profile-late-game-fx.cjs` | 上面的 CPU 探针 |

没有新增 `assets/ui` 模块。2D 增量写在已经静态加载的棋盘路径上（同步绘制，不能等动态 import）。`assets/ui` 仍只含 `src/presentation`。3D 改动留在 3D chunk。没有把素材或 `assets3d-local` 放进 git。

## 体积

生产构建后顶层 `dist/assets/*.js`：Node `zlib.gzipSync` level 9 合计 **631783** 字节，GNU `gzip -n -9` 合计 **627510** 字节。门禁 637144。隔离测试 `tests/rendering3d-isolation.test.ts` 通过。

## 测试

`npx vitest run --project fast --maxWorkers=4`，下列文件全部通过（22 个文件、328 条，外加隔离测试 1 条）：

`tests/rendering3d-particles-v2.test.ts`、`rendering3d-particles.test.ts`、`rendering3d-particle-pooling.test.ts`、`rendering3d-particle-readers.test.ts`、`rendering3d-late-game-retention.test.ts`、`rendering3d-skill-feel.test.ts`、`rendering3d-catchup.test.ts`、`rendering3d-playtest-effects.test.ts`、`rendering3d-singed-cast.test.ts`、`rendering3d-isolation.test.ts`、`vfx-ltk-ground-pass.test.ts`、`vfx-ltk-timeline.test.ts`、`vfx-ltk-features.test.ts`、`vfx-ltk-engine-conformance.test.ts`、`vfx-ltk-particles.test.ts`、`vfx-ltk-review-r.test.ts`、`vfx-ltk-review-j.test.ts`、`vfx-ltk-catalog.test.ts`、`vfx-ltk-converted-events.test.ts`、`combat-fx-pool.test.ts`、`m7-layout.test.ts`、`rendering3d-picking.test.ts`。

`npx tsc --noEmit` 通过。没有删断言、没有放宽超时或既有上限。拖尾几何仍在退场时释放一次（原断言保留）。`MAX_LTK_SYSTEMS` 仍是 6，`MAX_EFFECTS` 仍是 48，`MAX_LIVE_PARTICLES` 仍是 1500。新增的是 2D 同屏 48 和「第 4 个 LTK 系统起关闭额外通道」。

## 未完成

- 没有浏览器或 GPU 帧时间。上面的毫秒只说明 CPU 分配和场景遍历。
- LTK 绘制缓冲仍按每次施法创建并在结束时释放。跨施法池化会让 `tests/rendering3d-late-game-retention.test.ts` 里「每轮几何/材质归零」不再成立，所以没做。
- 拖尾几何不进池，避免改掉「退场时 dispose 一次」。
- 服务器 50–89 ms 尖峰、流式回放前缀复制、侧栏整表重建都没动。
- 没有跑完整对局，没有 `--write` 重录，没有跑 `playtest-1022b-bench`。

## 执行端待办

- 纪元 / 内容摘要：本轮没有改模拟或内容，没有需要重录的漂移。若执行端自己的树有摘要差，由执行端统一 `--write`。
- 素材下载、提取、上传测试服（ssh tencent）和测试服部署：不要由本分支代做。
- 浏览器 / GPU 实机（codex-browser）：同一后期对局开关 LTK，看帧时间、draw call、长任务。拥挤时第 4 个系统起不应再走景深/扭曲通道；2D 形状不应超过 48 个同时存在。
