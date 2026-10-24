> 后续覆盖：六费 AD 已按用户 10-23 第二批批准改为各自一星值 × 1/1.5/2.25，正数四舍五入；见 [六费 AD 报告](SIX_COST_AD_STAR_SCALING.md)。下述“六费保留/另定”为上一单的历史记录，HP 和专用四星仍保留。

# AD 星级倍率修正（2026-10-23）

分支 `codex/v22-candidate`，施工基线 `c2179b9e`。来源：**TFT 通用规则，用户 10-23 批准；14.24 源数据只有一星属性**。本单离线执行，**待 v22 统一录制**。

## 改动与调用检查

- 普通单位 HP 保持 **100/180/324%**，AD 改为 **100/150/225%**；从一星基础值乘整数百分比后向下取整。
- 普通 HP/AD 和保留的六费表集中在 `src/simulation/content/unit-star-scaling.ts:3`；`unit-stats.ts:17`、`:18` 分别选择 HP/AD 表。`getUnitStats` / `resolveUnitStats` 的签名、输出形状、失败原因不变。
- `s13-rules.ts:22` 公开 `starHealthPercent`、`starAttackPercent`、`sixCostStarPercent` 三张只读星级键表，引用同一来源；移除无调用方的旧 `starStatPercent`。来源说明 `source-manifest.ts:211` 同步区分 HP/AD。
- 展示卡 `src/presentation/unit-card.ts:107`、选中信息 `src/rendering/BoardScene.ts:1034` / `strategy-panel.ts:1237` 均读 `getUnitStats`；`ability-display.ts:49` 和双形态 `g2-3-forms.ts:11` 沿 `getUnitStats` / `resolveUnitStats`，不另建倍率。
- bot 的 `bot/formation.ts:11` 只按星级和费用估值，`bot/index.ts:85` 使用该估值；不推导 AD，保持原策略。
- trainer 魔像仍用 `content/opening-batch-b.ts:6`、`:7` 的独立 HP 与百分之一 AD 表，**600/1080/1944 HP、55/82.50/123.75 AD**；`fixedStarStats` 召唤物也保持不缩放。
- 家人普通升星沿 `family-reunion.ts:23` 读取新普通 AD；专用四星 `family-reunion.ts:25` 的普通 583.2% / 六费 648%，以及 `d14-anomalies/projection.ts:15` 的 583.2% HP/AD 覆盖保持。只修正文案，避免继续称普通 HP/AD 共用倍率。
- 没有改其他规则数值、界面实现、CI、版本或摘要常量、epoch、历史 golden/fixture；没有提交 commit。

## 六费 AD 现状：本次全部保留，待用户另定

| 六费 | 一星 / 二星 / 三星基础 AD | 定义位置 |
| --- | --- | --- |
| 沃里克 | **110 / 198 / 396** | `src/simulation/content/v19-six-cost.ts:16` |
| 维克托 | **100 / 180 / 360** | `src/simulation/content/v19-six-cost.ts:17` |
| 梅尔 | **80 / 144 / 288** | `src/simulation/content/v19-six-cost.ts:18` |

三者倍率均为 **100/180/360%**：表在 `src/simulation/content/unit-star-scaling.ts:6`，属性选择在 `src/simulation/unit-stats.ts:18`，三星声明 `threeStarBps:36000` 仍在 `src/simulation/content/v19-six-cost.ts:9`。

维克托战斗固定 AD 在 `src/simulation/combat-s13-state.ts:98`；额外 AD 转 AP 扣除基线在同文件 `:93`。原两处 `{1:100,2:180,3:360}` 改为引用同一保留表，**数值与转换行为不变**。这些固定 AD 是项目已批准特殊规则，不套普通 150/225%。家人专用六费四星仍为 648%，见 `family-reunion.ts:25`。

可选：继续保留六费特殊表，或另开规则单调整六费 AD 并同步维克托转换基线；建议本候选先保留，另单决定。

## 独立手算向量

`tests/ad-star-scaling.test.ts` 不引用生产倍率表生成期望值：

| 单位 | 一星 / 二星 / 三星 HP | 一星 / 二星 / 三星 AD |
| --- | --- | --- |
| 德莱厄斯 | 600 / 1080 / 1944 | 55 / 82 / 123 |
| 麦迪 | 500 / 900 / 1620 | 50 / 75 / 112 |
| 烈娜塔 | 600 / 1080 / 1944 | 35 / 52 / 78 |
| 洛里斯 | 850 / 1530 / 2754 | 50 / 75 / 112 |
| 旧测试 sentinel | 800 / 1440 / 2592 | 45 / 67 / 101 |

