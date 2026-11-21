# V26：3D 界面原版素材盘点与接入计划

盘点日期：2026-10-28。当前状态：**已完成全盘可读范围复查、分阶段下载规划器与离线提取器；本地提取 3 项（含 2 张卡图），当前阶段待执行端下载 97 块 / 1,659,846 字节。没有实施界面接入。**

**阅读顺序：第 7 节是本轮最新事实、脚本用法及交付边界，覆盖第 1–6 节上一轮的“不下载”“符号链接阻止输出”“主 UI 索引缺失”和“尚无脚本”等旧状态。第 3–6 节的视觉接入设计仍供后续参考。本任务的两步分工以用户最新批准为准：Codex 离线准备，执行端在沙盒外下载/补提取。**

## 1. 范围与工作区基线（上一轮历史记录）

- 本次是 Codex 的只读盘点及计划任务。仅新增本文档，没有修改任何既有已跟踪文件，没有修改 `src/`、测试、脚本、规则或数值，没有 Git 写操作。提交由执行端决定。
- 实际分支是 `claude/sol-t16`，HEAD 为 `8a9dda29b2df5d7de2c95f8ed17708f0c17dd8e2`（v25 integration 2 合并提交）；`git merge-base --is-ancestor 97068956 HEAD` 成功。本文行号以该 HEAD 为准，执行前须在最终 v25 HEAD 复核。
- 开始时仅有 `?? assets3d-local`。它是既存符号链接：`assets3d-local -> ../cat/assets3d-local`，真实目录是 `/home/aiapps/workspcae/cat/assets3d-local`。没有删除、改链、覆盖或写入它。
- 用户本次批准原版界面框、按钮、商店卡和字体仅本机使用，覆盖旧项目说明中相应的“不复制原图、字体”限制；素材、字体、原始数据、提取 manifest、预览图仍不得入库。
- 接入只针对联机多人 3D。单机仅保证不报错，不增加手机布局或专门测试。

## 2. 本机来源核查与提取结果（上一轮历史记录）

### 2.1 现有模型流水线的来源

| 环节 | 代码位置 | 实际行为 |
| --- | --- | --- |
| 来源配置 | `scripts/assets3d/local-config.mjs:5`、`:8` | 默认读本地 `unit-map.local.json`，允许 `ASSETS3D_UNIT_MAP`；缺配置报错，不用示例冒充真实素材。 |
| 离线索引计划 | `scripts/assets3d/plan-fetch.mjs:32` | 读 `trial/local/14.24.manifest`、缓存 `chunks/*.zst`、本地路径字典；`:46` 只规划 `TFTSet13.wad.client`、`TFTCommon.wad.client` 两个包。计划中的 downloadBytes 是估算，规划自身不下载。 |
| 可联网的独立步骤 | `scripts/assets3d/fetch-chunks.mjs:10`、`:139` | 原流水线有从官方 bundle CDN 按范围取块的下载器。本次没有调用它，没有下载或补缓存。已有字节的历史获取时间、完整下载收据未在本克隆恢复，不能声称全部来自完整安装目录。 |
| 离线解包 | `scripts/assets3d/extract-from-chunks.mjs:26`、`:73`、`:146` | RMAN 定位 WAD 范围，只读已有块，核验长度/块校验及源 SHA-256，输出 `extracted/` 和 `extraction.json`；缺块明确失败。 |
| 模型转换 | `scripts/assets3d/build.mjs:69`、`:80`、`:276` | 消费本地 extraction 记录，固定 source version `14.24.6442327`，输出 GLB/贴图/manifest/build report。`:278` 的 `fetchPlan` 调用离线 `planFetch`，并不是 fetch 网络请求。 |
| 合并可服务根 | `scripts/assets3d/build-asset-root.mjs:51`、`:110`、`:148` | 输入根只读；模型/特效路径合并、去冲突、记录来源，生成 `manifest.json`、`action-bindings.json`、`precache.json`、`merge-report.json`。**当前不会自动收集未来 UI sidecar。** |
| 打包 | `scripts/assets3d/pack-root.mjs:31`、`:39`、`:73` | 根据 precache 校验实际字节和 SHA-256，再产出 pack；不能只放一个 UI 文件夹就认为已入缓存/pack。 |

本机有 `assets3d-local/test-forge/` 的已生成模型根及 `ui-assets.json`（16 个英雄/羁绊/强化图标条目），有 `jayce-forge/` 的局部源和产物；这些不是本次所需的 HUD 框、按钮、字体或完整商店横版立绘。`trial/local/` 当前也没有模型默认构建所需的完整 `extracted/`、`extraction.json`、两个短索引和本地 unit map，因此不直接运行默认 build 来“顺带提取 UI”。

### 2.2 实际盘点证据

只扫描本地文件，未访问官方 CDN 或网页资源。扫描范围包括 `/home`、`/tmp`、`/mnt`、`/opt`，以及素材定向复查的 `/media`；跳过依赖/构建目录时，另行识别了下面的 Rust 测试 WAD。结论限于本环境可读范围，不代表用户另一台电脑没有客户端。

- RMAN：`assets3d-local/trial/local/14.24.manifest`，25,478,991 字节。
- RMAN SHA-256：`c080631bd377f60730d979b48807a49f86070517e85b7bafdc32c8666fee7a14`。
- 字典：`assets3d-local/trial/local/hashes/hashes.game.txt`，约 222 MiB。它含后续赛季条目，**字典命中不等于资源属于 14.24，也不等于已有原始字节**。
- 本地缓存：10,025 个文件。下表 cached 按每个 WAD 的 RMAN 块记录统计，共享块可重复计数，不是全局去重数量。

