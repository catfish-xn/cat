# vfxb1：v26 开局常见英雄 LTK 第 1 批

【完成英雄】

本地分支 `claude/v26-vfx-batch1`，基线 `4baaaf5a9a74335d46fa0e037a93e4e595f05384`。8 名英雄的原始系统／转换素材出包，主触发路径已接线；本任务没有提交、执行上传或修改 simulation/server。按用户本轮同步，413 个载荷已由 Claude 上传；8 份子索引、根索引和清单待 v26 前端部署时发布。

| 英雄 | 本批接线 | 系统 / 转换资产 / 子目录文件数 |
| --- | --- | --- |
| Amumu | 无 cast 的 W 被动：同拍伤害目标去重，一次本体脉冲、主目标火花、各目标命中；普通攻击独立 | 5 / 18 / 24 |
| Zeri | 普通 BA 与每第三次已观察攻击的 ChargedAttack_Beam/Tar 分开，无需 cast | 5 / 22 / 28 |
| Draven | 自身 Q 激活／武器增益；后续普攻使用 Q_mis、Q_spinning_tar，施法时不再向自身发飞斧 | 9 / 55 / 65 |
| Lux | 权威友方收盾者与自盾两种形态；下一次普攻使用 P 武器／命中，随后恢复普通 BA | 8 / 41 / 50 |
| Leona | 空目标 cast 只挂本体 W；在 cast 后 60 tick 的 damage-reduction 到期事件爆炸，并接该拍实际伤害目标；无敌人仍播自身爆炸 | 5 / 63 / 69 |
| Nocturne | 自身 P 增益；已观察施法后 6 秒内普攻播 cleave／tar，施法时不再把命中放在自己身上 | 9 / 59 / 69 |
| KogMaw | 自身嘴／眼／身体 W；每次普攻保留 BA 弹道并接额外魔法命中，施法不再播 Q 朝自己飞行 | 8 / 44 / 53 |
| Twitch | 自身 R 起手／武器；之后 8 次普攻用 R 弹道／穿透命中，目标读取同拍权威物理伤害收件人 | 8 / 54 / 63 |

复用 `/tmp/vfx4-set13/tft13_*` 中 vfx-tool 已有导出，原始系统 JSON 和转换载荷按子索引闭包逐字节复制；仅重新生成上述英雄的显示时间线。没有修改原始粒子定义来绕过 loader。

暂存根：`/home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/vfx-batch1-stage/`。

- `vfx-ltk/`：**413 个载荷文件（57 系统＋356 转换资产）＋8 子索引＋1 根索引＝422 文件，34,556,678 字节**。
- 根索引保留原 47 个直接系统、229 个资产及 skills、Tristana 注册，只增加 8 个英雄注册；每英雄仍受原索引限额约束。
- `manifest.json` 与线上基准逐字节一致；`manifest.delta.json` 为 `{}`。LTK 走固定 `vfx-ltk/index.json`，无需向旧 `manifest.effects` 填伪条目。
- `precache.json` 为合并全量；`precache.delta.json` 含 422 条新增／替换记录，其中根索引替换旧记录。因此 **3,179 → 3,600 项，净增 421**；其余 3,178 条原记录完整保留。新总缓存载荷 145,857,387 字节。
- `summary.json` 含每英雄文件数、源子索引 SHA-256 和输出摘要；`payload-files.txt`、`child-index-files.txt` 用于分阶段上传；`verify-upload.py` 用于上传后只读 HTTP 核验。

Opus 小修后复验：相关 LTK、真实渲染器追帧／清理、facing、旧手感、Jayce 锻炉、动作序列与 3D isolation/mode/death 合计 **22 文件／210 测试**通过（`--maxWorkers=4`）。其中 LTK **13 文件／101 测试**，追帧／清理 **34 测试**。类型检查通过。真实素材经当前 loader、真实 PNG 解码、LTKG/LTKS/LTKA reader 和 CPU 粒子时间线验证：**422 文件哈希、57 系统、23 形态全部通过**，没有放宽预算、断言或超时。

小修后生产构建的 **2D gzip-9＝630,527 字节 ≤ 637,144**；2D 静态依赖无 3D chunk，新增 `batch1-events.ts` 只位于 `assets/3d/render3d-DnecYnHO.js`。明细：本机 `artifacts/vfx-batch1/2d-size/modules.json`。

复验命令（依赖为只读共享 symlink，`--configLoader=runner` 避免向 node_modules 写临时配置）：

```bash
npm run typecheck
npm test -- tests/vfx-ltk-*.test.ts --maxWorkers=4 --configLoader=runner
npm test -- tests/rendering3d-catchup.test.ts --maxWorkers=4 --configLoader=runner
node scripts/assets3d/stage-vfx-batch1.mjs /home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/vfx-batch1-stage
node_modules/.bin/esbuild scripts/assets3d/verify-vfx-batch1.ts --bundle --platform=node --format=esm --packages=external --outfile=artifacts/vfx-batch1/verify.mjs
node artifacts/vfx-batch1/verify.mjs /home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/vfx-batch1-stage
node scripts/audit-2d-size.mjs --out=artifacts/vfx-batch1/2d-size --dist=dist
```

