# Set 13 转换数据接入与验收

日期：2026-10-27。工作树：`codex/vfx-ltk-port`；起点 `56daf94c`，合并 `origin/multiplayer` 正在进行。此任务不写 `.git`、不暂存、不提交。原游戏数据版本为 `14.24.6442327`；没有更改玩法、服务器投影或领域事件。

## 接入方式与回退

- 根 `vfx-ltk/index.json` 可以声明 `champions: { "lux": "tft13_lux/index.json" }`。运行时只为出现的英雄读取子索引，并为每份索引保留 128 系统、2,048 资产及 12 条 cue 的原上限。系统和纹理缓存按子库隔离，避免各英雄复用八位系统 ID 或相同转换文件名时串资源；根库释放时递归释放子库。
- 通用离线映射器读取 `TFTCharacterRecord.spellNames/basicAttack`、`SpellObject`、`ResourceResolver` 和动画 `ParticleEventData`。只有主技能、普通攻击和明确关联的动画事件可以自动接入；未关联的子法术、暴击、被动、回城不会凭名称混进主技能。原始帧号、骨骼与解析结果保存在 scratch 的 `event-mapping.json`。
- 脚本驱动的技能使用仓库既有 `action-bindings.json` 的显示时序，按导出系统的完整末级名称精确匹配。凡现有 `planActionEffects` 还依赖宿主的程序效果或有安全裁剪，数据时间线保持回退，避免绕过辛吉德固定射线排除或烈娜塔的程序投射物／区域。Jinx 三段及 Vi 保留既有专用时间线，通用映射补上普通攻击。
- 一次动作需要的系统全部 prepared 才接管；技能和攻击独立判断。缺索引、缺文件、无法解码、未知英雄、未完成预热或不支持的绘制功能均保留手写路径。低动态设置同样保留原行为。新增目录不是公开站点资产。
- `FX_SCALE=0.44` 保持全英雄共用，不叠乘 GLB 身高归一化。源骨、目标骨和地面骨分别解析，大小写不敏感；未找到的骨骼沿用原有 root 回退。30 FPS、通用投射物 0.3 秒及旧绑定的 delay 都是显示约定，不改变服务器伤害或命中时刻。

## 地面绘制与生命周期

默认 loader 继续拒绝地面层和纯阴影层；只有提供兼容绘制通道的棋盘宿主开启 `groundPass`。实际顺序为完整地板／透明格网、地面粒子、角色及其余粒子；早／晚扭曲与软粒子深度通道继续使用原画布和相机。地面保留原深度测试，小幅 polygon offset 避免与地板共面闪烁，不写深度以免挡住角色。绘制结束或异常时恢复相机层、材质状态和 renderer 状态；无活动效果直接走普通棋盘绘制。

最多六个系统、每个 150 根粒子加 100 子粒子槽，与原效果共用 1,500 槽预算。死亡事件、仅有死亡帧、直接移除棋子都会停止发射并取消待发 cue；尾迹只保留到 timeline duration。Vi 飞行按落地时刻到期，帧量化导致的延迟启动不会延长占槽。切阶段、切观看对象和销毁则清空全部；异步加载不会复活已经销毁的库。

## 所有变更调用点（含联机路径）