| RMAN 中的 WAD | 总字节 | 块记录数 / 已缓存 | 核查结果 |
| --- | ---: | ---: | --- |
| `DATA/FINAL/TFTCommon.wad.client` | 9,700,948 | 882 / 725 | WAD 索引可读，645 条；字典解析后 `assets/ux/`、字体、`data/menu/` 候选为 0。不是 HUD 源。 |
| `DATA/FINAL/TFTSet13.wad.client` | 69,242,840 | 5,664 / 5,604 | WAD 索引可读，4,857 条；同口径 UX 候选为 0。不能靠该包补 HUD。 |
| `DATA/FINAL/Maps/Shipping/Map22.wad.client` | 2,340,409,624 | 124,636 / 5,539 | 索引可读，82,615 条；全字典匹配 1,345 个 UX 候选（包括历代 splash），**可完整读取的为 0**。早期窄字典只匹配 1,175 条，最终以上述全字典口径为准。 |
| `DATA/FINAL/UI.wad.client` | 288,253,071 | 16,388 / 187 | 主 UI 包不完整，首块缺失，不能读取权威 WAD 索引，不能确认图集在此版本的 entry、压缩方式和字节。 |
| `DATA/FINAL/UI.zh_CN.wad.client` | 41,435 | 5 / 0 | 缺本地语言包；字体配置/语言选择需后续核实。 |
| `DATA/FINAL/UI.zh_TW.wad.client` | 43,857 | 5 / 0 | 同上。 |
| `DATA/FINAL/UI.en_US.wad.client` | 54,720 | 5 / 0 | 14.24 对应包无缓存。 |

主 UI 缺失的首块 ID 为 `7579A20F5DA96B92`（压缩 38,846 / 解压 50,535 字节）；简中为 `B436761783BD07CF`，繁中为 `D503D0744FB81676`。只补首块仍不能保证完整索引和 payload 齐全，执行端应优先从本机完整安装恢复对应 WAD，或恢复所有目标范围所需的已备份缓存，不执行下载。

扫描仅找到 `ltk_wad-0.5.10/tests/wads/` 下的 `Online.wad.client` 和 `UI.en_US.wad.client`（工作区 Rust registry 与 `/tmp/vfx4-converter/` 中各有副本）。前者 272 字节；后者 140,756 字节、6 entries，与本地 14.24 RMAN 对应的 54,720 字节包不符，无可靠 14.24 来源收据。它们是工具测试样本，**不作为游戏原版 UI 来源**。定向复查也未找到独立 HUD atlas、Spiegel/Beaufort 字体或中文 fontconfig 原件。

### 2.3 本次提取结果

| 项目 | 结果 |
| --- | --- |
| 计划目录 | `assets3d-local/ui/`（**未创建**） |
| 提取原始素材 / 转换图片 / 字体 | **0 / 0 / 0** |
| 新增本地 manifest | **0**；没有生成空清单冒充成功结果 |
| 缺失项 | 主 UI WAD 的权威索引与目标 payload；适用语言 fontconfig 及对应字体；Map22 中目标商店 splash 字节；图集 subregion/九宫格/状态映射证据 |
| 额外输出限制 | `.gitignore:8` 虽有 `assets3d-local/`，但本克隆该位置是跨克隆符号链接，`git check-ignore` 无法穿过链接验证子文件；`safeOutputPath('assets3d-local/ui', {directory:true})` 只读预检报 `unsafe-output-path`（`scripts/assets3d/safe-path.mjs:24`、`:39`）。真实目标又在本次可写工作区之外，因此不绕过安全检查写另一克隆。 |

**停止点：不下载、不重建客户端、不改 ignore、不替换符号链接。** 后续在拥有源文件且 `assets3d-local/` 为真实、已忽略可写目录的执行克隆继续。

## 3. 资源对应表：哪些已证实、哪些尚未证实

以下是从**本机路径字典**查出的真实候选路径和 64 位资源 hash，供执行端离线定位。它们不是已提取素材；除 Map22 中已读到的条目外，尚无 14.24 UI WAD 索引证明其包归属/存在性。主 UI 框、按钮、字体优先检查 `DATA/FINAL/UI.wad.client`；字体语言配置另查 `UI.zh_CN/zh_TW.wad.client`。这是待核实的包定位，不虚构为已验证归属。

同一 HUD atlas 包含多个元素。**本次不能给出金币、按钮等图块的精确 UV/子资源 ID**，下面用 atlas 级 hash 关联；拿到原件后必须读取关联 UI 定义或进行原图核对，记录裁剪区域和各状态来源，才能转为 ready。不能凭文件名猜矩形或借新赛季资源补齐。

