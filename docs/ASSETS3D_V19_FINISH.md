# v19 素材收尾（离线）

分支基线为 `codex/v19-assets` / `14006984`。本次没有联网、Git 写操作或界面改动。
素材、原始参数、源收据及详细报告均留在被忽略的 `assets3d-local/`。

## 已验证的增量

本机输出为 `assets3d-local/v19-additions-v2/`：

- `models/`：家人六人及维克托、梅尔的八个模型。范德、沃里克、金克丝、蔚增加
  `animations.celebrate`；蔚奥莱（`violet`）、爆爆（`powder`）的本地动画索引未找到
  dance，不注册替代片段。未用 taunt、idle 等动作冒充 dance。
- 新片段来自已有 14.24 离线提取缓存，逐文件核对 `extraction.json` 的版本、字节数和 SHA-256。
  动作追加使用与 cast 相同的骨架匹配及 accessor 转移；几何、材质、骨架和此前动画保持一致。
  具体片段、源路径和保留校验见本地 `report.json`。
- 三个六费模型以 `six-cost/rebuilt-v2/converted/` 为准；沃里克和维克托不重新引入与 death
  相同的 hit。`unitScale` 从 `model-scale/root/` 读取，只转移元数据，不用旧模型覆盖重建模型。
- `ui/ui-assets.json`：按现有 `S13Asset` 的 `kind/id/path/source/bytes/sha256` 形式提供旁路清单，
  三张候选头像注册为 `champion:warwick`、`champion:viktor`、`champion:mel`。
  PNG 位于 `ui/assets/s13/champions/`，已检查图像和哈希。
- 指定的 `characters/<key>/hud/<key>_square.tft_set13.png` 不在当前本地缓存中；实际转换源为
  同一 14.24 发布清单中三人的 `.tft_set13_evolved.tex`。清单同时记录 `requestedSource`
  和实际 `source`，不宣称与指定 PNG 字节相同；需要用户选择是否接受该替代源。
- v19 新羁绊为 `sisters`、`blood-hunter`、`machine-herald`、`banished-mage`。
  图标源映射已按本地 14.24 英文归档核对，包括梅尔的真实 API 名 `TFT13_MissMageTrait`。
  四份图像载荷均未在本地提取收据中找到；UI/Global 的 WAD 头块也不在现有 chunk 缓存，
  因而全部列入 `ui-assets.json.unavailable`，不使用其他羁绊或强化符文图标替代。
- `board/`：仅提取 `row-align/asset-root-v2/` 的默认棋盘模型、效果及 alignment/grid。
  不把该根中较旧的英雄和特效覆盖到最新测试服底包。

增量目录约 23.51 MiB，**不是已发布的新完整素材根**。

## 完整根的生成方式与当前阻断

`scripts/assets3d/v19-assets.mjs` 分为准备与最终合成两步。目录已存在时拒绝覆盖，
重新准备请换一个新输出目录；旧素材根保持原样。默认底包是本机最新的普通测试服根
`../boardwire/assets3d-local/game-v6`，可以用 `--base` 指定另一个完整根。

```powershell
# 本次已运行（已存在，不要原样重复准备）：
node scripts/assets3d/v19-assets.mjs prepare --out assets3d-local/v19-additions-v2

# 仅在接受 Evolved 头像之后，在允许现有祖先路径检查的本地终端运行：
node scripts/assets3d/v19-assets.mjs finalize --additions assets3d-local/v19-additions-v2 --out assets3d-local/test-server-v7 --portraitSource evolved
```

最终合成依次使用最新底包、默认棋盘增量、六费 FX、重建与 celebrate 模型，
再应用全体 unitScale。`compress.mjs` 输出到 `test-server-v7/`；将 2D 清单及 PNG 加入
压缩根的 precache 后调用 `pack-root.mjs`，验证所有文件、pack 整包和每个切片的 SHA-256。
未压缩中间根为 `test-server-v7-uncompressed/`。两者都要求新目录。
默认 `portraitSource=requested`，检测到 Evolved 替代源时停止；不会默默采用不同的源。

沙箱内对本机用户目录取 realpath 会返回 EPERM，所以 finalize 在普通本地终端运行
（路径检查未修改）。2026-10-21 已采用 Evolved 头像源完成：`test-server-v7/` 共 2831 个文件、
约 80 MB、7 个 pack，脚本自身的文件、pack 与切片 SHA-256 核验通过。后续若压缩中断，应换新的 `--out`。

四个输入根已各自通过 `assertManifest`、载荷哈希、模型动作及效果资源引用核验；
内存合并预检为 95 模型、521 效果、75 个 unitScale，四个 celebrate 均有真实片段，
默认棋盘 alignment/grid 保留。证据在本地 `preflight.json`；这不等于最终根验证完成。

合并器原本仅使用严格的未压缩 GLB reader，不能读取对齐底包中 meshopt 的虚拟备用 buffer。
`build-asset-root.mjs` 现在仅对这种合法运行时格式使用现有压缩 codec 校验，仍拒绝外部资源，
不改载荷内容或任何输出路径检查。新增合成测试覆盖此情况。

## 验证与界面交接

```powershell
# 默认配置打包会被沙箱阻止读取祖先目录；使用 Vite 自带 runner 加载同一配置。
node node_modules/vitest/vitest.mjs run --configLoader runner --project fast tests/assets3d-v19-assets.test.ts tests/assets3d-cast-picks.test.ts tests/assets3d-animation-rebuild.test.ts tests/assets3d-merge.test.ts tests/assets3d-unit-scale.test.ts
npx.cmd --no-install tsc --noEmit
```

上述五组共 31 项通过，TypeScript 检查通过。另已运行 `assets3d-build-root.test.ts`：
13 项中 1 项通过、12 项被同一个祖先路径 EPERM 阻断，尚不能报告该组通过。
新测试只用合成模型、图像字节、数值及收据，不需要版权素材或网络。

界面线需要接入以下数据，布局和表现由界面线决定：

1. 对家人彩蛋参与实例调用对应模型的 `celebrate`；缺映射的 `violet`、`powder` 保持现有回退。
   彩蛋时机和参与实例沿用领域公开数据，不能按英雄名自行重算资格。
2. 现有 `s13-assets.ts` / `g23-display.ts` 只读取打包的 TS 清单，没有从 3D 素材根读取 2D 清单的入口。
   需读取新根 `ui-assets.json` 的 `assets`，以 `kind:id` 注册头像与羁绊，再由加载器用素材根 URL
   解析相对 `path`；同时更新头像预加载枚举。仅生成旁路清单不会让当前界面自动显示头像。
3. `unavailable` 四个羁绊继续保留文字回退；补齐本地源后重新准备增量即可生成注册项。
4. 最终根完成 pack 与哈希核验后，再将测试服素材根 URL 指向 `test-server-v7/`。
