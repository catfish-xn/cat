# 特效第 3 批审查修复

基于 `claude/v26-vfx-batch3` 的 `804fc8f8`，分支 `cursor/vfx-batch3`。未开 PR，未强推。未改规则数值、内容摘要或纪元；没有 `--write` 重录。

## 改动

- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:23`：`isAbilityPacket`。带 `sourceKind`/`delivery` 的包里，装备（`item`、`equipment-proc`、`item-burn`）和其他非技能来源不再当作本批技能。没有这两个字段的旧包仍走原有闸门，避免改掉既有无标注断言。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:123`：Swain 升华只由前排施法建立。未施法时，魔法包（含技能包和装备包）不播升华脉冲，也不把尾巴续上。装备包在升华期间也不刷新 `lastTick`、不播 `swain-pulse`。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:205`：Illaoi 吸取/猛击、Loris 反击、Silco 代理攻击同样要求技能包，并且仍只在当前播放窗口播一次性效果。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:83`：`settle`。持续状态（升华、海牛通道、Silco 12 秒畸变体、Elise 0.6 秒蜘蛛）在 `current === false` 时先登记。等本批出现更晚的 tick，或 `update`/`frame` 收口后，仍在显示寿命内的才呈现；已经超过寿命的不生成。非当前施法不会在该事件返回前就生成代理，所以原「历史施法当时 `proxyCount === 0`」断言保持不变，追帧收口后的断言更严。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:221`：Illaoi 减伤结束不看短播放窗口，追帧里的结束仍会停通道。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:250`：视觉尾巴停掉升华时同时删登记，避免下一帧把已经结束的升华再开起来。尾巴仍是 1.25 秒，没有加长。
- `src/rendering/three-mode/vfx-ltk/batch3/proxies.ts:35`：`drop`，过期的一组代理按 id 撤掉，不把同主人的其他组一起清掉。
- `src/rendering/three-mode/vfx-ltk/runtime.ts:41`：`play()` 仍因任一死亡/缺失/已释放目标拒绝整段并保持手写回退。`playVariant`（`:57` 传入 partial）只丢掉该目标，保留无目标的自身起手和其他存活目标。队列上限仍按实际入队数量整段拒绝，不部分入队。
- `src/rendering/three-mode/vfx-ltk/runtime.ts:88`：0.3 秒过期窗口仍丢掉一次性效果。带 group 的持续技能只要 `clock < when + duration` 就仍启动。六次启动上限、0.3 秒常数、粒子单帧最多推进 0.1 秒都没提高。
- `src/simulation/combat-replay-view.ts:109`：`packetDamage` 增加 `sourceKind` 与 `delivery`（不是完整 Source）。`:135` 起类型上这两个字段可选，手写的旧视图字面量不用补字段。
- `docs/MULTIPLAYER_CONTRACT.md:1406`：白名单补上这两个展示字段，写明不执行规则。

未改断言、未放宽超时。被新规则覆盖的行为用更严的负例并列，原断言仍在：

- 历史 Silco 施法在下一条 tick / `update` 之前 `proxyCount === 0`（`tests/vfx-ltk-batch3.test.ts:103`）。
- `play()` 对死亡队友仍整段返回 false、队列不变（`tests/vfx-ltk-review-r.test.ts` 原用例，本文件 `:209` 再测一次）。
- 无 group 的 1 秒效果在 `update(1)` 后仍不出现（`tests/vfx-ltk-timeline.test.ts` 原用例，本文件用 `hero-burst` 再测）。

## 测试

`npx vitest run tests/vfx-ltk-batch3.test.ts tests/vfx-ltk-timeline.test.ts tests/vfx-ltk-review-r.test.ts tests/t5r-view-events.test.ts tests/rendering3d-animation.test.ts tests/g5-combat-summary.test.ts tests/jayce-forge-replay-order.test.ts tests/presentation/unit-revived-display.test.ts --maxWorkers=4`

结果：8 个文件，95 项通过。`npx tsc --noEmit` 通过。

负例在 `tests/vfx-ltk-batch3.test.ts:117`（装备魔法）、`:153`（追帧仍在/已结束）、`:190`（Silco 装备包不攻击）、`:209`（死亡目标与过期持续特效）。

生产构建 `/tmp/vfxb3-dist`：顶层 `dist/assets/*.js` gzip level 9 合计 **630,564**（`index` 506,665 + `phaser` 123,899）≤ 637,144。`index.html` 不预载 `assets/3d/`。3D 改动在 `vfx-ltk`，进入 3D chunk。未新增 `src/presentation` 懒加载模块，未改 `vite.config.ts` 的 `assets/ui` 列表。

## 未完成

- `heal.shares` 仍只有 `sourceId`。升华已经由施法建立之后，装备自疗仍可能把 1.25 秒尾巴续上。审查点是装备魔法伤害，这次没有扩治疗白名单。
- 显示层拿不到单独的战斗时钟，召唤物年龄用本批事件里最大的 tick。若追帧批次在施法之后只有空 tick、没有更晚的事件，会按施法 tick 当作仍在持续。
- 素材上传、测试服、浏览器/GPU 实机未做。

## 执行端待办

- 纪元/内容摘要这次没有漂移，不要 `--write`。若另有字节级回放或视图快照，`packetDamage` 多了 `sourceKind` 和 `delivery`，由执行端统一重录。
- 素材下载、提取、`ssh tencent` 上传测试服。
- 测试服部署。
- `codex-browser` 实机看自然施法、追帧和装备触发。
