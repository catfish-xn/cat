# TFT 额外本地素材：离线提取与接线合同

## 当前交付

离线入口：`node scripts/assets3d/tft-extras.mjs --force`。
复看入口：设置本机 `CHROMIUM_PATH` 后运行 `node scripts/assets3d/tft-extras-browser-review.mjs`。
唯一素材输出为真实目录 `assets3d-local/tft-extras/`；输入联接只读。该目录由现有忽略规则覆盖。没有运行 Git 命令，没有联网或改动界面、服务器、规则目录。

法球及扣血原有 17 个效果键已扩展为 28 个，`manifest.json` 与 `precache.json` 已通过 `merge-manifests` 生成。专用球增量入口为 `node scripts/assets3d/special-orbs.mjs`；本次 `special-orbs-report.json.ready` 与合并结果均为 true，没有缺块。`action-bindings.json` 是独立的展示时序合同，预缓存只列运行时资源，不包含审计原始字段。

默认河灵 `little-legend-default` 已完成离线闭包、模型/骨骼/动作/贴图转换，GLB 已纳入合并 manifest 与 precache。`pet-closure-report.json` 确认全部已发现依赖可读取、没有缺块；详细来源和绑定只保存在本地报告。旧 `build-report.json` 保留上一轮结果，本次增量状态以 `special-orbs-report.json` 为准；网格转换器现支持顶点色、面颜色数据与定位元数据，面颜色仅保留、不推断其着色用途。

动作映射为 `idle → idle`、`move → run_ufo`、`cast → cast`、`hit → hurt`、`death → death`；没有独立 attack，不做替代。GLB 另保留 `emote_01`、`emote_02`、`emote_03` 等原名剪辑，表现层可显式播放；公共动作状态不新增 emote。身体读取源绑定的 whitebox、眼部读取源绑定贴图；当前材质近似没有复刻原引擎身体着色，不能宣称原版材质还原。

模型构建复用 `neutrals.mjs` 的 `buildNonChampionModel`，不走英雄定义校验；动作只按真实图映射，hurt 对应 hit，表情保留原剪辑名而不扩张公共动作状态。不会把缺失的移动或攻击替换成待机。

## 效果键与阶段

| 键 | 用途 | phase / anchor |
| --- | --- | --- |
| `orb-gray` / `orb-blue` / `orb-gold` | 三档父球；已经包含静态子效果，不要重复叠加 child | start / source |
| 对应 `-child` | 单独检查与复用子效果 | start / source |
| 对应 `-open` | 三档 RewardBoxOpen 开球 | impact / target |
| `orb-prismatic` / `orb-prismatic-idle` | 彩球父包装与 Idle，两者择一 | start / source |
| `orb-warband` / `orb-crime` | S13 专用球 | start / source |
| `orb-warband-open` / `orb-crime-open` | 明确标注近似的通用 Gold / Silver 开球 | impact / target |
| `orb-warband-reward-queued` | Warband RewardQueued；移动宿主近似 | travel / projectile |
| `orb-warband-cashout` / `orb-warband-stack` | Warband CashoutCeremony / PropStackCeremony | impact / target |
| `orb-crime-spawn` / `orb-crime-cashout` | Crime Prop_Spawn / Prop_CashoutTrigger | start / source；impact / target |
| `orb-crime-prop-low` / `-medium` / `-high` / `-full` | Crime Prop 四档关联效果 | start / source |
| `player-damage-mis` / `player-damage-mis1` | Avatar 与简版弹道，择一 | travel / projectile |
| `player-damage-tar` | 命中主体 | impact / target |
| `player-damage-child` | 独立命中子效果 | impact / target |

彩球父包装引用的是 Idle，不应当把该包装当作已经提取的专用开球爆发。三档开球可作为另行明确选择的展示约定，但不能按名字自动替换专用系统。

