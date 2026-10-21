import type { ShaderMaterial } from 'three';
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
/** A color curve split into its three channel curves, once per curve (the documents are not changed afterwards). */
const channelCache = new WeakMap<object, [Curve, Curve, Curve]>();
export function colorChannels(color: readonly { readonly time: number; readonly value: readonly number[] }[]): [Curve, Curve, Curve] {
  let channels = channelCache.get(color);
  if (!channels) {
    const channel = (c: number): Curve => color.map(k => ({ time: k.time, value: k.value[c] }));
    channels = [channel(0), channel(1), channel(2)];
    channelCache.set(color, channels);
  }
  return channels;
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

/**
 * Particle materials kept for reuse, per shader variant (`key`): an effect given a pool hands its materials back on
 * expiry instead of disposing them, so a new particle neither builds a material nor makes the renderer look its program
 * up again, and a variant's program is never released between effects. The pool's owner disposes it.
 */
export class ParticleMaterialPool {
  private free = new Map<string, ShaderMaterial[]>();
  private closed = false;
  /** At most `keep` idle materials per variant; beyond that a returned one is disposed. */
  constructor(private readonly keep = 512) {}
  /** An idle material of this variant with `uniforms` copied in, or undefined (the caller builds one). */
  take(key: string, uniforms: Record<string, { value: unknown }>): ShaderMaterial | undefined {
    const material = this.free.get(key)?.pop();
    if (material) for (const name in uniforms) material.uniforms[name].value = uniforms[name].value;
    return material;
  }
  give(key: string, material: ShaderMaterial): void {
    let list = this.free.get(key);
    if (!list) { list = []; this.free.set(key, list); }
    if (this.closed || list.length >= this.keep) { material.dispose(); return; }
    material.uniforms.map.value = null; // never keep a texture alive through an idle material
    list.push(material);
  }
  get idle(): number { let n = 0; for (const list of this.free.values()) n += list.length; return n; }
  dispose(): void {
    this.closed = true;
    for (const list of this.free.values()) for (const material of list) material.dispose();
    this.free.clear();
  }
}
/** Live particles across every effect sharing it; a particle past `max` is not born (counted as dropped). */
export interface ParticleBudget { live: number; readonly max: number }
