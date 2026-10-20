import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OMIT_PREVIEW_FIELDS } from './particle-approximate.mjs';
import { safeInputPath, safeOutputPath, withinRoot, writeOutputFile } from './safe-path.mjs';
import { argumentsFor } from './plan-fetch.mjs';

const notes = `# 粒子映射第二、三轮：视觉近似与共享普攻 VFX

2026-10-20；第二轮基线：\`52688b3\`，第三轮起点：\`codex/assets3d-particles-map@8a983024\`。方案 A 已按用户决定实施。

## 交付与边界

- 独立根：\`assets3d-local/fx-trial/manifest.json\`，含 jinx、vi 的自包含 GLB、effects、纹理、静态 mesh、\`actionEffects\`；阶段/挂点/寿命在 \`action-bindings.json\`。
- \`fx-trial.mjs --particle-mode approximate|strict\`，默认 approximate；strict 保持第一轮的 linger opt-in，其余拒绝逻辑原封保留。底层 \`mapEmitter/convertParticles\` 与通用 build API 默认 strict，避免改变既有调用者；通用 build 也可显式传开关。
- 未改 \`src/rendering/three-mode/placeholder-renderer.ts\`。此交付证明可供现有 v2 runtime 分配几何/材质和回收；**未完成外壳接线或浏览器 GPU 视觉验收**。
- \`trial/\`、\`source-json/\`、\`prepared/\`、\`out/\` 为只读输入联接，未向其中写入。第三轮新产物只在 \`fx-trial/\`、\`global-vfx/\`。
- 当前所有读取均通过原 \`safeInputPath\`：联接作为输入根时，其 realpath 与候选保持同根，未遇拒绝，因此**无需放宽读路径**；写路径的严格 realpath 检查未改。
- 未联网、未 npm ci、未启动外部转换 EXE、未写 .git、未提交或改分支。

## 可重跑命令

\`\`\`powershell
node scripts/assets3d/fx-trial.mjs --particle-mode approximate --force
node scripts/assets3d/verify-fx-trial.mjs --force
node scripts/assets3d/fx-trial-report.mjs --force
# 仅重算：默认也落在 fx-trial/recount，不改 batch/all
node scripts/assets3d/fx-trial.mjs --mode recount --particle-mode approximate --force
# 回退严格产物请用独立子根，避免覆盖近似版
node scripts/assets3d/fx-trial.mjs --particle-mode strict --out assets3d-local/fx-trial/strict --force
\`\`\`

## 近似约定清单

这些是显式预览约定，未宣称 League 原引擎等价，也未在本次离线任务中验证社区资料。每个改写/忽略项在对应 \`effects/**/*.report.json\` 的 \`approximations[{field,value,handling}]\` 单独记录；发射器状态为 \`approximated\`，原始字段完整保留。计数按发射器互斥分类，单发射器可有多条约定。

| 字段/类型 | 采用的约定 |
| --- | --- |
| ArbitraryQuad | CameraQuad；出生旋转只保留 Z roll，避免 X/Y 旋转把面片转成侧面；系统 transform 仍在最后作用。 |
| Ray | 速度方向的定向长条 quad；零速度用局部 +Y；出生旋转由方向覆盖，尺寸沿用出生尺寸。 |
| Beam | primitive.start/end 是局部起止点，长条从 start 到 end，长度为距离、宽取 birthScale0.X；缺端点或重合则整发射器 skipped。本地两英雄没有 Beam primitive；W_Beam 系统实际是 ArbitraryQuad。 |
| 数字 blendMode | 当前转换器采用明确预览约定：1/3 → normal，2/4 → additive；未知/缺失模式且PNG全255 → additive，其他保留normal。全部数字映射/回退标approximated，见 docs/ASSETS3D_BLEND_MODES.md；字符串normal/additive/multiply保持严格支持。 |
| flags / pass / miscRenderFlags / alphaRef / depthBiasFactors | 忽略；本轮 pass 不映射 renderOrder，使用文档顺序及 Three 默认透明排序。 |
| SpawnShape Box | Size 当全尺寸，半尺寸分别均匀采样；缺维度为 0。 |
| SpawnShape Cylinder | Y 为轴，半径 r=sqrt(U)×radius，高度均匀采样 [-height/2,height/2]；缺尺寸为 0。 |
| SpawnShape Sphere | r=cbrt(U)×radius、均匀球方向；缺半径为 0。 |
| Legacy / 未知 shape hash | 点发射；保留 emitOffset（原始向量或采样值），忽略 shape flags 与 emitRotationAxes/Angles。 |
| bindWeight | 常量 1，effect 由外壳附着到指定挂点；忽略原权重曲线。 |
| isUniformScale=1 | birthScale0 的 X 分量用于 XYZ 等比尺寸。v2 标量 scale0 曲线统一取 abs(X)，逐项标记。 |
| 系统 4×4 transform | 行主序、行向量、最后一行平移；X 反射共轭后存为 v2 localTransform。形状/位置/速度/加速度先在局部求值，再作用仿射矩阵；面片/mesh 的朝向、缩放和 shear 由线性部分作用。非仿射/非有限矩阵拒绝。 |
| CameraTrail / ArbitraryTrail | 现有 v2 trail，宽取 mTrail.mBirthTilingSize.X（缺省 1）；birthScale 归 1；尾寿命 0.3 秒、32 段、stretch UV；不复刻模式、平滑和采样限制。需宿主/弹道移动才产生长度。 |
| constantValue + dynamics | 常量 × 曲线，逐分量；出生/发射参数取首个 key，color/scale 保留时间曲线。该约定也用于出生字段，可能放大源中重复存储的基值，属于视觉近似残差。 |
| probabilityTables | 每通道 keyValues 的算术均值当确定性乘数；空表=1；不声称保留随机分布。 |
| IntegratedValue | 取其 Value 数据，省略源积分层；世界加速度仍由 v2 解析积分；birthAcceleration 常量加到 gravity。 |
| 曲线时间越界 | clamp 到 [0,1]，同时间最后 key 胜出；其他无效曲线继续由 v2 拒绝。 |
| 缺失/特殊寿命 | 缺 particleLifetime 或连续 rate → 1；无限粒子 → 1 秒；连续 lifetime 非正/缺失 → 1 秒。合法 finite linger 仍省尾；null/负数等非法 linger 仍拒绝。 |
| 连续/单粒发射 | 连续模式显式加初始 burst=1，之后按原 rate；单粒模式固定 count=1。用于避免低 rate、短持续时间完全不出生。 |
| atlas | 数字 frameRate 包成 Value；birthFrameRate 仅在没有 frameRate 时用作 fps；缺 fps 为 0，固定首格；numFrames 不等网格时使用整网格，分数格维度退为 1，随机起帧省略。 |
| 其他外观 | anisotropic drag 取 X；rotationOverride 作为出生 Euler；mesh AlignYawToCamera 忽略；额外 modulationFactor 忽略。UV、第二纹理、erosion、palette、reflection 等省略，逐字段表见下。 |
| 子系统 / fieldCollection | 整个发射器 skipped，分别记 unexpressible-emitter 原因，绝不悄悄只画父级；独立绑定 child 属动作表中的另一条显式近似。 |
| 未列出的未知字段 | 继续交给严格层拒绝，不采用“删光未知字段”的兜底。AttachedMesh、无资源 mesh、屏幕 distortion 也维持 skipped。 |

v2 的新增可选能力仅有 \`shape.kind=cylinder\` 与 \`localTransform\`。前者有限非负 radius/height；后者是 16 个有限数、末列仿射约束。旧 v1 校验不变，旧 v2 不含新字段时运行路径不变；无需额外运行时模式开关，转换器控制是否生成近似 payload。

### 逐字段省略表

下面每一项都是独立旁路记录，不合并成一个“近似”标签。handling 是报告中稳定的精确标识。
`;

