import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {boardRoot,boardPlanJson,BOARD_PICKS} from './boards-plan.mjs';
import {packageFiles,verifyBoardPackage} from './boards-package.mjs';
import {writeOutputFileAtomic} from './safe-path.mjs';

const output='assets3d-local/boards',plan=JSON.parse(await readFile(join(output,'boards-plan.json'))),rows=[];
if(plan.chunks.length || !plan.dependencyClosureComplete)throw new Error('boards-dependencies-not-ready');
for(const pick of plan.picks){
  const r=JSON.parse(await readFile(join(output,'reports',`${pick.key}.json`))),packages={};
  for(const kind of ['boards','boards-compressed']){
    const root=join('assets3d-local',kind,boardRoot(pick.key)),files=await packageFiles(root),manifest=JSON.parse(files.get('manifest.json')),scene=JSON.parse(files.get('scene.json'));
    const effects=Object.fromEntries(Object.entries(manifest.effects).map(([id,e])=>[id,JSON.parse(files.get(e.path))]));
    packages[kind]={root:resolve(root),...verifyBoardPackage(manifest,JSON.parse(files.get('precache.json')),files,effects),alignment:scene.alignment,
      modelKeys:Object.keys(manifest.models),effects:Object.keys(manifest.effects).length,bakedLightmaps:scene.lighting.baked.length};
  }
  rows.push({key:pick.key,name:BOARD_PICKS.find(v=>v.key===pick.key)?.name??pick.name,cells:56,packages,clips:r.clips,rigs:r.animatedModels,staticRanges:r.geometry.ranges,effectSystems:{converted:r.systems.filter(s=>s.document).length,total:r.systems.length},emitters:r.effectCounts,lights:r.lightCounts,limitations:r.limitations});
}
await writeOutputFileAtomic(join(output,'summary.json'),boardPlanJson({ready:true,offline:true,missingChunks:0,boards:rows}),{force:true});
const docs=['# 棋盘','','S13 默认待核实。当前 `board-default` 保留通用竞技场；未发现足以将其他战斗棋盘认定为 S13 专属默认的绑定证据。','','已离线检查固定版本客户端的以下类别：','','- Map22 地图总配置、地图皮肤列表与默认地图皮肤的场景引用。','- S13 赛季配置及资源解析器的场景绑定；明确的赛季场景引用属于轮盘，不能据此替换战斗棋盘。','- 竞技场皮肤相关索引、通用竞技场场景与几何资源分类；名称或赛季主题不作为默认身份的证据。','- TFTSet13 与公共资源包的实际文件索引；未发现可确认专属默认战斗棋盘的独立场景配置。','','以上是本地可命名索引和已解析配置的检查结果，不代表证明该棋盘不存在；未解析字段及未命名资源仍有不确定性。身份未核实前不改键、不新增 `board-classic`，保留现有压缩包与截图。','','| 名称 | 格数 | 原始体积 | 压缩体积 |','| --- | --- | --- | --- |',...rows.map(r=>`| ${r.name} | ${r.cells} | ${(r.packages.boards.bytes/1048576).toFixed(2)} MiB | ${(r.packages['boards-compressed'].bytes/1048576).toFixed(2)} MiB |`),'','提交前：运行 `node scripts/assets3d/boards-preflight.mjs` 与合成数据棋盘测试。浏览器审阅脚本只从环境变量 `CHROMIUM_PATH` 读取浏览器位置；压缩器直接使用仓库内共享模块 `scripts/assets3d/compress.mjs`。',''].join('\n');
await writeFile('docs/ASSETS3D_BOARDS.md',docs);
plan.picks=plan.picks.map(p=>({...p,selection:BOARD_PICKS.find(v=>v.key===p.key)?.selection??p.selection}));
await writeOutputFileAtomic(join(output,'boards-plan.json'),boardPlanJson(plan),{force:true});
await writeOutputFileAtomic(join(output,'integration.json'),boardPlanJson({modifiedSourceFiles:[],requiredChanges:[
  {path:'src/rendering3d/contracts.ts',change:'Add typed boards metadata and validate scene path/grid/alignment; models[boardKey] loads the packed arena with named render-layer nodes.'},
  {path:'src/rendering/three-mode/placeholder-renderer.ts',change:'Replace buildBoard decorative tile meshes with board-default model/scene; derive root scale/offset for current BoardFrame radius/origin, keep existing pick/commands. Apply each named static node visibility, instantiate prop rigs using mirrorX*sourceMatrix*mirrorX and undo their exported recenter correction; skip interaction-volume renderRole. Play source graph idle aliases and behavior cues explicitly. Reconstruct lighting/shader approximations from scene.json; do not guess gameplay triggers.'},
  {path:'src/rendering/three-mode/asset-preload.ts',change:'Include the default board manifest/precache in the initial asset root. Fetch optional manifest/precache from its independent root only on player selection; bind all model/effect paths to that root and dispose leases when switching.'}
],limits:['Lights/sun/volumes and baked textures are exported; source shader, light-grid and behavior evaluation are not implemented in the current renderer.','Particle emitters use the existing approximate converter; all omitted source resources and conversion reasons remain local.','Board alignment derives 56 centers from native first-cell/center locators. Retarget to the live radius/origin rather than using decorative bounds.'],artifacts:{sourceRoot:resolve(output),compressedRoot:resolve('assets3d-local/boards-compressed'),reviewRoot:resolve(join(output,'review'))}}),{force:true});
console.log(boardPlanJson(rows.map(r=>({key:r.key,name:r.name,original:r.packages.boards.bytes,compressed:r.packages['boards-compressed'].bytes,clips:r.clips,effects:r.effectSystems,lights:r.lights,baked:r.packages.boards.bakedLightmaps,limitations:r.limitations.length}))));
