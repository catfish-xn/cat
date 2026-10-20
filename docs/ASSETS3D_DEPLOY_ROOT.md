# 离线重建完整 3D 素材根

以下占位符须替换为实际绝对路径；命令在仓库目录运行，保留路径外的引号：

| 占位符 | 含义 |
| --- | --- |
| `<REPO>` | 仓库目录 |
| `<ASSETS_LOCAL>` | 仓库的 `<REPO>/assets3d-local` 目录 |
| `<HEROES_ROOT>` | 已有英雄素材根，可为只读目录联接 |
| `<FX_BATCH1_ROOT>` 至 `<FX_BATCH6_ROOT>` | 按顺序合并的六个特效批次根 |
| `<NEUTRALS_ROOT>` | 中立单位素材根 |
| `<EXTRAS_ROOT>` | 额外素材根 |
| `<FX_PILOT_ROOT>` | 最后覆盖的特效试点根 |
| `<OUT_DIR>` | 合并输出目录 |
| `<COMPRESSED_OUT_DIR>` | 压缩根的最终部署输出目录 |
| `<REFERENCE_ROOT>` | 历史验收使用的参考素材根 |

运行以下 **一条 PowerShell 命令**；不下载素材，不依赖 #305 的脚本实现，只读取已有根的 manifest、bindings 和被引用载荷。按列出的顺序合并，最后的试点覆盖英雄和批次数据。

```powershell
node scripts/assets3d/build-asset-root.mjs --roots "<HEROES_ROOT>" "<FX_BATCH1_ROOT>" "<FX_BATCH2_ROOT>" "<FX_BATCH3_ROOT>" "<FX_BATCH4_ROOT>" "<FX_BATCH5_ROOT>" "<FX_BATCH6_ROOT>" "<NEUTRALS_ROOT>" "<EXTRAS_ROOT>" "<FX_PILOT_ROOT>" --out "<OUT_DIR>" --force
```

`--roots` 支持空格列表、逗号列表和重复参数（含空格的路径加引号）。输入是带顶层 `manifest.json` 的完整根，可以混用原始根、压缩根、已合并根；只读目录联接可以作为输入。旧 `merge-fx-roots.mjs --roots a,b --out ...` 也调用同一构建实现；旧 `merge-manifests.mjs --from ...` 保留批次 `units/` 汇总及重复 ID 报错语义。完整部署统一使用新入口。

## 覆盖和冲突

- 模型与特效分别按精确 ID 覆盖，后根优先；路径不限于 `models/<id>/model.glb`。只复制最终选中的载荷。每根使用 `roots/<输入序号>/` 命名空间；再次合并允许嵌套前缀，粒子的 texture、mesh、normalMap 都相应重写。GLB 必须自包含。
- `manifest.actionEffects` 按单位整体覆盖，包含空对象/空列表的显式清除；不按动作拼接。新单位动作计划同时清除该单位所有旧 variants，再导入新根的 variants。没有新动作计划时，variants 按 variant/单位覆盖。
- playback 跟随特效 ID 的胜出根；新特效没有 playback 即清除旧值。仅提供 playback 而没有对应特效会报错。notes 按单位后根覆盖；unavailable 保留顺序，若后根提供该单位动作计划，则丢弃旧的不可用记录。
- 同 ID 的跨根覆盖是预期行为。同一命名空间内同路径不同字节、文件/目录路径冲突、路径或 ID 仅大小写不同、manifest 与 bindings.actionEffects 不一致、无效动作/variant 引用、越界路径和外部 GLB 资源均在发布前报错。相同路径相同字节可共享。

