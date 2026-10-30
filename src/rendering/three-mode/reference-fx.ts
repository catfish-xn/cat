/** Visual-only shapes and envelopes. Radii are art direction in board units, never hit tests. */
import { AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry, type Camera } from 'three';
import type { DisplayCombatEvent } from '../../presentation/combat-display';

export const RENATA_IMPACT_DELAY = 0.9, RENATA_BURST_SECONDS = 1, MEL_SAVE_SECONDS = 2;
export const renataRadius = (hexRadius: number): number => Math.sqrt(3) * hexRadius * 1.75;
export function melSaveEnvelope(seconds: number, reduced = false) {
  const t = Math.max(0, seconds), active = t < MEL_SAVE_SECONDS;
  return { radius: reduced ? 1 : Math.min(1, 0.12 + t / 0.5),
    violet: active ? reduced ? 0.12 : Math.min(1, t / 0.08) * Math.max(0, 1 - t / 1.1) : 0,
    gold: active ? reduced ? 0.12 : Math.min(1, Math.max(0, (t - 0.65) / 0.3)) * Math.min(1, (2 - t) / 0.5) : 0 };
}

/** The display event retains the public M8 EffectKeyTuple, including the source, even online. No path/ally
 * calculation: only a positive, granted Renata ability receipt names a recipient. Unknown keys fail closed. */
export function renataShieldTarget(event: DisplayCombatEvent): string | null {
  if (event.type !== 'shieldLayerChanged' || event.reason !== 'granted' || event.remaining <= 0) return null;
  try {
    const key: unknown = JSON.parse(event.key);
    return Array.isArray(key) && key.length === 9 && key[2] === 'ability' && key[3] === 'renata-ability'
      && key[7] === event.targetId ? event.targetId : null;
  } catch { return null; }
}

const vertexShader = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragmentShader = `
varying vec2 vUv; uniform float age, alpha, mel;
void main(){
  vec2 p=(vUv-.5)*2.; float r=length(p), a=atan(p.y,p.x);
  float rim=exp(-pow((r-.86)/.025,2.));
  float haze=(1.-smoothstep(.55,1.,r))*smoothstep(.05,.4,r);
  float veins=pow(.5+.5*sin(a*(8.+mel*4.)+r*14.-age*4.),5.);
  float inner=exp(-pow((r-.64)/.06,2.));
  vec3 purple=mix(vec3(.66,.025,.65),vec3(.28,.04,.95),mel);
  vec3 edge=mix(vec3(1.,.22,.85),vec3(.12,.85,1.),mel);
  vec3 c=mix(purple,edge,clamp(rim+inner*.3,0.,1.));
  float core=exp(-r*r*55.)*mel*max(0.,1.-age/0.65);
  c=mix(c,vec3(.2,1.,1.),core);
  float opacity=(rim*.85+haze*(.24+veins*.3+mel*.45)+inner*.16+core)*alpha;
  gl_FragColor=vec4(c,opacity*(1.-smoothstep(.95,1.,r)));
}`;

// Broken, softly lit vapour and a brief rolling shell, rather than a uniformly filled disc.
const renataFragment = `
varying vec2 vUv; uniform float age, alpha;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){
  vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);
  float n=noise(p*6.+vec2(age*.6,-age*.8))*.65+noise(p*15.-age)*.35;
  float edge=.68+.035*sin(a*7.+age)+.055*(n-.5);
  float smoke=(1.-smoothstep(.28,.83,r))*(.2+.8*n);
  float rim=exp(-pow((r-edge)/.04,2.))*(.25+.75*noise(p*9.+age));
  float streak=pow(max(0.,sin(a*11.+r*8.)),10.)*exp(-pow((r-.5)/.19,2.));
  float flash=exp(-r*r*22.)*max(0.,1.-age/.2);
  vec3 c=mix(vec3(.22,.018,.38),vec3(.78,.08,.72),rim);
  c=mix(c,vec3(.85,.45,1.),flash);
  gl_FragColor=vec4(c,(smoke*.32+rim*.55+streak*.12+flash*.8)*alpha);
}`;

