# v26 技能特效第 3 批交付

【完成英雄】

Sion（`g23-sion`）、Silco、Elise、Illaoi、Swain、Rell、Loris 的 LTK 子索引、原始系统 JSON、转换纹理/网格/骨骼/动画已暂存。**这是本地资源与接线交付，未上传，未宣称测试服或 GPU 已验收。**

工作树 `claude/v26-vfx-batch3`，起点 `4baaaf5a9a74335d46fa0e037a93e4e595f05384`；未提交、未写 Git，未修改 simulation/server。初始已有的 `assets3d-local` 是指向外部素材目录的未跟踪符号链接，没有把素材写入源码目录。

暂存根：`/home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/vfx-batch3-stage/`。

| 英雄 | 系统/转换资产 | 已接展示阶段 |
| --- | --- | --- |
| Sion | 18 / 167 | 原版 Cabal 锁链、解缚、蓄力/重击、盾、复活；模型绑定 `cabal_idle`、解缚与复活后 spell4 动作 |
| Silco | 7 / 63 | 罐子弹道/落点，4/8 个原模型畸变体显示代理；实际伤害事件触发代理攻击，整组共用一个 buff 点缀 |
| Elise | 11 / 96 | 前后排分流；新增前排原版蜘蛛形态、小蜘蛛模型；后排蜘蛛沿真实收据目标显示并爆炸 |
| Illaoi | 9 / 62 | 自身起手、持续形态；实际真伤端点的附着吸取连线，减伤结束同 tick 的猛击 |
| Swain | 12 / 57 | 前排升华/后排群鸦分流；实际吸取/治疗脉冲维持升华显示 |
| Rell | 9 / 55 | 自身盾与实际敌方穿刺目标分开；自盾按独立盾层建立/耗尽/到期收尾 |
| Loris | 7 / 59 | 起盾/持续盾；正常到期同 tick 的反击命中；不把普通魔法伤害都画成反击 |

七个目录使用独立命名空间 `vfx-ltk/batch3/tft13_*/`，没有平铺根 systems，也没有覆盖第 0 批的 Jinx/Vi/Tristana。两个新增模型在 `models/vfx-elise-front/`、`models/vfx-elise-spider/`；原版 skinScale 已登记。补齐的两个原 mesh 是 `Karthus_Skin17_R_Lighting_Cyl.sco` 与 `Xerath_DI_Blastring.TFT_Set12.sco`，均从固定 14.24 的 TFTSet13 WAD 找回，没有替换成近似形状。Sion 的少量缺失共享贴图按固定 RMAN 的 CDN chunk 范围补齐并校验，未改原始缓存。

共 **640 个 LTK 文件（73 系统、559 转换资产、7 子索引、1 根索引）+ 2 个 GLB**。上传第一步是 **641 个载荷文件、62,092,665 字节（约 59.2 MiB）**；最后 3 份元数据，总计 **644 个发布文件**。基准 precache 3,179 项，合并后 **3,820 项**；其他批次先发布时，重新合并后的总项数会增加。

`index.delta.json`、`manifest.delta.json`、`precache.delta.json` 是纯增量；`vfx-ltk/index.json`、`manifest.json`、`precache.json` 是以用户指定基准合成的完整版本。`summary.json`、`delivery-files.json`、`source-provenance.json`、`validation.json` 分别记录统计、逐文件摘要、来源和真实 CPU loader 验证。`baseline/` 是只读取得的服务器原清单；`source-tools/` 保留本轮缓存恢复/模型构建命令源文件，不属于上传范围。

基准 SHA-256：

- manifest：`c70837476b0ecf586c7a57b735bc07a6153d837f57018d50cd18f1b01b359d28`
- precache：`5a3429ddf48cb86e7a7de57b546ac4a8a1b4eed8fd219fb51d529e4cc7b79d89`
- LTK 根索引：`bdc2ca200ef05235aac5c7cbed62c8dcfac4b2e719fd5065f67625947089e1fb`

