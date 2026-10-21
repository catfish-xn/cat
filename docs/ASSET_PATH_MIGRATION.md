# 真实素材路径本地化

本次仅处理已存在的路径配置、直接相关的动画目录和文档摘录；不改玩法、素材文件或历史身份。全程离线，不执行 Git 写操作。删除当前树中的引用不会清除公开仓库的旧提交，本次没有重写历史。

## 已迁出

| 仓库位置 | 本地保留 / 公开替代 |
| --- | --- |
| `scripts/assets3d/unit-map.json` | 原字节导出至 `assets3d-local/unit-map.local.json`，删除仓库原表；公开 `unit-map.example.json` 全为虚构资源 |
| `scripts/assets3d/fixtures/step2-bindings.json` | 原字节导出至 `assets3d-local/step2-bindings.local.json`；仓库夹具改用合成名字与路径，仍验证初始/动态材质差异 |
| `docs/evidence/g2-3/source-selection.json`、`g2-augments/source-selection.json` | 原字节导出至 `assets3d-local/evidence/<阶段>/source-selection.local.json`；仓库只留本地证据指针 |
| `docs/evidence/p7/sources.json`、`augment-anomaly-fixes/source-excerpts.json` | 原字节导出至 `assets3d-local/evidence/<阶段>/sources.local.json` 或 `source-excerpts.local.json`；仓库只留指针 |
| `docs/M9_DATA_LEDGER.md` | 原文完整保存在下述备份；公开保留规则分析和来源定位，107 个原始 JSON 摘录改为本地引用 |
| `docs/ASSETS3D_FX_TRIAL.md`、`ASSETS3D_CAST_PICKS.md` | 原名、素材路径和源读数保存在下述备份；公开只留方法说明 |
| `scripts/assets3d/ANIMATION-SOURCE-APPENDIX.md`、`ANIMATION-COVERAGE-REPORT.md` | 原名与路径目录迁至下述备份；公开只留复查方法和通用结论 |
| `docs/evidence/g2-2/SWAIN.md`、`scripts/assets3d/README.md` | 移除素材路径，说明本地配置和脱敏副本语义 |
| `verify-source.mjs`、`prepare-existing.mjs` 及相关测试 | 从配置读取源目录和动画映射，测试只用虚构路径 |

原文备份统一为 `assets3d-local/path-migration-backup/<原仓库路径>`，测试源码备份另加 `.bak`，防止被测试发现器执行。以上本地文件均由本次迁移前的现有文件导出，并核对字节相等；`assets3d-local/` 已受现有 `.gitignore` 覆盖。

## 使用方式

默认读取仓库下 `assets3d-local/unit-map.local.json`，与启动工作目录无关；可通过 `ASSETS3D_UNIT_MAP` 指定其他私有 JSON。缺失报 `missing-local-unit-map:<绝对路径>` 并给恢复方法；非法 JSON 或缺少动作规则报对应配置错误。公开示例不会自动作为生产回退。

`build`、`build-all`、`plan-fetch`、`audit-animations`、`cast-animations`、`cast-picks`、`verify-source` 和 `prepare-existing` 共用本地映射。纯计算辅助函数的导入不要求私有配置；构建测试通过参数注入合成映射，不依赖开发者机器。`cast-picks-doc.mjs` 现在只写本地 `assets3d-local/cast-picks/choices.md`，避免重新把动画名写回公开文档。

本工作区已具备原映射的 63 个单位配置及公共动作规则。真实素材缓存不在本工作区，本次验证配置连通性与合成构建，没有宣称重建全部真实素材；持有缓存的工作区需同步代码并恢复该私有映射。

## 保留未迁出：冻结证据

以下均保持开工时的文件字节，不修改或重算历史哈希：

| 位置 | 原因 |
| --- | --- |
| `tests/fixtures/**` 的 manifest、原始快照和各 epoch 证据 | 用户要求 manifest / herald 指纹 / epoch 历史字节不变；本次未修改任何既有测试历史夹具 |
| `src/simulation/content/source/s13-14.24.json` | herald manifest 和历次 release-audit 的 source 指纹明确覆盖它 |
| `src/simulation/content/source/s13-14.24b/normalized/g2-{1,2}-{champions,traits}.json`、`normalized/g2-1-items.json` | 同样被 herald / release 的源文件指纹覆盖；record canonical SHA 也关联完整源记录 |
| `src/simulation/content/source/s13-14.24b/raw/selected-{items,neutrals}.json` 及归档 gzip | 原始字节被 provenance/source-manifest、herald 和历史 release 证据固定 |
| `docs/evidence/g2-{1,2}/reconciliation.json` | 保留带 canonical record SHA 的完整源记录及其对账关系，不替换其中素材字段 |
| `docs/evidence/g2-{1,2}/assets-manifest.json` | 按用户 manifest 字节约束保留；G2-2 另有 `docs/evidence/g2-2/validation.json` 的历史文件 SHA 记录，不能回写 |
| `docs/evidence/zh-review/tencent-15.6-2025.S13/{chess,equip,hex}.js` | `manifest.txt` 和 `manifest.user.txt` 明确记录文件 SHA，不能脱敏后继续冒称原始响应 |

`git grep -i -E 'assets/characters/|assets/ux/|\.tft_set13\.'` 的剩余命中除以上项目和下方界面文件外，只有合成测试/示例的虚构路径。原始数值与源名若位于冻结历史内，也随原字节保留；本次不重新定义 content digest 的覆盖范围。

## Claude 接手清单：界面文件未改

| 文件 | 引用用途与建议 |
| --- | --- |
| `src/presentation/s13-asset-manifest.ts` | `path` 是公开站真实需要的本地运行时 URL 映射，`s13-assets.ts` 将其与 BASE_URL 拼接；`source` 是上游下载来源元数据，运行时取图不使用它。Claude 可单独评估迁走 source，须保留 path 映射 |
| `src/presentation/s13-assets.ts` | 注释含上游头像文件名模板，代码仍需本地图标映射；注释可泛化 |
| `src/presentation/s13-augment-asset-manifest.ts` | 同时含图标 path 和上游 source；需区分运行时映射与下载校验信息 |
| `src/presentation/s13-g23-asset-checks.ts`、`s13-neutral-asset-checks.ts` | 头部说明只供测试/审计使用，上游 source 不用于运行时；Claude 评估迁移，保留 PNG 字节数/哈希校验 |

指定检索没有命中 `src/rendering/`。另发现 `scripts/assets3d/fx-bindings/` 等不含本次路径模式的原名绑定表；这批现有绑定涉及独立的加载接口和多组测试，尚未迁出，列为后续范围待定项。本次不能视为仓库全部原名已经清理。

## 验证

- 受影响脚本测试与本地配置错误分支：10 文件，74 passed、1 skipped（既有 Windows 文件 symlink 权限分支）；测试只使用合成输入。
- `npx tsc --noEmit` 通过。
- `update-content-identities.cjs --check` 在开工基线即因 CRLF/LF 文本差异失败。使用同一 Vite 加载器和重算函数，直接断言导出的 digest 值相等：content=`fnv1a32-utf16:242e7562`；loot replay=`fnv1a32-utf16:df0d757c`。没有写回 identity 文件。
- 对开工字节快照复核：691 个 simulation / 历史夹具 / manifest / epoch 文件全部不变；所有 herald manifest 的 sources 与修改文件交集为空。核验明细只写 `assets3d-local/strip-paths-{byte,digest}-check.json`。
