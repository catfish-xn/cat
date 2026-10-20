import type { Curve } from './contracts';
export function sampleCurve(curve: Curve | undefined, time: number, fallback: number): number {
  if (!curve?.length) return fallback;
  if (time <= curve[0].time) return curve[0].value;
  for (let i = 1; i < curve.length; i++) {
    const left = curve[i - 1], right = curve[i];
    if (time <= right.time) return left.value + (right.value - left.value) * (time - left.time) / (right.time - left.time);
  }
  return curve[curve.length - 1].value;
}
export const vertexShader = `varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
export const fragmentShader = `uniform sampler2D map; uniform bool hasMap;
uniform vec3 tint; uniform float opacity; uniform float dissolve;
uniform vec2 tiles; uniform float frame; varying vec2 vUv;
void main(){
 vec2 cell=vec2(mod(frame,tiles.x),tiles.y-1.0-floor(frame/tiles.x));
 vec4 texel=hasMap?texture2D(map,(vUv+cell)/tiles):vec4(1.0);
 float noise=fract(sin(dot(floor(vUv*64.0),vec2(12.9898,78.233)))*43758.5453);
 if(dissolve>=1.0 || noise<dissolve)discard;
 gl_FragColor=vec4(texel.rgb*tint,texel.a*opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
