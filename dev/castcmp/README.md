# castcmp：技能 / 普攻对比录帧

开发用工具，不进正式构建。用假棋盘和虚拟时钟，把一个英雄的一次施法或普攻录成 1920×1080 的 30fps jpg 帧，再拿去和原版视频、部署前的录像做并排对比。

## 文件

- `harness.ts` + `index.html`：页面。挂载 3D 渲染器，摆 1 个我方（`me`）和 4 个木桩（`foe`…`foe4`），并暴露 `window.__h`（`step` 推进虚拟时钟，`cast` / `events` 发事件，`box` 取屏幕框）。
- `v-capture.cjs`：录一次施法，默认 0–3000ms（91 帧）。
- `v-capture-attack.cjs`：录一次普攻，默认 0–1500ms（46 帧）。
- `assets.cjs`：素材服务，带 CORS。传 `--upstream <assets3d 地址>`（或设环境变量 `CASTCMP_ASSET_UPSTREAM`）时，缺的文件会从那个地址拉下来缓存到 `--root`；不传时只用 `--root` 里已有的文件。
- `batch.cjs`：批量跑 jobs 文件，可以续跑。Windows 和 Linux 都能用，替代原来的 `run.sh` / `lane.sh`。
- `common.cjs`：按系统决定浏览器启动参数，并生成 30fps 时间点。

## 浏览器

- Windows：本机 Chrome，用 `--use-angle=d3d11` 走独显。GTX 1080 上一条施法大约 1 分钟。
- Linux：`/usr/bin/google-chrome`，走 SwiftShader 软件渲染。没有显卡的机器上一条大约 3 分钟。
- 可以用 `--gl gpu|swift` 指定渲染方式，用 `--chrome <路径>` 或环境变量 `CASTCMP_CHROME` 指定浏览器。
- 脚本结束时直接 `process.exit`，不调用 `browser.close`。在 Windows 显卡模式下，关闭 headless Chrome 会卡大约 30 秒。

## 用法

jobs 文件每行格式是 `<脚本> <英雄> <输出名> [参数…]`，`#` 开头的行是注释：

```
v-capture.cjs camille cast-camille --dist 1 --star 3
v-capture.cjs viktor cast-viktor --dist 3 --star 3 --slam 1 --ms 4000
v-capture-attack.cjs gangplank atk-gangplank-back --dist 3 --star 3 --form back
```

```bash
node dev/castcmp/batch.cjs jobs.txt out --serve --root <素材缓存目录> --upstream <测试服 assets3d 地址>
```

加了 `--serve`，脚本会自己起 vite（5311）和素材镜像（5419），录完后关掉。每录完一条，会写 `out/<输出名>/`（帧和 `boxes.json`）、`<输出名>.log` 和 `<输出名>.ok`。重跑时会跳过已经有 `.ok` 的条目。在显卡机上 `--parallel` 保持 1 即可。

单条录制（需要先手动起服务）：

```bash
node dev/castcmp/assets.cjs 5419 --root <素材缓存目录> --upstream <测试服 assets3d 地址>
npx vite --port 5311 --strictPort --host 127.0.0.1
node dev/castcmp/v-capture.cjs camille out/cast-camille --dist 1 --star 3
```

常用参数：`--dist` 是目标距离（格），`--star` 是星级（默认 3）；`--ms` 是时长，或用 `--times` 直接给时间点；`--warm N` 表示正式录之前先放 N 次技能，用于多段技能选段；`--form`、`--move`、`--outcome` 用来指定形态和施法分支；`--slam 1` 是维克托的砸地；`--real 1` 用真实战斗回放时，`--foes N`（1–4，默认 4）只留前 N 个对手，1 星后排对 4 个对手常常没放技能就死了。

录的是当前检出的代码。如果要录测试服上的版本，先检出测试服的 SHA 再录。