四个静态父球的子引用由实际 Map BIN 的 ResourceResolver 解析；只保留静态锚点，父级旋转、音频与引擎标志未复刻。扣血命中的动态子发射不自动展开，不猜测次数、随机分布或生成时机。逐项转换结果与遗漏原因只保存在本地报告。

本次检查 Map22 中的 set13 系统定义及 Map22 / TFTSet13 / TFTCommon 本地索引，所选 13 个系统没有额外子系统引用或未解析子引用；94 个贴图、10 个静态网格均已转换。没有发现 Warband / Crime 独立的 LootOrb_Open 或 LootOrb 弹道系统。`orb-warband-open` 选择通用 `TFT_RewardBoxOpen_Gold`、`orb-crime-open` 选择 `TFT_RewardBoxOpen_Silver`，沿用奖励开球这一最接近用途，绑定明确标记 `generic-*-open; no-dedicated-source-system`；不宣称颜色或原版触发一致。`RewardQueued` 只作为可选移动宿主；现金仪式、道具生成/档位效果独立保留，不能自动当作法球子效果或专用开球。

## 浏览器证据与近似限制

`review/` 含效果截图及河灵 idle、move、cast 三组 PNG，每组为斜视、俯视及多个播放采样；扣血弹道另有起终点参照与随时间移动的宿主。网格一格为一个棋盘格。`review/review-report.json` 记录加载错误与相对格数。

Chrome 实际截图中，`orb-gray` 及其 child 呈中性灰，`orb-blue` 及其 child 呈明显蓝青色，Gold 呈金黄；结合这几张截图与生成条目的系统对应关系，确认 Bronze → 灰，Silver → 蓝，而非仅按英文材质名推定。

当前灰球主体约占不足半格，蓝/金/专用球约半格量级；彩球图标更大，但仍在一格附近。三档开球主体约一格量级，扣血主体也保持局部效果；截图未见未贴图白方块、实心黑底矩形、异常竖片或铺屏。亮白闪光属于有纹理边缘的爆发，不能与缺贴图白块混同。

这些是近似效果：附着蒙皮网格、二级遮罩、未知字段、场集合和扭曲被现有转换器拒绝或跳过；并非原版完整复刻。灰球细节较少，开球部分颜色细节缺失，Crime 后段出现离散圆片。彩球持续待机已补验：初始、延长与长时采样的斜视/俯视截图均保留球芯，运行时仍有粒子且未结束，加载错误为空；仅代表本地有界持续播放验收，不代表无限运行或原引擎等价。报告保留失败与遗漏，不用空文档或临时白材质掩盖问题。通用粒子尺寸、坐标反射、混合/有效 alpha、网格尺度与平面方向均沿用现有近似管线及统一运行时比例。

专用复看入口为 `node scripts/assets3d/tft-extras-browser-review.mjs --special-orbs`，13 张截图与 `special-orbs-review-report.json` 在上述 `review/` 中，加载错误为空。Warband 球芯约半格，Crime 球芯约半格并带约两格的光尾；两者长时采样仍持续待机。含透明边缘的几何包围范围分别约一格、三格；开球约一至一点五格。RewardQueued 约三格，Warband CashoutCeremony 长边约七格半，其余仪式与道具关联效果约一至三格半。后两类不按法球大小直接自动播放。资源闭包完整不代表所有发射器均还原：未知字段、遮罩、附着蒙皮、模板/场集合等遗漏仍逐项保存在本地报告，面颜色保留为独立属性但不参与当前着色。

## 验证

新入口、请求键、phase/anchor、静态子映射与效果包单独预缓存均有合成测试，不保存原素材 fixture。新测试、assets3d-neutrals 与 rendering3d 系列共 15 文件、275 测试通过。

本次专用球合成测试覆盖四个必要键、阶段绑定、合并后文档/预缓存，以及 SCB 顶点色/面颜色和 SCO 定位字段；`tests/assets3d-tft-extras.test.ts`、`tests/assets3d-particles-v2.test.ts` 与 `tests/rendering3d*` 共 18 文件、367 测试通过。

