# 3D 海克斯科技锻炉（杰斯召唤物）

日期：2026-10-24。杰斯的召唤物在 14.24 zh_cn 叫【海克斯科技锻炉】（`TFT13_JayceSummon`），规则里的 definitionId 是 `g23-forge`。此前素材根里没有它的模型，3D 只能显示头像徽章。

## 转换

```sh
node scripts/assets3d/jayce-forge.mjs
```

只读本地 14.24.6442327 缓存（默认 `assets3d-local/trial/local`：`14.24.manifest`、`chunks/`、`hashes/hashes.game.txt`），不联网。缺块时只写 `assets3d-local/jayce-forge/plan.json`（可交给 `fetch-chunks.mjs --plan` 下载）和报告，不出模型。所有输出在 `assets3d-local/jayce-forge/`，不进仓库。

- 从 `data/characters/tft13_jaycesummon` 的 skin0/root BIN 走动画图闭包，复用 `buildNonChampionModel`（同野怪管线）。只转模型、骨骼、动作、贴图，不转粒子。
- 动作：`idle`=idle1，`cast`=cast，`death`=death，`spawn`=spawn（共 4 段，源图只有这 4 段；锻炉不移动、不攻击）。
- `unitScale` 取皮肤的官方 `skinScale`（2.2），和英雄一样按官方尺寸画，再受英雄高度上限约束。
- 结果：GLB 319,028 B，627 顶点，8 骨骼，一张 512×512 贴图。

## 增量包（部署）

```sh
node scripts/assets3d/jayce-forge.mjs --base <当前素材根>
```

写 `assets3d-local/jayce-forge/delta/`：`models/g23-forge/model.glb`，以及在 `--base` 的 `manifest.json`、`precache.json` 上加了锻炉的两个新文件。部署方式同 v9：复制当前素材根，再把 delta 解到副本上。`packs.json` 不用改：新文件不在任何包里，前端会单独下载它。基础根里已有 `g23-forge` 时报错，不覆盖。

## 表现

- 素材合同 `MODEL_ACTIONS` 增加 `spawn`。锻炉在战斗中出现、或被杰斯施法复活时，播一次 spawn 再回到待机。
- 杰斯施法时，他自己的锻炉（`<杰斯 id>:g23-forge`）播 cast 动作。已死亡的锻炉不播，同一次施法的复活改播 spawn。
- 锻炉头顶不画星级（规则里恒为一星，属于召唤结构）。
