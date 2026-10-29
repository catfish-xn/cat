# v26 技能特效第 2 批交付

分支 `claude/v26-vfx-batch2`，基线 `4baaaf5a9a74335d46fa0e037a93e4e595f05384`。未提交、未上传、未改 simulation/server。素材只在本机 `assets3d-local/vfx-batch2-stage/`。

## Astra 复审修正（2026-10-29）

- `batch2-bridge.ts:78`：逐事件登记 Viktor cast，登记和落地消费都不受最近两 tick 的特效窗口限制；过期落地只清状态，不补播。`action()` 仅播放，不再登记。真实渲染器的旧 cast＋当前落地同批追帧已覆盖。
- `batch2-bridge.ts:85`：只接受等待中同一 Viktor、施法目标列表内、后续 tick 的魔法伤害；同 tick 有该 Viktor attack 时继续保守跳过。真伤灼烧、物理伤害、其他来源或其他目标不触发，也不删除等待状态。当前展示协议只含 owner/伤害类型，没有包的 sourceKind/definitionId/actionSeq，不能声称可精确区分同源魔法装备伤害，见风险。
- `batch2-bridge.ts:94`：落地时过滤死亡、缺失、已释放目标；有存活目标时正常播放棋盘层＋存活目标命中层。全部目标已死时显式选择 `boardOnly`，仍播放棋盘落地层。`runtime.ts:59` 只按该显式阶段选择 cue，普通调用的整组目标校验不变。
- 回归覆盖 1 星/3 星、部分及全部目标死亡、真伤灼烧不会抢先消费、过期落地不会误触发下一批、跨战斗清理、事件顺序及真实 renderer 追帧。新增 6 项测试，原断言与超时保留。
- 只读 SSH 复核当前远端的 manifest、precache、LTK 根索引，三个 SHA-256 仍与下列基线一致。本次未执行上传。

## 【完成英雄】

“完成”指载荷、分支接线和 CPU 验证完成；不是 GPU 实图或逐像素还原验收。

| 英雄 | 已接阶段 | 所选系统 / CPU 成功 | 子目录文件数 |
| --- | --- | --- | --- |
| Jayce | 前排近战门/冲击、后排水晶/爆炸；Forge 按真实盾/增益收据绑定接收者 | 16/16 | 206 |
| Sevika | castOutcome 的喷火/蓝火、拳击、撕咬；头奖/火箭/盾/金币附加层；动画 branch 同步选择 | 18/18 | 191 |
| Viktor | 普攻激光起点、射线、命中；全棋盘警告/击飞；延迟伤害阶段的大地面系统和目标冲击，含三星大地面系统 | 9/9 | 236 |
| Jinx | W 补静止定向 beam；E 最多三枚独立投射/爆炸；R 飞向棋盘中心格；普攻使用本英雄弹道 | 12/12 | 201 |
| Mel | 前两次 Q 弹幕、第三次 R 爆发；吸收储能事件、实际护盾收据、playerSaved 救命爆发 | 15/15 | 545 |
| Warwick | 自身嗜血不再包含自身投射；devoured 收据在死亡后快照真实目标落点并播吞噬；永久嗜血 | 8/8 | 159 |

来源为 `vfx-tool` Rust resolver 已导出的 `/tmp/vfx4-set13/tft13_{jayce,lieutenant,viktor,jinx,missmage,warwick}`；使用自己的原始系统、转换贴图/网格/骨骼/动画。子索引改用逐分支时间线，没有重写原始系统 JSON。177 个原始系统、1,355 项转换资产全部按索引闭包复制；其中选入时间线的去重系统共 78 个，均通过当前真实 loader 和 60 帧 CPU 步进。

每个技能分支仍 ≤12 cue；Jinx 含普攻恰好 12。Sevika 的技能和附加奖励分别选择，单次组合最多 8 cue。没有提高 6 活跃系统、1,500 粒子槽、64 排队项、每帧 6 启动的限制。

## 【未完成及原因】

