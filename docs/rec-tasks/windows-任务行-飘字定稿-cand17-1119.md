# Windows 真显卡任务行：飘字定稿（暴击标 D + 横移封顶）近景三条 + 8v8（11-19，L4 起草，交协调者转 Windows）

- **分支：** `claude/rec-crit-cand17`（录制专用，勿合并）。飘字提交是 **d5961d1f**；分支最新头只比它多这份任务说明文件（`docs/rec-tasks/`），录最新头即可。
  - 内容：181240ba（暴击闪 #722 等）+ 飘字定稿。
  - 飘字部分和 #723 头 dd5e6488 逐字节相同，具体是：
    - 暴击字 42 px，约为普通字的 1.9 倍；
    - 暴击标 D（用户选定）：自绘斜劈撕痕，比数字深、偏红一档；
    - 相邻几条血条一起让开；
    - 不同单位的数字互相避让；
    - 为别的单位的数字横移最多 1.5 个自身宽度，到顶就留在单位旁（可轻叠数字，不压血条）；
    - 每帧从单位锚点重新找位置。
  - 没有任何录制开关，不用加 `--critmark`。
- **快照：** 0c59fc139706（正式）。
- **只录一列。** 我方 2★，阿木木 2★，不带可见装备（艾克那条带珠光护手，是为了出法术暴击）。
- **字幕写全：** 敌人、掩护、装备、快照。

## 1. 德莱文 2★ — 物理暴击 + 普通（橙）
```
node dev/castcmp/v-capture.cjs draven <输出>/draven --real 1 --star 2 --anchor attack-hit --from-start 1 --target amumu --nfoes 1 --foestar 2 --ally amumu --allystar 2 --ally-cell 4,2 --foe-cell 2,2 --layers none --systems none --ms 2600 --times 0,33,67,…,2600（30 fps） --snapshot <快照号> --assetPort <资源端口> --port <vite 端口>
```

## 2. 艾克 2★ 带珠光护手 — 法术暴击（青蓝）
```
node dev/castcmp/v-capture.cjs ekko <输出>/ekko --real 1 --star 2 --target amumu --nfoes 2 --foestar 2 --dist 1 --ally amumu --allystar 2 --ally-cell 5,2 --items me=jeweled-gauntlet --layers none --systems none --ms 2500 --times 0,33,…,2500 --snapshot <快照号> --assetPort <资源端口> --port <vite 端口>
```
- Node 核过：这一发技能打两个敌人，一个暴击（青蓝大字），一个普通。

## 3. 弗拉基米尔 2★ — 治疗（绿 +）
```
node dev/castcmp/v-capture.cjs vladimir <输出>/vladimir --real 1 --star 2 --target amumu --nfoes 1 --foestar 2 --dist 2 --layers none --systems none --ms 2500 --times 0,33,…,2500 --snapshot <快照号> --assetPort <资源端口> --port <vite 端口>
```
- 施法时给自己回血 +240；几拍后他自己也挨打，治疗和受伤数字在同一摞里。

## 4. 8v8 混战全景
```
node dev/castcmp/board-frames.cjs <输出>/brawl --board jinx,caitlyn,ambessa,vi,draven,twitch,ekko,zeri --foes drmundo,mordekaiser,leona,sevika,heimerdinger,silco,kogmaw,nami --star 2 --frames 30,36,42,…,330（每 6 帧） --cap 20 --budget 2250 --assetPort <资源端口> --port <vite 端口>
```
- 用真显卡，不加 `--gl swift`。

## 交付
- 每条近景出一个 mp4，另出 5 帧放大，覆盖弹出、回落、上飘、淡出。
- 8v8 出一个 mp4，另出 4 帧对照。
- 物理暴击那条要和原版拼"原版在上、我方在下"：
  - 原版用 Library 里的 `orig-crit-jinx3star-7fDPRPXy3VI-209.5-214.5s.mp4`（金克丝 3★，209.5 s 起）。
  - 原版裁近放大，让血条和单位大小和我方大致等比例；拼法同 `crit-orig-compare-1119`。
- 其余三条在上方标"无原版对照"。
- 看点：
  - 亮着的数字不盖任何血条；
  - 治疗和受伤数字同摞不叠；
  - 普通字 22 px，在全景下也读得清；
  - 暴击字约为普通字的 1.9 倍，左边是斜劈撕痕标（不是星星）；
  - 不同单位的数字不互相压住，也不在血条两边来回跳。
- 文件放 `win-out/`，前缀 `win-floatsD__`，附 SHA256SUMS。
