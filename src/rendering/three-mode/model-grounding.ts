/** CPU support contacts; props constrain penetration without selecting the foot anchor. */
import { Bone, Matrix4, Quaternion, SkinnedMesh, Vector3, type BufferGeometry, type Object3D } from 'three';

type Point = readonly [number, number, number];
type Contact = { mesh: number; vertex: number };
export interface ModelSupport {
  readonly center: Point;
  readonly floor: number;
  readonly normal: Point;
  readonly tiltDegrees: number;
  readonly tiltDeviation: number;
  /** Each individual sole must agree with the pooled plane; staggered/tiptoe feet cannot prove a rigid tilt. */
  readonly soleDeviation: number;
  readonly stableFeet: number;
  readonly contacts: readonly Contact[];
  readonly meshContacts: readonly Contact[];
  readonly meshFloor: number;
  readonly height: number;
  readonly method: 'feet' | 'body';
}

const up = new Vector3(0, 1, 0);
const footName = /foot|toe|ankle|paw|hoof/i;
const propName = /weapon|sword|blade|axe|shield|buffbone|overhead|(?:^|_)fx(?:_|$)/i;
const CHUNK = 512;
const renderedVertices = new WeakMap<BufferGeometry, Uint8Array>();
export const GROUNDING_BLEND_SECONDS = 0.12;
/** A small reserve for extrema between the eight calibration poses; audited independently at 30 fps. */
export const MESH_PENETRATION_RATIO = 0.009;

/** Classification itself is sliced, including large meshes' skin weights and index buffers. */
export function* supportVertexSteps(mesh: SkinnedMesh): Generator<void, readonly (string | null)[]> {
  const kinds = mesh.skeleton.bones.map(bone => {
    let foot: Bone | null = null, prop = false;
    for (let node: Object3D | null = bone; node instanceof Bone; node = node.parent) {
      if (footName.test(node.name) && !propName.test(node.name)) foot = node;
      if (propName.test(node.name)) prop = true;
    }
    return foot ? foot.name : prop ? null : 'body';
  });
  const { skinIndex: indices, skinWeight: weights, position } = mesh.geometry.attributes;
  const selected: (string | null)[] = Array(position.count).fill(null), used = new Uint8Array(position.count);
  const index = mesh.geometry.index;
  for (let i = 0; i < (index?.count ?? position.count); i++) {
    used[index ? index.getX(i) : i] = 1;
    if (i % CHUNK === CHUNK - 1) yield;
  }
  for (let vertex = 0; vertex < position.count; vertex++) {
    if (used[vertex]) {
      let body = 0, best = 0, foot: string | null = null;
      // At most four influences; no per-vertex Map/sort allocation.
      for (let k = 0; k < 4; k++) {
        const kind = kinds[indices!.getComponent(vertex, k)];
        if (kind === 'body') body += weights!.getComponent(vertex, k);
        else if (kind) {
          let total = 0;
          for (let j = 0; j < 4; j++) if (kinds[indices!.getComponent(vertex, j)] === kind) total += weights!.getComponent(vertex, j);
          if (total > best) { best = total; foot = kind; }
        }
      }
      selected[vertex] = best >= 0.5 ? foot : body >= 0.5 ? 'body' : null;
    }
    if (vertex % CHUNK === CHUNK - 1) yield;
  }
  renderedVertices.set(mesh.geometry, used);
  return selected;
}
export function supportVertices(mesh: SkinnedMesh): readonly (string | null)[] {
  const steps = supportVertexSteps(mesh);
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}

/** Least-squares y=ax+bz+c normal. A line/point cannot establish a support plane. */
export function supportNormal(points: readonly { x: number; y: number; z: number }[]): Vector3 {
  let mx = 0, my = 0, mz = 0;
  for (const p of points) { mx += p.x; my += p.y; mz += p.z; }
  const n = points.length || 1; mx /= n; my /= n; mz /= n;
  let xx = 0, zz = 0, xz = 0, xy = 0, zy = 0;
  for (const point of points) {
    const x = point.x - mx, y = point.y - my, z = point.z - mz;
    xx += x * x; zz += z * z; xz += x * z; xy += x * y; zy += z * y;
  }
  const determinant = xx * zz - xz * xz;
  if (determinant <= 1e-8 * Math.max(xx * zz, 1)) return up.clone();
  return new Vector3(-(xy * zz - zy * xz) / determinant, 1, -(zy * xx - xy * xz) / determinant).normalize();
}
const angle = (a: Vector3, b: Vector3) => Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180 / Math.PI;