本批完整合成版本 SHA-256（如并行批次已发布，以 `publish/merge-report.json` 的重合并结果为准）：

- manifest：`018a115f3eee18d165f58113fc14ea6548f91fbf1cc8e28cc4bd059bc10c6ca5`
- precache：`72899deb7dfeeadfbd78f02755230e49466b939c580e9380be8dc1bf75039157`
- LTK 根索引：`5d5a8fcf53b16e3050d6d675e10fab2f423926ee84ae19ca8b2992976f55f6c1`

【未完成及原因】

1. 本环境没有 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`，按 AGENTS.md 未自行启动 Chrome。Claude 需通过 `codex-browser exec` 启动桌面 Chromium 任务，验自然连续施法、模型比例、骨骼挂点、shader 和预算争用。HTTP/CPU 接受不能替代实图验收。
2. 公开 replay 的 `packetDamage` 缺 `actionSeq`、任务/召唤体身份和伤害 source kind。Silco 多次施法重叠时，无法证明某一包属于某只畸变体；现为展示代理，按观察到的包分配动作。Elise 收据没有主蜘蛛/范围受害者的区别，当前按去重收据目标、最多 8 只显示，不能宣称与原版蜘蛛数/路径逐只一致。
3. Swain 没有公开升华截止 tick/助攻延长收据，现按自疗/魔法脉冲续显，停止脉冲后留 1.25 秒尾部，不能保证与领域 buff 精确同 tick 结束。Illaoi 的状态来源未公开；多个减伤来源重叠仍不能逐来源绑定。Loris 盾提前耗尽后，规则的延迟反击没有独立技能身份，当前只在正常盾到期同 tick 识别反击，提前破盾分支未完整接管。
4. Sion 复活复用原版 unleashed smoke/cast 和模型 spell4 阶段，并无独立标为 revive 的粒子系统。音频未导出。动态宿主/蒙皮 surface emission 仍明确回退；本批 73 系统均未受其阻断。

以上缺口不在本轮前端伪造目标、读取规则私有任务或重复结算解决。后续所需展示字段列在 `docs/VFX_BATCH3_REPLAY_REQUIREMENTS.md`。

【前端改动】

- `src/rendering/three-mode/vfx-ltk/batch3/{sion,silco,elise,illaoi,swain,rell,loris}.ts:1`：英雄独立时间线；Sion 同文件的 `SionAnimation` 选原模型生命周期动作。
- `src/rendering/three-mode/vfx-ltk/batch3/controller.ts:1`、`proxies.ts:1`：消费只读事件/帧的生命周期与可见代理。没有领域成员、碰撞拾取、血条、命令或伤害回调；死亡、目标消失、重置、减少动态都清理。
- `src/rendering/BoardScene.ts:1428`、`board-feed.ts:17`：只透传战斗快照里的冻结 form；不按移动位置另算形态。
- `src/rendering/three-mode/placeholder-renderer.ts:612`：接线、Elise 模型选择、模型异步请求失效保护。与第 1/2 批主要冲突点集中在初始化、playAction、frame/events/update/clear 的调用行。
- `src/rendering/three-mode/vfx-ltk/runtime.ts:20`：只预热本英雄及其变体、按 variant 原子接管、分组停止、死亡软停止后回收。
- `src/rendering/three-mode/vfx-ltk/loader.ts:193`、`assets/emission.ts:1`、`particles.ts:81`、`timeline.ts:5`：静态 mesh/surface emission 真正加载并按三角形面积取样，连接 driver；新增源到真实目标的附着 `link`。不只是移除拒绝条件；缺文件/不支持的蒙皮仍失败回退。
- `scripts/assets3d/vfx-batch3-skn.mjs:1`：EliseSpiderling 原始 SKN v2 的无损 v4 包装；原 v4 inspector 保持严格。其余三个脚本负责 staging、校验与并行清单合并。

验证：本批实际资源 **73/73** 被真实 loader 接受，并逐系统执行 CPU 粒子驱动；**644/644** 文件摘要正确，全部旧模型/效果/根索引/其他 precache 条目保留。相关 Vitest 使用 `--maxWorkers=4`，无断言删除/弱化，无超时提高。模型格式检查通过。最终类型检查、构建与相关测试结果见下方交付验证记录；本地 `node_modules` 为只读链接，Vite/Vitest 使用 `--configLoader runner` 和 `/tmp` 缓存绕过临时文件写入问题，没有改项目配置。

【上传命令】

**下面命令本轮没有执行。先由 Claude 集成本分支与第 1/2 批的前端改动、发布新前端，再发布素材。v25 loader 不识别 `link`，单传素材不等于完整接入。**

```bash
bash /home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/vfx-batch3-stage/UPLOAD.sh
```

脚本全文在该 staging 根中，可直接审查；核心传输顺序是：

```bash
VFX_B3_STAGE=/home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/vfx-batch3-stage
# 先 641 个载荷；files-from 只列本批载荷，明确不含根索引/完整清单。
rsync -aivR --files-from="$VFX_B3_STAGE/payload-paths.txt" "$VFX_B3_STAGE/" \
  tencent:/srv/cat-playtest-v20/assets3d/
