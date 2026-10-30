海克斯图标与位置只读审核（2026-10-30）

结论：必修 3 处后再合入和上传；2D 体积通过。未修改原工作区任何文件、未提交、未放宽断言/阈值/超时、未运行全套测试或重录纪元/golden。

审核版本与复现边界
- 原工作区 /data/aiapps/cat-rev-icons，实际本地分支 rev-icons，HEAD bb1990d58899b794dbf756b920667ef411502a8b，开始和结束均干净。
- 主审范围 6bbb4002^..bb1990d5：6bbb4002、3e01c9fd、bb1990d5。
- 集成线使用本地远端引用 origin/cursor/v26-integration = bc818fd854a24bb3ae75e9f9035672bcbc836160；未联网刷新引用。
- 原目录执行 git merge --no-commit --no-ff origin/cursor/v26-integration，在写 ORIG_HEAD.lock 时被只读 .git 拒绝，未进入合并。
- 在 /tmp/augment-review.Eacvux/repo 创建共享对象副本，执行同一合并，查看冲突后 git merge --abort；副本恢复 bb1990d5，状态干净。
- 构建/测试使用无 .git 的临时合并快照 /tmp/augment-review.Eacvux/merged。唯一冲突的测量假设：保留本分支 body 挂载、懒加载绑定及清理，同时保留集成线 role/aria-label 和无条件 attachTextCards(this.augmentStrip)，并保持集成线从 isOnline() 条件列表移除该 scope 的改动。未顺手修复下述 CSS 或脚本问题。
- 以下行号默认来自 bb1990d5；标注“合并快照”的行号来自临时合并结果，可在该目录对应文件查看。

1. 合并冲突与语义冲突

必修｜src/rendering/strategy-panel.ts:274（合并快照:297）
唯一文本冲突发生在构造函数、traitColumn 初始化后的横排挂载段。
本分支使用 document.body.append + bindAugmentStrip；集成线仍使用 traitColumn.root.before，并增加 group/aria-label 和无条件 attachTextCards。
不能整段选 ours：会丢失集成线首次在线状态到来前已安装的说明监听。BoardScene 创建面板时 data-online 尚未设置，保留旧 isOnline() 条件安装会使首局图标说明失效。
也不能整段选 theirs：会丢失视口挂载与定位绑定。应采用上述合并快照的功能并集，只安装一次图标说明监听，并保留 disposer。

必修｜src/presentation/augment-hud.css:11；src/presentation/augment-hud.ts:89；集成线 src/style.css:1221、1225（合并快照）
这属于 Git 不会报告的 CSS/算法语义冲突。新算法按 --augment-size（可小于24px）和2px间隙计算横排宽度，新 CSS 设置 width/height，却未重置集成线 min-width/min-height:44px；图像的32px !important 也覆盖新 CSS 的100%。
例：现有纯函数用例 board.left=800、rail.right=732、3枚图标，算法得到 size=20、left=732，预期宽64；实际 chip 仍至少44，横排至少136，会越过棋盘左边界。四枚（含异常）同样受影响。
因此即使采用上述构造函数解法、typecheck 和纯函数测试都通过，真实DOM仍会错位/重叠。应让布局使用真实控件尺寸，并保留已有44px交互约束与不遮挡要求；不要通过降低已有断言或移除 !important/最小尺寸来掩盖冲突。
tests/augment-strip-layout.test.ts:50、105（集成线/合并快照）还要求桌面44px目标、位于羁绊上方和4px间隙；新方案则是棋盘边、可缩小、2px间隙，二者的布局契约本身也不一致。需要执行者明确整合布局，并保留控件可操作性、不遮挡、说明可达等实质断言。

无需｜src/rendering/BoardScene.ts:369（合并快照:369）；src/presentation/augment-display.ts:69；vite.config.ts:40、72（合并快照）
BoardScene 的 refreshAugmentIcons 回调自动保留，未发现与集成线异常/部署逻辑互相覆盖。
augment-display.ts 在共同基线901d63d0到本次集成线之间实际没有独立改动；新 helper 自动保留，没有文本冲突。
vite.config.ts 自动合并，既保留 augment-hud 的 augment-text 分块，也保留集成线 pvp-damage 的 assets/ui 路径。构建隔离测试通过，没有3D或solo代码静态进入2D入口。

