# D7 第 2 步交付记录

日期：2026-10-19。分支 `codex/assets3d-convert`，起点 `9cdf0de9239c085aae74c2735da2598f178b822c`。仅修改 `scripts/assets3d/**` 与新增 `tests/assets3d-*.test.ts`；未修改 src、既有测试、依赖、Git 元数据。未联网，未运行外部转换二进制。素材和输出均在被忽略的 `assets3d-local/`。

## 模型、动作和独立对照

输入来自 `trial/local/extracted`；旧 `rigged.glb` 只用于对照。输出使用原生 League 单位、X 反射、Y 向上和 +Z 正面；根节点无缩放。原点按 Body 绑定几何脚底及 XZ 中心平移，平移同步应用于顶点、根骨骼、动画和逆绑定。完整网格保留金克丝 Torch 道具，因此完整 bbox 可延伸至脚底以下。

| 英雄 | 顶点 | 三角形 | 骨骼 | 动作 | GLB 字节 | bbox 高度 | 最大世界平移误差 | 最大世界旋转误差 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| jinx | 5,163 | 5,926 | 89 | 5 | 1,644,996 | 234.378829 | 0.015226585 | 0.013688718° |
| vi | 4,247 | 4,818 | 72 | 5 | 1,712,304 | 212.670156 | 0.000052818 | 0.000015081° |

骨骼数量和父子层级、全部动作的名称映射和时长均与参考一致。参考旧名 idle/move/attack/cast/death 通过 `unit-map.json` 映射到输出源动作名；没有受击动作，manifest 省略 hit。金克丝 5 段均为压缩 v1，蔚 4 段为压缩 v1，cast 为非压缩 v5。

| 英雄 | 状态 | 源 clip 名 | GLB 秒 | 帧数 |
| --- | --- | --- | ---: | ---: |
| jinx | idle | `tft13_jinx_idle1` | 1.033333421 | 32 |
| jinx | move | `tft13_jinx_minigun_run` | 0.900000036 | 28 |
| jinx | attack | `tft13_jinx_minigun_attack1` | 1.533333421 | 47 |
| jinx | cast | `tft13_jinx_spell_deathrocket` | 1.766666770 | 54 |
| jinx | death | `jinx_minigun_death` | 1.466666698 | 45 |
| vi | idle | `vi_idle1` | 1.300000072 | 40 |
| vi | move | `vi_run1` | 0.833333373 | 26 |
| vi | attack | `vi_attack1` | 1.133333445 | 35 |
| vi | cast | `vi_spell4_hit` | 0.933333397 | 29 |
| vi | death | `vi_death` | 1.133333445 | 35 |

v1 导出采样时钟与旧导出一致，末帧为 source duration 前一个帧间隔。报告同时保留源时长和 GLB 时长，不把二者混称。

每段动作取参考时长的 0、1/2、1 三个时刻，使用 GLB 的 LINEAR / quaternion slerp 采样，比较所有皮肤骨骼的世界平移及旋转。参考只应用声明的 X 反射和原点平移，不做拟合或放宽容差。固定阈值为平移 ≤ 0.5 游戏单位、旋转 ≤ 0.5°，时长差 ≤ 0.000001 秒。

jinx 的唯一 POSITION 顶点在相同声明变换下最大误差 0.000004346 游戏单位（额外阈值 0.0001），本地结构校验通过；Khronos JS validator 2.0.0-dev.3.10：0 错误、0 警告。
vi 的唯一 POSITION 顶点在相同声明变换下最大误差 0.000005632 游戏单位（额外阈值 0.0001），本地结构校验通过；Khronos JS validator 2.0.0-dev.3.10：0 错误、0 警告。

## 贴图、粒子和合同

TEX/DDS 的 BC1/BC3 解码、PNG 编码均为纯 Node。现有两名英雄目录内 52 张贴图全部转换（jinx 42，vi 10），格式跳过 0；GLB 内嵌 PNG 为金克丝 2 张、蔚 1 张，均无外部贴图或解码器扩展。

