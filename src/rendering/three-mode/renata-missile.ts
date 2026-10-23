import { AdditiveBlending, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial, Vector3, type Camera } from 'three';

export const RENATA_LAUNCH_DELAY = .3, RENATA_FLIGHT_SECONDS = .6;

/** One camera-facing teardrop with a tapered wake. Its local +Y always follows the trajectory,
 * rather than inheriting the canister bone's (mostly edge-on) quad orientation. No combat state. */
export function createRenataMissile(from: Vector3, to: Vector3, radius: number) {
  const object = new Group(); object.name = 'renata-reference-missile';
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide,
    blending: AdditiveBlending, uniforms: { alpha: { value: 0 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform float alpha;void main(){
      vec2 p=(vUv-.5)*2.;
      float head=exp(-pow(p.x/.24,2.)-pow((p.y-.42)/.28,2.));
      float core=exp(-pow(p.x/.085,2.)-pow((p.y-.46)/.23,2.));
      float wake=smoothstep(-1.,.28,p.y)*(1.-smoothstep(.22,.5,p.y));
      float width=.055+.17*smoothstep(-1.,.3,p.y);
      float trail=exp(-pow(p.x/width,2.))*wake;
      float aura=exp(-pow(p.x/.52,2.)-pow((p.y-.27)/.6,2.));
      vec3 color=mix(vec3(.32,.035,.8),vec3(.75,.18,1.),head);
      color=mix(color,vec3(.85,.7,1.),core);
      float a=(head*.8+core*.75+trail*.6+aura*.15)*alpha;
      gl_FragColor=vec4(color,a*(1.-smoothstep(.88,1.,abs(p.y))));
    }` });
  const mesh = new Mesh(geometry, material); mesh.scale.set(radius * .36, radius * .92, 1); object.add(mesh);
  const start = from.clone(), end = to.clone(), previous = new Vector3(), forward = new Vector3(), up = new Vector3(0, 1, 0);
  let age = 0, disposed = false;
  const point = (t: number, out: Vector3) => out.lerpVectors(start, end, t).addScaledVector(up, Math.sin(Math.PI * t) * radius * .42);
  point(0, object.position);
  return { object, get finished() { return age >= RENATA_FLIGHT_SECONDS; }, update(seconds: number, camera?: Camera) {
    age += Math.max(0, seconds);
    const t = Math.min(1, age / RENATA_FLIGHT_SECONDS);
    point(Math.max(0, t - .025), previous); point(t, object.position);
    material.uniforms.alpha!.value = Math.min(1, age / .045) * Math.min(1, (RENATA_FLIGHT_SECONDS - age) / .065);
    if (camera) {
      camera.updateMatrixWorld();
      forward.copy(object.position).sub(previous).transformDirection(camera.matrixWorldInverse);
      mesh.quaternion.copy(camera.quaternion);
      mesh.rotateZ(Math.atan2(-forward.x, forward.y));
    }
  }, dispose() { if (disposed) return; disposed = true; object.removeFromParent(); geometry.dispose(); material.dispose(); } };
}