本机默认 Vitest 配置打包器遇到访问权限错误，使用 `node --experimental-strip-types node_modules/vitest/vitest.mjs run --configLoader native --project fast --maxWorkers 2 tests/assets3d-tft-extras.test.ts tests/assets3d-neutrals.test.ts tests/rendering3d` 验证通过。浏览器关闭目录监听，避免遍历本地素材联接。

全仓 `npm.cmd run typecheck` 已运行，现有压缩测试缺少 `@gltf-transform/core`、`ktx-parse`、`sharp`，因此全仓检查未通过；保持原编译选项、仅排除该已有测试文件的 TypeScript 检查为零错误。未联网安装依赖，也未添加空声明绕过错误。

## 界面接线需求

### conqueror-shimmer 独立包体积

| 键名 | 原始入口文件（字节） | 压缩入口文件（字节） |
| --- | ---: | ---: |
| `conqueror-chest` | 137848 | 48632 |
| `shimmer-flask` | 162136 | 50248 |
| `conqueror-chest-open` | 890 | 892 |
| `shimmer-flask-offer` | 7679 | 7684 |
| `shimmer-flask-take` | 19270 | 19281 |

入口文件体积不含共享依赖与索引。

2026-10-21 转正重建：完整 root 为 619031 字节，压缩包（含索引与 compression-report）为 287097 字节。微光瓶的倾斜来自源待机动画根骨骼自带的固定倾角，绑定网格本身竖直，不是导出轴或骨骼转换错误。导出时加一个 `shimmer-upright-export` 静态父节点抵消倾角并落地居中，动画和蒙皮数据不变，运行时无需转正；若源动画朝向变化，校验会拒绝这个静态修正。review 截图在 `assets3d-local/conqueror-shimmer/review/`。

### Warband / Crime 专用球（由 Claude 实现）

1. `src/rendering/board-feed.ts` 的 `BoardOrb` 增加可选 `readonly variant?: "warband" | "crime"`，保留 `tier`。当前 `src/rendering/BoardScene.ts` 发布帧仅从 `readUnclaimedOrbs(this.session.state)` 复制 `{ orbId, tier, queued }`；后者读取显示状态顶层 `state.unclaimedOrbs`，来自本席私有投影。`UnclaimedOrbView.source` 只有 `pve | mechanic`，单靠它或灰球 tier 无法区分专用球。
2. 已有可用的只读证据是 `this.session.state.seatMechanics?.receipts[]`：寻找 `kind === "unit" && resolution === "orb" && receipt.orbId === orb.orbId` 的收据，读其 `source`，严格映射 `conqueror → warband`、`black-market → crime`。其他来源、缺字段、无法唯一关联一律不设 variant；不解析 orbId 猜来源，不按英雄/物品内容猜皮肤。该收据在奖励入球时即存在，不必等玩家领取。公开类型 `SeatMechanicsState.receipts` 已供本席读取；不读取 `seatMechanics.hidden` 或对手状态。
3. 领域字段链的依据：`g2-3-runtime.ts::claimG23Atom` 以奖励 bundle 的 `source` 创建 grant 请求；`seat-mechanics/grants.ts::grantMechanicUnit` 在联机英雄奖励入球时保留该 `source`、写入 `orbId` 和 `resolution: "orb"`。球的领域路径为 `MatchState.m8.loot.rewardOrbs[]`，其 `entries[].sourceUnitId` 是该机制 receiptId；显示层直接按收据 `orbId` 关联即可，不重建领域身份。`readLootView(state).unclaimedOrbs[]` 只投影 `source: "mechanic"`，具体来源仍以机制收据为准。
4. 静态奖励表名称仅作调查佐证：`content/g2-3-loot-source.ts` 中 `ArmoryTable_TFT13_Warband_Cashout*` 经 `G23_CONQUEROR_CHESTS` 对应 `conqueror`；`TFT13_Crime_BlackMarket*` / `TFT13_Crime_Loot*` 经 `G23_BLACK_MARKETS` 对应 `black-market`。运行时奖励 bundle 存于 `state.seatMechanics.seat.conqueror.rewards[]`（包含两类来源），不是当前球上的专用皮肤字段；不从表名或 opaque seat 对象推算奖励。
5. `src/rendering/three-mode/tabletop.ts` 的 `OrbView` 保存该 variant；`startIdle` 有 variant 时加载 `orb-${variant}`，确认领取后 `removeOrb` 加载 `orb-${variant}-open`。无 variant 时保留现有 `ORB_IDLE[tier]` / `ORB_OPEN[tier]`，包括彩球现有通用开球。专用球加载失败可回退对应普通档；异步加载需维持原有销毁/去重保护。专用待机使用绑定中的有界持续时长，不能仍按普通球短时长截断。相同 orbId 的 variant 若晚到或改变，重建待机并保存最新 variant，防止旧加载覆盖新选择；移除时依据缓存的 variant 播放。
6. `openedOrbs` 保持现有 `orbClaimReceipts → grantedOrbIds` 路径，只在确认领取且非 forfeited 时播放一次；`queued` 不代表已开球，重连不补播历史。RewardQueued、现金仪式与道具档位是可选展示，暂不接入默认待机/开球链。现有本席机制收据已足够，不需要规则侧新增导出或更改结算；旧投影没有收据时回退普通档。若后续确需统一选择器，可另提只读 `orbId → source/variant` 导出需求，本任务未修改 `src/simulation` 或任何界面文件。