| 英雄 | 系统/文档数 | 映射 sprite | 已知类型跳过 | 拒绝发射器 |
| --- | ---: | ---: | ---: | ---: |
| jinx | 34 | 0 | 70 | 182 |
| vi | 11 | 0 | 14 | 33 |

跳过类型包括 mesh、trail、明确的 screenDistortion。连续发射、概率分布、发射器位置、向量尺寸、特殊生命周期和未知语义导致整个 sprite 拒绝。未将 ArbitraryQuad/Ray 伪装为 sprite。每个发射器均有 `sourcePath / mapped / status / reason / originalFields` 旁路记录；报告不进 manifest。

45 份粒子 JSON 逐份直接调用源码 `parseParticleDocument` 通过；manifest 直接调用 `assertManifest` 通过。通过纯 JS TypeScript loader 加载权威源码，无规则拷贝。与抄录差别：实际解析器未要求 texture 的扩展名为 PNG，且 opaque kind 不检查内部字段；本工具仍只输出 PNG 路径，并为 opaque kind 只写 kind。未改合同。

源 JSON 有 151 个贴图引用在当前 extracted 中缺失，已逐路径记入 build-report；所有依赖它们的实际发射器均被拒绝或作为已知类型跳过，输出 sprite 没有悬空贴图。本次没有可显示的 sprite 特效，不能把“文档校验通过”表述成“视觉技能特效已经还原”。

`actionEffects` 是 build-report 内按源系统名称匹配的建议：金克丝 W/E/R 与 cast、BA 与 attack；蔚 Q 系统与 cast。没有写进 manifest，也没有修改 D8 接线。

## 产物大小

manifest：5,823 字节；out 共 147 个文件，12,647,579 字节（12.062 MiB，包含 fetch-plan 和 build-report）。
fetch-plan：5,264,307 字节；build-report：124,348 字节。输出报告包含每个载荷的 SHA256；报告自身不做递归自哈希。

输出可通过 `node scripts/assets3d/build.mjs --units jinx,vi --source assets3d-local/trial/local --out assets3d-local/out` 重建；已存在时显式加 `--force`。开始写载荷之前将 build-report 标记为 ready:false，全部检查后才写 ready:true，避免失败重建遗留旧成功标记。没有清空原始目录或输出目录。

## 离线下载计划

模拟层 60 个单位全部列出，费用分布 14/13/13/12/8；5,502 条 WAD 条目、6,255 个全局去重压缩块，计划总下载 77,856,018 字节（74.249 MiB）。
当前还缺 6,107 块，需额外下载 75,636,001 字节（72.132 MiB）；本步没有发请求。

| WAD | 条目 | 覆盖压缩块 | 下载字节 | 共享候选条目 |
| --- | ---: | ---: | ---: | ---: |
| DATA/FINAL/TFTSet13.wad.client | 4,857 | 5,598 | 69,126,452 | 2,401 |
| DATA/FINAL/TFTCommon.wad.client | 645 | 723 | 9,031,683 | 645 |

逐 WAD 汇总可以重复包含同一压缩块，最终预算以全局去重总量为准。计划保守纳入 TFTSet13 与 TFTCommon 全部条目；58 名英雄缺少源 JSON，尚未证明跨 WAD 的传递依赖闭包。已知两名英雄会额外解析源 JSON 的直接引用，无法在这两个 WAD 中解析的路径逐项列入 unresolvedReferences，不编造下载字节。

下表列“自有条目”和“含已知直接引用的计划条目”；只有 jinx / vi 有源 JSON。逐英雄字节不含余下共享候选，且英雄之间会重复覆盖压缩块，不能相加代替全局预算。完整条目的路径、WAD、范围、bundle、块 ID 和字节数在本地 fetch-plan 中。