`--out` 可以是仓库外真实目录；拒绝输入根自身、内部目录及其祖先，按真实路径检查。输出及已有祖先、已有输出子树均不得包含符号链接/目录联接，也不能写入 `.git`。默认拒绝已有输出（包括空目录）；`--force` 仅允许输出目录不存在、为空，或其 `merge-report.json` 含有本工具生成的 `"generator": "assets3d/build-asset-root"` 标识时，**替换整个输出树（包括其中额外文件）**，不是增量追加。非空目录缺少该标识（包括旧版无标识报告、报告损坏或其他工具的报告）时，报 `refuse-force-foreign-output` 并保留原目录；请改用新的输出目录。

全部输入验证后写入相邻临时目录，替换前再次检查上述条件；替换失败时恢复旧目录。发布期间不要并发修改输入、输出或其父目录。

`precache.json` 调用与批次合并、压缩脚本相同的 `createPrecache`，按 path 排序，每项仅含 path/bytes/sha256。索引仅包含实际运行载荷，不包含 manifest、action-bindings、merge-report 或 precache 自身。`merge-report.json` 写入上述固定生成器标识，并列出各模型、特效、动作单位、playback、variant/单位、notes 和载荷的输入真实根来源，`sources.unavailable` 按输出 unavailable 数组索引标明来源；已合并根作为一个输入，不猜测其历史来源。报告没有时间戳和本次写入计数，相同输入顺序和字节重复执行时所有输出字节一致。

## 压缩顺序

建议先合并一次，再压缩一次，最后把压缩根部署到外部真实目录。这样只压缩最终选中的模型，避免重复处理被覆盖的载荷。`compress.mjs` 的输出仍受原策略限制，须是本仓库 `<ASSETS_LOCAL>` 下不存在的真实目录；本次不扩大压缩器权限。

```powershell
node scripts/assets3d/compress.mjs --from "<OUT_DIR>" --out "<ASSETS_LOCAL>/deploy-compressed"
node scripts/assets3d/build-asset-root.mjs --roots "<ASSETS_LOCAL>/deploy-compressed" --out "<COMPRESSED_OUT_DIR>" --force
```

也可先分别压缩各输入根，再按原顺序合并压缩根。不要反复压缩已经压缩的根；压缩后的路径和字节会改变，必须使用重新生成的 precache。两种流程都需要本地已安装的压缩依赖，本任务不会联网安装。压缩器的旧 merge-report 属于历史诊断，最终合并入口会重建来源报告。

## 本机验收

测试只使用系统临时目录中的合成 GLB、粒子和纹理，覆盖空目录及已标记产物的强制替换、拒绝无标记/损坏/外来报告的非空目录、非强制写入已有非空目录的拒绝，以及已合并根再合并、顺序覆盖、冲突、联接、输出重叠、外部输出、索引和重复执行确定性。

```powershell
npm test -- tests/assets3d-build-root.test.ts tests/assets3d-merge.test.ts tests/assets3d-fx-pilot.test.ts tests/assets3d-neutrals.test.ts
npm run typecheck
```

2026-10-21 修订前历史验收结果：上述四组共 27 项测试通过。重建 `<OUT_DIR>` 得到 73 模型、393 特效、1,976 个载荷，共 152,085,446 字节；与 `<REFERENCE_ROOT>` 的 precache 文件数、每项 path/bytes/sha256 及整个索引文件字节均一致。逐个读取新旧载荷核对哈希无差异，输出载荷集合与索引完全相符；manifest 和 action-bindings 也逐字节一致。新根额外包含要求的 merge-report，不进入 precache。重复构建和强制清理旧文件的字节确定性由合成测试验证。

本次安全修订验收：`assets3d-build-root`、`assets3d-merge`、`assets3d-fx-pilot` 三组共 28 项测试通过。脚本与相关测试、本文档的私人路径扫描无匹配。

本次 `tsc --noEmit` 因本目录缺少 `@gltf-transform/core`、`ktx-parse`、`sharp`，在已有 `tests/assets3d-compress.test.ts` 报 TS2307，未联网安装；合并测试不依赖这些压缩包。压缩流程仅提供顺序建议，本机未执行压缩。
