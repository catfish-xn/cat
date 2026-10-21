# 3D 上线部署说明（v17 起）

把压缩后的 3D 素材根放到素材服务器上，让公开测试页的 `?render=3d` 能读到。素材和原版数值**绝不进仓库**，也不放进游戏前端的部署目录；本文所有路径、地址都是占位符，照做时换成实际值，不要把实际值写回本文或提交。

| 占位符 | 含义 |
| --- | --- |
| `<COMPRESSED_ROOT>` | 本机最终压缩素材根（含 `manifest.json`、`precache.json`、`action-bindings.json`），见 [ASSETS3D_DEPLOY_ROOT.md](ASSETS3D_DEPLOY_ROOT.md) |
| `<SERVER>` | 素材服务器的 SSH 登录名，如 `user@host` |
| `<SERVER_WEB>` | 服务器上存放静态文件的目录，素材放在它下面的 `assets3d/` |
| `<ASSET_URL>` | 素材根的公网地址，以 `/` 结尾，如 `https://<域名>/assets3d/` |
| `<GAME_URL>` | 游戏页面的公网地址（与 2D 测试版相同） |

素材地址**不加口令**（用户定）。游戏前端和对局服务的部署方式不变，3D 只多一个素材地址。

## 1. 上传前核对素材根

最终根必须是合并后再压缩一次的那个（[ASSETS3D_DEPLOY_ROOT.md](ASSETS3D_DEPLOY_ROOT.md)「压缩顺序」），并且包含后来补的几批：英雄、六个特效批次、野怪、额外素材（河灵、法球、扣血）、施法补选、选秀转盘。在 `<COMPRESSED_ROOT>` 下用 PowerShell 核对：

```powershell
$m = Get-Content "<COMPRESSED_ROOT>/manifest.json" -Raw | ConvertFrom-Json
$p = Get-Content "<COMPRESSED_ROOT>/precache.json" -Raw | ConvertFrom-Json
"模型 $(@($m.models.PSObject.Properties).Count) 个，特效 $(@($m.effects.PSObject.Properties).Count) 个"
"预下载 $($p.files.Count) 个文件，共 $([math]::Round(($p.files | Measure-Object bytes -Sum).Sum / 1MB, 1)) MB"
'little-legend-default','orb-gold','player-damage-tar','carousel-center','pve-krug' | ForEach-Object {
  "$_ : " + ($null -ne $m.models.$_ -or $null -ne $m.effects.$_) }
```

通过标准：预下载约 55 MB；五个键都是 `True`（分别对应河灵、法球、扣血、转盘、野怪）。某项是 `False` 说明那一批没合进来，先按 ASSETS3D_DEPLOY_ROOT.md 把它加进 `--roots` 重建、再压缩，不要上传缺批次的根。

## 2. 上传到服务器

整个根作为一个目录上传，先传到新目录、传完再换名，避免玩家在上传中途读到新旧混杂的文件（哈希对不上的文件会被当作下载失败）：

```powershell
scp -r "<COMPRESSED_ROOT>" "<SERVER>:<SERVER_WEB>/assets3d.new"
ssh <SERVER> "cd <SERVER_WEB> && rm -rf assets3d.old && (test -d assets3d && mv assets3d assets3d.old || true) && mv assets3d.new assets3d"
```

确认服务器上 `<SERVER_WEB>/assets3d/manifest.json` 存在后，`assets3d.old` 可以留一版作回滚。以后更新素材也这样整目录替换；`precache.json` 会随新根一起换，玩家下次打开只重下哈希变了的文件，清单里删掉的文件会从浏览器里清掉。

## 3. 服务器配置

要求只有三条：

1. **跨域**：游戏页和素材不同源，素材的每个响应都要带 `Access-Control-Allow-Origin: *`。
2. **协议一致**：游戏页是 `https://` 时素材也必须是 `https://`，否则浏览器按混合内容直接拦掉，3D 只会显示占位棋子。游戏页是 `http://` 时素材用 http 也能下载和缓存，但浏览器在 http 下不给页面算 SHA-256，只按文件大小校验。**推荐两边都用 https。**
3. **缓存头用 `no-cache`**：浏览器里长期保存靠的是 IndexedDB（按 precache 的 sha256 管版本），HTTP 缓存只需每次向服务器确认（命中时 304，几乎不耗流量）。不要设长 `max-age`：同一路径换了内容时，旧的 HTTP 缓存会让哈希一直对不上。

nginx 示例（`root` 指向 `<SERVER_WEB>`，素材在其下 `assets3d/`）：

