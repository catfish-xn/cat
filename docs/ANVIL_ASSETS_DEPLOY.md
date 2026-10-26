# 14.24 原版散件 / 成装锻造器部署

本任务获准使用原版素材。模型、贴图、骨骼、动作、图标、提取源文件、缓存和截图全部只放 git 忽略的 `assets3d-local/`；不得强制添加到 git。仓库仅保留转换/验证脚本、索引合并逻辑、接线、测试和本文档。没有改动 simulation、规则或数值，也没有执行 git 提交或服务器切换。

## 离线重建

需要 Node 22.12+、本项目已有依赖（含 glTF Transform、meshoptimizer、ktx2-encoder）及 GNU tar。脚本不会联网获取素材。

先把授权的 14.24 缓存中的三样文件**复制**到当前工作区，不通过软链接写回原目录：

```bash
mkdir -p assets3d-local/trial/local/hashes
cp "<CACHE>/14.24.manifest" assets3d-local/trial/local/
cp "<CACHE>/hashes/hashes.game.txt" assets3d-local/trial/local/hashes/
cp -r "<CACHE>/chunks" assets3d-local/trial/local/
node scripts/assets3d/anvil-models.mjs \
  --source assets3d-local/trial/local \
  --base "<V9_ROOT>" \
  --out assets3d-local/anvil-delta
```

`<V9_ROOT>` 为带完整载荷及 manifest/precache/ui-assets.json/packs 的部署根只读副本。本次使用任务指定的 `test-server-v8`；其 manifest/precache 与 v9 一致。脚本固定验证源 manifest SHA-256 为 `c080631bd377f60730d979b48807a49f86070517e85b7bafdc32c8666fee7a14`，从 TFTCommon / TFTSet13 WAD 索引按精确原路径提取，不选择 Double Up 变体，不下载缺块；缺块直接报错。

输入与输出不得重叠。重复运行会生成新的 `build-*` / `root-*` 目录，更新 `delta/`、tar 和 report，不删除旧目录。`report.json.localRoot` 给出本次完整浏览器验收根；`report.json` 记录源文件哈希、基础索引哈希、模型规格、输出哈希和字节数。旧工作目录可在确认不用后人工清理。

原版来源：

- Component：`assets/characters/tft_armorykeycomponent/skins/base/armorykey_a.skn` / `.skl`。
- Completed：`assets/characters/tft_armorykeycompleted/skins/base/armorykey_b.skn` / `.skl`。
- 共用 Component 的 `skins/base/tft7_armorykey.tex` 和 `skins/base/animations/armory_a_idle1.anm`。
- 各自 `assets/characters/<character>/hud/<character>_square.tex` 转为 128×128 PNG。
- 各自 `data/characters/<character>/skins/skin0.bin` 提供官方 `skinScale`（两者均约 1.1）。

转换复用现有 makeModel：镜像 X、Y 向上、骨骼绑定、底部落地、自包含 GLB。压缩复用 `compressAssets`：meshopt medium、ETC1S KTX2（quality 128 / effort 2）、动画 resample。两模型均保留 3 骨骼及约 0.3 秒 idle，运行时由现有 UnitAnimationMixer 循环；使用现有单位 envelope / grounding / width-cap，不添加视觉缩放特例。

## 交付文件

增量包：`assets3d-local/anvil-delta/anvil-assets-delta.tar`，**1,013,760 字节（990 KiB）**。
SHA-256：`c581fdec1b453031ccc10eae409ce8b6b4cb319a9d6c055bae0a99a0747c996a`。
以下 7 个文件是 tar 的完整内容；路径相对于部署根（也存在于本地 `anvil-delta/delta/`）：