/** Calibration reuses numeric vertex records across poses; no point.clone() in the full mesh scan. */
export function createSupportSampler(meshes: readonly SkinnedMesh[], height: number, classified = meshes.map(supportVertices)) {
  type Sample = Contact & { x: number; y: number; z: number };
  const used = meshes.map(mesh => renderedVertices.get(mesh.geometry));
  const samples: Sample[][] = meshes.map(() => []), frames: { center: Vector3; floor: number; normal: Vector3 }[] = [];
  const contacts = new Map<string, Contact>(), meshContacts = new Map<string, Contact>();
  let method: ModelSupport['method'] = 'body', meshFloor = Infinity, soleDeviation = 0, stableFeet = Infinity, idleHeight = height;
  function* frameSteps(): Generator<void> {
    const groups = new Map<string, Sample[]>(); let low = Infinity, work = 0, fullMin = Infinity, fullMax = -Infinity;
    for (let mesh = 0; mesh < samples.length; mesh++) {
      const vertices = samples[mesh]!; let min = Infinity;
      for (const p of vertices) {
        if (p) {
          min = Math.min(min, p.y); fullMin = Math.min(fullMin, p.y); fullMax = Math.max(fullMax, p.y);
          const kind = classified[mesh]![p.vertex];
          if (kind) { const group = groups.get(kind) ?? []; group.push(p); groups.set(kind, group); low = Math.min(low, p.y); }
        }
        if (++work % CHUNK === 0) yield;
      }
      meshFloor = Math.min(meshFloor, min);
      // A low band rather than a single minimum follows changing weapon/tail extrema between calibration frames.
      for (const p of vertices) {
        if (p && p.y <= min + height * 0.02) meshContacts.set(`${mesh}:${p.vertex}`, { mesh, vertex: p.vertex });
        if (++work % CHUNK === 0) yield;
      }
    }
    idleHeight = Math.min(idleHeight, fullMax - fullMin);
    if (!groups.size) return;
    // Elevated passenger feet (Rumble's pilot) do not support the mech.
    const feet = [...groups].filter(([name, vertices]) => name !== 'body' && vertices.some(v => v.y <= low + height * 0.25));
    const selected = feet.length ? feet.map(([, vertices]) => vertices) : [[...groups.values()].flat()];
    if (feet.length) method = 'feet';
    const center = new Vector3(), soles: Sample[] = [], normals: Vector3[] = []; let floor = Infinity;
    for (const vertices of selected) {
      let bottom = Infinity, top = -Infinity;
      for (const v of vertices) { bottom = Math.min(bottom, v.y); top = Math.max(top, v.y); if (++work % CHUNK === 0) yield; }
      floor = Math.min(floor, bottom);
      const band = Math.min((top - bottom) * 0.15, height * 0.02) + 1e-6, sole: Sample[] = [];
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const v of vertices) {
        if (v.y <= bottom + band) {
          sole.push(v); soles.push(v);
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
          minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
          contacts.set(`${v.mesh}:${v.vertex}`, { mesh: v.mesh, vertex: v.vertex });
        }
        if (++work % CHUNK === 0) yield;
      }
      center.add(new Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2));
      normals.push(supportNormal(sole));
    }
    const normal = supportNormal(soles);
    for (const n of normals) soleDeviation = Math.max(soleDeviation, angle(n, normal));
    stableFeet = Math.min(stableFeet, feet.length);
    frames.push({ center: center.divideScalar(selected.length), floor, normal });
  }
  return {
    vertex(mesh: number, vertex: number, point: Vector3) {
      // Envelope visits every vertex; only rendered/indexed vertices constrain full-mesh penetration.
      if (!used[mesh]?.[vertex]) return;
      const p = samples[mesh]![vertex] ?? (samples[mesh]![vertex] = { mesh, vertex, x: 0, y: 0, z: 0 });
      p.x = point.x; p.y = point.y; p.z = point.z;
    },
    frameSteps,
    frame() { for (const _ of frameSteps()) { /* synchronous audit/test helper */ } },
    finish(): ModelSupport | undefined {
      if (!frames.length) return undefined;
      const center = frames.reduce((sum, frame) => sum.add(frame.center), new Vector3()).divideScalar(frames.length);
      const normal = frames.reduce((sum, frame) => sum.add(frame.normal), new Vector3()).normalize();
      return { center: center.toArray(), floor: Math.min(...frames.map(frame => frame.floor)), normal: normal.toArray(),
        tiltDegrees: angle(normal, up), tiltDeviation: Math.max(...frames.map(frame => angle(frame.normal, normal))),
        soleDeviation, stableFeet, meshFloor, height: idleHeight, meshContacts: [...meshContacts.values()], contacts: [...contacts.values()], method };
    },
  };
}

