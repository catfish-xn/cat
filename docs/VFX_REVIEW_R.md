# Review R：自身目标与整动作覆盖

2026-10-27；分支 `codex/vfx-ltk-port`，起点／保留 HEAD `7a6ea29a42b59c57ce7b3982747fc3357b0db96f`。不提交，不改 `.git`，不改规则、收据、服务器或素材。

## 修复合同

- `src/rendering/three-mode/vfx-ltk/timeline.ts:18`：`mapSkillTimeline` 返回 `{ spawns, unsupported }`。命中保留自身、友方和敌方目标，按收据顺序去重；`primary` 仍取原列表首个目标。起手 cue 不要求目标。
- `timeline.ts:31`：当前阶段的命中／投射 cue 缺目标时报告 `missing-target`；投射 cue 的首目标为自身时报 `self-projectile`。当前通用投射只支持两个不同单位之间的轨迹，不能把自身悄悄删除后换成第二目标。其他阶段不计入此次覆盖；合法自身命中仍留在诊断计划中。
- `src/rendering/three-mode/vfx-ltk/runtime.ts:33`：`play` 继续返回 boolean，只有全部当前 cue 可映射、所需系统就绪、宿主／目标存活且未释放、队列有空间时才返回 `true`。部分覆盖返回 `false`，此次动作零入队，既有动作不受影响；宿主由此执行整套手写回退。
- 保留原始 empty-noop、粒子／队列预算、超时、延后死亡取消及资源释放语义。接管表示完整排队；之后的死亡、资源失效或既有负载预算仍可取消视觉，不承诺 GPU 已实际绘制。

## 调用点清单（含联机）

| 调用点 | 本次处理 |
| --- | --- |
| `src/rendering/three-mode/vfx-ltk/runtime.ts:43` → `mapSkillTimeline` | 唯一修改的生产调用点；改用 `spawns/unsupported`，检查部分覆盖后才入队 |
| `tests/vfx-ltk-timeline.test.ts:33`、`:34`、`:35`、`:39`、`:57`、`:63` → `mapSkillTimeline` | 原数组断言改读 `.spawns`；自身命中断言补上，空目标同时断言 unsupported；`:38` 原三段循环等价断言保留 |
| `tests/vfx-ltk-review-r.test.ts:50` 起的 `play` 及 `:62` 起的 `mapSkillTimeline` | 新增范德尔真实收据、混合自身／友方／敌方、主目标、自投射、空目标、阶段／普攻隔离、死亡／释放／缺系统、满队列回归 |
| `tests/rendering3d-catchup.test.ts:99` → `RemoteSession.receiveReplay/advanceDisplay`、`:103` → `BoardFeedListener.events` | 新增联机投影到真实 3D 宿主的三种情况：范德尔自身双 cue 接管、空目标回退、大嘴自身投射回退；验证旧效果确实调用一次、无部分转换残留、无网络命令、回放和权威状态不变 |
| `scripts/assets3d/audit-vfx-ltk-targets.mjs:39`、`:66`、`:70` | 新增 `stepCombat` 收据采样、时间线覆盖和运行时整动作入队审计 |
| `src/rendering/three-mode/placeholder-renderer.ts:882` → `ltk.play` | **无需修改**：原 boolean 契约保留；`false` 继续手写路径。`:1118` 普攻、`:1123` 技能均共享该入口，技能原样传完整 `event.targetIds` |

联机真实生产接线也已核对：`src/main.ts:20` → `three-mode/three-loader.ts:95` 的共用 `boardFeed` → `BoardScene.ts:1344` 发布显示事件 → `placeholder-renderer.ts:1123` → `:882` → `runtime.ts:43`。没有额外联机 VFX 实现需要同步，未改 `main.ts`、`online/`、`BoardScene.ts` 或 `placeholder-renderer.ts`。测试只替换 GPU、模型／纹理读取；联机回放和 3D 动作选择使用生产实现。合成旧效果 ID 不属于技能手感裁剪名单，因此该集成用例用已有 `?skillfx=off` 路径验证旧素材回退。

## 63 英雄审计方法与结果

读取现有 `/tmp/vfx4-set13/index.json` 及全部 63 个子索引；不重新导出或修改索引。保留实际 cue 类型、顺序、phase、primary 和时序，替换系统 ID、粒子树、纹理和单位为合成数据。所有技能／普攻各检查三个阶段，以及空目标、自身、友方、敌方、三种混合首目标／重复目标、缺失目标，共 3,024 次；再使用生产 `stepCombat` 在有／无低血友军、前三次施法状态下采样，获得 366 份实际收据，合计 **3,390 次检查通过**。Amumu、Zeri 不主动施法，未伪造其收据。

