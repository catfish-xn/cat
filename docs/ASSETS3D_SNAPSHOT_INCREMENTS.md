# 素材快照的增量操作

现在线上用的 3D 素材根，最初由 `build-asset-root.mjs` 多根合并生成，之后在服务器上一次次增量修改，已经没法从源头整根重建。整根重建出来的根会缺模型，也会丢掉后来补进去的字段（光照、片段范围、施法序列等）。所以在"整根可重建"这件事收口之前，素材根**只走增量**，每一次都要用下面的工具，每一次都要留记录。本文就是这件事的第一步。

## 本地快照

- 增量一律先做在 **本地快照目录** 里。这个目录是现行根的一份完整副本，没有上测试服。线上根的副本和测试服都不能直接改。
- 改完以后，在机器上用 `asset-local-register <目录> <基于的快照号>` 登记。快照号的算法是：先列出每个文件的 sha256，排序，再对整份清单取 sha256，取前 12 位。和服务器快照用的是同一种算法，所以同一批文件以后上了测试服，快照号不会变。录制时要标出这个快照号；不同快照录出来的图，不能放在同一组里对比。
- 每做一次增量，快照号都会变，要重新登记。

## 三个工具

### 1. `scripts/assets3d/snapshot-add.mjs`：只加不改

```sh
node scripts/assets3d/snapshot-add.mjs --root <本地快照目录> --tag <名字> --models <build-all/compress 的输出根> --dry
node scripts/assets3d/snapshot-add.mjs --root <本地快照目录> --tag <名字> --vfx-pack vfx-ltk/<包目录> --vfx-from <vfx 导出目录> [--systems id,id] --dry
```

- `--models`：把构建根清单里的每个模型作为**新 id** 加进去。模型文件复制到 `roots/add-<tag>/…`，条目里的 path 改成指向这个新位置，precache 里加上对应条目。
- `--vfx-pack` / `--vfx-from`：把导出目录里的系统加进 vfx-ltk 包的 `systems/` 和 `index.systems`。包里还没有的资源，放进 `add-<tag>/`，同时登记到 `index.assets`。包里已有、内容又完全相同的资源，直接沿用，不重复复制。包的 skills 一律不动；把新系统挂到英雄身上是另一步，走代码那一侧（CUE_OVERRIDES 等）。如果包本身不存在，就新建一个，但不登记到 champions 里。
- **拒绝的情况**：id 已存在；同一路径已有文件但内容不同；已有系统或资源的内容会变；目标是线上根的副本（有 `.live-snapshot`）、测试服路径，或者没有登记过的目录。
- 不带 `--dry` 时，写入前会先用 `assertManifest`（来自 `src/rendering3d/contracts.ts`）校验清单，然后输出新旧清单的 sha256、新增文件清单和新增数量，可以直接贴进验收表。

### 2. `scripts/assets3d/replace-entry.mjs`：整条替换一个已有模型

```sh
node scripts/assets3d/replace-entry.mjs --manifest <清单文件的副本> --hero <id> --entry <只含这一条的 json> --backup-dir <目录> --dry
```

- 一次只能整条替换一个**已经存在**的模型条目，不能新增。其他模型和顶层的键只要有任何变化，就直接拒绝。
- 运行时会列出逐字段的改动，写入前先跑 `assertManifest`。改前和改后的清单各备份一份。
- 适用场景：某个模型的片段分段、施法序列、statusPose 这类条目要整体换掉。条目文件只保存在本地，原版数据不进仓库。

### 3. `scripts/assets3d/submesh-patch.mjs`：子网格显隐

见 `docs/ASSETS3D_DEPLOY_ROOT.md` 的"子网格补丁"一节。这个工具在合并入口里给模型加上 `submeshVisibility`，几何开关打开时还会追加初始隐藏的子网格。用在本地快照上时，只换改动过的模型和清单条目，不重写 packs：改动过的模型从对应包的文件列表里移出，`.bin` 不动，precache 只更新这几个文件。

### 4. 用工具复现已部署模型（以蒙多为例）

已部署的蒙多模型（384e1a99）不是从未压缩源整体打出来的，而是在压缩件上两次增量编辑的结果。要改它的几何（例如加上大招身体），先按原参数复现出逐字节一致的版本，再只换一个输入：

1. 11-02 的普攻补丁（本地工具 `attackfix-server/patch-attack.mjs`，不在仓库里）。它的产出（cf89564e）会被第 2 步整个覆盖，对结果没有影响。
2. 11-10 的 `scripts/assets3d/stage-anim-sequences.mjs`。当时的代码是 5f96edf6，回退件目录写死在脚本里、不能指定；复现时用 accfc10c 或之后的版本（新增了 `--uncompressed-fallback`），产出与 5f96edf6 逐字节一致（见下面的核对）：

```sh
node scripts/assets3d/stage-anim-sequences.mjs --assets <素材根> --extracted <解包缓存> --metadata-root <元数据根> --out-dir <目录> --only drmundo --unit-map <unit map> --uncompressed-fallback <目录>
```

- `--assets`：11-10 部署前的服务器清单，加上任一蒙多压缩件（放在清单里蒙多条目的路径上）。
- 需要追加片段时，工具会从 `--uncompressed-fallback` 目录里同一相对路径取未压缩件重建模型；不写这个参数时用脚本里原来写死的默认目录（与 5f96edf6 相同）。
- 用"子网格几何关"的未压缩件作回退件，产出与已部署的 384e1a99 逐字节一致；换成"几何开"的未压缩件，得到带 BodyUlt 的 c76e9602（正式快照 7b3c / 0c59 已带上）。
- 核对：对两步的输入和产出各打一次 sha256，和上面的值对上再往下做。

## 每次增量的验收（先报再上）

1. 变动的文件正好是预期那几个，其余文件逐字节不变。
2. 清单里变动的条目正好是预期那几条，只多出预期的字段；其余条目逐字节不变。
3. 用全量加载扫描对比前后，"原来成功、现在失败"的数量必须是 0。
4. `assertManifest` 通过，仓库 `audit --check` 通过。
5. 换上新快照前提前通知各线；跨快照的像素基线按"同状态配对"重新录。

这几条都通过以后，才能把新快照用到录制根上；要上测试服，还得另外走部署流程，并且由用户点头。
