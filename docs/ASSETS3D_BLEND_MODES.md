# 粒子混合模式：离线证据与预览约定

保留 YXZ 朝向修复，只改 approximate 策略；strict 不接受数字枚举的行为保持不变。未联网、未执行 Git 操作。

## 四根统计

复现：`node scripts/assets3d/fx-blend-audit.mjs`。详细行留在本地 `assets3d-local/blend-audit.json`。

统计各根 effects 下全部 sidecar 发射器，含 skipped/rejected；两批各计入复制的共享 BA_Hit。当前 all 预览根名为 fx-all，其 effects 是指向 fx-trial/effects 的联接；这里只读 global 两系统。根之间共享数据，不能相加作为独立样本。

读取对应根内能找到的全部引用 PNG，每张扫描全部 alpha 像素，任一 alpha<255 即有效，全255即无有效alpha。仅支持本地转换器的 RGBA8 非交错PNG。未写出的贴图列为不可读，不推断其alpha。各根读取去重PNG数见脚本输出；下表按发射器引用计数，同一贴图可能重复引用。

| 根 | blendMode | 发射器 | 有效alpha | 全255 | 无texture | PNG不可读 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| fx-trial | 1 | 158 | 130 | 1 | 1 | 26 |
| fx-trial | 3 | 3 | 1 | 0 | 0 | 2 |
| fx-trial | 4 | 128 | 97 | 14 | 1 | 16 |
| fx-trial | 缺失 | 22 | 5 | 11 | 5 | 1 |
| fx-batch1 | 1 | 235 | 169 | 3 | 0 | 63 |
| fx-batch1 | 2 | 4 | 1 | 1 | 0 | 2 |
| fx-batch1 | 3 | 7 | 2 | 3 | 0 | 2 |
| fx-batch1 | 4 | 340 | 203 | 63 | 0 | 74 |
| fx-batch1 | 5 | 1 | 0 | 0 | 0 | 1 |
| fx-batch1 | 缺失 | 110 | 45 | 35 | 7 | 23 |
| fx-batch2 | 1 | 128 | 89 | 0 | 0 | 39 |
| fx-batch2 | 2 | 8 | 5 | 2 | 0 | 1 |
| fx-batch2 | 3 | 6 | 0 | 3 | 0 | 3 |
| fx-batch2 | 4 | 113 | 62 | 11 | 0 | 40 |
| fx-batch2 | 缺失 | 49 | 9 | 21 | 14 | 5 |
| fx-all/global | 1 | 3 | 3 | 0 | 0 | 0 |
| fx-all/global | 4 | 9 | 6 | 3 | 0 | 0 |

总数分别为311、697、304、12。不可读为对应预览根没有该PNG，不表示本地缓存或源文件不存在。本轮没有为统计额外转换这些未写出资源。

## 映射与依据

League 源数据的 `VfxEmitterDefinitionData.blendMode` 是每发射器数字渲染选择字段，与 texture、birthColor/color 的alpha独立。本地字段和既有合同没有逐枚举GPU因子、预乘与pass方程，不能仅凭字段名恢复精确公式。保留既有1/3 alpha、4加亮约定；2根据本次PNG与截图反证修正。以下全部标为 **approximated**，reason为 `visual-preview-conventions`；sidecar保留原值、约定名及未知模式的alpha证据。

| 源值 | V2 → Three | 约定名 | 依据与限制 |
| --- | --- | --- | --- |
| 1 | normal → NormalBlending | league-preview-1-normal | 沿用alpha预览；有效alpha为主，少量全255不改写已知模式 |
| 2 | additive → AdditiveBlending | league-preview-2-additive | cracks全255及黑底截图否定normal；也有有效alpha贴图，按枚举统一映射 |
| 3 | normal → NormalBlending | league-preview-3-normal | 保留现有约定；alpha样本不能单独证明源模式 |
| 4 | additive → AdditiveBlending | league-preview-4-additive | 保留既有加亮约定，兼容有效alpha与全255光图 |
| 未知值或缺失，PNG全255 | additive → AdditiveBlending | league-preview-unknown-opaque-texture-additive | 预览避免黑底覆盖，不宣称未知源枚举就是加法 |
| 未知值，有效alpha或证据缺失 | normal → NormalBlending | league-preview-unknown-alpha-or-unverified-normal | 不将未知alpha误判为全255 |

未知值包括5、未来数字及未知字符串。字段缺失且未确认全255时保持默认normal，不新增转换记录。显式字符串 normal/additive/multiply 仍使用既有严格支持。没有英雄或贴图名称特例。

当前Three材质 `premultipliedAlpha=false`。AdditiveBlending的RGB为 `sourceRGB × sourceAlpha + destinationRGB`，黑色贡献为零，贴图及出生/曲线alpha仍控制亮度。NormalBlending为 `sourceRGB × sourceAlpha + destinationRGB × (1−sourceAlpha)`，全255黑底会覆盖背景。选择加法近似，不声称等价于League原始screen、减色或预乘方程。

已直接查看本地截图 `C:/Users/Administrator/Desktop/set13/3d-screenshots/particles/batch2-cleave-flat-black.jpg`：地面上约5格黑色方形与中间黄光。Nocturne P_cleave/cracks 的 Kayn_Skin02_z_add_glow_128 PNG 全alpha=255且mode2；P_tar/Flash_darkglow的mode2贴图也全255。贴图名仅定位资源，实际alpha与截图才是修正依据。

## 影响与验证

两批已用新转换器 `--force` 重生成。第一批23文档31发射器、第二批17文档28发射器由normal/default改additive，包含显式2及缺失模式的全255贴图。逐项详单留在本地 `fx-batch1-blend-changes.json`、`fx-batch2-blend-changes.json`。第二批包括Nocturne P_cleave/P_tar、Akali E/W，以及Amumu、Camille、Morgana、Sett、Tristana、Zyra等；不代表这些系统所有发射器都改变。

生成前后逐文档去除blend比较完全一致，几何、朝向、曲线、生命周期等字段未变。第一批地面辉光 praxis、Add_Glow1、Temp_GroundGlow 的完整emitter（含additive）逐项相同。jinx/vi strict 30行完整结果fixture与旧绑定fixture回归通过；未重生成fx-trial/all。

固定FX_SCALE=0.44、一格62.4、50ms采样的两批尺寸报告已重跑，本轮blend不改变几何尺寸。第一批旧文档口径更新见 [ASSETS3D_FX_BATCH1.md](ASSETS3D_FX_BATCH1.md)。合成测试覆盖2到Three加亮、未知/缺失模式alpha回退、全255/254/0检测、源对象不变及strict不受alpha选项影响。tsc通过；指定8文件382项通过，使用 `--configLoader runner`。修复后浏览器画面尚未复看，最终亮度与叠层仍需视觉验收。
