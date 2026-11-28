# v26 dmgfx：PvP 实扣血表现

基于 D0 `roundResults[].damageDealt`，仅修改前端、测试及分包配置；规则、服务器、结算时机和版本身份不变。

## 数据与播放

- `presentation/pvp-damage.ts` 从私有投影经 `toDisplayMatch` 保留的本轮结果读取：胜利或平局对手失血取 `damageDealt`，我方受伤取 `hpLost`。平局时两边各保留自己的权威实扣血总数。不使用未截断 `playerDamage`、棋子输出或公开 HP 差代算总伤害。镜像 0、缺失字段、PvE、选秀不新增对手扣血表现。
- 公共视图按回合保存已抽中的对手席位；下一回合的候选或对手不会接收上一回合的扣血。视图和私有状态先后到达均可；首次状态只建立基线，重复／旧状态不重播。每局使用本地表现序号，原地再来一局仍能播放同名回合。
- 2D 在侧栏原条目复用 `.seat-damage`、`.seat-lost`、`.hit` 样式，已有数字被实扣血覆盖，避免叠两个数字；后续视图重建行时恢复原动画进度，2.6 秒清理。全部实现按需进入 `assets/ui/pvp-damage`，只有入口接线保留在原应用。
- 3D 只从**同一回合且已结束**的终局 replay 读取存活棋子的格子；`stream.ended === false` 时不读取暂存为 initial 的 terminal。按 `countsG23SurvivorDamage` 的玩家伤害口径，用同一张前端排除表过滤两队：`g23-sion`、`g23-forge`、`g23-barrel`、`v20-silco-minion`、`b5-voidling`、`trainer-golem`、`carry-golem`、`s13-wolf`、`s13-mini`、`s13-crab`、`g24-voidspawn`。后四种分别对应所有当前 anomalySummon 身份和可按 definitionId 识别的 itemSummon。compact replay 不公开 `anomalySummon`／`itemSummon`；沿用英雄 definitionId 的镜像、壕沟、实验体及克隆设施复制体无法仅凭 definitionId 区分，不误排正常英雄，也不修改规则或 replay 协议。为保持独立 UI chunk 无运行时 import，规则谓词仅在测试中导入，逐身份验证排除表的双向筛选与权威口径一致。每个合格存活棋子一发，飞向对面小小英雄。
- 没有存活棋子、终局 replay 缺失、回合不匹配或流式 replay 未结束时，起点取空，不猜弹道数量，直接在目标小小英雄头顶显示 `-N` 并触发受击动作；2D 侧栏仍显示权威总数。
- 有起点时最后一发命中后，小小英雄头顶显示一次 `-N`；不会按弹道数重复或拆分扣血。每个目标独立保留 volley、数字和资源，平局双向表现互不清除；tabletop 按局内回合键＋目标去重。小小英雄走动时落点和文字跟随。弹道、拖尾、命中、文字均不等待命令，也不延长回合。
- 3D 挂载时隐藏旧的 DOM 弹道：联机 PvP 由新 volley／直接受击负责，单人和 PvE 继续走旧 3D 受击。`BoardHit.pvp` 仅标记联机 PvP，避免单人 PvP 被跳过。HUD 注释已说明两类替代关系；每帧只读 `damage.isActive()` 布尔值，不构建 debug 数组。
- 3D 素材迟到、替换、退出观战、卸载均有释放检查；文字贴图／材质、共享几何／材质和粒子实例分别释放。后台页恢复用墙钟跳过已过期表现。看其他棋盘及减少动态效果设置下不新增本席弹道；侧栏信息保留。

## 原版素材与近似

只读检查 `/home/aiapps/workspcae/vfx-tool/out/index.json`：47 个系统，属于 `tft13_jinx`／`tft13_vi`，未发现通用玩家扣血系统，未复制该目录素材。

现有 `assets3d-local/models-delta/manifest.json` 列有 `player-damage-mis`、`player-damage-mis1`、`player-damage-tar`。代码经现有可配置素材根和 EffectLibrary 尝试原版 travel／impact，主弹道缺失时尝试简版条目；但本机软链目录缺少这些条目指向的 `roots/.../effects/extras/*.json`，不能宣称已实载原版粒子。资源齐备的素材根可直接复用；本机缺失时使用程序生成的金色核心／渐细拖尾、命中闪光和 Canvas 数字。弧线、时长、分发节奏属于简洁表现约定，不声称原版逐帧一致。不自动展开 `player-damage-child`。

