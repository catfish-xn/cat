# 3D 动作覆盖与正式清单合并验收

2026-10-20；LF clone，分支 `codex/assets3d-anim-coverage`，起点 `3971d090b13519a45675f972b18abb5d38d78b11`。仅修改 scripts/assets3d 与 tests/assets3d-*.test.ts；未写 .git、联网、安装依赖或调用素材 exe。原共享 batch/all 保持不动。

## 覆盖结论

| 动作 | 原批次 | 新批次 GLB / 合并清单（隔离验收） | 说明 |
| --- | ---: | ---: | --- |
| idle | 60/60 | 60/60 | 原选择不变 |
| move | 60/60 | 60/60 | 原选择不变 |
| attack | 56/60 | 56/60 | 本轮不扩大普攻范围 |
| cast | 37/60 | 55/60 | 新增 18 个，原 37 个选择不变 |
| hit | 0/60 | 0/60 | 没有专用可绑定的受击 ANM，不拿命中段或死亡冒充 |
| death | 60/60 | 60/60 | 原选择不变 |

新增 cast：draven、singed、leona、rell、sett、tristana、vander、zeri、ezreal、loris、nami、nunu、renni、corki、ekko、illaoi、caitlyn、sevika。

完整原图、所有 clip 文件名与 ANM 路径、非 Atomic 项及源文件 SHA-256 均在 [ANIMATION-SOURCE-APPENDIX.md](ANIMATION-SOURCE-APPENDIX.md)。附录覆盖全部 60 个单位，不只是缺 cast 的 23 个。读取实际 AnimationGraphData 绑定和 linked bin（Amumu 为 skin1），并校验 extraction.json 记录。图键是 hash；仅列可用本地词表校验的名字候选，未知键原样保留，不伪造完整反解。

## 仍缺的动作

| 单位 | 动作 | 分类 | 源证据与处理 |
| --- | --- | --- | --- |
| amumu | cast | 源数据无此动作 | 绑定 skin1 图只有 attack/crit、idle、run、dance、death，未拿普攻替代 |
| ambessa | cast | 无法判定 | SpellChain_Strike 与 SpellFist_Dash/Throw/DashBackwards；没有唯一施法入口，需要形态/序列语义，暂不选 |
| drmundo | cast | 无法判定 | 仅 Spell4_Idle/Run/Out_Idle/Out_Run，只有技能状态/退出姿势，没有可确认的起手段 |
| gangplank | cast | 无法判定 | Spell_Melee、Melee_Ignite、Ranged_Summon/Blast 并存，单一 cast 映射缺少近/远程形态选择依据 |
| jayce | cast | 无法判定 | Spell1_GainShield、Spell1_Right 及 Spell2_Ranged_Jump/KnockHexCrystals 并存，同优先级多候选 |
| 全部 60 单位（逐个见附录） | hit | 源数据无此动作 | 没有专用可识别受击 ANM；57 个图键 Knockup 实际引用 Death ANM，不能当受击；另有 Attack*_Hit、Vi Spell4_hit 均属打击/施法命中段 |

“源数据无此动作”限于当前绑定皮肤图中可识别的动作，不声称整个游戏或其他皮肤没有此动作；未知 hash 不作为不存在的证明。当前 hit 无法判定项为 0（没有发现未排除的受击候选）；cast 无法判定项为 4。

## 规则与接口

- 通用 cast token 增加完整动作后缀、spell1a、编号 spell、spell_3、spellup、起手 in/start/intro/activate/first、brace，以及 cast/ability/channel/ult 命名；排除 out/toidle/idle/run/loop/end/finish。按通用编号优先级选择 Ezreal Spell2_In、Sevika Spell1_Activate，不按英雄 ID 分支。
- hit 增加 hurt/flinch/knockup 命名，但排除 spell/attack/cast/ability/ult/channel 及 death/die。排除同时约束图别名和显式覆盖，防止 Knockup → Death、Hit → Spell_Hit 伪覆盖。
- 单位级覆盖仅新增 Draven：`animations.cast = spell1_spin_left_right`，`animationNotes.cast` 记录 Spin_Left_Right 起手与 Arm_Catches 接斧/收尾的区分依据。Jinx/Vi 原五段覆盖不变。所有显式覆盖必须在当前图的合格 AtomicClipData 中找到，否则不回退冒充。
- `actionDecisions` 保留 reason，并增加 sourceStatus（no-source-action / undetermined）；显式选择 method 统一为 unit-explicit。未改 src/rendering3d；现有 animation-state 已支持 packetDamage → hit。
- 新 `merge-manifests.mjs` 合并 schemaVersion/models/effects，复制模型、特效及其 texture/mesh/distortion.normalMap 引用。ID/路径冲突拒绝，缺项写报告且不发布部分清单；哈希一致重跑跳过，已有不同内容拒绝覆盖。所有写入走 safe-path。

## 共享目录运行限制

用户指定的两条 build-all 新目录命令及生成 all-anim 的合并命令均已尝试，退出 1：`unsafe-output-path`。原因是 `assets3d-local` 为联接，实际指向 `../assets3d/assets3d-local`，现有 safe-path 主动拒绝输出根逃出 LF clone。这是脚本边界，不仅是沙箱；没有放宽安全检查或改链接。