54 份技能映射、30 份普攻映射有多个 cue；全部进入上述矩阵。表中“覆盖”只指所有系统已准备好时的目标覆盖，不替代原资源审计：Darius、Elise、Scar、Swain 的原资源缺口，Jayce／Sevika 的 cue 上限，Renata／Singed 的宿主程序回退及 Viktor 普攻无映射仍按旧合同处理。没有把 `55/63` 资源就绪数当作所有目标情形都能接管。

主要发现：

- Vander：`[self]` 加起手／命中，修复后两者都排队并实际创建，命中附着 caster。Nocturne 的自身命中、Rell／Garen 的自身加敌方命中同样保留。
- Draven、Illaoi、Kogmaw、Twitch、Warwick：实际 `[self]` 配投射 cue，整技能回退。Lux 单人时 `[self]` 回退，有低血友军时 `[ally]` 可完整映射，友军不会被误删。
- Leona、Nunu：真实空目标配起手／命中，整技能回退；Swain 也有此形状，但原本已有资源回退。Renni、DrMundo 的空目标只配起手，仍可接管。
- Irelia、Loris 的自身起手不受影响。Singed 可能选自身或友军但映射原本为空；Renata、Steb、TwistedFate、Mel、Jayce 的友方治疗／护盾不能凭描述另塞进 `cast.targetIds`，继续以实际收据为准。
- Jinx 三阶段逐一检查，Vi 的 primary 命中及多目标命中保留；不活跃阶段不会误报缺目标。

下表 `S/P/H` 分别为起手／投射／命中 cue 数（技能为全部阶段合计）；目标列为生产收据在上述合成棋盘的去重结果，不声称穷尽所有英雄强化、站位或战斗分支。