| 代号 | 客户端候选路径 | 字典资源 hash | 用途/待核实信息 |
| --- | --- | --- | --- |
| H | `assets/ux/tft/tft_hud_texture_atlas.tex` | `27e89e84bd655e87` | HUD 框、通用按钮、金币、等级、经验、计时器、玩家列表等的候选图集。 |
| X | `assets/ux/tft/tft_hud_buyxp_icon_atlas.tex` | `7caaa13214199cca` | 购买经验按钮图标；状态/裁剪待定。 |
| T | `assets/ux/tft/tft_hud_stagetracker_atlas.tex` | `9f16b03ef34b59fd` | 回合节点、阶段装饰。 |
| B | `assets/ux/tft/tfthealthbaratlas.tex` | `48feab81bbd58efc` | 棋子血/蓝/护盾条、分隔/边框、星级候选。 |
| R | `assets/ux/tft/tft_traits_texture_atlas.tex` | `05b8a1b536440fa7` | 羁绊图标容器、层级背景；不代替已存在的羁绊图标。 |
| A | `assets/ux/tft/tft_augment_atlas_pc.tex` | `f94f2c1bfc11808f` | 强化卡框和装饰候选；S13 动态卡需同时检查下一项。 |
| A13 | `assets/ux/tft/mograph/sets/set13/augmentcard/set13_augmentcard_spine.atlas` | `b47207a599da7e8b` | S13 强化卡分区定义；依赖纹理/动画的具体引用尚未取得，不引入 Spine 引擎来扩大本批范围。 |
| F | `assets/ux/tft/tft_armory_atlas_pc.tex` | `688e69362ee51976` | 武器库/锻造器候选框和按钮。 |
| I | `assets/ux/tft/tft_unitinfo_texture_atlas.tex` | `0111ade31cf19ba4` | 棋子详情卡、属性图标、条形框。 |
| C | `assets/ux/tft/tft_combatstates_atlas.tex` | `46e4d751834bff44` | 战斗阶段状态标记。 |
| E | `assets/ux/tft/tft_elimination_texture_atlas.tex` | `e2e288f81154c368` | 淘汰/名次提示。 |
| W | `data/menu/textures/tft_winstreak_atlas.dds` | `b1e532019b16a1e5` | 连胜败图标；旧命名可能是别名/旧资源，须在 14.24 索引验证。 |
| P | `assets/ux/tft/hud/tft_scoreboard_localplayerframe.png` | `f1db6c1699550e44` | 玩家列表自己的头像框。 |
| Q | `assets/ux/tft/hud/unitshop/tft_emptyshop.png` | `7af8253c197283ff` | 空商店槽。 |
| S4 | `assets/ux/tft/hud/unitshop/tft_shopcard_rarity4_default.png` | `b41444d215bd5e25` | 四费卡 default；hover `976148d74dcfa2bf`、clicked `f86eb48724f07cbe`。 |
| S5 | `assets/ux/tft/hud/unitshop/tft_shopcard_rarity5_default.png` | `136cee6f5f68247d` | 五费卡 default；hover `df61380bdb3aebc8`、clicked `e069f0a03b491995`；一至三费优先 H，不能伪造同名文件。 |
| L | `assets/ux/tft/tft_unitshop_lockenabled_clicked.png` / `tft_unitshop_lockdisabled_clicked.png` | `4dd26f288af3d65f` / `0864d85a4d80bb6d` | 锁店点击态；其余状态查 H 和 UI 定义。 |
| CM | `assets/ux/tft/armory/tft_set13/crime/tft_crime_frame.png` | `88486d66cfb32ee0` | 炼金黑市框；持续微光按钮 default `1dd335810dd8ecbe`、hover `feffb0990b509ed9`、clicked `731c66c585ac9472`、disabled `fb0f87b77280a1ed`。 |
| G | `assets/ux/tft/armory/tft_set13/goop/frame.png` | `c3ad221746014d7d` | 异常突变选择框；按钮须关联本地 UI 定义核实。 |
| FB | `assets/ux/fonts/beaufortforlol-bold.otf` / `beaufortforlol-regular.otf` | `715dd36ce6f16bb0` / `50051dc7856a99f6` | 标题/数字候选；不能假定覆盖中文。 |
| FS | `assets/ux/fonts/spiegel-regular.otf` / `spiegel-semibold.otf` | `0e73af395498f65c` / `47e418469e53787b` | 正文候选。 |
| FZ | `data/menu/fontconfig_zh_cn.txt` / `fontconfig_zh_tw.txt` | `2d845c67a39bd6fe` / `8acb15870523f671` | 中文字体选择的依据。字典另有 `assets/ux/fonts/fzltch.ttf`、`fzxhyszk.ttf`、`notosanscjk-regular.ttf`，不在缺配置时擅定哪个才是原版。 |

资源 ID 在落地前必须与字典和权威 WAD 双向匹配。本文只提供定位，不向仓库写入原始图集或数据。

## 4. 3D 界面自制部分清单与逐项接入位置

3D 并不是独立的一套 HUD：`three-mode/placeholder-renderer.ts:325` 注入专属样式，但商店、玩家列表、计时器和大部分弹窗仍来自共享 DOM 与 `src/style.css`。因此必须盘点这些文件；不能仅替换 `src/rendering3d/` 就宣称界面已完成。

下表的“接入位置”为未来实施范围，本次均未修改。通常仅在 `three-mode/hud-style.ts` 或新建的 3D 专属皮肤模块覆盖外观；共享组件只提供必要的节点/数据钩子，不另算金币、经验、时间或排名。