| 模拟层 id | 源名称 | 自有条目 | 计划条目 | 压缩块字节 | 未解析源引用 |
| --- | --- | ---: | ---: | ---: | ---: |
| akali | tft13_akali | 38 | 38 | 720,690 | 源 JSON 未提供 |
| ambessa | tft13_ambessa | 81 | 81 | 1,605,902 | 源 JSON 未提供 |
| amumu | tft13_amumu | 16 | 16 | 186,464 | 源 JSON 未提供 |
| blitzcrank | tft13_blitzcrank | 64 | 64 | 1,031,044 | 源 JSON 未提供 |
| caitlyn | tft13_caitlyn | 78 | 78 | 1,095,491 | 源 JSON 未提供 |
| camille | tft13_camille | 30 | 30 | 418,941 | 源 JSON 未提供 |
| cassiopeia | tft13_cassiopeia | 37 | 37 | 492,679 | 源 JSON 未提供 |
| corki | tft13_corki | 33 | 33 | 309,626 | 源 JSON 未提供 |
| darius | tft13_darius | 32 | 32 | 599,598 | 源 JSON 未提供 |
| draven | tft13_draven | 54 | 54 | 653,114 | 源 JSON 未提供 |
| drmundo | tft13_drmundo | 71 | 71 | 1,070,465 | 源 JSON 未提供 |
| ekko | tft13_ekko | 27 | 27 | 534,910 | 源 JSON 未提供 |
| elise | tft13_elise | 79 | 79 | 1,058,427 | 源 JSON 未提供 |
| ezreal | tft13_ezreal | 56 | 56 | 788,415 | 源 JSON 未提供 |
| gangplank | tft13_gangplank | 42 | 42 | 614,444 | 源 JSON 未提供 |
| garen | tft13_garen | 51 | 51 | 577,348 | 源 JSON 未提供 |
| heimerdinger | tft13_heimerdinger | 32 | 32 | 459,202 | 源 JSON 未提供 |
| illaoi | tft13_illaoi | 28 | 28 | 624,130 | 源 JSON 未提供 |
| irelia | tft13_irelia | 35 | 35 | 1,038,454 | 源 JSON 未提供 |
| jayce | tft13_jayce | 60 | 60 | 888,192 | 源 JSON 未提供 |
| jinx | tft13_jinx | 78 | 188 | 1,780,214 | 1 |
| kogmaw | tft13_kogmaw | 37 | 37 | 507,715 | 源 JSON 未提供 |
| leblanc | tft13_leblanc | 68 | 68 | 1,057,233 | 源 JSON 未提供 |
| leona | tft13_leona | 46 | 46 | 607,721 | 源 JSON 未提供 |
| loris | tft13_beardy | 50 | 50 | 952,748 | 源 JSON 未提供 |
| lux | tft13_lux | 25 | 25 | 307,649 | 源 JSON 未提供 |
| maddie | tft13_shooter | 32 | 32 | 493,427 | 源 JSON 未提供 |
| malzahar | tft13_malzahar | 50 | 50 | 1,159,922 | 源 JSON 未提供 |
| mordekaiser | tft13_mordekaiser | 64 | 64 | 1,097,644 | 源 JSON 未提供 |
| morgana | tft13_morgana | 45 | 45 | 818,341 | 源 JSON 未提供 |
| nami | tft13_nami | 37 | 37 | 520,906 | 源 JSON 未提供 |
| nocturne | tft13_nocturne | 39 | 39 | 408,698 | 源 JSON 未提供 |
| nunu | tft13_nunuwillump | 34 | 34 | 673,294 | 源 JSON 未提供 |
| powder | tft13_blue | 28 | 28 | 597,923 | 源 JSON 未提供 |
| rell | tft13_rell | 40 | 40 | 614,280 | 源 JSON 未提供 |
| renata | tft13_renataglasc | 53 | 53 | 626,318 | 源 JSON 未提供 |
| renni | tft13_chainsaw | 41 | 41 | 775,388 | 源 JSON 未提供 |
| rumble | tft13_rumble | 24 | 24 | 663,809 | 源 JSON 未提供 |
| scar | tft13_flyguy | 37 | 37 | 799,813 | 源 JSON 未提供 |
| sett | tft13_sett | 30 | 30 | 651,004 | 源 JSON 未提供 |
| sevika | tft13_lieutenant | 67 | 67 | 981,848 | 源 JSON 未提供 |
| silco | tft13_silco | 28 | 28 | 505,134 | 源 JSON 未提供 |
| singed | tft13_singed | 28 | 28 | 620,530 | 源 JSON 未提供 |
| smeech | tft13_gremlin | 44 | 44 | 693,044 | 源 JSON 未提供 |
| steb | tft13_fish | 37 | 37 | 589,375 | 源 JSON 未提供 |
| swain | tft13_swain | 35 | 35 | 665,434 | 源 JSON 未提供 |
| tristana | tft13_tristana | 32 | 32 | 447,499 | 源 JSON 未提供 |
| trundle | tft13_trundle | 16 | 16 | 258,884 | 源 JSON 未提供 |
| twistedfate | tft13_twistedfate | 32 | 32 | 508,079 | 源 JSON 未提供 |
| twitch | tft13_twitch | 35 | 35 | 573,979 | 源 JSON 未提供 |
| urgot | tft13_urgot | 26 | 26 | 431,905 | 源 JSON 未提供 |
| vander | tft13_prime | 21 | 21 | 501,947 | 源 JSON 未提供 |
| vex | tft13_vex | 48 | 48 | 1,124,437 | 源 JSON 未提供 |
| vi | tft13_vi | 26 | 99 | 1,729,209 | 0 |
| violet | tft13_red | 25 | 25 | 577,174 | 源 JSON 未提供 |
| vladimir | tft13_vladimir | 35 | 35 | 513,115 | 源 JSON 未提供 |
| zeri | tft13_zeri | 28 | 28 | 619,504 | 源 JSON 未提供 |
| ziggs | tft13_ziggs | 27 | 27 | 422,154 | 源 JSON 未提供 |
| zoe | tft13_zoe | 28 | 28 | 689,322 | 源 JSON 未提供 |
| zyra | tft13_zyra | 36 | 36 | 688,168 | 源 JSON 未提供 |