例如德莱厄斯二星 `floor(55×1.5)=82`，三星 `floor(55×2.25)=123`；麦迪默认技能单弹 `floor(AD×[1.25,1.25,1.4]+[10,15,25])` 为 **72/108/181**。同时检查六费全星级、魔像小数余数、固定属性召唤物、普通家人升星和专用四星不变。

既有 `unit-stats` 的普通 AD 断言同步；D14 两个普通 AD 断言改为独立手算：Lux 三星 `floor(30×2.25)=67`，二星归来加成 `floor(floor(30×1.5)×1.5)=67`；D14 四星 174 AD 原断言保留。未修改身份、摘要或 golden 类断言。

## 验收与保留失败

`npm run typecheck`、`git diff --check` **通过**。本地 Vitest 最终选择 **24 文件：19 文件全过、4 文件有旧断言失败、1 文件收集阻塞；已执行 735 项，462 通过、273 失败、0 跳过**。新增独立手算 **12/12 通过**。统一参数 `npm test -- <文件> --configLoader runner --no-file-parallelism --maxWorkers 1`，避免共享依赖目录的配置缓存写入。未联网、未重新录制。

全过文件（均为 `tests/` 下）：`ad-star-scaling`、`unit-stats`、`upgrades`、`m8-b5-grant-upgrade`、`t10-deferred-upgrades`、`combat-start`、`g2-2-ability-display`、`d14-ability-display`、`d14-anomalies`、`d14-sale-price`、`opening-encounters-batch-b`、`t7-bot-policy`、`g2-3-skills`、`v19-mechanics`、`presentation/g2-3-display`、`t11-golden`、`t12-golden`、`t13-a-golden`、`t13-golden`，后缀均为 `.test.ts`。六费属性及维克托战斗行为另由 `v19-part2` 通过的 38 项覆盖。

保留失败清单：

| 文件 / 用例 | 失败数 | 原因 |
| --- | --- | --- |
| `tests/content-identity-constants.test.ts` 的两个摘要核对 | 2 | 旧常量 CONTENT `35273c97` / LOOT `ef359464`；当前重算为 `2f81d2de` / `b60b716e`（均 `fnv1a32-utf16:`），只读核验，不回写 |
| `tests/m8-content-equivalence.test.ts` 的历史状态恢复 | 134 | `Invalid Match save: opening-context-mismatch`；父候选已启用 Batch A/B，历史录制待统一更新 |
| `tests/opening-random-identity.test.ts` 的历史状态恢复 | 134 | 同上，保留历史状态与断言 |
| 同上 `recomputes the first battle terminal and every event hash from public commands` | 1 | 候选战斗轨迹与旧录制不同，实际 164 tick、旧期望 342；待统一录制 |
| `tests/v19-part2.test.ts` / `freezes stage/level odds and preserves two words per shop slot` | 1 | Batch A 已记录的旧商店规则：4-6 预期20、实际16 Bps，非本次 AD 改动 |
| 同上 `shared six-cost reservations are finite, can merge, sell and fall back after exhaustion; locks and failures are inert` | 1 | Batch A 已记录的极小池旧向量：整店判定未中返回 `pool-empty`，非本次 AD 改动 |
| `tests/d14-wiring-match.test.ts` | 套件收集阻塞，未执行 it | `earned source must be dead`；旧公开路线 oracle 要求基础掉落怪物 ID 出现在当前死亡表，Batch B 蟹载体已改映射；不改历史 oracle |

旧规则失败的基线证据见 [Batch A 报告](OPENING_ENCOUNTERS_BATCH_A_REPORT.md#未改动的旧测试失败清单)；相同旧 oracle 阻塞见 [Batch B 报告](OPENING_ENCOUNTERS_BATCH_B_REPORT.md) 第147行。上述失败跨父候选和本次规则合成，不能都归因于本次 AD；只列本次实测结果。T11/T12/T13-A/T13 历史字节与拒绝旧身份测试通过，不把未运行的其他完整路线 golden 称作已验收。待 v22 统一录制时处理摘要、历史轨迹及旧 oracle，当前候选不能与旧身份状态混跑或直接发布。