| # | 自制部分及文件:行 | 对应原版候选 | 后续改哪个文件/如何接入 |
| --- | --- | --- | --- |
| 01 | 全局字体 `src/style.css:1`、按钮字体 `:11`；FPS monospace `:1287` | FB / FS / FZ | 新 `three-mode/ui-original-assets.ts` 加载 FontFace，`hud-style.ts` 仅对已挂载 3D 的 DOM/浮层指定字体；不改全局 2D 字体。中文先读配置验证字形。 |
| 02 | 商店底框/面板 `src/style.css:422`、`:972`、`:1198` | H，面板/边框区域待定 | `hud-style.ts` 按 manifest 的 image/nine-slice 覆盖；保留 shop dock 原位置和命令。 |
| 03 | 刷新、经验、出售按钮 `src/rendering/strategy-panel.ts:611`、`:640`；自画状态 `src/style.css:1004` | H / X | `hud-style.ts` 为现有 data-debug 按钮应用 normal/hover/pressed/disabled；`strategy-panel.ts` 仅在缺节点钩子时改 DOM 标记。文本、快捷键、费用来自现有组件。 |
| 04 | 锁店文字/emoji `strategy-panel.ts:642`；选中态 `src/style.css:1009` | L / H | 3D 专属样式替换装饰，保留 aria-pressed、generation 和回调；缺图保留原按钮。 |
| 05 | 商店卡费用框/底色/悬停/名条 `src/style.css:847`、`:973`、`:986` | H / S4 / S5，空槽 Q | `hud-style.ts` 针对 data-cost 和已有交互状态换皮；六费彩框 `src/style.css:1411` 必须另核 S13 原版，不能拿后续赛季 rarity6 当完成。 |
| 06 | 将方头像铺成横卡并加自画蒙版 `src/style.css:979`；卡内容 `strategy-panel.ts:1431` | `assets/ux/tft/championsplashes/` 下与 TFT13 单位对应的 PC 横版 splash（Map22）；逐英雄文件名/hash 尚未建立完整映射 | `strategy-panel.ts` 通过注入的 skin resolver 按 definitionId 取地址，不静态导入 3D 模块；manifest 逐英雄记录，不根据名字猜路径。无 splash 保留既有方头像/蒙版。 |
| 07 | 商店金币小圆 `src/style.css:861`、`:994`；金币 HUD `:1010`、`:1269` | H 的 coin / gold plate 区域 | `hud-style.ts` 用图集区域替换伪元素；数值继续由 `strategy-panel.ts:597` 读取 state.gold。 |
| 08 | 等级胶囊/经验条 `strategy-panel.ts:591`、`:599`；自画条 `src/style.css:182` | H / X 的 level、XP track/fill | `hud-style.ts` 换底框/填充纹理，只使用现有宽度；满级、disabled 行为不变。 |
| 09 | 人口文字 `strategy-panel.ts:600`；3D 大字 `src/style.css:1304` | FB/FZ、H 的人口标识候选 | 3D 样式/字体接入；容量继续读取公共显示结果，不把原版图上的数字烘焙成游戏数值。 |
| 10 | 倒计时胶囊/数字 `src/style.css:404`、`:409`；自画进度线 `:1284`；DOM `online/players-sidebar.ts:46` | H / C / FB/FZ | `hud-style.ts` 更换框、阶段图和进度填充；`players-sidebar.ts` 的服务端 deadline/clockOffset 继续唯一驱动，不添加第二个倒计时。 |
| 11 | 阶段 SVG 图标 `online/stage-track.ts:20`、`:82`；节点 CSS `src/style.css:411` | T；阶段标记 C | `stage-track.ts` 只提供原有 data-icon/data-state；通过注入的资源映射或 CSS 隐藏旧装饰再换图片，不从 3D import StageTrack。 |
| 12 | 连胜败火焰 SVG/利息胶囊 `src/style.css:1312`；`online/economy-hint.ts:40` | W / H | `hud-style.ts` 换 win/loss/none 图片；计数及收入预览沿用已有私有 seat 数据。 |
| 13 | 玩家头像外圈、血量数字框 `src/style.css:1209`、`:1225`；列表 DOM `online/players-sidebar.ts:110`、`:125` | P / H | `hud-style.ts` 覆盖 me/opponent/viewing/dead 状态；玩家自身头像内容并非原版小小英雄，本批只改框，不改身份语义。 |
| 14 | 玩家血条/损血拖尾 `players-sidebar.ts:118`、`src/style.css:881` | H / B 的玩家 HUD 区域（需核实是否与单位条分开） | 保持现有条宽/血量和掉血提示。**当前 3D 在 `src/style.css:1219` 隐藏 seat-bar**，不因找到素材擅自显示它或改列表信息层级。 |
| 15 | 玩家/统计页签 `src/style.css:1324`；统计底框/条形 `online/battle-summary.ts:37` | H，统计相关区域未定位 | `hud-style.ts` 换容器和页签装饰；统计仍用已有 BattleRanking，不重新聚合规则。 |
| 16 | 羁绊阶级框、计数框、折叠“+N” `src/style.css:1252`、`:1295`；`rendering/trait-column.ts` | R / H | `hud-style.ts` 读取已有 trait 状态钩子，换框和装饰；现有官方图标继续使用，不重复下载。 |
| 17 | 左侧装备空槽重复渐变 `three-mode/hud-style.ts:24`；物品边框 `src/style.css:442` | H；`assets/ux/tft/hud/itemtracker/tft_itemframe_{active,hover,inactive,pressed,selected}.png` | `hud-style.ts` 按槽位/状态换皮，保留拖放及 tooltip；这些文件也只有字典证据，未提取。 |
| 18 | 强化卡框、棱彩边框、重选按钮/⟳ `three-mode/hud-style.ts:32`、`:40`、`:49` | A / A13；按钮候选 `assets/ux/tft/tft_button_augment_{default,hover,clicked}.png` | `hud-style.ts` 按既有 data-augment-tier 和 disabled 换皮。先做有证据的静态卡面；动态 Spine 播放另评估，不因换图增加引擎依赖。 |
| 19 | 武器库/锻造器/通用三选卡 `src/style.css:41`、`:274`、`:1360`；黑市金币自画 `:1430` | F / CM / G / H | `hud-style.ts` 以 data-choice-source 区分；原版无对应的自定义选项保留文字与通用框。倒计时、跳过和领奖继续现有回调。 |
| 20 | 物品/通用 tooltip 框 `src/style.css:303`、`:804`；`presentation/hover-card.ts` | I / H；补查本地 `data/menu/textures/tooltip_atlas.dds` 别名 | `hud-style.ts` 只对 3D 激活状态的共享浮层换皮；悬停/关闭/长按及文字加载保持原链路。 |
| 21 | 棋子详情卡、属性血蓝条和装备槽 `presentation/unit-panel-style.ts:2`、`:9`、`:13` | I / B / FZ | 优先 `hud-style.ts` 外部覆盖，必要时 `unit-panel-style.ts` 加纯样式钩子；不得从 3D import unit-panel 实现，否则会引回 UI chunk。 |
| 22 | 棋子头顶 HP/护盾/蓝条 `three-mode/unit-overhead.ts:41`、`:78`；物品 stack/通缉字牌 `:60`、`:100` | B，文字 FB/FS/FZ；通缉原版图尚未定位 | `unit-overhead.ts` 用已加载图集画底框/填充/分段，字形等待字体；数据沿用 BoardMeters/items，保留当前 shield、300-HP 刻度及渲染顺序，不改数值。 |
| 23 | 星级由 ShapeGeometry 绘制 `rendering3d/star-mark.ts:34` | B / H 星级区域待核 | `star-mark.ts` 接收可选纹理/工厂参数，保留现有几何兜底与 billboard、dispose；不在核心模块加载 DOM/2D 资源。 |
| 24 | 选秀头顶倒计时圆盘/文字 `three-mode/carousel-stage.ts:418` | H / FB/FZ；专用圆盘区域待核 | `carousel-stage.ts` 使用同一 ui/font context 绘制，保留现有 text 与时机；本批只换图和字，不改选秀锁定或时间。 |
| 25 | 羁绊道具计数字牌 `three-mode/trait-props.ts:99`、`:118` | H / FB/FZ，具体字牌未定位 | `trait-props.ts` 仅注入纹理与字体，沿用已提供的计数；不碰道具模型或玩法。 |
| 26 | 小小英雄选择弹窗/卡框 `three-mode/legend-picker.ts:26` | H 通用框/按钮；本项目选择器没有已证实一一对应原版界面 | 由 `legend-picker.ts` 消费可选 skin context，模型缩略预览保留。不得捏造一个“原版 picker”资源 ID。 |
| 27 | 底部侦察小地图与棋盘点 `online/scout-minimap.ts:23`、`:28`；`src/style.css:1383` | H 的 minimap 容器候选；单位点是公共棋盘数据显示，不存在已证实静态原图 | `hud-style.ts` 换外框，保留 publicBoard 点位和点击回调；不把整块动态地图替成静态图。 |
| 28 | 战斗浮动提示、开场牌、淘汰/排名卡 `three-mode/placeholder-renderer.ts:442`、`src/style.css:951`、`rendering/opening-encounter-hud.ts`、`online/ranking.ts:13` | C / E / H；开场 encounter 专用资源待核 | 3D 专属样式/资源映射换框和字体；服务器结果及项目特有异常结束文案继续保留。 |
| 29 | 切换 2D 按钮、加载条、FPS/调试提示 `three-mode/three-loader.ts:51`、`:64`；`src/style.css:940`、`:1287` | H 通用按钮/进度框、FS；这些功能无原版专用图 | `hud-style.ts` 换通用皮肤，不让 three-loader 静态 import 原版清单/字体加载器。 |
| 30 | 帮助、展开策略、全屏、音效开关及联机匹配/断线提示 `src/style.css:226`、`:342`、`:892`；`online/lobby.ts` | H 通用控件/框；无本项目语义的专用原版资源 | 3D 皮肤上下文只装饰现有 DOM，保留匹配按钮流程，不增加原版账号/房间功能。匹配页没有挂载 3D 层时仍保持现状。 |