| 文件／入口 | 变化 |
| --- | --- |
| `placeholder-renderer.ts` 的 debug 对象及 `dispose` | 消除文本冲突；同时保留 renderer、goldMines、ltk 调试字段及金矿／VFX 释放；单位描述、hover、锻造器模型接线保持合并侧实现 |
| 同文件 `createVfxLibrary → createLtkRuntime` | 开启兼容地面通道，传入程序棋盘和真实场景地板根，仍使用原 AssetReader／preloader／共享预算 |
| 同文件 `playAction` | `cast` 和 `attack` 都先尝试转换时间线，成功才跳过旧显示路径 |
| 同文件 `onFrame` | 死亡帧及移除棋子时调用 `stopUnit`；准备阶段既有 `warmCast` 现在能预热任意有目录的英雄 |
| `vfx-ltk/runtime.ts` 的 `warm/play/update/render/dispose` | 延迟打开英雄子库；区分动作；队列携带所属子库；空闲直接绘制；释放子库与通道 |
| `vfx-ltk/loader.ts` 的 `parseIndex/createVfxLibrary/champion/load/dispose` | 目录与动作验证、子库隔离、地面通道显式授权与递归释放 |
| `vfx-ltk/s13-timelines.ts` 的 Vi 飞行 cue | 飞行在第 17 帧落地时到期；配合 runtime 按计划时间释放槽位，不再挤掉胸部冲击效果 |
| `vfx-ltk/timeline.ts` 的 `selectTimeline` | 允许目录明确注册的英雄；维持缺资源时整动作回退 |
| `vfx-ltk/rendering/utils/frame.ts` 的 `drawLayersOf/seeParticles` | 独立地面粒子层，保留阴影层过滤 |
| `vfx-ltk/rendering/passes.ts` 的 `createVfxPasses.render` | 地板／地面／角色排序及状态恢复 |
| `vfx-ltk/particles.ts` 的 `createLtkParticles` | 为运行组命名 `ltk-vfx`，便于检查实际场景残留 |
| `three-mode/effect-library.ts` 的 `once/sweep/dispose`、`vfx-ltk/loader.ts` 的资源缓存 | 已就绪的 GPU 缓存同步释放；在途读取保留关闭后自释放，避免在 renderer 清空分配记录后才释放纹理 |
| `src/rendering3d/assets.ts` 的 `ModelCache.load/evict` | 记录已就绪模板，在最后租约释放后的回收／销毁中同步释放模型纹理；在途读取行为保持不变 |
| `vfx-ltk/converted-events.ts` | 新增通用原始事件、旧显示绑定映射及诊断；不把原始游戏数据编入客户端 |
| `scripts/assets3d/mount-vfx-ltk-local.mjs` | 新增可选 `--trial` 目的根，仍强制只写忽略目录、不改原导出 |
| 新增 export／recover／audit／browser-review 脚本 | 分别调用现成 Rust CLI、只读缓存补资源、逐系统真实 loader/driver 审计、连接提供的 Chrome 验收；截图与数据不进 git |

联机客户端的真实共用途径为 `src/main.ts:mountThreeMode` → `three-mode/three-loader.ts:useBoardFeed(boardFeed)` → `BoardScene.ts:publishBoardFrame/publishCombatEvents` → 上表修改的 `placeholder-renderer.ts:onFrame/onEvents/playAction`。本次没有另建联机 VFX 分支，也不需要改 `online-application.ts`、`main.ts` 或服务器代码。浏览器补验通过同一个真实 `boardFeed` singleton 发布受控显示事件，覆盖这条共用接线；这不是一次 WebSocket 整局验收。

## 复现

```bash
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"
# 只读原转换器；本次 CARGO_HOME/CARGO_TARGET_DIR 均使用 /tmp/vfx4-converter 下的副本。
CARGO_HOME=/tmp/vfx4-converter/cargo-home CARGO_TARGET_DIR=/tmp/vfx4-converter/target \
  cargo build --manifest-path /home/aiapps/workspcae/vfx-tool/Cargo.toml -j 6 --locked --offline
node scripts/assets3d/export-vfx-ltk-set13.mjs \
  --cli=/tmp/vfx4-converter/target/debug/vfx-export \
  --source=/home/aiapps/workspace/set13-worktrees/boards/assets3d-local/trial/local \
  --six-cost=/home/aiapps/workspace/set13-worktrees/boards/assets3d-local/six-cost/source \
  --recovered=/home/aiapps/workspcae/vfx-tool/cache-recovered --out=/tmp/vfx4-set13
node scripts/assets3d/recover-vfx-ltk-missing.mjs \
  --source=/home/aiapps/workspace/set13-worktrees/boards/assets3d-local/trial/local --out=/tmp/vfx4-set13
# 补取资源后可向相同 export 命令追加 --retry=true，重导有诊断的英雄。
node scripts/assets3d/audit-vfx-ltk-set13.mjs --out=/tmp/vfx4-set13 \
  --bindings=/home/aiapps/workspcae/cat/assets3d-local/test-forge/action-bindings.json
node scripts/assets3d/mount-vfx-ltk-local.mjs --export=/tmp/vfx4-set13 \
  --models=/home/aiapps/workspcae/cat/assets3d-local/test-forge --trial=assets3d-local/trial-set13
node scripts/assets3d/vfx-ltk-browser-review.mjs
node scripts/assets3d/vfx-ltk-browser-review.mjs --root=assets3d-local/trial-set13 --smoke=true --shared=true
```