2. 图标来源、格式、输出边界

无需｜scripts/assets3d/augment-icons.mjs:34、44、99
API名从实际导出的内容合同收集，精确图标路径来自仓库 src/simulation/content/source/s13-14.24b/raw/en_us.json.gz 的 items[].icon；不是按中文名或slug猜测。
图片来源按优先级是：
  ① public 中既有 S13_AUGMENT_ASSETS 随包PNG，校验字节数和SHA-256；
  ② 显式 --downloads 目录中按定义ID命名的PNG，标注14.24 CommunityDragon镜像来源；
  ③ --archive 指向的离线研究包，读 icon-results.json，限定 game.gtimg.cn/images/lol/act/img/tft/hex/ 收据，按精确客户端文件名匹配并核对字节数/SHA-256。
因此它不是直接从本地14.24客户端WAD解包；本地离线包中既有原生PNG，也有官方图案的JPEG派生副本，脚本会解码后转PNG。下载脚本才使用 raw.communitydragon.org/14.24/game/... 精确路径。当前执行生成器本身不会联网。
来源限制：离线收据只能证明读到的字节与该研究包一致，不能独立证明腾讯CDN图案属于特定补丁；--downloads 也信任用户放入的文件，没有远端版本收据验证。

无需｜scripts/assets3d/augment-icons.mjs:49、131、138、146；src/presentation/s13-assets.ts:34；src/presentation/augment-display.ts:49
正常输出：assets3d-local/<out>/root/assets/s13/augments/<id>.png；索引 assets3d-local/<out>/root/ui-assets.json；报告和下载脚本位于 assets3d-local/<out>/。
<out>只能是全新的单层目录名，不接受 assets3d-local/... 这种路径参数；已存在目录会失败。
索引顶层保留 patch:'14.24'、assets 及基线未知字段；条目含 kind:'augment'、id、path:'assets/s13/augments/<id>.png'，附加 apiName/source/bytes/sha256。
运行时仅按kind/id/path读取，相对配置素材根解析；格式一致。随包优先，其次素材根，缺失保留徽章。合并清单保留其他批次；缺源ID如基线已有有效旧映射，也会保留旧映射。

必修｜scripts/assets3d/augment-icons.mjs:82、138；集成线 scripts/assets3d/safe-path.mjs:27、46（合并快照）
正常 assets3d-local 实目录下的输出属于 gitignore 范围；但当前脚本直接 realpath(assets3d-local)，绕过共用 safeOutputPath 对软链目标的检查。若该软链误指向仓库 public，合法 --out 也会向 public/<out>/root/... 写图和索引，违反必须只写忽略目录的要求。
已用 /tmp/augment-review.Eacvux/boundary-fixture 的16x16纯合成图片和最小内容定义复现：同一 assets3d-local -> public 配置，共用安全函数返回 unsafe-output-path；未改动的生成器却成功写入 public/probe/root/assets/s13/augments/probe.png 和 ui-assets.json。未用版权图片做越界写入，也未写原仓库。
建议直接复用集成线已支持外部素材软链的 safeOutputPath，保留新子目录独占创建约束；增加指向仓库内部和仓库祖先目录的软链拒绝用例。