- 未做 GPU / 自然战斗实图验收：当前无 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`。需要 Claude 通过 `codex-browser exec` 启动测试任务，复用浏览器桥，不自行 launch Chromium。
- 未上传：用户明确交给 Claude 执行。需要同时部署本分支的前端代码；只上传素材不足以接入新分支选择/网格采样/棋盘落点能力。
- 原始动画图时钟及全部连续子动作仍未重建。Jayce 门后的目标飞返、Sevika 连续吞咬重置等未新增完整运动代理。Jinx E 使用收据前至多三个真实目标，未新增独立地面中心字段；Mel 五个原本不支持的 surface/system-budget 辅助系统未被强行接管。当前选择的是已验证的独立原版片段。

## 【前端改动】

| 文件:行 | 内容 |
| --- | --- |
| `src/rendering/three-mode/vfx-ltk/champions/jayce.ts:3` | Jayce 两形态和 Forge 独立时间线 |
| `src/rendering/three-mode/vfx-ltk/champions/sevika.ts:2` | 三技能、蓝火和头奖附加分支 |
| `src/rendering/three-mode/vfx-ltk/champions/viktor.ts:2` | 死亡射线、警告/击飞和延迟全屏 |
| `src/rendering/three-mode/vfx-ltk/champions/jinx.ts:5` | 三段技能、棋盘中心 R 与普攻，12 cue |
| `src/rendering/three-mode/vfx-ltk/champions/mel.ts:7` | 普通/第三次、储能、盾、救命 |
| `src/rendering/three-mode/vfx-ltk/champions/warwick.ts:2` | 自身嗜血、死亡后吞噬、永久嗜血 |
| `src/rendering/three-mode/vfx-ltk/batch2-bridge.ts:23` | 只消费展示事件，选择技能/动画分支，按收据取接收者；`:78` 独立登记风暴，`:90` 来源/类型筛选，`:94` 存活目标过滤 |
| `src/rendering/three-mode/placeholder-renderer.ts:620` | 薄接线；`:893` 调用；`:1116` 不受播放窗口限制的事件观察；`:1210` 救命 |
| `src/rendering/three-mode/vfx-ltk/timeline.ts:32` | 棋盘点、有限多目标投射；保留自身投射和缺目标失败 |
| `src/rendering/three-mode/vfx-ltk/runtime.ts:52` | 选择当前分支/阶段后判断就绪；原地 beam、快照目标、按观测 channelTicks 停发射；`:59` 显式棋盘阶段 |
| `src/rendering/three-mode/vfx-ltk/assets/emissionMesh.ts:5` | 原始坐标下按三角形面积采样静态网格；拒绝蒙皮、越界和退化网格 |
| `src/rendering/three-mode/vfx-ltk/loader.ts:231` | 只为有已转换二进制的静态 emissionMesh 加载采样器；其余能力门槛不变 |
| `src/rendering/three-mode/vfx-ltk/particles.ts:85` | 将采样器交给既有粒子模拟 |
| `tests/vfx-ltk-batch2.test.ts:36` | 阶段/目标/分支、12 cue、死目标、静态网格和原有失败路径回归；`:107` 起为风暴修正回归 |
| `tests/rendering3d-jayce-forge.test.ts:256` | 真实 mountRenderer3d 追帧：旧 Viktor cast 不播放警告，当前落地仍只播放一次 |

共享改动仅为以上必需能力；英雄数据在独立文件中，便于与 batch1 合并。

验证：14 个相关测试文件、124 项通过，均 `--maxWorkers=4`；`npm run typecheck` 通过；生产内存构建通过。共享 node_modules 只读，测试/构建使用 `--configLoader=runner`，没有改超时或删弱断言。2D 顶层 JS 的 gzip level 9 合计 **630,527 字节 ≤ 637,144**，详见 stage 的 `build-budget.json`；HTML 不预载 3D。

## 【上传命令】

暂存根：`/home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/vfx-batch2-stage/`。

| 交付文件 | 用途 |
| --- | --- |
| `vfx-ltk/batch2/tft13_*/index.json` 及系统/资产 | 六份子索引及其闭包，隔离旧 batch0 路径 |
| `vfx-ltk/index.json` / `vfx-ltk-index.delta.json` | 保留现有 systems/assets/skills、Tristana 登记；新增六名英雄登记 |
| `manifest.json` / `manifest.delta.json` | 原 manifest 逐字节保留，增量为空：现有 Jinx 已为 W/E/R，LTK 发现不依赖 manifest.effects |
| `precache.json` / `precache.delta.json` | 合并清单与本批增量；保留旧项，仅更新 LTK 根索引项 |
| `release-summary.json` / `validation.json` / `build-budget.json` | 文件数、摘要、CPU 和体积证据 |
| `upload-commands.sh` | 可审阅的完整上传命令，尚未执行 |
| `verify-remote.py` / `verify-urls.txt` | 发布后只读 GET，逐文件核对长度、SHA-256 与 JSON |

预期 **1,532 个载荷文件 → 6 个子索引 → 1 个根索引 → 2 份清单**，共 1,541 个发布路径；LTK 共 1,539 个文件，precache 合计 4,717 项。没有新增 packs，新增项沿用逐文件预下载。完整 LTK 闭包约 160.84 MiB，具体字节和摘要见 release-summary.json。

基线 SHA-256（生成前已只读取得并核对）：

```text
c70837476b0ecf586c7a57b735bc07a6153d837f57018d50cd18f1b01b359d28  manifest.json
5a3429ddf48cb86e7a7de57b546ac4a8a1b4eed8fd219fb51d529e4cc7b79d89  precache.json
bdc2ca200ef05235aac5c7cbed62c8dcfac4b2e719fd5065f67625947089e1fb  vfx-ltk/index.json
```

Claude 先部署合并后的匹配前端，再审阅并执行 stage 内 `upload-commands.sh`。脚本会先校验本地清单及远端基线，在载荷传完后再次核对远端基线；若 batch1 已发布则中止，应取最新清单重新合并，保留双方的 champions 和 precache 项。上传顺序如下，所有 rsync 均无 `--delete`：

```bash
VFX_B2_STAGE=/home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/vfx-batch2-stage
# 必须先通过 upload-commands.sh 中的 SHA 前置检查；以下为其中的上传主体。
rsync -aiv --exclude='index.json' "$VFX_B2_STAGE/vfx-ltk/batch2/" tencent:/srv/cat-playtest-v20/assets3d/vfx-ltk/batch2/
rsync -aiv --include='*/' --include='index.json' --exclude='*' "$VFX_B2_STAGE/vfx-ltk/batch2/" tencent:/srv/cat-playtest-v20/assets3d/vfx-ltk/batch2/
rsync -aiv "$VFX_B2_STAGE/vfx-ltk/index.json" tencent:/srv/cat-playtest-v20/assets3d/vfx-ltk/index.json
rsync -aiv "$VFX_B2_STAGE/manifest.json" "$VFX_B2_STAGE/precache.json" tencent:/srv/cat-playtest-v20/assets3d/
ssh tencent 'python3 -' < "$VFX_B2_STAGE/verify-remote.py"
```

校验 URL（服务器内使用 `http://127.0.0.1:5190`；浏览器沿用实际测试服 5173 入口的同源 `/assets3d/`）：

