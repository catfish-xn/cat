# 3D 施法动画改动清单（2026-10-21）

依据：用户《S13 技能动画对照册 V2》与本地源图。原视频不入库；对照册没有逐帧核验，也不指定源片段。
按本次交付要求，本文仅记录数量、单位键与配置键；源动作名的显式映射集中在 `assets3d-local/unit-map.local.json`，素材与截图仅留在忽略目录。

## 范围

已有 60 个英雄模型；原对照约 19 个明显选错或缺主段，约 13 个缺起手或收尾。所有英雄的施法播放改为读取片段实际时长。
尚缺模型的 3 个单位不在本任务内。规则、战斗事件与协议不修改。

## 单位覆盖

| 单位键 | 配置键与处理 |
| --- | --- |
| amumu | `animations.cast: null`，保留特效事件 |
| tristana | `castSequence.in/main` |
| irelia | `castSequence.hold/main/out`、`castVariants.hero` |
| leona | `castSequence.in/hold/main` |
| loris | `castSequence.in/main` |
| illaoi | `castSequence.in/hold/main/out` |
| corki | `castSequence.in/hold/main` |
| ekko | `castSequence.in/main[]/out`，主段按施法次数轮换 |
| caitlyn | `castSequence.in/main/out`、`castVariants.branch`，侧向候选 |
| renni | `castSequence.in/hold/main` |
| smeech | `castSequence.in/main[]`、`castExtraClips` |
| sett | `castSequence.in/main`、`castVariants.branch`，单侧候选 |
| jinx | `castVariants.rotate`，3 段轮换；`castExtraClips` 保留候选 |
| sevika | `castVariants.branch`，4 个分支；等待战斗招式键 |
| gangplank / jayce | `castVariants.front/back` |
| swain | `castSequence.main/out`，形态差异待确认 |
| elise / vi | 保持已有主段 |
| ambessa | `castSequence.in/main`、`castVariants.branch`，姿态键待接线 |
| mordekaiser | `castVariants.star3` |
| drmundo | `castSequence.main/out`，持续段近似 |
| darius / twistedfate | `castSequence.in/main` |
| draven / morgana / rell / singed / camille / zeri / ezreal / renata / nunu | `castSequence.main/out` |
| akali | `castExtraClips`，2 个候选待核验，不默认启用 |
| vander | 普通主段保留，`castVariants.hero` |

其余 25 个单位的身体动作选择不变。32 个单位有施法显式配置，另 1 个单位仅追加候选。

## 素材与播放合同

- `castSequence`：`in → hold → main → out`；可选阶段省略；`main` 数组按施法次数轮换。`hold` 暂播放一次。
- `castVariants`：`star3/hero/front/back` 为序列；`rotate` 为轮换列表；`branch` 为招式键到序列的映射。
- `animations.cast: null` 明确关闭身体施法，与缺少映射不同。旧 manifest 仍可读取。
- 播放使用 `durationSeconds`；施法总时长受视觉上下限约束，整体调整速度以保留全部阶段。普攻可接受 `attackIntervalSeconds`。
- 各阶段单次播放并淡入，死亡清空队列。缺片段或明确关闭时保留当前动作与播放时间。
- 前后排依据布阵位置，在战斗中冻结；星级读取现有显示数据。计数随新战斗重置。

## 待战斗数据与边界

`sevika` 招式键、引导开始/结束、英雄强化标记由战斗数据下发，本任务不修改 simulation 或协议。
`ambessa` 姿态、`sett` 单侧命中、`caitlyn` 侧向分支缺少明确显示上下文，保留导出的可选片段，不据此推算规则。
`akali` 与 `jinx` 的额外候选未经用户视频逐帧确认，不代替默认序列。
其余英雄强化只变特效或行为的接线留待后续；不从单位名称猜测强化是否生效。

## 本地交付与验证

`cast-animations.mjs` 从只读素材根与固定版本提取缓存生成新根；先校验源文件基线与输入索引，再检查所有非动画数据及已有动作保留。
缺失必需源数据时仅写 `assets3d-local/cast-anim/plan.json` 并停止，不下载。
产物位于 `assets3d-local/cast-anim/` 与 `assets3d-local/cast-anim-compressed/`，不纳入 Git。
测试使用假名与程序生成骨骼曲线；本地真实预览至少核验 5 个指定单位，每个过程保存 3 帧至 `review/`。

## 本次交付验证

33 个单位经过重建检查，追加 68 个片段；32 个单位更新施法配置，另 1 个仅导出候选。33 个原模型的输入哈希与重建前一致。
源根与压缩根各保留 82 个模型、451 个动作，全部动作键及时间端点一致；运行文件索引各 2332 项，哈希检查通过。
25 个测试文件共 376 项通过，类型检查与构建通过。构建后的真实渲染器核验 5 个单位、8 种选择，源根与压缩根合计保存 48 帧。
`review-report.json` 的 `ready` 与 `proxyConnected` 均通过；`verification.json` 的 `ready`、`metadataEqual` 通过，`build-report.json` 的 `missingChunks` 为空。
仓库全量绝对路径预检命中既有文档；本次新增文件没有机器绝对路径，未修改既有无关文档。
