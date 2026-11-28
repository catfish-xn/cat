# assets3d-local 软链克隆修复

## 改动摘要

| 文件 | 行号 | 内容 |
| --- | --- | --- |
| `.gitignore` | 9–10 | `/assets3d-local` + `assets3d-local/` |
| `scripts/assets3d/safe-path.mjs` | 22–26 | `insideRoot()`：判断严格包含关系 |
| `scripts/assets3d/safe-path.mjs` | 28–43 | `assets3dLocalBound()`：软链目标为 repo 根、repo 内目录或 repo 祖先时抛 `unsafe-output-path`；普通目录或非 repo 外置目录软链仍解析为 `realpath` |
| `scripts/assets3d/safe-path.mjs` | 45–89 | `safeOutputPath()`：逻辑/bound 双 containment；遍历返回 `realpath` |
| `tests/assets3d-paths.test.ts` | 54–55 | 绝对路径期望改为 `join(await realpath(root), 'nested/report.json')` |
| `tests/assets3d-paths.test.ts` | 83–105 | 软链根可写；指向 repo 根 / `src` 拒写且目标文件不变；bound 内二次逃逸仍拒 |

## 测试结果

常规克隆（`assets3d-local` 为目录或不存在）：

```text
npm test -- tests/assets3d-paths.test.ts --maxWorkers=4
→ 1 文件、12 用例通过
```

`assets3d-local` 为指向临时目录的仓库根软链：

```text
npm test -- tests/assets3d-paths.test.ts tests/assets3d-carousel.test.ts --maxWorkers=4
→ 2 文件、19 用例通过
```

## 未完成项

- `safeInputPath()` 未改；输入侧软链根场景未覆盖。
- 未合入 `multiplayer`；本分支仅推送，无 PR。
- 未跑全量 assets3d / headless 套件。