`skill-feel.ts`、`unit-control.ts` 等还有程序绘制的战斗光晕/粒子；`tabletop.ts`、`placeholder-renderer.ts` 还有格子、拖放圈、占位棋子。它们是世界场景/战斗表现，不是本批 HUD 框、按钮、商店卡或字体，另列边界，不计为这批已替换 UI。`hud-style.ts:8` 的梅尔金色屏幕反馈也属于战斗特效，除字体/通用提示框外不借本批改动作或时长。

## 5. 后续实施方案（尚未执行）

### 5.1 先恢复本地输入，再输出独立 UI 根

执行端先向用户确认本机 14.24 客户端或离线备份的位置，恢复主 UI WAD、使用语言的 UI 包和目标 Map22 splash；核对 RMAN 版本/来源收据。若只有新版本，不自动用它替代 14.24。

目标目录建议如下，全部忽略、不提交：

```text
assets3d-local/ui/
  raw/                  # 经 WAD 索引证明的原始资源，保留来源路径
  textures/             # 无损 PNG 或保留原生 PNG，按资源 hash 去重
  fonts/                # 本机原版字体；保留格式，先不子集化
  manifest.json         # 独立 UI 运行时清单，不冒充模型 manifest
  extraction.json       # 来源版本、WAD、entry hash、源/输出大小与 SHA-256
  build-report.json     # ready、缺失/不支持原因、输出字节、人工核图结果
```

后续 Codex 在 `scripts/assets3d/` 新增离线 UI 规划/提取器，复用 `readRman`、`readWadIndex`、`extractWadEntry`、`verifyChunk`、`decodeTexture/encodePng` 和安全路径工具；本批不新增这些脚本。输入完整 WAD 或已有块缓存均可，禁止隐式 fetch、redirect、缺块补下载。只提取允许列表，不把整个客户端倒入输出。

对原 PNG 保持字节；对 TEX/DDS 无损解码为 PNG，记录原尺寸、alpha 和转换格式。未支持的压缩/色彩格式记 `unsupported-format`，不生成相似图片。九宫格/rect/各交互态必须有源定义或原图核验记录；同 atlas 尽量共用纹理，不为每个控件复制整图。

UI sidecar schema 建议为 `{schemaVersion:1, sourceVersion, textures, sprites, fonts, unavailable}`：

- `textures[id] = {path, width, height, bytes, sha256}`，path 只允许根内相对路径。
- `sprites[id] = {texture, rect:[x,y,w,h], slice?:[top,right,bottom,left], states?:{normal,hover,pressed,disabled,selected}}`；仅放已确认区域，不用 0 填未知坐标。
- `fonts[id] = {path, family, weight, style, locale, bytes, sha256}`；中文来源由 FZ 确认，英文文件不声称覆盖汉字。
- `unavailable[] = {id, reason, requestedSource?}`，建议原因 `source-missing`、`wad-index-missing`、`chunk-missing`、`version-unverified`、`region-unverified`、`unsupported-format`。它们仅是后续提案，不是当前已有导出/枚举。
- 详细来源路径、entry hash 和源 SHA-256 放本地 extraction/build report；运行时仅消费显示所需映射。断言用合成测试数据，不提交真实切图、字体、atlas 坐标摘录或客户端数据夹具。

### 5.2 复用资源根与缓存，不能假设现成 merger 支持 UI

沿用 `src/rendering/render-mode.ts:17` 的 `?assets3d=<url>` 优先、`VITE_ASSETS3D_BASE` 次之机制，由 HTTP 服务提供本地根；不向浏览器传绝对文件系统路径。根为空时不请求原版素材。

建议最终可服务根保留现有模型 `manifest.json`，额外提供 `ui/manifest.json` 和它引用的 `ui/textures/`、`ui/fonts/`。不把 UI 条目塞进 models/effects：`src/rendering3d/contracts.ts:114` 和当前 merger 的资源遍历并没有 UI 合同。

后续需在 `scripts/assets3d/build-asset-root.mjs` 加显式可选 UI 输入（例如 `--ui-root`，**目前尚不存在该参数**），或在合并后用独立发布步骤把 UI sidecar 纳入同一个 staging root；推荐前者，并验证 UI 与模型输出互不覆盖。同步加入 precache 的 bytes/SHA-256/version，pack 阶段由现有 `pack-root.mjs` 消费，不手改已发布的模型根、precache 或 pack 内容。当前 `packGroup` 会把 `ui/textures/` 归入 effects；若要独立 UI pack，需后续明确扩展分组与契约测试，不能默认为已支持。

3D 内新建 `ui-original-assets.ts`，通过同根 URL 加载 UI sidecar，复用 `AssetPreloader.read` 的缓存字节，派生 Three Texture、DOM blob URL、FontFace。`asset-reader.ts` 本身没有 DOM image/FontFace 公共接口，必要时新模块直接接受 readBlob 回调，不能误称 `readTexture` 已能服务 DOM/CSS。

`placeholder-renderer.ts:332` 的 openModels 只负责模型；UI 初始化作为可选独立结果，不让缺 UI 变成模型加载失败。`hud-style.ts` 管理应用与撤销。卸载 3D 时撤销样式变量/状态属性、释放 Three 纹理、blob URL 和 font ownership；异步旧请求不能在 dispose 后重新安装皮肤。复用字体须引用计数，不能卸载仍在使用的 FontFace。

### 5.3 必须保住分包隔离