完整浏览器检查默认挂载 `assets3d-local/trial`（原 Jinx／Vi 数据），逐段触发两人的技能与攻击，并在缺数据条件重复；`--smoke` 检查新全英雄根，`--shared` 使用联机共用 BoardFeed，`--procedural` 检查没有真实场景模型的六角棋盘，附加 `--ground=true` 可只复查 Jinx 火箭与 Vi 地面技能。只连接 `CODEX_BROWSER_CLIENT` 提供的 Chrome，不启动浏览器；一轮结束后关闭 context 并断开连接。

<!-- VERIFIED_RESULTS -->

## 逐英雄覆盖（最终离线审计）

63 名英雄均已调用现成 Rust CLI。逐目录合计 674 个系统，按系统 ID 去重为 550；当前 loader 接受 658 个（640 个非空、18 个原始空定义），拒绝 16 个。全局命中／暴击在每份英雄包中各有一份，因此目录合计包含重复资源。可接管技能 55/63、普攻 62/63；其余动作保留手写效果。

本表使用真实棋盘的 `groundPass: true` 配置，默认未授权宿主仍拒绝地面层。接受数包含 empty-noop；「技能／普攻」表示完整动作的接管条件是否具备，并不表示该英雄所有导出系统都参与这两个动作。未使用的被动、庆祝或其他系统也逐一审计；原系统及每条拒绝详情见 `/tmp/vfx4-set13/<source>/validation-current.json`，总表见 `/tmp/vfx4-set13/coverage.json`。每系统实际读取纹理／几何／骨架／动画并推进 60 帧后释放；此表是 Node loader/driver 验证，GPU 视觉验收范围为 Jinx、Vi。

