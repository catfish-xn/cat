/** No listening socket or game assets. Synthetic JSON, texture and screenshot are written under /tmp only. */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'cat-vfx-ltk-webgl-'));
const assets = join(out, 'vfx-ltk');
const source = `
import { WebGLRenderer, Scene, PerspectiveCamera, Group, DataTexture, RGBAFormat, BoxGeometry } from 'three';
import { createVfxLibrary } from './src/rendering/three-mode/vfx-ltk/loader';
import { createLtkParticles, unitAnchor, unitJoints } from './src/rendering/three-mode/vfx-ltk/particles';
import { drawnEmitters } from './src/rendering/three-mode/vfx-ltk/rendering/utils/definitions';
import { QUAD_TYPE } from './src/rendering/three-mode/vfx-ltk/engine/model/enums';
import { syntheticIndex, syntheticSystem, constant, vec, struct } from './tests/vfx-ltk-synthetic';
window.sample=syntheticSystem(); window.sampleIndex=syntheticIndex();
window.smoke = async () => {
 const canvas=document.createElement('canvas');document.body.append(canvas);
 const renderer=new WebGLRenderer({canvas,stencil:true,preserveDrawingBuffer:true}); renderer.setSize(128,128); renderer.setClearColor(0x000000,1);
 const scene=new Scene(), camera=new PerspectiveCamera(45,1,0.1,1000); camera.position.set(0,40,100);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const root=new Group(),target=new Group();target.position.x=22; const results=[];
 for(const primitive of ['VfxPrimitiveCameraQuad','VfxPrimitiveArbitraryQuad','VfxPrimitiveRay','VfxPrimitiveCameraTrail','VfxPrimitiveBeam','VfxPrimitivePlanarProjection','staticMesh']) {
  const doc=syntheticSystem({...(primitive==='staticMesh'?{}:{primitive:struct(primitive,{})}),birthScale0:constant(vec(12,12,12))});
  const library=createVfxLibrary('/local/', {readJson: async url=>url.endsWith('index.json')?syntheticIndex():doc,readTexture:async()=>{const t=new DataTexture(new Uint8Array([255,255,255,255]),1,1,RGBAFormat);t.needsUpdate=true;return t;}});
  let prepared=await library.load('sample');
  if(primitive==='staticMesh') {
   const model={...prepared.model,emitters:prepared.model.emitters.map(e=>({...e,quadType:QUAD_TYPE.mesh,mesh:{asset:{kind:'layer',path:'sample',project:'',layer:''},path:'sample',submeshes:[],submeshesAlways:[],alignPitch:false,alignYaw:false,skinned:false}}))};
   prepared={...prepared,model,drawn:drawnEmitters(model),meshes:new Map([['0',new BoxGeometry(1,1,1)]])};
  }
  const fx=createLtkParticles(prepared,{anchor:unitAnchor(root,null),target:unitAnchor(target,null),joints:unitJoints(root,null),duration:1,seed:1});scene.add(fx.object);
  for(let i=0;i<5;i++){fx.update(0.05,camera); renderer.render(scene,camera);}
  const pixels=new Uint8Array(128*128*4); renderer.getContext().readPixels(0,0,128,128,renderer.getContext().RGBA,renderer.getContext().UNSIGNED_BYTE,pixels);
  let lit=0;for(let at=0;at<pixels.length;at+=4)if(pixels[at]||pixels[at+1]||pixels[at+2])lit++;
  results.push({primitive,particles:fx.driver.pool.count,draws:fx.draws.length,lit,programs:renderer.info.programs.map(p=>({runnable:p.diagnostics?.runnable??true}))});
  fx.dispose();for(const geometry of prepared.meshes.values())geometry.dispose();library.dispose();
 }
 renderer.dispose(); return results;
};`;
const bundle = await build({stdin:{contents:source,resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'browser',format:'iife'});
const browser=await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--renderer-process-limit=1','--num-raster-threads=2']});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setContent('<html><body style="margin:0;background:black"></body></html>');
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 const results=await page.evaluate(()=>window.smoke());
 mkdirSync(join(assets,'systems'),{recursive:true}); mkdirSync(join(assets,'textures'),{recursive:true});
 writeFileSync(join(assets,'systems/sample.json'),JSON.stringify(await page.evaluate(()=>window.sample),null,2));
 writeFileSync(join(assets,'index.json'),JSON.stringify(await page.evaluate(()=>window.sampleIndex),null,2));
 await sharp({create:{width:1,height:1,channels:4,background:{r:255,g:255,b:255,alpha:1}}}).png().toFile(join(assets,'textures/sample.png'));
 const report={results,errors}; writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({out,...report},null,2));
 await page.screenshot({path:join(out,'webgl.png')});
 if(errors.length||results.some(x=>x.programs.some(p=>!p.runnable))||results.some(x=>!x.lit))process.exitCode=1;
} finally {await browser.close();}