const shell = `## 动作绑定与外壳接线（交 Claude）

根 manifest.actionEffects 的默认动作：Jinx attack=BA_Minigun_Mis + **Cas_Medium 唯一一个枪口**；cast=R；Vi cast=Q。W/E/R 的替代表分别在 action-bindings.json.variants.W/E/R，Q 在 variants.Q。Vi attack 仅在 BA_Hit 有通过 v2 校验的 payload 时绑定目标命中；本次尚无可写发射器，保持空数组。ActionState 无暴击区分，删除旧的空 variants.crit，以 unboundShared 明确记录 Crit 不绑定的原因。不能把 W/E/R 三套表同时混入一次 cast。

动作阶段是明确的预览编排，时间不是原版脚本证据：

| 动作 | 系统与触发时间 | 挂点/生命周期上限（秒） |
| --- | --- | --- |
| Jinx attack | Cas_Medium / Mis，0 | Minigun_Barrel1；枪口随骨骼 0.3，独立弹道 0.35 |
| W | W_Cas=0，W_Mis/W_Beam=0.1，W_Tar=0.5 | Cstm_Buffbone_Pistol；起手 0.3，弹道 0.4，目标命中 0.5 |
| E | E_Mis=0，E_Mine_Explosion=0.5 | L_Hand 出发；弹道 0.5，目标爆炸 1 |
| R | R_MuzzleFlash/R_Cast_Mouth=0，R_Rocket_Child=0.1，R_Tar=0.8 | Rocket_Launcher_End / Rocket_Launcher_Mouth_Top；起手 0.3/0.4，弹道 0.7，目标 1.5 |
| Vi Q | hands_R=0，Jumping_Dust=0.1，Landing_Mis=0.1，Landing_AoE/AoE_Child/Tar=0.45 | R_GloveHand / Buffbone_Glb_Ground_Loc / C_Buffbone_Glb_Center_Loc；上限 0.5/0.4/0.35/1/1/0.8 |
| Vi 普攻 | 仅在共享 BA_Hit 转换成功时填入；当前缺主贴图，空数组 | target，预览延迟 0.35，上限 0.5 |
| Vi 暴击 | 当前 ActionState 无 crit，保持不绑定 | 可写时保留独立 Crit effect；不将 Crit 混入普攻 |

Jinx R_Mis 是 child-only emitter，仍 skipped；动作表显式拿独立 R_Rocket_Child 充当弹道外观。Vi hands_L 是空系统，当前不绑定；不制造左手粒子。所有骨名均在复制的 GLB nodes 中核对存在。动作表标 status=approximated，逐效果 playback 指明 phase、anchor、bone、delay、maxDuration。

外壳已有 openModels / onEvents / tick / removePiece，对应最少调用如下（placeFx 与 enqueue 的职责在代码后明确；它们归外壳，不是本次新增接口）：

\`\`\`ts
import { createActionEffectResolver, loadParticleEffect } from '../../rendering3d';
const manifest = models.cache.manifest;
const plan = await (await fetch(options.assetBase + 'action-bindings.json')).json();
const normal = createActionEffectResolver(manifest);
const variants = Object.fromEntries(Object.entries(plan.variants).map(([key, table]) =>
  [key, createActionEffectResolver(manifest, table)]));

// onEvents: attack 用 attackerId；cast 用 sourceId；仅在 state.consume
// 接受该单位动作（revision 改变）后调用，避免广播、死亡和重复事件重放。
async function playAction(source, target, action: 'attack' | 'cast', variant?: string) {
  const generation = phaseGeneration;
  const resolve = variant ? variants[variant] : normal;
  if (!resolve) return;
  for (const { id } of resolve(source.definitionId, action)) {
    const spec = plan.playback[id];
    enqueue(spec.delay, async () => {
      const fx = await loadParticleEffect(manifest, id, {
        root: options.assetBase, scale: 1, maxDuration: spec.maxDuration,
        readMesh, // GLTFLoader.parse/load 后取静态 BufferGeometry；现有接口支持
      });
      if (generation !== phaseGeneration || source.disposed) { fx.dispose(); return; }
      if (!placeFx(fx, spec, source, target)) { fx.dispose(); return; }
      activeEffects.add(fx);
    });
  }
}
// tick: 先推进调度与弹道/宿主位置，再 fx.update(deltaSeconds, camera)。
// fx.finished 时 dispose 并从集合删除；换局/换体/removePiece/dispose 同样清理。
\`\`\`

placeFx 的数据约定：source → source.body.getObjectByName(spec.bone).add(fx.object)，继承已有 fit 缩放；骨缺失则跳过。target → 放在 target 当前世界位置，保留源模型的世界缩放，不挂在施法者身上。projectile → 在 scene 下创建独立 effect，从指定骨骼世界位置出发，向 target 世界位置按 maxDuration 做直线预览运动并对齐朝向；没有 target 就跳过，不能拿角色自身位移冒充弹道。独立物体按源 body 世界缩放换算 League 单位。

enqueue 按渲染时间累计，不用长时间 setTimeout；任务归属 source/target 与 phaseGeneration，晚到加载也检查 target 是否仍有效。异步等待期间流逝的预览时间要补进 fx.update 或直接丢弃过期实例。对局切换、卸载、死亡/移除时撤销排程并释放实例；复用 mesh callback 返回的几何须按 loadParticleEffect 的所有权约定处理（该函数会在 effect.dispose 时释放所加载的几何）。宿主可设并发实例上限，文档自身已有粒子/时长上限。

资源入口仍是 \`?render=3d&assets3d=/assets3d-local/fx-trial/\`；目前只说明如何指向素材根，**不能用现有未接粒子的外壳来宣称特效已经屏幕可见**。

## 第二轮验证基线与剩余限制

- \`npx.cmd tsc --noEmit\` 通过。
- 逐个执行 \`npx.cmd vitest run <file> --configLoader runner\`：全部 29 个 assets3d-* / rendering3d-* 文件通过，最终 575 passed、1 skipped。跳过项是既有 Windows 文件 symlink 权限分支；未跑全套。
- 新增近似文件 81 项、全局缓存文件 6 项，无新单条时限。strict 全结果与从 52688b3 只读提取的 30 组基线快照一致（默认调用与显式 strict 都验证）；真实 60 单位 strict 汇总也保持第一轮 0/0/493/2988。
- 合成测试覆盖两种模式、每条主要约定与逐字段省略标记、行主序变换后实际位置/朝向、圆柱体体积分布、初始 burst、挂点/阶段选择、哈希 resolver 跨 BIN 寻址、缓存验证/缺块/损坏、校验失败不写 payload。
- convertParticles 对每个发射器、完整系统分别执行真实 parseParticleDocument；fx-trial 在写 payload 前再次校验。失效系统只写报告，无 effect 引用；重建开始先写 building 标记，成功后才写最终 manifest/status。
- verification.json：真实运行时 CPU 烟测 38 份文档、104 张 PNG 引用、11 份 mesh；逐份有实际几何、材质、有限变换、粒子出生及生命周期完成，无运行时跳过。拖尾的测试宿主每 50 ms 沿 X 移动 5 League 单位；这是合成运动，非外壳已接线的证据。没有 GPU 截图或原版视觉等价结论。
- 重算以旧批次纹理/mesh 转换决策为只读基线，所以仍可能保留资源缺失、颜色顶点/附着 mesh 不支持等拒绝。两英雄输出实际用到的未写 mesh 从验证哈希的源缓存单独重建。所有新结果不回写 batch/all。

## 第三轮验证

- \`npx.cmd tsc --noEmit\` 通过；逐个执行 \`npx.cmd vitest run <file> --configLoader runner\`：assets3d-bin（8）、assets3d-global-vfx（8）、assets3d-fx-evidence（2）、assets3d-visual-approximate（82），共 100 项通过；未跑全套，无新单条时限。
- 新增合成覆盖默认预算不变、全局预算生效及超限拒绝、真实 PROP 编码的两个 resolver key 跨 BIN 命中（含逆序）、Hit 目标挂点和 Crit 无状态区分时不绑定。
- 已重跑 approximate 与 verify-fx-trial；仍是 38 份既有 v2 文档、104 张被引用 PNG、11 份 mesh 的运行时烟测通过。共享 Hit/Crit 仅有拒绝报告，不计入已验证文档。

建议英文提交信息：\`fix(assets3d): bound global BIN parsing and resolve shared attack VFX\`
`;

