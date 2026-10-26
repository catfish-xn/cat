# v24 非服务器测试提速实测（2026-10-26）

【完成】

基线：`codex/v24-speed4`，HEAD `f36fa7a59a17c6df50a11283c332c95fe1ff462b`。未提交、未推送。

测量：Node 22.23.4、Vitest 5.0.3；fast 非服务器测试按原分片器分四批，顺序执行，每批 `--maxWorkers=4`。不运行完整测试套件、浏览器脚本或服务器测试。

```sh
export PATH=$HOME/.local/bin:$PATH
npx vitest run --project fast --reporter=json --outputFile=/tmp/fast-N.json tests --exclude 'tests/server/**' --config .speed4-vitest.config.ts --shard=N/4 --maxWorkers=4
```

临时配置只给 fast project 追加服务器排除项与 `/tmp` 缓存目录；第 2–4 批通过只读 transform 固定使用 HEAD 的测试原文，避免施工污染基线。CLI exclude 在多 project 中的作用不明确，因此在项目内显式追加。共享 node_modules 只读，本地建立依赖链接目录承接 Vite 临时文件；交付恢复原链接并删除临时配置。

文件按 JSON `endTime-startTime`，用例按 `duration`；这两个指标不包含模块收集阶段的路线生成。拆分组列所有分段及最终用例的总和与最大分段，不能只看最终断言耗时。机器有其他工作，单次墙钟比较不代表纯 CPU 倍数。

基线实际覆盖 546 个文件、19601 个用例；文件路径唯一 546，服务器文件 0。

最慢 15 个原用例：

| 秒 | 文件 | 用例 | 状态 |
|---:|---|---|---|
| 147.780 | `tests/m6-integration-sniper.test.ts` | sniper: every completed battle has exact original state/events and isolated playback | passed |
| 147.409 | `tests/m6-integration-sniper-caitlyn.test.ts` | sniper-caitlyn: every completed battle has exact original state/events and isolated playback | passed |
| 134.355 | `tests/m6-integration-mage.test.ts` | mage: every completed battle has exact original state/events and isolated playback | passed |
| 81.470 | `tests/m6-integration.test.ts` | cannon: every completed battle has exact original state/events and isolated playback | passed |
| 61.624 | `tests/m5-route.test.ts` | normally buys five-cost Caitlyn and fields her for at least two real battles | passed |
| 46.976 | `tests/m8-b9-activity-log.test.ts` | a real Vander channel is logged once per lifecycle event, live and in replay | passed |
| 33.737 | `tests/t5r-b7-integration.test.ts` | SR-B7-01 / SR-C7-02: seed42 eight-seat complete match preserves every replay and current revealed loot | passed |
| 30.986 | `tests/m5-route.test.ts` | mage: ordinary purchases/rewards to 6-7 with a complete build | passed |
| 30.143 | `tests/m5-route.test.ts` | sniper: ordinary purchases/rewards to 6-7 with a complete build | passed |
| 29.272 | `tests/m6-integration-sniper-caitlyn.test.ts` | sniper-caitlyn: full catalog-capacity envelope acceptance (B9) | passed |
| 28.983 | `tests/m6-integration-mage.test.ts` | mage: full catalog-capacity envelope acceptance (B9) | passed |
| 28.249 | `tests/m6-integration-sniper.test.ts` | sniper: full catalog-capacity envelope acceptance (B9) | passed |
| 27.913 | `tests/m5-route.test.ts` | [B8] sniper: complete-build battles and full component grant chain | passed |
| 27.030 | `tests/m5-match-integration.test.ts` | restores each real tick, then supply without creating combat or consuming battle RNG | passed |
| 25.772 | `tests/m8-b8-oracle.test.ts` | runs the complete real cannon route, seed 230, through the unchanged public-command driver | passed |

最慢 10 个原文件：

| 秒 | 文件 | 状态 |
|---:|---|---|
| 396.376 | `tests/m5-replay-sniper-caitlyn.test.ts` | passed |
| 395.962 | `tests/m5-replay.test.ts` | passed |
| 370.439 | `tests/m5-replay-mage.test.ts` | passed |
| 176.681 | `tests/m6-integration-sniper-caitlyn.test.ts` | passed |
| 176.030 | `tests/m6-integration-sniper.test.ts` | passed |
| 168.627 | `tests/m5-route.test.ts` | passed |
| 163.338 | `tests/m6-integration-mage.test.ts` | passed |
| 122.603 | `tests/v23-tamper-batch4.test.ts` | passed |
| 96.902 | `tests/m6-integration.test.ts` | passed |
| 66.816 | `tests/m8-b8-input-evidence.test.mjs` | passed |

保留优化与回退实验的前后比较：

