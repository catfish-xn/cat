# v26 anomitem：异变奖励与便携异常点显示

工作树：`claude/v26-anomaly-items`，基线 `4baaaf5a9a74335d46fa0e037a93e4e595f05384`。仅修显示，不改规则、数值、发奖方式或网络协议；不提交，不写本地素材软链。

## 反馈 1：4-6 给的装备／法球

已确认的两条装备奖励链：

| 来源 | 发奖入口 | 实际去向 |
| --- | --- | --- |
| 双刀流 `dual-wielding` | `src/simulation/anomaly-acquisition.ts:29` | 两件符合目标定位的成装，调用 `grantMechanicItem` 直接入物品备战席 |
| 又一个异常突变 `another-anomaly` | `src/simulation/augment-pool-batch5-r2-anomaly.ts:18` | 选择 4-6 异变后，`TFT13_AnotherAnomaly_Item:<anomalyId>` 直接入物品备战席 |

`src/simulation/seat-mechanics/grants.ts:49` 将装备永久入库，不创建 `rewardOrbs`。因此，**这两类奖励没有待领取法球是当前发奖方式，不是投影漏字段**。本次没有把它们转换为法球；这会涉及发奖／领取规则变更。

| 链路 | 检查位置 | 结论 |
| --- | --- | --- |
| 本席私有装备 | `src/simulation/private-seat-view.ts:103` → `src/server/room/projection.ts:179` | `items` 保留实例 ID、定义 ID、inventory／unit 位置 |
| PlayerView 公共阵容 | `src/server/room/projection.ts:28`、`:69`、`:73` | `seats[].publicBoard.looseItems`／单位 `items` 保留定义 ID；不是给对手发送装备实例或奖励账本 |
| 客户端适配 | `src/rendering/online/seat-view-adapter.ts:92` | `...view` 保留装备和 `unclaimedOrbs` |
| 2D／3D 共用物品备战席 | `src/rendering/strategy-panel.ts:789` | 渲染所有 inventory 装备；便携异常点旧路径只有文字占位图，没有图标 |
| 法球 dock | `src/rendering/online/orb-dock.ts:19`、`:179` | 只渲染服务端已给出的 `unclaimedOrbs`；不从奖励收据虚构法球 |
| 3D 棋盘法球 | `src/rendering/BoardScene.ts:1453` → `src/rendering/three-mode/tabletop.ts:468` | 使用同一 `unclaimedOrbs`；上述直接入库奖励无棋盘法球 |
| 2D 装备／3D 头顶图标 | `src/rendering/BoardScene.ts:1483`、`src/rendering/three-mode/unit-overhead.ts:113` | 共用 `s13AssetUrl('item', id)`；旧便携异常点返回 null，3D 留下灰色占位块 |
| 3D 侦察装备 | `src/rendering/three-mode/three-loader.ts:101` → `src/rendering/three-mode/scout-stage.ts:194` | 同一物品图标查询，随本次映射一起修复 |

没有发现奖励根本未发，也没有复现装备从私有／公共投影中消失。若反馈 1 指其他异变或战斗奖励，需要补充异变名称与触发时机再定位，不能将本次验证外推为所有奖励路径都已复现。

## 反馈 2：是哪张海克斯、原版是什么

黄金海克斯 **又一个异常突变 / Another Anomaly / `TFT13_Augment_AnotherAnomaly`**。

本机只读归档：`/home/aiapps/workspace/augments-research-2026-10-23/catalogue.zh-CN.md:861`，以及 `data/augments-14.24.json` 中同 apiName 条目；规则内容为 `src/simulation/content/augment-pool-batch5-r2.ts:10`。本次另读取 [14.24 客户端原始中文数据](https://raw.communitydragon.org/14.24/cdragon/tft/zh_cn.json) 核对物品条目，得到：

```json
{
  "apiName": "TFT13_AnotherAnomaly_Item",
  "name": "便携异常点",
  "desc": "携带者获得你的【异常突变】进化效果。",
  "icon": "ASSETS/Maps/TFT/Icons/TFT13/TFT13_GoopItem_Icon.TFT_Set13.tex",
  "effects": { "AD": 0.20000000298023224, "AP": 25, "Health": 250 }
}
```

旧表现：名称回退为领域中的“便携异常：<异变名>”；效果已能显示对应异变说明，但夹带实现用语；物品图标只查 items／loot／artifact-items／support，未桥接 anomalies 图标，2D 是文字占位、3D 是灰块。

修复：`src/presentation/g23-display.ts:166` 使用“便携异常点：<对应异变名>”，`:192` 将所有有效便携变体映射到现有 `anomalyIconUrl()`；`src/presentation/special-item-text.ts:49` 明示所复制的异变及其说明，属性仍读原定义；`src/rendering/strategy-panel.ts:796` 让备战席使用同一显示名称。领域内容及 content digest 均不变。

所需图标 **本机已有**：`public/assets/s13/g23/anomalies/tft13_goopitem_icon.png`，来源及校验见 `src/presentation/s13-g23-asset-checks.ts:43`。本次不下载、不复制新素材。现有 3D 装备以头顶图标显示，未新增独立落地装备模型；`assets3d-local` 软链下仅有 UI 数据，无可确认的便携异常点独立模型。若要求新增独立落地模型，还缺经核实的原版模型／动作／特效素材及其展示约定，不能用通用法球冒充。

## 验证与待重录

新增 `tests/presentation/anomaly-items.test.ts` 验证真实选择／刷新／发奖命令、JSON 往返、私有和公共装备投影、所有便携变体名称／说明／图标、实际 3D Sprite 贴图。既有断言及超时未改动。

本环境无 `CODEX_BROWSER_CLIENT`／`PLAYWRIGHT_WS_ENDPOINT`，未启动浏览器。相关 Node 测试通过临时 `/tmp/anomitem.vitest.config.mts` 读取原配置，仅禁用缓存和会自行启动 Chromium 的 globalSetup；保留原测试项目、setupFiles、测试断言和超时，使用 `--configLoader runner --maxWorkers=4`。普通 Vite 配置加载会写只读 `node_modules/.vite-temp`，构建改用同一配置的 `--configLoader runner`。

验证结果：8 个相关测试文件，**159 / 159 通过**；`npm run typecheck`、`npx vite build --configLoader runner`、`git diff --check` 通过。文件包括新增 anomaly-items、special-item-text、v23-anomaly-panel、g2-3-display、reward-item-mark、rendering3d-overhead、rendering3d-tabletop 和真实房间回归 augment-pool-batch5-r2-anomaly。

按 `scripts/m7-budget.cjs` 口径（只加总 `dist/assets/*.js`、逐文件 gzip level 9），2D **630,531 → 630,661 B（+130 B）≤ 637,144 B**，余量 **6,483 B**。无新 chunk，无预算或 Vite 配置变更。UI 34,568 B、solo 88,433 B、3D 333,961 B 分列；并未声称跑过 m7 浏览器交互时延门禁。机器可读结果为生成物 `artifacts/anomitem/verification.json`。

需要 Claude 通过 `codex-browser exec` 新启动任务后重录：2D／3D 的 4-6 双刀流成装入库、又一个异常突变的便携异常点入库、hover 名称／效果、拖到备战席和棋盘棋子后图标、3D 侦察同款图标。不要把“不出现新法球”判作本次显示修复失败；若产品要求奖励先落球，应另开规则变更。
