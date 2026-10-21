import { decodeTexture, decodeBlocks } from './texture.mjs';

/** BC2/DXT3 has explicit four-bit alpha and an always-four-colour BC1 block. */
export function decodeBoardTexture(bytes) {
  if (bytes.length < 128 || bytes.toString('ascii',0,4) !== 'DDS ' || bytes.toString('ascii',84,88) !== 'DXT3') return decodeTexture(bytes);
  if(bytes.readUInt32LE(4)!==124 || bytes.readUInt32LE(76)!==32)throw new Error('invalid-dds');
  const width=bytes.readUInt32LE(16),height=bytes.readUInt32LE(12);
  if(!width||!height||width*height>16777216)throw new Error('texture-dimensions-budget');
  const bx=Math.ceil(width/4),by=Math.ceil(height/4);
  if(bytes.length<128+bx*by*16)throw new Error('truncated-asset');
  const bc3=Buffer.alloc(bx*by*16);
  for(let i=0;i<bx*by;i++){bc3[i*16]=255;bc3[i*16+1]=255;bytes.copy(bc3,i*16+8,128+i*16+8,128+(i+1)*16);}
  const image=decodeBlocks(bc3,width,height,'BC3');
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const block=Math.floor(y/4)*bx+Math.floor(x/4),p=(y%4)*4+x%4;
    image.rgba[(y*width+x)*4+3]=((bytes[128+block*16+Math.floor(p/2)]>>((p%2)*4))&15)*17;
  }
  return {...image,format:'BC2'};
}
