# v10 3D 素材合并增量部署

本包仅供授权的测试服务器使用。原版模型、贴图、特效和转换数据只放 `assets3d-local/` 或服务器素材根，不提交 Git、不放进公开 2D 站点。本次未执行线上部署或切换。必须使用当前 multiplayer 客户端（至少包含 #440 技能图标、#446 锻造器和 #451 VFX；本包核对的 `origin/multiplayer` 为 `8dc912aa6324f93726f0ce9f6fd1e336441f7ff6`）。此版本也包含旧 UI pack 切片的兼容处理。

## 包与基准

- `assets3d-local/v10-delta/v10-assets-delta.tar`：**519,096,320 字节**，SHA-256 `bed16d46a54bf2d052346d9488241f0a930c566069b7acf92100163d7f998538`。同一 delta 用固定排序、时间和所有者重新打包，两个 tar 字节完全一致。
- 包含新载荷：锻造器模型 **2**、锻造器图标 **2**、技能图标 **63**、VFX 文件 **5,590**（含根目录、63 个英雄子索引及其引用的系统和资源），另替换 3 个合并索引。`delta/` 内容与 tar 一致，不含转换源、审计中间文件或旧 packs。
- 以本地只读 `test-server-v8` 为基准，其 manifest/precache 据现有记录与 v9 相同；**必须按下文核对实际线上三个索引，任何一项不符都不能解压此包**。完整基准哈希和计数在 `report.json`。
- 旧模型映射 95 项及旧 UI 条目 16 项保留；新 UI 合计 81 项。新 precache 共 8,492 项，新增载荷均含字节数和 SHA-256，`ui-assets.json` 的哈希已更新；`packs.json` 和旧 packs 未重建，客户端跳过旧 UI 切片并单独读取新版 UI 索引。
- 用户指定的 `/home/aiapps/workspcae/vfx-tool/out/` 实际仅有 Jinx、Vi；63 人完整数据取自 [VFX_SET13_COVERAGE.md](VFX_SET13_COVERAGE.md) 记录的 `/tmp/vfx4-set13` 已审计导出。根目录和每个子索引采用合并后加载器的目录格式，技能映射来自该导出。两份 Jinx/Vi 索引并非同一字节版本；不要将前者覆盖后者。此 scratch 数据不保证长期存在；重建先依该文档复现 63 人导出和审计。

本地实测重复 tar 哈希一致；解包到基准完整副本后，8,492 个 precache 文件逐一校验通过，旧模型映射与 UI 条目不变，7 个旧 pack 被客户端兼容读取。生产 VFX 加载器逐项检查 63 个英雄的 674 个系统，结果与此前审计一致：658 接受（其中 18 个为空定义）、16 拒绝并按客户端既有逻辑回退。此前的技能/普攻覆盖和 5 个缺失原始 `.sco` 等限制见 [VFX_SET13_COVERAGE.md](VFX_SET13_COVERAGE.md)。本次未做线上或逐英雄 GPU 画面验收。

## 上传、核实基准、创建副本

以下命令在素材服务器执行，替换占位路径；不要在服务中的 v9 根上解包，不要使用硬链接副本。先上传 tar 与本地 `report.json`，使用当前 multiplayer 构建客户端；确认测试站实际素材 URL 和服务器根，不能仅凭历史目录推断。

```bash
set -e
V9_ROOT='<实际 v9 素材根>'
V10_ROOT='<尚不存在的 v10 素材根>'
V10_TAR='<已上传的 v10-assets-delta.tar>'
REPORT='<已上传的 report.json>'
printf '%s  %s\n' bed16d46a54bf2d052346d9488241f0a930c566069b7acf92100163d7f998538 "$V10_TAR" | sha256sum -c -
tar -tf "$V10_TAR" | head
python3 - "$V9_ROOT" "$REPORT" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
for name, expected in json.loads(pathlib.Path(sys.argv[2]).read_text())['base'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
print('v9 base indexes match')
PY

test ! -e "$V10_ROOT"
cp -a "$V9_ROOT" "$V10_ROOT"
tar --no-same-owner -xf "$V10_TAR" -C "$V10_ROOT"
```

若真实基准哈希不同，停止并基于真实根重新合并三个索引及全部载荷，不能依次覆盖原来的单功能增量。`tar -tf | head` 在启用 `pipefail` 的 shell 中可因上游 SIGPIPE 返回非零；需要完整列表时直接运行 `tar -tf "$V10_TAR"`。