### 其他已交付接线

- 小小英雄：读取 `manifest.models["little-legend-default"]` 并加载其 GLB，依照 animations 映射播放。建议与最近可部署格中心相距约一至两格，不占部署格。建议高度为英雄基准高度的二分之一；待机截图测得约为英雄的 0.51 倍，高约四分之三格、宽约一格，动作姿态会改变包围盒。按本地报告的 suggestedScale 缩放并贴板，不能把原始模型高度直接当显示高度。位置、朝向与动作由表现层控制，不能影响领域坐标或碰撞规则；表情通过原名剪辑显式触发，hurt 使用公共 hit 状态。
- 法球出现：依据 `lootRevealed` 与 `readLootView` 中已揭示的 `revealedOrbs` / `unclaimedOrbs` 创建，按 orbId 去重；使用投影已有位置与 tier，不能重跑随机、预测未揭示奖励或读取对手隐藏内容。父球与 child 二选一，不叠加重复。
- 法球开球：收到 `lootGranted` 或已确认的 `claimReceipts` 后，按唯一 receiptId / orbId 播放对应 `-open` 并移除待机；`lootForfeited` 仅移除，排队或容量不足不先播放成功开球。多条 drop 共用一球时须聚合到同一个 orbId，重连只还原当前待机，不重播历史开球。专用球需由明确公开来源选择，不能只凭奖励内容猜皮肤。彩球使用已验收的有界持续待机策略；宿主须在领取、移除或场景销毁时 dispose，超出本地报告播放上限需显式重建并复看，不宣称无限待机。
- 扣血：以 `roundSettled` 对应的权威 `roundResults` 中正的 hpLost 为依据；联机使用已有投影提供的相同结算证据，投影不暴露时应提数据需求。按 roundId 与受击席位去重，胜负和扣血量不在表现层重算。发射点为获胜方小小英雄/棋盘侧边锚点，终点为受击方小小英雄锚点；跨棋盘展示时把两个锚点投影到同一显示空间。
- 扣血时序：结算已确认后播放施法动作，弹道 travel 宿主沿起终点插值；飞行可占整个反馈段的约三分之二，抵达即停止 travel，随后在终点播放 impact。命中 child 若启用，只作为一次明确的近似附加，不复刻动态父子生成率。hp 与胜负以已收到状态为准，不等待特效、不二次扣血；重连不补播旧命中。
