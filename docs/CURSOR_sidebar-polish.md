# CURSOR sidebar-polish（`cursor/sidebar-polish`）

基于 `claude/v26-sidebar-rank` 的纯前端补丁：修复侧栏换位丢焦点，并把头像连胜火焰对齐 14.24 scoreboard 的两档 Loop VFX。

## 问题 a：换位丢焦点

`SidebarRanking.render` 原先在排序变化时对 `<ol>` 调用 `replaceChildren(...rows)`，会把已有行节点整批移出再插回，浏览器常因此清掉键盘焦点。

**改法**

- 新增 `syncSidebarListChildren`：按目标顺序用 `insertBefore` 就地移动，只动位置不对的节点；末尾多出的子节点 `remove`。
- 换位前记录 `document.activeElement` 的 `dataset.debug`；若插回后焦点不在该行上，则 `focus()` 恢复（双保险，正常就地移动通常已保留焦点）。
- 测试：`syncSidebarListChildren` 顺序断言；`SidebarRanking` 焦点保留；`PlayersSidebar` 集成里 `me.focus()` 后再 `render` 仍聚焦同一节点。

## 问题 b：两档火焰门槛

### 14.24 资料（CommunityDragon）

[`gameplay.tftscoreboard.bin.json`（14.24）](https://raw.communitydragon.org/14.24/game/gameplay.tftscoreboard.bin.json) 中 `PlayerSelfTemplate` / `PlayerOpponentTemplate` 均包含：

| 字段 | 含义（客户端资源引用） |
| --- | --- |
| `WinStreakIntro` | 连胜头像特效入场 |
| `WinStreakLoopLevel1` | 持续循环 · 第一档 |
| `WinStreakLoopLevel2` | 持续循环 · 第二档（更强） |
| `WinStreakOutro` | 退场 |
| `CombatStateWinFx` / `CombatStateLossFx` | 战斗态胜负 FX，**不是**侧栏头像连败冰焰 |

**未在 JSON 中出现的项：** 任意 `LossStreak*` / 头像冰焰侧栏控件；numeric 触发场次也未导出。

[Riot 14.2 补丁说明](https://teamfighttactics.leagueoflegends.com/en-au/news/game-updates/teamfight-tactics-patch-14-2-notes/) 只调整连胜**通知**到 5/8 场，不能当作头像火焰门槛，且与项目内**连胜金币**阶梯（2/5/6，经济规则）无关。

### 前端取值（推断）

JSON 有两档 Loop、无数值 → 代码使用 **`SIDEBAR_FIRE_WINS_LEVEL1 = 3`**、**`SIDEBAR_FIRE_WINS_LEVEL2 = 5`**（注释与本文均标明 **推断**）。旧 Reddit 实机帖有「4 连胜起火焰」说法，与两档结构并不矛盾，但不足以作为 14.24 官方阈值。

- `sidebarWinStreak()` 返回 `{ count, level: 1 | 2 } | null`。
- CSS：`.seat-streak-fire.level-2` 更大光晕、`seat-flame-strong` 动画；仍无图集请求。
- **不做**连败头像冰效（scoreboard 无对应字段）。

## 验证

```bash
npm run typecheck
npm test -- --maxWorkers=4 tests/presentation/sidebar.test.ts tests/presentation/overtime-display.test.ts tests/rendering3d-budget.test.ts tests/rendering3d-mode.test.ts
npx vite build --configLoader runner
gzip -9 -c dist/assets/*.js | wc -c   # 须 ≤ 637_144
```

未改 `src/simulation/`、`src/server/`；未删断言、未提高超时。

## 推送

分支 `cursor/sidebar-polish`，推送即可，未开 PR。