| 英雄 | 源目录 | 导出 | 接受（空定义） | 技能／普攻 | 不支持功能或回退原因 |
| --- | --- | ---: | ---: | --- | --- |
| akali | tft13_akali | 8 | 8（0） | 转换/转换 | 无 |
| ambessa | tft13_ambessa | 11 | 11（1） | 转换/转换 | 无 |
| amumu | tft13_amumu | 5 | 5（0） | 转换/转换 | 无 |
| loris | tft13_beardy | 7 | 7（0） | 转换/转换 | 无 |
| blitzcrank | tft13_blitzcrank | 9 | 9（0） | 转换/转换 | 无 |
| powder | tft13_blue | 6 | 6（0） | 转换/转换 | 无 |
| caitlyn | tft13_caitlyn | 19 | 19（2） | 转换/转换 | 无 |
| camille | tft13_camille | 8 | 8（0） | 转换/转换 | 无 |
| cassiopeia | tft13_cassiopeia | 7 | 7（0） | 转换/转换 | 无 |
| renni | tft13_chainsaw | 11 | 11（1） | 转换/转换 | 无 |
| corki | tft13_corki | 8 | 8（0） | 转换/转换 | 无 |
| darius | tft13_darius | 7 | 5（0） | 手写/转换 | 未解析网格定义；缺少原始 .sco 引用；技能所需系统被拒绝 |
| draven | tft13_draven | 9 | 9（0） | 转换/转换 | 无 |
| drmundo | tft13_drmundo | 14 | 12（1） | 转换/转换 | 表面发射 |
| ekko | tft13_ekko | 7 | 7（0） | 转换/转换 | 无 |
| elise | tft13_elise | 11 | 10（0） | 手写/转换 | 未解析网格定义；缺少原始 .sco 引用；技能所需系统被拒绝 |
| ezreal | tft13_ezreal | 10 | 10（0） | 转换/转换 | 无 |
| steb | tft13_fish | 7 | 7（0） | 转换/转换 | 无 |
| scar | tft13_flyguy | 10 | 9（0） | 手写/转换 | 未解析网格定义；缺少原始 .sco 引用；技能所需系统被拒绝 |
| gangplank | tft13_gangplank | 12 | 12（0） | 转换/转换 | 无 |
| garen | tft13_garen | 7 | 7（0） | 转换/转换 | 无 |
| smeech | tft13_gremlin | 11 | 11（0） | 转换/转换 | 无 |
| heimerdinger | tft13_heimerdinger | 6 | 6（0） | 转换/转换 | 无 |
| illaoi | tft13_illaoi | 9 | 9（0） | 转换/转换 | 无 |
| irelia | tft13_irelia | 4 | 4（0） | 转换/转换 | 无 |
| jayce | tft13_jayce | 25 | 25（0） | 手写/转换 | 技能超过 12 cue 上限 |
| jinx | tft13_jinx | 36 | 36（0） | 转换/转换 | 无 |
| kogmaw | tft13_kogmaw | 8 | 8（0） | 转换/转换 | 无 |
| leblanc | tft13_leblanc | 22 | 22（3） | 转换/转换 | 无 |
| leona | tft13_leona | 5 | 5（0） | 转换/转换 | 无 |
| sevika | tft13_lieutenant | 28 | 28（0） | 手写/转换 | 技能超过 12 cue 上限 |
| lux | tft13_lux | 8 | 8（0） | 转换/转换 | 无 |
| malzahar | tft13_malzahar | 14 | 14（0） | 转换/转换 | 无 |
| mordekaiser | tft13_mordekaiser | 15 | 15（0） | 转换/转换 | 无 |
| morgana | tft13_morgana | 7 | 7（0） | 转换/转换 | 无 |
| nami | tft13_nami | 7 | 7（0） | 转换/转换 | 无 |
| nocturne | tft13_nocturne | 9 | 9（0） | 转换/转换 | 无 |
| nunu | tft13_nunuwillump | 5 | 5（0） | 转换/转换 | 无 |
| vander | tft13_prime | 4 | 4（0） | 转换/转换 | 无 |
| violet | tft13_red | 4 | 4（0） | 转换/转换 | 无 |
| rell | tft13_rell | 9 | 9（0） | 转换/转换 | 无 |
| renata | tft13_renataglasc | 13 | 13（0） | 手写/转换 | 技能保留宿主程序／安全裁剪 |
| rumble | tft13_rumble | 12 | 12（1） | 转换/转换 | 无 |
| sett | tft13_sett | 9 | 9（0） | 转换/转换 | 无 |
| maddie | tft13_shooter | 5 | 5（0） | 转换/转换 | 无 |
| silco | tft13_silco | 7 | 7（0） | 转换/转换 | 无 |
| singed | tft13_singed | 7 | 6（1） | 手写/转换 | 表面发射；技能保留宿主程序／安全裁剪 |
| swain | tft13_swain | 12 | 11（0） | 手写/转换 | 未解析网格定义；缺少原始 .sco 引用；技能所需系统被拒绝 |
| tristana | tft13_tristana | 8 | 8（0） | 转换/转换 | 无 |
| trundle | tft13_trundle | 3 | 3（0） | 转换/转换 | 无 |
| twistedfate | tft13_twistedfate | 11 | 11（0） | 转换/转换 | 无 |
| twitch | tft13_twitch | 8 | 8（0） | 转换/转换 | 无 |
| urgot | tft13_urgot | 6 | 6（0） | 转换/转换 | 无 |
| vex | tft13_vex | 9 | 9（0） | 转换/转换 | 无 |
| vi | tft13_vi | 13 | 13（2） | 转换/转换 | 无 |
| vladimir | tft13_vladimir | 7 | 6（0） | 转换/转换 | 未解析网格定义；缺少原始 .sco 引用 |
| zeri | tft13_zeri | 5 | 5（0） | 转换/转换 | 无 |
| ziggs | tft13_ziggs | 5 | 5（0） | 转换/转换 | 无 |
| zoe | tft13_zoe | 9 | 9（1） | 转换/转换 | 无 |
| zyra | tft13_zyra | 8 | 8（0） | 转换/转换 | 无 |
| mel | tft13_missmage | 41 | 36（2） | 转换/转换 | 系统 emitter／预热预算；表面发射 |
| viktor | tft13_viktor | 20 | 18（3） | 转换/手写 | 网格表面发射；普攻无直接映射事件 |
| warwick | tft13_warwick | 27 | 27（0） | 转换/转换 | 无 |