本地实物核验
- 旧交付 /home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/augment-icons-v26/root：298张、5,765,301字节，全部PNG魔数/格式、方形尺寸、字节数、SHA-256通过；清单368条。来源57随包、52离线PNG、189离线JPEG转PNG。
- 合并后实际定义310个，比旧表306多 brb、over-encumbered、restart-mission、what-you-really-are。生成器会动态收集，4项都解析成功。
- 已在临时合并快照的 assets3d-local/merged-local-audit/ 完整离线生成：310项、302张就绪、5,837,918字节；302张再次核验格式/尺寸/字节/SHA-256通过。来源57随包、54离线PNG、191离线JPEG转PNG。
- 仍缺8项：all-out、contested、hall-of-mirrors、pit-fighter-prizefighter、quickstriker-crest、quickstriker-crown、table-scraps、watcher-growth。
- 上述临时合并生成使用空的合成基线清单，仅用于核查全量映射和输出。不可上传该清单，它没有测试服其他批次。正式交付必须用刚取回的在线索引重建。
- docs/V26_AUGMENT_ICONS_LAYOUT.md:20、43 的306/298/197是旧提交数据。合并后应重新生成：补齐镜像原图脚本现在包含199项（191张JPEG替换 + 8缺源），不能复用旧197项下载脚本作为完整交付。

3. 2D体积

