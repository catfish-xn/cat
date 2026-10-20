# Cast 动作近似选择

本地普通 manifest：`assets3d-local/cast-picks/manifest.json`，与 all-anim 使用同一 schema，仅含以下五个模型。
每个模型保留完整动作映射，cast 为选中动作；模型条目附带 `approximated: true`、`basis` 和 `confidence`。
保留基础 GLB 的模型、贴图及既有动作，仅追加选中片段；全部选择均为表现近似，不调整规则或技能时机。
完整候选动作与时长只写入本地 `assets3d-local/cast-picks/candidates.json`，不得提交。

离线重新生成：`node scripts/assets3d/cast-picks.mjs`；更新本文：`node scripts/assets3d/cast-picks-doc.mjs`。
设置 `CHROMIUM_PATH` 后运行 `node scripts/assets3d/cast-picks-browser-review.mjs`；截图位于本地 `review/<英雄 ID>.png`，以原速片段的 50% 位置采样。
仅重截阿木木可追加 `--unit amumu`，验收报告写入本地 `review/amumu-report.json`。
素材、报告和浏览器缓存仅写入 cast-picks 本地目录，来源只读；脚本不下载素材。

使用 #308 的统一入口 `build-asset-root.mjs`：后面的根按 ID 覆盖前面的根，本根放最后即可采用这五个模型的完整条目及对应 GLB，无专用覆盖表。
合并命令（路径为占位符；输入须在 assets3d-local 内，输出须在 assets3d-local/fx-pilot 内）：

```sh
node scripts/assets3d/build-asset-root.mjs --roots "<HEROES_ROOT>" "<FX_BATCH1_ROOT>" … "<FX_PILOT_ROOT>" "<CAST_PICKS_ROOT>" --out "<OUT_DIR>" --force
```

cast-picks 必须放在最后；完整动作映射随模型整体覆盖，其他模型及效果沿用前面的根。
该命令供后续集成使用，本次未运行合并，以遵守素材仅写入 cast-picks 的范围。

## ambessa

选择：`tft13_ambessa_spellfist_dash`（approximated；可信度：medium）。

短冲刺同时具有技能和位移语义，适合单次出手，但仅代表冲刺片段。

## amumu

选择：`tft13_amumu_skin23_attack2`（approximated；可信度：low）。

短攻击片段仅作为被动周期伤害的表现占位，缺少主动施法语义，因此仍为低可信近似。

## drmundo

选择：`tft13_drmundo_spell4_idle`（approximated；可信度：medium）。

强化状态的原地短循环可近似持续自我强化，但并非独立变身起手。

## gangplank

选择：`tft13_gangplank_spell_melee`（approximated；可信度：medium）。

短斩击匹配近战技能的快速出手，仅代表近战分支。

## jayce

选择：`tft13_jayce_spell2_knockhexcrystals`（approximated；可信度：medium）。

中等时长的水晶技能片段贴合当前远程默认姿态，仅代表远程出手。
