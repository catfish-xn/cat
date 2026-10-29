# CURSOR：carousel 文档与 v26 去脚环同步

分支：`cursor/carousel-doc-sync-7c0e`（自 `claude/v26-no-foot-ring`）。

## 背景

v26（`docs/NORING_V26_REPORT.md`）已移除选秀待选单位脚下费用色环与 `carousel-shareddraft-unittier1..6` 粒子循环；费用/品质改由头顶方标，可选/待确认改为轻微抬起（+5 / +10）。`docs/ASSETS3D_CAROUSEL.md` 第 52、86、105 行附近仍描述旧接线，与代码和测试不一致。

## 本次文档改动

| 文件 | 内容 |
| --- | --- |
| `docs/ASSETS3D_CAROUSEL.md` | 粒子表注明 unittier1..6 仍在素材包、运行时不再请求；复看段区分「复看可见」与「正式 UI 不播放」；界面接线段改为 v26 方标+抬起，并列出 precache 中带 `unittier` 的六条 effect JSON |

未改 `scripts/`、`src/`、manifest 生成逻辑或本地 `assets3d-local/carousel/` 素材。

## 代码现状（供对照，非本次修改）

- `src/rendering/three-mode/carousel-stage.ts`：`FX` 常量不含 `unittier`；`styleCue` 控制方标透明度与 `HOVER_LIFT` / `PENDING_LIFT`。
- `tests/rendering3d-carousel.test.ts`：断言 `loadEffect` 从未请求 `carousel-shareddraft-unittier*`。

## precache 中仍含 `unittier` 的条目

构建约定（`scripts/assets3d/carousel-build.mjs` → `effects/carousel/${id}.json`）下，94 项 precache 里**路径名**含 unittier 的只有下列 6 个（未从清单删除）：

1. `effects/carousel/carousel-shareddraft-unittier1.json`
2. `effects/carousel/carousel-shareddraft-unittier2.json`
3. `effects/carousel/carousel-shareddraft-unittier3.json`
4. `effects/carousel/carousel-shareddraft-unittier4.json`
5. `effects/carousel/carousel-shareddraft-unittier5.json`
6. `effects/carousel/carousel-shareddraft-unittier6.json`

本环境无 `assets3d-local/carousel/precache.json`，未逐条核对 bytes/sha256；若需哈希级列表，在素材机执行：

```bash
jq -r '.files[].path | select(test("unittier"))' assets3d-local/carousel/precache.json
```

## 未做

- 未开 PR（按任务要求）。
- 未从 manifest/precache 移除 unittier 资源（仅文档标注「运行时未引用」）。
- 未重跑 carousel 构建或浏览器复看。