# 中间：只读拉取最新三清单，prepare-vfx-batch3-upload.mjs 合并增量，
# 保留其他批次；远端 sha256 再次变化则停止。完整步骤见 UPLOAD.sh。
rsync -aiv "$VFX_B3_STAGE/publish/manifest.json" "$VFX_B3_STAGE/publish/precache.json" \
  tencent:/srv/cat-playtest-v20/assets3d/
rsync -aiv "$VFX_B3_STAGE/publish/vfx-ltk/index.json" \
  tencent:/srv/cat-playtest-v20/assets3d/vfx-ltk/index.json
```

**不要跳过脚本中的 fresh 拉取/合并而直接上传旧完整清单。** 不带 `--delete`；子索引随载荷，根索引最后发布；第 1/2/3 批清单发布应串行。脚本随后只读校验服务器上全部 644 个发布文件的长度与 SHA-256，并检查如下 URL：

- `http://127.0.0.1:5190/assets3d/{manifest,precache}.json`
- `http://127.0.0.1:5190/assets3d/vfx-ltk/index.json`
- `http://127.0.0.1:5190/assets3d/vfx-ltk/batch3/tft13_{sion,silco,elise,illaoi,swain,rell,beardy}/index.json`
- `http://127.0.0.1:5190/assets3d/models/vfx-elise-{front,spider}/model.glb`

花括号为此处列举简写，脚本使用逐个完整 URL；地址是服务器内部 5190，校验经 `ssh tencent` 执行。浏览器仍用现有同源入口 `?mode=online&server=ws&render=3d&assets3d=/assets3d/&debug3d=1`，发布后刷新页面，确认 Network 无 404、WebGL 无 shader 错误。`__render3d.ltk.warm('g23-sion')` 等只检加载；还须检查自然施法，不以手动播放替代。

【风险】

原有六系统/1500 粒子槽预算保持不变，多人盾/升华/锁链同时存在时仍会丢层；未提高资源上限以掩盖。代理上限全场 32 个，单组 8 个。62 MB 新素材逐文件首载有耗时，未改旧 packs。新 mesh 的比例、曲线时序与变形需 GPU 校准。并行分支共享文件的少量接线需 Claude 合并检查。

交付验证记录：相关 **19 个测试文件、168 项测试全部通过**；类型检查通过；干净目录 `/tmp/vfxb3-final-dist` 的生产构建通过。2D 顶层 JS gzip level 9 合计 **630,547 字节 ≤ 637,144**；3D 单独 **338,363 字节**，`index.html` 没有 3D preload。重复构建使用的旧临时目录不用于这组统计。`build-size.json` 保留机器可读记录。发布脚本仅做过 `bash -n` 语法检查，**没有执行 rsync/上传**。
