# 铁男施法后重复锤击：定位与验证

基线：`claude/v26-mordekaiser-anim`，`5c376b5ef69f2c5b384f5466367bca609ed1d0ad`。未提交、未改 `.git`，未修改 simulation/server 或本地素材软链。测试服只读取得的 GLB、逐 tick 记录和临时验证脚本均放在 gitignore 的 `artifacts/mordekaiser-animation/`。

## 根因

测试服实际 `tft13_mordekaiser_spell` 为 2.633333 秒，`tft13_mordekaiser_attack1` 为 2.933333 秒。映射正确，施法单次播放并在视觉窗口结束后回到 idle；没有发现 cast-index 卡住或施法 LoopRepeat。

确定性夹具 `tests/fixtures/mordekaiser-animation-replay.ts` 使用 `createMatch(42)` 和真实战斗/显示投影，铁男起始满蓝，对手仅在夹具中设为高血量、不主动攻击。施法在 tick 1；普攻在 38、75、112、149、186、223，相邻间隔 37 tick，即 1.85 秒。前一个普攻在施法收尾期间被视觉保护挡住；tick 75 起选择的已经是正确的 attack clip。

旧 `placeholder-renderer.ts` 的两个 playback resolver 都只传星级/形态，未传已有的 `attackIntervalSeconds`。`UnitActionState` 每个普攻增加 revision，`UnitAnimationMixer.play()` 每次执行 `reset()`，于是 2.933333 秒的 attack clip 每 1.85 秒从头重播，永远到不了收尾。即使只补间隔，旧 mixer 的 `interval * 2` 上限也不能解决这个案例。

`4baaaf5a` 与 `5c376b5e` 的 animation-state、animation-mixer、unit-control、skill-feel 没有差异；placeholder-renderer 只新增海克斯栏的 import 和挂载。该动画路径的问题两个版本共有，不是 #482 新增的施法或特效回归。

## 修复

- 新增 3D 专用 `AttackCadence`，只采样回放事件 tick 的间隔，包括被施法收尾覆盖的普攻；不预测攻击、不计算规则。重复/倒序 tick 不污染采样，施法/走路/控制中断连续采样，新回合、复活和动作重建清空历史。
- 两处模型 resolver 都传入采样间隔。mixer 将完整普攻缩放至最多 `interval * 0.9`，留下恢复到 idle 的窗口，短 clip 保持原时长。施法序列、分支和 cast-index 不变。
- 实际铁男 clip 的修复后播放窗口为 1.665 秒，完整播至 2.933333 秒末帧，在 tick 108、145、182、219 回到 idle。前后逐 tick 的 state、选中 clip、action time、weight、loop、paused 均记录在 `trace-before.json` / `trace-after.json`。

## 同类英雄

实际测试服 GLB 去掉网格/贴图后，仅以 Three.js 在内存中运行原始动画曲线。铁男普通/三星、Vi、Sevika 默认及四分支、Jayce 前/后排共 10 组上下文全部通过：每段 LoopOnce、完整达到末帧、收尾后 cast 权重归零、下一次普攻仅选择 attack clip。

Vi 的 attack 为 1.133333 秒；Sevika 为 1.133333 秒；Jayce 为 1.466667 秒。正常低攻速不具有铁男这个长普攻问题；高攻速下同样会受益于完整动作缩放。Jayce 的长入场/收尾阶段仍整体压在 2.5 秒施法上限内，未丢段。Sevika 分支验证显式提供 context；现有宿主未传 branch 的选择逻辑不在本补丁中扩展，也未从随机数猜分支。

CI 回归使用全部自行生成的曲线，覆盖同样的序列形状，不依赖测试服、GLB 或版权素材。另由真实 placeholder-renderer 以铁男身份接收 seed-42 事件，在 skill feel 开启/关闭两种情况下验证接线，以及阶段切换、隐藏后恢复、复活、销毁重建的采样清理。

## 验证

新增的领域回放/mixer 测试和真实 renderer 测试在修改前都以 `expected 3 to be less than 1.85` 失败；修改后通过。原有断言没有删除或弱化，既有时长断言随更严格的播放窗口从 0.5 改为 0.225；超时和预算未调整。

相关测试共 **9 文件、118 项通过**，全部使用 `--maxWorkers=4`：animation、cast-sequence、unit-control、skill-feel、mordekaiser-animation、catchup、death、jayce-forge、isolation。`npm run typecheck` 和 `git diff --check` 通过。

本环境没有浏览器连接变量，选中的测试均无需浏览器。使用临时配置 `artifacts/mordekaiser-animation/vitest.config.ts` 继承原测试配置，仅去掉会启动 Chromium 的 globalSetup；未改仓库测试配置、断言或超时。命令：

```sh
npx vitest run --configLoader runner --config artifacts/mordekaiser-animation/vitest.config.ts --project fast tests/rendering3d-animation.test.ts tests/rendering3d-cast-sequence.test.ts tests/rendering3d-unit-control.test.ts tests/rendering3d-skill-feel.test.ts tests/rendering3d-mordekaiser-animation.test.ts tests/rendering3d-catchup.test.ts tests/rendering3d-death.test.ts tests/rendering3d-jayce-forge.test.ts tests/rendering3d-isolation.test.ts --maxWorkers=4
```

生产构建按真实 Vite 配置（runner，write:false）比较：基线两个源码文件通过只读 `git show HEAD:<path>` 替换，其余配置/代码/压缩器相同。顶层 2D JS gzip-9 **631,315 → 631,314 B**，低于 637,144；2D 源码不变，动态 chunk 文件名变化造成 1 B 压缩差异。3D 为 320,015 → 320,209 B。isolation 测试另行验证 2D 静态导入图没有带入 3D，原硬门槛保持不变。

## 限制

没有足够连续普攻样本时仍按原始 clip 播放；攻速突然变化的首拍可能沿用上一次视觉采样，下一次连续攻击更新。浏览器实际观感尚未验收；若需真机复核，需要 Claude 通过 `codex-browser exec` 新启动浏览器测试任务，不能在本任务中自行启动 Chromium。
