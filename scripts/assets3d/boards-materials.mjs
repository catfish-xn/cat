import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readGlb, writeGlb } from './glb.mjs';
import { pngHasEffectiveAlpha } from './texture-alpha.mjs';
import { safeOutputPath, writeOutputFileAtomic } from './safe-path.mjs';
import { boardRoot } from './boards-plan.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Correct container-level diffuse alpha only. Shader tint, deformation,
 * parallax, lightmaps and behavior-driven visibility remain separate gaps. */
export function boardAlphaMaterials(document,binary){
  const alpha=new Map(),changed=[];
  for(const mat of document.materials??[]){
    const t=document.textures?.[mat.pbrMetallicRoughness?.baseColorTexture?.index],im=document.images?.[t?.source];
    if(!im||im.mimeType!=='image/png')continue;
    if(!alpha.has(t.source)){const v=document.bufferViews[im.bufferView];alpha.set(t.source,pngHasEffectiveAlpha(binary.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength)));}
    if(!alpha.get(t.source))continue;
    mat.alphaMode=/water|glass|reflection|shadow|caustic/i.test(mat.name??'')?'BLEND':'MASK';if(mat.alphaMode==='MASK')mat.alphaCutoff=.5;
    changed.push({name:mat.name,alphaMode:mat.alphaMode,alphaCutoff:mat.alphaCutoff});
  }return changed;
}

// Meshopt adds a second, virtual fallback buffer. Preserve every byte and
// extension when editing JSON material metadata; decoding is checked in Chrome.
export function readBoardGlbContainer(bytes){
  if(bytes.length<28||bytes.readUInt32LE(0)!==0x46546c67||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length||bytes.readUInt32LE(16)!==0x4e4f534a)throw new Error('invalid-board-glb');
  const n=bytes.readUInt32LE(12),at=20+n;
  if(at+8>bytes.length||bytes.readUInt32LE(at+4)!==0x004e4942||at+8+bytes.readUInt32LE(at)!==bytes.length)throw new Error('invalid-board-glb-chunks');
  const document=JSON.parse(bytes.subarray(20,at)),binary=bytes.subarray(at+8);
  if(document.asset?.version!=='2.0'||!document.buffers?.length||document.buffers[0].byteLength>binary.length||binary.length-document.buffers[0].byteLength>3||document.buffers.some(b=>b.uri))throw new Error('invalid-board-glb-buffers');
  return {document,binary:binary.subarray(0,document.buffers[0].byteLength)};
}

export async function fixBoardMaterials(){
const plan=JSON.parse(await readFile('assets3d-local/boards/boards-plan.json'));
for(const p of plan.picks){
  const original=join('assets3d-local/boards',boardRoot(p.key),'models/arena.glb');
  const {document:d,binary:b}=readGlb(await readFile(original));
  if(p.key==='board-spirit-blossom'&&!d.asset.extras?.boardBgraCorrected){
    const visited=new Set();for(const m of d.meshes)for(const primitive of m.primitives){const ai=primitive.attributes.COLOR_0;if(ai===undefined||visited.has(ai))continue;visited.add(ai);const a=d.accessors[ai],v=d.bufferViews[a.bufferView];if(a.componentType!==5126||a.type!=='VEC4')throw new Error('unexpected-board-color-storage');for(let i=0;i<a.count;i++){const at=(v.byteOffset??0)+(a.byteOffset??0)+i*16,r=b.readFloatLE(at),blue=b.readFloatLE(at+8);b.writeFloatLE(blue,at);b.writeFloatLE(r,at+8);}}
    d.asset.extras={...d.asset.extras,boardBgraCorrected:true};
  }
  const changes=boardAlphaMaterials(d,b);
  for(const mesh of d.meshes)for(const p of mesh.primitives)if(p.attributes.COLOR_0!==undefined){p.attributes._SOURCE_COLOR=p.attributes.COLOR_0;delete p.attributes.COLOR_0;}
  await writeOutputFileAtomic(original,writeGlb(d,b),{force:true});
  if(process.argv.includes('--with-compressed')){
    const path=await safeOutputPath(join('assets3d-local/boards-compressed',boardRoot(p.key),'models/arena.glb'),{force:true});
    const {document:c,binary:cb}=readBoardGlbContainer(await readFile(path));
    for(const mesh of c.meshes)for(const p of mesh.primitives)if(p.attributes.COLOR_0!==undefined){p.attributes._SOURCE_COLOR=p.attributes.COLOR_0;delete p.attributes.COLOR_0;}
    for(const m of c.materials){const change=changes.find(v=>v.name===m.name);if(change){m.alphaMode=change.alphaMode;if(change.alphaCutoff!==undefined)m.alphaCutoff=change.alphaCutoff;}}
    await writeOutputFileAtomic(path,writeGlb(c,cb),{force:true});
  }
  console.log(JSON.stringify({key:p.key,alphaMaterials:changes.length}));
}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await fixBoardMaterials();
