# D7 第 3 步（d）验收记录

分支 `codex/assets3d-batch`，起始 HEAD `8d560595cfef8b8ba40f0786ba28dc22a69d0390`。改动只留工作区；没有写 .git、联网或调用素材转换 exe。

## 批量构建

| 批次 | 成功 | 失败 | 缺单位映射 | 产物字节 |
| --- | ---: | ---: | ---: | ---: |
| batch-cost12 | 27 | 0 | 0 | 56706304 |
| batch-cost345 | 33 | 0 | 0 | 82971107 |

失败原因分组：无。失败单位：无。60 个单位均通过结构检查，本机 gltf-validator 均为 0 error、0 warning。成功表示转换和结构检查通过；不表示全部动作可判定或完成游戏内视觉验收。

## 动作覆盖

通用优先级在 unit-map.json 的 `$animationRules`；先匹配图别名，再匹配文件名 token。同优先级存在多个不同路径时省略并报告候选。不拼接 Sequencer/Selector。原有 jinx/vi 五段选择保留作第 2 步兼容基线，仍须在真实动画图中找到文件；其余单位没有新增硬编码。

| 动作 | 覆盖 | 缺少或无法唯一判定的单位 |
| --- | ---: | --- |
| idle | 60/60 | 无 |
| move | 60/60 | 无 |
| attack | 56/60 | vex、zeri、gangplank、drmundo |
| cast | 37/60 | amumu、draven、singed、leona、rell、sett、tristana、vander、zeri、ezreal、gangplank、loris、nami、nunu、renni、ambessa、corki、drmundo、ekko、illaoi、caitlyn、jayce、sevika |
| hit | 0/60 | 全部 60 个单位，完整清单如下 |
| death | 60/60 | 无 |

hit 缺项：amumu、darius、draven、irelia、lux、maddie、morgana、powder、singed、steb、trundle、vex、violet、zyra、akali、camille、leona、nocturne、rell、renata、sett、tristana、urgot、vander、vladimir、zeri、ziggs、blitzcrank、cassiopeia、ezreal、gangplank、kogmaw、loris、nami、nunu、renni、scar、smeech、swain、twistedfate、ambessa、corki、drmundo、ekko、elise、garen、heimerdinger、illaoi、silco、twitch、vi、zoe、caitlyn、jayce、jinx、leblanc、malzahar、mordekaiser、rumble、sevika。

省略原因：

- attack / ambiguous-action：vex、zeri、gangplank、drmundo。
- cast / ambiguous-action：draven、singed、leona、rell、tristana、vander、zeri、gangplank、nunu、renni、corki、ekko、illaoi、caitlyn、jayce、sevika。
- cast / missing-atomic-action：amumu、sett、ezreal、loris、nami、ambessa、drmundo。
- hit / missing-atomic-action：全部 60 单位。没有把施法 hit 段冒充受击。

每单位报告保留 graphClips（含非 Atomic 类型、flags、hash）和 actionDecisions（选择方法、路径、候选）。动作缺项不构成结构转换失败。

## 第 2 步对照

原始参考 rigged.glb 可正常读取；旧批量失败根因是导出动作全集，导致 compareModels.namesMatch=false。现批量和单体统一只导出所选动作集，两单位的参考姿态、时长、骨骼、顶点检查均通过。此比较不验证材质像素。

| 单位 | 第 2 步 SHA-256 | 本次 SHA-256 |
| --- | --- | --- |
| jinx | `620658c3eff0ea8d00e3702d3c3cb57c487744297790ca5da605e60d067f1f51` | `19e25e90ef3f2731b425be8468ae7fd3d5a7e9cbf25a98fe2249e114d7f1af79` |
| vi | `b571abadf34845c4f0941c3545e7c12ea8e8db99e317c93615033e656262575d` | `6f1405718d68eabe1975f372d9879fcbb8f5fbc1c61402cd3c37c0db3c0ffab2` |

- Jinx：Body/Torch 贴图路径均与旧手工表一致；按 initialSubmeshToHide 删除 Torch primitive、材质及嵌入图片，所以 GLB 哈希不同。顶点属性、五段完整动画曲线和节点逐项相同。
- Vi：初始 Material 链接 TierUpgrade，Diffuse_Texture 使用 `tft13_vi_base_tx_cm`（512×512）；旧表 `tft13_vi_skin0_tx_cm`（1024×1024）属于 RebelStatus 动态材质。两个路径和像素不同，不能声称映射等同。当前候选遵循 bin 初始材质；旧表保留作比较，不参与绑定。顶点属性、五段完整动画曲线和节点逐项相同。

Vi 的结果推翻了“解析结果应与手工表一致”的原假设。夹具测试明确验证这一差异，没有伪造相等断言。若要求旧外观，需用户选择显式兼容覆盖；建议以 bin 初始材质为准。夹具 fixtures/step2-bindings.json 只含名字与路径字符串，无素材二进制。

## 兼容处理与限制

- 角色主 PROP 位于无扩展名的 `characters/<sourceName>`；StaticMaterialDef 通常在此。已修正单位归属。
- 已从现有缓存补提取 60 份主 PROP（4,512,824 字节）；基于真实 bin 第二轮计划又补提取 1,028 项（30,148,774 字节）。未下载内容。计划仅增加已知 WAD 中的直接依赖，不宣称完整传递闭包。
- 动画图跟随皮肤 AnimationGraphData/linked_files：例如 Amumu 使用 animations/skin1.bin。
- Trundle 所需 uncompressed ANM v4 已支持，保持边界和扩张预算；其他未实现版本仍明确失败。
- 零权重 JOINTS_0 置 0。零法线按邻面重建；Renni 1 个、Mordekaiser 8 个零法线顶点无可用邻面，使用 +Y，并记录 normalRepair。
- Ziggs/Malzahar 的大小写重名定位骨 hash 碰撞：已确认无权重且无子节点，保留 bind pose 并记录。若涉及变形骨或有子节点，明确失败。
- ANM 中不属于当前 rig 的额外轨道省略，每动作记录 omittedUnboundTracks/omittedBoneHashes，不猜骨名。
- Renata 的 Weapon_Glass / Canister_Glass 没有漫反射 sampler，是程序化玻璃 shader。使用源 Glass_Color1 做明确标注的平面不透明颜色近似，记录 solidMaterials.reason；不宣称还原透明度、Fresnel 或完整 shader。
- 隐藏子网格不输出 primitive，也不要求隐藏部件的外部贴图可用；仍保留完整源顶点缓冲以保持绑定及对照。
- 粒子仍是 v1。jinx/vi 有 source-json，其他 58 单位明确报告 missing-source-json；没有实现 v2。
- 只有 jinx/vi 有独立参考 GLB；其余 58 单位不虚报独立参考或视觉验收。

## 验证

- `npx.cmd tsc --noEmit`：通过。
- 逐个运行 15 个 tests/assets3d-*.test.ts，均用 `--configLoader runner`：最终 167 通过、1 个既有条件跳过。
- 初轮旧“v4 不支持”断言已随新增 v4 支持更新，单文件重跑通过。其余文件均通过；新增模型兼容测试另已重跑通过。
- 两条用户指定 build-all 命令均完成，退出码 0。

## 建议提交信息

`feat(assets3d): resolve PROP skin materials and animation mappings for 60-unit builds`
