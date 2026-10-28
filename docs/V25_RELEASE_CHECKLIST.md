# release/v25 上线清单与测试服更新步骤

文档核对日期：2026-10-28。代码基线：`codex/v25-integration-2` 的 `686f3086fa565d2c1af81a5414d1259fc0ab86fb`；本克隆文档分支为 `claude/v25-release-docs`。这是待执行清单，不是已通过验收或已部署的记录。**测试服更新由用户自己执行；本次只写文档，不开 PR、不合并、不部署。**

流程沿用 [联机发布手册](MULTIPLAYER_RELEASE_NOTES.md)、[P3/P4/P5](P3P4P5_RELEASE.md)、[T13-A](T13_A_RELEASE.md) 和[随机一费起手](OPENING_RANDOM_1COST_RELEASE.md)的固定提交、独立纪元、保全旧证据原则。素材分别按 [完整根重建](ASSETS3D_DEPLOY_ROOT.md)、[公网素材部署](ASSETS3D_PUBLIC_DEPLOY.md)、[技能图标增量](ABILITY_ICONS_DEPLOY.md)处理。

## 1. 发布对象与身份

先验货 `codex/v25-integration-2 → multiplayer`，再由用户确定 `release/v25` 候选；最终批准后才合 main。实际部署固定完整 SHA，不能把持续变化的分支名当包名。合入后若代码、内容或构建配置变化，重新在最终候选验收。`release/v25` 的创建、合并与推送是**手动**操作，本次未执行。

| 项目 | v24 | 当前 v25 候选 |
| --- | --- | --- |
| rulesVersion | `s13-g2-3-v24-online-rules` | `s13-g2-3-v25-online-rules` |
| contentVersion | `s13-14.24b-g2-3-v24-online-rules` | `s13-14.24b-g2-3-v25-online-rules` |
| CONTENT_DIGEST | `fnv1a32-utf16:1b86447c` | `fnv1a32-utf16:b5e50d50` |
| LOOT_REPLAY_DIGEST | `fnv1a32-utf16:18c876b2` | `fnv1a32-utf16:63bddec2` |
| schema / save / replay / command | `12 / 8 / 8 / 7` | `12 / 8 / 8 / 7` |
| NET_PROTOCOL | `6` | `6` |

依据：`src/simulation/content/identity-constants.ts`、`tests/v25-online-rules-content-baseline.json`。固定 50 ms/tick、`lcg32-v1` 不变；协议号相同不代表规则兼容。不要照抄较早 V25 报告中的中间 digest 或未完成状态。当前 `docs/evidence/v25-online-rules/epoch-verification.json` 有 15 步、`complete: true` 的写入记录；它不能代替最终候选的无写入检查或最新 CI。

### 给玩家的影响

- v24 存档、快照和回放按精确纪元身份拒绝，不迁移、不重新抽随机数，不改文件头冒充 v25。旧单人局不能在 v25 续玩，旧回放不能在 v25 播放；原文件可保全、原字节导出，需要查看时保留配套旧版本。
- 提前公告“更新后需要新开局；重要旧档请先导出”。不要把“清除全部站点数据”列为常规升级步骤，它也会删除未导出的单人存档和素材缓存。
- 服务端对局只在内存里，重启会丢失活动局、队列与旧席位凭证。先结束活动局并停止新匹配准入（入口控制由用户**手动**处理），通知玩家刷新、重新匹配；重启不是跨版本重连。
- 本轮数值、阶段、未实现卡及项目约定见 [PR 草稿](V25_PR_DESCRIPTION.md)。星夜 1–2 级当前 0%，与 v24 的 18% 决定冲突，发布前需用户确认；战利品爆炸数值暂定待实测。

## 2. 上线前检查（逐项登记最终 SHA 与证据）

