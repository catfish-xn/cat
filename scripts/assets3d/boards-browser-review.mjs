import { createServer } from 'vite';
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { boardRoot, boardPlanJson } from './boards-plan.mjs';
import { packageFiles, verifyBoardPackage } from './boards-package.mjs';

const review=await safeOutputPath('assets3d-local/boards/review',{directory:true});await mkdir(review,{recursive:true});
if(!process.env.CHROMIUM_PATH)throw new Error('CHROMIUM_PATH-required');
const server=await createServer({configFile:false,optimizeDeps:{noDiscovery:true,entries:[],include:[]},cacheDir:join(review,'browser-cache'),server:{host:'127.0.0.1',port:5197,strictPort:true,watch:null}});
const plan=JSON.parse(await readFile('assets3d-local/boards/boards-plan.json'));
let browser;const results=[];
try{
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const kinds=process.argv.includes('--source-only')?['boards']:process.argv.includes('--compressed-only')?['boards-compressed']:['boards','boards-compressed'];
  for(const kind of kinds)for(const pick of plan.picks){
    const root=join('assets3d-local',kind,boardRoot(pick.key)),files=await packageFiles(root),manifest=JSON.parse(files.get('manifest.json'));
    const scene=JSON.parse(files.get(manifest.boards[pick.key].path)),effects=Object.fromEntries(Object.entries(manifest.effects).map(([id,e])=>[id,JSON.parse(files.get(e.path))]));
    verifyBoardPackage(manifest,JSON.parse(files.get('precache.json')),files,effects);
    const page=await browser.newPage({viewport:{width:1440,height:1200}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
    await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
    await page.route('http://127.0.0.1:5197/review',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><body style="margin:0;background:#10151c;color:white;font:16px sans-serif"></body>'}));
    await page.goto('http://127.0.0.1:5197/review');
    const result=await page.evaluate(async({manifest,scene,effects,base,name,kind})=>{
      const T=await import('/node_modules/three/build/three.module.js');
      const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
      const {KTX2Loader}=await import('/node_modules/three/examples/jsm/loaders/KTX2Loader.js');
      const {MeshoptDecoder}=await import('/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js');
      const {ParticleEffectV2}=await import('/src/rendering3d/particles-v2.ts');
      const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1440,1140);renderer.setPixelRatio(1);renderer.setClearColor(0x131c28);
      const title=document.createElement('div');title.style.cssText='height:60px;box-sizing:border-box;padding:15px 25px';title.textContent=`${name} · ${kind} · 7 × 8 = 56 格 · 俯视 / 环境预览 / 2 秒`;document.body.append(title,renderer.domElement);
      const world=new T.Scene(),board=new T.Group();world.add(board);
      board.scale.fromArray(scene.alignment.scale);board.position.fromArray(scene.alignment.offset);
      const ktx=new KTX2Loader().setTranscoderPath('/node_modules/three/examples/jsm/libs/basis/').detectSupport(renderer);
      const loader=new GLTFLoader().setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
      const cache=new Map(),mixers=[];
      async function model(id){if(!cache.has(id))cache.set(id,loader.loadAsync(base+manifest.models[id].path));return cache.get(id);}
      let staticCount=0,propCount=0,animationCount=0;
      const loadedStatic=new Set();
      for(const m of scene.models){const g=await model(m.id);if(!loadedStatic.has(m.id)){board.add(g.scene);loadedStatic.add(m.id);}const node=m.node?g.scene.getObjectByName(m.node):g.scene;if(node)node.visible=!m.visibility||!!(m.visibility&1);if(node?.visible)staticCount++;}
      // Leases of a rig must clone bones as well as meshes.
      const {clone}=await import('/node_modules/three/examples/jsm/utils/SkeletonUtils.js');
      const mirror=new T.Matrix4().makeScale(-1,1,1);
      for(const p of scene.props){
        if(!p.id||!manifest.models[p.id]||!p.matrix)continue;
        // The client uses an invisible interaction rig as a click target.
        // Preserve its asset, but do not preview that control volume as art.
        if(p.renderRole==='interaction-volume')continue;
        const visibility=p.source.fields.find(f=>f.hash===3438777127)?.value??255;if(!(visibility&1))continue;
        const g=await model(p.id),o=clone(g.scene),holder=new T.Group();
        holder.matrix.copy(mirror).multiply(new T.Matrix4().fromArray(p.matrix)).multiply(mirror);holder.matrixAutoUpdate=false;
        o.position.fromArray(p.correction.map(v=>-v));holder.add(o);board.add(holder);propCount++;
        const clip=g.animations.find(c=>c.name.toLowerCase()===p.idle?.toLowerCase())??g.animations.find(c=>/idle/i.test(c.name));
        if(clip&&p.playIdle){const mixer=new T.AnimationMixer(o);mixer.clipAction(clip).play();mixers.push(mixer);animationCount++;}
      }
      const ambient=new T.AmbientLight(0xffffff,1.5);world.add(ambient);const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(0,1000,500);world.add(sun);
      // Scene effects are bound by exact source identity. Prop-attached systems
      // and behavior-triggered effects stay exported; this view does not guess
      // which gameplay cue should fire them.
      const texCache=new Map(),meshCache=new Map();
      async function texture(p){if(!texCache.has(p)){const tex=await new T.TextureLoader().loadAsync(base+p);tex.flipY=false;texCache.set(p,tex);}return texCache.get(p);}
      const effectViews=[];let effectCount=0;
      for(const p of scene.placements??[]){
        if(!p.effect||!effects[p.effect]||!p.matrix||!(p.visibility&1))continue;
        // Review selects ambient systems only; source behavior cue records are
        // retained for integration instead of firing all event effects at once.
        if(!/idle|ambient|water|brazier|butterfly|leaf|petal|sky/i.test(p.name??'')||/win|loss|streak|click|dump|blast|impact/i.test(p.name??''))continue;
        const doc=effects[p.effect];
        for(const e of doc.emitters){for(const t of [e.texture,e.distortion?.normalMap].filter(Boolean))await texture(t);if(e.mesh&&!meshCache.has(e.mesh)){const g=await loader.loadAsync(base+e.mesh);g.scene.traverse(o=>{if(o.isMesh)meshCache.set(e.mesh,o.geometry);});}}
        const fx=new ParticleEffectV2(doc,{scale:1,texture:p=>texCache.get(p),mesh:p=>meshCache.get(p)}),holder=new T.Group();
        holder.matrix.copy(mirror).multiply(new T.Matrix4().fromArray(p.matrix)).multiply(mirror);holder.matrixAutoUpdate=false;holder.add(fx.object);board.add(holder);effectViews.push(fx);effectCount++;
      }
      // The 56 runtime cell centers are independent of model bounds. A small
      // ring at each center makes alignment reviewable without covering art.
      const marker=new T.RingGeometry(2,3,16),material=new T.MeshBasicMaterial({color:0x76e5ff,side:T.DoubleSide,transparent:true,opacity:.8});
      for(let row=0;row<8;row++)for(let col=0;col<7;col++){
        const o=new T.Mesh(marker,material);o.rotation.x=-Math.PI/2;o.position.set(35+Math.sqrt(3)*34*(col+(row%2)/2),12,50+51*row);world.add(o);
      }
      const cx=35+Math.sqrt(3)*34*3.25,cz=50+51*3.5,half=620;
      const camera=new T.OrthographicCamera(-half*1440/1140,half*1440/1140,half,-half,.1,10000);camera.position.set(cx,4000,cz);camera.up.set(0,0,-1);camera.lookAt(cx,0,cz);
      for(let i=0;i<120;i++){mixers.forEach(m=>m.update(1/60));effectViews.forEach(f=>f.update(1/60));}renderer.render(world,camera);
      const gl=renderer.getContext(),webglError=gl.getError();if(webglError)throw new Error(`board-webgl-error:${webglError}`);
      return {staticCount,propCount,animationCount,effectCount,cells:56,webglError,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
    },{manifest,scene,effects,base:`/${root.replaceAll('\\','/')}/`,name:pick.name,kind});
    if(errors.length)throw new Error(JSON.stringify({key:pick.key,kind,errors}));
    const path=await safeOutputPath(join(review,`${pick.key}${kind==='boards'?'':'-compressed'}.png`),{force:true});await page.screenshot({path,fullPage:true});
    results.push({key:pick.key,kind,path,...result});console.log(JSON.stringify(results.at(-1)));await page.close();
  }
  await writeOutputFileAtomic(join(review,'review.json'),boardPlanJson(results),{force:true});
}finally{await browser?.close();await server.close();}
