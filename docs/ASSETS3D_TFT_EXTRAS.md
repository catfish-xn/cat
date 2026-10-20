# TFT 额外本地素材：离线提取与接线合同

## 当前交付

离线入口：`node scripts/assets3d/tft-extras.mjs --force`。
复看入口：设置本机 `CHROMIUM_PATH` 后运行 `node scripts/assets3d/tft-extras-browser-review.mjs`。
唯一素材输出为真实目录 `assets3d-local/tft-extras/`；输入联接只读。该目录由现有忽略规则覆盖。没有运行 Git 命令，没有联网或改动界面、服务器、规则目录。

法球及扣血共 17 个目标系统均有近似效果文档，`manifest.json` 与 `precache.json` 已通过 `merge-manifests` 生成；效果包可用不代表整个任务已完成，整体 `build-report.json.ready` 仍为 false。`action-bindings.json` 是独立的展示时序合同，预缓存只列运行时资源，不包含审计原始字段。

默认河灵 `little-legend-default` 已完成离线闭包、模型/骨骼/动作/贴图转换，GLB 已纳入合并 manifest 与 precache。`pet-closure-report.json` 确认全部已发现依赖可读取、没有缺块；详细来源和绑定只保存在本地报告。`merge-report.json.ready` 为 true；整体 `build-report.json.ready` 仍为 false，原因是效果中三个带顶点色网格未被转换器支持，并非河灵缺失。

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
| `player-damage-mis` / `player-damage-mis1` | Avatar 与简版弹道，择一 | travel / projectile |
| `player-damage-tar` | 命中主体 | impact / target |
| `player-damage-child` | 独立命中子效果 | impact / target |

彩球父包装引用的是 Idle，不应当把该包装当作已经提取的专用开球爆发。三档开球可作为另行明确选择的展示约定，但不能按名字自动替换专用系统。

四个静态父球的子引用由实际 Map BIN 的 ResourceResolver 解析；只保留静态锚点，父级旋转、音频与引擎标志未复刻。扣血命中的动态子发射不自动展开，不猜测次数、随机分布或生成时机。逐项转换结果与遗漏原因只保存在本地报告。

## 浏览器证据与近似限制

`review/` 含效果截图及河灵 idle、move、cast 三组 PNG，每组为斜视、俯视及多个播放采样；扣血弹道另有起终点参照与随时间移动的宿主。网格一格为一个棋盘格。`review/review-report.json` 记录加载错误与相对格数。

Chrome 实际截图中，`orb-gray` 及其 child 呈中性灰，`orb-blue` 及其 child 呈明显蓝青色，Gold 呈金黄；结合这几张截图与生成条目的系统对应关系，确认 Bronze → 灰，Silver → 蓝，而非仅按英文材质名推定。

当前灰球主体约占不足半格，蓝/金/专用球约半格量级；彩球图标更大，但仍在一格附近。三档开球主体约一格量级，扣血主体也保持局部效果；截图未见未贴图白方块、实心黑底矩形、异常竖片或铺屏。亮白闪光属于有纹理边缘的爆发，不能与缺贴图白块混同。

这些是近似效果：部分带顶点色网格、二级遮罩、未知字段、场集合和扭曲被现有转换器拒绝或跳过；并非原版完整复刻。灰球细节较少，开球部分颜色细节缺失，Crime 后段出现离散圆片。彩球持续待机已补验：初始、延长与长时采样的斜视/俯视截图均保留球芯，运行时仍有粒子且未结束，加载错误为空；仅代表本地有界持续播放验收，不代表无限运行或原引擎等价。报告保留失败与遗漏，不用空文档或临时白材质掩盖问题。通用粒子尺寸、坐标反射、混合/有效 alpha、网格尺度与平面方向均沿用现有近似管线及统一运行时比例。

## 验证

新入口、请求键、phase/anchor、静态子映射与效果包单独预缓存均有合成测试，不保存原素材 fixture。新测试、assets3d-neutrals 与 rendering3d 系列共 15 文件、275 测试通过。

本机默认 Vitest 配置打包器遇到访问权限错误，使用 `node --experimental-strip-types node_modules/vitest/vitest.mjs run --configLoader native --project fast --maxWorkers 2 tests/assets3d-tft-extras.test.ts tests/assets3d-neutrals.test.ts tests/rendering3d` 验证通过。浏览器关闭目录监听，避免遍历本地素材联接。

全仓 `npm.cmd run typecheck` 已运行，现有压缩测试缺少 `@gltf-transform/core`、`ktx-parse`、`sharp`，因此全仓检查未通过；保持原编译选项、仅排除该已有测试文件的 TypeScript 检查为零错误。未联网安装依赖，也未添加空声明绕过错误。

## 界面接线需求

- 小小英雄：读取 `manifest.models["little-legend-default"]` 并加载其 GLB，依照 animations 映射播放。建议与最近可部署格中心相距约一至两格，不占部署格。建议高度为英雄基准高度的二分之一；待机截图测得约为英雄的 0.51 倍，高约四分之三格、宽约一格，动作姿态会改变包围盒。按本地报告的 suggestedScale 缩放并贴板，不能把原始模型高度直接当显示高度。位置、朝向与动作由表现层控制，不能影响领域坐标或碰撞规则；表情通过原名剪辑显式触发，hurt 使用公共 hit 状态。
- 法球出现：依据 `lootRevealed` 与 `readLootView` 中已揭示的 `revealedOrbs` / `unclaimedOrbs` 创建，按 orbId 去重；使用投影已有位置与 tier，不能重跑随机、预测未揭示奖励或读取对手隐藏内容。父球与 child 二选一，不叠加重复。
- 法球开球：收到 `lootGranted` 或已确认的 `claimReceipts` 后，按唯一 receiptId / orbId 播放对应 `-open` 并移除待机；`lootForfeited` 仅移除，排队或容量不足不先播放成功开球。多条 drop 共用一球时须聚合到同一个 orbId，重连只还原当前待机，不重播历史开球。专用球需由明确公开来源选择，不能只凭奖励内容猜皮肤。彩球使用已验收的有界持续待机策略；宿主须在领取、移除或场景销毁时 dispose，超出本地报告播放上限需显式重建并复看，不宣称无限待机。
- 扣血：以 `roundSettled` 对应的权威 `roundResults` 中正的 hpLost 为依据；联机使用已有投影提供的相同结算证据，投影不暴露时应提数据需求。按 roundId 与受击席位去重，胜负和扣血量不在表现层重算。发射点为获胜方小小英雄/棋盘侧边锚点，终点为受击方小小英雄锚点；跨棋盘展示时把两个锚点投影到同一显示空间。
- 扣血时序：结算已确认后播放施法动作，弹道 travel 宿主沿起终点插值；飞行可占整个反馈段的约三分之二，抵达即停止 travel，随后在终点播放 impact。命中 child 若启用，只作为一次明确的近似附加，不复刻动态父子生成率。hp 与胜负以已收到状态为准，不等待特效、不二次扣血；重连不补播旧命中。