```text
http://127.0.0.1:5190/assets3d/vfx-ltk/index.json
http://127.0.0.1:5190/assets3d/vfx-ltk/batch2/tft13_jayce/index.json
http://127.0.0.1:5190/assets3d/vfx-ltk/batch2/tft13_lieutenant/index.json
http://127.0.0.1:5190/assets3d/vfx-ltk/batch2/tft13_viktor/index.json
http://127.0.0.1:5190/assets3d/vfx-ltk/batch2/tft13_jinx/index.json
http://127.0.0.1:5190/assets3d/vfx-ltk/batch2/tft13_missmage/index.json
http://127.0.0.1:5190/assets3d/vfx-ltk/batch2/tft13_warwick/index.json
http://127.0.0.1:5190/assets3d/vfx-ltk/batch2/tft13_viktor/systems/c4ef93f3.json
```

远端验证脚本共核对 1,541 个 GET，并发 4；完整 URL 表见 `verify-urls.txt`。本次没有执行此远端脚本。素材发布完须刷新旧页面，然后自然测试：Jayce 两形态及 Forge；Sevika 三技能和头奖；Jinx 连续 W/E/R；Mel 至少三次和救命；Viktor 普攻及全屏；Warwick 嗜血和死亡后吞噬。检查 Network 无 404、shader 无错误、切战斗/观战后 queued/active 清零。

本地重建与验证命令：

```bash
node scripts/assets3d/stage-vfx-batch2.mjs
node scripts/assets3d/verify-vfx-batch2-stage.mjs
npm test -- tests/vfx-ltk-*.test.ts tests/rendering3d-playtest-effects.test.ts tests/rendering3d-jayce-forge.test.ts tests/rendering3d-isolation.test.ts --maxWorkers=4 --configLoader=runner
npm run typecheck
npx vite build --configLoader=runner
```

## 【风险】

- 6 个同时运行系统的硬预算不变；多英雄同帧、满屏多目标、其他效果占槽时仍可能丢层。`play=true` 代表完整排队，不能等同所有层最终在 GPU 出现。
- Viktor 展示伤害事件没有包来源明细或 actionSeq。现已限制为同一施法者、原施法目标内的后续魔法包，排除真伤灼烧等；同源魔法装备伤害与风暴仍不能仅凭该展示协议精确区分。如果射线和风暴恰在同 tick，会保守等待后续包，仍有延迟/缺失风险。本批未修改 simulation/server 或网络合同。
- 审查提及的 UI chunk 静态 import 是基线已有问题：`assets/ui/unit-panel-*.js` 仍 import 入口和 Phaser，既有隔离测试对 unit-panel 有例外。本批未修改该边界；2D 体积和 3D 按需加载检查通过不等于“UI chunk 无 import”要求通过。
- 片段时间、尺寸和缺失骨点的根节点回退仍需逐英雄 GPU 校准。Mel 原始 surface 辅助层没有擅自近似或放宽 system-budget。
- 双批次必须顺序发布根索引/precache。SHA 前置检查能拦截已发生的并发变更，不能替代跨发布者协调；未知远端变更不得直接覆盖。
- 160.84 MiB 是独立本地/测试服 3D 素材，不进入 Git，也不进入 2D 首屏；首次逐文件下载/解码成本尚未做 GPU 性能验收。
