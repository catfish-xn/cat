/**
 * Crowd control on a 3D piece (presentation only), from BoardPiece.control (BoardScene tells 击飞 from 眩晕 in
 * presentation/control-display.ts; the rules model both as a stun). While controlled the model stops its action and
 * its clip runs slow; a ring of stars circles over its head; a knock-up lifts the drawn body (and its bars) off the
 * cell until the control ends, then it drops back. Kept apart from the renderer so the curve is testable on numbers.
 * Heights and times are first guesses, to be calibrated against the research notes.
 */
import { CanvasTexture, Group, LinearFilter, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

export type ControlKind = 'stun' | 'airborne';

export const CONTROL_3D = {
  /** Knock-up lift, as a share of the drawn model height (MODEL_HEIGHT 92 board units → ~83). */
  liftShare: 0.9,
  /** Seconds to reach the top, and to fall back once the control ends. */
  riseSeconds: 0.18,
  fallSeconds: 0.22,
  /** Mixer time scale while controlled (0 freezes the pose; TFT's stunned units sway slowly). */
  clipTimeScale: 0.25,
  /**
   * A control is drawn for at least this long once it starts (presentation only; the rules' duration is untouched):
   * a 0.25 s knock-up otherwise ends before the body has even reached the top (11-09 field recording).
   */
  minShownSeconds: 0.5,
  /** A knocked-up body leans back by this much (radians) at the top of its lift. */
  leanRadians: 0.3,
  /** Star ring over the head: stars, ring radius and star size (board units), turns per second, and the glow disc under them. */
  stars: 3, ringRadius: 28, starSize: 22, turnsPerSecond: 0.8, glowSize: 76,
} as const;
/** The white burst on a unit struck by an ability (board units, seconds). */
export const HIT_FLASH_3D = { size: 58, seconds: 0.14 } as const;

/**
 * Forced moves the rules tag on their movement event (pulled, grabbed, knocked back): drawn as a short hop along the
 * slide instead of a run, the unit being moved rather than walking. Tags from the displacement rules (莫德凯撒/瑟提/赛维卡).
 */
export const DISPLACEMENT_REASONS: ReadonlySet<string> = new Set(['mordekaiser-pull', 'sett-grab', 'sevika-knockback', 'vander-knockback']);
export const DISPLACEMENT_HOP = { seconds: 0.3, liftShare: 0.15 } as const;
/** Hop share (0..1) `elapsed` seconds into a displacement hop: one arc, 0 once over. */
export const displacementHop = (elapsed: number, seconds = DISPLACEMENT_HOP.seconds): number =>
  seconds > 0 && elapsed > 0 && elapsed < seconds ? Math.sin(Math.PI * elapsed / seconds) : 0;

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInQuad = (t: number) => t * t;

/** A piece's lift share over time: eases up while airborne, holds, and falls from wherever it was once it ends. */
export class ControlMotion {
  private kind: ControlKind | null = null;
  private since = 0;
  private landing: number | null = null;
  private from = 0;
  private share = 0;
  /** Seconds the current control has been shown, and whether the rules already ended it before minShownSeconds. */
  private shown = 0;
  private releasePending = false;
  constructor(private readonly spec: { readonly riseSeconds: number; readonly fallSeconds: number; readonly minShownSeconds?: number; readonly leanRadians?: number } = CONTROL_3D) {}
  get control(): ControlKind | null { return this.kind; }
  /** Lift share now: 0 on the floor, 1 at the top. */
  get lift(): number { return this.share; }
  /** Backward lean (radians) of a knocked-up body: follows the lift, so it straightens as it lands. */
  get lean(): number { return this.share * (this.spec.leanRadians ?? 0); }
  /** True from a control's start until the piece is back on the floor. */
  get active(): boolean { return this.kind !== null || this.share > 0; }
  /** The control shown now; returns true when one has just started (the host stops the piece's action). */
  set(kind: ControlKind | null): boolean {
    if (kind === null && this.kind !== null && this.shown < (this.spec.minShownSeconds ?? 0)) { this.releasePending = true; return false; }
    this.releasePending = false;
    return this.change(kind);
  }
  private change(kind: ControlKind | null): boolean {
    if (kind === this.kind) return false;
    const started = this.kind === null && kind !== null;
    if (started) this.shown = 0;
    if (kind === 'airborne') { this.since = 0; this.landing = null; }
    else if (this.kind === 'airborne') { this.from = this.share; this.landing = 0; }
    this.kind = kind;
    return started;
  }
  update(seconds: number): number {
    const { riseSeconds: rise, fallSeconds: fall } = this.spec;
    if (this.kind !== null) {
      this.shown += seconds;
      if (this.releasePending && this.shown >= (this.spec.minShownSeconds ?? 0)) { this.releasePending = false; this.change(null); }
    }
    if (this.landing !== null) {
      this.landing += seconds;
      this.share = this.landing >= fall || !(fall > 0) ? 0 : this.from * (1 - easeInQuad(this.landing / fall));
      if (this.share === 0) this.landing = null;
    } else if (this.kind === 'airborne') {
      this.since += seconds;
      this.share = !(rise > 0) || this.since >= rise ? 1 : easeOutCubic(this.since / rise);
    } else this.share = 0;
    return this.share;
  }
  /** Back on the floor with no control (a new combat, a reset action). */
  clear(): void { this.kind = null; this.landing = null; this.share = 0; this.from = 0; this.shown = 0; this.releasePending = false; }
}

let starTexture: CanvasTexture | null = null;
/** One yellow five-point star with a dark rim, shared by every ring (never disposed: a few KB for the page's life). */
function starMap(): CanvasTexture | null {
  if (starTexture || typeof document === 'undefined') return starTexture;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 12 : 28, a = -Math.PI / 2 + i * Math.PI / 5;
    g.lineTo(32 + r * Math.cos(a), 32 + r * Math.sin(a));
  }
  g.closePath(); g.fillStyle = '#ffd84d'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#5a3d00'; g.stroke();
  starTexture = new CanvasTexture(canvas); starTexture.colorSpace = SRGBColorSpace; starTexture.minFilter = LinearFilter;
  return starTexture;
}