| 文件 | 用例数 前→后 | 文件秒 前→后 | 最大用例秒 前→后 | 处理 |
|---|---:|---:|---:|---|
| `tests/anvil-rewards.test.ts` | 17→48 | 17.415→14.528 | 10.067→1.155 | 保留 |
| `tests/g2-4a-crown-history.test.ts` | 56→56 | 53.534→57.121 | 3.830→3.803 | 回退，最终保留原版 |
| `tests/g2-4b-unstable-chest.test.ts` | 39→209 | 38.792→37.888 | 17.519→2.842 | 保留 |
| `tests/m5-match-integration.test.ts` | 3→51 | 27.125→24.230 | 27.030→3.004 | 保留 |
| `tests/m5-replay-mage.test.ts` | 1647→1647 | 370.439→376.290 | 0.546→0.469 | 保留 |
| `tests/m5-replay-sniper-caitlyn.test.ts` | 1672→1672 | 396.376→402.980 | 0.670→0.501 | 保留 |
| `tests/m5-replay.test.ts` | 1671→1671 | 395.962→401.497 | 0.626→0.523 | 保留 |
| `tests/m8-b8-input-evidence.test.mjs` | 32→32 | 66.816→1.294 | 3.094→0.076 | 保留 |
| `tests/m8-b8-oracle.test.ts` | 25→553 | 65.164→61.919 | 25.772→14.848 | 保留 |
| `tests/m8-b9-activity-log.test.ts` | 1→34 | 46.976→2.379 | 46.976→0.867 | 保留 |
| `tests/restore-audit/cd-replay-facts.test.ts` | 34→514 | 40.916→39.959 | 12.662→0.640 | 保留 |
| `tests/rules-placebo-stage.test.ts` | 7→7 | 4.175→0.247 | 3.824→0.127 | 保留 |
| `tests/s13-p1-dual-wielding.test.ts` | 2→322 | 22.802→25.359 | 22.795→0.832 | 保留 |
| `tests/task-mechanism-restore.test.ts` | 20→20 | 25.349→26.304 | 9.960→10.419 | 回退，最终保留原版 |

实现证据：

- `tests/m5-replay-helper.ts:33`：let chunk: Chunk。
- `tests/m8-b8-input-evidence.test.mjs:23`：const roots =。
- `tests/anvil-rewards.test.ts:94`：const anvilEntries=。
- `tests/s13-p1-dual-wielding.test.ts:32`：const dualRoute=。
- `tests/m8-b9-activity-log.test.ts:20`：const activityRoute =。
- `tests/restore-audit/cd-replay-facts.test.ts:64`：const anomalyRoutes =。
- `tests/g2-4b-unstable-chest.test.ts:123`：function poolInputs。
- `tests/rules-placebo-stage.test.ts:61`：const seed = id。
- `tests/m5-match-integration.test.ts:58`：function restoreThrough。
- `tests/m8-b8-oracle.test.ts:186`：const progress = roundRouteCache。
- `docs/S13_RULES_GAP.md:1260`：## v24 非服务器测试提速。

收集阶段另计：原 JSON 基线没有保留模块 console，无法准确逐文件比较收集耗时，故不将压缩边界去重计作已测得的文件收益。优化后日志分别记录：sniper 路线生成 39.949 秒（压缩 4.657 秒）、mage 38.118 秒（压缩 4.337 秒）、sniper-caitlyn 39.885 秒（压缩 4.671 秒）；炮手 20.860 秒（压缩 2.546 秒）。后者的 timing project 原本不在 fast 基线中，只作受影响 helper 的额外验证。


逐原用例对照（重放文件另按组汇总；拆分项的“后”包含全部相关分段）：

