import { AnimationMixer, Group, LoopOnce, Vector3, type Object3D } from 'three';
import type { ModelLease } from '../../../../rendering3d';
import type { VfxUnit } from '../runtime';
interface Proxy extends VfxUnit { root: Group; until: number; owner: string; target?: string; slot: number; lease?: ModelLease; mixer?: AnimationMixer }
/** Display objects have no board membership, bars, picking, commands, or damage callbacks. */
export function createSummonProxies(scene: Object3D, find: (id: string) => VfxUnit | undefined, load?: (id: string) => Promise<ModelLease>) {
  const proxies = new Map<string, Proxy>(); let clock = 0, serial = 0;
  const remove = (id: string, p: Proxy) => { p.disposed = true; p.alive = false; p.mixer?.stopAllAction(); p.mixer?.uncacheRoot(p.lease!.scene); p.lease?.release(); p.root.removeFromParent(); proxies.delete(id); };
  const point = new Vector3();
  return {
    find: (id: string) => proxies.get(id),
    spawn(owner: string, model: string, count: number, duration: number, target?: string): string[] {
      const source = find(owner); if (!source?.alive || !load) return [];
      const ids: string[] = [];
      for (let slot = 0; slot < Math.min(count, 8) && proxies.size < 32; slot++) {
        const id = `vfx-batch3:${owner}:${serial++}`, root = new Group(); root.name = model;
        const proxy: Proxy = { root, body: null, alive: true, until: clock + duration, owner, target, slot };
        root.position.copy(source.root.position); root.userData.visualProxy = true; scene.add(root); proxies.set(id, proxy); ids.push(id);
        void load(model).then(lease => {
          if (proxy.disposed || lease.placeholder) { lease.release(); if (!proxy.disposed) remove(id, proxy); return; }
          proxy.lease = lease; proxy.body = lease.scene; root.add(lease.scene);
          lease.scene.scale.multiplyScalar(model === 'vfx-elise-spider' ? .24 : .44 * .4268);
          proxy.mixer = new AnimationMixer(lease.scene);
          const clip = lease.animations.find(c => c.name === lease.animationNames.move);
          if (clip) proxy.mixer.clipAction(clip).play();
        }).catch(() => { if (!proxy.disposed) remove(id, proxy); });
      }
      return ids;
    },
    attack(id: string, target: string) {
      const p = proxies.get(id); if (!p) return; p.target = target;
      const clip = p.lease?.animations.find(c => c.name === p.lease?.animationNames.attack);
      if (clip && p.mixer) { p.mixer.stopAllAction(); p.mixer.clipAction(clip).reset().setLoop(LoopOnce, 1).play(); }
    },
    drop(ids: readonly string[]) { for (const id of ids) { const held = proxies.get(id); if (held) remove(id, held); } },
    stopUnit(id: string) { for (const [key, p] of proxies) if (p.owner === id || p.target === id) remove(key, p); },
    update(seconds: number) {
      clock += seconds;
      for (const [id, p] of proxies) {
        const source = find(p.owner), target = p.target ? find(p.target) : undefined;
        if (clock >= p.until || !source?.alive || source.disposed || (p.target && (!target?.alive || target.disposed))) { remove(id, p); continue; }
        point.copy((target ?? source).root.position); const a = p.slot * Math.PI / 2;
        point.x += Math.cos(a) * 24; point.z += Math.sin(a) * 24;
        p.root.position.lerp(point, Math.min(1, seconds * 8)); p.root.lookAt(point.x, p.root.position.y, point.z); p.mixer?.update(seconds);
      }
    },
    clear() { for (const [id, p] of proxies) remove(id, p); },
    get count() { return proxies.size; },
  };
}