原缓存共缺失 19 个引用路径；本轮从固定 14.24 RMAN／WAD chunk 缓存补取了 14 个，并重新运行对应英雄 CLI。仍缺 5 个 `.sco` 路径，分别涉及 Darius、Elise、Scar、Swain、Vladimir，未下载其他版本或伪造替代文件。另有一个网格定义无法解析；表面／网格发射以及过大系统继续明确拒绝。完整诊断保存在 `/tmp/vfx4-set13/missing-recovery.json` 与各英雄 `inventory.json`。

回退动作：Darius、Elise、Scar、Swain 的技能依赖被拒绝系统；Jayce、Sevika 的技能绑定分别含 17／20 条，超过现有 12 cue 上限；Renata、Singed 的技能保留程序效果／安全裁剪；Viktor 的普通攻击无可直接接入的事件。没有提高上限、删除断言或延长测试 timeout。

## 浏览器、构建与最终检查

浏览器仅连接任务入口提供的 sandbox Chrome，完整检查使用真实 GLB／转换数据及受控 BoardFeed；未启动第二个浏览器工作负载。共保留 47 张 PNG，位于 `assets3d-local/vfx-shots/`，全部被 gitignore 排除。

| 检查 | 证据 |
| --- | --- |
| 原 Jinx／Vi 导出：3 段 Jinx 技能、Vi 技能、两人普攻；随后缺索引条件重复 | `review-report.json`，32 张图；0 page error／shader／WebGL 错误，只有刻意缺索引的 1 条 HTTP 404 Console 记录 |
| 全英雄目录根、真实共用 BoardFeed：上述 6 个动作 | `catalog-review-report.json`，6 张图，0 错误，所有命名骨骼存在，FX group 三轴均为 0.44 |
| 最终资源释放修复后：真实场景地板与程序六角棋盘分别检查 Jinx 火箭／Vi 地面效果 | `catalog-arena-final-review-report.json` 与 `catalog-procedural-review-report.json`，各 2 张图；0 错误／缺骨，死亡后 active／queued／ltkGroups 均 0，销毁后 pieces／live／canvas 均 0、BoardFeed 解绑、GPU geometries=0／textures=0 |
| 最终 Vi 峰值／普通攻击补图 | `vi-final-review-report.json`，5 张图；包括技能 0.20／0.65／1.00 秒与普攻 0.30／0.55 秒，0 错误，销毁 GPU 计数为 0／0 |
| TypeScript | `npx tsc --noEmit -p .`，通过；日志 `/tmp/vfx4-tsc-final.log` |
| 相关回归 | `GOMAXPROCS=4 npx vitest run --project fast --maxWorkers=4 tests/rendering3d-*.test.ts tests/vfx-ltk-*.test.ts`，57 文件／714 项通过；包含指定 isolation／budget／所有 VFX 测试、合并后的金矿／锻造器／生命周期测试；日志 `/tmp/vfx4-tests-final.log` |
| 新增回归 | 目录惰性加载与冲突 ID 隔离、独立动作回退、通用映射、地面通道顺序／异常恢复、Vi 落地六系统预算、VFX／旧效果／模型缓存同步释放；原断言未删除、timeout 未提高 |
| 最终构建 | `GOMAXPROCS=4 npx vite build` 通过；日志 `/tmp/vfx4-build-final.log`；既有 500 kB 提示保留，没有放宽限制 |
| 工作区 | `git diff --check` 通过；`git check-ignore` 确认资源根与截图被忽略；HEAD 保持 `56daf94c`，无素材进入 git 状态 |

