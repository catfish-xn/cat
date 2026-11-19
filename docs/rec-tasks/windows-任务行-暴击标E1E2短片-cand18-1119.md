# Windows 真显卡任务行：暴击标 E1 / E2 短片（11-19，L4 起草，交协调者转 Windows）

- **分支：** `claude/rec-crit-cand18`（录制专用，勿合并）。候选提交是 **b10813d2**；分支最新头只比它多这份任务说明文件（`docs/rec-tasks/`），录最新头即可。
  - 在 cand17（飘字定稿 D + 横移封顶）的基础上，改了三处，都是自定值，非原版：
    - 暴击标换成往下炸开的厚块，自绘：
      - E1 是一整块实心，下面长几根粗短的尖刺；
      - E2 是碎成 4 片往下炸开。
    - 所有数字加纯黑、不模糊的硬投影，往右下偏字号的 6.5%（约字高的 9%）。
    - 暴击弹出后过冲回落，100 ms 内到位，然后停住不飘，最后淡出。
  - 用 `--critmark E1` 或 `--critmark E2` 切换。
- **快照：** 0c59fc139706（正式）。
- **只录德莱文一条，两个候选各录一次：**
  - 2★，掩护阿木木 2★，敌人阿木木 2★，不带装备。
  - 字幕写明候选名、敌人、掩护、快照。

## 德莱文 2★ — 物理暴击，E1 和 E2 各一条
```
node dev/castcmp/v-capture.cjs draven <输出>/draven-E1 --real 1 --star 2 --anchor attack-hit --from-start 1 --target amumu --nfoes 1 --foestar 2 --ally amumu --allystar 2 --ally-cell 4,2 --foe-cell 2,2 --layers none --systems none --ms 1500 --times 0,17,33,50,…,1500（60 fps） --critmark E1 --snapshot <快照号> --assetPort <资源端口> --port <vite 端口>
node dev/castcmp/v-capture.cjs draven <输出>/draven-E2 （同上，--critmark E2）
```

## 交付
- 两个候选各出一个 mp4，原版在上、我方在下，同比例（按数字高度对齐）。
  - 原版用 Library 里的 `orig-crit-jinx3star-7fDPRPXy3VI-209.5-214.5s.mp4`，取 210.6–211.4 s 那一发 236 暴击，裁近放大。
- 另出 0、33、67、100、300 ms 五帧放大，看点：
  - 一出现就弹大，过冲后回落，100 ms 内到位，之后停住不飘；
  - 标是厚块、往下炸开，不是细线或小碎屑；
  - 数字和标都有硬投影；
  - 不压血条。
- 文件放 `win-out/`，前缀 `win-critE__`，附 SHA256SUMS。