【未完成及原因】

- 可选的 Maddie、Violet、Vex、Powder 未纳入本批；优先完成 8 名主范围英雄的自然事件与渲染器集成验收。
- 没有浏览器／GPU 实图验收：当前无 `CODEX_BROWSER_CLIENT` / `PLAYWRIGHT_WS_ENDPOINT`。按项目要求，须由 Claude 使用 `codex-browser exec` 新开浏览器测试任务；本次未自行启动 Chromium。
- Zeri 完整弹射链、Draven 回斧／接斧落点与轨迹、Nocturne 逐个流血邻敌反馈，尚未还原。本批先覆盖每次攻击都会出现的主弹／主命中／强化形态。
- 原版音频、动画图精确时钟、Lux 护盾提前破除的完整寿命同步仍未接入。普通攻击骨骼／起手帧读取导出；飞行、停发射、尾迹时长为显示约定，不能据 CPU 可启动认定画面完全等同原版。

【前端改动】

- `src/rendering/three-mode/vfx-ltk/batch1-events.ts:18`：只读已观察事件的显示记忆；强化攻击、自盾、被动和结束阶段选择；追帧推进、重复事件去重、跨轮清空。14.24b 的 3 次、8 发、3 秒／6 秒只用于显示选择，不计算伤害、支付或结算。
- `src/rendering/three-mode/vfx-ltk/batch1-timelines.ts:20`：8 英雄的原系统 ID、动作／形态、挂点、显示时序；只用于本地生成子索引，不加入 2D。
- `src/rendering/three-mode/vfx-ltk/timeline.ts:2`、`loader.ts:118`：增加 `passive/end` 动作和 `empowered/self` 形态，并严格校验；原 128 系统、2,048 资产、12 cue 上限不变。
- `src/rendering/three-mode/vfx-ltk/runtime.ts:35`：每次只选择完整的一个形态，失败维持整动作回退；`:55` 在增益结束／重施法时释放旧槽位，避免旧增益挤掉爆炸。6 系统／1,500 粒子／64 排队上限不变。
- `src/rendering/three-mode/placeholder-renderer.ts:611`、`:1109`：在现有 3D 事件入口接线，状态到期在动画过滤前处理；原始账本和传入事件不变。
- Opus 小修：`completed === false` 的提前退出只适用于上述 8 名英雄，由 `batch1-events.ts` 的 `skipCast` 标记控制；其他英雄沿用原有特效、lunge、cast-index 轮换和 Jayce 锻炉动作路径。batch1 的失败施法仍交给动画状态消费，但不推进强化形态或触发完成施法效果。
- `eventSeq <= lastSeq` 只抑制 batch1 的 VFX 选择／显示记忆更新，不再跳过整个渲染事件循环：动画消费、死亡 `stopUnit`、lunge 启动／取消和通用 cast-index 继续执行。序号回退本身无法区分重复投递与回放重启，因此特效形态仍须由现有 `clearEffects()` 边界重置；未清空前，动画与清理继续、旧序号不重播 batch1 VFX。新增逐英雄真实渲染器回归，覆盖相同序号与回退序号，以及批外失败施法的特效／cast-index 保持原行为。
- 新增 `tests/vfx-ltk-batch1*.test.ts`，扩充 `tests/rendering3d-catchup.test.ts`；新增 `scripts/assets3d/stage-vfx-batch1.mjs`、`verify-vfx-batch1.ts`。没有删改既有断言或提高测试超时。

【上传命令】

**以下命令本任务均未执行，由 Claude 执行；载荷步骤已由 Claude 先行完成，可跳过或幂等复传。发布子索引／根索引前，先发布本分支 v26 前端。**旧前端不认识新动作／形态；只传素材不能完成本批接线。随后依次发布子索引、根索引、清单。无需更新 packs.json、旧大包或 action-bindings.json。

以下只包含素材增量发布；实际前端部署沿用 Claude 现有测试服流程。