- `vite.config.ts` 的 manualChunks 会把 three-mode（除 loader/contract）、rendering3d、Three 收进 render3d；**不能从该 chunk 静态导入共享 2D UI、presentation 数据或运行时代码**。即使只 import 一个 helper，也可能把共享模块吸进 render3d，再令 2D 入口静态依赖整个 Three。
- 遵循 `placeholder-renderer.ts:148`、`three-loader.ts:95` 现有模式：2D 壳持有共享 HUD 的 DOM/回调，3D 收到注入接口。共享文件的 `BoardFeed`、显示类型仅 `import type`。新 3D 皮肤代码只依赖本目录/独立 rendering3d/平台 API。
- 共享 `strategy-panel.ts` 若需原版 splash，用由壳注入的 `getShopArt(definitionId)` 或等价 provider；不要在那里 import `three-mode/ui-original-assets`，也不要让 3D 去 import StrategyPanel、PlayersSidebar、theme、s13-assets、unit-panel 或 stage-track。注入方案须兼顾后续 render 时的资源 ready 通知，不能复制一套商店渲染逻辑。
- 原版素材和长映射不得写入 `src`、`public/assets` 或以 `?url` 静态导入；新 3D 样式不加到全局 `style.css`，放动态加载的 `hud-style.ts`。仅当共享 DOM 缺钩子时由 Claude 最小修改共享组件。
- `tests/rendering3d-isolation.test.ts:103` 检查 3D 不 import 2D/UI chunks，`:107` 按输出路径统计 2D gzip，`:109` 使用 **严格 `< 637_144`**。不改断言、超时、manualChunks 边界或预算来通过。

### 5.4 缺素材的兜底

按元素 ready，而不是全有/全无切换。保留每一项现有 CSS/canvas/几何底层：仅在图片解码和区域校验成功后安装对应覆盖。文件缺失、HTTP/CORS/解码失败、manifest/schema 不符、字体缺字、状态不全时，保留该元素的当前样式与文字，记录可诊断原因；不要空白按钮、透明卡框或失去点击区域。

字体未 ready 前继续 system-ui/sans-serif；canvas 字牌在 FontFace ready 后允许按当前显示数据重绘，不延迟对局开始。不要删除可访问文字、焦点框、aria-label、disabled/selected 语义。原版无专用元素的项目功能使用已验证的通用皮肤，无法验证时明确保留自制兜底，不宣称已达成“全部原版”。

## 6. 体积、实施批次与验收

### 6.1 当前测量

真实生产配置、`configLoader:'runner'`、`build.write:false`，Node 22.23.4，gzip level 9；没有写 dist。数值为本次 HEAD 基线，不代表未来接入后的结果。

| 范围 | JS 原始字节 | gzip-9 字节 |
| --- | ---: | ---: |
| 2D 顶层 JS 合计（index + phaser，沿用测试统计口径） | 1,769,457 | **634,708** |
| 动态 3D JS | 1,069,422 | **318,818** |

2D 与门槛相差 2,436 字节，但测试是严格小于，所以到最大允许值 637,143 仅剩 2,435 字节。不要把余量当作可以在入口内嵌映射/字体的额度。本次代码变化为 0，2D/3D JS 增量均为 **0**。

未来 JS 只增加 3D 内的清单解析、样式与资源生命周期代码；准确增量需实现后重新测，不能在没有代码时报一个“已验证增量”。原版图片/字体作为外部根 payload，不计 JS gzip，**但会增加 3D 首次网络下载、IndexedDB、解码和 GPU/字体内存**，必须另报。

本次可用目标素材为 0，因此不能给出真实纹理/字体总大小或压缩率。后续 build report 必须按去重文件实测：纹理压缩字节、字体字节、manifest/precache/pack 元数据字节，纹理解码约 `Σ(width×height×4)`（有 mipmap 另计）及实际字体载入内存。PNG 不默认开 mipmap，中文整字体可能成为主要下载量；子集化需另评估字符覆盖，不能用缺字换体积达标。资源需按可见 UI/交互阶段读取，不能为了样式阻塞模型和开局；precache 是否完整预下载须在实现时明确测量，沿用已有模型策略也要报告新增等待。

### 6.2 批次与责任

1. **输入恢复与精确映射**（执行端确认本机源位置，Codex 离线提取）：先恢复真实忽略目录和目标 WAD；核实 H/X/T/B/字体配置，输出源与区域证据。缺任何资源继续保留兜底，不下载。
2. **资源合同/生命周期**（Codex：scripts/assets3d、独立 rendering3d 合同与合成测试；Claude：three-mode 接线）：完成 UI sidecar、merger/precache、可选解析和销毁，不碰规则/服务器。
3. **商店与基础 HUD**（Claude）：按清单 01–17 替换字体、框、按钮和商店立绘；没有完整 PC splash 映射时保留原图。
4. **弹窗与世界字牌**（Claude 接线；Codex 可选纹理的独立星级模块）：按 18–30 分批换皮；不改动作、数值、选秀或结算时机。
5. **验收**：交叉检查“测试过了吗、越界了吗、改玩法了吗”，由执行端提交代码 PR；真实素材始终不进入 diff/提交。

每个实现批次至少覆盖：无资源根、缺 sidecar、单项缺图、完整本机根、字体失败、切回 2D、重复挂卸和已有多人商店/选择操作。补针对 URL/非法 rect/状态/缓存版本与 dispose 的合成测试，不加入真实样本；沿用必要原有回归。浏览器验证只用已提供 codex-browser 连接，缺环境变量时由执行端通过该入口新开任务，不自行 launch Chromium。

### 6.3 本次验证与交付边界