- [ ] 工作区干净、完整 SHA 已固定；依赖按锁文件安装，Node **22.x 且至少 22.12**。没有素材、`dist/`、`dist-server/`、`artifacts/` 混入提交。
- [ ] GitHub **手动核对**最终候选的 CI：`changes` 为 full；四个 `test-and-build-tests-*`、headless/performance、timing、六组 dev/preview × cannon/sniper/mage 浏览器完整路线、input/touch/archives/M6-performance、`m8-ui-dynamic`、`m6-retention`、`m7-presentation`、`compare-evidence` 和 `ci-required` 全绿。仅 docs tier 全绿不算游戏发布验收。
- [ ] `release/v25` 的完整 CI 全绿且耗时门槛实际 enforce。普通 PR（目标非 release）及 multiplayer push 的 CI 使用 `CI_WALLCLOCK_GATES=report`；另检查对应 SHA 的 `Wall-clock budgets`（`vitest-timing`、`m6-performance`、`m7-budget` 与 report）。该工作流不是独立的 PR 必需门禁；不能用 report 模式绿灯替代预算通过。
- [ ] 内容身份重算检查通过；v25 写入完整、无写入检查完整；v24 及更早证据保全检查通过。无新增规则修改时不重录旧纪元。
- [ ] `rendering3d-isolation` 通过：2D 静态依赖不泄漏 3D、solo 恢复认证或延迟 UI；3D 不反向拉入 2D/UI。顶层 `assets/*.js` **gzip-9 总和严格小于 637,144 字节**，不能沿用中间版本临时放大的预算。
- [ ] M7：JS gzip 比率 ≤1.50，首次交互中位数比率 ≤1.20，不预加载 3D/solo。沿用 CI 的固定 M6/M7 基线，同机交替测量；不要把 637,144 误当未压缩全部 JS 或包含 3D 的总上限。
- [ ] `bot-driver-timing` 独占运行：八机器人整局 <60,000 ms；同时核对一真人七机器人、排名、意图合法性。历史优化报告不是当前候选或测试机实测。
- [ ] 浏览器 e2e 另做真实 WS 两客户端、重连、侦察、选秀、加时、回放和异常收局；2D Canvas、带真实素材地址的 3D、技能图标均完成冒烟。CI 的完整单人路线不等于公网八人联机验收。
- [ ] 用户确认星夜取值、最终发布/回滚 SHA、维护窗口、素材根和实际服务配置；记录当前 `/healthz` 与旧素材版本。

以下为已有命令，均在候选验收环境执行；本次文档任务不运行它们：

```bash
npm ci
npm run typecheck
npm test
CI_WALLCLOCK_GATES=enforce npm run test:timing
node scripts/update-content-identities.cjs --check
node scripts/verify-v25-online-rules-epoch.cjs
npm test -- tests/rendering3d-isolation.test.ts scripts/tests/production-size.test.ts
CI_WALLCLOCK_GATES=enforce npx vitest run --project timing --no-file-parallelism tests/server/bot-driver-timing.test.ts
npm run test:server-entry
npm run build:game
node --check dist-server/game/main.mjs
npm run build
```

只读依赖目录导致 `.vite-temp` 写入失败时，Vitest 可加 `--configLoader runner`；前端先 `npm run typecheck` 再 `npx vite build --configLoader runner`。不以跳过类型检查替代正式构建。

纪元**写入**仅供规则集成负责人在最终规则冻结后执行，非测试服部署命令，也非每次发布都要重复：

```bash
node scripts/verify-v25-online-rules-epoch.cjs --write
node scripts/verify-v25-online-rules-epoch.cjs
# 可选并行替代，同一时间只跑一种 runner：
# node scripts/verify-v25-epoch-parallel.cjs --write --jobs=3
# node scripts/verify-v25-epoch-parallel.cjs --jobs=3
```

无参数即 check；串行 runner **不接受 `--check`**。检查 `artifacts/v25-online-rules-recording/epoch-verification.json` 的 `complete=true`、15 步退出码全 0，check 还须 `trackedFilesUnchanged=true`、`changedTrackedFiles=[]`。写入输出审查后才纳入候选；失败/部分报告只留 artifacts，不充当完成证据。本轮已多次因后续修复重录，均仍属于同一个 v25 纪元。

M7 的固定已构建基线目录准备好后，可按 CI 参数执行（基线构建步骤见 `.github/workflows/ci.yml`，本克隆 `.git` 只读，不在此创建 worktree）：

```bash
CI_WALLCLOCK_GATES=enforce node scripts/m7-budget.cjs \
  --base=/absolute/m6-base/dist --js-base=/absolute/m7-js-base/dist \
  --current=dist --out=artifacts/m7-budget --samples=15
```