export function createReferenceBurst(kind: 'renata' | 'mel', radius: number, reduced: boolean) {
  const object = new Group(); object.name = `${kind}-reference-burst`;
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({ vertexShader, fragmentShader: kind === 'renata' ? renataFragment : fragmentShader, transparent: true, depthWrite: false,
    side: DoubleSide, uniforms: { age: { value: 0 }, alpha: { value: 0 }, mel: { value: kind === 'mel' ? 1 : 0 } } });
  const mesh = new Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2; mesh.position.y = 3; object.add(mesh);
  const wisps: Mesh<PlaneGeometry, ShaderMaterial>[] = [];
  let wispMaterial: ShaderMaterial | null = null;
  if (kind === 'renata' && !reduced) {
    wispMaterial = new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending,
      uniforms: { alpha: { value: 0 } }, vertexShader,
      fragmentShader: `varying vec2 vUv;uniform float alpha;void main(){vec2 p=(vUv-.5)*2.;
        float r=length(p);float cloud=exp(-dot(p*vec2(1.4,1.),p*vec2(1.4,1.))*3.);
        float curl=exp(-pow((r-.53)/.16,2.))*(.5+.5*sin(atan(p.y,p.x)*2.+r*5.));
        gl_FragColor=vec4(mix(vec3(.34,.025,.72),vec3(.8,.15,.7),cloud),
          (cloud*.7+curl*.3)*(1.-smoothstep(.7,1.,r))*alpha);}` });
    for (let i = 0; i < 8; i++) {
      const wisp = new Mesh(geometry, wispMaterial); object.add(wisp); wisps.push(wisp);
    }
  }
  let cloud: Mesh<SphereGeometry, ShaderMaterial> | null = null;
  if (kind === 'renata' && !reduced) {
    cloud = new Mesh(new SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { age: { value: 0 }, alpha: { value: 0 } },
      vertexShader: `varying vec3 n,v;varying vec2 uv0;void main(){uv0=uv;vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
      fragmentShader: `varying vec3 n,v;varying vec2 uv0;uniform float age,alpha;void main(){
        float rim=pow(1.-abs(dot(normalize(n),normalize(v))),2.);
        float wisps=.5+.25*sin(uv0.x*39.+uv0.y*12.-age*2.)+.25*sin(uv0.x*63.-uv0.y*24.+age*3.);
        float edge=smoothstep(0.,.2,uv0.y);
        gl_FragColor=vec4(mix(vec3(.28,.025,.47),vec3(.85,.14,.74),rim),
          (rim*.48+wisps*.11)*alpha*edge);
      }` }));
    cloud.position.y = 3; object.add(cloud);
  }
  // One draw call for the central crystalline release; no textures or per-particle objects.
  let crown: Mesh<BufferGeometry, MeshBasicMaterial> | null = null;
  if (kind === 'mel' && !reduced) {
    const positions: number[] = [], colors: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      for (const [angle, r, y, color] of [[a - .18, .1, .02, [.35, .05, .8]], [a, .32, .22 + (i % 3) * .06, [.2, .9, 1]],
        [a + .18, .13, .02, [.9, .04, .75]]] as const) {
        positions.push(Math.cos(angle) * radius * r, radius * y, Math.sin(angle) * radius * r); colors.push(...color);
      }
    }
    const shards = new BufferGeometry(); shards.setAttribute('position', new Float32BufferAttribute(positions, 3));
    shards.setAttribute('color', new Float32BufferAttribute(colors, 3));
    crown = new Mesh(shards, new MeshBasicMaterial({ vertexColors: true, side: DoubleSide, transparent: true, depthWrite: false }));
    object.add(crown);
  }
  let age = 0, disposed = false;
  const duration = kind === 'mel' ? MEL_SAVE_SECONDS : RENATA_BURST_SECONDS;
  const rearm = () => {
    if (disposed) return;
    age = 0; object.removeFromParent(); update(0);
  };
  const update = (seconds: number, camera?: Camera) => {
    age += Math.max(0, seconds);
    const envelope = melSaveEnvelope(age, reduced);
    const scale = kind === 'mel' ? envelope.radius : reduced ? 1 : Math.min(1, .3 + age / .22);
    mesh.scale.setScalar(radius * scale);
    material.uniforms.age!.value = reduced ? 0 : age;
    material.uniforms.alpha!.value = kind === 'mel' ? envelope.violet : age >= duration ? 0
      : (reduced ? .3 : Math.min(1, age / .04)) * Math.min(1, (duration - age) / .45);
    if (cloud) {
      cloud.scale.set(radius * scale * .7, radius * .38 * Math.min(1, age / .15), radius * scale * .7);
      cloud.material.uniforms.age!.value = age;
      cloud.material.uniforms.alpha!.value = material.uniforms.alpha!.value * Math.max(0, 1 - age / .85);
    }
    if (wispMaterial) {
      wispMaterial.uniforms.alpha!.value = Math.min(1, age / .035) * Math.max(0, 1 - age / .7);
      wisps.forEach((wisp, i) => {
        const angle = i * Math.PI / 4 + .19, reach = radius * (.18 + .5 * Math.min(1, age / .3));
        wisp.position.set(Math.cos(angle) * reach, 9 + Math.sin(age * 3) * 13 + i % 3 * 4, Math.sin(angle) * reach);
        wisp.scale.set(radius * (.1 + age * .1), radius * (.17 + age * .08), 1);
        if (camera) { wisp.quaternion.copy(camera.quaternion); wisp.rotateZ(angle); }
      });
    }
    if (crown) { crown.scale.setScalar(Math.min(1, age / .15)); crown.material.opacity = envelope.violet; }
  };
  update(0);
  return { object, kind, radius, reduced, rearm, get finished() { return age >= duration; }, update,
    dispose() { if (disposed) return; disposed = true; object.removeFromParent(); geometry.dispose(); material.dispose(); crown?.geometry.dispose(); crown?.material.dispose(); cloud?.geometry.dispose(); cloud?.material.dispose(); wispMaterial?.dispose(); } };
}

/** A brief translucent shell, attached only to an event's actual recipient. */
export function createRenataShield(radius: number, reduced: boolean) {
  const object = new Group(); object.name = 'renata-receipt-shield';
  const geometry = new SphereGeometry(radius * 1.05, 20, 12);
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide,
    uniforms: { alpha: { value: 0 } },
    vertexShader: `varying vec3 n,v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `varying vec3 n,v;uniform float alpha;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),2.);gl_FragColor=vec4(.9,.16,.78,(.07+rim*.7)*alpha);}` });
  const mesh = new Mesh(geometry, material); mesh.position.y = radius * 1.35; mesh.scale.y = 1.3; object.add(mesh);
  let age = 0, disposed = false;
  const rearm = () => { if (disposed) return; age = 0; object.removeFromParent(); material.uniforms.alpha!.value = 0; };
  return { object, radius, reduced, rearm, get finished() { return age >= .6; }, update(seconds: number) {
    age += Math.max(0, seconds); material.uniforms.alpha!.value = Math.max(0, 1 - age / .6) * (reduced ? .35 : 1);
  }, dispose() { if (disposed) return; disposed = true; object.removeFromParent(); geometry.dispose(); material.dispose(); } };
}
