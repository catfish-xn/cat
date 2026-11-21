# v26 海克斯图标与位置核查

工作树：`claude/v26-augment-icons-layout`，HEAD `901d63d0`。没有提交、上传或执行素材下载脚本，没有修改 simulation/server。原工作区只有 `assets3d-local` 软链，指向同级 `cat-cx-uiassets/assets3d-local`。

## 原版位置依据

| 证据 | 能证明的内容 | 可信度与限制 |
| --- | --- | --- |
| [S13 原始商店画面](https://cdn.gametoc.co.kr/news/photo/202411/86395_261583_2511.png)，[原文](https://www.gametoc.co.kr/news/articleView.html?idxno=86395)，本机 `game-flow-ui-research-2026-10-23/screenshots/s13-gametoc-shop-original.png` | 1280×715；图标横排在棋盘左侧海克斯装置上方，与左侧装备/羁绊栏分离。三图标大约占 x305–375、y163–185；中心约为视口 (26.6%,24.3%)。 | S13 实机画面，位置关系可信；2024-11-21 发布，早于14.24，不能称为14.24实拍。像素范围为人工读图近似值。 |
| [S13 玩家原始画面](https://files.peakd.com/file/peakd-hive/dangab/23uExGCULJdPvm1aFt7QE6zz3pU9UfewfD3fiFWHaLrk6tySFtV5M5NcTg1fNst1j7dcP.png)，[作者页面](https://peakd.com/hive-140217/@dangab/teamfight-tactics-set-13-renata-glasc-top-1-closer-and-closer-to-diamond-rank) | 1264×699；三图标约 x289–389、y147–180，中心约 (26.8%,23.4%)；悬停后旁边展开含图标和名称的纵向列表。 | 玩家自行发布的 S13 画面；补丁、HUD 缩放值和拍摄时间未确认。不能把这张图当作精确14.24证据。实际下载文件在 `artifacts/augicons-v26/s13-owned-augment-tooltip.png`。 |
| [14.24 控制器](https://raw.communitydragon.org/14.24/game/gameplay.tftaugmentinfo.bin.json)、[桌面布局](https://raw.communitydragon.org/14.24/game/clientstates/gameplay/ux/tft/tftaugmentinfo/uibase.cdtb.bin.json)、[图集映射](https://raw.communitydragon.org/14.24/game/clientstates/gameplay/ux/tft/tftaugmentinfo.cdtb.json) | 控制器绑定三个强化槽和一个自定义信息槽；桌面详情列表原始参考分辨率1600×1200，强化图标60×60，三行 y181/262/343。 | 14.24 归档客户端数据，槽位、详情列表尺寸可信；这是详情弹层，不是棋盘悬浮横排，不能拿60px当横排尺寸或把其坐标当屏幕固定坐标。已下载 JSON 和二进制，文件 SHA-256 见 `artifacts/augicons-v26/evidence.json`。 |
| 既有离线参考 `tft-ui-conversation-2026-10-23/offline/index.html` | 提供官方 CDN 图标、来源收据和参考画面。 | 图册/研究汇编，包含生成图，不能整页视为原版布局证明。布局结论只采用以上实际画面和客户端记录。 |

结论：默认横排位于棋盘左侧海克斯装置上方；悬停详情为纵向列表。“羁绊栏上方一排”没有依据。横排显示尺寸随 HUD 缩放不同，两张图约22–34px，未发现“原版固定44px”的证据。

本次保留既有逐图标悬停说明，调整在线2D/3D的横排位置：3D中心采用两张画面共同支持的约 `(26.7vw,23.8dvh)`；图标按视口缩放，范围24–44px。2D按相同的棋盘左侧关系放到棋盘边缘外，避免遮盖格子。异常徽章保持原有数据和说明。这里的屏幕锚点是依据截图的归一化近似，尚未取得海克斯装置的原版世界坐标；不能宣称任意窗口比例逐像素一致。

另：指定HEAD里实际 `.augment-strip .augment-icon` 仍为28px，未发现用户描述的#482 44px规则；本次以实际Git内容为基线，不假定不存在的修改。

## 缺图标清单与映射

- 扫描对象是 `AUGMENT_DEFINITIONS` 的全部306个实际定义，逐一读取 content 导出的客户端 API 名，并用仓库归档 `en_us.json.gz` 的 `items[].icon` 取得精确路径；不根据显示名称猜图标。禁用、尚未进入该注册表的候选内容不计入306。
- 随包清单57个；[原随包清单之外的全部249个ID及映射](V26_AUGMENT_ICON_MISSING.tsv)；[306个定义的完整审计](V26_AUGMENT_ICON_AUDIT.tsv)。表格包含 API、客户端源路径、运行时路径、原随包/素材根覆盖和本次结果。
- 本机已知79条目的素材索引含9个强化，原运行时合计覆盖66个，因此240个没有已知映射；本次新增其中232个，余8个缺源。也为原有9个素材根强化重建载荷，随包57个继续优先使用原清单文件。
- 当前载荷共298张、5,765,301字节：57张校验既有随包PNG，52张校验离线包原生PNG，189张来自离线包的官方图案JPEG副本，转为PNG且不改变尺寸。每张都核对来源收据字节数/SHA-256，实际解码，记录输出SHA-256；189张不是原生PNG字节，建议上传前下载替换。
- 图片、原始配置和输出索引仅在忽略目录，仓库只增加脚本、路径/映射审计和样式。当前输出 `assets3d-local/augment-icons-v26/root/`、收据 `report.json`，**不是已上传状态**。

8个本机缺源定义（每一项精确下载URL也在 `assets3d-local/augment-icons-v26/missing-local.tsv`）：

| ID | 14.24 Hexcore 源文件 |
| --- | --- |
| `all-out` | `Prime-Hero-II.tex` |
| `contested` | `Contested_II.TFT_Set13.tex` |
| `hall-of-mirrors` | `HallofMirrors_III.TFT_Set13.tex` |
| `pit-fighter-prizefighter` | `OnTheRopes_II.TFT_Set13.tex` |
| `quickstriker-crest` | `Crest_Quickstriker_II.TFT_Set13.tex` |
| `quickstriker-crown` | `Crown_Quickstriker_III.TFT_Set13.tex` |
| `table-scraps` | `TableScraps_I.TFT_Set13.tex` |
| `watcher-growth` | `BattleScars_II.TFT_Set13.tex` |

这些源文件均位于 `ASSETS/Maps/TFT/Icons/Augments/Hexcore/`。精确14.24 UI WAD索引有这8条路径；全盘既有库存记录和本次本地缓存复核缺少其对应源块，未擅自下载。归档中229张JPEG的真实格式与其PNG类型标记不符；优先使用57张既有原生PNG后，实际需要替换189张JPEG副本。

## 上传/下载命令（交给Claude执行，本次未执行）

`download-missing.sh` 只下载缺源8张；推荐 `download-original-pngs.sh` 下载全部197张（189张原生替换+8张缺源）。脚本逐项使用归档中的精确客户端文件名，下载到`.part`，成功后改名；构建时严格检查PNG魔数、解码和尺寸。若镜像返回JPEG/WebP/HTML，构建失败，不会把错误内容写入索引。

先设置真实测试服素材根目标，然后取回**当前在线**索引。当前本地候选使用的是 ability-icons-delta 的79条目基线，SHA-256 `75d3d5babd502f20114a03a98e7ae43ffd6a6d254cda8408e82f16dd9ec21f48`，不能未经核对就覆盖服务器可能更新的索引。

```bash
cd /home/aiapps/workspcae/cat-cx-augicons
export ASSET_UPLOAD_TARGET='USER@HOST:/真实站点素材根/'
rsync -av --protect-args "${ASSET_UPLOAD_TARGET}ui-assets.json" assets3d-local/augment-base-live.json
bash assets3d-local/augment-icons-v26/download-original-pngs.sh &&
node scripts/assets3d/augment-icons.mjs \
  --archive /home/aiapps/workspace/tft-ui-conversation-2026-10-23/offline \
  --downloads assets3d-local/augment-icon-downloads \
  --baseManifest assets3d-local/augment-base-live.json \
  --out augment-icons-v26-native &&
rsync -av --protect-args --exclude='ui-assets.json' \
  assets3d-local/augment-icons-v26-native/root/ "$ASSET_UPLOAD_TARGET" &&
rsync -av --protect-args \
  assets3d-local/augment-icons-v26-native/root/ui-assets.json "$ASSET_UPLOAD_TARGET"
```

`augment-icons-v26-native` 尚不存在，执行以上命令后才会产生。输出目录必须全新；重跑换新名字，不删除旧交付。缺任意一个定义时构建以状态2退出，`&&` 阻止上传；先载荷后索引，载荷失败阻止索引上传，所有命令均不带`--delete`。合并保留当前索引中其他素材批次及未知字段。两个渲染模式都沿用现有 `loadRootUiAssets(readAssetBase3d())`；2D不需要加载three.js，但必须配置相同素材根。

## 完成与验证

- `src/rendering/strategy-panel.ts`：横排独立挂到棋盘根；刷新键包含图标URL，允许晚到的素材索引替换文字徽章；浮层鼠标/触摸事件沿用弹层的隔离方式，避免触发背后棋盘操作。
- `src/rendering/BoardScene.ts`：素材索引完成时立即刷新横排。
- `src/presentation/augment-hud.css`、`augment-text-data.ts`：新位置样式随强化文本懒加载，保留已有图片和说明接口；3D侦察时隐藏自己的横排，避免把自己的强化误当成对方信息。
- `scripts/assets3d/augment-icons.mjs`：全量枚举、来源验证、离线组装、保留其他批次的索引合并、缺源下载命令；允许用户明确给定的本地素材软链，不修改共用路径安全模块；只向该软链目标的全新子目录写入。
- `tests/assets3d-augment-icons.test.ts`：覆盖全定义映射、客户端内部名、冲突拒绝、索引合并和路径边界。

`npm run build -- --configLoader runner`通过（含typecheck）。默认config loader会向共享只读node_modules的`.vite-temp`写文件，故使用Vite既有runner选项，没有调整权限或构建内容。按 `scripts/m7-budget.cjs` 的顶层JS、gzip level9口径，实际HEAD基线634,342字节，本次634,396字节，增加54字节，低于637,144，余2,748字节；默认gzip level6口径为635,456字节，同样低于上限。强化样式和three.js均未在index预加载。基线用只读HEAD源码构建，无Git操作或工作区回退；详见 `artifacts/augicons-v26/size-report.json`。

相关测试只运行4个文件，`--maxWorkers=4`，89项通过；没有删除或弱化断言、提高超时。为遵守浏览器桥约束，使用 `artifacts/augicons-v26/vitest.config.mts` 仅运行无浏览器的原有测试及新脚本测试，不触发默认全局设置中的Chrome启动。日志：`artifacts/augicons-v26/tests.log`。298张输出文件已重新逐一校验索引字节数/SHA-256，完整候选索引368条，保留基线70条非强化素材。

## 风险与待验

没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，依本仓库 `AGENTS.md` 的浏览器桥要求，没有自行启动Chrome。布局截图、鼠标阻断和1440×1000等非16:9窗口的重叠检查仍待Claude通过新入口验收：

```bash
codex-browser exec -C /home/aiapps/workspcae/cat-cx-augicons \
  '验收本次海克斯栏：在线2D/3D，1280x720、1920x1080、1440x1000；取得3个强化并绑定异常，验证横排与羁绊/物品栏/棋子不重叠、悬停说明正常、点击不操作背后棋子、素材索引延迟完成可替换徽章、3D侦察不显示自己的强化；只用已有浏览器连接，不改规则或断言。'
```

8个缺源图标暂保留既有文字徽章；197张原生PNG下载、使用在线索引重建和上传均未执行。截图证据支持位置关系和近似锚点，未证明14.24原版世界锚点或所有HUD缩放下的精确像素。
