import { createHash } from 'node:crypto';
import { readGlb, writeGlb } from './glb.mjs';

/** Preserve draw ranges as named nodes while sharing identical embedded images.
 * This is limited to the static GLBs produced by boardRangeGlb, not arbitrary
 * imported glTF with skins, external resources or node transforms. */
export function combineBoardGeometry(parts){
  const d={asset:{version:'2.0',generator:'offline-board-static-pack',extras:{boardBgraCorrected:true}},scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[],images:[],textures:[],samplers:[],buffers:[{byteLength:0}],bufferViews:[],accessors:[],extensionsUsed:['KHR_materials_unlit']};
  const binary=[],images=new Map(),materials=new Map();let size=0;
  const view=bytes=>{const padding=Buffer.alloc((4-bytes.length%4)%4),i=d.bufferViews.length;d.bufferViews.push({buffer:0,byteOffset:size,byteLength:bytes.length});binary.push(bytes,padding);size+=bytes.length+padding.length;return i;};
  for(const {id,bytes}of parts){
    const {document:s,binary:b}=readGlb(bytes);
    if(s.nodes.length!==1||s.nodes[0].mesh!==0||s.meshes.length!==1||s.skins||s.animations)throw new Error('unsupported-board-static-pack');
    const aMap=new Map();
    function accessor(index){if(aMap.has(index))return aMap.get(index);const a=s.accessors[index],v=s.bufferViews[a.bufferView];if(v.buffer!==0)throw new Error('external-board-buffer');const i=d.accessors.length;d.accessors.push({...a,bufferView:view(b.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength))});aMap.set(index,i);return i;}
    const primitives=s.meshes[0].primitives.map(p=>{
      const mat=structuredClone(s.materials[p.material]),tex=mat.pbrMetallicRoughness?.baseColorTexture;
      if(tex){const t=s.textures[tex.index],im=s.images[t.source],v=s.bufferViews[im.bufferView],image=b.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength),h=createHash('sha256').update(image).digest('hex');
        if(!images.has(h)){const i=d.images.length;d.images.push({mimeType:im.mimeType,bufferView:view(image)});d.samplers.push(s.samplers[t.sampler]);d.textures.push({source:i,sampler:d.samplers.length-1});images.set(h,d.textures.length-1);}tex.index=images.get(h);
      }
      const mkey=JSON.stringify(mat);if(!materials.has(mkey)){materials.set(mkey,d.materials.length);d.materials.push(mat);}
      return {...p,attributes:Object.fromEntries(Object.entries(p.attributes).map(([n,i])=>[n,accessor(i)])),...(p.indices===undefined?{}:{indices:accessor(p.indices)}),material:materials.get(mkey)};
    });
    const mesh=d.meshes.length,node=d.nodes.length;d.meshes.push({primitives});d.nodes.push({name:id,mesh});d.scenes[0].nodes.push(node);
  }
  d.buffers[0].byteLength=size;
  return {glb:writeGlb(d,Buffer.concat(binary)),nodes:d.nodes.length,images:d.images.length};
}