完整路线/输入/比较沿用 [PROJECT_GUIDE.md](PROJECT_GUIDE.md) 与 `.github/workflows/ci.yml`。联机专项已有入口如 `node tests/server/e2e/ws-two-contexts.mjs --rounds=10`、`node tests/server/e2e/p7-carousel.mjs`、`node tests/server/e2e/c5-spectate.mjs`、`node tests/server/e2e/c6-replay.mjs`、`node tests/server/e2e/c19-overtime-display.mjs`、`node tests/server/e2e/g3-fault-recovery.mjs`；缩短轮数的两客户端检查不能当完整终局验收。这些旧脚本会自行 launch Chromium，**不能在本克隆沙盒直接运行**。此环境浏览器测试须由 Claude 用 `codex-browser exec` 开新任务、通过 `CODEX_BROWSER_CLIENT` 连接；没有连接变量就报告未验收，不能自行启动 Chrome。普通独立 CI/验收机按其浏览器配置运行。

## 3. 构建与正式发布

| 命令 | 实际产物与用途 |
| --- | --- |
| `npm run build` | typecheck + Vite，生成 `dist/` 前端 |
| `npm run build:server` | 清空整个 `dist-server/`，生成规则 Node ESM `index.mjs`、`run-battle.mjs`、chunks、metafile；不是监听 WebSocket 的服务 |
| `npm run test:server-entry` | 先执行上述规则构建，再验规则入口 |
| `npm run build:game` | 生成 `dist-server/game/main.mjs` 和 `test-client.mjs`；`ws` 等包外置，生产需安装运行依赖 |
| `npm run serve:game` | 先重新 build:game 再启动；仅开发/验收使用，生产直接运行已构建 main.mjs |

因此需要两种服务器构建时，**先 test:server-entry/build:server，后 build:game**；最后不要再用 build:server 删除上线入口。先安装含 devDependencies 的依赖再构建；成品目录最后才 `npm prune --omit=dev` 或另装运行依赖。

正式机已按联机手册配置 `/srv/cat/{releases,current,previous}`、systemd、Caddy 时，用户可使用已有脚本：

```bash
set -euo pipefail
cd /absolute/cat-deploy
CAT_RELEASE_SHA='替换为已批准的40位SHA'
git fetch origin release/v25
git checkout --detach "$CAT_RELEASE_SHA"
VITE_ASSETS3D_BASE='https://替换为素材域名/assets3d/' deploy/deploy.sh "$CAT_RELEASE_SHA"
deploy/deploy.sh status
```

脚本负责拉取、npm ci、game/前端构建、原子切换 current、重启及 SHA 健康检查，失败自动回 previous；**不会**运行全部测试、写纪元、部署 3D 素材、合并 main 或替玩家迁移旧档。已有同 SHA `.release-ok` 会复用成品；若换了构建变量不会自动重构，须手动准备新的成品，不能误认为变量已生效。默认不加 `--force`，也不使用跳过重启检查的 `--no-restart`。

素材先按第 4 节准备并保留旧根。正式 Pages `/cat/` 由 main 的 `.github/workflows/pages.yml` 发布（`npm run build -- --mode pages`，另保留 `/cat/m7/` 快照）；`release/v25` 本身不会触发 Pages 发布，对局 Node 服务也不会随 Pages 自动更新。用户最终批准合 main 前保持正式站原版本；子路径沿用 BASE_URL 配置。

## 4. 测试服更新（全部由用户自己执行）

以下 Bash 是手工备用流程，适用于已配置 `current` 指向版本目录的测试服；真实根、systemd 名、端口、Web 根尚未在本任务核实，必须填实际值。旧记录中的 `/srv/cat-playtest-v20`、5190 只是历史配置，不能直接认定仍有效。若当前测试服不使用该目录结构，**手动**先核对服务 WorkingDirectory/ExecStart、EnvironmentFile 和静态 Web 根，再将切换步骤映射到现有配置；仓库没有统一的 `deploy:test`、素材上传或服务迁移脚本。

### 4.1 拉取、锁定提交、保留旧版

在用户自己的测试服克隆执行，不在本次只读 `.git` 克隆执行：

