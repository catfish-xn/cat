/**
 * Skill feel sample (2026-10-24 playtest: 普攻和技能很难区分，特效有点卡). Display only, never combat timing.
 *
 * For the sample champions a cast reads as a cast: a short charge in the champion's color (a ring closing in at the
 * feet and a glow on the body, the mana bar flashing before it empties), only then the cast's own effects, trimmed to
 * launch / flight / impact; at the impact the caster and its targets hold their pose a moment and the camera gives a
 * small kick. Their basic attacks drop the official, colorful attack effects for one small near-white tracer (ranged) or
 * spark (melee), drawn from a fixed pool of sprites sharing one texture: no per-attack loads, materials or geometry.
 * Champions without a row in skill-fx-table.ts are unchanged.
 */
import { AdditiveBlending, CanvasTexture, Group, Mesh, MeshBasicMaterial, RingGeometry, SRGBColorSpace, Sprite, SpriteMaterial, Vector3, type Object3D, type Texture } from 'three';
import type { PlannedEffect } from './action-effect-plan';
import { SKILL_FX_DEFAULTS, SKILL_FX_TABLE, type SkillFxEffectTuning } from './skill-fx-table';

/** The sample champions: every row of the skill feel table (skill-fx-table.ts). */
export const SKILL_FEEL_SAMPLE: ReadonlySet<string> = new Set(Object.keys(SKILL_FX_TABLE));
/** `?skillfx=off` in the page address draws the sample champions as before (for side-by-side review). */
export function skillFeelFor(definitionId: string): boolean {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('skillfx') === 'off') return false;
  return SKILL_FEEL_SAMPLE.has(definitionId);
}
/** The charge color per sample champion (its main skin color); anything else charges in warm gold. */
export const skillColor = (definitionId: string): number => SKILL_FX_TABLE[definitionId]?.color ?? SKILL_FX_DEFAULTS.color;

/** Seconds of charge before a cast's own effects start. */
export const WINDUP_SECONDS = SKILL_FX_DEFAULTS.windup;
/** Seconds the caster and its targets hold still at the impact. */
export const HITSTOP_SECONDS = SKILL_FX_DEFAULTS.impact.hold;
/** A sample cast's impact: hold seconds, camera kick strength, and whether a ring bursts at each target. */
export const impactFeel = (definitionId: string): { hold: number; kick: number; ring: boolean; ringDelay?: number } =>
  ({ ...(SKILL_FX_TABLE[definitionId]?.impact ?? SKILL_FX_DEFAULTS.impact) });
/** Live particles one cast effect of a sample champion may have (the shared budget still caps the whole board). */
export const CAST_PARTICLE_CAP = SKILL_FX_DEFAULTS.effect.particles;
/** Every row's per-effect overrides, by effect id (ids carry their champion's prefix, so they never collide). */
const EFFECT_TUNING: ReadonlyMap<string, SkillFxEffectTuning> = new Map(Object.values(SKILL_FX_TABLE).flatMap(row => Object.entries(row.effects ?? {})));
/** A sample cast effect's size factor and live-particle limit. */
export const castEffectTuning = (id: string): { scale: number; particles: number } => ({ ...(EFFECT_TUNING.get(id) ?? SKILL_FX_DEFAULTS.effect) });
const RELEASE_SECONDS = 0.14, SHAKE_SECONDS = 0.16, SHAKE_AMPLITUDE = 1.6, SHAKE_GAP = 0.35;

/** A sample champion's cast plan: trimmed to its kept effects, none starting before the charge has finished. */
export function simplifyCast(definitionId: string, plan: readonly PlannedEffect[]): PlannedEffect[] {
  const keep = SKILL_FX_TABLE[definitionId]?.keepCast;
  return (keep ? plan.filter(entry => keep.includes(entry.id)) : [...plan]).map(entry => entry.playback.delay >= WINDUP_SECONDS ? entry
    : { id: entry.id, playback: { ...entry.playback, delay: WINDUP_SECONDS } });
}

/** Seconds after the cast event that its impact lands: its first effect on the target, else just after the release. */
export function impactDelay(plan: readonly PlannedEffect[], fallback = WINDUP_SECONDS + 0.15): number {
  const hits = plan.filter(entry => entry.playback.anchor === 'target').map(entry => entry.playback.delay);
  return hits.length ? Math.max(WINDUP_SECONDS, Math.min(...hits)) : fallback;
}