/** Pooled slant alone is insufficient: both individual soles must corroborate it throughout idle. */
export function supportRotation(support: ModelSupport): Quaternion {
  return support.method === 'feet' && support.stableFeet >= 2 && support.soleDeviation <= 0.5
    && support.tiltDegrees >= 1.5 && support.tiltDegrees <= 8 && support.tiltDeviation <= 0.25
    ? new Quaternion().setFromUnitVectors(new Vector3(...support.normal), up) : new Quaternion();
}

interface GroundedModel {
  meshes: { mesh: SkinnedMesh; contacts: { vertex: number; foot: boolean; guard: boolean }[] }[];
  offset: number; floor: number; allowance: number; idle?: boolean; elapsed: number; from: number;
}
const grounded = new WeakMap<Object3D, GroundedModel>();
const inverse = new Matrix4(), point = new Vector3();
export function registerModelGrounding(body: Object3D, support: ModelSupport, floor: number, scale: number): void {
  const meshes: SkinnedMesh[] = [];
  body.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node); });
  grounded.set(body, { meshes: meshes.map((mesh, index) => {
    const vertices = new Map<number, { vertex: number; foot: boolean; guard: boolean }>();
    for (const [source, kind] of [[support.contacts, 'foot'], [support.meshContacts, 'guard']] as const) {
      for (const c of source) if (c.mesh === index) {
        const flags = vertices.get(c.vertex) ?? { vertex: c.vertex, foot: false, guard: false }; flags[kind] = true; vertices.set(c.vertex, flags);
      }
    }
    return { mesh, contacts: [...vertices.values()] };
  }).filter(entry => entry.contacts.length), offset: 0, floor, allowance: support.height * scale * MESH_PENETRATION_RATIO, elapsed: 0, from: 0 });
}

/** After posing: follow idle, blend both entry and release over 120 ms, preserving external lifts/parent transforms. */
export function updateModelGrounding(body: Object3D, idle: boolean, seconds: number): void {
  const entry = grounded.get(body);
  if (!entry) return;
  if (entry.idle !== idle) {
    entry.from = entry.offset; entry.elapsed = entry.idle === undefined ? GROUNDING_BLEND_SECONDS : 0; entry.idle = idle;
  }
  let target = 0;
  if (idle && entry.meshes.length) {
    // One hierarchy refresh. updateWorldMatrix alone does not refresh attached skins' inverse bind matrices.
    body.updateWorldMatrix(true, true); inverse.copy(body.matrixWorld).invert();
    let foot = Infinity, meshLow = Infinity;
    for (const { mesh, contacts } of entry.meshes) {
      if (mesh.bindMode === 'attached') mesh.bindMatrixInverse.copy(mesh.matrixWorld).invert();
      mesh.skeleton.update();
      for (const c of contacts) {
        mesh.getVertexPosition(c.vertex, point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        const y = point.multiply(body.scale).applyQuaternion(body.quaternion).y;
        if (c.foot) foot = Math.min(foot, y);
        if (c.guard) meshLow = Math.min(meshLow, y);
      }
    }
    const low = Math.min(foot, meshLow + entry.allowance);
    if (Number.isFinite(low)) target = entry.floor - low;
  }
  entry.elapsed = Math.min(GROUNDING_BLEND_SECONDS, entry.elapsed + Math.max(0, seconds));
  const t = entry.elapsed / GROUNDING_BLEND_SECONDS, blend = t * t * (3 - 2 * t);
  const next = entry.from + (target - entry.from) * blend;
  body.position.y += next - entry.offset; entry.offset = next;
}
