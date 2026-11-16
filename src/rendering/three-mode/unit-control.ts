/**
 * Crowd control on a 3D piece (presentation only), from BoardPiece.control (BoardScene tells 击飞 from 眩晕 in
 * presentation/control-display.ts; the rules model both as a stun). While controlled the model stops its action and
 * its clip runs slow; two stars with short trails circle its head, with sparkles, a fading ring and an opening flash;
 * a knock-up throws the drawn body (and its bars) up on one arc that lands as a 0.5 s knock-up ends. Kept apart from
 * the renderer so the curve is testable on numbers.
 * Shapes follow the client's stun (two stars on opposite sides circling the head, sparkles, a
 * dissolving ring, a flash) and its knock-up (an arc that lands when the control ends), drawn with our own textures
 * and sizes (11-10 side-by-side, ccvs-*). Nothing here reads original assets.
 */
import { AdditiveBlending, CanvasTexture, Group, LinearFilter, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';

export type ControlKind = 'stun' | 'airborne';

export const CONTROL_3D = {
  /** Knock-up peak, as a share of the drawn model height (MODEL_HEIGHT 92 board units → ~46). */
  liftShare: 0.5,
  /**
   * A knock-up is one arc of this many seconds from its start, up and down (no hang at the top): it lands as a 0.5 s
   * knock-up ends, and a shorter one (shown for minShownSeconds) the same. The arc ignores riseSeconds/fallSeconds.
   */
  arcSeconds: 0.5,
  /** Rise and fall seconds for a motion made without arcSeconds (eases up, holds while airborne, drops once it ends). */
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
  /**
   * Stars around the head: count, ring radius and star sprite size (board units; the star itself fills about a third
   * of the sprite, the rest is its glow, like the client's star texture), turns per second, the ring centre's height
   * as a share of the drawn body height (head level), and the dark glow behind them. Calibrated on the 11-10 three-row
   * recordings (ccvs-after, -after2): the first cut drew stars and ring well over the client's and too
   * high; at 0.85 the ring still sat clearly over the client's (the drawn height includes helmets and hair), at 0.67
   * only slightly over (after3).
   */
  stars: 2, ringRadius: 11, starSize: 26, turnsPerSecond: 0.48, headShare: 0.6, glowSize: 32,
  /** Ghosts trailing each star: how many, the angle (radians) between them, and the first ghost's opacity. */
  trail: { ghosts: 3, gap: 0.28, opacity: 0.5 },
  /** Small sparkles popping around the ring: count, life (s), distance from the centre and size (board units). */
  sparkles: { count: 4, seconds: 0.5, radius: [8, 11], size: [12, 16] },
  /** Dissolving rings: count (staggered), seconds each, full size (board units); each grows from half size and fades. */
  rings: { count: 2, seconds: 1.5, size: 28 },
  /** The flash as the control starts: seconds and size (board units). */
  flash: { seconds: 0.15, size: 30 },
} as const;
/**
 * Vi's grab (rules: VI_SLAM_TICKS, a knock-up on the held target until her slam): the target goes up with her, hangs at
 * `peakShare` × the knock-up lift, and is slammed down in `slamSeconds` so it lands on the slam tick, where the rules
 * apply the damage and the stun. Rise and slam in seconds; the hold fills the rest. `viSlamTicks` copies the rules'
 * VI_SLAM_TICKS (a 3D module must not import the rules); tests/rendering3d-vi-grab.test.ts keeps the two equal.
 */
export const GRAB_3D = { riseSeconds: 0.2, slamSeconds: 0.08, peakShare: 2, viSlamTicks: 12 } as const;
/** Draw order of the stun effects: over the health bars (1001), which hid the old ring at board distance (11-09). */
export const STUN_RENDER_ORDER = 1003;
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

/**
 * A piece's lift share over time. With arcSeconds: one arc from a knock-up's start, 4t(1-t), landing after arcSeconds
 * whether the control is still on or not. Without: eases up while airborne, holds, and falls once it ends.
 */
export class ControlMotion {
  private kind: ControlKind | null = null;
  /** Seconds into the current knock-up arc (arc mode); null when not in the air. */
  private arc: number | null = null;
  private since = 0;
  private landing: number | null = null;
  private from = 0;
  private share = 0;
  /** Seconds the current control has been shown, and whether the rules already ended it before minShownSeconds. */
  private shown = 0;
  private releasePending = false;
  /** A grab (grab()): seconds into it and its length; null when none. It owns the lift until it lands. */
  private grabAt: number | null = null;
  private grabSeconds = 0;
  constructor(private readonly spec: { readonly riseSeconds: number; readonly fallSeconds: number; readonly arcSeconds?: number; readonly minShownSeconds?: number; readonly leanRadians?: number } = CONTROL_3D) {}
  get control(): ControlKind | null { return this.kind; }
  /** Lift share now: 0 on the floor, 1 at the top. */
  get lift(): number { return this.share; }
  /** Backward lean (radians) of a knocked-up body: follows the lift, so it straightens as it lands. */
  get lean(): number { return Math.min(1, this.share) * (this.spec.leanRadians ?? 0); }
  /** True from a control's start until the piece is back on the floor. */
  get active(): boolean { return this.kind !== null || this.share > 0 || this.arc !== null || this.grabAt !== null; }
  /**
   * Held up for `seconds` and slammed down to land as they end (GRAB_3D): replaces a knock-up arc already in flight, and
   * a knock-up shown during the grab starts no arc of its own.
   */
  grab(seconds: number): void {
    if (!(Number.isFinite(seconds) && seconds > 0)) return;
    this.grabAt = 0; this.grabSeconds = seconds; this.arc = null; this.landing = null;
  }
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
    if (this.spec.arcSeconds !== undefined) {
      // Arc mode: a knock-up starts a new arc; ending or changing the control leaves the arc in flight until it lands.
      if (kind === 'airborne' && this.arc === null && this.grabAt === null) this.arc = 0;
    } else if (kind === 'airborne') { this.since = 0; this.landing = null; }
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
    if (this.grabAt !== null) {
      this.grabAt += seconds;
      const total = this.grabSeconds, slam = Math.min(GRAB_3D.slamSeconds, total / 2), rise = Math.min(GRAB_3D.riseSeconds, total - slam);
      const t = this.grabAt;
      if (t >= total) { this.grabAt = null; this.share = 0; }
      else if (t < rise) this.share = GRAB_3D.peakShare * easeOutCubic(t / rise);
      else if (t < total - slam) this.share = GRAB_3D.peakShare;
      else this.share = GRAB_3D.peakShare * (1 - easeInQuad((t - (total - slam)) / slam));
      return this.share;
    }
    const arcSeconds = this.spec.arcSeconds;
    if (arcSeconds !== undefined) {
      if (this.arc !== null) {
        this.arc += seconds;
        const t = arcSeconds > 0 ? this.arc / arcSeconds : 1;
        if (t >= 1) { this.arc = null; this.share = 0; } else this.share = 4 * t * (1 - t);
      } else this.share = 0;
      return this.share;
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
  clear(): void { this.kind = null; this.arc = null; this.landing = null; this.share = 0; this.from = 0; this.shown = 0; this.releasePending = false; this.grabAt = null; }
}

let starTexture: CanvasTexture | null = null;
/**
 * One bright gold five-point star (about a third of the sprite) in a warm glow filling the rest, shared by every stun
 * (never disposed: a few KB for the page's life).
 */
function starMap(): CanvasTexture | null {
  if (starTexture || typeof document === 'undefined') return starTexture;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  if (!g) return null;
  if (typeof g.createRadialGradient === 'function') {
    const halo = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    halo.addColorStop(0, 'rgba(255,214,110,0.75)'); halo.addColorStop(0.35, 'rgba(255,170,40,0.35)'); halo.addColorStop(1, 'rgba(255,150,0,0)');
    g.fillStyle = halo; g.fillRect(0, 0, 64, 64);
  }
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 3.3 : 8, a = -Math.PI / 2 + i * Math.PI / 5;
    g.lineTo(32 + r * Math.cos(a), 32 + r * Math.sin(a));
  }
  g.closePath();
  g.shadowColor = 'rgba(255,170,0,0.9)'; g.shadowBlur = 4;
  g.fillStyle = '#ffe680'; g.fill(); g.lineWidth = 1; g.strokeStyle = '#fff8d8'; g.stroke();
  starTexture = new CanvasTexture(canvas); starTexture.colorSpace = SRGBColorSpace; starTexture.minFilter = LinearFilter;
  return starTexture;
}

let ringTexture: CanvasTexture | null = null;
/** A thin soft annulus (white, tinted by the sprite's color), shared by every dissolving ring. */
function ringMap(): CanvasTexture | null {
  if (ringTexture || typeof document === 'undefined') return ringTexture;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  if (!g || typeof g.createRadialGradient !== 'function') return null;
  const gradient = g.createRadialGradient(32, 32, 18, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,0)'); gradient.addColorStop(0.55, 'rgba(255,255,255,1)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient; g.fillRect(0, 0, 64, 64);
  ringTexture = new CanvasTexture(canvas); ringTexture.colorSpace = SRGBColorSpace; ringTexture.minFilter = LinearFilter;
  return ringTexture;
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
  /** Back to the start (angle, flash, sparkles), so a pooled stun starts like a new one. */
  reset(): void;
  dispose(): void;
}

/** Fixed pseudo-random 0..1 from an integer (sparkle placement stays the same run to run, for recordings and tests). */
const jitter = (n: number) => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

/**
 * The stun around the head (billboards drawn over the model and the bars): a dark glow, two stars circling with short
 * trails, a few sparkles popping in and out, two staggered rings that grow and dissolve, and a flash as it starts.
 */
export function createStunHalo(spec = CONTROL_3D): StunHalo {
  const object = new Group(); object.name = 'render3d-stun';
  const sprite = (name: string, material: SpriteMaterial, order = STUN_RENDER_ORDER) => {
    const s = new Sprite(material); s.name = name; s.renderOrder = order; object.add(s); return s;
  };
  const materials: SpriteMaterial[] = [];
  const make = (map: CanvasTexture | null, color: string, opacity = 1, additive = false) => {
    const m = new SpriteMaterial({ map, color, opacity, depthTest: false, depthWrite: false, transparent: true, toneMapped: false, ...(additive ? { blending: AdditiveBlending } : {}) });
    materials.push(m); return m;
  };
  // A dark glow behind the stars sets them off against a bright board (the client darkens behind its stun too).
  const glow = sprite('render3d-stun-glow', make(glowMap(), '#1c1030', 0.5), STUN_RENDER_ORDER - 1);
  glow.scale.set(spec.glowSize, spec.glowSize * 0.6, 1);
  const starMaterial = make(starMap(), '#ffffff');
  const stars: Sprite[] = [];
  for (let i = 0; i < spec.stars; i++) {
    const star = sprite(`render3d-stun-star-${i}`, starMaterial, STUN_RENDER_ORDER + 1);
    star.scale.set(spec.starSize, spec.starSize, 1); stars.push(star);
  }
  // Trails: fading, shrinking copies of each star a little behind it on the ring.
  const trails: { sprite: Sprite; star: number; lag: number }[] = [];
  for (let i = 0; i < spec.stars; i++) for (let j = 1; j <= spec.trail.ghosts; j++) {
    const fade = 1 - (j - 1) / spec.trail.ghosts;
    const ghost = sprite(`render3d-stun-trail-${i}-${j}`, make(starMap(), '#ffd36b', spec.trail.opacity * fade, true));
    const size = spec.starSize * (1 - 0.15 * j); ghost.scale.set(size, size, 1);
    trails.push({ sprite: ghost, star: i, lag: j * spec.trail.gap });
  }
  const sparkles = Array.from({ length: spec.sparkles.count }, (_, i) => ({ sprite: sprite(`render3d-stun-sparkle-${i}`, make(starMap(), '#fff3b0', 0, true)), born: -i * spec.sparkles.seconds / spec.sparkles.count, round: 0, index: i }));
  const rings = Array.from({ length: spec.rings.count }, (_, i) => ({ sprite: sprite(`render3d-stun-ring-${i}`, make(ringMap(), '#ff9a2e', 0, true), STUN_RENDER_ORDER - 1), offset: i * spec.rings.seconds / spec.rings.count }));
  const flashMaterial = make(glowMap(), '#fffbe8', 0, true);
  const flash = sprite('render3d-stun-flash', flashMaterial, STUN_RENDER_ORDER + 2);
  let angle = 0, age = 0;
  const ringPoint = (a: number) => [Math.cos(a) * spec.ringRadius, Math.sin(a) * spec.ringRadius * 0.18, Math.sin(a) * spec.ringRadius] as const;
  const place = () => {
    // A tilted ring: the near side dips a little, so the circling reads in perspective.
    stars.forEach((star, i) => star.position.set(...ringPoint(angle + i * Math.PI * 2 / stars.length)));
    for (const t of trails) t.sprite.position.set(...ringPoint(angle + t.star * Math.PI * 2 / stars.length - t.lag));
    const { seconds: life, radius: [r0, r1], size: [s0, s1] } = spec.sparkles;
    for (const s of sparkles) {
      while (age - s.born >= life) { s.born += life; s.round++; }
      const t = (age - s.born) / life, alive = age >= s.born;
      const n = s.index * 101 + s.round * 7, a = jitter(n) * Math.PI * 2, r = r0 + (r1 - r0) * jitter(n + 1), size = s0 + (s1 - s0) * jitter(n + 2);
      s.sprite.position.set(Math.cos(a) * r, (jitter(n + 3) - 0.5) * 10, Math.sin(a) * r);
      const shown = alive ? Math.sin(Math.PI * t) : 0; s.sprite.scale.set(size * (0.6 + 0.4 * shown), size * (0.6 + 0.4 * shown), 1);
      (s.sprite.material as SpriteMaterial).opacity = shown;
    }
    for (const ring of rings) {
      const t = ((age + ring.offset) % spec.rings.seconds) / spec.rings.seconds, size = spec.rings.size * (0.5 + 0.5 * t);
      ring.sprite.scale.set(size, size * 0.35, 1);
      (ring.sprite.material as SpriteMaterial).opacity = 0.7 * Math.sin(Math.PI * t) * (1 - t * 0.5);
    }
    const f = Math.min(1, age / spec.flash.seconds), fs = spec.flash.size * (0.6 + 0.6 * f);
    flash.scale.set(fs, fs, 1); flashMaterial.opacity = age < spec.flash.seconds ? 0.85 * (1 - f * f) : 0;
  };
  place();
  return {
    object,
    update(seconds) { age += seconds; angle = (angle + seconds * spec.turnsPerSecond * Math.PI * 2) % (Math.PI * 2); place(); },
    reset() { angle = 0; age = 0; for (const s of sparkles) { s.born = -s.index * spec.sparkles.seconds / spec.sparkles.count; s.round = 0; } place(); },
    dispose() { object.removeFromParent(); object.clear(); for (const m of materials) m.dispose(); },
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
