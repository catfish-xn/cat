/** Cosmetic arrivals on the feed's opponent side. No commands, timers, assets or rules. */
import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import type { BoardFrame } from '../board-feed';

interface ArrivalPiece {
  readonly root: Group;
  readonly target: Vector3;
  readonly alive: boolean;
}
export const PORTAL_SECONDS = 0.62;
const STAGGER_SECONDS = 0.025, MAX_STAGGER = 0.18;

export function createPvpPortal(parent: Group | import('three').Scene) {
  const object = new Group(); object.name = 'render3d-pvp-portal'; object.visible = false; parent.add(object);
  const geometry = new RingGeometry(0.72, 1, 48);
  const material = new MeshBasicMaterial({ color: '#a293ff', side: DoubleSide, transparent: true, opacity: 0,
    depthWrite: false, blending: AdditiveBlending });
  const innerMaterial = material.clone(); innerMaterial.color.set('#58dfff');
  const arc = new RingGeometry(0.75, 1, 40, 1, 0, Math.PI * 1.55);
  const outer = new Mesh(geometry, material), inner = new Mesh(arc, innerMaterial);
  outer.rotation.x = inner.rotation.x = -Math.PI / 2; inner.scale.setScalar(0.66); inner.position.y = 0.015;
  object.add(outer, inner);
  const arrivals = new Map<string, { piece: ArrivalPiece; delay: number }>();
  let elapsed = 0, radius = 34, closed = false;
  const cancel = () => {
    for (const { piece } of arrivals.values()) piece.root.position.copy(piece.target);
    arrivals.clear(); object.visible = false;
  };
  return {
    object,
    get active() { return arrivals.size > 0; },
    /** `began` is only the local preparation → combat edge, never a mount/reconnect/watch edge. */
    frame(frame: BoardFrame, pieces: ReadonlyMap<string, ArrivalPiece>, began: boolean, enabled: boolean) {
      if (closed) return;
      if (!enabled || !frame.fighting) { cancel(); return; }
      // A disappearing/dead unit must immediately stop travelling, including during an arrival.
      for (const [id, entry] of arrivals) {
        if (pieces.get(id) !== entry.piece || !entry.piece.alive || !entry.piece.root.visible) {
          entry.piece.root.position.copy(entry.piece.target); arrivals.delete(id);
        }
      }
      if (!began) { object.visible = arrivals.size > 0; return; }
      cancel();
      const enemies = frame.pieces.filter(piece => piece.team === 'enemy' && piece.visible && piece.alive);
      if (!enemies.length || enemies.some(piece => piece.neutral)) return;
      radius = frame.hexRadius;
      // Feed coordinates already put the opponent in the far half for either board perspective.
      const span = Math.sqrt(3) * radius;
      object.position.set(frame.origin.x + span * (frame.columns - 1) / 2, 4, frame.origin.y + radius * 0.7);
      object.scale.setScalar(radius * 1.45);
      elapsed = 0; object.visible = true;
      for (const piece of enemies) {
        const view = pieces.get(piece.id);
        if (view) arrivals.set(piece.id, { piece: view, delay: Math.min(arrivals.size * STAGGER_SECONDS, MAX_STAGGER) });
      }
    },
    advance(seconds: number, enabled: boolean) {
      if (!enabled) { cancel(); return; }
      if (!arrivals.size) return;
      elapsed += Math.max(0, seconds);
      const fade = Math.min(1, elapsed / 0.08) * Math.min(1, Math.max(0, (PORTAL_SECONDS + MAX_STAGGER - elapsed) / 0.18));
      material.opacity = 0.8 * fade; innerMaterial.opacity = 0.6 * fade;
      inner.scale.setScalar(0.62 + Math.sin(elapsed * 14) * 0.05);
      object.rotation.y = elapsed * 1.8;
    },
    /** Applied after ordinary following and before overheads; every landing uses the latest feed target. */
    apply(id: string) {
      const entry = arrivals.get(id);
      if (!entry) return;
      const { piece, delay } = entry;
      const t = Math.min(1, Math.max(0, (elapsed - delay) / PORTAL_SECONDS));
      if (t >= 1 || !piece.alive || !piece.root.visible) {
        piece.root.position.copy(piece.target); arrivals.delete(id); object.visible = arrivals.size > 0; return;
      }
      const ease = 1 - (1 - t) ** 3;
      piece.root.position.lerpVectors(object.position, piece.target, ease);
      piece.root.position.y = piece.target.y + radius * (2.2 * (1 - ease) + Math.sin(t * Math.PI) * 1.2);
    },
    cancel,
    dispose() {
      if (closed) return;
      closed = true; cancel(); object.removeFromParent(); geometry.dispose(); arc.dispose(); material.dispose(); innerMaterial.dispose();
    },
  };
}
