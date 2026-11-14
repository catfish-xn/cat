# cursor/vfx-batch2

基于 `claude/v26-vfx-batch2` @ `9eab5f3c`。未开 PR，未强推。未改玩法数值、内容摘要、epoch 或 `src/server/`。

## 改动

| 文件:行 | 内容 |
| --- | --- |
| `src/rendering/three-mode/vfx-ltk/batch2-bridge.ts:90` | 风暴落地只认技能自身包：`damageType === 'magic'` 且 `sourceKind === 'ability'` 且 `definitionId === 'viktor-ability'` 且 `delivery === 'ability-direct'`，仍要求施法目标内、施法之后的 tick，同 tick 有该 Viktor 的 attack 时继续跳过。冥火之拥（`sourceKind: 'item'`、`definitionId: 'TFT9_Item_OrnnDeathfireGrasp'`、`delivery: 'equipment-proc'`）、死亡射线（`delivery: 'basic-attack'`）和无来源标量的魔法包都不消费等待。 |
| `src/rendering/three-mode/vfx-ltk/batch2-bridge.ts:98` | 施法者已死或已不在场时，仍把存活目标交给 slam；`boardOnly` 仅在没有任何存活目标时为真。 |
| `src/rendering/three-mode/vfx-ltk/runtime.ts:10` | 只有骨骼施法起点和投射物需要活着的施法者。棋盘点与目标命中层不需要。 |
| `src/rendering/three-mode/vfx-ltk/runtime.ts:80` | 整组仍原子：任一 cue 锚在施法者身上且施法者已死，则整组不入队。slam 两组 cue 都不锚施法者，施法者死后仍入队。带骨骼起点的维克托警告在施法者死后仍整组拒绝。 |
| `src/rendering/three-mode/vfx-ltk/runtime.ts:102` | `stopUnit(施法者)` 只取消锚在该施法者上的等待/播放；不取消棋盘点与别人身上的命中层。目标死亡仍取消该目标未快照的层。 |
| `src/rendering/three-mode/vfx-ltk/runtime.ts:122` | 开播时同样只检查锚点：命中层看目标是否还活着，不因施法者已死跳过。 |
| `src/simulation/combat-replay-view.ts:110` | `packetDamage` 白名单增加三枚来源标量：`sourceKind`、`definitionId`、`delivery`。不复制 instanceId、effectIndex、packetId、permissions。 |
| `src/simulation/combat-replay-view.ts:144` | 类型上这三项可选，旧回放缺字段仍能通过编译；运行时缺字段不算技能包。 |
| `docs/MULTIPLAYER_CONTRACT.md:1406` | 白名单表与 `:1415` 说明上述三字段。不升版本号、不改 digest。 |
| `tests/vfx-ltk-batch2.test.ts:28` | 风暴夹具改为技能自身包。 |
| `tests/vfx-ltk-batch2.test.ts:142` | 241 施法、250 射线、260 冥火、270 无标量魔法都不落地；281 技能包只播放一次。 |
| `tests/vfx-ltk-batch2.test.ts:158` | 施法者死亡或离场后仍请求存活目标的命中层，且不是 `boardOnly`。 |
| `tests/vfx-ltk-batch2.test.ts:178` | 投影含三字段，不含其余来源。 |
| `tests/vfx-ltk-batch2.test.ts:229` | 施法者死后 slam 的棋盘层和命中层都开播；`stopUnit` 不清掉它们；带骨骼起点的警告仍整组失败。 |
| `tests/rendering3d-jayce-forge.test.ts:271` | 追帧落地改为技能自身包。播放次数与 `viktor-slam` 断言未改。 |

## 被取代的断言

- 原「后续任意魔法包即风暴」（`stormDamage()` 只有 owner 和 `damageType`，以及 `rendering3d-jayce-forge.test.ts` 的无标量 landing）改为「`viktor-ability` + `ability-direct` + magic 才是风暴」。原「播放一次 slam / 同 tick 普攻不触发 / 真伤与物理不消费」仍在，输入改为技能包。更严的新断言：冥火、死亡射线、无标量魔法不消费等待。
- 原运行时「施法者已死则整组 slam 失败」没有单独断言，行为改为「施法者已死仍播放棋盘层和存活目标命中层」。替代断言在 `tests/vfx-ltk-batch2.test.ts:229`：命中系统 `607d7b6b` 与棋盘系统 `c4ef93f3` 都出现，且骨骼警告仍返回 false、队列为 0。没有删超时，没有放宽 6 系统 / 64 队列上限。

## 测试

`npx vitest run --project fast tests/vfx-ltk-batch2.test.ts tests/vfx-ltk-timeline.test.ts tests/vfx-ltk-review-j.test.ts tests/rendering3d-jayce-forge.test.ts --maxWorkers=4`：4 文件、61 项通过。`npx tsc --noEmit` 通过。

2D 顶层 `dist/assets/*.js` gzip-9 合计 **630,555** ≤ 637,144（`assets/index-*.js` 506,656 + `assets/phaser-*.js` 123,899）。3D 仍在 `assets/3d/render3d-*.js`。未改 epoch、content digest、recorded fixtures、opening-random-identity，没有 `--write`。

## 未完成与执行端待办

- 未做浏览器 / GPU 实机验收，也未上传素材、未部署测试服。沿用 `docs/VFX_BATCH2_V26.md` 的上传与 codex-browser 步骤，不要在本分支代做。
- 旧服务器若仍下发没有这三项的 `packetDamage`，维克托风暴落地不会播放。测试服需同时带上本分支的投影。缺字段不能当成技能包。
- `docs/evidence/g5/replay-bytes.json` 的回放哈希会因每个伤害包多三个字段而变。本次未重录。没有内容摘要或 v25 epoch 漂移。
- `docs/VFX_BATCH2_V26.md` 风险段仍写「展示协议不能区分同源魔法装备伤害」。以本文为准。