## 测试与交付边界

本地 `npx.cmd tsc --noEmit` 通过。逐文件运行全部 10 个 `tests/assets3d-*.test.ts`，均使用 `--configLoader runner`：81 通过、1 个既有文件符号链接用例因 Windows EPERM 跳过；新增 49 个用例全部通过，未改既有断言或时限。未跑全套、浏览器或联网 CI。

合成样本覆盖压缩/非压缩 ANM、两类样条与四元数符号、BC1/BC3、DDS/TEX mip、PNG CRC/扫描线、SKN/SKL→GLB 镜像/原点/逆绑定、对照器的反例、粒子拒绝与合同交叉校验、manifest/路径、CLI、RMAN 表/缓存范围/块去重。不把真实素材作为测试夹具。

远端 CI、提交、推送及 PR 均未执行：按任务边界留给调度方。本地工作区仅代码、测试和文档，所有素材和产物保持 ignored。

## 风险、未完成与建议

- 可见技能粒子还原未完成：v1 无法表达这些源 sprite；后续由用户决定是否规划 v2，本步未扩大合同。
- 下载计划是明确标注的保守候选预算；跨 WAD 未解析引用没有完整字节预算，不能宣称这是完整 60 英雄资产包的精确总下载量。
- ANM 非官方格式由本地样本反推并通过参考数值验收；未遇到的版本或 TEX/DDS 格式明确拒绝/报告，不保证全英雄通用。
- 建议由调度方提交到 3d 的 PR 后运行远端 CI，再交 Claude 做 D8 接线；不提交 assets3d-local。

建议英文提交拆分（依次提交）：

1. `feat(assets3d): decode raw rigs, spline animations and BC textures` — animation/model/texture/compare 与其合成测试。
2. `feat(assets3d): build contract-validated assets and offline fetch plans` — build、particles、runtime/ts-loader、unit-map、RMAN/plan-fetch 及合同/下载测试。
3. `docs(assets3d): document D7 conversion results and fetch budgets` — README 与本交付记录。

