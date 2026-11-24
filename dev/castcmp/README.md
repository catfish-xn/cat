# castcmp：技能 / 普攻对比录帧

开发用工具，不进正式构建。用假棋盘和虚拟时钟，把一个英雄的一次施法或普攻录成 1920×1080 的 30fps jpg 帧，再拿去和原版视频、部署前的录像做并排对比。

## 文件

- `harness.ts` + `index.html`：页面。挂载 3D 渲染器，摆 1 个我方（`me`）和 4 个木桩（`foe`…`foe4`），并暴露 `window.__h`（`step` 推进虚拟时钟，`cast` / `events` 发事件，`box` 取屏幕框）。
- `v-capture.cjs`：录一次施法，默认 0–3000ms（91 帧）。
- `v-capture-attack.cjs`：录一次普攻，默认 0–1500ms（46 帧）。
- `assets.cjs`：素材服务，带 CORS。传 `--upstream <assets3d 地址>`（或设环境变量 `CASTCMP_ASSET_UPSTREAM`）时，缺的文件会从那个地址拉下来缓存到 `--root`；不传时只用 `--root` 里已有的文件。
- `batch.cjs`：批量跑 jobs 文件，可以续跑。Windows 和 Linux 都能用，替代原来的 `run.sh` / `lane.sh`。
- `common.cjs`：按系统决定浏览器启动参数，并生成 30fps 时间点。
- `render-meta.json` / `ref-units.png`（v-capture 每次都写）：录制前的渲染状态。内容包括 WebGL renderer/vendor 字符串、上下文属性、MSAA 采样数、画布和绘图缓冲尺寸、devicePixelRatio，以及素材服务文件加载完成的先后次序（作为贴图上传次序的近似）。另外存一张参考帧，是单位站好、录制的施法还没发出时，单位区域的 PNG，并记下它的 sha256 指纹。gate.json 的 meta.render 里有摘要。
- 参考帧在截之前会先等：特效预热完成（LTK_WARMING 归零；--cold 1 时不等这一项），且资源请求连续 1.5 秒没有新增（最多等 30 秒）。等的结果记在 render-meta.json 的 quiet 字段里；quiet.ok 为 false 表示是在加载途中截的。
- `ref-pair.cjs <录制A> <录制B>`：判断两段录制能不能逐像素对比（Fable 11-15 的同状态配对口径）。比较两段的参考帧，单位区域在 SwiftShader 每次运行自带的噪声以内才算配对（Fable 11-18：超过 8 的像素不多于 16 个，且最大差不超过 32；超出任意一条就算真差异），同时列出 render-meta 中不同的字段（加载清单按集合比较，只列两边各自多出的文件，不比较完成的先后；任意一边 quiet.ok 为 false 时输出 warning，提醒重录）。注意：批量录制时每一遍最多会多等 30 秒。退出码：0 表示配对，1 表示状态不同，2 表示缺 meta。

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
v-capture-attack.cjs jayce atk-jayce-ranged --dist 3 --star 3 --form ranged
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

常用参数：`--dist` 是目标距离（格），`--star` 是星级（默认 3）；`--ms` 是时长，或用 `--times` 直接给时间点；`--warm N` 表示正式录之前先放 N 次技能，用于多段技能选段；`--form`、`--move`、`--outcome` 用来指定形态和施法分支（`--move`、`--outcome` 只用于假人；真实模式 `--real 1` 下带了会直接报错退出，因为真实对局自己决定分支）；`--slam 1` 是维克托的砸地。

`--hide-units 1`：不画单位模型（血条、星级、影子和特效照画），每帧左上角和 keyframes 图头都标“单位已隐藏”。`--pin-foe N`（只用于假人，N 为 1–5）：只放一个假人，在施法者正前方同一列 N 格处，不走动、不还手，施法者也不动，技能只打它；每帧和图头标“假人”，gate.json 记 `pinFoe`、`hideUnits`，`dist` 记为 N。不带这两个参数时行为不变。

关于 `--dist`：假人模式下，目标确实放在施法者前方 `dist` 排（默认 4 个假人：三个并排、一个在后）；画面上看着贴脸，是因为假人数量多、施法者模型高（如 2★ 维克托）。`--real 1` 时双方按真实规则走位，近战目标会自己走到施法者身边，`--dist` 只决定开局站位。要固定距离、单个目标，用 `--pin-foe N`。