为继续验证模型与贴图，在 `scripts/assets3d/.verify-local` 临时隔离副本中使用本轮脚本，直接只读共享源数据，输出到隔离副本自己的 assets3d-local；测试也在此副本逐文件执行，防止现有测试向共享联接写入。临时副本在记录证据后清理。隔离结果不代表目标共享 all-anim 已生成。

实际共享目录 `assets3d-local/out-anim/` 与 `assets3d-local/all-anim/` 的生成仍需调度方在持有普通 assets3d-local 目录的 `../assets3d` 仓库中运行本轮更新脚本。不得覆盖原 batch-* 或 all。

## 隔离真实重建与合并结果

两批命令使用同样的 --units/--cost/--out/--force，仅显式 --source 指回原 LF clone 的共享源目录；在临时副本自己的非联接 assets3d-local 输出。两批均退出 0，全部 60 份 gltf-validator 为 0 error、0 warning。

| 批次 | 成功 | 失败 | 缺单位映射 | 全部构建产物字节（含报告/sidecar） |
| --- | ---: | ---: | ---: | ---: |
| out-anim/batch-cost12 | 27 | 0 | 0 | 74,106,797 |
| out-anim/batch-cost345 | 33 | 0 | 0 | 130,512,448 |

`verifyAnimationRebuild` 读取原共享 batch 作为 before、新隔离 batch 作为 after：60/60 非动画内容一致，60/60 旧动画曲线/通道一致；42 个未改动作的单位整份 GLB 字节相同。其余 18 个仅新增 cast。模型、节点、骨骼、材质和嵌入贴图均未回退。

| 单位 | 原共享 batch 与新隔离 batch 相同的 GLB SHA-256 |
| --- | --- |
| jinx | `19e25e90ef3f2731b425be8468ae7fd3d5a7e9cbf25a98fe2249e114d7f1af79` |
| vi | `6f1405718d68eabe1975f372d9879fcbb8f5fbc1c61402cd3c37c0db3c0ffab2` |

正式合并脚本在隔离目录运行两次均退出 0，合并 manifest 实测 cast 55、hit 0：

| 指标 | 首次 | 重跑 |
| --- | ---: | ---: |
| 模型 | 60 | 60 |
| effects | 0 | 0 |
| GLB / 去重 runtime payload 字节 | 107,984,972 | 107,984,972 |
| manifest 字节（单列） | 15,632 | 15,632 |
| 写入文件 / 字节 | 60 / 107,984,972 | 0 / 0 |
| 哈希相同跳过文件 | 0 | 60 |
| 缺失项 | 0 | 0 |

本批 manifest 没有 effects，未凭空补特效；effects 合并及间接 texture/mesh/normalMap 复制由合成样本验证。以上模型数与字节是隔离 all-anim 的实测结果，真实共享 all-anim 尚未生成，不能直接用查看参数访问此临时产物。

## 使用与交接

```powershell
node scripts/assets3d/build-all.mjs --units all --cost 1,2 --out assets3d-local/out-anim/batch-cost12 --force
node scripts/assets3d/build-all.mjs --units all --cost 3,4,5 --out assets3d-local/out-anim/batch-cost345 --force
node scripts/assets3d/verify-animation-rebuild.mjs
node scripts/assets3d/merge-manifests.mjs --from assets3d-local/out-anim/batch-cost12 assets3d-local/out-anim/batch-cost345 --out assets3d-local/all-anim/
```

`--from` 可重复给出；输出报告为新根的 merge-report.json。模型字节 modelBytes 单列；bytes 为去重后的全部运行时 payload 字节，不含 manifest/report；missing 列出缺项。详见 [README](README.md)。

共享 all-anim 成功生成后查看：`?render=3d&assets3d=/assets3d-local/all-anim/`。本轮无外壳接入需求；若进一步增加多形态选择，应由 Claude 接 src/rendering/ 并另行约定动作输入。

## 验证

- `npx.cmd tsc --noEmit`：通过。
- 逐文件 `npx.cmd vitest run tests/<file> --configLoader runner --project fast --no-cache`：19 个 assets3d 文件 251 通过、1 个既有 Windows 文件 symlink 权限条件跳过；8 个 rendering3d 文件 211 通过。总计 462 通过、1 跳过，没有运行全套测试。新增测试不设置单条超时。
- 隔离副本首轮 rendering3d-isolation 因未复制 vite.config.ts 失败；补齐原样 Vite 配置及 index.html 后单文件重跑通过（14.77 s），未改生产配置、入口或测试断言。
- 新合成测试覆盖动作规则、缺项/歧义/仅持续姿势、显式单位覆盖、死亡/命中段防冒充、多批合并、ID 冲突、越界/链接拒绝、重复哈希跳过、effects 和间接资源合并、缺项报告及已有不同内容保护；模型守卫测试能区分非动画图片变化和旧动画变化。

## 建议提交信息

`feat(assets3d): audit animation coverage and add safe batch manifest merging`