- 已运行：`export PATH=$HOME/.local/bin:$PATH` 后 `node node_modules/vitest/vitest.mjs run tests/rendering3d-isolation.test.ts --configLoader runner --maxWorkers=3`，**1 文件 / 1 测试通过**（16.55 秒）。没有修改测试和门槛。
- 已做：离线解析本地 RMAN、3 个可读 WAD 索引、全字典匹配、目标缓存范围完整性检查、输出路径只读预检、生产 write:false 的 gzip 测量。
- 没有运行界面浏览器测试/完整对局；只有文档新增，没有视觉实现可验。没有运行纪元 --write、修改 fixtures/evidence 或构建部署。
- 临时盘点结果位于 `/tmp/v26-wads.json`、`/tmp/v26-cached-indexes.json`、`/tmp/v26-ui-index.json`、`/tmp/v26-ui-dictionary.txt`、`/tmp/v26-bundle-baseline.json`，仅供本会话复核，可能随环境清理；不是需提交的素材清单。重现方法是读本地 RMAN 和完整路径字典，按 WAD hash 查找，再确认条目每一覆盖块存在且可校验。
- 最终需交执行端询问用户：**14.24 主 UI WAD、使用语言的 UI 包及 Map22 离线文件/备份在本机哪里？** 建议提供本地路径并在真实忽略目录克隆执行；若没有，停在准备阶段，当前自制界面继续兜底。无需为本次文档再确认玩法或数值。


## 7. T16 续：本轮交付与执行端操作（2026-10-28）

### 7.1 工作区核对与本地复查

- 开工 `git status --short` 只有 `?? docs/V26_3D_UI_ORIGINAL_ASSETS_PLAN.md`；`git diff`、`git diff --stat` 均为空。分支仍是 `claude/sol-t16`，HEAD `8a9dda29`，未切分支，未做 Git 写操作。
- `assets3d-local/` 已由执行端改为真实目录；`git check-ignore assets3d-local/ui-cache/test` 命中，输出预检通过。本轮没有修改 `.gitignore`。
- `ui-source.mjs` 从 `/` 遍历可读目录，跟随目录链接并按 realpath 去重；只排除 `/proc`、`/sys`、`/dev`、`/run` 和 Git 元数据。包括 `/home/aiapps/workspace/` 的旧调研目录、全部克隆的素材根、`/tmp`、其他挂载点和系统目录。无法读取的位置与断链逐条记录，不能断言这些不可读目录没有素材。扫描只读取候选素材/清单，不读取凭据内容。
- 本次发现 6 个 `14.24.manifest` 文件、10,189 个不同压缩块 ID；使用的 RMAN SHA-256 仍为 `c080631bd377f60730d979b48807a49f86070517e85b7bafdc32c8666fee7a14`。未用大小相同的新版本文件冒充。
- **更正上一轮结论：** `/home/aiapps/workspcae/cat-abilityicon/assets3d-local/trial/local/chunks/` 保存了主 UI 头、完整索引和商店数据相关块。对全盘候选逐块验证后，主 UI 的 9,180 条权威索引可读；旧结论只检查了主素材缓存，漏掉此克隆。Map22 的 82,615 条索引仍可读。本轮复用了这些本地字节，没有重新下载。
- 四个工具测试 WAD 仍在 Rust registry 和 `/tmp/vfx4-converter/`；未将其作为 14.24 UI 来源。旧调研 HTML/PDF、系统 Noto 字体和 RST 工具样本也不是待提取的原版纹理/字体。

完整的逐目标本地有无、可用块路径、缺块 ID 见本地 [LOCAL_FINDINGS.md](../assets3d-local/ui-plan/LOCAL_FINDINGS.md)；扫描范围、权限失败和全部块候选路径见 [local-inventory.json](../assets3d-local/ui-plan/local-inventory.json)。它们均在 gitignore 内，不提交。

| 类别 | 本地核验结果 | 来源/输出 |
| --- | --- | --- |
| 主 UI 头/索引 | 已有且通过块校验；无需下载 | `cat-abilityicon/assets3d-local/trial/local/chunks/`；计划记录每个实际路径 |
| S13 商店数据 | 已完整提取 | `ui/raw/UI.wad.client/data/tftteamplanner/characters.bin` |
| 商店 PC 卡图 | 63 个项目商店英雄已建立精确映射；金克丝、蔚完整本地已有，其余 61 项缺块 | 原始 `TFTCharacterRecord.mShopData.PcSplashPath`，定义 ID 复用仓库现有映射；不是根据角色名拼接路径 |
| HUD / 经验 / 阶段 / 血条 / 羁绊 / 强化 / 武器库 / 详情 / 战斗 / 淘汰图集 | 10 个原始图集已由固定版本 WAD 证明存在，payload 仍缺块 | HUD 实际为 `tft_hud_texture_atlas.tft_set12.tex`，虽带 set12 后缀，确实属于此 14.24 WAD；未用后续赛季替代 |
| S13 强化卡 atlas 定义 | 权威条目存在，尚缺 payload | 取回后再按源定义规划关联纹理；不猜页名/区域 |
| 英文字体 | Beaufort bold/regular、Spiegel regular 在固定 WAD 中存在，仍缺块 | 不声称覆盖中文；semibold 尚未证实存在 |
| 简中语言包 | 当前缺头块 | 先取 `B436761783BD07CF`，再按头里的 count 精确规划索引和 fontconfig；不下载整语言包或其他语言 |
| 独立按钮/卡框等剩余候选 | 25 个目标尚未证实属于三个选定 WAD | 当前记 `index-pending`；读完语言包仍未命中时改为 `not-in-selected-wads`，不生成替代品 |

商店映射仅取 `SHOP_CATALOG` 的 63 项，结合既有 `S13_ASSETS`、`G23_HERO_IDS`、`CHAMPION_PORTRAIT_KEYS`；排除客户端仍残留的非商店单位。图片地址和字节不写入 `src/`。源字段名以本机 `hashes.binfields.txt` 核对，包含 `mShopData`、`BaseCost`、`PcSplashPath`。

### 7.2 当前阶段需下载清单

完整的 **97 个块 ID、bundle ID、准确 Range、压缩字节及每个条目归属**已生成至 [DOWNLOADS.md](../assets3d-local/ui-plan/DOWNLOADS.md) 和机器可执行 [fetch-plan.json](../assets3d-local/ui-plan/fetch-plan.json)。下面是去重汇总，属于当前阶段，未读定义的后续依赖不虚构估算。

| WAD / 当前用途 | 缺块数 | 压缩字节 |
| --- | ---: | ---: |
| `DATA/FINAL/UI.wad.client`：目标图集、3 字体、atlas 定义、61 张 PC 卡图 | 96 | 1,659,475 |
| `DATA/FINAL/UI.zh_CN.wad.client`：头块 | 1 | 371 |
| `DATA/FINAL/Maps/Shipping/Map22.wad.client` | 0 | 0 |
| **全局去重合计** | **97** | **1,659,846** |