| 文件 / 原用例 | 前秒 | 后整组秒 | 后最大分段秒 |
|---|---:|---:|---:|
| `tests/anvil-rewards.test.ts` / 5-7 epic claim gives persistent units, no popup or terminal conversion | 0.014 | 0.019 | 0.019 |
| `tests/anvil-rewards.test.ts` / 6-7 epic claim gives persistent units, no popup or terminal conversion | 0.013 | 0.018 | 0.018 |
| `tests/anvil-rewards.test.ts` / completed pool retains Thief’s Gloves | 0.000 | 0.000 | 0.000 |
| `tests/anvil-rewards.test.ts` / subscription bucket 3 stays in orb until claim, uses old offers, is not auto-opened | 0.022 | 0.021 | 0.021 |
| `tests/anvil-rewards.test.ts` / subscription bucket 4 stays in orb until claim, uses old offers, is not auto-opened | 0.014 | 0.015 | 0.015 |
| `tests/anvil-rewards.test.ts` / 4-7 full bench keeps forge orb; retry grants once and preserves shared pool | 0.068 | 0.055 | 0.055 |
| `tests/anvil-rewards.test.ts` / 5-7 full bench keeps forge orb; retry grants once and preserves shared pool | 0.036 | 0.034 | 0.034 |
| `tests/anvil-rewards.test.ts` / portable-forge still opens immediately with its original offers | 0.006 | 0.005 | 0.005 |
| `tests/anvil-rewards.test.ts` / radiant-relics still opens immediately with its original offers | 0.005 | 0.005 | 0.005 |
| `tests/anvil-rewards.test.ts` / conqueror forge atoms grant units, preserve sample order, remain unopened | 0.012 | 0.011 | 0.011 |
| `tests/anvil-rewards.test.ts` / public 4-7 combat: save/replay before and after opening an anvil | 7.063 | 8.092 | 0.762 |
| `tests/anvil-rewards.test.ts` / public 5-7 combat: save/replay before and after opening an anvil | 10.067 | 13.476 | 1.155 |
| `tests/anvil-rewards.test.ts` / crab-rave 5-7 grants two anvil units with the original batch B offers | 0.014 | 0.015 | 0.015 |
| `tests/anvil-rewards.test.ts` / crab-rave 6-7 grants two anvil units with the original batch B offers | 0.012 | 0.009 | 0.009 |
| `tests/anvil-rewards.test.ts` / Mel branch 9 gives two claimable component anvils, no automatic choice | 0.017 | 0.021 | 0.021 |
| `tests/anvil-rewards.test.ts` / G2-3 full bench retains anvil orb; freeing capacity never auto-claims it | 0.030 | 0.033 | 0.033 |
| `tests/anvil-rewards.test.ts` / mixed orb allocation pays other entries once and retains its full-bench anvil | 0.021 | 0.023 | 0.023 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects the crowns:84/+5 coordinated forgery in text and object restoration, with or without genuine history | 0.233 | 0.459 | 0.459 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects the unchanged genuine replay collection paired with the forgery, synchronously and asynchronously | 0.501 | 0.504 | 0.504 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / does not let a later record context authorize its own forged historical prefix | 0.520 | 0.511 | 0.511 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / accepts the public-command no-crown control and resumes identically | 0.516 | 0.492 | 0.492 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / restores and continues a legal provenance-backed crown control, seed 1 | 0.742 | 0.993 | 0.993 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / restores and continues a legal provenance-backed crown control, seed 42 | 0.734 | 0.822 | 0.822 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects seed 77 cross-round crown transfer despite self-consistent production replay and rewards | 1.011 | 2.225 | 2.225 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / accepts legal sale and subsequent re-equipping | 1.371 | 1.509 | 1.509 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / accepts legal remover and subsequent re-equipping | 1.284 | 1.426 | 1.426 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / accepts legal upgrade and subsequent re-equipping | 1.321 | 1.365 | 1.365 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / accepts legal upgrade-remover-equip and subsequent re-equipping | 1.340 | 1.390 | 1.390 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / accepts legal combine-equip and subsequent re-equipping | 0.880 | 1.050 | 1.050 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / replays survivor equipment before-upgrade in exact order (M4) | 1.048 | 1.059 | 1.059 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / replays survivor equipment after-upgrade in exact order (M4) | 1.080 | 1.072 | 1.072 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / also rejects moving a non-crown equipped instance | 0.067 | 0.118 | 0.118 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / replays combat equip before settlement, restores through all three entries and continues tick for tick | 0.987 | 0.948 | 0.948 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects a claimed pre-first-battle equip left in inventory, with or without an empty history | 0.154 | 0.164 | 0.164 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / accepts legal pre-first-battle equipment and validates the first opening prefix | 0.662 | 0.695 | 0.695 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / records combat consumable use with remove at all three entries and resumes tick for tick (M10) | 1.640 | 1.569 | 1.569 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / records combat consumable use with reequip at all three entries and resumes tick for tick (M10) | 1.639 | 1.654 | 1.654 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / records combat consumable use with combine at all three entries and resumes tick for tick (M10) | 1.346 | 1.201 | 1.201 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / records combat consumable use with component at all three entries and resumes tick for tick (M10) | 2.685 | 2.801 | 2.801 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / records combat consumable use with completed at all three entries and resumes tick for tick (M10) | 3.830 | 3.803 | 3.803 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects changing the remove command tick at all three entries (M10) | 0.709 | 0.673 | 0.673 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects changing the component command tick at all three entries (M10) | 2.229 | 2.282 | 2.282 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects changing the completed command tick at all three entries (M10) | 2.837 | 3.113 | 3.113 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects changing the remove resource tick at all three entries (M10) | 0.414 | 0.422 | 0.422 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects changing the component resource tick at all three entries (M10) | 1.434 | 1.457 | 1.457 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects changing the completed resource tick at all three entries (M10) | 2.123 | 1.841 | 1.841 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / records inventory combination followed by equip=false and resumes the next battle tick for tick (M8) | 0.868 | 0.835 | 0.835 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / records inventory combination followed by equip=true and resumes the next battle tick for tick (M8) | 0.589 | 0.631 | 0.631 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects changing only the command tick to 0, 2 or 69 for ordinary (M9) | 0.562 | 0.658 | 0.658 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects changing only the command tick to 0, 2 or 69 for in-place (M9) | 0.573 | 0.672 | 0.672 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects changing only the command tick to 0, 2 or 69 for inventory (M9) | 0.919 | 0.925 | 0.925 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / binds next-tick receipts when both tick claims move to 0 (M9 boundary) | 0.615 | 0.602 | 0.602 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / binds next-tick receipts when both tick claims move to 2 (M9 boundary) | 0.610 | 0.664 | 0.664 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / binds next-tick receipts when both tick claims move to 69 (M9 boundary) | 0.587 | 0.569 | 0.569 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects existing-target in-place combination tampering at all three entries | 0.189 | 0.201 | 0.201 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects missing-first in-place combination tampering at all three entries | 0.066 | 0.073 | 0.073 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects missing-second in-place combination tampering at all three entries | 0.067 | 0.072 | 0.072 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects ordinary-equip in-place combination tampering at all three entries | 0.069 | 0.072 | 0.072 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects missing-first inventory combination commands at all three entries | 0.122 | 0.105 | 0.105 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects missing-second inventory combination commands at all three entries | 0.110 | 0.112 | 0.112 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects ordinary-equip inventory combination commands at all three entries | 0.196 | 0.165 | 0.165 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects a structurally valid command with an invalid recipe through production replay | 0.151 | 0.299 | 0.299 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / binds combat equip order to the temporary item roll prefix (M9) | 0.899 | 0.914 | 0.914 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / keeps combat equips before terminal resources and crown gold (M9) | 0.573 | 0.771 | 0.771 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / records in-place sword combination at tick 1 (requested slot 0) and resumes the next battle tick for tick | 0.877 | 0.917 | 0.917 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / records in-place sword combination at tick 1 (requested slot 2) and resumes the next battle tick for tick | 0.892 | 0.924 | 0.924 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects reordered commands at all three save/restore entries | 0.473 | 0.485 | 0.485 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects duplicated commands at all three save/restore entries | 0.337 | 0.343 | 0.343 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects extra commands at all three save/restore entries | 0.424 | 0.451 | 0.451 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects missing commands at all three save/restore entries | 0.387 | 0.389 | 0.389 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / rejects unknown-target commands at all three save/restore entries | 0.321 | 0.336 | 0.336 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / accepts combat equipment targeting a bench unit at all three entries | 0.205 | 0.280 | 0.280 |
| `tests/g2-4a-crown-history.test.ts`（已回退实验） / accepts combat equipment targeting a dead unit at all three entries | 1.419 | 1.628 | 1.628 |
| `tests/g2-4b-unstable-chest.test.ts` / pools the 35 ordinary completed items except Thief's Gloves, in apiName order, each as a valid program | 0.002 | 0.007 | 0.007 |
| `tests/g2-4b-unstable-chest.test.ts` / rewrites legacy mechanic tags and strategy stats into declarative programs (G24-CHEST-04) | 0.001 | 0.002 | 0.002 |
| `tests/g2-4b-unstable-chest.test.ts` / declares one holder-death grant to four allies ordered by health ratio then id | 0.000 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / the four healthiest allies by ratio each gain one item when the holder dies; ties break by id; full units still receive | 0.027 | 0.058 | 0.058 |
| `tests/g2-4b-unstable-chest.test.ts` / summons and structures never receive an item (user 2026-10-17 06:25); the next healthiest champion does | 0.018 | 0.022 | 0.022 |
| `tests/g2-4b-unstable-chest.test.ts` / every pool item gained mid-combat applies its stats and start effects at once and passes restore validation for the rest of the fight | 6.504 | 6.558 | 2.256 |
| `tests/g2-4b-unstable-chest.test.ts` / granted periodic and stacking items keep working after the grant | 0.060 | 0.057 | 0.057 |
| `tests/g2-4b-unstable-chest.test.ts` / a mid-combat JSON save continues to the identical terminal state and ledger | 1.024 | 1.053 | 1.053 |
| `tests/g2-4b-unstable-chest.test.ts` / M1: Lux casts after receiving Nashor, accepts 594 magic damage and rejects 595 | 0.017 | 0.031 | 0.031 |
| `tests/g2-4b-unstable-chest.test.ts` / M1: Lux casts at two Archangel pulses, accepts 972 magic damage and rejects 973 | 0.060 | 0.054 | 0.054 |
| `tests/g2-4b-unstable-chest.test.ts` / M1: Vander casts before Shojin arrives, accepts the old 450 physical damage and rejects 451 | 0.013 | 0.019 | 0.019 |
| `tests/g2-4b-unstable-chest.test.ts` / M2: Lux dies after casting at two granted Archangel pulses; 972 magic restores and continues identically | 0.463 | 0.571 | 0.571 |
| `tests/g2-4b-unstable-chest.test.ts` / M2: Lux shields Irelia after two granted Archangel pulses, then dies; the ally shield restores and continues identically | 0.396 | 0.424 | 0.424 |
| `tests/g2-4b-unstable-chest.test.ts` / granted periodic candidates stay bounded by the save clock even without live tasks or a known sample tick | 0.054 | 0.048 | 0.048 |
| `tests/g2-4b-unstable-chest.test.ts` / three Titans plus three granted Archangels restore after eight pulses without expanding 102 million histories | 0.279 | 0.282 | 0.282 |
| `tests/g2-4b-unstable-chest.test.ts` / every AP and AD a receiver had since the grant is among the restore candidates for that sample | 2.163 | 2.246 | 0.714 |
| `tests/g2-4b-unstable-chest.test.ts` / receivers that attack and cast after the grant keep every mid-combat save valid | 17.519 | 15.959 | 1.628 |
| `tests/g2-4b-unstable-chest.test.ts` / accepts the genuine grants | 0.001 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / rejects an item outside the pool | 0.001 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / rejects a future tick | 0.001 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / rejects a different tick from its siblings | 0.001 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / rejects a duplicated ordinal | 0.001 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / rejects a fifth grant | 0.001 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / rejects a second grant to one receiver | 0.001 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / rejects an enemy receiver | 0.001 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / rejects a living holder | 0.001 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / rejects an unfired chest | 0.001 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / rejects an extra field | 0.001 | 0.001 | 0.001 |
| `tests/g2-4b-unstable-chest.test.ts` / a Match save whose unit claims an item it never received is rejected | 0.029 | 0.076 | 0.076 |
| `tests/g2-4b-unstable-chest.test.ts` / a Match save with not an array as combat item grants is an invalid save | 0.016 | 0.014 | 0.014 |
| `tests/g2-4b-unstable-chest.test.ts` / a Match save with a null record as combat item grants is an invalid save | 0.012 | 0.013 | 0.013 |
| `tests/g2-4b-unstable-chest.test.ts` / a Match save with an item outside the pool as combat item grants is an invalid save | 0.012 | 0.017 | 0.017 |
| `tests/g2-4b-unstable-chest.test.ts` / a Match save with an unknown item as combat item grants is an invalid save | 0.011 | 0.013 | 0.013 |
| `tests/g2-4b-unstable-chest.test.ts` / a Match save with a missing chest as combat item grants is an invalid save | 0.018 | 0.012 | 0.012 |
| `tests/g2-4b-unstable-chest.test.ts` / a Match save with a text ordinal as combat item grants is an invalid save | 0.013 | 0.012 | 0.012 |
| `tests/g2-4b-unstable-chest.test.ts` / a Match save with a fractional tick as combat item grants is an invalid save | 0.014 | 0.013 | 0.013 |
| `tests/g2-4b-unstable-chest.test.ts` / A holds the chest: grants go to the holder's own seat and every tick restores | 2.677 | 2.842 | 2.842 |
| `tests/g2-4b-unstable-chest.test.ts` / B holds the chest: grants go to the holder's own seat and every tick restores | 1.773 | 1.882 | 1.882 |
| `tests/g2-4b-unstable-chest.test.ts` / a mirror copy of the chest seat fights the identical battle | 0.899 | 0.915 | 0.915 |
| `tests/m5-match-integration.test.ts` / starts with the approved single hero, then restores the first real augment without an old component package | 0.073 | 0.146 | 0.146 |
| `tests/m5-match-integration.test.ts` / locks natural refresh while allowing paid D and immediate F, rejected commands retain identity | 0.022 | 0.034 | 0.034 |
| `tests/m5-match-integration.test.ts` / restores each real tick, then supply without creating combat or consuming battle RNG | 27.030 | 24.046 | 3.004 |
| `tests/m5-replay-mage.test.ts` 全部逐步恢复用例 | 370.132 | 376.003 | 0.469 |
| `tests/m5-replay-sniper-caitlyn.test.ts` 全部逐步恢复用例 | 396.040 | 402.704 | 0.501 |
| `tests/m5-replay.test.ts` 全部逐步恢复用例 | 395.627 | 401.206 | 0.523 |
| `tests/m8-b8-input-evidence.test.mjs` / accepts the genuine public-command evidence | 3.094 | 0.075 | 0.075 |
| `tests/m8-b8-input-evidence.test.mjs` / accepts the legal differences of real DOM input: hover events, redraw release target, no click on a non-committing control | 2.910 | 0.060 | 0.060 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects deleted combat artifact | 2.768 | 0.050 | 0.050 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects deleted recipe interaction | 2.520 | 0.018 | 0.018 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects deleted Rageblade events | 2.933 | 0.068 | 0.068 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects forged extra event | 2.718 | 0.076 | 0.076 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects placeholder ledger with one forged statChanged | 2.841 | 0.060 | 0.060 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects all inputs replaced by {trusted:true} | 0.247 | 0.032 | 0.032 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects start pressed on the canvas instead of the Start control | 2.763 | 0.066 | 0.066 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects equip operations in the wrong order | 2.441 | 0.028 | 0.028 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects touch input substituted for the mouse pick | 0.234 | 0.010 | 0.010 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects committing click removed | 2.481 | 0.022 | 0.022 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects committing click before its release with increasing timestamps | 2.900 | 0.062 | 0.062 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects reroll click appended after the legal operation | 2.957 | 0.063 | 0.063 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects reroll click between two operations | 2.522 | 0.028 | 0.028 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects missing mousedown | 0.229 | 0.008 | 0.008 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects duplicated release | 0.220 | 0.008 | 0.008 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects duplicated committing click | 2.860 | 0.060 | 0.060 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects release on another control | 0.237 | 0.009 | 0.009 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects inputs out of time order | 2.792 | 0.062 | 0.062 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects re-hashed forged before state | 2.366 | 0.025 | 0.025 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects re-hashed forged combat result | 2.878 | 0.066 | 0.066 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects modified recorded state | 2.811 | 0.061 | 0.061 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects untrusted input | 2.853 | 0.062 | 0.062 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects changed Lux identity | 2.463 | 0.013 | 0.013 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects changed Rageblade identity | 2.447 | 0.019 | 0.019 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects forged summary values | 0.006 | 0.003 | 0.003 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects forged frozen interval | 2.778 | 0.054 | 0.054 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects forged current interval | 2.770 | 0.057 | 0.057 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects forged tick count | 2.766 | 0.057 | 0.057 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects missing summary | 0.003 | 0.005 | 0.005 |
| `tests/m8-b8-input-evidence.test.mjs` / rejects reordered interactions | 0.003 | 0.003 | 0.003 |
| `tests/m8-b8-oracle.test.ts` / pins LOOT A3 at 9G: direct gold before interest, heroes never become gold | 0.001 | 0.004 | 0.004 |
| `tests/m8-b8-oracle.test.ts` / pins LOOT A3 at 49G: direct gold before interest, heroes never become gold | 0.000 | 0.001 | 0.001 |
| `tests/m8-b8-oracle.test.ts` / pins LOOT A3 at 50G: direct gold before interest, heroes never become gold | 0.000 | 0.001 | 0.001 |
| `tests/m8-b8-oracle.test.ts` / pins accepted and rejected words using independent unbounded integer arithmetic | 0.000 | 0.001 | 0.001 |
| `tests/m8-b8-oracle.test.ts` / pins randomized orb source/order, all eight components and terminal gold/tool | 0.001 | 0.005 | 0.005 |
| `tests/m8-b8-oracle.test.ts` / counts Into the Unknown held ownership through real departure and return, rejecting missing or duplicated resources | 15.139 | 14.848 | 14.848 |
| `tests/m8-b8-oracle.test.ts` / counts a real reward candidate even when immediately consumed by its upgrade | 2.451 | 2.425 | 2.425 |
| `tests/m8-b8-oracle.test.ts` / validates actual .4 sword choice, one ScheduleReceipt and no extra LootReceipt | 0.250 | 0.255 | 0.255 |
| `tests/m8-b8-oracle.test.ts` / validates actual .4 vest choice, one ScheduleReceipt and no extra LootReceipt | 0.226 | 0.251 | 0.251 |
| `tests/m8-b8-oracle.test.ts` / validates actual .4 belt choice, one ScheduleReceipt and no extra LootReceipt | 0.234 | 0.242 | 0.242 |
| `tests/m8-b8-oracle.test.ts` / validates actual .4 rod choice, one ScheduleReceipt and no extra LootReceipt | 0.214 | 0.229 | 0.229 |
| `tests/m8-b8-oracle.test.ts` / validates actual .4 cloak choice, one ScheduleReceipt and no extra LootReceipt | 0.254 | 0.223 | 0.223 |
| `tests/m8-b8-oracle.test.ts` / validates actual .4 bow choice, one ScheduleReceipt and no extra LootReceipt | 0.211 | 0.206 | 0.206 |
| `tests/m8-b8-oracle.test.ts` / validates actual .4 gloves choice, one ScheduleReceipt and no extra LootReceipt | 0.266 | 0.190 | 0.190 |
| `tests/m8-b8-oracle.test.ts` / validates actual .4 tear choice, one ScheduleReceipt and no extra LootReceipt | 0.342 | 0.197 | 0.197 |
| `tests/m8-b8-oracle.test.ts` / rejects duplicate grant, reveal and resolution events independently of event-sequence checks | 0.004 | 0.004 | 0.004 |
| `tests/m8-b8-oracle.test.ts` / rejects wrong payload instead of blessing mutated production output | 0.002 | 0.002 | 0.002 |
| `tests/m8-b8-oracle.test.ts` / rejects wrong source instead of blessing mutated production output | 0.003 | 0.002 | 0.002 |
| `tests/m8-b8-oracle.test.ts` / rejects duplicate receipt instead of blessing mutated production output | 0.002 | 0.001 | 0.001 |
| `tests/m8-b8-oracle.test.ts` / rejects unearned receipt instead of blessing mutated production output | 0.002 | 0.001 | 0.001 |
| `tests/m8-b8-oracle.test.ts` / rejects wrong fallback instead of blessing mutated production output | 0.002 | 0.001 | 0.001 |
| `tests/m8-b8-oracle.test.ts` / rejects missing candidate instead of blessing mutated production output | 0.002 | 0.002 | 0.002 |
| `tests/m8-b8-oracle.test.ts` / rejects obsolete PvE fallback resolutions and a second schedule grant | 0.003 | 0.003 | 0.003 |
| `tests/m8-b8-oracle.test.ts` / runs the complete real cannon route, seed 42, through the unchanged public-command driver | 19.779 | 18.454 | 0.553 |
| `tests/m8-b8-oracle.test.ts` / runs the complete real cannon route, seed 230, through the unchanged public-command driver | 25.772 | 24.345 | 0.665 |
| `tests/m8-b9-activity-log.test.ts` / a real Vander channel is logged once per lifecycle event, live and in replay | 46.976 | 2.378 | 0.867 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C02 rejects invented processed keys on a holder without triggers | 0.060 | 0.058 | 0.058 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C02 rejects invented actionCounts keys on a holder without triggers | 0.051 | 0.046 | 0.046 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C03 authenticates every unit attackCount even within the one-tick bound | 0.048 | 0.049 | 0.049 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C03 authenticates every unit castCount even within the one-tick bound | 0.044 | 0.044 | 0.044 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C04 binds the contribution map and trigger sequence: victim | 0.043 | 0.045 | 0.045 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C04 binds the contribution map and trigger sequence: holder | 0.044 | 0.044 | 0.044 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C04 binds the contribution map and trigger sequence: sequence | 0.047 | 0.044 | 0.044 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C04 binds the combat cursor: rngState | 0.074 | 0.073 | 0.073 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C04 binds the combat cursor: rngDraws | 0.063 | 0.063 | 0.063 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C04 binds the combat cursor: nextActionSeq | 0.059 | 0.058 | 0.058 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C04 binds the combat cursor: nextEventSeq | 0.062 | 0.062 | 0.062 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C05 binds a genuinely damaged ordinary shield even when both projections conserve the grant | 0.198 | 0.204 | 0.204 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C06 binds the real absorption value even when its status is forged coherently | 11.885 | 12.822 | 0.550 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C07 authenticates a live periodic fractional account | 0.249 | 0.295 | 0.295 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C07 authenticates burn phase even when the group and task agree | 0.197 | 0.231 | 0.231 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C08 rejects invented Experiment takedowns plus matching maximum health | 0.515 | 0.488 | 0.488 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C08 binds Sevika high-roller mod rather than only its enum | 0.217 | 0.229 | 0.229 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C09 binds the activity duration even with a matching legacy status | 0.172 | 0.165 | 0.165 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C09 binds the activity share even with a matching legacy status | 0.129 | 0.124 | 0.124 |
| `tests/restore-audit/cd-replay-facts.test.ts` / P1-BOUNDS-01 binds exposureBps at tick zero | 0.048 | 0.050 | 0.050 |
| `tests/restore-audit/cd-replay-facts.test.ts` / P1-BOUNDS-01 binds exposureFromTick at tick zero | 0.045 | 0.061 | 0.061 |
| `tests/restore-audit/cd-replay-facts.test.ts` / P1-BOUNDS-01 binds exposureUntilTick at tick zero | 0.043 | 0.062 | 0.062 |
| `tests/restore-audit/cd-replay-facts.test.ts` / P2-BOUNDS-02 binds damageDealt at tick zero | 0.045 | 0.065 | 0.065 |
| `tests/restore-audit/cd-replay-facts.test.ts` / P2-BOUNDS-02 binds damageTaken at tick zero | 0.044 | 0.062 | 0.062 |
| `tests/restore-audit/cd-replay-facts.test.ts` / P2-BOUNDS-02 binds crystalDamage at tick zero | 0.045 | 0.046 | 0.046 |
| `tests/restore-audit/cd-replay-facts.test.ts` / shares one replay between all consumers and detaches the expanded facts on cache hits | 0.032 | 0.039 | 0.039 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C03 rejects changing a real first-tick attack from one to zero | 0.096 | 0.106 | 0.106 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C03 rejects coherent Kogmaw cast/speed/range changes | 0.137 | 0.149 | 0.149 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C03 rejects Tristana growth that remains within the cast-count upper bound | 0.137 | 0.140 | 0.140 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C08 binds real one-thousand-cuts history | 12.662 | 11.555 | 0.539 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C08 binds real eagle-eye history | 12.404 | 11.445 | 0.640 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C08 binds Swain ascension timing | 0.222 | 0.240 | 0.240 |
| `tests/restore-audit/cd-replay-facts.test.ts` / G-C08 binds Conqueror receipts after an actual takedown | 0.636 | 0.609 | 0.609 |
| `tests/restore-audit/cd-replay-facts.test.ts` / resists shields, sampled holders and ordinary facts share the same cached trajectory | 0.154 | 0.159 | 0.159 |
| `tests/rules-placebo-stage.test.ts` / 2-1 has independent stage amounts 8 / 15 | 0.000 | 0.001 | 0.001 |
| `tests/rules-placebo-stage.test.ts` / 3-2 has independent stage amounts 11 / 18 | 0.000 | 0.000 | 0.000 |
| `tests/rules-placebo-stage.test.ts` / 4-2 has independent stage amounts 15 / 22 | 0.000 | 0.000 | 0.000 |
| `tests/rules-placebo-stage.test.ts` / 5-1 has independent stage amounts 15 / 22 | 0.000 | 0.000 | 0.000 |
| `tests/rules-placebo-stage.test.ts` / 5-7 has independent stage amounts 15 / 22 | 0.000 | 0.000 | 0.000 |
| `tests/rules-placebo-stage.test.ts` / 2-1 placebo public choice grants exactly 8 once and authenticates its receipt | 0.351 | 0.118 | 0.118 |
| `tests/rules-placebo-stage.test.ts` / 3-2 placebo-plus public choice grants exactly 18 once and authenticates its receipt | 3.824 | 0.127 | 0.127 |
| `tests/s13-p1-dual-wielding.test.ts` / raw role pools are eight actual completed items and all 63 v19 real heroes have explicit roles | 0.007 | 0.007 | 0.007 |
| `tests/s13-p1-dual-wielding.test.ts` / public anomaly selection grants two role items once, keeps equipment, restores after target sale and rejects altered grant | 22.795 | 25.332 | 0.832 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / a holder-owned summon kills as itself; holder contribution=false controls only assists, with identical restored ticks | 9.960 | 10.419 | 10.419 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / a holder-owned summon kills as itself; holder contribution=true controls only assists, with identical restored ticks | 9.409 | 9.910 | 9.910 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / saves Morgana curse without a summon or bracer, restores object/JSON, and continues every tick | 0.666 | 0.734 | 0.734 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / rejects altered or invented target reave facts beside the legal seed 3151248 curse | 0.172 | 0.122 | 0.122 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / restores the legal target reave and retains Irelia shielding at tick 104 | 0.118 | 0.068 | 0.068 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / rejects forged Black Rose member cast counts, including redistribution with an unchanged team total | 0.241 | 0.276 | 0.276 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / restores legal Black Rose member counts and keeps Sion bound at tick 21 | 0.096 | 0.075 | 0.075 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / rejects corrupted curse attachment binding for object and JSON beside a valid control | 0.089 | 0.049 | 0.049 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / rejects corrupted curse source binding for object and JSON beside a valid control | 0.089 | 0.046 | 0.046 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / rejects corrupted curse timing binding for object and JSON beside a valid control | 0.091 | 0.045 | 0.045 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / rejects corrupted curse action binding for object and JSON beside a valid control | 0.090 | 0.047 | 0.047 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / rejects corrupted curse amount binding for object and JSON beside a valid control | 0.088 | 0.049 | 0.049 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / rejects corrupted curse missing binding for object and JSON beside a valid control | 0.097 | 0.047 | 0.047 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / rejects transferring pulses to another real Morgana even with rebuilt source/holder/key identities | 0.159 | 0.146 | 0.146 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / rejects an appended fake bleed while retaining every genuine Morgana curse pulse | 0.089 | 0.050 | 0.050 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / restores a living Bulky Buddies holder after its Forge buddy dies and Jayce revives that same Forge | 3.167 | 3.405 | 3.405 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / compares every restore for tasks only while reusing only exact detached replay evidence | 0.157 | 0.179 | 0.179 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / compares every restore for bracer and tasks while reusing only exact detached replay evidence | 0.190 | 0.228 | 0.228 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / bounds replay evidence, separates complete input contents and detaches every returned graph | 0.073 | 0.091 | 0.091 |
| `tests/task-mechanism-restore.test.ts`（已回退实验） / reuses verified hashes and incrementally hashes appended events against the full-ledger oracle | 0.305 | 0.314 | 0.314 |