代表截图（路径均在本工作树的忽略目录）：

- `assets3d-local/vfx-shots/converted-jinx-cast-0-550.png`：Zap，枪口／目标胸部。
- `assets3d-local/vfx-shots/converted-jinx-cast-1-700.png`：FlameChompers 目标爆炸。
- `assets3d-local/vfx-shots/catalog-arena-final-converted-jinx-cast-2-1450.png`：最终真实场景火箭落地、地面排序及统一尺度。
- `assets3d-local/vfx-shots/vi-final-converted-vi-cast-0-650.png`：最终 Vi 落地／冲击／护盾；同前缀 200／1000 图分别记录起跳和尾迹。
- `assets3d-local/vfx-shots/catalog-procedural-converted-jinx-cast-2-1450.png` 与 `catalog-procedural-converted-vi-cast-0-1000.png`：程序棋盘地面路径。
- `assets3d-local/vfx-shots/converted-jinx-attack-0-300.png` 与 `converted-vi-attack-0-300.png`：两人普通攻击。
- `assets3d-local/vfx-shots/absent-jinx-cast-2-1450.png` 与 `absent-vi-cast-0-650.png`：无转换数据时仍可见的旧效果。

前两轮补验曾暴露缓存释放晚于 renderer 清理的问题，已修复；判断最终释放结果应使用带 `arena-final`、`procedural` 或 `vi-final` 的报告，不使用较早 `catalog-review-report.json` 的即时 GPU 快照。

## 交付边界

【完成】冲突文本已消除，同时保留双方功能；63 名英雄的转换、逐系统审计、通用显示接线、缺数据回退、Jinx／Vi 实图与清理验收已完成；没有提交。

【未完成】`.git` 只读，合并索引仍为 UU，无法在本任务暂存解决结果或完成 merge。另 61 名英雄仅完成离线 loader／driver 检查，未做逐英雄 GPU 像素验收；本次浏览器要求覆盖 Jinx／Vi，未把离线通过冒称为画面等价。

【需要我决定】无新增玩法决定。

【风险】16 个系统继续拒绝、5 个原始 `.sco` 缓存引用仍缺失；表中动作按设计回退。Jinx 火箭仍沿用首目标落点的既有显示约定；通用飞行／时间线也不冒充服务器命中调度。拥挤场景仍受原六系统／1,500 槽显示预算约束。`/tmp/vfx4-set13` 为本地 scratch，资源没有发布或纳入 git。

【下一步】由能写 `.git` 的外层会话检查后暂存冲突解决文件并继续合并；如要扩展逐英雄视觉验收或补齐剩余原始缓存，可复用本文脚本及 per-champion 诊断。

最终 3D 主包 `dist/assets/3d/render3d--xN7iamE.js`：raw 1,065,167 B，gzip-9 315,714 B。体积及 2D 静态入口隔离均由原测试门槛检查。
