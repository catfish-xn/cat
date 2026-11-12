// Dev-only page probes for the castcmp harness: what the vfx runtime is running, and where a unit's overhead bar sits on
// screen against its body. Read from the outside, with no hook in src/, so the same probes work on any checked-out build
// (a `before` column is an older commit).
//
// Running systems: vfx-ltk runtime.ts keeps its live systems in a Set of records shaped
// { reserved, system, source, fx, until, ... } (the same shape since before the attached-mesh work). Set.prototype.add /
// delete are wrapped on this page to notice records of that shape; nothing else is touched. A system that starts means its
// play() was accepted (play queues only when it returns true), so "started" stands in for play()'s return value.
//
// Overhead: the renderer adds each piece's root Group and, right after it, its overhead Group ('render3d-overhead') to the
// scene (both found as below); a unit's root is the scene Group
// nearest its board position, its bar is the overhead that follows it, its body point is the Pelvis bone (else Root).
type Rec = { system: string; source?: string; action?: string; reserved?: unknown; fx?: unknown; until?: unknown };
const looksRunning = (v: any): v is Rec => !!v && typeof v === 'object' && typeof v.system === 'string' && 'reserved' in v && 'fx' in v && 'until' in v;

export function installProbes(clock: () => number) {
  const live = new Set<Rec>(), started: { t: number; system: string; source?: string; action?: string }[] = [];
  const add = Set.prototype.add, del = Set.prototype.delete;
  Set.prototype.add = function (this: Set<unknown>, value: unknown) {
    if (looksRunning(value) && this !== (live as unknown)) { live.add(value); started.push({ t: clock(), system: value.system, source: value.source, action: value.action }); }
    return add.call(this, value) as any;
  };
  Set.prototype.delete = function (this: Set<unknown>, value: unknown) {
    if (looksRunning(value) && this !== (live as unknown)) del.call(live, value);
    return del.call(this, value);
  };
  // WebGLRenderer defines render() per instance, so the scene and camera are found another way: the scene is the parent
  // the renderer adds overheads to (Object3D.prototype.add), the camera the perspective camera with the canvas's aspect
  // whose world matrix the renderer refreshes each frame (Camera.prototype.updateMatrixWorld).
  let scene: any = null, camera: any = null;
  const three = import('three').then(THREE => {
    const add = THREE.Object3D.prototype.add;
    THREE.Object3D.prototype.add = function (this: any, ...objects: any[]) {
      if (objects.some(o => o?.name === 'render3d-overhead')) scene = this;
      return add.apply(this, objects);
    };
    const update = THREE.Camera.prototype.updateMatrixWorld;
    THREE.Camera.prototype.updateMatrixWorld = function (this: any, force?: boolean) {
      const c = document.querySelector('#host canvas') as HTMLCanvasElement | null;
      if (this.isPerspectiveCamera && c && Math.abs(this.aspect - c.clientWidth / Math.max(1, c.clientHeight)) < 0.01) camera = this;
      return update.call(this, force);
    };
    return THREE;
  });
  return {
    ready: three,
    /** Systems running now, and every start since the last reset (t on the harness clock, ms). */
    systems: () => ({ live: [...new Set([...live].map(r => r.system))], started: started.slice() }),
    resetStarts: () => { started.length = 0; },
    /** Every attached-mesh overlay drawn now (vfx-ltk AttachedMeshes: a SkinnedMesh named `<emitter>#<index>.<slot>` whose
     * material carries particleTint): its tint and erosion drive, its blend state, and each texture it samples with
     * whether that texture has its image yet (a texture still loading samples as nothing or a flat colour). */
    attached() {
      if (!scene) return { missing: ['scene'] };
      const out: any[] = [];
      scene.traverse((o: any) => {
        if (!o.isSkinnedMesh || !o.visible || !/#\d+\.\d+$/.test(o.name)) return;
        const mats: any[] = Array.isArray(o.material) ? o.material : [o.material];
        const m = mats.find(x => x?.uniforms?.particleTint); if (!m) return;
        const textures = Object.entries(m.uniforms).filter(([, u]: any) => u?.value?.isTexture).map(([k, u]: any) => {
          const img = u.value.image; return { uniform: k, ready: !!img && (img.width > 0 || img.data?.length > 0), size: img ? `${img.width ?? '?'}x${img.height ?? '?'}` : null, version: u.value.version };
        });
        const num = (v: any) => Array.isArray(v) ? v.map((x: number) => +x.toFixed(3)) : typeof v === 'number' ? +v.toFixed(3) : v;
        out.push({ name: o.name, host: o.parent?.name ?? null, parts: mats.filter(x => x?.visible !== false).length, of: mats.length,
          tint: num(m.uniforms.particleTint.value), erode: num(m.uniforms.particleErode?.value), blending: m.blending,
          blendSrc: m.blendSrc, blendDst: m.blendDst, transparent: m.transparent, depthTest: m.depthTest, depthWrite: m.depthWrite,
          defines: Object.keys(m.defines ?? {}).filter(k => !/^(SHEEN)$/.test(k)).join(','), textures });
      });
      return { draws: out };
    },
    /** Screen points (CSS px in the canvas) of `pos`'s unit: its overhead bar and its body (Pelvis, else Root, else root). */
    async overhead(pos: { x: number; y: number }) {
      const THREE = await three;
      const canvas = document.querySelector('#host canvas') as HTMLCanvasElement | null;
      if (!scene || !camera || !canvas) return { missing: [!scene && 'scene', !camera && 'camera', !canvas && 'canvas'].filter(Boolean) };
      const kids: any[] = scene.children;
      let best = -1, d = Infinity;
      for (let i = 0; i < kids.length - 1; i++) {
        if (!kids[i].isGroup || kids[i + 1].name !== 'render3d-overhead' || !kids[i].visible) continue;
        const p = kids[i].position, dd = (p.x - pos.x) ** 2 + (p.z - pos.y) ** 2;
        if (dd < d) { d = dd; best = i; }
      }
      if (best < 0) return { missing: ['root'] };
      const root = kids[best], bar = kids[best + 1];
      let body: any = null;
      root.traverse((o: any) => { if (!body && /pelvis/i.test(o.name)) body = o; });
      if (!body) root.traverse((o: any) => { if (!body && o.name === 'Root') body = o; });
      const rect = canvas.getBoundingClientRect();
      const screen = (o: any) => { o.updateWorldMatrix(true, false); const v = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld).project(camera);
        return { x: +((v.x + 1) / 2 * rect.width).toFixed(1), y: +((1 - v.y) / 2 * rect.height).toFixed(1) }; };
      const b = screen(bar), c = screen(body ?? root);
      return { barX: b.x, barY: b.y, bodyX: c.x, bodyY: c.y, dx: +(b.x - c.x).toFixed(1), bodyBone: body?.name ?? 'root', rootDistance: +Math.sqrt(d).toFixed(1) };
    },
  };
}
