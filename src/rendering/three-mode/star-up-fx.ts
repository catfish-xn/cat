import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, Vector3, type SkinnedMesh, type Object3D } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { BoardMerge, BoardMergePoint } from '../board-feed';

export const STAR_UP_FLY_SECONDS = .3, STAR_UP_SECONDS = .68;
export interface MergeModel { readonly object: Object3D; release(): void }
export interface StarUpHost {
  readonly scene: Object3D;
  /** Transfers a consumed model out of the live/pickable roster, retaining its lease until release. */
  take(id: string): MergeModel | undefined;
  target(id: string): Object3D | undefined;
  point(point: BoardMergePoint): Vector3;
  color(level: number): string;
  reduced(): boolean;
}

/** Only presentation; receives explicit domain merges via BoardFeed, never compares rosters to infer one. */
export function createStarUpFx(host: StarUpHost) {
  interface Stage {
    merge: BoardMerge; delay: number; fly: number; impacted: boolean; to: Vector3;
    ghosts: { object: Object3D; from: Vector3; scale: Vector3 }[];
    ring: Mesh<RingGeometry, MeshBasicMaterial>; flash: Mesh<SphereGeometry, MeshBasicMaterial>;
  }
  interface Batch { age: number; end: number; group: Group; stages: Stage[]; held: MergeModel[]; clones: Object3D[] }
  const batches: Batch[] = [];
  const levels = new Map<string, number>();
  const pulse = new Map<string, number>();
  let disposed = false;
  const finish = (batch: Batch) => {
    batch.group.removeFromParent();
    for (const stage of batch.stages) { stage.ring.geometry.dispose(); stage.flash.geometry.dispose(); stage.ring.material.dispose(); stage.flash.material.dispose(); }
    // Clones share the held models' buffers/materials: only their original owner releases those resources.
    batch.group.clear(); batch.clones.forEach(object => object.traverse(node => (node as SkinnedMesh).skeleton?.dispose())); batch.held.forEach(model => model.release());
  };
  const clear = () => { batches.splice(0).forEach(finish); levels.clear(); pulse.clear(); };
  return {
    level: (id: string, authoritative: number) => levels.get(id) ?? authoritative,
    scale: (id: string) => 1 + Math.sin(Math.PI * (pulse.get(id) ?? 0)) * .5,
    play(merges: readonly BoardMerge[]) {
      if (disposed || !merges.length) return;
      const group = new Group(); group.name = 'render3d-star-up'; host.scene.add(group);
      // Capture every consumed model before the next BoardFrame removes it, including intermediate cascade survivors.
      const taken = new Map<string, MergeModel>();
      for (const merge of merges) for (const source of merge.from) if (!taken.has(source.id)) {
        const model = host.take(source.id); if (model) { model.object.visible = false; taken.set(source.id, model); }
      }
      // Snapshot templates before any transferred model is animated. Bought copies may never have had a view.
      const templates = new Map<string, Object3D>(), clones: Object3D[] = [];
      for (const merge of merges) {
        const source = merge.from.map(point => taken.get(point.id)?.object).find(Boolean);
        if (source) { const template = clone(source); templates.set(merge.definitionId, template); clones.push(template); }
      }
      const ready = new Map<string, number>();
      const stages = merges.map((merge): Stage => {
        if (!levels.has(merge.to.id)) levels.set(merge.to.id, merge.fromStar);
        const delay = Math.max(0, ...[merge.to, ...merge.from].map(point => ready.get(point.id) ?? 0));
        const fly = host.reduced() ? 0 : STAR_UP_FLY_SECONDS;
        const color = host.color(merge.toStar);
        const ring = new Mesh(new RingGeometry(23, 27, 40), new MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending, toneMapped: false }));
        ring.rotation.x = -Math.PI / 2; ring.name = 'merge-ring'; ring.visible = false;
        const flash = new Mesh(new SphereGeometry(25, 12, 8), new MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: AdditiveBlending, toneMapped: false }));
        flash.name = 'merge-flash'; flash.visible = false; group.add(ring, flash);
        const ghosts = fly ? merge.from.map(point => {
          const object = taken.get(point.id)?.object ?? (templates.has(merge.definitionId) ? clone(templates.get(merge.definitionId)!) : new Group());
          if (!taken.has(point.id)) clones.push(object);
          const from = taken.has(point.id) ? object.position.clone() : host.point(point);
          // With no visible copy yet, use a small light silhouette; no model request delays this animation.
          if (!object.children.length) {
            const silhouette = new Mesh(flash.geometry, flash.material); silhouette.position.y = 28; object.add(silhouette);
          }
          group.add(object); object.visible = false;
          return { object, from, scale: object.scale.clone() };
        }) : [];
        const stage: Stage = { merge, delay, fly, impacted: false, to: host.point(merge.to), ghosts, ring, flash };
        ready.set(merge.to.id, delay + fly);
        return stage;
      });
      // Reduced motion consumes no flying models, but their leases still live until this short flash ends.
      const end = Math.max(...stages.map(stage => stage.delay + (stage.fly ? STAR_UP_SECONDS : .24)));
      batches.push({ age: 0, end, group, stages, held: [...taken.values()], clones });
    },
    update(seconds: number) {
      for (const batch of [...batches]) {
        batch.age += Math.max(0, seconds);
        for (const stage of batch.stages) {
          const elapsed = batch.age - stage.delay;
          if (elapsed < 0) continue;
          const target = host.target(stage.merge.to.id);
          if (target) stage.to.copy(target.position);
          const t = stage.fly ? Math.min(1, elapsed / stage.fly) : 1;
          stage.ghosts.forEach(ghost => {
            ghost.object.visible = t < 1;
            ghost.object.position.lerpVectors(ghost.from, stage.to, t * t);
            if (t < 1) ghost.object.position.y += Math.sin(t * Math.PI) * 35;
            ghost.object.scale.copy(ghost.scale).multiplyScalar(1 - t * .8);
          });
          if (elapsed < stage.fly) continue;
          if (!stage.impacted) { stage.impacted = true; levels.set(stage.merge.to.id, stage.merge.toStar); }
          const p = Math.min(1, (elapsed - stage.fly) / (stage.fly ? STAR_UP_SECONDS - stage.fly : .24));
          pulse.set(stage.merge.to.id, stage.fly ? p : 0);
          stage.ring.visible = p < 1; stage.ring.position.copy(stage.to).add(new Vector3(0, 2, 0));
          stage.ring.scale.setScalar(stage.fly ? 1 + p * 2 : 1); stage.ring.material.opacity = 1 - p;
          stage.flash.visible = p < 1; stage.flash.position.copy(stage.to).add(new Vector3(0, 30, 0));
          stage.flash.scale.setScalar(stage.fly ? 1 + p : 1); stage.flash.material.opacity = (1 - p) ** 2 * .65;
        }
        if (batch.age >= batch.end) {
          batches.splice(batches.indexOf(batch), 1); finish(batch);
        }
      }
      // Keep pending levels only while a stage still owns them; a later authoritative frame may promote to 4★.
      for (const id of levels.keys()) if (!batches.some(batch => batch.stages.some(stage => stage.merge.to.id === id))) { levels.delete(id); pulse.delete(id); }
    },
    clear,
    dispose() { if (disposed) return; disposed = true; clear(); },
  };
}