没有写入、复制或修改任何本地素材，`assets3d-local` 保持开工前的只读软链状态。

## 验证与限制

相关 Vitest 用例与现有 3D 生命周期、分包隔离、观战商店、侧栏倒计时回归使用 `--maxWorkers=4 --configLoader runner`；原测试的断言和超时未删改，分包隔离新增专门断言确保 PvP UI chunk 实际独立发出且没有静态／动态 import。临时配置 `artifacts/dmgfx/vitest.config.ts` 仅省去会自行启动 Chromium 的全局 setup，保留项目选择、worker setup 和测试本身。

本次补充空起点立即数字／受击、同归于尽双向失血、双目标独立到期／清理及迟到粒子释放、缺失／错回合／未结束流式 replay、G23 非战斗体和 wolf/mini 过滤、2D 平局双方只播一次的回归。既有胜负弹道、原版粒子接口、12 发不截断、移动落点、后台到期、再来一局和卸载用例保持通过。

生产构建使用 `npx vite build --configLoader runner`，避免 Vite 默认配置打包器向只读 `node_modules/.vite-temp` 写临时文件。2D 按 `dist/assets/*.js` 逐文件 gzip level 9 相加计量；独立隔离用例验证新 UI chunk 无静态 import、只含 `src/presentation` 模块，且 HTML 不预加载。

截图**未实跑**：没有 `CODEX_BROWSER_CLIENT`／`PLAYWRIGHT_WS_ENDPOINT`，未启动 Chromium 或更改权限。需要 Claude 以 `codex-browser exec` 新开浏览器任务后验收 2D 对手／我方扣血、3D 胜负弹道与文字、平局双向、空起点及未结束 replay 回退、镜像零伤害、再来一局及模式切换。自动测试的合成 DOM／粒子对象不代替真实画面验收。

本轮审查修复的测试、类型检查、构建和精确体积见 `artifacts/dmgfx/review-tests-final.log`、`review-online-final.log`、`review-isolation-final.log`、`review-typecheck-final.log`、`review-build-final.log`、`review-size.json`；这些生成物不提交。

最终结果：相关 **9 文件 / 106 项通过**（主回归 7 文件／89 项，侧栏及观战 2 文件／17 项；加强后的隔离用例另行复跑通过），全部 `--maxWorkers=4`；`npm run typecheck`、生产构建、`git diff --check` 通过。2D JS 按 Node `gzipSync({level:9})` 逐文件累加为 **631,533 B**（入口 507,634 + Phaser 123,899），低于 637,144 B，余量 5,611 B。新 UI lazy chunk 为 2,702 B 原始 / 1,303 B gzip-9；隔离门禁确认只有 presentation 模块且无 import。没有提交；`src/simulation`、`src/server` 与既有测试断言／超时未改。

## Opus 复审：玩家伤害存活口径修正

将上述战斗存活筛选更正为玩家伤害存活筛选，新增排除 `g23-sion`、`b5-voidling`、`trainer-golem`、`carry-golem`、`s13-crab` 及装备召唤的 `g24-voidspawn`；其他播放逻辑不变。原先错误认定 Sion 为弹道源的断言已更正并扩展为 11 种身份的双队参数化回归，测试直接调用 `countsG23SurvivorDamage` 校验排除依据，同时断言权威扣血总数不变、普通英雄仍保留。

本轮仅复跑相关 **3 文件／31 项，全部通过**，均 `--maxWorkers=4`：表现及 3D 专项 30 项、真实生产分包隔离 1 项。`npm run typecheck`、`npx vite build --configLoader runner`、`git diff --check` 均通过。最新生产 2D JS gzip-9 合计 **631,530 B**（入口 507,631 + Phaser 123,899），低于上限 637,144 B，余量 5,614 B；PvP UI lazy chunk **2,788 B 原始／1,346 B gzip-9**，仍仅含 presentation 模块且无静态／动态 import。日志与体积记录为 `artifacts/dmgfx/review-survivors-{tests,isolation,typecheck,build}.log`、`review-survivors-size.json`。浏览器桥接变量仍缺失，截图未实跑；素材使用及复制体识别限制见上文。本轮只修改前端筛选、专项测试与本文档，无规则／服务器修改，无提交。