| 英雄 | 技能 S/P/H | 普攻 S/P/H | 采样收据目标 → 目标覆盖 |
| --- | --- | --- | --- |
| akali | 2/1/3 | 0/0/1 | 敌方 → 覆盖 |
| ambessa | 4/0/2 | 0/0/1 | 敌方 → 覆盖 |
| amumu | 1/1/1 | 0/0/1 | 无主动施法 |
| loris | 2/0/0 | 0/0/1 | 自身 → 覆盖 |
| blitzcrank | 1/2/1 | 0/0/1 | 敌方 → 覆盖 |
| powder | 0/0/2 | 0/1/1 | 敌方 → 覆盖 |
| caitlyn | 3/0/2 | 1/1/1 | 敌方 → 覆盖 |
| camille | 3/0/1 | 0/0/1 | 敌方 → 覆盖 |
| cassiopeia | 1/1/1 | 0/1/1 | 敌方 → 覆盖 |
| renni | 1/0/0 | 0/0/1 | 空 → 覆盖 |
| corki | 0/2/3 | 0/1/1 | 敌方 → 覆盖 |
| darius | 3/0/1 | 0/0/1 | 敌方 → 覆盖 |
| draven | 2/2/2 | 0/1/1 | 自身 → 回退 |
| drmundo | 2/0/0 | 0/0/1 | 空 → 覆盖 |
| ekko | 1/0/3 | 0/0/1 | 敌方 → 覆盖 |
| elise | 3/1/3 | 0/1/1 | 敌方 → 覆盖 |
| ezreal | 2/2/3 | 0/1/1 | 敌方 → 覆盖 |
| steb | 0/1/2 | 0/0/1 | 敌方 → 覆盖 |
| scar | 1/3/2 | 0/0/1 | 敌方 → 覆盖 |
| gangplank | 1/2/5 | 0/0/1 | 敌方 → 覆盖 |
| garen | 1/0/2 | 0/0/1 | 自身、敌方 → 覆盖 |
| smeech | 6/1/1 | 0/0/1 | 敌方 → 覆盖 |
| heimerdinger | 1/1/1 | 0/1/1 | 敌方 → 覆盖 |
| illaoi | 2/1/2 | 0/0/1 | 自身 → 回退 |
| irelia | 2/0/0 | 0/0/1 | 自身 → 覆盖 |
| jayce | 0/0/0 | 0/0/1 | 敌方 → 回退 |
| jinx | 3/3/3 | 0/1/1 | 敌方 → 覆盖 |
| kogmaw | 3/1/1 | 0/1/1 | 自身 → 回退 |
| leblanc | 3/2/5 | 0/1/1 | 敌方 → 覆盖 |
| leona | 2/0/1 | 0/0/1 | 空 → 回退 |
| sevika | 0/0/0 | 0/0/1 | 敌方 → 回退 |
| lux | 0/1/1 | 0/1/1 | 自身 → 回退；友方 → 覆盖 |
| malzahar | 1/1/3 | 0/1/1 | 敌方 → 覆盖 |
| mordekaiser | 5/0/3 | 0/0/1 | 敌方 → 覆盖 |
| morgana | 0/1/2 | 0/1/1 | 敌方 → 覆盖 |
| nami | 1/1/2 | 0/1/1 | 敌方 → 覆盖 |
| nocturne | 2/0/1 | 0/0/1 | 自身 → 覆盖 |
| nunu | 2/0/1 | 0/0/1 | 空 → 回退 |
| vander | 1/0/1 | 0/0/1 | 自身 → 覆盖 |
| violet | 0/0/2 | 0/0/1 | 敌方 → 覆盖 |
| rell | 2/0/3 | 0/0/1 | 自身、敌方 → 覆盖 |
| renata | 0/0/0 | 0/1/1 | 敌方 → 回退 |
| rumble | 3/1/1 | 0/0/1 | 敌方 → 覆盖 |
| sett | 1/0/2 | 0/0/1 | 敌方 → 覆盖 |
| maddie | 0/1/1 | 0/1/1 | 敌方 → 覆盖 |
| silco | 1/1/1 | 0/1/1 | 敌方 → 覆盖 |
| singed | 0/0/0 | 0/0/1 | 自身 → 回退；友方 → 回退 |
| swain | 4/1/2 | 0/1/1 | 空 → 回退 |
| tristana | 1/0/1 | 0/1/1 | 敌方 → 覆盖 |
| trundle | 0/0/1 | 0/0/1 | 敌方 → 覆盖 |
| twistedfate | 1/1/1 | 0/1/1 | 敌方 → 覆盖 |
| twitch | 3/1/1 | 0/1/1 | 自身 → 回退 |
| urgot | 0/1/0 | 0/1/1 | 敌方 → 覆盖 |
| vex | 2/1/3 | 0/1/1 | 敌方 → 覆盖 |
| vi | 5/1/2 | 0/0/1 | 敌方 → 覆盖 |
| vladimir | 1/1/0 | 0/1/1 | 敌方 → 覆盖 |
| zeri | 0/1/1 | 0/1/1 | 无主动施法 |
| ziggs | 0/0/1 | 0/1/1 | 敌方 → 覆盖 |
| zoe | 1/1/1 | 0/1/1 | 敌方 → 覆盖 |
| zyra | 0/1/0 | 0/1/1 | 敌方 → 覆盖 |
| mel | 2/1/2 | 0/1/1 | 敌方 → 覆盖 |
| viktor | 1/0/1 | 0/0/0 | 敌方 → 覆盖 |
| warwick | 2/1/2 | 0/0/1 | 自身 → 回退 |

## 验证与边界

| 检查 | 结果／证据 |
| --- | --- |
| `GOMAXPROCS=4 npx vitest run --project fast --maxWorkers=4 tests/rendering3d-*.test.ts tests/vfx-ltk-*.test.ts` | 58 文件、732 项全部通过；`/tmp/vfx-review-r-tests.log`；含 3D 隔离、预算、释放和联机宿主回归 |
| 最后补充收据类型收窄后，单跑 `tests/vfx-ltk-review-r.test.ts`，仍为 `--maxWorkers=4` | 15 项全部通过；`/tmp/vfx-review-r-final-regression.log` |
| `npm run typecheck` | 通过；`/tmp/vfx-review-r-typecheck.log` |
| `GOMAXPROCS=4 npx vite build` | 通过；`/tmp/vfx-review-r-build.log`；既有 500 kB 分块提示保留，未放宽限制 |
| `GOMAXPROCS=4 node scripts/assets3d/audit-vfx-ltk-targets.mjs --catalog=/tmp/vfx4-set13/index.json --out=/tmp/vfx-review-r-target-audit.json` | 63 英雄、3,390 次检查通过；JSON 含每次目标、覆盖、队列及 unsupported 原因 |
| `git diff --check`、`git status --short`、`git rev-parse HEAD` | 通过；仅代码／测试／审计脚本／文档，未引入游戏素材，HEAD 未变，无提交 |

本任务未启动浏览器或执行浏览器脚本，未做 GPU 视觉验收；合成数据验证不证明真实贴图、骨骼、飞行或叠层的最终观感。没有删除原断言或提高 timeout。未来有授权浏览器任务时可优先复验 Vander 自身命中、Lux 自身／友方切换及混合目标；Review R 的代码修复和要求的离线检查已完成。
