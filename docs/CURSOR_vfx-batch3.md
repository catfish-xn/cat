# 特效第 3 批审查修复

基于 `claude/v26-vfx-batch3` 的 `804fc8f8`，分支 `cursor/vfx-batch3`。未开 PR，未强推。未改规则数值、内容摘要或纪元；没有 `--write` 重录。

## 改动

- `src/simulation/combat-replay-view.ts:142`：来源类型改成与 `cursor/vfx-batch2` 相同的 `PacketOrigin` / `RelaxPacketOrigin`（`sourceKind`、`definitionId`、`delivery`）。伤害包三个字段都投影。治疗份额照同一写法带上这三个字段；治疗账本没有伤害 delivery，只按 `sourceKind` 收成 `ability-direct` / `equipment-proc` / `basic-attack` / `attack-extra`，不参与结算。缺任一字段的旧回放不当作技能来源。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:21`：`isAbilityPacket` 必须同时是 `sourceKind==='ability'`、非空 `definitionId`、以及 `ability-direct` 或 `ability-periodic`。装备自疗因此不会续 Swain 的 1.25 秒尾巴。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:123`：Swain 升华只由前排施法建立。未施法时，魔法包（含技能包和装备包）不播升华脉冲，也不把尾巴续上。装备包在升华期间也不刷新 `lastTick`、不播 `swain-pulse`。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:205`：Illaoi 吸取/猛击、Loris 反击、Silco 代理攻击同样要求技能包，并且仍只在当前播放窗口播一次性效果。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:83`：`settle`。持续状态（升华、海牛通道、Silco 12 秒畸变体、Elise 0.6 秒蜘蛛）在 `current === false` 时先登记。等本批出现更晚的 tick，或 `update`/`frame` 收口后，仍在显示寿命内的才呈现；已经超过寿命的不生成。非当前施法不会在该事件返回前就生成代理，所以原「历史施法当时 `proxyCount === 0`」断言保持不变，追帧收口后的断言更严。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:221`：Illaoi 减伤结束不看短播放窗口，追帧里的结束仍会停通道。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:250`：视觉尾巴停掉升华时同时删登记，避免下一帧把已经结束的升华再开起来。尾巴仍是 1.25 秒，没有加长。
- `src/rendering/three-mode/vfx-ltk/batch3/proxies.ts:35`：`drop`，过期的一组代理按 id 撤掉，不把同主人的其他组一起清掉。
- `src/rendering/three-mode/vfx-ltk/runtime.ts:41`：`play()` 仍因任一死亡/缺失/已释放目标拒绝整段并保持手写回退。`playVariant`（`:57` 传入 partial）只丢掉该目标，保留无目标的自身起手和其他存活目标。队列上限仍按实际入队数量整段拒绝，不部分入队。
- `src/rendering/three-mode/vfx-ltk/runtime.ts:88`：0.3 秒过期窗口仍丢掉一次性效果。带 group 的持续技能只要 `clock < when + duration` 就仍启动。六次启动上限、0.3 秒常数、粒子单帧最多推进 0.1 秒都没提高。
- `docs/MULTIPLAYER_CONTRACT.md:1406`：伤害包与治疗份额白名单改成上述三个展示字段，写明不执行规则、不下发 instanceId/effectIndex。

未改断言、未放宽超时。被新规则覆盖的行为用更严的负例并列，原断言仍在：

- 历史 Silco 施法在下一条 tick / `update` 之前 `proxyCount === 0`（`tests/vfx-ltk-batch3.test.ts` 原用例）。
- Swain 连续 12 次自疗仍播 2 次升华、停疗后再过 1.3 秒才停。份额改成投影里的技能来源（`ability` / `swain-ability` / `ability-direct`）；缺字段或装备份额不再续尾巴，另有负例。
- `tests/g5-combat-summary.test.ts`：份额键从 `actual,sourceId` 换成 `actual,definitionId,delivery,sourceId,sourceKind`，并要求 `definitionId==='heal'` 且 `delivery==='ability-direct'`。原来禁止 `sourceKind|definitionId` 的正则改为仍禁止 `instanceId|effectIndex|requested|overheal|parentItemInstanceId`。
- `play()` 对死亡队友仍整段返回 false、队列不变（`tests/vfx-ltk-review-r.test.ts` 原用例，本文件 `:209` 再测一次）。
- 无 group 的 1 秒效果在 `update(1)` 后仍不出现（`tests/vfx-ltk-timeline.test.ts` 原用例，本文件用 `hero-burst` 再测）。

## 测试

`npx vitest run tests/vfx-ltk-batch3.test.ts tests/g5-combat-summary.test.ts --maxWorkers=4`：2 个文件、26 项通过。`npx tsc --noEmit` 通过。本分支没有 `tests/vfx-ltk-batch2.test.ts`（该文件在 `cursor/vfx-batch2`）。

负例：装备魔法、缺字段的伤害包、装备自疗和缺字段的自疗、Silco 装备包不攻击、追帧已结束的召唤、死亡目标。

回放视图（g5 的 2-1、种子 42、六英雄对局，`JSON.stringify` UTF-8）：整段 **510,743** 字节。相对只带伤害包 `sourceKind`/`delivery` 的上一版，本次多 **9,722** 字节（约 1.9%）：229 个伤害包的 `definitionId` 共 7,261 字节，31 个治疗份额的三个来源字段共 2,461 字节（每份约 79 字节）。

生产构建 `/tmp/vfxb3-dist`：顶层 `dist/assets/*.js` gzip level 9 合计 **630,539**（`index` 506,640 + `phaser` 123,899）≤ 637,144。`index.html` 不预载 `assets/3d/`。

## 未完成

- 显示层拿不到单独的战斗时钟，召唤物年龄用本批事件里最大的 tick。若追帧批次在施法之后只有空 tick、没有更晚的事件，会按施法 tick 当作仍在持续。
- 素材上传、测试服、浏览器/GPU 实机未做。

## 执行端待办

- 纪元/内容摘要这次没有漂移，不要 `--write`。若另有字节级回放或视图快照，伤害包多了 `definitionId`，治疗份额多了 `sourceKind`、`definitionId`、`delivery`，由执行端统一重录。
- 素材下载、提取、`ssh tencent` 上传测试服。
- 测试服部署。
- `codex-browser` 实机看自然施法、追帧和装备触发。
