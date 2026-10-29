# assets3d-local 软链克隆修复

## 改动摘要

| 文件 | 行号 | 内容 |
| --- | --- | --- |
| `.gitignore` | 9 | 新增 `/assets3d-local`（无尾斜杠），忽略仓库根下的目录软链本身 |
| `.gitignore` | 10 | 保留 `assets3d-local/` 忽略目录内容 |
| `scripts/assets3d/safe-path.mjs` | 22–35 | `assets3dLocalBound()`：解析 repo 根 `assets3d-local` 目录软链到真实目录 |
| `scripts/assets3d/safe-path.mjs` | 38–81 | `safeOutputPath()`：逻辑路径 + `localBound` 双 containment；根为外链时从 bound 树遍历；嵌套 link 仍用 `realpath` 限制在 bound 内 |
| `tests/assets3d-paths.test.ts` | 71–95 | 软链根写入通过；bound 内二次目录软链逃逸仍拒 |

## 测试结果

```text
npm test -- tests/assets3d-paths.test.ts tests/assets3d-carousel.test.ts \
  tests/assets3d-fetch.test.ts tests/assets3d-extract.test.ts \
  tests/assets3d-batch.test.ts tests/assets3d-merge.test.ts --maxWorkers=4
```

6 个文件、65 个用例全部通过。

## 未完成项

- 未在真实「本机 assets3d-local → 外部素材盘」克隆上跑完整 `test:headless` / 全量 assets3d 套件；仅上述相关 fast 项目子集。
- `safeInputPath()` 未改；若输入侧也存在同类软链根场景，需另开任务。
- 未合入 `multiplayer`；本分支仅推送，无 PR。