锻造器两条原用例共享的路线前缀，在各自整组行中均计入，不能把这两行相加；文件行是无重复的实际总数。重放逐例原名保持不变，完整逐例数值另存 `/tmp/speed4-before-after.json`。

验证与清理：基线 546 文件 / 19,601 用例：19,600 通过、1 跳过、0 失败；首批限定复测 12 文件 / 6,232 用例全部通过。炮手 timing 入口单独执行，1,047 用例全部通过。最后补测 4 文件 / 869 用例全部通过；`npm run typecheck`、`git diff --check` 均通过。基线唯一跳过为原有 `tests/five-cost-comparison.test.ts` 的 original reproduction。现有 `tests/playtest-1022b-bench.test.ts:35` 自动写入的计时输出已恢复 HEAD，`docs/evidence/**` 无差异。

【未完成】

涉及 `tests/fixtures/v2*` 的测试、`tests/presentation/**` 均未修改。王冠历史和任务机制两处无收益实验已恢复 HEAD；三条重放文件的总耗时未显著下降，仍是主要耗时来源。真实生产构建隔离测试只有一次构建，不通过删减生产构建验证来提速。

【需要我决定】

无。按用户委托采用只读输入缓存、真实路线分段、固定搜索成功种子的推荐方案；约定记录于 `docs/S13_RULES_GAP.md` 的 speed4 四条 P（2026-10-25）。

【风险】

单次墙钟受机器负载和 worker 内共享缓存影响。单独过滤晚期分段会补跑前缀，耗时可能高于按整文件运行。未调整游戏规则、数值、保存格式、身份版本、独立 oracle、受保护夹具、前端或服务器。

【下一步】

由 Claude 交叉验货：检查测试结果、目录边界及玩法是否保持。用户明确要求不提交，本次保留为工作区修改。
