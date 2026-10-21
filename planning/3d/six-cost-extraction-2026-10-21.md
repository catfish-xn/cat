# 6 费三人 3D 素材提取任务书（沃里克 / 维克托 / 梅尔，v19）

日期：2026-10-21。执行：执行端 Codex（scripts/ 归 Codex）。评审：评审串（Claude）。
用户原话"7 费卡都做进去，不要分两批"，协调者确认指的是这三张 6 费卡。

**底线（照旧）**：素材只放 gitignore 的本地素材根（`assets3d-local/` 下），绝不进仓库；文档只写比例和格数；测试用合成数据；不写本机路径；不改 `src/simulation`；提交前 `git status` 确认没有素材文件。

## 0. 单位 ID

暂定 `warwick`、`viktor`、`mel`（和现有 `unit-map.json` 一样用小写英文键）。规则串加定义时必须用同样的键；如果规则串定了别的键，只改 unit-map 的键名，素材不用重做。

## 1. 脚本小改（单独一个小 PR，先合）

现在 `build-all.mjs` 的 `selectUnits` 和 `plan-fetch.mjs` 都从 `src/simulation/units.ts` 的 `M5_UNIT_DEFINITIONS` 取单位，费用只认 1–5。6 费卡在规则合入之前不在定义里，所以：

- 新增 `scripts/assets3d/extra-units.json`：`{ "warwick": { "cost": 6 }, "viktor": { "cost": 6 }, "mel": { "cost": 6 } }`。`runtime.mjs` 的 `unitDefinitions()` 只补 M5 里**没有**的键；规则合入后 M5 里有了，就以 M5 为准，并校验两边的 cost 一致。
- `selectUnits` 的费用过滤放宽到 1–6；`--units all` 的默认集合不变（仍是原来 60 个），6 费只在显式 `--units warwick,viktor,mel` 或 `--cost 6` 时出现，保证现有批次的结果不变。
- 合成数据测试：额外单位能被选中；M5 有同名键时以 M5 为准、cost 冲突时报错；`all` 仍是 60 个。

## 2. 资源映射

- 用 `plan-fetch.mjs --units warwick,viktor,mel` 生成独立的 fetch-plan，写到新目录，不覆盖原来的 `out/fetch-plan.json`。`sourceName` 从 plan 里实际的 `entries.path` 推导（预计是 `tft13_<名字>` 这一类，**以实际索引为准，不猜**）。
- 在 `unit-map.json` 里加三条：mesh、skeleton、贴图、动作目录。和 Corki/Illaoi 一样，特殊文件名照实写。
- 先 `fetch-chunks.mjs --dry-run` 看字节数，再实际下载（默认 120 MiB 上限；超了就分批）→ 第 3 步（c）解包。

## 3. 模型和动作

```text
build-all.mjs --units warwick,viktor,mel --out assets3d-local/out-anim/batch-cost6
audit-animations.mjs --markdown
```

- 六个动作 idle / move / attack / cast / hit / death，**cast 必须有**，因为 6 费卡的技能是重点。
- cast 先按 audit 的通用规则选；选不出单段起手时，参照 `cast-picks.mjs`（安蓓萨/阿木木那一批）的做法显式指定，并在报告里注明可信度（比如"attack2 低可信"）。
- 有多形态或多段技能的（维克托、梅尔可能有），只选一段做展示，不重建形态切换；形态切换以后有需要再由 Claude 接 `src/rendering`。
- 跑 `verify-animation-rebuild.mjs`，确认原来 60 个单位的 GLB 字节不变。

## 4. 特效

- 新建 `fx-bindings/warwick.mjs`、`viktor.mjs`、`mel.mjs`，再加一个 `batch7.mjs` 汇总。格式和 batch1–6 相同：attack 和 cast 两个分组，每条写 system、phase（start/travel/impact）、anchor（source/projectile/target）、delay、maxDuration、status（mapped/approximated），能确认骨骼时写 bone；没有对应系统的写进 `unavailable` 并说明原因。
- 系统从这三人自己的源 BIN 里找（攻击和技能相关的 TFT13/Base 系统），不借用别的英雄的系统。
- `fx-batch.mjs --units warwick,viktor,mel --out assets3d-local/fx-batch7`，被省略的发射器照常带 reason 码。
- 带顶点色的粒子网格走 #321/#326 之后的转换器，不能再出现 `unsupported-scb-vertex-colors` 跳过。
- 浏览器预览截图放 `assets3d-local/fx-batch7/review/`，不进仓库。

## 5. FX_SCALE

**三人所有特效统一乘 FX_SCALE = 0.44，不做单项特例**（用户已定）。不需要"哪些缩、哪些不缩"的清单。

- 用 fx-batch 的尺寸审计（`fx-batch-sizes` / oversize 那一套）报告一下：按 0.44 缩放后，包围盒超过 2 格的系统列出来，**只报告，不改比例**。评审串据此判断要不要找用户。

## 6. 合入素材根

- 用 `build-asset-root.mjs` 把现有的完整根和 batch-cost6、fx-batch7 合成一个**新根**（新目录，不覆盖旧根），再走 `compress.mjs` → `pack-root.mjs`。
- 确认新根里原有文件的 SHA-256 和旧根一致（只多出三人的文件）。

## 7. 交付和验收

- PR 进 multiplayer，只能包含：`extra-units.json`、`runtime.mjs`/`build-all.mjs`/`plan-fetch.mjs` 的小改、`unit-map.json` 三条、`fx-bindings/` 三个表加 batch7、合成数据测试，以及只写比例和格数的文档。
- 回报：三人各自的顶点数和骨骼数、动作映射（cast 的来源和可信度）、特效 mapped/approximated/skipped 计数、超过 2 格的系统列表、新根压缩前后体积、下载字节数。
- 规则先上线；3D 接线等素材根更新后再做。三人进素材根后，3D 里会自动按 unit-map 的键加载，不需要另改前端，除非 ID 和规则对不上。