无需｜vite.config.ts:40、72（合并快照）；scripts/audit-2d-size.mjs:20（集成线）
已在上述合并快照执行 npm run build -- --configLoader runner，包含 tsc --noEmit，成功。runner只解决共享依赖目录只读的配置临时文件问题，不改变体积口径。
随后执行 node scripts/audit-2d-size.mjs，退出0；并对实际 dist/assets/*.js 独立执行gzip level9求和，结果一致：
  index-CIFd98fq.js   原始1,357,667字节，gzip-9 517,910字节
  phaser-DpE2NteB.js  原始  385,936字节，gzip-9 111,617字节
  合计629,527字节，≤637,144，硬上限余7,617；≤630,000，目标余473。
静态可达只有以上两个顶层JS；无重复模块；隔离测试还验证UI/3D/solo不被HTML预加载或静态拉入。
这是明确说明构造函数解冲突后的结果，不是尚未解冲突的原工作树构建值；修复CSS/边界代码后仍需对最终集成结果复测。

4. 迟到图标、监听、定位

无需｜src/presentation/augment-display.ts:69；src/rendering/strategy-panel.ts:449；src/rendering/BoardScene.ts:369
刷新仅扫描横排直属带data-augment的chip：徽章替换为img，已有img仅在URL变化时改src；不会重建shop、面板或拖拽节点。新定向测试验证了节点身份和拖拽对象保留，第二次URL变化也复用原img。
素材清单完成后，BoardScene受isActive保护调用一次。构造函数的懒加载绑定有isConnected保护，销毁前未完成的import不会在销毁后安装observer。

无需｜src/presentation/augment-hud.ts:125、135；src/rendering/strategy-panel.ts:277、281
每个面板只创建一个ResizeObserver及一个window resize监听；返回的disposer断开observer并移除监听。没有requestAnimationFrame循环或每帧DOM读写；相同anchor避免重复写样式。ResizeObserver回调仍会读几何，但仅随被观测元素尺寸变化触发。
合成生命周期探针结果：observer=1，resize监听=1；同几何再次调用样式写入数仍为3；dispose后监听=0、observer断开=1。没有发现明显重复监听或持续泄漏。

建议｜src/presentation/augment-hud.ts:138
目前只感知resize/被观测元素尺寸变化，不感知仅位置变化（例如文档滚动或不改尺寸的位移）。若2D棋盘在同尺寸下改变视口位置，fixed横排可能保留旧坐标。可补充对应位置变化测试和必要的事件触发；不建议为此加每帧轮询。
3D/body视口挂载消除了board-frame容器包含块偏移；实际布局仍受第1节CSS冲突影响。未执行真实浏览器布局验收，不能把纯函数通过视为真实矩形通过。

5. 测试质量、执行范围与剩余工作

无需｜tests/assets3d-augment-icons.test.ts:8、23；tests/presentation/augment-strip-layout.test.ts:8；tests/presentation/augment-strip-late-icons.test.ts:60
主审范围只新增3个测试文件（4+5+1=10项），没有删除或修改既有断言。映射全覆盖/内部API名、冲突拒绝、清单保留与幂等、失败核算、原位更新、布局计算的断言有意义。
建议｜tests/assets3d-augment-icons.test.ts:42：当前边界测试只拒绝out='../escape'，未覆盖素材根软链；本次合成复现证明该缺口有实际后果。
建议｜tests/presentation/augment-strip-layout.test.ts:8；tests/presentation/augment-strip-late-icons.test.ts:67：前者只算数字，不加载合并后的CSS；后者绕过构造函数，不验证启动顺序/监听/真实DOM。应补4枚含异常及合并CSS下的真实矩形回归，保留集成线已有实质断言。

实际执行并通过的Vitest（全部 --maxWorkers=2）：
  tests/assets3d-augment-icons.test.ts
  tests/presentation/augment-strip-layout.test.ts
  tests/presentation/augment-strip-late-icons.test.ts
  tests/presentation/s13-root-ui-assets.test.ts
  tests/presentation/augment-text-loader.test.ts
  tests/rendering3d-isolation.test.ts
合计6文件、80项通过，16.18秒。另执行构建、体积审计、素材实物校验、纯合成边界和observer探针；没有新增受跟踪测试文件。
命令：node node_modules/vitest/vitest.mjs run --config artifacts-audit-vitest.config.mts --configLoader runner --maxWorkers=2。
该临时配置只列上述6个无浏览器文件并沿用g4-worker-setup；未调用会启动Chrome的g4-global-setup，不曾跳过测试或更改断言/阈值/超时。
当前没有CODEX_BROWSER_CLIENT/PLAYWRIGHT_WS_ENDPOINT，依浏览器桥约束未启动Chrome。集成线 tests/augment-strip-layout.test.ts 的浏览器用例尚未运行；Claude需经 codex-browser exec 新开连接任务，用原断言验收最终合并版本。未碰纪元/摘要漂移、server或simulation规则。

证据：
  /tmp/augment-review.Eacvux/build.log
  /tmp/augment-review.Eacvux/tests.log
  /tmp/augment-review.Eacvux/size-audit.log
  /tmp/augment-review.Eacvux/merged/artifacts/2d-size/modules.json
  /tmp/augment-review.Eacvux/icons-merged-audit.json

上传测试服需要的具体步骤（本次没有执行下载或上传）

先由执行者修复3处必修，并在最终集成工作树复测。以下命令在最终合并版本的仓库根目录执行；USER@HOST替换为已有测试服SSH目标。当前审核目录没有assets3d-local，先建立真正被忽略的实目录；若使用软链，必须是已核查的仓库外素材目录，不能指回public或其他仓库内部目录。

1) 获取当前在线基线，绝不能用旧79条索引直接覆盖：
   mkdir -p assets3d-local
   git check-ignore assets3d-local/augment-base-live.json
   export ASSET_UPLOAD_TARGET='USER@HOST:/srv/cat-playtest-v20/assets3d/'
   rsync -av --protect-args "${ASSET_UPLOAD_TARGET}ui-assets.json" assets3d-local/augment-base-live.json

2) 在最终集成版重新生成种子和下载列表（输出目录必须尚不存在）：
   node scripts/assets3d/augment-icons.mjs \
     --archive /home/aiapps/workspace/tft-ui-conversation-2026-10-23/offline \
     --baseManifest assets3d-local/augment-base-live.json \
     --out augment-icons-v26-seed
   当前离线输入预计返回状态2，并留下302张载荷及8项缺源清单；这一轮只为生成下载脚本，不能据此上传。不接受其他错误为成功。
   bash assets3d-local/augment-icons-v26-seed/download-original-pngs.sh
   该脚本会把最终集成版需要的镜像原图写到 assets3d-local/augment-icon-downloads/<id>.png（实目录模式；软链模式为其对应物理目录）。下载失败先解决，不跳过。

3) 使用下载缓存与在线基线重新生成完整候选；此命令必须退出0：
   node scripts/assets3d/augment-icons.mjs \
     --archive /home/aiapps/workspace/tft-ui-conversation-2026-10-23/offline \
     --downloads assets3d-local/augment-icon-downloads \
     --baseManifest assets3d-local/augment-base-live.json \
     --out augment-icons-v26-native
   输出图片目录：assets3d-local/augment-icons-v26-native/root/assets/s13/augments/。
   输出索引：assets3d-local/augment-icons-v26-native/root/ui-assets.json。
   合并版当前应total=310、ready=310、unavailable=[]；重跑使用全新out名字，禁止删除旧批次后掩盖失败。

4) 使用 origin/cursor/v26-augment-icon-audit 的审计脚本复查，必须读取最终合并版定义。
   若该脚本已集成且位于scripts/，执行：
   node scripts/audit-augment-icons.mjs \
     --ui-assets assets3d-local/augment-icons-v26-native/root/ui-assets.json \
     > assets3d-local/augment-icons-v26-native/audit.json
   若尚未集成，下面的临时投影避免改动工作树，同时保持脚本根目录解析正确：
   AUDIT_ROOT=$(mktemp -d /tmp/augment-icon-audit.XXXXXX)
   mkdir "$AUDIT_ROOT/scripts"
   git show origin/cursor/v26-augment-icon-audit:scripts/audit-augment-icons.mjs > "$AUDIT_ROOT/scripts/audit-augment-icons.mjs"
   ln -s "$PWD/src" "$AUDIT_ROOT/src"
   ln -s "$PWD/public" "$AUDIT_ROOT/public"
   ln -s "$PWD/node_modules" "$AUDIT_ROOT/node_modules"
   node "$AUDIT_ROOT/scripts/audit-augment-icons.mjs" \
     --ui-assets "$PWD/assets3d-local/augment-icons-v26-native/root/ui-assets.json" \
     > assets3d-local/augment-icons-v26-native/audit.json
   验收summary.totalAugments=310、missingBoth=0、missingFiles=0，检查ignoredRootMappings和每个ID来源。missingMappings=253只是未随包，不代表缺图；rootFallbackAugments应253。审计脚本发现缺项仍退出0，必须检查JSON，不能只看退出码。
   本次已用该分支1becfecd的原脚本对临时合并版302张清单实跑：310定义、57随包、245素材根、8两者都无、missingFiles=0、ignoredRootMappings=0。
   --ui-assets只检查索引映射，不检查服务器图片或PNG哈希；不能替代载荷核验。

5) 先图片、后索引，不带--delete：
   rsync -av --protect-args --exclude='ui-assets.json' \
     assets3d-local/augment-icons-v26-native/root/ \
     "$ASSET_UPLOAD_TARGET" && \
   rsync -av --protect-args \
     assets3d-local/augment-icons-v26-native/root/ui-assets.json \
     "${ASSET_UPLOAD_TARGET}ui-assets.json"
   最终远端图片：/srv/cat-playtest-v20/assets3d/assets/s13/augments/<id>.png。
   最终远端索引：/srv/cat-playtest-v20/assets3d/ui-assets.json。
   不要多套一层root/或augment-icons-v26-native/；不要更新ui/manifest.json、3D manifest.json或precache.json来代替这个索引。

6) 上传前复核在线索引未被其他素材批次并发更新；有变化就取新基线，用新out重新合并生成和审核。上传后取回ui-assets.json并以同一个最终合并工作树再次运行上述--ui-assets审计；另核对服务器图片存在及字节/哈希。
   页面素材根应配置为 http://实际测试服:5190/assets3d/（VITE_ASSETS3D_BASE或URL的assets3d参数，按当前服务配置），2D/3D共用该根。用浏览器桥在桌面1280×720、1440×1000、1920×1080验证迟到索引原位更新、4枚图标矩形/悬停/点击、无背后棋盘操作及3D侦察隐藏。

未完成：3处必修的代码修复（本次只读）、真实浏览器验收、8项缺源的联网补齐、用在线索引重建和上传；均未伪装成已完成。
需要用户决定：没有必须新增的玩法决定；建议先修复并复验，再由用户决定最终合并。