| 路径 | 字节 |
| --- | ---: |
| `anvils/models/TFT_ArmoryKeyComponent.glb` | 67,068 |
| `anvils/models/TFT_ArmoryKeyCompleted.glb` | 84,936 |
| `anvils/icons/TFT_ArmoryKeyComponent.png` | 11,661 |
| `anvils/icons/TFT_ArmoryKeyCompleted.png` | 14,202 |
| `manifest.json` | 136,142 |
| `precache.json` | 679,053 |
| `ui-assets.json` | 7,807 |

模型与图标新增载荷合计 177,867 字节。tar 不包含源文件、转换中间产物、截图、旧载荷或 pack；不需要向仓库或公开 2D 站点复制图片。

合并保留全部旧 manifest 字段（effects、动作映射、boards 等）、旧模型和旧 UI 条目。模型键严格为 `TFT_ArmoryKeyComponent` / `TFT_ArmoryKeyCompleted`；UI 条目为 `kind: champion`、同 ID。precache 追加四个新载荷并更新 `ui-assets.json` 自身哈希，再按路径排序。本机已实跑重复构建，tar SHA-256 一致（见 `repeat-verification.json`）。相同输入重复运行的部署文件和 tar 字节一致；build/report 里的工作路径允许不同。

**pack 兼容说明：**基础 precache 与 `packs/other.bin` 中含旧版 ui-assets.json；本次更换 UI 索引后，旧 pack 的这一个切片不可再使用。客户端 `readPackList` 仅对 `ui-assets.json` 的版本变化跳过旧切片，让新清单走单文件、按新哈希校验；模型/特效不一致仍拒绝 pack。整个 pack 原哈希、边界、重复路径检查照旧。因此部署必须同时包含本 PR 的客户端代码。旧客户端仍能按文件下载，但会因旧 UI pack 元数据不同而放弃 packs；无需重建或覆盖 packs.json。

## 服务器覆盖、切换与回滚

以下是运维执行步骤；本任务没有操作线上服务器。占位路径须替换为实际版本目录。不要直接在正在服务的 v9 根上解压，不要覆盖不同基线的索引。

1. 上传 tar 和本地 `report.json`；先核对 tar 的 SHA-256 和 `tar -tf` 的上述 7 路径。确认当前根的三个索引与 report.base 完全相同，否则基于该实际根重新生成增量：

```bash
python3 - "<V9_ROOT>" "<REPORT_JSON>" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
for name, expected in json.load(open(sys.argv[2]))['base'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
print('base indexes match')
PY
```

2. 创建尚不存在的版本副本，解压覆盖；复制必须保留旧载荷与 packs。不要用硬链接副本，避免覆盖索引时影响 v9：

```bash
test ! -e "<ANVIL_ROOT>"
cp -a "<V9_ROOT>" "<ANVIL_ROOT>"
tar --no-same-owner -xf "<ANVIL_TAR>" -C "<ANVIL_ROOT>"
```

3. 切换前验证新根的所有 precache 载荷，模型映射和图标可通过 HTTP 读取：

```bash
python3 - "<ANVIL_ROOT>" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
for row in json.loads((root / 'precache.json').read_text())['files']:
    data = (root / row['path']).read_bytes()
    assert len(data) == row['bytes'], row['path']
    assert hashlib.sha256(data).hexdigest() == row['sha256'], row['path']
manifest = json.loads((root / 'manifest.json').read_text())
ui = json.loads((root / 'ui-assets.json').read_text())
for suffix in ['Component', 'Completed']:
    key = 'TFT_ArmoryKey' + suffix
    assert manifest['models'][key]['animations']['idle'] == 'idle'
    assert any(a['kind'] == 'champion' and a['id'] == key for a in ui['assets'])
print('payload hashes, models and icons verified')
PY
```