export async function fxTrialReport({ root = 'assets3d-local/fx-trial', force = false } = {}) {
  const output = await safeOutputPath(root, { directory: true });
  withinRoot(await safeOutputPath('assets3d-local/fx-trial', { directory: true }), output, 'fx-trial-output-only');
  const read = async p => JSON.parse(await readFile(await safeInputPath(output, join(output, p)), 'utf8'));
  const summary = await read('recount/summary.json'), jinx = await read('recount/jinx.json'), vi = await read('recount/vi.json');
  const global = await read('global-vfx-status.json');
  const rows = Object.entries(OMIT_PREVIEW_FIELDS).map(([field, handling]) => `| \`${field}\` | \`${handling}\` |`).join('\n');
  let md = `${notes}\n| 字段 | handling |\n| --- | --- |\n${rows}\n\n## 逐系统对照\n\n严格列指第一轮 linger opt-in；近似列指视觉近似模式。所有数字为发射器数，M=精确映射、A=近似、S=跳过、R=拒绝。空系统保留为 0。\n`;
  for (const [name, unit] of [['金克丝', jinx], ['蔚', vi]]) {
    md += `\n### ${name}\n\n| 系统（省略角色路径前缀） | strict M | A | S | R | approximate M | A | S | R |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
    for (const s of unit.systems) {
      const count = rows => ['mapped', 'approximated', 'skipped', 'rejected'].map(status => rows.filter(r => r.status === status).length);
      md += `| ${s.sourcePath.split('_Base_').at(-1)} | ${[...count(s.strictReport), ...count(s.report)].join(' | ')} |\n`;
    }
    md += `| **合计 ${unit.counts.systems} 系统 / ${unit.counts.emitters} 发射器** | ${['mapped', 'approximated', 'skipped', 'rejected'].map(k => unit.strictCounts[k] ?? 0).join(' | ')} | ${['mapped', 'approximated', 'skipped', 'rejected'].map(k => unit.counts[k] ?? 0).join(' | ')} |\n`;
  }
  md += '\n蔚专属系统唯一拒绝：Q_Landing_Mis_Child/StrokeDissolve_Right 的 particleLinger=null（保留 invalid-source-linger 拒绝）。第三轮已解析的 Hit/Crit 属共享系统，不计入这 47 个专属发射器。child/fieldCollection/attached mesh/distortion/不可转换 mesh 的跳过均保留具体原因，详见各系统旁路与 recount/vi.json、jinx.json。\n';
  md += `\n## 60 单位重算\n\n全部明细只写到 \`fx-trial/recount/\`：60 个单位文件和 summary.json，未修改旧 batch/all。逐单位与总量均核对 M+A+S+R=emitters，并与旧 inventory 的单位/系统/发射器数一致。\n\n| 模式 | 单位 | 系统 | 发射器 | 精确映射 | 近似 | 跳过 | 拒绝 |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |\n`;
  for (const [name, t] of [['严格（第一轮）', summary.strictTotals], ['视觉近似', summary.totals]]) md += `| ${name} | 60 | ${t.systems} | ${t.emitters} | ${t.mapped} | ${t.approximated} | ${t.skipped} | ${t.rejected} |\n`;
  md += `\n## 第三轮全局 VFX：系统已定位，贴图仍缺块\n
Map22 的 42 块 / 1,699,502 字节已由外部调度方补齐。离线提取的 \`data/maps/shipping/map22/map22.bin\` 为 26,646,502 字节，SHA-256：\`627fabe4594998b6f479d918533e20d19824f82f1ec8d9092807ca33a414af6f\`。解析得到 12,168 个 entry，其中 1,724 个 VfxSystemDefinitionData；linked 为空。两个共享系统均由 ResourceResolver 的 effect-key 哈希定位，非名称猜测。

### 专用解析预算

\`parseGlobalVfxBin\` 仅供全局 VFX 离线入口使用，显式传 \`GLOBAL_VFX_BIN_LIMITS\`：maxValues=4,000,000、累计 maxStringBytes=8 MiB。Map22 同时包含地图放置与大量共享 VFX，先后触发了默认 1,000,000 值和 4 MiB 字符串限制，因此给出有界的 4 倍/2 倍余量。32 MiB 输入、64 层深度、单容器 100,000 项等上限保持不变；超过任一新上限仍拒绝。\`parseBin\` 默认和其余调用者未改；本次没有放宽路径或使用无限预算。

### 系统及转换结果

实际解析 **${global.found.length}** 个系统，提取 BIN/贴图 **${global.files.length}** 个。原始 BIN 和已取得纹理位于 \`global-vfx/extracted/\`，选中的完整系统在 \`global-vfx/systems.json\`；转换报告在 \`fx-trial/effects/global/*.report.json\`。

| 系统 | 所在 BIN / WAD | Resolver target hash | 原始 particlePath |
| --- | --- | ---: | --- |
`;
  for (const [key, r] of Object.entries(global.resolvedKeys)) md += `| ${key} | ${r.sourceBin} / ${r.sourceWad} | ${r.resolverTargetHash} | ${r.sourcePath} |\n`;
  md += '\n| 系统 | 映射 | 近似 | 跳过 | 拒绝 | 输出 |\n| --- | ---: | ---: | ---: | ---: | --- |\n';
  for (const s of global.systems) md += `| ${s.sourcePath.split('/').at(-1)} | ${s.counts.mapped} | ${s.counts.approximated} | ${s.counts.skipped} | ${s.counts.rejected} | ${s.path ?? s.reason} |\n`;
  md += `
Hit 的 3 个发射器均缺主贴图；Crit 的 9 个发射器中，7 个首先因缺主贴图拒绝，Flash1、ring 因 \`unmapped-source-field:falloffTexture\` 拒绝（ring 的主贴图也缺块）。仍按既有近似白名单处理，未新增省略 falloffTexture 的约定。所有发射器无可写 payload，因此当前不生成共享 effects 引用，Vi attack 也没有悬空绑定。补块后 Hit 可重新尝试；不能预先宣称会通过 v2 校验。

### 贴图及精确缺块

两个系统共引用 ${global.textureReferences.length} 张贴图；已提取并成功转 PNG ${global.textureConversions.filter(t => t.status === 'converted').length} 张，其余 6 张等待块。已取得的 defaultcoloroverlifetime、defaultfalloff、flash_01、tft_glb_gradient 为原始依赖；只有实际被通过校验的文档使用的资源才计入 verify-fx-trial 引用数。

| 依赖 | 状态 |
| --- | --- |
`;
  for (const ref of global.textureReferences) {
    const canonical = p => p.toLowerCase().replaceAll('.tft_set13', '');
    const converted = global.textureConversions.find(t => canonical(t.source) === canonical(ref));
    md += `| ${ref} | ${converted?.status === 'converted' ? `PNG: ${converted.path}` : converted?.reason ?? global.failures.find(f => f.path === ref)?.reason ?? 'unresolved'} |\n`;
  }
  md += `\n缺块均属 \`DATA/FINAL/Maps/Shipping/Map22.wad.client\` 的纹理，共 **${global.missingChunks.length} 块 / ${global.downloadBytes.toLocaleString('en-US')} 字节（压缩下载量）**，无需再下载 Map22 BIN。完整字段 id、bundleId、offset、size、targetSize、fileOffset、requiredBy 位于 \`assets3d-local/global-vfx/report.json\` 的 missingChunks；试验根内副本：\`global-vfx-status.json\`。当前 dependencyClosureKnown=false，报告保留 6 个纹理缺块失败。\n\n| Chunk ID | Bundle ID | Bundle offset | 压缩字节 | 解压字节 |\n| --- | --- | ---: | ---: | ---: |\n`;
  for (const c of global.missingChunks) md += `| ${c.id} | ${c.bundleId} | ${c.offset} | ${c.size} | ${c.targetSize} |\n`;
  md += `\n外部调度方按每行 bundleId 的 Range \`offset..offset+size-1\` 取得压缩块，作为 \`chunks/<ID>.zst\` 交回只读输入缓存；本轮没有下载或修改缓存。新提取文件只写 \`global-vfx/extracted/\`，转换后被试验根引用的 PNG/effects 再写到 \`fx-trial/\`，不会让独立根引用 ../global-vfx。\n\n${shell}`;
  await writeOutputFile(join(output, 'report.md'), md, { force });
  return md;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await fxTrialReport(argumentsFor(process.argv.slice(2), ['--root']));
  console.log(JSON.stringify({ reportBytes: Buffer.byteLength(report) }));
}