```bash
set -euo pipefail
VFX_B1_STAGE=/home/aiapps/workspcae/cat-cx-uiassets/assets3d-local/vfx-batch1-stage
# 任一基准已变即停止，重新合并；不可跳过校验继续覆盖。
ssh tencent 'cd /srv/cat-playtest-v20/assets3d && sha256sum manifest.json precache.json vfx-ltk/index.json' | cmp - "$VFX_B1_STAGE/baseline.sha256"
# 1. 413 个载荷；files-from 不包含任何索引，也不包含本地报告／基准文件。
rsync -aiv --files-from="$VFX_B1_STAGE/payload-files.txt" "$VFX_B1_STAGE/vfx-ltk/" tencent:/srv/cat-playtest-v20/assets3d/vfx-ltk/
# 此处开始前须已部署本分支前端；2. 八个英雄子索引。
rsync -aiv --files-from="$VFX_B1_STAGE/child-index-files.txt" "$VFX_B1_STAGE/vfx-ltk/" tencent:/srv/cat-playtest-v20/assets3d/vfx-ltk/
# 前端发布／载荷传输期间若有其他素材发布，这里再次阻止覆盖已变化的清单。
ssh tencent 'cd /srv/cat-playtest-v20/assets3d && sha256sum manifest.json precache.json vfx-ltk/index.json' | cmp - "$VFX_B1_STAGE/baseline.sha256"
# 3. 最后开放根索引登记，再更新下载清单；不带 --delete。
rsync -aiv "$VFX_B1_STAGE/vfx-ltk/index.json" tencent:/srv/cat-playtest-v20/assets3d/vfx-ltk/index.json
rsync -aiv "$VFX_B1_STAGE/manifest.json" "$VFX_B1_STAGE/precache.json" tencent:/srv/cat-playtest-v20/assets3d/
# 只读 GET 全部 422 个 LTK 文件以及 manifest/precache，校验长度、SHA 和 JSON。
ssh tencent 'python3 -' < "$VFX_B1_STAGE/verify-upload.py"
```

预期传送选择集：**413＋8＋1＝422 个 LTK 文件**，另 2 份顶层清单；manifest 字节不变，rsync 可能跳过。HTTP 核验成功输出 `Verified HTTP files: 424`。可给 rsync 加 `--dry-run` 预览。

远端 HTTP 核验 URL 基准为 `http://127.0.0.1:5190/assets3d/`（仅在服务器执行）；桌面浏览器沿现有 5173 同源 `/assets3d/` 访问。以下都应为 200 且 JSON 可解析：

```text
/assets3d/vfx-ltk/index.json
/assets3d/vfx-ltk/tft13_amumu/index.json
/assets3d/vfx-ltk/tft13_zeri/index.json
/assets3d/vfx-ltk/tft13_draven/index.json
/assets3d/vfx-ltk/tft13_lux/index.json
/assets3d/vfx-ltk/tft13_leona/index.json
/assets3d/vfx-ltk/tft13_nocturne/index.json
/assets3d/vfx-ltk/tft13_kogmaw/index.json
/assets3d/vfx-ltk/tft13_twitch/index.json
/assets3d/vfx-ltk/tft13_zeri/systems/d160dfa9.json
/assets3d/vfx-ltk/tft13_leona/systems/dda108d2.json
/assets3d/manifest.json
/assets3d/precache.json
```

预期 SHA-256：

```text
manifest.json      c70837476b0ecf586c7a57b735bc07a6153d837f57018d50cd18f1b01b359d28
precache.json      bad93b84d7d435d14de89e5ea805f404e81e74206364a6d82aa2bbc4bc6800c5
vfx-ltk/index.json d6cff7da5166161260c071d0a17cef23ab14ac658e0240fab4812e8186ee4796
```

进入页面合并参数 `?mode=online&server=ws&render=3d&assets3d=/assets3d/&debug3d=1`。发布后刷新旧页面，再检查自然战斗中连续普攻／施法、Network 无 404、控制台无 shader 错误；手动 `__render3d.ltk.play()` 只验证管线，不能替代自然动作验收。

【风险】

- **来源归因仍有限制。**在线 packetDamage 只有 owner/目标／类型，没有 sourceDefinitionId、actionSeq、delivery；Amumu 当前保守跳过同拍有普攻的 W，可能漏该拍真实被动，非普攻来源的装备／羁绊魔法伤害也可能误归因。Twitch 同拍物理附伤可能混进穿透目标；主弹只沿首个收件人飞行，完整直线终点并未恢复。已在 UI_REQUESTS 记录补充只读来源／形态字段的需求，本批没有修改协议或规则来掩盖缺口。
- 从战斗中途接入且缺少之前完整攻击／施法历史时，强化形态显示可能偏移；重连／迟到数据需后续权威形态投影。
- Lux 盾为固定 4 秒显示，未按提前破盾停播；原 runtime 对已死亡／移除目标保留整动作回退或取消策略，致死命中可能少显示。6 系统上限与长增益共用预算，混战仍可能丢层；本批没有提高预算来隐藏此问题。
- GPU 原材质观感、尺寸和时序尚待桌面 Chromium 验收；不能把载荷／CPU 验证通过当作完整原版还原。
- 本工作树开始就存在未跟踪 `assets3d-local` 符号链接；它与素材均未加入 Git。生成的 dist/artifacts 亦未提交。后续提交由 Claude 另审文件列表。