实战窗口也可以不以施法定位：`--anchor attack-hit` 以本单位第 N 次普攻命中为锚点，`--anchor event:<类型>` 以本单位发出（或作为主体）该类显示事件的第 N 拍为锚点（按拍计数：同一拍里有几个这样的事件只算一次，例如一次脉冲同时打到两个敌人）（例如被动周期伤害用 `event:packetDamage`），N 仍由 `--cast-index` 给出。用于从不施法的单位（阿木木、泽丽）；jobs-check 会检查锚点事件确实落在窗口里。

实战里换形英雄（普朗克、斯维因、杰斯等）的形态由规则按所在行决定：己方前两排（第 4、5 行）近战，后两排（第 6、7 行）远程，`--form` 只决定画哪套模型。所以远程形态要用 `--me-cell R,C` 把施法者放到第 6、7 行，`--form` 和所在行对不上时 jobs-check 判 FAIL。实战行必须带 `--systems`（这行要判的系统，没有就写 `--systems none`），缺了 jobs-check 判 FAIL。

实战窗口从战斗中途开始时，录制工具会先把窗口之前的全部事件作为一批交给渲染层：只推进计数和状态（泽丽每第 3 下强化、图奇施法后的强化射击等），不播特效（`real-combat.ts` 的 `catchUpBatch`）。窗口第一拍自身的事件仍然不送，和以前一样。

实战（`--real 1`）的录制窗口用同一套参数选：`--cast-index N` 以本单位第 N 次施法为锚点（默认第 1 次）；`--from-start 1` 从开战（第 0 tick）开始录，锚点之前的普攻和施法都在窗口里；`--lead-ms MS` 从锚点前 MS 毫秒开始（不早于开战）；都不带时和以前一样，从锚点前 0.5 秒开始。`--from-start` 和 `--lead-ms` 只能选一个。实战录制的 `--times` 必须从 0 开始（jobs-check 不符合判 FAIL）。gate.json 记 `window`（锚点和起点），`actionAtMs` 是锚点施法在录制时钟上的位置。

`--foe-offset K`（只用于 `--real 1`）：所有目标整体横移 K 列（正数往右），让目标站在施法者侧前方，比如光束横着出现在画面里，而不是正对镜头被透视压短。平移后每个目标都要在第 0–6 列（`--nfoes 1` 时最好用）；不带时站位不变。

录的是当前检出的代码。如果要录测试服上的版本，先检出测试服的 SHA 再录。

## 装备和第二个友军（--items / --ally2，仅 --real）

- `--items me=a+b,ally=c,ally2=d`：给我方单位带装备。每个单位最多 3 件，id 用 `src/simulation/content/items.ts` 里的装备 id。不加这个参数时谁都不带装备，录出来的内容和以前逐字节一样。暂时不支持给对手带装备（写 `foe=` 会直接报错）。
- 带了什么装备会写进 `gate.json` 和 `render-meta.json` 的 `items` 字段、keyframes 标题条，以及 jobs-check 的那一行。画面上看不到装备图标，因为录制页没有接客户端的图标钩子。
- `item-advice.cjs` 列出装备怎么选：
  - **首选**：纯属性的那几件。坦克优先用狂徒、石像鬼、坚定之心。
  - **警告**：护盾、治疗、灼烧、额外伤害、无法选中、减益标签、暴击类的装备，jobs-check 会警告，但不会拦下。暴击三件可以用在暴击专题的录制里，要在任务行里写明。
  - **节奏类**：改出手或攒蓝节奏的装备不警告，但标题条会注明。其中朔极之矛和蓝霸符可以让非坦克英雄更早放出技能。
- `--ally2 X --ally2star N --ally2-cell R,C`：我方再加一个单位，用于"坦克加搭档"这类摆法。默认站在施法者前一排、右边一列，星级默认 2。

`--foe-items foe=a+b,foe2=c`（仅 `--real`）：给敌方单位（foe … foe4，每个最多 3 件）配装备，走规则里只供录制用的敌方装备入口；规则会按名拒绝写错的装备、非敌方单位、重复槽位。和 `--items` 一样写进 gate.json / render-meta.json 和关键帧说明。

`--after-end-ms N`（仅 `--real`，0–5000）：录制窗口可以越过战斗最后一拍再录 N 毫秒。这段时间规则不再推进，棋盘停在最后状态，已起播的特效照常播完，和游戏里战斗结束后到下一回合前看到的一样。不带这个参数时，窗口越过战斗结束会被判不通过。带了以后，窗口越过结束时目标已死不算不通过，因为录的就是收尾那一下。