let glowTexture: CanvasTexture | null = null;
/** A soft radial disc (white centre, transparent rim), tinted by the sprite's color; shared by every glow and flash. */
function glowMap(): CanvasTexture | null {
  if (glowTexture || typeof document === 'undefined') return glowTexture;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  if (!g || typeof g.createRadialGradient !== 'function') return null;
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient; g.fillRect(0, 0, 64, 64);
  glowTexture = new CanvasTexture(canvas); glowTexture.colorSpace = SRGBColorSpace; glowTexture.minFilter = LinearFilter;
  return glowTexture;
}

export interface StunHalo {
  /** Scene child: the host moves it over the piece's head each frame. */
  readonly object: Group;
  update(seconds: number): void;
  /** Back to the starting angle, so a pooled ring starts like a new one. */
  reset(): void;
  dispose(): void;
}

/** Stars circling the head (billboards, drawn over the model like the bars). */
export function createStunHalo(spec = CONTROL_3D): StunHalo {
  const object = new Group(); object.name = 'render3d-stun';
  const material = new SpriteMaterial({ map: starMap(), color: '#ffffff', depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
  // A faint yellow glow behind the ring, so the control reads at board distance even where a star is behind the bar.
  const glowMaterial = new SpriteMaterial({ map: glowMap(), color: '#ffd84d', opacity: 0.38, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
  const glow = new Sprite(glowMaterial); glow.name = 'render3d-stun-glow'; glow.scale.set(spec.glowSize, spec.glowSize * 0.5, 1); glow.renderOrder = 999;
  object.add(glow);
  const stars: Sprite[] = [];
  for (let i = 0; i < spec.stars; i++) {
    const star = new Sprite(material); star.name = `render3d-stun-star-${i}`;
    star.scale.set(spec.starSize, spec.starSize, 1); star.renderOrder = 1000;
    object.add(star); stars.push(star);
  }
  let angle = 0;
  const place = () => stars.forEach((star, i) => {
    const a = angle + i * Math.PI * 2 / stars.length;
    // A tilted ring: the near side dips a little, so the circling reads in perspective.
    star.position.set(Math.cos(a) * spec.ringRadius, Math.sin(a) * spec.ringRadius * 0.18, Math.sin(a) * spec.ringRadius);
  });
  place();
  return {
    object,
    update(seconds) { angle = (angle + seconds * spec.turnsPerSecond * Math.PI * 2) % (Math.PI * 2); place(); },
    reset() { angle = 0; place(); },
    dispose() { object.removeFromParent(); object.clear(); material.dispose(); glowMaterial.dispose(); },
  };
}

export interface HitFlash {
  /** Scene child: the host places it at the struck body's middle. */
  readonly object: Sprite;
  /** Fades over HIT_FLASH_3D.seconds; returns false once spent (the host parks it). */
  update(seconds: number): boolean;
  /** Bright again, for the next strike. */
  reset(): void;
  dispose(): void;
}
/** The white burst on a body struck by an ability: a billboard disc that fades out in a few frames. */
export function createHitFlash(spec = HIT_FLASH_3D): HitFlash {
  const material = new SpriteMaterial({ map: glowMap(), color: '#ffffff', opacity: 0.85, depthTest: false, depthWrite: false, transparent: true, toneMapped: false });
  const object = new Sprite(material); object.name = 'render3d-hit-flash'; object.renderOrder = 998;
  let age = 0;
  const place = () => { const grow = 1 + age / spec.seconds * 0.35; object.scale.set(spec.size * grow, spec.size * grow, 1); material.opacity = 0.85 * Math.max(0, 1 - age / spec.seconds); };
  place();
  return {
    object,
    update(seconds) { age = Math.min(spec.seconds, age + seconds); place(); return age < spec.seconds; },
    reset() { age = 0; place(); },
    dispose() { object.removeFromParent(); material.dispose(); },
  };
}
