/** Cosmetic settlement volley. Its clock never gates a command, settlement or the next round. */
import { CanvasTexture, Group, Mesh, MeshBasicMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3, type Camera, type Scene } from 'three';
import type { ParticleEffect } from '../../rendering3d';
import type { PvpDamage } from '../../presentation/pvp-damage';

const FLIGHT = 0.8, IMPACT = 0.35, NUMBER = 1.3;
interface Bolt {
  from: Vector3; to: Vector3; delay: number; root: Group;
  travel: ParticleEffect | null; impact: ParticleEffect | null;
  landed: boolean; ended: boolean;
}
interface Volley {
  hit: PvpDamage; at: number; elapsed: number; bolts: Bolt[];
  target: () => Vector3; onImpact: () => void; disposed: boolean;
  number: Sprite | null; numberAt: number | null;
}
export function createPlayerDamage(ctx: {
  scene: Scene; camera: Camera; effectScale: number;
  loadEffect: ((id: string, seconds: number) => Promise<ParticleEffect>) | null;
  now?: () => number;
}) {
  const now = ctx.now ?? (() => performance.now());
  const geometry = new SphereGeometry(5, 10, 8);
  const material = new MeshBasicMaterial({ color: '#ffe3a1', transparent: true, depthWrite: false });
  const active = new Map<PvpDamage['target'], Volley>();
  let disposed = false;
  const point = (bolt: Bolt, t: number, out: Vector3) => {
    out.lerpVectors(bolt.from, bolt.to, t); out.y += Math.sin(Math.PI * t) * 60;
  };
  const releaseNumber = (sprite: Sprite | null) => {
    if (!sprite) return;
    sprite.removeFromParent(); sprite.material.map?.dispose(); sprite.material.dispose();
  };
  const release = (volley: Volley) => {
    volley.disposed = true;
    for (const bolt of volley.bolts) { bolt.root.removeFromParent(); bolt.travel?.dispose(); bolt.impact?.dispose(); }
    releaseNumber(volley.number); active.delete(volley.hit.target);
  };
  const clear = () => { for (const volley of active.values()) release(volley); };
  const load = async (id: string, seconds: number, volley: Volley, live: () => boolean) => {
    if (disposed || volley.disposed || !live()) return null;
    const fx = await ctx.loadEffect?.(id, seconds).catch(() => null);
    if (!fx) return null;
    if (disposed || volley.disposed || !live()) { fx.dispose(); return null; }
    fx.object.scale.setScalar(ctx.effectScale); ctx.scene.add(fx.object); return fx;
  };
  const number = (damage: number) => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const pen = canvas.getContext?.('2d'); if (!pen) return null;
    pen.textAlign = 'center'; pen.textBaseline = 'middle'; pen.font = 'bold 76px sans-serif';
    pen.lineWidth = 9; pen.strokeStyle = '#30150d'; pen.strokeText(`-${damage}`, 128, 64);
    pen.fillStyle = '#ff8a7a'; pen.fillText(`-${damage}`, 128, 64);
    const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(canvas), transparent: true, depthTest: false, depthWrite: false }));
    sprite.name = 'render3d-player-damage-number'; sprite.scale.set(110, 55, 1); sprite.renderOrder = 100;
    sprite.userData.damage = damage; ctx.scene.add(sprite); return sprite;
  };
  const land = (volley: Volley, at: number) => {
    // One authoritative total per target, even when no survivor/reliable terminal cell exists.
    volley.numberAt = at;
    if (volley.elapsed - at < NUMBER) {
      volley.number = number(volley.hit.damage);
      volley.number?.position.copy(volley.target()).add(new Vector3(0, 45, 0));
    }
    volley.onImpact();
  };
  return {
    play(hit: PvpDamage, sources: readonly Vector3[], target: () => Vector3, onImpact: () => void) {
      if (disposed) return;
      const previous = active.get(hit.target);
      if (previous) release(previous);
      const volley: Volley = { hit, at: now(), elapsed: 0, bolts: [], target, onImpact, disposed: false, number: null, numberAt: null };
      active.set(hit.target, volley);
      if (!sources.length) { land(volley, 0); return; }
      const gap = Math.min(0.07, 0.7 / sources.length);
      for (const [index, from] of sources.entries()) {
        const root = new Group(); root.name = 'render3d-player-damage-bolt'; ctx.scene.add(root);
        // A tiny golden core and tapering trail remain visible if the optional original particle cannot load.
        for (let tail = 0; tail < 5; tail++) { const mesh = new Mesh(geometry, material); mesh.scale.setScalar(1 - tail * 0.16); root.add(mesh); }
        const bolt: Bolt = { from: from.clone(), to: target(), delay: index * gap, root, travel: null, impact: null, landed: false, ended: false };
        root.visible = false; volley.bolts.push(bolt);
        void load('player-damage-mis', FLIGHT + 0.1, volley, () => !bolt.landed).then(async fx => {
          fx ??= await load('player-damage-mis1', FLIGHT + 0.1, volley, () => !bolt.landed);
          if (fx && !volley.disposed && !bolt.landed) { bolt.travel = fx; fx.object.visible = false; }
          else fx?.dispose();
        });
      }
    },
    update(seconds: number) {
      for (const volley of active.values()) {
        volley.elapsed = Math.max(volley.elapsed + seconds, (now() - volley.at) / 1000);
        let allLanded = true;
        for (const bolt of volley.bolts) {
          const age = volley.elapsed - bolt.delay;
          if (age < 0) { allLanded = false; continue; }
          bolt.to.copy(volley.target());
          if (!bolt.landed && age < FLIGHT) {
            allLanded = false; const t = age / FLIGHT;
            bolt.root.visible = !bolt.travel;
            bolt.root.children.forEach((mesh, index) => point(bolt, Math.max(0, t - index * 0.035), mesh.position));
            if (bolt.travel) {
              bolt.travel.object.visible = true; point(bolt, t, bolt.travel.object.position);
              bolt.travel.object.lookAt(bolt.to); bolt.travel.update(seconds, ctx.camera);
            }
          } else if (!bolt.landed) {
            bolt.landed = true; bolt.travel?.dispose(); bolt.travel = null; bolt.root.visible = false;
            void load('player-damage-tar', IMPACT, volley, () => !bolt.ended).then(fx => {
              if (fx && !volley.disposed && !bolt.ended) { bolt.impact = fx; fx.object.position.copy(bolt.to); }
              else fx?.dispose();
            });
          }
          if (bolt.landed && !bolt.ended) {
            const impactAge = age - FLIGHT;
            bolt.root.visible = !bolt.impact && impactAge < IMPACT;
            bolt.root.children.forEach((mesh, index) => {
              mesh.position.copy(bolt.to); mesh.scale.setScalar(index === 0 ? 1 + impactAge * 15 : 0);
            });
            if (bolt.impact) { bolt.impact.object.position.copy(bolt.to); bolt.impact.update(seconds, ctx.camera); }
            if (impactAge >= IMPACT) { bolt.ended = true; bolt.impact?.dispose(); bolt.impact = null; bolt.root.removeFromParent(); }
          }
        }
        if (allLanded && volley.numberAt === null) {
          // One authoritative total, after the last impact; never split or multiply the server's damage.
          land(volley, FLIGHT + volley.bolts[volley.bolts.length - 1]!.delay);
        }
        if (volley.numberAt !== null) {
          const age = volley.elapsed - volley.numberAt;
          if (volley.number) {
            volley.number.position.copy(volley.target()).add(new Vector3(0, 45 + age * 24, 0));
            volley.number.material.opacity = Math.min(1, Math.max(0, (NUMBER - age) / 0.4));
          }
          if (age >= NUMBER) release(volley);
        }
      }
    },
    clear,
    isActive: () => active.size > 0,
    debug: () => {
      const volleys = [...active.values()].map(volley => ({ key: volley.hit.key, target: volley.hit.target, damage: volley.hit.damage,
        count: volley.bolts.length, landed: volley.bolts.filter(bolt => bolt.landed).length, number: volley.numberAt !== null }));
      return volleys.length ? { ...volleys[volleys.length - 1]!, volleys } : null;
    },
    dispose() { if (disposed) return; clear(); disposed = true; geometry.dispose(); material.dispose(); },
  };
}