Map22 虽有对应索引，但此次目标卡图也在主 UI 中存在，主 UI 已提供权威路径，因此本阶段没有理由补 Map22 的整包或其他卡图。当前合计块 198 个，其中 101 个本地已有。`downloadBytes` 是清单选定压缩块的准确合计；HTTP 失败和重试的实际流量另由下载报告记录，并仍受原下载器 125,829,120 字节默认上限约束，没有提高上限、超时或重试次数。

规划器每次只增加已经能由本地字节证明的范围：缺头先规划头，有头再规划完整索引，有索引再选择允许的条目；读取 fontconfig、Spine atlas 定义后再加入其明确引用的字体/页图。只在固定版本索引中存在的路径/格式别名才可解析；有歧义的源引用标记失败，不能用相似图补足。

### 7.3 两个入口脚本的用法

新增入口 `scripts/assets3d/ui-fetch-plan.mjs`，共享离线读取模块 `ui-source.mjs`。默认离线扫描和写计划；`--dry-run` 只输出计划，不写文件、不联网；**只有 `--fetch` 下载**，且只消费已经落盘的冻结清单。正式下载前再次扫描本地并核验块，后补到其他克隆的字节也会跳过。

```bash
export PATH=$HOME/.local/bin:$PATH
# 离线输出计划；默认全盘可读范围，默认仅简中 zh_CN
node scripts/assets3d/ui-fetch-plan.mjs --dry-run
# 离线保存计划、逐项本地查找报告和下载表
node scripts/assets3d/ui-fetch-plan.mjs
# 执行端预检冻结清单：依然不联网、不写下载缓存
node scripts/assets3d/ui-fetch-plan.mjs --fetch --dry-run
# 以下一条由执行端在沙盒外运行；只下载清单内仍然缺少的块
node scripts/assets3d/ui-fetch-plan.mjs --fetch
# 取回本阶段后离线重新规划。若仍缺块，再由执行端执行上一条。
node scripts/assets3d/ui-fetch-plan.mjs
# 离线提取当前清单中本地可用的条目
node scripts/assets3d/ui-extract.mjs
```

下载只到 `assets3d-local/ui-cache/chunks/`，报告在 `ui-cache/fetch-report.json` 和含本地复用记录的 `ui-cache/ui-fetch-report.json`。复用现有 `fetchChunks/selectChunks`：固定官方 HTTPS 主机、RMAN 中的 bundle 范围、禁止重定向、验证 206 和 Content-Range、校验块 ID、原子落盘；只合并相邻选中块，不下载空隙。

可选参数：`--locale zh_CN|zh_TW|en_US`、`--manifest <本地RMAN>`、`--dictionary <本地完整字典>`、重复的 `--scan-root <范围>`；窄化 scan-root 会缩小“先查本地”的证据范围，正式执行推荐保持默认全盘。计划器 `--out` 改计划目录，下载模式 `--out` 改本地缓存目录，仍受 `assets3d-local/` 安全边界约束；提取器 `--plan <JSON>`、`--out <UI输出目录>`、`--reportOut <报告目录>`。换语言必须重新生成计划，不能沿用旧 locale 清单。

新增离线入口 `scripts/assets3d/ui-extract.mjs`：没有网络入口；重新核对 RMAN SHA、权威 WAD entry 和字典路径，再只提取清单允许的条目。支持已有压缩块、官方 bundle 本地缓存的精确范围和经 RMAN 块 ID 验证的完整 WAD；原 PNG 保持字节，TEX/DDS 复用现有解码器转 PNG；未知格式保留 raw 并明确报告。字体保留格式，字形/语言覆盖不作猜测。输出边界、符号链接和既有文件 hash 不符时失败。

提取器退出码 `0` 为完整成功、`2` 为缺块/待核验的部分结果、`1` 为输入/校验错误。当前实际运行退出 `2` 是预期部分结果；它已写出真实可用来源，未伪装成全部就绪。完全没有可提取来源时只写 `ui-plan/extract-report.json`，不生成空 runtime manifest。

### 7.4 本轮实际提取、验证与剩余工作

- 已生成 `assets3d-local/ui/raw/`、`textures/`、`manifest.json`、`extraction.json`；实际提取 **3 项 / 1,091,408 原始字节**，其中两张 PNG 去重总计 **60,179 字节**，字体 **0**。manifest 的 `shopArt.jinx`、`shopArt.vi` 已对应原始 PC 引用及纹理；`sprites` 保持空，未编造图集区域。
- 没有正式网络请求和下载。冻结清单真实 `--fetch --dry-run` 输出：97 缺块、1,659,846 字节、101 本地复用、`requests=0`、`downloadBytes=0`。
- 合成测试覆盖分阶段头/索引规划、固定 WAD 格式/赛季后缀、错误块回退到另一克隆、完整 WAD / bundle 范围校验、下载前复查、仅下载冻结范围、dry-run 零写入/零网络、篡改范围/entry、纹理解码与来源收据、重复提取、空来源不产假清单、路径链接逃逸和源引用解析。真实客户端字节未放入测试夹具。
- 相关测试（包含现有 fetch/extract/WAD/RMAN/texture 和分包隔离）**7 文件 / 79 测试通过**。命令：`node node_modules/vitest/vitest.mjs run tests/assets3d-ui.test.ts tests/assets3d-fetch.test.ts tests/assets3d-extract.test.ts tests/assets3d-wad.test.ts tests/assets3d-rman.test.ts tests/assets3d-texture.test.ts tests/rendering3d-isolation.test.ts --configLoader runner --maxWorkers=3`。`npm run typecheck` 通过。没有改任何断言、超时、预算或规则；没有运行纪元 `--write`，没有改 `docs/evidence/` 或录制夹具。
- **修改的 src 文件：0。** 新增的三个 `.mjs` 与一个合成测试、更新本文档；素材、原始数据和提取 manifest 均只在已忽略目录。没有提交和部署。
- **剩余是执行端步骤：** 在沙盒外按冻结清单下载，再按阶段重新规划/提取。中文字体具体映射与 glyph 覆盖、atlas 精确区域/九宫格/交互态仍须拿到源定义/原图后核验；不是缺少用户授权，也不再要求用户先找客户端路径。界面接线仍由 Claude 按第 4–6 节负责，本任务没有扩大到视觉改动。