```nginx
location /assets3d/ {
    root <SERVER_WEB>;
    add_header Access-Control-Allow-Origin * always;
    add_header Cache-Control "no-cache" always;
    types { model/gltf-binary glb; image/ktx2 ktx2; image/webp webp; image/png png; application/json json; }
    gzip on;
    gzip_types application/json;
}
```

GLB 已经 meshopt 压缩、贴图是 KTX2/WebP，再 gzip 收益很小，只压 JSON。若服务器用 Caddy，`file_server` 加上同样两个响应头即可，Caddy 有域名时会自动申请 https 证书。

上传后在本机核对（任选一个模型路径，从 `precache.json` 里抄）：

```powershell
curl.exe -sI "<ASSET_URL>manifest.json"
curl.exe -sI "<ASSET_URL><precache 里任一 .glb 的 path>"
```

两条都应是 `200`，带 `Access-Control-Allow-Origin: *` 和 `Cache-Control: no-cache`，`.glb` 的 `Content-Type` 是 `model/gltf-binary`。

## 4. 3D 页面怎么带上素材地址

两种方式，效果相同（代码见 `src/rendering/render-mode.ts`）：

- **地址栏参数**（不用重新构建，适合先试）：`<GAME_URL>/?mode=online&server=ws&render=3d&assets3d=<ASSET_URL>`
- **构建时写入**（推荐正式测试用，链接短）：构建前端时设环境变量，之后 `<GAME_URL>/?mode=online&server=ws&render=3d` 就会用它：

  ```powershell
  $env:VITE_ASSETS3D_BASE="<ASSET_URL>"; $env:VITE_CAT_SHA="<发布提交>"; npm run build
  ```

  这个变量只在构建命令里设，不写进仓库任何文件。地址栏的 `assets3d=` 仍然优先，可临时指向别的素材根。

只认 `http://`、`https://` 开头的地址，末尾没写 `/` 会自动补上。不带 `render=3d` 时页面是普通 2D，不加载 three.js，也不请求任何素材；3D 顶栏的「切回 2D」可随时退出。

## 5. 核对首次下载用时

3D 顶栏右侧显示预下载进度，结束时写明本次从网络下了多少、用了多久：

| 顶栏文字 | 含义 |
| --- | --- |
| `素材预下载 37/55 MB（67%）` | 正在下载；棋盘上用到的英雄会被提到队首，先显示队伍色占位棋子，模型到了就换上 |
| `素材已全部缓存到本地（N 个文件，本次下载 55 MB 用时 X 秒）` | 首次打开下载完成，X 就是首次下载用时（从读完清单开始算） |
| `素材已全部缓存到本地（N 个文件，全部来自本地）` | 之前已下过，本次没有走网络 |
| `素材预下载完成，K 个文件失败（…），本次下载 …` | 有文件 404、哈希或大小不符；用到时会再从网络读 |
| `…，浏览器不允许本地保存，下次需重下` | 无痕窗口或空间不足，能玩但每次都要重下 |

测首次用时的步骤：

1. 桌面 Chrome 或 Edge，不用无痕窗口。打开 `<GAME_URL>`，按 F12 → Application（应用）→ Storage（存储）→ Clear site data（清除网站数据），清掉以前缓存的素材。
2. 打开带 `render=3d` 的地址，等顶栏变成「已全部缓存到本地」，记下文字里的 MB 和秒数。
3. F5 刷新，顶栏应变成「全部来自本地」，棋子直接是模型、不再出现占位棋子。
4. 有第二台电脑或网络时各测一次，记录网络类型。

参考值：约 55 MB，服务器上行 200 Mbps（约 25 MB/s）时单人理论约 2–3 秒；实际受玩家下行带宽和服务器同时下载人数限制，两人同时首开约翻倍。若明显慢于按自己下行带宽算出的时间，先看 F12 → Network 里素材请求是不是逐个很慢（服务器或线路）还是被拦（红色，多为跨域或混合内容）。

## 6. 回滚与关闭

- 素材有问题：服务器上把 `assets3d.old` 换回 `assets3d`。玩家下次打开会按旧 precache 重下变化的文件。
- 暂停 3D：去掉页面链接里的 `render=3d` 即可，2D 完全不受影响。关掉素材地址后，3D 模式会退回占位棋子（读不到 `manifest.json`）。

## 7. 不做的事

- 不把素材放进仓库、`assets3d-local/` 以外的仓库目录、前端 `dist/` 或 Vite 的 `public/`。
- 不在文档、提交、PR、聊天记录里写实际的服务器地址、目录或账号。
- 不给素材地址加口令或访问限制。
