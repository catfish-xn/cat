# 14.24 英雄技能图标增量部署

本次只交付客户端代码和本地素材增量，不执行部署、不提交 Git。原版美术只存在
`assets3d-local/` 和用户部署的素材根，禁止加入仓库或 `public/assets/`。

## 内容与来源

- 覆盖 `M5_UNIT_IDS` 中技能存在于 `S13_ABILITY_DATA` 的全部 **63 位英雄**，包括六费英雄。
  训练假人、野怪、召唤物不属于这次英雄清单。
- 找到 **63**，`unavailable` 为 **空列表 `[]`**，没有替用其他技能图标。
- `assets3d-local/ability-icons-delta/ui/assets/s13/abilities/<abilityId>.png`：63 张 PNG，
  共 **382,533 字节**。保留不超过 64px 的原尺寸，较大图片等比缩至 64px 内。
- `assets3d-local/ability-icons-delta/ui/ui-assets.json`：**27,109 字节**，
  保留基准清单原来的 16 项，追加 63 项 `kind: ability`，合计 79 项。
  每项包含内容技能 id、相对路径、原始来源、PNG 字节数和 SHA-256。
- **实际覆盖素材根的内容共 64 个文件、409,642 字节**。
  增量目录另有不用于部署的 `report.json`（23,619 字节；源文件校验、角色关联、尺寸及补块统计），
  因此目录文件总大小为 433,261 字节。已打包的
  `assets3d-local/ability-icons-delta.tar.gz` 为 **388,321 字节**，SHA-256：
  `98f280fd9afb121e7c12e0bcccd64e676bb7727e44aa7f56c909fceabd2467c0`。
  本地总览图为 `assets3d-local/ability-icons-preview.png`。

来源是固定的 Riot 14.24 游戏 manifest，SHA-256：
`c080631bd377f60730d979b48807a49f86070517e85b7bafdc32c8666fee7a14`。
脚本优先读取本克隆缓存，再复制共享只读缓存中需要的文件；只有显式 `--download` 才从
Riot 官方补丁 CDN 下载缺失 chunk，并按 RMAN 校验大小和 chunk hash。

内容表当前没有图标路径字段。关联取自 UI WAD 的
`data/tftteamplanner/characters.bin`：`TFTCharacterRecord` 的客户端资料链接
（字段 hash `e4e7426c`）指向该英雄的 TFT 客户端资料，其技能图标字段 hash 为 `df0ad83b`。
头像、移动端图、背景图均为其他字段，不参与替代选择。内部角色别名来自本地忽略的
`unit-map.local.json`。实际素材路径、提取来源及校验留在本地报告，不编入客户端。

## 素材根基准与线上核实边界

此次基准是只读的
`/home/aiapps/workspace/set13-worktrees/boards/assets3d-local/test-server-v8/ui-assets.json`，
SHA-256：`a5aef30afd73bfe676a53b1411e283abb2f712d6c0aff3428d05f0eec1e96869`。

项目本机的 2026-10-22 部署记录与 2026-10-23、23b 更新清单记载线上继续使用 **v9**：
目录 `/srv/cat-playtest-v20/assets3d`，素材服务为 5190，URL 形式为
`http://<测试服IP>:5190/assets3d/`。v9 的 3D manifest/precache 对应本地 test-server-v8，
其 UI 清单包含 3 个头像、4 个羁绊和 9 个强化图标，与本次基准相符。

**尚未取得当前测试站 URL 或部署配置，不能声称已实核当前线上配置仍指向该根。**
仓库中没有当前部署 `.env`；代码用 `?assets3d=` 优先于构建变量 `VITE_ASSETS3D_BASE`。
以下上线步骤首先核实实际地址及基准 hash；不匹配就以线上清单重新生成，禁止直接覆盖。
本次没有写入共享工作树或线上素材根。

## 精确重建本次增量

Node 22.12+，本仓库已有依赖。下面命令在本克隆根目录执行；输出目录必须不存在。

```bash
export PATH=$HOME/.local/bin:$PATH
mkdir -p assets3d-local
git check-ignore assets3d-local/base-ui-assets.json assets3d-local/ability-icons-delta/ui/ui-assets.json
cp /home/aiapps/workspace/set13-worktrees/strippaths/assets3d-local/unit-map.local.json assets3d-local/unit-map.local.json
cp /home/aiapps/workspace/set13-worktrees/boards/assets3d-local/test-server-v8/ui-assets.json assets3d-local/base-ui-assets.json
node scripts/assets3d/ability-icons.mjs \
  --cacheFrom /home/aiapps/workspace/set13-worktrees/boards/assets3d-local/trial/local \
  --unitMap assets3d-local/unit-map.local.json \
  --baseManifest assets3d-local/base-ui-assets.json \
  --out assets3d-local/ability-icons-delta \
  --download
```

本次共读取 17 个已有缓存块、从官方 CDN 补充 61 个块。缓存齐全后去掉 `--download`
即可离线重建；已经生成过的目录不会被覆盖，应指定新的 `--out`，不要删除唯一交付副本。
脚本只向本克隆的 `assets3d-local/` 写入。共享缓存路径仅用于读取、复制所需内容。

## 用户部署步骤