/** Charge then release, for one cast: ring radius share and glow/ring opacity at `age` seconds. */
export function windupEnvelope(age: number): { ring: number; opacity: number; glow: number } | null {
  if (age < 0 || age >= WINDUP_SECONDS + RELEASE_SECONDS) return null;
  if (age < WINDUP_SECONDS) {
    const t = age / WINDUP_SECONDS;
    return { ring: 1.7 - 0.8 * t * (2 - t), opacity: 0.25 + 0.65 * t, glow: 0.15 + 0.45 * t };
  }
  const t = (age - WINDUP_SECONDS) / RELEASE_SECONDS;
  return { ring: 0.9 + 0.8 * t, opacity: 0.9 * (1 - t), glow: 0.6 * (1 - t) };
}

// 10-24 GPU review: the first tracer (6 units, two ghosts) was barely visible; twice the size with a four-step tail.
const ATTACK_COLOR = 0xfff4e6, TRACER_SECONDS = 0.16, SPARK_SECONDS = 0.12, TRACER_SIZE = 12, SPARK_SIZE = 26, TRAIL = 4, TRAIL_GAP = 0.022;
const IMPACT_SECONDS = 0.28;
const SPRITES = 96, CHARGES = 8, IMPACTS = 8;

function glowTexture(): Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(0.25, 'rgba(255,255,255,0.75)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient; g.fillRect(0, 0, 64, 64);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}

interface Pulse { sprite: Sprite; age: number; from: Vector3; to: Vector3 | null; trail: number }
interface Charge { ring: Mesh<RingGeometry, MeshBasicMaterial>; glow: Sprite; age: number; follow: Object3D; height: number; radius: number }
interface Impact { ring: Mesh<RingGeometry, MeshBasicMaterial>; flash: Sprite; age: number; at: Vector3; radius: number }

export interface SkillFeel {
  /** Scene child holding every pooled object (all hidden while unused). */
  readonly object: Group;
  /** Starts a charge under `follow` (a piece root), `radius` board units across its ring, its glow at `height`. */
  charge(follow: Object3D, color: number, radius: number, height: number): void;
  /** A basic attack: a tracer from `from` to `to` when ranged, a spark at `to` either way, after `delay` seconds. */
  attack(from: Vector3, to: Vector3, ranged: boolean, delay: number): void;
  /** A ring in `color` bursting at `at` (a target's feet), `radius` board units at its widest. */
  impact(at: Vector3, color: number, radius: number): void;
  /** A skill impact: a camera kick (`strength` times the usual), unless one is still settling. */
  kick(strength?: number): void;
  update(seconds: number): void;
  /** The camera's offset this frame (zero when still). */
  shake(out: Vector3): Vector3;
  /** Shows every pooled object for one shader compile (the host compiles, then calls it with false). */
  reveal(on: boolean): void;
  dispose(): void;
}

export function createSkillFeel(): SkillFeel {
  const object = new Group(); object.name = 'skill-feel';
  const texture = glowTexture();
  const free: Sprite[] = [], pulses = new Set<Pulse>(), charges = new Set<Charge>(), idleCharges: Charge[] = [];
  for (let i = 0; i < SPRITES; i++) {
    const sprite = new Sprite(new SpriteMaterial({ map: texture, color: ATTACK_COLOR, transparent: true, depthWrite: false, blending: AdditiveBlending }));
    sprite.visible = false; object.add(sprite); free.push(sprite);
  }
  const ringGeometry = new RingGeometry(0.82, 1, 48);
  for (let i = 0; i < CHARGES; i++) {
    const ring = new Mesh(ringGeometry, new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.visible = false;
    const glow = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: AdditiveBlending }));
    glow.visible = false; object.add(ring, glow);
    idleCharges.push({ ring, glow, age: 0, follow: object, height: 0, radius: 0 });
  }
  const impacts = new Set<Impact>(), idleImpacts: Impact[] = [];
  for (let i = 0; i < IMPACTS; i++) {
    const ring = new Mesh(ringGeometry, new MeshBasicMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.visible = false;
    const flash = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, blending: AdditiveBlending }));
    flash.visible = false; object.add(ring, flash);
    idleImpacts.push({ ring, flash, age: 0, at: new Vector3(), radius: 0 });
  }
  let shakeLeft = 0, shakeStrength = 1, sinceShake = Infinity, disposed = false;
  const at = new Vector3();
  const release = (pulse: Pulse) => { pulse.sprite.visible = false; free.push(pulse.sprite); pulses.delete(pulse); };
  return {
    object,
    charge(follow, color, radius, height) {
      const charge = idleCharges.pop() ?? [...charges][0];
      if (!charge) return;
      charges.add(charge);
      Object.assign(charge, { age: 0, follow, radius, height });
      charge.ring.material.color.setHex(color); charge.glow.material.color.setHex(color);
    },
    attack(from, to, ranged, delay) {
      // Ranged: the head and two fading ghosts behind it, then the spark; melee: the spark only.
      const parts = ranged ? [...Array.from({ length: TRAIL + 1 }, (_, i) => i), -1] : [-1];
      for (const trail of parts) {
        const sprite = free.pop();
        if (!sprite) return; // pool spent: a crowded fight draws fewer attacks, never more objects
        if (trail < 0) pulses.add({ sprite, age: -delay - (ranged ? TRACER_SECONDS : 0), from: to.clone(), to: null, trail });
        else pulses.add({ sprite, age: -delay - trail * TRAIL_GAP, from: from.clone(), to: to.clone(), trail });
      }
    },
    impact(at, color, radius) {
      const impact = idleImpacts.pop();
      if (!impact) return;
      impacts.add(impact); impact.age = 0; impact.at.copy(at); impact.radius = radius;
      impact.ring.material.color.setHex(color); impact.flash.material.color.setHex(color);
    },
    kick(strength = 1) { if (sinceShake < SHAKE_GAP) return; shakeLeft = SHAKE_SECONDS; shakeStrength = strength; sinceShake = 0; },
    update(seconds) {
      shakeLeft = Math.max(0, shakeLeft - seconds); sinceShake += seconds;
      for (const pulse of pulses) {
        pulse.age += seconds;
        const { sprite } = pulse;
        if (pulse.age < 0) { sprite.visible = false; continue; }
        if (pulse.to) {
          const t = pulse.age / TRACER_SECONDS;
          if (t >= 1) { release(pulse); continue; }
          sprite.position.lerpVectors(pulse.from, pulse.to, t);
          const size = TRACER_SIZE * (1 - pulse.trail * 0.17);
          sprite.scale.set(size, size, 1); sprite.material.opacity = 0.95 * (1 - pulse.trail / (TRAIL + 1));
        } else {
          const t = pulse.age / SPARK_SECONDS;
          if (t >= 1) { release(pulse); continue; }
          sprite.position.copy(pulse.from);
          const size = SPARK_SIZE * (0.45 + 0.55 * t);
          sprite.scale.set(size, size, 1); sprite.material.opacity = 0.9 * (1 - t);
        }
        sprite.visible = true;
      }
      for (const impact of impacts) {
        impact.age += seconds;
        const t = impact.age / IMPACT_SECONDS;
        if (t >= 1) { impact.ring.visible = impact.flash.visible = false; impacts.delete(impact); idleImpacts.push(impact); continue; }
        const out = 1 - (1 - t) ** 2;
        impact.ring.position.set(impact.at.x, impact.at.y + 1, impact.at.z); impact.ring.scale.setScalar(impact.radius * (0.3 + 0.7 * out));
        impact.ring.material.opacity = 0.95 * (1 - t);
        const flash = impact.radius * (0.9 + 0.6 * out);
        impact.flash.position.set(impact.at.x, impact.at.y + impact.radius * 0.6, impact.at.z);
        impact.flash.scale.set(flash, flash, 1); impact.flash.material.opacity = 0.7 * Math.max(0, 1 - t * 1.8);
        impact.ring.visible = impact.flash.visible = true;
      }
      for (const charge of charges) {
        charge.age += seconds;
        const envelope = windupEnvelope(charge.age);
        if (!envelope || !charge.follow.parent) {
          charge.ring.visible = charge.glow.visible = false; charges.delete(charge); idleCharges.push(charge); continue;
        }
        charge.follow.getWorldPosition(at);
        charge.ring.position.set(at.x, at.y + 0.8, at.z); charge.ring.scale.setScalar(charge.radius * envelope.ring);
        charge.ring.material.opacity = envelope.opacity;
        charge.glow.position.set(at.x, at.y + charge.height, at.z);
        const glow = charge.height * (1.1 + 0.5 * envelope.glow);
        charge.glow.scale.set(glow, glow * 1.4, 1); charge.glow.material.opacity = envelope.glow;
        charge.ring.visible = charge.glow.visible = true;
      }
    },
    shake(out) {
      if (shakeLeft <= 0) return out.set(0, 0, 0);
      const strength = SHAKE_AMPLITUDE * shakeStrength * shakeLeft / SHAKE_SECONDS;
      return out.set((Math.random() * 2 - 1) * strength, (Math.random() * 2 - 1) * strength * 0.5, (Math.random() * 2 - 1) * strength);
    },
    reveal(on) {
      for (const child of object.children) child.visible = on;
      if (!on) {
        for (const pulse of pulses) pulse.sprite.visible = pulse.age >= 0;
        for (const charge of charges) charge.ring.visible = charge.glow.visible = true;
        for (const impact of impacts) impact.ring.visible = impact.flash.visible = true;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true; object.removeFromParent();
      for (const child of object.children) ((child as Sprite | Mesh<RingGeometry, MeshBasicMaterial>).material).dispose();
      ringGeometry.dispose(); texture?.dispose(); object.clear(); pulses.clear(); charges.clear(); impacts.clear();
    },
  };
}