4. 用桌面 Chromium 打开 `?render=3d&assets3d=<NEW_ROOT_URL>/` 验收（URL 参数需编码），检查模型、悬停及商店。跨域素材根保留既有 CORS、GLB/KTX2 MIME 和缓存配置。推荐切换到新的版本 URL，并完整刷新页面，避免内存中只加载一次的 UI 清单仍指向旧根。现有构建变量为 `VITE_ASSETS3D_BASE`；正式切换沿用现有部署入口配置，不向公共 `/cat/` 添加素材。若服务器已有 `current` 软链接，也可在副本验证后以临时软链接 + rename 原子切换；仅对已确定为软链接的发布指针操作。
5. 保留 v9 完整根及旧客户端发布版本。回滚时把素材 URL / 发布指针恢复到 v9，并重新加载页面；若同时发布了客户端，也可一并切回旧客户端版本。不要把旧三个索引覆盖回新根来冒充回滚。

## 代码与验证

- `scripts/assets3d/anvil-models.mjs`：离线提取、模型与图标转换、压缩、清单合并、本地完整根与确定性 tar。
- `scripts/assets3d/anvil-browser-review.mjs`：通过 `require(process.env.CODEX_BROWSER_CLIENT).connect()` 使用已提供的单一 Chrome，关闭 context 后断开；绝不自行启动浏览器。
- `choice-fallback.ts` / `strategy-panel.ts`：4 选 1 标题栏读取匹配的可选根图标；缺条目不增加图标，图片失败则移除。卡片仍是原来的装备、命令与按钮。
- 既有 `unit-model.ts` / placeholder-renderer 的两键映射及 idle 接线、`anvil-display.ts` / unit-card 的原版图标优先逻辑已满足需求，不增加重复模型规则，也没有从 3D 模块值导入 2D 模块。
- `asset-preload.ts`：上述旧 UI pack 切片兼容。

```bash
npm test -- tests/assets3d-anvil-models.test.ts tests/rendering3d-anvil-model.test.ts \
  tests/anvil-display.test.ts tests/assets3d-unit-scale.test.ts tests/rendering3d-preload.test.ts \
  --maxWorkers=2 --configLoader runner
npm run typecheck
node scripts/assets3d/anvil-browser-review.mjs
```

`--configLoader runner` 用于本环境只读共享 node_modules，避免 Vite 向其中写临时配置。浏览器命令需要 Claude 通过 codex-browser 入口提供环境；未提供时脚本直接报错，不自行启动 Chrome。验收启动独立 Vite 页面，假 BoardFeed 挂载生产 mountRenderer3d，调用生产商店渲染方法与棋子详情正文，动作回调只记录，不运行对局或更改规则。为限制资源，只预加载两种模型和参考英雄 Sett；载荷读取生成的完整根，同时使用完整 manifest/precache/packs 验证 pack 兼容：保留 7 个 pack、2,834 个原载荷切片，仅跳过旧 UI 清单切片；未执行全根浏览器预加载或真实八人对局。

本次结果：相关 5 文件 40 测试通过；解包副本全部 **2,839** 个 precache 载荷哈希通过，原 **95** 模型映射不变。浏览器记录模型均非占位、世界缩放约 0.484、落地偏移接近 0、idle 持续跨越 6 个周期；商店与详情各自原图均成功解码，四个按钮为 270×92 px，点击返回原 choiceId / generation / optionId。

截图与证据均不入库：

- `assets3d-local/anvil-shots/anvil-original-component.png`（143,436 字节）
- `assets3d-local/anvil-shots/anvil-original-completed.png`（143,402 字节）
- `assets3d-local/anvil-shots/review-report.json`（含动作、尺寸、图标 URL、点击与完整 pack 兼容结果）
- `assets3d-local/anvil-delta/unpack-verification.json`（全根哈希与 tar 清单）

本地 Vite HMR WebSocket 被提供的 Chrome 的 Local Network Access 检查阻断；它与素材 HTTP 请求、模型渲染或选择命令无关，记录在 review-report.consoleErrors。页面 JS 错误和素材请求失败均为零。没有执行 vite build、rendering3d-isolation 或全套测试；线上根的实际权限、CORS、发布指针及最终视觉验收仍需部署时确认。