```bash
set -euo pipefail
CAT_TEST_REPO='/absolute/测试服源码克隆'
CAT_TEST_ROOT='/absolute/测试服发布根'
CAT_GAME_SERVICE='替换为实际systemd服务名'
CAT_HEALTH_URL='http://127.0.0.1:替换端口/healthz'
CAT_GAME_URL='https://替换为测试站域名/'
CAT_ASSET_PARENT='/absolute/素材Web父目录'
CAT_COMPRESSED_ROOT='/absolute/已验收的完整压缩素材根'
CAT_ASSET_URL='https://替换为素材域名/assets3d/'
CAT_RELEASE_SHA='替换为已批准的40位SHA'
cd "$CAT_TEST_REPO"
test -z "$(git status --porcelain)"
git fetch origin release/v25
git checkout --detach "$CAT_RELEASE_SHA"
test "$(git rev-parse HEAD)" = "$CAT_RELEASE_SHA"
node --version
sudo systemctl show "$CAT_GAME_SERVICE" -p WorkingDirectory -p ExecStart -p EnvironmentFiles
curl -fsS "$CAT_HEALTH_URL"
CAT_PREVIOUS_RELEASE=$(readlink -f "$CAT_TEST_ROOT/current")
test -d "$CAT_PREVIOUS_RELEASE"
printf '%s\n' "$CAT_PREVIOUS_RELEASE"
```

**手动检查**当前房间已结束/为空，队列无人、入口已暂停；把旧完整 SHA、两 digest、旧目录、服务配置及素材版本记到用户自己的发布记录。确认 Node 22.12+、Web 根为 `current/dist`，服务读取 `current/release.env`，入口为 `current/dist-server/game/main.mjs`。未满足先处理配置，不能继续切换。

### 4.2 构建前端和服务器并安装新版本目录

```bash
npm ci
npm run test:server-entry
npm run build:game
VITE_CAT_SHA="$CAT_RELEASE_SHA" VITE_ASSETS3D_BASE="$CAT_ASSET_URL" npm run build
node --check dist-server/game/main.mjs
test -f dist/index.html
CAT_RELEASE_DIR="$CAT_TEST_ROOT/releases/$CAT_RELEASE_SHA"
test ! -e "$CAT_RELEASE_DIR"
mkdir -p "$CAT_RELEASE_DIR/dist-server"
cp -a dist "$CAT_RELEASE_DIR/"
cp -a dist-server/game "$CAT_RELEASE_DIR/dist-server/"
cp package.json package-lock.json "$CAT_RELEASE_DIR/"
npm ci --omit=dev --prefix "$CAT_RELEASE_DIR"
printf 'CAT_GIT_SHA=%s\n' "$CAT_RELEASE_SHA" > "$CAT_RELEASE_DIR/release.env"
```

目录须由部署账号可写、服务账号可读/遍历；必要的权限调整为**手动**。不要覆盖唯一旧版本；同 SHA 目录已存在就停下核对，勿删除已在服务的目录。上述为根路径站点构建，若测试站部署在子路径，**手动**给 build 传既有 `--base` 并验证所有静态路径。

### 4.3 准备、部署 3D 素材完整根与图标

已有验收过的完整压缩根可直接部署；需重建时在本地素材工作区执行以下真实脚本（占位符依 [重建说明](ASSETS3D_DEPLOY_ROOT.md)替换）：

```bash
node scripts/assets3d/build-asset-root.mjs --roots "<HEROES_ROOT>" "<FX_BATCH1_ROOT>" "<FX_BATCH2_ROOT>" "<FX_BATCH3_ROOT>" "<FX_BATCH4_ROOT>" "<FX_BATCH5_ROOT>" "<FX_BATCH6_ROOT>" "<NEUTRALS_ROOT>" "<EXTRAS_ROOT>" "<FX_PILOT_ROOT>" --out "<OUT_DIR>"
node scripts/assets3d/compress.mjs --from "<OUT_DIR>" --out "assets3d-local/v25-compressed"
node scripts/assets3d/build-asset-root.mjs --roots "assets3d-local/v25-compressed" --out "<COMPRESSED_OUT_DIR>"
```

输出使用不存在的新目录；输入先合并、再压缩一次、最后导出。选秀、施法补选、野怪等后续批次必须包含在实际输入完整根中，不因示例省略而丢失。素材只留本地 gitignore 目录/外部素材服务，不进 Git、public 或 dist。远程上传为**手动**：`scp -r /absolute/完整根 用户@素材机:/absolute/新目录`，上传后在素材机执行下列副本切换；不要边上传边覆盖现役目录。

```bash
CAT_ASSET_NEXT="$CAT_ASSET_PARENT/assets3d.v25-next-$CAT_RELEASE_SHA"
CAT_ASSET_OLD="$CAT_ASSET_PARENT/assets3d.before-v25-$CAT_RELEASE_SHA"
test ! -e "$CAT_ASSET_NEXT"
test ! -e "$CAT_ASSET_OLD"
mkdir -p "$CAT_ASSET_NEXT"
cp -a "$CAT_COMPRESSED_ROOT/." "$CAT_ASSET_NEXT/"
test -f "$CAT_ASSET_NEXT/manifest.json"
test -f "$CAT_ASSET_NEXT/action-bindings.json"
test -f "$CAT_ASSET_NEXT/precache.json"
```