1. 在实际测试站浏览器开发者工具的 Network 中找到 `ui-assets.json` 请求，记录请求地址。
   同时检查页面 `assets3d` 参数或前端构建环境 `VITE_ASSETS3D_BASE`，确认对应的真实服务器目录。
   把实际 URL 写入下面变量（末尾保留 `/`），不要照抄示例 IP。

   ```bash
   ASSET_URL='http://实际测试服IP:5190/assets3d/'
   curl -fSL "${ASSET_URL}ui-assets.json" -o assets3d-local/live-ui-assets.json
   sha256sum assets3d-local/live-ui-assets.json
   ```

   应与上述基准 hash 相同。若不同，保留新清单并重新生成：

   ```bash
   node scripts/assets3d/ability-icons.mjs \
     --cacheFrom /home/aiapps/workspace/set13-worktrees/boards/assets3d-local/trial/local \
     --unitMap assets3d-local/unit-map.local.json \
     --baseManifest assets3d-local/live-ui-assets.json \
     --out assets3d-local/ability-icons-delta-live
   ```

   后续步骤改用新输出的 `ui/` 内容；若发现缺块，可显式加 `--download`。

2. 构建并发布本次修改的前端代码，沿用测试站当前构建变量和部署流程。
   `VITE_ASSETS3D_BASE` 应指向上一步确认的地址；也可以在验收 URL 使用 `assets3d=` 指定。
   本机共享依赖目录只读时的构建命令为 `npx vite build --configLoader runner`。

3. 打包增量并传到实际素材服务器（此命令只打包 `ui/` 的内容）：

   ```bash
   tar -czf assets3d-local/ability-icons-delta.tar.gz -C assets3d-local/ability-icons-delta/ui .
   sha256sum assets3d-local/ability-icons-delta.tar.gz
   ```

4. 在服务器复制当前根，再覆盖该副本；以下目录沿用历史部署记录，实际根不同则替换。
   `assets3d.ability-next` 和 `assets3d.before-ability` 必须尚不存在。

   ```bash
   set -e
   cd /srv/cat-playtest-v20
   test ! -e assets3d.ability-next && test ! -e assets3d.before-ability
   cp -a assets3d assets3d.ability-next
   tar -xzf /path/to/ability-icons-delta.tar.gz -C assets3d.ability-next
   ```

   只新增 `assets/s13/abilities/*.png` 并替换根顶层 `ui-assets.json`。
   **不要把整个 `ui` 文件夹放到素材根下**；客户端请求的是 `<root>/ui-assets.json`。
   不改 3D `manifest.json`、`precache.json`、`packs.json` 或已有 pack。
   沿用 v9 旁路图标发布方式：这些 UI 图标通过独立 HTTP 请求加载，不加入 3D 离线预缓存。

5. 在副本上校验全部清单资源，并确认技能数量为 63：

   ```bash
   node - assets3d.ability-next <<'JS'
   const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
   const root = process.argv[2], ui = JSON.parse(fs.readFileSync(path.join(root, 'ui-assets.json')));
   for (const a of ui.assets) {
     const b = fs.readFileSync(path.join(root, a.path));
     if (b.length !== a.bytes || crypto.createHash('sha256').update(b).digest('hex') !== a.sha256)
       throw Error(`校验失败: ${a.kind}:${a.id}`);
   }
   const count = ui.assets.filter(a => a.kind === 'ability').length;
   if (count !== 63) throw Error(`技能数错误: ${count}`);
   console.log('清单资源校验通过，技能图标', count, '未找到项', ui.unavailable);
   JS
   mv assets3d assets3d.before-ability
   mv assets3d.ability-next assets3d
   ```

   用现有 Web 服务的 reload 方式更新静态目录；如有代理缓存，刷新该旁路清单缓存。
   不需要因素材替换重启对局服务。保留旧根直到验收完成。

6. 浏览器完整刷新页面，进入联机对局，点击己方及侦察英雄检查面板，同时鼠标悬浮英雄卡。
   验证拉克丝、内部别名英雄（如史密奇）及六费英雄的技能名左侧有 36px 圆角图标；
   Network 中 `ui-assets.json` 有 63 项 ability，PNG 返回 200；图标不应是英雄头像。
   暂时阻止某张 PNG 请求时仅隐藏该图；移除 ability 注册时回退英雄头像，技能文本保留。
   无素材根的公开 2D 页面继续使用头像回退，不请求这些新素材。

## 回滚

```bash
set -e
cd /srv/cat-playtest-v20
test ! -e assets3d.with-ability
mv assets3d assets3d.with-ability
mv assets3d.before-ability assets3d
```

沿用 Web 服务 reload 并刷新浏览器；需要回滚前端时按既有代码发布机制回到先前构建。
旧前端会忽略 ability 类型，新前端读取旧根会回退头像，因此两者可以独立回滚。

## 验收记录

运行 `npx tsc --noEmit`，以及四个限定测试文件（`--maxWorkers=2`，没有运行全套）：
资源注册、检查面板 Chromium DOM、纯合成映射/合并、3D 构建隔离。
构建前后使用同一 `npx vite build --configLoader runner`，逐文件 gzip level 9 后求和，
只统计顶层 `dist/assets/*.js`，不计 `assets/ui/`、`assets/3d/`、`assets/solo/`。
结果：类型检查通过，四文件 **75/75 项通过**。顶层 JS gzip-9 总量为
**612,404 → 612,518 字节（+114）**；其中入口为
**455,638 → 455,752 字节（+114）**，低于本任务 +300 字节上限。
另外实际执行了一次不带 `--download` 的离线重建，63 张 PNG 与合并清单逐字节一致，
全部 PNG 的尺寸与清单大小、SHA-256 均通过核验；总览图已人工检查。
合并清单 SHA-256 为
`75d3d5babd502f20114a03a98e7ae43ffd6a6d254cda8408e82f16dd9ec21f48`。
`git diff --check` 通过，`git check-ignore` 确认图标、清单、预览和 tar 均被忽略，
Git 工作区只包含三个客户端文件、脚本、三个测试文件和本文档。
