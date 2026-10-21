import { Matrix4, Quaternion, Vector3 } from 'three';
import { readGlb, writeGlb } from './glb.mjs';
import { readAccessor } from './model.mjs';

/** Remove the source prop's fixed idle lean, outside every animated node. */
export function uprightShimmer(glb, idle) {
  const parsed = readGlb(glb), d = parsed.document;
  const clip = d.animations.find(a => a.name === idle);
  const main = d.nodes.findIndex(n => n.name === 'Main');
  const channel = clip?.channels.find(c => c.target.node === main && c.target.path === 'rotation');
  if (!channel) throw Error('missing-shimmer-main-rotation');
  const source = new Quaternion(...readAccessor(parsed, clip.samplers[channel.sampler].output)[0]).normalize();
  const up = new Vector3(0, 1, 0), authoredUp = up.clone().applyQuaternion(source);
  // Fail closed if a future source has an actual changing Main orientation.
  for (const a of d.animations) for (const c of a.channels) {
    if (c.target.node === main && c.target.path === 'rotation') {
      for (const q of readAccessor(parsed, a.samplers[c.sampler].output)) {
        if (up.clone().applyQuaternion(new Quaternion(...q).normalize()).distanceTo(authoredUp) > 1e-5)
          throw Error('shimmer-main-lean-is-not-constant');
      }
    }
  }
  const rotation = new Quaternion().setFromUnitVectors(authoredUp, up);
  // Make the GLB's default pose match the selected idle's first frame as well.
  for (const c of clip.channels) d.nodes[c.target.node][c.target.path] = readAccessor(parsed, clip.samplers[c.sampler].output)[0];
  const world = [];
  function visit(i, parent) {
    const n = d.nodes[i];
    world[i] = parent.clone().multiply(new Matrix4().compose(new Vector3(...(n.translation ?? [0, 0, 0])),
      new Quaternion(...(n.rotation ?? [0, 0, 0, 1])), new Vector3(...(n.scale ?? [1, 1, 1]))));
    for (const child of n.children ?? []) visit(child, world[i]);
  }
  const scene = d.scenes[d.scene ?? 0];
  for (const i of scene.nodes) visit(i, new Matrix4());
  const points = [];
  for (const [i, n] of d.nodes.entries()) if (n.mesh !== undefined) {
    for (const p of d.meshes[n.mesh].primitives) {
      const positions = readAccessor(parsed, p.attributes.POSITION);
      const skin = d.skins?.[n.skin];
      const joints = skin && readAccessor(parsed, p.attributes.JOINTS_0), weights = skin && readAccessor(parsed, p.attributes.WEIGHTS_0);
      const matrices = skin && readAccessor(parsed, skin.inverseBindMatrices).map((m, k) => world[skin.joints[k]].clone().multiply(new Matrix4().fromArray(m)));
      for (const [k, v] of positions.entries()) {
        const point = new Vector3();
        if (skin) for (let j = 0; j < 4; j++) {
          if (weights[k][j]) point.addScaledVector(new Vector3(...v).applyMatrix4(matrices[joints[k][j]]), weights[k][j]);
        }
        else point.copy(new Vector3(...v).applyMatrix4(world[i]));
        points.push(point.applyQuaternion(rotation));
      }
    }
  }
  const min = [0, 1, 2].map(k => Math.min(...points.map(p => p.getComponent(k))));
  const max = [0, 1, 2].map(k => Math.max(...points.map(p => p.getComponent(k))));
  const translation = [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2];
  const wrapper = d.nodes.length;
  d.nodes.push({ name: 'shimmer-upright-export', rotation: rotation.toArray(), translation, children: [...scene.nodes] });
  scene.nodes = [wrapper];
  return { glb: writeGlb(d, parsed.binary), report: { basis: 'source Main idle up axis to +Y; first idle pose grounded',
    sourceMainRotation: source.toArray(), sourceTiltDegrees: Math.acos(authoredUp.dot(up)) * 180 / Math.PI,
    rotation: rotation.toArray(), translation, defaultPose: idle } };
}