技能图标是旁路 UI 清单，不由 3D 合并脚本保证保留。**手动**核对现役 `<ASSET_URL>ui-assets.json`：若完整根尚无 63 项 ability，按 [图标增量手册](ABILITY_ICONS_DEPLOY.md)对现役基准重建 delta，然后在切换前执行：

```bash
# 仅在基准已核对且需要增量时执行；复制 ui/ 的内容到素材根顶层。
cp -a /absolute/已核对的ability-icons-delta/ui/. "$CAT_ASSET_NEXT/"
```

不要把整个 `ui` 目录套到根下，也不修改现有 3D precache/packs 来装这些旁路图标。下面命令校验副本全部预下载文件、UI 文件大小和哈希，且要求 63 项技能；缺失先停下补齐：

```bash
node - "$CAT_ASSET_NEXT" <<'JS'
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = process.argv[2];
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const manifest = read('manifest.json'), precache = read('precache.json'), ui = read('ui-assets.json');
for (const a of [...precache.files, ...ui.assets]) {
  const b = fs.readFileSync(path.join(root, a.path));
  if (b.length !== a.bytes || crypto.createHash('sha256').update(b).digest('hex') !== a.sha256)
    throw Error(`素材校验失败: ${a.path}`);
}
for (const id of ['little-legend-default','orb-gold','player-damage-tar','carousel-center','pve-krug'])
  if (!manifest.models?.[id] && !manifest.effects?.[id]) throw Error(`缺批次: ${id}`);
if (ui.assets.filter(a => a.kind === 'ability').length !== 63) throw Error('技能图标数不是63');
console.log('完整根及63项技能图标校验通过');
JS
# 确认维护窗口后整目录切换，保留旧根；两次 rename 间存在短暂空窗。
mv "$CAT_ASSET_PARENT/assets3d" "$CAT_ASSET_OLD"
mv "$CAT_ASSET_NEXT" "$CAT_ASSET_PARENT/assets3d"
curl -fsSI "${CAT_ASSET_URL}manifest.json"
curl -fsSI "${CAT_ASSET_URL}ui-assets.json"
```

Web reload/代理缓存刷新按现有配置**手动**执行。跨域资源须 `Access-Control-Allow-Origin: *`、`Cache-Control: no-cache`；HTTPS 页面配 HTTPS 素材，GLB MIME 为 `model/gltf-binary`。**手动**从 precache 取一条真实 GLB 路径验证 200/响应头；有 packs 时保留原文件回退，不能只上传 packs。

### 4.4 切换版本、重启、冒烟

再次确认无活动局，沿用同一终端变量：

```bash
ln -sfn "$CAT_PREVIOUS_RELEASE" "$CAT_TEST_ROOT/previous.next"
mv -Tf "$CAT_TEST_ROOT/previous.next" "$CAT_TEST_ROOT/previous"
ln -sfn "$CAT_RELEASE_DIR" "$CAT_TEST_ROOT/current.next"
mv -Tf "$CAT_TEST_ROOT/current.next" "$CAT_TEST_ROOT/current"
sudo systemctl restart "$CAT_GAME_SERVICE"
sudo systemctl status "$CAT_GAME_SERVICE" --no-pager
curl -fsS "$CAT_HEALTH_URL"
sudo journalctl -u "$CAT_GAME_SERVICE" -n 50 --no-pager -o cat
```

手工流程没有自动健康轮询/自动回滚，curl 失败或版本不对先停，不开放入口；服务启动后重新检查。若使用第 3 节 deploy 脚本，则由脚本完成切换和重启，**不要再重复此流程**。