## 在副本上校验

以下脚本检查每个 precache 载荷、所有旧模型映射和旧 UI 条目、65 个新增图标以及 63 个 VFX 子索引中的全部系统和资源引用；不会替代浏览器画面验收：

```bash
python3 - "$V9_ROOT" "$V10_ROOT" <<'PY'
import hashlib, json, pathlib, sys
old, root = map(pathlib.Path, sys.argv[1:])
def load(p): return json.loads(p.read_text())
def safe(p):
    p = pathlib.PurePosixPath(p)
    assert not p.is_absolute() and all(x not in ('', '.', '..') for x in p.parts)
    return p
oldm, m = load(old / 'manifest.json'), load(root / 'manifest.json')
for key, value in oldm.items():
    if key != 'models': assert m[key] == value, key
for key, value in oldm['models'].items(): assert m['models'][key] == value, key
for suffix in ('Component', 'Completed'):
    key = 'TFT_ArmoryKey' + suffix
    assert m['models'][key]['animations']['idle'] == 'idle'
    assert (root / safe(m['models'][key]['path'])).is_file(), key
pre = load(root / 'precache.json')['files']
assert len(pre) == 8492 and len({r['path'] for r in pre}) == len(pre)
rows = {r['path']: r for r in pre}
for row in pre:
    data = (root / safe(row['path'])).read_bytes()
    assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], row['path']
for row in load(old / 'precache.json')['files']:
    if row['path'] != 'ui-assets.json': assert rows[row['path']] == row, row['path']
ui = load(root / 'ui-assets.json')['assets']
for row in load(old / 'ui-assets.json')['assets']: assert row in ui
assert len(ui) == 81 and sum(r['kind'] == 'ability' for r in ui) == 63
for suffix in ('Component', 'Completed'):
    assert any(r['kind'] == 'champion' and r['id'] == 'TFT_ArmoryKey' + suffix for r in ui)
for row in ui:
    data = (root / safe(row['path'])).read_bytes()
    assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], row['path']
vfx = root / 'vfx-ltk'
cat = load(vfx / 'index.json')
assert len(cat['champions']) == 63
systems = 0
for champion, path in cat['champions'].items():
    sub = vfx / safe(path)
    index = load(sub)
    systems += len(index['systems'])
    for path in (*index['systems'].values(), *index['assets'].values()):
        payload = sub.parent / safe(path)
        assert payload.is_file(), (champion, path)
        assert payload.relative_to(root).as_posix() in rows, payload
assert systems == 674
print('precache, models, UI and VFX references verified')
PY
```

## 浏览器验收、切换和回滚

1. 对新根配置临时 URL；保持现有 CORS、GLB/KTX2 及 JSON 的 MIME、缓存设置。先通过 HTTP 检查 `manifest.json`、`precache.json`、`ui-assets.json`、`vfx-ltk/index.json` 以及一张技能图标和一个锻造器模型可读取。跨域场景检查浏览器控制台和 Network，不能只验证磁盘。
2. 使用桌面 Chromium 打开当前 multiplayer 客户端的 `?render=3d&assets3d=<新素材根URL>/`（参数值按 URL 编码），完整刷新。检查棋盘与旧单位、两种锻造器模型和图标、技能图标、Jinx/Vi 等战斗技能与普攻、断线重连后的显示；留意缺资源、控制台和 WebGL 错误。VFX 首次预缓存需额外下载约 512 MB、5,590 个小文件，评估带宽与冷启动耗时；不支持的系统按既有策略回退。
3. 验收通过后把实际客户端的 `VITE_ASSETS3D_BASE` 或发布入口配置改为新版本 URL，并重新发布/刷新。若现有发布指针**已经确认是软链接**，可在同一目录建立临时软链接，再用 `mv -T` 原子替换该指针；不要对真实目录运行此操作。例如：

```bash
POINTER='<已有的 current 软链接绝对路径>'
test -L "$POINTER"
test ! -e "${POINTER}.next" && test ! -L "${POINTER}.next"
ln -s "$V10_ROOT" "${POINTER}.next"
mv -Tf "${POINTER}.next" "$POINTER"
```

4. 保留 v9 完整根和旧客户端。回滚时将客户端素材 URL 或已确认的软链接指针按同样方式恢复到 v9，完整刷新页面；如客户端也需回退，恢复对应旧版本。不要把旧索引覆盖回 v10 来模拟回滚。实际线上地址、权限、CORS、发布指针和最终画面须由部署时确认。