- [ ] `/healthz`：`status=ok`、`sha` 为完整候选 SHA、两个 digest 等于第 1 节，netProtocol=6；无 room.fault。通过公网代理再查 `/ws/healthz`，不能只查本机。
- [ ] **手动**用桌面 Chromium 打开 `${CAT_GAME_URL}?mode=online&server=ws`，强制刷新，页面/服务器 SHA 和内容摘要一致。两位玩家看到同一队列，开始后机器人补至八席，商店购买、装备、强化选择及对局推进成功。
- [ ] **手动**测刷新重连、侦察、战斗尾包/回放、选秀领取与加时，最终排名和返回匹配正常。不要在真实玩家局注入 fault；异常收局在隔离验收环境测试。
- [ ] **手动**打开附加 `&render=3d&assets3d=<URL编码后的素材根>` 的同一地址；检查模型、特效、选秀、野怪、素材下载失败数为0，再刷新显示本地缓存。普通 2D 页面不应加载 three.js/3D 素材。
- [ ] **手动**检查己方/侦察英雄（含六费）的技能图标；PNG 200、不是头像替代；无素材根仍可用回退。
- [ ] **手动**以保全的 v24 文件测试拒绝续玩/回放，并验证 v25 新单人档可存取、新回放可播放。旧文件不删除、不修改身份。

全部通过后才恢复准入并记录时间、操作者、SHA、digest、素材版本及浏览器验收结果。仓库没有一条自动覆盖上述公网产品验收的脚本。

## 5. 回滚

触发条件：进程/健康检查失败、身份不一致、持续断线/异常收局、资源发放异常、严重显示问题。先暂停入口并保存日志、health JSON、失败版本信息，勿反复重启损失现场。

标准脚本布局由用户执行（CAT_ROOT/HEALTH/RESTART 等变量需与发布时相同）：

```bash
cd /absolute/cat-deploy
deploy/deploy.sh status
deploy/deploy.sh rollback
deploy/deploy.sh status
```

脚本保留活动局保护；不要默认 `--force`。手工测试服则在维护窗口使用第 4 节记录的旧目录（不以当前失败版本重新计算旧目标）：

```bash
set -euo pipefail
test -f "$CAT_PREVIOUS_RELEASE/dist-server/game/main.mjs"
ln -sfn "$CAT_PREVIOUS_RELEASE" "$CAT_TEST_ROOT/current.next"
mv -Tf "$CAT_TEST_ROOT/current.next" "$CAT_TEST_ROOT/current"
sudo systemctl restart "$CAT_GAME_SERVICE"
curl -fsS "$CAT_HEALTH_URL"
sudo journalctl -u "$CAT_GAME_SERVICE" -n 50 --no-pager -o cat
# 如素材也需回滚，保留故障根，不覆盖已有诊断目录：
test -d "$CAT_ASSET_OLD"
test ! -e "$CAT_ASSET_PARENT/assets3d.failed-$CAT_RELEASE_SHA"
mv "$CAT_ASSET_PARENT/assets3d" "$CAT_ASSET_PARENT/assets3d.failed-$CAT_RELEASE_SHA"
mv "$CAT_ASSET_OLD" "$CAT_ASSET_PARENT/assets3d"
```

Web reload/缓存刷新、Pages 回退到已批准 main 版本为**手动**操作，按原托管流程执行。代码回滚应同时回前端、服务器和其运行依赖，核对旧 SHA/digest 后再开新局；素材可独立回滚。回滚也不恢复进程中的旧局，v25 新档不会自动变为 v24 可读；保留两代原文件及配套版本。

## 6. 上线后观察与记录

- 观察 `/healthz` 的 sha、contentDigest、lootReplayDigest、connections、seatsOnline、queue、room.phase/round/fault、uptimeSec、rssBytes；确认没有卡阶段、反复重启或队列无法再开。
- 观察 `journalctl -u <实际服务名> -o cat` 的阶段切换、重连、`room.ended` 与错误；关注 resolver-error、stall、abandon、replay/restore 拒绝原因和重复奖励。生产不设 `CAT_FAULT_INJECT_ROUND`，不为发布改战斗时钟。
- 观察 3D 首次下载量/用时、失败数、刷新缓存命中、图标请求；素材约55MB只是历史参考，不是当前根验收的精确尺寸。
- 收集 Loot Explosion 各阶段掉落与价值暴击收益、魔像装备不被转换、卓尔不群各阶段增益、安慰剂+固定15金、动态值显示与实际结算是否一致。
- 已知遗留：强化历史累计有平方级成本风险，长局/频繁恢复尤其需要观察耗时和内存；v25 后单独立项。不能因此放宽本轮 60秒、M7 或隔离预算。
- 发布记录至少填：候选/回滚 SHA、CI 链接与 enforce 结果、纪元 check 报告、身份、素材清单 hash、维护窗口、健康 JSON、冒烟结论、异常及处置。未执行项目明确写“未执行/手动待验”，不要登记为通过。
